// @vitest-environment node
import { describe, it, expect } from "vitest";
import { SESSION_COOKIE, createSession } from "./auth";
import { Builder } from "./builder";
import { handleRequest, type AdminRequest, type HandlerDeps } from "./handler";
import { MemoryFs } from "./memory-fs";
import { LoginThrottle } from "./rate-limit";
import { CONTENT_DIR, listImages } from "./store";

/**
 * An offline editor sends a new post's image before the post's first save:
 * the image waited in the queue ahead of the save that references it. The
 * save must find the image already beside it, though no post file exists yet.
 */
const SECRET = "session-secret";
const NOW = 1_700_000_000_000;
const ROOT = "/repo";

function deps(fs: MemoryFs): HandlerDeps {
  return {
    fs,
    root: ROOT,
    passwordHash: "unused",
    sessionSecret: SECRET,
    throttle: new LoginThrottle(),
    builder: new Builder(() => Promise.resolve({ code: 0, output: "" }), () => 0),
    now: () => NOW,
    adminHtml: () => Promise.resolve(""),
    adminAsset: () => Promise.resolve(null),
  };
}

function request(method: string, path: string, body: Uint8Array, headers: Record<string, string> = {}): AdminRequest {
  return { method, path, body, headers: { cookie: `${SESSION_COOKIE}=${createSession(SECRET, NOW)}`, ...headers } };
}

const meta = { title: "Trip", date: "2026-11-27", summary: "S" };

describe("saving a new post after its image", () => {
  it("accepts the image the post references", async () => {
    const d = deps(new MemoryFs({}));
    const upload = await handleRequest(
      request("POST", "/api/posts/trip/images", new Uint8Array([1, 2]), { "x-filename": "pixel.png" }), d);
    expect(upload.status).toBe(201);
    const save = await handleRequest(
      request("PUT", "/api/posts/trip", new TextEncoder().encode(JSON.stringify({ meta, body: "![](./pixel.png)" }))), d);
    expect(save.status).toBe(200);
  });
});

describe("listImages", () => {
  it("lists the images beside a post that has no post file yet", async () => {
    const fs = new MemoryFs({ [`${ROOT}/${CONTENT_DIR}/trip/pixel.png`]: "x" });
    expect(await listImages(fs, ROOT, "trip")).toEqual(["pixel.png"]);
  });

  it("is empty for a post directory that does not exist", async () => {
    expect(await listImages(new MemoryFs({}), ROOT, "nope")).toEqual([]);
  });
});
