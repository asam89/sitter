"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getPublicStorage } from "@/lib/public-storage";

export type ActionResult = { ok: boolean; error?: string };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const PHOTO_EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ALLOWED_PHOTO_TYPES = Object.keys(PHOTO_EXT_BY_TYPE);
const MAX_BIO_LEN = 1000;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

// Sitter edits their own public-facing bio and opt-in to appear on the team page.
export async function updateSitterPublicProfile(
  fd: FormData,
): Promise<ActionResult> {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) {
    return { ok: false, error: "You need to be vetted before setting up a public profile." };
  }

  const bioRaw = s(fd, "bio").trim();
  if (bioRaw.length > MAX_BIO_LEN) {
    return { ok: false, error: `Bio is too long (max ${MAX_BIO_LEN} characters).` };
  }
  const publicOptIn = fd.get("publicOptIn") === "on" || fd.get("publicOptIn") === "true";

  await prisma.sitterProfile.update({
    where: { id: profile.id },
    data: { bio: bioRaw || null, publicOptIn },
  });
  revalidatePath("/sitter");
  revalidatePath("/team");
  return { ok: true };
}

// Sitter uploads or replaces their public profile photo.
export async function uploadSitterPhoto(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, photoPath: true },
  });
  if (!profile) {
    return { ok: false, error: "You need to be vetted before adding a photo." };
  }

  const file = fd.get("photo");
  if (!(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "Choose a photo to upload." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Photo is too large (max 5 MB)." };
  }
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, error: "Upload a JPEG, PNG, or WebP image." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = PHOTO_EXT_BY_TYPE[file.type] ?? "bin";
  const storage = getPublicStorage();
  const newPath = await storage.put(bytes, ext);

  await prisma.sitterProfile.update({
    where: { id: profile.id },
    data: { photoPath: newPath },
  });
  // Best-effort cleanup of the superseded file.
  if (profile.photoPath) {
    await storage.delete(profile.photoPath);
  }

  revalidatePath("/sitter");
  revalidatePath("/team");
  return { ok: true };
}

// Sitter removes their public profile photo.
export async function removeSitterPhoto(): Promise<ActionResult> {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, photoPath: true },
  });
  if (!profile) return { ok: false, error: "No profile found." };

  if (profile.photoPath) {
    await getPublicStorage().delete(profile.photoPath);
    await prisma.sitterProfile.update({
      where: { id: profile.id },
      data: { photoPath: null },
    });
  }
  revalidatePath("/sitter");
  revalidatePath("/team");
  return { ok: true };
}

// Admin approves/removes a sitter from the public "Meet our team" showcase.
export async function setSitterShowcased(
  sitterProfileId: string,
  showcased: boolean,
): Promise<void> {
  await requireRole("ADMIN");
  await prisma.sitterProfile.update({
    where: { id: sitterProfileId },
    data: { showcased },
  });
  revalidatePath("/admin");
  revalidatePath("/team");
}
