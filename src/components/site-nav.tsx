import { Link, NavLink, useLocation } from "react-router";
import { isKnownPage } from "../lib/head";

/**
 * Top-level navigation between the landing page and the blog.
 *
 * On the not-found view nothing is marked current. 404.html is prerendered
 * once, with no item active, and then served at every mistyped address; a
 * NavLink would light up Blog on `/blog/typo` in the browser only, and React
 * does not patch attribute mismatches during hydration.
 */
export function SiteNav() {
  const { pathname } = useLocation();
  if (!isKnownPage(pathname)) {
    return (
      <nav className="site-nav" aria-label="Site">
        <Link to="/">Home</Link>
        <Link to="/blog">Blog</Link>
      </nav>
    );
  }
  return (
    <nav className="site-nav" aria-label="Site">
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/blog">Blog</NavLink>
    </nav>
  );
}
