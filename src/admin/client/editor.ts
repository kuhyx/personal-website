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

import type { StoredPostJson, ListResponse, EditorPorts } from "./editor-parts";
import { controls } from "./editor-controls";
import {
  insertBlock, postListItems, statusReporter, renderImageList,
  errorMessage, parseTags, FIELDS, memoryStorage,
} from "./editor-parts";
import { apiClient, syncer } from "./editor-sync";
import { queueUpload, registerShell } from "./editor-upload";
import { memoryFiles } from "./files";
import { Offline, OfflineStore } from "./offline-store";

/**
 * Wire up the editor and decide which view to show.
 * The document is served without a session, so the first request is what
 * answers "am I logged in": `/api/posts` is behind the gate and the editor is not.
 */
export async function mountEditor(ports: EditorPorts): Promise<void> {
  const { doc } = ports;
  const {
    el, status, loginView, editorView, password, slug, date, title, summary, tags, cover,
    draft, body, save, remove, imageInput, postList, imageList,
  } = controls(doc);

  let posts: StoredPostJson[] = [];
  let current: string | null = null;
  let dirty = false;
  const store = new OfflineStore(ports.storage ?? memoryStorage());
  const files = ports.files ?? memoryFiles();
  const say = statusReporter(doc, status);
  const api = apiClient(ports.fetch, () => { show("login"); });
  const sync = syncer(store, files, api, say, refresh);

  function show(view: "login" | "editor"): void {
    loginView.hidden = view !== "login";
    editorView.hidden = view !== "editor";
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
    renderImageList(doc, imageList, images, (name) => { insert(`![](./${name})`); });
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

  /** Paint the cached list at once, then replace it with the server's when it answers. */
  async function refresh(): Promise<void> {
    posts = store.posts();
    renderList();
    try {
      store.rememberList((await api<ListResponse>("/api/posts")).posts);
    } catch (error) {
      if (error instanceof Offline) {
        return;
      }
      throw error;
    }
    posts = store.posts();
    renderList();
  }

  /** Show the cached copy at once; the fresh one replaces it only if nothing was typed meanwhile. */
  async function load(name: string): Promise<void> {
    const cached = store.post(name);
    if (cached !== null) {
      fill(cached);
      say(`Editing ${name}.`);
    }
    let fresh: StoredPostJson;
    try {
      fresh = await api<StoredPostJson>(`/api/posts/${encodeURIComponent(name)}`);
    } catch (error) {
      if (cached !== null && error instanceof Offline) {
        return;
      }
      throw error;
    }
    store.rememberPost(fresh);
    if (cached === null || (current === name && !dirty)) {
      fill(store.post(name));
      say(`Editing ${name}.`);
    }
  }

  async function start(): Promise<void> {
    await refresh();
    show("editor");
    fill(null);
    guard(sync)();
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
      try {
        // Offline first: the save lands on this device before any request goes out.
        store.queuePut(name, {
          title: title.value,
          date: date.value,
          summary: summary.value,
          tags: parseTags(tags.value),
          cover: cover.value.trim() === "" ? null : cover.value.trim(),
          draft: draft.checked,
        }, body.value);
        current = name;
        slug.disabled = true;
        remove.hidden = false;
        dirty = false;
        posts = store.posts();
        renderList();
        say("Saving and rebuilding…", "busy");
        await sync();
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
      // Offline first, like a save: on this device before any request goes out.
      await queueUpload(store, files, name, file, ports.newId ?? (() => crypto.randomUUID()));
      insert(`![](./${file.name})`);
      dirty = true;
      renderImages(store.post(name)?.images ?? [file.name]);
      say(`Added ${file.name}. Save to publish it.`);
      await sync();
    }),
  );

  remove.addEventListener(
    "click",
    // No confirm(): a modal blocks the page; every post is in git anyway.
    guard(async () => {
      const name = slug.value.trim();
      await Promise.all(store.queueDelete(name).map((key) => files.delete(key)));
      posts = store.posts();
      fill(null);
      say(`Deleted ${name}.`);
      await sync();
    }),
  );

  ports.onOnline?.(guard(sync));
  guard(() => registerShell(ports.serviceWorker))();

  for (const id of FIELDS) {
    el(id).addEventListener("input", () => {
      status.textContent = "";
      dirty = true;
    });
  }

  try {
    await start();
  } catch {
    show("login");
  }
}