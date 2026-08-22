import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { effectiveRate } from "@/lib/pricing";
import { requireRole } from "@/lib/session";
import { adminAddSlot, adminDeleteSlot, adminEditSlot } from "@/lib/actions";
import { AvailabilityWeek, type SlotView } from "@/components/AvailabilityWeek";
import { WeekNav } from "@/components/WeekNav";
import { PageTitle } from "@/components/ui";
import { bookingRef, moneyHr } from "@/lib/format";
import { weekWindow } from "@/lib/week";

export const dynamic = "force-dynamic";

function hours(startTime: Date, endTime: Date): number {
  return (endTime.getTime() - startTime.getTime()) / 3_600_000;
}

export default async function AdminSitterAvailability({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { week?: string; days?: string };
}) {
  await requireRole("ADMIN");
  const week = weekWindow(searchParams);

  const sp = await prisma.sitterProfile.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true } },
      slots: {
        // Any block overlapping the visible week.
        where: { startTime: { lt: week.end }, endTime: { gt: week.start } },
        orderBy: { startTime: "asc" },
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              parent: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!sp) notFound();

  const slots: SlotView[] = sp.slots.map((s) => ({
    id: s.id,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    status: s.status,
    isLastMinuteEligible: s.isLastMinuteEligible,
    bookingHref: s.booking ? `/bookings/${s.booking.id}` : null,
    bookingLabel: s.booking
      ? `${bookingRef(s.booking.bookingNumber)} · ${s.booking.parent.name}`
      : null,
  }));

  const openHours = sp.slots
    .filter((s) => s.status === "OPEN")
    .reduce((sum, s) => sum + hours(s.startTime, s.endTime), 0);
  const bookedHours = sp.slots
    .filter((s) => s.status !== "OPEN")
    .reduce((sum, s) => sum + hours(s.startTime, s.endTime), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageTitle
        title={`${sp.user.name} — hours`}
        subtitle={`Rate ${moneyHr(effectiveRate(sp))} · ${
          sp.isListed ? "listed" : "unlisted"
        } · this week: ${openHours}h open, ${bookedHours}h booked`}
      />

      <WeekNav basePath={`/admin/sitters/${sp.id}`} week={week} />

      <AvailabilityWeek
        weekStart={week.weekStart}
        dayCount={week.dayCount}
        slots={slots}
        createAction={adminAddSlot.bind(null, sp.id)}
        editAction={adminEditSlot}
        deleteAction={adminDeleteSlot}
      />
    </div>
  );
}
