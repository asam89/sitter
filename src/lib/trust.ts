export type TrustTier = "COMMUNITY_ENDORSED" | "PLATFORM_VERIFIED" | "UNVERIFIED";

export const TRUST_LABEL: Record<TrustTier, string> = {
  COMMUNITY_ENDORSED: "Community Endorsed",
  PLATFORM_VERIFIED: "Platform Verified",
  UNVERIFIED: "Unverified",
};

const TIER_WEIGHT: Record<TrustTier, number> = {
  COMMUNITY_ENDORSED: 2,
  PLATFORM_VERIFIED: 1,
  UNVERIFIED: 0,
};

export function trustTier(input: {
  hasApprovedEndorsement: boolean;
  verificationStatus: string;
}): TrustTier {
  if (input.hasApprovedEndorsement) return "COMMUNITY_ENDORSED";
  if (input.verificationStatus === "PLATFORM_VERIFIED")
    return "PLATFORM_VERIFIED";
  return "UNVERIFIED";
}

// Community endorsement is the dominant ranking signal (by design), reviews
// are the secondary signal — a strong endorsement plus strong reviews ranks top.
export function rankScore(
  tier: TrustTier,
  avgRating: number,
  reviewCount: number,
): number {
  return TIER_WEIGHT[tier] * 1000 + avgRating * 100 + Math.min(reviewCount, 50);
}
