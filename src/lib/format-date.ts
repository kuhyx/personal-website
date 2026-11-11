/**
 * Render a `YYYY-MM-DD` frontmatter date as e.g. "2026-08-29".
 *
 * textgate: numbers only, no generated month names. Parsed and printed in
 * UTC so the label never shifts by a day depending on where the reader is,
 * and a malformed date throws instead of printing "NaN".
 */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10);
}
