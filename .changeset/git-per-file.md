---
"@quartz-community/created-modified-date": patch
---

fix: whether git dates are used is decided per note, by the repository that contains it. Before, a content folder outside any git repository turned git off for the whole build, so a folder in it that links to a vault with its own repository got file-system dates. Notes outside every repository now get their dates from the next source in `priority`.
