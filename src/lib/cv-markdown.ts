/**
 * The home page as markdown, rendered from the same `cv.json` the page uses.
 *
 * Only what the page itself shows: the hero never prints the phone number, so
 * neither does this. Durations of ongoing jobs are computed live in the
 * browser, so a build-time copy would freeze one that goes stale; only a
 * pinned `durationEn` is written out.
 */

import type { CvData, ExperienceJob } from "../data/cv";
import { absoluteUrl } from "./site";

function experience(job: ExperienceJob): string[] {
  const dates = `${job.startLabelEn} – ${job.endLabelEn}`;
  return [
    `### ${job.roleEn} · ${job.company}`,
    "",
    job.durationEn === undefined ? dates : `${dates} · ${job.durationEn}`,
    "",
    ...job.items.map((item) => `- **${item.titleEn}** — ${item.descEn}`),
    "",
  ];
}

/** `cv` as one markdown document, English fields only. */
export function cvMarkdown(cv: CvData): string {
  const { header } = cv;
  const lines = [
    `# ${header.name}`,
    "",
    header.titleEn,
    "",
    cv.summary.en,
    "",
    `- Email: <mailto:${header.email}>`,
    `- GitHub: <${header.github}>`,
    `- LinkedIn: <${header.linkedin}>`,
    `- Discord: <https://discord.com/users/${header.discord}>`,
    `- CV (PDF): <${absoluteUrl("/cv.pdf")}>`,
    "",
    "## Experience",
    "",
    ...cv.experience.flatMap(experience),
    "## Education",
    "",
    ...cv.education.flatMap((school) => [
      `### ${school.institutionEn}`,
      "",
      ...school.entries.map((entry) => `- **${entry.degreeEn}** — ${entry.detailEn}`),
      "",
    ]),
    "## Skills",
    "",
    ...cv.skills.map((skill) => `- **${skill.labelEn}:** ${skill.valueEn}`),
    "",
    "## Volunteering",
    "",
    ...cv.volunteer.flatMap((org) => [
      `### ${org.orgEn}`,
      "",
      ...org.rolesEn.map((role) => `- ${role}`),
      "",
      org.descEn,
      "",
    ]),
    "## Side projects",
    "",
    ...cv.sideProjects.map(
      (project) => `- [${project.titleEn}](${project.url}) — ${project.descEn}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}
