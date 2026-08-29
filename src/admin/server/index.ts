/**
 * The socket layer, and nothing else.
 *
 * Everything with a decision in it lives in `handler.ts` as a pure function of
 * a request record; this file only turns a Node request into that record and
 * the answer back into bytes. Keeping the split sharp is what lets the routes,
 * the auth gate and the traversal guards be tested without a live server.
 *
 * Each conversion step is exported separately rather than buried in the
 * `createServer` callback, so the awkward cases -- a request with no method, a
 * body that overruns the limit -- are reachable from a test without having to
 * manufacture a malformed socket.
 *
 * Nothing runs on import: `scripts/admin.mjs` is the executable entry point and
 * calls {@link main}.
 *
 * Bound to loopback by default. The editor is reached through an SSH tunnel or
 * through a TLS front, which matters: the session cookie is `Secure`, and a
 * browser silently discards those over plain http on anything but localhost --
 * you would log in successfully and then get 401 on every request after it.
 */

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hashPassword } from "./auth";
import { Builder } from "./builder";
import { readConfig, type AdminConfig } from "./config";
import { MAX_IMAGE_BYTES } from "./guards";
import { handleRequest, type AdminRequest, type AdminResponse, type HandlerDeps } from "./handler";
import { NodeFs } from "./node-fs";
import { spawnRunner } from "./process";
import { LoginThrottle } from "./rate-limit";

/** Repo-relative path of the editor document, as `pnpm build:admin` emits it. */
export const ADMIN_HTML = "dist-admin/client/index.html";
/** Where that build puts the page's bundle. */
export const ADMIN_ASSETS = "dist-admin/client/assets";

/** Bytes in a generated session secret; hex-encoded it clears MIN_SECRET_LENGTH. */
const SECRET_BYTES = 32;

/**
 * The largest body accepted, matching the image ceiling.
 *
 * Enforced while reading rather than only in `guards.ts`, because a size check
 * that runs after the whole upload is already in memory is decorative.
 */
export const MAX_BODY_BYTES = MAX_IMAGE_BYTES;

/** Raised when a request body exceeds {@link MAX_BODY_BYTES}. */
export class BodyTooLarge extends Error {}

/** What {@link send} needs of a `ServerResponse`. */
export interface ResponseSink {
  writeHead: (status: number, headers: Record<string, string>) => unknown;
  end: (body: Buffer) => unknown;
}

/**
 * Buffer a request body, refusing to hold more than the limit.
 *
 * Stops reading rather than destroying the connection: the caller still has to
 * write a 413, and a socket torn down mid-upload reaches the client as a
 * network error instead of an answer. Node dumps the unread remainder itself
 * once the response ends.
 */
export async function readBody(
  stream: AsyncIterable<Buffer | string>,
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
    total += buffer.byteLength;
    if (total > MAX_BODY_BYTES) {
      throw new BodyTooLarge();
    }
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** Write a response, always with an explicit length. */
export function send(sink: ResponseSink, answer: AdminResponse): void {
  const body =
    typeof answer.body === "string" ? Buffer.from(answer.body, "utf8") : Buffer.from(answer.body);
  sink.writeHead(answer.status, {
    ...answer.headers,
    "Content-Length": String(body.byteLength),
  });
  sink.end(body);
}

/** Reduce a Node request to the record the routes read. */
export function toAdminRequest(
  method: string | undefined,
  url: string | undefined,
  headers: Readonly<Record<string, string | undefined>>,
  body: Uint8Array,
): AdminRequest {
  const path = url ?? "/";
  const query = path.indexOf("?");
  return {
    method: method ?? "GET",
    path: query === -1 ? path : path.slice(0, query),
    headers,
    body,
  };
}

/**
 * The answer to a request that failed before routing.
 *
 * Anything that is not an overrun is this layer's own fault -- `handleRequest`
 * already turns every route-level failure into a 4xx of its own -- so it is a
 * 500 with no detail rather than an error string echoed back to the client.
 */
export function errorResponse(error: unknown): AdminResponse {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  return error instanceof BodyTooLarge
    ? {
        status: 413,
        headers,
        body: JSON.stringify({ error: `body is over the ${String(MAX_BODY_BYTES)} byte limit` }),
      }
    : { status: 500, headers, body: JSON.stringify({ error: "internal error" }) };
}

/** Assemble everything the routes depend on from a config. */
export function handlerDeps(config: AdminConfig): HandlerDeps {
  return {
    fs: new NodeFs(),
    root: config.root,
    passwordHash: config.passwordHash,
    sessionSecret: config.sessionSecret,
    throttle: new LoginThrottle(),
    builder: new Builder(spawnRunner(config.root)),
    now: Date.now,
    // Read per request rather than cached, so rebuilding the editor is visible
    // on reload without restarting the service.
    adminHtml: () => readFile(join(config.root, ADMIN_HTML), "utf8"),
    adminAsset: async (name) => {
      try {
        return new Uint8Array(await readFile(join(config.root, ADMIN_ASSETS, name)));
      } catch {
        // An asset that is not there means the editor was not built, which is
        // a 404 for that file rather than a failure of the whole request.
        return null;
      }
    },
  };
}

/** A running service, and the way to stop it. */
export interface RunningServer {
  close: () => Promise<void>;
}

/** Start the service. Resolves once it is accepting connections. */
export function serve(config: AdminConfig): Promise<RunningServer> {
  const deps = handlerDeps(config);
  const server = createServer((request, response) => {
    void (async () => {
      try {
        const body = await readBody(request);
        const headers = request.headers as Readonly<Record<string, string | undefined>>;
        send(response, await handleRequest(
          toAdminRequest(request.method, request.url, headers, body),
          deps,
        ));
      } catch (error) {
        send(response, errorResponse(error));
      }
    })();
  });
  return new Promise((resolve) => {
    server.listen(config.port, config.host, () => {
      process.stdout.write(
        `admin service on http://${config.host}:${String(config.port)}/admin\n`,
      );
      resolve({
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(() => { done(); });
          }),
      });
    });
  });
}

/** Read a password from stdin and print its hash, for provisioning. */
export async function hashFromStdin(
  stdin: AsyncIterable<Buffer | string>,
  out: (text: string) => void,
  fail: (text: string) => void,
): Promise<boolean> {
  const chunks: string[] = [];
  for await (const chunk of stdin) {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
  }
  const password = chunks.join("").trim();
  if (password === "") {
    fail("no password on stdin\n");
    return false;
  }
  out(`${await hashPassword(password)}\n`);
  return true;
}

/**
 * The command line: `hash-password`, `session-secret`, or run the service.
 *
 * Returns the running server so a caller -- the entry script in production, a
 * test otherwise -- can shut it down; null for the one-shot subcommands and
 * for a configuration that will not start.
 */
export async function main(argv: readonly string[]): Promise<RunningServer | null> {
  const out = (text: string): void => { process.stdout.write(text); };
  const fail = (text: string): void => {
    process.stderr.write(text);
    process.exitCode = 1;
  };

  if (argv[0] === "hash-password") {
    await hashFromStdin(process.stdin, out, fail);
    return null;
  }
  if (argv[0] === "session-secret") {
    out(`${randomBytes(SECRET_BYTES).toString("hex")}\n`);
    return null;
  }
  const config = readConfig(process.env, process.cwd());
  if (typeof config === "string") {
    fail(`${config}\n`);
    return null;
  }
  return serve(config);
}
