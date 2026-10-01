"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { buttonClass } from "@/components/ui";

// Card details are entered in Stripe's own iframe and go straight to Stripe;
// this app never sees or stores a card number.
function CardForm({
  bookingId,
  amount,
  onPaid,
}: {
  bookingId: string;
  amount: string;
  onPaid: (bookingId: string) => Promise<{ error?: string }>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const confirmed = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (confirmed.error) {
      setError(confirmed.error.message ?? "Your card could not be charged.");
      setBusy(false);
      return;
    }
    // Stripe took the money; the server verifies the intent itself before the
    // booking is marked paid.
    const settled = await onPaid(bookingId);
    if (settled.error) {
      setError(settled.error);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <PaymentElement />
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={pay}
        disabled={!stripe || busy}
        className={buttonClass()}
      >
        {busy ? "Paying…" : `Pay ${amount}`}
      </button>
    </div>
  );
}

export function CardPaymentFields({
  publishableKey,
  clientSecret,
  bookingId,
  amount,
  onPaid,
}: {
  publishableKey: string;
  clientSecret: string;
  bookingId: string;
  amount: string;
  onPaid: (bookingId: string) => Promise<{ error?: string }>;
}) {
  const stripePromise = useMemo(
    () => loadStripe(publishableKey),
    [publishableKey],
  );
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CardForm bookingId={bookingId} amount={amount} onPaid={onPaid} />
    </Elements>
  );
}
