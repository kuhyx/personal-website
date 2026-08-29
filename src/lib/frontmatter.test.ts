import { describe, it, expect } from "vitest";
import { parsePost } from "./frontmatter";

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
