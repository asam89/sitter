// Welcome email sent immediately after registration.
//
// This is transactional (it confirms an account the person just created), so it
// goes to every new user regardless of newsletter consent. Marketing content is
// kept out of it deliberately — see `NEWSLETTER_CONSENT_TEXT` in @/lib/consent
// for the separate, express opt-in Canada's anti-spam law (CASL) requires
// before we send any commercial email.
//
// Never throws: a mail failure must not fail registration.

import { getEmailProvider } from "@/lib/notifications";

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(/\/$/, "");
  return `${base}${path}`;
}

export async function sendWelcomeEmail(u: {
  email: string;
  name: string | null;
  role: string;
  newsletterOptIn: boolean;
  unsubscribeToken: string | null;
}): Promise<void> {
  const hi = u.name ? `Hi ${u.name},` : "Hi,";
  const isSitter = u.role === "SITTER";

  const nextSteps = isSitter
    ? `Next step: complete your vetting application. Our evaluation team — ECEs, ` +
      `OCT teachers and trusted community members — reviews every applicant and ` +
      `holds a short interview before you can be listed and booked.\n\n` +
      `Start your application: ${appUrl("/sitter")}`
    : `Next step: verify your contact details so you can book. Then you can browse ` +
      `open times, or ask for a date and time nobody has posted yet and let our ` +
      `sitters pick it up.\n\n` +
      `Your dashboard: ${appUrl("/parent")}`;

  const footer =
    u.newsletterOptIn && u.unsubscribeToken
      ? `\n\nYou asked us to email you Ri'aya news and updates. You can ` +
        `unsubscribe any time: ${appUrl(`/unsubscribe?token=${u.unsubscribeToken}`)}`
      : "";

  try {
    await getEmailProvider().sendMessage(u.email, {
      subject: isSitter
        ? "Welcome to Ri'aya Babysitters — your application is next"
        : "Welcome to Ri'aya Babysitters",
      body:
        `${hi}\n\n` +
        `Your Ri'aya Babysitters account is set up. Ri'aya is a vetted, ` +
        `community-trusted babysitting service — every sitter is interviewed and ` +
        `approved by our team before a family can book them.\n\n` +
        `${nextSteps}\n\n` +
        `If you have questions just reply to this email.\n\n` +
        `— Ri'aya Babysitters Inc.` +
        footer,
    });
  } catch (e) {
    console.error(
      `[welcome] failed to email ${u.email}: ${String(e).slice(0, 200)}`,
    );
  }
}
