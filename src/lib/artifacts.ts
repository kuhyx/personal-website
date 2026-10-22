/**
 * Every file the prerender step writes into `dist/`, as data.
 *
 * `scripts/prerender.mjs` only loops over this list with mkdir + writeFile:
 * which files exist, where they go and what they hold is decided here, in
 * typechecked and tested code (see that script's header for why).
 */

import { NOT_FOUND_ROUTE } from "./agent-head";
import { aiCatalog, llmsTxt, robotsTxt, sitemapXml } from "./discovery";
import { prerenderRoutes } from "./head";
import { markdownFor, mirrorPath } from "./mirror";
import { publishedPosts } from "./posts";
import { inject, outputPath } from "./template";

/** One file to write: a path relative to `dist/`, and its UTF-8 contents. */
export interface SiteFile {
  readonly file: string;
  readonly contents: string;
}

/** Renders one route to app markup plus its `<head>` block. */
export type Renderer = (route: string) => { html: string; head: string };

/**
 * All prerendered HTML pages, `404.html`, the discovery files and one markdown
 * mirror per route. The 404 page is deliberately not a route: it must never
 * appear in the sitemap, the catalog or llms.txt.
 */
export function siteFiles(template: string, render: Renderer): SiteFile[] {
  const routes = prerenderRoutes();
  const page = (route: string, file: string): SiteFile => ({
    file,
    contents: inject(template, render(route)),
  });
  return [
    ...routes.map((route) => page(route, outputPath(route))),
    page(NOT_FOUND_ROUTE, "404.html"),
    { file: "robots.txt", contents: robotsTxt() },
    { file: "sitemap.xml", contents: sitemapXml(routes, publishedPosts) },
    { file: "llms.txt", contents: llmsTxt(publishedPosts) },
    {
      file: ".well-known/ai-catalog.json",
      contents: `${JSON.stringify(aiCatalog(routes), null, 2)}\n`,
    },
    ...routes.map((route) => ({
      file: mirrorPath(route).slice(1),
      contents: markdownFor(route),
    })),
  ];
}
