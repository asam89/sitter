import { NextResponse } from "next/server";
import { passwordResetRequestSchema } from "@/lib/validation";
import { requestPasswordReset } from "@/lib/password-reset";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = passwordResetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Always succeed regardless of whether the email matches an account, so the
  // response can't be used to enumerate registered emails.
  await requestPasswordReset(parsed.data.email).catch((e) => {
    console.error("[password-reset] request failed:", e);
  });

  return NextResponse.json({ ok: true });
}
