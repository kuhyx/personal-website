/**
 * The blog collection's frontmatter schema, ported from `frontmatter.ts`.
 *
 * Strict on purpose: an unknown key (a mistyped `sumary:`) fails `astro build`
 * with the file name and the key, rather than shipping a post with no
 * link-preview description. Astro parses the block as YAML, so the values are
 * normalised back to the shapes `PostMeta` promises: a bare
 * `date: 2026-08-29` arrives as a `Date`, and a bare `title: 2026` as a number.
 */

import { z } from "astro/zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A required, non-empty scalar, kept as the text the author wrote. */
const text = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().min(1));

/** `YYYY-MM-DD`, whether YAML handed over a `Date` or a quoted string. */
const isoDate = z
  .union([z.date().transform((date) => date.toISOString().slice(0, 10)), z.string()])
  .pipe(z.string().regex(DATE_PATTERN, "date must be YYYY-MM-DD"));

/** The validated frontmatter of one post. */
export const postSchema = z.strictObject({
  title: text,
  date: isoDate,
  summary: text,
  // An empty `tags:` is YAML null, and the hand-written parser reads it as [].
  tags: z.array(text).nullish().transform((tags) => tags ?? []),
  cover: z.string().nullish().transform((cover) => (cover === "" ? null : (cover ?? null))),
  draft: z.boolean().default(false),
});

/** What {@link postSchema} produces: the same shape as `PostMeta`. */
export type PostSchema = z.output<typeof postSchema>;
