import { NextResponse } from "next/server";
import { sendParentNewsletter } from "@/lib/parent-newsletter";

// Every-other-week "book now" email to registered parents with sitter
// availability for the next two weeks. Run weekly (throttled to every 13 days):
//   curl -fsS -X POST -H "x-maintenance-token: $MAINTENANCE_TOKEN" \
//     https://riaya.ca/api/maintenance/parent-newsletter
export async function POST(req: Request) {
  const expected = process.env.MAINTENANCE_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }
  if (req.headers.get("x-maintenance-token") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendParentNewsletter());
}

export async function GET(req: Request) {
  return POST(req);
}
