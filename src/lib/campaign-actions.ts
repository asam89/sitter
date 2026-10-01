"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { CampaignAudienceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { campaignSchema, smsCampaignSchema } from "@/lib/validation";
import { getEmailProvider, getSmsProvider } from "@/lib/notifications";
import {
  smsAudienceWhere,
  smsBodyWithOptOut,
  smsReachableWhere,
  type SmsAudience,
  type SmsCampaignState,
} from "@/lib/sms-campaign";
import {
  CONFIRMED_SUBSCRIBERS,
  CONSENTED_PARENTS,
  audienceWhere,
  campaignFooter,
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

// Every marketing email must carry a working unsubscribe link, so parents who
// predate the token column get one before they are emailed.
async function ensureUnsubscribeToken(user: {
  id: string;
  unsubscribeToken: string | null;
}): Promise<string> {
  if (user.unsubscribeToken) return user.unsubscribeToken;
  const token = randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { unsubscribeToken: token },
  });
  return token;
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

  const accounts = await prisma.user.findMany({
    where: audienceWhere(audienceKind),
    select: { id: true, email: true, name: true, unsubscribeToken: true },
  });
  // Public sign-ups belong to the express-consent audience only. Anyone who also
  // holds an account is mailed once, through the account row.
  const subscribers =
    audienceKind === "NEWSLETTER"
      ? (
          await prisma.newsletterSubscriber.findMany({
            where: CONFIRMED_SUBSCRIBERS,
            select: { email: true, unsubscribeToken: true },
          })
        ).filter((s) => !accounts.some((a) => a.email === s.email))
      : [];
  const recipients = [
    ...accounts.map((a) => ({
      email: a.email,
      name: a.name as string | null,
      unsubscribeToken: a.unsubscribeToken,
      userId: a.id as string | null,
    })),
    ...subscribers.map((s) => ({
      email: s.email,
      name: null,
      unsubscribeToken: s.unsubscribeToken,
      userId: null,
    })),
  ];
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

  const provider = getEmailProvider();
  let failures = 0;
  for (const r of recipients) {
    try {
      const token = r.userId
        ? await ensureUnsubscribeToken({
            id: r.userId,
            unsubscribeToken: r.unsubscribeToken,
          })
        : r.unsubscribeToken;
      await provider.sendMessage(r.email, {
        subject,
        body:
          `${r.name ? `Hi ${r.name},` : "Hi,"}\n\n${body}` +
          campaignFooter(token, audienceKind),
      });
    } catch (e) {
      failures++;
      console.error(
        `[campaign] failed to email ${r.email}: ${String(e).slice(0, 200)}`,
      );
    }
  }

  await prisma.emailCampaign.create({
    data: {
      subject,
      body,
      sentByUserId: admin.id,
      audience: audienceKind,
      recipientCount: recipients.length - failures,
      failureCount: failures,
      suppressedCount: suppressed,
    },
  });

  revalidatePath("/admin/broadcast");
  return { sent: recipients.length - failures, suppressed };
}
