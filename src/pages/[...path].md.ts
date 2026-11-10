import type { APIRoute, GetStaticPaths } from "astro";
import { prerenderRoutes } from "../lib/head";
import { markdownFor, mirrorParam, routeForMirrorParam } from "../lib/mirror";
import { textResponse } from "../lib/respond";

/** One markdown mirror per page: `/index.md`, `/blog.md`, `/blog/<slug>.md`. */
export const getStaticPaths: GetStaticPaths = () =>
  prerenderRoutes().map((route) => ({ params: { path: mirrorParam(route) } }));

export const GET: APIRoute = ({ params }) =>
  textResponse(markdownFor(routeForMirrorParam(String(params.path))), "text/markdown");
