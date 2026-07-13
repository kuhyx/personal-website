import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Projects } from "./projects";
import { fetchRepos, GithubError, type Project } from "../lib/github";

vi.mock("../lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/github")>();
  return { ...actual, fetchRepos: vi.fn() };
});

const mockedFetchRepos = vi.mocked(fetchRepos);

const project: Project = {
  name: "wake-alarm",
  description: "Morning alarm.",
  languages: ["Python"],
  stars: 1,
  pushedAt: "2026-05-01T00:00:00Z",
  url: "https://github.com/kuhyx/wake-alarm",
  homepage: null,
  topics: [],
};

beforeEach(() => {
  mockedFetchRepos.mockReset();
});

describe("Projects", () => {
  it("shows a loading state first", () => {
    mockedFetchRepos.mockReturnValue(new Promise(() => undefined));
    render(<Projects />);
    expect(screen.getByText("Loading projects…")).toBeInTheDocument();
  });

  it("renders the fetched projects", async () => {
    mockedFetchRepos.mockResolvedValue([project]);
    render(<Projects />);
    expect(
      await screen.findByRole("link", { name: "wake-alarm" }),
    ).toBeInTheDocument();
  });

  it("shows an empty message when there are no projects", async () => {
    mockedFetchRepos.mockResolvedValue([]);
    render(<Projects />);
    expect(await screen.findByText("No projects to show.")).toBeInTheDocument();
  });

  it("shows a typed GithubError message", async () => {
    mockedFetchRepos.mockRejectedValue(
      new GithubError("rate-limit", "GitHub rate limit hit."),
    );
    render(<Projects />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "GitHub rate limit hit.",
    );
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    mockedFetchRepos.mockRejectedValue("boom");
    render(<Projects />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load projects.",
    );
  });
});
