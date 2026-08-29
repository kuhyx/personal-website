// @vitest-environment node
import { describe, it, expect } from "vitest";
import { MAX_OUTPUT_CHARS, spawnRunner } from "./process";

// Real child processes, because the whole job of this module is the part a
// fake `spawn` would have to invent: exit codes, interleaved streams, ENOENT.
const run = spawnRunner(process.cwd());

describe("spawnRunner", () => {
  it("reports a zero exit code and stdout", async () => {
    const result = await run("node", ["-e", "process.stdout.write('out')"]);
    expect(result).toEqual({ code: 0, output: "out" });
  });

  it("captures stderr alongside stdout", async () => {
    const result = await run("node", ["-e", "process.stderr.write('boom')"]);
    expect(result.output).toBe("boom");
  });

  it("reports a non-zero exit code", async () => {
    expect((await run("node", ["-e", "process.exit(3)"])).code).toBe(3);
  });

  it("reports a missing command as a failure rather than throwing", async () => {
    const result = await run("definitely-not-a-command-xyz", []);
    expect(result.code).toBe(127);
    expect(result.output).not.toBe("");
  });

  it("passes arguments literally, with no shell in between", async () => {
    const result = await run("node", ["-e", "process.stdout.write(process.argv[1])", "$HOME; ls"]);
    expect(result.output).toBe("$HOME; ls");
  });

  it("reports a child killed by a signal as a failure, not as success", async () => {
    // `close` hands over a null code when a signal ended the process; treating
    // that as 0 would let a build the OOM killer stopped publish as "built".
    const result = await run("node", ["-e", "process.kill(process.pid, 'SIGKILL')"]);
    expect(result.code).toBe(1);
  });

  it("keeps the tail of oversized output and says it truncated", async () => {
    const size = MAX_OUTPUT_CHARS + 100;
    const result = await run("node", [
      "-e",
      `process.stdout.write("a".repeat(${String(size)}) + "END")`,
    ]);
    expect(result.output).toContain("truncated");
    expect(result.output.endsWith("END")).toBe(true);
    expect(result.output.length).toBeLessThan(size);
  });
});
