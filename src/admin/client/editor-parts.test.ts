import { describe, it, expect } from "vitest";
import {
  insertBlock,
  postListItems,
  separator,
  glyph,
  labelledGlyph,
  required,
  parseTags,
  Unauthorised,
  errorMessage,
} from "./editor-parts";
import type { StoredPostJson } from "./editor-parts";

const doc = document;

describe("insertBlock", () => {
  it("empty body inserts text at start", () => {
    const body = doc.createElement("textarea");
    body.value = "";
    insertBlock(body, "hello");
    expect(body.value).toBe("hello");
    expect(body.selectionStart).toBe(5);
    expect(body.selectionEnd).toBe(5);
  });

  it("caret after text with no newline adds two newlines", () => {
    const body = doc.createElement("textarea");
    body.value = "first";
    body.selectionStart = body.selectionEnd = 5;
    insertBlock(body, "second");
    expect(body.value).toBe("first\n\nsecond");
    expect(body.selectionStart).toBe(13);
  });

  it("one newline before caret adds one newline", () => {
    const body = doc.createElement("textarea");
    body.value = "first\n";
    body.selectionStart = body.selectionEnd = 6;
    insertBlock(body, "second");
    expect(body.value).toBe("first\n\nsecond");
    expect(body.selectionStart).toBe(13);
  });

  it("two newlines before caret adds nothing", () => {
    const body = doc.createElement("textarea");
    body.value = "first\n\n";
    body.selectionStart = body.selectionEnd = 7;
    insertBlock(body, "second");
    expect(body.value).toBe("first\n\nsecond");
    expect(body.selectionStart).toBe(13);
  });

  it("text after caret handled symmetrically", () => {
    const body = doc.createElement("textarea");
    body.value = "first\nsecond";
    body.selectionStart = body.selectionEnd = 6; // between first and second
    insertBlock(body, "middle");
    expect(body.value).toBe("first\n\nmiddle\n\nsecond");
  });
});

describe("postListItems", () => {
  const makePost = (slug: string, draft: boolean): StoredPostJson => ({
    slug,
    meta: { title: `Title ${slug}`, date: "2024-01-01", summary: "", tags: [], cover: null, draft },
    body: "",
    images: [],
  });

  it("draft glyph shown only for drafts", () => {
    const posts = [makePost("a", true), makePost("b", false)];
    const items = postListItems(doc, posts, null, (slug) => () => slug);
    expect(items[0]?.querySelector("span[aria-label='draft']") ?? null).not.toBeNull();
    expect(items[1]?.querySelector("span[aria-label='draft']") ?? null).toBeNull();
  });

  it("aria-current true only for current", () => {
    const posts = [makePost("a", false), makePost("b", false)];
    const items = postListItems(doc, posts, "b", (slug) => () => slug);
    expect(items[0]?.querySelector("button")?.getAttribute("aria-current") ?? "").toBe("false");
    expect(items[1]?.querySelector("button")?.getAttribute("aria-current") ?? "").toBe("true");
  });

  it("click calls listener from onPick", () => {
    const posts = [makePost("a", false)];
    let listener: (() => void) | null = null;
    const items = postListItems(doc, posts, null, () => {
      const fn = () => { listener = fn; };
      return fn;
    });
    items[0]?.querySelector("button")?.click();
    expect(listener).not.toBeNull();
  });
});

describe("separator", () => {
  it("empty neighbour returns empty", () => {
    expect(separator("", 0)).toBe("");
    expect(separator("", 2)).toBe("");
  });
  it("one existing newline adds one", () => {
    expect(separator("x", 1)).toBe("\n");
  });
  it("no existing newlines adds two", () => {
    expect(separator("x", 0)).toBe("\n\n");
  });
  it("two existing newlines adds none", () => {
    expect(separator("x", 2)).toBe("");
  });
});

describe("glyph", () => {
  it("creates SVG with correct class and href", () => {
    const svg = glyph(doc, "test");
    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("class")).toBe("icon icon--test");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    const use = svg.querySelector("use");
    expect(use?.getAttribute("href")).toBe("#icon-test");
  });
});

describe("labelledGlyph", () => {
  it("wraps glyph in span with role and aria-label", () => {
    const span = labelledGlyph(doc, "test", "label");
    expect(span.tagName).toBe("SPAN");
    expect(span.getAttribute("role")).toBe("img");
    expect(span.getAttribute("aria-label")).toBe("label");
    expect(span.querySelector("svg")).not.toBeNull();
  });
});

describe("required", () => {
  it("returns element when found", () => {
    const div = doc.createElement("div");
    div.id = "found";
    doc.body.append(div);
    expect(required(doc, "found")).toBe(div);
  });

  it("throws for missing id", () => {
    expect(() => required(doc, "missing")).toThrow("the editor document is missing #missing");
  });
});

describe("parseTags", () => {
  it("splits and trims", () => {
    expect(parseTags("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("filters empty", () => {
    expect(parseTags("a,, b")).toEqual(["a", "b"]);
  });
  it("handles empty string", () => {
    expect(parseTags("")).toEqual([]);
  });
});

describe("Unauthorised", () => {
  it("is an Error subclass", () => {
    expect(new Unauthorised() instanceof Error).toBe(true);
  });
});

describe("errorMessage", () => {
  it("returns message for Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });
  it("stringifies non-Error", () => {
    expect(errorMessage("raw")).toBe("raw");
    expect(errorMessage(null)).toBe("null");
  });
});