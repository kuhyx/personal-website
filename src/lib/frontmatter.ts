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
