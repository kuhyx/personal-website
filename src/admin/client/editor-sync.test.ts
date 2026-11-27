import { describe, it, expect } from "vitest";
import { memoryStorage } from "./editor-parts";
import { syncer, type Api, type Say } from "./editor-sync";
import { memoryFiles } from "./files";
import { Offline, OfflineStore, type PostMetaJson } from "./offline-store";

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
    const sync = syncer(store, memoryFiles(), api, quiet, noRefresh);
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
    const sync = syncer(store, memoryFiles(), api, quiet, noRefresh);
    store.queuePut("a", META, "A");
    await expect(sync()).rejects.toThrow("disk full");
    fail = false;
    await sync();
    expect(store.pending()).toEqual([]);
  });

  it("skips an image re-picked while the flush was running, sending nothing for it", async () => {
    const store = new OfflineStore(memoryStorage());
    const files = memoryFiles();
    const { api, calls, answer } = gatedApi();
    const sync = syncer(store, files, api, quiet, noRefresh);
    store.queuePut("a", META, "A");
    store.queueImage("b", "x.png", "f1");
    const pass = sync();
    await settle();
    store.queueImage("b", "x.png", "f2");
    answer();
    await pass;
    expect(calls).toEqual(["PUT /api/posts/a"]);
    expect(store.pending()).toEqual([{ kind: "image", slug: "b", name: "x.png", file: "f2" }]);
  });

  it("clears its offline state when another tab already sent the queue", async () => {
    const storage = memoryStorage();
    const store = new OfflineStore(storage);
    const said: string[] = [];
    let refreshed = 0;
    const offline = (<T>(): Promise<T> => Promise.reject(new Offline("down"))) as Api;
    const sync = syncer(store, memoryFiles(), offline, (text) => { said.push(text); }, () => {
      refreshed += 1;
      return Promise.resolve();
    });
    store.queuePut("a", META, "A");
    await sync();
    await new OfflineStore(storage).flush(() => Promise.resolve());
    await sync();
    expect(said.at(-1)).toBe("Published.");
    expect(refreshed).toBe(1);
    await sync();
    expect(refreshed).toBe(1);
  });
});
