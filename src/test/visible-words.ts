/**
 * The textgate guard: which words would a visitor SEE on this markup?
 *
 * Walks the text nodes under `root`, skipping what never paints (`script`,
 * `style`, `template`, `head`, and `.sr-only` spoken-only labels; attributes
 * such as `aria-label` are never text nodes). A `[hidden]` subtree still
 * counts: it is shown later. Every `allowed` string (authored content such as
 * cv.json values or a post's title) is cut out first, longest first, and what
 * is left must hold no word of two or more letters.
 */

const SILENT = new Set(["SCRIPT", "STYLE", "TEMPLATE", "HEAD", "TITLE", "NOSCRIPT"]);

function painted(node: Node): boolean {
  for (let el = node.parentElement; el !== null; el = el.parentElement) {
    if (SILENT.has(el.tagName.toUpperCase()) || el.classList.contains("sr-only")) {
      return false;
    }
  }
  return true;
}

/** All painted text under `root`, one entry per text node, untrimmed so runs split by `<strong>` still join. */
export function paintedText(root: Node): string[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const out: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (painted(node)) {
      out.push(text);
    }
  }
  return out;
}

/** The chrome words left on `root` once the `allowed` content strings are cut out. */
export function visibleWords(root: Node, allowed: readonly string[]): string[] {
  let text = paintedText(root).join("");
  const sorted = [...allowed].filter((item) => item.trim() !== "").sort((a, b) => b.length - a.length);
  for (const item of sorted) {
    text = text.split(item).join(" ");
  }
  return text.match(/\p{L}{2,}/gu) ?? [];
}

/** Every string value inside a JSON-like value (for content allowlists). */
export function stringsIn(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringsIn);
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}
