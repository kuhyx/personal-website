import { Hero } from "./components/hero";
import { Projects } from "./components/projects";
import { CvSection } from "./components/cv-section";

/** Page shell: intro, live projects, and CV. */
export function App() {
  return (
    <main className="page">
      <Hero />
      <Projects />
      <CvSection />
    </main>
  );
}
