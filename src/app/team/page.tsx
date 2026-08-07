import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { TEAM_GROUPS, initials, type TeamMember } from "@/lib/team";

export const metadata: Metadata = {
  title: "Meet our team — Ri'aya Babysitters",
  description:
    "The Early Childhood Educators, OCT-certified teachers, and trusted community members who evaluate and approve every Ri'aya babysitter.",
};

export const dynamic = "force-dynamic";

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
    <div className="rounded-xl border border-brand-teal/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar name={member.name} index={index} />
        <div>
          <p className="font-semibold text-brand-ink">{member.name}</p>
          <p className="text-sm text-brand-teal-light">{member.title}</p>
        </div>
      </div>
      {member.bio && (
        <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
          {member.bio}
        </p>
      )}
    </div>
  );
}

// A publicly showcased sitter: opted in, admin-approved, and currently listed.
function SitterCard({
  id,
  name,
  bio,
  hasPhoto,
  index,
}: {
  id: string;
  name: string;
  bio: string | null;
  hasPhoto: boolean;
  index: number;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-brand-teal/10 bg-white p-5 shadow-sm">
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/sitter/${id}/photo`}
          alt={`${name}, Ri'aya babysitter`}
          className="h-14 w-14 shrink-0 rounded-full object-cover"
        />
      ) : (
        <Avatar name={name} index={index} />
      )}
      <div>
        <p className="font-semibold text-brand-ink">{name}</p>
        <p className="text-sm text-brand-teal-light">Babysitter</p>
        {bio && <p className="mt-2 text-sm text-slate-600">{bio}</p>}
      </div>
    </div>
  );
}

export default async function TeamPage() {
  const sitters = await prisma.sitterProfile.findMany({
    where: { isListed: true, publicOptIn: true, showcased: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      bio: true,
      photoPath: true,
      user: { select: { name: true } },
    },
  });

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

      {sitters.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-brand-ink">
              Our babysitters
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-teal-light">
              Vetted, listed sitters who chose to share a little about
              themselves.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sitters.map((s, i) => (
              <SitterCard
                key={s.id}
                id={s.id}
                name={s.user.name}
                bio={s.bio}
                hasPhoto={Boolean(s.photoPath)}
                index={i}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
