## 1.0.3

### Patch Changes

- 77682ba: Git dates of notes in folders work on Windows. The note's path was passed to git with Windows separators (`content\notes\a.md`), while git stores `/`-separated paths, so every note outside the top folder could fall back to "isn't yet tracked by git" and got its filesystem date. The path is now always `/`-separated.

## 1.0.2

### Patch Changes

- 6618dd1: Releases are published from GitHub Actions with npm trusted publishing, so each version on npm now carries provenance linking it to the commit and workflow that built it. No changes to the package itself.

## 1.0.1

### Patch Changes

- Widen the `@napi-rs/simple-git` peer range to `^0.1.19 || ^1.0.0`.

  Quartz core now depends on `@napi-rs/simple-git@1.x`, which fell outside the previous
  peer range and caused `npm install`/`npm ci` to fail with ERESOLVE. Widening is additive
  and does not break existing consumers on 0.1.x.

# Changelog

## 1.0.0

### Major Changes

- Stable 1.0 release. All `@quartz-community/*` dependencies now use `^1.0.0` ranges.

  Pre-1.0 caret ranges pinned the minor version (`^0.2.1` means `>=0.2.1 <0.3.0`), so
  published fixes to shared packages could never be resolved by dependents. Moving the
  ecosystem to 1.0 makes caret ranges behave conventionally.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Quartz community plugin template.
