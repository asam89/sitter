import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageTitle,
  Card,
  Badge,
  EmptyState,
  ButtonLink,
} from "@/components/ui";
import { dt, money } from "@/lib/format";
import {
  DecidePartner,
  DecideDocument,
  ReportStatusControl,
} from "./AdminControls";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireRole("PLATFORM_ADMIN");

  const [
    pendingPartners,
    pendingDocs,
    reports,
    activeSitters,
    parents,
    bookingCount,
    completed,
    endorsedCount,
    platformVerifiedCount,
  ] = await Promise.all([
    prisma.communityPartner.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.verificationDocument.findMany({
      where: { reviewStatus: "PENDING" },
      include: {
        sitterProfile: { include: { user: { select: { name: true } } } },
      },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { reporter: { select: { name: true } } },
    }),
    prisma.sitterProfile.count({ where: { isAvailableNow: true } }),
    prisma.user.count({ where: { role: "PARENT" } }),
    prisma.booking.count(),
    prisma.booking.findMany({
      where: { status: "COMPLETED" },
      select: { totalAmount: true, platformFeeAmount: true },
    }),
    prisma.sitterProfile.count({
      where: { endorsements: { some: { status: "APPROVED" } } },
    }),
    prisma.sitterProfile.count({
      where: { verificationStatus: "PLATFORM_VERIFIED" },
    }),
  ]);

  const gmv = completed.reduce((s, b) => s + b.totalAmount, 0);
  const feeRevenue = completed.reduce((s, b) => s + b.platformFeeAmount, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <PageTitle title="Platform Admin" />
        <ButtonLink href="/admin/settings" variant="secondary">
          Platform settings
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Available sitters" value={String(activeSitters)} />
        <Stat label="Parents" value={String(parents)} />
        <Stat label="Bookings" value={String(bookingCount)} />
        <Stat label="GMV" value={money(gmv)} />
        <Stat label="Fee revenue" value={money(feeRevenue)} />
        <Stat label="Community-endorsed sitters" value={String(endorsedCount)} />
        <Stat
          label="Platform-verified sitters"
          value={String(platformVerifiedCount)}
        />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Community Partner applications
        </h2>
        {pendingPartners.length === 0 ? (
          <EmptyState>No pending partner applications.</EmptyState>
        ) : (
          <div className="space-y-3">
            {pendingPartners.map((p) => (
              <Card key={p.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-slate-500">
                    {p.type} {p.city ? `· ${p.city}` : ""}
                  </div>
                  {p.description && (
                    <p className="mt-1 text-sm text-slate-600">
                      {p.description}
                    </p>
                  )}
                </div>
                <DecidePartner partnerId={p.id} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Verification documents to review
        </h2>
        {pendingDocs.length === 0 ? (
          <EmptyState>No documents pending review.</EmptyState>
        ) : (
          <div className="space-y-3">
            {pendingDocs.map((d) => (
              <Card key={d.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {d.sitterProfile.user.name}
                  </div>
                  <div className="text-sm text-slate-500">
                    {d.type} ·{" "}
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 underline"
                    >
                      view document
                    </a>
                  </div>
                </div>
                <DecideDocument documentId={d.id} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Reports queue</h2>
        {reports.length === 0 ? (
          <EmptyState>No reports.</EmptyState>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <Card key={r.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge color="red">{r.status}</Badge>
                  <span className="text-xs text-slate-400">
                    {dt(r.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{r.reason}</p>
                <div className="text-xs text-slate-500">
                  {r.targetType} · reported by {r.reporter.name}
                </div>
                <ReportStatusControl
                  reportId={r.id}
                  targetType={r.targetType}
                  targetId={r.targetId}
                />
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </Card>
  );
}
