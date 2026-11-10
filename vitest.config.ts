/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Tests run under Astro's own Vite config, so `.astro` imports and
// `import.meta.glob` resolve exactly as they do in `astro build`. The `.astro`
// files are markup, rendered by the Container API tests; coverage is measured
// on every TypeScript source.
export default getViteConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // data/** and content/** are static content; test/** is harness.
      exclude: ["src/data/**", "src/content/**", "src/test/**", "src/**/*.d.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
