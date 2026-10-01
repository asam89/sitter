import { NextResponse } from "next/server";
import { passwordResetConfirmSchema } from "@/lib/validation";
import { resetPassword } from "@/lib/password-reset";

const MESSAGES: Record<string, string> = {
  invalid: "This reset link is invalid.",
  expired: "This reset link has expired. Please request a new one.",
  used: "This reset link has already been used. Please request a new one.",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = passwordResetConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const result = await resetPassword(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json(
      { error: MESSAGES[result.reason] ?? MESSAGES.invalid },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
