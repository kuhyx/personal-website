/**
 * Syntax highlighting for fenced code blocks, with only the grammars we use.
 *
 * Written here instead of using `rehype-highlight` because that package does
 * `import {common} from 'lowlight'` at module scope: its `languages` option
 * *adds* grammars, it cannot subtract, so the bundle carried roughly forty of
 * them whatever we passed. Importing only `createLowlight` lets Rollup drop
 * the rest — lowlight's entry point is pure re-exports.
 *
 * The traversal is deliberately hand-rolled rather than pulling in
 * `unist-util-visit` and `hast-util-to-text`: a `<pre><code>` subtree contains
 * nothing but text, so the general-purpose versions would be two more
 * dependencies to keep on their newest stable for no behaviour gained.
 */

import type { Element, ElementContent, Nodes, Parents, Root } from "hast";
import { createLowlight } from "lowlight";
import { highlightLanguages } from "./highlight-languages";

const lowlight = createLowlight(highlightLanguages);

function isElement(node: Nodes): node is Element {
  return node.type === "element";
}

function hasChildren(node: Nodes): node is Parents {
  return "children" in node;
}

/** Class names on a hast element; hast models the property as a list or absent. */
function classNames(node: Element): string[] {
  const value = node.properties.className;
  return value === undefined ? [] : value.map(String);
}

/** The `language-x` / `lang-x` fence info string, or null if the fence had none. */
export function languageOf(node: Element): string | null {
  for (const name of classNames(node)) {
    const match = /^lang(?:uage)?-(.+)$/.exec(name);
    if (match?.[1] !== undefined) {
      return match[1];
    }
  }
  return null;
}

/** Concatenate every text node beneath `node`. */
export function textOf(node: Nodes): string {
  if (node.type === "text") {
    return node.value;
  }
  if (!hasChildren(node)) {
    return "";
  }
  return node.children.map(textOf).join("");
}

/**
 * Highlight one `<code>` element in place.
 *
 * Unregistered languages keep their plain text — a post that fences `elixir`
 * should render as an unstyled block, never throw during a build.
 */
export function highlightCode(node: Element): void {
  const language = languageOf(node);
  const registered = language !== null && lowlight.registered(language);
  node.properties.className = [
    "hljs",
    ...(language === null ? [] : [`language-${language}`]),
  ];
  if (!registered) {
    return;
  }
  const tree = lowlight.highlight(language, textOf(node));
  // lowlight emits only elements and text; filtering rather than casting keeps
  // that assumption checked instead of asserted.
  node.children = tree.children.filter(
    (child): child is ElementContent =>
      child.type === "element" || child.type === "text",
  );
}

/** Walk the tree, highlighting every `<code>` that is the child of a `<pre>`. */
function walk(node: Nodes, inPre: boolean): void {
  if (!hasChildren(node)) {
    return;
  }
  for (const child of node.children) {
    if (isElement(child) && child.tagName === "code" && inPre) {
      highlightCode(child);
      continue;
    }
    walk(child, isElement(child) && child.tagName === "pre");
  }
}

/** Rehype plugin: highlight fenced code blocks. */
export function rehypeHighlightLite() {
  return function transform(tree: Root): void {
    walk(tree, false);
  };
}
