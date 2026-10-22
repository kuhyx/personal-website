/**
 * schema.org JSON-LD for each prerendered page (AgentReady AR-READ-08).
 *
 * One `@graph` per page so the WebSite and Person nodes are declared once and
 * referenced by `@id`, rather than nested and repeated inside every post.
 */

import { cv } from "../data/cv";
import { publishedPosts, type Post } from "./posts";
import { postMeta } from "./head";
import { SITE_DESCRIPTION, SITE_TITLE, absoluteUrl } from "./site";

/** One schema.org node. */
export type JsonLdNode = Readonly<Record<string, unknown>>;

/** A page's JSON-LD document. */
export interface JsonLd {
  readonly "@context": "https://schema.org";
  readonly "@graph": readonly JsonLdNode[];
}

const SITE_ID = absoluteUrl("/#website");
const PERSON_ID = absoluteUrl("/#person");

const website: JsonLdNode = {
  "@type": "WebSite",
  "@id": SITE_ID,
  url: absoluteUrl("/"),
  name: SITE_TITLE,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  publisher: { "@id": PERSON_ID },
};

const person: JsonLdNode = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: cv.header.name,
  url: absoluteUrl("/"),
  description: cv.summary.en,
  email: `mailto:${cv.header.email}`,
  sameAs: [cv.header.github, cv.header.linkedin],
  alumniOf: cv.education.map((school) => ({
    "@type": "CollegeOrUniversity",
    name: school.institutionEn,
  })),
};

function graph(...nodes: JsonLdNode[]): JsonLd {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** The JSON-LD for one prerendered route; anything unknown gets the home graph. */
export function jsonLdFor(path: string): JsonLd {
  if (path === "/blog") {
    return graph(website, {
      "@type": "Blog",
      "@id": absoluteUrl("/blog#blog"),
      url: absoluteUrl("/blog"),
      name: `Blog — ${SITE_TITLE}`,
      author: { "@id": PERSON_ID },
      isPartOf: { "@id": SITE_ID },
    });
  }
  const post = publishedPosts.find((entry) => `/blog/${entry.slug}` === path);
  if (post === undefined) {
    return graph(website, person);
  }
  return postJsonLd(post);
}

/** A post as a BlogPosting by the site's author. */
export function postJsonLd(post: Post): JsonLd {
  const meta = postMeta(post);
  const url = absoluteUrl(meta.path);
  return graph(
    website,
    {
      "@type": "BlogPosting",
      "@id": `${url}#post`,
      url,
      mainEntityOfPage: url,
      headline: post.meta.title,
      description: post.meta.summary,
      datePublished: post.meta.date,
      keywords: post.meta.tags,
      ...(meta.image === null ? {} : { image: absoluteUrl(meta.image) }),
      author: { "@id": PERSON_ID },
      isPartOf: { "@id": SITE_ID },
    },
    person,
  );
}

/**
 * `doc` as an inline script. `<` is written as `<`, which JSON parses
 * back to the same string, so no value -- a post title included -- can close
 * the `</script>` early.
 */
export function jsonLdScript(doc: JsonLd): string {
  const json = JSON.stringify(doc).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}
