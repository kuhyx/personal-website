/**
 * The image references inside a markdown post, as pure string functions.
 *
 * Split out of `posts.ts` because that module runs `import.meta.glob` at the
 * top level: importing it pulls the whole committed corpus and every hashed
 * asset URL along with it. The admin service needs exactly these three
 * helpers and none of that, so they live where a Node process can import them
 * without dragging the site's content into its bundle.
 */

import { captured } from "./captured";

/** Matches `![alt](path)`, capturing the path. */
const IMAGE_PATTERN = /!\[[^\]]*\]\(\s*([^)\s]+)/g;

/** Normalise a markdown image reference to its key in a post's image map. */
export function imageKey(source: string): string {
  return source.startsWith("./") ? source.slice(2) : source;
}

/** True for images the bundler never sees, which are the author's problem. */
export function isRemoteImage(source: string): boolean {
  return /^(https?:)?\/\//.test(source) || source.startsWith("data:");
}

/**
 * Every local image path a body and cover reference.
 *
 * Takes the raw strings rather than a `Post` so the admin service can check a
 * post it has not written yet -- validating before the write is what keeps a
 * rejected save from leaving a half-built site behind.
 */
export function markdownImageSources(
  body: string,
  cover: string | null,
): string[] {
  const referenced = [...body.matchAll(IMAGE_PATTERN)].map((match) =>
    captured(match, 1),
  );
  if (cover !== null) {
    referenced.push(cover);
  }
  return referenced.filter((source) => !isRemoteImage(source));
}
