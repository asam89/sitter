"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { differenceInMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/session";
import { getBusinessSettings, updateBusinessSettings } from "@/lib/settings";
import { computePrice, isLastMinute } from "@/lib/pricing";
import { getActiveTerms } from "@/lib/terms";
import { stripeEnabled, stripe } from "@/lib/stripe";
import {
  applicationSchema,
  bookingSchema,
  linesToArray,
  reportSchema,
  settingsSchema,
  slotSchema,
  vetSchema,
} from "@/lib/validation";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function slotDurationHours(startTime: Date, endTime: Date): number {
  return Math.max(1, Math.round(differenceInMinutes(endTime, startTime) / 60));
}

// ---------- Sitter: application ----------

export async function submitApplication(fd: FormData) {
  const user = await requireRole("SITTER");
  const parsed = applicationSchema.safeParse({
    bio: s(fd, "bio"),
    experience: s(fd, "experience"),
    certifications: s(fd, "certifications"),
    documentUrls: s(fd, "documentUrls"),
    targetPayRate: s(fd, "targetPayRate"),
  });
  if (!parsed.success) throw new Error("Invalid application");
  const d = parsed.data;

  // An APPLIED/UNDER_REVIEW application can be resubmitted; once VETTED it is
  // locked (profile exists). REJECTED can re-apply.
  const existing = await prisma.sitterApplication.findUnique({
    where: { userId: user.id },
  });
  if (existing?.status === "VETTED") {
    throw new Error("You are already vetted.");
  }

  await prisma.sitterApplication.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      bio: d.bio,
      experience: d.experience,
      certifications: linesToArray(d.certifications),
      documentUrls: linesToArray(d.documentUrls),
      targetPayRate: d.targetPayRate,
      status: "APPLIED",
    },
    update: {
      bio: d.bio,
      experience: d.experience,
      certifications: linesToArray(d.certifications),
      documentUrls: linesToArray(d.documentUrls),
      targetPayRate: d.targetPayRate,
      status: "APPLIED",
      reviewedByAdminId: null,
      reviewedAt: null,
    },
  });
  revalidatePath("/sitter");
  redirect("/sitter");
}

// ---------- Sitter / Admin: availability ----------

async function createSlotFor(sitterProfileId: string, fd: FormData) {
  const parsed = slotSchema.safeParse({
    startTime: s(fd, "startTime"),
    endTime: s(fd, "endTime"),
  });
  if (!parsed.success) throw new Error("Invalid time range");
  await prisma.availabilitySlot.create({
    data: {
      sitterProfileId,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
    },
  });
}

export async function addMySlot(fd: FormData) {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  await createSlotFor(profile.id, fd);
  revalidatePath("/sitter/availability");
  revalidatePath("/sitter");
}

export async function deleteMySlot(slotId: string) {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  await prisma.availabilitySlot.deleteMany({
    where: { id: slotId, sitterProfileId: profile.id, status: "OPEN" },
  });
  revalidatePath("/sitter/availability");
}

export async function adminAddSlot(sitterProfileId: string, fd: FormData) {
  await requireRole("ADMIN");
  await createSlotFor(sitterProfileId, fd);
  revalidatePath(`/admin/sitters/${sitterProfileId}`);
}

export async function adminDeleteSlot(slotId: string) {
  await requireRole("ADMIN");
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
  });
  await prisma.availabilitySlot.deleteMany({
    where: { id: slotId, status: "OPEN" },
  });
  if (slot) revalidatePath(`/admin/sitters/${slot.sitterProfileId}`);
}

// ---------- Admin: vetting & listing ----------

export async function moveApplicationUnderReview(applicationId: string) {
  await requireRole("ADMIN");
  await prisma.sitterApplication.updateMany({
    where: { id: applicationId, status: "APPLIED" },
    data: { status: "UNDER_REVIEW" },
  });
  revalidatePath("/admin/applications");
}

export async function vetApplication(fd: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = vetSchema.safeParse({
    applicationId: s(fd, "applicationId"),
    listedPayRate: s(fd, "listedPayRate"),
    adminNotes: s(fd, "adminNotes"),
  });
  if (!parsed.success) throw new Error("Invalid vetting input");
  const { applicationId, listedPayRate, adminNotes } = parsed.data;

  const app = await prisma.sitterApplication.findUniqueOrThrow({
    where: { id: applicationId },
  });
  if (app.status === "VETTED") return;

  // targetPayRate (app) and listedPayRate (profile) are stored separately and
  // never overwritten into one another.
  await prisma.$transaction([
    prisma.sitterApplication.update({
      where: { id: applicationId },
      data: {
        status: "VETTED",
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
        adminNotes: adminNotes || null,
      },
    }),
    prisma.sitterProfile.upsert({
      where: { userId: app.userId },
      create: {
        userId: app.userId,
        bio: app.bio,
        listedPayRate,
        isListed: false, // vetted != listed; Admin lists separately
      },
      update: { listedPayRate },
    }),
  ]);
  revalidatePath("/admin/applications");
  revalidatePath("/admin");
}

export async function rejectApplication(fd: FormData) {
  const admin = await requireRole("ADMIN");
  const applicationId = s(fd, "applicationId");
  const adminNotes = s(fd, "adminNotes");
  await prisma.sitterApplication.update({
    where: { id: applicationId },
    data: {
      status: "REJECTED",
      reviewedByAdminId: admin.id,
      reviewedAt: new Date(),
      adminNotes: adminNotes || null,
    },
  });
  revalidatePath("/admin/applications");
}

export async function setListed(sitterProfileId: string, isListed: boolean) {
  await requireRole("ADMIN");
  await prisma.sitterProfile.update({
    where: { id: sitterProfileId },
    data: { isListed },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/sitters");
}

export async function updateSettings(fd: FormData) {
  await requireRole("ADMIN");
  const parsed = settingsSchema.safeParse({
    lastMinuteThresholdHours: s(fd, "lastMinuteThresholdHours"),
    rushFeeType: s(fd, "rushFeeType"),
    rushFeeAmount: s(fd, "rushFeeAmount"),
    platformFeeType: s(fd, "platformFeeType"),
    platformFeeAmount: s(fd, "platformFeeAmount"),
  });
  if (!parsed.success) throw new Error("Invalid settings");
  await updateBusinessSettings(parsed.data);
  revalidatePath("/admin/settings");
}

export async function setUserSuspended(userId: string, suspended: boolean) {
  await requireRole("ADMIN");
  await prisma.user.update({ where: { id: userId }, data: { suspended } });
  revalidatePath("/admin");
}

export async function updateReportStatus(
  reportId: string,
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED",
) {
  await requireRole("ADMIN");
  await prisma.report.update({ where: { id: reportId }, data: { status } });
  revalidatePath("/admin");
}

// ---------- Parent: booking ----------

export type BookingFormState = { error?: string };

export async function createBooking(
  _prevState: BookingFormState,
  fd: FormData,
): Promise<BookingFormState> {
  const user = await requireRole("PARENT");
  const parsed = bookingSchema.safeParse({
    slotId: s(fd, "slotId"),
    childrenAgeRange: s(fd, "childrenAgeRange"),
    numberOfChildren: s(fd, "numberOfChildren"),
    notes: s(fd, "notes"),
    waiverAccepted: s(fd, "waiverAccepted"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid booking input",
    };
  }
  const d = parsed.data;

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: d.slotId },
    include: { sitterProfile: true },
  });
  if (!slot || slot.status !== "OPEN") {
    return { error: "That time slot is no longer available." };
  }
  if (!slot.sitterProfile.isListed) {
    return { error: "That sitter is not currently bookable." };
  }

  const settings = await getBusinessSettings();
  const terms = await getActiveTerms();
  const duration = slotDurationHours(slot.startTime, slot.endTime);
  const lastMinute = isLastMinute(
    slot.startTime,
    settings.lastMinuteThresholdHours,
  );
  const price = computePrice(
    slot.sitterProfile.listedPayRate,
    duration,
    lastMinute,
    settings,
  );

  // Atomically claim the slot so two parents can't book the same window.
  const claimed = await prisma.availabilitySlot.updateMany({
    where: { id: slot.id, status: "OPEN" },
    data: { status: "BOOKED" },
  });
  if (claimed.count === 0) {
    return { error: "That time slot was just booked." };
  }

  const booking = await prisma.booking.create({
    data: {
      parentId: user.id,
      sitterId: slot.sitterProfile.userId,
      availabilitySlotId: slot.id,
      dateTime: slot.startTime,
      durationHours: duration,
      childrenAgeRange: d.childrenAgeRange,
      numberOfChildren: d.numberOfChildren,
      notes: d.notes || null,
      listedRateSnapshot: price.listedRate,
      baseAmount: price.base,
      isLastMinute: lastMinute,
      rushFeeAmount: price.rushFee,
      platformFeeAmount: price.platformFee,
      totalAmount: price.total,
      waiverVersion: terms.version,
      waiverAcceptedAt: new Date(),
      status: "REQUESTED",
    },
  });

  redirect(`/bookings/${booking.id}`);
}

export async function payBooking(bookingId: string) {
  const user = await requireRole("PARENT");
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (booking.parentId !== user.id) throw new Error("Not your booking");
  if (booking.status !== "REQUESTED") {
    throw new Error("Booking is not awaiting payment");
  }

  let paymentIntentId: string | null = null;
  if (stripeEnabled && stripe) {
    // Funds captured to the platform and held (escrow) until completion, then
    // transferred to the sitter's connected account minus the platform fee.
    const pi = await stripe.paymentIntents.create({
      amount: booking.totalAmount * 100,
      currency: "cad",
      capture_method: "automatic",
      metadata: { bookingId },
    });
    paymentIntentId = pi.id;
  }
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CONFIRMED",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
    },
  });
  revalidatePath(`/bookings/${bookingId}`);
}

// Either the parent or an Admin can mark a booking complete, releasing payout.
export async function completeBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { sitter: { include: { sitterProfile: true } } },
  });
  const isParticipant =
    booking.parentId === user.id || booking.sitterId === user.id;
  if (!isParticipant && user.role !== "ADMIN") {
    throw new Error("Not permitted");
  }
  if (booking.status !== "CONFIRMED") {
    throw new Error("Booking must be paid before completion");
  }

  if (stripeEnabled && stripe && booking.sitter.sitterProfile?.stripeAccountId) {
    await stripe.transfers.create({
      amount: (booking.baseAmount + booking.rushFeeAmount) * 100,
      currency: "cad",
      destination: booking.sitter.sitterProfile.stripeAccountId,
      metadata: { bookingId },
    });
  }
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      payoutReleasedAt: new Date(),
    },
  });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/admin");
}

export async function cancelBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  const isParticipant =
    booking.parentId === user.id || booking.sitterId === user.id;
  if (!isParticipant && user.role !== "ADMIN") {
    throw new Error("Not permitted");
  }
  if (["COMPLETED", "CANCELLED"].includes(booking.status)) return;
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    }),
    prisma.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { status: "OPEN" },
    }),
  ]);
  revalidatePath(`/bookings/${bookingId}`);
}

// ---------- Reports ----------

export async function submitReport(fd: FormData) {
  const user = await requireUser();
  const parsed = reportSchema.safeParse({
    bookingId: s(fd, "bookingId"),
    reason: s(fd, "reason"),
  });
  if (!parsed.success) throw new Error("Invalid report");

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: parsed.data.bookingId },
  });
  if (booking.parentId !== user.id && booking.sitterId !== user.id) {
    throw new Error("Not your booking");
  }

  await prisma.report.create({
    data: {
      reporterId: user.id,
      bookingId: booking.id,
      reason: parsed.data.reason,
    },
  });
  revalidatePath(`/bookings/${booking.id}`);
  revalidatePath("/admin");
}

// ---------- Stripe Connect onboarding (sitter payouts) ----------

export async function connectStripe() {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  if (stripeEnabled && stripe) {
    let accountId = profile.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({ type: "express" });
      accountId = account.id;
      await prisma.sitterProfile.update({
        where: { id: profile.id },
        data: { stripeAccountId: accountId },
      });
    }
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/sitter`,
      return_url: `${base}/sitter`,
      type: "account_onboarding",
    });
    redirect(link.url);
  }

  // Mock mode (no Stripe key): simulate a connected payout account so the
  // completion/payout flow is exercisable end to end in dev/test.
  await prisma.sitterProfile.update({
    where: { id: profile.id },
    data: { stripeAccountId: profile.stripeAccountId ?? `mock_acct_${profile.id}` },
  });
  revalidatePath("/sitter");
}
