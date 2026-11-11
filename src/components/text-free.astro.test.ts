// @vitest-environment node
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { cv } from "../data/cv";
import NotFoundPage from "../pages/404.astro";
import BlogPage from "../pages/blog/index.astro";
import IndexPage from "../pages/index.astro";
import { publishedPosts } from "../lib/posts";
import { first } from "../test/first";
import { stringsIn, visibleWords } from "../test/visible-words";
import BlogIndex from "./blog-index.astro";
import PostPage from "./post-page.astro";

/**
 * textgate: no page paints a word Claude wrote. What may show is authored
 * content: cv.json values (kuhy's CV, shared with the PDF) minus the hero's
 * degree title, and each post's own title, summary, tags and body.
 */
type Component = Parameters<AstroContainer["renderToString"]>[0];

async function words(component: Component, allowed: readonly string[], props = {}, slots = {}): Promise<string[]> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(component, { props, slots });
  const page = new JSDOM(html).window.document;
  expect(page.body.querySelector("svg, p, h1")).not.toBeNull();
  return visibleWords(page.body, allowed);
}

/** cv.json strings, also split at `**` because markup.astro renders bold runs apart. */
const CV_CONTENT = stringsIn({ ...cv, header: { ...cv.header, titleEn: "", titlePl: "" } }).flatMap((text) => [
  text,
  ...text.split("**"),
]);
const POST = first(publishedPosts, "post");
const POST_CONTENT = publishedPosts.flatMap((post) => [post.meta.title, post.meta.summary, ...post.meta.tags]);

describe("text-free pages", () => {
  it("home paints only CV content", async () => {
    expect(await words(IndexPage, CV_CONTENT)).toEqual([]);
  });

  it("blog index paints only post content", async () => {
    expect(await words(BlogPage, POST_CONTENT)).toEqual([]);
  });

  it("empty blog index paints nothing", async () => {
    expect(await words(BlogIndex, [], { posts: [] }, {})).toEqual([]);
  });

  it("a post page paints only the post", async () => {
    expect(await words(PostPage, [...POST_CONTENT, "Body"], { meta: POST.meta }, { default: "<p>Body</p>" })).toEqual([]);
  });

  it("the 404 page paints no words", async () => {
    expect(await words(NotFoundPage, [])).toEqual([]);
  });
});
