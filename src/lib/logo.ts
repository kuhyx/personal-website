/**
 * The site's logo (favicon set, header mark, og:image card) and where its
 * files are served.
 *
 * The design lives in kuhyx/utils (`unified-design-system/logo/final`) and is
 * vendored here by `scripts/sync-logos.ts` from the commit pinned in
 * `scripts/logo-source.json`; this repo never redraws it. Pages only ever use
 * the vendored static files under `public/logo/`.
 *
 * Two masters, the same letters at two sizes: `logo.svg` keeps them clear of
 * a round crop (header mark, avatars, touch icon, og card); `favicon.svg`
 * fits them to the square, for tab icons, where at 16 px every pixel counts.
 */

import source from "../../scripts/logo-source.json" with { type: "json" };

/** The pinned source of the masters: `dir/file` and `dir/favicon` in `repo` at `sha`. */
export const LOGO_SOURCE: {
  readonly repo: string;
  readonly sha: string;
  readonly dir: string;
  readonly file: string;
  readonly favicon: string;
} = source;

/** Favicon / touch-icon / large PNG exports. */
export const PNG_SIZES: readonly number[] = [16, 32, 64, 180, 512];

/** The og:image card size. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** URL of one of the logo's files. */
export function assetPath(file: string): string {
  return `/logo/${file}`;
}

/** Repo-relative path of one of the logo's committed files. */
export function publicFile(file: string): string {
  return `public${assetPath(file)}`;
}

/** The largest PNG export that is a tab icon; larger ones may be cropped round. */
const TAB_ICON_MAX = 32;

/** The vendored master a PNG export of `size` px is rendered from. */
export function masterFor(size: number): "favicon.svg" | "logo.svg" {
  return size <= TAB_ICON_MAX ? "favicon.svg" : "logo.svg";
}

/** The round-safe vector mark: the header mark. */
export const LOGO_SVG = assetPath("logo.svg");

/** The square-fitted vector mark: the SVG tab icon. */
export const FAVICON_SVG = assetPath("favicon.svg");

/** The card every page without its own cover shows when it is shared. */
export const LOGO_OG = assetPath("og.png");
