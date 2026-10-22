// ============================================================================
// Write one real HTML file per route, so every post has its own <title> and
// OpenGraph tags. Link-preview scrapers do not run JavaScript, so without this
// every shared post URL would preview as the site-wide title. Alongside them:
// 404.html, robots.txt, sitemap.xml, llms.txt, .well-known/ai-catalog.json
// and one markdown mirror per page.
//
// Strictly file I/O. Every decision -- which files, what markup, what <head>,
// where each file goes, how the template is spliced -- comes from
// `src/entry-server.tsx` and the modules it re-exports, because `scripts/`
// sits outside both tsconfig's `include` and `pnpm lint`'s `eslint src` and
// anything decided here would have no gate on it.
//
// Usage: node scripts/prerender.mjs   (run by `pnpm build`, after both builds)
// ============================================================================

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, "dist");
const SERVER_ENTRY = join(ROOT, "dist-ssr", "entry-server.js");

async function main() {
  const { files } = await import(pathToFileURL(SERVER_ENTRY).href);
  const template = await readFile(join(DIST, "index.html"), "utf8");

  const all = files(template);
  for (const { file, contents } of all) {
    const target = join(DIST, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }

  console.log(`Prerendered ${String(all.length)} file(s): ${all.map((f) => f.file).join(", ")}`);
}

await main();
