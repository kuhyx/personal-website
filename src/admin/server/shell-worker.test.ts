import { describe, it, expect } from "vitest";
import { handleRequest, type HandlerDeps } from "./handler";

/**
 * The editor's service worker is a built asset like any other, but the
 * browser only lets it control `/admin` -- one level above its own folder --
 * when the response says so, and it must be re-checked on every load.
 */
const deps = {
  adminAsset: (name: string) => Promise.resolve(name === "sw.js" ? new Uint8Array([1]) : null),
} as unknown as HandlerDeps;

describe("the editor's service worker", () => {
  it("is allowed to control the whole editor, not only its own folder", async () => {
    const response = await handleRequest({ method: "GET", path: "/admin/assets/sw.js", headers: {}, body: new Uint8Array() }, deps);
    expect(response.status).toBe(200);
    expect(response.headers["Service-Worker-Allowed"]).toBe("/admin");
    expect(response.headers["Content-Type"]).toMatch(/javascript/);
  });

  it("is revalidated on every load, unlike the hashed assets", async () => {
    const response = await handleRequest({ method: "GET", path: "/admin/assets/sw.js", headers: {}, body: new Uint8Array() }, deps);
    expect(response.headers["Cache-Control"]).toBe("no-cache");
  });
});
