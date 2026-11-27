/**
 * Where an image picked offline waits until it can be uploaded.
 *
 * Not localStorage: an image may be 5 MB, which base64 makes larger than the
 * whole localStorage quota. Cache Storage keeps Blobs as they are, with the
 * origin's much larger quota, and needs no extra dependency. The queue entry
 * that names the file still lives in {@link OfflineStore}.
 */

/** A key-to-Blob store; `memoryFiles` for tests, `cacheFiles` in the browser. */
export interface FileStore {
  put: (key: string, blob: Blob) => Promise<void>;
  get: (key: string) => Promise<Blob | null>;
  delete: (key: string) => Promise<void>;
}

/** The cache holding queued uploads, apart from the page shell's. */
export const UPLOADS_CACHE = "blog-admin-uploads";

export function memoryFiles(): FileStore {
  const data = new Map<string, Blob>();
  return {
    put: (key, blob) => {
      data.set(key, blob);
      return Promise.resolve();
    },
    get: (key) => Promise.resolve(data.get(key) ?? null),
    delete: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
}

/** A FileStore over Cache Storage, each key stored under a same-origin URL nobody fetches. */
export function cacheFiles(caches: Pick<CacheStorage, "open">): FileStore {
  const url = (key: string): string => `/admin/pending-upload/${encodeURIComponent(key)}`;
  const open = (): Promise<Cache> => caches.open(UPLOADS_CACHE);
  return {
    put: async (key, blob) => {
      await (await open()).put(url(key), new Response(blob));
    },
    get: async (key) => {
      const response = await (await open()).match(url(key));
      return response === undefined ? null : response.blob();
    },
    delete: async (key) => {
      await (await open()).delete(url(key));
    },
  };
}
