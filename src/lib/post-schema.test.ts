import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { parsePost, serializePost, type PostMeta } from "./frontmatter";
import { postSchema } from "./post-schema";

const BLOG_DIR = join(import.meta.dirname, "../content/blog");

/** What Astro's glob loader does to a post file: YAML, then the schema. */
function astroParse(raw: string): PostMeta {
  return postSchema.parse(parseFrontmatter(raw).frontmatter);
}

const META: PostMeta = {
  title: "Hello",
  date: "2026-08-29",
  summary: "A summary.",
  tags: ["a", "b"],
  cover: null,
  draft: false,
};

describe("postSchema", () => {
  it("normalises a YAML date to YYYY-MM-DD and fills defaults", () => {
    expect(postSchema.parse({ title: "T", date: new Date("2026-08-29"), summary: "S" })).toEqual({
      title: "T",
      date: "2026-08-29",
      summary: "S",
      tags: [],
      cover: null,
      draft: false,
    });
  });

  it("keeps a quoted date, numbers as text, an empty tags list and a cover", () => {
    expect(
      postSchema.parse({ title: 2026, date: "2026-01-02", summary: "S", tags: null, cover: "c.png", draft: true }),
    ).toEqual({ title: "2026", date: "2026-01-02", summary: "S", tags: [], cover: "c.png", draft: true });
  });

  it("reads an empty cover as no cover", () => {
    expect(postSchema.parse({ title: "T", date: "2026-01-02", summary: "S", cover: "" }).cover).toBeNull();
  });

  it("rejects an unknown key, naming it", () => {
    const result = postSchema.safeParse({ title: "T", date: "2026-01-02", summary: "S", sumary: "x" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("sumary");
  });

  it.each([
    ["a missing title", { date: "2026-01-02", summary: "S" }],
    ["an empty summary", { title: "T", date: "2026-01-02", summary: "" }],
    ["a malformed date", { title: "T", date: "02.01.2026", summary: "S" }],
    ["a non-boolean draft", { title: "T", date: "2026-01-02", summary: "S", draft: "yes" }],
  ])("rejects %s", (_what, data) => {
    expect(postSchema.safeParse(data).success).toBe(false);
  });
});

// Differential: the admin writes posts with serializePost and the hand-written
// parsePost reads them back, but `astro build` reads them as YAML. A value the
// two read differently is a save that the admin accepts and the build then
// fails on (or, worse, ships altered).
describe("serializePost output, read by Astro", () => {
  it.each([
    ["plain", "Hello, world"],
    ["a colon", "Hello: world"],
    ["a trailing colon", "Note:"],
    ["a hash", "C# tips #1"],
    ["a leading dash", "- not a list"],
    ["a leading bracket", "[draft] notes"],
    ["a leading brace", "{curly}"],
    ["a leading star", "*nix"],
    ["a leading ampersand", "&anchor"],
    ["a leading bang", "!important"],
    ["a leading percent", "%done"],
    ["a leading at", "@handle"],
    ["a leading backtick", "`code`"],
    ["a leading pipe", "| table"],
    ["a leading angle", "> quote"],
    ["a leading question mark", "? what"],
    ["a single quote", "It's here"],
    ["a double quote", 'He said "hi"'],
    ["matching double quotes", '"quoted"'],
    ["matching single quotes", "'quoted'"],
    ["a backslash", "C:\\path"],
    ["a YAML boolean", "true"],
    ["a YAML null", "null"],
    ["a tilde", "~"],
    ["a number", "2026"],
    ["a float", "1.50"],
    ["a date", "2026-01-02"],
    ["yes", "yes"],
  ])("round-trips a title with %s", (_what, title) => {
    const meta = { ...META, title, summary: title };
    const file = serializePost(meta, "Body.");
    expect(parsePost("x.md", file).meta).toEqual(meta);
    expect(astroParse(file)).toEqual(meta);
  });

  it("round-trips tags and a cover that need quoting", () => {
    const meta = { ...META, tags: ["c#", "a: b", "yes", "2026", "it's"], cover: "./a b: c.png", draft: true };
    const file = serializePost(meta, "Body.");
    expect(parsePost("x.md", file).meta).toEqual(meta);
    expect(astroParse(file)).toEqual(meta);
  });

  it("refuses a value it cannot quote for both readers", () => {
    expect(() => serializePost({ ...META, title: `Both ' and ": here` }, "B")).toThrow(
      "title cannot hold both quote characters",
    );
  });
});

describe("every post on disk", () => {
  const files = readdirSync(BLOG_DIR).map((slug) => join(BLOG_DIR, slug, "DOCS-index.md"));

  it.each(files)("reads the same through parsePost and the schema: %s", (file) => {
    const raw = readFileSync(file, "utf8");
    expect(astroParse(raw)).toEqual(parsePost(file, raw).meta);
  });
});
