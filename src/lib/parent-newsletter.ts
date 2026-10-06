// Recurring "book now" email to every registered parent (implied consent),
// summarising which vetted sitters have open hours over the next two weeks.
import { prisma } from "@/lib/prisma";
import { registeredParents } from "@/lib/campaign";
import {
  deliverEmailCampaign,
  emailCampaignRecipients,
} from "@/lib/campaign-delivery";

export const NEWSLETTER_HORIZON_DAYS = 14;
// Cron runs weekly; this throttle makes the email go out every other week.
export const NEWSLETTER_COOLDOWN_DAYS = 13;
export const NEWSLETTER_SUBJECT = "Ri'aya sitters available over the next two weeks";
const EVENING_FROM_HOUR = 16;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type AvailabilitySummary = {
  sitters: string[];
  openHours: number;
  eveningSitters: number;
  weekendSitters: number;
  daysCovered: number;
  recentBookings: number;
};

const torontoParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});

function local(d: Date) {
  const p = Object.fromEntries(
    torontoParts.formatToParts(d).map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekend: p.weekday === "Sat" || p.weekday === "Sun",
    hour: Number(p.hour),
  };
}

function firstName(name: string | null): string {
  return (name ?? "").trim().split(/\s+/)[0] || "";
}

export async function availabilitySummary(
  now = new Date(),
): Promise<AvailabilitySummary> {
  const until = new Date(now.getTime() + NEWSLETTER_HORIZON_DAYS * DAY_MS);
  const slots = await prisma.availabilitySlot.findMany({
    where: {
      status: "OPEN",
      endTime: { gt: now },
      startTime: { lt: until },
      sitterProfile: {
        isListed: true,
        user: { suspended: false, role: "SITTER" },
      },
    },
    select: {
      startTime: true,
      endTime: true,
      sitterProfile: { select: { id: true, user: { select: { name: true } } } },
    },
  });

  const sitters = new Map<string, string>();
  const days = new Set<string>();
  let openHours = 0;
  const evening = new Set<string>();
  const weekend = new Set<string>();
  for (const s of slots) {
    const start = Math.max(s.startTime.getTime(), now.getTime());
    const end = Math.min(s.endTime.getTime(), until.getTime());
    if (end <= start) continue;
    sitters.set(s.sitterProfile.id, firstName(s.sitterProfile.user.name));
    for (let t = start; t < end; t += HOUR_MS) {
      const h = Math.min(HOUR_MS, end - t) / HOUR_MS;
      const l = local(new Date(t));
      openHours += h;
      if (l.hour >= EVENING_FROM_HOUR) evening.add(s.sitterProfile.id);
      if (l.weekend) weekend.add(s.sitterProfile.id);
      days.add(l.date);
    }
  }

  const recentBookings = await prisma.booking.count({
    where: {
      status: "COMPLETED",
      dateTime: { gte: new Date(now.getTime() - 30 * DAY_MS), lte: now },
    },
  });

  return {
    sitters: Array.from(sitters.values()).filter(Boolean).sort(),
    openHours: Math.round(openHours),
    eveningSitters: evening.size,
    weekendSitters: weekend.size,
    daysCovered: Math.min(days.size, NEWSLETTER_HORIZON_DAYS),
    recentBookings,
  };
}

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(/\/$/, "");
  return `${base}${path}`;
}

export function newsletterBody(s: AvailabilitySummary): string {
  const lines = [
    `${s.sitters.length} vetted sitter${s.sitters.length === 1 ? " has" : "s have"} open times`,
    `A sitter is free on ${s.daysCovered} of the next ${NEWSLETTER_HORIZON_DAYS} days`,
    `${s.eveningSitters} free in the evenings (after 4pm), ${s.weekendSitters} free on weekends`,
  ];
  if (s.recentBookings >= 3) {
    lines.push(`${s.recentBookings} sittings completed in the last 30 days`);
  }
  return (
    `Assalamu Alaikum. Here is what our babysitters have open over the next two weeks:\n\n` +
    lines.map((l) => `• ${l}`).join("\n") +
    `\n\nAvailable: ${s.sitters.join(", ")}\n\n` +
    `Every Ri'aya sitter is interviewed and background checked by our team before she is listed.\n\n` +
    `See their profiles and book a time: ${appUrl("/parent/sitters")}\n\n` +
    `Thank you,\nThe Ri'aya Babysitters team`
  );
}

export type NewsletterRun = {
  sent: number;
  failures: number;
  skipped?: string;
};

export async function sendParentNewsletter(
  now = new Date(),
  opts: { force?: boolean; sentByUserId?: string } = {},
): Promise<NewsletterRun> {
  if (!opts.force) {
    const recent = await prisma.emailCampaign.findFirst({
      where: {
        subject: NEWSLETTER_SUBJECT,
        sentAt: { gte: new Date(now.getTime() - NEWSLETTER_COOLDOWN_DAYS * DAY_MS) },
      },
      select: { id: true },
    });
    if (recent) return { sent: 0, failures: 0, skipped: "sent recently" };
  }

  const summary = await availabilitySummary(now);
  if (summary.openHours === 0) {
    return { sent: 0, failures: 0, skipped: "no open sitter hours" };
  }

  const author =
    opts.sentByUserId ??
    (
      await prisma.user.findFirst({
        where: { role: "ADMIN", suspended: false },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id;
  if (!author) return { sent: 0, failures: 0, skipped: "no admin account" };

  const recipients = await emailCampaignRecipients("REGISTERED", now);
  if (recipients.length === 0) {
    return { sent: 0, failures: 0, skipped: "no registered parents" };
  }
  const parents = await prisma.user.count({
    where: { role: "PARENT", suspended: false },
  });
  const reachable = await prisma.user.count({ where: registeredParents(now) });
  return deliverEmailCampaign({
    subject: NEWSLETTER_SUBJECT,
    body: newsletterBody(summary),
    audienceKind: "REGISTERED",
    recipients,
    sentByUserId: author,
    suppressed: parents - reachable,
  });
}
