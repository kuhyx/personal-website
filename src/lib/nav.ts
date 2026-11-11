import type { IconName } from "./icons";

/** The two top-level sections the site nav links to. */
export type NavItem = "/" | "/blog";

/**
 * One nav link: where it goes, its glyph, its spoken-only label (textgate: the
 * nav paints no words), and whether it is the current section.
 */
export interface NavLink {
  readonly href: NavItem;
  readonly icon: IconName;
  readonly label: string;
  readonly current: boolean;
}

/**
 * The nav links with `current` marked.
 *
 * `current` is decided by the page, not by the URL: the 404 page is built once
 * and served at every mistyped address, so it passes null and marks nothing,
 * where a URL match would light up Blog on `/blog/typo`.
 */
export function navLinks(current: NavItem | null): NavLink[] {
  return [
    { href: "/", icon: "home", label: "Home", current: current === "/" },
    { href: "/blog", icon: "blog", label: "Blog", current: current === "/blog" },
  ];
}
