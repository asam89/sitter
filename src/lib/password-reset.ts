import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/notifications";

export const RESET_TOKEN_TTL_MINUTES = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function resetUrl(token: string): string {
  const base = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/reset-password?token=${token}`;
}

// Creates a reset token for the account with `email` (if one exists) and emails
// the reset link. Callers must NOT reveal whether the email matched an account.
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) return; // silently no-op to avoid account enumeration

  // Invalidate any outstanding tokens for this user before issuing a new one.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
  });

  const link = resetUrl(token);
  await getEmailProvider().sendMessage(user.email, {
    subject: "Reset your Ri'aya password",
    body: [
      `Hi ${user.name},`,
      "",
      "We received a request to reset your Ri'aya Babysitters password.",
      `Reset it here (valid for ${RESET_TOKEN_TTL_MINUTES} minutes):`,
      link,
      "",
      "If you didn't request this, you can safely ignore this email — your password won't change.",
    ].join("\n"),
  });
}

export type ResetResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "used" };

// Consumes a reset token and sets the new password. Single-use: the token (and
// any siblings) are invalidated on success.
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<ResetResult> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now())
    return { ok: false, reason: "expired" };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // drop any other outstanding tokens for this user
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, id: { not: record.id } },
    }),
  ]);
  return { ok: true };
}
