import { sendParentNewsletter } from "@/lib/parent-newsletter";
import { runMaintenanceJob } from "@/lib/automations";

// Every-other-week "book now" email to registered parents with sitter
// availability for the next two weeks. Run weekly (throttled to every 13 days):
//   curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/parent-newsletter
// Token check and run tracking (/admin/automations) live in runMaintenanceJob.
export async function POST(req: Request) {
  return runMaintenanceJob(req, "parent-newsletter", () => sendParentNewsletter());
}

export async function GET(req: Request) {
  return POST(req);
}
