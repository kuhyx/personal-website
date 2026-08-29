import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Served from the domain root behind Caddy, so absolute asset paths are fine.
  base: "/",
  plugins: [react()],
  build: {
    // Never inline post assets as data URIs, whatever their size. A `cover:`
    // image has to be a real fetchable URL: an og:image data URI is silently
    // dropped by every link-preview scraper, and the failure is invisible
    // until someone shares a post.
    assetsInlineLimit: (filePath) => (filePath.includes("/content/blog/") ? false : undefined),
  },
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // main.tsx and entry-server.tsx are untestable bootstraps (they only
      // mount/render the tree); data/** and content/** are static content;
      // test/** is harness.
      exclude: [
        "src/main.tsx",
        "src/entry-server.tsx",
        "src/data/**",
        "src/content/**",
        "src/test/**",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
