import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageTitle, Card, Badge, EmptyState } from "@/components/ui";
import { dt } from "@/lib/format";
import {
  DecideAffiliation,
  DecideEndorsement,
} from "./DecisionButtons";

export const dynamic = "force-dynamic";

export default async function CommunityDashboard() {
  const user = await requireRole("COMMUNITY_ADMIN");

  const adminOf = await prisma.communityAffiliation.findMany({
    where: { userId: user.id, role: "ADMIN", status: "APPROVED" },
    include: { communityPartner: true },
  });
  const partnerIds = adminOf.map((a) => a.communityPartnerId);

  if (partnerIds.length === 0) {
    return (
      <div>
        <PageTitle title="Community dashboard" />
        <EmptyState>
          Your community partner is pending platform approval. You&apos;ll be
          able to manage members once approved.
        </EmptyState>
      </div>
    );
  }

  const [pendingMembers, endorsementRequests, reports, stats] =
    await Promise.all([
      prisma.communityAffiliation.findMany({
        where: { communityPartnerId: { in: partnerIds }, status: "PENDING" },
        include: {
          user: { select: { name: true, email: true, role: true } },
          communityPartner: { select: { name: true } },
        },
      }),
      prisma.endorsement.findMany({
        where: { communityPartnerId: { in: partnerIds }, status: "PENDING" },
        include: {
          sitterProfile: {
            include: { user: { select: { name: true, email: true } } },
          },
          communityPartner: { select: { name: true } },
        },
      }),
      prisma.report.findMany({
        where: { visibleToCommunityPartnerId: { in: partnerIds } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.endorsement.count({
        where: { communityPartnerId: { in: partnerIds }, status: "APPROVED" },
      }),
    ]);

  return (
    <div className="space-y-8">
      <PageTitle
        title={adminOf.map((a) => a.communityPartner.name).join(", ")}
        subtitle="Community Partner dashboard"
      />

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Endorsed sitters" value={stats} />
        <Stat label="Pending members" value={pendingMembers.length} />
        <Stat label="Reports" value={reports.length} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Endorsement requests
        </h2>
        {endorsementRequests.length === 0 ? (
          <EmptyState>No pending endorsement requests.</EmptyState>
        ) : (
          <div className="space-y-3">
            {endorsementRequests.map((e) => (
              <Card key={e.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {e.sitterProfile.user.name}
                  </div>
                  <div className="text-sm text-slate-500">
                    {e.communityPartner.name}
                  </div>
                </div>
                <DecideEndorsement endorsementId={e.id} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Membership requests</h2>
        {pendingMembers.length === 0 ? (
          <EmptyState>No pending membership requests.</EmptyState>
        ) : (
          <div className="space-y-3">
            {pendingMembers.map((m) => (
              <Card key={m.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {m.user.name}{" "}
                    <span className="text-xs text-slate-400">
                      ({m.user.role})
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">
                    {m.communityPartner.name}
                  </div>
                </div>
                <DecideAffiliation affiliationId={m.id} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Reports involving your endorsed members
        </h2>
        {reports.length === 0 ? (
          <EmptyState>No reports.</EmptyState>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <Card key={r.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Badge color="red">{r.status}</Badge>
                  <span className="text-xs text-slate-400">
                    {dt(r.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{r.reason}</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </Card>
  );
}
