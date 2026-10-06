import { randomBytes } from "crypto";
import type { CampaignAudienceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/notifications";
import {
  CONFIRMED_SUBSCRIBERS,
  audienceWhere,
  campaignFooter,
} from "@/lib/campaign";

// Every marketing email must carry a working unsubscribe link, so parents who
// predate the token column get one before they are emailed.
export async function ensureUnsubscribeToken(user: {
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

type Recipient = {
  email: string;
  name: string | null;
  unsubscribeToken: string | null;
  userId: string | null;
};

export async function emailCampaignRecipients(
  audienceKind: CampaignAudienceKind,
  now = new Date(),
): Promise<Recipient[]> {
  const accounts = await prisma.user.findMany({
    where: audienceWhere(audienceKind, now),
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
  return [
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
}

// Emails each recipient (greeting + body + CASL footer) and records the send.
export async function deliverEmailCampaign(opts: {
  subject: string;
  body: string;
  audienceKind: CampaignAudienceKind;
  recipients: Recipient[];
  sentByUserId: string;
  suppressed: number;
}): Promise<{ sent: number; failures: number }> {
  const provider = getEmailProvider();
  let failures = 0;
  for (const r of opts.recipients) {
    try {
      const token = r.userId
        ? await ensureUnsubscribeToken({
            id: r.userId,
            unsubscribeToken: r.unsubscribeToken,
          })
        : r.unsubscribeToken;
      await provider.sendMessage(r.email, {
        subject: opts.subject,
        body:
          `${r.name ? `Hi ${r.name},` : "Hi,"}\n\n${opts.body}` +
          campaignFooter(token, opts.audienceKind),
      });
    } catch (e) {
      failures++;
      console.error(
        `[campaign] failed to email ${r.email}: ${String(e).slice(0, 200)}`,
      );
    }
  }

  const sent = opts.recipients.length - failures;
  await prisma.emailCampaign.create({
    data: {
      subject: opts.subject,
      body: opts.body,
      sentByUserId: opts.sentByUserId,
      audience: opts.audienceKind,
      recipientCount: sent,
      failureCount: failures,
      suppressedCount: opts.suppressed,
    },
  });
  return { sent, failures };
}
