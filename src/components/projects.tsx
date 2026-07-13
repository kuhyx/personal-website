import { useEffect, useState } from "react";
import { fetchRepos, type Project } from "../lib/github";
import { ProjectCard } from "./project-card";

type State =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly projects: readonly Project[] };

/** Extract a human message from an unknown rejection. */
function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not load projects.";
}

/** The projects showcase — a single live fetch of the public GitHub repos. */
export function Projects() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    void fetchRepos()
      .then((projects) => {
        setState({ status: "ready", projects });
      })
      .catch((error: unknown) => {
        setState({ status: "error", message: errorMessage(error) });
      });
  }, []);

  return (
    <section className="projects" aria-labelledby="projects-heading">
      <h2 id="projects-heading">Projects</h2>
      {state.status === "loading" && <p>Loading projects…</p>}
      {state.status === "error" && <p role="alert">{state.message}</p>}
      {state.status === "ready" &&
        (state.projects.length === 0 ? (
          <p>No projects to show.</p>
        ) : (
          <div className="projects__grid">
            {state.projects.map((project) => (
              <ProjectCard key={project.name} project={project} />
            ))}
          </div>
        ))}
    </section>
  );
}
