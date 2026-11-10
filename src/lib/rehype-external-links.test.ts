import type { Element, Root } from "hast";
import { rehypeExternalLinks } from "./rehype-external-links";

function link(href: unknown): Element {
  return { type: "element", tagName: "a", properties: { href } as Element["properties"], children: [] };
}

function run(...children: Element[]): Element[] {
  const tree: Root = {
    type: "root",
    children: [{ type: "element", tagName: "p", properties: {}, children: [...children, { type: "text", value: "x" }] }],
  };
  rehypeExternalLinks()(tree);
  return children;
}

describe("rehypeExternalLinks", () => {
  it.each(["https://example.com", "http://example.com/x"])("opens %s in a new tab", (href) => {
    const [anchor] = run(link(href));
    expect(anchor?.properties).toMatchObject({ target: "_blank", rel: ["noreferrer"] });
  });

  it.each(["/blog/x", "#top", "mailto:a@b.c", undefined])("leaves %s alone", (href) => {
    const [anchor] = run(link(href));
    expect(anchor?.properties.target).toBeUndefined();
  });

  it("ignores elements that are not links", () => {
    const span: Element = { type: "element", tagName: "span", properties: { href: "https://x.y" }, children: [] };
    run(span);
    expect(span.properties.target).toBeUndefined();
  });
});
