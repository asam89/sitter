import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { connectStripe } from "@/lib/actions";
import { ActionButton } from "@/components/ActionButton";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageTitle,
} from "@/components/ui";
import { APPLICATION_STATUS_COLOR, BOOKING_STATUS_COLOR } from "@/lib/status";
import { dt, money, moneyHr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SitterDashboard() {
  const user = await requireRole("SITTER");
  const [application, profile] = await Promise.all([
    prisma.sitterApplication.findUnique({ where: { userId: user.id } }),
    prisma.sitterProfile.findUnique({
      where: { userId: user.id },
      include: { slots: { where: { status: "OPEN" } } },
    }),
  ]);
  const bookings = await prisma.booking.findMany({
    where: { sitterId: user.id },
    orderBy: { dateTime: "desc" },
    include: { parent: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <PageTitle title={`Hi, ${user.name}`} subtitle="Your sitter dashboard." />

      {/* Vetting / listing status */}
      {!application ? (
        <Card>
          <h2 className="font-semibold">Get vetted to start sitting</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every Sitbaby sitter is manually vetted by our team before they can
            be listed and booked.
          </p>
          <div className="mt-3">
            <ButtonLink href="/sitter/apply">Start application</ButtonLink>
          </div>
        </Card>
      ) : !profile ? (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Application status</h2>
            <Badge color={APPLICATION_STATUS_COLOR[application.status]}>
              {application.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Your requested rate: {moneyHr(application.targetPayRate)}.
          </p>
          {application.status === "REJECTED" ? (
            <>
              {application.adminNotes && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                  {application.adminNotes}
                </p>
              )}
              <div className="mt-3">
                <ButtonLink href="/sitter/apply" variant="secondary">
                  Update &amp; re-apply
                </ButtonLink>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              We&apos;ll email you once our team has reviewed your application.
            </p>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">You&apos;re vetted</h2>
              <p className="mt-1 text-sm text-slate-600">
                Your listed rate is {moneyHr(profile.listedPayRate)} (set by
                Sitbaby). Your original proposal was{" "}
                {moneyHr(application.targetPayRate)}.
              </p>
            </div>
            <Badge color={profile.isListed ? "green" : "amber"}>
              {profile.isListed ? "Listed — bookable" : "Not currently listed"}
            </Badge>
          </div>
          {!profile.isListed && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Only Sitbaby can list you. You can still set your availability now
              so you&apos;re ready when we list you.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="/sitter/availability">
              Manage availability ({profile.slots.length} open)
            </ButtonLink>
            {profile.stripeAccountId ? (
              <Badge color="green">Payouts connected</Badge>
            ) : (
              <ActionButton action={connectStripe} variant="secondary">
                Connect payouts (Stripe)
              </ActionButton>
            )}
          </div>
        </Card>
      )}

      {/* Bookings */}
      <section>
        <h2 className="mb-3 font-semibold">Your bookings</h2>
        {bookings.length === 0 ? (
          <EmptyState>No bookings yet.</EmptyState>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <Card key={b.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {dt(b.dateTime)} · {b.durationHours}h
                    </p>
                    <p className="text-sm text-slate-600">
                      {b.parent.name} · {b.numberOfChildren} child(ren), ages{" "}
                      {b.childrenAgeRange}
                      {b.isLastMinute && (
                        <span className="ml-2 text-amber-700">· last-minute</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      You earn {money(b.baseAmount + b.rushFeeAmount)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge color={BOOKING_STATUS_COLOR[b.status]}>
                      {b.status}
                    </Badge>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="text-sm font-medium text-indigo-600"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
