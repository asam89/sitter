import { NextResponse } from "next/server";
import { sweepPipeline } from "@/lib/pipeline-nudges";

// Daily sweep that reminds listed sitters with empty calendars, chases
// applicants to book an interview, points half-registered sitters at the
// application form, and sends Admin a digest of what's waiting on them.
// Run once a day (nudges are throttled per person, the digest is not):
//   curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/pipeline-nudges
export async function POST(req: Request) {
  const expected = process.env.MAINTENANCE_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }
  if (req.headers.get("x-maintenance-token") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sweepPipeline());
}

export async function GET(req: Request) {
  return POST(req);
}
