// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { BUILD_STEPS, Builder, type CommandRunner } from "./builder";

function clock(): () => number {
  let time = 0;
  return () => (time += 100);
}

describe("Builder", () => {
  it("runs every step in order and reports success", async () => {
    const seen: string[] = [];
    const run: CommandRunner = (command, args) => {
      seen.push(`${command} ${args.join(" ")}`);
      return Promise.resolve({ code: 0, output: "ok" });
    };
    const result = await new Builder(run, clock()).build();
    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(BUILD_STEPS.length);
    expect(seen[0]).toContain("vite build");
    expect(seen[2]).toContain("prerender.mjs");
  });

  it("measures how long the build took", async () => {
    const run: CommandRunner = () => Promise.resolve({ code: 0, output: "" });
    // clock() advances 100 ms per read: one at start, one at end.
    expect((await new Builder(run, clock()).build()).durationMs).toBe(100);
  });

  it("stops at the first failing step and keeps its output", async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValueOnce({ code: 1, output: "boom" });
    const result = await new Builder(run, clock()).build();
    expect(result.ok).toBe(false);
    expect(result.output).toBe("boom");
    // Running prerender against a bundle that never built would report a
    // second error that hides the real one.
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("collects output from every step it ran", async () => {
    const run: CommandRunner = () => Promise.resolve({ code: 0, output: "line" });
    expect((await new Builder(run, clock()).build()).output).toBe("line\nline\nline");
  });

  it("serialises overlapping builds instead of interleaving them", async () => {
    let active = 0;
    let maxActive = 0;
    const run: CommandRunner = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return { code: 0, output: "" };
    };
    const builder = new Builder(run, clock());
    await Promise.all([builder.build(), builder.build(), builder.build()]);
    expect(maxActive).toBe(1);
  });

  it("keeps working after a step throws", async () => {
    const run = vi
      .fn<CommandRunner>()
      .mockRejectedValueOnce(new Error("spawn failed"))
      .mockResolvedValue({ code: 0, output: "" });
    const builder = new Builder(run, clock());
    await expect(builder.build()).rejects.toThrow("spawn failed");
    // A poisoned queue would leave every later save hanging or failing.
    expect((await builder.build()).ok).toBe(true);
  });
});
