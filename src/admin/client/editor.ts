/**
 * The editor page's behaviour.
 *
 * Separated from `index.html` so it is type-checked, linted and tested like
 * the rest of the repo rather than living as untyped script text. Everything
 * it touches -- the document, `fetch`, today's date -- arrives through
 * {@link EditorPorts}, so the whole flow runs under jsdom against a stub
 * server, which is the only way its error paths get exercised at all.
 */

export { Unauthorised, errorMessage, parseTags } from "./editor-parts";
export type { PostMetaJson, StoredPostJson, EditorPorts, ListResponse, SaveResponse, UploadResponse } from "./editor-parts";

import type { Tone, StoredPostJson, ListResponse, SaveResponse, UploadResponse, EditorPorts } from "./editor-parts";
import {
  glyph,
  labelledGlyph,
  required,
  insertBlock,
  postListItems,
  TONE_GLYPH,
  Unauthorised,
  errorMessage,
  parseTags,
  FIELDS,
} from "./editor-parts";

/**
 * Wire up the editor and decide which view to show.
 * The document is served without a session, so the first request is what
 * answers "am I logged in": `/api/posts` is behind the gate and the editor is not.
 */
export async function mountEditor(ports: EditorPorts): Promise<void> {
  const { doc } = ports;
  const el = (id: string): HTMLElement => required(doc, id);
  // The document is ours and shipped beside this file, so a cast is a
  // statement about a known template, not a guess about untrusted input --
  // and `required` has already refused an id that is not in it.
  const input = (id: string): HTMLInputElement => el(id) as HTMLInputElement;

  const status = el("status");
  const loginView = el("login-view");
  const editorView = el("editor-view");
  const password = input("password");
  const slug = input("slug");
  const date = input("date");
  const title = input("title");
  const summary = input("summary");
  const tags = input("tags");
  const cover = input("cover");
  const draft = input("draft");
  const body = el("body") as HTMLTextAreaElement;
  const save = el("save") as HTMLButtonElement;
  const remove = el("delete") as HTMLButtonElement;
  const imageInput = input("image-input");
  const postList = el("post-list");
  const imageList = el("images");

  let posts: StoredPostJson[] = [];
  let current: string | null = null;
  /** Report a state as a glyph per tone; the sentence is spoken-only (textgate). */
  const say = (text: string, tone: Tone = "ok", figure?: string): void => {
    const spoken = doc.createElement("span");
    spoken.className = "sr-only";
    spoken.textContent = text;
    const shown: Node[] = [glyph(doc, TONE_GLYPH[tone])];
    if (figure !== undefined) {
      shown.push(doc.createTextNode(figure));
    }
    status.replaceChildren(...shown, spoken);
    status.dataset.tone = tone;
  };

  function show(view: "login" | "editor"): void {
    loginView.hidden = view !== "login";
    editorView.hidden = view !== "editor";
  }

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await ports.fetch(path, { credentials: "same-origin", ...options });
    if (response.status === 401) {
      show("login");
      throw new Unauthorised("your session has expired");
    }
    const payload = ((await response.json()) as unknown) as Partial<{ error: string }> & T;
    if (!response.ok) {
      throw new Error(payload.error ?? `request failed (${String(response.status)})`);
    }
    return payload;
  }

  /** Run a handler, turning any failure into a message instead of a crash. */
  function guard(work: () => Promise<void>): () => void {
    return () => {
      void work().catch((error: unknown) => { say(errorMessage(error), "bad"); });
    };
  }

  function insert(text: string): void {
    insertBlock(body, text);
  }

  function renderImages(images: readonly string[]): void {
    if (images.length === 0) {
      imageList.replaceChildren(labelledGlyph(doc, "images", "No images yet."));
      return;
    }
    imageList.replaceChildren();
    for (const name of images) {
      const code = doc.createElement("code");
      code.textContent = name;
      code.addEventListener("click", () => { insert(`![](./${name})`); });
      imageList.append(code, " ");
    }
  }

  function renderList(): void {
    postList.replaceChildren(
      ...postListItems(doc, posts, current, (name) => guard(() => load(name))),
    );
  }

  function fill(post: StoredPostJson | null): void {
    current = post === null ? null : post.slug;
    slug.value = post === null ? "" : post.slug;
    slug.disabled = post !== null;
    date.value = post === null ? ports.today() : post.meta.date;
    title.value = post === null ? "" : post.meta.title;
    summary.value = post === null ? "" : post.meta.summary;
    tags.value = post === null ? "" : post.meta.tags.join(", ");
    cover.value = post === null ? "" : (post.meta.cover ?? "");
    // A new post starts as a draft; publishing should be a decision, not a typo.
    draft.checked = post === null ? true : post.meta.draft;
    body.value = post === null ? "" : post.body;
    remove.hidden = post === null;
    renderImages(post === null ? [] : post.images);
    renderList();
  }

  async function refresh(): Promise<void> {
    posts = (await api<ListResponse>("/api/posts")).posts;
    renderList();
  }

  async function load(name: string): Promise<void> {
    fill(await api<StoredPostJson>(`/api/posts/${encodeURIComponent(name)}`));
    say(`Editing ${name}.`);
  }

  async function start(): Promise<void> {
    await refresh();
    show("editor");
    fill(null);
  }

  el("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    guard(async () => {
      await api("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.value }),
      });
      password.value = "";
      await start();
      say("Signed in.");
    })();
  });

  el("logout").addEventListener(
    "click",
    guard(async () => {
      await api("/api/logout", { method: "POST" });
      show("login");
      say("Signed out.");
    }),
  );

  el("new-post").addEventListener("click", () => {
    fill(null);
    say("New post. Save it once to create the directory, then add images.");
  });

  el("post-form").addEventListener("submit", (event) => {
    event.preventDefault();
    guard(async () => {
      const name = slug.value.trim();
      save.disabled = true;
      say("Saving and rebuilding…", "busy");
      try {
        const result = await api<SaveResponse>(`/api/posts/${encodeURIComponent(name)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meta: {
              title: title.value,
              date: date.value,
              summary: summary.value,
              tags: parseTags(tags.value),
              cover: cover.value.trim() === "" ? null : cover.value.trim(),
              draft: draft.checked,
            },
            body: body.value,
          }),
        });
        current = name;
        slug.disabled = true;
        await refresh();
        const seconds = `${(result.durationMs / 1000).toFixed(1)}s`;
        say(`Saved and published in ${seconds}.`, "ok", seconds);
      } finally {
        save.disabled = false;
      }
    })();
  });

  el("upload").addEventListener("click", () => {
    if (slug.value.trim() === "") {
      say("Give the post a slug and save it first — images live next to it.", "bad");
      return;
    }
    imageInput.click();
  });

  imageInput.addEventListener(
    "change",
    guard(async () => {
      const file = imageInput.files?.[0];
      if (file === undefined) {
        return;
      }
      const name = slug.value.trim();
      const result = await api<UploadResponse>(
        `/api/posts/${encodeURIComponent(name)}/images`,
        { method: "POST", headers: { "X-Filename": file.name }, body: file },
      );
      insert(result.markdown);
      renderImages((await api<StoredPostJson>(`/api/posts/${encodeURIComponent(name)}`)).images);
      say(`Uploaded ${result.name}. Save to publish it.`);
    }),
  );

  remove.addEventListener(
    "click",
    // No confirm(): a modal blocks the page; every post is in git anyway.
    guard(async () => {
      const name = slug.value.trim();
      await api(`/api/posts/${encodeURIComponent(name)}`, { method: "DELETE" });
      await refresh();
      fill(null);
      say(`Deleted ${name}.`);
    }),
  );

  for (const id of FIELDS) {
    el(id).addEventListener("input", () => { status.textContent = ""; });
  }

  try {
    await start();
  } catch {
    show("login");
  }
}