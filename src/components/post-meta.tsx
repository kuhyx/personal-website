import { formatDate } from "../lib/format-date";
import type { PostMeta } from "../lib/frontmatter";

/** Date line and tag list, shared by the blog index and a post's header. */
export function PostMetaLine({ meta }: { readonly meta: PostMeta }) {
  return (
    <p className="post-meta">
      <time dateTime={meta.date}>{formatDate(meta.date)}</time>
      {meta.tags.map((tag) => (
        <span key={tag} className="post-meta__tag">
          {tag}
        </span>
      ))}
    </p>
  );
}
