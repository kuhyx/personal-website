// @vitest-environment node
import { describe, it, expect } from "vitest";
import { MemoryFs } from "./memory-fs";
import { Builder } from "./builder";
import { LoginThrottle, MAX_ATTEMPTS } from "./rate-limit";
import { SESSION_COOKIE, createSession, hashPassword, sessionCookieHeader } from "./auth";
import { CONTENT_DIR, POST_FILE } from "./store";
import {
  handleRequest,
  missingImages,
  readMeta,
  reason,
  type AdminRequest,
  type AdminResponse,
  type HandlerDeps,
} from "./handler";

const ROOT = "/repo";
const BASE = `${ROOT}/${CONTENT_DIR}`;
const SECRET = "session-secret";
const PASSWORD = "hunter2";
const NOW = 1_700_000_000_000;

// Hashed once: scrypt is deliberately slow, and every test needs the same hash.
const passwordHash = await hashPassword(PASSWORD);

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    fs: new MemoryFs({
      [`${BASE}/hello/${POST_FILE}`]: `---\ntitle: Hello\ndate: 2026-08-29\nsummary: s\n---\n\nBody.`,
      [`${BASE}/hello/a.png`]: "bytes",
    }),
    root: ROOT,
    passwordHash,
    sessionSecret: SECRET,
    throttle: new LoginThrottle(),
    builder: new Builder(() => Promise.resolve({ code: 0, output: "" }), () => 0),
    now: () => NOW,
    adminHtml: () => Promise.resolve("<html>editor</html>"),
    adminAsset: (name) =>
      Promise.resolve(name === "app.js" ? new TextEncoder().encode("boot()") : null),
    ...overrides,
  };
}

function request(overrides: Partial<AdminRequest> = {}): AdminRequest {
  return {
    method: "GET",
    path: "/api/posts",
    headers: { cookie: `${SESSION_COOKIE}=${createSession(SECRET, NOW)}` },
    body: new Uint8Array(),
    ...overrides,
  };
}

function encode(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function parse(response: AdminResponse): Record<string, unknown> {
  return JSON.parse(String(response.body)) as Record<string, unknown>;
}

describe("authentication gate", () => {
  it.each([
    "/api/posts",
    "/api/posts/hello",
    "/api/posts/hello/images",
    "/api/posts/hello/images/a.png",
    "/api/logout",
  ])("refuses %s with no cookie", async (path) => {
    const response = await handleRequest(request({ path, headers: {} }), makeDeps());
    expect(response.status).toBe(401);
  });

  it("refuses a session signed with another secret", async () => {
    const forged = `${SESSION_COOKIE}=${createSession("other", NOW)}`;
    const response = await handleRequest(
      request({ headers: { cookie: forged } }),
      makeDeps(),
    );
    expect(response.status).toBe(401);
  });

  it("refuses an expired session", async () => {
    const response = await handleRequest(request(), makeDeps({ now: () => NOW + 1e12 }));
    expect(response.status).toBe(401);
  });

  it("serves the editor document with no cookie, since it holds the login form", async () => {
    const response = await handleRequest(request({ path: "/admin", headers: {} }), makeDeps());
    expect(response.status).toBe(200);
    expect(String(response.body)).toContain("editor");
  });

  it("puts no post data in the document it serves unauthenticated", async () => {
    // The shell being public is only acceptable while it stays a shell: every
    // byte of content has to arrive later, through the gated /api routes.
    const response = await handleRequest(request({ path: "/admin", headers: {} }), makeDeps());
    const listing = await handleRequest(request({ path: "/api/posts", headers: {} }), makeDeps());
    expect(String(response.body)).not.toContain("hello");
    expect(listing.status).toBe(401);
  });
});

describe("login", () => {
  it("sets a hardened session cookie for the right password", async () => {
    const response = await handleRequest(
      request({ method: "POST", path: "/api/login", headers: {}, body: encode({ password: PASSWORD }) }),
      makeDeps(),
    );
    expect(response.status).toBe(200);
    expect(response.headers["Set-Cookie"]).toContain("HttpOnly");
    expect(response.headers["Set-Cookie"]).toContain("SameSite=Strict");
  });

  it.each([
    ["a wrong password", encode({ password: "nope" })],
    ["a missing password", encode({})],
    ["a non-string password", encode({ password: 42 })],
    ["malformed JSON", new TextEncoder().encode("{not json")],
  ])("rejects %s with one indistinguishable message", async (_label, body) => {
    const response = await handleRequest(
      request({ method: "POST", path: "/api/login", headers: {}, body }),
      makeDeps(),
    );
    expect(response.status).toBe(401);
    expect(parse(response).error).toBe("invalid credentials");
  });

  it("locks out after repeated failures and reports Retry-After", async () => {
    const deps = makeDeps();
    const bad = request({ method: "POST", path: "/api/login", headers: {}, body: encode({ password: "no" }) });
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await handleRequest(bad, deps);
    }
    const locked = await handleRequest(bad, deps);
    expect(locked.status).toBe(429);
    expect(locked.headers["Retry-After"]).toBeDefined();
  });

  it("rejects a non-POST login", async () => {
    const response = await handleRequest(request({ path: "/api/login", headers: {} }), makeDeps());
    expect(response.status).toBe(405);
  });
});

describe("logout", () => {
  it("clears the cookie", async () => {
    const response = await handleRequest(
      request({ method: "POST", path: "/api/logout" }),
      makeDeps(),
    );
    expect(response.headers["Set-Cookie"]).toBe(sessionCookieHeader(null));
  });

  it("rejects a non-POST logout", async () => {
    const response = await handleRequest(request({ path: "/api/logout" }), makeDeps());
    expect(response.status).toBe(405);
  });
});

describe("reading posts", () => {
  it("lists them", async () => {
    const response = await handleRequest(request(), makeDeps());
    expect(response.status).toBe(200);
    expect(parse(response).posts).toHaveLength(1);
  });

  it("reads one", async () => {
    const response = await handleRequest(request({ path: "/api/posts/hello" }), makeDeps());
    expect((parse(response).meta as PostMetaLike).title).toBe("Hello");
  });

  it("404s an unknown slug", async () => {
    const response = await handleRequest(request({ path: "/api/posts/nope" }), makeDeps());
    expect(response.status).toBe(404);
  });

  it("rejects a non-GET list", async () => {
    const response = await handleRequest(request({ method: "POST" }), makeDeps());
    expect(response.status).toBe(405);
  });

  it("rejects an unsupported method on a post", async () => {
    const response = await handleRequest(
      request({ method: "PATCH", path: "/api/posts/hello" }),
      makeDeps(),
    );
    expect(response.status).toBe(405);
  });
});

interface PostMetaLike {
  readonly title: string;
}

describe("saving a post", () => {
  const meta = { title: "New", date: "2026-08-29", summary: "s" };

  function put(body: unknown, path = "/api/posts/hello"): AdminRequest {
    return request({ method: "PUT", path, body: encode(body) });
  }

  it("writes it and rebuilds", async () => {
    const deps = makeDeps();
    const response = await handleRequest(put({ meta, body: "New body." }), deps);
    expect(response.status).toBe(200);
    expect(parse(response).built).toBe(true);
  });

  it("reports a failed build without claiming success", async () => {
    const deps = makeDeps({
      builder: new Builder(() => Promise.resolve({ code: 1, output: "boom" }), () => 0),
    });
    const response = await handleRequest(put({ meta, body: "New body." }), deps);
    expect(response.status).toBe(500);
    expect(parse(response).built).toBe(false);
    expect(parse(response).output).toBe("boom");
  });

  it.each([
    ["a missing title", { meta: { ...meta, title: "" }, body: "b" }, /title is required/],
    ["a missing date", { meta: { title: "t", summary: "s" }, body: "b" }, /date is required/],
    ["a missing summary", { meta: { title: "t", date: "2026-01-01" }, body: "b" }, /summary is required/],
    ["bad tags", { meta: { ...meta, tags: [1] }, body: "b" }, /tags must be/],
    ["a bad cover", { meta: { ...meta, cover: 5 }, body: "b" }, /cover must be/],
    ["a bad draft flag", { meta: { ...meta, draft: "yes" }, body: "b" }, /draft must be/],
    ["a non-object meta", { meta: "nope", body: "b" }, /must be a JSON object/],
    ["a non-string body", { meta, body: 42 }, /body must be a string/],
    ["a bad date format", { meta: { ...meta, date: "29-08-2026" }, body: "b" }, /YYYY-MM-DD/],
  ])("rejects %s", async (_label, payload, expected) => {
    const response = await handleRequest(put(payload), makeDeps());
    expect(response.status).toBe(400);
    expect(String(parse(response).error)).toMatch(expected);
  });

  it("rejects a body referencing an image that is not there, before writing", async () => {
    const deps = makeDeps();
    const response = await handleRequest(
      put({ meta, body: "![x](./missing.png)" }),
      deps,
    );
    expect(response.status).toBe(400);
    expect(String(parse(response).error)).toContain("missing.png");
    // The post file must be untouched: a rejected save cannot half-build dist/.
    expect(await deps.fs.readText(`${BASE}/hello/${POST_FILE}`)).toContain("Body.");
  });

  it("accepts a body referencing an image that is there", async () => {
    const response = await handleRequest(put({ meta, body: "![a](./a.png)" }), makeDeps());
    expect(response.status).toBe(200);
  });

  it("rejects a traversing slug", async () => {
    const response = await handleRequest(put({ meta, body: "b" }, "/api/posts/..%2F..%2Fetc"), makeDeps());
    expect(response.status).toBe(400);
  });
});

describe("deleting a post", () => {
  it("removes it and rebuilds", async () => {
    const deps = makeDeps();
    const response = await handleRequest(
      request({ method: "DELETE", path: "/api/posts/hello" }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(await deps.fs.exists(`${BASE}/hello/${POST_FILE}`)).toBe(false);
  });

  it("is a no-op for a slug that does not exist", async () => {
    const response = await handleRequest(
      request({ method: "DELETE", path: "/api/posts/nope" }),
      makeDeps(),
    );
    expect(response.status).toBe(200);
  });
});

describe("images", () => {
  it("uploads one and returns the markdown to paste", async () => {
    const deps = makeDeps();
    const response = await handleRequest(
      request({
        method: "POST",
        path: "/api/posts/hello/images",
        headers: {
          cookie: `${SESSION_COOKIE}=${createSession(SECRET, NOW)}`,
          "x-filename": "shot.png",
        },
        body: new Uint8Array([1, 2, 3]),
      }),
      deps,
    );
    expect(response.status).toBe(201);
    expect(parse(response).markdown).toBe("![](./shot.png)");
    expect(await deps.fs.exists(`${BASE}/hello/shot.png`)).toBe(true);
  });

  it.each([
    ["a traversing filename", "../../x.png", new Uint8Array([1])],
    ["a disallowed extension", "x.exe", new Uint8Array([1])],
    ["a missing filename", undefined, new Uint8Array([1])],
    ["an empty body", "x.png", new Uint8Array()],
  ])("rejects %s", async (_label, filename, body) => {
    const deps = makeDeps();
    const response = await handleRequest(
      request({
        method: "POST",
        path: "/api/posts/hello/images",
        headers: {
          cookie: `${SESSION_COOKIE}=${createSession(SECRET, NOW)}`,
          ...(filename === undefined ? {} : { "x-filename": filename }),
        },
        body,
      }),
      deps,
    );
    expect(response.status).toBe(400);
  });

  it("serves one back with its media type and no caching", async () => {
    const response = await handleRequest(
      request({ path: "/api/posts/hello/images/a.png" }),
      makeDeps(),
    );
    expect(response.status).toBe(200);
    expect(response.headers["Content-Type"]).toBe("image/png");
    expect(response.headers["Cache-Control"]).toBe("no-store");
  });

  it("404s an image that is not there", async () => {
    const response = await handleRequest(
      request({ path: "/api/posts/hello/images/gone.png" }),
      makeDeps(),
    );
    expect(response.status).toBe(404);
  });

  it("rejects a non-GET image fetch and a non-POST upload", async () => {
    expect(
      (await handleRequest(request({ method: "PUT", path: "/api/posts/hello/images/a.png" }), makeDeps())).status,
    ).toBe(405);
    expect(
      (await handleRequest(request({ method: "GET", path: "/api/posts/hello/images" }), makeDeps())).status,
    ).toBe(405);
  });
});

describe("the editor document", () => {
  it("is served to an authenticated request, unindexed and unframeable", async () => {
    const response = await handleRequest(request({ path: "/admin" }), makeDeps());
    expect(response.status).toBe(200);
    expect(String(response.body)).toContain("editor");
    expect(response.headers["X-Robots-Tag"]).toContain("noindex");
    expect(response.headers["X-Frame-Options"]).toBe("DENY");
  });

  it("serves a built asset with a long cache and the right type", async () => {
    const response = await handleRequest(
      request({ path: "/admin/assets/app.js", headers: {} }),
      makeDeps(),
    );
    expect(response.status).toBe(200);
    expect(response.headers["Content-Type"]).toMatch(/javascript/);
    expect(response.headers["Cache-Control"]).toContain("immutable");
    expect(new TextDecoder().decode(response.body as Uint8Array)).toBe("boot()");
  });

  it("404s an asset that is not there rather than falling through to the page", async () => {
    const response = await handleRequest(
      request({ path: "/admin/assets/missing.js", headers: {} }),
      makeDeps(),
    );
    expect(response.status).toBe(404);
  });

  it.each(["../../../etc/passwd", "app.sh", "app"])(
    "refuses the asset name %s without asking the filesystem",
    async (name) => {
      const asked: string[] = [];
      const response = await handleRequest(
        request({ path: `/admin/assets/${encodeURIComponent(name)}`, headers: {} }),
        makeDeps({
          adminAsset: (asset) => {
            asked.push(asset);
            return Promise.resolve(new Uint8Array());
          },
        }),
      );
      expect(response.status).toBe(404);
      expect(asked).toEqual([]);
    },
  );

  it("serves an editor stylesheet as CSS", async () => {
    const response = await handleRequest(
      request({ path: "/admin/assets/app.css", headers: {} }),
      makeDeps({ adminAsset: () => Promise.resolve(new Uint8Array([1])) }),
    );
    expect(response.headers["Content-Type"]).toMatch(/text\/css/);
  });

  it("refuses a non-GET on an asset", async () => {
    const response = await handleRequest(
      request({ method: "POST", path: "/admin/assets/app.js", headers: {} }),
      makeDeps(),
    );
    expect(response.status).toBe(405);
  });

  it("serves client routes under /admin/ too", async () => {
    const response = await handleRequest(request({ path: "/admin/preview/hello" }), makeDeps());
    expect(response.status).toBe(200);
  });

  it("rejects a non-GET", async () => {
    const response = await handleRequest(request({ method: "POST", path: "/admin" }), makeDeps());
    expect(response.status).toBe(405);
  });
});

describe("unknown routes and failures", () => {
  it("404s anything else", async () => {
    const response = await handleRequest(request({ path: "/api/nope" }), makeDeps());
    expect(response.status).toBe(404);
  });

  it("turns a thrown error into a 400 rather than a dead connection", async () => {
    // Seeded so listSlugs gets past its exists() check and actually reaches
    // listDir; an empty fake would short-circuit and never throw.
    const fs = new MemoryFs({ [`${BASE}/hello/${POST_FILE}`]: "x" });
    fs.listDir = () => Promise.reject(new Error("disk on fire"));
    const response = await handleRequest(request(), makeDeps({ fs }));
    expect(response.status).toBe(400);
    expect(parse(response).error).toBe("disk on fire");
  });

  it("reports a non-Error throw safely", async () => {
    const fs = new MemoryFs({ [`${BASE}/hello/${POST_FILE}`]: "x" });
    // Typed unknown, not a literal: the point of the test is a library that
    // rejects with something that is not an Error, which is exactly what the
    // handler's `instanceof Error` fallback exists for.
    const notAnError: unknown = "just a string";
    fs.listDir = () => {
      throw notAnError;
    };
    const response = await handleRequest(request(), makeDeps({ fs }));
    expect(parse(response).error).toBe("bad request");
  });
});

describe("readMeta", () => {
  it("defaults the optional fields", () => {
    const meta = readMeta({ title: " T ", date: "2026-01-01", summary: " S " });
    expect(meta).toEqual({
      title: "T",
      date: "2026-01-01",
      summary: "S",
      tags: [],
      cover: null,
      draft: false,
    });
  });

  it("rejects an array, which is an object but not a record", () => {
    expect(readMeta([])).toBe("body must be a JSON object");
  });
});

describe("missingImages", () => {
  it("ignores remote images", () => {
    expect(missingImages("![a](https://x/y.png)", null, [])).toEqual([]);
  });

  it("reports a missing cover as well as a missing body image", () => {
    expect(missingImages("![a](./a.png)", "./c.png", []).sort()).toEqual(["./a.png", "./c.png"]);
  });

  it("accepts references with and without the ./ prefix", () => {
    expect(missingImages("![a](./a.png) ![b](b.png)", null, ["a.png", "b.png"])).toEqual([]);
  });
});

describe("saving a post the awkward ways", () => {
  const put = (body: string, slug = "hello", overrides: Partial<HandlerDeps> = {}) =>
    handleRequest(
      request({ method: "PUT", path: `/api/posts/${slug}`, body: new TextEncoder().encode(body) }),
      makeDeps(overrides),
    );

  it.each(["[1, 2]", '"a string"', "null", "17"])(
    "refuses a body that is not a JSON object: %s",
    async (payload) => {
      const response = await put(payload);
      expect(response.status).toBe(400);
    },
  );

  it("refuses a payload whose meta is missing entirely", async () => {
    const response = await put(JSON.stringify({ body: "text" }));
    expect(parse(response).error).toBe("body must be a JSON object");
  });

  it("creates a post at a slug that does not exist yet", async () => {
    const meta = { title: "Fresh", date: "2026-08-29", summary: "New." };
    const response = await put(JSON.stringify({ meta, body: "Prose." }), "fresh");
    expect(response.status).toBe(200);
    expect(parse(response).slug).toBe("fresh");
  });

  it("refuses an image reference on a post that has no directory yet", async () => {
    const meta = { title: "Fresh", date: "2026-08-29", summary: "New." };
    const response = await put(
      JSON.stringify({ meta, body: "![](./nope.png)" }),
      "fresh",
    );
    expect(parse(response).error).toMatch(/image not found/);
  });

  it("reports a filesystem failure as a 400 with its message", async () => {
    const fs = new MemoryFs();
    const meta = { title: "Fresh", date: "2026-08-29", summary: "New." };
    const response = await put(JSON.stringify({ meta, body: "Prose." }), "fresh", {
      fs: {
        readText: (path) => fs.readText(path),
        readBytes: (path) => fs.readBytes(path),
        writeBytes: (path, data) => fs.writeBytes(path, data),
        mkdirp: (path) => fs.mkdirp(path),
        listDir: (path) => fs.listDir(path),
        removeDir: (path) => fs.removeDir(path),
        exists: (path) => fs.exists(path),
        writeText: () => Promise.reject(new Error("EACCES: permission denied")),
      },
    });
    expect(response.status).toBe(400);
    expect(parse(response).error).toBe("EACCES: permission denied");
  });
});

describe("reason", () => {
  it("uses an Error's own message", () => {
    expect(reason(new Error("EACCES"), "fallback")).toBe("EACCES");
  });

  it("falls back for anything that is not an Error", () => {
    expect(reason("a string", "could not write the post")).toBe("could not write the post");
    expect(reason(undefined, "bad request")).toBe("bad request");
  });
});
