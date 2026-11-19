/**
 * The logo candidates on `/logo-lab`, and where their files are served.
 *
 * The designs live in kuhyx/utils (`unified-design-system/logo`) and are
 * vendored here by `scripts/sync-logos.ts` from the commit pinned in
 * `scripts/logo-source.json`; this repo never redraws one. The lab and the
 * switcher only ever use the vendored static files under `public/logo-lab/`.
 */

import source from "../../scripts/logo-source.json" with { type: "json" };

/** One candidate: `id` names its folder, `label` is the only text the lab paints. */
export interface Candidate {
  readonly id: string;
  readonly label: string;
  readonly name: string;
  /** File name of the master in the utils logo folder. */
  readonly file: string;
}

/** The pinned source of the masters. */
export const LOGO_SOURCE: {
  readonly repo: string;
  readonly sha: string;
  readonly dir: string;
} = source;

export const CANDIDATES: readonly Candidate[] = source.candidates;

/** The lab's route. Not a prerendered route, so no discovery file lists it. */
export const LOGO_LAB_ROUTE = "/logo-lab";

/** localStorage key of the candidate kuhy is trying; must match `public/logo-switch.js`. */
export const PICK_KEY = "logo-lab:pick";

/** Favicon / touch-icon / large PNG exports per candidate. */
export const PNG_SIZES: readonly number[] = [16, 32, 64, 180, 512];

/** The og:image card size. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** URL of one of a candidate's files. */
export function assetPath(id: string, file: string): string {
  return `/logo-lab/${id}/${file}`;
}

/** Repo-relative path of one of a candidate's committed files. */
export function publicFile(id: string, file: string): string {
  return `public${assetPath(id, file)}`;
}
