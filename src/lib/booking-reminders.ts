// Pre-session reminders for both sides of a confirmed booking.
//
// Two reminders go out per booking — a heads-up (default 24h before) and a final
// one (default 2h before), both configurable in /admin/settings, 0 disables.
// Only confirmed (approved + paid) bookings are reminded: reminding someone
// about a session that isn't actually confirmed would be misleading.
//
// Idempotency: the timestamp is claimed with a conditional updateMany before the
// message is sent, so a cron re-run (or two overlapping runs) can't send twice.
// Sending the final reminder also stamps the earlier one, so a job that was down
// over the 24h mark doesn't fire a stale "tomorrow" reminder afterwards.

import { prisma } from "@/lib/prisma";
import { getBusinessSettings } from "@/lib/settings";
import { appUrl, deliverBookingMessage } from "@/lib/booking-notifications";
import { dt } from "@/lib/format";
import type { BusinessSettings } from "@prisma/client";

export type ReminderKind = "FIRST" | "FINAL";

export function supportEmail(settings: BusinessSettings): string {
  return (
    settings.supportEmail ||
    process.env.EMAIL_REPLY_TO ||
    "support@riaya.ca"
  );
}

function hoursUntil(start: Date, now: Date): number {
  return Math.max(1, Math.round((start.getTime() - now.getTime()) / 3600000));
}

const reminderSelect = {
  id: true,
  dateTime: true,
  durationHours: true,
  numberOfChildren: true,
  parent: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      parentProfile: { select: { city: true } },
    },
  },
  sitter: { select: { id: true, name: true, email: true, phone: true } },
} as const;

type ReminderBooking = Awaited<
  ReturnType<
    typeof prisma.booking.findFirstOrThrow<{ select: typeof reminderSelect }>
  >
>;

async function sendReminder(
  booking: ReminderBooking,
  settings: BusinessSettings,
  now: Date,
): Promise<void> {
  const lead = hoursUntil(booking.dateTime, now);
  const when = dt(booking.dateTime);
  const link = appUrl(`/bookings/${booking.id}`);
  const help = `\n\nNeed help or need to change something? Email ${supportEmail(settings)}.`;
  const city = booking.parent.parentProfile?.city;

  await deliverBookingMessage({
    bookingId: booking.id,
    settings,
    recipient: {
      userId: booking.parent.id,
      email: booking.parent.email,
      phone: booking.parent.phone,
    },
    message: {
      subject: `Reminder: ${booking.sitter.name} arrives in about ${lead}h`,
      body:
        `Your booking with ${booking.sitter.name} starts ${when} and runs ` +
        `${booking.durationHours}h. Details: ${link}`,
    },
    emailSuffix: help,
  });

  await deliverBookingMessage({
    bookingId: booking.id,
    settings,
    recipient: {
      userId: booking.sitter.id,
      email: booking.sitter.email,
      phone: booking.sitter.phone,
    },
    message: {
      subject: `Reminder: you sit for ${booking.parent.name} in about ${lead}h`,
      body:
        `Your booking with ${booking.parent.name}` +
        `${city ? ` in ${city}` : ""} starts ${when} and runs ` +
        `${booking.durationHours}h (${booking.numberOfChildren} child(ren)). ` +
        `Address and details: ${link}`,
    },
    emailSuffix: help,
  });
}

// Sends whichever reminders are now due. Safe to call as often as you like.
export async function sendDueBookingReminders(
  now = new Date(),
): Promise<{ first: number; final: number }> {
  const settings = await getBusinessSettings();
  const sent = { first: 0, final: 0 };

  for (const kind of ["FINAL", "FIRST"] as ReminderKind[]) {
    const lead =
      kind === "FINAL"
        ? settings.reminderFinalLeadHours
        : settings.reminderLeadHours;
    if (lead <= 0) continue;

    const due = await prisma.booking.findMany({
      where: {
        status: "APPROVED",
        paidAt: { not: null },
        dateTime: { gt: now, lte: new Date(now.getTime() + lead * 3600000) },
        ...(kind === "FINAL"
          ? { finalReminderSentAt: null }
          : { reminderSentAt: null }),
      },
      select: reminderSelect,
    });

    for (const booking of due) {
      // Claim before sending so a concurrent run skips this booking.
      const claim = await prisma.booking.updateMany({
        where:
          kind === "FINAL"
            ? { id: booking.id, finalReminderSentAt: null }
            : { id: booking.id, reminderSentAt: null },
        data:
          kind === "FINAL"
            ? { finalReminderSentAt: now, reminderSentAt: now }
            : { reminderSentAt: now },
      });
      if (claim.count === 0) continue;
      await sendReminder(booking, settings, now);
      if (kind === "FINAL") sent.final += 1;
      else sent.first += 1;
    }
  }

  return sent;
}
