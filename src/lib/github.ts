/**
 * GitHub projects feed.
 *
 * The showcase is intentionally driven by a single unauthenticated REST call so
 * it stays live without a token and without exhausting the 60-requests/hour per
 * IP limit — we never fan out to per-repo endpoints (languages, commits, ...).
 */

const GITHUB_USER = "kuhyx";
const REPOS_URL = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`;

// Curation on top of the default "non-archived, non-fork" rule: some archived
// repos are still worth showing (e.g. university/hackathon work referenced in
// the CV), and some non-archived ones are noise.
const ALWAYS_SHOW = new Set(["ARAI", "WUT_Computer_Science"]);
const NEVER_SHOW = new Set(["testsAndMisc-archive"]);

// Fallback descriptions for repos that have none set on GitHub, so every card
// says something. Real GitHub descriptions always take precedence.
const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  testsAndMisc:
    "Personal automation monorepo — Python tools, Bash scripts, and Linux/Android productivity systems.",
  ARAI: "Legal-hackathon app: describe a lawsuit, estimate cost and time, and get matched to a mediator.",
  WUT_Computer_Science:
    "Coursework and projects from my Computer Science studies at Warsaw University of Technology.",
};

/** What went wrong fetching the feed, for tailored UI messages. */
export type GithubErrorKind = "rate-limit" | "http" | "network";

/** A typed failure from {@link fetchRepos}. */
export class GithubError extends Error {
  readonly kind: GithubErrorKind;

  constructor(kind: GithubErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GithubError";
    this.kind = kind;
  }
}

/** The repo fields we read from the GitHub REST response. */
interface GithubRepoRaw {
  readonly name: string;
  readonly description: string | null;
  readonly language: string | null;
  readonly stargazers_count: number;
  readonly pushed_at: string;
  readonly html_url: string;
  readonly homepage: string | null;
  readonly topics?: readonly string[];
  readonly archived: boolean;
  readonly fork: boolean;
}

/** A project ready to render in the showcase. */
export interface Project {
  readonly name: string;
  readonly description: string | null;
  /** Languages used, most bytes first. Falls back to the primary language. */
  readonly languages: readonly string[];
  readonly stars: number;
  readonly pushedAt: string;
  readonly url: string;
  readonly homepage: string | null;
  readonly topics: readonly string[];
}

function shouldShow(repo: GithubRepoRaw): boolean {
  if (NEVER_SHOW.has(repo.name)) {
    return false;
  }
  if (ALWAYS_SHOW.has(repo.name)) {
    return true;
  }
  return !repo.archived && !repo.fork;
}

/**
 * Fetch the full language breakdown for one repo, most-used first.
 * Returns an empty array on any failure (e.g. rate limiting) so the caller can
 * fall back to the repo's primary language.
 */
async function fetchLanguages(name: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_USER}/${name}/languages`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!response.ok) {
      return [];
    }
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) {
      return [];
    }
    return Object.entries(data as Record<string, number>)
      .sort((a, b) => b[1] - a[1])
      .map(([language]) => language);
  } catch {
    return [];
  }
}

function toProject(raw: GithubRepoRaw, languages: readonly string[]): Project {
  const resolvedLanguages =
    languages.length > 0
      ? languages
      : raw.language !== null
        ? [raw.language]
        : [];
  return {
    name: raw.name,
    description: raw.description ?? FALLBACK_DESCRIPTIONS[raw.name] ?? null,
    languages: resolvedLanguages,
    stars: raw.stargazers_count,
    pushedAt: raw.pushed_at,
    url: raw.html_url,
    // A homepage of "" is treated as absent so the UI does not render a dead link.
    homepage: raw.homepage === "" ? null : raw.homepage,
    topics: raw.topics ?? [],
  };
}

/**
 * Fetch the public projects to showcase: non-archived, non-fork repositories,
 * most recently pushed first.
 *
 * @throws {GithubError} On network failure, rate limiting, or a bad response.
 */
export async function fetchRepos(): Promise<Project[]> {
  let response: Response;
  try {
    response = await fetch(REPOS_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch (cause) {
    throw new GithubError("network", "Could not reach GitHub.", { cause });
  }

  if (response.status === 403) {
    throw new GithubError(
      "rate-limit",
      "GitHub rate limit hit. Try again in a little while.",
    );
  }
  if (!response.ok) {
    throw new GithubError(
      "http",
      `GitHub returned ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new GithubError("http", "Unexpected response from GitHub.");
  }

  const repos = (payload as GithubRepoRaw[]).filter(shouldShow);
  // One extra call per shown repo to get its full language mix; each is
  // independent and degrades to the primary language on failure.
  return Promise.all(
    repos.map(async (repo) => toProject(repo, await fetchLanguages(repo.name))),
  );
}
