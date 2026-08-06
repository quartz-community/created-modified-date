import fs from "fs";
import { Repository } from "@napi-rs/simple-git";
import type { QuartzTransformerPlugin } from "@quartz-community/types";
import type { VFile } from "vfile";
import type { Root } from "mdast";
import path from "path";
import { styleText } from "util";

export interface CreatedModifiedDateOptions {
  priority: ("frontmatter" | "git" | "filesystem")[];
  defaultDateType: "created" | "modified" | "published";
}

const defaultOptions: CreatedModifiedDateOptions = {
  priority: ["frontmatter", "git", "filesystem"],
  defaultDateType: "modified",
};

// YYYY-MM-DD
const iso8601DateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

// Chinese date format: 2025年8月13日 14:30 / 2025年08月13日 14:30:00 / 2025年8月13日
const chineseDateRegex =
  /^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

function parseChineseDate(str: string): Date | null {
  const m = chineseDateRegex.exec(str);
  if (!m) return null;

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const hour = m[4] !== undefined ? parseInt(m[4], 10) : 0;
  const minute = m[5] !== undefined ? parseInt(m[5], 10) : 0;
  const second = m[6] !== undefined ? parseInt(m[6], 10) : 0;

  const dt = new Date(year, month, day, hour, minute, second);

  // Validate date (e.g. reject Feb 30)
  if (dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) {
    return null;
  }

  return dt;
}

function coerceDate(fp: string, d: unknown): Date {
  // check ISO8601 date-only format
  // we treat this one as local midnight as the normal
  // js date ctor treats YYYY-MM-DD as UTC midnight
  if (typeof d === "string" && iso8601DateOnlyRegex.test(d)) {
    d = `${d}T00:00:00`;
  }

  // Try parsing Chinese date format (e.g. "2025年8月13日 14:30")
  let parsed: Date | null = null;
  if (typeof d === "string") {
    parsed = parseChineseDate(d);
  }

  const dt =
    parsed !== null
      ? parsed
      : d === undefined
        ? new Date()
        : d === null
          ? new Date(0)
          : new Date(d as string | number | Date);
  const invalidDate = isNaN(dt.getTime()) || dt.getTime() === 0;
  if (invalidDate && d !== undefined) {
    console.log(
      styleText(
        "yellow",
        `\nWarning: found invalid date "${d}" in \`${fp}\`. Supported formats: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format`,
      ),
    );
  }

  return invalidDate ? new Date() : dt;
}

type MaybeDate = undefined | string | number | Date | null;
type FrontmatterDates = {
  created?: MaybeDate;
  modified?: MaybeDate;
  published?: MaybeDate;
};

type FileData = {
  relativePath?: string;
  filePath?: string;
  frontmatter?: FrontmatterDates;
  dates?: {
    created: Date;
    modified: Date;
    published: Date;
  };
  defaultDateType?: "created" | "modified" | "published";
};

export const CreatedModifiedDate: QuartzTransformerPlugin<Partial<CreatedModifiedDateOptions>> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts };
  return {
    name: "CreatedModifiedDate",
    markdownPlugins(ctx) {
      return [
        () => {
          let repo: Repository | undefined = undefined;
          let repositoryWorkdir: string;
          if (opts.priority.includes("git")) {
            try {
              repo = Repository.discover(ctx.argv.directory);
              repositoryWorkdir = repo.workdir() ?? ctx.argv.directory;
            } catch (e) {
              console.log(
                styleText(
                  "yellow",
                  `\nWarning: couldn't find git repository for ${ctx.argv.directory}`,
                ),
              );
            }
          }

          return async (_tree: Root, file: VFile) => {
            let created: MaybeDate = undefined;
            let modified: MaybeDate = undefined;
            let published: MaybeDate = undefined;

            const data = file.data as FileData;
            const fp = data.relativePath!;
            const fullFp = data.filePath!;
            for (const source of opts.priority) {
              if (source === "filesystem") {
                const st = await fs.promises.stat(fullFp);
                created ||= st.birthtimeMs;
                modified ||= st.mtimeMs;
              } else if (source === "frontmatter" && data.frontmatter) {
                created ||= data.frontmatter.created;
                modified ||= data.frontmatter.modified;
                published ||= data.frontmatter.published;
              } else if (source === "git" && repo) {
                try {
                  const relativePath = path.relative(repositoryWorkdir, fullFp);
                  modified ||= await repo.getFileLatestModifiedDateAsync(relativePath);
                } catch {
                  console.log(
                    styleText(
                      "yellow",
                      `\nWarning: ${data.filePath!} isn't yet tracked by git, dates will be inaccurate`,
                    ),
                  );
                }
              }
            }

            data.dates = {
              created: coerceDate(fp, created),
              modified: coerceDate(fp, modified),
              published: coerceDate(fp, published),
            };
            data.defaultDateType = opts.defaultDateType;
          };
        },
      ];
    },
  };
};
