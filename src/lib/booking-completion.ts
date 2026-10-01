// Finishing a booking: COMPLETED status, the sitter's payout becomes owed, and
// a feedback request to the parent during daytime hours.
//
// Paid bookings complete on their own once the session has ended (run from the
// hourly booking-reminders job); an Admin can also complete one by hand. Each
// step is claimed with a conditional updateMany first, so overlapping runs
// can't complete or ask twice.

import { prisma } from "@/lib/prisma";
import { getBusinessSettings } from "@/lib/settings";
import { payoutAmount, transferToSitter } from "@/lib/payouts";
import {
  appUrl,
  bookingNotifyInclude,
  deliverBookingMessage,
  newsletterInvite,
  notifyBookingParties,
  type Channel,
} from "@/lib/booking-notifications";
import { smsBodyWithOptOut } from "@/lib/sms-campaign";
import { dt } from "@/lib/format";

const COMPLETABLE = ["APPROVED", "IN_PROGRESS"] as const;
const HOUR_MS = 3600000;

// Feedback requests only go out between these Toronto hours (24h clock).
const FEEDBACK_FROM_HOUR = 9;
const FEEDBACK_UNTIL_HOUR = 20;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function torontoHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Toronto",
    }).format(d),
  );
}

// Completes a paid, approved or in-progress booking. Returns false if it was
// not in a completable state (or another run got there first).
export async function finishBooking(
  bookingId: string,
  now = new Date(),
): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      ...bookingNotifyInclude,
      sitter: { include: { sitterProfile: true } },
    },
  });
  if (!booking?.paidAt) return false;

  const claim = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: { in: [...COMPLETABLE] },
      paidAt: { not: null },
    },
    data: {
      status: "COMPLETED",
      completedAt: now,
      payoutReleasedAt: now,
      payoutAmount: payoutAmount(booking),
    },
  });
  if (claim.count === 0) return false;

  // Never fails the completion: anything that doesn't move shows as owed on
  // /admin/payouts.
  const attempt = await transferToSitter(booking, booking.sitter.sitterProfile);
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      payoutStatus: attempt.status,
      payoutMethod: attempt.status === "PAID" ? "STRIPE" : null,
      payoutTransferId: attempt.transferId,
      payoutError: attempt.error,
      payoutPaidAt: attempt.status === "PAID" ? new Date() : null,
    },
  });

  // The parent hears from us through the feedback request instead.
  const settings = await getBusinessSettings();
  await notifyBookingParties("COMPLETED", ["SITTER"], booking, settings);
  return true;
}

// Completes every paid booking whose session has ended.
export async function completeFinishedBookings(
  now = new Date(),
): Promise<number> {
  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: [...COMPLETABLE] },
      paidAt: { not: null },
      dateTime: { lt: now },
    },
    select: { id: true, dateTime: true, durationHours: true },
  });
  let completed = 0;
  for (const b of candidates) {
    const end = b.dateTime.getTime() + b.durationHours * HOUR_MS;
    if (end > now.getTime()) continue;
    if (await finishBooking(b.id, now)) completed++;
  }
  return completed;
}

// Asks the parent of each newly completed booking how it went, by email and,
// if they have a verified phone and haven't texted STOP, by SMS. Skips parents
// who already left a review.
export async function sendFeedbackRequests(now = new Date()): Promise<number> {
  const hour = torontoHour(now);
  if (hour < FEEDBACK_FROM_HOUR || hour >= FEEDBACK_UNTIL_HOUR) return 0;

  const due = await prisma.booking.findMany({
    where: { status: "COMPLETED", feedbackRequestedAt: null },
    select: {
      id: true,
      dateTime: true,
      parentId: true,
      parent: {
        select: {
          name: true,
          email: true,
          phone: true,
          phoneVerified: true,
          smsOptOutAt: true,
        },
      },
      sitter: { select: { name: true } },
      reviews: { select: { authorId: true } },
    },
  });
  if (due.length === 0) return 0;
  const settings = await getBusinessSettings();

  let sent = 0;
  for (const b of due) {
    const claim = await prisma.booking.updateMany({
      where: { id: b.id, feedbackRequestedAt: null },
      data: { feedbackRequestedAt: now },
    });
    if (claim.count === 0) continue;
    if (b.reviews.some((r) => r.authorId === b.parentId)) continue;

    const sitter = firstName(b.sitter.name);
    const link = appUrl(`/bookings/${b.id}`);
    const canText = Boolean(
      b.parent.phone && b.parent.phoneVerified && !b.parent.smsOptOutAt,
    );
    const channels: Channel[] = canText ? ["EMAIL", "SMS"] : ["EMAIL"];

    await deliverBookingMessage({
      bookingId: b.id,
      settings,
      recipient: {
        userId: b.parentId,
        email: b.parent.email,
        phone: b.parent.phone,
      },
      channels,
      message: {
        subject: `How did it go with ${sitter}?`,
        body:
          `Assalamu Alaikum ${firstName(b.parent.name)},\n\n` +
          `Thank you for booking with Ri'aya. How did ${sitter} do on ` +
          `${dt(b.dateTime)}?\n\n` +
          `Please leave a quick rating and a few words here: ${link}\n\n` +
          `It helps other families and helps ${sitter} too. If anything ` +
          `went wrong, just reply to this email.\n\n` +
          `Thank you,\nThe Ri'aya team`,
      },
      emailSuffix: await newsletterInvite(b.parentId),
      smsBody: smsBodyWithOptOut(
        `Ri'aya: how did ${sitter} do? Leave a quick review: ${link}`,
      ),
    });
    sent++;
  }
  return sent;
}
