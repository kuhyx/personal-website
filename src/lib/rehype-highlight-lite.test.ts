import { describe, it, expect } from "vitest";
import type { Element, Root } from "hast";
import {
  highlightCode,
  languageOf,
  rehypeHighlightLite,
  textOf,
} from "./rehype-highlight-lite";

function code(className: string[] | undefined, value = "const x = 1;"): Element {
  return {
    type: "element",
    tagName: "code",
    properties: className === undefined ? {} : { className },
    children: [{ type: "text", value }],
  };
}

function tree(child: Element): Root {
  return {
    type: "root",
    children: [
      { type: "element", tagName: "pre", properties: {}, children: [child] },
    ],
  };
}

describe("languageOf", () => {
  it.each([
    [["language-ts"], "ts"],
    [["lang-ts"], "ts"],
    [["hljs", "language-python"], "python"],
    [["hljs"], null],
    [undefined, null],
  ])("reads %s as %s", (className, expected) => {
    expect(languageOf(code(className))).toBe(expected);
  });
});

describe("textOf", () => {
  it("concatenates nested text", () => {
    expect(
      textOf({
        type: "element",
        tagName: "code",
        properties: {},
        children: [
          { type: "text", value: "a" },
          {
            type: "element",
            tagName: "span",
            properties: {},
            children: [{ type: "text", value: "b" }],
          },
        ],
      }),
    ).toBe("ab");
  });

  it("returns nothing for a childless node", () => {
    expect(textOf({ type: "comment", value: "x" })).toBe("");
  });
});

describe("highlightCode", () => {
  it("splits a registered language into hljs spans", () => {
    const node = code(["language-typescript"]);
    highlightCode(node);
    expect(node.properties.className).toEqual(["hljs", "language-typescript"]);
    expect(node.children.length).toBeGreaterThan(1);
    expect(JSON.stringify(node.children)).toContain("hljs-keyword");
  });

  it("leaves an unregistered language as plain text rather than throwing", () => {
    const node = code(["language-brainfuck"], "+++");
    highlightCode(node);
    expect(node.properties.className).toEqual(["hljs", "language-brainfuck"]);
    expect(node.children).toEqual([{ type: "text", value: "+++" }]);
  });

  it("marks an unlabelled fence as hljs with no language class", () => {
    const node = code(undefined, "plain");
    highlightCode(node);
    expect(node.properties.className).toEqual(["hljs"]);
  });
});

describe("rehypeHighlightLite", () => {
  it("highlights code inside a pre", () => {
    const root = tree(code(["language-typescript"]));
    rehypeHighlightLite()(root);
    expect(JSON.stringify(root)).toContain("hljs-keyword");
  });

  it("leaves inline code outside a pre alone", () => {
    const inline = code(["language-typescript"]);
    const root: Root = {
      type: "root",
      children: [
        { type: "element", tagName: "p", properties: {}, children: [inline] },
      ],
    };
    rehypeHighlightLite()(root);
    expect(inline.children).toEqual([{ type: "text", value: "const x = 1;" }]);
  });

  it("walks past nodes that cannot have children", () => {
    const root: Root = { type: "root", children: [{ type: "comment", value: "x" }] };
    expect(() => { rehypeHighlightLite()(root); }).not.toThrow();
  });
});
