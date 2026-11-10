import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  metaForPath,
  postMeta,
  prerenderRoutes,
  renderHead,
} from "./head";
import { buildPosts, publishedPosts, type Post } from "./posts";
import { first } from "../test/first";
import { SITE_ORIGIN, SITE_TITLE } from "./site";

const DIR = "../content/blog";

function make(extra = ""): Post {
  const built = buildPosts(
    {
      [`${DIR}/a-post/DOCS-index.md`]: `---\ntitle: A post\ndate: 2026-08-29\nsummary: Short.\n${extra}---\n\nBody.`,
    },
    { [`${DIR}/a-post/c.png`]: "/assets/c.hash.png" },
  );
  return first(built, "post");
}

describe("escapeHtml", () => {
  it("escapes everything that can break out of an attribute", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;",
    );
  });
});

describe("renderHead", () => {
  const base = {
    title: "T",
    description: "D",
    path: "/blog/x",
    image: null,
    publishedAt: null,
  };

  it("absolutises og:url, because a relative one is silently dropped", () => {
    expect(renderHead(base)).toContain(
      `content="${SITE_ORIGIN}/blog/x"`,
    );
  });

  it("marks a page with no date as a website and omits article metadata", () => {
    const html = renderHead(base);
    expect(html).toContain('content="website"');
    expect(html).not.toContain("article:published_time");
    expect(html).toContain('content="summary"');
  });

  it("marks a dated page as an article", () => {
    const html = renderHead({ ...base, publishedAt: "2026-08-29" });
    expect(html).toContain('content="article"');
    expect(html).toContain('article:published_time" content="2026-08-29"');
  });

  it("absolutises og:image and upgrades the card when there is one", () => {
    const html = renderHead({ ...base, image: "/assets/c.hash.png" });
    expect(html).toContain(`og:image" content="${SITE_ORIGIN}/assets/c.hash.png"`);
    expect(html).toContain('content="summary_large_image"');
  });

  it("escapes the title", () => {
    expect(renderHead({ ...base, title: 'A "quoted" <b>' })).toContain(
      "<title>A &quot;quoted&quot; &lt;b&gt;</title>",
    );
  });

  it("emits a canonical link", () => {
    expect(renderHead(base)).toContain(
      `<link rel="canonical" href="${SITE_ORIGIN}/blog/x" />`,
    );
  });
});

describe("postMeta", () => {
  it("suffixes the site name and uses the summary as the description", () => {
    const meta = postMeta(make());
    expect(meta.title).toBe(`A post — ${SITE_TITLE}`);
    expect(meta.description).toBe("Short.");
    expect(meta.path).toBe("/blog/a-post");
    expect(meta.publishedAt).toBe("2026-08-29");
  });

  it("has no image without a cover", () => {
    expect(postMeta(make()).image).toBeNull();
  });

  it("resolves a cover to its hashed URL", () => {
    expect(postMeta(make("cover: ./c.png\n")).image).toBe("/assets/c.hash.png");
  });

  it("falls back to no image when the cover does not resolve", () => {
    expect(postMeta(make("cover: ./missing.png\n")).image).toBeNull();
  });
});

describe("metaForPath", () => {
  it("describes the blog index", () => {
    expect(metaForPath("/blog").title).toBe(`Blog — ${SITE_TITLE}`);
  });

  it("describes a real post", () => {
    const post = first(publishedPosts, "post");
    expect(metaForPath(`/blog/${post.slug}`).title).toContain(post.meta.title);
  });

  it("falls back to the site defaults for anything else", () => {
    const meta = metaForPath("/nonsense");
    expect(meta.title).toBe(SITE_TITLE);
    expect(meta.path).toBe("/");
  });
});

describe("prerenderRoutes", () => {
  it("covers the landing page, the index, and every published post", () => {
    const routes = prerenderRoutes();
    expect(routes.slice(0, 2)).toEqual(["/", "/blog"]);
    expect(routes).toHaveLength(2 + publishedPosts.length);
    for (const entry of publishedPosts) {
      expect(routes).toContain(`/blog/${entry.slug}`);
    }
  });
});
