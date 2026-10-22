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
import { headFor } from "./lib/agent-head";
import { siteFiles } from "./lib/artifacts";

/** Render one route to the markup and `<head>` block the template needs. */
export function render(path: string): { html: string; head: string } {
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={path}>
        <App />
      </StaticRouter>
    </StrictMode>,
  );
  return { html, head: headFor(path) };
}

/**
 * Every file to write into `dist/`, given the built `index.html`. Kept here so
 * scripts/prerender.mjs stays pure file I/O: everything it writes is decided,
 * typechecked, linted and tested in src/.
 */
export function files(template: string): { file: string; contents: string }[] {
  return siteFiles(template, render);
}
