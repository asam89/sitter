import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card, Badge } from "@/components/ui";
import { dt, money } from "@/lib/format";
import { BOOKING_STATUS_COLOR } from "@/lib/status";
import { computePrice } from "@/lib/pricing";
import {
  payBooking,
  completeBooking,
  cancelBooking,
} from "@/lib/actions";
import { LiveStatus } from "./LiveStatus";
import { Chat } from "./Chat";
import { ReviewForm } from "./ReviewForm";
import { ReportForm } from "./ReportForm";
import { ActionButton } from "@/components/ActionButton";

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
      reviews: true,
    },
  });
  if (!booking) notFound();
  if (booking.parentId !== user.id && booking.sitterId !== user.id) notFound();

  const isParent = booking.parentId === user.id;
  const price = computePrice(
    booking.sitterHourlyRate,
    booking.platformFeePct,
    booking.durationHours,
  );
  const matched = ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(
    booking.status,
  );
  const myReview = booking.reviews.find((r) => r.authorId === user.id);
  const counterpartId = isParent ? booking.sitterId : booking.parentId;

  return (
    <div className="space-y-6">
      <PageTitle
        title={`${booking.requestType === "NOW" ? "On-demand" : "Scheduled"} booking`}
        subtitle={`${booking.numberOfChildren} child(ren), ages ${booking.childrenAgeRange}`}
      />

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge color={BOOKING_STATUS_COLOR[booking.status]}>
            {booking.status}
          </Badge>
          <span className="text-sm text-slate-500">{dt(booking.dateTime)}</span>
        </div>

        {booking.status === "PENDING" && (
          <LiveStatus bookingId={booking.id} initialStatus={booking.status} />
        )}

        <div className="text-sm text-slate-600">
          {booking.sitter ? (
            <>Sitter: <strong>{booking.sitter.name}</strong></>
          ) : (
            "Awaiting a sitter to accept…"
          )}
          {" · "}Parent: {booking.parent.name}
        </div>

        {matched && booking.addressReleasedAt && booking.address && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            Address (released after acceptance): {booking.address}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Transparent pricing</h2>
        <div className="space-y-1 text-sm">
          <Row label="Sitter rate" value={`$${booking.sitterHourlyRate}/hr`} />
          <Row
            label={`Platform fee (${booking.platformFeePct}%)`}
            value={`$${price.platformFeePerHour}/hr`}
          />
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <span>Total ({booking.durationHours}h)</span>
            <span>{money(booking.totalAmount)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isParent && booking.status === "ACCEPTED" && (
            <ActionButton action={payBooking.bind(null, booking.id)}>
              Pay {money(booking.totalAmount)}
            </ActionButton>
          )}
          {booking.status === "IN_PROGRESS" && (
            <ActionButton action={completeBooking.bind(null, booking.id)}>
              Mark completed
            </ActionButton>
          )}
          {["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(booking.status) && (
            <ActionButton
              action={cancelBooking.bind(null, booking.id)}
              variant="secondary"
            >
              Cancel
            </ActionButton>
          )}
        </div>
        {booking.status === "IN_PROGRESS" && (
          <p className="mt-2 text-xs text-slate-500">
            Payment is held and released to the sitter (minus the platform fee)
            once the booking is marked completed.
          </p>
        )}
      </Card>

      {matched && counterpartId && (
        <Card>
          <h2 className="mb-2 font-semibold">Messages</h2>
          <p className="mb-3 text-xs text-slate-500">
            Messaging is always free and unlocked once matched.
          </p>
          <Chat bookingId={booking.id} meId={user.id} />
        </Card>
      )}

      {booking.status === "COMPLETED" && counterpartId && (
        <Card>
          <h2 className="mb-2 font-semibold">Review</h2>
          {myReview ? (
            <p className="text-sm text-slate-600">
              You rated {myReview.rating}★. Reviews are permanent once posted.
            </p>
          ) : (
            <ReviewForm bookingId={booking.id} />
          )}
        </Card>
      )}

      {counterpartId && (
        <Card>
          <h2 className="mb-2 font-semibold">Safety</h2>
          <ReportForm
            targetType="USER"
            targetId={counterpartId}
            label="Report the other party"
          />
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}
