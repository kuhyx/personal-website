import { describe, it, expect } from "vitest";
import { cvMarkdown } from "./cv-markdown";
import { cv } from "../data/cv";
import { first } from "../test/first";

describe("cvMarkdown", () => {
  const md = cvMarkdown(cv);

  it("leads with the name and the summary", () => {
    expect(md.startsWith(`# ${cv.header.name}\n`)).toBe(true);
    expect(md).toContain(cv.summary.en);
  });

  it("lists the contact links the hero shows, and not the phone number", () => {
    expect(md).toContain(cv.header.email);
    expect(md).toContain(cv.header.github);
    expect(md).toContain(cv.header.linkedin);
    expect(md).not.toContain(cv.header.phone);
  });

  it("covers every CV section the page renders", () => {
    for (const heading of [
      "## Experience",
      "## Education",
      "## Skills",
      "## Volunteering",
      "## Side projects",
    ]) {
      expect(md).toContain(heading);
    }
    const job = first(cv.experience, "job");
    expect(md).toContain(`### ${job.roleEn} · ${job.company}`);
    expect(md).toContain(`${job.startLabelEn} – ${job.endLabelEn}`);
  });

  it("links the PDF", () => {
    expect(md).toContain("https://kuhy.duckdns.org/cv.pdf");
  });

  it("uses a pinned duration label when a job has one", () => {
    const job = { ...first(cv.experience, "job"), durationEn: "2 yrs" };
    const out = cvMarkdown({ ...cv, experience: [job] });
    expect(out).toContain(`${job.startLabelEn} – ${job.endLabelEn} · 2 yrs`);
  });

  it("is English only", () => {
    expect(md).not.toContain(cv.summary.pl);
  });
});
