import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { markCardPaid } from "@/lib/payments";
import { syncConnectAccount } from "@/lib/payouts";

export const dynamic = "force-dynamic";

// Stripe's own account of what happened, so the truth doesn't depend on the
// parent's browser staying open: a card that succeeds after the tab closes
// still confirms the booking, and a sitter finishing onboarding flips their
// payout capability without anyone pressing refresh.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeEnabled || !stripe || !secret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Unsigned" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      secret,
    );
  } catch {
    // An unverified body is not ours to act on.
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const bookingId = intent.metadata?.bookingId;
      if (bookingId) await markCardPaid(bookingId, intent.id);
      break;
    }
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const profile = await prisma.sitterProfile.findFirst({
        where: { stripeAccountId: account.id },
        select: { id: true },
      });
      if (profile) await syncConnectAccount(profile.id, account.id);
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
