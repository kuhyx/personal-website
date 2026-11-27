import { describe, it, expect } from "vitest";
import { memoryStorage } from "./editor-parts";
import { OfflineStore, type PendingOp, type PostMetaJson, type StoredPostJson } from "./offline-store";

/** Images picked offline: queued beside the saves, shown at once, sent in order. */
const META: PostMetaJson = { title: "T", date: "2026-08-20", summary: "S", tags: [], cover: null, draft: false };
const POST: StoredPostJson = { slug: "trip", meta: META, body: "B", images: ["old.png"] };

const store = (): OfflineStore => new OfflineStore(memoryStorage());

describe("queueImage", () => {
  it("lists a queued image on its post at once", () => {
    const s = store();
    s.rememberList([POST]);
    expect(s.queueImage("trip", "new.png", "f1")).toBeNull();
    expect(s.post("trip")?.images).toEqual(["old.png", "new.png"]);
    expect(s.posts()[0]?.images).toEqual(["old.png", "new.png"]);
  });

  it("lists an image once even when the server already has that name", () => {
    const s = store();
    s.rememberList([POST]);
    s.queueImage("trip", "old.png", "f1");
    expect(s.post("trip")?.images).toEqual(["old.png"]);
    expect(s.posts()[0]?.images).toEqual(["old.png"]);
  });

  it("adds an image to a post that exists only as a queued save", () => {
    const s = store();
    s.queuePut("trip", META, "B");
    s.queueImage("trip", "a.png", "f1");
    expect(s.post("trip")?.images).toEqual(["a.png"]);
  });

  it("ignores an image for a post it knows nothing about", () => {
    const s = store();
    s.queueImage("ghost", "a.png", "f1");
    expect(s.post("ghost")).toBeNull();
    expect(s.posts()).toEqual([]);
  });

  it("replaces a re-picked image in place and hands back the stale file", () => {
    const s = store();
    s.queueImage("trip", "a.png", "f1");
    s.queuePut("trip", META, "![](./a.png)");
    expect(s.queueImage("trip", "a.png", "f2")).toBe("f1");
    expect(s.pending().map((op) => (op.kind === "image" ? op.file : op.kind))).toEqual(["f2", "put"]);
  });

  it("keeps queued images when the post is saved again", () => {
    const s = store();
    s.queuePut("trip", META, "B");
    s.queueImage("trip", "a.png", "f1");
    s.queuePut("trip", META, "![](./a.png)");
    expect(s.pending().map((op) => op.kind)).toEqual(["image", "put"]);
  });

  it("drops a deleted post's queued images and hands back their files", () => {
    const s = store();
    s.queueImage("trip", "a.png", "f1");
    s.queueImage("other", "b.png", "f2");
    expect(s.queueDelete("trip")).toEqual(["f1"]);
    expect(s.pending().map((op) => op.slug)).toEqual(["other", "trip"]);
  });
});

describe("flush with images", () => {
  it("removes exactly the op it sent when a post has several queued", async () => {
    const s = store();
    s.queueImage("trip", "a.png", "f1");
    s.queuePut("trip", META, "B");
    const sent: PendingOp[] = [];
    await s.flush((op) => {
      sent.push(op);
      return Promise.resolve();
    });
    expect(sent.map((op) => op.kind)).toEqual(["image", "put"]);
    expect(s.pending()).toEqual([]);
  });

  it("keeps a re-picked image queued when the old one went out meanwhile", async () => {
    const s = store();
    s.queueImage("trip", "a.png", "f1");
    await s.flush(() => {
      s.queueImage("trip", "a.png", "f2");
      return Promise.resolve();
    });
    expect(s.pending()).toEqual([{ kind: "image", slug: "trip", name: "a.png", file: "f2" }]);
  });
});
