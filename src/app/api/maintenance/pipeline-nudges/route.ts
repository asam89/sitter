import { sweepPipeline } from "@/lib/pipeline-nudges";
import { runMaintenanceJob } from "@/lib/automations";

// Daily sweep that reminds listed sitters with empty calendars, chases
// applicants to book an interview, points half-registered sitters at the
// application form, and sends Admin a digest of what's waiting on them.
// Run once a day (nudges are throttled per person, the digest is not):
//   curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/pipeline-nudges
// Token check and run tracking (/admin/automations) live in runMaintenanceJob.
export async function POST(req: Request) {
  return runMaintenanceJob(req, "pipeline-nudges", () => sweepPipeline());
}

export async function GET(req: Request) {
  return POST(req);
}
