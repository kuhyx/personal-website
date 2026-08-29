/**
 * The real {@link CommandRunner}, on `node:child_process`.
 *
 * stdout and stderr are merged in arrival order into one string, because that
 * is what a failed `vite build` looks like to a human: the error line only
 * makes sense next to the step that printed it. `Builder` hands this straight
 * back to the editor as the reason a save did not publish.
 */

import { spawn } from "node:child_process";
import type { CommandRunner } from "./builder";

/** How much command output to keep. Enough for a stack, not for a log file. */
export const MAX_OUTPUT_CHARS = 20000;

/** Keep the tail: the error that stopped the build is at the end. */
function clamp(output: string): string {
  return output.length <= MAX_OUTPUT_CHARS
    ? output
    : `...(truncated)\n${output.slice(-MAX_OUTPUT_CHARS)}`;
}

/** Run commands in `cwd`, capturing their combined output. */
export function spawnRunner(cwd: string): CommandRunner {
  return (command, args) =>
    new Promise((resolve) => {
      const child = spawn(command, [...args], {
        cwd,
        // No shell: arguments stay arguments, so nothing here can ever be
        // interpreted as a command even if BUILD_STEPS grows.
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const chunks: string[] = [];
      const collect = (chunk: Buffer): void => {
        chunks.push(chunk.toString("utf8"));
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);
      child.on("error", (error: Error) => {
        resolve({ code: 127, output: clamp(`${chunks.join("")}${error.message}`) });
      });
      child.on("close", (code: number | null) => {
        resolve({ code: code ?? 1, output: clamp(chunks.join("")) });
      });
    });
}
