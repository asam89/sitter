// Shared, non-action helpers for the Admin → parents email broadcast.
//
// This is commercial email, so under Canada's anti-spam law (CASL) it needs
// consent, the sender's identity with a mailing address, and a working
// unsubscribe link. Two kinds of consent are supported:
//
//   NEWSLETTER — express consent: the parent ticked the newsletter box.
//   REGISTERED — implied consent from an existing business relationship, which
//                CASL limits to two years after the relationship (signing up,
//                or the most recent booking). Suitable for a reminder that the
//                service exists; anyone who ever opted out is still excluded.
//
// Transactional email (bookings, password resets) is unaffected by an
// unsubscribe.
import type { CampaignAudienceKind, Prisma } from "@prisma/client";

export const CAMPAIGN_SENDER_IDENTITY =
  process.env.BUSINESS_IDENTITY ??
  "Ri'aya Babysitters — [PENDING: business mailing address required by CASL]";

export type CampaignAudience = {
  newsletter: number;
  registered: number;
  parents: number; // every active parent, for the suppressed count
};

export type CampaignState = {
  error?: string;
  sent?: number;
  suppressed?: number;
};

// CASL's implied-consent window for an existing business relationship.
export const IMPLIED_CONSENT_MONTHS = 24;

export function impliedConsentSince(now = new Date()): Date {
  const since = new Date(now);
  since.setMonth(since.getMonth() - IMPLIED_CONSENT_MONTHS);
  return since;
}

// Parents who gave express newsletter consent and have not opted out.
export const CONSENTED_PARENTS = {
  role: "PARENT",
  suspended: false,
  newsletterOptIn: true,
  newsletterOptOutAt: null,
} as const;

// Parents reachable under implied consent: registered or booked within the
// window, never opted out. Express consenters are a subset of this audience.
export function registeredParents(now = new Date()): Prisma.UserWhereInput {
  const since = impliedConsentSince(now);
  return {
    role: "PARENT",
    suspended: false,
    newsletterOptOutAt: null,
    OR: [
      { createdAt: { gte: since } },
      { parentBookings: { some: { dateTime: { gte: since } } } },
    ],
  };
}

export function audienceWhere(
  kind: CampaignAudienceKind,
  now = new Date(),
): Prisma.UserWhereInput {
  return kind === "NEWSLETTER" ? { ...CONSENTED_PARENTS } : registeredParents(now);
}

export const AUDIENCE_LABEL: Record<CampaignAudienceKind, string> = {
  NEWSLETTER: "Newsletter subscribers (express consent)",
  REGISTERED: `All registered parents (implied consent, ${IMPLIED_CONSENT_MONTHS} months)`,
};

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

export function campaignFooter(
  unsubscribeToken: string | null,
  kind: CampaignAudienceKind = "NEWSLETTER",
): string {
  const link = unsubscribeToken
    ? appUrl(`/unsubscribe?token=${unsubscribeToken}`)
    : appUrl("/unsubscribe");
  const why =
    kind === "NEWSLETTER"
      ? `You are receiving this because you asked us to email you Ri'aya news and updates.`
      : `You are receiving this because you have a Ri'aya Babysitters account.`;
  return `\n\n—\n${CAMPAIGN_SENDER_IDENTITY}\n${why} Unsubscribe: ${link}`;
}
