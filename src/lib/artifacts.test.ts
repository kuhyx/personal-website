import { describe, it, expect } from "vitest";
import { siteFiles } from "./artifacts";
import { prerenderRoutes } from "./head";
import { mirrorPath } from "./mirror";
import { NOT_FOUND_ROUTE } from "./agent-head";

const TEMPLATE = [
  "<head>",
  "<!--head-start-->",
  "<title>default</title>",
  "<!--head-end-->",
  "</head>",
  '<div id="root"><!--app-html--></div>',
].join("\n");

/** A stand-in renderer that records which route each file came from. */
function fakeRender(route: string): { html: string; head: string } {
  return { html: `<p>route ${route}</p>`, head: `<title>${route}</title>` };
}

describe("siteFiles", () => {
  const files = siteFiles(TEMPLATE, fakeRender);
  const byName = new Map(files.map((file) => [file.file, file.contents]));

  it("writes every file path relative to dist/, once", () => {
    const names = files.map((file) => file.file);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.startsWith("/")).toBe(false);
      expect(name).not.toContain("..");
    }
  });

  it("prerenders one HTML file per route", () => {
    expect(byName.get("index.html")).toContain("<p>route /</p>");
    expect(byName.get("blog/index.html")).toContain("<p>route /blog</p>");
  });

  it("writes 404.html from the not-found route, at the root", () => {
    expect(byName.get("404.html")).toContain(`<p>route ${NOT_FOUND_ROUTE}</p>`);
    expect(byName.has("404/index.html")).toBe(false);
  });

  it("writes the discovery files", () => {
    expect(byName.get("robots.txt")).toContain("Sitemap: ");
    expect(byName.get("sitemap.xml")).toContain("<urlset");
    expect(byName.get("llms.txt")).toMatch(/^# /);
    const catalog: unknown = JSON.parse(byName.get(".well-known/ai-catalog.json") ?? "");
    expect(catalog).toHaveProperty("specVersion", "1.0");
  });

  it("writes a markdown mirror for every route, where the head says it is", () => {
    for (const route of prerenderRoutes()) {
      expect(byName.get(mirrorPath(route).slice(1))).toMatch(/^# /);
    }
  });

  it("keeps the 404 page out of the sitemap", () => {
    expect(byName.get("sitemap.xml")).not.toContain(NOT_FOUND_ROUTE);
  });
});
