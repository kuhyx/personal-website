import type { APIRoute } from "astro";
import { sitemapXml } from "../lib/discovery";
import { prerenderRoutes } from "../lib/head";
import { publishedPosts } from "../lib/posts";
import { textResponse } from "../lib/respond";

/** `/sitemap.xml`: every page, each post with its publish date. */
export const GET: APIRoute = () =>
  textResponse(sitemapXml(prerenderRoutes(), publishedPosts), "application/xml");
