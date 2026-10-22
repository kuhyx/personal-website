import { describe, it, expect } from "vitest";
import { aiCatalog, llmsTxt, robotsTxt, sitemapXml } from "./discovery";
import { buildPosts, type Post } from "./posts";
import { first } from "../test/first";
import { SITE_ORIGIN } from "./site";

const DIR = "../content/blog";

function make(slug = "a-post", title = "A post"): Post {
  const built = buildPosts(
    {
      [`${DIR}/${slug}/DOCS-index.md`]: `---\ntitle: ${title}\ndate: 2026-08-29\nsummary: Short.\n---\n\nBody.`,
    },
    {},
  );
  return first(built, "post");
}

describe("robotsTxt", () => {
  const robots = robotsTxt();

  it("allows every agent, training crawlers included", () => {
    expect(robots).toMatch(/^User-agent: \*\nAllow: \/$/m);
    for (const bot of ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"]) {
      expect(robots).toContain(`User-agent: ${bot}\nAllow: /`);
    }
    expect(robots).not.toMatch(/^Disallow: \/\S*$/m);
  });

  it("points at the sitemap by absolute URL", () => {
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });
});

describe("sitemapXml", () => {
  it("lists every route as an absolute <loc>", () => {
    const xml = sitemapXml(["/", "/blog", "/blog/a-post"], [make()]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    for (const route of ["/", "/blog", "/blog/a-post"]) {
      expect(xml).toContain(`<loc>${SITE_ORIGIN}${route}</loc>`);
    }
  });

  it("dates a post's entry with its publish date and nothing else", () => {
    const xml = sitemapXml(["/", "/blog/a-post"], [make()]);
    expect(xml).toContain(
      `<loc>${SITE_ORIGIN}/blog/a-post</loc><lastmod>2026-08-29</lastmod>`,
    );
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/</loc></url>`);
  });

  it("escapes XML metacharacters", () => {
    expect(sitemapXml(["/a&b"], [])).toContain(`<loc>${SITE_ORIGIN}/a&amp;b</loc>`);
  });
});

describe("llmsTxt", () => {
  const text = llmsTxt([make()]);
  const lines = text.split("\n");

  it("opens with an H1 and a blockquote summary", () => {
    expect(lines[0]).toMatch(/^# \S/);
    expect(lines.slice(1, 4).some((line) => line.startsWith("> "))).toBe(true);
  });

  it("describes the home page, the CV and every post", () => {
    expect(text).toMatch(/^## Pages$/m);
    expect(text).toContain(`](${SITE_ORIGIN}/index.md): `);
    expect(text).toContain(`](${SITE_ORIGIN}/cv.pdf): `);
    expect(text).toContain(`](${SITE_ORIGIN}/blog.md): `);
    expect(text).toMatch(/^## Blog$/m);
    expect(text).toContain(`- [A post](${SITE_ORIGIN}/blog/a-post.md): Short.`);
  });

  it("keeps the Blog section, saying it is empty, when there are no posts", () => {
    const empty = llmsTxt([]);
    expect(empty).toMatch(/^## Blog$/m);
    expect(empty).toContain("No posts yet.");
  });

  it("escapes a ] in a title so the link list stays parseable", () => {
    expect(llmsTxt([make("x", "[draft] notes")])).toContain(
      `- [\\[draft\\] notes](${SITE_ORIGIN}/blog/x.md)`,
    );
  });
});

describe("aiCatalog", () => {
  const catalog = aiCatalog(["/", "/blog/a-post"]);

  it("is a specVersion 1.0 catalog with a host display name", () => {
    expect(catalog.specVersion).toBe("1.0");
    expect(catalog.host.displayName).toBeTruthy();
  });

  it("lists llms.txt, the sitemap and every markdown mirror", () => {
    const urls = catalog.entries.map((entry) => entry.url);
    expect(urls).toEqual([
      `${SITE_ORIGIN}/llms.txt`,
      `${SITE_ORIGIN}/sitemap.xml`,
      `${SITE_ORIGIN}/index.md`,
      `${SITE_ORIGIN}/blog/a-post.md`,
    ]);
  });

  it("gives every entry a unique urn:air identifier and a media type", () => {
    const ids = catalog.entries.map((entry) => entry.identifier);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(/^urn:air:kuhy\.duckdns\.org:/);
      expect(entry.type).toMatch(/^[a-z]+\/[a-z+-]+$/);
    }
  });
});
