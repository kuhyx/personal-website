import { Fragment, type ReactNode } from "react";

/**
 * Render the lightweight cv.json markup into React nodes.
 *
 * The only supported markup is `**bold**` (matching what `build_cv.py` turns
 * into `\textbf{...}` for the PDF). Splitting on the `**` delimiter makes every
 * odd-indexed segment bold and every even-indexed segment plain text.
 */
export function renderMarkup(text: string): ReactNode {
  return text.split("**").map((segment, index) =>
    index % 2 === 1 ? (
      <strong key={index}>{segment}</strong>
    ) : (
      <Fragment key={index}>{segment}</Fragment>
    ),
  );
}
