/**
 * Markdown mirrors: one `.md` file per prerendered page, for agents that would
 * rather not parse HTML. Each page's head advertises its mirror with
 * `<link rel="alternate" type="text/markdown">` (AgentReady AR-READ-09).
 *
 * Paths follow llms.txt's convention of appending `.md` to the page URL, with
 * `/index.md` for the root: `/blog/x` -> `/blog/x.md`, `/blog` -> `/blog.md`.
 */

import { cv } from "../data/cv";
import { cvMarkdown } from "./cv-markdown";
import { isRemoteImage, publishedPosts, resolveImage, type Post } from "./posts";
import { absoluteUrl } from "./site";

/** Site-root-relative URL of a route's markdown mirror. */
export function mirrorPath(route: string): string {
  return route === "/" ? "/index.md" : `${route}.md`;
}

/** Escape text for use inside `[...]`, so a `]` in a title cannot end the link. */
export function linkText(text: string): string {
  return text.replace(/[[\]\\]/g, "\\$&");
}

/** `- [title](mirror): summary` for one post. */
export function postListItem(post: Post): string {
  const url = absoluteUrl(mirrorPath(`/blog/${post.slug}`));
  return `- [${linkText(post.meta.title)}](${url}): ${post.meta.summary}`;
}

const IMAGE_SOURCE = /(!\[[^\]]*\]\(\s*)([^)\s]+)/g;

/**
 * One post as markdown: its frontmatter turned into a heading block, then the
 * body with every local image pointed at the hashed URL Vite emitted. Left as
 * written, `./c.png` would resolve against `/blog/x.md` to a file that does
 * not exist.
 */
export function postMarkdown(post: Post): string {
  const body = post.body.replace(
    IMAGE_SOURCE,
    (_match, prefix: string, source: string) =>
      prefix +
      (isRemoteImage(source) ? source : absoluteUrl(resolveImage(post, source))),
  );
  return [
    `# ${post.meta.title}`,
    "",
    `Published ${post.meta.date} · <${absoluteUrl(`/blog/${post.slug}`)}>`,
    "",
    `> ${post.meta.summary}`,
    "",
    body.trim(),
    "",
  ].join("\n");
}

/** The blog index as markdown: every post, newest first. */
export function blogIndexMarkdown(posts: readonly Post[]): string {
  const items = posts.length === 0 ? ["No posts yet."] : posts.map(postListItem);
  return ["# Blog", "", "Notes on the things I build.", "", ...items, ""].join("\n");
}

/**
 * The mirror for one prerendered route.
 *
 * @throws {Error} For a route with no page: silently mirroring the home page
 * would hand agents a document that claims to be something it is not.
 */
export function markdownFor(route: string): string {
  if (route === "/") {
    return `${cvMarkdown(cv)}\nThe blog: <${absoluteUrl(mirrorPath("/blog"))}>\n`;
  }
  if (route === "/blog") {
    return blogIndexMarkdown(publishedPosts);
  }
  const post = publishedPosts.find((entry) => `/blog/${entry.slug}` === route);
  if (post === undefined) {
    throw new Error(`No page to mirror at ${route}`);
  }
  return postMarkdown(post);
}
