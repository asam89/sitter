import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card, Badge, EmptyState } from "@/components/ui";
import { JoinButton } from "./JoinButton";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const user = await requireUser();
  const [partners, affiliations] = await Promise.all([
    prisma.communityPartner.findMany({
      where: { status: "APPROVED" },
      orderBy: { name: "asc" },
    }),
    prisma.communityAffiliation.findMany({ where: { userId: user.id } }),
  ]);
  const affMap = new Map(affiliations.map((a) => [a.communityPartnerId, a.status]));

  return (
    <div className="space-y-6">
      <PageTitle
        title="Community directory"
        subtitle="Join a community to unlock endorsed sitters and (for sitters) request endorsement."
      />
      {partners.length === 0 ? (
        <EmptyState>No community partners onboarded yet.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {partners.map((p) => {
            const status = affMap.get(p.id);
            return (
              <Card key={p.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.type} {p.city ? `· ${p.city}` : ""}
                    </div>
                  </div>
                  {status && (
                    <Badge color={status === "APPROVED" ? "green" : "amber"}>
                      {status}
                    </Badge>
                  )}
                </div>
                {p.description && (
                  <p className="text-sm text-slate-600">{p.description}</p>
                )}
                {!status && <JoinButton communityPartnerId={p.id} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
