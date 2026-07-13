# personal-website

My personal site — a projects showcase and CV — served at
[kuhy.duckdns.org](https://kuhy.duckdns.org/).

Minimalistic, responsive, no build-time secrets. The projects section is fetched
live from the GitHub REST API; the CV is rendered from `src/data/cv.json` (the
same file that renders my LaTeX CV), with per-job durations computed in the
browser.

## Stack

- React 19 + Vite 6 + TypeScript (strict)
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
pnpm build      # tsc -b && vite build -> dist/
```

## Layout

- `src/lib/` — `github.ts` (projects feed + language breakdown), `duration.ts`
  (live job durations), `markup.ts`/`markup.tsx` (`**bold**` rendering)
- `src/components/` — `hero`, `projects`, `project-card`, `cv-section`,
  `experience-item`
- `src/data/` — `cv.json` (content) + `cv.ts` (typed view)
- `public/cv.pdf` — the rendered CV, offered as a download

## Deployment

The static `dist/` is served behind a shared Caddy edge on my home server. The
deploy/orchestration script (`setup_personal_website.sh`) lives in my
[testsAndMisc](https://github.com/kuhyx/testsAndMisc) repo, since it also moves
Gitea and manages the reverse-proxy edge; it builds this repo and serves `dist/`
from a loopback container fronted by Caddy on `kuhy.duckdns.org`.
