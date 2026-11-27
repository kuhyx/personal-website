/**
 * The service worker entry, built to `dist-admin/client/assets/sw.js`.
 * Everything it does lives in `sw-shell.ts`, where it is tested.
 */
import { installShell, type WorkerScope } from "./sw-shell";

// The DOM lib types `globalThis` as a Window; inside a worker it is the
// worker scope, which `WorkerScope` describes.
installShell(globalThis as unknown as WorkerScope);
