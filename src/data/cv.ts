import cvData from "./cv.json";

/**
 * Typed view of cv.json. The website renders the English (`*En`) fields; the
 * Polish (`*Pl`) fields and the `start`/`end` ISO dates feed the PDF build and
 * the live duration calculation respectively.
 */
export interface CvHeader {
  readonly name: string;
  readonly titlePl: string;
  readonly titleEn: string;
  readonly email: string;
  readonly phone: string;
  readonly linkedin: string;
  readonly github: string;
  // Discord numeric user ID; linked as https://discord.com/users/<id>.
  readonly discord: string;
}

export interface CvSummary {
  readonly pl: string;
  readonly en: string;
}

export interface EducationEntry {
  readonly degreePl: string;
  readonly degreeEn: string;
  readonly detailPl: string;
  readonly detailEn: string;
}

export interface EducationSchool {
  readonly institutionPl: string;
  readonly institutionEn: string;
  readonly entries: readonly EducationEntry[];
}

export interface ExperienceBullet {
  readonly titlePl: string;
  readonly titleEn: string;
  readonly descPl: string;
  readonly descEn: string;
}

export interface ExperienceJob {
  readonly company: string;
  readonly locationPl: string;
  readonly locationEn: string;
  readonly rolePl: string;
  readonly roleEn: string;
  readonly start: string;
  readonly end: string | null;
  readonly startLabelPl: string;
  readonly startLabelEn: string;
  readonly endLabelPl: string;
  readonly endLabelEn: string;
  // Optional fixed duration label (finished jobs); when absent the duration is
  // computed live from start/end.
  readonly durationPl?: string;
  readonly durationEn?: string;
  readonly items: readonly ExperienceBullet[];
}

export interface VolunteerOrg {
  readonly orgPl: string;
  readonly orgEn: string;
  readonly rolesPl: readonly string[];
  readonly rolesEn: readonly string[];
  readonly descPl: string;
  readonly descEn: string;
}

export interface SkillRow {
  readonly labelPl: string;
  readonly labelEn: string;
  readonly valuePl: string;
  readonly valueEn: string;
}

export interface SideProject {
  readonly titlePl: string;
  readonly titleEn: string;
  readonly descPl: string;
  readonly descEn: string;
  readonly url: string;
}

export interface CvData {
  readonly header: CvHeader;
  readonly summary: CvSummary;
  readonly education: readonly EducationSchool[];
  readonly experience: readonly ExperienceJob[];
  readonly volunteer: readonly VolunteerOrg[];
  readonly skills: readonly SkillRow[];
  readonly sideProjects: readonly SideProject[];
}

export const cv: CvData = cvData;
