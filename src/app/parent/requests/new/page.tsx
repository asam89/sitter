import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getParentBookingEligibility } from "@/lib/verification";
import { getBusinessSettings } from "@/lib/settings";
import { getActiveTerms } from "@/lib/terms";
import { createBookingRequest } from "@/lib/actions";
import { Card, PageTitle } from "@/components/ui";
import { moneyHr } from "@/lib/format";
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

  const [settings, terms, rates] = await Promise.all([
    getBusinessSettings(),
    getActiveTerms(),
    prisma.sitterProfile.aggregate({
      where: { isListed: true, user: { suspended: false } },
      _min: { listedPayRate: true },
      _max: { listedPayRate: true },
    }),
  ]);
  const minRate = rates._min.listedPayRate;
  const maxRate = rates._max.listedPayRate;

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
            ? "Rates are set by Ri'aya per sitter, so your total is confirmed once a sitter picks up your request."
            : minRate === maxRate
              ? `Listed rates are ${moneyHr(minRate)}; your itemised total is confirmed once a sitter picks up your request.`
              : `Listed rates currently range ${moneyHr(minRate)}–${moneyHr(maxRate)} depending on the sitter; your itemised total is confirmed once one picks up your request.`}
          {" "}
          Requests starting within {settings.lastMinuteThresholdHours}h also
          carry the last-minute rush fee.
        </p>
      </Card>

      <RequestForm
        action={createBookingRequest}
        termsVersion={terms.version}
        termsBody={terms.body}
        minStartTime={localInputValue(new Date())}
      />
    </div>
  );
}
