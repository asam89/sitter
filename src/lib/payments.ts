import { prisma } from "@/lib/prisma";
import { stripe, stripeEnabled } from "@/lib/stripe";

// A card booking becomes paid only once Stripe says the PaymentIntent
// succeeded. Both the browser (after confirming the card) and the Stripe
// webhook land here, so a parent closing the tab mid-payment still ends up
// with a confirmed booking. Idempotent: a second call is a no-op.
export async function markCardPaid(
  bookingId: string,
  paymentIntentId: string,
): Promise<{ paid: boolean; error?: string }> {
  if (!stripeEnabled || !stripe) return { paid: false, error: "No Stripe." };

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.metadata?.bookingId !== bookingId) {
    return { paid: false, error: "That payment is for a different booking." };
  }
  if (intent.status !== "succeeded") {
    return { paid: false, error: `Payment is ${intent.status}.` };
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { paid: false, error: "Booking not found." };
  if (booking.paidAt) return { paid: true };

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paidAt: new Date(),
      paymentMethod: "CARD",
      stripePaymentIntentId: intent.id,
    },
  });
  return { paid: true };
}
