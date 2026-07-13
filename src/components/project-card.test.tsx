import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "./project-card";
import type { Project } from "../lib/github";

const base: Project = {
  name: "screen-locker",
  description: "Locks the screen for workouts.",
  languages: ["Python", "Shell", "Dart"],
  stars: 3,
  pushedAt: "2026-06-15T00:00:00Z",
  url: "https://github.com/kuhyx/screen-locker",
  homepage: "https://kuhy.duckdns.org",
  topics: ["python", "linux"],
};

describe("ProjectCard", () => {
  it("renders all fields when present", () => {
    render(<ProjectCard project={base} />);
    expect(
      screen.getByRole("link", { name: "screen-locker" }),
    ).toHaveAttribute("href", base.url);
    expect(
      screen.getByText("Locks the screen for workouts."),
    ).toBeInTheDocument();
    // Every language shows as its own tag.
    for (const language of base.languages) {
      expect(screen.getByText(language)).toBeInTheDocument();
    }
    expect(screen.getByText("Jun 2026")).toBeInTheDocument();
    expect(screen.getByText("python")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Live site" }),
    ).toHaveAttribute("href", base.homepage);
  });

  it("omits optional fields when absent", () => {
    render(
      <ProjectCard
        project={{
          ...base,
          description: null,
          languages: [],
          homepage: null,
          topics: [],
        }}
      />,
    );
    expect(screen.queryByText("Python")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Locks the screen for workouts."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Live site" }),
    ).not.toBeInTheDocument();
    // The updated date always renders.
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("Jun 2026")).toBeInTheDocument();
  });
});
