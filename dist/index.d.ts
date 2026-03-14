import { QuartzTransformerPlugin } from '@quartz-community/types';
export { QuartzTransformerPlugin } from '@quartz-community/types';

interface CreatedModifiedDateOptions {
    priority: ("frontmatter" | "git" | "filesystem")[];
}
declare const CreatedModifiedDate: QuartzTransformerPlugin<Partial<CreatedModifiedDateOptions>>;
declare module "vfile" {
    interface DataMap {
        dates: {
            created: Date;
            modified: Date;
            published: Date;
        };
    }
}

export { CreatedModifiedDate, type CreatedModifiedDateOptions };
