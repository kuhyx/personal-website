import { describe, it, expect } from "vitest";
import { parsePost, serializePost, type PostMeta } from "./frontmatter";

const MINIMAL = `---
title: A post
date: 2026-08-29
summary: Something short.
---

Body text.`;

describe("parsePost", () => {
  it("parses the required fields and the body", () => {
    const { meta, body } = parsePost("a.md", MINIMAL);
    expect(meta.title).toBe("A post");
    expect(meta.date).toBe("2026-08-29");
    expect(meta.summary).toBe("Something short.");
    expect(meta.tags).toEqual([]);
    expect(meta.cover).toBeNull();
    expect(meta.draft).toBe(false);
    expect(body).toBe("Body text.");
  });

  it("parses the optional fields", () => {
    const raw = MINIMAL.replace(
      "summary: Something short.",
      "summary: Something short.\ntags: [meta, react]\ncover: ./c.png\ndraft: true",
    );
    const { meta } = parsePost("a.md", raw);
    expect(meta.tags).toEqual(["meta", "react"]);
    expect(meta.cover).toBe("./c.png");
    expect(meta.draft).toBe(true);
  });

  it("treats an empty tag list and empty cover as absent", () => {
    const raw = MINIMAL.replace(
      "summary: Something short.",
      "summary: Something short.\ntags: []\ncover:",
    );
    const { meta } = parsePost("a.md", raw);
    expect(meta.tags).toEqual([]);
    expect(meta.cover).toBeNull();
  });

  it("drops empty entries inside a tag list", () => {
    const raw = MINIMAL.replace("date:", "tags: [a, , b]\ndate:");
    expect(parsePost("a.md", raw).meta.tags).toEqual(["a", "b"]);
  });

  it("strips one layer of quotes, so a colon can appear in a value", () => {
    const raw = MINIMAL.replace("title: A post", 'title: "A post: with a colon"');
    expect(parsePost("a.md", raw).meta.title).toBe("A post: with a colon");
  });

  it("unquotes single-quoted tags", () => {
    const raw = MINIMAL.replace("date:", "tags: ['a b']\ndate:");
    expect(parsePost("a.md", raw).meta.tags).toEqual(["a b"]);
  });

  it("ignores blank lines inside the block", () => {
    const raw = MINIMAL.replace("date:", "\ndate:");
    expect(parsePost("a.md", raw).meta.date).toBe("2026-08-29");
  });

  it("tolerates a byte-order mark", () => {
    expect(parsePost("a.md", `\uFEFF${MINIMAL}`).meta.title).toBe("A post");
  });

  it.each([
    ["no frontmatter at all", "Just text.", /must start with/],
    [
      "an unclosed block",
      "---\ntitle: x\ndate: 2026-01-01\nsummary: y",
      /never closed/,
    ],
    [
      "a malformed line",
      MINIMAL.replace("date:", "this is not a field\ndate:"),
      /not "key: value"/,
    ],
    [
      "an unknown key",
      MINIMAL.replace("date:", "sumary: typo\ndate:"),
      /unknown frontmatter key "sumary"/,
    ],
    [
      "a duplicate key",
      MINIMAL.replace("date:", "title: again\ndate:"),
      /duplicate frontmatter key "title"/,
    ],
    ["a missing title", MINIMAL.replace("title: A post\n", ""), /"title"/],
    ["an empty summary", MINIMAL.replace("Something short.", ""), /"summary"/],
    [
      "a non-ISO date",
      MINIMAL.replace("2026-08-29", "29 Aug 2026"),
      /date must be YYYY-MM-DD/,
    ],
    [
      "an unbracketed tag list",
      MINIMAL.replace("date:", "tags: meta, react\ndate:"),
      /tags must be a bracketed list/,
    ],
    [
      "a non-boolean draft",
      MINIMAL.replace("date:", "draft: yes\ndate:"),
      /draft must be true or false/,
    ],
  ])("rejects %s", (_label, raw, expected) => {
    expect(() => parsePost("posts/a.md", raw)).toThrow(expected);
  });

  it("names the offending file in the error", () => {
    expect(() => parsePost("posts/broken.md", "nope")).toThrow(/^posts\/broken\.md:/);
  });
});

describe("serializePost", () => {
  const base: PostMeta = {
    title: "A post",
    date: "2026-08-29",
    summary: "Short.",
    tags: [],
    cover: null,
    draft: false,
  };

  // The round trip is the contract, not the exact text: asserting on output
  // formatting would let the pair drift while both tests still pass.
  it.each([
    ["the minimum", base],
    ["tags", { ...base, tags: ["meta", "react"] }],
    ["a cover", { ...base, cover: "./c.png" }],
    ["a draft", { ...base, draft: true }],
    ["everything", { ...base, tags: ["a"], cover: "./c.png", draft: true }],
    ["a colon in the title", { ...base, title: "A post: with a colon" }],
    ["a quote inside the summary", { ...base, summary: 'He said "hi" once.' }],
    ["a fully double-quoted title", { ...base, title: '"quoted"' }],
    ["a fully single-quoted title", { ...base, title: "'quoted'" }],
    ["a lone quote character", { ...base, title: '"' }],
    ["a bracketed summary", { ...base, summary: "[not a tag list]" }],
  ])("round-trips %s", (_label, meta) => {
    const parsed = parsePost("a.md", serializePost(meta, "Body **text**."));
    expect(parsed.meta).toEqual(meta);
    expect(parsed.body).toBe("Body **text**.");
  });

  it("round-trips a multi-paragraph body unchanged", () => {
    const body = "# H\n\nOne.\n\n```ts\nconst x = 1;\n```\n\nTwo.";
    expect(parsePost("a.md", serializePost(base, body)).body).toBe(body);
  });

  it.each([
    ["a newline in the title", { ...base, title: "a\nb" }, /title must not contain/],
    ["a newline in the summary", { ...base, summary: "a\nb" }, /summary must not contain/],
    ["a newline in the cover", { ...base, cover: "a\nb" }, /cover must not contain/],
    ["a bad date", { ...base, date: "29-08-2026" }, /date must be YYYY-MM-DD/],
    ["a comma in a tag", { ...base, tags: ["a,b"] }, /must not contain a comma/],
    ["a bracket in a tag", { ...base, tags: ["a]b"] }, /must not contain a comma/],
  ])("refuses to write %s", (_label, meta, expected) => {
    expect(() => serializePost(meta, "Body.")).toThrow(expected);
  });
});
