"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getEmailProvider } from "@/lib/notifications";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/consent";
import { CAMPAIGN_SENDER_IDENTITY } from "@/lib/campaign";
import { appUrl, hashConfirmToken, type SubscribeState } from "@/lib/newsletter";
import { newsletterSignupSchema } from "@/lib/validation";

// Public newsletter sign-up (footer/home form). Anyone can type any address
// here, so consent only counts once the recipient clicks the emailed link
// (double opt-in) — until then the row is unconfirmed and never mailed
// commercially. The response is identical whether or not the address is already
// on the list, so the form can't be used to probe who is subscribed.
export async function subscribeToNewsletter(
  _prev: SubscribeState,
  fd: FormData,
): Promise<SubscribeState> {
  const parsed = newsletterSignupSchema.safeParse({
    email: fd.get("email"),
    source: fd.get("source"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  }
  const email = parsed.data.email.toLowerCase();
  const h = headers();

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email },
  });
  if (existing?.confirmedAt && !existing.unsubscribedAt) {
    return { pending: true }; // already subscribed; say nothing more
  }

  const token = randomBytes(24).toString("hex");
  const data = {
    confirmTokenHash: hashConfirmToken(token),
    confirmSentAt: new Date(),
    consentText: NEWSLETTER_CONSENT_TEXT,
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
    source: parsed.data.source || null,
  };
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: {
      email,
      ...data,
      unsubscribeToken: randomBytes(24).toString("hex"),
    },
    // Re-subscribing after an opt-out is allowed, but only via a fresh
    // confirmation click.
    update: { ...data, confirmedAt: null, unsubscribedAt: null },
  });

  try {
    await getEmailProvider().sendMessage(email, {
      subject: "Confirm your Ri'aya newsletter subscription",
      body:
        `Please confirm you want Ri'aya Babysitters news and availability ` +
        `updates by opening this link:\n\n` +
        `${appUrl(`/newsletter/confirm?token=${token}`)}\n\n` +
        `You asked to receive: "${NEWSLETTER_CONSENT_TEXT}"\n\n` +
        `If this wasn't you, ignore this email and nothing further will be ` +
        `sent.\n\n—\n${CAMPAIGN_SENDER_IDENTITY}`,
    });
  } catch (e) {
    console.error(
      `[newsletter] confirmation email failed: ${String(e).slice(0, 200)}`,
    );
    return { error: "We couldn't send the confirmation email. Try again." };
  }
  return { pending: true };
}

// Completes double opt-in. Returns the confirmed address (or null for a token
// that doesn't match), so the page can show who was subscribed.
export async function confirmNewsletterSubscription(
  token: string,
): Promise<string | null> {
  const hash = hashConfirmToken(token);
  const row = await prisma.newsletterSubscriber.findUnique({
    where: { confirmTokenHash: hash },
  });
  if (!row) return null;
  await prisma.newsletterSubscriber.update({
    where: { id: row.id },
    data: { confirmTokenHash: null, confirmedAt: new Date(), unsubscribedAt: null },
  });

  // If they also hold an account, the confirmed click is express consent for it
  // too, so the parent audience picks them up without a second opt-in.
  await prisma.user.updateMany({
    where: { email: row.email, newsletterOptIn: false, newsletterOptOutAt: null },
    data: {
      newsletterOptIn: true,
      newsletterConsentAt: new Date(),
      newsletterConsentText: row.consentText,
    },
  });
  revalidatePath("/admin/broadcast");
  return row.email;
}

// One-click opt-in for a signed-in parent: the session proves they own the
// inbox, so no confirmation email is needed.
export async function optInToNewsletter(): Promise<void> {
  const user = await requireRole("PARENT");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      newsletterOptIn: true,
      newsletterConsentAt: new Date(),
      newsletterConsentText: NEWSLETTER_CONSENT_TEXT,
      newsletterOptOutAt: null,
    },
  });
  revalidatePath("/parent");
}
