import { NextResponse } from "next/server";
import { purgeExpiredMedical } from "@/lib/child-medical";

// Retention job for per-child medical notes. Call it on a schedule (e.g. a
// daily cron on the host):
//   curl -fsS -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/purge-medical
// Requires MAINTENANCE_TOKEN to be set; without it the route is disabled so a
// missing env var can never leave the endpoint open.
export async function POST(req: Request) {
  const expected = process.env.MAINTENANCE_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }
  if (req.headers.get("x-maintenance-token") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const purged = await purgeExpiredMedical();
  return NextResponse.json({ purged });
}

export async function GET(req: Request) {
  return POST(req);
}
