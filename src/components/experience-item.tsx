import type { ExperienceJob } from "../data/cv";
import { computeDuration, formatDuration } from "../lib/duration";
import { renderMarkup } from "../lib/markup";

/** A single job in the CV, with a live-computed duration. */
export function ExperienceItem({ job }: { job: ExperienceJob }) {
  // Finished jobs may pin a fixed duration label; ongoing jobs compute it live.
  const duration =
    job.durationEn ?? formatDuration(computeDuration(job.start, job.end));
  return (
    <article className="experience">
      <h3 className="experience__role">
        {job.roleEn} · {job.company}
      </h3>
      <p className="experience__dates">
        {job.startLabelEn} – {job.endLabelEn} · {duration}
      </p>
      <ul className="experience__items">
        {job.items.map((item) => (
          <li key={item.titleEn}>
            <strong>{item.titleEn}</strong> — {renderMarkup(item.descEn)}
          </li>
        ))}
      </ul>
    </article>
  );
}
