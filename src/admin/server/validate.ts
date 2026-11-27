/** Turning an untrusted request body into what a route may act on. */

import { imageKey, markdownImageSources } from "../../lib/markdown-images";
import type { PostMeta } from "../../lib/frontmatter";
import type { AdminRequest } from "./deps";

/** Read a JSON body, or null if it is absent or malformed. */
export function readJson(request: AdminRequest): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(request.body));
  } catch {
    return null;
  }
}

/**
 * The message to report for a thrown value.
 *
 * A named function rather than a ternary at each `catch`, so the
 * not-an-`Error` case is testable directly: a rejection carrying a non-Error
 * is real but awkward to stage through a route.
 */
export function reason(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Coerce an untrusted JSON object into PostMeta, or explain why it cannot be. */
export function readMeta(value: unknown): PostMeta | string {
  if (!isRecord(value)) {
    return "body must be a JSON object";
  }
  const { title, date, summary, tags, cover, draft } = value;
  if (typeof title !== "string" || title.trim() === "") {
    return "title is required";
  }
  if (typeof date !== "string") {
    return "date is required";
  }
  if (typeof summary !== "string" || summary.trim() === "") {
    return "summary is required";
  }
  if (tags !== undefined && !(Array.isArray(tags) && tags.every((t) => typeof t === "string"))) {
    return "tags must be an array of strings";
  }
  if (cover !== undefined && cover !== null && typeof cover !== "string") {
    return "cover must be a string or null";
  }
  if (draft !== undefined && typeof draft !== "boolean") {
    return "draft must be a boolean";
  }
  return {
    title: title.trim(),
    date,
    summary: summary.trim(),
    tags: tags ?? [],
    cover: cover ?? null,
    draft: draft ?? false,
  };
}

/**
 * Which referenced images are missing from `available`.
 *
 * Run before the write, so a post naming an image that is not there is
 * rejected while `dist/` is still whole — the same guarantee `posts.test.ts`
 * enforces for the committed corpus.
 */
export function missingImages(
  body: string,
  cover: string | null,
  available: readonly string[],
): string[] {
  const present = new Set(available);
  return markdownImageSources(body, cover).filter(
    (source) => !present.has(imageKey(source)),
  );
}
