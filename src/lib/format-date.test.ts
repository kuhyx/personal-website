import { describe, it, expect } from "vitest";
import { formatDate } from "./format-date";

describe("formatDate", () => {
  it("renders a frontmatter date in long form", () => {
    expect(formatDate("2026-08-29")).toBe("29 August 2026");
  });

  it("does not shift a day west of Greenwich", () => {
    // Parsed and formatted in UTC on purpose: a local-time parse would render
    // this as 31 December here and 1 January on the server, and the
    // prerendered HTML would disagree with the hydrated client.
    expect(formatDate("2026-01-01")).toBe("1 January 2026");
  });
});
