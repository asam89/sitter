import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { adminMarkPayoutPaid } from "@/lib/actions";
import { stripe, stripeEnabled } from "@/lib/stripe";
import {
  Badge,
  Card,
  EmptyState,
  PageTitle,
  buttonClass,
} from "@/components/ui";
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

// Money Ri'aya owes sitters for work already done, and what's actually been
// sent. Card money lands in Ri'aya's Stripe balance and pays out to the
// chequing account on Stripe's schedule; sitters are then paid by Interac
// e-Transfer from that account and the transfer is recorded here — so a payout
// can be owed while the card money is still in transit.
export default async function AdminPayoutsPage() {
  await requireRole("ADMIN");

  const [outstanding, paid] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "COMPLETED", payoutPaidAt: null },
      orderBy: { completedAt: "asc" },
      include: {
        sitter: { select: { name: true, email: true } },
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
        subtitle="What Ri'aya owes sitters for completed bookings, and what has already been e-Transferred."
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
                  Payable now, and paid to your chequing account on
                  Stripe&apos;s schedule.
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
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Sitters are paid by Interac e-Transfer to their account email. Send
          the transfer from the Ri&apos;aya chequing account, then record it
          here.
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Outstanding</h2>
        {outstanding.length === 0 ? (
          <EmptyState>Every completed booking has been paid out.</EmptyState>
        ) : (
          outstanding.map((b) => {
            const amount =
              b.payoutAmount ?? b.totalAmount - b.platformFeeAmount;
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
                  <span className="text-sm">
                    {b.sitter.name}{" "}
                    <span className="text-slate-500">
                      · e-Transfer to {b.sitter.email}
                    </span>
                  </span>
                  <span className="text-sm text-slate-500">
                    session {dt(b.dateTime)}
                  </span>
                  <span className="ml-auto text-lg font-semibold">
                    {money(amount)}
                  </span>
                </div>

                {b.payoutError && (
                  <p className="mt-1 text-xs text-red-700">{b.payoutError}</p>
                )}

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <form
                    action={adminMarkPayoutPaid}
                    className="flex items-end gap-2"
                  >
                    <input type="hidden" name="bookingId" value={b.id} />
                    <label className="text-xs text-slate-600">
                      e-Transfer sent
                      <input
                        name="note"
                        placeholder="Interac reference / note"
                        className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <button type="submit" className={buttonClass()}>
                      Mark paid {money(amount)}
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
