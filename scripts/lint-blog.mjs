// ============================================================================
// Mechanical blog guardrails (the checkable half of the `blog-writing` skill,
// ~/.claude/skills/blog-writing/SKILL.md). Source article:
// https://refactoringenglish.com/blog/anti-patterns-software-blogging/
//
// ERRORS (exit 1, fail the build):
//   - a fenced code line wider than 80 columns (mobile overflow, rule 7)
//   - images/code blocks could overflow: `.prose img { max-width: 100% }` or
//     `.prose pre { overflow-x: auto }` missing from the stylesheet, or a raw
//     <img> in a post with a fixed width over 640px
//   - body text colours below WCAG AA 4.5:1 against the page/card background,
//     in the light AND the dark theme (rule 8)
// WARNINGS (printed, exit 0):
//   - first paragraph longer than 3 sentences, or an image/quote before it
//     (meandering intro / preamble clutter, rule 1)
//   - accent used as text below 4.5:1 -- the palette is shared across repos and
//     frozen, so this is reported rather than blocking the build
//
// Usage: node scripts/lint-blog.mjs [blog-dir] [css-file]
//   (run by `pnpm lint:blog`, `pnpm lint` and `pnpm build`)
// ============================================================================

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BLOG_DIR = process.argv[2] ?? join(ROOT, "src/content/blog");
const CSS_FILE = process.argv[3] ?? join(ROOT, "src/styles/index.css");

const MAX_CODE_COLUMNS = 80;
const MAX_INTRO_SENTENCES = 3;
const MAX_IMG_WIDTH_PX = 640;
const MIN_CONTRAST = 4.5;
// Text tokens checked against each background token. Accent is warn-only.
const TEXT_TOKENS = ["fg", "muted", "accent"];
const BG_TOKENS = ["bg", "card"];
const WARN_ONLY_TOKENS = new Set(["accent"]);

const errors = [];
const warnings = [];

function* markdownFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* markdownFiles(path);
    else if (entry.name.endsWith(".md")) yield path;
  }
}

// --- markdown checks -------------------------------------------------------

function stripFrontmatter(text) {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(text);
  return match ? text.slice(match[0].length) : text;
}

/** Fenced-code lines wider than the limit, as {line, width}. */
function wideCodeLines(body) {
  const found = [];
  let fence = null;
  body.split("\n").forEach((raw, index) => {
    const line = raw.replace(/\r$/, "");
    const marker = /^\s*(```+|~~~+)/.exec(line);
    if (marker) {
      const mark = marker[1];
      if (fence === null) fence = mark[0];
      else if (mark[0] === fence) fence = null;
      return;
    }
    const width = [...line].length;
    if (fence !== null && width > MAX_CODE_COLUMNS) {
      found.push({ line: index + 1, width });
    }
  });
  return found;
}

/** Blocks of consecutive non-blank lines outside fences, in order. */
function blocks(body) {
  const out = [];
  let current = [];
  let fence = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && line.trim() === "") {
      if (current.length > 0) out.push(current.join(" "));
      current = [];
    } else current.push(line.trim());
  }
  if (current.length > 0) out.push(current.join(" "));
  return out;
}

function sentenceCount(paragraph) {
  const plain = paragraph
    .replace(/`[^`]*`/g, "code")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "url")
    .replace(/\b(e\.g|i\.e|etc|vs)\./gi, "$1")
    .replace(/\b\d+\.\d+/g, "num");
  return plain.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim() !== "").length;
}

function checkIntro(body, label) {
  const all = blocks(body);
  const first = all.findIndex((b) => !/^(#|\||[-*+] |\d+\. )/.test(b));
  if (first === -1) return;
  const before = all.slice(0, first);
  const decorated = (b) => /^(!\[|>|<img)/.test(b);
  if (decorated(all[first]) || before.some(decorated)) {
    warnings.push(`${label}: image or quote before the first paragraph (preamble clutter)`);
    return;
  }
  const count = sentenceCount(all[first]);
  if (count > MAX_INTRO_SENTENCES) {
    warnings.push(
      `${label}: first paragraph has ${String(count)} sentences (> ${String(MAX_INTRO_SENTENCES)}); ` +
        "put the reader's benefit up front",
    );
  }
}

function checkRawImages(body, label) {
  for (const tag of body.match(/<img\b[^>]*>/gi) ?? []) {
    const width = /\bwidth\s*=\s*["']?(\d+)/i.exec(tag) ?? /width\s*:\s*(\d+)px/i.exec(tag);
    if (width && Number(width[1]) > MAX_IMG_WIDTH_PX) {
      errors.push(`${label}: <img> fixed at ${width[1]}px (> ${String(MAX_IMG_WIDTH_PX)}px) overflows phones`);
    }
  }
}

function lintPost(path) {
  const label = relative(ROOT, path);
  const body = stripFrontmatter(readFileSync(path, "utf8"));
  for (const { line, width } of wideCodeLines(body)) {
    errors.push(
      `${label}: code line ${String(line)} is ${String(width)} columns (max ${String(MAX_CODE_COLUMNS)}); wrap it`,
    );
  }
  checkRawImages(body, label);
  checkIntro(body, label);
}

// --- stylesheet checks -----------------------------------------------------

function parseTokens(blockText) {
  const tokens = {};
  for (const m of blockText.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) {
    tokens[m[1]] = m[2];
  }
  return tokens;
}

function luminance(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function lintStylesheet(css) {
  const label = relative(ROOT, CSS_FILE);
  if (!/\.prose\s+img\s*\{[^}]*max-width\s*:\s*100%/.test(css)) {
    errors.push(`${label}: missing \`.prose img { max-width: 100% }\` (wide images force sideways scrolling)`);
  }
  if (!/\.prose\s+pre\s*\{[^}]*overflow-x\s*:\s*(auto|scroll)/.test(css)) {
    errors.push(`${label}: missing \`.prose pre { overflow-x: auto }\` (code would widen the page)`);
  }

  const light = /:root\s*\{([^}]*)\}/.exec(css);
  const dark = /prefers-color-scheme\s*:\s*dark\s*\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css);
  if (!light || !dark) {
    errors.push(`${label}: cannot find the light :root and dark :root colour tokens to check contrast`);
    return;
  }
  const lightTokens = parseTokens(light[1]);
  const themes = { light: lightTokens, dark: { ...lightTokens, ...parseTokens(dark[1]) } };
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const fg of TEXT_TOKENS) {
      for (const bg of BG_TOKENS) {
        if (!tokens[fg] || !tokens[bg]) {
          errors.push(`${label}: --${fg} or --${bg} is not a hex colour in the ${theme} theme`);
          continue;
        }
        const ratio = contrast(tokens[fg], tokens[bg]);
        if (ratio >= MIN_CONTRAST) continue;
        const msg =
          `${label}: ${theme} --${fg} ${tokens[fg]} on --${bg} ${tokens[bg]} ` +
          `is ${ratio.toFixed(2)}:1 (min ${String(MIN_CONTRAST)}:1)`;
        (WARN_ONLY_TOKENS.has(fg) ? warnings : errors).push(msg);
      }
    }
  }
}

// --- main ------------------------------------------------------------------

const posts = [...markdownFiles(BLOG_DIR)];
for (const post of posts) lintPost(post);
lintStylesheet(readFileSync(CSS_FILE, "utf8"));

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
console.log(
  `lint-blog: ${String(posts.length)} post file(s), ${String(errors.length)} error(s), ${String(warnings.length)} warning(s)`,
);
process.exit(errors.length > 0 ? 1 : 0);
