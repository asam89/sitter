"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { differenceInMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/session";
import { getBusinessSettings, updateBusinessSettings } from "@/lib/settings";
import {
  computePrice,
  effectiveRate,
  isLastMinute,
  sitterPayout,
} from "@/lib/pricing";
import { computeRefund } from "@/lib/cancellation";
import {
  copyRequestMedicalToBooking,
  parseChildMedical,
  storeChildMedical,
} from "@/lib/child-medical";
import { getActiveTerms } from "@/lib/terms";
import { meetsLevel, LEVEL_LABEL } from "@/lib/verification";
import { stripeEnabled, stripe } from "@/lib/stripe";
import { notifyBookingEvent, type BookingEvent } from "@/lib/booking-notifications";
import {
  notifySitterVetted,
  notifySitterListed,
} from "@/lib/sitter-account-notifications";
import {
  notifyAdminsOfApplication,
  notifyAdminsOfBooking,
  notifyAdminsOfOpenRequest,
} from "@/lib/admin-notifications";
import { notifyListedSittersOfRequest } from "@/lib/request-notifications";
import { Prisma, type BusinessSettings } from "@prisma/client";
import {
  adminBookingSchema,
  applicationSchema,
  bookingRequestSchema,
  bookingSchema,
  interviewSchema,
  linesToArray,
  reportSchema,
  reviewSchema,
  settingsSchema,
  sitterRateSchema,
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

// Evidence captured alongside a waiver acceptance. Behind a proxy the client IP
// arrives in x-forwarded-for (first hop), which is how prod (nginx) serves.
function waiverAcceptanceContext(): {
  ip: string | null;
  userAgent: string | null;
} {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

// A booking loaded with the fields needed to notify both parties.
type BookingForNotify = {
  id: string;
  dateTime: Date;
  durationHours: number;
  baseAmount: number;
  rushFeeAmount: number;
  platformFeeAmount: number;
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
    sitterEarns: sitterPayout(booking),
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
    whatsappPhone: s(fd, "whatsappPhone"),
    whatsappReachable: s(fd, "whatsappReachable"),
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

  const wasResubmitted = existing !== null;

  await prisma.sitterApplication.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      bio: d.bio,
      experience: d.experience,
      certifications: linesToArray(d.certifications),
      documentUrls: linesToArray(d.documentUrls),
      targetPayRate: d.targetPayRate,
      whatsappPhone: d.whatsappPhone,
      whatsappReachable: d.whatsappReachable,
      status: "APPLIED",
    },
    update: {
      bio: d.bio,
      experience: d.experience,
      certifications: linesToArray(d.certifications),
      documentUrls: linesToArray(d.documentUrls),
      targetPayRate: d.targetPayRate,
      whatsappPhone: d.whatsappPhone,
      whatsappReachable: d.whatsappReachable,
      status: "APPLIED",
      reviewedByAdminId: null,
      reviewedAt: null,
      interviewScheduledAt: null,
      interviewNotes: null,
    },
  });
  // The application number doubles as the sitter's contact number: keep it on
  // the account so booking texts reach them, but never clear a verified phone.
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true, phoneVerified: true },
  });
  if (!account?.phoneVerified && account?.phone !== d.whatsappPhone) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: d.whatsappPhone },
    });
  }

  await notifyAdminsOfApplication({
    name: user.name ?? null,
    email: user.email ?? null,
    targetPayRate: d.targetPayRate,
    resubmitted: wasResubmitted,
    whatsappPhone: d.whatsappPhone,
    whatsappReachable: d.whatsappReachable,
  });

  revalidatePath("/sitter");
  redirect("/sitter");
}

// ---------- Sitter: own hourly rate ----------

// Sitters price their own time. Existing and future bookings keep the rate they
// were quoted at (pricing is snapshotted on the booking), so a change here only
// affects new bookings.
export async function setMyRate(fd: FormData) {
  const user = await requireRole("SITTER");
  const parsed = sitterRateSchema.safeParse({ baseRate: s(fd, "baseRate") });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid rate");
  }
  await prisma.sitterProfile.update({
    where: { userId: user.id },
    data: { baseRate: parsed.data.baseRate },
  });
  revalidatePath("/sitter");
  revalidatePath("/parent/schedule");
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
    minBookingHours: s(fd, "minBookingHours"),
    extraChildFeeAmount: s(fd, "extraChildFeeAmount"),
    lateNightFeeAmount: s(fd, "lateNightFeeAmount"),
    lateNightStartHour: s(fd, "lateNightStartHour"),
    lateNightEndHour: s(fd, "lateNightEndHour"),
    overnightFeeAmount: s(fd, "overnightFeeAmount"),
    overnightStartHour: s(fd, "overnightStartHour"),
    overnightEndHour: s(fd, "overnightEndHour"),
    refundFullBeforeHours: s(fd, "refundFullBeforeHours"),
    lateCancelWindowHours: s(fd, "lateCancelWindowHours"),
    midRefundPercent: s(fd, "midRefundPercent"),
    lateRefundPercent: s(fd, "lateRefundPercent"),
    afterStartRefundPercent: s(fd, "afterStartRefundPercent"),
    sitterCancelRefundPercent: s(fd, "sitterCancelRefundPercent"),
    etransferEmail: s(fd, "etransferEmail"),
  });
  if (!parsed.success) throw new Error("Invalid settings");
  const { etransferEmail, ...rest } = parsed.data;
  await updateBusinessSettings({
    ...rest,
    etransferEmail: etransferEmail || null,
  });
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
  if (duration < settings.minBookingHours) {
    return {
      error: `Bookings are a minimum of ${settings.minBookingHours} hours — this block is only ${duration}h.`,
    };
  }
  const lastMinute = isLastMinute(
    slot.startTime,
    settings.lastMinuteThresholdHours,
  );
  const price = computePrice(
    effectiveRate(slot.sitterProfile),
    duration,
    lastMinute,
    settings,
    slot.startTime,
    d.numberOfChildren,
  );
  const acceptance = waiverAcceptanceContext();

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
      extraChildFeeAmount: price.extraChildFee,
      lateNightFeeAmount: price.lateNightFee,
      overnightFeeAmount: price.overnightFee,
      platformFeeAmount: price.platformFee,
      totalAmount: price.total,
      waiverVersion: terms.version,
      waiverAcceptedAt: new Date(),
      waiverAcceptedIp: acceptance.ip,
      waiverAcceptedUserAgent: acceptance.userAgent,
      status: "REQUESTED",
    },
    include: notifyInclude,
  });

  // Health details, encrypted and released to the sitter only once paid.
  await storeChildMedical(
    { bookingId: booking.id },
    parseChildMedical(fd),
    booking.dateTime,
  );

  // Alert the sitter across every enabled channel that a request is waiting.
  await notify("REQUESTED", ["SITTER"], booking, settings);
  await notifyAdminsOfBooking({
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    parentName: booking.parent.name,
    sitterName: booking.sitter.name,
    when: booking.dateTime,
    durationHours: booking.durationHours,
    totalAmount: booking.totalAmount,
    isLastMinute: booking.isLastMinute,
  });

  redirect(`/bookings/${booking.id}`);
}

// ---------- Admin: manual booking on a parent's behalf ----------

// Admin enters a booking for a parent who called/messaged instead of using the
// app. It follows the normal lifecycle from here: the sitter still confirms, the
// parent still accepts the waiver and pays, and the window becomes a BOOKED
// block so it shows on the calendar and hours grid like any other booking.
export async function adminCreateBooking(
  _prevState: BookingFormState,
  fd: FormData,
): Promise<BookingFormState> {
  const admin = await requireRole("ADMIN");
  const parsed = adminBookingSchema.safeParse({
    parentId: s(fd, "parentId"),
    sitterProfileId: s(fd, "sitterProfileId"),
    startTime: s(fd, "startTime"),
    durationHours: s(fd, "durationHours"),
    childrenAgeRange: s(fd, "childrenAgeRange"),
    numberOfChildren: s(fd, "numberOfChildren"),
    notes: s(fd, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid booking input" };
  }
  const d = parsed.data;
  const start = new Date(d.startTime);
  if (Number.isNaN(start.getTime())) {
    return { error: "That date and time isn't valid." };
  }
  const end = new Date(start.getTime() + d.durationHours * 3600 * 1000);

  const settings = await getBusinessSettings();
  if (d.durationHours < settings.minBookingHours) {
    return {
      error: `Bookings are a minimum of ${settings.minBookingHours} hours.`,
    };
  }

  const [parent, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: d.parentId },
      select: { role: true, suspended: true },
    }),
    prisma.sitterProfile.findUnique({
      where: { id: d.sitterProfileId },
      include: { user: { select: { suspended: true } } },
    }),
  ]);
  if (!parent || parent.role !== "PARENT" || parent.suspended) {
    return { error: "That parent account can't be booked for." };
  }
  if (!profile || !profile.isListed || profile.user.suspended) {
    return { error: "That sitter isn't currently bookable." };
  }
  const conflict = await prisma.availabilitySlot.findFirst({
    where: {
      sitterProfileId: profile.id,
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  if (conflict) {
    return { error: "That window overlaps an existing block for this sitter." };
  }

  const terms = await getActiveTerms();
  const lastMinute = isLastMinute(start, settings.lastMinuteThresholdHours);
  const price = computePrice(
    effectiveRate(profile),
    d.durationHours,
    lastMinute,
    settings,
    start,
    d.numberOfChildren,
  );

  const slot = await prisma.availabilitySlot.create({
    data: {
      sitterProfileId: profile.id,
      startTime: start,
      endTime: end,
      status: "BOOKED",
      isLastMinuteEligible: lastMinute,
    },
  });
  const booking = await prisma.booking.create({
    data: {
      parentId: d.parentId,
      sitterId: profile.userId,
      availabilitySlotId: slot.id,
      dateTime: start,
      durationHours: d.durationHours,
      childrenAgeRange: d.childrenAgeRange,
      numberOfChildren: d.numberOfChildren,
      notes: d.notes || null,
      listedRateSnapshot: price.listedRate,
      baseAmount: price.base,
      isLastMinute: lastMinute,
      rushFeeAmount: price.rushFee,
      extraChildFeeAmount: price.extraChildFee,
      lateNightFeeAmount: price.lateNightFee,
      overnightFeeAmount: price.overnightFee,
      platformFeeAmount: price.platformFee,
      totalAmount: price.total,
      // Version pinned now; the parent's own acceptance is recorded at payment.
      waiverVersion: terms.version,
      createdByAdminId: admin.id,
      status: "REQUESTED",
    },
    include: notifyInclude,
  });

  await notify("REQUESTED", ["SITTER", "PARENT"], booking, settings);
  await notifyAdminsOfBooking({
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    parentName: booking.parent.name,
    sitterName: booking.sitter.name,
    when: booking.dateTime,
    durationHours: booking.durationHours,
    totalAmount: booking.totalAmount,
    isLastMinute: booking.isLastMinute,
  });

  revalidatePath("/admin/bookings");
  redirect(`/bookings/${booking.id}`);
}

// ---------- Open requests (no published availability) ----------

export type RequestFormState = { error?: string };

// A parent asks for a time nobody has posted availability for. This creates no
// booking and holds no slot: it goes on a board that Admin and every listed
// sitter can see, and the first sitter to claim it turns it into a booking.
export async function createBookingRequest(
  _prevState: RequestFormState,
  fd: FormData,
): Promise<RequestFormState> {
  const user = await requireRole("PARENT");

  // Same verification gate as a direct booking — a request can become one.
  const settings = await getBusinessSettings();
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      verificationLevel: true,
      name: true,
      parentProfile: { select: { city: true } },
    },
  });
  if (
    !meetsLevel(
      account.verificationLevel,
      settings.minParentVerificationLevelToBook,
    )
  ) {
    return {
      error: `Please finish verifying your account (${LEVEL_LABEL[settings.minParentVerificationLevelToBook]} required) before requesting a sitter.`,
    };
  }

  const parsed = bookingRequestSchema.safeParse({
    startTime: s(fd, "startTime"),
    durationHours: s(fd, "durationHours"),
    childrenAgeRange: s(fd, "childrenAgeRange"),
    numberOfChildren: s(fd, "numberOfChildren"),
    notes: s(fd, "notes"),
    waiverAccepted: s(fd, "waiverAccepted"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const d = parsed.data;
  const startTime = new Date(d.startTime);
  if (Number.isNaN(startTime.getTime())) {
    return { error: "Choose a valid date and start time." };
  }
  if (startTime.getTime() <= Date.now()) {
    return { error: "Choose a start time in the future." };
  }
  if (d.durationHours < settings.minBookingHours) {
    return {
      error: `Bookings are a minimum of ${settings.minBookingHours} hours.`,
    };
  }

  const terms = await getActiveTerms();
  const acceptance = waiverAcceptanceContext();
  const request = await prisma.bookingRequest.create({
    data: {
      parentId: user.id,
      startTime,
      durationHours: d.durationHours,
      childrenAgeRange: d.childrenAgeRange,
      numberOfChildren: d.numberOfChildren,
      notes: d.notes || null,
      waiverVersion: terms.version,
      waiverAcceptedAt: new Date(),
      waiverAcceptedIp: acceptance.ip,
      waiverAcceptedUserAgent: acceptance.userAgent,
    },
  });

  await storeChildMedical(
    { bookingRequestId: request.id },
    parseChildMedical(fd),
    request.startTime,
  );

  const summary = {
    requestNumber: request.requestNumber,
    startTime: request.startTime,
    durationHours: request.durationHours,
    numberOfChildren: request.numberOfChildren,
    childrenAgeRange: request.childrenAgeRange,
    city: account.parentProfile?.city ?? null,
    isLastMinute: isLastMinute(startTime, settings.lastMinuteThresholdHours),
  };
  const listedSitterCount = await prisma.sitterProfile.count({
    where: { isListed: true, user: { suspended: false } },
  });
  await notifyListedSittersOfRequest(summary);
  await notifyAdminsOfOpenRequest({
    ...summary,
    when: summary.startTime,
    parentName: account.name,
    listedSitterCount,
  });

  revalidatePath("/parent");
  redirect("/parent");
}

// Turn an open request into a booking for a specific sitter. Shared by the
// sitter claiming it and an Admin assigning it. The sitter volunteered for the
// time, so there is no separate approval step: the booking lands APPROVED with
// the address released, awaiting the parent's payment.
async function fulfilRequest(
  requestId: string,
  sitterProfileId: string,
): Promise<string> {
  const profile = await prisma.sitterProfile.findUniqueOrThrow({
    where: { id: sitterProfileId },
    include: { user: { select: { suspended: true } } },
  });
  if (!profile.isListed || profile.user.suspended) {
    throw new Error("That sitter isn't currently bookable.");
  }
  const request = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  if (request.status !== "OPEN") {
    throw new Error("That request is no longer open.");
  }

  const start = request.startTime;
  const end = new Date(start.getTime() + request.durationHours * 3600 * 1000);
  const conflict = await prisma.availabilitySlot.findFirst({
    where: {
      sitterProfileId: profile.id,
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  if (conflict) {
    throw new Error("That window overlaps an existing block for this sitter.");
  }

  const settings = await getBusinessSettings();
  const lastMinute = isLastMinute(start, settings.lastMinuteThresholdHours);
  const price = computePrice(
    effectiveRate(profile),
    request.durationHours,
    lastMinute,
    settings,
    start,
    request.numberOfChildren,
  );

  // Atomically claim the request so two sitters can't pick up the same one.
  const claimed = await prisma.bookingRequest.updateMany({
    where: { id: requestId, status: "OPEN" },
    data: {
      status: "CLAIMED",
      claimedById: profile.userId,
      claimedAt: new Date(),
    },
  });
  if (claimed.count === 0) {
    throw new Error("Another sitter just picked that request up.");
  }

  // The claimed window becomes a BOOKED block so it shows in the hours grid and
  // blocks any conflicting booking.
  const now = new Date();
  const slot = await prisma.availabilitySlot.create({
    data: {
      sitterProfileId: profile.id,
      startTime: start,
      endTime: end,
      status: "BOOKED",
      isLastMinuteEligible: lastMinute,
    },
  });
  const booking = await prisma.booking.create({
    data: {
      parentId: request.parentId,
      sitterId: profile.userId,
      availabilitySlotId: slot.id,
      dateTime: start,
      durationHours: request.durationHours,
      childrenAgeRange: request.childrenAgeRange,
      numberOfChildren: request.numberOfChildren,
      notes: request.notes,
      listedRateSnapshot: price.listedRate,
      baseAmount: price.base,
      isLastMinute: lastMinute,
      rushFeeAmount: price.rushFee,
      extraChildFeeAmount: price.extraChildFee,
      lateNightFeeAmount: price.lateNightFee,
      overnightFeeAmount: price.overnightFee,
      platformFeeAmount: price.platformFee,
      totalAmount: price.total,
      waiverVersion: request.waiverVersion,
      waiverAcceptedAt: request.waiverAcceptedAt,
      waiverAcceptedIp: request.waiverAcceptedIp,
      waiverAcceptedUserAgent: request.waiverAcceptedUserAgent,
      status: "APPROVED",
      approvedAt: now,
      addressReleasedAt: now,
    },
    include: notifyInclude,
  });
  await prisma.bookingRequest.update({
    where: { id: requestId },
    data: { bookingId: booking.id },
  });
  await copyRequestMedicalToBooking(requestId, booking.id, start);

  await notify("APPROVED", ["PARENT", "SITTER"], booking, settings);
  await notifyAdminsOfBooking({
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    parentName: booking.parent.name,
    sitterName: booking.sitter.name,
    when: booking.dateTime,
    durationHours: booking.durationHours,
    totalAmount: booking.totalAmount,
    isLastMinute: booking.isLastMinute,
  });
  return booking.id;
}

export async function claimBookingRequest(requestId: string) {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) throw new Error("You need to be vetted before claiming work.");
  const bookingId = await fulfilRequest(requestId, profile.id);
  revalidatePath("/sitter/requests");
  revalidatePath("/sitter");
  revalidatePath("/admin/requests");
  redirect(`/bookings/${bookingId}`);
}

export async function adminAssignBookingRequest(fd: FormData) {
  await requireRole("ADMIN");
  const requestId = s(fd, "requestId");
  const sitterProfileId = s(fd, "sitterProfileId");
  if (!requestId || !sitterProfileId) throw new Error("Pick a sitter to assign.");
  await fulfilRequest(requestId, sitterProfileId);
  revalidatePath("/admin/requests");
  revalidatePath("/admin");
}

// Withdraw an open request. The parent can withdraw their own; Admin can
// withdraw any. Claimed requests are cancelled through their booking instead.
export async function cancelBookingRequest(requestId: string) {
  const user = await requireUser();
  const request = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  if (request.parentId !== user.id && user.role !== "ADMIN") {
    throw new Error("Not your request");
  }
  await prisma.bookingRequest.updateMany({
    where: { id: requestId, status: "OPEN" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  revalidatePath("/parent");
  revalidatePath("/sitter/requests");
  revalidatePath("/admin/requests");
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

export type PaymentFormState = { error?: string };

// Payment happens after the sitter approves, so a parent is never charged for a
// booking the sitter might decline. A card payment settles here and holds the
// funds until completion; an e-transfer settles outside the app, so the booking
// only records the choice and waits for an Admin to confirm the money arrived.
export async function payBooking(
  _prevState: PaymentFormState,
  fd: FormData,
): Promise<PaymentFormState> {
  const user = await requireRole("PARENT");
  const bookingId = s(fd, "bookingId");
  const method = s(fd, "method") === "ETRANSFER" ? "ETRANSFER" : "CARD";
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (booking.parentId !== user.id) throw new Error("Not your booking");
  if (booking.status !== "APPROVED") {
    return { error: "The sitter has to approve the booking before payment." };
  }
  if (booking.paidAt) return { error: "This booking is already paid." };

  // An Admin-entered booking carries no waiver acceptance yet; the parent gives
  // it here, before any money moves.
  const waiver: Prisma.BookingUpdateInput = {};
  if (!booking.waiverAcceptedAt) {
    if (s(fd, "waiverAccepted") !== "on") {
      return { error: "You must accept the waiver and terms to pay." };
    }
    const acceptance = waiverAcceptanceContext();
    waiver.waiverAcceptedAt = new Date();
    waiver.waiverAcceptedIp = acceptance.ip;
    waiver.waiverAcceptedUserAgent = acceptance.userAgent;
  }

  if (method === "ETRANSFER") {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { ...waiver, paymentMethod: "ETRANSFER" },
    });
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/admin/bookings");
    return {};
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
      ...waiver,
      paidAt: new Date(),
      paymentMethod: "CARD",
      stripePaymentIntentId: paymentIntentId,
    },
  });
  revalidatePath(`/bookings/${bookingId}`);
  return {};
}

// Admin records a payment that arrived outside the app (e-transfer or cash).
// This is the only way an e-transfer booking becomes paid, so who confirmed it
// is stored on the booking.
export async function adminMarkBookingPaid(bookingId: string) {
  const admin = await requireRole("ADMIN");
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (booking.paidAt) throw new Error("Booking is already paid.");
  if (booking.status !== "APPROVED") {
    throw new Error("The sitter has to approve the booking before payment.");
  }
  if (!booking.waiverAcceptedAt) {
    throw new Error(
      "The parent has to accept the waiver before the booking can be paid.",
    );
  }
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paidAt: new Date(),
      paymentMethod: booking.paymentMethod ?? "ETRANSFER",
      paidRecordedById: admin.id,
    },
  });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
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
      amount: sitterPayout(booking) * 100,
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

// Form wrapper so the canceller can say why (stored on the booking, shown to
// the other party and to Admin).
export async function cancelBookingWithReason(fd: FormData) {
  const bookingId = String(fd.get("bookingId") ?? "");
  const reason = String(fd.get("reason") ?? "");
  await cancelBooking(bookingId, reason);
}

export async function cancelBooking(bookingId: string, reason?: string) {
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
  // Tiered refund: who cancelled, and (for a parent) how much notice they gave.
  // A sitter or Admin cancellation always makes the parent whole.
  const actorRole =
    user.role === "ADMIN" && !isParticipant
      ? "ADMIN"
      : booking.sitterId === user.id
        ? "SITTER"
        : booking.parentId === user.id
          ? "PARENT"
          : "ADMIN";
  const refund = computeRefund({
    actorRole,
    paidAmount: booking.paidAt ? booking.totalAmount : 0,
    start: booking.dateTime,
    settings,
  });

  // Refund the real charge where one exists; the mock-payment path just records
  // the outcome. A processor failure must not leave the booking half-cancelled.
  let refundProcessorId: string | null = null;
  let refundProcessorStatus: string | null = null;
  if (refund.refundAmount > 0) {
    if (stripeEnabled && stripe && booking.stripePaymentIntentId) {
      const created = await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        amount: refund.refundAmount * 100,
      });
      refundProcessorId = created.id;
      refundProcessorStatus = created.status ?? null;
    } else {
      refundProcessorStatus = "mock";
    }
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationChargeAmount: refund.forfeitAmount,
        refundAmount: refund.refundAmount,
        refundPercent: booking.paidAt ? refund.refundPercent : null,
        refundTier: refund.tier,
        cancelledByUserId: user.id,
        cancelledByRole: actorRole,
        cancellationReason: reason?.trim() || null,
        refundProcessorId,
        refundProcessorStatus,
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
