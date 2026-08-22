import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { campaignAudience, sendCampaign } from "@/lib/campaign-actions";
import { campaignFooter } from "@/lib/campaign";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";
import { BroadcastForm } from "./BroadcastForm";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  await requireRole("ADMIN");
  const [audience, campaigns] = await Promise.all([
    campaignAudience(),
    prisma.emailCampaign.findMany({
      orderBy: { sentAt: "desc" },
      take: 20,
      include: { sentBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Email parents"
        subtitle="Goes only to parents who gave express newsletter consent."
      />

      <Card>
        <p className="text-sm text-slate-600">
          Canada&apos;s anti-spam law (CASL) requires express consent, your
          identity and a working unsubscribe link in every commercial email. All
          three are applied automatically — but the mailing address in the footer
          must be set (BUSINESS_IDENTITY) before you send for real.
        </p>
      </Card>

      <BroadcastForm
        action={sendCampaign}
        footer={campaignFooter(null)}
        consented={audience.consented}
        suppressed={audience.suppressed}
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
                {dt(c.sentAt)} · {c.sentBy.name} · {c.recipientCount} delivered
                {c.failureCount > 0 ? `, ${c.failureCount} failed` : ""} ·{" "}
                {c.suppressedCount} skipped without consent
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
