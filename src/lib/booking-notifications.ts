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
import { sitterPayout } from "@/lib/pricing";

export type Channel = "EMAIL" | "SMS" | "WHATSAPP";

// Notifications are read outside the app (inbox, texts), so booking links have
// to be absolute.
export function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

export type BookingEvent =
  "REQUESTED" | "APPROVED" | "DECLINED" | "CANCELLED" | "COMPLETED";

export type Recipient = {
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
      // The parent only hears about a request they didn't place themselves —
      // i.e. one Ri'aya entered for them.
      return ctx.audience === "PARENT"
        ? {
            subject: `Your booking with ${ctx.sitterName} is pending`,
            body:
              `We've set up your booking with ${ctx.sitterName} on ${when} ` +
              `for ${ctx.durationHours}h (${money(ctx.total)}). Once ` +
              `${ctx.sitterName} confirms, you can accept the waiver and pay: ` +
              link,
          }
        : {
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
            subject: `Booking completed`,
            body:
              `The ${when} booking is complete. We'll send your ` +
              `${money(ctx.sitterEarns)} by e-Transfer. You can now leave a ` +
              `review of the family: ${link}`,
          }
        : {
            subject: `Booking completed`,
            body:
              `Your ${when} booking with ${ctx.sitterName} is complete. ` +
              `You can now leave a review: ${link}`,
          };
  }
}

// The completed-booking email is the one transactional message where inviting a
// parent to the newsletter is appropriate. It links to the sign-up page, so
// receiving it never subscribes anyone, and parents who already opted in or
// deliberately unsubscribed aren't asked.
export async function newsletterInvite(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { newsletterOptIn: true, newsletterOptOutAt: true },
  });
  if (!user || user.newsletterOptIn || user.newsletterOptOutAt) return "";
  return (
    `\n\nWant Ri'aya news, availability and childcare tips by email? ` +
    `Sign up here: ${appUrl("/newsletter")}`
  );
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

// Fan out one prepared message to a recipient across every enabled channel and
// record each attempt. Never throws — notification failure must not break the
// booking transaction that triggered it. `emailSuffix` is appended to the email
// body only, so texts stay terse.
export async function deliverBookingMessage(opts: {
  bookingId: string;
  settings: BusinessSettings;
  recipient: Recipient;
  message: NotificationMessage;
  emailSuffix?: string;
  // Overrides the business-wide channel toggles for this message.
  channels?: Channel[];
  smsBody?: string;
}): Promise<void> {
  for (const channel of opts.channels ?? enabledChannels(opts.settings)) {
    const to =
      channel === "EMAIL" ? opts.recipient.email : opts.recipient.phone;
    const msg =
      channel === "EMAIL"
        ? opts.emailSuffix
          ? { ...opts.message, body: `${opts.message.body}${opts.emailSuffix}` }
          : opts.message
        : opts.smsBody
          ? { ...opts.message, body: opts.smsBody }
          : opts.message;
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

  // Only the email body carries the newsletter invitation — texts stay terse.
  const invite =
    event === "COMPLETED" && opts.audience === "PARENT"
      ? await newsletterInvite(opts.recipient.userId)
      : "";

  await deliverBookingMessage({
    bookingId: opts.bookingId,
    settings: opts.settings,
    recipient: opts.recipient,
    message: msg,
    emailSuffix: invite,
  });
}

// A booking loaded with the fields needed to notify both parties.
export type BookingForNotify = {
  id: string;
  dateTime: Date;
  durationHours: number;
  baseAmount: number;
  rushFeeAmount: number;
  platformFeeAmount: number;
  totalAmount: number;
  parentId: string;
  sitterId: string;
  parent: { name: string; email: string; phone: string | null };
  sitter: { name: string; email: string; phone: string | null };
  availabilitySlot: { sitterProfile: { city: string | null } };
};

export const bookingNotifyInclude = {
  parent: { select: { name: true, email: true, phone: true } },
  sitter: { select: { name: true, email: true, phone: true } },
  availabilitySlot: { select: { sitterProfile: { select: { city: true } } } },
} as const;

// Fan a lifecycle event out to the sitter and/or parent across enabled channels.
export async function notifyBookingParties(
  event: BookingEvent,
  audiences: Array<"SITTER" | "PARENT">,
  booking: BookingForNotify,
  settings: BusinessSettings,
) {
  const base = {
    bookingId: booking.id,
    settings,
    parentName: booking.parent.name,
    sitterName: booking.sitter.name,
    when: booking.dateTime,
    durationHours: booking.durationHours,
    city: booking.availabilitySlot.sitterProfile.city,
    sitterEarns: sitterPayout(booking),
    total: booking.totalAmount,
  };
  for (const audience of audiences) {
    const recipient =
      audience === "SITTER"
        ? {
            userId: booking.sitterId,
            email: booking.sitter.email,
            phone: booking.sitter.phone,
          }
        : {
            userId: booking.parentId,
            email: booking.parent.email,
            phone: booking.parent.phone,
          };
    await notifyBookingEvent(event, { ...base, audience, recipient });
  }
}
