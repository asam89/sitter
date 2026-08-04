import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageTitle,
} from "@/components/ui";
import { BOOKING_STATUS_COLOR, REPORT_STATUS_COLOR } from "@/lib/status";
import { dt, money, moneyHr } from "@/lib/format";
import {
  ListingToggle,
  ReportControls,
  SuspendButton,
} from "./AdminControls";

export const dynamic = "force-dynamic";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </Card>
  );
}

export default async function AdminDashboard() {
  await requireRole("ADMIN");

  const [
    pendingApps,
    sitters,
    listedCount,
    bookings,
    reports,
    revenueAgg,
    rushBookings,
  ] = await Promise.all([
    prisma.sitterApplication.count({
      where: { status: { in: ["APPLIED", "UNDER_REVIEW"] } },
    }),
    prisma.sitterProfile.findMany({
      include: {
        user: { select: { id: true, name: true, suspended: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sitterProfile.count({ where: { isListed: true } }),
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        parent: { select: { name: true } },
        sitter: { select: { name: true } },
      },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reporter: { select: { name: true } },
        booking: {
          select: {
            id: true,
            parent: { select: { name: true } },
            sitter: { select: { name: true } },
          },
        },
      },
    }),
    prisma.booking.aggregate({
      where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { totalAmount: true, platformFeeAmount: true, rushFeeAmount: true },
    }),
    prisma.booking.count({
      where: { isLastMinute: true, status: { in: ["CONFIRMED", "COMPLETED"] } },
    }),
  ]);

  const bookedRevenue = revenueAgg._sum.totalAmount ?? 0;
  const feeRevenue = revenueAgg._sum.platformFeeAmount ?? 0;
  const rushRevenue = revenueAgg._sum.rushFeeAmount ?? 0;
  const openReports = reports.filter((r) => r.status === "OPEN");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <PageTitle title="Admin dashboard" subtitle="Ri'aya operations." />
        <div className="flex gap-2">
          <ButtonLink href="/admin/applications" variant="secondary">
            Applications ({pendingApps})
          </ButtonLink>
          <ButtonLink href="/admin/parents" variant="secondary">
            Parents
          </ButtonLink>
          <ButtonLink href="/admin/settings" variant="secondary">
            Business rules
          </ButtonLink>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Pending applications" value={String(pendingApps)} />
        <Metric
          label="Listed / vetted sitters"
          value={`${listedCount} / ${sitters.length}`}
        />
        <Metric label="Booked revenue (GMV)" value={money(bookedRevenue)} />
        <Metric
          label="Platform / rush revenue"
          value={`${money(feeRevenue)} / ${money(rushRevenue)}`}
        />
      </section>

      {/* Sitter listing control */}
      <section>
        <h2 className="mb-3 font-semibold">Vetted sitters — listing control</h2>
        {sitters.length === 0 ? (
          <EmptyState>No vetted sitters yet.</EmptyState>
        ) : (
          <div className="space-y-2">
            {sitters.map((sp) => (
              <Card key={sp.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {sp.user.name}{" "}
                      <span className="text-sm text-slate-400">
                        {moneyHr(sp.listedPayRate)}
                      </span>
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge color={sp.isListed ? "green" : "amber"}>
                        {sp.isListed ? "Listed" : "Unlisted"}
                      </Badge>
                      {sp.user.suspended && <Badge color="red">Suspended</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/sitters/${sp.id}`}
                      className="text-sm font-medium text-brand-coral"
                    >
                      Availability
                    </Link>
                    <ListingToggle
                      sitterProfileId={sp.id}
                      isListed={sp.isListed}
                    />
                    <SuspendButton
                      userId={sp.user.id}
                      suspended={sp.user.suspended}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Reports */}
      <section>
        <h2 className="mb-3 font-semibold">
          Reports {openReports.length > 0 && `(${openReports.length} open)`}
        </h2>
        {reports.length === 0 ? (
          <EmptyState>No reports.</EmptyState>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">{r.reason}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      by {r.reporter.name} · booking{" "}
                      {r.booking.parent.name} / {r.booking.sitter.name} ·{" "}
                      {dt(r.createdAt)}
                    </p>
                    <Link
                      href={`/bookings/${r.booking.id}`}
                      className="text-xs font-medium text-brand-coral"
                    >
                      View booking
                    </Link>
                  </div>
                  <Badge color={REPORT_STATUS_COLOR[r.status]}>{r.status}</Badge>
                </div>
                {r.status !== "RESOLVED" && r.status !== "DISMISSED" && (
                  <div className="mt-2">
                    <ReportControls reportId={r.id} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent bookings */}
      <section>
        <h2 className="mb-3 font-semibold">Recent bookings</h2>
        {bookings.length === 0 ? (
          <EmptyState>No bookings yet.</EmptyState>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <Card key={b.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {b.parent.name} → {b.sitter.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {dt(b.dateTime)} · {money(b.totalAmount)}
                      {b.isLastMinute && (
                        <span className="ml-1 text-amber-700">· rush</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={BOOKING_STATUS_COLOR[b.status]}>
                      {b.status}
                    </Badge>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="text-sm font-medium text-brand-coral"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          {rushBookings} paid/completed booking(s) carried a rush fee.
        </p>
      </section>
    </div>
  );
}
