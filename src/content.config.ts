/**
 * The blog as an Astro content collection: one directory per post, the
 * markdown named `DOCS-index.md` (the repo-wide markdown-naming gate only
 * permits README / CLAUDE* / DOCS* basenames). The slug is the directory name.
 */

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { postSchema } from "./lib/post-schema";

/** The glob loader's id for a post: `hello-world/DOCS-index.md` -> `hello-world`. */
export function slugFromEntry({ entry }: { readonly entry: string }): string {
  return entry.slice(0, entry.indexOf("/"));
}

export const collections = {
  blog: defineCollection({
    loader: glob({
      base: "./src/content/blog",
      pattern: "*/DOCS-index.md",
      generateId: slugFromEntry,
    }),
    schema: postSchema,
  }),
};
