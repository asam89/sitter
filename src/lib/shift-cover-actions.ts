"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  SITTER_SHIFTS_PATH,
  coverPoolSitters,
  CoverError,
  fillShiftCover,
  isCoverable,
  notifyPoolOfShift,
  shiftWindow,
} from "@/lib/shift-covers";

// Shift-cover pool: an Admin offers a booking whose sitter can't make it to
// every other vetted sitter. The first to take it becomes the booking's sitter;
// pricing, waiver and payment stay on the same booking.

export type ShiftCoverState = {
  error?: string;
  offered?: number;
  texted?: number;
  emailed?: number;
};

const offerSchema = z.object({
  bookingId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
  notifySms: z.boolean(),
  notifyEmail: z.boolean(),
});

export async function offerShiftCover(
  _prev: ShiftCoverState,
  fd: FormData,
): Promise<ShiftCoverState> {
  const admin = await requireRole("ADMIN");
  const parsed = offerSchema.safeParse({
    bookingId: fd.get("bookingId"),
    note: fd.get("note") || undefined,
    notifySms: fd.get("notifySms") === "on",
    notifyEmail: fd.get("notifyEmail") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid offer" };
  }
  const { bookingId, note, notifySms, notifyEmail } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      parent: { select: { parentProfile: { select: { city: true } } } },
      shiftCovers: { where: { status: "OPEN" }, select: { id: true } },
    },
  });
  if (!booking) return { error: "Booking not found." };
  if (!isCoverable(booking.status) || booking.dateTime <= new Date()) {
    return {
      error: "Only upcoming bookings that haven't started can be offered.",
    };
  }
  if (booking.shiftCovers.length > 0) {
    return { error: "This shift is already in the pool." };
  }

  const recipients = await coverPoolSitters(
    booking.sitterId,
    shiftWindow(booking),
  );
  if (recipients.length === 0) {
    return { error: "No other vetted sitter is free during this shift." };
  }

  const cover = await prisma.shiftCover.create({
    data: {
      bookingId,
      fromSitterId: booking.sitterId,
      postedById: admin.id,
      note: note ?? null,
    },
  });

  const { texted, emailed } = await notifyPoolOfShift(
    {
      bookingNumber: booking.bookingNumber,
      dateTime: booking.dateTime,
      durationHours: booking.durationHours,
      numberOfChildren: booking.numberOfChildren,
      childrenAgeRange: booking.childrenAgeRange,
      totalAmount: booking.totalAmount,
      platformFeeAmount: booking.platformFeeAmount,
      city: booking.parent.parentProfile?.city ?? null,
    },
    note ?? null,
    recipients,
    { sms: notifySms, email: notifyEmail },
  );
  await prisma.shiftCover.update({
    where: { id: cover.id },
    data: { smsSentCount: texted, emailSentCount: emailed },
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(SITTER_SHIFTS_PATH);
  return { offered: recipients.length, texted, emailed };
}

export async function withdrawShiftCover(coverId: string): Promise<void> {
  await requireRole("ADMIN");
  const cover = await prisma.shiftCover.findUniqueOrThrow({
    where: { id: coverId },
  });
  await prisma.shiftCover.updateMany({
    where: { id: coverId, status: "OPEN" },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
  });
  revalidatePath(`/bookings/${cover.bookingId}`);
  revalidatePath(SITTER_SHIFTS_PATH);
}

export async function takeShiftCover(coverId: string): Promise<void> {
  const user = await requireRole("SITTER");
  let bookingId: string;
  try {
    bookingId = await fillShiftCover(coverId, user.id);
  } catch (e) {
    if (!(e instanceof CoverError)) throw e;
    revalidatePath(SITTER_SHIFTS_PATH);
    redirect(`${SITTER_SHIFTS_PATH}?error=${e.code}`);
  }
  revalidatePath(SITTER_SHIFTS_PATH);
  revalidatePath("/sitter");
  revalidatePath(`/bookings/${bookingId}`);
  redirect(`/bookings/${bookingId}`);
}
