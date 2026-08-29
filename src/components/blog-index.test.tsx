import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { BlogIndex } from "./blog-index";
import { publishedPosts } from "../lib/posts";

function renderIndex() {
  return render(
    <MemoryRouter>
      <BlogIndex />
    </MemoryRouter>,
  );
}

describe("BlogIndex", () => {
  it("links every published post by title", () => {
    renderIndex();
    for (const post of publishedPosts) {
      expect(screen.getByRole("link", { name: post.meta.title })).toHaveAttribute(
        "href",
        `/blog/${post.slug}`,
      );
    }
  });

  it("shows each summary", () => {
    renderIndex();
    for (const post of publishedPosts) {
      expect(screen.getByText(post.meta.summary)).toBeInTheDocument();
    }
  });

  it("says so when there is nothing published", async () => {
    vi.resetModules();
    vi.doMock("../lib/posts", () => ({ publishedPosts: [] }));
    const { BlogIndex: Empty } = await import("./blog-index");
    render(
      <MemoryRouter>
        <Empty />
      </MemoryRouter>,
    );
    expect(screen.getByText("Nothing published yet.")).toBeInTheDocument();
    vi.doUnmock("../lib/posts");
    vi.resetModules();
  });
});
