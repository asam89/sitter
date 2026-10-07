"use server";

import { revalidatePath } from "next/cache";
import type { CampaignAudienceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { campaignSchema, smsCampaignSchema } from "@/lib/validation";
import { getSmsProvider } from "@/lib/notifications";
import {
  smsAudienceWhere,
  smsBodyWithOptOut,
  smsReachableWhere,
  type SmsAudience,
  type SmsCampaignState,
} from "@/lib/sms-campaign";
import {
  deliverEmailCampaign,
  emailCampaignRecipients,
} from "@/lib/campaign-delivery";
import { sendParentNewsletter } from "@/lib/parent-newsletter";
import {
  CONFIRMED_SUBSCRIBERS,
  CONSENTED_PARENTS,
  registeredParents,
  type CampaignAudience,
  type CampaignState,
} from "@/lib/campaign";

export async function campaignAudience(): Promise<CampaignAudience> {
  const [newsletter, registered, parents, subscribers] = await Promise.all([
    prisma.user.count({ where: CONSENTED_PARENTS }),
    prisma.user.count({ where: registeredParents() }),
    prisma.user.count({ where: { role: "PARENT", suspended: false } }),
    prisma.newsletterSubscriber.count({ where: CONFIRMED_SUBSCRIBERS }),
  ]);
  return { newsletter, registered, parents, subscribers };
}

export async function smsCampaignAudience(): Promise<SmsAudience> {
  const [newsletter, registered, reachable] = await Promise.all([
    prisma.user.count({ where: smsAudienceWhere("NEWSLETTER") }),
    prisma.user.count({ where: smsAudienceWhere("REGISTERED") }),
    prisma.user.count({ where: smsReachableWhere() }),
  ]);
  return { newsletter, registered, reachable };
}

// Texting the same audience rules as the email campaign, one message at a
// time: a failed number (wrong format, carrier rejection) must not stop the
// rest of the send.
export async function sendSmsCampaign(
  _prev: SmsCampaignState,
  fd: FormData,
): Promise<SmsCampaignState> {
  const admin = await requireRole("ADMIN");
  const parsed = smsCampaignSchema.safeParse({ body: fd.get("body") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message" };
  }
  const audienceKind = (
    fd.get("audience") === "REGISTERED" ? "REGISTERED" : "NEWSLETTER"
  ) satisfies CampaignAudienceKind;

  const recipients = await prisma.user.findMany({
    where: smsAudienceWhere(audienceKind),
    select: { id: true, phone: true },
  });
  if (recipients.length === 0) {
    return {
      error:
        "Nobody in that audience has a phone number we may text. Everyone " +
        "who replied STOP is excluded.",
    };
  }

  const body = smsBodyWithOptOut(parsed.data.body);
  const provider = getSmsProvider();
  let failures = 0;
  for (const r of recipients) {
    if (!r.phone) continue;
    try {
      await provider.sendMessage(r.phone, { subject: "Ri'aya", body });
    } catch (e) {
      failures++;
      console.error(`[sms-campaign] failed: ${String(e).slice(0, 200)}`);
    }
  }

  const reachable = await prisma.user.count({ where: smsReachableWhere() });
  await prisma.emailCampaign.create({
    data: {
      subject: "SMS broadcast",
      body,
      channel: "SMS",
      sentByUserId: admin.id,
      audience: audienceKind,
      recipientCount: recipients.length - failures,
      failureCount: failures,
      suppressedCount: reachable - recipients.length,
    },
  });

  revalidatePath("/admin/broadcast");
  return {
    sent: recipients.length - failures,
    skipped: reachable - recipients.length,
  };
}

export async function sendCampaign(
  _prev: CampaignState,
  fd: FormData,
): Promise<CampaignState> {
  const admin = await requireRole("ADMIN");
  const parsed = campaignSchema.safeParse({
    subject: fd.get("subject"),
    body: fd.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message" };
  }
  const { subject, body } = parsed.data;
  const audienceKind = (
    fd.get("audience") === "REGISTERED" ? "REGISTERED" : "NEWSLETTER"
  ) satisfies CampaignAudienceKind;

  const recipients = await emailCampaignRecipients(audienceKind);
  const accounts = recipients.filter((r) => r.userId);
  const audience = await campaignAudience();
  const suppressed = audience.parents - accounts.length;
  if (recipients.length === 0) {
    return {
      error:
        audienceKind === "NEWSLETTER"
          ? "No parent has newsletter consent on file yet, so there is nobody " +
            "we may email commercially."
          : "No registered parent falls inside the implied-consent window.",
    };
  }

  const { sent } = await deliverEmailCampaign({
    subject,
    body,
    audienceKind,
    recipients,
    sentByUserId: admin.id,
    suppressed,
  });

  revalidatePath("/admin/broadcast");
  return { sent, suppressed };
}

export type NewsletterNowState = { error?: string; sent?: number };

export async function sendParentNewsletterNow(): Promise<NewsletterNowState> {
  const admin = await requireRole("ADMIN");
  const run = await sendParentNewsletter(new Date(), {
    force: true,
    sentByUserId: admin.id,
  });
  revalidatePath("/admin/broadcast");
  if (run.skipped) return { error: `Nothing sent: ${run.skipped}.` };
  return { sent: run.sent };
}
