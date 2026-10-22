import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteNav } from "./site-nav";
import { publishedPosts } from "../lib/posts";
import { first } from "../test/first";

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteNav />
    </MemoryRouter>,
  );
}

describe("SiteNav", () => {
  it("links to the landing page and the blog", () => {
    at("/");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/blog");
  });

  it("marks the current page for assistive tech", () => {
    at("/blog");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not mark Home as current on a sub-route", () => {
    at("/blog/x");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Blog as current on a real post", () => {
    at(`/blog/${first(publishedPosts, "published post").slug}`);
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Blog as current with a trailing slash", () => {
    at("/blog/");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks nothing as current on the not-found view", () => {
    // 404.html is prerendered with no active item; a mistyped post URL must
    // hydrate to the same markup, not light up Blog.
    for (const path of ["/blog/typo", "/no/such/page"]) {
      const { unmount } = at(path);
      for (const name of ["Home", "Blog"]) {
        const link = screen.getByRole("link", { name });
        expect(link).not.toHaveAttribute("aria-current");
        expect(link).not.toHaveClass("active");
      }
      unmount();
    }
  });
});
