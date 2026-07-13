import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./app";
import { fetchRepos } from "./lib/github";

vi.mock("./lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/github")>();
  return { ...actual, fetchRepos: vi.fn() };
});

beforeEach(() => {
  vi.mocked(fetchRepos).mockResolvedValue([]);
});

describe("App", () => {
  it("renders the hero, projects, and CV sections", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Projects" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CV" })).toBeInTheDocument();
  });
});
