import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { prisma } from "@/lib/prisma";

// Health information about a child is the most sensitive data on the platform,
// so it is encrypted at rest with AES-256-GCM and only ever decrypted for the
// parent who entered it and the sitter assigned to that booking.
//
// The key comes from MEDICAL_ENCRYPTION_KEY (32 bytes, hex or base64). Without
// it we derive a key from NEXTAUTH_SECRET so development works out of the box —
// rotating NEXTAUTH_SECRET then makes existing records unreadable, which is why
// production must set MEDICAL_ENCRYPTION_KEY explicitly.
function encryptionKey(): Buffer {
  const configured = process.env.MEDICAL_ENCRYPTION_KEY;
  if (configured) {
    const buf = /^[0-9a-fA-F]{64}$/.test(configured)
      ? Buffer.from(configured, "hex")
      : Buffer.from(configured, "base64");
    if (buf.length !== 32) {
      throw new Error("MEDICAL_ENCRYPTION_KEY must be 32 bytes (hex or base64)");
    }
    return buf;
  }
  const fallback = process.env.NEXTAUTH_SECRET;
  if (!fallback) {
    throw new Error(
      "Set MEDICAL_ENCRYPTION_KEY (or NEXTAUTH_SECRET) before collecting child health information.",
    );
  }
  return createHash("sha256").update(`riaya:medical:${fallback}`).digest();
}

export type ChildMedical = {
  label: string; // "Child 1" or a first name the parent chose to give
  ageYears: number | null;
  conditions: string;
  allergies: string;
  medications: string;
  specialNeeds: string;
};

const FIELD_LIMIT = 1000;

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  // iv.ciphertext.tag, all base64url so the column stays printable.
  return [iv, body, cipher.getAuthTag()]
    .map((b) => b.toString("base64url"))
    .join(".");
}

function decrypt(payload: string): string {
  const [iv, body, tag] = payload
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  if (!iv || !body || !tag) throw new Error("Malformed encrypted record");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8",
  );
}

// Pull the per-child medical rows out of a booking form. Rows are indexed
// (`medical.0.allergies`); a row with nothing filled in is dropped so parents
// with nothing to declare store nothing.
export function parseChildMedical(fd: FormData): ChildMedical[] {
  const rows: ChildMedical[] = [];
  const clean = (v: FormDataEntryValue | null) =>
    typeof v === "string" ? v.trim().slice(0, FIELD_LIMIT) : "";
  for (let i = 0; i < 10; i++) {
    const conditions = clean(fd.get(`medical.${i}.conditions`));
    const allergies = clean(fd.get(`medical.${i}.allergies`));
    const medications = clean(fd.get(`medical.${i}.medications`));
    const specialNeeds = clean(fd.get(`medical.${i}.specialNeeds`));
    const ageRaw = clean(fd.get(`medical.${i}.ageYears`));
    const label = clean(fd.get(`medical.${i}.label`)) || `Child ${i + 1}`;
    if (!conditions && !allergies && !medications && !specialNeeds) continue;
    const age = Number(ageRaw);
    rows.push({
      label,
      ageYears: Number.isFinite(age) && age > 0 && age < 19 ? age : null,
      conditions,
      allergies,
      medications,
      specialNeeds,
    });
  }
  return rows;
}

// Retention: health data is kept only as long as it is operationally useful,
// then purged. PENDING PRIVACY REVIEW — confirm the window with counsel before
// launch (PHIPA/PIPEDA retention limits).
export const MEDICAL_RETENTION_DAYS = 60;

function purgeDate(sessionStart: Date): Date {
  return new Date(
    sessionStart.getTime() + MEDICAL_RETENTION_DAYS * 24 * 3600 * 1000,
  );
}

export async function storeChildMedical(
  target: { bookingId: string } | { bookingRequestId: string },
  rows: ChildMedical[],
  sessionStart: Date,
): Promise<void> {
  if (rows.length === 0) return;
  await prisma.childMedicalRecord.createMany({
    data: rows.map((row, index) => ({
      ...target,
      childIndex: index,
      label: row.label,
      ageYears: row.ageYears,
      encrypted: encrypt(
        JSON.stringify({
          conditions: row.conditions,
          allergies: row.allergies,
          medications: row.medications,
          specialNeeds: row.specialNeeds,
        }),
      ),
      purgeAfter: purgeDate(sessionStart),
    })),
  });
}

// Carry a request's records over when a sitter claims it, so the parent never
// re-enters them.
export async function copyRequestMedicalToBooking(
  bookingRequestId: string,
  bookingId: string,
  sessionStart: Date,
): Promise<void> {
  const records = await prisma.childMedicalRecord.findMany({
    where: { bookingRequestId },
    orderBy: { childIndex: "asc" },
  });
  if (records.length === 0) return;
  await prisma.childMedicalRecord.createMany({
    data: records.map((r) => ({
      bookingId,
      childIndex: r.childIndex,
      label: r.label,
      ageYears: r.ageYears,
      encrypted: r.encrypted,
      purgeAfter: purgeDate(sessionStart),
    })),
  });
}

export type ChildMedicalView = ChildMedical & { childIndex: number };

// Read the records for a booking. Only the parent who entered them and the
// assigned sitter can read, and the sitter only once the booking is paid (i.e.
// actually going ahead). Admins are deliberately excluded.
export async function readBookingMedical(
  booking: {
    id: string;
    parentId: string;
    sitterId: string;
    paidAt: Date | null;
  },
  viewer: { id: string },
): Promise<ChildMedicalView[] | null> {
  const isParent = booking.parentId === viewer.id;
  const isAssignedSitter = booking.sitterId === viewer.id;
  if (!isParent && !isAssignedSitter) return null;
  if (isAssignedSitter && !booking.paidAt) return null;

  const records = await prisma.childMedicalRecord.findMany({
    where: { bookingId: booking.id },
    orderBy: { childIndex: "asc" },
  });
  return records.map((r) => {
    const body = JSON.parse(decrypt(r.encrypted)) as {
      conditions: string;
      allergies: string;
      medications: string;
      specialNeeds: string;
    };
    return {
      childIndex: r.childIndex,
      label: r.label,
      ageYears: r.ageYears,
      ...body,
    };
  });
}

// Delete records past their retention window. Called from a scheduled task.
export async function purgeExpiredMedical(now = new Date()): Promise<number> {
  const { count } = await prisma.childMedicalRecord.deleteMany({
    where: { purgeAfter: { lte: now } },
  });
  return count;
}
