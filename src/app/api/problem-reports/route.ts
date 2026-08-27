import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { recordUserReport } from "@/lib/error-events";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const MIN_NOTE = 5;

// "Report a problem" — files a GitHub issue and alerts Admins. Open to
// signed-out visitors on purpose (a broken login page is exactly when someone
// needs it), so it is rate limited and the note is length-capped.
export async function POST(req: Request) {
  const limit = rateLimit(`reports:${clientKey(req)}`, 5, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "You've sent several reports already — we have them. Email info@riaya.ca if it's urgent.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    route?: string;
    note?: string;
    ref?: string;
  } | null;
  const note = (body?.note ?? "").trim();
  if (note.length < MIN_NOTE) {
    return NextResponse.json(
      { error: "Tell us briefly what went wrong." },
      { status: 400 },
    );
  }

  const session = await getSession();
  try {
    const { ref, issueUrl } = await recordUserReport({
      route: body?.route ?? "unknown",
      note,
      relatedRef: body?.ref ?? null,
      actor: {
        userId: session?.user?.id ?? null,
        userRole: session?.user?.role ?? null,
        userEmail: session?.user?.email ?? null,
      },
    });
    return NextResponse.json({ ref, issueFiled: issueUrl != null });
  } catch (e) {
    // The reporting path itself failing must not hand the user another error
    // screen — the note is at least in the server log.
    console.error(`[problem-report] failed: ${String(e).slice(0, 300)}`, note);
    return NextResponse.json(
      { error: "We couldn't log that. Please email info@riaya.ca." },
      { status: 500 },
    );
  }
}
