import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { bookingRef, d, dt, money, moneyHr } from "@/lib/format";
import { effectiveRate, sitterPayout } from "@/lib/pricing";
import { APPLICATION_STATUS_COLOR, BOOKING_STATUS_COLOR } from "@/lib/status";
import { CHECK_TYPE_LABEL, screeningState } from "@/lib/screening";
import { sitterStage } from "@/lib/sitter-stage";

export const dynamic = "force-dynamic";

const HORIZON_DAYS = 28;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="whitespace-pre-line text-sm text-slate-700">{children}</dd>
    </div>
  );
}

function hours(slots: { startTime: Date; endTime: Date }[]): number {
  return slots.reduce(
    (sum, s) => sum + (s.endTime.getTime() - s.startTime.getTime()) / 3_600_000,
    0,
  );
}

// Everything Ri'aya holds on one sitter, for the admin team.
export default async function AdminSitterProfilePage({
  params,
}: {
  params: { userId: string };
}) {
  await requireRole("ADMIN");
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);

  const u = await prisma.user.findUnique({
    where: { id: params.userId },
    include: {
      application: { include: { reviewedBy: { select: { name: true } } } },
      sitterProfile: {
        include: {
          slots: {
            where: { endTime: { gt: now }, startTime: { lt: horizon } },
            select: { startTime: true, endTime: true, status: true },
          },
        },
      },
      screenings: {
        orderBy: { createdAt: "desc" },
        include: {
          verifiedBy: { select: { name: true } },
          _count: { select: { accesses: true } },
        },
      },
      sitterBookings: {
        orderBy: { dateTime: "desc" },
        select: {
          id: true,
          bookingNumber: true,
          dateTime: true,
          durationHours: true,
          status: true,
          totalAmount: true,
          platformFeeAmount: true,
          payoutStatus: true,
          payoutAmount: true,
          payoutPaidAt: true,
          parent: { select: { name: true } },
        },
      },
      reviewsReceived: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!u || u.role !== "SITTER") notFound();

  const app = u.application;
  const sp = u.sitterProfile;
  const stage = sitterStage(u);
  const vsc = u.screenings.find(
    (r) =>
      r.checkType === "VULNERABLE_SECTOR" && screeningState(r, now).current,
  );

  const upcoming = u.sitterBookings
    .filter(
      (b) => b.dateTime > now && !["CANCELLED", "DECLINED"].includes(b.status),
    )
    .reverse();
  const past = u.sitterBookings.filter((b) => !upcoming.includes(b));
  const completed = u.sitterBookings.filter((b) => b.status === "COMPLETED");
  const owedTo = (b: (typeof completed)[number]) =>
    b.payoutAmount ?? sitterPayout(b);
  const paid = completed
    .filter((b) => b.payoutStatus === "PAID")
    .reduce((s, b) => s + owedTo(b), 0);
  const owed = completed
    .filter((b) => b.payoutStatus !== "PAID")
    .reduce((s, b) => s + owedTo(b), 0);
  const openHours = sp ? hours(sp.slots.filter((s) => s.status === "OPEN")) : 0;
  const bookedHours = sp
    ? hours(sp.slots.filter((s) => s.status !== "OPEN"))
    : 0;
  const avgRating =
    u.reviewsReceived.length > 0
      ? u.reviewsReceived.reduce((s, r) => s + r.rating, 0) /
        u.reviewsReceived.length
      : null;

  const link = "text-sm font-medium text-brand-coral";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin/roster" className="text-sm text-slate-500">
        ← All sitters
      </Link>
      <div className="flex flex-wrap items-start gap-4">
        {sp?.photoPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/sitter/${sp.id}/photo`}
            alt=""
            className="h-20 w-20 rounded-full object-cover"
          />
        )}
        <div className="flex-1">
          <PageTitle title={u.name} subtitle={u.email} />
          <div className="-mt-4 flex flex-wrap gap-2">
            <Badge color={stage.color}>{stage.label}</Badge>
            <Badge color={vsc ? "green" : "red"}>
              {vsc ? "VSC on file" : "No current VSC"}
            </Badge>
            {avgRating !== null && (
              <Badge color="indigo">
                {avgRating.toFixed(1)}★ from {u.reviewsReceived.length} review
                {u.reviewsReceived.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Contact &amp; account</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone">
            {u.phone ?? "Not given"}
            {u.phone &&
              (u.smsOptOutAt ? " · texts off (replied STOP)" : " · texts on")}
          </Field>
          <Field label="Email">{u.email}</Field>
          {app?.whatsappPhone && (
            <Field label="Mobile on application">
              {app.whatsappPhone}
              {app.whatsappReachable ? " · on WhatsApp" : " · not on WhatsApp"}
            </Field>
          )}
          <Field label="Joined">{dt(u.createdAt)}</Field>
          <Field label="Newsletter">
            {u.newsletterOptIn && !u.newsletterOptOutAt
              ? "Subscribed"
              : "Not subscribed"}
          </Field>
        </dl>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            href={`/admin/users?q=${encodeURIComponent(u.email)}`}
            className={link}
          >
            Account settings
          </Link>
          <Link href="/admin/messages" className={link}>
            Message sitters
          </Link>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Original application</h2>
          {app && (
            <Badge color={APPLICATION_STATUS_COLOR[app.status]}>
              {app.status.replace("_", " ")}
            </Badge>
          )}
        </div>
        {!app ? (
          <EmptyState>
            No application on file. This account was activated without one.
          </EmptyState>
        ) : (
          <dl className="space-y-3">
            <Field label="Applied">{dt(app.createdAt)}</Field>
            <Field label="About them">{app.bio}</Field>
            <Field label="Experience">{app.experience}</Field>
            <Field label="Certifications">
              {app.certifications.length > 0
                ? app.certifications.join(", ")
                : "None listed"}
            </Field>
            <Field label="Rate they asked for">
              {moneyHr(app.targetPayRate)}
            </Field>
            {app.documentUrls.length > 0 && (
              <Field label="Links they submitted">
                <ul>
                  {app.documentUrls.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-coral"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </Field>
            )}
            <Field label="Interview">
              {app.interviewScheduledAt
                ? `Scheduled ${dt(app.interviewScheduledAt)}`
                : "No time recorded"}
            </Field>
            {app.interviewNotes && (
              <Field label="Interview notes">{app.interviewNotes}</Field>
            )}
            {app.adminNotes && (
              <Field label="Admin notes">{app.adminNotes}</Field>
            )}
            {app.reviewedAt && (
              <Field label="Decision">
                {app.status.replace("_", " ").toLowerCase()} on{" "}
                {dt(app.reviewedAt)}
                {app.reviewedBy ? ` by ${app.reviewedBy.name}` : ""}
              </Field>
            )}
          </dl>
        )}
        <Link
          href="/admin/applications"
          className={`${link} mt-3 inline-block`}
        >
          Review in applications
        </Link>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Sitter profile</h2>
        {!sp ? (
          <EmptyState>
            Not vetted yet, so there is no sitter profile.
          </EmptyState>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Rate parents see">
                {moneyHr(effectiveRate(sp))}
              </Field>
              <Field label="City">{sp.city ?? "Not set"}</Field>
              <Field label="Bookable by parents">
                {sp.isListed ? "Yes, listed" : "No, unlisted"}
              </Field>
              <Field label="Vetted">{d(sp.vettedAt)}</Field>
              <Field label="On the Meet our team page">
                {sp.showcased && sp.publicOptIn
                  ? "Yes"
                  : sp.publicOptIn
                    ? "Sitter agreed; not featured yet"
                    : "No, sitter hasn't agreed to be shown"}
              </Field>
              <Field label={`Next ${HORIZON_DAYS} days`}>
                {openHours}h open · {bookedHours}h booked
              </Field>
            </dl>
            {sp.bio && (
              <dl className="mt-3">
                <Field label="Public bio">{sp.bio}</Field>
              </dl>
            )}
            <Link
              href={`/admin/sitters/${sp.id}`}
              className={`${link} mt-3 inline-block`}
            >
              Edit hours
            </Link>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Documents</h2>
        <p className="mb-3 text-xs text-slate-500">
          Opening a file is logged against your account.
        </p>
        {u.screenings.length === 0 ? (
          <EmptyState>
            No background checks or certificates uploaded.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {u.screenings.map((r) => {
              const state = screeningState(r, now);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {CHECK_TYPE_LABEL[r.checkType]}
                      {r.issuer ? ` · ${r.issuer}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.issuedOn
                        ? `Issued ${d(r.issuedOn)}`
                        : "Issue date not recorded"}
                      {r.renewBy ? ` · renew by ${d(r.renewBy)}` : ""}
                      {r.verifiedAt && r.verifiedBy
                        ? ` · verified by ${r.verifiedBy.name} on ${d(r.verifiedAt)}`
                        : ""}
                      {` · opened ${r._count.accesses} time${r._count.accesses === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      color={
                        r.status === "VERIFIED"
                          ? state.expired
                            ? "red"
                            : "green"
                          : r.status === "REJECTED"
                            ? "red"
                            : "amber"
                      }
                    >
                      {state.expired && r.status === "VERIFIED"
                        ? "EXPIRED"
                        : r.status}
                    </Badge>
                    {r.storagePath ? (
                      <a
                        href={`/admin/screening/doc/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={link}
                      >
                        Open file
                      </a>
                    ) : (
                      <Badge>FILE DESTROYED</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/admin/screening" className={`${link} mt-3 inline-block`}>
          Verify or upload in background checks
        </Link>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Bookings &amp; payouts</h2>
        <dl className="mb-4 grid gap-3 sm:grid-cols-4">
          <Field label="Upcoming">{upcoming.length}</Field>
          <Field label="Completed">{completed.length}</Field>
          <Field label="Paid out">{money(paid)}</Field>
          <Field label="Owed by e-Transfer">{money(owed)}</Field>
        </dl>
        {u.sitterBookings.length === 0 ? (
          <EmptyState>No bookings yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...upcoming, ...past].map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <Link href={`/bookings/${b.id}`} className="text-sm">
                  <span className="font-medium text-brand-coral">
                    {bookingRef(b.bookingNumber)}
                  </span>{" "}
                  · {dt(b.dateTime)} · {b.durationHours}h · {b.parent.name}
                </Link>
                <div className="flex items-center gap-2">
                  {b.status === "COMPLETED" && (
                    <span className="text-xs text-slate-500">
                      {money(owedTo(b))}{" "}
                      {b.payoutStatus === "PAID"
                        ? `paid${b.payoutPaidAt ? ` ${d(b.payoutPaidAt)}` : ""}`
                        : "owed"}
                    </span>
                  )}
                  <Badge color={BOOKING_STATUS_COLOR[b.status]}>
                    {b.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/payouts" className={`${link} mt-3 inline-block`}>
          Sitter payouts
        </Link>
      </Card>

      {u.reviewsReceived.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Parent reviews</h2>
          <ul className="space-y-2">
            {u.reviewsReceived.map((r) => (
              <li key={r.id} className="text-sm text-slate-700">
                <span className="font-medium">{r.rating}★</span> from{" "}
                {r.author.name}, {d(r.createdAt)}
                {r.comment ? `: ${r.comment}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
