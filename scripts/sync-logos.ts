/**
 * sync-logos.ts — vendor the site's logo from kuhyx/utils into public/logo/
 * and render its PNG exports and og card.
 *
 * The master is read with `git show <sha>:<path>` at the commit pinned in
 * scripts/logo-source.json, from the first checkout that has it: $UTILS_ROOT,
 * ~/src/utils, then a cached clone (~/.cache/personal-website/utils), which is
 * created or fetched when neither of the others has the commit. Writes
 * logo.svg (byte-for-byte the master), 16/32/64/180/512.png and og.png
 * (1200x630). src/lib/logo.test.ts fails when any file drifts.
 *
 * Run: node scripts/sync-logos.ts   (Node strips the types itself.)
 * Exit 0 = every file written; non-zero = no checkout has the pinned commit.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { LOGO_SOURCE, PNG_SIZES, publicFile } from "../src/lib/logo.ts";
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
  const master = `${LOGO_SOURCE.dir}/${LOGO_SOURCE.file}`;
  const dir = source(master);
  const svg = readMaster(dir, LOGO_SOURCE.sha, master);
  if (svg === null) {
    throw new Error(`sync-logos: ${master} missing at ${LOGO_SOURCE.sha}`);
  }
  write(publicFile("logo.svg"), svg);
  for (const size of PNG_SIZES) {
    write(publicFile(`${size}.png`), await renderPng(svg, size));
  }
  write(publicFile("og.png"), await renderOg(svg));
  console.log(`sync-logos: ${master} from ${dir} @ ${LOGO_SOURCE.sha.slice(0, 7)}`);
}

await main();
