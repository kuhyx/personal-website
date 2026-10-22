import { Link } from "react-router";

/** Shown for an unknown address, and for a `/blog/:slug` that matches no post. */
export function NotFound() {
  return (
    <section className="post">
      <h1>Not found</h1>
      <p>
        Nothing lives at this address. It may have moved, or never existed.
      </p>
      <p>
        <Link to="/">Go to the home page</Link>, or{" "}
        <Link to="/blog">read the blog</Link>.
      </p>
    </section>
  );
}
