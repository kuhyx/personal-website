import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "./app";
import { fetchRepos } from "./lib/github";
import { publishedPosts } from "./lib/posts";

vi.mock("./lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/github")>();
  return { ...actual, fetchRepos: vi.fn() };
});

beforeEach(() => {
  vi.mocked(fetchRepos).mockResolvedValue([]);
});

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("renders the hero, projects, and CV sections at the root", () => {
    at("/");
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CV" })).toBeInTheDocument();
  });

  it("renders the blog index at /blog", () => {
    at("/blog");
    expect(screen.getByRole("heading", { level: 1, name: "Blog" })).toBeInTheDocument();
  });

  it("renders a post at /blog/:slug", () => {
    const first = publishedPosts[0];
    if (first === undefined) {
      throw new Error("the corpus is empty; this test needs at least one post");
    }
    at(`/blog/${first.slug}`);
    expect(
      screen.getByRole("heading", { level: 1, name: first.meta.title }),
    ).toBeInTheDocument();
  });

  it("renders the not-found notice for an unknown address", () => {
    at("/nowhere");
    expect(
      screen.getByRole("heading", { level: 1, name: "Not found" }),
    ).toBeInTheDocument();
  });

  it("shows the site nav on every route", () => {
    at("/blog");
    expect(screen.getByRole("navigation", { name: "Site" })).toBeInTheDocument();
  });
});
