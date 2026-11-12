// Scheduled-job tracking: did each automation actually run, and did it work?
//
// The jobs themselves are plain HTTP routes under /api/maintenance/* that the
// host crontab calls with MAINTENANCE_TOKEN. Before this, a cron line that was
// deleted, a host that rebooted without cron, or a token that changed would
// fail silently: reminders and newsletters simply stop and nothing says so.
//
// Every run is now recorded in JobRun. From that:
//   - /admin/automations shows each job's last run, last success and result.
//   - GET /api/health/automations returns 200 when every job is on schedule
//     and 503 otherwise, for an outside uptime monitor (and the GitHub Actions
//     watchdog in .github/workflows/automation-watchdog.yml).
//   - A failed run, or a check that finds a job overdue, alerts Admins through
//     the same broken-function path as /admin/errors (once per job per 12h).

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordServerError } from "@/lib/error-events";

const HOUR = 3_600_000;

export type AutomationKey =
  | "booking-reminders"
  | "pipeline-nudges"
  | "purge-medical"
  | "screening-expiry"
  | "weekly-schedule-reminders"
  | "parent-newsletter";

export type Automation = {
  key: AutomationKey;
  label: string;
  does: string;
  schedule: string; // human description of the intended cron
  maxGapHours: number; // overdue once the last successful run is older than this
};

// Gaps leave slack for one late or skipped run before anyone is alerted.
export const AUTOMATIONS: Automation[] = [
  {
    key: "booking-reminders",
    label: "Booking reminders & auto-complete",
    does: "Pre-session reminders, completes paid bookings that have ended, asks parents for feedback.",
    schedule: "Hourly",
    maxGapHours: 3,
  },
  {
    key: "pipeline-nudges",
    label: "Pipeline nudges",
    does: "Chases empty sitter calendars, stalled applicants and unfinished accounts; Admin digest.",
    schedule: "Daily, 09:05 UTC",
    maxGapHours: 28,
  },
  {
    key: "screening-expiry",
    label: "Background-check expiry",
    does: "Warns sitters whose police / vulnerable-sector checks are expiring; Admin digest.",
    schedule: "Daily",
    maxGapHours: 28,
  },
  {
    key: "purge-medical",
    label: "Medical-notes retention purge",
    does: "Deletes per-child medical notes 60 days after the session.",
    schedule: "Daily",
    maxGapHours: 28,
  },
  {
    key: "weekly-schedule-reminders",
    label: "Weekly schedule reminder",
    does: "Asks every vetted sitter to set the coming week's availability.",
    schedule: "Weekly, Sunday 22:00 UTC",
    maxGapHours: 8 * 24,
  },
  {
    key: "parent-newsletter",
    label: "Parent availability newsletter",
    does: "Every-other-week email to parents with the next two weeks of availability.",
    schedule: "Weekly (sends every 13 days)",
    maxGapHours: 8 * 24,
  },
];

export type AutomationState =
  | "OK" // last run succeeded and is within the expected gap
  | "WARNING" // ran, but reported delivery failures
  | "FAILING" // the most recent run threw
  | "OVERDUE" // no successful run within maxGapHours
  | "NEVER_RUN"; // nothing recorded yet

export type AutomationHealth = Automation & {
  state: AutomationState;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  lastSummary: unknown;
  runsLast7Days: number;
};

export const HEALTHY_STATES: AutomationState[] = ["OK", "WARNING"];

// Before the first run of a newly deployed job there is nothing to judge, so
// "never run" only counts as unhealthy once tracking has existed for longer
// than the job's gap. The earliest JobRun of any job marks when tracking began.
async function trackingStartedAt(): Promise<Date | null> {
  const first = await prisma.jobRun.findFirst({
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });
  return first?.startedAt ?? null;
}

function failuresIn(summary: unknown): number {
  if (summary && typeof summary === "object" && "failures" in summary) {
    const n = Number((summary as { failures: unknown }).failures);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function automationHealth(
  now = new Date(),
): Promise<AutomationHealth[]> {
  const since7d = new Date(now.getTime() - 7 * 24 * HOUR);
  const startedTracking = await trackingStartedAt();

  return Promise.all(
    AUTOMATIONS.map(async (a) => {
      const [last, lastSuccess, runsLast7Days] = await Promise.all([
        prisma.jobRun.findFirst({
          where: { job: a.key, finishedAt: { not: null } },
          orderBy: { startedAt: "desc" },
        }),
        prisma.jobRun.findFirst({
          where: { job: a.key, ok: true },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        }),
        prisma.jobRun.count({
          where: { job: a.key, startedAt: { gte: since7d } },
        }),
      ]);

      const gapMs = a.maxGapHours * HOUR;
      let state: AutomationState;
      if (!last) {
        const graceOver =
          startedTracking !== null &&
          now.getTime() - startedTracking.getTime() > gapMs;
        state = graceOver ? "OVERDUE" : "NEVER_RUN";
      } else if (last.ok === false) {
        state = "FAILING";
      } else if (
        !lastSuccess ||
        now.getTime() - lastSuccess.startedAt.getTime() > gapMs
      ) {
        state = "OVERDUE";
      } else if (failuresIn(last.summary) > 0) {
        state = "WARNING";
      } else {
        state = "OK";
      }

      return {
        ...a,
        state,
        lastRunAt: last?.startedAt ?? null,
        lastSuccessAt: lastSuccess?.startedAt ?? null,
        lastError: last?.ok === false ? last.error : null,
        lastSummary: last?.summary ?? null,
        runsLast7Days,
      };
    }),
  );
}

const ALERT_DEDUPE_HOURS = 12;

// Alert Admins about a job, at most once per job per 12 hours, through the
// broken-function path so it also lands on /admin/errors.
async function alertJob(key: AutomationKey, message: string): Promise<void> {
  const route = `/automations/${key}`;
  try {
    const recent = await prisma.errorEvent.findFirst({
      where: {
        route,
        createdAt: { gte: new Date(Date.now() - ALERT_DEDUPE_HOURS * HOUR) },
      },
      select: { id: true },
    });
    if (recent) return;
    await recordServerError({ route, message });
  } catch (e) {
    console.error(`[automations] alert for ${key} failed: ${String(e)}`);
  }
}

// Alerts on every job that is overdue or failing. Called by the health route,
// so whatever polls it (uptime monitor, GitHub watchdog) also drives emails.
export async function alertUnhealthyAutomations(
  health: AutomationHealth[],
): Promise<void> {
  for (const h of health) {
    if (h.state === "OVERDUE") {
      await alertJob(
        h.key,
        `Scheduled job "${h.label}" has not run successfully since ` +
          `${h.lastSuccessAt?.toISOString() ?? "it was set up"} (expected: ${h.schedule}). ` +
          `Check the crontab on the host and MAINTENANCE_TOKEN.`,
      );
    } else if (h.state === "FAILING") {
      await alertJob(
        h.key,
        `Scheduled job "${h.label}" failed on its last run: ${h.lastError ?? "unknown error"}`,
      );
    }
  }
}

// Shared handler for every /api/maintenance/* route: checks the token, records
// the run, and turns a thrown error into a 500 (so `curl -f` in cron fails
// loudly) plus an Admin alert.
export async function runMaintenanceJob(
  req: Request,
  key: AutomationKey,
  job: () => Promise<unknown>,
): Promise<NextResponse> {
  const expected = process.env.MAINTENANCE_TOKEN;
  // Without the token the route is disabled, so a missing env var can never
  // leave the endpoint open.
  if (!expected) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }
  if (req.headers.get("x-maintenance-token") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tracking must never stop the job itself from running.
  const run = await prisma.jobRun
    .create({ data: { job: key }, select: { id: true } })
    .catch((e) => {
      console.error(`[automations] could not record ${key} start: ${e}`);
      return null;
    });

  try {
    const result = await job();
    if (run) {
      await prisma.jobRun
        .update({
          where: { id: run.id },
          data: {
            finishedAt: new Date(),
            ok: true,
            summary:
              result === undefined || result === null
                ? Prisma.JsonNull
                : (result as Prisma.InputJsonValue),
          },
        })
        .catch((e) =>
          console.error(`[automations] could not record ${key} result: ${e}`),
        );
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = String(e instanceof Error ? e.message : e).slice(0, 500);
    console.error(`[automations] ${key} failed: ${message}`);
    if (run) {
      await prisma.jobRun
        .update({
          where: { id: run.id },
          data: { finishedAt: new Date(), ok: false, error: message },
        })
        .catch(() => {});
    }
    await alertJob(key, `Scheduled job failed: ${message}`);
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
}
