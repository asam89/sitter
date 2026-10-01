// Read side and notification fan-out for the shift-cover pool (see
// shift-cover-actions.ts): a booked shift the assigned sitter can't make,
// offered to every other vetted sitter until one takes it.
import { prisma } from "@/lib/prisma";
import { getEmailProvider, getSmsProvider } from "@/lib/notifications";
import { smsBodyWithOptOut } from "@/lib/sms-campaign";
import { sitterPayout } from "@/lib/pricing";
import { bookingRef, dt, money } from "@/lib/format";
import { remainders } from "@/lib/slot-window";
import { notifyAdminsOfShiftCovered } from "@/lib/admin-notifications";

export const SITTER_SHIFTS_PATH = "/sitter/shifts";

// Bookings that can still change hands: not started, not finished.
export const COVERABLE_STATUSES = ["REQUESTED", "APPROVED"] as const;

export function isCoverable(status: string): boolean {
  return (COVERABLE_STATUSES as readonly string[]).includes(status);
}

export function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

// Vetted = has a sitter profile. Listing is a separate public-facing decision
// and doesn't matter for covering a shift the agency is placing.
export async function coverPoolSitters(excludeUserId: string) {
  return prisma.user.findMany({
    where: {
      role: "SITTER",
      suspended: false,
      sitterProfile: { isNot: null },
      id: { not: excludeUserId },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      smsOptOutAt: true,
    },
  });
}

const openCoverWhere = (userId: string) => ({
  status: "OPEN" as const,
  fromSitterId: { not: userId },
  booking: {
    status: { in: [...COVERABLE_STATUSES] },
    dateTime: { gt: new Date() },
  },
});

export async function openShiftCoversFor(userId: string) {
  return prisma.shiftCover.findMany({
    where: openCoverWhere(userId),
    orderBy: { booking: { dateTime: "asc" } },
    include: {
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          dateTime: true,
          durationHours: true,
          numberOfChildren: true,
          childrenAgeRange: true,
          totalAmount: true,
          platformFeeAmount: true,
          parent: {
            select: { parentProfile: { select: { city: true } } },
          },
        },
      },
    },
  });
}

export async function openShiftCoverCount(userId: string): Promise<number> {
  return prisma.shiftCover.count({ where: openCoverWhere(userId) });
}

export type CoverShift = {
  bookingNumber: number;
  dateTime: Date;
  durationHours: number;
  numberOfChildren: number;
  childrenAgeRange: string;
  totalAmount: number;
  platformFeeAmount: number;
  city: string | null;
};

function describeShift(s: CoverShift): string {
  return (
    `${dt(s.dateTime)} for ${s.durationHours} hour${s.durationHours === 1 ? "" : "s"}` +
    (s.city ? ` in ${s.city}` : "")
  );
}

// Text and email every vetted sitter. Only the city goes out: the street
// address is released to whoever takes the shift. Never throws.
export async function notifyPoolOfShift(
  shift: CoverShift,
  note: string | null,
  recipients: Awaited<ReturnType<typeof coverPoolSitters>>,
  channels: { sms: boolean; email: boolean },
): Promise<{ texted: number; emailed: number }> {
  const link = appUrl(SITTER_SHIFTS_PATH);
  const when = describeShift(shift);
  const earn = money(sitterPayout(shift));
  let texted = 0;
  let emailed = 0;

  if (channels.sms) {
    const sms = getSmsProvider();
    const text = smsBodyWithOptOut(
      `Ri'aya: a shift needs a sitter. ${when}, you'd earn ${earn}. ` +
        `First to take it gets it: ${link}`,
    );
    for (const r of recipients) {
      if (!r.phone || r.smsOptOutAt) continue;
      try {
        await sms.sendMessage(r.phone, { subject: "Ri'aya", body: text });
        texted++;
      } catch (e) {
        console.error(
          `[shift-cover] sms to ${r.id} failed: ${String(e).slice(0, 200)}`,
        );
      }
    }
  }

  if (channels.email) {
    const mail = getEmailProvider();
    for (const r of recipients) {
      try {
        await mail.sendMessage(r.email, {
          subject: `Can you take a shift? ${dt(shift.dateTime)}`,
          body:
            `${r.name ? `Hi ${r.name.split(" ")[0]},` : "Hi,"}\n\n` +
            `The sitter booked for this shift can't make it, and we're looking for someone to cover it.\n\n` +
            `When: ${when}\n` +
            `Children: ${shift.numberOfChildren}, aged ${shift.childrenAgeRange}\n` +
            `You'd earn: ${earn}\n` +
            (note ? `Note from the team: ${note}\n` : "") +
            `\nThe first sitter to take it gets the booking:\n${link}\n\n` +
            `Thank you,\nThe Ri'aya team\nwww.riaya.ca`,
        });
        emailed++;
      } catch (e) {
        console.error(
          `[shift-cover] email to ${r.id} failed: ${String(e).slice(0, 200)}`,
        );
      }
    }
  }

  return { texted, emailed };
}

async function sendQuietly(to: string, subject: string, body: string) {
  try {
    await getEmailProvider().sendMessage(to, { subject, body });
  } catch (e) {
    console.error(
      `[shift-cover] email to ${to} failed: ${String(e).slice(0, 200)}`,
    );
  }
}

// Tell the parent, the new sitter and the sitter who dropped the shift who is
// now booked. Never throws.
export async function notifyShiftCovered(c: {
  bookingId: string;
  bookingNumber: number;
  dateTime: Date;
  durationHours: number;
  needsPayment: boolean;
  parent: { name: string | null; email: string };
  newSitter: { name: string | null; email: string };
  oldSitter: { name: string | null; email: string };
}): Promise<void> {
  const link = appUrl(`/bookings/${c.bookingId}`);
  const ref = bookingRef(c.bookingNumber);
  const when = `${dt(c.dateTime)} (${c.durationHours}h)`;
  const first = (n: string | null) => (n ? n.split(" ")[0] : "there");
  const newName = c.newSitter.name ?? "a Ri'aya sitter";

  await sendQuietly(
    c.parent.email,
    `Your sitter for ${dt(c.dateTime)} has changed`,
    `Hi ${first(c.parent.name)},\n\n` +
      `${c.oldSitter.name ?? "Your sitter"} can no longer make your booking on ${when}, ` +
      `so ${newName} will be taking care of your children instead. ` +
      `${newName} has been vetted by our team like every Ri'aya sitter.\n\n` +
      (c.needsPayment
        ? `You can accept the waiver and pay on your booking page:\n${link}\n\n`
        : `Your payment and booking details stay the same:\n${link}\n\n`) +
      `If you'd like to talk to the team about this, reply to this email.\n\n` +
      `Thank you,\nThe Ri'aya team\nwww.riaya.ca`,
  );
  await sendQuietly(
    c.newSitter.email,
    `You're booked: ${ref} on ${dt(c.dateTime)}`,
    `Hi ${first(c.newSitter.name)},\n\n` +
      `Thank you for taking this shift. You're now the sitter for ${ref} on ${when}. ` +
      `The family's address and contact details are on the booking page:\n${link}\n\n` +
      `Thank you,\nThe Ri'aya team\nwww.riaya.ca`,
  );
  await sendQuietly(
    c.oldSitter.email,
    `Your shift on ${dt(c.dateTime)} is covered`,
    `Hi ${first(c.oldSitter.name)},\n\n` +
      `${newName} is taking your shift (${ref}) on ${when}, so you don't need to go. ` +
      `Thank you for letting us know.\n\n` +
      `The Ri'aya team\nwww.riaya.ca`,
  );
}

export const COVER_ERRORS = {
  unvetted: "Only vetted sitters can take shifts.",
  taken: "Another sitter already took this shift.",
  own: "This is your own shift.",
  gone: "This shift can no longer be covered.",
  clash: "You already have a booking during this shift.",
} as const;
export type CoverErrorCode = keyof typeof COVER_ERRORS;

export class CoverError extends Error {
  constructor(readonly code: CoverErrorCode) {
    super(COVER_ERRORS[code]);
  }
}

// The first sitter to call this wins the shift and becomes the booking's
// sitter. Returns the booking id.
export async function fillShiftCover(
  coverId: string,
  userId: string,
): Promise<string> {
  const profile = await prisma.sitterProfile.findUnique({
    where: { userId },
    include: { user: { select: { suspended: true } } },
  });
  if (!profile || profile.user.suspended) {
    throw new CoverError("unvetted");
  }

  const cover = await prisma.shiftCover.findUniqueOrThrow({
    where: { id: coverId },
    include: { booking: true },
  });
  const booking = cover.booking;
  if (cover.status !== "OPEN") {
    throw new CoverError("taken");
  }
  if (cover.fromSitterId === userId || booking.sitterId === userId) {
    throw new CoverError("own");
  }
  if (!isCoverable(booking.status) || booking.dateTime <= new Date()) {
    throw new CoverError("gone");
  }

  const start = booking.dateTime;
  const end = new Date(start.getTime() + booking.durationHours * 3600 * 1000);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // First claim wins: the status flip is the lock.
    const taken = await tx.shiftCover.updateMany({
      where: { id: coverId, status: "OPEN" },
      data: { status: "FILLED", filledById: userId, filledAt: now },
    });
    if (taken.count === 0) {
      throw new CoverError("taken");
    }

    const overlapping = await tx.availabilitySlot.findMany({
      where: {
        sitterProfileId: profile.id,
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });
    if (overlapping.some((s) => s.status !== "OPEN")) {
      throw new CoverError("clash");
    }
    // Their own open hours during the shift are spent on it now.
    for (const slot of overlapping) {
      const [first, ...rest] = remainders(slot, {
        start,
        end,
        hours: booking.durationHours,
      });
      if (first) {
        await tx.availabilitySlot.update({
          where: { id: slot.id },
          data: first,
        });
      } else {
        // An open block entirely inside the shift. A block reopened by a
        // cancellation still carries that booking, so it can't be deleted;
        // collapse it to zero length instead.
        const referenced = await tx.booking.count({
          where: { availabilitySlotId: slot.id },
        });
        if (referenced > 0) {
          await tx.availabilitySlot.update({
            where: { id: slot.id },
            data: { endTime: slot.startTime },
          });
        } else {
          await tx.availabilitySlot.delete({ where: { id: slot.id } });
        }
      }
      if (rest.length > 0) {
        await tx.availabilitySlot.createMany({
          data: rest.map((r) => ({
            sitterProfileId: profile.id,
            startTime: r.startTime,
            endTime: r.endTime,
            status: "OPEN" as const,
          })),
        });
      }
    }

    await tx.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { sitterProfileId: profile.id },
    });
    // Taking a shift is accepting it, so a still-pending request is approved.
    const moved = await tx.booking.updateMany({
      where: {
        id: booking.id,
        sitterId: cover.fromSitterId,
        status: { in: [...COVERABLE_STATUSES] },
      },
      data:
        booking.status === "REQUESTED"
          ? {
              sitterId: userId,
              status: "APPROVED",
              approvedAt: now,
              addressReleasedAt: now,
            }
          : { sitterId: userId },
    });
    if (moved.count === 0) {
      throw new CoverError("gone");
    }
  });

  const [parent, newSitter, oldSitter] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: booking.parentId },
      select: { name: true, email: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: cover.fromSitterId },
      select: { name: true, email: true },
    }),
  ]);
  await notifyShiftCovered({
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    dateTime: booking.dateTime,
    durationHours: booking.durationHours,
    needsPayment: !booking.paidAt,
    parent,
    newSitter,
    oldSitter,
  });
  await notifyAdminsOfShiftCovered({
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    when: booking.dateTime,
    durationHours: booking.durationHours,
    fromSitterName: oldSitter.name ?? oldSitter.email,
    newSitterName: newSitter.name ?? newSitter.email,
  });

  return booking.id;
}
