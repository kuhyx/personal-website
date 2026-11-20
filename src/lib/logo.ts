/**
 * The site's logo (favicon set, header mark, og:image card) and where its
 * files are served.
 *
 * The design lives in kuhyx/utils (`unified-design-system/logo/final`) and is
 * vendored here by `scripts/sync-logos.ts` from the commit pinned in
 * `scripts/logo-source.json`; this repo never redraws it. Pages only ever use
 * the vendored static files under `public/logo/`.
 */

import source from "../../scripts/logo-source.json" with { type: "json" };

/** The pinned source of the master: `dir/file` in `repo` at `sha`. */
export const LOGO_SOURCE: {
  readonly repo: string;
  readonly sha: string;
  readonly dir: string;
  readonly file: string;
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

/** The vector mark: the header mark and the SVG favicon. */
export const LOGO_SVG = assetPath("logo.svg");

/** The card every page without its own cover shows when it is shared. */
export const LOGO_OG = assetPath("og.png");
