/**
 * Harness for the admin editor's end-to-end tests: the real page, a stub
 * server that can be unplugged, and ports that outlive a mount -- which is
 * what a reload is.
 */
import { readFileSync } from "node:fs";
import { mountEditor } from "../admin/client/editor";
import type { EditorPorts, StoredPostJson } from "../admin/client/editor-parts";
import type { KeyValue } from "../admin/client/offline-store";

const PAGE = readFileSync("src/admin/client/index.html", "utf8");
export const BODY = /<body>([\s\S]*)<\/body>/.exec(PAGE)?.[1] ?? "";

export const POST: StoredPostJson = {
  slug: "hello",
  meta: { title: "Hello", date: "2026-08-20", summary: "Sum", tags: ["meta"], cover: null, draft: false },
  body: "Body text.",
  images: ["cover.png"],
};

export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

/** A server that answers `answer` while plugged in and drops every request otherwise. */
export interface Server {
  plugged: boolean;
  calls: string[];
  /** The `X-Filename` and byte count of each image POST, in order. */
  uploads: string[];
  fetch: typeof globalThis.fetch;
}

export function server(answer: (method: string, path: string) => Response | Promise<Response>): Server {
  const state: Server = {
    plugged: true,
    calls: [],
    uploads: [],
    fetch: async (input, init) => {
      const path = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      if (!state.plugged) {
        throw new TypeError("Failed to fetch");
      }
      state.calls.push(`${method} ${path}`);
      if (init?.body instanceof Blob) {
        const headers = new Headers(init.headers);
        state.uploads.push(`${headers.get("X-Filename") ?? ""}:${String(init.body.size)}`);
      }
      return answer(method, path);
    },
  };
  return state;
}

/** The blog as the stub server holds it: listing, one post's details, writes that build. */
export function blog(posts: StoredPostJson[]): (method: string, path: string) => Response {
  return (method, path) => {
    if (method === "PUT") {
      return json({ durationMs: 1200 });
    }
    if (method === "DELETE") {
      return json({ deleted: true });
    }
    if (method === "POST" && path.endsWith("/images")) {
      return json({ name: "x", markdown: "![](./x)" }, 201);
    }
    return path.endsWith("/api/posts") ? json({ posts }) : json(posts[0]);
  };
}

export const el = (id: string): HTMLElement => document.getElementById(id) ?? document.body;
export const input = (id: string): HTMLInputElement => el(id) as HTMLInputElement;
export const status = (): string => el("status").querySelector(".sr-only")?.textContent ?? "";
export const tone = (): string | undefined => el("status").dataset.tone;
export const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

/** The last `onOnline` listener the editor registered. */
export const reconnect: { fire: () => void } = { fire: () => undefined };

/** Mount on a fresh copy of the page, as a reload would. */
export async function mount(
  fetch: typeof globalThis.fetch,
  storage: KeyValue,
  extra: Partial<EditorPorts> = {},
): Promise<void> {
  document.body.innerHTML = BODY;
  await mountEditor({
    doc: document,
    fetch,
    today: () => "2026-08-29",
    storage,
    onOnline: (listener) => { reconnect.fire = listener; },
    ...extra,
  });
  await settle();
}

/** Pick `file` in the image picker, as the browser's file dialog would. */
export function pick(file: File): void {
  const picker = input("image-input");
  Object.defineProperty(picker, "files", { value: [file], configurable: true });
  picker.dispatchEvent(new Event("change"));
}

export function submit(slug: string, title: string): void {
  input("slug").value = slug;
  input("title").value = title;
  el("post-form").dispatchEvent(new Event("submit"));
}
