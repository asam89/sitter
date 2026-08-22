"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { campaignSchema } from "@/lib/validation";
import { getEmailProvider } from "@/lib/notifications";
import {
  CONSENTED_PARENTS,
  campaignFooter,
  type CampaignAudience,
  type CampaignState,
} from "@/lib/campaign";

export async function campaignAudience(): Promise<CampaignAudience> {
  const [consented, parents] = await Promise.all([
    prisma.user.count({ where: CONSENTED_PARENTS }),
    prisma.user.count({ where: { role: "PARENT", suspended: false } }),
  ]);
  return { consented, suppressed: parents - consented };
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

  const recipients = await prisma.user.findMany({
    where: CONSENTED_PARENTS,
    select: { id: true, email: true, name: true, unsubscribeToken: true },
  });
  const audience = await campaignAudience();
  if (recipients.length === 0) {
    return {
      error:
        "No parent has newsletter consent on file yet, so there is nobody we " +
        "may email commercially.",
    };
  }

  const provider = getEmailProvider();
  let failures = 0;
  for (const r of recipients) {
    try {
      await provider.sendMessage(r.email, {
        subject,
        body:
          `${r.name ? `Hi ${r.name},` : "Hi,"}\n\n${body}` +
          campaignFooter(r.unsubscribeToken),
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
      recipientCount: recipients.length - failures,
      failureCount: failures,
      suppressedCount: audience.suppressed,
    },
  });

  revalidatePath("/admin/broadcast");
  return {
    sent: recipients.length - failures,
    suppressed: audience.suppressed,
  };
}
