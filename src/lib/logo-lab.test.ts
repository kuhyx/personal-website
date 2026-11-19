// @vitest-environment node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANDIDATES,
  LOGO_LAB_ROUTE,
  LOGO_SOURCE,
  OG_SIZE,
  PICK_KEY,
  PNG_SIZES,
  assetPath,
  publicFile,
} from "./logo-lab";
import { findSource, pixels, readMaster, renderOg, renderPng } from "./logo-render";

const ROOT = join(import.meta.dirname, "../..");

/** Where the pinned masters can come from: same order as scripts/sync-logos.ts. */
const SOURCE = findSource(
  [process.env.UTILS_ROOT, join(homedir(), "src/utils"), join(homedir(), ".cache/personal-website/utils")],
  LOGO_SOURCE.sha,
  `${LOGO_SOURCE.dir}/${CANDIDATES[0]?.file ?? ""}`,
);

function committed(id: string, file: string): Buffer {
  return readFileSync(join(ROOT, publicFile(id, file)));
}

describe("logo candidates", () => {
  it("are three variants of each of A to F, with fixed ids", () => {
    const kinds = ["A", "B", "C", "D", "E", "F"];
    expect(CANDIDATES.map((c) => c.label)).toEqual(kinds.flatMap((k) => [`${k}1`, `${k}2`, `${k}3`]));
    expect(CANDIDATES.map((c) => c.id)).toEqual(kinds.flatMap((k) => [1, 2, 3].map((n) => `${k.toLowerCase()}${n}`)));
    expect(CANDIDATES.map((c) => c.file.slice(0, 2))).toEqual(CANDIDATES.map((c) => c.id));
  });

  it("pins a full commit SHA of kuhyx/utils", () => {
    expect(LOGO_SOURCE.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(LOGO_SOURCE.repo).toContain("kuhyx/utils");
  });

  it("serves every asset under /logo-lab/<id>/", () => {
    expect(assetPath("b", "32.png")).toBe("/logo-lab/b/32.png");
    expect(publicFile("b", "32.png")).toBe("public/logo-lab/b/32.png");
    expect(LOGO_LAB_ROUTE).toBe("/logo-lab");
    expect(PICK_KEY).toBe("logo-lab:pick");
    expect(PNG_SIZES).toEqual([16, 32, 64, 180, 512]);
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  });
});

describe("vendored masters", () => {
  it.skipIf(SOURCE === null).each(CANDIDATES)("$label equals utils at the pinned SHA", ({ id, file }) => {
    const master = readMaster(SOURCE ?? "", LOGO_SOURCE.sha, `${LOGO_SOURCE.dir}/${file}`);
    expect(committed(id, "logo.svg").toString("utf8")).toBe(master);
  });

  it("reads nothing from a missing checkout or commit", () => {
    expect(readMaster("/nonexistent", LOGO_SOURCE.sha, "x.svg")).toBeNull();
    expect(findSource([undefined, "/nonexistent"], LOGO_SOURCE.sha, "x.svg")).toBeNull();
  });
});

describe("rendered exports", () => {
  it.each(CANDIDATES)("$label PNGs match a fresh render", async ({ id }) => {
    const svg = committed(id, "logo.svg").toString("utf8");
    for (const size of PNG_SIZES) {
      const fresh = await renderPng(svg, size);
      const file = committed(id, `${size}.png`);
      expect(await pixels(file)).toEqual(await pixels(fresh));
    }
  });

  it.each(CANDIDATES)("$label og card is 1200x630 and matches a fresh render", async ({ id }) => {
    const svg = committed(id, "logo.svg").toString("utf8");
    const file = committed(id, "og.png");
    const fresh = await renderOg(svg);
    expect(await pixels(file)).toEqual(await pixels(fresh));
  });
});
