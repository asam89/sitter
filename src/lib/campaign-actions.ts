"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { CampaignAudienceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { campaignSchema } from "@/lib/validation";
import { getEmailProvider } from "@/lib/notifications";
import {
  CONSENTED_PARENTS,
  audienceWhere,
  campaignFooter,
  registeredParents,
  type CampaignAudience,
  type CampaignState,
} from "@/lib/campaign";

export async function campaignAudience(): Promise<CampaignAudience> {
  const [newsletter, registered, parents] = await Promise.all([
    prisma.user.count({ where: CONSENTED_PARENTS }),
    prisma.user.count({ where: registeredParents() }),
    prisma.user.count({ where: { role: "PARENT", suspended: false } }),
  ]);
  return { newsletter, registered, parents };
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

  const recipients = await prisma.user.findMany({
    where: audienceWhere(audienceKind),
    select: { id: true, email: true, name: true, unsubscribeToken: true },
  });
  const audience = await campaignAudience();
  const suppressed = audience.parents - recipients.length;
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
      const token = await ensureUnsubscribeToken(r);
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
