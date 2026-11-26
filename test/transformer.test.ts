import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { VFile } from "vfile";
import type { BuildCtx } from "@quartz-community/types";
import { CreatedModifiedDate, gitRelativePath, realPathOrResolved } from "../src/transformer.js";

describe("gitRelativePath", () => {
  // git stores paths with "/" on every OS; path.relative on Windows gives backslashes
  it("joins with forward slashes on Windows", () => {
    expect(gitRelativePath("C:\\site", "C:\\site\\content\\notes\\a.md", path.win32)).toBe(
      "content/notes/a.md",
    );
  });

  it("leaves POSIX paths as they are", () => {
    expect(gitRelativePath("/site", "/site/content/notes/a.md", path.posix)).toBe(
      "content/notes/a.md",
    );
  });
});

describe("git dates", () => {
  let root: string;
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      timeout: 30_000,
      stdio: "pipe",
      // the plugin reads the commit (committer) date
      env: { ...process.env, GIT_COMMITTER_DATE: "2024-03-05T12:00:00Z" },
    });

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "created-modified-date-"));
    fs.mkdirSync(path.join(root, "content", "notes"), { recursive: true });
    fs.writeFileSync(path.join(root, "content", "notes", "a.md"), "# A\n");
    git("init", "-q");
    git("add", ".");
    git(
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.com",
      "commit",
      "-q",
      "-m",
      "a",
      "--date=2024-03-05T12:00:00Z",
    );
  });

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("reads the last commit date of a note in a folder", async () => {
    const ctx = { argv: { directory: path.join(root, "content") } } as unknown as BuildCtx;
    const [factory] = CreatedModifiedDate({ priority: ["git"] }).markdownPlugins!(ctx) as [
      () => (tree: unknown, file: VFile) => Promise<void>,
    ];
    const file = new VFile("");
    file.data = {
      relativePath: "notes/a.md",
      filePath: path.join(root, "content", "notes", "a.md"),
    } as never;
    await factory()({ type: "root", children: [] }, file);
    const dates = (file.data as { dates?: { modified?: Date } }).dates;
    expect(dates?.modified?.toISOString()).toBe("2024-03-05T12:00:00.000Z");
  });
});

describe("git dates with a symlinked content folder", () => {
  // content/ -> a vault kept in its own git repository outside the project (issue #2)
  let base: string;
  let vault: string;
  let project: string;
  const commit = (cwd: string, date: string) => {
    const run = (...args: string[]) =>
      execFileSync("git", args, {
        cwd,
        timeout: 30_000,
        stdio: "pipe",
        env: { ...process.env, GIT_COMMITTER_DATE: date },
      });
    run("init", "-q");
    run("add", ".");
    run("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "a");
  };
  const runPlugin = async (directory: string, filePath: string) => {
    const ctx = { argv: { directory } } as unknown as BuildCtx;
    const [factory] = CreatedModifiedDate({ priority: ["git"] }).markdownPlugins!(ctx) as [
      () => (tree: unknown, file: VFile) => Promise<void>,
    ];
    const file = new VFile("");
    file.data = { relativePath: "notes/a.md", filePath } as never;
    await factory()({ type: "root", children: [] }, file);
    return (file.data as { dates?: { modified?: Date } }).dates?.modified?.toISOString();
  };

  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "created-modified-date-link-"));
    vault = path.join(base, "vault");
    project = path.join(base, "project");
    fs.mkdirSync(path.join(vault, "notes"), { recursive: true });
    fs.writeFileSync(path.join(vault, "notes", "a.md"), "# A\n");
    commit(vault, "2024-06-07T08:00:00Z");
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(project, "README.md"), "project\n");
    commit(project, "2020-01-01T00:00:00Z");
    fs.symlinkSync(vault, path.join(project, "content"), "dir");
  });

  afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

  it("reads the vault repository's commit date through the link (absolute path)", async () => {
    expect(
      await runPlugin(
        path.join(project, "content"),
        path.join(project, "content", "notes", "a.md"),
      ),
    ).toBe("2024-06-07T08:00:00.000Z");
  });

  it("reads it for a project-relative path, as Quartz passes it", async () => {
    const cwd = process.cwd();
    process.chdir(project);
    try {
      expect(await runPlugin("content", path.join("content", "notes", "a.md"))).toBe(
        "2024-06-07T08:00:00.000Z",
      );
    } finally {
      process.chdir(cwd);
    }
  });

  it("realPathOrResolved falls back to an absolute path for a dangling link", () => {
    const dangling = path.join(base, "dangling");
    fs.symlinkSync(path.join(base, "missing"), dangling);
    expect(realPathOrResolved(dangling)).toBe(path.resolve(dangling));
  });
});
