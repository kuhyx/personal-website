/**
 * Open off-site links from a post in a new tab.
 *
 * Astro renders the markdown, so the rule lives in its pipeline. Only
 * absolute `http(s)` links count as external: `/blog/x` and `#anchor` stay in
 * the tab.
 */

import type { Nodes, Root } from "hast";

const EXTERNAL = /^https?:\/\//;

function visit(node: Nodes): void {
  if (node.type === "element" && node.tagName === "a") {
    const { href } = node.properties;
    if (typeof href === "string" && EXTERNAL.test(href)) {
      node.properties.target = "_blank";
      node.properties.rel = ["noreferrer"];
    }
  }
  if ("children" in node) {
    for (const child of node.children) {
      visit(child);
    }
  }
}

/** Rehype plugin: `target="_blank" rel="noreferrer"` on every external link. */
export function rehypeExternalLinks(): (tree: Root) => void {
  return (tree) => {
    visit(tree);
  };
}
