import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { adminMarkPayoutPaid, adminPayoutBooking } from "@/lib/actions";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { Badge, Card, EmptyState, PageTitle, buttonClass } from "@/components/ui";
import { bookingRef, dt, money } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OWED: "Owed",
  BLOCKED: "Blocked",
  FAILED: "Failed",
  PAID: "Paid",
};

const STATUS_COLOR: Record<string, "green" | "amber" | "red"> = {
  OWED: "amber",
  BLOCKED: "amber",
  FAILED: "red",
  PAID: "green",
};

// Money Ri'aya owes sitters for work already done, and what's actually left the
// account. Card money lands in Ri'aya's Stripe balance first, pays out to the
// chequing account on Stripe's schedule, and the sitter's share is transferred
// out of that same balance — so a payout can be owed while the cash is still in
// transit.
export default async function AdminPayoutsPage() {
  await requireRole("ADMIN");

  const [outstanding, paid] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "COMPLETED", payoutPaidAt: null },
      orderBy: { completedAt: "asc" },
      include: {
        sitter: {
          select: {
            name: true,
            email: true,
            sitterProfile: {
              select: {
                stripeAccountId: true,
                stripePayoutsEnabled: true,
                stripeRequirementsDue: true,
              },
            },
          },
        },
      },
    }),
    prisma.booking.findMany({
      where: { status: "COMPLETED", payoutPaidAt: { not: null } },
      orderBy: { payoutPaidAt: "desc" },
      take: 50,
      include: {
        sitter: { select: { name: true } },
        payoutRecordedBy: { select: { name: true } },
      },
    }),
  ]);

  const owedTotal = outstanding.reduce(
    (sum, b) => sum + (b.payoutAmount ?? b.totalAmount - b.platformFeeAmount),
    0,
  );

  // Stripe's view of the float: "available" can already be paid out to the
  // chequing account, "pending" is card money still settling.
  let balance: { available: number; pending: number } | null = null;
  if (stripeEnabled && stripe) {
    try {
      const b = await stripe.balance.retrieve();
      const cad = (rows: { amount: number; currency: string }[]) =>
        rows
          .filter((r) => r.currency === "cad")
          .reduce((sum, r) => sum + r.amount, 0) / 100;
      balance = { available: cad(b.available), pending: cad(b.pending) };
    } catch {
      balance = null;
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sitter payouts"
        subtitle="What Ri'aya owes sitters for completed bookings, and what has already been sent."
      />

      <Card>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase text-slate-500">Owed to sitters</p>
            <p className="text-2xl font-semibold">{money(owedTotal)}</p>
            <p className="text-xs text-slate-500">
              {outstanding.length} completed booking
              {outstanding.length === 1 ? "" : "s"}
            </p>
          </div>
          {balance && (
            <>
              <div>
                <p className="text-xs uppercase text-slate-500">
                  Stripe balance available
                </p>
                <p className="text-2xl font-semibold">
                  {money(balance.available)}
                </p>
                <p className="text-xs text-slate-500">
                  Payable now, and paid to your chequing account on Stripe&apos;s
                  schedule.
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">
                  Still settling
                </p>
                <p className="text-2xl font-semibold">
                  {money(balance.pending)}
                </p>
                <p className="text-xs text-slate-500">
                  Card charges Stripe hasn&apos;t released yet.
                </p>
              </div>
            </>
          )}
        </div>
        {!stripeEnabled && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Stripe isn&apos;t configured, so no card money is being collected and
            no payout can be sent automatically. Settle these by e-Transfer and
            record them here.
          </p>
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Outstanding</h2>
        {outstanding.length === 0 ? (
          <EmptyState>Every completed booking has been paid out.</EmptyState>
        ) : (
          outstanding.map((b) => {
            const amount =
              b.payoutAmount ?? b.totalAmount - b.platformFeeAmount;
            const profile = b.sitter.sitterProfile;
            const stripeReady =
              stripeEnabled &&
              Boolean(profile?.stripeAccountId) &&
              !profile?.stripeAccountId?.startsWith("mock_acct_") &&
              profile?.stripePayoutsEnabled;
            return (
              <Card key={b.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={STATUS_COLOR[b.payoutStatus ?? "OWED"]}>
                    {STATUS_LABEL[b.payoutStatus ?? "OWED"]}
                  </Badge>
                  <Link
                    href={`/bookings/${b.id}`}
                    className="font-mono text-sm underline"
                  >
                    {bookingRef(b.bookingNumber)}
                  </Link>
                  <span className="text-sm">{b.sitter.name}</span>
                  <span className="text-sm text-slate-500">
                    session {dt(b.dateTime)}
                  </span>
                  <span className="ml-auto text-lg font-semibold">
                    {money(amount)}
                  </span>
                </div>

                {!stripeReady && (
                  <p className="mt-2 text-xs text-amber-800">
                    {profile?.stripeAccountId
                      ? profile.stripeRequirementsDue
                        ? `Stripe still needs: ${profile.stripeRequirementsDue}.`
                        : "Stripe hasn't enabled payouts on this sitter's account yet."
                      : "This sitter hasn't connected a Stripe payout account — pay them by e-Transfer and record it."}
                  </p>
                )}
                {b.payoutError && (
                  <p className="mt-1 text-xs text-red-700">{b.payoutError}</p>
                )}

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  {stripeReady && (
                    <form action={adminPayoutBooking}>
                      <input type="hidden" name="bookingId" value={b.id} />
                      <button type="submit" className={buttonClass()}>
                        Send {money(amount)} via Stripe
                      </button>
                    </form>
                  )}
                  <form action={adminMarkPayoutPaid} className="flex items-end gap-2">
                    <input type="hidden" name="bookingId" value={b.id} />
                    <label className="text-xs text-slate-600">
                      Paid outside Stripe
                      <input
                        name="note"
                        placeholder="e-Transfer ref / note"
                        className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className={buttonClass("secondary")}
                    >
                      Mark paid
                    </button>
                  </form>
                </div>
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recently paid</h2>
        {paid.length === 0 ? (
          <EmptyState>No payouts sent yet.</EmptyState>
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100 text-sm">
              {paid.map((b) => (
                <li key={b.id} className="flex flex-wrap gap-2 py-2">
                  <span className="font-mono">
                    {bookingRef(b.bookingNumber)}
                  </span>
                  <span>{b.sitter.name}</span>
                  <span className="text-slate-500">
                    {b.payoutMethod === "STRIPE"
                      ? `Stripe transfer ${b.payoutTransferId ?? ""}`
                      : `Recorded by ${b.payoutRecordedBy?.name ?? "an admin"}${
                          b.payoutNote ? ` — ${b.payoutNote}` : ""
                        }`}
                  </span>
                  <span className="ml-auto">
                    {money(b.payoutAmount ?? 0)} ·{" "}
                    {b.payoutPaidAt ? dt(b.payoutPaidAt) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
