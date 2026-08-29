import { Hero } from "./hero";
import { Projects } from "./projects";
import { CvSection } from "./cv-section";

/** The landing page: intro, live projects, and CV. */
export function Home() {
  return (
    <>
      <Hero />
      <Projects />
      <CvSection />
    </>
  );
}
