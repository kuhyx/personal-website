// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_NAME_LENGTH,
  MAX_SLUG_LENGTH,
  extensionOf,
  imageUploadProblem,
  isValidImageName,
  isValidSlug,
  isValidAssetName,
  assetContentType,
  imageContentType,
  FALLBACK_TYPE,
} from "./guards";

describe("isValidSlug", () => {
  it.each(["a", "why-i-built-todo", "post-2026", "x1"])("accepts %s", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["traversal", "../../etc/passwd"],
    ["bare dots", ".."],
    ["a forward slash", "a/b"],
    ["a backslash", "a\\b"],
    ["a NUL byte", "a\0b"],
    ["uppercase", "Post"],
    ["a leading hyphen", "-post"],
    ["a trailing hyphen", "post-"],
    ["a dot", "post.md"],
    ["a space", "my post"],
    ["a tilde", "~root"],
    ["over the length cap", "a".repeat(MAX_SLUG_LENGTH + 1)],
  ])("rejects %s", (_label, slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });

  it("accepts exactly the length cap", () => {
    expect(isValidSlug("a".repeat(MAX_SLUG_LENGTH))).toBe(true);
  });
});

describe("extensionOf", () => {
  it.each([
    ["a.png", ".png"],
    ["a.PNG", ".png"],
    ["a.tar.gz", ".gz"],
    ["noext", ""],
  ])("reads %s as %s", (name, expected) => {
    expect(extensionOf(name)).toBe(expected);
  });
});

describe("isValidImageName", () => {
  it.each(["a.png", "shot_1.jpeg", "arch-diagram.svg", "x.avif"])(
    "accepts %s",
    (name) => {
      expect(isValidImageName(name)).toBe(true);
    },
  );

  it.each([
    ["empty", ""],
    ["traversal", "../../x.png"],
    ["a slash", "dir/x.png"],
    ["a backslash", "dir\\x.png"],
    ["a NUL byte", "x\0.png"],
    ["a disallowed extension", "x.exe"],
    ["no extension", "x"],
    ["a leading dot", ".hidden.png"],
    ["over the length cap", `${"a".repeat(MAX_IMAGE_NAME_LENGTH)}.png`],
  ])("rejects %s", (_label, name) => {
    expect(isValidImageName(name)).toBe(false);
  });
});

describe("imageUploadProblem", () => {
  it("accepts a normal upload", () => {
    expect(imageUploadProblem("a.png", 1024)).toBeNull();
  });

  it("names the bad filename", () => {
    expect(imageUploadProblem("../x.exe", 10)).toMatch(/not an allowed image filename/);
  });

  it("rejects an empty body", () => {
    expect(imageUploadProblem("a.png", 0)).toBe("image is empty");
  });

  it("rejects an oversized body, reporting both numbers", () => {
    const problem = imageUploadProblem("a.png", MAX_IMAGE_BYTES + 1);
    expect(problem).toContain(String(MAX_IMAGE_BYTES + 1));
    expect(problem).toContain(String(MAX_IMAGE_BYTES));
  });

  it("accepts exactly the byte cap", () => {
    expect(imageUploadProblem("a.png", MAX_IMAGE_BYTES)).toBeNull();
  });
});

describe("content types", () => {
  it.each([
    ["a.png", "image/png"],
    ["a.JPG", "image/jpeg"],
    ["a.jpeg", "image/jpeg"],
    ["a.webp", "image/webp"],
    ["a.gif", "image/gif"],
    ["a.svg", "image/svg+xml"],
    ["a.avif", "image/avif"],
  ])("serves %s as %s", (name, expected) => {
    expect(imageContentType(name)).toBe(expected);
  });

  it("falls back for a name the upload guard would have refused", () => {
    expect(imageContentType("a.txt")).toBe(FALLBACK_TYPE);
    expect(imageContentType("noextension")).toBe(FALLBACK_TYPE);
  });

  it("serves the editor bundle and its stylesheet", () => {
    expect(assetContentType("index-abc.js")).toMatch(/javascript/);
    expect(assetContentType("index-abc.css")).toMatch(/text\/css/);
    expect(assetContentType("index-abc.map")).toBe(FALLBACK_TYPE);
  });

  it("accepts exactly the extensions it can name a type for", () => {
    for (const name of ["a.png", "a.jpg", "a.jpeg", "a.webp", "a.gif", "a.svg", "a.avif"]) {
      expect(isValidImageName(name)).toBe(true);
      expect(imageContentType(name)).not.toBe(FALLBACK_TYPE);
    }
    for (const name of ["a.js", "a.css"]) {
      expect(isValidAssetName(name)).toBe(true);
      expect(assetContentType(name)).not.toBe(FALLBACK_TYPE);
    }
  });

  it.each(["a.png", "a.exe", "../a.js", "a.js.exe"])(
    "keeps the asset allowlist narrower than the image one for %s",
    (name) => {
      expect(isValidAssetName(name)).toBe(false);
    },
  );
});
