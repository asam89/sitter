import { NextResponse } from "next/server";
import { sweepScreeningExpiry } from "@/lib/screening-notifications";

// Daily sweep that nudges sitters whose background checks are expiring (or have
// expired) and sends Admin a digest. Call it on a schedule:
//   curl -fsS -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/screening-expiry
// Requires MAINTENANCE_TOKEN; without it the route is disabled so a missing env
// var can never leave the endpoint open. Run it once a day — each run emails
// every affected sitter.
export async function POST(req: Request) {
  const expected = process.env.MAINTENANCE_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }
  if (req.headers.get("x-maintenance-token") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sweepScreeningExpiry());
}

export async function GET(req: Request) {
  return POST(req);
}
