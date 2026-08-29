import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { componentsFor, PostBody } from "./post-body";
import { buildPosts, type Post } from "../lib/posts";
import { first } from "../test/first";

const DIR = "../content/blog";

function make(body: string): Post {
  const built = buildPosts(
    { [`${DIR}/p/DOCS-index.md`]: `---\ntitle: t\ndate: 2026-01-01\nsummary: s\n---\n\n${body}` },
    { [`${DIR}/p/a.png`]: "/assets/a.hash.png" },
  );
  return first(built, "post");
}

describe("PostBody", () => {
  it("renders markdown structure", () => {
    render(<PostBody post={make("# H\n\nSome **bold** text.")} />);
    expect(screen.getByRole("heading", { name: "H" })).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("renders GFM tables and strikethrough", () => {
    render(<PostBody post={make("| a |\n| --- |\n| b |\n\n~~gone~~")} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("gone").tagName).toBe("DEL");
  });

  it("highlights a fenced code block", () => {
    const { container } = render(
      <PostBody post={make("```typescript\nconst x = 1;\n```")} />,
    );
    expect(container.querySelector("code.hljs")).not.toBeNull();
    expect(container.querySelector(".hljs-keyword")).not.toBeNull();
  });

  it("rewrites a relative image to its hashed URL", () => {
    render(<PostBody post={make("![alt text](./a.png)")} />);
    expect(screen.getByRole("img", { name: "alt text" })).toHaveAttribute(
      "src",
      "/assets/a.hash.png",
    );
  });

  it("throws for an image that is not next to the post", () => {
    // Loud on purpose: posts.test.ts runs this check over the whole corpus, so
    // a broken path is a red suite rather than a 404 in production.
    expect(() => render(<PostBody post={make("![x](./missing.png)")} />)).toThrow(
      /does not exist next to it/,
    );
  });

  it("leaves a remote image untouched", () => {
    render(<PostBody post={make("![r](https://example.com/x.png)")} />);
    expect(screen.getByRole("img", { name: "r" })).toHaveAttribute(
      "src",
      "https://example.com/x.png",
    );
  });

  it("opens external links in a new tab but not internal ones", () => {
    render(<PostBody post={make("[out](https://example.com) and [in](/blog)")} />);
    const external = screen.getByRole("link", { name: "out" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByRole("link", { name: "in" })).not.toHaveAttribute("target");
  });
});

describe("componentsFor", () => {
  // react-markdown always supplies a string src, but the renderer is typed for
  // its absence; exercising it keeps that path honest rather than dead.
  it("treats a missing src as an empty path and reports it", () => {
    const post = make("body");
    const Img = componentsFor(post).img;
    if (typeof Img !== "function") {
      throw new Error("img renderer should be a component");
    }
    expect(() => render(<Img />)).toThrow(/references image ""/);
  });

  it("renders an empty alt when markdown supplied none", () => {
    const Img = componentsFor(make("body")).img;
    if (typeof Img !== "function") {
      throw new Error("img renderer should be a component");
    }
    const { container } = render(<Img src="./a.png" />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("treats a missing href as internal", () => {
    const Anchor = componentsFor(make("body")).a;
    if (typeof Anchor !== "function") {
      throw new Error("a renderer should be a component");
    }
    render(<Anchor>text</Anchor>);
    expect(screen.getByText("text")).not.toHaveAttribute("target");
  });
});
