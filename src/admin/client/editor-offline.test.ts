import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { mountEditor, type StoredPostJson } from "./editor";
import { memoryStorage } from "./editor-parts";
import { OfflineStore, type KeyValue } from "./offline-store";

/**
 * Offline first, end to end: the real page, a stub server that can be
 * unplugged, and a storage that outlives a mount -- which is what a reload is.
 */
const PAGE = readFileSync("src/admin/client/index.html", "utf8");
const BODY = /<body>([\s\S]*)<\/body>/.exec(PAGE)?.[1] ?? "";

const POST: StoredPostJson = {
  slug: "hello",
  meta: { title: "Hello", date: "2026-08-20", summary: "Sum", tags: ["meta"], cover: null, draft: false },
  body: "Body text.",
  images: ["cover.png"],
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

const memory = (): KeyValue => memoryStorage();

/** A server that answers `answer` while plugged in and drops every request otherwise. */
interface Server {
  plugged: boolean;
  calls: string[];
  fetch: typeof globalThis.fetch;
}

function server(answer: (method: string, path: string) => Response | Promise<Response>): Server {
  const state: Server = {
    plugged: true,
    calls: [],
    fetch: (input, init) => {
      const path = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      if (!state.plugged) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      state.calls.push(`${method} ${path}`);
      return Promise.resolve(answer(method, path));
    },
  };
  return state;
}

/** The blog as the stub server holds it: listing, one post's details, writes that build. */
function blog(posts: StoredPostJson[]): (method: string, path: string) => Response {
  return (method, path) => {
    if (method === "PUT") {
      return json({ durationMs: 1200 });
    }
    if (method === "DELETE") {
      return json({ deleted: true });
    }
    return path.endsWith("/api/posts") ? json({ posts }) : json(posts[0]);
  };
}

const el = (id: string): HTMLElement => document.getElementById(id) ?? document.body;
const input = (id: string): HTMLInputElement => el(id) as HTMLInputElement;
const status = (): string => el("status").querySelector(".sr-only")?.textContent ?? "";
const tone = (): string | undefined => el("status").dataset.tone;
/** Each listed post's title, without the draft glyph beside it. */
const titles = (): string[] =>
  [...el("post-list").querySelectorAll("button > span")].map((span) => span.firstChild?.textContent ?? "");
const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });
const today = (): string => "2026-08-29";

let online: (() => void) | null = null;
const onOnline = (listener: () => void): void => { online = listener; };

/** Mount on a fresh copy of the page, as a reload would. */
async function mount(fetch: typeof globalThis.fetch, storage: KeyValue): Promise<void> {
  document.body.innerHTML = BODY;
  await mountEditor({ doc: document, fetch, today, storage, onOnline });
  await settle();
}

function submit(slug: string, title: string): void {
  input("slug").value = slug;
  input("title").value = title;
  el("post-form").dispatchEvent(new Event("submit"));
}

beforeEach(() => {
  online = null;
});

describe("offline first", () => {
  it("shows a save at once with no network and still has it after a reload", async () => {
    const storage = memory();
    const api = server(blog([]));
    await mount(api.fetch, storage);
    api.plugged = false;
    submit("trip", "Trip");
    await settle();
    expect(titles()).toEqual(["Trip"]);
    expect(tone()).toBe("offline");
    expect((el("save") as HTMLButtonElement).disabled).toBe(false);

    await mount(api.fetch, storage);
    expect(el("editor-view").hidden).toBe(false);
    expect(titles()).toEqual(["Trip"]);
    expect(tone()).toBe("offline");
  });

  it("publishes the queue when the browser comes back online", async () => {
    const storage = memory();
    const api = server(blog([]));
    await mount(api.fetch, storage);
    api.plugged = false;
    submit("trip", "Trip");
    await settle();
    api.plugged = true;
    online?.();
    await settle();
    expect(api.calls).toContain("PUT /api/posts/trip");
    expect(new OfflineStore(storage).pending()).toEqual([]);
    expect(status()).toBe("Saved and published in 1.2s.");
  });

  it("opens a post from the device when the server is gone", async () => {
    const storage = memory();
    const api = server(blog([POST]));
    await mount(api.fetch, storage);
    api.plugged = false;
    await mount(api.fetch, storage);
    el("post-list").querySelector("button")?.dispatchEvent(new Event("click"));
    await settle();
    expect(input("title").value).toBe("Hello");
    expect((el("body") as HTMLTextAreaElement).value).toBe("Body text.");
    expect(status()).toBe("Editing hello.");
  });

  it("queues a delete offline and sends it once online", async () => {
    const storage = memory();
    const api = server(blog([POST]));
    await mount(api.fetch, storage);
    api.plugged = false;
    input("slug").value = "hello";
    el("delete").dispatchEvent(new Event("click"));
    await settle();
    expect(titles()).toEqual([]);
    expect(tone()).toBe("offline");
    api.plugged = true;
    online?.();
    await settle();
    expect(api.calls).toContain("DELETE /api/posts/hello");
    expect(status()).toBe("Published.");
  });

  it("shows an empty editor, not the login form, on a first offline start", async () => {
    const api = server(blog([]));
    api.plugged = false;
    await mount(api.fetch, memory());
    expect(el("editor-view").hidden).toBe(false);
    expect(titles()).toEqual([]);
  });
});

describe("loading details", () => {
  /** A storage that knows the list but not the post's details. */
  function listOnly(): KeyValue {
    const storage = memory();
    storage.setItem("blog-admin:list", JSON.stringify([POST]));
    return storage;
  }

  it("reports a post it has neither cached nor can fetch", async () => {
    const api = server(blog([POST]));
    api.plugged = false;
    await mount(api.fetch, listOnly());
    el("post-list").querySelector("button")?.dispatchEvent(new Event("click"));
    await settle();
    expect(tone()).toBe("bad");
    expect(status()).toBe("the server cannot be reached");
  });

  it("fetches and caches a post it had no details for", async () => {
    const storage = listOnly();
    const fresh = { ...POST, body: "Fresh." };
    const api = server(blog([fresh]));
    api.plugged = false;
    await mount(api.fetch, storage);
    api.plugged = true;
    el("post-list").querySelector("button")?.dispatchEvent(new Event("click"));
    await settle();
    expect((el("body") as HTMLTextAreaElement).value).toBe("Fresh.");
    expect(new OfflineStore(storage).post("hello")?.body).toBe("Fresh.");
  });

  it("reports a server error behind a cached post", async () => {
    const storage = memory();
    new OfflineStore(storage).rememberPost(POST);
    const api = server((_, path) =>
      path.endsWith("/api/posts") ? json({ posts: [POST] }) : json({ error: "disk full" }, 500));
    await mount(api.fetch, storage);
    el("post-list").querySelector("button")?.dispatchEvent(new Event("click"));
    await settle();
    expect(tone()).toBe("bad");
    expect(status()).toBe("disk full");
  });

  describe("when the fresh copy arrives after the cached one", () => {
    const fresh = { ...POST, meta: { ...POST.meta, title: "Server" } };
    let release: () => void = () => undefined;

    async function open(): Promise<KeyValue> {
      const storage = memory();
      const details = new Promise<Response>((resolve) => { release = () => { resolve(json(fresh)); }; });
      const api = server((_, path) => (path.endsWith("/api/posts") ? json({ posts: [POST] }) : details));
      await mount(api.fetch, storage);
      el("post-list").querySelector("button")?.dispatchEvent(new Event("click"));
      await settle();
      expect(input("title").value).toBe("Hello");
      return storage;
    }

    it("refreshes the form when nothing was typed", async () => {
      await open();
      release();
      await settle();
      expect(input("title").value).toBe("Server");
    });

    it("keeps what the author typed, but still caches the fresh copy", async () => {
      const storage = await open();
      input("title").value = "Mine";
      input("title").dispatchEvent(new Event("input"));
      release();
      await settle();
      expect(input("title").value).toBe("Mine");
      expect(new OfflineStore(storage).post("hello")?.meta.title).toBe("Server");
    });

    it("leaves the form alone when the author moved on to another post", async () => {
      await open();
      el("new-post").dispatchEvent(new Event("click"));
      release();
      await settle();
      expect(input("title").value).toBe("");
    });
  });
});
