/**
 * sync-logos.ts — vendor the site's logo from kuhyx/utils into public/logo/
 * and render its PNG exports and og card.
 *
 * The masters are read with `git show <sha>:<path>` at the commit pinned in
 * scripts/logo-source.json, from the first checkout that has it: $UTILS_ROOT,
 * ~/src/utils, then a cached clone (~/.cache/personal-website/utils), which is
 * created or fetched when neither of the others has the commit. Writes
 * logo.svg and favicon.svg (byte-for-byte the masters), 16/32.png from
 * favicon.svg, 64/180/512.png and og.png (1200x630) from logo.svg.
 * src/lib/logo.test.ts fails when any file drifts.
 *
 * Run: node scripts/sync-logos.ts   (Node strips the types itself.)
 * Exit 0 = every file written; non-zero = no checkout has the pinned commit.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { LOGO_SOURCE, PNG_SIZES, masterFor, publicFile } from "../src/lib/logo.ts";
import { findSource, readMaster, renderOg, renderPng } from "../src/lib/logo-render.ts";

const ROOT = join(import.meta.dirname, "..");
const CACHE = join(homedir(), ".cache/personal-website/utils");

function git(...args: string[]): void {
  execFileSync("git", args, { stdio: "inherit" });
}

/** A checkout that has the pinned commit, cloning or fetching the cache if needed. */
function source(probe: string): string {
  const dirs = [process.env.UTILS_ROOT, join(homedir(), "src/utils"), CACHE];
  const found = findSource(dirs, LOGO_SOURCE.sha, probe);
  if (found !== null) {
    return found;
  }
  if (!existsSync(CACHE)) {
    git("clone", "--filter=blob:none", "--no-checkout", LOGO_SOURCE.repo, CACHE);
  }
  git("-C", CACHE, "fetch", "--filter=blob:none", "origin", LOGO_SOURCE.sha);
  return CACHE;
}

function write(file: string, data: string | Buffer): void {
  const path = join(ROOT, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

async function main(): Promise<void> {
  const paths = {
    "logo.svg": `${LOGO_SOURCE.dir}/${LOGO_SOURCE.file}`,
    "favicon.svg": `${LOGO_SOURCE.dir}/${LOGO_SOURCE.favicon}`,
  };
  const dir = source(paths["favicon.svg"]);
  const read = (file: keyof typeof paths): string => {
    const svg = readMaster(dir, LOGO_SOURCE.sha, paths[file]);
    if (svg === null) {
      throw new Error(`sync-logos: ${paths[file]} missing at ${LOGO_SOURCE.sha}`);
    }
    write(publicFile(file), svg);
    return svg;
  };
  const masters = { "logo.svg": read("logo.svg"), "favicon.svg": read("favicon.svg") };
  for (const size of PNG_SIZES) {
    write(publicFile(`${size}.png`), await renderPng(masters[masterFor(size)], size));
  }
  write(publicFile("og.png"), await renderOg(masters["logo.svg"]));
  console.log(`sync-logos: ${LOGO_SOURCE.dir} from ${dir} @ ${LOGO_SOURCE.sha.slice(0, 7)}`);
}

await main();
