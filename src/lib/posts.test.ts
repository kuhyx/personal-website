import { describe, it, expect } from "vitest";
import {
  allPosts,
  buildPosts,
  findPost,
  imageKey,
  imageReferences,
  isRemoteImage,
  publishedPosts,
  resolveImage,
} from "./posts";
import { first } from "../test/first";

const DIR = "../content/blog";

function post(slug: string, extra = "", body = "Body."): string {
  return `---\ntitle: ${slug}\ndate: 2026-01-01\nsummary: s\n${extra}---\n\n${body}`;
}

describe("buildPosts", () => {
  it("takes the slug from the directory, not the filename", () => {
    const built = buildPosts({ [`${DIR}/why-i-built-it/DOCS-index.md`]: post("x") }, {});
    expect(built[0]?.slug).toBe("why-i-built-it");
  });

  it("attaches only the images sitting next to the post", () => {
    const built = buildPosts(
      { [`${DIR}/one/DOCS-index.md`]: post("one") },
      {
        [`${DIR}/one/a.png`]: "/assets/a.hash.png",
        [`${DIR}/two/b.png`]: "/assets/b.hash.png",
      },
    );
    expect([...(built[0]?.images.keys() ?? [])]).toEqual(["a.png"]);
    expect(built[0]?.images.get("a.png")).toBe("/assets/a.hash.png");
  });

  it("sorts newest first", () => {
    const built = buildPosts(
      {
        [`${DIR}/old/DOCS-index.md`]: post("old").replace("2026-01-01", "2025-01-01"),
        [`${DIR}/new/DOCS-index.md`]: post("new").replace("2026-01-01", "2027-01-01"),
      },
      {},
    );
    expect(built.map((entry) => entry.slug)).toEqual(["new", "old"]);
  });

  it("breaks a same-date tie on title, so glob order never decides", () => {
    const built = buildPosts(
      {
        [`${DIR}/zebra/DOCS-index.md`]: post("zebra"),
        [`${DIR}/apple/DOCS-index.md`]: post("apple"),
      },
      {},
    );
    expect(built.map((entry) => entry.slug)).toEqual(["apple", "zebra"]);
  });
});

describe("image helpers", () => {
  const built = buildPosts(
    { [`${DIR}/one/DOCS-index.md`]: post("one", "cover: ./c.png\n", "![a](./a.png)\n\n![r](https://x/y.png)") },
    { [`${DIR}/one/a.png`]: "/assets/a.hash.png", [`${DIR}/one/c.png`]: "/assets/c.hash.png" },
  );
  const one = first(built, "post");

  it("normalises a leading ./ away", () => {
    expect(imageKey("./a.png")).toBe("a.png");
    expect(imageKey("a.png")).toBe("a.png");
  });

  it.each([
    ["https://x/y.png", true],
    ["//x/y.png", true],
    ["data:image/svg+xml,x", true],
    ["./a.png", false],
  ])("classifies %s as remote=%s", (source, expected) => {
    expect(isRemoteImage(source)).toBe(expected);
  });

  it("collects body images and the cover, skipping remote ones", () => {
    expect(imageReferences(one).sort()).toEqual(["./a.png", "./c.png"]);
  });

  it("resolves a reference to the hashed URL", () => {
    expect(resolveImage(one, "./a.png")).toBe("/assets/a.hash.png");
  });

  it("throws for a path that does not exist next to the post", () => {
    expect(() => resolveImage(one, "./missing.png")).toThrow(
      /references image "\.\/missing\.png".*Available: a\.png, c\.png/s,
    );
  });

  it("lists (none) when the post has no images at all", () => {
    const bare = first(
      buildPosts({ [`${DIR}/bare/DOCS-index.md`]: post("bare") }, {}),
      "post",
    );
    expect(() => resolveImage(bare, "./x.png")).toThrow(/Available: \(none\)/);
  });
});

describe("the corpus on disk", () => {
  it("loads at least one post", () => {
    expect(allPosts.length).toBeGreaterThan(0);
  });

  it("hides drafts from the published list", () => {
    expect(publishedPosts.every((entry) => !entry.meta.draft)).toBe(true);
    expect(publishedPosts.length).toBeLessThanOrEqual(allPosts.length);
  });

  it("finds a post by slug, and nothing by a bad one", () => {
    const post = first(publishedPosts, "post");
    expect(findPost(post.slug)).toBe(post);
    expect(findPost("definitely-not-a-post")).toBeUndefined();
  });

  // The guarantee: a mistyped image path fails here, in milliseconds, rather
  // than shipping as a 404 nobody notices.
  it.each(allPosts.map((entry) => [entry.slug, entry] as const))(
    "resolves every image referenced by %s",
    (_slug, entry) => {
      for (const source of imageReferences(entry)) {
        expect(() => resolveImage(entry, source)).not.toThrow();
      }
    },
  );
});
