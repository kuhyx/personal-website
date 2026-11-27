/**
 * Every element of `index.html` the editor drives, looked up once.
 *
 * The document is ours and shipped beside this file, so each cast is a
 * statement about a known template, not a guess about untrusted input --
 * and `required` has already refused an id that is not in it.
 */
import { required } from "./editor-parts";

export function controls(doc: Document) {
  const el = (id: string): HTMLElement => required(doc, id);
  const input = (id: string): HTMLInputElement => el(id) as HTMLInputElement;
  return {
    el,
    status: el("status"),
    loginView: el("login-view"),
    editorView: el("editor-view"),
    password: input("password"),
    slug: input("slug"),
    date: input("date"),
    title: input("title"),
    summary: input("summary"),
    tags: input("tags"),
    cover: input("cover"),
    draft: input("draft"),
    body: el("body") as HTMLTextAreaElement,
    save: el("save") as HTMLButtonElement,
    remove: el("delete") as HTMLButtonElement,
    imageInput: input("image-input"),
    postList: el("post-list"),
    imageList: el("images"),
  };
}
