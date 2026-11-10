import { getByRole, getByText, queryByRole } from "@testing-library/dom";
import { GithubError, type Project } from "./github";
import { errorMessage, formatMonthYear, mountProjects, projectCard } from "./projects";

const base: Project = {
  name: "screen-locker",
  description: "Locks the screen for workouts.",
  languages: ["Python", "Shell", "Dart"],
  stars: 3,
  pushedAt: "2026-06-15T00:00:00Z",
  url: "https://github.com/kuhyx/screen-locker",
  homepage: "https://kuhy.duckdns.org",
  topics: ["python", "linux"],
};

function container(): HTMLElement {
  document.body.innerHTML = "<div data-projects><p>Loading projects…</p></div>";
  const node = document.querySelector<HTMLElement>("[data-projects]");
  if (node === null) {
    throw new Error("fixture missing");
  }
  return node;
}

describe("projectCard", () => {
  it("renders every field when present", () => {
    const card = projectCard(document, base);
    expect(card).toHaveClass("project-card");
    const link = getByRole(card, "link", { name: "screen-locker" });
    expect(link).toHaveAttribute("href", base.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(getByText(card, "Locks the screen for workouts.")).toBeInstanceOf(HTMLElement);
    expect(card.querySelector(".project-card__langs")?.textContent).toBe("PythonShellDart");
    expect(card.querySelector(".project-card__topics")?.textContent).toBe("pythonlinux");
    expect(getByText(card, "Jun 2026")).toBeInstanceOf(HTMLElement);
    expect(getByRole(card, "link", { name: "Live site" })).toHaveAttribute("href", base.homepage);
  });

  it("omits the optional parts when absent", () => {
    const card = projectCard(document, { ...base, description: null, languages: [], topics: [], homepage: null });
    expect(card.querySelector("p")).toBeNull();
    expect(card.querySelector(".project-card__langs")).toBeNull();
    expect(card.querySelector(".project-card__topics")).toBeNull();
    expect(queryByRole(card, "link", { name: "Live site" })).toBeNull();
  });

  it("lists at most six languages", () => {
    const languages = ["A", "B", "C", "D", "E", "F", "G"];
    const card = projectCard(document, { ...base, languages });
    expect(card.querySelectorAll(".project-card__langs li")).toHaveLength(6);
  });

  it("never parses repo text as markup", () => {
    const card = projectCard(document, { ...base, description: "<img src=x onerror=alert(1)>" });
    expect(card.querySelector("img")).toBeNull();
    expect(getByText(card, "<img src=x onerror=alert(1)>")).toBeInstanceOf(HTMLElement);
  });
});

describe("mountProjects", () => {
  it("replaces the loading line with a grid of cards", async () => {
    const node = container();
    await mountProjects(node, () => Promise.resolve([base, { ...base, name: "other" }]));
    expect(node.querySelector(".projects__grid")?.children).toHaveLength(2);
    expect(node.textContent).not.toContain("Loading");
  });

  it("says so when there is nothing to show", async () => {
    const node = container();
    await mountProjects(node, () => Promise.resolve([]));
    expect(node.textContent).toBe("No projects to show.");
  });

  it("shows the failure as an alert", async () => {
    const node = container();
    await mountProjects(node, () => Promise.reject(new GithubError("rate-limit", "GitHub rate limit hit.")));
    expect(getByRole(node, "alert")).toHaveTextContent("GitHub rate limit hit.");
  });

  it("fetches from GitHub by default", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError("offline")));
    vi.stubGlobal("fetch", fetchMock);
    const node = container();
    await mountProjects(node);
    expect(fetchMock).toHaveBeenCalled();
    expect(getByRole(node, "alert")).toHaveTextContent("Could not reach GitHub.");
    vi.unstubAllGlobals();
  });
});

describe("errorMessage / formatMonthYear", () => {
  it("uses an Error's message and a fallback for anything else", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("nope")).toBe("Could not load projects.");
  });

  it("formats an ISO timestamp as a short month and year", () => {
    expect(formatMonthYear("2026-01-20T10:00:00Z")).toBe("Jan 2026");
  });
});
