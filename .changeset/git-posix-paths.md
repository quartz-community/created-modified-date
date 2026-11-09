---
"@quartz-community/created-modified-date": patch
---

Git dates of notes in folders work on Windows. The note's path was passed to git with Windows separators (`content\notes\a.md`), while git stores `/`-separated paths, so every note outside the top folder could fall back to "isn't yet tracked by git" and got its filesystem date. The path is now always `/`-separated.
