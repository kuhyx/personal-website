/**
 * Every admin route, as one pure function.
 *
 * `handleRequest` takes a plain request record and returns a plain response
 * record — no sockets, no `node:http` types. That is what lets the routing,
 * the auth gate and the traversal guards be tested directly instead of through
 * a live server, and it is the only way 100% branch coverage here is honest
 * rather than theatrical. `index.ts` does the socket wiring and nothing else.
 */

import { captured } from "../../lib/captured";
import { imageKey, markdownImageSources } from "../../lib/markdown-images";
import type { PostMeta } from "../../lib/frontmatter";
import {
  SESSION_COOKIE,
  createSession,
  parseCookies,
  sessionCookieHeader,
  verifyPassword,
  verifySession,
} from "./auth";
import type { Builder } from "./builder";
import { assetContentType, imageContentType, imageUploadProblem, isValidAssetName } from "./guards";
import type { LoginThrottle } from "./rate-limit";
import {
  deletePost,
  listSlugs,
  readAllPosts,
  readImage,
  readPost,
  writeImage,
  writePost,
  type FileSystemPort,
} from "./store";

/** A request, reduced to what the routes actually read. */
export interface AdminRequest {
  readonly method: string;
  /** Pathname only, no query string. */
  readonly path: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: Uint8Array;
}

/** A response, ready for the socket layer to write. */
export interface AdminResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array;
}

/** Everything the routes depend on, injected. */
export interface HandlerDeps {
  readonly fs: FileSystemPort;
  readonly root: string;
  readonly passwordHash: string;
  readonly sessionSecret: string;
  readonly throttle: LoginThrottle;
  readonly builder: Builder;
  readonly now: () => number;
  /**
   * The admin UI document.
   *
   * Served without a session, because it has to be: the login form is inside
   * it. It carries no post data -- every byte the editor shows arrives later
   * through `/api/*`, behind the gate.
   */
  readonly adminHtml: () => Promise<string>;
  /**
   * One built asset of the editor page, or null if there is no such file.
   *
   * Served beside the document and under the same reasoning: it is the shell,
   * not the content. Without it the page loads and does nothing, because the
   * bundle it imports is a 404.
   */
  readonly adminAsset: (name: string) => Promise<Uint8Array | null>;
}

const JSON_TYPE = "application/json";

function json(status: number, value: unknown, extra: Record<string, string> = {}): AdminResponse {
  return {
    status,
    headers: { "Content-Type": JSON_TYPE, "Cache-Control": "no-store", ...extra },
    body: JSON.stringify(value),
  };
}

function fail(status: number, message: string, extra: Record<string, string> = {}): AdminResponse {
  return json(status, { error: message }, extra);
}

/** Read a JSON body, or null if it is absent or malformed. */
function readJson(request: AdminRequest): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(request.body));
  } catch {
    return null;
  }
}

/**
 * The message to report for a thrown value.
 *
 * A named function rather than a ternary at each `catch`, so the
 * not-an-`Error` case is testable directly: a rejection carrying a non-Error
 * is real but awkward to stage through a route.
 */
export function reason(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Coerce an untrusted JSON object into PostMeta, or explain why it cannot be. */
export function readMeta(value: unknown): PostMeta | string {
  if (!isRecord(value)) {
    return "body must be a JSON object";
  }
  const { title, date, summary, tags, cover, draft } = value;
  if (typeof title !== "string" || title.trim() === "") {
    return "title is required";
  }
  if (typeof date !== "string") {
    return "date is required";
  }
  if (typeof summary !== "string" || summary.trim() === "") {
    return "summary is required";
  }
  if (tags !== undefined && !(Array.isArray(tags) && tags.every((t) => typeof t === "string"))) {
    return "tags must be an array of strings";
  }
  if (cover !== undefined && cover !== null && typeof cover !== "string") {
    return "cover must be a string or null";
  }
  if (draft !== undefined && typeof draft !== "boolean") {
    return "draft must be a boolean";
  }
  return {
    title: title.trim(),
    date,
    summary: summary.trim(),
    tags: tags ?? [],
    cover: cover ?? null,
    draft: draft ?? false,
  };
}

/**
 * Which referenced images are missing from `available`.
 *
 * Run before the write, so a post naming an image that is not there is
 * rejected while `dist/` is still whole — the same guarantee `posts.test.ts`
 * enforces for the committed corpus.
 */
export function missingImages(
  body: string,
  cover: string | null,
  available: readonly string[],
): string[] {
  const present = new Set(available);
  return markdownImageSources(body, cover).filter(
    (source) => !present.has(imageKey(source)),
  );
}

function authorised(request: AdminRequest, deps: HandlerDeps): boolean {
  const cookie = parseCookies(request.headers.cookie).get(SESSION_COOKIE);
  return verifySession(cookie, deps.sessionSecret, deps.now());
}

async function login(request: AdminRequest, deps: HandlerDeps): Promise<AdminResponse> {
  const now = deps.now();
  const waitMs = deps.throttle.retryAfterMs(now);
  if (waitMs > 0) {
    return fail(429, "too many attempts", {
      "Retry-After": String(Math.ceil(waitMs / 1000)),
    });
  }
  const payload = readJson(request);
  const password = isRecord(payload) ? payload.password : undefined;
  if (typeof password !== "string" || !(await verifyPassword(password, deps.passwordHash))) {
    deps.throttle.recordFailure(now);
    // One message for a bad password and a malformed body alike: distinguishing
    // them tells an attacker which half they got right.
    return fail(401, "invalid credentials");
  }
  deps.throttle.recordSuccess();
  return json(200, { ok: true }, { "Set-Cookie": sessionCookieHeader(createSession(deps.sessionSecret, now)) });
}

async function savePost(
  slug: string,
  request: AdminRequest,
  deps: HandlerDeps,
): Promise<AdminResponse> {
  // Narrowed once rather than at each field: asking `isRecord` twice leaves a
  // second branch that the first check has already made unreachable.
  const payload = readJson(request);
  const fields: Readonly<Record<string, unknown>> = isRecord(payload) ? payload : {};
  const meta = readMeta(fields.meta);
  if (typeof meta === "string") {
    return fail(400, meta);
  }
  const body = fields.body;
  if (typeof body !== "string") {
    return fail(400, "body must be a string");
  }

  const existing = await readPost(deps.fs, deps.root, slug);
  const missing = missingImages(body, meta.cover, existing?.images ?? []);
  if (missing.length > 0) {
    return fail(400, `image not found next to the post: ${missing.join(", ")}`);
  }

  try {
    await writePost(deps.fs, deps.root, slug, meta, body);
  } catch (error) {
    return fail(400, reason(error, "could not write the post"));
  }
  const build = await deps.builder.build();
  return json(build.ok ? 200 : 500, {
    slug,
    built: build.ok,
    durationMs: build.durationMs,
    ...(build.ok ? {} : { output: build.output }),
  });
}

async function uploadImage(
  slug: string,
  request: AdminRequest,
  deps: HandlerDeps,
): Promise<AdminResponse> {
  const name = request.headers["x-filename"] ?? "";
  const problem = imageUploadProblem(name, request.body.byteLength);
  if (problem !== null) {
    return fail(400, problem);
  }
  await writeImage(deps.fs, deps.root, slug, name, request.body);
  return json(201, { name, markdown: `![](./${name})` });
}

async function serveImage(
  slug: string,
  name: string,
  deps: HandlerDeps,
): Promise<AdminResponse> {
  const bytes = await readImage(deps.fs, deps.root, slug, name);
  if (bytes === null) {
    return fail(404, "no such image");
  }
  return {
    status: 200,
    // Draft images change under a stable name while writing, so they must not
    // be cached; the published build serves content-hashed URLs instead.
    headers: {
      "Content-Type": imageContentType(name),
      "Cache-Control": "no-store",
    },
    body: bytes,
  };
}

async function route(request: AdminRequest, deps: HandlerDeps): Promise<AdminResponse> {
  const { method, path } = request;

  if (path === "/api/login") {
    return method === "POST" ? login(request, deps) : fail(405, "method not allowed");
  }

  const assetMatch = /^\/admin\/assets\/([^/]+)$/.exec(path);
  if (assetMatch) {
    if (method !== "GET") {
      return fail(405, "method not allowed");
    }
    const name = captured(assetMatch, 1);
    const bytes = isValidAssetName(name) ? await deps.adminAsset(name) : null;
    return bytes === null
      ? fail(404, "no such asset")
      : {
          status: 200,
          headers: {
            "Content-Type": assetContentType(name),
            // Content-hashed by the build, so this is safe to keep.
            "Cache-Control": "public, max-age=31536000, immutable",
          },
          body: bytes,
        };
  }

  if (path === "/admin" || path.startsWith("/admin/")) {
    return method === "GET"
      ? {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            // The editor must never be framed or indexed.
            "X-Frame-Options": "DENY",
            "X-Robots-Tag": "noindex, nofollow",
          },
          body: await deps.adminHtml(),
        }
      : fail(405, "method not allowed");
  }

  if (!authorised(request, deps)) {
    return fail(401, "authentication required");
  }

  if (path === "/api/logout") {
    return method === "POST"
      ? json(200, { ok: true }, { "Set-Cookie": sessionCookieHeader(null) })
      : fail(405, "method not allowed");
  }

  if (path === "/api/posts") {
    if (method !== "GET") {
      return fail(405, "method not allowed");
    }
    return json(200, { posts: await readAllPosts(deps.fs, deps.root) });
  }

  const imageMatch = /^\/api\/posts\/([^/]+)\/images\/([^/]+)$/.exec(path);
  if (imageMatch) {
    return method === "GET"
      ? serveImage(captured(imageMatch, 1), captured(imageMatch, 2), deps)
      : fail(405, "method not allowed");
  }

  const uploadMatch = /^\/api\/posts\/([^/]+)\/images$/.exec(path);
  if (uploadMatch) {
    return method === "POST"
      ? uploadImage(captured(uploadMatch, 1), request, deps)
      : fail(405, "method not allowed");
  }

  const postMatch = /^\/api\/posts\/([^/]+)$/.exec(path);
  if (postMatch) {
    const slug = captured(postMatch, 1);
    if (method === "GET") {
      const post = await readPost(deps.fs, deps.root, slug);
      return post === null ? fail(404, "no such post") : json(200, post);
    }
    if (method === "PUT") {
      return savePost(slug, request, deps);
    }
    if (method === "DELETE") {
      if ((await listSlugs(deps.fs, deps.root)).includes(slug)) {
        await deletePost(deps.fs, deps.root, slug);
        await deps.builder.build();
      }
      return json(200, { slug, deleted: true });
    }
    return fail(405, "method not allowed");
  }

  return fail(404, "not found");
}

/**
 * Handle one request.
 *
 * Wraps {@link route} so that any thrown error — an invalid slug reaching a
 * path builder, a filesystem failure — becomes a 400 rather than a stack trace
 * on the wire or a dead connection.
 */
export async function handleRequest(
  request: AdminRequest,
  deps: HandlerDeps,
): Promise<AdminResponse> {
  try {
    return await route(request, deps);
  } catch (error) {
    return fail(400, reason(error, "bad request"));
  }
}
