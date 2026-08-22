// Shared, non-action helpers for the Admin → parents email broadcast.
//
// This is commercial email, so under Canada's anti-spam law (CASL) it goes only
// to parents with express consent on file (newsletterOptIn, not since opted
// out), and every message carries the sender's identity, a mailing address and
// a working unsubscribe link. Transactional email (bookings, password resets)
// is unaffected by an unsubscribe.

export const CAMPAIGN_SENDER_IDENTITY =
  process.env.BUSINESS_IDENTITY ??
  "Ri'aya Babysitters — [PENDING: business mailing address required by CASL]";

export type CampaignAudience = {
  consented: number;
  suppressed: number; // parents we may not email commercially
};

export type CampaignState = {
  error?: string;
  sent?: number;
  suppressed?: number;
};

// Parents we are allowed to email commercially.
export const CONSENTED_PARENTS = {
  role: "PARENT",
  suspended: false,
  newsletterOptIn: true,
  newsletterOptOutAt: null,
} as const;

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

export function campaignFooter(unsubscribeToken: string | null): string {
  const link = unsubscribeToken
    ? appUrl(`/unsubscribe?token=${unsubscribeToken}`)
    : appUrl("/unsubscribe");
  return (
    `\n\n—\n${CAMPAIGN_SENDER_IDENTITY}\n` +
    `You are receiving this because you asked us to email you Ri'aya news and ` +
    `updates. Unsubscribe: ${link}`
  );
}
