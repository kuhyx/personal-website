import { StrictMode, act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { BrowserRouter, StaticRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { App } from "./app";
import { prerenderRoutes } from "./lib/head";

/**
 * The prerendered HTML and the hydrated client tree must agree.
 *
 * This is the check that `renderToString` (not `renderToStaticMarkup`) is the
 * right server renderer, and it belongs in the suite rather than in a pair of
 * human eyes on a devtools console: React reports a mismatch by calling
 * console.error, so it can be adjudicated by an exit code.
 */
describe("prerender/hydrate agreement", () => {
  for (const route of prerenderRoutes()) {
    it(`hydrates ${route} without warnings`, async () => {
      const html = renderToString(
        <StrictMode>
          <StaticRouter location={route}>
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
