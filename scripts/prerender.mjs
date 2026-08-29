// ============================================================================
// Write one real HTML file per route, so every post has its own <title> and
// OpenGraph tags. Link-preview scrapers do not run JavaScript, so without this
// every shared post URL would preview as the site-wide title.
//
// Deliberately logic-free file I/O: `scripts/` sits outside tsconfig's
// `include` and outside `pnpm lint`'s `eslint src`, so anything decided here
// would be build-critical code with no gate on it. The routes, the markup and
// the <head> block all come from `src/entry-server.tsx`, which is typechecked
// and tested.
//
// Usage: node scripts/prerender.mjs   (run by `pnpm build`, after both builds)
// ============================================================================

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, "dist");
const SERVER_ENTRY = join(ROOT, "dist-ssr", "entry-server.js");
const TEMPLATE = join(DIST, "index.html");

const HEAD_START = "<!--head-start-->";
const HEAD_END = "<!--head-end-->";
const APP_MARKER = "<!--app-html-->";

/** `/` -> `dist/index.html`; `/blog/x` -> `dist/blog/x/index.html`. */
function outputPath(route) {
  return route === "/"
    ? join(DIST, "index.html")
    : join(DIST, route.slice(1), "index.html");
}

function inject(template, { html, head }) {
  const headStart = template.indexOf(HEAD_START);
  const headEnd = template.indexOf(HEAD_END);
  if (headStart === -1 || headEnd === -1) {
    throw new Error(`index.html is missing ${HEAD_START} / ${HEAD_END}`);
  }
  if (!template.includes(APP_MARKER)) {
    throw new Error(`index.html is missing ${APP_MARKER}`);
  }
  const withHead =
    template.slice(0, headStart + HEAD_START.length) +
    `\n    ${head}\n    ` +
    template.slice(headEnd);
  return withHead.replace(APP_MARKER, html);
}

async function main() {
  const { render, routes } = await import(pathToFileURL(SERVER_ENTRY).href);
  const template = await readFile(TEMPLATE, "utf8");

  const all = routes();
  for (const route of all) {
    const target = outputPath(route);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, inject(template, render(route)), "utf8");
  }

  console.log(`Prerendered ${String(all.length)} route(s): ${all.join(", ")}`);
}

await main();
