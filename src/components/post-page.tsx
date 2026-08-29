import { Link, useParams } from "react-router";
import { findPost } from "../lib/posts";
import { NotFound } from "./not-found";
import { PostBody } from "./post-body";
import { PostMetaLine } from "./post-meta";

/** One post, or the not-found notice if the slug matches nothing published. */
export function PostPage() {
  const { slug } = useParams();
  const post = slug === undefined ? undefined : findPost(slug);

  if (post === undefined) {
    return <NotFound />;
  }

  return (
    <article className="post">
      <h1>{post.meta.title}</h1>
      <PostMetaLine meta={post.meta} />
      <PostBody post={post} />
      <p className="post__back">
        <Link to="/blog">← All posts</Link>
      </p>
    </article>
  );
}
