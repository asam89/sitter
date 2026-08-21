"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { differenceInMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/session";
import { getBusinessSettings, updateBusinessSettings } from "@/lib/settings";
import { computePrice, isLastMinute } from "@/lib/pricing";
import { getActiveTerms } from "@/lib/terms";
import { meetsLevel, LEVEL_LABEL } from "@/lib/verification";
import { stripeEnabled, stripe } from "@/lib/stripe";
import { notifyBookingEvent, type BookingEvent } from "@/lib/booking-notifications";
import {
  notifySitterVetted,
  notifySitterListed,
} from "@/lib/sitter-account-notifications";
import type { BusinessSettings } from "@prisma/client";
import {
  applicationSchema,
  bookingSchema,
  interviewSchema,
  linesToArray,
  reportSchema,
  reviewSchema,
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

// A booking loaded with the fields needed to notify both parties.
type BookingForNotify = {
  id: string;
  dateTime: Date;
  durationHours: number;
  baseAmount: number;
  rushFeeAmount: number;
  totalAmount: number;
  parentId: string;
  sitterId: string;
  parent: { name: string; email: string; phone: string | null };
  sitter: { name: string; email: string; phone: string | null };
  availabilitySlot: { sitterProfile: { city: string | null } };
};

const notifyInclude = {
  parent: { select: { name: true, email: true, phone: true } },
  sitter: { select: { name: true, email: true, phone: true } },
  availabilitySlot: { select: { sitterProfile: { select: { city: true } } } },
} as const;

// Fan a lifecycle event out to the sitter and/or parent across enabled channels.
async function notify(
  event: BookingEvent,
  audiences: Array<"SITTER" | "PARENT">,
  booking: BookingForNotify,
  settings: BusinessSettings,
) {
  const base = {
    bookingId: booking.id,
    settings,
    parentName: booking.parent.name,
    sitterName: booking.sitter.name,
    when: booking.dateTime,
    durationHours: booking.durationHours,
    city: booking.availabilitySlot.sitterProfile.city,
    sitterEarns: booking.baseAmount + booking.rushFeeAmount,
    total: booking.totalAmount,
  };
  for (const audience of audiences) {
    const recipient =
      audience === "SITTER"
        ? {
            userId: booking.sitterId,
            email: booking.sitter.email,
            phone: booking.sitter.phone,
          }
        : {
            userId: booking.parentId,
            email: booking.parent.email,
            phone: booking.parent.phone,
          };
    await notifyBookingEvent(event, { ...base, audience, recipient });
  }
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
      interviewScheduledAt: null,
      interviewNotes: null,
    },
  });
  revalidatePath("/sitter");
  redirect("/sitter");
}

// ---------- Sitter / Admin: availability ----------

function parseSlot(fd: FormData) {
  const parsed = slotSchema.safeParse({
    startTime: s(fd, "startTime"),
    endTime: s(fd, "endTime"),
    isLastMinuteEligible: s(fd, "isLastMinuteEligible"),
  });
  if (!parsed.success) throw new Error("Invalid time range");
  return parsed.data;
}

async function createSlotFor(sitterProfileId: string, fd: FormData) {
  const d = parseSlot(fd);
  await prisma.availabilitySlot.create({
    data: {
      sitterProfileId,
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      isLastMinuteEligible: d.isLastMinuteEligible,
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

// Edit an OPEN slot's time window / last-minute eligibility. Booked slots are
// locked (their booking pins the time) so this only touches OPEN slots.
export async function editMySlot(slotId: string, fd: FormData) {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const d = parseSlot(fd);
  await prisma.availabilitySlot.updateMany({
    where: { id: slotId, sitterProfileId: profile.id, status: "OPEN" },
    data: {
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      isLastMinuteEligible: d.isLastMinuteEligible,
    },
  });
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

// Admin adjusts a sitter's hours. Booked slots stay locked (their booking pins
// the time) — cancel the booking first if the time has to move.
export async function adminEditSlot(slotId: string, fd: FormData) {
  await requireRole("ADMIN");
  const d = parseSlot(fd);
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
  });
  await prisma.availabilitySlot.updateMany({
    where: { id: slotId, status: "OPEN" },
    data: {
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      isLastMinuteEligible: d.isLastMinuteEligible,
    },
  });
  if (slot) revalidatePath(`/admin/sitters/${slot.sitterProfileId}`);
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

// Move an applicant into the interview stage. An optional scheduled time is
// surfaced to the applicant; notes are the reviewers' internal write-up.
export async function moveApplicationToInterview(fd: FormData) {
  await requireRole("ADMIN");
  const parsed = interviewSchema.safeParse({
    applicationId: s(fd, "applicationId"),
    interviewScheduledAt: s(fd, "interviewScheduledAt"),
    interviewNotes: s(fd, "interviewNotes"),
  });
  if (!parsed.success) throw new Error("Invalid interview input");
  const { applicationId, interviewScheduledAt, interviewNotes } = parsed.data;
  await prisma.sitterApplication.updateMany({
    where: {
      id: applicationId,
      status: { in: ["APPLIED", "UNDER_REVIEW", "INTERVIEW"] },
    },
    data: {
      status: "INTERVIEW",
      interviewScheduledAt: interviewScheduledAt
        ? new Date(interviewScheduledAt)
        : null,
      interviewNotes: interviewNotes || null,
    },
  });
  revalidatePath("/admin/applications");
  revalidatePath("/admin");
}

// Save/update the internal interview notes without changing the stage.
export async function saveInterviewNotes(fd: FormData) {
  await requireRole("ADMIN");
  const applicationId = s(fd, "applicationId");
  const interviewNotes = s(fd, "interviewNotes");
  await prisma.sitterApplication.update({
    where: { id: applicationId },
    data: { interviewNotes: interviewNotes || null },
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
    include: { user: { select: { name: true, email: true } } },
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

  // Let the sitter know they've been approved (best-effort; never blocks vetting).
  await notifySitterVetted(app.user.email, app.user.name);

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
  const profile = await prisma.sitterProfile.update({
    where: { id: sitterProfileId },
    data: { isListed },
    include: { user: { select: { name: true, email: true } } },
  });

  // Notify the sitter the first time they go live (best-effort).
  if (isListed) {
    await notifySitterListed(profile.user.email, profile.user.name);
  }

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
    minParentVerificationLevelToBook: s(fd, "minParentVerificationLevelToBook"),
    completionConfirmedBy: s(fd, "completionConfirmedBy"),
    notifySmsEnabled: s(fd, "notifySmsEnabled"),
    notifyWhatsappEnabled: s(fd, "notifyWhatsappEnabled"),
    cancellationWindowHours: s(fd, "cancellationWindowHours"),
    cancellationChargePercent: s(fd, "cancellationChargePercent"),
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

  // Verification gate: a parent must meet the Admin-configured minimum level
  // before any booking can be created.
  const settings0 = await getBusinessSettings();
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { verificationLevel: true },
  });
  if (
    !meetsLevel(
      account.verificationLevel,
      settings0.minParentVerificationLevelToBook,
    )
  ) {
    return {
      error: `Please finish verifying your account (${LEVEL_LABEL[settings0.minParentVerificationLevelToBook]} required) before booking.`,
    };
  }

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
    include: notifyInclude,
  });

  // Alert the sitter across every enabled channel that a request is waiting.
  await notify("REQUESTED", ["SITTER"], booking, settings);

  redirect(`/bookings/${booking.id}`);
}

// ---------- Sitter: approve / decline ----------

// Sitter approves the request at the Admin-set rate (they never set a rate).
// This releases the full service address and moves the booking to APPROVED so
// the parent can pay into escrow.
export async function approveBooking(bookingId: string) {
  const user = await requireRole("SITTER");
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: notifyInclude,
  });
  if (booking.sitterId !== user.id) throw new Error("Not your booking");
  if (booking.status !== "REQUESTED") {
    throw new Error("Only a pending request can be approved.");
  }
  const now = new Date();
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "APPROVED", approvedAt: now, addressReleasedAt: now },
  });
  const settings = await getBusinessSettings();
  await notify("APPROVED", ["PARENT", "SITTER"], booking, settings);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/sitter");
  revalidatePath("/admin");
}

// Sitter declines: booking → DECLINED and the slot reopens for other parents.
export async function declineBooking(bookingId: string) {
  const user = await requireRole("SITTER");
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: notifyInclude,
  });
  if (booking.sitterId !== user.id) throw new Error("Not your booking");
  if (booking.status !== "REQUESTED") {
    throw new Error("Only a pending request can be declined.");
  }
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "DECLINED", declinedAt: new Date() },
    }),
    prisma.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { status: "OPEN" },
    }),
  ]);
  const settings = await getBusinessSettings();
  await notify("DECLINED", ["PARENT"], booking, settings);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/sitter");
  revalidatePath("/admin");
}

// ---------- Parent: payment (escrow) ----------

// Payment happens after the sitter approves, so a parent is never charged for a
// booking the sitter might decline. Funds are held until completion.
export async function payBooking(bookingId: string) {
  const user = await requireRole("PARENT");
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (booking.parentId !== user.id) throw new Error("Not your booking");
  if (booking.status !== "APPROVED") {
    throw new Error("Booking must be approved by the sitter before payment.");
  }
  if (booking.paidAt) throw new Error("Booking is already paid.");

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
    data: { paidAt: new Date(), stripePaymentIntentId: paymentIntentId },
  });
  revalidatePath(`/bookings/${bookingId}`);
}

// ---------- Completion lifecycle ----------

// Mark an approved+paid booking as underway (on/after the scheduled start).
export async function startBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  const isParticipant =
    booking.parentId === user.id || booking.sitterId === user.id;
  if (!isParticipant && user.role !== "ADMIN") throw new Error("Not permitted");
  if (booking.status !== "APPROVED") {
    throw new Error("Booking must be approved before it can start.");
  }
  if (!booking.paidAt) throw new Error("Booking must be paid before it starts.");
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/admin");
}

// Confirm completion (releases payout). The confirmer is configurable: with
// completionConfirmedBy = PARENT the parent or an Admin can confirm; with ADMIN
// only an Admin can. Reviews unlock once COMPLETED.
export async function completeBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { ...notifyInclude, sitter: { include: { sitterProfile: true } } },
  });
  const settings = await getBusinessSettings();

  const isAdmin = user.role === "ADMIN";
  const parentMayConfirm =
    settings.completionConfirmedBy === "PARENT" && booking.parentId === user.id;
  if (!isAdmin && !parentMayConfirm) {
    throw new Error("Not permitted to confirm completion.");
  }
  if (booking.status !== "IN_PROGRESS") {
    throw new Error("Booking must be in progress before completion.");
  }
  if (!booking.paidAt) throw new Error("Booking must be paid before completion.");

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
  await notify("COMPLETED", ["PARENT", "SITTER"], booking, settings);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/admin");
}

export async function cancelBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: notifyInclude,
  });
  const isParticipant =
    booking.parentId === user.id || booking.sitterId === user.id;
  if (!isParticipant && user.role !== "ADMIN") {
    throw new Error("Not permitted");
  }
  if (["COMPLETED", "CANCELLED", "DECLINED"].includes(booking.status)) return;

  const settings = await getBusinessSettings();
  // Late-cancellation charge: if a paid booking is cancelled by the parent
  // within the configurable window of the start time, apply a percent of base.
  let cancellationCharge = 0;
  const hoursToStart =
    (booking.dateTime.getTime() - Date.now()) / (3600 * 1000);
  const withinWindow = hoursToStart < settings.cancellationWindowHours;
  if (
    booking.paidAt &&
    withinWindow &&
    settings.cancellationChargePercent > 0
  ) {
    cancellationCharge = Math.round(
      (booking.baseAmount * settings.cancellationChargePercent) / 100,
    );
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationChargeAmount: cancellationCharge,
      },
    }),
    prisma.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { status: "OPEN" },
    }),
  ]);
  await notify("CANCELLED", ["PARENT", "SITTER"], booking, settings);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/admin");
}

// ---------- Reviews (two-way; unlocked only after completion) ----------

export async function submitReview(fd: FormData) {
  const user = await requireUser();
  const parsed = reviewSchema.safeParse({
    bookingId: s(fd, "bookingId"),
    rating: s(fd, "rating"),
    comment: s(fd, "comment"),
  });
  if (!parsed.success) throw new Error("Invalid review");

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: parsed.data.bookingId },
  });
  const isParent = booking.parentId === user.id;
  const isSitter = booking.sitterId === user.id;
  if (!isParent && !isSitter) throw new Error("Not your booking");
  if (booking.status !== "COMPLETED") {
    throw new Error("Reviews unlock only after a booking is completed.");
  }

  const subjectId = isParent ? booking.sitterId : booking.parentId;
  await prisma.review.upsert({
    where: { bookingId_authorId: { bookingId: booking.id, authorId: user.id } },
    create: {
      bookingId: booking.id,
      authorId: user.id,
      subjectId,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    },
    update: {
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    },
  });
  revalidatePath(`/bookings/${booking.id}`);
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
