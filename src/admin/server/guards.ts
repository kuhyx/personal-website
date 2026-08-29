/**
 * Validation for every value that becomes part of a filesystem path.
 *
 * The admin service writes into `src/content/blog/<slug>/<name>`, so a slug or
 * image name is a path fragment supplied by an HTTP client. These predicates
 * are an allowlist rather than a denylist: `..` and `/` are rejected because
 * nothing outside the allowed character set is accepted at all, not because
 * they are individually blocked. Enumerating bad inputs is how traversal bugs
 * survive review.
 */

/** Lowercase, digits and inner hyphens. No dots, so `..` cannot be formed. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Image basenames additionally allow dots and underscores, never leading. */
const IMAGE_NAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

/**
 * Extensions Vite's asset pipeline handles, with the type to serve them as.
 *
 * One table rather than a set plus a lookup elsewhere: an extension that was
 * accepted on upload but had no content type would be served as a download,
 * and the two lists drifting is exactly how that happens.
 */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

const IMAGE_EXTENSIONS = new Set(Object.keys(IMAGE_TYPES));

/** Refuse anything that could span directories, whatever the pattern allows. */
const SEPARATORS = ["/", "\\", "\0"];

/** The two kinds of file the editor build emits, with their types. */
const ASSET_TYPES: Readonly<Record<string, string>> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const ASSET_EXTENSIONS = new Set(Object.keys(ASSET_TYPES));

/** What a byte stream of unknown kind is served as. */
export const FALLBACK_TYPE = "application/octet-stream";

export const MAX_SLUG_LENGTH = 80;
export const MAX_IMAGE_NAME_LENGTH = 100;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function hasSeparator(value: string): boolean {
  return SEPARATORS.some((separator) => value.includes(separator));
}

/** True if `value` is safe to use as a post directory name. */
export function isValidSlug(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_SLUG_LENGTH &&
    !hasSeparator(value) &&
    SLUG_PATTERN.test(value)
  );
}

/** The lowercased extension of `name`, including the dot, or "" if it has none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/** True if `name` is safe to write into a post directory as an image. */
export function isValidImageName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_IMAGE_NAME_LENGTH &&
    !hasSeparator(name) &&
    IMAGE_NAME_PATTERN.test(name) &&
    IMAGE_EXTENSIONS.has(extensionOf(name))
  );
}

/**
 * True if `name` is a built editor asset this service will serve.
 *
 * The same allowlist shape as the image names, for the same reason: the value
 * arrives in a URL and becomes a path segment. The extensions are narrower
 * because only two kinds of file are ever emitted there.
 */
export function isValidAssetName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_IMAGE_NAME_LENGTH &&
    !hasSeparator(name) &&
    IMAGE_NAME_PATTERN.test(name) &&
    ASSET_EXTENSIONS.has(extensionOf(name))
  );
}

/** The Content-Type for a stored post image. */
export function imageContentType(name: string): string {
  return IMAGE_TYPES[extensionOf(name)] ?? FALLBACK_TYPE;
}

/** The Content-Type for a built editor asset. */
export function assetContentType(name: string): string {
  return ASSET_TYPES[extensionOf(name)] ?? FALLBACK_TYPE;
}

/** Why an upload is unacceptable, or null if it is fine. */
export function imageUploadProblem(name: string, byteLength: number): string | null {
  if (!isValidImageName(name)) {
    return `"${name}" is not an allowed image filename (${[...IMAGE_EXTENSIONS].join(", ")})`;
  }
  if (byteLength === 0) {
    return "image is empty";
  }
  if (byteLength > MAX_IMAGE_BYTES) {
    return `image is ${String(byteLength)} bytes, over the ${String(MAX_IMAGE_BYTES)} limit`;
  }
  return null;
}
