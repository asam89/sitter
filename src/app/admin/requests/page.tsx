import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { effectiveRate } from "@/lib/pricing";
import { requireRole } from "@/lib/session";
import { adminAssignBookingRequest, cancelBookingRequest } from "@/lib/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { REQUEST_STATUS_COLOR } from "@/lib/status";
import { bookingRef, dt, moneyHr, requestRef } from "@/lib/format";
import { AssignForm } from "./AssignForm";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requireRole("ADMIN");
  const [requests, sitters] = await Promise.all([
    prisma.bookingRequest.findMany({
      orderBy: [{ status: "asc" }, { startTime: "asc" }],
      take: 100,
      include: {
        parent: {
          select: {
            name: true,
            email: true,
            phone: true,
            parentProfile: { select: { city: true } },
          },
        },
        claimedBy: { select: { name: true } },
        booking: { select: { id: true, bookingNumber: true } },
      },
    }),
    prisma.sitterProfile.findMany({
      where: { isListed: true, user: { suspended: false } },
      select: {
        id: true,
        baseRate: true,
        listedPayRate: true,
        city: true,
        user: { select: { name: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const sitterOptions = sitters.map((s) => ({
    id: s.id,
    label: `${s.user.name} · ${moneyHr(effectiveRate(s))}${s.city ? ` · ${s.city}` : ""}`,
  }));
  const open = requests.filter((r) => r.status === "OPEN");

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sitter requests"
        subtitle="Times parents asked for when nobody had posted availability. Sitters can claim these; you can also assign one."
      />

      <Card>
        <p className="text-sm text-slate-600">
          <span className="font-semibold">{open.length}</span> open request
          {open.length === 1 ? "" : "s"} · broadcast to{" "}
          {sitterOptions.length} listed sitter
          {sitterOptions.length === 1 ? "" : "s"}. Claiming or assigning creates
          a confirmed booking at that sitter&apos;s listed rate and releases the
          family&apos;s address to them.
        </p>
      </Card>

      {requests.length === 0 ? (
        <EmptyState>No sitter requests yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{dt(r.startTime)}</span>
                    <Badge color="amber">{r.durationHours}h</Badge>
                    <Badge color={REQUEST_STATUS_COLOR[r.status]}>
                      {r.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {requestRef(r.requestNumber)} · {r.parent.name} (
                    {r.parent.email}
                    {r.parent.phone ? `, ${r.parent.phone}` : ""}) ·{" "}
                    {r.numberOfChildren} child
                    {r.numberOfChildren === 1 ? "" : "ren"} aged{" "}
                    {r.childrenAgeRange}
                    {r.parent.parentProfile?.city
                      ? ` · ${r.parent.parentProfile.city}`
                      : ""}
                  </p>
                  {r.notes && (
                    <p className="mt-1 text-sm text-slate-500">“{r.notes}”</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Requested {dt(r.createdAt)} · waiver {r.waiverVersion}
                    {r.claimedBy ? ` · picked up by ${r.claimedBy.name}` : ""}
                  </p>
                  {r.booking && (
                    <Link
                      href={`/bookings/${r.booking.id}`}
                      className="mt-1 inline-block text-sm font-semibold text-brand-teal underline"
                    >
                      {bookingRef(r.booking.bookingNumber)}
                    </Link>
                  )}
                </div>
                {r.status === "OPEN" && (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <AssignForm
                      requestId={r.id}
                      sitters={sitterOptions}
                      action={adminAssignBookingRequest}
                    />
                    <ActionButton
                      action={cancelBookingRequest.bind(null, r.id)}
                      variant="secondary"
                      confirm="Withdraw this request?"
                    >
                      Withdraw
                    </ActionButton>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
