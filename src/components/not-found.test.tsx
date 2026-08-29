import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { NotFound } from "./not-found";

describe("NotFound", () => {
  it("offers a way back to the blog", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the blog" })).toHaveAttribute(
      "href",
      "/blog",
    );
  });
});
