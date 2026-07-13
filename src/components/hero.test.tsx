import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";
import { cv } from "../data/cv";

describe("Hero", () => {
  it("shows the name, title, and summary", () => {
    render(<Hero />);
    expect(
      screen.getByRole("heading", { level: 1, name: cv.header.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(cv.header.titleEn)).toBeInTheDocument();
    expect(screen.getByText(cv.summary.en)).toBeInTheDocument();
  });

  it("links to email, GitHub, and LinkedIn", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: cv.header.email })).toHaveAttribute(
      "href",
      `mailto:${cv.header.email}`,
    );
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      cv.header.github,
    );
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      cv.header.linkedin,
    );
    expect(screen.getByRole("link", { name: "Discord" })).toHaveAttribute(
      "href",
      `https://discord.com/users/${cv.header.discord}`,
    );
  });
});
