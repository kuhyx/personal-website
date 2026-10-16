## Blog posts

Before writing, editing or reviewing ANY post in `src/content/blog/`, load the `blog-writing` skill (`~/.claude/skills/blog-writing/SKILL.md`); `pnpm lint:blog` enforces its mechanical rules and runs in `pnpm lint` and `pnpm build`.

## Commands

- run: `pnpm run dev`
- test: `pnpm run test`
- test-changed: `scripts/test_changed.sh`
- lint: `pnpm run lint`
- coverage: `pnpm run coverage`
- coverage-gaps: `coverage-gaps coverage/lcov.info`
