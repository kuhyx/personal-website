/** The shapes the offline store keeps. */

/** The slice of Web Storage the store needs; tests pass an in-memory Map-backed stub. */
export type KeyValue = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface PostMetaJson {
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover: string | null;
  draft: boolean;
}

export interface StoredPostJson {
  slug: string;
  meta: PostMetaJson;
  body: string;
  images: string[];
}

/**
 * One queued change. An `image` names a picked file by its key in the
 * `FileStore` (files.ts): the bytes are too big for this storage.
 */
export type PendingOp =
  | { kind: "put"; slug: string; meta: PostMetaJson; body: string }
  | { kind: "delete"; slug: string }
  | { kind: "image"; slug: string; name: string; file: string };
