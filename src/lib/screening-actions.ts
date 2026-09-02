"use server";

import { revalidatePath } from "next/cache";
import type { ScreeningCheckType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  CHECK_TYPE_LABEL,
  MAX_SCREENING_BYTES,
  SCREENING_MIME_EXT,
  destroyScreeningDocument,
  putScreeningDocument,
} from "@/lib/screening";
import {
  notifyAdminsOfScreeningUpload,
  notifySitterScreeningVerified,
} from "@/lib/screening-notifications";
import { screeningDetailsSchema } from "@/lib/validation";

export type ScreeningState = { ok?: string; error?: string };

const CHECK_TYPES = Object.keys(CHECK_TYPE_LABEL) as ScreeningCheckType[];

function checkType(raw: FormDataEntryValue | null): ScreeningCheckType | null {
  return typeof raw === "string" && CHECK_TYPES.includes(raw as ScreeningCheckType)
    ? (raw as ScreeningCheckType)
    : null;
}

// Reads the uploaded document out of the form. Blob rather than File: the
// `File` global isn't present in every Node server runtime.
async function readUpload(
  fd: FormData,
): Promise<
  { bytes: Buffer; mime: string; name: string } | { error: string }
> {
  const file = fd.get("document");
  if (!(file instanceof Blob) || file.size === 0) {
    return { error: "Choose the document to upload." };
  }
  if (file.size > MAX_SCREENING_BYTES) {
    return { error: "That file is too large (max 12 MB)." };
  }
  if (!SCREENING_MIME_EXT[file.type]) {
    return { error: "Upload a PDF, JPEG, PNG or WebP." };
  }
  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    mime: file.type,
    // Blob has no name in the type, but FormData files do at runtime.
    name: String((file as Blob & { name?: string }).name ?? "document").slice(0, 200),
  };
}

// ---------- Sitter: upload my own check ----------

export async function uploadMyScreening(
  _prev: ScreeningState,
  fd: FormData,
): Promise<ScreeningState> {
  const user = await requireRole("SITTER");
  const type = checkType(fd.get("checkType"));
  if (!type) return { error: "Pick which document this is." };

  const upload = await readUpload(fd);
  if ("error" in upload) return { error: upload.error };

  // The sitter states the dates; an Admin confirms them against the document
  // when they verify it, so nothing here is trusted on its own.
  const parsed = screeningDetailsSchema.safeParse({
    issuer: fd.get("issuer") ?? "",
    issuedOn: fd.get("issuedOn") ?? "",
    renewBy: fd.get("renewBy") ?? "",
    adminNotes: "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the dates." };
  }

  const storagePath = await putScreeningDocument(upload.bytes);
  await prisma.sitterScreening.create({
    data: {
      sitterUserId: user.id,
      checkType: type,
      issuer: parsed.data.issuer || null,
      issuedOn: parsed.data.issuedOn,
      renewBy: parsed.data.renewBy,
      storagePath,
      originalMime: upload.mime,
      originalName: upload.name,
      fileBytes: upload.bytes.length,
      uploadedByUserId: user.id,
    },
  });

  const me = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true },
  });
  await notifyAdminsOfScreeningUpload({
    sitterName: me.name,
    sitterEmail: me.email,
    checkLabel: CHECK_TYPE_LABEL[type],
  });

  revalidatePath("/sitter/screening");
  revalidatePath("/admin/screening");
  return {
    ok: "Uploaded. Our administrators will verify it — families never see the document.",
  };
}

// ---------- Admin: upload on a sitter's behalf ----------

export async function adminUploadScreening(
  _prev: ScreeningState,
  fd: FormData,
): Promise<ScreeningState> {
  const admin = await requireRole("ADMIN");
  const sitterUserId = String(fd.get("sitterUserId") ?? "");
  const type = checkType(fd.get("checkType"));
  if (!type) return { error: "Pick which document this is." };

  const sitter = await prisma.user.findUnique({
    where: { id: sitterUserId },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!sitter || sitter.role !== "SITTER") {
    return { error: "That isn't a sitter account." };
  }

  const parsed = screeningDetailsSchema.safeParse({
    issuer: fd.get("issuer") ?? "",
    issuedOn: fd.get("issuedOn") ?? "",
    renewBy: fd.get("renewBy") ?? "",
    adminNotes: fd.get("adminNotes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the dates." };
  }

  const upload = await readUpload(fd);
  if ("error" in upload) return { error: upload.error };
  const storagePath = await putScreeningDocument(upload.bytes);

  // An Admin uploading it has, by definition, just read the document — so it
  // lands verified with them named as the verifier.
  await prisma.sitterScreening.create({
    data: {
      sitterUserId: sitter.id,
      checkType: type,
      issuer: parsed.data.issuer || null,
      issuedOn: parsed.data.issuedOn,
      renewBy: parsed.data.renewBy,
      adminNotes: parsed.data.adminNotes || null,
      status: "VERIFIED",
      storagePath,
      originalMime: upload.mime,
      originalName: upload.name,
      fileBytes: upload.bytes.length,
      uploadedByUserId: admin.id,
      verifiedByAdminId: admin.id,
      verifiedAt: new Date(),
    },
  });
  await prisma.adminAuditLog.create({
    data: {
      actorId: admin.id,
      targetUserId: sitter.id,
      action: "screening:upload+verify",
      detail: `${CHECK_TYPE_LABEL[type]}${parsed.data.issuer ? ` · ${parsed.data.issuer}` : ""}`,
    },
  });

  revalidatePath("/admin/screening");
  return { ok: `Recorded ${CHECK_TYPE_LABEL[type].toLowerCase()} for ${sitter.name}.` };
}

// ---------- Admin: verify / reject / correct ----------

export async function reviewScreening(
  _prev: ScreeningState,
  fd: FormData,
): Promise<ScreeningState> {
  const admin = await requireRole("ADMIN");
  const id = String(fd.get("screeningId") ?? "");
  const decision = String(fd.get("decision") ?? "");
  if (decision !== "VERIFIED" && decision !== "REJECTED") {
    return { error: "Choose verify or reject." };
  }
  const parsed = screeningDetailsSchema.safeParse({
    issuer: fd.get("issuer") ?? "",
    issuedOn: fd.get("issuedOn") ?? "",
    renewBy: fd.get("renewBy") ?? "",
    adminNotes: fd.get("adminNotes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the dates." };
  }

  const row = await prisma.sitterScreening.findUnique({
    where: { id },
    include: { sitter: { select: { name: true, email: true } } },
  });
  if (!row) return { error: "That document no longer exists." };

  await prisma.sitterScreening.update({
    where: { id },
    data: {
      status: decision,
      issuer: parsed.data.issuer || null,
      issuedOn: parsed.data.issuedOn,
      renewBy: parsed.data.renewBy,
      adminNotes: parsed.data.adminNotes || null,
      verifiedByAdminId: admin.id,
      verifiedAt: new Date(),
    },
  });
  await prisma.adminAuditLog.create({
    data: {
      actorId: admin.id,
      targetUserId: row.sitterUserId,
      action: decision === "VERIFIED" ? "screening:verify" : "screening:reject",
      detail: CHECK_TYPE_LABEL[row.checkType],
    },
  });

  if (decision === "VERIFIED") {
    await notifySitterScreeningVerified(
      row.sitter.email,
      row.sitter.name,
      CHECK_TYPE_LABEL[row.checkType],
    );
  }

  revalidatePath("/admin/screening");
  revalidatePath("/sitter/screening");
  return {
    ok:
      decision === "VERIFIED"
        ? `Verified — ${row.sitter.name} counts as screened.`
        : `Marked not acceptable. ${row.sitter.name} can upload a replacement.`,
  };
}

// Destroys the encrypted document but keeps the record of what was checked and
// by whom — so a deletion request (or a decision to stop holding the file)
// doesn't erase the audit trail that the screening happened.
export async function destroyScreeningFile(
  _prev: ScreeningState,
  fd: FormData,
): Promise<ScreeningState> {
  const admin = await requireRole("ADMIN");
  const id = String(fd.get("screeningId") ?? "");
  const row = await prisma.sitterScreening.findUnique({ where: { id } });
  if (!row) return { error: "That document no longer exists." };
  if (!row.storagePath) return { ok: "That document is already destroyed." };

  await destroyScreeningDocument(row.storagePath);
  await prisma.sitterScreening.update({
    where: { id },
    data: { storagePath: null, deletedAt: new Date() },
  });
  await prisma.adminAuditLog.create({
    data: {
      actorId: admin.id,
      targetUserId: row.sitterUserId,
      action: "screening:destroy-file",
      detail: CHECK_TYPE_LABEL[row.checkType],
    },
  });

  revalidatePath("/admin/screening");
  return {
    ok: "Document destroyed. The verification record is kept.",
  };
}
