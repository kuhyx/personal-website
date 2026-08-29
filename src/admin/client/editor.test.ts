import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Unauthorised, errorMessage, mountEditor, parseTags, type StoredPostJson } from "./editor";

/**
 * The real page, not a fixture.
 *
 * Mounting against `index.html` itself is the point: a renamed id or a control
 * dropped from the markup fails here instead of in the browser. jsdom never
 * runs the inline module script, so assigning the markup is enough.
 */
const PAGE = readFileSync("src/admin/client/index.html", "utf8");
const BODY = /<body>([\s\S]*)<\/body>/.exec(PAGE)?.[1] ?? "";

const POST: StoredPostJson = {
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

const DRAFT: StoredPostJson = { ...POST, slug: "wip", meta: { ...POST.meta, draft: true } };

/** One canned answer per route, matched by the first pattern that fits. */
type Route = [RegExp, () => Response | Promise<Response>];

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(routes: Route[]): { fetch: typeof globalThis.fetch; calls: string[] } {
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

const listing = (posts: StoredPostJson[]): Route => [/\/api\/posts$/, () => json({ posts })];
const unauthorised: Route = [/\/api\//, () => json({ error: "authentication required" }, 401)];

const el = (id: string): HTMLElement => {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`#${id} is not in the page`);
  }
  return found;
};
const input = (id: string): HTMLInputElement => el(id) as HTMLInputElement;
const status = (): string => el("status").textContent;
const today = (): string => "2026-08-29";
const postButton = (): HTMLButtonElement => {
  const button = el("post-list").querySelector("button");
  if (button === null) {
    throw new Error("the post list rendered no entries");
  }
  return button;
};
const firstImageChip = (): HTMLElement => {
  const chip = el("images").querySelector("code");
  if (chip === null) {
    throw new Error("the image list rendered no names");
  }
  return chip;
};

/** Let the promise chain a DOM event started settle before asserting. */
const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

beforeEach(() => {
  document.body.innerHTML = BODY;
});

describe("errorMessage", () => {
  it("uses an Error's message", () => {
    expect(errorMessage(new Error("nope"))).toBe("nope");
  });

  it("stringifies anything else, so nothing fails silently", () => {
    expect(errorMessage("network down")).toBe("network down");
  });
});

describe("parseTags", () => {
  it.each([
    ["", []],
    ["one", ["one"]],
    [" one , two ", ["one", "two"]],
    ["one,,two,", ["one", "two"]],
  ])("parses %j", (raw, expected) => {
    expect(parseTags(raw)).toEqual(expected);
  });
});

describe("mounting", () => {
  it("refuses a document that is missing a control it needs", async () => {
    el("status").remove();
    const { fetch } = stubFetch([listing([])]);
    await expect(mountEditor({ doc: document, fetch, today })).rejects.toThrow(/missing #status/);
  });

  it("shows the editor when the session is still good", async () => {
    const { fetch } = stubFetch([listing([POST])]);
    await mountEditor({ doc: document, fetch, today });
    expect(el("editor-view").hidden).toBe(false);
    expect(el("login-view").hidden).toBe(true);
    expect(el("post-list").textContent).toContain("Hello");
  });

  it("shows the login form when there is no session", async () => {
    const { fetch } = stubFetch([unauthorised]);
    await mountEditor({ doc: document, fetch, today });
    expect(el("login-view").hidden).toBe(false);
    expect(el("editor-view").hidden).toBe(true);
  });

  it("marks a draft in the list and dates every entry", async () => {
    const { fetch } = stubFetch([listing([POST, DRAFT])]);
    await mountEditor({ doc: document, fetch, today });
    expect(el("post-list").textContent).toContain("Hello (draft)".replace("Hello", DRAFT.meta.title));
    expect(el("post-list").textContent).toContain("2026-08-20");
  });

  it("starts a blank post dated today, as a draft", async () => {
    const { fetch } = stubFetch([listing([])]);
    await mountEditor({ doc: document, fetch, today });
    expect(input("date").value).toBe("2026-08-29");
    expect(input("draft").checked).toBe(true);
    expect(input("slug").disabled).toBe(false);
    expect(el("delete").hidden).toBe(true);
    expect(el("images").textContent).toBe("No images yet.");
  });
});

describe("signing in", () => {
  it("swaps to the editor and forgets the password", async () => {
    const { fetch, calls } = stubFetch([
      [/\/api\/login$/, () => json({ ok: true })],
      listing([POST]),
    ]);
    // The first mount fails the session check, which is what shows the form.
    const failing = stubFetch([unauthorised]);
    await mountEditor({ doc: document, fetch: failing.fetch, today });

    document.body.innerHTML = BODY;
    await mountEditor({ doc: document, fetch, today });
    input("password").value = "hunter2";
    el("login-form").dispatchEvent(new Event("submit"));
    await settle();

    expect(input("password").value).toBe("");
    expect(el("editor-view").hidden).toBe(false);
    expect(status()).toBe("Signed in.");
    expect(calls).toContain("POST /api/login");
  });

  it("reports a rejected password without leaving the form", async () => {
    const { fetch } = stubFetch([
      [/\/api\/login$/, () => json({ error: "invalid credentials" }, 401)],
      listing([]),
    ]);
    await mountEditor({ doc: document, fetch, today });
    el("login-form").dispatchEvent(new Event("submit"));
    await settle();
    expect(status()).toBe("your session has expired");
    expect(el("login-view").hidden).toBe(false);
  });

  it("signs out back to the form", async () => {
    const { fetch, calls } = stubFetch([
      [/\/api\/logout$/, () => json({ ok: true })],
      listing([]),
    ]);
    await mountEditor({ doc: document, fetch, today });
    el("logout").dispatchEvent(new Event("click"));
    await settle();
    expect(calls).toContain("POST /api/logout");
    expect(el("login-view").hidden).toBe(false);
    expect(status()).toBe("Signed out.");
  });
});

describe("editing", () => {
  const withPost = (): ReturnType<typeof stubFetch> =>
    stubFetch([listing([POST]), [/\/api\/posts\/hello$/, () => json(POST)]]);

  it("loads a post from the list into the form", async () => {
    const { fetch } = withPost();
    await mountEditor({ doc: document, fetch, today });
    postButton().click();
    await settle();
    expect(input("title").value).toBe("Hello");
    expect(input("tags").value).toBe("meta, vite");
    expect(input("cover").value).toBe("./cover.png");
    expect(input("slug").disabled).toBe(true);
    expect(el("delete").hidden).toBe(false);
    expect(status()).toBe("Editing hello.");
  });

  it("leaves the cover empty when the post has none", async () => {
    const bare = { ...POST, meta: { ...POST.meta, cover: null } };
    const { fetch } = stubFetch([listing([bare]), [/\/api\/posts\/hello$/, () => json(bare)]]);
    await mountEditor({ doc: document, fetch, today });
    postButton().click();
    await settle();
    expect(input("cover").value).toBe("");
  });

  it("clears the last message as soon as a field is edited", async () => {
    const { fetch } = withPost();
    await mountEditor({ doc: document, fetch, today });
    el("new-post").dispatchEvent(new Event("click"));
    expect(status()).not.toBe("");
    input("title").dispatchEvent(new Event("input"));
    expect(status()).toBe("");
  });

  it("inserts an image reference at the cursor when its name is clicked", async () => {
    const { fetch } = withPost();
    await mountEditor({ doc: document, fetch, today });
    postButton().click();
    await settle();
    const body = el("body") as HTMLTextAreaElement;
    body.value = "before after";
    body.selectionStart = body.selectionEnd = 7;
    firstImageChip().click();
    expect(body.value).toBe("before \n\n![](./cover.png)\n\nafter");
    expect(body.selectionStart).toBe("before \n\n![](./cover.png)\n\n".length);
  });

  it("separates an inserted image from a body that does not end in a newline", async () => {
    const { fetch } = withPost();
    await mountEditor({ doc: document, fetch, today });
    postButton().click();
    await settle();
    const body = el("body") as HTMLTextAreaElement;
    // Assigning `value` is what loading a post does, and it leaves the caret at
    // the end -- the state a writer is in after picking a post from the list.
    // Glued to a closing fence, the image would be inside code that never ends.
    body.value = "```ts\nconst ok = true;\n```";
    body.selectionStart = body.selectionEnd = body.value.length;
    firstImageChip().click();
    expect(body.value).toBe("```ts\nconst ok = true;\n```\n\n![](./cover.png)");
  });

  it("adds only the newlines the boundary is missing", async () => {
    const { fetch } = withPost();
    await mountEditor({ doc: document, fetch, today });
    postButton().click();
    await settle();
    const body = el("body") as HTMLTextAreaElement;
    body.value = "one\n\ntwo";
    body.selectionStart = body.selectionEnd = 4;
    firstImageChip().click();
    expect(body.value).toBe("one\n\n![](./cover.png)\n\ntwo");
  });

  it("adds nothing where the boundary is already a blank line", async () => {
    const { fetch } = withPost();
    await mountEditor({ doc: document, fetch, today });
    postButton().click();
    await settle();
    const body = el("body") as HTMLTextAreaElement;
    body.value = "one\n\n\n\ntwo";
    body.selectionStart = body.selectionEnd = 5;
    firstImageChip().click();
    expect(body.value).toBe("one\n\n![](./cover.png)\n\ntwo");
  });
});

describe("saving", () => {
  it("sends the form as JSON and reports how long the build took", async () => {
    let sent: unknown = null;
    const { fetch } = stubFetch([
      listing([POST]),
      [
        /\/api\/posts\/new-one$/,
        () => json({ slug: "new-one", built: true, durationMs: 1500 }),
      ],
    ]);
    const recording: typeof globalThis.fetch = (path, init) => {
      if (init?.method === "PUT" && typeof init.body === "string") {
        sent = JSON.parse(init.body);
      }
      return fetch(path, init);
    };
    await mountEditor({ doc: document, fetch: recording, today });
    input("slug").value = "new-one";
    input("title").value = "New one";
    input("summary").value = "Summary.";
    input("tags").value = "a, b";
    input("cover").value = "  ";
    (el("body") as HTMLTextAreaElement).value = "Prose.";
    el("post-form").dispatchEvent(new Event("submit"));
    await settle();

    expect(sent).toMatchObject({
      meta: { title: "New one", tags: ["a", "b"], cover: null, draft: true },
      body: "Prose.",
    });
    expect(status()).toBe("Saved and published in 1.5s.");
    expect(input("slug").disabled).toBe(true);
    expect((el("save") as HTMLButtonElement).disabled).toBe(false);
  });

  it("sends a cover through unchanged when one is set", async () => {
    let sent: unknown = null;
    const { fetch } = stubFetch([
      listing([]),
      [/\/api\/posts\/x$/, () => json({ durationMs: 600 })],
    ]);
    const recording: typeof globalThis.fetch = (path, init) => {
      if (init?.method === "PUT" && typeof init.body === "string") {
        sent = JSON.parse(init.body);
      }
      return fetch(path, init);
    };
    await mountEditor({ doc: document, fetch: recording, today });
    input("slug").value = "x";
    input("cover").value = "  ./cover.png  ";
    el("post-form").dispatchEvent(new Event("submit"));
    await settle();
    expect(sent).toMatchObject({ meta: { cover: "./cover.png" } });
  });

  it("reports a rejected save and re-enables the button", async () => {
    const { fetch } = stubFetch([
      listing([]),
      [/\/api\/posts\/x$/, () => json({ error: "image not found next to the post" }, 400)],
    ]);
    await mountEditor({ doc: document, fetch, today });
    input("slug").value = "x";
    el("post-form").dispatchEvent(new Event("submit"));
    await settle();
    expect(status()).toContain("image not found");
    expect((el("save") as HTMLButtonElement).disabled).toBe(false);
  });

  it("falls back to the status code when a failure carries no message", async () => {
    const { fetch } = stubFetch([listing([]), [/\/api\/posts\/x$/, () => json({}, 502)]]);
    await mountEditor({ doc: document, fetch, today });
    input("slug").value = "x";
    el("post-form").dispatchEvent(new Event("submit"));
    await settle();
    expect(status()).toBe("request failed (502)");
  });

  it("reports a network failure rather than leaving the button disabled", async () => {
    const { fetch } = stubFetch([listing([])]);
    const offline: typeof globalThis.fetch = (path, init) =>
      init?.method === "PUT"
        ? Promise.reject(new Error("Failed to fetch"))
        : fetch(path, init);
    await mountEditor({ doc: document, fetch: offline, today });
    input("slug").value = "x";
    el("post-form").dispatchEvent(new Event("submit"));
    await settle();
    expect(status()).toBe("Failed to fetch");
    expect((el("save") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("images", () => {
  it("refuses to upload before the post has a slug", async () => {
    const { fetch } = stubFetch([listing([])]);
    await mountEditor({ doc: document, fetch, today });
    const picker = vi.spyOn(input("image-input"), "click");
    el("upload").dispatchEvent(new Event("click"));
    expect(status()).toMatch(/slug/);
    expect(picker).not.toHaveBeenCalled();
  });

  it("opens the file picker once there is a slug", async () => {
    const { fetch } = stubFetch([listing([])]);
    await mountEditor({ doc: document, fetch, today });
    input("slug").value = "hello";
    const picker = vi.spyOn(input("image-input"), "click");
    el("upload").dispatchEvent(new Event("click"));
    expect(picker).toHaveBeenCalledOnce();
  });

  it("does nothing when the picker is dismissed with no file", async () => {
    const { fetch, calls } = stubFetch([listing([])]);
    await mountEditor({ doc: document, fetch, today });
    input("image-input").dispatchEvent(new Event("change"));
    await settle();
    expect(calls.filter((call) => call.includes("images"))).toEqual([]);
  });

  it("uploads, inserts the markdown and relists the post's images", async () => {
    const uploaded = { ...POST, images: ["cover.png", "shot.png"] };
    const { fetch, calls } = stubFetch([
      [/\/images$/, () => json({ name: "shot.png", markdown: "![](./shot.png)" }, 201)],
      [/\/api\/posts\/hello$/, () => json(uploaded)],
      listing([POST]),
    ]);
    await mountEditor({ doc: document, fetch, today });
    input("slug").value = "hello";
    const picker = input("image-input");
    Object.defineProperty(picker, "files", {
      value: [new File(["bytes"], "shot.png", { type: "image/png" })],
    });
    picker.dispatchEvent(new Event("change"));
    await settle();

    expect(calls).toContain("POST /api/posts/hello/images");
    expect((el("body") as HTMLTextAreaElement).value).toBe("![](./shot.png)");
    expect(el("images").textContent).toContain("shot.png");
    expect(status()).toContain("Uploaded shot.png");
  });

  it("reports a rejected upload", async () => {
    const { fetch } = stubFetch([
      [/\/images$/, () => json({ error: "image is empty" }, 400)],
      listing([]),
    ]);
    await mountEditor({ doc: document, fetch, today });
    input("slug").value = "hello";
    const picker = input("image-input");
    Object.defineProperty(picker, "files", { value: [new File([], "shot.png")] });
    picker.dispatchEvent(new Event("change"));
    await settle();
    expect(status()).toBe("image is empty");
  });
});

describe("deleting", () => {
  it("removes the post and returns to a blank form", async () => {
    const { fetch, calls } = stubFetch([
      [/\/api\/posts\/hello$/, () => json({ slug: "hello", deleted: true })],
      listing([]),
    ]);
    await mountEditor({ doc: document, fetch, today });
    input("slug").value = "hello";
    el("delete").dispatchEvent(new Event("click"));
    await settle();
    expect(calls).toContain("DELETE /api/posts/hello");
    expect(input("slug").value).toBe("");
    expect(status()).toBe("Deleted hello.");
  });

  it("reports a failed delete", async () => {
    const { fetch } = stubFetch([
      [/\/api\/posts\/hello$/, () => json({ error: "no such post" }, 404)],
      listing([]),
    ]);
    await mountEditor({ doc: document, fetch, today });
    input("slug").value = "hello";
    el("delete").dispatchEvent(new Event("click"));
    await settle();
    expect(status()).toBe("no such post");
  });
});

describe("session expiry", () => {
  it("drops back to the login form mid-session", async () => {
    let signedIn = true;
    const { fetch } = stubFetch([
      [
        /\/api\/posts/,
        () => (signedIn ? json({ posts: [] }) : json({ error: "authentication required" }, 401)),
      ],
    ]);
    await mountEditor({ doc: document, fetch, today });
    expect(el("editor-view").hidden).toBe(false);
    signedIn = false;
    el("new-post").dispatchEvent(new Event("click"));
    input("slug").value = "x";
    el("post-form").dispatchEvent(new Event("submit"));
    await settle();
    expect(el("login-view").hidden).toBe(false);
    expect(status()).toBe(new Unauthorised("your session has expired").message);
  });
});
