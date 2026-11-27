// @vitest-environment node
// Node's Response only reads Node's own Blob; jsdom swaps in another one.
import { describe, it, expect } from "vitest";
import { UPLOADS_CACHE, cacheFiles, memoryFiles, type FileStore } from "./files";

/**
 * Where an image picked offline waits: bytes too big for localStorage, so
 * the browser's Cache Storage holds them. The same contract runs against the
 * in-memory store and the Cache-backed one (over a Map-backed fake cache).
 */
function fakeCaches(): { open: (name: string) => Promise<Cache>; opened: string[] } {
  const data = new Map<string, Response>();
  const opened: string[] = [];
  const url = (key: RequestInfo | URL): string =>
    new URL(key instanceof Request ? key.url : String(key), "http://localhost:4321").href;
  const cache = {
    put: (key: RequestInfo | URL, response: Response) => {
      data.set(url(key), response);
      return Promise.resolve();
    },
    match: (key: RequestInfo | URL) => Promise.resolve(data.get(url(key))?.clone()),
    delete: (key: RequestInfo | URL) => Promise.resolve(data.delete(url(key))),
    keys: () => Promise.resolve([...data.keys()].map((u) => new Request(u))),
  } as unknown as Cache;
  return {
    opened,
    open: (name) => {
      opened.push(name);
      return Promise.resolve(cache);
    },
  };
}

describe.each([
  ["memory", (): FileStore => memoryFiles()],
  ["cache", (): FileStore => cacheFiles(fakeCaches())],
])("%s file store", (_, make) => {
  it("gives back the bytes it was given", async () => {
    const files = make();
    await files.put("trip/a b.png/1", new Blob(["png"]));
    expect(await (await files.get("trip/a b.png/1"))?.text()).toBe("png");
  });

  it("knows nothing about a key it never held", async () => {
    expect(await make().get("nope")).toBeNull();
  });

  it("forgets a deleted file", async () => {
    const files = make();
    await files.put("k", new Blob(["x"]));
    await files.delete("k");
    expect(await files.get("k")).toBeNull();
  });
});

describe("cacheFiles", () => {
  it("keeps uploads in their own cache, not the page shell's", async () => {
    const caches = fakeCaches();
    await cacheFiles(caches).put("k", new Blob(["x"]));
    expect(caches.opened).toEqual([UPLOADS_CACHE]);
  });
});
