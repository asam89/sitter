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
import {
  maxHoursFrom,
  slotDurationHours,
  windowStarts,
} from "@/lib/slot-window";
import { Card, PageTitle } from "@/components/ui";
import { dt, time } from "@/lib/format";
import { BookingForm, type Quote, type StartOption } from "./BookingForm";

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
  const blockHours = slotDurationHours(slot.startTime, slot.endTime);
  const tooShort = blockHours < settings.minBookingHours;

  // Quote every start × length a parent may pick, server-side, so the price
  // shown is exactly what createBooking will store (same TZ, same settings).
  // Quoted for one child; the extra-child fee is itemised in the form.
  const rate = effectiveRate(slot.sitterProfile);
  const starts: StartOption[] = windowStarts(slot, settings.minBookingHours).map(
    (start) => ({
      iso: start.toISOString(),
      label: time(start),
      maxHours: maxHoursFrom(slot, start),
    }),
  );
  const quotes: Record<string, Quote> = {};
  for (const start of starts) {
    const at = new Date(start.iso);
    const lastMinute = isLastMinute(at, settings.lastMinuteThresholdHours);
    for (let h = settings.minBookingHours; h <= start.maxHours; h++) {
      const p = computePrice(rate, h, lastMinute, settings, at, 1);
      quotes[`${start.iso}|${h}`] = {
        endLabel: time(new Date(at.getTime() + h * 3600 * 1000)),
        listedRate: p.listedRate,
        base: p.base,
        rushFee: p.rushFee,
        lateNightFee: p.lateNightFee,
        overnightFee: p.overnightFee,
        platformFee: p.platformFee,
        total: p.total,
        isLastMinute: lastMinute,
      };
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title={`Book ${slot.sitterProfile.user.name}`}
        subtitle={`Available ${dt(slot.startTime)} → ${time(slot.endTime)} · pick the hours you need`}
      />

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
            This block is {blockHours}h and bookings are a minimum of{" "}
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
          starts={starts}
          quotes={quotes}
          minHours={settings.minBookingHours}
          fees={{
            rushLabel:
              settings.rushFeeType === "PERCENT"
                ? `Last-minute rush fee (${settings.rushFeeAmount}%)`
                : "Last-minute rush fee",
            lateNightLabel: `Late-night fee (${settings.lateNightStartHour}:00–${settings.lateNightEndHour}:00)`,
            overnightLabel: `Overnight fee (${settings.overnightStartHour}:00–${settings.overnightEndHour}:00)`,
            platformLabel: `Ri'aya fee${settings.platformFeeType === "PERCENT" ? ` (${settings.platformFeeAmount}%)` : ""}`,
            extraChildFee: settings.extraChildFeeAmount,
            lastMinuteThresholdHours: settings.lastMinuteThresholdHours,
          }}
        />
      )}
    </div>
  );
}
