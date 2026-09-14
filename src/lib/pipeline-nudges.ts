// Daily pipeline sweep: chases the people whose inaction is holding up supply.
//
//   - A listed sitter with no open hours in the next two weeks can't be booked,
//     so they're reminded to fill their calendar.
//   - An applicant sitting at Applied / Under review / Interview (with no future
//     interview booked) is asked to reply with interview times.
//   - A sitter account that never submitted an application is pointed at the
//     form.
//   - Admin gets one digest of everything waiting on a human: applications to
//     review, interviews to book or write up, vetted sitters not yet listed,
//     listed sitters with empty calendars.
//
// Every nudge is logged in PipelineNudge and a person is only chased about the
// same thing once per NUDGE_COOLDOWN_DAYS, so the job is safe to run daily.
// Delivery never throws: a failed email must not stop the sweep.

import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/notifications";
import { adminAlertRecipients } from "@/lib/admin-notifications";
import { d } from "@/lib/format";
import type { PipelineNudgeKind } from "@prisma/client";

export const NUDGE_COOLDOWN_DAYS = 7;
export const EMPTY_CALENDAR_HORIZON_DAYS = 14;
export const APPLICANT_STALE_DAYS = 3;

const DAY_MS = 86_400_000;

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || "there";
}

async function send(
  to: string,
  subject: string,
  body: string,
  footer = `\n\nQuestions — just reply to this email.\n\n— The Ri'aya team\nwww.riaya.ca`,
): Promise<boolean> {
  try {
    await getEmailProvider().sendMessage(to, { subject, body: body + footer });
    return true;
  } catch (e) {
    console.error(
      `[pipeline-nudge] failed to email ${to}: ${String(e).slice(0, 200)}`,
    );
    return false;
  }
}

async function recentlyNudged(
  userId: string,
  kind: PipelineNudgeKind,
  now: Date,
): Promise<boolean> {
  const since = new Date(now.getTime() - NUDGE_COOLDOWN_DAYS * DAY_MS);
  const hit = await prisma.pipelineNudge.findFirst({
    where: { userId, kind, sentAt: { gte: since } },
    select: { id: true },
  });
  return hit !== null;
}

async function nudge(
  user: { id: string; email: string; name: string | null },
  kind: PipelineNudgeKind,
  subject: string,
  body: string,
  now: Date,
): Promise<boolean> {
  if (await recentlyNudged(user.id, kind, now)) return false;
  const ok = await send(user.email, subject, body);
  if (ok) {
    await prisma.pipelineNudge.create({ data: { userId: user.id, kind } });
  }
  return ok;
}

export type PipelineSweep = {
  emptyCalendars: number;
  sittersNudged: number;
  staleApplicants: number;
  applicantsNudged: number;
  unfinishedAccounts: number;
  unfinishedNudged: number;
  adminDigestSent: boolean;
};

export async function sweepPipeline(now = new Date()): Promise<PipelineSweep> {
  const horizon = new Date(
    now.getTime() + EMPTY_CALENDAR_HORIZON_DAYS * DAY_MS,
  );
  const stale = new Date(now.getTime() - APPLICANT_STALE_DAYS * DAY_MS);

  // 1. Listed sitters with nothing open in the next two weeks.
  const listed = await prisma.sitterProfile.findMany({
    where: { isListed: true, user: { suspended: false } },
    select: {
      user: { select: { id: true, email: true, name: true } },
      slots: {
        where: { status: "OPEN", startTime: { gte: now, lte: horizon } },
        select: { id: true },
        take: 1,
      },
    },
  });
  const emptyCalendars = listed.filter((s) => s.slots.length === 0);
  let sittersNudged = 0;
  for (const s of emptyCalendars) {
    const ok = await nudge(
      s.user,
      "SITTER_SCHEDULE",
      "Your Ri'aya calendar is empty — parents can't book you",
      `Hi ${firstName(s.user.name)},\n\n` +
        `You're listed on Ri'aya, but you have no open hours in the next two weeks, ` +
        `so parents looking for a sitter can't book you. It only takes a minute to fix:\n\n` +
        `${appUrl("/sitter/availability")}\n\n` +
        `Open the days and hours you can actually sit — evenings, daytime, weekends — ` +
        `and keep it current. A booking you accept is a commitment to the family, so only ` +
        `open hours you're sure of.`,
      now,
    );
    if (ok) sittersNudged++;
  }

  // 2. Applications waiting on an interview.
  const applications = await prisma.sitterApplication.findMany({
    where: {
      status: { in: ["APPLIED", "UNDER_REVIEW", "INTERVIEW"] },
      user: { suspended: false },
    },
    orderBy: { createdAt: "asc" },
    select: {
      status: true,
      createdAt: true,
      updatedAt: true,
      interviewScheduledAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  const staleApplicants = applications.filter(
    (a) =>
      a.updatedAt <= stale &&
      !(a.interviewScheduledAt && a.interviewScheduledAt > now),
  );
  let applicantsNudged = 0;
  for (const a of staleApplicants) {
    const ok = await nudge(
      a.user,
      "APPLICANT_NEXT_STEP",
      "Next step for your Ri'aya application: book your interview",
      `Hi ${firstName(a.user.name)},\n\n` +
        `Thank you for applying to sit with Ri'aya Babysitters. Parents are booking and ` +
        `we're growing the roster, so we'd love to get you on it.\n\n` +
        `The next step is a short interview with our team so we can get to know you and ` +
        `complete vetting. Reply to this email with a few times that work for you this ` +
        `week or next and we'll book it in.\n\n` +
        `Every Ri'aya sitter is interviewed in person and holds a current vulnerable-sector ` +
        `check — that's why families trust who we send.`,
      now,
    );
    if (ok) applicantsNudged++;
  }

  // 3. Sitter accounts that never applied.
  const unfinished = await prisma.user.findMany({
    where: {
      role: "SITTER",
      suspended: false,
      application: null,
      sitterProfile: null,
      createdAt: { lte: stale },
    },
    select: { id: true, email: true, name: true },
  });
  let unfinishedNudged = 0;
  for (const u of unfinished) {
    const ok = await nudge(
      u,
      "APPLICATION_UNFINISHED",
      "Finish your Ri'aya babysitter application",
      `Hi ${firstName(u.name)},\n\n` +
        `You created a Ri'aya sitter account but haven't submitted an application yet. ` +
        `It takes about ten minutes:\n\n${appUrl("/sitter/apply")}\n\n` +
        `Tell us about your experience, references and the hours you'd like. Once it's in, ` +
        `we'll book a short interview to complete vetting and get you on the roster.`,
      now,
    );
    if (ok) unfinishedNudged++;
  }

  // 4. Admin digest of everything waiting on a human.
  const toReview = applications.filter(
    (a) => a.status === "APPLIED" || a.status === "UNDER_REVIEW",
  );
  const interviewing = applications.filter((a) => a.status === "INTERVIEW");
  const unlistedVetted = await prisma.sitterProfile.findMany({
    where: { isListed: false, user: { suspended: false } },
    select: { user: { select: { name: true, email: true } } },
  });

  const label = (u: { name: string | null; email: string }) =>
    u.name?.trim() || u.email;
  const sections: string[] = [];
  if (toReview.length > 0) {
    sections.push(
      `APPLICATIONS TO REVIEW / INTERVIEW TO BOOK (${toReview.length})\n` +
        toReview
          .map((a) => `• ${label(a.user)} — applied ${d(a.createdAt)}`)
          .join("\n"),
    );
  }
  if (interviewing.length > 0) {
    sections.push(
      `INTERVIEWS TO HOLD OR WRITE UP, THEN VET (${interviewing.length})\n` +
        interviewing
          .map(
            (a) =>
              `• ${label(a.user)} — ` +
              (a.interviewScheduledAt
                ? `interview ${a.interviewScheduledAt > now ? "booked for" : "was on"} ${d(a.interviewScheduledAt)}`
                : "no interview time set"),
          )
          .join("\n"),
    );
  }
  if (unlistedVetted.length > 0) {
    sections.push(
      `VETTED BUT NOT LISTED (${unlistedVetted.length})\n` +
        unlistedVetted.map((s) => `• ${label(s.user)}`).join("\n"),
    );
  }
  if (emptyCalendars.length > 0) {
    sections.push(
      `LISTED SITTERS WITH NO OPEN HOURS IN ${EMPTY_CALENDAR_HORIZON_DAYS} DAYS (${emptyCalendars.length})\n` +
        emptyCalendars.map((s) => `• ${label(s.user)}`).join("\n"),
    );
  }
  if (unfinished.length > 0) {
    sections.push(
      `SITTER ACCOUNTS WITH NO APPLICATION (${unfinished.length})\n` +
        unfinished.map((u) => `• ${label(u)}`).join("\n"),
    );
  }

  let adminDigestSent = false;
  if (sections.length > 0) {
    const pending =
      toReview.length + interviewing.length + unlistedVetted.length;
    const { emails } = await adminAlertRecipients();
    for (const to of emails) {
      const ok = await send(
        to,
        `Ri'aya pipeline: ${pending} sitter${pending === 1 ? "" : "s"} waiting on you`,
        `Good morning — here's what's waiting on the team today.\n\n` +
          sections.join("\n\n") +
          `\n\nAutomatic reminders went out today to ${sittersNudged} sitter(s) with empty calendars, ` +
          `${applicantsNudged} applicant(s) to book an interview and ${unfinishedNudged} account(s) to finish applying ` +
          `(each person is reminded at most once every ${NUDGE_COOLDOWN_DAYS} days).\n\n` +
          `Applications: ${appUrl("/admin/applications")}\n` +
          `Sitters: ${appUrl("/admin/sitters")}\n` +
          `Accounts: ${appUrl("/admin/users")}`,
        "",
      );
      adminDigestSent = adminDigestSent || ok;
    }
  }

  return {
    emptyCalendars: emptyCalendars.length,
    sittersNudged,
    staleApplicants: staleApplicants.length,
    applicantsNudged,
    unfinishedAccounts: unfinished.length,
    unfinishedNudged,
    adminDigestSent,
  };
}
