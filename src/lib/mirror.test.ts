import { describe, it, expect } from "vitest";
import {
  blogIndexMarkdown,
  markdownFor,
  mirrorPath,
  postMarkdown,
} from "./mirror";
import { buildPosts, publishedPosts, type Post } from "./posts";
import { prerenderRoutes } from "./head";
import { first } from "../test/first";
import { SITE_ORIGIN } from "./site";

const DIR = "../content/blog";

function make(body: string, extra = ""): Post {
  const built = buildPosts(
    {
      [`${DIR}/a-post/DOCS-index.md`]: `---\ntitle: A post\ndate: 2026-08-29\nsummary: Short.\n${extra}---\n\n${body}`,
    },
    { [`${DIR}/a-post/c.png`]: "/assets/c.hash.png" },
  );
  return first(built, "post");
}

describe("mirrorPath", () => {
  it.each([
    ["/", "/index.md"],
    ["/blog", "/blog.md"],
    ["/blog/a-post", "/blog/a-post.md"],
  ])("maps %s to %s", (route, expected) => {
    expect(mirrorPath(route)).toBe(expected);
  });
});

describe("postMarkdown", () => {
  it("leads with the title, date and summary", () => {
    const md = postMarkdown(make("Body."));
    expect(md.startsWith("# A post\n")).toBe(true);
    expect(md).toContain("2026-08-29");
    expect(md).toContain("> Short.");
    expect(md).toContain("Body.");
  });

  it("rewrites post-relative images to their absolute hashed URL", () => {
    // Served at /blog/a-post.md, `./c.png` would resolve to /blog/c.png,
    // which does not exist: only the hashed asset does.
    const md = postMarkdown(make("![alt](./c.png) and ![b](c.png)"));
    expect(md).toContain(`![alt](${SITE_ORIGIN}/assets/c.hash.png)`);
    expect(md).toContain(`![b](${SITE_ORIGIN}/assets/c.hash.png)`);
    expect(md).not.toContain("./c.png");
  });

  it("leaves remote images alone", () => {
    const md = postMarkdown(make("![r](https://example.com/x.png)"));
    expect(md).toContain("![r](https://example.com/x.png)");
  });

  it("links back to the HTML page", () => {
    expect(postMarkdown(make("Body."))).toContain(`${SITE_ORIGIN}/blog/a-post`);
  });
});

describe("blogIndexMarkdown", () => {
  it("lists every post with its mirror link and summary", () => {
    const md = blogIndexMarkdown([make("Body.")]);
    expect(md.startsWith("# Blog\n")).toBe(true);
    expect(md).toContain(`- [A post](${SITE_ORIGIN}/blog/a-post.md): Short.`);
  });

  it("says so when there are no posts yet", () => {
    expect(blogIndexMarkdown([])).toContain("No posts yet.");
  });
});

describe("markdownFor", () => {
  it("has a mirror for every prerendered route", () => {
    for (const route of prerenderRoutes()) {
      expect(markdownFor(route).startsWith("# ")).toBe(true);
    }
  });

  it("renders the home page from the CV", () => {
    expect(markdownFor("/")).toContain("## Experience");
  });

  it("renders a published post", () => {
    const post = first(publishedPosts, "published post");
    expect(markdownFor(`/blog/${post.slug}`)).toContain(`# ${post.meta.title}`);
  });

  it("throws for a route with no page, rather than mirroring the home page", () => {
    expect(() => markdownFor("/nope")).toThrow(/\/nope/);
  });
});
