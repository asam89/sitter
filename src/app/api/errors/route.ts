import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { recordServerError } from "@/lib/error-events";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// Called by the error boundaries when a page or server action throws, so an
// Admin is alerted instead of finding out from the user. Next.js only hands the
// browser a digest in production; the matching server log line holds the stack.
export async function POST(req: Request) {
  const limit = rateLimit(`errors:${clientKey(req)}`, 10, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many reports" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    route?: string;
    digest?: string;
    message?: string;
  } | null;
  if (!body?.route) {
    return NextResponse.json({ error: "route is required" }, { status: 400 });
  }

  const session = await getSession();
  try {
    const { ref } = await recordServerError({
      route: body.route,
      digest: body.digest,
      message: body.message,
      actor: {
        userId: session?.user?.id ?? null,
        userRole: session?.user?.role ?? null,
        userEmail: session?.user?.email ?? null,
      },
    });
    return NextResponse.json({ ref });
  } catch (e) {
    console.error(`[error-event] recording failed: ${String(e).slice(0, 300)}`);
    return NextResponse.json({ error: "Not recorded" }, { status: 500 });
  }
}
