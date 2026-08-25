import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  getParentBookingEligibility,
  getServiceAddressOnFile,
} from "@/lib/verification";
import { getBusinessSettings } from "@/lib/settings";
import { getActiveTerms } from "@/lib/terms";
import { createBookingRequest } from "@/lib/actions";
import { Card, PageTitle } from "@/components/ui";
import { moneyHr } from "@/lib/format";
import { effectiveRate } from "@/lib/pricing";
import { refundPolicyLines } from "@/lib/cancellation";
import { RequestForm } from "./RequestForm";

export const dynamic = "force-dynamic";

// datetime-local wants a local "YYYY-MM-DDTHH:mm"; the app runs in
// America/Toronto so the server's local time is the parent's.
function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default async function NewRequestPage() {
  const user = await requireRole("PARENT");
  const eligibility = await getParentBookingEligibility(user.id);
  if (!eligibility.canBook) redirect("/parent/verify");

  const [settings, terms, addressOnFile, rates] = await Promise.all([
    getBusinessSettings(),
    getActiveTerms(),
    getServiceAddressOnFile(user.id),
    prisma.sitterProfile.findMany({
      where: { isListed: true, user: { suspended: false } },
      select: { baseRate: true, listedPayRate: true },
    }),
  ]);
  // Sitters set their own rates, so the range comes from the effective rate of
  // each listed sitter rather than a single admin-set number.
  const effectiveRates = rates.map(effectiveRate);
  const minRate = effectiveRates.length ? Math.min(...effectiveRates) : null;
  const maxRate = effectiveRates.length ? Math.max(...effectiveRates) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Request a sitter"
        subtitle="Ask for a date and time even if nobody has posted availability — every listed sitter sees it."
      />

      <Card>
        <h2 className="font-semibold">How this works</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>You post the time you need — this is not a booking yet.</li>
          <li>
            Our team and every listed sitter are notified, and the first sitter
            free at that time picks it up.
          </li>
          <li>
            It becomes a confirmed booking you pay for, and your address is
            released to that sitter only.
          </li>
        </ol>
        <p className="mt-3 rounded-lg bg-brand-cream px-3 py-2 text-xs text-brand-teal">
          {minRate === null || maxRate === null
            ? "Each sitter sets their own rate, so your total is confirmed once a sitter picks up your request."
            : minRate === maxRate
              ? `Sitters' rates are ${moneyHr(minRate)}; your itemised total (plus Ri'aya's fee) is confirmed once a sitter picks up your request.`
              : `Sitters' rates currently range ${moneyHr(minRate)}–${moneyHr(maxRate)}; your itemised total (plus Ri'aya's fee) is confirmed once one picks up your request.`}{" "}
          Requests starting within {settings.lastMinuteThresholdHours}h also
          carry the last-minute rush fee, and bookings are a minimum of{" "}
          {settings.minBookingHours} hours.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold">If plans change</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {refundPolicyLines(settings).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>

      <RequestForm
        action={createBookingRequest}
        termsVersion={terms.version}
        termsBody={terms.body}
        minStartTime={localInputValue(new Date())}
        minHours={settings.minBookingHours}
        addressOnFile={addressOnFile}
      />
    </div>
  );
}
