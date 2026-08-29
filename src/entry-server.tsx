/**
 * SSR entry used only by `scripts/prerender.mjs` at build time.
 *
 * `renderToString`, never `renderToStaticMarkup`: the latter omits the markers
 * `hydrateRoot` walks, so the client would rebuild the tree from scratch and
 * warn about a mismatch on every post.
 */

import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { App } from "./app";
import { metaForPath, prerenderRoutes, renderHead } from "./lib/head";
import { inject, outputPath } from "./lib/template";

/** Render one route to the markup and `<head>` block the template needs. */
export function render(path: string): { html: string; head: string } {
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={path}>
        <App />
      </StaticRouter>
    </StrictMode>,
  );
  return { html, head: renderHead(metaForPath(path)) };
}

/** Every route to emit an HTML file for. */
export const routes = prerenderRoutes;

// Re-exported so scripts/prerender.mjs stays pure file I/O: everything it
// decides is typechecked, linted and tested in src/.
export { inject, outputPath };
