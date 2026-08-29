import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostMetaLine } from "./post-meta";

const META = {
  title: "t",
  date: "2026-08-29",
  summary: "s",
  tags: ["meta", "react"],
  cover: null,
  draft: false,
};

describe("PostMetaLine", () => {
  it("renders a machine-readable date next to the human one", () => {
    render(<PostMetaLine meta={META} />);
    const time = screen.getByText("29 August 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-08-29");
  });

  it("lists every tag", () => {
    render(<PostMetaLine meta={META} />);
    expect(screen.getByText("meta")).toBeInTheDocument();
    expect(screen.getByText("react")).toBeInTheDocument();
  });

  it("renders nothing extra when there are no tags", () => {
    render(<PostMetaLine meta={{ ...META, tags: [] }} />);
    expect(document.querySelectorAll(".post-meta__tag")).toHaveLength(0);
  });
});
