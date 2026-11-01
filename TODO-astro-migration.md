# Migrate personal-website to Astro (no React)

## what
Replace React + Vite + the hand-rolled SSR prerender with Astro 7 static
output. Pages become `.astro`. The two live parts become `<script>` TS:
the GitHub projects fetch and the CV durations. The site stays a static
`dist/` behind the same Caddy container.

## steps
1. Blocked on `~/src/utils/web_ui/TODO-astro-port.md`. This repo does not
   import `@kuhyx/web-ui` today. Add `tokens.css` from the new tag in the
   layout.
2. Routes become `src/pages/`: `index.astro`, `blog/index.astro`,
   `blog/[slug].astro` (`getStaticPaths` over a collection), `404.astro`. Delete `app.tsx`, `main.tsx`, `entry-server.tsx`, `scripts/prerender.mjs`
   and `dist-ssr/`.
3. Blog. Use a content collection (glob loader) on `src/content/blog/*/DOCS-index.md`.
   Port the strict frontmatter from `lib/frontmatter.ts` into its zod schema.
   Unknown keys still fail the build. `lint-blog.mjs` stays in `build`.
   - Markdown: Astro's built-in remark-gfm. Code fences: keep lowlight as a
     rehype plugin, or switch to Shiki only if the output CSS matches.
   - Images: keep `cover:` a real fetchable URL. Use `astro:assets`
     `getImage()` for the og:image, never a data URI.
4. Rewrite 15 React files as `.astro`. Static ones:
   - `hero`, `site-nav`, `home`, `cv-section`, `experience-item`
   - `blog-index`, `post-page`, `post-meta`, `post-body`, `not-found`
   - `lib/markup.tsx`, which becomes a `.ts` string helper or `.astro`
   Live ones (`<script>`):
   - `projects` and `project-card`: the fetch and render move to `src/lib/projects.ts`.
   - The CV duration maths stays in `src/lib/*.ts`. A small script fills in the
     spans on the client.
5. `<head>` and OG tags move into `src/layouts/Base.astro`, with props per page.
   Keep the per-post `<title>`, description and og:image.
6. AgentReady. Port the generator that `entry-server.tsx` re-exports into
   static endpoints that read the same collection: `src/pages/robots.txt.ts`,
   `sitemap.xml.ts`, `llms.txt.ts`, `.well-known/ai-catalog.json.ts` and
   `[...path].md.ts` (markdown mirrors). The JSON-LD goes in `index.astro`.
7. Admin (`src/admin/`). `editor.ts` is already vanilla TS, so keep it and
   `vite.admin.config.ts`. Point the service's rebuild at `pnpm build`, which
   now runs `astro build`.
8. Dependencies, exact pins via pnpm:
   - Add `astro@7.4.4`, `@astrojs/check@0.9.12`, `eslint-plugin-astro@3.2.1`
     and `@testing-library/dom`.
   - Remove `react`, `react-dom`, `react-router`, `react-markdown`, `@types/react*`,
     `@vitejs/plugin-react`, `@testing-library/react` and `jsdom`. Keep `jsdom`
     if the script tests need it.
   - Keep direct `vite`: `build:admin` calls it. Astro brings
     `vite ^8.3.5`.
9. Tests. Use vitest 5.0.5 with `getViteConfig()`. `.astro` components are
   tested with `experimental_AstroContainer`. Script logic is tested in jsdom.
   Keep 100% coverage on `src/**/*.ts`. Exclude `.astro`. `hydration.test.tsx`
   and `app.test.tsx` are dropped, since there is no hydration left.
10. `build` becomes
    `node scripts/lint-blog.mjs && astro check && astro build`.
    `dist/` stays the output.

## done
Run from the repo root:
`pnpm install --frozen-lockfile && pnpm lint && pnpm coverage && pnpm build && ~/src/utils/agent_ready/check.sh dist dist`
Then:
`! grep -q '"react"' package.json && ! grep -qE '"(react-dom|@vitejs/plugin-react)"' package.json && ! find src -name '*.tsx' | grep -q .`
Both exit 0.

## verify
Deploy with
`~/src/testsAndMisc/linux_configuration/features/setup_personal_website.sh`
(a Caddy container on 127.0.0.1:8088, behind the edge). Then run
`~/src/utils/agent_ready/check.sh url https://kuhy.duckdns.org`.
`curl -sI https://kuhy.duckdns.org/blog/<slug>` returns 200, and a missing path
returns 404.

## read first
- `~/src/utils/web_ui/TODO-astro-port.md` (do it first)
- `src/entry-server.tsx`, `scripts/prerender.mjs`, `src/lib/frontmatter.ts`
- `README.md` (posts, admin, deployment)
- `~/src/testsAndMisc/linux_configuration/features/lib/static_site_caddy.sh`

REMOVE ME AFTER FINISH
