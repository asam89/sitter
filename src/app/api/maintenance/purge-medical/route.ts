import { purgeExpiredMedical } from "@/lib/child-medical";
import { runMaintenanceJob } from "@/lib/automations";

// Retention job for per-child medical notes. Call it on a schedule (e.g. a
// daily cron on the host):
//   curl -fsS -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/purge-medical
// Token check and run tracking (/admin/automations) live in runMaintenanceJob.
export async function POST(req: Request) {
  return runMaintenanceJob(req, "purge-medical", async () => ({ purged: await purgeExpiredMedical() }));
}

export async function GET(req: Request) {
  return POST(req);
}
