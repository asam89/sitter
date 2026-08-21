import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { adminAddSlot, adminDeleteSlot, adminEditSlot } from "@/lib/actions";
import { ActionButton } from "@/components/ActionButton";
import { SlotEditor } from "@/components/SlotEditor";
import {
  Badge,
  Card,
  EmptyState,
  PageTitle,
  buttonClass,
} from "@/components/ui";
import { bookingRef, dt, moneyHr } from "@/lib/format";

export const dynamic = "force-dynamic";

function hours(startTime: Date, endTime: Date): number {
  return (endTime.getTime() - startTime.getTime()) / 3_600_000;
}

export default async function AdminSitterAvailability({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("ADMIN");
  const sp = await prisma.sitterProfile.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true } },
      slots: {
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

  const addSlot = adminAddSlot.bind(null, sp.id);
  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  const now = new Date();
  const upcoming = sp.slots.filter((s) => s.endTime >= now);
  const openHours = upcoming
    .filter((s) => s.status === "OPEN")
    .reduce((sum, s) => sum + hours(s.startTime, s.endTime), 0);
  const bookedHours = upcoming
    .filter((s) => s.status !== "OPEN")
    .reduce((sum, s) => sum + hours(s.startTime, s.endTime), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle
        title={`${sp.user.name} — hours`}
        subtitle={`Listed rate ${moneyHr(sp.listedPayRate)} · ${
          sp.isListed ? "listed" : "unlisted"
        } · upcoming: ${openHours}h open, ${bookedHours}h booked`}
      />

      <Card>
        <form action={addSlot} className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium">
            Start
            <input
              type="datetime-local"
              name="startTime"
              required
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            End
            <input
              type="datetime-local"
              name="endTime"
              required
              className={input}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isLastMinuteEligible" />
            Last-minute OK
          </label>
          <button type="submit" className={buttonClass()}>
            Add hours
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Open blocks can be edited or removed. Booked blocks are locked — their
          booking pins the time, so cancel the booking first to move it.
        </p>
      </Card>

      {sp.slots.length === 0 ? (
        <EmptyState>No availability set.</EmptyState>
      ) : (
        <div className="space-y-2">
          {sp.slots.map((slot) => (
            <Card key={slot.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm">
                    {dt(slot.startTime)} → {dt(slot.endTime)}
                  </p>
                  <span className="text-xs text-slate-400">
                    {hours(slot.startTime, slot.endTime)}h
                  </span>
                  {slot.isLastMinuteEligible && (
                    <Badge color="amber">Last-minute OK</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={slot.status === "OPEN" ? "green" : "indigo"}>
                    {slot.status}
                  </Badge>
                  {slot.booking ? (
                    <Link
                      href={`/bookings/${slot.booking.id}`}
                      className="text-sm font-medium text-brand-coral"
                    >
                      {bookingRef(slot.booking.bookingNumber)} ·{" "}
                      {slot.booking.parent.name}
                    </Link>
                  ) : (
                    <>
                      <SlotEditor
                        action={adminEditSlot.bind(null, slot.id)}
                        startTime={slot.startTime.toISOString()}
                        endTime={slot.endTime.toISOString()}
                        isLastMinuteEligible={slot.isLastMinuteEligible}
                      />
                      <ActionButton
                        action={adminDeleteSlot.bind(null, slot.id)}
                        variant="secondary"
                        confirm="Remove this slot?"
                      >
                        Remove
                      </ActionButton>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
