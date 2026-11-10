import type { APIRoute } from "astro";
import { aiCatalog } from "../../lib/discovery";
import { prerenderRoutes } from "../../lib/head";
import { textResponse } from "../../lib/respond";

/** `/.well-known/ai-catalog.json`: every agent-facing file this site ships. */
export const GET: APIRoute = () =>
  textResponse(`${JSON.stringify(aiCatalog(prerenderRoutes()), null, 2)}\n`, "application/ai-catalog+json");
