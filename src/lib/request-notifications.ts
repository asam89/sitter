// Broadcast notifications for open booking requests (a parent asked for a time
// no sitter has published availability for).
//
// Unlike booking-lifecycle notifications, these have no Booking row yet, so
// there is no Notification audit row to write — the request itself is the record.
// Email is the baseline channel; sitters also get a text when the Admin SMS
// toggle is on and a real provider is configured.
//
// Never throws: a broadcast failure must never roll back the parent's request.

import { prisma } from "@/lib/prisma";
import { getEmailProvider, getSmsProvider } from "@/lib/notifications";
import { getBusinessSettings } from "@/lib/settings";
import { dt, requestRef } from "@/lib/format";

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(/\/$/, "");
  return `${base}${path}`;
}

export type OpenRequestSummary = {
  requestNumber: number;
  startTime: Date;
  durationHours: number;
  numberOfChildren: number;
  childrenAgeRange: string;
  city: string | null;
  isLastMinute: boolean;
};

// Only the parent's city is included — never the service address, which is
// released to a single sitter after the request becomes a confirmed booking.
export function describeRequest(r: OpenRequestSummary): string {
  const where = r.city ? ` in ${r.city}` : "";
  return (
    `${requestRef(r.requestNumber)} — ${dt(r.startTime)} for ${r.durationHours}h` +
    `${where}, ${r.numberOfChildren} child(ren) aged ${r.childrenAgeRange}` +
    `${r.isLastMinute ? " (last-minute)" : ""}`
  );
}

// Fan an open request out to every listed, non-suspended sitter so whoever is
// free can pick it up. First to claim wins, so the text is deliberately short.
export async function notifyListedSittersOfRequest(
  r: OpenRequestSummary,
): Promise<void> {
  const [sitters, settings] = await Promise.all([
    prisma.sitterProfile.findMany({
      where: { isListed: true, user: { suspended: false } },
      select: { user: { select: { name: true, email: true, phone: true } } },
    }),
    getBusinessSettings(),
  ]);

  const summary = describeRequest(r);
  const link = appUrl("/sitter/requests");
  const email = getEmailProvider();
  const sms = settings.notifySmsEnabled ? getSmsProvider() : null;

  for (const { user } of sitters) {
    try {
      await email.sendMessage(user.email, {
        subject: "A family is looking for a sitter — open request",
        body:
          `Hi ${user.name},\n\n` +
          `A Ri'aya family has requested a sitter for a time nobody has posted ` +
          `availability for:\n\n${summary}\n\n` +
          `First sitter to pick it up gets the booking:\n${link}\n\n` +
          `— Ri'aya Babysitters Inc.`,
      });
    } catch (e) {
      console.error(
        `[request-notify] email to ${user.email} failed: ${String(e).slice(0, 200)}`,
      );
    }
    if (!sms || !user.phone) continue;
    try {
      await sms.sendMessage(user.phone, {
        subject: "Open sitter request",
        body: `Ri'aya: open request — ${summary}. Claim it: ${link}`,
      });
    } catch (e) {
      console.error(
        `[request-notify] SMS to ${user.name} failed: ${String(e).slice(0, 200)}`,
      );
    }
  }
}
