/**
 * Logo lab switcher: lets kuhy try a logo candidate as the live header mark
 * and favicon, on his own browser only.
 *
 * The pick lives in localStorage, so the served HTML never changes: with no
 * stored pick this module touches nothing, and every visitor sees the current
 * look. On /logo-lab, tapping a `[data-logo]` button stores that candidate and
 * `[data-logo-reset]` clears it. Delete this file once the pick is wired in.
 * Ids must match scripts/logo-source.json (src/lib/logo-lab.test.ts checks).
 */

const PICK_KEY = "logo-lab:pick";
const IDS = ["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3", "d1", "d2", "d3", "e1", "e2", "e3", "f1", "f2", "f3"];
/** Same size as the nav's icons (`.site-nav .icon`, 1.75rem at 16 px). */
const MARK_PX = 28;

/**
 * Show the stored candidate in the nav and the tab, or restore the current look.
 * @param {Document} doc
 * @param {Storage} storage
 */
export function applyPick(doc, storage) {
  const id = storage.getItem(PICK_KEY);
  const pick = id !== null && IDS.includes(id) ? id : null;
  doc.querySelector("[data-logo-mark]")?.remove();
  const icon = doc.querySelector('link[rel="icon"]');
  if (pick === null) {
    const original = icon?.getAttribute("data-logo-original");
    if (icon && original !== null && original !== undefined) {
      icon.setAttribute("href", original);
      icon.removeAttribute("data-logo-original");
    }
    return;
  }
  const mark = doc.createElement("img");
  mark.setAttribute("src", `/logo-lab/${pick}/logo.svg`);
  mark.setAttribute("alt", "");
  mark.setAttribute("width", String(MARK_PX));
  mark.setAttribute("height", String(MARK_PX));
  mark.setAttribute("data-logo-mark", "");
  doc.querySelector(".site-nav")?.prepend(mark);
  if (icon) {
    if (!icon.hasAttribute("data-logo-original")) {
      icon.setAttribute("data-logo-original", icon.getAttribute("href") ?? "");
    }
    icon.setAttribute("href", `/logo-lab/${pick}/32.png`);
  }
}

/**
 * Store a candidate on a `[data-logo]` tap, clear it on `[data-logo-reset]`.
 * @param {Document} doc
 * @param {Storage} storage
 */
export function wire(doc, storage) {
  doc.addEventListener("click", (event) => {
    const target = /** @type {Element} */ (event.target);
    const button = target.closest("[data-logo], [data-logo-reset]");
    if (button === null) {
      return;
    }
    const id = button.getAttribute("data-logo");
    if (id === null) {
      storage.removeItem(PICK_KEY);
    } else {
      storage.setItem(PICK_KEY, id);
    }
    applyPick(doc, storage);
  });
}

if (typeof document !== "undefined" && typeof localStorage !== "undefined") {
  applyPick(document, localStorage);
  wire(document, localStorage);
}
