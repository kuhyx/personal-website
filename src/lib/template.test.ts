import { describe, it, expect } from "vitest";
import { inject, outputPath } from "./template";

const TEMPLATE = [
  "<head>",
  "<!--head-start-->",
  "<title>default</title>",
  "<!--head-end-->",
  "</head>",
  '<div id="root"><!--app-html--></div>',
].join("\n");

describe("inject", () => {
  it("replaces the head block and the app markup", () => {
    const out = inject(TEMPLATE, { html: "<p>hi</p>", head: "<title>real</title>" });
    expect(out).toContain("<title>real</title>");
    expect(out).not.toContain("<title>default</title>");
    expect(out).toContain('<div id="root"><p>hi</p></div>');
    expect(out).not.toContain("<!--app-html-->");
  });

  it.each(["$&", "$'", "$`", "$1", "$$"])(
    "inserts %s literally instead of expanding it",
    (token) => {
      // React escapes ' & < > into entities, so a post containing $' arrives
      // here as `$&#39;` — every one of these is a real replacement pattern.
      const html = `<p>a ${token} b</p>`;
      expect(inject(TEMPLATE, { html, head: "<title>t</title>" })).toContain(html);
    },
  );

  it("keeps a $-heavy shell snippet byte-for-byte", () => {
    const html = "<code>printf $'%s\\n' &amp;&amp; echo $&amp;</code>";
    expect(inject(TEMPLATE, { html, head: "<title>t</title>" })).toContain(html);
  });

  it.each([
    ["the head markers", TEMPLATE.replace("<!--head-end-->", ""), /head-start.*head-end/],
    ["the app marker", TEMPLATE.replace("<!--app-html-->", ""), /app-html/],
  ])("throws when the template is missing %s", (_label, broken, expected) => {
    expect(() => inject(broken, { html: "x", head: "y" })).toThrow(expected);
  });
});

describe("outputPath", () => {
  it.each([
    ["/", "index.html"],
    ["/blog", "blog/index.html"],
    ["/blog/hello-world", "blog/hello-world/index.html"],
  ])("maps %s to %s", (route, expected) => {
    expect(outputPath(route)).toBe(expected);
  });
});
