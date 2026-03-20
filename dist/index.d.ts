import { QuartzTransformerPlugin } from '@quartz-community/types';
export { QuartzTransformerPlugin } from '@quartz-community/types';

interface CreatedModifiedDateOptions {
    priority: ("frontmatter" | "git" | "filesystem")[];
    defaultDateType: "created" | "modified" | "published";
}
declare const CreatedModifiedDate: QuartzTransformerPlugin<Partial<CreatedModifiedDateOptions>>;
declare module "vfile" {
    interface DataMap {
        dates: {
            created: Date;
            modified: Date;
            published: Date;
        };
        defaultDateType: "created" | "modified" | "published";
    }
}

export { CreatedModifiedDate, type CreatedModifiedDateOptions };
