/**
 * The full `<head>` block per page: the scraper metadata from `head.ts` plus
 * what agents look for (AgentReady): the AI Catalog link, llms.txt, the page's
 * markdown mirror and its JSON-LD.
 *
 * The 404 page gets its own head. `metaForPath`'s fallback is the home page,
 * whose canonical URL would tell a crawler that every mistyped address *is*
 * the home page.
 */

import { escapeHtml, metaForPath, renderHead } from "./head";
import { jsonLdFor, jsonLdScript } from "./jsonld";
import { LOGO_LAB_ROUTE } from "./logo-lab";
import { mirrorPath } from "./mirror";
import { SITE_TITLE } from "./site";

/**
 * The route `404.html` is rendered from. Not a real page: it only has to match
 * the router's `*` route, exactly as any mistyped address does.
 */
export const NOT_FOUND_ROUTE = "/404";

const SEPARATOR = "\n    ";

/** Links every page carries: the AI Catalog and llms.txt (AR-FIND-04, AR-READ-06). */
const DISCOVERY_LINKS = [
  '<link rel="ai-catalog" href="/.well-known/ai-catalog.json" type="application/ai-catalog+json" />',
  '<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt" />',
];

function notFoundHead(): string {
  return [
    `<title>${escapeHtml(`Not found — ${SITE_TITLE}`)}</title>`,
    '<meta name="robots" content="noindex" />',
    ...DISCOVERY_LINKS,
  ].join(SEPARATOR);
}

/**
 * `/logo-lab` is a private preview: kept out of the index, and claiming none of
 * the home page's canonical, card, mirror or JSON-LD that `metaForPath` would
 * fall back to.
 */
function logoLabHead(): string {
  return [
    `<title>${escapeHtml(SITE_TITLE)}</title>`,
    '<meta name="robots" content="noindex" />',
    ...DISCOVERY_LINKS,
  ].join(SEPARATOR);
}

/** The `<head>` block for one prerendered route, `NOT_FOUND_ROUTE` or the logo lab. */
export function headFor(path: string): string {
  if (path === NOT_FOUND_ROUTE) {
    return notFoundHead();
  }
  if (path === LOGO_LAB_ROUTE) {
    return logoLabHead();
  }
  const meta = metaForPath(path);
  return [
    renderHead(meta),
    ...DISCOVERY_LINKS,
    `<link rel="alternate" type="text/markdown" href="${escapeHtml(mirrorPath(meta.path))}" />`,
    jsonLdScript(jsonLdFor(meta.path)),
  ].join(SEPARATOR);
}
