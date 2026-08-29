import { describe, it, expect } from "vitest";
import { SITE_ORIGIN, absoluteUrl } from "./site";

describe("absoluteUrl", () => {
  it("prefixes the origin, which is what card scrapers require", () => {
    expect(absoluteUrl("/blog/x")).toBe(`${SITE_ORIGIN}/blog/x`);
  });

  it("leaves no double slash at the root", () => {
    expect(absoluteUrl("/")).toBe(`${SITE_ORIGIN}/`);
  });
});
