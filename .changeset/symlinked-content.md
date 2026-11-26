---
"@quartz-community/created-modified-date": patch
---

fix: git dates resolve when `content/` (or a folder in it) is a symlink to a vault in another git repository. The file path is resolved with `realpath` and looked up in the repository that contains the real file, instead of being made relative to that repository from the project directory (which pointed back out of it, so every page warned "isn't yet tracked by git" and fell back to filesystem dates).
