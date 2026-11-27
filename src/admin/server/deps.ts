/** What a route reads from a request, and everything the routes depend on. */

import type { Builder } from "./builder";
import type { LoginThrottle } from "./rate-limit";
import type { FileSystemPort } from "./store";

/** A request, reduced to what the routes actually read. */
export interface AdminRequest {
  readonly method: string;
  /** Pathname only, no query string. */
  readonly path: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: Uint8Array;
}

/** Everything the routes depend on, injected. */
export interface HandlerDeps {
  readonly fs: FileSystemPort;
  readonly root: string;
  readonly passwordHash: string;
  readonly sessionSecret: string;
  readonly throttle: LoginThrottle;
  readonly builder: Builder;
  readonly now: () => number;
  /**
   * The admin UI document.
   *
   * Served without a session, because it has to be: the login form is inside
   * it. It carries no post data -- every byte the editor shows arrives later
   * through `/api/*`, behind the gate.
   */
  readonly adminHtml: () => Promise<string>;
  /**
   * One built asset of the editor page, or null if there is no such file.
   *
   * Served beside the document and under the same reasoning: it is the shell,
   * not the content. Without it the page loads and does nothing, because the
   * bundle it imports is a 404.
   */
  readonly adminAsset: (name: string) => Promise<Uint8Array | null>;
}
