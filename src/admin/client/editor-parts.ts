/**
 * Shared editor utilities extracted from editor.ts for reuse and testing.
 */

import type { KeyValue, PendingOp, StoredPostJson } from "./offline-store";

export type { PostMetaJson, StoredPostJson } from "./offline-store";
export type { KeyValue } from "./offline-store";
export type { PendingOp } from "./offline-store";

/** What the editor needs from the outside world. */
export interface EditorPorts {
  readonly doc: Document;
  readonly fetch: typeof globalThis.fetch;
  /** Today as YYYY-MM-DD, for a new post's date. */
  readonly today: () => string;
  /** Persistent key-value storage; falls back to in-memory. */
  readonly storage?: KeyValue;
  /** Register a listener fired whenever the server may be reachable again (reconnect, a timer). */
  readonly onOnline?: (listener: () => void) => void;
}

/** In-memory KeyValue backed by a Map; used when no real storage is provided. */
export function memoryStorage(): KeyValue {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

export interface ListResponse {
  posts: StoredPostJson[];
}
export interface SaveResponse {
  durationMs: number;
}
export interface UploadResponse {
  name: string;
  markdown: string;
}

export const FIELDS = ["slug", "date", "title", "summary", "tags", "cover", "body"] as const;

/** Raised when the session is gone; the caller shows the login form instead. */
export class Unauthorised extends Error {}

/**
 * What to show the author when something failed.
 *
 * A pure function rather than a ternary inside the catch, because `catch`
 * types its argument `unknown` and the non-`Error` case is only reachable from
 * engine-level oddities -- testable here, not through a stub server.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** How a status reads: done, failed, still running, or offline. */
export type Tone = "ok" | "bad" | "busy" | "offline";

/** The `index.html` sprite symbol each tone shows. */
export const TONE_GLYPH: Record<Tone, string> = {
  ok: "ok",
  bad: "error",
  busy: "busy",
  offline: "offline",
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** A decorative `<svg class="icon">` drawing sprite symbol `#icon-<name>` from `index.html`. */
export function glyph(doc: Document, name: string): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", `icon icon--${name}`);
  svg.setAttribute("aria-hidden", "true");
  const use = doc.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

/** A glyph a reader hears as `label`: a `role="img"` span around it. */
export function labelledGlyph(doc: Document, name: string, label: string): HTMLSpanElement {
  const span = doc.createElement("span");
  span.setAttribute("role", "img");
  span.setAttribute("aria-label", label);
  span.append(glyph(doc, name));
  return span;
}

export function required(doc: Document, id: string): HTMLElement {
  const element = doc.getElementById(id);
  if (element === null) {
    throw new Error(`the editor document is missing #${id}`);
  }
  return element;
}

/** Split a comma-separated tag input into the array the API wants. */
export function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

/**
 * The newlines to put between an inserted block and the text beside it.
 *
 * Markdown starts a new block on a blank line, so two newlines is the target
 * and whatever is already at that boundary counts towards it. Nothing beside
 * it needs nothing: padding the ends of the body would only be trimmed away
 * when the post is written out.
 */
export function separator(neighbour: string, existing: number): string {
  return neighbour === "" ? "" : "\n".repeat(2 - existing);
}

/**
 * Insert `text` at the caret, as a block of its own.
 *
 * Everything inserted here is an image, and an image glued to the end of the
 * line before it is at best inline in someone else's paragraph and at worst
 * -- when that line is a closing code fence -- a fence that never closes.
 * That is not a corner case: loading a post assigns `body.value`, which
 * leaves the caret at the end of it, so "pick a post, add an image" lands
 * there every time unless the writer clicks into the textarea first.
 */
export function insertBlock(body: HTMLTextAreaElement, text: string): void {
  const at = body.selectionStart;
  const before = body.value.slice(0, at);
  const after = body.value.slice(body.selectionEnd);
  const lead = separator(before, before.endsWith("\n\n") ? 2 : before.endsWith("\n") ? 1 : 0);
  const trail = separator(after, after.startsWith("\n\n") ? 2 : after.startsWith("\n") ? 1 : 0);
  body.value = `${before}${lead}${text}${trail}${after}`;
  // After the whole block, so the next thing typed starts a new paragraph
  // rather than running on from the image.
  body.selectionStart = body.selectionEnd = at + lead.length + text.length + trail.length;
}

/** The request a pending op translates to. */
export function opRequest(op: PendingOp): [string, RequestInit] {
  if (op.kind === "put") {
    return [
      `/api/posts/${encodeURIComponent(op.slug)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta: op.meta, body: op.body }),
      },
    ];
  }
  return [`/api/posts/${encodeURIComponent(op.slug)}`, { method: "DELETE" }];
}

/**
 * Create list item elements for the post list.
 *
 * @param doc - The document to create elements in.
 * @param posts - The posts to render.
 * @param current - The currently selected post slug.
 * @param onPick - Returns a click handler for a post slug.
 * @returns Array of `<li>` elements.
 */
export function postListItems(
  doc: Document,
  posts: readonly StoredPostJson[],
  current: string | null,
  onPick: (slug: string) => () => void,
): HTMLLIElement[] {
  return posts.map((post) => {
    const item = doc.createElement("li");
    const button = doc.createElement("button");
    button.type = "button";
    button.setAttribute("aria-current", String(post.slug === current));
    const label = doc.createElement("span");
    label.textContent = post.meta.title;
    if (post.meta.draft) {
      label.append(" ", labelledGlyph(doc, "draft", "draft"));
    }
    const when = doc.createElement("small");
    when.textContent = post.meta.date;
    button.append(label, when);
    button.addEventListener("click", onPick(post.slug));
    item.append(button);
    return item;
  });
}

/**
 * The status reporter: a glyph per tone, the sentence spoken-only (textgate:
 * the editor paints no words of its own). `figure` is a number worth seeing,
 * such as the publish time, painted next to the glyph.
 */
export function statusReporter(
  doc: Document,
  status: HTMLElement,
): (text: string, tone?: Tone, figure?: string) => void {
  return (text, tone = "ok", figure) => {
    const spoken = doc.createElement("span");
    spoken.className = "sr-only";
    spoken.textContent = text;
    const shown: Node[] = [glyph(doc, TONE_GLYPH[tone])];
    if (figure !== undefined) {
      shown.push(doc.createTextNode(figure));
    }
    status.replaceChildren(...shown, spoken);
    status.dataset.tone = tone;
  };
}

/** Fill the image list; clicking a name inserts its reference through `onPick`. */
export function renderImageList(
  doc: Document,
  list: HTMLElement,
  images: readonly string[],
  onPick: (name: string) => void,
): void {
  if (images.length === 0) {
    list.replaceChildren(labelledGlyph(doc, "images", "No images yet."));
    return;
  }
  list.replaceChildren();
  for (const name of images) {
    const code = doc.createElement("code");
    code.textContent = name;
    code.addEventListener("click", () => { onPick(name); });
    list.append(code, " ");
  }
}
