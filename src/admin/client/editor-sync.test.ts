import { describe, it, expect } from "vitest";
import { memoryStorage } from "./editor-parts";
import { syncer, type Api, type Say } from "./editor-sync";
import { OfflineStore, type PostMetaJson } from "./offline-store";

const META: PostMetaJson = { title: "T", date: "2026-08-20", summary: "", tags: [], cover: null, draft: true };

/** An API whose every answer waits until the test calls `answer()`. */
function gatedApi(): { api: Api; calls: string[]; answer: () => void } {
  const calls: string[] = [];
  const waiting: (() => void)[] = [];
  const api = (<T>(path: string, init?: RequestInit): Promise<T> => {
    calls.push(`${init?.method ?? "GET"} ${path}`);
    return new Promise<T>((resolve) => {
      waiting.push(() => { resolve({ durationMs: 100 } as T); });
    });
  }) as Api;
  return { api, calls, answer: () => { waiting.splice(0).forEach((go) => { go(); }); } };
}

const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });
const quiet: Say = () => undefined;
const noRefresh = (): Promise<void> => Promise.resolve();

describe("syncer", () => {
  it("never flushes twice at once, and runs one more pass for a save queued meanwhile", async () => {
    const store = new OfflineStore(memoryStorage());
    const { api, calls, answer } = gatedApi();
    const sync = syncer(store, api, quiet, noRefresh);
    store.queuePut("a", META, "A");
    const first = sync();
    const second = sync();
    expect(second).toBe(first);
    store.queuePut("b", META, "B");
    await settle();
    expect(calls).toEqual(["PUT /api/posts/a"]);
    answer();
    await settle();
    answer();
    await first;
    expect(calls).toEqual(["PUT /api/posts/a", "PUT /api/posts/b"]);
    expect(store.pending()).toEqual([]);
  });

  it("starts afresh after a pass that failed", async () => {
    const store = new OfflineStore(memoryStorage());
    let fail = true;
    const api = (<T>(): Promise<T> =>
      fail ? Promise.reject(new Error("disk full")) : Promise.resolve({ durationMs: 1 } as T)) as Api;
    const sync = syncer(store, api, quiet, noRefresh);
    store.queuePut("a", META, "A");
    await expect(sync()).rejects.toThrow("disk full");
    fail = false;
    await sync();
    expect(store.pending()).toEqual([]);
  });
});
