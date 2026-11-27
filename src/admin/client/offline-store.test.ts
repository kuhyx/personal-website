import { describe, it, expect } from "vitest";
import { OfflineStore, type StoredPostJson } from "./offline-store.js";
import { makeStore, memory, sampleMeta, samplePost } from "../../test/offline-fixtures";

describe("OfflineStore", () => {
  describe("empty store", () => {
    it("posts returns empty array", () => {
      const store = makeStore();
      expect(store.posts()).toEqual([]);
    });

    it("post returns null for unknown slug", () => {
      const store = makeStore();
      expect(store.post("unknown")).toBeNull();
    });

    it("pending returns empty array", () => {
      const store = makeStore();
      expect(store.pending()).toEqual([]);
    });
  });

  describe("rememberList and rememberPost", () => {
    it("rememberList caches list and each post", () => {
      const mem = memory();
      const store = new OfflineStore(mem);
      store.rememberList([samplePost]);
      expect(store.posts()).toEqual([samplePost]);
      expect(store.post("test-post")).toEqual(samplePost);
    });

    it("rememberPost caches single post and updates list", () => {
      const mem = memory();
      const store = new OfflineStore(mem);
      store.rememberPost(samplePost);
      expect(store.post("test-post")).toEqual(samplePost);
      expect(store.posts()).toEqual([samplePost]);
    });

    it("rememberPost updates existing list entry", () => {
      const mem = memory();
      const store = new OfflineStore(mem);
      store.rememberList([samplePost]);
      const updated = { ...samplePost, body: "Updated body" };
      store.rememberPost(updated);
      expect(store.post("test-post")?.body).toBe("Updated body");
      const posts = store.posts();
      expect(posts[0]?.body).toBe("Updated body");
    });
  });

  describe("list sort by date descending", () => {
    it("posts sorted by date descending", () => {
      const mem = memory();
      const store = new OfflineStore(mem);
      const older: StoredPostJson = {
        ...samplePost,
        slug: "older",
        meta: { ...sampleMeta, date: "2024-01-10T10:00:00.000Z" },
      };
      const newer: StoredPostJson = {
        ...samplePost,
        slug: "newer",
        meta: { ...sampleMeta, date: "2024-01-20T10:00:00.000Z" },
      };
      store.rememberList([older, newer]);
      const posts = store.posts();
      expect(posts[0]?.slug).toBe("newer");
      expect(posts[1]?.slug).toBe("older");
    });
  });

  describe("queuePut and queueDelete", () => {
    it("queuePut adds pending put", () => {
      const store = makeStore();
      store.queuePut("new-post", sampleMeta, "New body");
      expect(store.pending()).toEqual([
        { kind: "put", slug: "new-post", meta: sampleMeta, body: "New body" },
      ]);
    });

    it("queuePut replaces earlier op for same slug", () => {
      const store = makeStore();
      store.queuePut("slug", sampleMeta, "First");
      store.queuePut("slug", sampleMeta, "Second");
      expect(store.pending()).toEqual([
        { kind: "put", slug: "slug", meta: sampleMeta, body: "Second" },
      ]);
    });

    it("queuePut on new slug gets empty images", () => {
      const store = makeStore();
      store.queuePut("new-slug", sampleMeta, "Body");
      const post = store.post("new-slug");
      expect(post?.images).toEqual([]);
    });

    it("queuePut overlays on existing cached post", () => {
      const mem = memory();
      const store = new OfflineStore(mem);
      store.rememberPost(samplePost);
      store.queuePut("test-post", { ...sampleMeta, title: "Updated" }, "New body");
      const post = store.post("test-post");
      expect(post?.meta.title).toBe("Updated");
      expect(post?.body).toBe("New body");
      expect(post?.images).toEqual(["img1.jpg"]);
    });

    it("queueDelete adds pending delete", () => {
      const store = makeStore();
      store.queueDelete("slug");
      expect(store.pending()).toEqual([{ kind: "delete", slug: "slug" }]);
    });

    it("queueDelete replaces earlier op for same slug", () => {
      const store = makeStore();
      store.queuePut("slug", sampleMeta, "Body");
      store.queueDelete("slug");
      expect(store.pending()).toEqual([{ kind: "delete", slug: "slug" }]);
    });

    it("queueDelete overlays: post returns null", () => {
      const mem = memory();
      const store = new OfflineStore(mem);
      store.rememberPost(samplePost);
      store.queueDelete("test-post");
      expect(store.post("test-post")).toBeNull();
      expect(store.posts()).toEqual([]);
    });
  });

  describe("posts with pending ops applied", () => {
    it("pending put appears in posts list", () => {
      const store = makeStore();
      store.queuePut("new-post", sampleMeta, "Body");
      const posts = store.posts();
      expect(posts.length).toBe(1);
      expect(posts[0]?.slug).toBe("new-post");
    });

    it("pending delete removes from posts list", () => {
      const mem = memory();
      const store = new OfflineStore(mem);
      store.rememberPost(samplePost);
      store.queueDelete("test-post");
      expect(store.posts()).toEqual([]);
    });

    it("pending put then delete results in delete", () => {
      const store = makeStore();
      store.queuePut("slug", sampleMeta, "Body");
      store.queueDelete("slug");
      expect(store.posts()).toEqual([]);
    });
  });
});
