import { describe, it, expect } from "vitest";
import { captured } from "./captured";

describe("captured", () => {
  it("returns a group that matched", () => {
    const match = /a(b)/.exec("ab");
    if (match === null) {
      throw new Error("pattern should match");
    }
    expect(captured(match, 1)).toBe("b");
  });

  it("returns an empty string for a group that is absent", () => {
    // Only reachable by hand: the patterns using this helper all have
    // mandatory groups, which is exactly why the fallback needs a test here.
    const match = /a/.exec("a");
    if (match === null) {
      throw new Error("pattern should match");
    }
    expect(captured(match, 9)).toBe("");
  });
});
