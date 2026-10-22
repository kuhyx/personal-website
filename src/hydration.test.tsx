import { StrictMode, act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { BrowserRouter, StaticRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { App } from "./app";
import { prerenderRoutes } from "./lib/head";
import { NOT_FOUND_ROUTE } from "./lib/agent-head";

/**
 * The prerendered HTML and the hydrated client tree must agree.
 *
 * This is the check that `renderToString` (not `renderToStaticMarkup`) is the
 * right server renderer, and it belongs in the suite rather than in a pair of
 * human eyes on a devtools console: React reports a mismatch by calling
 * console.error, so it can be adjudicated by an exit code.
 */
describe("prerender/hydrate agreement", () => {
  // 404.html is prerendered once at NOT_FOUND_ROUTE but served at whatever
  // address was mistyped, so it must hydrate cleanly at an unrelated path.
  const cases: [string, string][] = [
    ...prerenderRoutes().map((route): [string, string] => [route, route]),
    [NOT_FOUND_ROUTE, "/no/such/page"],
    // A mistyped post URL matches /blog/:slug on the client, so the Blog
    // NavLink would turn active there while the 404 HTML has it inactive.
    [NOT_FOUND_ROUTE, "/blog/typo"],
    // Caddy serves blog/index.html for /blog/ too.
    ["/blog", "/blog/"],
  ];
  for (const [rendered, route] of cases) {
    it(`hydrates ${route} without warnings`, async () => {
      const html = renderToString(
        <StrictMode>
          <StaticRouter location={rendered}>
            <App />
          </StaticRouter>
        </StrictMode>,
      );

      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);

      window.history.pushState(null, "", route);
      const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const root = await act(async () => {
        const created = hydrateRoot(
          container,
          <StrictMode>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </StrictMode>,
        );
        // React 19 hydrates concurrently; let the scheduled work run before
        // asserting, or a mismatch reported later would go unnoticed.
        await Promise.resolve();
        return created;
      });

      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();

      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
      container.remove();
    });
  }
});
