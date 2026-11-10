// @vitest-environment node
import type { APIContext } from "astro";
import { aiCatalog, llmsTxt, robotsTxt, sitemapXml } from "./lib/discovery";
import { prerenderRoutes } from "./lib/head";
import { markdownFor } from "./lib/mirror";
import { publishedPosts } from "./lib/posts";
import * as catalog from "./pages/.well-known/ai-catalog.json";
import * as mirror from "./pages/[...path].md";
import * as llms from "./pages/llms.txt";
import * as robots from "./pages/robots.txt";
import * as sitemap from "./pages/sitemap.xml";

function context(params: Record<string, string> = {}): APIContext {
  return { params } as unknown as APIContext;
}

async function body(response: Response | Promise<Response>): Promise<[string, string | null]> {
  const resolved = await response;
  return [await resolved.text(), resolved.headers.get("Content-Type")];
}

describe("discovery endpoints", () => {
  it.each([
    ["robots.txt", robots.GET, robotsTxt(), "text/plain; charset=utf-8"],
    ["sitemap.xml", sitemap.GET, sitemapXml(prerenderRoutes(), publishedPosts), "application/xml; charset=utf-8"],
    ["llms.txt", llms.GET, llmsTxt(publishedPosts), "text/plain; charset=utf-8"],
    [
      "ai-catalog.json",
      catalog.GET,
      `${JSON.stringify(aiCatalog(prerenderRoutes()), null, 2)}\n`,
      "application/ai-catalog+json; charset=utf-8",
    ],
  ])("%s serves the generated file with its type", async (_name, get, expected, type) => {
    expect(await body(get(context()))).toEqual([expected, type]);
  });
});

describe("markdown mirrors", () => {
  it("has one static path per prerendered route", async () => {
    const paths = await mirror.getStaticPaths({} as Parameters<typeof mirror.getStaticPaths>[0]);
    expect(paths.map((entry) => entry.params.path)).toEqual(
      prerenderRoutes().map((route) => (route === "/" ? "index" : route.slice(1))),
    );
  });

  it.each(prerenderRoutes())("serves the mirror of %s", async (route) => {
    const param = route === "/" ? "index" : route.slice(1);
    expect(await body(mirror.GET(context({ path: param })))).toEqual([
      markdownFor(route),
      "text/markdown; charset=utf-8",
    ]);
  });
});
