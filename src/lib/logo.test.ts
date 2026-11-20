// @vitest-environment node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FAVICON_SVG,
  LOGO_OG,
  LOGO_SOURCE,
  LOGO_SVG,
  OG_SIZE,
  PNG_SIZES,
  assetPath,
  masterFor,
  publicFile,
} from "./logo";
import { findSource, pixels, readMaster, renderOg, renderPng } from "./logo-render";

const ROOT = join(import.meta.dirname, "../..");
const MASTER = `${LOGO_SOURCE.dir}/${LOGO_SOURCE.file}`;
const FAVICON_MASTER = `${LOGO_SOURCE.dir}/${LOGO_SOURCE.favicon}`;

/** Where the pinned master can come from: same order as scripts/sync-logos.ts. */
const SOURCE = findSource(
  [process.env.UTILS_ROOT, join(homedir(), "src/utils"), join(homedir(), ".cache/personal-website/utils")],
  LOGO_SOURCE.sha,
  MASTER,
);

function committed(file: string): Buffer {
  return readFileSync(join(ROOT, publicFile(file)));
}

/** The painted pixels of a square PNG (those off its corner's field colour), as [x, y]. */
async function ink(png: Buffer): Promise<{ width: number; at: [number, number][] }> {
  const { width, data } = await pixels(png);
  const at: [number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if ([0, 1, 2].some((c) => Math.abs((data[i + c] ?? 0) - (data[c] ?? 0)) > 24)) {
      at.push([(i / 4) % width, Math.floor(i / 4 / width)]);
    }
  }
  return { width, at };
}

/** Farthest painted pixel from the centre of a square PNG, as a share of its half-width. */
async function reach(png: Buffer): Promise<number> {
  const { width, at } = await ink(png);
  const centre = (width - 1) / 2;
  return Math.max(...at.map(([x, y]) => Math.hypot(x - centre, y - centre))) / (width / 2);
}

describe("the logo", () => {
  it("pins a full commit SHA of kuhyx/utils", () => {
    expect(LOGO_SOURCE.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(LOGO_SOURCE.repo).toContain("kuhyx/utils");
    expect(MASTER).toBe("unified-design-system/logo/final/kuhy.svg");
    expect(FAVICON_MASTER).toBe("unified-design-system/logo/final/kuhy-favicon.svg");
  });

  it("serves every file under /logo/, which robots.txt leaves open", () => {
    expect(assetPath("32.png")).toBe("/logo/32.png");
    expect(publicFile("32.png")).toBe("public/logo/32.png");
    expect(LOGO_SVG).toBe("/logo/logo.svg");
    expect(LOGO_OG).toBe("/logo/og.png");
    expect(FAVICON_SVG).toBe("/logo/favicon.svg");
    expect(PNG_SIZES).toEqual([16, 32, 64, 180, 512]);
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("is not trimmed by a round avatar crop", async () => {
    expect(await reach(committed("512.png"))).toBeLessThan(5 / 6);
    expect(await reach(committed("180.png"))).toBeLessThan(0.9);
  });

  // A tab icon is square, so the round crop's air is wasted there: the letters take 14 of the 16 pixels.
  it("fills the square tab icon: one pixel of air at 16 px", async () => {
    const { at } = await ink(committed("16.png"));
    const all = at.flat();
    expect([Math.min(...all), Math.max(...all)]).toEqual([1, 14]);
    for (const axis of [0, 1] as const) {
      const span = at.map((point) => point[axis]);
      expect(Math.max(...span) - Math.min(...span) + 1).toBeGreaterThanOrEqual(13);
    }
  });

  it("draws the tab icon sizes from the tab icon master, the rest from the round-safe one", () => {
    expect(PNG_SIZES.map(masterFor)).toEqual(["favicon.svg", "favicon.svg", "logo.svg", "logo.svg", "logo.svg"]);
  });
});

describe("vendored master", () => {
  it.skipIf(SOURCE === null).each([
    ["logo.svg", MASTER],
    ["favicon.svg", FAVICON_MASTER],
  ])("%s equals utils at the pinned SHA", (file, master) => {
    expect(committed(file).toString("utf8")).toBe(readMaster(SOURCE ?? "", LOGO_SOURCE.sha, master));
  });

  // Against this repo itself, so the reading code is covered where there is no utils checkout (CI).
  it("reads a file at a commit, from the first checkout that has it", () => {
    expect(readMaster(ROOT, "HEAD", "package.json")).toContain('"name"');
    expect(findSource([undefined, "/nonexistent", ROOT], "HEAD", "package.json")).toBe(ROOT);
  });

  it("reads nothing from a missing checkout or commit", () => {
    expect(readMaster("/nonexistent", LOGO_SOURCE.sha, "x.svg")).toBeNull();
    expect(findSource([undefined, "/nonexistent"], LOGO_SOURCE.sha, "x.svg")).toBeNull();
  });
});

describe("rendered exports", () => {
  it.each(PNG_SIZES)("%i px PNG matches a fresh render", async (size) => {
    const fresh = await renderPng(committed(masterFor(size)).toString("utf8"), size);
    expect(await pixels(committed(`${size}.png`))).toEqual(await pixels(fresh));
  });

  it("og card is 1200x630 and matches a fresh render", async () => {
    const card = await pixels(committed("og.png"));
    expect([card.width, card.height]).toEqual([OG_SIZE.width, OG_SIZE.height]);
    expect(card).toEqual(await pixels(await renderOg(committed("logo.svg").toString("utf8"))));
  });
});
