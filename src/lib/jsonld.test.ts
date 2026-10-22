import { describe, it, expect } from "vitest";
import { jsonLdFor, jsonLdScript, postJsonLd } from "./jsonld";
import { buildPosts, publishedPosts } from "./posts";
import { first } from "../test/first";
import { SITE_ORIGIN } from "./site";

/** The `@type`s in a page's graph, in order. */
function types(path: string): unknown[] {
  return jsonLdFor(path)["@graph"].map((node) => node["@type"]);
}

describe("jsonLdFor", () => {
  it("always carries a schema.org @context", () => {
    expect(jsonLdFor("/")["@context"]).toBe("https://schema.org");
  });

  it("describes the home page as the site plus the person", () => {
    expect(types("/")).toEqual(["WebSite", "Person"]);
    const person = jsonLdFor("/")["@graph"][1];
    expect(person?.name).toBe("Krzysztof Rudnicki");
    expect(person?.sameAs).toContain("https://github.com/kuhyx");
  });

  it("describes the blog index as a Blog", () => {
    expect(types("/blog")).toEqual(["WebSite", "Blog"]);
  });

  it("describes a post as a BlogPosting by the person", () => {
    const post = first(publishedPosts, "published post");
    const graph = jsonLdFor(`/blog/${post.slug}`)["@graph"];
    const posting = graph[1];
    expect(posting?.["@type"]).toBe("BlogPosting");
    expect(posting?.headline).toBe(post.meta.title);
    expect(posting?.datePublished).toBe(post.meta.date);
    expect(posting?.url).toBe(`${SITE_ORIGIN}/blog/${post.slug}`);
    expect(posting?.author).toEqual({ "@id": `${SITE_ORIGIN}/#person` });
    expect(graph[2]?.["@type"]).toBe("Person");
  });
});

describe("postJsonLd", () => {
  function posting(extra: string) {
    const post = first(
      buildPosts(
        {
          "../content/blog/p/DOCS-index.md": `---\ntitle: P\ndate: 2026-08-29\nsummary: S.\n${extra}---\n\nBody.`,
        },
        { "../content/blog/p/c.png": "/assets/c.hash.png" },
      ),
      "post",
    );
    return postJsonLd(post)["@graph"][1];
  }

  it("carries the cover as an absolute image URL", () => {
    expect(posting("cover: ./c.png\n")?.image).toBe(`${SITE_ORIGIN}/assets/c.hash.png`);
  });

  it("omits image when there is no cover", () => {
    expect(posting("")).not.toHaveProperty("image");
  });
});

describe("jsonLdScript", () => {
  it("emits a parseable ld+json script", () => {
    const html = jsonLdScript({ "@context": "https://schema.org", "@graph": [] });
    const match = /^<script type="application\/ld\+json">(.*)<\/script>$/.exec(html);
    expect(match).not.toBeNull();
    expect(JSON.parse(match?.[1] ?? "")).toEqual({
      "@context": "https://schema.org",
      "@graph": [],
    });
  });

  it("cannot be closed early by a </script> inside a value", () => {
    const html = jsonLdScript({
      "@context": "https://schema.org",
      "@graph": [{ "@type": "Thing", name: "</script><b>x" }],
    });
    expect(html.indexOf("</script>")).toBe(html.length - "</script>".length);
    expect(html).toContain("\\u003c/script>");
  });
});
