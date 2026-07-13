import type { Project } from "../lib/github";

/** Format an ISO timestamp as e.g. `Jun 2026`. */
function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

/** A single project in the showcase. */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="project-card">
      <h3>
        <a href={project.url} target="_blank" rel="noreferrer">
          {project.name}
        </a>
      </h3>
      {project.description !== null && <p>{project.description}</p>}
      {project.languages.length > 0 && (
        <ul className="project-card__langs">
          {project.languages.slice(0, 6).map((language) => (
            <li key={language}>{language}</li>
          ))}
        </ul>
      )}
      <dl className="project-card__meta">
        <div>
          <dt>Updated</dt>
          <dd>{formatMonthYear(project.pushedAt)}</dd>
        </div>
      </dl>
      {project.topics.length > 0 && (
        <ul className="project-card__topics">
          {project.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      )}
      {project.homepage !== null && (
        <a
          className="project-card__homepage"
          href={project.homepage}
          target="_blank"
          rel="noreferrer"
        >
          Live site
        </a>
      )}
    </article>
  );
}
