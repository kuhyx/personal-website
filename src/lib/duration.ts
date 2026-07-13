/**
 * Duration helpers for CV experience entries.
 *
 * Job dates are stored as `YYYY-MM` strings (an `end` of `null` means the job
 * is ongoing). "Time spent" is computed live so a present job's duration grows
 * on its own without editing the data. The Python `build_cv.py` mirrors this
 * logic to keep the PDF and the website in agreement (intentional duplication).
 */

/** A whole-month duration split into years and remaining months. */
export interface Duration {
  readonly years: number;
  readonly months: number;
}

interface YearMonth {
  readonly year: number;
  readonly month: number;
}

/**
 * Parse a `YYYY-MM` string into a year/month pair.
 *
 * @throws If the value is not a valid `YYYY-MM` string.
 */
function parseYearMonth(value: string): YearMonth {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid YYYY-MM value: ${value}`);
  }
  // The regex guarantees both groups are present and numeric.
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in value: ${value}`);
  }
  return { year, month };
}

/** The current calendar month as a `YearMonth` (uses the system clock). */
function currentYearMonth(): YearMonth {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * Compute the whole-month duration between two `YYYY-MM` dates.
 *
 * @param startISO Start month, `YYYY-MM`.
 * @param endISO End month `YYYY-MM`, or `null`/`undefined` for "now".
 * @returns Years and remaining months. A start in the future clamps to zero.
 */
export function computeDuration(
  startISO: string,
  endISO?: string | null,
): Duration {
  const start = parseYearMonth(startISO);
  const end =
    endISO === null || endISO === undefined
      ? currentYearMonth()
      : parseYearMonth(endISO);

  let totalMonths =
    (end.year - start.year) * 12 + (end.month - start.month);
  if (totalMonths < 0) {
    // Defensive: a start after the end (e.g. a future-dated job) reads as zero.
    totalMonths = 0;
  }
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
  };
}

/** Pluralise a unit: `1 year`, `2 years`. */
function unit(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/**
 * Render a {@link Duration} as human text, e.g. `2 years 1 month`.
 * A zero-length duration renders as `less than a month`.
 */
export function formatDuration(duration: Duration): string {
  const parts: string[] = [];
  if (duration.years > 0) {
    parts.push(unit(duration.years, "year"));
  }
  if (duration.months > 0) {
    parts.push(unit(duration.months, "month"));
  }
  if (parts.length === 0) {
    return "less than a month";
  }
  return parts.join(" and ");
}
