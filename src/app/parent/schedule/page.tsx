import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getParentBookingEligibility } from "@/lib/verification";
import { getBusinessSettings } from "@/lib/settings";
import { isLastMinute } from "@/lib/pricing";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageTitle,
} from "@/components/ui";
import { dt, moneyHr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const user = await requireRole("PARENT");
  const eligibility = await getParentBookingEligibility(user.id);
  // Booking is gated on verification level; send unverified parents to verify.
  if (!eligibility.canBook) redirect("/parent/verify");
  const settings = await getBusinessSettings();

  // Only listed sitters (and only their non-suspended accounts) with future
  // open slots appear. Listing is the sole parent-facing gate.
  const sitters = await prisma.sitterProfile.findMany({
    where: {
      isListed: true,
      user: { suspended: false },
      slots: { some: { status: "OPEN", startTime: { gte: new Date() } } },
    },
    include: {
      user: { select: { name: true } },
      slots: {
        where: { status: "OPEN", startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { listedPayRate: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Available sitters"
        subtitle="Every sitter here is vetted and listed by Ri'aya. Pick a time to book."
      />
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-teal">
          Don&apos;t see the time you need? Post a request and every listed
          sitter can pick it up.
        </p>
        <ButtonLink href="/parent/requests/new" variant="secondary">
          Request a time
        </ButtonLink>
      </Card>

      {sitters.length === 0 ? (
        <EmptyState>No open availability right now — check back soon.</EmptyState>
      ) : (
        <div className="space-y-4">
          {sitters.map((sp) => (
            <Card key={sp.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{sp.user.name}</h2>
                  {sp.bio && (
                    <p className="mt-1 text-sm text-slate-600">{sp.bio}</p>
                  )}
                </div>
                <Badge color="indigo">{moneyHr(sp.listedPayRate)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sp.slots.map((slot) => {
                  const rush = isLastMinute(
                    slot.startTime,
                    settings.lastMinuteThresholdHours,
                  );
                  return (
                    <Link
                      key={slot.id}
                      href={`/parent/book/${slot.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:border-brand-teal hover:bg-brand-cream"
                    >
                      {dt(slot.startTime)}
                      {rush && (
                        <span className="ml-1 text-xs text-amber-700">
                          (last-minute)
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
