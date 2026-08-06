import type { Metadata } from "next";
import { TEAM_GROUPS, initials, type TeamMember } from "@/lib/team";

export const metadata: Metadata = {
  title: "Meet our team — Ri'aya Babysitters",
  description:
    "The Early Childhood Educators, OCT-certified teachers, and trusted community members who evaluate and approve every Ri'aya babysitter.",
};

const AVATAR_COLORS = [
  "bg-brand-teal",
  "bg-brand-coral",
  "bg-brand-blue-dark",
  "bg-brand-teal-light",
  "bg-brand-coral-dark",
];

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <span
      aria-hidden
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${
        AVATAR_COLORS[index % AVATAR_COLORS.length]
      }`}
    >
      {initials(name)}
    </span>
  );
}

function MemberCard({ member, index }: { member: TeamMember; index: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-brand-teal/10 bg-white p-5 shadow-sm">
      <Avatar name={member.name} index={index} />
      <div>
        <p className="font-semibold text-brand-ink">{member.name}</p>
        <p className="text-sm text-brand-teal-light">{member.title}</p>
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <div className="space-y-10">
      <header className="rounded-2xl bg-brand-teal px-8 py-12 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Meet our team</h1>
        <p className="mt-3 max-w-2xl text-brand-blue-light">
          At Ri&apos;aya, the trust layer is people — not anonymous reviews.
          These are the educators and community members who evaluate every
          babysitter application and the senior sitters who set our standard of
          care.
        </p>
      </header>

      {TEAM_GROUPS.map((group) => (
        <section key={group.id} className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-brand-ink">
              {group.heading}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-teal-light">
              {group.blurb}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((m, i) => (
              <MemberCard key={m.name} member={m} index={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
