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

type DateType = "created" | "modified" | "published";

/**
 * A date value from frontmatter, git or the file system as a `Date`, or `undefined` when it
 * doesn't give one (missing, `null`, empty, the epoch, or a value `Date` can't parse; the last
 * prints a warning). ISO 8601 date-only values (`2024-03-05`) are local midnight: the `Date`
 * constructor would read them as UTC midnight.
 */
export function parseDate(fp: string, d: unknown): Date | undefined {
  if (d === undefined || d === null || d === "") return undefined;
  if (typeof d === "string" && iso8601DateOnlyRegex.test(d)) {
    d = `${d}T00:00:00`;
  }
  const dt =
    d instanceof Date ? d : typeof d === "string" || typeof d === "number" ? new Date(d) : null;
  if (!dt || isNaN(dt.getTime()) || dt.getTime() === 0) {
    console.log(
      styleText(
        "yellow",
        `\nWarning: found invalid date "${String(d)}" in \`${fp}\`. Supported formats: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format`,
      ),
    );
    return undefined;
  }
  return dt;
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
  defaultDateType?: DateType;
  fallbackDates?: DateType[];
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
          const useGit = opts.priority.includes("git");
          // Git is looked up per file: the content folder may be outside any repository while a
          // (symlinked) folder in it is a vault with its own. Notes outside every repository get
          // their dates from the next source; a directory without one is reported once.
          const contentHasRepo =
            useGit && findRepo(realPathOrResolved(ctx.argv.directory)) !== undefined;
          if (useGit && !contentHasRepo) {
            console.log(
              styleText(
                "yellow",
                `\nWarning: couldn't find git repository for ${ctx.argv.directory}; notes outside a git repository get no git dates`,
              ),
            );
          }
          const reportedDirs = new Set<string>();

          return async (_tree: Root, file: VFile) => {
            let created: Date | undefined = undefined;
            let modified: Date | undefined = undefined;
            let published: Date | undefined = undefined;

            const data = file.data as FileData;
            const fp = data.relativePath!;
            const fullFp = data.filePath!;
            for (const source of opts.priority) {
              if (source === "filesystem") {
                const st = await fs.promises.stat(fullFp);
                // (some file systems have no birth time: 0)
                if (st.birthtimeMs > 0) created ??= new Date(st.birthtimeMs);
                if (st.mtimeMs > 0) modified ??= new Date(st.mtimeMs);
              } else if (source === "frontmatter" && data.frontmatter) {
                // an invalid value is skipped (with a warning): the next source fills the date
                created ??= parseDate(fp, data.frontmatter.created);
                modified ??= parseDate(fp, data.frontmatter.modified);
                published ??= parseDate(fp, data.frontmatter.published);
              } else if (source === "git" && useGit && !modified) {
                const realFp = realPathOrResolved(fullFp);
                const dir = path.dirname(realFp);
                const git = findRepo(dir);
                if (!git) {
                  // with no repository for the content folder that was reported above
                  if (contentHasRepo && !reportedDirs.has(dir)) {
                    reportedDirs.add(dir);
                    console.log(
                      styleText("yellow", `\nWarning: couldn't find git repository for ${dir}`),
                    );
                  }
                  continue;
                }
                try {
                  modified = parseDate(
                    fp,
                    await git.repo.getFileLatestModifiedDateAsync(
                      gitRelativePath(git.workdir, realFp),
                    ),
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

            // A date no source gave is the build time, so every page has one (RSS, sitemaps
            // and page lists sort by it). Those stand-ins are listed in \`fallbackDates\`, so
            // consumers can tell them apart from real dates (Quartz leaves them out of
            // contentIndex.json and the page's meta tags).
            const now = new Date();
            const fallbackDates: DateType[] = [];
            const orNow = (type: DateType, d: Date | undefined): Date => {
              if (d) return d;
              fallbackDates.push(type);
              return new Date(now);
            };
            data.dates = {
              created: orNow("created", created),
              modified: orNow("modified", modified),
              published: orNow("published", published),
            };
            data.fallbackDates = fallbackDates;
            data.defaultDateType = opts.defaultDateType;
          };
        },
      ];
    },
  };
};
