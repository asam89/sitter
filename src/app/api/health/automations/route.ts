import { NextResponse } from "next/server";
import {
  HEALTHY_STATES,
  alertUnhealthyAutomations,
  automationHealth,
} from "@/lib/automations";

export const dynamic = "force-dynamic";

// Public health check for the scheduled jobs: 200 when every job is on
// schedule, 503 when any is overdue or failing. Safe to expose: it returns job
// names, states and timestamps only, never job results or personal data.
//
// Point an uptime monitor at it, or rely on the GitHub Actions watchdog
// (.github/workflows/automation-watchdog.yml). Each poll also emails Admins
// about unhealthy jobs (at most once per job per 12 hours).
export async function GET() {
  const health = await automationHealth();
  await alertUnhealthyAutomations(health);
  const ok = health.every((h) => HEALTHY_STATES.includes(h.state) || h.state === "NEVER_RUN");
  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      jobs: health.map((h) => ({
        job: h.key,
        state: h.state,
        schedule: h.schedule,
        lastRunAt: h.lastRunAt,
        lastSuccessAt: h.lastSuccessAt,
      })),
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
