---
"@quartz-community/created-modified-date": patch
---

fix: a date no source gives is still the build time (RSS, sitemaps and page lists need one), but it is now listed in `file.data.fallbackDates` (for example `["published"]` for a page without `published:`), so Quartz can leave it out of `contentIndex.json` and the page's `article:published_time` instead of presenting the build time as a real date. An invalid frontmatter date (with its warning) no longer blocks the next source: `modified: garbage` falls back to git or the file system, as a missing value does.
