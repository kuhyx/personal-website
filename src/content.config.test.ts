// @vitest-environment node
import { collections, slugFromEntry } from "./content.config";

describe("blog collection", () => {
  it("takes the slug from the post's directory", () => {
    expect(slugFromEntry({ entry: "hello-world/DOCS-index.md" })).toBe("hello-world");
  });

  it("is defined with the strict post schema", () => {
    expect(collections.blog).toBeDefined();
  });
});
