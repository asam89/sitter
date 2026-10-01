import { NextResponse } from "next/server";
import { sweepWeeklySchedules } from "@/lib/pipeline-nudges";

// Weekly reminder asking every listed sitter to review the coming week's
// availability. Run once a week (throttled per sitter to once every 6 days):
//   curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/weekly-schedule-reminders
export async function POST(req: Request) {
  const expected = process.env.MAINTENANCE_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }
  if (req.headers.get("x-maintenance-token") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sweepWeeklySchedules());
}

export async function GET(req: Request) {
  return POST(req);
}
