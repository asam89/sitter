// Public "Meet our team" data. Names/titles are content, not user records —
// edit here to update the public team section. `title` labels are editable
// placeholders until each member's exact credential (ECE / OCT teacher /
// community member) is confirmed.

export type TeamMember = {
  name: string;
  title: string;
  // Optional free-text bio; newlines are preserved when rendered.
  bio?: string;
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
    ],
  },
  {
    id: "senior-sitters",
    heading: "Our senior babysitters",
    blurb:
      "Experienced sitters who set the standard of care at Ri'aya and help mentor newer applicants through the process.",
    members: [
      {
        name: "Sakina Ashraf",
        title: "Senior Babysitter",
        bio: `Salaam! My name is Sakina, or as many of you know me, Coach Sakina.

I have been the Tough Tigers girls' basketball coach with Faez Sports for the past two regular seasons, starting in Grade 9 and now going into Grade 11. I have also worked as a Faez Sports Summer Camp Counsellor for the past two summers and volunteered with the RIS (Reviving the Islamic Spirit) Children's Program for two years, where I received basic childcare training through Mumini.

Over the years, I've had the opportunity to build strong connections with many children and families in the Faez Sports community. I'm excited to reconnect with familiar faces and meet new families while providing a safe, caring, and engaging environment for your children.

Availability
• August: Full-time availability
• School Year: Weekends and after school (depending on location)
• Winter Break: Full availability`,
      },
      { name: "Maryam Saleem", title: "Senior Babysitter" },
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
