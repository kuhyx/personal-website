// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFs } from "./node-fs";

// A real temp directory rather than a mock: the point of this adapter is that
// it behaves like the filesystem, which a mock of the filesystem cannot show.
let root = "";
const fs = new NodeFs();

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pw-admin-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("NodeFs", () => {
  it("round-trips text through a directory it created", async () => {
    const directory = join(root, "a", "b");
    await fs.mkdirp(directory);
    await fs.writeText(join(directory, "post.md"), "hello");
    expect(await fs.readText(join(directory, "post.md"))).toBe("hello");
  });

  it("round-trips bytes", async () => {
    const bytes = new Uint8Array([0, 1, 254, 255]);
    await fs.writeBytes(join(root, "image.png"), bytes);
    expect(await fs.readBytes(join(root, "image.png"))).toEqual(bytes);
  });

  it("is idempotent about creating a directory that exists", async () => {
    await fs.mkdirp(join(root, "twice"));
    await expect(fs.mkdirp(join(root, "twice"))).resolves.toBeUndefined();
  });

  it("lists directory entries", async () => {
    await writeFile(join(root, "one.md"), "");
    await writeFile(join(root, "two.png"), "");
    expect((await fs.listDir(root)).sort()).toEqual(["one.md", "two.png"]);
  });

  it("reports what exists and what does not", async () => {
    await writeFile(join(root, "here"), "");
    expect(await fs.exists(join(root, "here"))).toBe(true);
    expect(await fs.exists(join(root, "absent"))).toBe(false);
  });

  it("removes a directory and its contents, and tolerates a missing one", async () => {
    await fs.mkdirp(join(root, "post"));
    await fs.writeText(join(root, "post", "DOCS-index.md"), "x");
    await fs.removeDir(join(root, "post"));
    expect(await fs.exists(join(root, "post"))).toBe(false);
    await expect(fs.removeDir(join(root, "post"))).resolves.toBeUndefined();
  });
});
