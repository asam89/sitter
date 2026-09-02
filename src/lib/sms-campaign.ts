// Shared, non-action helpers for the Admin → parents/sitters SMS broadcast.
//
// A text costs the recipient attention (and sometimes money), so CASL applies
// the same way it does to email: consent, our identity, and a working opt-out
// in every message. The two consent kinds mirror the email campaign —
// NEWSLETTER (express) and REGISTERED (implied, 24 months from sign-up or the
// last booking) — with two differences:
//
//   * sitters are included, because a service announcement reaches the people
//     taking the bookings as much as the families making them;
//   * a separate opt-out (`smsOptOutAt`) is kept, so replying STOP silences
//     texts without also unsubscribing someone from email.
//
// Booking codes and reminders are transactional and unaffected by either
// opt-out.
import type { CampaignAudienceKind, Prisma } from "@prisma/client";

import { impliedConsentSince } from "@/lib/campaign";

// Two GSM segments. Longer messages still send, but Twilio bills per segment
// and long marketing texts get reported as spam, so the form enforces this.
export const MAX_SMS_BODY = 280;

export type SmsAudience = {
  newsletter: number;
  registered: number;
  reachable: number; // every non-suspended account with a phone number
};

export type SmsCampaignState = {
  error?: string;
  sent?: number;
  skipped?: number;
};

const SMS_REACHABLE: Prisma.UserWhereInput = {
  role: { in: ["PARENT", "SITTER"] },
  suspended: false,
  phone: { not: null },
  smsOptOutAt: null,
};

export function smsAudienceWhere(
  kind: CampaignAudienceKind,
  now = new Date(),
): Prisma.UserWhereInput {
  if (kind === "NEWSLETTER") {
    return {
      ...SMS_REACHABLE,
      newsletterOptIn: true,
      newsletterOptOutAt: null,
    };
  }
  const since = impliedConsentSince(now);
  return {
    ...SMS_REACHABLE,
    newsletterOptOutAt: null,
    OR: [
      { createdAt: { gte: since } },
      { parentBookings: { some: { dateTime: { gte: since } } } },
      { sitterBookings: { some: { dateTime: { gte: since } } } },
    ],
  };
}

export function smsReachableWhere(): Prisma.UserWhereInput {
  return { ...SMS_REACHABLE };
}

// Appended to every broadcast text. Twilio honours STOP at the carrier level
// too, but we record it ourselves so the audience counts stay honest.
export const SMS_OPT_OUT_LINE = "Reply STOP to opt out.";

export function smsBodyWithOptOut(body: string): string {
  return body.trim().endsWith(SMS_OPT_OUT_LINE)
    ? body.trim()
    : `${body.trim()} ${SMS_OPT_OUT_LINE}`;
}

// Words a carrier treats as an opt-out, matched case-insensitively on the whole
// message so "stop by at 6" doesn't unsubscribe a parent.
const STOP_WORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit"];
const START_WORDS = ["start", "unstop", "yes"];

export type InboundIntent = "STOP" | "START" | "MESSAGE";

export function inboundIntent(body: string): InboundIntent {
  const word = body.trim().toLowerCase().replace(/[.!]$/, "");
  if (STOP_WORDS.includes(word)) return "STOP";
  if (START_WORDS.includes(word)) return "START";
  return "MESSAGE";
}
