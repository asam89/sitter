import { prisma } from "@/lib/prisma";
import { distanceKm } from "@/lib/geo";
import type { Booking, DispatchTier } from "@prisma/client";

async function parentCommunityIds(parentUserId: string): Promise<string[]> {
  const affs = await prisma.communityAffiliation.findMany({
    where: { userId: parentUserId, status: "APPROVED" },
    select: { communityPartnerId: true },
  });
  return affs.map((a) => a.communityPartnerId);
}

type Candidate = {
  userId: string;
  lat: number | null;
  lng: number | null;
  serviceRadiusKm: number;
};

function withinRadius(booking: Booking, s: Candidate): boolean {
  if (booking.lat == null || booking.lng == null) return true;
  if (s.lat == null || s.lng == null) return true;
  return (
    distanceKm(
      { lat: booking.lat, lng: booking.lng },
      { lat: s.lat, lng: s.lng },
    ) <= s.serviceRadiusKm
  );
}

async function communityEndorsedSitters(
  communityIds: string[],
): Promise<Candidate[]> {
  if (communityIds.length === 0) return [];
  const profiles = await prisma.sitterProfile.findMany({
    where: {
      isAvailableNow: true,
      user: { suspended: false },
      endorsements: {
        some: { status: "APPROVED", communityPartnerId: { in: communityIds } },
      },
    },
    select: { userId: true, lat: true, lng: true, serviceRadiusKm: true },
  });
  return profiles;
}

async function anyEndorsedSitters(): Promise<Candidate[]> {
  const profiles = await prisma.sitterProfile.findMany({
    where: {
      isAvailableNow: true,
      user: { suspended: false },
      endorsements: { some: { status: "APPROVED" } },
    },
    select: { userId: true, lat: true, lng: true, serviceRadiusKm: true },
  });
  return profiles;
}

async function platformVerifiedSitters(): Promise<Candidate[]> {
  const profiles = await prisma.sitterProfile.findMany({
    where: {
      isAvailableNow: true,
      user: { suspended: false },
      verificationStatus: "PLATFORM_VERIFIED",
    },
    select: { userId: true, lat: true, lng: true, serviceRadiusKm: true },
  });
  return profiles;
}

async function createOffers(
  booking: Booking,
  candidates: Candidate[],
  tier: DispatchTier,
): Promise<number> {
  const eligible = candidates.filter(
    (c) => c.userId !== booking.parentId && withinRadius(booking, c),
  );
  if (eligible.length === 0) return 0;
  const res = await prisma.dispatchOffer.createMany({
    data: eligible.map((c) => ({
      bookingId: booking.id,
      sitterId: c.userId,
      tier,
    })),
    skipDuplicates: true,
  });
  return res.count;
}

// Tier 1: community-endorsed sitters get first dibs. For communityOnly requests
// only sitters endorsed within the parent's own community are eligible.
export async function startDispatch(booking: Booking): Promise<number> {
  const communityIds = await parentCommunityIds(booking.parentId);
  const tier1 = booking.communityOnly
    ? await communityEndorsedSitters(communityIds)
    : communityIds.length > 0
      ? await communityEndorsedSitters(communityIds)
      : await anyEndorsedSitters();
  return createOffers(booking, tier1, "COMMUNITY_ENDORSED");
}

// Tier 2: once the fallback window elapses with no acceptance, include
// platform-verified-only sitters (never for communityOnly requests).
export async function expandDispatchIfNeeded(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;
  if (booking.status !== "PENDING") return;
  if (booking.requestType !== "NOW") return;
  if (booking.communityOnly) return;
  if (!booking.dispatchDeadline || booking.dispatchDeadline > new Date()) return;

  const existing = await prisma.dispatchOffer.findMany({
    where: { bookingId, tier: "PLATFORM_VERIFIED" },
    select: { id: true },
  });
  if (existing.length > 0) return;

  const tier2 = await platformVerifiedSitters();
  await createOffers(booking, tier2, "PLATFORM_VERIFIED");
}
