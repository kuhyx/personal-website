/**
 * The editor's network side: the JSON call helper and the offline-first sync.
 *
 * Offline first: every save and delete lands in {@link OfflineStore} before any
 * request goes out, so it shows at once and survives a reload. `syncer` pushes
 * the queue whenever the server answers and leaves the rest queued when it
 * does not -- the same contract as the todo app.
 */

import { opRequest, Unauthorised, type SaveResponse, type Tone } from "./editor-parts";
import { Offline, type OfflineStore, type PendingOp } from "./offline-store";

/** A JSON request to the admin API. */
export type Api = <T>(path: string, options?: RequestInit) => Promise<T>;

/** Report a state in the status line. */
export type Say = (text: string, tone?: Tone, figure?: string) => void;

/**
 * Build the JSON call helper.
 *
 * `fetch` rejects only when no answer came back at all (no network, server
 * down), so a rejection becomes {@link Offline} -- the one failure the sync
 * waits out instead of reporting. 401 calls `onUnauthorised` first, so the
 * caller can swap to the login form.
 */
export function apiClient(fetcher: typeof globalThis.fetch, onUnauthorised: () => void): Api {
  return async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    let response: Response;
    try {
      response = await fetcher(path, { credentials: "same-origin", ...options });
    } catch {
      throw new Offline("the server cannot be reached");
    }
    if (response.status === 401) {
      onUnauthorised();
      throw new Unauthorised("your session has expired");
    }
    const payload = ((await response.json()) as unknown) as Partial<{ error: string }> & T;
    if (!response.ok) {
      throw new Error(payload.error ?? `request failed (${String(response.status)})`);
    }
    return payload;
  };
}

/**
 * Build the sync step: send the queue oldest first, then tell the author where it stands.
 *
 * Still queued means offline (or a send failed and was re-thrown, which the
 * caller's guard reports). Everything sent means the server holds it all, so
 * the list is fetched again and the build time of the last save is shown.
 */
export function syncer(
  store: OfflineStore,
  api: Api,
  say: Say,
  refresh: () => Promise<void>,
): () => Promise<void> {
  const once = async (): Promise<void> => {
    // An object, not a `let`: the send callback assigns it, which a narrowed
    // `let` would hide from the checks below.
    const last: { ms: number | null } = { ms: null };
    const send = async (op: PendingOp): Promise<void> => {
      const result = await api<SaveResponse>(...opRequest(op));
      if (op.kind === "put") {
        last.ms = result.durationMs;
      }
    };
    const sent = await store.flush(send);
    if (store.pending().length > 0) {
      say("Saved on this device. It publishes when the server is reachable.", "offline");
      return;
    }
    if (sent === 0) {
      return;
    }
    await refresh();
    if (last.ms === null) {
      say("Published.");
      return;
    }
    const seconds = `${(last.ms / 1000).toFixed(1)}s`;
    say(`Saved and published in ${seconds}.`, "ok", seconds);
  };
  // Single flight: the retry timer, the online event and a save can all ask at
  // once, and two overlapping flushes would send the same op twice. A request
  // made mid-flush runs one more pass, so a save queued meanwhile still goes.
  // Fields, not `let`s, for the same narrowing reason as `last` above; `asks`
  // counts requests, so a pass knows whether one arrived while it ran.
  const flight: { running: Promise<void> | null; asks: number } = { running: null, asks: 0 };
  return () => {
    flight.asks += 1;
    if (flight.running !== null) {
      return flight.running;
    }
    flight.running = (async () => {
      try {
        let seen: number;
        do {
          seen = flight.asks;
          await once();
        } while (flight.asks !== seen);
      } finally {
        flight.running = null;
      }
    })();
    return flight.running;
  };
}
