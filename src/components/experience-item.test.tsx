import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExperienceItem } from "./experience-item";
import type { ExperienceJob } from "../data/cv";

const endedJob: ExperienceJob = {
  company: "Delta Electronics",
  locationPl: "Warszawa",
  locationEn: "Warsaw",
  rolePl: "Frontend Developer",
  roleEn: "Frontend Developer",
  start: "2022-11",
  end: "2024-07",
  startLabelPl: "listopad 2022",
  startLabelEn: "November 2022",
  endLabelPl: "lipiec 2024",
  endLabelEn: "July 2024",
  items: [
    {
      titlePl: "Dashboard",
      titleEn: "EV dashboard",
      descPl: "Zbudowany w **Angular**",
      descEn: "Built with **Angular**",
    },
  ],
};

const presentJob: ExperienceJob = {
  ...endedJob,
  company: "AI Clearing",
  start: "2024-06",
  end: null,
  startLabelEn: "June 2024",
  endLabelEn: "present",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("ExperienceItem", () => {
  it("computes the duration for an ended job without a pinned label", () => {
    render(<ExperienceItem job={endedJob} />);
    expect(
      screen.getByRole("heading", { name: "Frontend Developer · Delta Electronics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("November 2022 – July 2024 · 1 year and 8 months"),
    ).toBeInTheDocument();
    expect(screen.getByText("EV dashboard")).toBeInTheDocument();
    expect(screen.getByText("Angular").tagName).toBe("STRONG");
  });

  it("uses a pinned duration label when provided", () => {
    render(<ExperienceItem job={{ ...endedJob, durationEn: "1.5 years" }} />);
    expect(
      screen.getByText("November 2022 – July 2024 · 1.5 years"),
    ).toBeInTheDocument();
  });

  it("computes a live duration for a present job", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
    render(<ExperienceItem job={presentJob} />);
    expect(
      screen.getByText("June 2024 – present · 2 years and 1 month"),
    ).toBeInTheDocument();
  });
});
