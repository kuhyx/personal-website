import { describe, it, expect, beforeEach } from "vitest";
import { errorMessage, mountEditor, parseTags } from "./editor";
import { BODY, DRAFT, POST, el, firstImageChip, input, json, listing, postButton, settle, status, stubFetch, today, unauthorised } from "../../test/editor-stub";

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
    const [published, draft] = [...el("post-list").querySelectorAll("li")];
    expect(published?.querySelector('[role="img"][aria-label="draft"]')).toBeNull();
    expect(draft?.querySelector('[role="img"][aria-label="draft"] use')?.getAttribute("href")).toBe("#icon-draft");
    expect(el("post-list").textContent).toContain("2026-08-20");
  });

  it("starts a blank post dated today, as a draft", async () => {
    const { fetch } = stubFetch([listing([])]);
    await mountEditor({ doc: document, fetch, today });
    expect(input("date").value).toBe("2026-08-29");
    expect(input("draft").checked).toBe(true);
    expect(input("slug").disabled).toBe(false);
    expect(el("delete").hidden).toBe(true);
    const imgList = el("images");
    expect(imgList.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("No images yet.");
    expect(imgList.querySelector("use")?.getAttribute("href")).toBe("#icon-images");
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
