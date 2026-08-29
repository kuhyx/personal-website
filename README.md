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

## Writing a post in the browser

`src/admin/` is a small service that edits the same directories you would edit
by hand: it writes `DOCS-index.md`, drops uploads beside it, and then runs the
build so the change is live. It is a separate process from the site — the site
itself stays a static `dist/`, with no server behind it.

```bash
pnpm build:admin                                    # service + editor page
node dist-admin/admin.js session-secret             # a 32-byte hex secret
printf 'your password' | node dist-admin/admin.js hash-password

PW_ADMIN_SESSION_SECRET=... PW_ADMIN_PASSWORD_HASH=... pnpm admin
```

`build:admin` produces two things under `dist-admin/`: `admin.js`, the service,
and `client/`, the editor page. The service serves the page and its bundle
itself, so both have to be built before it will show you anything.

Then open `/admin`. Environment:

| Variable | Default | |
| --- | --- | --- |
| `PW_ADMIN_PASSWORD_HASH` | — | required; scrypt hash, never the password |
| `PW_ADMIN_SESSION_SECRET` | — | required; >= 32 chars, signs the session cookie |
| `PW_ADMIN_HOST` | `127.0.0.1` | loopback on purpose |
| `PW_ADMIN_PORT` | `4321` | |
| `PW_ADMIN_ROOT` | `process.cwd()` | repo root; also the build's working directory |

**Reach it over `localhost`, never over a plain-http LAN address.** The session
cookie is `Secure`, so a browser served the editor from `http://192.168.x.x`
accepts the login and then silently drops the cookie: every request after it
comes back 401. Browsers exempt `localhost`, which is why the deployed service
binds to loopback and is reached through an SSH tunnel:

```bash
ssh -N -L 4321:127.0.0.1:4321 <server>   # then open http://localhost:4321/admin
```

There is deliberately no Caddy route for it. The site is public; its editor is
not on the internet at all.

What the service guarantees, and why each one is a test rather than a habit:

- A save is refused if the body or `cover:` names an image that is not on
  disk, **before** anything is written — the same check `posts.test.ts` runs
  over the committed corpus, so the editor cannot produce a post the repo
  would reject.
- Slugs and image filenames are allowlists (`guards.ts`), so `..` and `/`
  never need to be blocked individually.
- Builds are serialised: two saves in a row queue rather than sharing `dist/`.
- Login is throttled globally — five failures buys a 15-minute lockout.
- A save skips `tsc`, which is what makes it ~0.6 s rather than ~2.4 s. Prose
  changes no types; anything that does still goes through `pnpm build` and CI.

Posts written here are ordinary files: commit them like any other change.

## Layout

- `src/lib/` — `github.ts` (projects feed + language breakdown), `duration.ts`
  (live job durations), `markup.tsx` (`**bold**` rendering), `frontmatter.ts`
  + `posts.ts` + `markdown-images.ts` (the blog corpus), `head.ts` (per-page meta tags), `site.ts`
  (the public origin), `rehype-highlight-lite.ts` (code fences)
- `src/components/` — `hero`, `projects`, `project-card`, `cv-section`,
  `experience-item`, `site-nav`, `home`, `blog-index`, `post-page`,
  `post-body`, `post-meta`, `not-found`
- `src/content/blog/` — the posts
- `src/admin/server/` — the editor service: `handler.ts` (every route, as
  one pure function), `store.ts`, `guards.ts`, `auth.ts`, `rate-limit.ts`,
  `builder.ts`, and the runtime edges `index.ts` / `node-fs.ts` /
  `process.ts` / `config.ts`
- `src/admin/client/index.html` — the editor page, one dependency-free file
- `src/data/` — `cv.json` (content) + `cv.ts` (typed view)
- `src/entry-server.tsx` + `scripts/prerender.mjs` — the build-time prerender
- `public/cv.pdf` — the rendered CV, offered as a download

## Deployment

The static `dist/` is served behind a shared Caddy edge on my home server. The
deploy/orchestration script (`setup_personal_website.sh`) lives in my
[testsAndMisc](https://github.com/kuhyx/testsAndMisc) repo, since it also moves
Gitea and manages the reverse-proxy edge; it builds this repo and serves `dist/`
from a loopback container fronted by Caddy on `kuhy.duckdns.org`.
