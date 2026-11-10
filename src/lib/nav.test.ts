import { navLinks } from "./nav";

describe("navLinks", () => {
  it.each([
    ["/", [true, false]],
    ["/blog", [false, true]],
    [null, [false, false]],
  ] as const)("marks the current section for %s", (current, expected) => {
    expect(navLinks(current).map((link) => link.current)).toEqual(expected);
  });

  it("links Home and Blog, in that order", () => {
    expect(navLinks(null).map((link) => [link.href, link.label])).toEqual([
      ["/", "Home"],
      ["/blog", "Blog"],
    ]);
  });
});
