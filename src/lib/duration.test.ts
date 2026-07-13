import { describe, it, expect, vi } from "vitest";
import { computeDuration, formatDuration } from "./duration";

describe("computeDuration", () => {
  it("computes an exact number of years", () => {
    expect(computeDuration("2020-01", "2023-01")).toEqual({
      years: 3,
      months: 0,
    });
  });

  it("computes years plus remaining months", () => {
    expect(computeDuration("2022-11", "2024-07")).toEqual({
      years: 1,
      months: 8,
    });
  });

  it("returns zero for the same month", () => {
    expect(computeDuration("2024-06", "2024-06")).toEqual({
      years: 0,
      months: 0,
    });
  });

  it("borrows a year when the end month precedes the start month", () => {
    expect(computeDuration("2021-12", "2022-11")).toEqual({
      years: 0,
      months: 11,
    });
  });

  it("uses the current month when end is null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
    expect(computeDuration("2024-06", null)).toEqual({ years: 2, months: 1 });
  });

  it("uses the current month when end is omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T00:00:00Z"));
    expect(computeDuration("2024-06")).toEqual({ years: 1, months: 0 });
  });

  it("clamps a future start to zero", () => {
    expect(computeDuration("2030-01", "2020-01")).toEqual({
      years: 0,
      months: 0,
    });
  });

  it("throws on a malformed date", () => {
    expect(() => computeDuration("2024/06", "2025-01")).toThrow(
      /Invalid YYYY-MM/,
    );
  });

  it("throws on an out-of-range month", () => {
    expect(() => computeDuration("2024-13", "2025-01")).toThrow(
      /Invalid month/,
    );
  });
});

describe("formatDuration", () => {
  it("renders years and months", () => {
    expect(formatDuration({ years: 2, months: 1 })).toBe(
      "2 years and 1 month",
    );
  });

  it("renders singular units", () => {
    expect(formatDuration({ years: 1, months: 0 })).toBe("1 year");
  });

  it("renders months only", () => {
    expect(formatDuration({ years: 0, months: 3 })).toBe("3 months");
  });

  it("renders a zero duration as less than a month", () => {
    expect(formatDuration({ years: 0, months: 0 })).toBe("less than a month");
  });
});
