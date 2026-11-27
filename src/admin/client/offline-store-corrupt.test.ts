import { describe, it, expect } from "vitest";
import { OfflineStore, type KeyValue } from "./offline-store.js";

function memory(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

describe("corrupt JSON handling", () => {
  it("list key: corrupt JSON returns empty array", () => {
    const mem = memory();
    mem.setItem("blog-admin:list", "{");
    const store = new OfflineStore(mem);
    expect(store.posts()).toEqual([]);
  });

  it("list key: wrong shape JSON returns empty array", () => {
    const mem = memory();
    mem.setItem("blog-admin:list", "5");
    const store = new OfflineStore(mem);
    expect(store.posts()).toEqual([]);
  });

  it("post key: corrupt JSON returns null", () => {
    const mem = memory();
    mem.setItem("blog-admin:post:test", "{");
    const store = new OfflineStore(mem);
    expect(store.post("test")).toBeNull();
  });

  it("post key: wrong shape JSON returns null", () => {
    const mem = memory();
    mem.setItem("blog-admin:post:test", "5");
    const store = new OfflineStore(mem);
    expect(store.post("test")).toBeNull();
  });

  it("pending key: corrupt JSON returns empty array", () => {
    const mem = memory();
    mem.setItem("blog-admin:pending", "{");
    const store = new OfflineStore(mem);
    expect(store.pending()).toEqual([]);
  });

  it("pending key: wrong shape JSON returns empty array", () => {
    const mem = memory();
    mem.setItem("blog-admin:pending", "5");
    const store = new OfflineStore(mem);
    expect(store.pending()).toEqual([]);
  });
});