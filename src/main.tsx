import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app";
import "./styles/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

const tree = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// `pnpm build` prerenders every route to static HTML, so the served page
// already has markup to adopt. `pnpm dev` serves a #root holding only the
// `<!--app-html-->` comment, where hydration would just warn about a mismatch.
// Tested with firstElementChild, not hasChildNodes: that comment IS a child
// node, so hasChildNodes would take the hydrate branch in dev every time.
if (root.firstElementChild !== null) {
  hydrateRoot(root, tree);
} else {
  createRoot(root).render(tree);
}
