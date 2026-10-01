import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/notifications";

export const RESET_TOKEN_TTL_MINUTES = 60;
// An invited account can't be used at all until the token is redeemed, so the
// window is generous — a one-hour link would strand anyone who isn't at their
// inbox when an Admin creates the account.
export const INVITE_TOKEN_TTL_MINUTES = 7 * 24 * 60;

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

// Issues a single outstanding token for a user, invalidating any earlier one.
async function issueToken(
  userId: string,
  ttlMinutes: number,
): Promise<string> {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    },
  });
  return token;
}

// Invitation for an account an Admin created on someone's behalf. The same
// single-use token mechanism as a reset: no password is ever chosen for them, so
// the account is unusable until they set their own.
export async function sendAccountSetupInvite(user: {
  id: string;
  email: string;
  name: string;
  role: "PARENT" | "SITTER";
}): Promise<void> {
  const link = resetUrl(await issueToken(user.id, INVITE_TOKEN_TTL_MINUTES));
  const next =
    user.role === "SITTER"
      ? "Once you're in, add your availability so families can book you."
      : "Once you're in, you can see your bookings and book a sitter yourself.";
  await getEmailProvider().sendMessage(user.email, {
    subject: "Set your Ri'aya password",
    body: [
      `Hi ${user.name},`,
      "",
      "Ri'aya Babysitters has set up an account for you. Choose a password to",
      `activate it (link valid for ${INVITE_TOKEN_TTL_MINUTES / (24 * 60)} days):`,
      link,
      "",
      next,
      "",
      "If you weren't expecting this, you can ignore this email — the account",
      "can't be used until a password is set.",
    ].join("\n"),
  });
}

// Creates a reset token for the account with `email` (if one exists) and emails
// the reset link. Callers must NOT reveal whether the email matched an account.
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) return; // silently no-op to avoid account enumeration

  const link = resetUrl(await issueToken(user.id, RESET_TOKEN_TTL_MINUTES));
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
