/**
 * Rebuilding the site after a post changes.
 *
 * The three steps are the same ones `pnpm build` runs, minus `tsc`: writing a
 * post changes no types, and skipping the type check is what takes a save from
 * 2.4 s to roughly 0.6 s. Anything that *does* change types goes through the
 * normal build and CI, not through here.
 *
 * Builds are serialised. Two overlapping `vite build` runs share one `dist/`
 * and would interleave their output, so a second save waits for the first
 * rather than racing it.
 */

/** How a command is executed. Injected so the queue is testable without spawning. */
export type CommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<{ readonly code: number; readonly output: string }>;

/** The outcome of one rebuild. */
export interface BuildResult {
  readonly ok: boolean;
  readonly durationMs: number;
  /** Combined output, for showing the user why a failed build failed. */
  readonly output: string;
}

/** The steps a post-only change needs, in order. */
export const BUILD_STEPS: readonly (readonly [string, readonly string[]])[] = [
  ["node_modules/.bin/vite", ["build"]],
  [
    "node_modules/.bin/vite",
    ["build", "--ssr", "src/entry-server.tsx", "--outDir", "dist-ssr"],
  ],
  ["node", ["scripts/prerender.mjs"]],
];

/** Runs rebuilds one at a time. */
export class Builder {
  readonly #run: CommandRunner;
  readonly #now: () => number;
  #tail: Promise<unknown> = Promise.resolve();

  constructor(run: CommandRunner, now: () => number = Date.now) {
    this.#run = run;
    this.#now = now;
  }

  async #runSteps(): Promise<BuildResult> {
    const started = this.#now();
    const chunks: string[] = [];
    for (const [command, args] of BUILD_STEPS) {
      const { code, output } = await this.#run(command, args);
      chunks.push(output);
      if (code !== 0) {
        // Stop at the first failure: running prerender against a bundle that
        // did not build would report a second, misleading error.
        return {
          ok: false,
          durationMs: this.#now() - started,
          output: chunks.join("\n").trim(),
        };
      }
    }
    return {
      ok: true,
      durationMs: this.#now() - started,
      output: chunks.join("\n").trim(),
    };
  }

  /** Queue a rebuild behind any already running, and report its result. */
  build(): Promise<BuildResult> {
    const result = this.#tail.then(() => this.#runSteps());
    // The tail swallows rejections so one failed build cannot poison the queue
    // and block every save after it.
    this.#tail = result.catch(() => undefined);
    return result;
  }
}
