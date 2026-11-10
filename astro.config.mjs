import { unified } from "@astrojs/markdown-remark";
import { execFileSync } from "node:child_process";
import { defineConfig } from "astro/config";
import { rehypeExternalLinks } from "./src/lib/rehype-external-links.ts";
import { rehypeHighlightLite } from "./src/lib/rehype-highlight-lite.ts";

/**
 * The commit this build is from, stamped into every page as
 * `<meta name="build-id">`, so `curl <url> | grep <hash>` proves the live
 * site serves this build. "unknown" outside a git checkout.
 */
function buildId() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

// Static output only: `dist/` is served as plain files by the Caddy container
// (~/src/testsAndMisc/linux_configuration/features/setup_personal_website.sh).
export default defineConfig({
  site: "https://kuhy.duckdns.org",
  output: "static",
  outDir: "dist",
  // `/blog/x` -> `blog/x/index.html`, the layout Caddy's
  // `try_files {path} {path}/index.html` already resolves.
  build: { format: "directory" },
  devToolbar: { enabled: false },
  server: { port: 5173 },
  markdown: {
    // The remark/rehype pipeline the React site used: GFM on (tables, task
    // lists, strikethrough, autolinks), SmartyPants off (react-markdown never
    // curled quotes). Highlighting stays on lowlight with only the grammars
    // we use, so the `.hljs-*` colours in styles/index.css keep applying.
    syntaxHighlight: false,
    processor: unified({
      gfm: true,
      smartypants: false,
      rehypePlugins: [rehypeHighlightLite, rehypeExternalLinks],
    }),
  },
  vite: {
    define: { "import.meta.env.PUBLIC_BUILD_ID": JSON.stringify(buildId()) },
    build: {
      // Never inline post assets as data URIs, whatever their size. A `cover:`
      // image has to be a real fetchable URL: an og:image data URI is silently
      // dropped by every link-preview scraper.
      assetsInlineLimit: (filePath) => (filePath.includes("/content/blog/") ? false : undefined),
    },
  },
});
