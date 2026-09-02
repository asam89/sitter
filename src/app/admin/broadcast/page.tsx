import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  campaignAudience,
  sendCampaign,
  sendSmsCampaign,
  smsCampaignAudience,
} from "@/lib/campaign-actions";
import { AUDIENCE_LABEL, IMPLIED_CONSENT_MONTHS, campaignFooter } from "@/lib/campaign";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";
import { BroadcastForm } from "./BroadcastForm";
import { SmsBroadcastForm } from "./SmsBroadcastForm";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  await requireRole("ADMIN");
  const [audience, smsAudience, campaigns] = await Promise.all([
    campaignAudience(),
    smsCampaignAudience(),
    prisma.emailCampaign.findMany({
      orderBy: { sentAt: "desc" },
      take: 20,
      include: { sentBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Message parents and sitters"
        subtitle="Email or text the people who consented to hear from Ri'aya."
      />

      <Card>
        <p className="text-sm text-slate-600">
          Canada&apos;s anti-spam law (CASL) requires consent, your identity and
          a working unsubscribe link in every commercial email. Consent is either
          express (the parent ticked the newsletter box) or implied for{" "}
          {IMPLIED_CONSENT_MONTHS} months after someone signs up or books — which
          is what a reminder to registered parents relies on. Identity and
          unsubscribe are added automatically, but the mailing address in the
          footer must be set (BUSINESS_IDENTITY) before you send for real. This
          is our reading of CASL, not legal advice.
        </p>
      </Card>

      <BroadcastForm
        action={sendCampaign}
        footerFor={{
          NEWSLETTER: campaignFooter(null, "NEWSLETTER"),
          REGISTERED: campaignFooter(null, "REGISTERED"),
        }}
        newsletterCount={audience.newsletter}
        subscriberCount={audience.subscribers}
        registeredCount={audience.registered}
        parentCount={audience.parents}
        impliedMonths={IMPLIED_CONSENT_MONTHS}
      />

      <SmsBroadcastForm
        action={sendSmsCampaign}
        newsletterCount={smsAudience.newsletter}
        registeredCount={smsAudience.registered}
        reachableCount={smsAudience.reachable}
        impliedMonths={IMPLIED_CONSENT_MONTHS}
      />

      <div className="space-y-2">
        <h2 className="font-semibold">Past sends</h2>
        {campaigns.length === 0 ? (
          <EmptyState>Nothing sent yet.</EmptyState>
        ) : (
          campaigns.map((c) => (
            <Card key={c.id}>
              <p className="font-medium">{c.subject}</p>
              <p className="mt-1 text-xs text-slate-500">
                {dt(c.sentAt)} · {c.sentBy.name} · {c.channel} ·{" "}
                {AUDIENCE_LABEL[c.audience]}{" "}
                · {c.recipientCount} delivered
                {c.failureCount > 0 ? `, ${c.failureCount} failed` : ""} ·{" "}
                {c.suppressedCount} skipped
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
