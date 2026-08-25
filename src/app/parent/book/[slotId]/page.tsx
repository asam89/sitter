import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  getParentBookingEligibility,
  getServiceAddressOnFile,
} from "@/lib/verification";
import { getBusinessSettings } from "@/lib/settings";
import { getActiveTerms } from "@/lib/terms";
import { computePrice, effectiveRate, isLastMinute } from "@/lib/pricing";
import { refundPolicyLines } from "@/lib/cancellation";
import { createBooking } from "@/lib/actions";
import { differenceInMinutes } from "date-fns";
import { Card, PageTitle } from "@/components/ui";
import { dt, money } from "@/lib/format";
import { BookingForm } from "./BookingForm";

export const dynamic = "force-dynamic";

export default async function BookSlotPage({
  params,
}: {
  params: { slotId: string };
}) {
  const user = await requireRole("PARENT");
  const eligibility = await getParentBookingEligibility(user.id);
  if (!eligibility.canBook) redirect("/parent/verify");
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: params.slotId },
    include: {
      sitterProfile: { include: { user: { select: { name: true } } } },
    },
  });
  if (!slot || slot.status !== "OPEN" || !slot.sitterProfile.isListed) {
    notFound();
  }

  const settings = await getBusinessSettings();
  const terms = await getActiveTerms();
  const addressOnFile = await getServiceAddressOnFile(user.id);
  const duration = Math.max(
    1,
    Math.round(differenceInMinutes(slot.endTime, slot.startTime) / 60),
  );
  const lastMinute = isLastMinute(
    slot.startTime,
    settings.lastMinuteThresholdHours,
  );
  // Quoted for one child; each additional child adds a flat fee, itemised on
  // the booking once the parent has said how many children there are.
  const price = computePrice(
    effectiveRate(slot.sitterProfile),
    duration,
    lastMinute,
    settings,
    slot.startTime,
    1,
  );
  const tooShort = duration < settings.minBookingHours;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title={`Book ${slot.sitterProfile.user.name}`}
        subtitle={`${dt(slot.startTime)} → ${dt(slot.endTime)} · ${duration}h`}
      />

      {/* Transparent pricing — shown before commitment, rush fee itemised. */}
      <Card>
        <h2 className="font-semibold">Price</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row
            label={`Sitter's rate — ${money(price.listedRate)}/hr × ${duration}h`}
            value={money(price.base)}
          />
          {price.rushFee > 0 && (
            <Row
              label={
                <span className="text-amber-700">
                  Last-minute rush fee
                  {settings.rushFeeType === "PERCENT"
                    ? ` (${settings.rushFeeAmount}%)`
                    : ""}
                </span>
              }
              value={money(price.rushFee)}
            />
          )}
          {price.lateNightFee > 0 && (
            <Row
              label={`Late-night fee (${settings.lateNightStartHour}:00–${settings.lateNightEndHour}:00)`}
              value={money(price.lateNightFee)}
            />
          )}
          {price.overnightFee > 0 && (
            <Row
              label={`Overnight fee (${settings.overnightStartHour}:00–${settings.overnightEndHour}:00)`}
              value={money(price.overnightFee)}
            />
          )}
          {settings.extraChildFeeAmount > 0 && (
            <Row
              label="Each additional child"
              value={`+ ${money(settings.extraChildFeeAmount)}`}
            />
          )}
          <Row
            label={`Ri'aya fee${settings.platformFeeType === "PERCENT" ? ` (${settings.platformFeeAmount}%)` : ""}`}
            value={money(price.platformFee)}
          />
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <span>
              Total{settings.extraChildFeeAmount > 0 ? " (1 child)" : ""}
            </span>
            <span>{money(price.total)}</span>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Once the sitter accepts, you pay in full to confirm the booking.
        </p>
        {lastMinute && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This booking is within {settings.lastMinuteThresholdHours}h of the
            start time, so a rush fee applies.
          </p>
        )}
      </Card>

      {/* Cancellation terms, disclosed before any commitment. */}
      <Card>
        <h2 className="font-semibold">If plans change</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {refundPolicyLines(settings).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>

      {tooShort ? (
        <Card>
          <p className="text-sm text-slate-700">
            This block is {duration}h and bookings are a minimum of{" "}
            {settings.minBookingHours} hours. Ask this sitter for a longer
            block, or post a request for the time you need.
          </p>
        </Card>
      ) : (
        <BookingForm
          slotId={slot.id}
          action={createBooking}
          termsVersion={terms.version}
          termsBody={terms.body}
          addressOnFile={addressOnFile}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}
