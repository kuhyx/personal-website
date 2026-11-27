/**
 * The editor's service worker: what lets `/admin` open with the server down.
 *
 * The page and its bundle come from the same service as the API, so without
 * this a reload while it is down is the browser's own "connection refused"
 * page, and the posts and queued saves on this device are out of reach. The
 * worker keeps a copy of the page and every asset it loads, and answers with
 * it only when the network cannot.
 *
 * It never answers `/api/*`: the editor's own offline store decides what a
 * failed request means, and a cached API answer would hide the failure from it.
 *
 * Imports nothing the editor bundle also imports, so the build keeps it one
 * classic script rather than a module sharing a chunk.
 */

/** The cache holding the page and its assets. */
export const SHELL_CACHE = "blog-admin-shell-v1";
/** The one key every `/admin` page is stored under: they are all the same document. */
export const SHELL_KEY = "/admin";
/** The worker script itself, refetched by the browser on every load. */
export const WORKER_PATH = "/admin/assets/sw.js";

export interface ShellCache {
  match: (key: string) => Promise<Response | undefined>;
  put: (key: string, response: Response) => Promise<void>;
}

export interface ExtendableEventLike {
  waitUntil: (work: Promise<unknown>) => void;
}

export interface FetchEventLike {
  readonly request: Request;
  respondWith: (response: Promise<Response>) => void;
}

/** The slice of `ServiceWorkerGlobalScope` the worker uses; tests pass a fake. */
export interface WorkerScope {
  readonly location: { readonly origin: string };
  readonly caches: { open: (name: string) => Promise<ShellCache> };
  readonly fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  skipWaiting: () => Promise<void>;
  readonly clients: { claim: () => Promise<void> };
  addEventListener: ((type: "install" | "activate", listener: (event: ExtendableEventLike) => void) => void) &
    ((type: "fetch", listener: (event: FetchEventLike) => void) => void);
}

/** Every `/admin/assets/...` URL the page names, once each, in order. */
export function assetUrls(html: string): string[] {
  return [...new Set(html.match(/\/admin\/assets\/[\w.-]+/g) ?? [])];
}

/** How a request is answered: the page, a hashed asset, or left to the network. */
export function strategy(method: string, url: URL, origin: string): "shell" | "asset" | null {
  if (method !== "GET" || url.origin !== origin || url.pathname === WORKER_PATH) {
    return null;
  }
  if (url.pathname.startsWith("/admin/assets/")) {
    return "asset";
  }
  return url.pathname === "/admin" || url.pathname.startsWith("/admin/") ? "shell" : null;
}

/** Fetch the page and everything it loads into the cache; a page that fails fails the install. */
async function precache(scope: WorkerScope): Promise<void> {
  const cache = await scope.caches.open(SHELL_CACHE);
  const page = await scope.fetch(SHELL_KEY, { cache: "no-store" });
  if (!page.ok) {
    throw new Error(`the editor page answered ${String(page.status)}`);
  }
  const html = await page.clone().text();
  await cache.put(SHELL_KEY, page);
  for (const url of assetUrls(html)) {
    const asset = await scope.fetch(url);
    if (asset.ok) {
      await cache.put(url, asset);
    }
  }
}

/** The page: fresh from the network when it answers, the kept copy when it does not. */
async function shell(scope: WorkerScope, request: Request): Promise<Response> {
  const cache = await scope.caches.open(SHELL_CACHE);
  let response: Response;
  try {
    response = await scope.fetch(request);
  } catch (error) {
    const kept = await cache.match(SHELL_KEY);
    if (kept === undefined) {
      throw error;
    }
    return kept;
  }
  if (response.ok) {
    await cache.put(SHELL_KEY, response.clone());
  }
  return response;
}

/** A content-hashed asset: never changes under its name, so the kept copy wins. */
async function asset(scope: WorkerScope, request: Request): Promise<Response> {
  const cache = await scope.caches.open(SHELL_CACHE);
  const key = new URL(request.url).pathname;
  const kept = await cache.match(key);
  if (kept !== undefined) {
    return kept;
  }
  const response = await scope.fetch(request);
  if (response.ok) {
    await cache.put(key, response.clone());
  }
  return response;
}

/** Attach the worker's install, activate and fetch handlers to `scope`. */
export function installShell(scope: WorkerScope): void {
  scope.addEventListener("install", (event) => {
    // Take over at once: a waiting worker would leave this first tab uncached.
    event.waitUntil(precache(scope).then(() => scope.skipWaiting()));
  });
  scope.addEventListener("activate", (event) => {
    event.waitUntil(scope.clients.claim());
  });
  scope.addEventListener("fetch", (event) => {
    const how = strategy(event.request.method, new URL(event.request.url), scope.location.origin);
    if (how !== null) {
      event.respondWith((how === "shell" ? shell : asset)(scope, event.request));
    }
  });
}
