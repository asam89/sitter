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
import { PublicProfileCard } from "./PublicProfileCard";
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
  const pending = bookings.filter((b) => b.status === "REQUESTED");
  const upcoming = bookings.filter((b) =>
    ["APPROVED", "IN_PROGRESS"].includes(b.status),
  );
  const history = bookings.filter((b) =>
    ["COMPLETED", "DECLINED", "CANCELLED"].includes(b.status),
  );

  return (
    <div className="space-y-6">
      <PageTitle title={`Hi, ${user.name}`} subtitle="Your sitter dashboard." />

      {/* Vetting / listing status */}
      {!application ? (
        <Card>
          <h2 className="font-semibold">Get vetted to start sitting</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every Ri&apos;aya sitter is manually vetted by our team before they can
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
          ) : application.status === "INTERVIEW" ? (
            <p className="mt-2 rounded-lg bg-brand-cream px-3 py-2 text-sm text-brand-teal">
              Our team would like to interview you
              {application.interviewScheduledAt
                ? ` on ${dt(application.interviewScheduledAt)}.`
                : ". We\u2019ll reach out to arrange a time."}{" "}
              This is the final step before we vet and list you.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              We&apos;ll email you once our team has reviewed your application.
              Vetting includes a short interview with our reviewers.
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
                Ri&apos;aya). Your original proposal was{" "}
                {moneyHr(application.targetPayRate)}.
              </p>
            </div>
            <Badge color={profile.isListed ? "green" : "amber"}>
              {profile.isListed ? "Listed — bookable" : "Not currently listed"}
            </Badge>
          </div>
          {!profile.isListed && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Only Ri&apos;aya can list you. You can still set your availability now
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

      {/* Public profile: photo + bio + opt-in (only once vetted) */}
      {profile && (
        <PublicProfileCard
          profileId={profile.id}
          bio={profile.bio ?? ""}
          publicOptIn={profile.publicOptIn}
          hasPhoto={Boolean(profile.photoPath)}
          showcased={profile.showcased}
        />
      )}

      {/* Bookings — grouped by lifecycle stage */}
      <BookingSection
        title="Pending your approval"
        bookings={pending}
        empty="No requests waiting on you."
        highlight
      />
      <BookingSection
        title="Upcoming"
        bookings={upcoming}
        empty="No approved bookings yet."
      />
      <BookingSection
        title="History"
        bookings={history}
        empty="No past bookings."
      />
    </div>
  );
}

type SitterBooking = {
  id: string;
  dateTime: Date;
  durationHours: number;
  numberOfChildren: number;
  childrenAgeRange: string;
  isLastMinute: boolean;
  baseAmount: number;
  rushFeeAmount: number;
  status: keyof typeof BOOKING_STATUS_COLOR;
  parent: { name: string };
};

function BookingSection({
  title,
  bookings,
  empty,
  highlight,
}: {
  title: string;
  bookings: SitterBooking[];
  empty: string;
  highlight?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 font-semibold">
        {title}
        {highlight && bookings.length > 0 && (
          <span className="ml-2 rounded-full bg-brand-coral px-2 py-0.5 text-xs text-white">
            {bookings.length}
          </span>
        )}
      </h2>
      {bookings.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
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
                  <Badge color={BOOKING_STATUS_COLOR[b.status]}>{b.status}</Badge>
                  <Link
                    href={`/bookings/${b.id}`}
                    className="text-sm font-medium text-brand-coral"
                  >
                    {b.status === "REQUESTED" ? "Review" : "View"}
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
