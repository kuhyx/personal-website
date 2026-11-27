import { describe, it, expect, beforeEach } from "vitest";
import { Unauthorised, mountEditor } from "./editor";
import { BODY, POST, el, input, json, listing, settle, status, stubFetch, today } from "../../test/editor-stub";

beforeEach(() => {
  document.body.innerHTML = BODY;
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
    expect(el("status").dataset.tone).toBe("ok");
    expect(el("status").querySelector("use")?.getAttribute("href")).toBe("#icon-ok");
    expect(el("status").firstChild?.nextSibling?.textContent).toBe("1.5s");
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

  it("keeps a save on the device when the network fails, and re-enables the button", async () => {
    const { fetch } = stubFetch([listing([])]);
    const offline: typeof globalThis.fetch = (path, init) =>
      init?.method === "PUT"
        ? Promise.reject(new Error("Failed to fetch"))
        : fetch(path, init);
    await mountEditor({ doc: document, fetch: offline, today });
    input("slug").value = "x";
    el("post-form").dispatchEvent(new Event("submit"));
    await settle();
    expect(status()).toBe("Saved on this device. It publishes when the server is reachable.");
    expect(el("status").dataset.tone).toBe("offline");
    expect((el("save") as HTMLButtonElement).disabled).toBe(false);
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
    expect(status()).toBe("Published.");
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
