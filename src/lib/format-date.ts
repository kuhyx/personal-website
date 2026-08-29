/** Render a `YYYY-MM-DD` frontmatter date as e.g. "29 August 2026". */
export function formatDate(iso: string): string {
  // Parsed as UTC and formatted in UTC so the label never shifts by a day
  // depending on where the reader is — the prerendered HTML would otherwise
  // disagree with the hydrated client for anyone west of Greenwich.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
