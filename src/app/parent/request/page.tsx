import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPlatformFeePct, getDispatchWindowSeconds } from "@/lib/settings";
import { getApprovedCommunityIds } from "@/lib/queries";
import { PageTitle, Card } from "@/components/ui";
import { RequestForm } from "./RequestForm";

export const dynamic = "force-dynamic";

export default async function RequestPage({
  searchParams,
}: {
  searchParams: { sitterId?: string };
}) {
  const user = await requireRole("PARENT");
  const feePct = await getPlatformFeePct();
  const windowSeconds = await getDispatchWindowSeconds();
  const communityIds = await getApprovedCommunityIds(user.id);

  let sitter: { userId: string; name: string; hourlyRate: number } | null =
    null;
  if (searchParams.sitterId) {
    const sp = await prisma.sitterProfile.findUnique({
      where: { userId: searchParams.sitterId },
      include: { user: { select: { name: true } } },
    });
    if (sp)
      sitter = {
        userId: sp.userId,
        name: sp.user.name,
        hourlyRate: sp.hourlyRate,
      };
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle
        title={sitter ? `Book ${sitter.name}` : "Request a sitter now"}
        subtitle={
          sitter
            ? "Confirm the details for this sitter."
            : "We'll dispatch to the nearest available, trusted sitters."
        }
      />
      <Card>
        <RequestForm
          feePct={feePct}
          windowSeconds={windowSeconds}
          hasCommunities={communityIds.length > 0}
          sitter={sitter}
        />
      </Card>
    </div>
  );
}
