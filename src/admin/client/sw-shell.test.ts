import { describe, it, expect } from "vitest";
import { WORKER_URL } from "./editor-upload";
import {
  SHELL_CACHE,
  WORKER_PATH,
  SHELL_KEY,
  assetUrls,
  installShell,
  strategy,
  type ExtendableEventLike,
  type FetchEventLike,
  type ShellCache,
  type WorkerScope,
} from "./sw-shell";

/**
 * The editor's service worker: what lets `/admin` open with the server down.
 * Driven through a fake worker scope -- real `Request`/`Response`, a Map for
 * the cache -- so every route it takes is exercised without a browser.
 */
const ORIGIN = "http://localhost:4321";
const HTML = `<script type="module" src="/admin/assets/index-abc.js"></script>
<link rel="stylesheet" href="/admin/assets/index-def.css"><script src="/admin/assets/index-abc.js"></script>`;

function memoryCache(): ShellCache & { data: Map<string, Response> } {
  const data = new Map<string, Response>();
  return {
    data,
    match: (key) => Promise.resolve(data.get(key)?.clone()),
    put: (key, response) => {
      data.set(key, response);
      return Promise.resolve();
    },
  };
}

interface Harness {
  scope: WorkerScope;
  cache: ReturnType<typeof memoryCache>;
  opened: string[];
  fetched: string[];
  plugged: boolean;
  skipped: number;
  claimed: number;
  fire: (type: "install" | "activate") => Promise<void>;
  request: (path: string, method?: string) => Promise<Response> | null;
}

function harness(answer: (path: string) => Response = () => new Response("net")): Harness {
  const cache = memoryCache();
  const listeners = new Map<string, (event: never) => void>();
  const h: Harness = {
    cache,
    opened: [],
    fetched: [],
    plugged: true,
    skipped: 0,
    claimed: 0,
    scope: {
      location: { origin: ORIGIN },
      caches: {
        open: (name) => {
          h.opened.push(name);
          return Promise.resolve(cache);
        },
      },
      fetch: (input) => {
        const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN);
        if (!h.plugged) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        h.fetched.push(url.pathname);
        return Promise.resolve(answer(url.pathname));
      },
      skipWaiting: () => {
        h.skipped += 1;
        return Promise.resolve();
      },
      clients: {
        claim: () => {
          h.claimed += 1;
          return Promise.resolve();
        },
      },
      addEventListener: (type: string, listener: (event: never) => void) => {
        listeners.set(type, listener);
      },
    },
    fire: async (type) => {
      const waits: Promise<unknown>[] = [];
      const event: ExtendableEventLike = { waitUntil: (p) => { waits.push(p); } };
      (listeners.get(type) as (e: ExtendableEventLike) => void)(event);
      await Promise.all(waits);
    },
    request: (path, method = "GET") => {
      let answered: Promise<Response> | null = null;
      const event: FetchEventLike = {
        request: new Request(new URL(path, ORIGIN), { method }),
        respondWith: (r) => { answered = r; },
      };
      (listeners.get("fetch") as (e: FetchEventLike) => void)(event);
      return answered;
    },
  };
  installShell(h.scope);
  return h;
}

const text = async (r: Promise<Response> | null): Promise<string> => (r === null ? "<passed>" : (await r).text());

describe("the worker's own URL", () => {
  it("is the one the page registers, so the worker never caches itself", () => {
    expect(WORKER_PATH).toBe(WORKER_URL);
  });
});

describe("assetUrls", () => {
  it("lists each editor asset the page loads, once", () => {
    expect(assetUrls(HTML)).toEqual(["/admin/assets/index-abc.js", "/admin/assets/index-def.css"]);
  });

  it("finds nothing in a page with no assets", () => {
    expect(assetUrls("<p>hi</p>")).toEqual([]);
  });
});

describe("strategy", () => {
  const at = (path: string): URL => new URL(path, ORIGIN);

  it.each([
    ["/admin", "shell"],
    ["/admin/", "shell"],
    ["/admin/preview/x", "shell"],
    ["/admin/assets/index-abc.js", "asset"],
    ["/admin/assets/sw.js", null],
    ["/api/posts", null],
    ["/administrator", null],
  ])("routes %s to %s", (path, expected) => {
    expect(strategy("GET", at(path), ORIGIN)).toBe(expected);
  });

  it("leaves writes and other origins to the network", () => {
    expect(strategy("POST", at("/admin"), ORIGIN)).toBeNull();
    expect(strategy("GET", new URL("https://cdn.example/admin"), ORIGIN)).toBeNull();
  });
});

describe("install", () => {
  it("caches the page and every asset it loads, then takes over at once", async () => {
    const h = harness((path) => new Response(path === SHELL_KEY ? HTML : `asset ${path}`));
    await h.fire("install");
    expect(h.opened).toEqual([SHELL_CACHE]);
    expect([...h.cache.data.keys()].sort()).toEqual([
      SHELL_KEY, "/admin/assets/index-abc.js", "/admin/assets/index-def.css",
    ]);
    expect(await h.cache.data.get(SHELL_KEY)?.text()).toBe(HTML);
    expect(h.skipped).toBe(1);
  });

  it("fails the install when the page cannot be fetched, so the browser retries", async () => {
    const h = harness(() => new Response("down", { status: 502 }));
    await expect(h.fire("install")).rejects.toThrow("502");
    expect(h.skipped).toBe(0);
  });

  it("skips an asset that does not answer rather than caching an error", async () => {
    const h = harness((path) =>
      path === SHELL_KEY ? new Response(HTML) : new Response("gone", { status: 404 }));
    await h.fire("install");
    expect([...h.cache.data.keys()]).toEqual([SHELL_KEY]);
  });
});

describe("activate", () => {
  it("claims the open tabs", async () => {
    const h = harness();
    await h.fire("activate");
    expect(h.claimed).toBe(1);
  });
});

describe("fetch", () => {
  it("serves the page from the network and keeps the copy", async () => {
    const h = harness(() => new Response("fresh page"));
    expect(await text(h.request("/admin"))).toBe("fresh page");
    expect(await h.cache.data.get(SHELL_KEY)?.text()).toBe("fresh page");
  });

  it("does not keep an error page in place of the editor", async () => {
    const h = harness(() => new Response("bad gateway", { status: 502 }));
    await h.cache.put(SHELL_KEY, new Response("cached page"));
    expect(await text(h.request("/admin"))).toBe("bad gateway");
    expect(await h.cache.data.get(SHELL_KEY)?.text()).toBe("cached page");
  });

  it("opens the cached page when the server is down, under any /admin path", async () => {
    const h = harness();
    await h.cache.put(SHELL_KEY, new Response("cached page"));
    h.plugged = false;
    expect(await text(h.request("/admin"))).toBe("cached page");
    expect(await text(h.request("/admin/"))).toBe("cached page");
  });

  it("fails like the network when the server is down and nothing is cached", async () => {
    const h = harness();
    h.plugged = false;
    await expect(h.request("/admin")).rejects.toThrow("Failed to fetch");
  });

  it("serves an asset from the cache without asking the network", async () => {
    const h = harness();
    await h.cache.put("/admin/assets/a.js", new Response("cached js"));
    expect(await text(h.request("/admin/assets/a.js"))).toBe("cached js");
    expect(h.fetched).toEqual([]);
  });

  it("fetches and keeps an asset it has not seen", async () => {
    const h = harness(() => new Response("new js"));
    expect(await text(h.request("/admin/assets/b.js"))).toBe("new js");
    expect(await h.cache.data.get("/admin/assets/b.js")?.text()).toBe("new js");
  });

  it("does not keep a missing asset", async () => {
    const h = harness(() => new Response("nope", { status: 404 }));
    expect((await h.request("/admin/assets/c.js"))?.status).toBe(404);
    expect(h.cache.data.has("/admin/assets/c.js")).toBe(false);
  });

  it("never answers the API, so the editor sees a real offline failure", () => {
    const h = harness();
    expect(h.request("/api/posts")).toBeNull();
    expect(h.request("/admin", "POST")).toBeNull();
  });
});
