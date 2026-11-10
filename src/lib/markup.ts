/** One run of cv.json text: bold or plain. */
export interface MarkupSegment {
  readonly text: string;
  readonly bold: boolean;
}

/**
 * Split the lightweight cv.json markup into plain and bold runs.
 *
 * The only supported markup is `**bold**` (matching what `build_cv.py` turns
 * into `\textbf{...}` for the PDF). Splitting on the `**` delimiter makes every
 * odd-indexed segment bold and every even-indexed segment plain text. Empty
 * runs are dropped so the markup carries no stray empty `<strong>`.
 */
export function markupSegments(text: string): MarkupSegment[] {
  return text
    .split("**")
    .map((segment, index) => ({ text: segment, bold: index % 2 === 1 }))
    .filter((segment) => segment.text !== "");
}
