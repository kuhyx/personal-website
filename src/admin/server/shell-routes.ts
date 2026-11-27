/**
 * The editor shell: the page and its built assets, served without a session
 * because the login form is part of them. They carry no post data.
 */

import { captured } from "../../lib/captured";
import { assetContentType, isValidAssetName } from "./guards";
import type { AdminRequest, HandlerDeps } from "./deps";
import { fail, type AdminResponse } from "./responses";

/** The service worker's file, built beside the other assets under a fixed name. */
export const WORKER_ASSET = "sw.js";

/**
 * The cache headers for a built asset.
 *
 * Hashed bundles never change under their name, so they are kept for a year.
 * The worker keeps one name across builds, so it is revalidated every time,
 * and it may control `/admin` -- one level above its own folder -- only when
 * the response says so.
 */
function assetHeaders(name: string): Record<string, string> {
  return name === WORKER_ASSET
    ? { "Cache-Control": "no-cache", "Service-Worker-Allowed": "/admin" }
    : { "Cache-Control": "public, max-age=31536000, immutable" };
}

async function asset(name: string, deps: HandlerDeps): Promise<AdminResponse> {
  const bytes = isValidAssetName(name) ? await deps.adminAsset(name) : null;
  return bytes === null
    ? fail(404, "no such asset")
    : {
        status: 200,
        headers: { "Content-Type": assetContentType(name), ...assetHeaders(name) },
        body: bytes,
      };
}

async function page(deps: HandlerDeps): Promise<AdminResponse> {
  return {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // The editor must never be framed or indexed.
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow",
    },
    body: await deps.adminHtml(),
  };
}

/** The shell's answer to `request`, or null when it is not a shell path. */
export async function shellRoute(
  request: AdminRequest,
  deps: HandlerDeps,
): Promise<AdminResponse | null> {
  const { method, path } = request;
  const assetMatch = /^\/admin\/assets\/([^/]+)$/.exec(path);
  if (assetMatch) {
    return method === "GET" ? asset(captured(assetMatch, 1), deps) : fail(405, "method not allowed");
  }
  if (path === "/admin" || path.startsWith("/admin/")) {
    return method === "GET" ? page(deps) : fail(405, "method not allowed");
  }
  return null;
}
