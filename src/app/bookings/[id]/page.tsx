import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { cancelBooking, completeBooking, payBooking } from "@/lib/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, PageTitle } from "@/components/ui";
import { BOOKING_STATUS_COLOR } from "@/lib/status";
import { dt, money } from "@/lib/format";
import { Chat } from "./Chat";
import { ReportForm } from "./ReportForm";

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      parent: { select: { id: true, name: true } },
      sitter: { select: { id: true, name: true } },
      availabilitySlot: true,
    },
  });
  if (!booking) notFound();

  const isParent = booking.parentId === user.id;
  const isSitter = booking.sitterId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isParent && !isSitter && !isAdmin) redirect("/");

  const addressReleased = booking.status !== "CANCELLED";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle title="Booking" subtitle={dt(booking.dateTime)} />
        <Badge color={BOOKING_STATUS_COLOR[booking.status]}>
          {booking.status}
        </Badge>
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">Parent</dt>
          <dd>{booking.parent.name}</dd>
          <dt className="text-slate-500">Sitter</dt>
          <dd>{booking.sitter.name}</dd>
          <dt className="text-slate-500">When</dt>
          <dd>
            {dt(booking.availabilitySlot.startTime)} → {" "}
            {dt(booking.availabilitySlot.endTime)} ({booking.durationHours}h)
          </dd>
          <dt className="text-slate-500">Children</dt>
          <dd>
            {booking.numberOfChildren} child(ren), ages {booking.childrenAgeRange}
          </dd>
          {booking.notes && (
            <>
              <dt className="text-slate-500">Notes</dt>
              <dd>{booking.notes}</dd>
            </>
          )}
          <dt className="text-slate-500">Waiver</dt>
          <dd>
            {booking.waiverVersion} accepted {dt(booking.waiverAcceptedAt)}
          </dd>
        </dl>
      </Card>

      {/* Pricing */}
      <Card>
        <h2 className="font-semibold">Pricing</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">
              Listed rate {money(booking.listedRateSnapshot)}/hr ×{" "}
              {booking.durationHours}h
            </span>
            <span>{money(booking.baseAmount)}</span>
          </div>
          {booking.rushFeeAmount > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>Last-minute rush fee</span>
              <span>{money(booking.rushFeeAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Platform fee</span>
            <span>{money(booking.platformFeeAmount)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <span>{isSitter ? "You earn" : "Total"}</span>
            <span>
              {isSitter
                ? money(booking.baseAmount + booking.rushFeeAmount)
                : money(booking.totalAmount)}
            </span>
          </div>
        </dl>
      </Card>

      {/* Actions */}
      <Card className="flex flex-wrap gap-3">
        {isParent && booking.status === "REQUESTED" && (
          <ActionButton action={payBooking.bind(null, booking.id)}>
            Pay {money(booking.totalAmount)}
          </ActionButton>
        )}
        {booking.status === "CONFIRMED" && (isParent || isAdmin) && (
          <ActionButton action={completeBooking.bind(null, booking.id)}>
            Mark completed
          </ActionButton>
        )}
        {["REQUESTED", "CONFIRMED"].includes(booking.status) && (
          <ActionButton
            action={cancelBooking.bind(null, booking.id)}
            variant="secondary"
            confirm="Cancel this booking?"
          >
            Cancel
          </ActionButton>
        )}
        {booking.status === "COMPLETED" && (
          <p className="text-sm text-emerald-700">
            Completed — payout released to the sitter.
          </p>
        )}
      </Card>

      {/* Messaging — always free, available once a booking exists. */}
      {(isParent || isSitter) && addressReleased && (
        <Card>
          <h2 className="mb-3 font-semibold">Messages</h2>
          <Chat bookingId={booking.id} meId={user.id} />
        </Card>
      )}

      {/* Report */}
      {(isParent || isSitter) && (
        <Card>
          <ReportForm bookingId={booking.id} />
        </Card>
      )}
    </div>
  );
}
