# personal-website

My personal site — a projects showcase and CV — served at
[kuhy.duckdns.org](https://kuhy.duckdns.org/).

Minimalistic, responsive, no build-time secrets. The projects section is fetched
live from the GitHub REST API; the CV is rendered from `src/data/cv.json` (the
same file that renders my LaTeX CV), with per-job durations computed in the
browser. Blog posts are markdown on disk, prerendered to static HTML at build
time so each one has its own title and link preview.

## Stack

- React 19 + Vite 8 + TypeScript (strict)
- react-router, react-markdown + remark-gfm, lowlight for code fences
- ESLint 10 flat config, `typescript-eslint` strict + stylistic (type-aware)
- Vitest + Testing Library, 100% coverage enforced
- Package manager: pnpm

## Commands

```bash
pnpm install
pnpm dev        # local dev server
pnpm lint       # tsc --noEmit && eslint src
pnpm test       # vitest run
pnpm coverage   # vitest run --coverage (100% thresholds)
pnpm build      # typecheck, bundle, SSR bundle, then prerender -> dist/
```

`pnpm preview` is *not* a faithful copy of production: it rewrites every path
to the SPA shell, so prerendered post pages appear as the landing page. To
check the real thing, serve `dist/` with the deployed Caddy config.

## Writing a post

One directory per post under `src/content/blog/`. The **directory name is the
slug** — `src/content/blog/why-i-built-todo/` is served at `/blog/why-i-built-todo`.

```
src/content/blog/why-i-built-todo/
  DOCS-index.md     <- the post
  screenshot.png    <- images, referenced as ./screenshot.png
```

The `DOCS-` prefix is load-bearing: `scripts/check_md_naming.sh` (and the
`md-naming` CI workflow, which scans the whole tree) only permits README /
CLAUDE\* / DOCS\* / TODO\* basenames. A post must also avoid the removal marker
that gate reserves for TODO files — writing it here would be enough to fail the
check, which is why this sentence does not quote it.

Frontmatter is strict — an unknown or malformed key fails the build and names
the file:

```yaml
---
title: Why I built todo
date: 2026-08-29        # YYYY-MM-DD; the only place the date is written
summary: One line, used on the index and in link previews.
tags: [flutter, sync]   # optional
cover: ./cover.png      # optional; PNG or JPG — scrapers do not render SVG
draft: false            # optional; true hides it everywhere
---
```

Images are resolved through Vite, so they get content-hashed URLs and a
mistyped path **fails `pnpm test`** rather than shipping as a 404. Assets under
`src/content/blog/` are never inlined as data URIs, because a `cover:` has to
be a real fetchable URL for `og:image`.

## Layout

- `src/lib/` — `github.ts` (projects feed + language breakdown), `duration.ts`
  (live job durations), `markup.tsx` (`**bold**` rendering), `frontmatter.ts`
  + `posts.ts` (the blog corpus), `head.ts` (per-page meta tags), `site.ts`
  (the public origin), `rehype-highlight-lite.ts` (code fences)
- `src/components/` — `hero`, `projects`, `project-card`, `cv-section`,
  `experience-item`, `site-nav`, `home`, `blog-index`, `post-page`,
  `post-body`, `post-meta`, `not-found`
- `src/content/blog/` — the posts
- `src/data/` — `cv.json` (content) + `cv.ts` (typed view)
- `src/entry-server.tsx` + `scripts/prerender.mjs` — the build-time prerender
- `public/cv.pdf` — the rendered CV, offered as a download

## Deployment

The static `dist/` is served behind a shared Caddy edge on my home server. The
deploy/orchestration script (`setup_personal_website.sh`) lives in my
[testsAndMisc](https://github.com/kuhyx/testsAndMisc) repo, since it also moves
Gitea and manages the reverse-proxy edge; it builds this repo and serves `dist/`
from a loopback container fronted by Caddy on `kuhy.duckdns.org`.
