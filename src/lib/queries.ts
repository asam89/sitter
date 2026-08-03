import { prisma } from "@/lib/prisma";
import { trustTier, rankScore, type TrustTier } from "@/lib/trust";

export type SitterCard = {
  userId: string;
  sitterProfileId: string;
  name: string;
  bio: string | null;
  city: string | null;
  hourlyRate: number;
  languages: string[];
  certifications: string[];
  isAvailableNow: boolean;
  tier: TrustTier;
  endorsedBy: string[]; // community partner names
  avgRating: number;
  reviewCount: number;
  score: number;
};

// Returns sitter cards ranked by trust tier then reviews. When
// communityPartnerIds is provided (the parent's communities) and
// communityOnly is true, only sitters endorsed within those communities show.
export async function getSitterCards(opts: {
  communityOnly?: boolean;
  communityPartnerIds?: string[];
}): Promise<SitterCard[]> {
  const { communityOnly = false, communityPartnerIds = [] } = opts;

  const profiles = await prisma.sitterProfile.findMany({
    where: { user: { suspended: false } },
    include: {
      user: { select: { id: true, name: true } },
      endorsements: {
        where: { status: "APPROVED" },
        include: { communityPartner: { select: { id: true, name: true } } },
      },
    },
  });

  // Review aggregates per sitter user id.
  const reviews = await prisma.review.groupBy({
    by: ["targetId"],
    _avg: { rating: true },
    _count: { _all: true },
  });
  const reviewMap = new Map(
    reviews.map((r) => [
      r.targetId,
      { avg: r._avg.rating ?? 0, count: r._count._all },
    ]),
  );

  const cards: SitterCard[] = [];
  for (const p of profiles) {
    const hasApprovedEndorsement = p.endorsements.length > 0;
    const inParentCommunity = p.endorsements.some((e) =>
      communityPartnerIds.includes(e.communityPartnerId),
    );
    if (communityOnly && !inParentCommunity) continue;

    const agg = reviewMap.get(p.userId) ?? { avg: 0, count: 0 };
    const tier = trustTier({
      hasApprovedEndorsement,
      verificationStatus: p.verificationStatus,
    });
    cards.push({
      userId: p.userId,
      sitterProfileId: p.id,
      name: p.user.name,
      bio: p.bio,
      city: p.city,
      hourlyRate: p.hourlyRate,
      languages: p.languages,
      certifications: p.certifications,
      isAvailableNow: p.isAvailableNow,
      tier,
      endorsedBy: p.endorsements.map((e) => e.communityPartner.name),
      avgRating: Math.round(agg.avg * 10) / 10,
      reviewCount: agg.count,
      score: rankScore(tier, agg.avg, agg.count),
    });
  }
  cards.sort((a, b) => b.score - a.score);
  return cards;
}

export async function getApprovedCommunityIds(
  userId: string,
): Promise<string[]> {
  const affs = await prisma.communityAffiliation.findMany({
    where: { userId, status: "APPROVED" },
    select: { communityPartnerId: true },
  });
  return affs.map((a) => a.communityPartnerId);
}
