import type { Booking, SitterProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { sitterPayout } from "@/lib/pricing";

// What Ri'aya owes the sitter for a booking: the parent's total minus Ri'aya's
// fee. Stored on the booking at completion so a later settings change can't
// alter money already owed.
export function payoutAmount(
  booking: Pick<Booking, "totalAmount" | "platformFeeAmount">,
): number {
  return sitterPayout(booking);
}

function requirementsSummary(account: {
  requirements?: { currently_due?: string[] | null } | null;
}): string | null {
  const due = account.requirements?.currently_due ?? [];
  return due.length ? due.slice(0, 6).join(", ") : null;
}

// Pull the connected account's real state from Stripe. Payout capability is
// Stripe's call (identity, bank details), so we mirror it rather than assume a
// finished onboarding redirect means the sitter can be paid.
export async function syncConnectAccount(
  sitterProfileId: string,
  accountId: string,
): Promise<{ payoutsEnabled: boolean }> {
  if (!stripeEnabled || !stripe || accountId.startsWith("mock_acct_")) {
    return { payoutsEnabled: false };
  }
  const account = await stripe.accounts.retrieve(accountId);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  await prisma.sitterProfile.update({
    where: { id: sitterProfileId },
    data: {
      stripePayoutsEnabled: payoutsEnabled,
      stripeDetailsSubmitted: Boolean(account.details_submitted),
      stripeRequirementsDue: requirementsSummary(account),
      stripeStatusCheckedAt: new Date(),
    },
  });
  return { payoutsEnabled };
}

export type PayoutAttempt = {
  status: "PAID" | "BLOCKED" | "FAILED";
  transferId: string | null;
  error: string | null;
};

// Move the sitter's share out of Ri'aya's Stripe balance. Never throws: a
// booking is finished work whether or not the money can move yet, so a failure
// leaves the booking payable from /admin/payouts instead of blocking completion.
export async function transferToSitter(
  booking: Pick<Booking, "id" | "totalAmount" | "platformFeeAmount">,
  profile: Pick<
    SitterProfile,
    "stripeAccountId" | "stripePayoutsEnabled"
  > | null,
): Promise<PayoutAttempt> {
  const amount = payoutAmount(booking);
  if (!stripeEnabled || !stripe) {
    return {
      status: "BLOCKED",
      transferId: null,
      error: "Stripe is not configured — settle this payout by hand.",
    };
  }
  if (
    !profile?.stripeAccountId ||
    profile.stripeAccountId.startsWith("mock_acct_")
  ) {
    return {
      status: "BLOCKED",
      transferId: null,
      error: "The sitter has not connected a Stripe payout account.",
    };
  }
  if (!profile.stripePayoutsEnabled) {
    return {
      status: "BLOCKED",
      transferId: null,
      error: "Stripe has not enabled payouts on the sitter's account yet.",
    };
  }
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: amount * 100,
        currency: "cad",
        destination: profile.stripeAccountId,
        metadata: { bookingId: booking.id },
      },
      // Retrying a payout must never send the money twice.
      { idempotencyKey: `payout_${booking.id}` },
    );
    return { status: "PAID", transferId: transfer.id, error: null };
  } catch (e) {
    return {
      status: "FAILED",
      transferId: null,
      error: e instanceof Error ? e.message : "Stripe transfer failed.",
    };
  }
}

// Record the outcome of an attempt on the booking.
export async function recordPayoutAttempt(
  bookingId: string,
  amount: number,
  attempt: PayoutAttempt,
): Promise<void> {
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      payoutAmount: amount,
      payoutStatus: attempt.status,
      payoutMethod: attempt.status === "PAID" ? "STRIPE" : null,
      payoutTransferId: attempt.transferId,
      payoutError: attempt.error,
      payoutPaidAt: attempt.status === "PAID" ? new Date() : null,
    },
  });
}
