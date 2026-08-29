// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { Readable } from "node:stream";
import { createServer } from "node:net";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ADMIN_ASSETS,
  ADMIN_HTML,
  BodyTooLarge,
  MAX_BODY_BYTES,
  errorResponse,
  hashFromStdin,
  handlerDeps,
  main,
  readBody,
  send,
  serve,
  toAdminRequest,
} from "./index";
import { verifyPassword } from "./auth";
import type { AdminConfig } from "./config";

const SECRET = "s".repeat(40);
/** A hash of "letmein", precomputed: deriving one costs ~100 ms per test. */
const HASH =
  "scrypt$32768$8$1$b3b8bf3b1a5f4e2d9c0a7f6e5d4c3b2a$" +
  "0".repeat(128);

/** Ask the kernel for a port, then give it straight back. */
function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => { resolve(port); });
    });
  });
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pw-admin-index-"));
  await mkdir(join(root, dirname(ADMIN_HTML)), { recursive: true });
  await writeFile(join(root, ADMIN_HTML), "<html>editor</html>", "utf8");
  return root;
}

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
  vi.restoreAllMocks();
});

async function running(): Promise<{ base: string; root: string }> {
  const root = await tempRoot();
  const port = await freePort();
  const config: AdminConfig = {
    host: "127.0.0.1",
    port,
    root,
    passwordHash: HASH,
    sessionSecret: SECRET,
  };
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const server = await serve(config);
  cleanups.push(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${String(port)}`, root };
}

describe("readBody", () => {
  it("joins chunks, whatever type they arrive as", async () => {
    const body = await readBody(Readable.from([Buffer.from("ab"), "cd"]));
    expect(new TextDecoder().decode(body)).toBe("abcd");
  });

  it("is empty for an empty stream", async () => {
    expect(await readBody(Readable.from([]))).toEqual(new Uint8Array());
  });

  it("throws once the limit is passed, without reading the rest", async () => {
    const oversized = Readable.from([Buffer.alloc(MAX_BODY_BYTES), Buffer.alloc(1)]);
    await expect(readBody(oversized)).rejects.toBeInstanceOf(BodyTooLarge);
  });

  it("accepts a body of exactly the limit", async () => {
    const exact = Readable.from([Buffer.alloc(MAX_BODY_BYTES)]);
    expect((await readBody(exact)).byteLength).toBe(MAX_BODY_BYTES);
  });
});

describe("send", () => {
  it("writes a string body with its byte length, not its character count", () => {
    const sink = { writeHead: vi.fn(), end: vi.fn() };
    send(sink, { status: 200, headers: { "Content-Type": "text/plain" }, body: "€" });
    expect(sink.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "text/plain",
      "Content-Length": "3",
    });
    expect(sink.end).toHaveBeenCalledWith(Buffer.from("€", "utf8"));
  });

  it("writes a binary body unchanged", () => {
    const sink = { writeHead: vi.fn(), end: vi.fn() };
    const bytes = new Uint8Array([1, 2, 3]);
    send(sink, { status: 200, headers: {}, body: bytes });
    expect(sink.writeHead).toHaveBeenCalledWith(200, { "Content-Length": "3" });
    expect(sink.end).toHaveBeenCalledWith(Buffer.from(bytes));
  });
});

describe("toAdminRequest", () => {
  it("drops the query string", () => {
    const request = toAdminRequest("GET", "/api/posts?draft=1", {}, new Uint8Array());
    expect(request.path).toBe("/api/posts");
  });

  it("keeps a path that has no query string", () => {
    expect(toAdminRequest("GET", "/admin", {}, new Uint8Array()).path).toBe("/admin");
  });

  it("defaults a request with neither method nor url", () => {
    const request = toAdminRequest(undefined, undefined, {}, new Uint8Array());
    expect(request).toMatchObject({ method: "GET", path: "/" });
  });
});

describe("errorResponse", () => {
  it("answers an overrun with 413 and the limit", () => {
    const response = errorResponse(new BodyTooLarge());
    expect(response.status).toBe(413);
    expect(String(response.body)).toContain(String(MAX_BODY_BYTES));
  });

  it("answers anything else with a 500 that leaks nothing", () => {
    const response = errorResponse(new Error("ENOENT /etc/shadow"));
    expect(response.status).toBe(500);
    expect(String(response.body)).not.toContain("shadow");
  });
});

describe("handlerDeps", () => {
  it("reads the editor document from the configured root", async () => {
    const root = await tempRoot();
    cleanups.push(() => rm(root, { recursive: true, force: true }));
    const deps = handlerDeps({
      host: "127.0.0.1",
      port: 1,
      root,
      passwordHash: HASH,
      sessionSecret: SECRET,
    });
    expect(await deps.adminHtml()).toBe("<html>editor</html>");
    expect(deps.root).toBe(root);
  });

  it("reads a built asset, and answers null for one that was never built", async () => {
    const root = await tempRoot();
    cleanups.push(() => rm(root, { recursive: true, force: true }));
    await mkdir(join(root, ADMIN_ASSETS), { recursive: true });
    await writeFile(join(root, ADMIN_ASSETS, "index-abc.js"), "boot()", "utf8");
    const deps = handlerDeps({
      host: "127.0.0.1",
      port: 1,
      root,
      passwordHash: HASH,
      sessionSecret: SECRET,
    });
    const bytes = await deps.adminAsset("index-abc.js");
    expect(bytes === null ? "" : new TextDecoder().decode(bytes)).toBe("boot()");
    expect(await deps.adminAsset("index-missing.js")).toBeNull();
  });
});

describe("a listening service", () => {
  it("serves the editor document", async () => {
    const { base } = await running();
    const response = await fetch(`${base}/admin`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(await response.text()).toBe("<html>editor</html>");
  });

  it("serves the bundle at the URL the page actually asks for", async () => {
    // Built for real, then resolved the way a browser resolves it. Fetching a
    // hand-built /admin/assets/<name> instead is what let a page whose script
    // 404s pass as working: the reference has to come from the document.
    const root = await tempRoot();
    const port = await freePort();
    await mkdir(join(root, ADMIN_ASSETS), { recursive: true });
    await writeFile(join(root, ADMIN_ASSETS, "index-abc.js"), "boot()", "utf8");
    await writeFile(
      join(root, ADMIN_HTML),
      '<html><body><script type="module" src="/admin/assets/index-abc.js"></script></body></html>',
      "utf8",
    );
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const server = await serve({
      host: "127.0.0.1",
      port,
      root,
      passwordHash: HASH,
      sessionSecret: SECRET,
    });
    cleanups.push(async () => {
      await server.close();
      await rm(root, { recursive: true, force: true });
    });

    const base = `http://127.0.0.1:${String(port)}`;
    const page = await fetch(`${base}/admin`);
    const src = /src="([^"]+)"/.exec(await page.text())?.[1] ?? "";
    const script = await fetch(new URL(src, `${base}/admin`));
    expect(script.status).toBe(200);
    expect(await script.text()).toBe("boot()");
  });

  it("gates the API and ignores the query string while doing it", async () => {
    const { base } = await running();
    const response = await fetch(`${base}/api/posts?tag=meta`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "authentication required" });
  });

  it("answers an unknown path with the auth challenge, not a route listing", async () => {
    // The 404 lives behind the gate on purpose: an anonymous client learns
    // nothing about which paths exist.
    const { base } = await running();
    expect((await fetch(`${base}/nope`)).status).toBe(401);
  });

  it("refuses a body over the limit with 413", async () => {
    const { base } = await running();
    const response = await fetch(`${base}/api/login`, {
      method: "POST",
      body: Buffer.alloc(MAX_BODY_BYTES + 1024),
    });
    expect(response.status).toBe(413);
  });

  it("stops answering once it is closed", async () => {
    const { base } = await running();
    for (const cleanup of cleanups.splice(0)) {
      await cleanup();
    }
    await expect(fetch(`${base}/admin`)).rejects.toThrow();
  });
});

describe("hashFromStdin", () => {
  it("prints a hash that verifies against the password it read", async () => {
    const written: string[] = [];
    const ok = await hashFromStdin(
      Readable.from(["hunter2\n"]),
      (text) => written.push(text),
      () => { throw new Error("should not fail"); },
    );
    expect(ok).toBe(true);
    expect(await verifyPassword("hunter2", written.join("").trim())).toBe(true);
  });

  it("refuses an empty stdin rather than hashing the empty string", async () => {
    const failures: string[] = [];
    const ok = await hashFromStdin(
      Readable.from([Buffer.from("   \n")]),
      () => { throw new Error("should not print"); },
      (text) => failures.push(text),
    );
    expect(ok).toBe(false);
    expect(failures.join("")).toMatch(/no password/);
  });
});

describe("main", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    process.exitCode = 0;
  });

  it("hashes a password from stdin", async () => {
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process, "stdin", "get").mockReturnValue(
      Readable.from(["s3cret"]) as unknown as typeof process.stdin,
    );
    expect(await main(["hash-password"])).toBeNull();
    expect(String(out.mock.calls[0]?.[0])).toMatch(/^scrypt\$/);
  });

  it("prints a session secret long enough for the config gate to accept", async () => {
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await main(["session-secret"])).toBeNull();
    expect(String(out.mock.calls[0]?.[0]).trim()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses to start without secrets, and says which one is missing", async () => {
    const errors = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    delete process.env.PW_ADMIN_PASSWORD_HASH;
    delete process.env.PW_ADMIN_SESSION_SECRET;
    expect(await main([])).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(String(errors.mock.calls[0]?.[0])).toMatch(/PW_ADMIN_PASSWORD_HASH/);
  });

  it("starts a server when the environment is complete", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const port = await freePort();
    process.env.PW_ADMIN_PASSWORD_HASH = HASH;
    process.env.PW_ADMIN_SESSION_SECRET = SECRET;
    process.env.PW_ADMIN_PORT = String(port);
    const server = await main([]);
    expect(server).not.toBeNull();
    expect((await fetch(`http://127.0.0.1:${String(port)}/api/posts`)).status).toBe(401);
    await server?.close();
  });
});
