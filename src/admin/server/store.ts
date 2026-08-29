/**
 * Reading and writing posts on disk.
 *
 * Filesystem access is injected rather than imported so the handler can be
 * tested without a temp directory, and so every path this module builds is
 * constructed here -- one place to guarantee a slug from an HTTP request never
 * escapes `src/content/blog/`.
 */

import { join } from "node:path";
import {
  parsePost,
  serializePost,
  type PostMeta,
} from "../../lib/frontmatter";
import { extensionOf, isValidImageName, isValidSlug } from "./guards";

/** Filename the markdown lives under; see README on the DOCS- prefix. */
export const POST_FILE = "DOCS-index.md";
/** Repo-relative directory holding the corpus. */
export const CONTENT_DIR = "src/content/blog";

/** The filesystem operations the store needs, as a port. */
export interface FileSystemPort {
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  writeText(path: string, data: string): Promise<void>;
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  mkdirp(path: string): Promise<void>;
  listDir(path: string): Promise<string[]>;
  removeDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/** A post as it exists on disk. */
export interface StoredPost {
  readonly slug: string;
  readonly meta: PostMeta;
  readonly body: string;
  /** Image filenames sitting beside the markdown. */
  readonly images: readonly string[];
}

/**
 * The directory for `slug`.
 *
 * Throws rather than returning a sentinel: a caller that forgets to check
 * would otherwise build a path out of unvalidated input, which is the whole
 * failure this function exists to prevent.
 */
export function postDir(root: string, slug: string): string {
  if (!isValidSlug(slug)) {
    throw new Error(`"${slug}" is not a valid post slug`);
  }
  return join(root, CONTENT_DIR, slug);
}

/** The path of an image inside a post directory. */
export function imagePath(root: string, slug: string, name: string): string {
  if (!isValidImageName(name)) {
    throw new Error(`"${name}" is not a valid image filename`);
  }
  return join(postDir(root, slug), name);
}

/** Every slug with a post file, in directory order. */
export async function listSlugs(
  fs: FileSystemPort,
  root: string,
): Promise<string[]> {
  const base = join(root, CONTENT_DIR);
  if (!(await fs.exists(base))) {
    return [];
  }
  const entries = await fs.listDir(base);
  const slugs: string[] = [];
  for (const entry of entries) {
    if (isValidSlug(entry) && (await fs.exists(join(base, entry, POST_FILE)))) {
      slugs.push(entry);
    }
  }
  return slugs;
}

/** Read one post, or null if it does not exist. */
export async function readPost(
  fs: FileSystemPort,
  root: string,
  slug: string,
): Promise<StoredPost | null> {
  const directory = postDir(root, slug);
  const file = join(directory, POST_FILE);
  if (!(await fs.exists(file))) {
    return null;
  }
  const { meta, body } = parsePost(`${slug}/${POST_FILE}`, await fs.readText(file));
  const images = (await fs.listDir(directory)).filter(
    (name) => name !== POST_FILE && extensionOf(name) !== "",
  );
  return { slug, meta, body, images };
}

/** Read every post, newest first. */
export async function readAllPosts(
  fs: FileSystemPort,
  root: string,
): Promise<StoredPost[]> {
  const posts: StoredPost[] = [];
  for (const slug of await listSlugs(fs, root)) {
    const post = await readPost(fs, root, slug);
    if (post !== null) {
      posts.push(post);
    }
  }
  return posts.sort(
    (a, b) =>
      b.meta.date.localeCompare(a.meta.date) ||
      a.meta.title.localeCompare(b.meta.title),
  );
}

/** Create or overwrite a post. Throws if the metadata cannot be written. */
export async function writePost(
  fs: FileSystemPort,
  root: string,
  slug: string,
  meta: PostMeta,
  body: string,
): Promise<void> {
  // serializePost validates before anything touches the filesystem, so a
  // rejected post leaves no half-written directory behind.
  const contents = serializePost(meta, body);
  const directory = postDir(root, slug);
  await fs.mkdirp(directory);
  await fs.writeText(join(directory, POST_FILE), contents);
}

/** Remove a post and everything beside it. */
export async function deletePost(
  fs: FileSystemPort,
  root: string,
  slug: string,
): Promise<void> {
  await fs.removeDir(postDir(root, slug));
}

/** Write an image into a post directory. */
export async function writeImage(
  fs: FileSystemPort,
  root: string,
  slug: string,
  name: string,
  bytes: Uint8Array,
): Promise<void> {
  const target = imagePath(root, slug, name);
  await fs.mkdirp(postDir(root, slug));
  await fs.writeBytes(target, bytes);
}

/** Read an image, or null if it is not there. */
export async function readImage(
  fs: FileSystemPort,
  root: string,
  slug: string,
  name: string,
): Promise<Uint8Array | null> {
  const target = imagePath(root, slug, name);
  return (await fs.exists(target)) ? fs.readBytes(target) : null;
}
