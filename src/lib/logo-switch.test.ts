import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { CANDIDATES, PICK_KEY } from "./logo-lab";
// The switcher is a static same-origin module (public/), loaded as-is by the
// base layout so no Astro bundle on the public pages changes because of it.
import { applyPick, wire } from "../../public/logo-switch.js";

const FAVICON = "data:image/svg+xml,current";

function page(): Document {
  const doc = document.implementation.createHTMLDocument("t");
  doc.head.innerHTML = `<link rel="icon" href="${FAVICON}" />`;
  doc.body.innerHTML = `<nav class="site-nav"><a href="/">h</a><a href="/blog">b</a></nav>
    <button type="button" data-logo="c"><img alt="" /></button>
    <button type="button" data-logo="e"></button>
    <button type="button" data-logo-reset></button>`;
  return doc;
}

function icon(doc: Document): string | null {
  return doc.querySelector('link[rel="icon"]')?.getAttribute("href") ?? null;
}

function click(doc: Document, selector: string): void {
  const target = doc.querySelector(selector);
  target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("logo switcher", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps its id list in step with the manifest", () => {
    const script = readFileSync(join(import.meta.dirname, "../../public/logo-switch.js"), "utf8");
    const ids = CANDIDATES.map((c) => `"${c.id}"`).join(", ");
    expect(script).toContain(`const IDS = [${ids}];`);
    expect(script).toContain(`const PICK_KEY = "${PICK_KEY}";`);
  });

  it("leaves a visitor's page untouched when nothing is stored", () => {
    const doc = page();
    const before = doc.documentElement.outerHTML;
    applyPick(doc, localStorage);
    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("ignores a stored id that is not a candidate", () => {
    const doc = page();
    const before = doc.documentElement.outerHTML;
    localStorage.setItem("logo-lab:pick", "zz");
    applyPick(doc, localStorage);
    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("puts the stored candidate first in the nav and as the favicon", () => {
    const doc = page();
    localStorage.setItem("logo-lab:pick", "c");
    applyPick(doc, localStorage);
    const mark = doc.querySelector(".site-nav")?.firstElementChild;
    expect(mark?.tagName).toBe("IMG");
    expect(mark?.getAttribute("src")).toBe("/logo-lab/c/logo.svg");
    expect(mark?.getAttribute("alt")).toBe("");
    expect(icon(doc)).toBe("/logo-lab/c/32.png");
  });

  it("switches on a tap, swaps on the next tap and resets to the current look", () => {
    const doc = page();
    wire(doc, localStorage);
    click(doc, '[data-logo="c"] img');
    expect(localStorage.getItem("logo-lab:pick")).toBe("c");
    expect(doc.querySelectorAll("[data-logo-mark]")).toHaveLength(1);

    click(doc, '[data-logo="e"]');
    expect(doc.querySelectorAll("[data-logo-mark]")).toHaveLength(1);
    expect(doc.querySelector("[data-logo-mark]")?.getAttribute("src")).toBe("/logo-lab/e/logo.svg");
    expect(icon(doc)).toBe("/logo-lab/e/32.png");

    click(doc, "[data-logo-reset]");
    expect(localStorage.getItem("logo-lab:pick")).toBeNull();
    expect(doc.querySelector("[data-logo-mark]")).toBeNull();
    expect(icon(doc)).toBe(FAVICON);
    expect(doc.querySelector('link[rel="icon"]')?.hasAttribute("data-logo-original")).toBe(false);
  });

  it("ignores taps elsewhere and pages without a nav or favicon", () => {
    const doc = document.implementation.createHTMLDocument("t");
    doc.body.innerHTML = "<p>x</p>";
    wire(doc, localStorage);
    click(doc, "p");
    expect(localStorage.getItem("logo-lab:pick")).toBeNull();
    localStorage.setItem("logo-lab:pick", "b");
    applyPick(doc, localStorage);
    expect(doc.body.innerHTML).toBe("<p>x</p>");
  });
});
