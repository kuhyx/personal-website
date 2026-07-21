# Design audit — personal-website

Generated against safe-design-rules (anthonyhobday.com/sideprojects/saferules).
Report only — nothing in this repo was changed by the audit itself.

Design-token entry point: `src/styles/index.css` (`:root` custom properties,
lines 1–19), consumed via `var(--x)` throughout component CSS in the same
file. Vite/TS + React; all styling is plain CSS, no CSS-in-JS/Tailwind.

## Web app (src/)

### Violations

- **Rule 1 (near-black/white, not pure)** — `src/styles/index.css:2` —
  light-mode `--bg: #ffffff` is pure white. `--fg: #1a1a1a` (line 3) is
  correctly near-black; dark mode `--bg: #14161a` (line 12) is correctly
  near-black. Only the light background is pure. → give light `--bg` a
  slightly muted value, e.g. `#fcfcfc`–`#fafafa`.

- **Rule 2 (saturate your neutrals)** — `src/styles/index.css:2-7` — light
  neutrals (`--fg #1a1a1a`, `--muted #5c5c5c`, `--border #e4e4e4`, `--card
  #fafafa`) all have equal R=G=B channels: zero saturation, generic gray.
  Compare dark mode (lines 12-17), where every neutral carries a deliberate
  cool/blue tint (e.g. `--bg #14161a` = R20 G22 B26). → apply the same cool
  tint used in dark mode to the light-mode neutrals for consistency.

- **Rule 6 (letter-spacing/line-height by text size)** — `src/styles/index.css:36`
  sets one global `line-height: 1.55` on `body` and nothing overrides it for
  larger text (`.hero h1` at `font-size: 2rem`, lines 54-57) or `h2` (`font-size:
  1.4rem`, lines 80-84). Larger text should get a tighter line-height per the
  rule; right now a 2rem heading inherits the same 1.55 used for 0.75rem tag
  labels. → add a smaller `line-height` (~1.1–1.2) to `.hero h1` and `h2`.

- **Rule 7 (border contrast with both surfaces)** — `src/styles/index.css:6`
  `--border: #e4e4e4` is used as `.project-card` border (line 93) against
  `--card: #fafafa` background (line 96, itself sitting on `--bg: #ffffff`).
  Computed WCAG contrast: border vs card ≈ 1.22:1, border vs page bg ≈
  1.27:1 — both far below the ~3:1 needed for a UI border to read as a
  crisp edge; it will look blurry/washed out. Same `--border` also used for
  `h2` bottom rule (line 82). → darken `--border` in light mode (e.g.
  `#d0d0d0` or add a light shadow instead) to reach ≥3:1 against `#fafafa`.

- **Rule 8 (everything aligns with something)** — `src/styles/index.css:49`
  `.page { max-width: 46rem; }` vs `src/styles/index.css:67`
  `.hero__summary { max-width: 40rem; }` — the intro paragraph's right edge
  sits 6rem short of every other element's right edge (project grid, CV
  content), so it doesn't align with the rest of the page content. →
  either accept this as an intentional readability constraint (see Rule 21
  note below) and align something else to the same 40rem edge, or drop the
  summary's own max-width and control line length at the `.page` level.

- **Rule 11 (mathematically related measurements)** — root is 16px
  (`src/styles/index.css:26`), but spacing values across the file don't sit
  on any consistent scale (neither an 8px/0.5rem nor a 4px/0.25rem
  increment). Off-scale values found at: `:55` `0.25rem`, `:82-83` `1.4rem`
  / `0.35rem`, `:100` `0.4rem`, `:112-114` `0.25rem 1.25rem` / `0.85rem`,
  `:119-120` `0.35rem`, `:146` `0.1rem 0.6rem`, `:162` `0.1rem 0.55rem`,
  `:166` `1.25rem`, `:171` `1.05rem`, `:175` `0.15rem` / `0.9rem`, `:182`
  `1.1rem`, `:198` `0.9rem`, `:201-203` `0.4rem` / `0.3rem 0.8rem`, `:213-214`
  `1.75rem` / `1.1rem`, `:229` `0.4rem 1.5rem`. → pick one base unit (e.g.
  4px/0.25rem) and snap every spacing/sizing value in the file to it.

- **Rule 15 (closer elements should be lighter)** — `src/styles/index.css:2`
  vs `:7` — in light mode `.project-card`'s `--card: #fafafa` (a raised
  container, i.e. "closer" in the z-stack) is *darker* than the page
  `--bg: #ffffff` behind it — backwards from the rule. Dark mode gets this
  right (`--card #1b1e24` at line 17 is lighter than `--bg #14161a` at line
  12). → make light-mode `--card` lighter than `--bg`, or equal plus a
  border, not darker.

- **Rule 19 (outer padding ≥ inner padding)** — `src/styles/index.css:95`
  `.project-card { padding: 1rem; }` vs `:112`
  `.project-card__meta { gap: 0.25rem 1.25rem; }` — the horizontal gap
  between meta items (1.25rem) inside the card exceeds the card's own outer
  padding (1rem), so related inner items end up spaced further apart than
  the container's edge. → reduce the meta gap below 1rem, or increase card
  padding to ≥1.25rem.

- **Rule 20 (body text 16px minimum)** — root/body default is 16px (line
  26) and primary reading copy (hero summary, project descriptions,
  experience bullets) correctly inherits it with no override. But several
  informational text elements drop below 16px: `.project-card__meta`
  `font-size: 0.85rem` (13.6px, line 114), `.project-card__langs li` /
  `.project-card__topics li` `font-size: 0.75rem` (12px, lines 141 & 159),
  `.experience__dates` `font-size: 0.9rem` (14.4px, line 177),
  `.cv__download` `font-size: 0.9rem` (14.4px, line 198). Dates and the CV
  download label are content users need to read, not decorative chrome. →
  raise `.experience__dates` and `.cv__download` to 1rem; tag/badge sizes
  (langs, topics, meta labels) are a defensible exception as UI chrome.

- **Rule 21 (line length ~70 characters)** — `.hero__summary` correctly
  constrains itself to `max-width: 40rem` (`src/styles/index.css:67`, ≈
  75-80 characters at 16px) but no other running text gets the same
  treatment: `.experience__items li` (`:180-183`) has no `max-width` and
  runs the full `.page` content width (~696px effective ≈ 85+ characters at
  16px system-ui). → apply the same ~40rem cap to `.experience__items` and
  any other prose-length list/paragraph content.

- **Rule 22 (button padding: horizontal = 2× vertical)** — `src/styles/index.css:202`
  `.cv__download { padding: 0.3rem 0.8rem; }` — ratio is 2.67×, not 2×.
  `.project-card__langs li` (`:146`, `0.1rem 0.6rem` = 6×) and
  `.project-card__topics li` (`:162`, `0.1rem 0.55rem` = 5.5×) are pill
  badges rather than buttons so the ratio there is a softer call, but the
  one real actionable button on the page (`cv__download`) is off-target. →
  change `.cv__download` padding to `0.4rem 0.8rem` (exactly 2×).

### Not applicable

- Rule 5 (optical alignment) — no icons or asymmetric glyphs in the UI;
  every visual element is text or a simple rectangle/pill, so mathematical
  and optical centers coincide.
- Rule 13 (12-column grid) — this is a single-column article-style page
  (`.page { max-width: 46rem }`, `src/styles/index.css:49`); the only grids
  in use are `.projects__grid` (`auto-fill, minmax(15rem, 1fr)`, line 89)
  and `.cv__skills` (`max-content 1fr`, line 228), neither of which is a
  page-level multi-column layout a 12-col system would meaningfully apply
  to.
- Rule 14 (space between high-contrast points, not bounding box) — cannot
  be verified from CSS source alone; requires a rendered/visual inspection
  (e.g. a browser screenshot pass) to check where actual pixel contrast
  edges fall vs. box padding. Flagged in Notes below, not scored.
- Rule 16 (shadow blur ≈ 2× distance) — no `box-shadow` declaration exists
  anywhere in `src/styles/index.css` (confirmed via full-file read + grep);
  the site uses no shadows at all, so the rule has nothing to check.
- Rule 24 (nest corners properly) — no parent/child rounded-corner
  containers exist where one shape sits flush inside another (the
  `.project-card` radius at `:94` and the pill radii at `:145`/`:161` are
  siblings in a flex row, not nested containers), so there's no
  corner-nesting relationship to validate.
- Rule 28 (lower icon contrast with text) — the UI has no icons anywhere
  (contact links, CTA, and badges are all plain text) — confirmed via
  component read of `hero.tsx`, `project-card.tsx`, `cv-section.tsx`,
  `experience-item.tsx`.

### Notes

- **No box-shadow anywhere** also means rules 26 (no shadows in dark UI)
  and 27 (don't mix depth techniques) pass trivially — there's exactly one
  depth technique in use (flat color + border), applied consistently.
  Worth stating explicitly since "consistent" here is really "absent."
- **Two CSS classes referenced in TSX have zero rules in `index.css`**:
  `project-card__homepage` (`src/components/project-card.tsx:43`) and
  `cv__side-projects` (`src/components/cv-section.tsx:59`). They render
  with only the browser's default `<a>`/`<ul>` styling. This isn't one of
  the 28 rules directly, but it undermines Rule 4 ("everything should be
  deliberate") — these two elements are undeliberate by omission. Add
  explicit rules for both, or confirm the default styling is intentional.
- **Rule 11 is the highest-leverage fix**: nearly every other spacing-shaped
  violation here (19, parts of 21) traces back to the file having no
  declared spacing scale. Introducing one (e.g. CSS custom properties
  `--space-1: 0.25rem` through `--space-8: 2rem`) and refactoring the
  ad-hoc values onto it would resolve rule 11 and make rules 4 and 19
  easier to keep correct going forward.
- Computed contrast ratios in this report (rules 3, 7) use the WCAG
  relative-luminance formula by hand from the hex values in
  `src/styles/index.css`; no browser/devtools contrast checker was run
  against the live rendered page. A rendered-page pass (rule 14, and to
  double-check 3/7) is recommended before treating those numbers as final.
