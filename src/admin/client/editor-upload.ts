/**
 * The editor's offline-first pieces that are not saves: a picked image goes
 * to the device first, and the page registers the worker that lets it open
 * with the server down.
 */
import type { WorkerRegistry } from "./editor-parts";
import type { FileStore } from "./files";
import type { OfflineStore } from "./offline-store";

/** The worker script, served beside the editor's other assets. */
export const WORKER_URL = "/admin/assets/sw.js";
/** Every editor page, `/admin` itself included -- hence the server's `Service-Worker-Allowed`. */
export const WORKER_SCOPE = "/admin";

/**
 * Keep a picked image on this device and queue its upload.
 *
 * The bytes go in first, so a sync that starts in between never finds a
 * queued image with nothing behind it; a re-pick's stale bytes go last.
 */
export async function queueUpload(
  store: OfflineStore,
  files: FileStore,
  slug: string,
  file: File,
  newId: () => string,
): Promise<void> {
  const key = `${slug}/${file.name}/${newId()}`;
  await files.put(key, file);
  const stale = store.queueImage(slug, file.name, key);
  if (stale !== null) {
    await files.delete(stale);
  }
}

/** Register the page-shell worker; nothing to do where the browser offers none. */
export async function registerShell(
  container: WorkerRegistry | undefined,
): Promise<void> {
  await container?.register(WORKER_URL, { scope: WORKER_SCOPE });
}
