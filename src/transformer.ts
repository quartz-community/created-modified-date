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

function coerceDate(fp: string, d: unknown): Date {
  // check ISO8601 date-only format
  // we treat this one as local midnight as the normal
  // js date ctor treats YYYY-MM-DD as UTC midnight
  if (typeof d === "string" && iso8601DateOnlyRegex.test(d)) {
    d = `${d}T00:00:00`;
  }

  const dt =
    d === undefined ? new Date() : d === null ? new Date(0) : new Date(d as string | number | Date);
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

/**
 * A file's path inside its git repository, `/`-separated as git stores it. On Windows
 * `path.relative` gives `content\\notes\\a.md`, which names no file in git's history, so
 * every note in a folder fell back to "isn't yet tracked by git".
 */
export function gitRelativePath(
  workdir: string,
  filePath: string,
  pathModule: Pick<typeof path, "relative" | "sep"> = path,
): string {
  return pathModule.relative(workdir, filePath).split(pathModule.sep).join("/");
}

/**
 * `p` with every symlink resolved, or just made absolute when it can't be resolved (a dangling
 * link keeps the old behaviour: a "not tracked by git" warning instead of a hard failure).
 */
export function realPathOrResolved(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

type GitRepo = { repo: Repository; workdir: string };

/**
 * Finds the git repository of each file's *real* location. `content/` (or a folder in it) is
 * often a symlink to an Obsidian vault kept in its own repository: `Repository.discover` follows
 * the link, so the file path has to be resolved the same way before it is made relative to the
 * repository's workdir (otherwise it points back out of the repository and every lookup fails).
 * Results are cached per directory.
 */
export function createRepoFinder(
  discover: (dir: string) => Repository = (dir) => Repository.discover(dir),
) {
  const byDir = new Map<string, GitRepo | undefined>();
  return (dir: string): GitRepo | undefined => {
    if (byDir.has(dir)) return byDir.get(dir);
    let found: GitRepo | undefined;
    try {
      const repo = discover(dir);
      const workdir = repo.workdir();
      if (workdir) found = { repo, workdir: realPathOrResolved(workdir) };
    } catch {
      found = undefined;
    }
    byDir.set(dir, found);
    return found;
  };
}

export const CreatedModifiedDate: QuartzTransformerPlugin<Partial<CreatedModifiedDateOptions>> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts };
  return {
    name: "CreatedModifiedDate",
    markdownPlugins(ctx) {
      return [
        () => {
          const findRepo = createRepoFinder();
          let useGit = false;
          if (opts.priority.includes("git")) {
            useGit = findRepo(realPathOrResolved(ctx.argv.directory)) !== undefined;
            if (!useGit) {
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
              } else if (source === "git" && useGit && !modified) {
                try {
                  const realFp = realPathOrResolved(fullFp);
                  const git = findRepo(path.dirname(realFp));
                  if (!git) throw new Error(`no git repository for ${realFp}`);
                  modified = await git.repo.getFileLatestModifiedDateAsync(
                    gitRelativePath(git.workdir, realFp),
                  );
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
