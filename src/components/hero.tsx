import { cv } from "../data/cv";

/** Intro block: name, title, one-line summary, and contact links. */
export function Hero() {
  const { header, summary } = cv;
  return (
    <header className="hero">
      <h1>{header.name}</h1>
      <p className="hero__title">{header.titleEn}</p>
      <p className="hero__summary">{summary.en}</p>
      <nav className="hero__links" aria-label="Contact">
        <a href={`mailto:${header.email}`}>{header.email}</a>
        <a href={header.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={header.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        <a
          href={`https://discord.com/users/${header.discord}`}
          target="_blank"
          rel="noreferrer"
        >
          Discord
        </a>
      </nav>
    </header>
  );
}
