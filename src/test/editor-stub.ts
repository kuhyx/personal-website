/** Harness for the editor's route-stubbed tests: the real page and one canned answer per route. */
import { readFileSync } from "node:fs";
import type { StoredPostJson } from "../admin/client/editor";

/**
 * The real page, not a fixture.
 *
 * Mounting against `index.html` itself is the point: a renamed id or a control
 * dropped from the markup fails here instead of in the browser. jsdom never
 * runs the inline module script, so assigning the markup is enough.
 */
export const PAGE = readFileSync("src/admin/client/index.html", "utf8");
export const BODY = /<body>([\s\S]*)<\/body>/.exec(PAGE)?.[1] ?? "";

export const POST: StoredPostJson = {
  slug: "hello",
  meta: {
    title: "Hello",
    date: "2026-08-20",
    summary: "A summary.",
    tags: ["meta", "vite"],
    cover: "./cover.png",
    draft: false,
  },
  body: "Body text.",
  images: ["cover.png"],
};

export const DRAFT: StoredPostJson = { ...POST, slug: "wip", meta: { ...POST.meta, draft: true } };

/** One canned answer per route, matched by the first pattern that fits. */
export type Route = [RegExp, () => Response | Promise<Response>];

export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function stubFetch(routes: Route[]): { fetch: typeof globalThis.fetch; calls: string[] } {
  const calls: string[] = [];
  const fetcher = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(`${init?.method ?? "GET"} ${path}`);
    const route = routes.find(([pattern]) => pattern.test(path));
    if (route === undefined) {
      return Promise.resolve(json({ error: `no stub for ${path}` }, 500));
    }
    return Promise.resolve(route[1]());
  };
  return { fetch: fetcher, calls };
}

export const listing = (posts: StoredPostJson[]): Route => [/\/api\/posts$/, () => json({ posts })];
export const unauthorised: Route = [/\/api\//, () => json({ error: "authentication required" }, 401)];

export const el = (id: string): HTMLElement => {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`#${id} is not in the page`);
  }
  return found;
};
export const input = (id: string): HTMLInputElement => el(id) as HTMLInputElement;
export const status = (): string => el("status").querySelector(".sr-only")?.textContent ?? "";
export const today = (): string => "2026-08-29";
export const postButton = (): HTMLButtonElement => {
  const button = el("post-list").querySelector("button");
  if (button === null) {
    throw new Error("the post list rendered no entries");
  }
  return button;
};
export const firstImageChip = (): HTMLElement => {
  const chip = el("images").querySelector("code");
  if (chip === null) {
    throw new Error("the image list rendered no names");
  }
  return chip;
};

/** Let the promise chain a DOM event started settle before asserting. */
export const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });
