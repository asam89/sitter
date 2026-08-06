// Public "Meet our team" data. Names/titles are content, not user records —
// edit here to update the public team section. `title` labels are editable
// placeholders until each member's exact credential (ECE / OCT teacher /
// community member) is confirmed.

export type TeamMember = {
  name: string;
  title: string;
};

export type TeamGroup = {
  id: string;
  heading: string;
  blurb: string;
  members: TeamMember[];
};

export const TEAM_GROUPS: TeamGroup[] = [
  {
    id: "evaluators",
    heading: "Who evaluates our babysitters",
    blurb:
      "Every applicant is reviewed and interviewed by our evaluation team — a group of Early Childhood Educators (ECEs), OCT-certified teachers, and trusted community members. They meet each sitter before anyone is vetted and listed.",
    members: [
      { name: "Marya Khan", title: "Application Evaluator" },
      { name: "Sameeha Ibrahim", title: "Application Evaluator" },
    ],
  },
  {
    id: "senior-sitters",
    heading: "Our senior babysitters",
    blurb:
      "Experienced sitters who set the standard of care at Ri'aya and help mentor newer applicants through the process.",
    members: [
      { name: "Sakina", title: "Senior Babysitter" },
      { name: "Maryam Saleem", title: "Senior Babysitter" },
      { name: "Sufia Gulamali", title: "Senior Babysitter" },
    ],
  },
];

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
