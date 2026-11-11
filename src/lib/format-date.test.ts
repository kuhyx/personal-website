import { describe, it, expect } from "vitest";
import { formatDate } from "./format-date";

describe("formatDate", () => {
  it("renders a frontmatter date as numbers only", () => {
    expect(formatDate("2026-08-29")).toBe("2026-08-29");
  });

  it("does not shift a day west of Greenwich", () => {
    // Parsed and formatted in UTC on purpose: a local-time parse would render
    // this as 31 December here and 1 January on the server, and the
    // prerendered HTML would disagree with the hydrated client.
    expect(formatDate("2026-01-01")).toBe("2026-01-01");
  });

  it("refuses a malformed date instead of printing NaN", () => {
    expect(() => formatDate("2026-13-45")).toThrow(RangeError);
  });
});
