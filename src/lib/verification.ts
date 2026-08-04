import type { ParentProfile, User, VerificationLevel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getBusinessSettings } from "@/lib/settings";

export const CODE_TTL_MINUTES = 10;

const LEVEL_RANK: Record<VerificationLevel, number> = {
  LEVEL_0_REGISTERED: 0,
  LEVEL_1_CONTACT: 1,
  LEVEL_2_IDENTITY: 2,
};

export const LEVEL_LABEL: Record<VerificationLevel, string> = {
  LEVEL_0_REGISTERED: "Registered",
  LEVEL_1_CONTACT: "Contact verified",
  LEVEL_2_IDENTITY: "Identity verified",
};

export function levelRank(level: VerificationLevel): number {
  return LEVEL_RANK[level];
}

export function meetsLevel(
  actual: VerificationLevel,
  required: VerificationLevel,
): boolean {
  return LEVEL_RANK[actual] >= LEVEL_RANK[required];
}

// A verified, on-file service address is required for LEVEL_2.
export function hasServiceAddress(
  profile: Pick<ParentProfile, "streetAddress" | "postalCode" | "province">,
): boolean {
  return Boolean(
    profile.streetAddress?.trim() &&
      profile.postalCode?.trim() &&
      profile.province?.trim(),
  );
}

// Derives the level purely from the underlying verification facts, so the
// stored `verificationLevel` can never drift from reality.
export function deriveLevel(
  user: Pick<User, "emailVerified" | "phoneVerified">,
  profile:
    | Pick<
        ParentProfile,
        "identityVerified" | "streetAddress" | "postalCode" | "province"
      >
    | null,
): VerificationLevel {
  const contactVerified = Boolean(user.emailVerified) && user.phoneVerified;
  if (!contactVerified) return "LEVEL_0_REGISTERED";
  const identityDone =
    Boolean(profile?.identityVerified) &&
    !!profile &&
    hasServiceAddress(profile);
  return identityDone ? "LEVEL_2_IDENTITY" : "LEVEL_1_CONTACT";
}

// Recomputes and persists a user's verificationLevel after any verification
// event. Returns the new level.
export async function recomputeVerificationLevel(
  userId: string,
): Promise<VerificationLevel> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { parentProfile: true },
  });
  const level = deriveLevel(user, user.parentProfile);
  if (level !== user.verificationLevel) {
    await prisma.user.update({
      where: { id: userId },
      data: { verificationLevel: level },
    });
  }
  return level;
}

// Convenience for parent-facing pages: current level, the required level, and
// whether the parent can book right now.
export async function getParentBookingEligibility(userId: string): Promise<{
  level: VerificationLevel;
  required: VerificationLevel;
  canBook: boolean;
}> {
  const [user, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { verificationLevel: true },
    }),
    getBusinessSettings(),
  ]);
  const required = settings.minParentVerificationLevelToBook;
  return {
    level: user.verificationLevel,
    required,
    canBook: meetsLevel(user.verificationLevel, required),
  };
}

// --- One-time code helpers ---

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueCode(
  userId: string,
  channel: "EMAIL" | "PHONE",
): Promise<string> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  // Invalidate any prior unconsumed codes for this channel.
  await prisma.verificationCode.updateMany({
    where: { userId, channel, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.verificationCode.create({
    data: {
      userId,
      channel,
      codeHash,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    },
  });
  return code;
}

// Verifies a submitted code against the latest unconsumed, unexpired code.
export async function consumeCode(
  userId: string,
  channel: "EMAIL" | "PHONE",
  submitted: string,
): Promise<boolean> {
  const record = await prisma.verificationCode.findFirst({
    where: {
      userId,
      channel,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return false;
  const ok = await bcrypt.compare(submitted.trim(), record.codeHash);
  if (!ok) return false;
  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return true;
}
