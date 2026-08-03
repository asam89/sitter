import { prisma } from "@/lib/prisma";

// Marks OFFERED dispatch offers as VIEWED so the parent's live status can show
// "a sitter is viewing your request". Best-effort, non-blocking on failure.
export async function markOffersViewed(offerIds: string[]): Promise<void> {
  if (offerIds.length === 0) return;
  await prisma.dispatchOffer.updateMany({
    where: { id: { in: offerIds }, status: "OFFERED" },
    data: { status: "VIEWED", viewedAt: new Date() },
  });
}
