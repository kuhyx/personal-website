/**
 * The discovery files agents look for before they read a single page:
 * `robots.txt`, `sitemap.xml`, `llms.txt` and `/.well-known/ai-catalog.json`.
 *
 * Generated from the same route list the prerender uses, so a new post shows
 * up in all four the moment it is published -- a hand-kept sitemap is one
 * that silently stops listing the newest posts. Formats and the checks that
 * hold them to it: `~/src/utils/agent_ready/DOCS-spec-notes.md`.
 */

import { escapeHtml } from "./head";
import { mirrorPath, postListItem } from "./mirror";
import type { Post } from "./posts";
import { SITE_DESCRIPTION, SITE_ORIGIN, SITE_TITLE, absoluteUrl } from "./site";

/**
 * Allow-all, by choice: training crawlers too, not only search and
 * user-initiated fetchers. The named groups say the same as `*`; they exist so
 * that the choice reads as deliberate rather than as an oversight.
 */
const NAMED_AGENTS = ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"];

/** `robots.txt`: every agent may fetch everything; the sitemap is linked. */
export function robotsTxt(): string {
  const groups = ["*", ...NAMED_AGENTS].map(
    (agent) => `User-agent: ${agent}\nAllow: /\n`,
  );
  return `${groups.join("\n")}\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`;
}

/** `sitemap.xml` listing `routes`; a post's entry carries its publish date. */
export function sitemapXml(routes: readonly string[], posts: readonly Post[]): string {
  const dates = new Map(posts.map((post) => [`/blog/${post.slug}`, post.meta.date]));
  const urls = routes.map((route) => {
    const date = dates.get(route);
    const lastmod = date === undefined ? "" : `<lastmod>${date}</lastmod>`;
    return `  <url><loc>${escapeHtml(absoluteUrl(route))}</loc>${lastmod}</url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** `llms.txt`: H1, blockquote summary, then sections of described links. */
export function llmsTxt(posts: readonly Post[]): string {
  return [
    `# ${SITE_TITLE}`,
    "",
    `> ${SITE_DESCRIPTION} Also a blog about the things I build.`,
    "",
    "Every page has a markdown mirror at the same address plus `.md`",
    "(`/index.md` for the home page); the links below point at those.",
    "",
    "## Pages",
    "",
    `- [Home and CV](${absoluteUrl(mirrorPath("/"))}): who I am, experience, education, skills, volunteering and side projects`,
    `- [CV (PDF)](${absoluteUrl("/cv.pdf")}): the same CV as a printable PDF`,
    `- [Blog](${absoluteUrl(mirrorPath("/blog"))}): every post, newest first`,
    "",
    "## Blog",
    "",
    ...(posts.length === 0 ? ["No posts yet."] : posts.map(postListItem)),
    "",
  ].join("\n");
}

/** One AI Catalog entry; `url` only, never inline `data`. */
export interface CatalogEntry {
  readonly identifier: string;
  readonly displayName: string;
  readonly type: string;
  readonly url: string;
}

/** The AI Catalog document (ai-catalog specVersion 1.0). */
export interface AiCatalog {
  readonly specVersion: "1.0";
  readonly host: {
    readonly displayName: string;
    readonly identifier: string;
    readonly documentationUrl: string;
  };
  readonly entries: readonly CatalogEntry[];
}

const HOST = new URL(SITE_ORIGIN).host;

function entry(name: string, displayName: string, type: string, path: string): CatalogEntry {
  return {
    identifier: `urn:air:${HOST}:${name}`,
    displayName,
    type,
    url: absoluteUrl(path),
  };
}

/** Name segment for a route's mirror: `/` -> `home`, `/blog/x` -> `blog.x`. */
function routeName(route: string): string {
  return route === "/" ? "home" : route.slice(1).replace(/\//g, ".");
}

/** `/.well-known/ai-catalog.json`: every agent-facing file this site ships. */
export function aiCatalog(routes: readonly string[]): AiCatalog {
  return {
    specVersion: "1.0",
    host: {
      displayName: SITE_TITLE,
      identifier: SITE_ORIGIN,
      documentationUrl: absoluteUrl("/llms.txt"),
    },
    entries: [
      entry("docs:llms", "llms.txt", "text/plain", "/llms.txt"),
      entry("docs:sitemap", "Sitemap", "application/xml", "/sitemap.xml"),
      ...routes.map((route) =>
        entry(
          `markdown:${routeName(route)}`,
          `Markdown mirror of ${route}`,
          "text/markdown",
          mirrorPath(route),
        ),
      ),
    ],
  };
}
