import { sweepScreeningExpiry } from "@/lib/screening-notifications";
import { runMaintenanceJob } from "@/lib/automations";

// Daily sweep that nudges sitters whose background checks are expiring (or have
// expired) and sends Admin a digest. Call it on a schedule:
//   curl -fsS -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/screening-expiry
// Run it once a day: each run emails every affected sitter.
// Token check and run tracking (/admin/automations) live in runMaintenanceJob.
export async function POST(req: Request) {
  return runMaintenanceJob(req, "screening-expiry", () => sweepScreeningExpiry());
}

export async function GET(req: Request) {
  return POST(req);
}
