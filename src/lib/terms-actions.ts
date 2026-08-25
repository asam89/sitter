"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { termsPublishSchema } from "@/lib/validation";

// Publishing the waiver/terms text from the dashboard.
//
// Editing never mutates an existing version: a booking stores the version it
// was accepted under, so rewriting that row would silently change what a parent
// agreed to. Every save therefore inserts a new TermsVersion and deactivates
// the previous ones, leaving the old text (and every acceptance pointing at it)
// intact and readable.

export type TermsFormState = { error?: string; ok?: string };

export async function publishTerms(
  _prev: TermsFormState,
  fd: FormData,
): Promise<TermsFormState> {
  await requireRole("ADMIN");
  const parsed = termsPublishSchema.safeParse({
    version: fd.get("version"),
    body: fd.get("body"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the text and try again.",
    };
  }
  const { version, body } = parsed.data;

  const clash = await prisma.termsVersion.findUnique({ where: { version } });
  if (clash) {
    return {
      error:
        `Version "${version}" already exists. Use a new label (e.g. ` +
        `${version}.1) — published versions can't be rewritten because ` +
        `bookings reference them.`,
    };
  }

  await prisma.$transaction([
    prisma.termsVersion.updateMany({
      where: { active: true },
      data: { active: false },
    }),
    prisma.termsVersion.create({ data: { version, body, active: true } }),
  ]);

  revalidatePath("/admin/terms");
  revalidatePath("/policies");
  return {
    ok: `Published ${version}. New bookings will accept this version; earlier acceptances keep their own.`,
  };
}
