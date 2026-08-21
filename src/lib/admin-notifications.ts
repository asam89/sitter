// Admin-facing alerts (email, plus optional SMS).
//
// The Admin dashboard is the source of truth, but Admins also want a push when
// something needs their attention: a new account, a submitted sitter
// application, or a new booking request. Delivery goes through the same
// swappable EmailProvider as every other email, so nothing sends until a real
// provider is configured (the stub logs server-side).
//
// Recipients default to every ADMIN user in the database so adding an Admin
// account is enough to start receiving alerts; ADMIN_ALERT_EMAILS overrides
// that with an explicit comma-separated list. Each alert can be switched off
// individually (ADMIN_ALERT_SIGNUP / _APPLICATION / _BOOKING = false).
//
// Text alerts go to ADMIN_ALERT_PHONES and need a real SMS provider
// (SMS_PROVIDER=twilio); unset, the stub logs them server-side.
//
// Never throws: an alert failure must never roll back the user action that
// triggered it.

import { prisma } from "@/lib/prisma";
import { getEmailProvider, getSmsProvider } from "@/lib/notifications";
import { bookingRef, dt, money } from "@/lib/format";

type AdminAlert = "SIGNUP" | "APPLICATION" | "BOOKING";

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(/\/$/, "");
  return `${base}${path}`;
}

function isEnabled(alert: AdminAlert): boolean {
  const raw = process.env[`ADMIN_ALERT_${alert}`];
  if (raw === undefined || raw === "") return true;
  return raw !== "false" && raw !== "0";
}

// Admin phone numbers for text alerts. Admin accounts don't reliably carry a
// phone, so texting is opt-in through an explicit list.
function adminPhones(): string[] {
  return (process.env.ADMIN_ALERT_PHONES ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

async function adminRecipients(): Promise<string[]> {
  const override = process.env.ADMIN_ALERT_EMAILS;
  if (override) {
    return override
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  }
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", suspended: false },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}

async function alertAdmins(
  alert: AdminAlert,
  subject: string,
  body: string,
): Promise<void> {
  if (!isEnabled(alert)) return;
  try {
    const to = await adminRecipients();
    const email = getEmailProvider();
    for (const address of to) {
      await email.sendMessage(address, {
        subject,
        body: `${body}\n\n— Ri'aya Babysitters Inc.`,
      });
    }
  } catch (e) {
    console.error(
      `[admin-notify] ${alert} email alert failed: ${String(e).slice(0, 200)}`,
    );
  }
  // Texts run independently of email so one channel failing can't mute the
  // other. The subject already says who/what, so that's the whole text.
  try {
    const phones = adminPhones();
    if (phones.length === 0) return;
    const sms = getSmsProvider();
    for (const phone of phones) {
      await sms.sendMessage(phone, { subject, body: `Ri'aya: ${subject}` });
    }
  } catch (e) {
    console.error(
      `[admin-notify] ${alert} SMS alert failed: ${String(e).slice(0, 200)}`,
    );
  }
}

// A new account was created (parent or sitter).
export async function notifyAdminsOfSignup(u: {
  name: string;
  email: string;
  role: string;
  phone: string | null;
  city?: string | null;
}): Promise<void> {
  const kind = u.role === "SITTER" ? "babysitter" : u.role.toLowerCase();
  await alertAdmins(
    "SIGNUP",
    `New ${kind} sign-up: ${u.name}`,
    `A new ${kind} account was just created on Ri'aya.\n\n` +
      `Name: ${u.name}\n` +
      `Email: ${u.email}\n` +
      `Phone: ${u.phone ?? "—"}\n` +
      (u.city ? `City: ${u.city}\n` : "") +
      `Signed up: ${dt(new Date())}\n\n` +
      (u.role === "SITTER"
        ? `They still need to submit a vetting application — you'll get another ` +
          `alert when they do: ${appUrl("/admin/applications")}`
        : `Parent accounts: ${appUrl("/admin/parents")}`),
  );
}

// A sitter submitted (or resubmitted) their vetting application.
export async function notifyAdminsOfApplication(a: {
  name: string | null;
  email: string | null;
  targetPayRate: number;
  resubmitted: boolean;
}): Promise<void> {
  const who = a.name || a.email || "A babysitter";
  await alertAdmins(
    "APPLICATION",
    `${a.resubmitted ? "Updated" : "New"} babysitter application: ${who}`,
    `${who} ${a.resubmitted ? "resubmitted" : "submitted"} a babysitter ` +
      `application and it's waiting for review.\n\n` +
      `Name: ${a.name ?? "—"}\n` +
      `Email: ${a.email ?? "—"}\n` +
      `Requested rate: ${money(a.targetPayRate)}/hr\n` +
      `Submitted: ${dt(new Date())}\n\n` +
      `Review and schedule the interview here: ${appUrl("/admin/applications")}`,
  );
}

// A parent requested a booking (still awaiting the sitter's approval).
export async function notifyAdminsOfBooking(b: {
  id: string;
  bookingNumber: number;
  parentName: string;
  sitterName: string;
  when: Date;
  durationHours: number;
  totalAmount: number;
  isLastMinute: boolean;
}): Promise<void> {
  await alertAdmins(
    "BOOKING",
    `New booking request ${bookingRef(b.bookingNumber)}: ${b.parentName} → ${b.sitterName}`,
    `A parent just requested a booking.\n\n` +
      `Reference: ${bookingRef(b.bookingNumber)}\n` +
      `Parent: ${b.parentName}\n` +
      `Babysitter: ${b.sitterName}\n` +
      `When: ${dt(b.when)} (${b.durationHours}h)${b.isLastMinute ? " — last minute" : ""}\n` +
      `Total: ${money(b.totalAmount)}\n\n` +
      `The babysitter has been notified and needs to approve it. ` +
      `Details: ${appUrl(`/bookings/${b.id}`)}\n` +
      `All bookings: ${appUrl("/admin/bookings")}`,
  );
}
