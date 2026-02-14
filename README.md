# @quartz-community/created-modified-date

Extracts created and modified dates from frontmatter, git history, or filesystem metadata.

## Installation

```bash
npx quartz plugin add github:quartz-community/created-modified-date
```

## Usage

```ts
// quartz.config.ts
import * as ExternalPlugin from "./.quartz/plugins";

const config: QuartzConfig = {
  plugins: {
    transformers: [ExternalPlugin.CreatedModifiedDate()],
  },
};
```

## Configuration

| Option     | Type                                         | Default                                | Description                                                   |
| ---------- | -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| `priority` | `("frontmatter" \| "git" \| "filesystem")[]` | `["frontmatter", "git", "filesystem"]` | The order of sources to check for created and modified dates. |

## Documentation

See the [Quartz documentation](https://quartz.jzhao.xyz/) for more information.

## License

MIT
