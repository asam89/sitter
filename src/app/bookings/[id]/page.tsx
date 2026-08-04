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
      parent: {
        select: {
          id: true,
          name: true,
          phone: true,
          parentProfile: {
            select: {
              streetAddress: true,
              unit: true,
              city: true,
              province: true,
              postalCode: true,
            },
          },
        },
      },
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

  // Service address (+ phone) is released to the sitter ONLY once the booking
  // is paid/confirmed — never while REQUESTED, never before, never in a URL.
  // The parent always sees their own; an Admin can see it for support.
  const addr = booking.parent.parentProfile;
  const addressUnlocked =
    booking.status === "CONFIRMED" || booking.status === "COMPLETED";
  const showServiceAddress =
    !!addr &&
    (isParent || isAdmin || (isSitter && addressUnlocked));
  const fullAddress = addr
    ? [
        addr.streetAddress,
        addr.unit ? `Unit ${addr.unit}` : null,
        addr.city,
        addr.province,
        addr.postalCode,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

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

      {/* Service address — released to the sitter only once confirmed. */}
      {showServiceAddress && fullAddress && (
        <Card>
          <h2 className="font-semibold">Service address</h2>
          <p className="mt-2 text-sm text-slate-700">{fullAddress}</p>
          {isSitter && (
            <p className="mt-1 text-xs text-slate-500">
              Shared with you because this booking is confirmed.
            </p>
          )}
          {isParent && booking.status === "REQUESTED" && (
            <p className="mt-1 text-xs text-slate-500">
              Your sitter will see this address only after you pay and the
              booking is confirmed.
            </p>
          )}
        </Card>
      )}

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
