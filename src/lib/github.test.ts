import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchRepos, GithubError } from "./github";

interface FetchResultOptions {
  readonly ok?: boolean;
  readonly status?: number;
  readonly json?: unknown;
  // Per-repo languages endpoint behaviour.
  readonly languages?: unknown;
  readonly languagesOk?: boolean;
}

function mockFetch(options: FetchResultOptions): void {
  const {
    ok = true,
    status = 200,
    json = [],
    languages = {},
    languagesOk = true,
  } = options;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/languages")) {
        return Promise.resolve({
          ok: languagesOk,
          status: languagesOk ? 200 : 403,
          json: () => Promise.resolve(languages),
        } as Response);
      }
      return Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(json),
      } as Response);
    }),
  );
}

function rawRepo(overrides: Record<string, unknown> = {}): unknown {
  return {
    name: "screen-locker",
    description: "Locks the screen for workouts.",
    language: "Python",
    stargazers_count: 3,
    pushed_at: "2026-06-01T00:00:00Z",
    html_url: "https://github.com/kuhyx/screen-locker",
    homepage: "",
    topics: ["python"],
    archived: false,
    fork: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRepos", () => {
  it("maps repositories to projects with a language breakdown", async () => {
    mockFetch({ json: [rawRepo()], languages: { Python: 200, Shell: 100 } });
    const projects = await fetchRepos();
    expect(projects).toEqual([
      {
        name: "screen-locker",
        description: "Locks the screen for workouts.",
        languages: ["Python", "Shell"],
        stars: 3,
        pushedAt: "2026-06-01T00:00:00Z",
        url: "https://github.com/kuhyx/screen-locker",
        homepage: null,
        topics: ["python"],
      },
    ]);
  });

  it("falls back to the primary language when the languages call fails", async () => {
    mockFetch({ json: [rawRepo()], languagesOk: false });
    const [project] = await fetchRepos();
    expect(project?.languages).toEqual(["Python"]);
  });

  it("falls back when the languages payload is not an object", async () => {
    mockFetch({ json: [rawRepo()], languages: "nope" });
    const [project] = await fetchRepos();
    expect(project?.languages).toEqual(["Python"]);
  });

  it("falls back to the primary language when the languages request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/languages")) {
          return Promise.reject(new Error("boom"));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([rawRepo()]),
        } as Response);
      }),
    );
    const [project] = await fetchRepos();
    expect(project?.languages).toEqual(["Python"]);
  });

  it("has no languages when the repo has neither a mix nor a primary", async () => {
    mockFetch({ json: [rawRepo({ language: null })], languages: {} });
    const [project] = await fetchRepos();
    expect(project?.languages).toEqual([]);
  });

  it("keeps a real homepage and defaults missing topics", async () => {
    mockFetch({
      json: [rawRepo({ homepage: "https://kuhy.duckdns.org", topics: undefined })],
    });
    const [project] = await fetchRepos();
    expect(project?.homepage).toBe("https://kuhy.duckdns.org");
    expect(project?.topics).toEqual([]);
  });

  it("drops archived and forked repositories", async () => {
    mockFetch({
      json: [
        rawRepo({ name: "active" }),
        rawRepo({ name: "old", archived: true }),
        rawRepo({ name: "mirror", fork: true }),
      ],
    });
    const names = (await fetchRepos()).map((p) => p.name);
    expect(names).toEqual(["active"]);
  });

  it("force-includes curated repos even when archived", async () => {
    mockFetch({
      json: [
        rawRepo({ name: "ARAI", archived: true }),
        rawRepo({ name: "WUT_Computer_Science", archived: true }),
      ],
    });
    const names = (await fetchRepos()).map((p) => p.name);
    expect(names).toEqual(["ARAI", "WUT_Computer_Science"]);
  });

  it("excludes blocklisted repos even when not archived", async () => {
    mockFetch({ json: [rawRepo({ name: "testsAndMisc-archive" })] });
    expect(await fetchRepos()).toEqual([]);
  });

  it("fills a fallback description only when GitHub has none", async () => {
    mockFetch({
      json: [
        rawRepo({ name: "testsAndMisc", description: null }),
        rawRepo({ name: "screen-locker", description: null }),
      ],
    });
    const projects = await fetchRepos();
    expect(projects[0]?.description).toMatch(/automation monorepo/);
    expect(projects[1]?.description).toBeNull();
  });

  it("returns an empty list when the feed is empty", async () => {
    mockFetch({ json: [] });
    expect(await fetchRepos()).toEqual([]);
  });

  it("throws a rate-limit error on HTTP 403", async () => {
    mockFetch({ ok: false, status: 403 });
    await expect(fetchRepos()).rejects.toMatchObject({ kind: "rate-limit" });
  });

  it("throws an http error on other bad statuses", async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(fetchRepos()).rejects.toMatchObject({ kind: "http" });
  });

  it("throws an http error when the payload is not an array", async () => {
    mockFetch({ json: { message: "nope" } });
    await expect(fetchRepos()).rejects.toMatchObject({ kind: "http" });
  });

  it("throws a network error when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    await expect(fetchRepos()).rejects.toMatchObject({ kind: "network" });
  });

  it("exposes the kind on GithubError instances", () => {
    const error = new GithubError("network", "boom");
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe("network");
    expect(error.name).toBe("GithubError");
  });
});
