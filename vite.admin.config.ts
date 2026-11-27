import { resolve } from "node:path";
import { defineConfig } from "vite";

const ROOT = "src/admin/client";

/**
 * Build config for the admin editor page.
 *
 * Separate from `vite.config.ts` because it is a different site: its own root,
 * its own entry, and an output the public `dist/` must never contain.
 *
 * `base` is absolute rather than `"./"` on purpose. The page is served at
 * `/admin`, with no trailing slash, so a relative `./assets/x.js` resolves
 * against `/` and asks for `/assets/x.js` -- which is not an admin route, so
 * the page loads and silently does nothing. An absolute base is the same URL
 * whether or not the address bar has the slash.
 *
 * The service worker is a second entry with a fixed name, `assets/sw.js`: the
 * page registers it by that URL, so it cannot carry a content hash.
 */
export default defineConfig({
  root: ROOT,
  base: "/admin/",
  build: {
    outDir: "../../../dist-admin/client",
    emptyOutDir: true,
    rolldownOptions: {
      input: { index: resolve(ROOT, "index.html"), sw: resolve(ROOT, "sw.ts") },
      output: {
        entryFileNames: (chunk) => (chunk.name === "sw" ? "assets/sw.js" : "assets/[name]-[hash].js"),
      },
    },
  },
});
