// Account-level email notifications for sitters (application outcome / listing).
//
// These sit outside the booking-lifecycle notifications (which are tied to a
// Booking row) — they fire when Admin changes a sitter's application status or
// listing state. Email is the baseline channel and delivery goes through the
// same swappable EmailProvider, so nothing actually sends until a real provider
// (e.g. Resend) is configured; until then the stub logs server-side.
//
// Never throws: a notification failure must never roll back the Admin action
// that triggered it.

import { getEmailProvider } from "@/lib/notifications";

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(/\/$/, "");
  return `${base}${path}`;
}

async function sendEmail(to: string | null, subject: string, body: string): Promise<void> {
  if (!to) return;
  try {
    await getEmailProvider().sendMessage(to, { subject, body });
  } catch (e) {
    console.error(`[sitter-notify] failed to email ${to}: ${String(e).slice(0, 200)}`);
  }
}

// Sitter's application has been approved (VETTED) by the evaluation team.
export async function notifySitterVetted(to: string | null, name: string | null): Promise<void> {
  const hi = name ? `Hi ${name},` : "Hi,";
  await sendEmail(
    to,
    "You're approved to sit with Ri'aya Babysitters",
    `${hi}\n\n` +
      `Great news — our evaluation team has reviewed your application and you've been ` +
      `approved as a Ri'aya babysitter. Welcome to the team!\n\n` +
      `Next step: once we list your profile you'll be able to set your availability and ` +
      `start receiving booking requests. We'll email you again the moment you go live.\n\n` +
      `You can view your status any time here: ${appUrl("/dashboard")}\n\n` +
      `— Ri'aya Babysitters Inc.`,
  );
}

// Sitter has been listed and is now bookable by parents.
export async function notifySitterListed(to: string | null, name: string | null): Promise<void> {
  const hi = name ? `Hi ${name},` : "Hi,";
  await sendEmail(
    to,
    "You're now live on Ri'aya — parents can book you",
    `${hi}\n\n` +
      `Your profile is now live and parents can request bookings with you. ` +
      `Add your availability so families can find open times:\n\n` +
      `${appUrl("/dashboard")}\n\n` +
      `You'll get an email as soon as someone requests a booking.\n\n` +
      `— Ri'aya Babysitters Inc.`,
  );
}
