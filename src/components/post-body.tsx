import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { rehypeHighlightLite } from "../lib/rehype-highlight-lite";
import { isRemoteImage, resolveImage, type Post } from "../lib/posts";

/**
 * Renderers for one specific post.
 *
 * Built per-post rather than at module level because `react-markdown` hands
 * the `img` renderer a bare `src="./diagram.svg"` with no idea which post it
 * came from — the mapping to a hashed bundle URL only exists in the closure.
 */
export function componentsFor(post: Post): Components {
  return {
    img({ src, alt, title }) {
      const source = typeof src === "string" ? src : "";
      return (
        <img
          src={isRemoteImage(source) ? source : resolveImage(post, source)}
          alt={alt ?? ""}
          title={title}
          loading="lazy"
        />
      );
    },
    a({ href, children }) {
      const external = typeof href === "string" && /^https?:\/\//.test(href);
      return (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {children}
        </a>
      );
    },
  };
}

/** The markdown body of a post, rendered as React. */
export function PostBody({ post }: { readonly post: Post }) {
  return (
    <div className="prose">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlightLite]}
        components={componentsFor(post)}
      >
        {post.body}
      </Markdown>
    </div>
  );
}
