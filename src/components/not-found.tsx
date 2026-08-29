import { Link } from "react-router";

/** Shown for an unknown address, and for a `/blog/:slug` that matches no post. */
export function NotFound() {
  return (
    <section className="post">
      <h1>Not found</h1>
      <p>
        Nothing lives at this address.{" "}
        <Link to="/blog">Back to the blog</Link>.
      </p>
    </section>
  );
}
