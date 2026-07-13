import { cv } from "../data/cv";
import { renderMarkup } from "../lib/markup";
import { ExperienceItem } from "./experience-item";

/** The CV: experience, education, skills, volunteering, and side projects. */
export function CvSection() {
  return (
    <section className="cv" aria-labelledby="cv-heading">
      <div className="cv__header">
        <h2 id="cv-heading">CV</h2>
        <a className="cv__download" href="/cv.pdf" download>
          Download PDF
        </a>
      </div>

      <h3 className="cv__subheading">Experience</h3>
      {cv.experience.map((job) => (
        <ExperienceItem key={job.company} job={job} />
      ))}

      <h3 className="cv__subheading">Education</h3>
      {cv.education.map((school) => (
        <div key={school.institutionEn} className="cv__block">
          <p className="cv__block-title">{school.institutionEn}</p>
          <ul>
            {school.entries.map((entry) => (
              <li key={entry.degreeEn}>
                <strong>{entry.degreeEn}</strong> — {entry.detailEn}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <h3 className="cv__subheading">Skills</h3>
      <dl className="cv__skills">
        {cv.skills.map((skill) => (
          <div key={skill.labelEn}>
            <dt>{skill.labelEn}</dt>
            <dd>{renderMarkup(skill.valueEn)}</dd>
          </div>
        ))}
      </dl>

      <h3 className="cv__subheading">Volunteering</h3>
      {cv.volunteer.map((org) => (
        <div key={org.orgEn} className="cv__block">
          <p className="cv__block-title">{org.orgEn}</p>
          <ul>
            {org.rolesEn.map((role) => (
              <li key={role}>{role}</li>
            ))}
          </ul>
          <p>{org.descEn}</p>
        </div>
      ))}

      <h3 className="cv__subheading">Side projects</h3>
      <ul className="cv__side-projects">
        {cv.sideProjects.map((sideProject) => (
          <li key={sideProject.titleEn}>
            <a href={sideProject.url} target="_blank" rel="noreferrer">
              {sideProject.titleEn}
            </a>{" "}
            — {renderMarkup(sideProject.descEn)}
          </li>
        ))}
      </ul>
    </section>
  );
}
