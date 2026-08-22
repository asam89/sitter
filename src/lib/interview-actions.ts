"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { interviewRequestSchema } from "@/lib/validation";
import { getEmailProvider } from "@/lib/notifications";

// Optional intro call between a parent and the sitter they have booked, usually
// the day before. It never gates the booking: the session goes ahead whatever
// the interview status is.

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

async function emailQuietly(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    await getEmailProvider().sendMessage(to, { subject, body });
  } catch (e) {
    console.error(`[interview] email to ${to} failed: ${String(e).slice(0, 200)}`);
  }
}

export async function requestInterview(fd: FormData) {
  const user = await requireUser();
  const parsed = interviewRequestSchema.safeParse({
    bookingId: fd.get("bookingId"),
    proposedAt: fd.get("proposedAt"),
    method: fd.get("method"),
    note: fd.get("note"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { bookingId, proposedAt, method, note } = parsed.data;

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      parent: { select: { name: true } },
      sitter: { select: { name: true, email: true } },
    },
  });
  if (booking.parentId !== user.id) throw new Error("Not your booking");
  if (["CANCELLED", "DECLINED", "COMPLETED"].includes(booking.status)) {
    throw new Error("This booking is closed.");
  }
  const when = new Date(proposedAt);
  if (Number.isNaN(when.getTime())) throw new Error("Invalid time");

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      interviewStatus: "REQUESTED",
      interviewRequestedAt: new Date(),
      interviewScheduledAt: when,
      interviewMethod: method,
      interviewNote: note?.trim() || null,
    },
  });

  await emailQuietly(
    booking.sitter.email,
    `${booking.parent.name} would like a quick intro call`,
    `Hi ${booking.sitter.name},\n\n` +
      `${booking.parent.name} has asked for a short intro before your booking. ` +
      `They suggested ${when.toLocaleString("en-CA")} (${method}).\n\n` +
      `${note ? `They added: ${note}\n\n` : ""}` +
      `Accept or decline: ${appUrl(`/bookings/${bookingId}`)}\n\n` +
      `This is optional — the booking stands either way.\n\n` +
      `— Ri'aya Babysitters`,
  );
  revalidatePath(`/bookings/${bookingId}`);
}

export async function respondToInterview(
  bookingId: string,
  accept: boolean,
) {
  const user = await requireUser();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      parent: { select: { name: true, email: true } },
      sitter: { select: { name: true } },
    },
  });
  if (booking.sitterId !== user.id) throw new Error("Not your booking");
  if (booking.interviewStatus !== "REQUESTED") {
    throw new Error("There is no interview request to answer.");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { interviewStatus: accept ? "SCHEDULED" : "DECLINED" },
  });

  await emailQuietly(
    booking.parent.email,
    accept
      ? `${booking.sitter.name} accepted your intro call`
      : `${booking.sitter.name} can't make that intro call`,
    `Hi ${booking.parent.name},\n\n` +
      (accept
        ? `${booking.sitter.name} has accepted your intro ` +
          `${(booking.interviewMethod ?? "call").toLowerCase()} for ` +
          `${booking.interviewScheduledAt?.toLocaleString("en-CA")}.`
        : `${booking.sitter.name} can't make that time. Your booking is ` +
          `unaffected, and you can suggest another time.`) +
      `\n\n${appUrl(`/bookings/${bookingId}`)}\n\n— Ri'aya Babysitters`,
  );
  revalidatePath(`/bookings/${bookingId}`);
}

export async function completeInterview(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (booking.parentId !== user.id && booking.sitterId !== user.id) {
    throw new Error("Not your booking");
  }
  await prisma.booking.update({
    where: { id: bookingId },
    data: { interviewStatus: "COMPLETED" },
  });
  revalidatePath(`/bookings/${bookingId}`);
}
