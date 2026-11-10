import type { APIRoute } from "astro";
import { llmsTxt } from "../lib/discovery";
import { publishedPosts } from "../lib/posts";
import { textResponse } from "../lib/respond";

/** `/llms.txt`: the site for agents, linking every markdown mirror. */
export const GET: APIRoute = () => textResponse(llmsTxt(publishedPosts), "text/plain");
