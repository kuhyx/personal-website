import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { PostPage } from "./post-page";
import { publishedPosts } from "../lib/posts";
import { first } from "../test/first";

function at(path: string, pattern = "/blog/:slug") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={<PostPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const post = first(publishedPosts, "post");

describe("PostPage", () => {
  it("renders the post title, date and body", () => {
    at(`/blog/${post.slug}`);
    expect(
      screen.getByRole("heading", { level: 1, name: post.meta.title }),
    ).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute(
      "datetime",
      post.meta.date,
    );
    expect(document.querySelector(".prose")).not.toBeNull();
  });

  it("offers a way back to the index", () => {
    at(`/blog/${post.slug}`);
    expect(screen.getByRole("link", { name: "← All posts" })).toHaveAttribute(
      "href",
      "/blog",
    );
  });

  it("shows the not-found notice for an unknown slug", () => {
    at("/blog/definitely-not-a-post");
    expect(
      screen.getByRole("heading", { level: 1, name: "Not found" }),
    ).toBeInTheDocument();
  });

  it("shows the not-found notice when the route carries no slug at all", () => {
    at("/blog", "/blog");
    expect(
      screen.getByRole("heading", { level: 1, name: "Not found" }),
    ).toBeInTheDocument();
  });
});
