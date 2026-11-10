/**
 * Rebuilding the site after a post changes.
 *
 * One step: `pnpm build`, the same command CI and a manual build run
 * (blog lint, `astro check`, `astro build`). The type check costs a few
 * seconds per save, and buys a rejected save instead of a site that built
 * from a post `astro check` would have caught.
 *
 * Builds are serialised. Two overlapping `astro build` runs share one `dist/`
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

/** The steps a post change needs, in order. */
export const BUILD_STEPS: readonly (readonly [string, readonly string[]])[] = [
  ["pnpm", ["build"]],
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
        // Stop at the first failure: a later step run against a build that
        // failed would report a second, misleading error.
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
