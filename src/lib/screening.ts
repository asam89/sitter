// Sitter background checks — police vulnerable sector checks above all.
//
// A vulnerable sector check names a person, their date of birth and the police
// service that screened them; it is the most damaging document Ri'aya holds, so
// it is:
//   1. encrypted at rest with AES-256-GCM before it touches the disk, so the
//      raw file is unreadable to anyone with the volume or a DB dump,
//   2. never served from the web root and never linked publicly — the only way
//      out is an Admin-only route that logs the access,
//   3. reduced to a badge for parents ("vulnerable sector check verified"),
//      never the document or the details on it.
//
// The key comes from SCREENING_ENCRYPTION_KEY (32 bytes, hex or base64),
// falling back to MEDICAL_ENCRYPTION_KEY and then to a key derived from
// NEXTAUTH_SECRET so development works without setup. Rotating the key makes
// existing documents unreadable, which is why production must set one
// explicitly.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import type { ScreeningCheckType, SitterScreening } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPrivateStorage } from "@/lib/storage";

const ALGO = "aes-256-gcm";

export const MAX_SCREENING_BYTES = 12 * 1024 * 1024; // 12 MB
export const SCREENING_MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CHECK_TYPE_LABEL: Record<ScreeningCheckType, string> = {
  VULNERABLE_SECTOR: "Police vulnerable sector check",
  POLICE_RECORD: "Police criminal record check",
  CPR: "CPR certification",
  FIRST_AID: "First aid certification",
  REFERENCE: "Reference check",
  OTHER: "Other document",
};

function encryptionKey(): Buffer {
  const configured =
    process.env.SCREENING_ENCRYPTION_KEY || process.env.MEDICAL_ENCRYPTION_KEY;
  if (configured) {
    const buf = /^[0-9a-fA-F]{64}$/.test(configured)
      ? Buffer.from(configured, "hex")
      : Buffer.from(configured, "base64");
    if (buf.length !== 32) {
      throw new Error(
        "SCREENING_ENCRYPTION_KEY must be 32 bytes (hex or base64)",
      );
    }
    return buf;
  }
  const fallback = process.env.NEXTAUTH_SECRET;
  if (!fallback) {
    throw new Error(
      "Set SCREENING_ENCRYPTION_KEY before storing police checks.",
    );
  }
  return createHash("sha256").update(`riaya:screening:${fallback}`).digest();
}

// Layout: [12-byte iv][16-byte auth tag][ciphertext]. Self-describing, so a
// stored blob can be decrypted with nothing but the key.
function encryptBytes(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decryptBytes(blob: Buffer): Buffer {
  if (blob.length < 28) throw new Error("Malformed encrypted document");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
}

// Stores the document encrypted and returns the opaque private-storage path.
// The `.enc` extension is deliberate: nothing downstream should ever guess a
// content type from the stored file, only from `originalMime` in the DB.
export async function putScreeningDocument(plain: Buffer): Promise<string> {
  return getPrivateStorage().put(encryptBytes(plain), "enc");
}

export async function readScreeningDocument(
  storagePath: string,
): Promise<Buffer> {
  return decryptBytes(await getPrivateStorage().get(storagePath));
}

export async function destroyScreeningDocument(
  storagePath: string,
): Promise<void> {
  await getPrivateStorage().delete(storagePath);
}

const DAY_MS = 86_400_000;

// How long before renewBy an Admin should be nagged about a check.
export const EXPIRY_WARNING_DAYS = 60;

export type ScreeningState = {
  expired: boolean;
  expiringSoon: boolean;
  daysToRenew: number | null;
  // A check Ri'aya can currently stand behind: verified and not past renewBy.
  current: boolean;
};

export function screeningState(
  s: Pick<SitterScreening, "status" | "renewBy">,
  now: Date = new Date(),
): ScreeningState {
  const daysToRenew = s.renewBy
    ? Math.ceil((s.renewBy.getTime() - now.getTime()) / DAY_MS)
    : null;
  const expired = daysToRenew !== null && daysToRenew < 0;
  return {
    expired,
    expiringSoon:
      !expired && daysToRenew !== null && daysToRenew <= EXPIRY_WARNING_DAYS,
    daysToRenew,
    current: s.status === "VERIFIED" && !expired,
  };
}

// The one screening fact parents are shown. Returns the set of sitter user ids
// with a current vulnerable sector check, so a listing page can badge them in
// a single query instead of per-sitter round trips.
export async function sittersWithCurrentVsc(
  sitterUserIds: string[],
): Promise<Set<string>> {
  if (sitterUserIds.length === 0) return new Set();
  const rows = await prisma.sitterScreening.findMany({
    where: {
      sitterUserId: { in: sitterUserIds },
      checkType: "VULNERABLE_SECTOR",
      status: "VERIFIED",
      OR: [{ renewBy: null }, { renewBy: { gt: new Date() } }],
    },
    select: { sitterUserId: true },
  });
  return new Set(rows.map((r) => r.sitterUserId));
}
