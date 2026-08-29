/**
 * The editor page's behaviour.
 *
 * Separated from `index.html` so it is type-checked, linted and tested like
 * the rest of the repo rather than living as untyped script text. Everything
 * it touches -- the document, `fetch`, today's date -- arrives through
 * {@link EditorPorts}, so the whole flow runs under jsdom against a stub
 * server, which is the only way its error paths get exercised at all.
 */

/** Post metadata, exactly as the API sends and accepts it. */
export interface PostMetaJson {
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover: string | null;
  draft: boolean;
}

/** One post as `/api/posts` returns it. */
export interface StoredPostJson {
  slug: string;
  meta: PostMetaJson;
  body: string;
  images: string[];
}

/** What the editor needs from the outside world. */
export interface EditorPorts {
  readonly doc: Document;
  readonly fetch: typeof globalThis.fetch;
  /** Today as YYYY-MM-DD, for a new post's date. */
  readonly today: () => string;
}

/** Raised when the session is gone; the caller shows the login form instead. */
export class Unauthorised extends Error {}

/**
 * What to show the author when something failed.
 *
 * A pure function rather than a ternary inside the catch, because `catch`
 * types its argument `unknown` and the non-`Error` case is only reachable from
 * engine-level oddities -- testable here, not through a stub server.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ListResponse {
  posts: StoredPostJson[];
}
interface SaveResponse {
  durationMs: number;
}
interface UploadResponse {
  name: string;
  markdown: string;
}

const FIELDS = ["slug", "date", "title", "summary", "tags", "cover", "body"] as const;

function required(doc: Document, id: string): HTMLElement {
  const element = doc.getElementById(id);
  if (element === null) {
    throw new Error(`the editor document is missing #${id}`);
  }
  return element;
}

/** Split a comma-separated tag input into the array the API wants. */
export function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

/**
 * The newlines to put between an inserted block and the text beside it.
 *
 * Markdown starts a new block on a blank line, so two newlines is the target
 * and whatever is already at that boundary counts towards it. Nothing beside
 * it needs nothing: padding the ends of the body would only be trimmed away
 * when the post is written out.
 */
function separator(neighbour: string, existing: number): string {
  return neighbour === "" ? "" : "\n".repeat(2 - existing);
}

/**
 * Wire up the editor and decide which view to show.
 *
 * The document is served without a session, so the first request is what
 * answers "am I logged in": `/api/posts` is behind the gate and the editor is
 * not.
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

  const say = (text: string, tone: "ok" | "bad" = "ok"): void => {
    status.textContent = text;
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

  /**
   * Insert `text` at the caret, as a block of its own.
   *
   * Everything inserted here is an image, and an image glued to the end of the
   * line before it is at best inline in someone else's paragraph and at worst
   * -- when that line is a closing code fence -- a fence that never closes.
   * That is not a corner case: loading a post assigns `body.value`, which
   * leaves the caret at the end of it, so "pick a post, add an image" lands
   * there every time unless the writer clicks into the textarea first.
   */
  function insert(text: string): void {
    const at = body.selectionStart;
    const before = body.value.slice(0, at);
    const after = body.value.slice(body.selectionEnd);
    const lead = separator(before, before.endsWith("\n\n") ? 2 : before.endsWith("\n") ? 1 : 0);
    const trail = separator(after, after.startsWith("\n\n") ? 2 : after.startsWith("\n") ? 1 : 0);
    body.value = `${before}${lead}${text}${trail}${after}`;
    // After the whole block, so the next thing typed starts a new paragraph
    // rather than running on from the image.
    body.selectionStart = body.selectionEnd = at + lead.length + text.length + trail.length;
  }

  function renderImages(images: readonly string[]): void {
    if (images.length === 0) {
      imageList.textContent = "No images yet.";
      return;
    }
    imageList.replaceChildren("Click to insert: ");
    for (const name of images) {
      const code = doc.createElement("code");
      code.textContent = name;
      code.addEventListener("click", () => { insert(`![](./${name})`); });
      imageList.append(code, " ");
    }
  }

  function renderList(): void {
    postList.replaceChildren(
      ...posts.map((post) => {
        const item = doc.createElement("li");
        const button = doc.createElement("button");
        button.type = "button";
        button.setAttribute("aria-current", String(post.slug === current));
        const label = doc.createElement("span");
        label.textContent = post.meta.draft ? `${post.meta.title} (draft)` : post.meta.title;
        const when = doc.createElement("small");
        when.textContent = post.meta.date;
        button.append(label, when);
        button.addEventListener("click", guard(() => load(post.slug)));
        item.append(button);
        return item;
      }),
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
    // A new post starts as a draft: publishing should be a decision, not what
    // happens because the first save was a typo.
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
      say("Saving and rebuilding…");
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
        say(`Saved and published in ${(result.durationMs / 1000).toFixed(1)}s.`);
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
    // No confirm(): a modal blocks the page, and every post is in git anyway --
    // recovering one is a checkout, not a catastrophe.
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
