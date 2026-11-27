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
import {
  SESSION_COOKIE,
  createSession,
  parseCookies,
  sessionCookieHeader,
  verifyPassword,
  verifySession,
} from "./auth";
import type { AdminRequest, HandlerDeps } from "./deps";
import { imageContentType, imageUploadProblem } from "./guards";
import { fail, json, type AdminResponse } from "./responses";
import { shellRoute } from "./shell-routes";
import { isRecord, missingImages, readJson, reason, readMeta } from "./validate";
import {
  deletePost,
  listImages,
  listSlugs,
  readAllPosts,
  readImage,
  readPost,
  writeImage,
  writePost,
} from "./store";

export { missingImages, readMeta, reason } from "./validate";

export type { AdminRequest, HandlerDeps } from "./deps";
export type { AdminResponse } from "./responses";

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

  const missing = missingImages(body, meta.cover, await listImages(deps.fs, deps.root, slug));
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

  const shell = await shellRoute(request, deps);
  if (shell !== null) {
    return shell;
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
