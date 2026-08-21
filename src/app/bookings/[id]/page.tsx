import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  approveBooking,
  cancelBooking,
  completeBooking,
  declineBooking,
  payBooking,
  startBooking,
} from "@/lib/actions";
import { getBusinessSettings } from "@/lib/settings";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, PageTitle } from "@/components/ui";
import { BOOKING_STATUS_COLOR } from "@/lib/status";
import { bookingRef, dt, money } from "@/lib/format";
import { Chat } from "./Chat";
import { ReportForm } from "./ReportForm";
import { ReviewForm } from "./ReviewForm";

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
      reviews: true,
    },
  });
  if (!booking) notFound();

  const settings = await getBusinessSettings();

  const isParent = booking.parentId === user.id;
  const isSitter = booking.sitterId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isParent && !isSitter && !isAdmin) redirect("/");

  const messagingOpen = !["CANCELLED", "DECLINED"].includes(booking.status);

  // Service address (+ phone) is released to the sitter ONLY once the sitter has
  // approved (addressReleasedAt is set then) — never while REQUESTED, never
  // before, never in a URL. The parent always sees their own; Admin sees it for
  // support.
  const addr = booking.parent.parentProfile;
  const addressUnlocked = booking.addressReleasedAt != null;
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
        <PageTitle
          title={`Booking ${bookingRef(booking.bookingNumber)}`}
          subtitle={dt(booking.dateTime)}
        />
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
              Shared with you because you approved this booking.
            </p>
          )}
          {isParent && booking.status === "REQUESTED" && (
            <p className="mt-1 text-xs text-slate-500">
              Your sitter will see this address only after they approve the
              booking.
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

      {/* Actions — one card per lifecycle stage */}
      <Card className="space-y-3">
        {/* Sitter approves/declines a pending request */}
        {isSitter && booking.status === "REQUESTED" && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              You&apos;d earn{" "}
              <strong>{money(booking.baseAmount + booking.rushFeeAmount)}</strong>{" "}
              at Ri&apos;aya&apos;s set rate. Approving releases the family&apos;s
              full address to you.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionButton action={approveBooking.bind(null, booking.id)}>
                Approve at {money(booking.baseAmount + booking.rushFeeAmount)}
              </ActionButton>
              <ActionButton
                action={declineBooking.bind(null, booking.id)}
                variant="secondary"
                confirm="Decline this booking? The slot will reopen."
              >
                Decline
              </ActionButton>
            </div>
          </div>
        )}

        {/* Parent pays after the sitter approves */}
        {isParent && booking.status === "APPROVED" && !booking.paidAt && (
          <ActionButton action={payBooking.bind(null, booking.id)}>
            Pay {money(booking.totalAmount)}
          </ActionButton>
        )}
        {isParent && booking.status === "REQUESTED" && (
          <p className="text-sm text-slate-600">
            Waiting for {booking.sitter.name} to approve. You&apos;ll pay once
            they do.
          </p>
        )}

        {/* Start the job (approved + paid) */}
        {booking.status === "APPROVED" &&
          booking.paidAt &&
          (isParent || isSitter || isAdmin) && (
            <ActionButton action={startBooking.bind(null, booking.id)}>
              Mark job started
            </ActionButton>
          )}
        {booking.status === "APPROVED" && !booking.paidAt && isSitter && (
          <p className="text-sm text-slate-600">
            Approved — waiting for the parent to pay.
          </p>
        )}

        {/* Completion — confirmer is configurable */}
        {booking.status === "IN_PROGRESS" &&
          (isAdmin ||
            (settings.completionConfirmedBy === "PARENT" && isParent)) && (
            <ActionButton action={completeBooking.bind(null, booking.id)}>
              Confirm completed &amp; release payout
            </ActionButton>
          )}
        {booking.status === "IN_PROGRESS" &&
          settings.completionConfirmedBy === "ADMIN" &&
          !isAdmin && (
            <p className="text-sm text-slate-600">
              In progress — Ri&apos;aya will confirm completion.
            </p>
          )}

        {/* Cancel — available until the job completes */}
        {["REQUESTED", "APPROVED", "IN_PROGRESS"].includes(booking.status) && (
          <ActionButton
            action={cancelBooking.bind(null, booking.id)}
            variant="secondary"
            confirm="Cancel this booking?"
          >
            Cancel
          </ActionButton>
        )}

        {booking.status === "DECLINED" && (
          <p className="text-sm text-slate-600">
            Declined by the sitter — the slot has reopened.
          </p>
        )}
        {booking.status === "CANCELLED" && (
          <p className="text-sm text-slate-600">
            Cancelled.
            {booking.cancellationChargeAmount > 0 &&
              ` A late-cancellation charge of ${money(
                booking.cancellationChargeAmount,
              )} applied.`}
          </p>
        )}
        {booking.status === "COMPLETED" && (
          <p className="text-sm text-emerald-700">
            Completed — payout released to the sitter.
          </p>
        )}
      </Card>

      {/* Reviews — unlock only after completion, two-way */}
      {booking.status === "COMPLETED" && (isParent || isSitter) && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Reviews</h2>
          {booking.reviews.map((r) => (
            <div key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
                {r.authorId === user.id ? " · your review" : ""}
              </p>
              {r.comment && <p className="mt-1 text-slate-600">{r.comment}</p>}
            </div>
          ))}
          {!booking.reviews.some((r) => r.authorId === user.id) && (
            <ReviewForm
              bookingId={booking.id}
              subjectName={isParent ? booking.sitter.name : booking.parent.name}
            />
          )}
        </Card>
      )}

      {/* Messaging — always free, available once a booking exists. */}
      {(isParent || isSitter) && messagingOpen && (
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
