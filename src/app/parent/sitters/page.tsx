import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageTitle,
} from "@/components/ui";
import { moneyHr } from "@/lib/format";
import { effectiveRate } from "@/lib/pricing";
import { sittersWithCurrentVsc } from "@/lib/screening";
import { firstName, sitterSharePath } from "@/lib/public-sitter";

export const dynamic = "force-dynamic";

export default async function ParentSitterProfiles() {
  await requireRole("PARENT", "ADMIN");
  const sitters = await prisma.sitterProfile.findMany({
    where: { isListed: true, user: { suspended: false } },
    orderBy: { vettedAt: "asc" },
    select: {
      id: true,
      bio: true,
      city: true,
      photoPath: true,
      age: true,
      education: true,
      listedPayRate: true,
      baseRate: true,
      userId: true,
      user: { select: { name: true } },
    },
  });
  const vsc = await sittersWithCurrentVsc(sitters.map((s) => s.userId));

  return (
    <div className="space-y-4">
      <PageTitle
        title="Sitter profiles"
        subtitle="Every Ri'aya sitter is interviewed in person and vetted by our team. Open a profile to read more about her."
      />
      {sitters.length === 0 ? (
        <EmptyState>No sitters are available right now.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sitters.map((s) => (
            <Link key={s.id} href={sitterSharePath(s.id)} className="block">
              <Card className="h-full hover:border-brand-coral">
                <div className="flex gap-4">
                  {s.photoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/sitter/${s.id}/photo`}
                      alt={`${s.user.name}, Ri'aya babysitter`}
                      className="h-16 w-16 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xl font-semibold text-white"
                    >
                      {firstName(s.user.name).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-ink">
                      {s.user.name}
                    </p>
                    <p className="text-sm text-brand-teal-light">
                      {moneyHr(effectiveRate(s))}
                      {s.city ? ` · ${s.city}` : ""}
                      {s.age !== null ? ` · ${s.age} years old` : ""}
                    </p>
                    {s.education && (
                      <p className="text-sm text-slate-600">{s.education}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge color="green">Interviewed by Ri&apos;aya</Badge>
                      {vsc.has(s.userId) && (
                        <Badge color="green">Police check verified</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {s.bio && (
                  <p className="mt-3 line-clamp-3 text-sm text-slate-600">
                    {s.bio}
                  </p>
                )}
                <p className="mt-3 text-sm font-medium text-brand-coral">
                  View profile →
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/parent/schedule">See availability</ButtonLink>
        <ButtonLink href="/parent/requests/new" variant="secondary">
          Request a sitter
        </ButtonLink>
      </div>
    </div>
  );
}
