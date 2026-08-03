import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageTitle,
  Card,
  Badge,
  EmptyState,
  ButtonLink,
} from "@/components/ui";
import { dt, money, moneyHr } from "@/lib/format";
import { BOOKING_STATUS_COLOR } from "@/lib/status";
import { AvailabilityToggle } from "./AvailabilityToggle";
import { OfferActions } from "./OfferActions";
import { markOffersViewed } from "@/lib/sitterView";

export const dynamic = "force-dynamic";

export default async function SitterDashboard() {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
  });

  // Incoming, still-open offers (booking PENDING and unassigned).
  const offers = await prisma.dispatchOffer.findMany({
    where: {
      sitterId: user.id,
      status: { in: ["OFFERED", "VIEWED"] },
      booking: { status: "PENDING", sitterId: null },
    },
    include: { booking: { include: { parent: { select: { name: true } } } } },
    orderBy: { offeredAt: "desc" },
  });
  await markOffersViewed(offers.map((o) => o.id));

  const bookings = await prisma.booking.findMany({
    where: { sitterId: user.id },
    orderBy: { createdAt: "desc" },
    include: { parent: { select: { name: true } } },
    take: 15,
  });

  return (
    <div className="space-y-8">
      <PageTitle title={`Hi, ${user.name}`} subtitle="Your sitter dashboard" />

      <Card className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Available now</div>
          <div className="text-sm text-slate-500">
            Toggle on to receive on-demand requests.
          </div>
        </div>
        <AvailabilityToggle initial={profile?.isAvailableNow ?? false} />
      </Card>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/sitter/profile" variant="secondary">
          Edit profile ({profile ? moneyHr(profile.hourlyRate) : "—"})
        </ButtonLink>
        <ButtonLink href="/sitter/endorsements" variant="secondary">
          Community endorsements
        </ButtonLink>
        <ButtonLink href="/sitter/verification" variant="secondary">
          Verification documents
        </ButtonLink>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Incoming requests</h2>
        {offers.length === 0 ? (
          <EmptyState>
            No open requests right now. Turn on &quot;Available now&quot; to get
            dispatched.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {offers.map((o) => (
              <Card key={o.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {o.booking.numberOfChildren} child(ren), ages{" "}
                    {o.booking.childrenAgeRange}
                  </div>
                  <Badge
                    color={
                      o.tier === "COMMUNITY_ENDORSED" ? "green" : "indigo"
                    }
                  >
                    {o.tier === "COMMUNITY_ENDORSED"
                      ? "Community request"
                      : "Platform request"}
                  </Badge>
                </div>
                <div className="text-sm text-slate-500">
                  {o.booking.requestType === "NOW" ? "Now" : dt(o.booking.dateTime)}{" "}
                  · {o.booking.durationHours}h · Parent {o.booking.parent.name} ·
                  earns {money(o.booking.sitterHourlyRate * o.booking.durationHours)}
                </div>
                <OfferActions bookingId={o.bookingId} />
              </Card>
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
                      {b.parent.name} · {b.numberOfChildren} child(ren)
                    </div>
                    <div className="text-sm text-slate-500">
                      {dt(b.dateTime)} · {b.durationHours}h
                    </div>
                  </div>
                  <Badge color={BOOKING_STATUS_COLOR[b.status]}>
                    {b.status}
                  </Badge>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
