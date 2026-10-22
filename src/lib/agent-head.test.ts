import { describe, it, expect } from "vitest";
import { NOT_FOUND_ROUTE, headFor } from "./agent-head";
import { prerenderRoutes } from "./head";
import { SITE_TITLE } from "./site";

const CATALOG_LINK =
  '<link rel="ai-catalog" href="/.well-known/ai-catalog.json" type="application/ai-catalog+json" />';
const LLMS_LINK = '<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt" />';

describe("headFor", () => {
  it.each(prerenderRoutes())("links the catalog and llms.txt on %s", (route) => {
    const head = headFor(route);
    expect(head).toContain(CATALOG_LINK);
    expect(head).toContain(LLMS_LINK);
  });

  it.each([
    ["/", "/index.md"],
    ["/blog", "/blog.md"],
  ])("advertises the markdown mirror of %s", (route, mirror) => {
    expect(headFor(route)).toContain(
      `<link rel="alternate" type="text/markdown" href="${mirror}" />`,
    );
  });

  it("carries JSON-LD on every page", () => {
    for (const route of prerenderRoutes()) {
      expect(headFor(route)).toContain('<script type="application/ld+json">{"@context"');
    }
  });

  it("keeps the page's own title and canonical", () => {
    const head = headFor("/blog");
    expect(head).toContain(`<title>Blog — ${SITE_TITLE}</title>`);
    expect(head).toContain('<link rel="canonical" href="https://kuhy.duckdns.org/blog" />');
  });
});

describe("headFor(NOT_FOUND_ROUTE)", () => {
  const head = headFor(NOT_FOUND_ROUTE);

  it("is titled as not found and kept out of the index", () => {
    expect(head).toContain(`<title>Not found — ${SITE_TITLE}</title>`);
    expect(head).toContain('<meta name="robots" content="noindex" />');
  });

  it("claims no canonical URL and no markdown mirror", () => {
    // The 404 page is served at whatever address was mistyped; a canonical
    // pointing at "/" would tell crawlers that address is the home page.
    expect(head).not.toContain("canonical");
    expect(head).not.toContain("og:url");
    expect(head).not.toContain("text/markdown");
  });

  it("still links the catalog, like every other page", () => {
    expect(head).toContain(CATALOG_LINK);
  });
});
