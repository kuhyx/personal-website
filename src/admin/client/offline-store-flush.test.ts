import { describe, it, expect } from "vitest";
import { OfflineStore, Offline, type KeyValue, type PostMetaJson } from "./offline-store.js";

function memory(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

const sampleMeta: PostMetaJson = {
  title: "Test Post",
  date: "2024-01-15T10:00:00.000Z",
  summary: "A test post",
  tags: ["test"],
  cover: null,
  draft: false,
};

function makeStore(storage?: KeyValue) {
  return new OfflineStore(storage ?? memory());
}

describe("flush", () => {
  it("flush sends all ops and clears queue", async () => {
    const store = makeStore();
    const sent: string[] = [];
    store.queuePut("a", sampleMeta, "A");
    store.queuePut("b", sampleMeta, "B");
    const count = await store.flush((op) => {
      sent.push(op.slug);
      return Promise.resolve();
    });
    expect(count).toBe(2);
    expect(sent).toEqual(["a", "b"]);
    expect(store.pending()).toEqual([]);
  });

  it("flush removes deleted post from cache", async () => {
    const mem = memory();
    const store = new OfflineStore(mem);
    const samplePost = {
      slug: "test-post",
      meta: sampleMeta,
      body: "Body content",
      images: ["img1.jpg"],
    };
    store.rememberPost(samplePost);
    store.queueDelete("test-post");
    await store.flush(() => Promise.resolve());
    expect(store.post("test-post")).toBeNull();
    expect(store.posts()).toEqual([]);
  });

  it("flush stops on Offline error and keeps remaining", async () => {
    const store = makeStore();
    store.queuePut("a", sampleMeta, "A");
    store.queuePut("b", sampleMeta, "B");
    store.queuePut("c", sampleMeta, "C");
    let call = 0;
    await expect(
      store.flush(() => {
        call++;
        if (call === 2) throw new Offline("offline");
        return Promise.resolve();
      })
    ).resolves.toBe(1);
    expect(store.pending().length).toBe(2);
    expect(store.pending()[0]?.slug).toBe("b");
  });

  it("flush re-throws non-Offline error", async () => {
    const store = makeStore();
    store.queuePut("a", sampleMeta, "A");
    await expect(
      store.flush(() => {
        throw new Error("network error");
      })
    ).rejects.toThrow("network error");
    expect(store.pending().length).toBe(1);
  });

  it("flush returns number sent so far on Offline", async () => {
    const store = makeStore();
    store.queuePut("a", sampleMeta, "A");
    store.queuePut("b", sampleMeta, "B");
    let count = 0;
    const result = await store.flush(() => {
      count++;
      if (count === 1) throw new Offline("offline");
      return Promise.resolve();
    });
    expect(result).toBe(0);
  });

  it("keeps ops queued during send pending when a newer save replaced the sent one", async () => {
    const store = makeStore();
    store.queuePut("a", sampleMeta, "A");
    const result = await store.flush((op) => {
      if (op.slug === "a") {
        store.queuePut("a", { ...sampleMeta, title: "Newer" }, "A2");
        store.queuePut("b", sampleMeta, "B");
      }
      return Promise.resolve();
    });
    expect(result).toBe(1);
    const slugs = store.pending().map((o) => o.slug);
    expect(slugs).toEqual(["a", "b"]);
    expect(store.pending()[0]).toMatchObject({ kind: "put", body: "A2" });
  });
});
