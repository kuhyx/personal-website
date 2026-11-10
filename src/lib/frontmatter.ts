/**
 * Strict frontmatter parser for blog posts.
 *
 * Deliberately NOT a YAML parser. The schema is fixed and tiny, so a parser
 * that *rejects* everything it does not recognise beats a general one that
 * silently coerces: a mistyped `sumary:` is a loud failure naming the file,
 * not a post that quietly ships with no link-preview description.
 *
 * Swap in `js-yaml` only if the schema ever grows past what is listed here.
 */

/** The frontmatter block of a post, after validation. */
export interface PostMeta {
  readonly title: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly summary: string;
  readonly tags: readonly string[];
  /** Post-relative image path used for link previews, or null. */
  readonly cover: string | null;
  /** Drafts are excluded from the index, the routes and the prerender. */
  readonly draft: boolean;
}

/** A parsed post file: its validated metadata and the markdown that follows. */
export interface ParsedPost {
  readonly meta: PostMeta;
  readonly body: string;
}

const DELIMITER = "---";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KEY_PATTERN = /^[A-Za-z]+$/;
const KNOWN_KEYS = ["title", "date", "summary", "tags", "cover", "draft"];

function fail(source: string, problem: string): never {
  throw new Error(`${source}: ${problem}`);
}

/** Drop one layer of matching quotes, so `title: "Hello: world"` survives. */
function unquote(value: string): string {
  // slice, not [0]: indexing is typed possibly-absent under
  // noUncheckedIndexedAccess, which would add a branch no test can reach.
  const first = value.slice(0, 1);
  const quoted =
    value.length >= 2 &&
    (first === '"' || first === "'") &&
    value.endsWith(first);
  return quoted ? value.slice(1, -1) : value;
}

/** `[a, b]` -> `["a", "b"]`; `[]` and a bare empty value -> `[]`. */
function parseTags(source: string, value: string): string[] {
  if (value === "") {
    return [];
  }
  if (!value.startsWith("[") || !value.endsWith("]")) {
    fail(source, `tags must be a bracketed list, got "${value}"`);
  }
  return value
    .slice(1, -1)
    .split(",")
    .map((tag) => unquote(tag.trim()))
    .filter((tag) => tag !== "");
}

function parseBoolean(source: string, key: string, value: string): boolean {
  if (value !== "true" && value !== "false") {
    fail(source, `${key} must be true or false, got "${value}"`);
  }
  return value === "true";
}

/** Split the raw file into its frontmatter lines and the markdown body. */
function split(source: string, raw: string): [string[], string] {
  const lines = raw.replace(/^\uFEFF/, "").split("\n");
  if (lines[0]?.trim() !== DELIMITER) {
    fail(source, `must start with a "${DELIMITER}" frontmatter block`);
  }
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === DELIMITER,
  );
  if (end === -1) {
    fail(source, `frontmatter block is never closed with "${DELIMITER}"`);
  }
  return [lines.slice(1, end), lines.slice(end + 1).join("\n").trim()];
}

/** Collect `key: value` pairs, rejecting malformed lines and unknown keys. */
function readFields(source: string, lines: string[]): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    const colon = line.indexOf(":");
    const key = line.slice(0, colon);
    if (colon === -1 || !KEY_PATTERN.test(key)) {
      fail(source, `frontmatter line is not "key: value": "${line}"`);
    }
    if (!KNOWN_KEYS.includes(key)) {
      fail(source, `unknown frontmatter key "${key}" (known: ${KNOWN_KEYS.join(", ")})`);
    }
    if (fields.has(key)) {
      fail(source, `duplicate frontmatter key "${key}"`);
    }
    fields.set(key, unquote(line.slice(colon + 1).trim()));
  }
  return fields;
}

function required(
  source: string,
  fields: Map<string, string>,
  key: string,
): string {
  const value = fields.get(key);
  if (value === undefined || value === "") {
    fail(source, `missing required frontmatter key "${key}"`);
  }
  return value;
}

/**
 * Parse one post file.
 *
 * @param source Path used in error messages, so a failure names the file.
 * @throws {Error} On any malformed, missing, duplicated or unknown field.
 */
export function parsePost(source: string, raw: string): ParsedPost {
  const [block, body] = split(source, raw);
  const fields = readFields(source, block);

  const date = required(source, fields, "date");
  if (!DATE_PATTERN.test(date)) {
    fail(source, `date must be YYYY-MM-DD, got "${date}"`);
  }

  const cover = fields.get("cover");
  const draft = fields.get("draft");

  return {
    meta: {
      title: required(source, fields, "title"),
      date,
      summary: required(source, fields, "summary"),
      tags: parseTags(source, fields.get("tags") ?? ""),
      cover: cover === undefined || cover === "" ? null : cover,
      draft: draft === undefined ? false : parseBoolean(source, "draft", draft),
    },
    body,
  };
}

/** A frontmatter value that cannot be represented in this format. */
function rejectUnwritable(key: string, value: string): void {
  if (value.includes("\n")) {
    throw new Error(`${key} must not contain a newline`);
  }
}

/** First characters that YAML reads as syntax rather than text. */
const YAML_INDICATOR = /^[-?:,[\]{}#&*!|>'"%@`\s]/;
/** Scalars YAML would hand back as a boolean, null or number, not the text. */
const YAML_SPECIAL = /^(?:true|false|yes|no|on|off|y|n|null|~)$/i;
const NUMBER_LIKE = /^[-+.]?\d/;

/**
 * True if writing `value` bare would not read back as the same text.
 *
 * Two readers see this file: {@link parsePost} (the admin) and Astro's YAML
 * frontmatter parser (`astro build`). A bare `Hello: world` or `C# tips` is
 * fine for the first and a parse error or a truncated title for the second,
 * and a value that starts and ends with the same quote loses a layer in the
 * first. Inside a `[...]` tag list, brackets and braces are syntax too.
 */
function needsQuotes(value: string, inFlowList: boolean): boolean {
  return (
    /[:#]/.test(value) ||
    YAML_INDICATOR.test(value) ||
    YAML_SPECIAL.test(value) ||
    NUMBER_LIKE.test(value) ||
    (inFlowList && /[[\]{}]/.test(value))
  );
}

/**
 * `value` as both readers will read it back.
 *
 * Single quotes first: YAML keeps everything inside them literal except `'`,
 * and parsePost strips exactly one layer, so the two agree. A value holding a
 * `'` goes in double quotes, which agree only while there is no `"` or `\`.
 *
 * @throws {Error} When neither quote style is safe for the value.
 */
function writeValue(key: string, value: string, inFlowList = false): string {
  if (!needsQuotes(value, inFlowList)) {
    return value;
  }
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  if (!/["\\]/.test(value)) {
    return `"${value}"`;
  }
  throw new Error(`${key} cannot hold both quote characters (or ' and a backslash) together with YAML syntax`);
}

/**
 * Render metadata and a body back into a post file.
 *
 * The inverse of {@link parsePost}, kept beside it so the two cannot drift:
 * `frontmatter.test.ts` asserts the round trip rather than the output text.
 */
export function serializePost(meta: PostMeta, body: string): string {
  rejectUnwritable("title", meta.title);
  rejectUnwritable("summary", meta.summary);
  if (!DATE_PATTERN.test(meta.date)) {
    throw new Error(`date must be YYYY-MM-DD, got "${meta.date}"`);
  }
  for (const tag of meta.tags) {
    if (/[,\]\n]/.test(tag)) {
      throw new Error(`tag "${tag}" must not contain a comma, bracket or newline`);
    }
  }

  const lines = [
    DELIMITER,
    `title: ${writeValue("title", meta.title)}`,
    `date: ${meta.date}`,
    `summary: ${writeValue("summary", meta.summary)}`,
  ];
  if (meta.tags.length > 0) {
    lines.push(`tags: [${meta.tags.map((tag) => writeValue("tag", tag, true)).join(", ")}]`);
  }
  if (meta.cover !== null) {
    rejectUnwritable("cover", meta.cover);
    lines.push(`cover: ${writeValue("cover", meta.cover)}`);
  }
  // Only written when true: an absent `draft` already means published, and a
  // file full of defaults is harder to read than one stating what is unusual.
  if (meta.draft) {
    lines.push("draft: true");
  }
  lines.push(DELIMITER, "", `${body.trim()}\n`);
  return lines.join("\n");
}
