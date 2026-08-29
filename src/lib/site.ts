/**
 * Site-wide constants that must not be duplicated.
 *
 * `SITE_ORIGIN` exists because OpenGraph URLs are not resolved relative to the
 * page they appear on: a card scraper handed `/assets/cover.a1b2c3.png` simply
 * ignores it. Every `og:url` and `og:image` therefore has to be absolutised,
 * and an origin written down in two places is one that rots in one of them.
 */

/** Public origin the built site is served from, with no trailing slash. */
export const SITE_ORIGIN = "https://kuhy.duckdns.org";

/** Fallback `<title>` and description for routes that have no post of their own. */
export const SITE_TITLE = "Krzysztof Rudnicki";
export const SITE_DESCRIPTION =
  "Krzysztof Rudnicki — full-stack engineer. Projects and CV.";

/** Absolute form of a site-root-relative path, for metadata that demands one. */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}
