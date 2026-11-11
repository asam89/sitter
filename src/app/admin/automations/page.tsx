import { requireRole } from "@/lib/session";
import { Badge, Card, PageTitle } from "@/components/ui";
import { dt } from "@/lib/format";
import {
  type AutomationState,
  HEALTHY_STATES,
  automationHealth,
} from "@/lib/automations";

export const dynamic = "force-dynamic";

const STATE_BADGE: Record<
  AutomationState,
  { label: string; color: "green" | "amber" | "red" | "slate" }
> = {
  OK: { label: "Running", color: "green" },
  WARNING: { label: "Ran with delivery failures", color: "amber" },
  FAILING: { label: "Last run failed", color: "red" },
  OVERDUE: { label: "Overdue", color: "red" },
  NEVER_RUN: { label: "No runs recorded yet", color: "slate" },
};

function summaryText(summary: unknown): string | null {
  if (!summary || typeof summary !== "object") return null;
  return Object.entries(summary as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

// Is every scheduled job actually running? The host crontab calls the
// /api/maintenance/* routes; each call is recorded so a job that silently
// stopped shows up here as Overdue instead of just going quiet.
export default async function AdminAutomationsPage() {
  await requireRole("ADMIN");
  const health = await automationHealth();
  const unhealthy = health.filter(
    (h) => !HEALTHY_STATES.includes(h.state) && h.state !== "NEVER_RUN",
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title="Automations"
        subtitle="Scheduled jobs that send reminders, nudges and newsletters. A job that misses its schedule or fails emails Admins (at most once every 12 hours) and is listed under Failures & reports."
      />

      <Card>
        <p
          className={
            unhealthy.length
              ? "text-sm font-medium text-red-700"
              : "text-sm text-emerald-800"
          }
        >
          {unhealthy.length
            ? `${unhealthy.length} of ${health.length} jobs need attention.`
            : `All ${health.length} jobs are on schedule (or waiting for their first run).`}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Public check for uptime monitors: <code>/api/health/automations</code>{" "}
          (200 = healthy, 503 = something is overdue or failing).
        </p>
      </Card>

      <div className="space-y-3">
        {health.map((h) => {
          const badge = STATE_BADGE[h.state];
          const summary = summaryText(h.lastSummary);
          return (
            <Card key={h.key}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{h.label}</span>
                <Badge color={badge.color}>{badge.label}</Badge>
                <span className="ml-auto text-xs text-slate-500">
                  {h.schedule}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{h.does}</p>
              <p className="mt-2 text-xs text-slate-500">
                Last run: {h.lastRunAt ? dt(h.lastRunAt) : "never"} · Last
                success: {h.lastSuccessAt ? dt(h.lastSuccessAt) : "never"} ·{" "}
                {h.runsLast7Days} {h.runsLast7Days === 1 ? "run" : "runs"} in
                the last 7 days
              </p>
              {summary && (
                <p className="mt-1 font-mono text-xs text-slate-600">
                  {summary}
                </p>
              )}
              {h.lastError && (
                <p className="mt-1 break-words font-mono text-xs text-red-700">
                  {h.lastError}
                </p>
              )}
              <p className="mt-1 font-mono text-xs text-slate-400">
                /api/maintenance/{h.key}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
