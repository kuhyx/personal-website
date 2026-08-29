/**
 * The blog corpus: every post under `src/content/blog/`, loaded at build time.
 *
 * One directory per post so images sit next to the prose they belong to. The
 * markdown file is named `DOCS-index.md` because the shared markdown-naming
 * gate (`scripts/check_md_naming.sh`, enforced repo-wide in CI) only permits
 * README / CLAUDE* / DOCS* / TODO* basenames.
 *
 * The slug is the *directory* name and the date lives in frontmatter, so
 * neither is written down twice.
 */

import { parsePost, type PostMeta } from "./frontmatter";
import { imageKey, isRemoteImage, markdownImageSources } from "./markdown-images";

// Re-exported so callers keep one import site for "everything about posts",
// while the pure half stays importable without the globs below.
export { imageKey, isRemoteImage, markdownImageSources };

/** A post ready to render. */
export interface Post {
  /** URL segment: `/blog/<slug>`. Taken from the directory name. */
  readonly slug: string;
  readonly meta: PostMeta;
  /** Markdown body, frontmatter stripped. */
  readonly body: string;
  /** Post-relative image path -> the hashed URL Vite emitted for it. */
  readonly images: ReadonlyMap<string, string>;
}

/** Everything before the final `/`, i.e. the post's directory. */
function directoryOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

/** The last path segment — the post's slug, given `<dir>/<slug>/DOCS-index.md`. */
function slugOf(path: string): string {
  const directory = directoryOf(path);
  return directory.slice(directory.lastIndexOf("/") + 1);
}

/** Every image path referenced by a post: its body images plus its cover. */
export function imageReferences(post: Post): string[] {
  return markdownImageSources(post.body, post.meta.cover);
}

/**
 * Resolve one markdown image reference to the URL Vite emitted.
 *
 * @throws {Error} If the path does not exist next to the post. Loud on purpose:
 * a silently broken image ships as a 404 nobody notices. `posts.test.ts` runs
 * this over every post so the failure lands in `pnpm test`, not in production.
 */
export function resolveImage(post: Post, source: string): string {
  const url = post.images.get(imageKey(source));
  if (url === undefined) {
    const available = [...post.images.keys()].join(", ") || "(none)";
    throw new Error(
      `Post "${post.slug}" references image "${source}", which does not exist ` +
        `next to it. Available: ${available}`,
    );
  }
  return url;
}

/**
 * Assemble the corpus from Vite's two glob records.
 *
 * Pure on purpose: the globs are wired up once below, while every edge case is
 * unit-tested against fixtures rather than against whatever posts exist today.
 */
export function buildPosts(
  rawFiles: Readonly<Record<string, string>>,
  imageUrls: Readonly<Record<string, string>>,
): Post[] {
  const posts = Object.entries(rawFiles).map(([path, raw]): Post => {
    const { meta, body } = parsePost(path, raw);
    const directory = `${directoryOf(path)}/`;
    const images = new Map(
      Object.entries(imageUrls)
        .filter(([imagePath]) => imagePath.startsWith(directory))
        .map(([imagePath, url]) => [imagePath.slice(directory.length), url]),
    );
    return { slug: slugOf(path), meta, body, images };
  });

  // Newest first; title breaks ties so the order never depends on glob order.
  return posts.sort(
    (a, b) =>
      b.meta.date.localeCompare(a.meta.date) ||
      a.meta.title.localeCompare(b.meta.title),
  );
}

const rawFiles = import.meta.glob("../content/blog/*/DOCS-index.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const imageUrls = import.meta.glob(
  "../content/blog/*/*.{png,jpg,jpeg,webp,gif,svg,avif}",
  { query: "?url", import: "default", eager: true },
);

/** Every post on disk, drafts included. Newest first. */
export const allPosts: readonly Post[] = buildPosts(rawFiles, imageUrls);

/** The posts the site actually shows. Flip `draft:` in frontmatter to preview. */
export const publishedPosts: readonly Post[] = allPosts.filter(
  (post) => !post.meta.draft,
);

/** The published post with this slug, or undefined. */
export function findPost(slug: string): Post | undefined {
  return publishedPosts.find((post) => post.slug === slug);
}
