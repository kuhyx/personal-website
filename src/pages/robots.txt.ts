import type { APIRoute } from "astro";
import { robotsTxt } from "../lib/discovery";
import { textResponse } from "../lib/respond";

/** `/robots.txt` (AgentReady): allow-all, sitemap linked. */
export const GET: APIRoute = () => textResponse(robotsTxt(), "text/plain");
