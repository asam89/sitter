"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getEmailProvider, getSmsProvider } from "@/lib/notifications";
import { smsBodyWithOptOut } from "@/lib/sms-campaign";
import { SITTERS, SITTER_INBOX_PATH } from "@/lib/team-messages";
import { sweepWeeklySchedules } from "@/lib/pipeline-nudges";

// Team → sitter messages. The text lives in the portal; the optional SMS and
// email are only a pointer to it, so nothing sensitive goes over a carrier and
// the sitter has one place to look.

export type TeamMessageState = {
  error?: string;
  sent?: number;
  texted?: number;
  emailed?: number;
};

const schema = z.object({
  subject: z.string().trim().min(3, "Subject is too short").max(120),
  body: z.string().trim().min(10, "Message is too short").max(5000),
  recipientUserId: z.string().trim().optional(),
  notifySms: z.boolean(),
  notifyEmail: z.boolean(),
});

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

export async function sendTeamMessage(
  _prev: TeamMessageState,
  fd: FormData,
): Promise<TeamMessageState> {
  const admin = await requireRole("ADMIN");
  const parsed = schema.safeParse({
    subject: fd.get("subject"),
    body: fd.get("body"),
    recipientUserId: fd.get("recipientUserId") || undefined,
    notifySms: fd.get("notifySms") === "on",
    notifyEmail: fd.get("notifyEmail") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message" };
  }
  const { subject, body, recipientUserId, notifySms, notifyEmail } =
    parsed.data;

  const recipients = await prisma.user.findMany({
    where: recipientUserId ? { ...SITTERS, id: recipientUserId } : SITTERS,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      smsOptOutAt: true,
    },
  });
  if (recipients.length === 0) {
    return { error: "No sitter account matches that recipient." };
  }

  const message = await prisma.teamMessage.create({
    data: {
      authorUserId: admin.id,
      recipientUserId: recipientUserId ?? null,
      subject,
      body,
    },
  });

  const link = appUrl(SITTER_INBOX_PATH);
  let texted = 0;
  let emailed = 0;

  if (notifySms) {
    const sms = getSmsProvider();
    const text = smsBodyWithOptOut(
      `Ri'aya: you have a new message from the team. Log in to read it: ${link}`,
    );
    for (const r of recipients) {
      if (!r.phone || r.smsOptOutAt) continue;
      try {
        await sms.sendMessage(r.phone, { subject: "Ri'aya", body: text });
        texted++;
      } catch (e) {
        console.error(
          `[team-message] sms to ${r.id} failed: ${String(e).slice(0, 200)}`,
        );
      }
    }
    await prisma.teamMessage.update({
      where: { id: message.id },
      data: { smsSentCount: texted },
    });
  }

  if (notifyEmail) {
    const mail = getEmailProvider();
    for (const r of recipients) {
      try {
        await mail.sendMessage(r.email, {
          subject: `New message from the Ri'aya team: ${subject}`,
          body:
            `${r.name ? `Hi ${r.name.split(" ")[0]},` : "Hi,"}\n\n` +
            `The Ri'aya team has posted a message for you in your sitter portal:\n\n` +
            `${link}\n\n— The Ri'aya team\nwww.riaya.ca`,
        });
        emailed++;
      } catch (e) {
        console.error(
          `[team-message] email to ${r.id} failed: ${String(e).slice(0, 200)}`,
        );
      }
    }
  }

  revalidatePath("/admin/messages");
  revalidatePath(SITTER_INBOX_PATH);
  return { sent: recipients.length, texted, emailed };
}

export type ScheduleReminderState = {
  error?: string;
  reminded?: number;
  texted?: number;
};

// The weekly schedule reminder, sent now to every vetted sitter regardless of
// when they last got it.
export async function sendScheduleReminderNow(): Promise<ScheduleReminderState> {
  await requireRole("ADMIN");
  const r = await sweepWeeklySchedules(new Date(), { force: true });
  if (r.vettedSitters === 0)
    return { error: "There are no vetted sitters yet." };
  revalidatePath("/admin/messages");
  return { reminded: r.reminded, texted: r.texted };
}
