// Channel-agnostic dispatch for booking-lifecycle notifications.
//
// A single event (booking requested, approved, declined, cancelled, completed)
// fans out to the recipient across every enabled channel. Email is the baseline
// and always sent; SMS and WhatsApp are toggled per-business via BusinessSettings
// (default off → stubbed). Each attempt is recorded as a Notification row so the
// lifecycle has an auditable trail without holding any provider secrets.
//
// Privacy: notification bodies never include the parent's street address before
// the sitter approves — only the city. Full address is released on approval and
// only ever through the authenticated booking page, never in a notification.

import type { BusinessSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getEmailProvider,
  getSmsProvider,
  getWhatsappProvider,
  type NotificationMessage,
} from "@/lib/notifications";
import { dt, money } from "@/lib/format";

type Channel = "EMAIL" | "SMS" | "WHATSAPP";

// Notifications are read outside the app (inbox, texts), so booking links have
// to be absolute.
function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(/\/$/, "");
  return `${base}${path}`;
}

export type BookingEvent =
  | "REQUESTED"
  | "APPROVED"
  | "DECLINED"
  | "CANCELLED"
  | "COMPLETED";

type Recipient = {
  userId: string;
  email: string | null;
  phone: string | null;
};

// Build the human-readable message for an event. `city` is intentionally the
// only location detail — the full address is never placed in a notification.
function buildMessage(
  event: BookingEvent,
  ctx: {
    bookingId: string;
    parentName: string;
    sitterName: string;
    when: Date;
    durationHours: number;
    city: string | null;
    sitterEarns: number;
    total: number;
    audience: "SITTER" | "PARENT";
  },
): NotificationMessage {
  const where = ctx.city ? ` in ${ctx.city}` : "";
  const when = dt(ctx.when);
  const link = appUrl(`/bookings/${ctx.bookingId}`);
  switch (event) {
    case "REQUESTED":
      return {
        subject: `New booking request from ${ctx.parentName}`,
        body:
          `${ctx.parentName} requested you${where} on ${when} for ` +
          `${ctx.durationHours}h. You'd earn ${money(ctx.sitterEarns)} at ` +
          `Ri'aya's set rate. Approve or decline: ${link}`,
      };
    case "APPROVED":
      return ctx.audience === "PARENT"
        ? {
            subject: `${ctx.sitterName} approved your booking`,
            body:
              `${ctx.sitterName} approved your ${when} booking (` +
              `${ctx.durationHours}h). Total ${money(ctx.total)}. Details: ${link}`,
          }
        : {
            subject: `Booking confirmed — ${when}`,
            body:
              `You approved ${ctx.parentName}'s booking on ${when}. The full ` +
              `service address is now on the booking page: ${link}`,
          };
    case "DECLINED":
      return {
        subject: `Your booking request was declined`,
        body:
          `Unfortunately ${ctx.sitterName} can't take the ${when} booking. ` +
          `The slot is open again — you can book another sitter: ${link}`,
      };
    case "CANCELLED":
      return {
        subject: `Booking cancelled — ${when}`,
        body: `The ${when} booking (${ctx.parentName} / ${ctx.sitterName}) was cancelled. ${link}`,
      };
    case "COMPLETED":
      return ctx.audience === "SITTER"
        ? {
            subject: `Booking completed — payout released`,
            body:
              `The ${when} booking is complete. ${money(ctx.sitterEarns)} has ` +
              `been released to you. You can now leave a review: ${link}`,
          }
        : {
            subject: `Booking completed`,
            body:
              `Your ${when} booking with ${ctx.sitterName} is complete. ` +
              `You can now leave a review: ${link}`,
          };
  }
}

// Which channels are enabled for the business (email always on).
function enabledChannels(settings: BusinessSettings): Channel[] {
  const channels: Channel[] = ["EMAIL"];
  if (settings.notifySmsEnabled) channels.push("SMS");
  if (settings.notifyWhatsappEnabled) channels.push("WHATSAPP");
  return channels;
}

async function dispatchOne(
  channel: Channel,
  to: string | null,
  msg: NotificationMessage,
): Promise<{ status: "SENT" | "STUBBED" | "FAILED"; detail: string }> {
  if (!to) return { status: "FAILED", detail: "no contact on file" };
  try {
    if (channel === "EMAIL") {
      const p = getEmailProvider();
      await p.sendMessage(to, msg);
      return { status: p.stub ? "STUBBED" : "SENT", detail: p.name };
    }
    if (channel === "SMS") {
      const p = getSmsProvider();
      await p.sendMessage(to, msg);
      return { status: p.stub ? "STUBBED" : "SENT", detail: p.name };
    }
    const p = getWhatsappProvider();
    await p.sendMessage(to, msg);
    return { status: p.stub ? "STUBBED" : "SENT", detail: p.name };
  } catch (e) {
    return { status: "FAILED", detail: String(e).slice(0, 200) };
  }
}

// Fan out a booking event to one recipient across all enabled channels and
// record each attempt. Never throws — notification failure must not break the
// booking transaction that triggered it.
export async function notifyBookingEvent(
  event: BookingEvent,
  opts: {
    bookingId: string;
    settings: BusinessSettings;
    recipient: Recipient;
    audience: "SITTER" | "PARENT";
    parentName: string;
    sitterName: string;
    when: Date;
    durationHours: number;
    city: string | null;
    sitterEarns: number;
    total: number;
  },
): Promise<void> {
  const msg = buildMessage(event, {
    bookingId: opts.bookingId,
    parentName: opts.parentName,
    sitterName: opts.sitterName,
    when: opts.when,
    durationHours: opts.durationHours,
    city: opts.city,
    sitterEarns: opts.sitterEarns,
    total: opts.total,
    audience: opts.audience,
  });

  for (const channel of enabledChannels(opts.settings)) {
    const to = channel === "EMAIL" ? opts.recipient.email : opts.recipient.phone;
    const result = await dispatchOne(channel, to, msg);
    try {
      await prisma.notification.create({
        data: {
          bookingId: opts.bookingId,
          recipientUserId: opts.recipient.userId,
          channel,
          status: result.status,
          detail: result.detail,
        },
      });
    } catch {
      // Auditing is best-effort; swallow so it can never break the caller.
    }
  }
}
