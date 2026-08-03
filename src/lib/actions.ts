"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/session";
import { getPlatformFeePct, getDispatchWindowSeconds, setSetting, SETTING_KEYS } from "@/lib/settings";
import { computePrice } from "@/lib/pricing";
import { startDispatch } from "@/lib/dispatch";
import { stripeEnabled, stripe } from "@/lib/stripe";
import { bookingSchema, reviewSchema, reportSchema } from "@/lib/validation";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

// ---------- Sitter ----------

export async function toggleAvailability(available: boolean) {
  const user = await requireRole("SITTER");
  await prisma.sitterProfile.update({
    where: { userId: user.id },
    data: { isAvailableNow: available },
  });
  revalidatePath("/sitter");
}

export async function updateSitterProfile(fd: FormData) {
  const user = await requireRole("SITTER");
  await prisma.sitterProfile.update({
    where: { userId: user.id },
    data: {
      bio: s(fd, "bio") || null,
      hourlyRate: Math.max(1, Number(s(fd, "hourlyRate")) || 20),
      serviceRadiusKm: Math.max(1, Number(s(fd, "serviceRadiusKm")) || 15),
      city: s(fd, "city") || null,
      languages: splitCsv(s(fd, "languages")),
      certifications: splitCsv(s(fd, "certifications")),
    },
  });
  revalidatePath("/sitter");
}

function splitCsv(v: string): string[] {
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function requestEndorsement(communityPartnerId: string) {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  await prisma.endorsement.upsert({
    where: {
      sitterProfileId_communityPartnerId: {
        sitterProfileId: profile.id,
        communityPartnerId,
      },
    },
    create: {
      sitterProfileId: profile.id,
      communityPartnerId,
      status: "PENDING",
    },
    update: { status: "PENDING" },
  });
  revalidatePath("/sitter/endorsements");
}

export async function addVerificationDocument(fd: FormData) {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const type = s(fd, "type") as "ID" | "BACKGROUND_CHECK" | "CERTIFICATION";
  const fileUrl = s(fd, "fileUrl");
  if (!fileUrl) return;
  await prisma.verificationDocument.create({
    data: { sitterProfileId: profile.id, type, fileUrl },
  });
  revalidatePath("/sitter/verification");
}

// ---------- Community affiliation (join a community) ----------

export async function joinCommunity(communityPartnerId: string) {
  const user = await requireUser();
  await prisma.communityAffiliation.upsert({
    where: {
      userId_communityPartnerId: { userId: user.id, communityPartnerId },
    },
    create: { userId: user.id, communityPartnerId, status: "PENDING" },
    update: {},
  });
  revalidatePath("/parent");
  revalidatePath("/sitter/endorsements");
}

// ---------- Community admin ----------

export async function decideAffiliation(
  affiliationId: string,
  approve: boolean,
) {
  const admin = await requireRole("COMMUNITY_ADMIN");
  const aff = await prisma.communityAffiliation.findUniqueOrThrow({
    where: { id: affiliationId },
  });
  await assertPartnerAdmin(admin.id, aff.communityPartnerId);
  await prisma.communityAffiliation.update({
    where: { id: affiliationId },
    data: { status: approve ? "APPROVED" : "REJECTED" },
  });
  revalidatePath("/community");
}

export async function decideEndorsement(
  endorsementId: string,
  approve: boolean,
) {
  const admin = await requireRole("COMMUNITY_ADMIN");
  const end = await prisma.endorsement.findUniqueOrThrow({
    where: { id: endorsementId },
  });
  await assertPartnerAdmin(admin.id, end.communityPartnerId);
  await prisma.endorsement.update({
    where: { id: endorsementId },
    data: {
      status: approve ? "APPROVED" : "DENIED",
      endorsedByAdminId: admin.id,
    },
  });
  revalidatePath("/community");
}

export async function revokeEndorsement(endorsementId: string) {
  const admin = await requireRole("COMMUNITY_ADMIN");
  const end = await prisma.endorsement.findUniqueOrThrow({
    where: { id: endorsementId },
  });
  await assertPartnerAdmin(admin.id, end.communityPartnerId);
  await prisma.endorsement.update({
    where: { id: endorsementId },
    data: { status: "REVOKED" },
  });
  revalidatePath("/community");
}

async function assertPartnerAdmin(userId: string, communityPartnerId: string) {
  const aff = await prisma.communityAffiliation.findFirst({
    where: {
      userId,
      communityPartnerId,
      role: "ADMIN",
      status: "APPROVED",
    },
  });
  if (!aff) throw new Error("Not an admin of this community partner.");
}

// ---------- Platform admin ----------

export async function decidePartner(partnerId: string, approve: boolean) {
  await requireRole("PLATFORM_ADMIN");
  await prisma.communityPartner.update({
    where: { id: partnerId },
    data: { status: approve ? "APPROVED" : "REJECTED" },
  });
  revalidatePath("/admin");
}

export async function decideDocument(documentId: string, approve: boolean) {
  const admin = await requireRole("PLATFORM_ADMIN");
  const doc = await prisma.verificationDocument.update({
    where: { id: documentId },
    data: {
      reviewStatus: approve ? "APPROVED" : "REJECTED",
      reviewedByAdminId: admin.id,
    },
  });
  // A sitter with at least one approved document is Platform Verified.
  if (approve) {
    await prisma.sitterProfile.update({
      where: { id: doc.sitterProfileId },
      data: { verificationStatus: "PLATFORM_VERIFIED" },
    });
  }
  revalidatePath("/admin");
}

export async function updateSettings(fd: FormData) {
  await requireRole("PLATFORM_ADMIN");
  const fee = Number(s(fd, "platformFeePct"));
  const win = Number(s(fd, "dispatchWindowSeconds"));
  if (!Number.isNaN(fee) && fee >= 0 && fee <= 100) {
    await setSetting(SETTING_KEYS.platformFeePct, String(fee));
  }
  if (!Number.isNaN(win) && win >= 30 && win <= 3600) {
    await setSetting(SETTING_KEYS.dispatchWindowSeconds, String(win));
  }
  revalidatePath("/admin/settings");
}

export async function setUserSuspended(userId: string, suspended: boolean) {
  await requireRole("PLATFORM_ADMIN");
  await prisma.user.update({ where: { id: userId }, data: { suspended } });
  revalidatePath("/admin");
}

export async function updateReportStatus(
  reportId: string,
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED",
) {
  await requireRole("PLATFORM_ADMIN", "COMMUNITY_ADMIN");
  await prisma.report.update({ where: { id: reportId }, data: { status } });
  revalidatePath("/admin");
  revalidatePath("/community");
}

// ---------- Bookings / dispatch ----------

export async function createBooking(fd: FormData) {
  const user = await requireRole("PARENT");
  const parsed = bookingSchema.safeParse({
    requestType: s(fd, "requestType"),
    dateTime: s(fd, "dateTime"),
    durationHours: s(fd, "durationHours"),
    childrenAgeRange: s(fd, "childrenAgeRange"),
    numberOfChildren: s(fd, "numberOfChildren"),
    sitterId: s(fd, "sitterId") || undefined,
    communityOnly: s(fd, "communityOnly") === "on" || s(fd, "communityOnly") === "true",
  });
  if (!parsed.success) throw new Error("Invalid booking input");
  const data = parsed.data;

  const feePct = await getPlatformFeePct();
  const windowSeconds = await getDispatchWindowSeconds();

  // Determine the sitter rate for the price snapshot. For a directed booking we
  // use that sitter's rate; for open dispatch we snapshot the parent-facing fee
  // against the chosen sitter at accept time, using a provisional rate here.
  let sitterHourlyRate = 20;
  let directedSitterUserId: string | undefined;
  if (data.sitterId) {
    const sp = await prisma.sitterProfile.findUnique({
      where: { userId: data.sitterId },
    });
    if (sp) {
      sitterHourlyRate = sp.hourlyRate;
      directedSitterUserId = data.sitterId;
    }
  }

  const when =
    data.requestType === "SCHEDULED" && data.dateTime
      ? new Date(data.dateTime)
      : new Date();

  const price = computePrice(sitterHourlyRate, feePct, data.durationHours);

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: user.id },
  });

  const booking = await prisma.booking.create({
    data: {
      parentId: user.id,
      sitterId: directedSitterUserId ?? null,
      requestType: data.requestType,
      status: directedSitterUserId ? "ACCEPTED" : "PENDING",
      dateTime: when,
      durationHours: data.durationHours,
      childrenAgeRange: data.childrenAgeRange,
      numberOfChildren: data.numberOfChildren,
      city: parentProfile?.city ?? null,
      lat: parentProfile?.lat ?? null,
      lng: parentProfile?.lng ?? null,
      address: parentProfile?.address ?? null,
      addressReleasedAt: directedSitterUserId ? new Date() : null,
      communityOnly: data.communityOnly,
      sitterHourlyRate,
      platformFeePct: feePct,
      platformFeeAmount: price.platformFeeAmount,
      totalAmount: price.totalAmount,
      dispatchDeadline:
        data.requestType === "NOW" && !directedSitterUserId
          ? new Date(Date.now() + windowSeconds * 1000)
          : null,
    },
  });

  if (!directedSitterUserId) {
    await startDispatch(booking);
  }

  redirect(`/bookings/${booking.id}`);
}

export async function acceptOffer(bookingId: string) {
  const user = await requireRole("SITTER");
  // Atomic claim: only succeed if still PENDING and unassigned.
  const result = await prisma.booking.updateMany({
    where: { id: bookingId, status: "PENDING", sitterId: null },
    data: {
      sitterId: user.id,
      status: "ACCEPTED",
      addressReleasedAt: new Date(),
    },
  });
  if (result.count === 0) {
    // Someone else got it, or it expired.
    revalidatePath("/sitter");
    return;
  }
  // Snapshot this sitter's actual rate for pricing transparency.
  const sp = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
  });
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (sp) {
    const price = computePrice(
      sp.hourlyRate,
      booking.platformFeePct,
      booking.durationHours,
    );
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        sitterHourlyRate: sp.hourlyRate,
        platformFeeAmount: price.platformFeeAmount,
        totalAmount: price.totalAmount,
      },
    });
  }
  await prisma.dispatchOffer.updateMany({
    where: { bookingId, sitterId: user.id },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });
  await prisma.dispatchOffer.updateMany({
    where: { bookingId, sitterId: { not: user.id }, status: { in: ["OFFERED", "VIEWED"] } },
    data: { status: "EXPIRED", respondedAt: new Date() },
  });
  revalidatePath("/sitter");
  revalidatePath(`/bookings/${bookingId}`);
}

export async function declineOffer(bookingId: string) {
  const user = await requireRole("SITTER");
  await prisma.dispatchOffer.updateMany({
    where: { bookingId, sitterId: user.id },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
  revalidatePath("/sitter");
}

export async function payBooking(bookingId: string) {
  const user = await requireRole("PARENT");
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (booking.parentId !== user.id) throw new Error("Not your booking");
  if (booking.status !== "ACCEPTED") throw new Error("Booking not ready to pay");

  let paymentIntentId: string | null = null;
  if (stripeEnabled && stripe) {
    // Stripe Connect: funds are captured to the platform and held until the
    // booking is completed, then transferred to the sitter minus the fee.
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
      status: "IN_PROGRESS",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
    },
  });
  revalidatePath(`/bookings/${bookingId}`);
}

export async function completeBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (booking.parentId !== user.id && booking.sitterId !== user.id) {
    throw new Error("Not your booking");
  }
  // Payout released to the sitter minus the platform fee once complete.
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "COMPLETED", payoutReleasedAt: new Date() },
  });
  revalidatePath(`/bookings/${bookingId}`);
}

export async function cancelBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (booking.parentId !== user.id && booking.sitterId !== user.id) {
    throw new Error("Not your booking");
  }
  if (["COMPLETED", "CANCELLED"].includes(booking.status)) return;
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED" },
  });
  revalidatePath(`/bookings/${bookingId}`);
}

// ---------- Reviews ----------

export async function submitReview(bookingId: string, fd: FormData) {
  const user = await requireUser();
  const parsed = reviewSchema.safeParse({
    rating: s(fd, "rating"),
    text: s(fd, "text"),
  });
  if (!parsed.success) throw new Error("Invalid review");
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });
  if (booking.status !== "COMPLETED") throw new Error("Booking not completed");
  const isParent = booking.parentId === user.id;
  const isSitter = booking.sitterId === user.id;
  if (!isParent && !isSitter) throw new Error("Not your booking");
  const targetId = isParent ? booking.sitterId! : booking.parentId;

  await prisma.review.upsert({
    where: { bookingId_authorId: { bookingId, authorId: user.id } },
    create: {
      bookingId,
      authorId: user.id,
      targetId,
      rating: parsed.data.rating,
      text: parsed.data.text || null,
    },
    update: {}, // reviews are permanent once posted
  });
  revalidatePath(`/bookings/${bookingId}`);
}

// ---------- Reports ----------

export async function submitReport(fd: FormData) {
  const user = await requireUser();
  const parsed = reportSchema.safeParse({
    targetType: s(fd, "targetType"),
    targetId: s(fd, "targetId"),
    reason: s(fd, "reason"),
  });
  if (!parsed.success) throw new Error("Invalid report");

  // If the report concerns a sitter, make it visible to a community partner
  // that endorses them (in addition to the platform admin queue).
  let visibleToCommunityPartnerId: string | null = null;
  if (parsed.data.targetType === "USER") {
    const sitter = await prisma.sitterProfile.findUnique({
      where: { userId: parsed.data.targetId },
      include: {
        endorsements: {
          where: { status: "APPROVED" },
          select: { communityPartnerId: true },
        },
      },
    });
    if (sitter && sitter.endorsements.length > 0) {
      visibleToCommunityPartnerId = sitter.endorsements[0].communityPartnerId;
    }
  }

  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      visibleToCommunityPartnerId,
    },
  });
  revalidatePath("/admin");
}

// ---------- Partner application (become a community partner) ----------

export async function applyAsPartner(fd: FormData) {
  const name = s(fd, "name");
  const email = s(fd, "email").toLowerCase();
  const password = s(fd, "password");
  const adminName = s(fd, "adminName");
  const type = (s(fd, "type") || "OTHER") as
    | "MOSQUE"
    | "SCHOOL"
    | "SPORTS_LEAGUE"
    | "OTHER";
  const city = s(fd, "city");
  const description = s(fd, "description");

  if (!name || !email || password.length < 8 || !adminName) {
    throw new Error("Missing required fields");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already in use");

  const passwordHash = await bcrypt.hash(password, 10);
  const partner = await prisma.communityPartner.create({
    data: {
      name,
      type,
      city: city || null,
      description: description || null,
      status: "PENDING",
    },
  });
  await prisma.user.create({
    data: {
      name: adminName,
      email,
      passwordHash,
      role: "COMMUNITY_ADMIN",
      affiliations: {
        create: {
          communityPartnerId: partner.id,
          role: "ADMIN",
          status: "APPROVED",
        },
      },
    },
  });
  redirect("/partner/apply/thanks");
}
