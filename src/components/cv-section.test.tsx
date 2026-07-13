import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CvSection } from "./cv-section";
import { cv } from "../data/cv";

describe("CvSection", () => {
  it("renders every CV subsection heading", () => {
    render(<CvSection />);
    for (const name of [
      "Experience",
      "Education",
      "Skills",
      "Volunteering",
      "Side projects",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("offers a PDF download", () => {
    render(<CvSection />);
    const link = screen.getByRole("link", { name: "Download PDF" });
    expect(link).toHaveAttribute("href", "/cv.pdf");
    expect(link).toHaveAttribute("download");
  });

  it("renders content drawn from cv.json", () => {
    render(<CvSection />);
    const firstJob = cv.experience[0];
    const firstSchool = cv.education[0];
    const firstProject = cv.sideProjects[0];
    expect(firstJob).toBeDefined();
    expect(firstSchool).toBeDefined();
    expect(firstProject).toBeDefined();
    // Company name appears in an experience heading.
    expect(
      screen.getByText(new RegExp(firstJob?.company ?? ""), {
        selector: "h3",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(firstSchool?.institutionEn ?? ""),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: firstProject?.titleEn ?? "" }),
    ).toHaveAttribute("href", firstProject?.url ?? "");
  });
});
