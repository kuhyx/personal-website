// @vitest-environment node
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { cv } from "../data/cv";
import BaseLayout from "../layouts/base.astro";
import NotFoundPage from "../pages/404.astro";
import BlogPage from "../pages/blog/index.astro";
import IndexPage from "../pages/index.astro";
import { NOT_FOUND_ROUTE } from "../lib/agent-head";
import type { PostMeta } from "../lib/frontmatter";
import { publishedPosts } from "../lib/posts";
import { first } from "../test/first";
import BlogIndex from "./blog-index.astro";
import CvSection from "./cv-section.astro";
import ExperienceItem from "./experience-item.astro";
import Hero from "./hero.astro";
import Markup from "./markup.astro";
import NotFound from "./not-found.astro";
import PostMetaLine from "./post-meta.astro";
import PostPage from "./post-page.astro";
import Projects from "./projects.astro";
import SiteNav from "./site-nav.astro";

type Component = Parameters<AstroContainer["renderToString"]>[0];

async function render(
  component: Component,
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(component, { props, slots });
}

const META: PostMeta = {
  title: "A <post>",
  date: "2026-08-29",
  summary: "Summary.",
  tags: ["meta", "astro"],
  cover: null,
  draft: false,
};

describe("site nav", () => {
  it("marks Home current on the home page", async () => {
    const html = await render(SiteNav, { current: "/" });
    expect(html).toContain('<a href="/" class="active" aria-current="page" aria-label="Home"><svg class="icon"');
    expect(html).toContain('<a href="/blog" aria-label="Blog"><svg class="icon"');
  });

  it("marks nothing on the not-found page", async () => {
    expect(await render(SiteNav, { current: null })).not.toContain("aria-current");
  });
});

describe("markup", () => {
  it("renders **bold** runs as strong and escapes the rest", async () => {
    expect(await render(Markup, { text: "**Go** & <b>" })).toBe("<strong>Go</strong> &amp; &lt;b&gt;");
  });
});

describe("hero", () => {
  it("shows the name and every contact link", async () => {
    const html = await render(Hero);
    expect(html).toContain(`<h1>${cv.header.name}</h1>`);
    expect(html).toContain(`href="mailto:${cv.header.email}"`);
    expect(html).toContain(`href="https://discord.com/users/${cv.header.discord}"`);
  });
});

describe("projects", () => {
  it("ships a spinner, a mount point and the fetch script", async () => {
    const html = await render(Projects);
    expect(html).toContain('<span class="spinner" role="progressbar" aria-label="Loading projects"></span>');
    expect(html).toContain("data-projects");
    expect(html).toContain("<script");
  });
});

describe("experience item", () => {
  const ongoing = first(
    cv.experience.filter((job) => job.durationEn === undefined && job.end === null),
    "ongoing job",
  );
  const pinned = first(
    cv.experience.filter((job) => job.durationEn !== undefined),
    "job with a pinned duration",
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15));
  });

  it("writes an ongoing job's duration as of the build, for the script to refresh", async () => {
    const html = await render(ExperienceItem, { job: ongoing });
    expect(html).toContain(`<span data-duration-start="${ongoing.start}">2y 5m</span>`);
    expect(html).not.toContain("data-duration-end");
  });

  it("writes a finished job's end month for the script", async () => {
    const html = await render(ExperienceItem, { job: { ...ongoing, end: "2025-06" } });
    expect(html).toContain('data-duration-end="2025-06"');
  });

  it("prints a pinned duration as plain text", async () => {
    const html = await render(ExperienceItem, { job: pinned });
    expect(html).toContain(`· ${String(pinned.durationEn)}`);
    expect(html).not.toContain("data-duration-start");
  });
});

describe("cv section", () => {
  it("lists every job, school, skill, organisation and side project", async () => {
    const html = await render(CvSection);
    for (const job of cv.experience) {
      expect(html).toContain(job.company.replace(/&/g, "&amp;"));
    }
    for (const skill of cv.skills) {
      expect(html).toContain(`<dt>${skill.labelEn.replace(/&/g, "&amp;")}</dt>`);
    }
    for (const sideProject of cv.sideProjects) {
      expect(html).toContain(`href="${sideProject.url}"`);
    }
    for (const school of cv.education) {
      expect(html).toContain(`<p class="cv__block-title">${school.institutionEn}</p>`);
    }
    expect(html).toContain('href="/cv.pdf" download');
  });
});

describe("blog index", () => {
  it("lists each post with its link, date and summary", async () => {
    const post = first(publishedPosts, "post");
    const html = await render(BlogIndex, { posts: publishedPosts });
    expect(html).toContain(`href="/blog/${post.slug}"`);
    expect(html).toContain(`<time datetime="${post.meta.date}">`);
    expect(html).toContain(`<p class="blog__summary">`);
  });

  it("shows the empty glyph when nothing is published", async () => {
    expect(await render(BlogIndex, { posts: [] })).toContain('<p class="blog__empty" aria-label="Nothing published yet."><svg');
  });
});

describe("post meta and post page", () => {
  it("prints the date and one span per tag", async () => {
    const html = await render(PostMetaLine, { meta: META });
    expect(html).toContain('<time datetime="2026-08-29">2026-08-29</time>');
    expect(html.match(/post-meta__tag/g)).toHaveLength(2);
  });

  it("wraps the rendered body in .prose under an escaped title", async () => {
    const html = await render(PostPage, { meta: META }, { default: "<p>Body</p>" });
    expect(html).toContain("<h1>A &lt;post&gt;</h1>");
    expect(html).toContain('<div class="prose"><p>Body</p></div>');
    expect(html).toContain('<a href="/blog" aria-label="All posts"><svg class="icon"');
  });
});

describe("pages", () => {
  it("the layout puts the route's own head and the nav around the content", async () => {
    const html = await render(BaseLayout, { path: "/blog", current: "/blog" }, { default: "<p>x</p>" });
    expect(html).toContain("<title>Blog — Krzysztof Rudnicki</title>");
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/blog.md" />');
    expect(html).toContain('<main class="page"><nav class="site-nav"');
    expect(html).toMatch(/<meta name="build-id" content="[0-9a-f]{7,}">/);
  });

  it("the home page carries hero, projects, CV and the site JSON-LD", async () => {
    const html = await render(IndexPage);
    expect(html).toContain('class="hero"');
    expect(html).toContain('class="projects"');
    expect(html).toContain('class="cv"');
    expect(html).toContain('<script type="application/ld+json">');
  });

  it("the blog page lists the published posts", async () => {
    const html = await render(BlogPage);
    expect(html).toContain('<h1 id="blog-heading" aria-label="Blog"><svg class="icon"');
  });

  it("the 404 page is noindex, with nothing marked current", async () => {
    const html = await render(NotFoundPage);
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain('<h1 aria-label="Not found"><svg class="icon"');
    expect(html).not.toContain("aria-current");
    expect(await render(NotFound)).toContain('<a href="/blog" aria-label="Read the blog"><svg');
    expect(NOT_FOUND_ROUTE).toBe("/404");
  });
});
