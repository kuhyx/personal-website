/**
 * The projects showcase, rendered in the browser from one live GitHub fetch.
 *
 * The static page ships the section with a spinner; this module replaces it
 * with the cards, the error glyph or the empty glyph. Built with DOM calls and
 * `textContent` only, never `innerHTML`: every string here comes from GitHub,
 * so none of it is ever parsed as markup.
 *
 * textgate: the only words painted are the repo's own (name, description,
 * languages, topics). Labels and error messages are spoken-only.
 */

import { fetchRepos, type Project } from "./github";
import { iconElement, type IconName } from "./icons";

/** How many languages a card lists before it stops. */
const MAX_LANGUAGES = 6;

/** Format an ISO timestamp as e.g. `2026-06`: numbers, no month names. */
export function formatMonthYear(iso: string): string {
  return new Date(iso).toISOString().slice(0, 7);
}

/** Extract a human message from an unknown rejection. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not load projects.";
}

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (text !== undefined) {
    node.textContent = text;
  }
  if (className !== undefined) {
    node.className = className;
  }
  return node;
}

function externalLink(doc: Document, href: string, text: string, className?: string): HTMLAnchorElement {
  const link = element(doc, "a", text, className);
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}

/** A visually-hidden span: read by screen readers, never painted. */
function spoken(doc: Document, text: string): HTMLSpanElement {
  return element(doc, "span", text, "sr-only");
}

/**
 * A `p` painting only `icon`, with `label` in a spoken-only span (the empty
 * and error states). A span, not `aria-label`: a paragraph takes no name, and
 * an alert announces its contents.
 */
function glyphLine(doc: Document, icon: IconName, label: string, className: string): HTMLParagraphElement {
  const line = element(doc, "p", undefined, className);
  line.append(iconElement(doc, icon), spoken(doc, label));
  return line;
}

function list(doc: Document, className: string, items: readonly string[]): HTMLUListElement {
  const ul = element(doc, "ul", undefined, className);
  ul.append(...items.map((item) => element(doc, "li", item)));
  return ul;
}

/** One project card: name, description, languages, last push, topics, live site. */
export function projectCard(doc: Document, project: Project): HTMLElement {
  const card = element(doc, "article", undefined, "project-card");
  const heading = element(doc, "h3");
  heading.append(externalLink(doc, project.url, project.name));
  card.append(heading);
  if (project.description !== null) {
    card.append(element(doc, "p", project.description));
  }
  if (project.languages.length > 0) {
    card.append(list(doc, "project-card__langs", project.languages.slice(0, MAX_LANGUAGES)));
  }
  const meta = element(doc, "dl", undefined, "project-card__meta");
  const updated = element(doc, "div");
  const term = element(doc, "dt");
  term.append(iconElement(doc, "updated"), spoken(doc, "Updated"));
  updated.append(term, element(doc, "dd", formatMonthYear(project.pushedAt)));
  meta.append(updated);
  card.append(meta);
  if (project.topics.length > 0) {
    card.append(list(doc, "project-card__topics", project.topics));
  }
  if (project.homepage !== null) {
    const live = externalLink(doc, project.homepage, "", "project-card__homepage");
    live.setAttribute("aria-label", "Live site");
    live.append(iconElement(doc, "external"));
    card.append(live);
  }
  return card;
}

/** Replace `container`'s contents with the cards, or the empty glyph. */
export function renderProjects(container: HTMLElement, projects: readonly Project[]): void {
  const doc = container.ownerDocument;
  container.removeAttribute("aria-busy");
  if (projects.length === 0) {
    container.replaceChildren(glyphLine(doc, "empty", "No projects to show.", "projects__state"));
    return;
  }
  const grid = element(doc, "div", undefined, "projects__grid");
  grid.append(...projects.map((project) => projectCard(doc, project)));
  container.replaceChildren(grid);
}

/** Replace `container`'s contents with an alert glyph that speaks `message`. */
export function renderError(container: HTMLElement, message: string): void {
  const alert = glyphLine(container.ownerDocument, "error", message, "projects__state projects__state--error");
  alert.setAttribute("role", "alert");
  container.removeAttribute("aria-busy");
  container.replaceChildren(alert);
}

/**
 * Fetch the projects and render them into `container`.
 *
 * Resolves once the container shows its final state; never rejects, because a
 * failed fetch is a state the visitor sees, not an exception.
 */
export async function mountProjects(
  container: HTMLElement,
  load: () => Promise<Project[]> = fetchRepos,
): Promise<void> {
  try {
    renderProjects(container, await load());
  } catch (error: unknown) {
    renderError(container, errorMessage(error));
  }
}
