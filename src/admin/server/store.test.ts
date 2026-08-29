// @vitest-environment node
import { describe, it, expect } from "vitest";
import { MemoryFs } from "./memory-fs";
import {
  CONTENT_DIR,
  POST_FILE,
  deletePost,
  imagePath,
  listSlugs,
  postDir,
  readAllPosts,
  readImage,
  readPost,
  writeImage,
  writePost,
} from "./store";
import type { FileSystemPort } from "./store";
import type { PostMeta } from "../../lib/frontmatter";

const ROOT = "/repo";
const BASE = `${ROOT}/${CONTENT_DIR}`;

const META: PostMeta = {
  title: "A post",
  date: "2026-08-29",
  summary: "Short.",
  tags: ["meta"],
  cover: null,
  draft: false,
};

function post(title: string, date: string): string {
  return `---\ntitle: ${title}\ndate: ${date}\nsummary: s\n---\n\nBody.`;
}

describe("path construction", () => {
  it("builds a post directory under the content dir", () => {
    expect(postDir(ROOT, "hello")).toBe(`${BASE}/hello`);
  });

  it.each(["../../etc", "a/b", "..", "", "Hello"])(
    "refuses to build a path from %s",
    (slug) => {
      expect(() => postDir(ROOT, slug)).toThrow(/not a valid post slug/);
    },
  );

  it("builds an image path inside the post directory", () => {
    expect(imagePath(ROOT, "hello", "a.png")).toBe(`${BASE}/hello/a.png`);
  });

  it.each(["../x.png", "a/b.png", "x.exe"])(
    "refuses to build an image path from %s",
    (name) => {
      expect(() => imagePath(ROOT, "hello", name)).toThrow(/not a valid image filename/);
    },
  );
});

describe("listSlugs", () => {
  it("is empty when the content dir does not exist", async () => {
    expect(await listSlugs(new MemoryFs(), ROOT)).toEqual([]);
  });

  it("lists only directories that actually hold a post file", async () => {
    const fs = new MemoryFs({
      [`${BASE}/good/${POST_FILE}`]: post("Good", "2026-01-01"),
      [`${BASE}/empty/README.txt`]: "x",
    });
    expect(await listSlugs(fs, ROOT)).toEqual(["good"]);
  });

  it("skips entries that are not valid slugs", async () => {
    const fs = new MemoryFs({
      [`${BASE}/Good/${POST_FILE}`]: post("Good", "2026-01-01"),
      [`${BASE}/ok/${POST_FILE}`]: post("Ok", "2026-01-01"),
    });
    expect(await listSlugs(fs, ROOT)).toEqual(["ok"]);
  });
});

describe("readPost", () => {
  it("returns null for a post that is not there", async () => {
    expect(await readPost(new MemoryFs(), ROOT, "nope")).toBeNull();
  });

  it("parses the frontmatter and lists sibling images", async () => {
    const fs = new MemoryFs({
      [`${BASE}/hello/${POST_FILE}`]: post("Hello", "2026-08-29"),
      [`${BASE}/hello/a.png`]: "binary",
      [`${BASE}/hello/b.svg`]: "binary",
    });
    const result = await readPost(fs, ROOT, "hello");
    expect(result?.meta.title).toBe("Hello");
    expect(result?.body).toBe("Body.");
    expect(result?.images).toEqual(["a.png", "b.svg"]);
  });

  it("names the post in a frontmatter error", async () => {
    const fs = new MemoryFs({ [`${BASE}/bad/${POST_FILE}`]: "no frontmatter" });
    await expect(readPost(fs, ROOT, "bad")).rejects.toThrow(
      new RegExp(`^bad/${POST_FILE}:`),
    );
  });
});

describe("readAllPosts", () => {
  it("sorts newest first, breaking ties on title", async () => {
    const fs = new MemoryFs({
      [`${BASE}/old/${POST_FILE}`]: post("Old", "2025-01-01"),
      [`${BASE}/zeta/${POST_FILE}`]: post("Zeta", "2026-01-01"),
      [`${BASE}/alpha/${POST_FILE}`]: post("Alpha", "2026-01-01"),
    });
    expect((await readAllPosts(fs, ROOT)).map((p) => p.slug)).toEqual([
      "alpha",
      "zeta",
      "old",
    ]);
  });

  it("is empty with no content dir", async () => {
    expect(await readAllPosts(new MemoryFs(), ROOT)).toEqual([]);
  });
});

describe("writePost", () => {
  it("writes a file the parser reads back identically", async () => {
    const fs = new MemoryFs();
    await writePost(fs, ROOT, "hello", META, "Body **text**.");
    const result = await readPost(fs, ROOT, "hello");
    expect(result?.meta).toEqual(META);
    expect(result?.body).toBe("Body **text**.");
  });

  it("writes nothing when the metadata is unwritable", async () => {
    const fs = new MemoryFs();
    await expect(
      writePost(fs, ROOT, "hello", { ...META, title: "a\nb" }, "Body."),
    ).rejects.toThrow(/must not contain a newline/);
    // The guarantee: a rejected save leaves no directory behind to half-build.
    expect(fs.files.size).toBe(0);
  });

  it("refuses an invalid slug before writing", async () => {
    const fs = new MemoryFs();
    await expect(writePost(fs, ROOT, "../x", META, "Body.")).rejects.toThrow(
      /not a valid post slug/,
    );
    expect(fs.files.size).toBe(0);
  });
});

describe("images", () => {
  it("writes and reads one back", async () => {
    const fs = new MemoryFs();
    const bytes = new Uint8Array([1, 2, 3]);
    await writeImage(fs, ROOT, "hello", "a.png", bytes);
    expect(await readImage(fs, ROOT, "hello", "a.png")).toEqual(bytes);
  });

  it("returns null for one that is not there", async () => {
    expect(await readImage(new MemoryFs(), ROOT, "hello", "a.png")).toBeNull();
  });

  it("refuses a traversing filename", async () => {
    const fs = new MemoryFs();
    await expect(
      writeImage(fs, ROOT, "hello", "../../x.png", new Uint8Array([1])),
    ).rejects.toThrow(/not a valid image filename/);
    expect(fs.files.size).toBe(0);
  });
});

describe("deletePost", () => {
  it("removes the post and its images", async () => {
    const fs = new MemoryFs({
      [`${BASE}/hello/${POST_FILE}`]: post("Hello", "2026-01-01"),
      [`${BASE}/hello/a.png`]: "binary",
      [`${BASE}/other/${POST_FILE}`]: post("Other", "2026-01-01"),
    });
    await deletePost(fs, ROOT, "hello");
    expect(await listSlugs(fs, ROOT)).toEqual(["other"]);
  });
});

describe("readAllPosts under a concurrent delete", () => {
  it("skips a slug that disappeared between the listing and the read", async () => {
    const fs = new MemoryFs({
      [`${BASE}/one/${POST_FILE}`]: post("One", "2026-08-01"),
      [`${BASE}/two/${POST_FILE}`]: post("Two", "2026-08-02"),
    });
    // listSlugs sees both; the first read of "one" finds nothing, exactly as
    // it would if the editor deleted it while the listing was in flight.
    let firstLookupDone = false;
    const racing: FileSystemPort = {
      readText: (path) => fs.readText(path),
      readBytes: (path) => fs.readBytes(path),
      writeText: (path, data) => fs.writeText(path, data),
      writeBytes: (path, data) => fs.writeBytes(path, data),
      mkdirp: (path) => fs.mkdirp(path),
      listDir: (path) => fs.listDir(path),
      removeDir: (path) => fs.removeDir(path),
      exists: async (path) => {
        const answer = await fs.exists(path);
        if (path === `${BASE}/one/${POST_FILE}` && firstLookupDone) {
          return false;
        }
        if (path === `${BASE}/one/${POST_FILE}`) {
          firstLookupDone = true;
        }
        return answer;
      },
    };
    const posts = await readAllPosts(racing, ROOT);
    expect(posts.map((entry) => entry.slug)).toEqual(["two"]);
  });
});
