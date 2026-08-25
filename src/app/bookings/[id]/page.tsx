import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  adminMarkBookingPaid,
  approveBooking,
  cancelBookingWithReason,
  completeBooking,
  declineBooking,
  payBooking,
  startBooking,
} from "@/lib/actions";
import { getBusinessSettings } from "@/lib/settings";
import { getActiveTerms } from "@/lib/terms";
import { REFUND_TIER_LABEL, refundPolicyLines } from "@/lib/cancellation";
import { readBookingMedical } from "@/lib/child-medical";
import { hasServiceAddress } from "@/lib/verification";
import { InterviewCard } from "./InterviewCard";
import { PaymentChoice } from "./PaymentChoice";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, PageTitle, buttonClass } from "@/components/ui";
import { BOOKING_STATUS_COLOR } from "@/lib/status";
import { bookingRef, dt, money } from "@/lib/format";
import { Chat } from "./Chat";
import { ReportForm } from "./ReportForm";
import { ReviewForm } from "./ReviewForm";

export const dynamic = "force-dynamic";

// Default suggestion for an intro call: ~24h before the session, as a local
// datetime-local value (the app runs in America/Toronto).
function interviewSuggestion(start: Date): string {
  const d = new Date(start.getTime() - 24 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

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
          email: true,
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

  const [settings, terms] = await Promise.all([
    getBusinessSettings(),
    getActiveTerms(),
  ]);

  const isParent = booking.parentId === user.id;
  const isSitter = booking.sitterId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isParent && !isSitter && !isAdmin) redirect("/");

  const messagingOpen = !["CANCELLED", "DECLINED"].includes(booking.status);

  // Health details: the parent who entered them, and the assigned sitter once
  // the booking is paid. Admins never see them.
  const medical = await readBookingMedical(booking, user);
  const medicalWithheldFromSitter =
    isSitter && !booking.paidAt && booking.status !== "CANCELLED";

  // Service address (+ phone) is released to the sitter ONLY once the sitter has
  // approved (addressReleasedAt is set then) — never while REQUESTED, never
  // before, never in a URL. The parent always sees their own; Admin sees it for
  // support.
  const addr = booking.parent.parentProfile;
  const addressUnlocked = booking.addressReleasedAt != null;
  const addressComplete = !!addr && hasServiceAddress(addr);
  const showServiceAddress =
    !!addr && (isParent || isAdmin || (isSitter && addressUnlocked));
  // The sitter needs to reach the family directly once they own the booking —
  // same release point as the address.
  const showParentContact = isAdmin || (isSitter && addressUnlocked);
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
        <div className="flex items-center gap-2">
          <Badge color={BOOKING_STATUS_COLOR[booking.status]}>
            {booking.status}
          </Badge>
          {booking.paidAt && booking.status !== "CANCELLED" && (
            <Badge color="green">PAID</Badge>
          )}
        </div>
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">Parent</dt>
          <dd>{booking.parent.name}</dd>
          <dt className="text-slate-500">Sitter</dt>
          <dd>{booking.sitter.name}</dd>
          <dt className="text-slate-500">When</dt>
          <dd>
            {dt(booking.availabilitySlot.startTime)} →{" "}
            {dt(booking.availabilitySlot.endTime)} ({booking.durationHours}h)
          </dd>
          <dt className="text-slate-500">Children</dt>
          <dd>
            {booking.numberOfChildren} child(ren), ages{" "}
            {booking.childrenAgeRange}
          </dd>
          {booking.notes && (
            <>
              <dt className="text-slate-500">Notes</dt>
              <dd>{booking.notes}</dd>
            </>
          )}
          <dt className="text-slate-500">Waiver</dt>
          <dd>
            {booking.waiverAcceptedAt
              ? `${booking.waiverVersion} accepted ${dt(booking.waiverAcceptedAt)}`
              : `${booking.waiverVersion} — not yet accepted`}
          </dd>
          {booking.paymentMethod && (
            <>
              <dt className="text-slate-500">Payment</dt>
              <dd>
                {booking.paymentMethod === "CARD"
                  ? "Credit card"
                  : "Interac e-Transfer"}
                {booking.paidAt ? "" : " — awaiting funds"}
              </dd>
            </>
          )}
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

      {showParentContact && (
        <Card>
          <h2 className="font-semibold">Parent contact</h2>
          <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Name</dt>
            <dd>{booking.parent.name}</dd>
            <dt className="text-slate-500">Phone</dt>
            <dd>
              {booking.parent.phone ? (
                <a href={`tel:${booking.parent.phone}`} className="underline">
                  {booking.parent.phone}
                </a>
              ) : (
                <span className="text-slate-500">Not provided</span>
              )}
            </dd>
            <dt className="text-slate-500">Email</dt>
            <dd>
              <a href={`mailto:${booking.parent.email}`} className="underline">
                {booking.parent.email}
              </a>
            </dd>
          </dl>
          {isSitter && (
            <p className="mt-2 text-xs text-slate-500">
              Shared with you because you approved this booking. Use it for this
              booking only.
            </p>
          )}
          {isSitter &&
            !booking.waiverAcceptedAt &&
            !["CANCELLED", "DECLINED", "COMPLETED"].includes(
              booking.status,
            ) && (
              <p className="mt-2 text-sm text-amber-700">
                {booking.parent.name} hasn&apos;t accepted the waiver yet — the
                booking is only confirmed once they accept it and pay. A quick
                call or email helps.
              </p>
            )}
        </Card>
      )}

      {medical && medical.length > 0 && (
        <Card>
          <h2 className="font-semibold">Health &amp; care needs</h2>
          <p className="mt-1 text-xs text-slate-500">
            Encrypted; visible only to {booking.parent.name} and{" "}
            {booking.sitter.name}. Deleted 60 days after the session.
          </p>
          <div className="mt-3 space-y-3 text-sm">
            {medical.map((child) => (
              <div key={child.childIndex}>
                <p className="font-medium">
                  {child.label}
                  {child.ageYears !== null ? ` · ${child.ageYears}` : ""}
                </p>
                {child.allergies && <p>Allergies: {child.allergies}</p>}
                {child.conditions && <p>Conditions: {child.conditions}</p>}
                {child.medications && <p>Medications: {child.medications}</p>}
                {child.specialNeeds && <p>Notes: {child.specialNeeds}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
      {medicalWithheldFromSitter && (
        <Card>
          <p className="text-sm text-slate-600">
            If this family has shared allergies or medical needs, they are
            released to you once the booking is paid.
          </p>
        </Card>
      )}

      {(isParent || isSitter) &&
        !["CANCELLED", "DECLINED"].includes(booking.status) && (
          <InterviewCard
            booking={{
              id: booking.id,
              interviewStatus: booking.interviewStatus,
              interviewScheduledAt: booking.interviewScheduledAt,
              interviewMethod: booking.interviewMethod,
              interviewNote: booking.interviewNote,
              parentName: booking.parent.name,
              sitterName: booking.sitter.name,
            }}
            isParent={isParent}
            isSitter={isSitter}
            suggestedAt={interviewSuggestion(booking.dateTime)}
          />
        )}

      {/* Pricing */}
      <Card>
        <h2 className="font-semibold">Pricing</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">
              Sitter&apos;s rate {money(booking.listedRateSnapshot)}/hr ×{" "}
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
          {booking.extraChildFeeAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">
                Extra children ({booking.numberOfChildren} total)
              </span>
              <span>{money(booking.extraChildFeeAmount)}</span>
            </div>
          )}
          {booking.lateNightFeeAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Late-night fee</span>
              <span>{money(booking.lateNightFeeAmount)}</span>
            </div>
          )}
          {booking.overnightFeeAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Overnight fee</span>
              <span>{money(booking.overnightFeeAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Ri&apos;aya fee</span>
            <span>{money(booking.platformFeeAmount)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <span>{isSitter ? "You earn" : "Total"}</span>
            <span>
              {isSitter
                ? money(booking.totalAmount - booking.platformFeeAmount)
                : money(booking.totalAmount)}
            </span>
          </div>
          {booking.paidAt && (
            <div className="flex justify-between text-emerald-700">
              <span>Paid {dt(booking.paidAt)}</span>
              <span>
                {isSitter ? "Payout on completion" : "Receipt on file"}
              </span>
            </div>
          )}
        </dl>
      </Card>

      {/* Actions — one card per lifecycle stage */}
      <Card className="space-y-3">
        {/* Sitter approves/declines a pending request */}
        {isSitter && booking.status === "REQUESTED" && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              You&apos;d earn{" "}
              <strong>
                {money(booking.totalAmount - booking.platformFeeAmount)}
              </strong>{" "}
              at your rate. Approving releases the family&apos;s full address to
              you.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionButton action={approveBooking.bind(null, booking.id)}>
                Approve at{" "}
                {money(booking.totalAmount - booking.platformFeeAmount)}
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
          <div className="space-y-2">
            <PaymentChoice
              action={payBooking}
              bookingId={booking.id}
              amount={money(booking.totalAmount)}
              etransferEmail={settings.etransferEmail}
              bookingRef={bookingRef(booking.bookingNumber)}
              termsVersion={booking.waiverVersion}
              termsBody={terms.body}
              waiverOutstanding={!booking.waiverAcceptedAt}
              addressOnFile={
                addressComplete && fullAddress ? { line: fullAddress } : null
              }
            />
            {booking.paymentMethod === "ETRANSFER" && (
              <p className="text-sm text-amber-800">
                Waiting on your e-Transfer of {money(booking.totalAmount)} to{" "}
                {settings.etransferEmail}. We&apos;ll confirm the booking as
                soon as it arrives.
              </p>
            )}
            {/* Cancellation terms restated at the point of payment. */}
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
              {refundPolicyLines(settings).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {isParent && booking.status === "REQUESTED" && (
          <p className="text-sm text-slate-600">
            {booking.createdByAdminId
              ? `We set this booking up for you. ${booking.sitter.name} is confirming it — you'll accept the waiver and pay once they do.`
              : `Waiting for ${booking.sitter.name} to approve. You'll pay once they do.`}
          </p>
        )}

        {/* Admin records an offline payment (e-Transfer or cash) */}
        {isAdmin && booking.status === "APPROVED" && !booking.paidAt && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              {booking.paymentMethod === "ETRANSFER"
                ? `The parent chose to pay ${money(booking.totalAmount)} by e-Transfer.`
                : `Awaiting payment of ${money(booking.totalAmount)} from the parent.`}
            </p>
            {booking.waiverAcceptedAt ? (
              <ActionButton
                action={adminMarkBookingPaid.bind(null, booking.id)}
                confirm="Mark this booking paid? Only do this once the money has actually arrived."
              >
                Mark paid ({money(booking.totalAmount)} received)
              </ActionButton>
            ) : (
              <p className="text-sm text-amber-800">
                The parent still has to accept the waiver before this booking
                can be marked paid.
              </p>
            )}
          </div>
        )}

        {/* Start the job (approved + paid) */}
        {booking.status === "APPROVED" &&
          booking.paidAt &&
          (isParent || isSitter || isAdmin) && (
            <div className="space-y-2">
              <p className="text-sm text-emerald-700">
                Paid and confirmed — {booking.sitter.name} is booked for{" "}
                {dt(booking.dateTime)}
              </p>
              <ActionButton action={startBooking.bind(null, booking.id)}>
                Mark job started
              </ActionButton>
            </div>
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
          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Cancel this booking
            </summary>
            <form action={cancelBookingWithReason} className="mt-3 space-y-2">
              <input type="hidden" name="bookingId" value={booking.id} />
              <label className="block text-sm font-medium">
                Reason (optional)
                <input
                  name="reason"
                  maxLength={500}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                {refundPolicyLines(settings).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <button type="submit" className={buttonClass("secondary")}>
                Cancel booking
              </button>
            </form>
          </details>
        )}

        {booking.status === "DECLINED" && (
          <p className="text-sm text-slate-600">
            Declined by the sitter — the slot has reopened.
          </p>
        )}
        {booking.status === "CANCELLED" && (
          <div className="space-y-1 text-sm text-slate-600">
            <p>
              Cancelled
              {booking.cancelledByRole
                ? ` by the ${booking.cancelledByRole.toLowerCase()}`
                : ""}
              {booking.cancelledAt ? ` on ${dt(booking.cancelledAt)}` : ""}
            </p>
            {booking.refundTier && booking.refundPercent !== null && (
              <p>
                {REFUND_TIER_LABEL[booking.refundTier]} —{" "}
                {booking.refundPercent}% refunded ({money(booking.refundAmount)}
                )
                {booking.cancellationChargeAmount > 0
                  ? `, ${money(booking.cancellationChargeAmount)} retained`
                  : ""}
                .
              </p>
            )}
            {booking.cancellationReason && (
              <p>Reason given: &ldquo;{booking.cancellationReason}&rdquo;</p>
            )}
          </div>
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
            <div
              key={r.id}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
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
