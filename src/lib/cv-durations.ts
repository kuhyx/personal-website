/**
 * Fill the CV's duration spans in the browser.
 *
 * The build writes each ongoing job's duration as of build time, so the text
 * is never empty with JavaScript off. This script recomputes it from the
 * visitor's clock, so a job still in progress keeps growing between deploys.
 */

import { computeDuration, formatDuration } from "./duration";

/** Selector for a span carrying `data-start` (and optionally `data-end`). */
export const DURATION_SELECTOR = "[data-duration-start]";

/** Recompute every duration span under `root`. Returns how many it filled. */
export function fillDurations(root: ParentNode): number {
  const spans = root.querySelectorAll<HTMLElement>(DURATION_SELECTOR);
  for (const span of spans) {
    // The selector guarantees `data-duration-start`; an absent `data-duration-end`
    // means "ongoing", which is what computeDuration takes undefined to mean.
    const { durationStart, durationEnd } = span.dataset;
    span.textContent = formatDuration(computeDuration(String(durationStart), durationEnd));
  }
  return spans.length;
}
