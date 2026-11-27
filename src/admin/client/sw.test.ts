import { describe, it, expect, vi } from "vitest";

/** The entry only hands the worker scope to `installShell`; this checks it does. */
describe("sw entry", () => {
  it("attaches the install, activate and fetch handlers to the global scope", async () => {
    const attach = vi.spyOn(globalThis, "addEventListener");
    await import("./sw");
    expect(attach.mock.calls.map(([type]) => type)).toEqual(["install", "activate", "fetch"]);
    attach.mockRestore();
  });
});
