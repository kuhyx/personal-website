import { NavLink } from "react-router";

/** Top-level navigation between the landing page and the blog. */
export function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Site">
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/blog">Blog</NavLink>
    </nav>
  );
}
