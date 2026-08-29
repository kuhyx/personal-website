// @vitest-environment node
import { describe, it, expect } from "vitest";
import { MemoryFs } from "./memory-fs";

/**
 * The fake filesystem gets its own tests for one reason: the store and handler
 * suites lean on it heavily, and a fake that quietly resolves where the real
 * one would fail turns every test above it into a false pass.
 */
describe("MemoryFs", () => {
  it("seeds files, and their parent directories with them", async () => {
    const fs = new MemoryFs({ "/repo/blog/one/DOCS-index.md": "body" });
    expect(await fs.readText("/repo/blog/one/DOCS-index.md")).toBe("body");
    expect(await fs.exists("/repo/blog/one")).toBe(true);
    expect(await fs.exists("/repo/blog")).toBe(true);
  });

  it("rejects reading text that is not there, as ENOENT would", async () => {
    await expect(new MemoryFs().readText("/absent")).rejects.toThrow(/ENOENT/);
  });

  it("rejects reading bytes that are not there", async () => {
    await expect(new MemoryFs().readBytes("/absent")).rejects.toThrow(/ENOENT/);
  });

  it("round-trips bytes written under a created directory", async () => {
    const fs = new MemoryFs();
    await fs.mkdirp("/repo/blog/one");
    await fs.writeBytes("/repo/blog/one/a.png", new Uint8Array([7]));
    expect(await fs.readBytes("/repo/blog/one/a.png")).toEqual(new Uint8Array([7]));
    expect((await fs.listDir("/repo/blog/one")).sort()).toEqual(["a.png"]);
  });

  it("removes a directory and everything under it", async () => {
    const fs = new MemoryFs({ "/repo/one/DOCS-index.md": "x", "/repo/two/DOCS-index.md": "y" });
    await fs.removeDir("/repo/one");
    expect(await fs.exists("/repo/one")).toBe(false);
    expect(await fs.exists("/repo/one/DOCS-index.md")).toBe(false);
    expect(await fs.exists("/repo/two/DOCS-index.md")).toBe(true);
  });

  it("lists nothing for a directory that was never created", async () => {
    expect(await new MemoryFs().listDir("/nowhere")).toEqual([]);
  });
});
