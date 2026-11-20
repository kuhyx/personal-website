/**
 * Node-only half of the logo: read the master from a utils checkout at the
 * pinned commit, and render the PNG exports and the og card with sharp.
 * Used by `scripts/sync-logos.ts` to write the files and by the tests to
 * prove the committed files still match a fresh render.
 */

import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { OG_SIZE } from "./logo.ts";

/** The charcoal of the master's field; the og card is filled with it. */
const INK = "#211D1B";

/** The master's viewBox edge, so a render at `size` px needs no resampling. */
const MASTER = 512;

/** How much of the og card's height the mark takes. */
const OG_MARK = 420;

/** `path` at commit `sha` in the git checkout `dir`, or null if either is missing. */
export function readMaster(dir: string, sha: string, path: string): string | null {
  try {
    return execFileSync("git", ["-C", dir, "show", `${sha}:${path}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

/** The first checkout in `dirs` that has `probe` at `sha`, or null. */
export function findSource(dirs: readonly (string | undefined)[], sha: string, probe: string): string | null {
  for (const dir of dirs) {
    if (dir !== undefined && readMaster(dir, sha, probe) !== null) {
      return dir;
    }
  }
  return null;
}

/** The SVG rasterised straight at `size` px square (density scales the 512 viewBox). */
export function renderPng(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: (72 * size) / MASTER })
    .resize(size, size)
    .png()
    .toBuffer();
}

/** The 1200x630 og:image card: the mark centred on its own charcoal field. */
export async function renderOg(svg: string): Promise<Buffer> {
  const mark = await renderPng(svg, OG_MARK);
  return sharp({
    create: { width: OG_SIZE.width, height: OG_SIZE.height, channels: 4, background: INK },
  })
    .composite([
      {
        input: mark,
        left: (OG_SIZE.width - OG_MARK) / 2,
        top: (OG_SIZE.height - OG_MARK) / 2,
      },
    ])
    .png()
    .toBuffer();
}

/** Decoded RGBA pixels plus size, so PNG encoder noise never fails a comparison. */
export async function pixels(png: Buffer): Promise<{ width: number; height: number; data: Buffer }> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}
