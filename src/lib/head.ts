/**
 * The `<head>` contents injected into each prerendered page.
 *
 * Lives here, in typechecked and tested code, rather than in
 * `scripts/prerender.mjs`: `scripts/` is outside both `tsconfig.json`'s
 * `include` and `pnpm lint`'s `eslint src`, so build-critical logic put there
 * would have no gate at all. The prerender script stays pure file I/O.
 */

import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  absoluteUrl,
} from "./site";
import { imageKey, publishedPosts, type Post } from "./posts";

/** Everything a single page needs to describe itself to a scraper. */
export interface PageMeta {
  readonly title: string;
  readonly description: string;
  /** Site-root-relative route, e.g. `/blog/hello-world`. */
  readonly path: string;
  /** Site-root-relative image URL, or null for no card image. */
  readonly image: string | null;
  /** ISO date for `article:published_time`, or null for non-articles. */
  readonly publishedAt: string | null;
}

/** Escape the five characters that can break out of an HTML attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tag(attribute: "name" | "property", key: string, content: string): string {
  return `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
}

/** The `<title>` and `<meta>` block for one page, as an HTML string. */
export function renderHead(meta: PageMeta): string {
  const lines = [
    `<title>${escapeHtml(meta.title)}</title>`,
    tag("name", "description", meta.description),
    tag("property", "og:type", meta.publishedAt === null ? "website" : "article"),
    tag("property", "og:title", meta.title),
    tag("property", "og:description", meta.description),
    // Absolute on purpose: card scrapers do not resolve OG URLs against the
    // page they were found on, so a relative one is silently dropped.
    tag("property", "og:url", absoluteUrl(meta.path)),
    tag("name", "twitter:card", meta.image === null ? "summary" : "summary_large_image"),
  ];
  if (meta.image !== null) {
    lines.push(tag("property", "og:image", absoluteUrl(meta.image)));
  }
  if (meta.publishedAt !== null) {
    lines.push(tag("property", "article:published_time", meta.publishedAt));
  }
  lines.push(`<link rel="canonical" href="${escapeHtml(absoluteUrl(meta.path))}" />`);
  return lines.join("\n    ");
}

/** Page metadata for a single post. */
export function postMeta(post: Post): PageMeta {
  return {
    title: `${post.meta.title} — ${SITE_TITLE}`,
    description: post.meta.summary,
    path: `/blog/${post.slug}`,
    // imageKey rather than a second ./-stripping rule here: two copies of that
    // normalisation is how a cover silently stops resolving.
    image:
      post.meta.cover === null
        ? null
        : (post.images.get(imageKey(post.meta.cover)) ?? null),
    publishedAt: post.meta.date,
  };
}

/** Page metadata for any prerendered route, post or not. */
export function metaForPath(path: string): PageMeta {
  if (path === "/blog") {
    return {
      title: `Blog — ${SITE_TITLE}`,
      description: "Notes on the things I build.",
      path,
      image: null,
      publishedAt: null,
    };
  }
  const post = publishedPosts.find((entry) => `/blog/${entry.slug}` === path);
  if (post !== undefined) {
    return postMeta(post);
  }
  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    path: "/",
    image: null,
    publishedAt: null,
  };
}

/** Every route the prerender step should emit an HTML file for. */
export function prerenderRoutes(): string[] {
  return ["/", "/blog", ...publishedPosts.map((post) => `/blog/${post.slug}`)];
}
