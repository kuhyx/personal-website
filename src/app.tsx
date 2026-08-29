import { Route, Routes } from "react-router";
import { SiteNav } from "./components/site-nav";
import { Home } from "./components/home";
import { BlogIndex } from "./components/blog-index";
import { PostPage } from "./components/post-page";
import { NotFound } from "./components/not-found";

/** Page shell and routing table. */
export function App() {
  return (
    <main className="page">
      <SiteNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<PostPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  );
}
