import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card, ButtonLink, Badge, EmptyState } from "@/components/ui";
import { dt, money } from "@/lib/format";
import { BOOKING_STATUS_COLOR } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function ParentDashboard() {
  const user = await requireRole("PARENT");
  const [bookings, affiliations] = await Promise.all([
    prisma.booking.findMany({
      where: { parentId: user.id },
      orderBy: { createdAt: "desc" },
      include: { sitter: { select: { name: true } } },
      take: 20,
    }),
    prisma.communityAffiliation.findMany({
      where: { userId: user.id },
      include: { communityPartner: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageTitle
        title={`Welcome, ${user.name}`}
        subtitle="Request trusted childcare on demand or schedule ahead."
      />

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/parent/request">Request now</ButtonLink>
        <ButtonLink href="/sitters" variant="secondary">
          Browse sitters
        </ButtonLink>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your communities</h2>
        {affiliations.length === 0 ? (
          <EmptyState>
            You have no community affiliations.{" "}
            <Link href="/communities" className="font-medium text-indigo-600">
              Join a community
            </Link>{" "}
            to unlock community-endorsed sitters.
          </EmptyState>
        ) : (
          <div className="flex flex-wrap gap-2">
            {affiliations.map((a) => (
              <Badge
                key={a.id}
                color={a.status === "APPROVED" ? "green" : "amber"}
              >
                {a.communityPartner.name} · {a.status}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your bookings</h2>
        {bookings.length === 0 ? (
          <EmptyState>No bookings yet.</EmptyState>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <Link key={b.id} href={`/bookings/${b.id}`} className="block">
                <Card className="flex items-center justify-between hover:border-indigo-300">
                  <div>
                    <div className="font-medium">
                      {b.requestType === "NOW" ? "On-demand" : "Scheduled"} ·{" "}
                      {b.numberOfChildren} child(ren), ages {b.childrenAgeRange}
                    </div>
                    <div className="text-sm text-slate-500">
                      {dt(b.dateTime)} · {b.durationHours}h ·{" "}
                      {b.sitter ? `Sitter: ${b.sitter.name}` : "Finding sitter…"}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge color={BOOKING_STATUS_COLOR[b.status]}>
                      {b.status}
                    </Badge>
                    <div className="mt-1 text-sm font-semibold">
                      {money(b.totalAmount)}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
