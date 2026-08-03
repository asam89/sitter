import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card, Badge, EmptyState } from "@/components/ui";
import { EndorsementButton } from "./EndorsementButton";

export const dynamic = "force-dynamic";

export default async function EndorsementsPage() {
  const user = await requireRole("SITTER");
  const profile = await prisma.sitterProfile.findUniqueOrThrow({
    where: { userId: user.id },
    include: { endorsements: true },
  });

  // Communities the sitter is an approved member of.
  const affiliations = await prisma.communityAffiliation.findMany({
    where: { userId: user.id, status: "APPROVED" },
    include: { communityPartner: { select: { id: true, name: true } } },
  });

  const byPartner = new Map(
    profile.endorsements.map((e) => [e.communityPartnerId, e.status]),
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle
        title="Community endorsements"
        subtitle="Ask a community you belong to to vouch for you. Endorsement is the strongest trust signal on CircleCare."
      />
      {affiliations.length === 0 ? (
        <EmptyState>
          You have no approved community memberships yet. Join a community from
          the communities directory first.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {affiliations.map((a) => {
            const status = byPartner.get(a.communityPartnerId);
            return (
              <Card
                key={a.id}
                className="flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{a.communityPartner.name}</div>
                  {status && (
                    <Badge
                      color={
                        status === "APPROVED"
                          ? "green"
                          : status === "PENDING"
                            ? "amber"
                            : "red"
                      }
                    >
                      {status}
                    </Badge>
                  )}
                </div>
                {status !== "APPROVED" && (
                  <EndorsementButton
                    communityPartnerId={a.communityPartnerId}
                    pending={status === "PENDING"}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
