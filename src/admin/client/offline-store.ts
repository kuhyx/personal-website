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

export type PendingOp =
  | { kind: "put"; slug: string; meta: PostMetaJson; body: string }
  | { kind: "delete"; slug: string };

/** Raised by a sender when the server cannot be reached (fetch threw). */
export class Offline extends Error {}

/**
 * Offline-first local store for the blog admin editor.
 * Caches server data and queues mutations for later sync.
 */
export class OfflineStore {
  private readonly prefix: string;

  constructor(
    private readonly storage: KeyValue,
    prefix = "blog-admin:"
  ) {
    this.prefix = prefix;
  }

  private listKey(): string {
    return `${this.prefix}list`;
  }

  private postKey(slug: string): string {
    return `${this.prefix}post:${slug}`;
  }

  private pendingKey(): string {
    return `${this.prefix}pending`;
  }

  private read<T>(key: string, fallback: T, shape: "array" | "object" = "object"): T {
    try {
      const raw = this.storage.getItem(key);
      if (raw === null) return fallback;
      const parsed: unknown = JSON.parse(raw);
      if (shape === "array") {
        return (Array.isArray(parsed) ? parsed : fallback) as T;
      }
      return (parsed !== null && typeof parsed === "object" ? parsed : fallback) as T;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    this.storage.setItem(key, JSON.stringify(value));
  }

  /**
   * Last list the server sent, with pending ops applied on top (puts upsert, deletes remove),
   * sorted by meta.date descending. [] when nothing is cached.
   */
  posts(): StoredPostJson[] {
    const list = this.read<StoredPostJson[]>(this.listKey(), [], "array");
    const pending = this.pending();

    const merged = new Map<string, StoredPostJson>();
    for (const post of list) {
      merged.set(post.slug, post);
    }

    for (const op of pending) {
      if (op.kind === "put") {
        const existing = merged.get(op.slug);
        merged.set(op.slug, {
          slug: op.slug,
          meta: op.meta,
          body: op.body,
          images: existing?.images ?? [],
        });
      } else {
        merged.delete(op.slug);
      }
    }

    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    );
  }

  /**
   * Replace the cached list from a server answer; also caches each post's details.
   */
  rememberList(posts: readonly StoredPostJson[]): void {
    this.write(this.listKey(), [...posts]);
    for (const post of posts) {
      this.write(this.postKey(post.slug), post);
    }
  }

  /**
   * One post's cached details with any pending put applied; null when unknown or pending delete.
   */
  post(slug: string): StoredPostJson | null {
    const cached = this.read<StoredPostJson | null>(this.postKey(slug), null, "object");
    const pending = this.pending();

    for (const op of pending) {
      if (op.slug !== slug) continue;
      if (op.kind === "delete") return null;
      // op.kind is "put" here due to union type narrowing
      const base = cached ?? { slug, meta: op.meta, body: op.body, images: [] };
      return { ...base, meta: op.meta, body: op.body };
    }

    return cached;
  }

  /**
   * Cache one post's details (from GET /api/posts/<slug>) and refresh its row in the list.
   */
  rememberPost(post: StoredPostJson): void {
    this.write(this.postKey(post.slug), post);

    const list = this.read<StoredPostJson[]>(this.listKey(), [], "array");
    const idx = list.findIndex((p) => p.slug === post.slug);
    if (idx >= 0) {
      list[idx] = post;
    } else {
      list.push(post);
    }
    this.write(this.listKey(), list);
  }

  /**
   * Queue a save. Replaces an earlier queued op for the same slug.
   * A put for a slug with no cached post gets images: [].
   */
  queuePut(slug: string, meta: PostMetaJson, body: string): void {
    const pending = this.pending().filter((op) => op.slug !== slug);
    pending.push({ kind: "put", slug, meta, body });
    this.write(this.pendingKey(), pending);
  }

  /**
   * Queue a delete. Replaces an earlier queued op for the same slug.
   */
  queueDelete(slug: string): void {
    const pending = this.pending().filter((op) => op.slug !== slug);
    pending.push({ kind: "delete", slug });
    this.write(this.pendingKey(), pending);
  }

  /**
   * Queued ops, oldest first.
   */
  pending(): PendingOp[] {
    return this.read<PendingOp[]>(this.pendingKey(), [], "array");
  }

  /**
   * Send queued ops oldest first with `send`. Each op that resolves is removed
   * from the queue (and a sent delete is also dropped from the cache).
   * If `send` rejects with Offline: stop, keep that op and the rest, return
   * the number sent so far. Any other rejection (the server refused that one
   * op) keeps it queued but goes on with the rest -- one bad save must not
   * hold every later one hostage -- and the first such error is re-thrown at
   * the end.
   * An op queued while `send` was awaiting is preserved if its stored copy
   * differs from the one just sent (e.g. a newer save for the same slug).
   */
  async flush(send: (op: PendingOp) => Promise<void>): Promise<number> {
    const original = this.pending();
    const refused: unknown[] = [];
    let sent = 0;

    for (const op of original) {
      try {
        await send(op);
      } catch (e) {
        if (e instanceof Offline) {
          break;
        }
        refused.push(e);
        continue;
      }

      if (op.kind === "delete") {
        this.storage.removeItem(this.postKey(op.slug));
        const list = this.read<StoredPostJson[]>(this.listKey(), [], "array").filter(
          (p) => p.slug !== op.slug
        );
        this.write(this.listKey(), list);
      }

      // Remove the sent op only if the stored version is still identical.
      const updated = this.pending();
      const idx = updated.findIndex((o) => o.slug === op.slug);
      if (idx >= 0 && JSON.stringify(updated[idx]) === JSON.stringify(op)) {
        updated.splice(idx, 1);
        this.write(this.pendingKey(), updated);
      }
      sent++;
    }

    if (refused.length > 0) {
      throw refused[0];
    }
    return sent;
  }
}