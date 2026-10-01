import { NextResponse } from "next/server";
import { sendDueBookingReminders } from "@/lib/booking-reminders";

// Pre-session reminder job. Call it hourly (the final reminder can only be as
// punctual as the cron interval):
//   curl -fsS -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/booking-reminders
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
  const sent = await sendDueBookingReminders();
  return NextResponse.json(sent);
}

export async function GET(req: Request) {
  return POST(req);
}
