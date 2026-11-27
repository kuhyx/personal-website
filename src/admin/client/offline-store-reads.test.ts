import { describe, it, expect } from "vitest";
import { OfflineStore } from "./offline-store.js";
import { makeStore, memory, sampleMeta, samplePost } from "../../test/offline-fixtures";

describe("OfflineStore", () => {
  describe("post with pending ops", () => {
    it("post ignores pending ops for other slugs", () => {
      const mem = memory();
      const store = new OfflineStore(mem);
      store.rememberPost(samplePost);
      store.queuePut("other-slug", sampleMeta, "Other body");
      expect(store.post("test-post")).toEqual(samplePost);
    });

    it("post applies pending put for matching slug", () => {
      const store = makeStore();
      store.queuePut("test-post", { ...sampleMeta, title: "Pending Title" }, "Pending body");
      const post = store.post("test-post");
      expect(post?.meta.title).toBe("Pending Title");
      expect(post?.body).toBe("Pending body");
    });

    it("post applies pending put for matching slug with no cached post", () => {
      const store = makeStore();
      store.queuePut("new-slug", sampleMeta, "New body");
      const post = store.post("new-slug");
      expect(post?.slug).toBe("new-slug");
      expect(post?.body).toBe("New body");
      expect(post?.images).toEqual([]);
    });

    it("post skips non-matching pending ops and returns cached", () => {
      const mem = memory();
      const store = new OfflineStore(mem);
      store.rememberPost(samplePost);
      store.queuePut("other-slug", sampleMeta, "Other");
      store.queueDelete("another-slug");
      expect(store.post("test-post")).toEqual(samplePost);
    });
  });

  describe("persistence across reload (same storage)", () => {
    it("second store instance sees same data", () => {
      const mem = memory();
      const store1 = new OfflineStore(mem);
      store1.rememberList([samplePost]);
      store1.queuePut("new-post", sampleMeta, "Body");

      const store2 = new OfflineStore(mem);
      expect(store2.posts().length).toBe(2);
      expect(store2.post("new-post")?.body).toBe("Body");
      expect(store2.pending().length).toBe(1);
    });
  });

  describe("custom prefix", () => {
    it("uses custom prefix for all keys", () => {
      const mem = memory();
      const store = new OfflineStore(mem, "custom:");
      store.rememberList([samplePost]);
      store.queuePut("slug", sampleMeta, "Body");

      expect(mem.data.has("custom:list")).toBe(true);
      expect(mem.data.has("custom:post:test-post")).toBe(true);
      expect(mem.data.has("custom:pending")).toBe(true);
      expect(mem.data.has("blog-admin:list")).toBe(false);
    });

    it("separate prefixes do not interfere", () => {
      const mem = memory();
      const store1 = new OfflineStore(mem, "a:");
      const store2 = new OfflineStore(mem, "b:");
      store1.rememberList([samplePost]);
      store2.queuePut("slug", sampleMeta, "Body");

      expect(store1.posts().length).toBe(1);
      expect(store2.posts().length).toBe(1);
      expect(store1.post("test-post")).toEqual(samplePost);
      expect(store2.post("slug")?.body).toBe("Body");
    });
  });
});