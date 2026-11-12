import { sweepWeeklySchedules } from "@/lib/pipeline-nudges";
import { runMaintenanceJob } from "@/lib/automations";

// Weekly reminder (email + text) asking every vetted sitter to set the coming
// week's availability. Run once a week (throttled per sitter to once every 6 days):
//   curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/weekly-schedule-reminders
// Token check and run tracking (/admin/automations) live in runMaintenanceJob.
export async function POST(req: Request) {
  return runMaintenanceJob(req, "weekly-schedule-reminders", () => sweepWeeklySchedules());
}

export async function GET(req: Request) {
  return POST(req);
}
