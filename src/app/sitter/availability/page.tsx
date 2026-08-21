import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { addMySlot, deleteMySlot, editMySlot } from "@/lib/actions";
import { AvailabilityWeek, type SlotView } from "@/components/AvailabilityWeek";
import { WeekNav } from "@/components/WeekNav";
import { PageTitle } from "@/components/ui";
import { weekWindow } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: { week?: string; days?: string };
}) {
  const user = await requireRole("SITTER");
  const week = weekWindow(searchParams);

  const profile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
    include: {
      slots: {
        // Any block overlapping the visible week.
        where: { startTime: { lt: week.end }, endTime: { gt: week.start } },
        orderBy: { startTime: "asc" },
        include: {
          booking: { select: { id: true, parent: { select: { name: true } } } },
        },
      },
    },
  });
  if (!profile) redirect("/sitter");

  const slots: SlotView[] = profile.slots.map((s) => ({
    id: s.id,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    status: s.status,
    isLastMinuteEligible: s.isLastMinuteEligible,
    bookingHref: s.booking ? `/bookings/${s.booking.id}` : null,
    bookingLabel: s.booking ? `Booked · ${s.booking.parent.name}` : null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageTitle
        title="Your availability"
        subtitle="Drag out the hours you're free. Parents can book these once Ri'aya has you listed."
      />

      <WeekNav basePath="/sitter/availability" week={week} />

      <AvailabilityWeek
        weekStart={week.weekStart}
        dayCount={week.dayCount}
        slots={slots}
        createAction={addMySlot}
        editAction={editMySlot}
        deleteAction={deleteMySlot}
      />
    </div>
  );
}
