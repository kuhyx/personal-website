import { Link } from "react-router";
import { publishedPosts } from "../lib/posts";
import { PostMetaLine } from "./post-meta";

/** The post list, newest first. */
export function BlogIndex() {
  return (
    <section className="blog" aria-labelledby="blog-heading">
      <h1 id="blog-heading">Blog</h1>
      {publishedPosts.length === 0 ? (
        <p>Nothing published yet.</p>
      ) : (
        <ul className="blog__list">
          {publishedPosts.map((post) => (
            <li key={post.slug} className="blog__entry">
              <h2>
                <Link to={`/blog/${post.slug}`}>{post.meta.title}</Link>
              </h2>
              <PostMetaLine meta={post.meta} />
              <p className="blog__summary">{post.meta.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
