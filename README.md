# @quartz-community/created-modified-date

Extracts created, modified and published dates from frontmatter, git history, or filesystem metadata.

Frontmatter `created`, `modified` and `published` (and aliases such as `date`, `lastmod` and `updated`) are read. Git only provides the modified date; the filesystem provides created and modified dates. A source only fills dates that a higher-priority source has not set; an invalid frontmatter date is skipped with a warning. Date-only values such as `2024-03-05` are read as local midnight. Git dates are looked up in the repository that contains each note (following symlinks), so a vault linked into the content folder uses its own history.

A date no source gives (for example `published` on a page without `published:`) is the build time, so feeds and page lists can still sort by it. Those stand-in dates are listed in `file.data.fallbackDates` (`["published"]`); Quartz leaves them out of `contentIndex.json` and the page's meta tags.

## Installation

```bash
npx quartz plugin add @quartz-community/created-modified-date
```

It is already included (and enabled) in the default `quartz.config.yaml`.

## Usage

```yaml title="quartz.config.yaml"
plugins:
  - source: "@quartz-community/created-modified-date"
    enabled: true
    options:
      defaultDateType: modified
      priority:
        - frontmatter
        - git
        - filesystem
    order: 10
```

For advanced use cases, you can override in TypeScript:

```ts title="quartz.ts (override)"
import * as ExternalPlugin from "./.quartz/plugins";

ExternalPlugin.CreatedModifiedDate({
  priority: ["frontmatter", "git", "filesystem"],
  defaultDateType: "modified",
});
```

## Configuration

| Option            | Type                                         | Default                                | Description                                                                         |
| ----------------- | -------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `priority`        | `("frontmatter" \| "git" \| "filesystem")[]` | `["frontmatter", "git", "filesystem"]` | The order of sources to check for created and modified dates.                       |
| `defaultDateType` | `"created" \| "modified" \| "published"`     | `"modified"`                           | Which date to display (e.g. in content-meta, recent-notes and folder/tag listings). |

If you rely on `git` for dates, keep `defaultDateType: modified`.

## Documentation

See the [Quartz documentation](https://quartz.jzhao.xyz/plugins/CreatedModifiedDate) for more information.

## License

MIT
