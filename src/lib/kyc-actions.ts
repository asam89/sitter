"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getEmailProvider, getSmsProvider } from "@/lib/notifications";
import { getPrivateStorage } from "@/lib/storage";
import { issueCode, consumeCode, recomputeVerificationLevel } from "@/lib/verification";
import {
  phoneSchema,
  serviceAddressSchema,
  verifyCodeSchema,
} from "@/lib/validation";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export type ActionResult = { ok: boolean; error?: string; devCode?: string };

const MAX_ID_BYTES = 8 * 1024 * 1024; // 8 MB
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const ALLOWED_ID_TYPES = Object.keys(EXT_BY_TYPE);

// ---------- Contact verification (email + phone) ----------

export async function sendEmailCode(): Promise<ActionResult> {
  const sessionUser = await requireRole("PARENT");
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { email: true, emailVerified: true },
  });
  if (user.emailVerified) return { ok: true };
  const code = await issueCode(sessionUser.id, "EMAIL");
  const provider = getEmailProvider();
  await provider.sendVerificationCode(user.email, code);
  // In stub mode we reveal the code so dev/test can complete the flow. A real
  // provider (provider.stub === false) never returns the code to the client.
  return { ok: true, devCode: provider.stub ? code : undefined };
}

export async function verifyEmail(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("PARENT");
  const parsed = verifyCodeSchema.safeParse({ code: s(fd, "code") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const ok = await consumeCode(user.id, "EMAIL", parsed.data.code);
  if (!ok) return { ok: false, error: "That code is invalid or expired." };
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });
  await recomputeVerificationLevel(user.id);
  revalidatePath("/parent/verify");
  return { ok: true };
}

export async function sendPhoneCode(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("PARENT");
  const parsed = phoneSchema.safeParse({ phone: s(fd, "phone") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  // Persist the phone being verified; verifying resets any prior confirmation.
  await prisma.user.update({
    where: { id: user.id },
    data: { phone: parsed.data.phone, phoneVerified: false },
  });
  await recomputeVerificationLevel(user.id);
  const code = await issueCode(user.id, "PHONE");
  const provider = getSmsProvider();
  await provider.sendVerificationCode(parsed.data.phone, code);
  return { ok: true, devCode: provider.stub ? code : undefined };
}

export async function verifyPhone(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("PARENT");
  const parsed = verifyCodeSchema.safeParse({ code: s(fd, "code") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const ok = await consumeCode(user.id, "PHONE", parsed.data.code);
  if (!ok) return { ok: false, error: "That code is invalid or expired." };
  await prisma.user.update({
    where: { id: user.id },
    data: { phoneVerified: true },
  });
  await recomputeVerificationLevel(user.id);
  revalidatePath("/parent/verify");
  return { ok: true };
}

// ---------- Service address ----------

export async function saveServiceAddress(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("PARENT");
  const parsed = serviceAddressSchema.safeParse({
    streetAddress: s(fd, "streetAddress"),
    unit: s(fd, "unit"),
    city: s(fd, "city"),
    province: s(fd, "province"),
    postalCode: s(fd, "postalCode"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const d = parsed.data;
  await prisma.parentProfile.update({
    where: { userId: user.id },
    data: {
      streetAddress: d.streetAddress,
      unit: d.unit || null,
      city: d.city,
      province: d.province,
      postalCode: d.postalCode,
    },
  });
  await recomputeVerificationLevel(user.id);
  revalidatePath("/parent/verify");
  return { ok: true };
}

// ---------- ID document (manual-review MVP path) ----------

export async function uploadIdDocument(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("PARENT");
  const file = fd.get("document");
  // FormData files arrive as Blob (with name/type); avoid the `File` global,
  // which is not present in all Node server runtimes.
  if (!(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "Choose a photo of your ID to upload." };
  }
  if (file.size > MAX_ID_BYTES) {
    return { ok: false, error: "File is too large (max 8 MB)." };
  }
  if (!ALLOWED_ID_TYPES.includes(file.type)) {
    return { ok: false, error: "Upload a JPEG, PNG, WebP, or PDF." };
  }

  const profile = await prisma.parentProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = EXT_BY_TYPE[file.type] ?? "bin";
  const storage = getPrivateStorage();
  const storagePath = await storage.put(bytes, ext);

  // Supersede any prior pending doc for this parent.
  await prisma.idVerificationDocument.updateMany({
    where: { parentProfileId: profile.id, reviewStatus: "PENDING" },
    data: { reviewStatus: "REJECTED", reviewedAt: new Date() },
  });
  await prisma.idVerificationDocument.create({
    data: { parentProfileId: profile.id, storagePath },
  });
  revalidatePath("/parent/verify");
  revalidatePath("/admin/parents");
  return { ok: true };
}

// ---------- Admin: ID review queue ----------

export async function approveIdDocument(
  documentId: string,
  verifiedName: string,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  const doc = await prisma.idVerificationDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { parentProfile: true },
  });

  await prisma.$transaction([
    prisma.parentProfile.update({
      where: { id: doc.parentProfileId },
      data: {
        identityVerified: true,
        verifiedName: verifiedName.trim() || null,
        idVerificationProvider: "manual",
        idVerifiedAt: new Date(),
      },
    }),
    prisma.idVerificationDocument.update({
      where: { id: documentId },
      data: {
        reviewStatus: "APPROVED",
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
      },
    }),
  ]);

  // Retention: delete the raw document once verification passes. Never keep
  // the sensitive image longer than needed to confirm identity.
  if (doc.storagePath) {
    await getPrivateStorage().delete(doc.storagePath);
    await prisma.idVerificationDocument.update({
      where: { id: documentId },
      data: { storagePath: null, deletedAt: new Date() },
    });
  }

  await recomputeVerificationLevel(doc.parentProfile.userId);
  revalidatePath("/admin/parents");
}

export async function rejectIdDocument(documentId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const doc = await prisma.idVerificationDocument.findUniqueOrThrow({
    where: { id: documentId },
  });
  await prisma.idVerificationDocument.update({
    where: { id: documentId },
    data: {
      reviewStatus: "REJECTED",
      reviewedByAdminId: admin.id,
      reviewedAt: new Date(),
    },
  });
  // Delete the raw document on rejection too — no reason to retain it.
  if (doc.storagePath) {
    await getPrivateStorage().delete(doc.storagePath);
    await prisma.idVerificationDocument.update({
      where: { id: documentId },
      data: { storagePath: null, deletedAt: new Date() },
    });
  }
  revalidatePath("/admin/parents");
}
