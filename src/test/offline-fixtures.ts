/** Shared fixtures for the offline store's tests. */
import { OfflineStore, type KeyValue, type StoredPostJson, type PostMetaJson } from "../admin/client/offline-store";

export function memory(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

export const sampleMeta: PostMetaJson = {
  title: "Test Post",
  date: "2024-01-15T10:00:00.000Z",
  summary: "A test post",
  tags: ["test"],
  cover: null,
  draft: false,
};

export const samplePost: StoredPostJson = {
  slug: "test-post",
  meta: sampleMeta,
  body: "Body content",
  images: ["img1.jpg"],
};

export function makeStore(storage?: KeyValue): OfflineStore {
  return new OfflineStore(storage ?? memory());
}
