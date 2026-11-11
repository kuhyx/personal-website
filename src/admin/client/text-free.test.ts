import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { mountEditor, type StoredPostJson } from "./editor";
import { visibleWords } from "../../test/visible-words";

/**
 * textgate: the editor paints no word Claude wrote, in any state `say()` can
 * reach. Allowed: the post's own fields (title, date, tags, image names) and
 * server error text never reaches the screen either.
 */
const PAGE = readFileSync("src/admin/client/index.html", "utf8");
const BODY = /<body>([\s\S]*)<\/body>/.exec(PAGE)?.[1] ?? "";

const POST: StoredPostJson = {
  slug: "hello",
  meta: { title: "Hello", date: "2026-08-20", summary: "Sum", tags: ["meta"], cover: null, draft: true },
  body: "Body",
  images: ["cover.png"],
};
const CONTENT = ["Hello", "hello", "cover.png"];

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

/** A fetch that answers the listing, one post, and fails every write with server prose. */
function fetcher(authorised: boolean): typeof globalThis.fetch {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!authorised) {
      return Promise.resolve(json({ error: "authentication required" }, 401));
    }
    if ((init?.method ?? "GET") !== "GET") {
      return Promise.resolve(json({ error: "something broke on the server" }, 500));
    }
    return Promise.resolve(json(path.endsWith("/api/posts") ? { posts: [POST] } : POST));
  };
}

const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });
const words = (): string[] => visibleWords(document.body, CONTENT);
const click = (id: string): void => { document.getElementById(id)?.click(); };

beforeEach(() => {
  document.body.innerHTML = BODY;
});

describe("text-free admin", () => {
  it("the login view paints no words", async () => {
    await mountEditor({ doc: document, fetch: fetcher(false), today: () => "2026-08-29" });
    expect(document.body.textContent.trim()).not.toBe("");
    expect(words()).toEqual([]);
  });

  it("the editor, a loaded post, a new post and a failed save paint only post content", async () => {
    await mountEditor({ doc: document, fetch: fetcher(true), today: () => "2026-08-29" });
    expect(words()).toEqual([]);
    document.querySelector<HTMLButtonElement>("#post-list button")?.click();
    await settle();
    expect(words()).toEqual([]);
    click("save");
    await settle();
    expect(document.getElementById("status")?.dataset.tone).toBe("bad");
    expect(words()).toEqual([]);
    click("new-post");
    await settle();
    expect(words()).toEqual([]);
    click("upload");
    await settle();
    expect(words()).toEqual([]);
  });
});
