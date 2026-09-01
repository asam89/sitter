import Stripe from "stripe";

// Stripe is optional in local/dev: when no key is configured the app runs in a
// "mock" payment mode so core flows work without live Stripe calls (test-mode
// only per spec). Provide STRIPE_SECRET_KEY to enable real Stripe Connect.
const key = process.env.STRIPE_SECRET_KEY;

export const stripeEnabled = Boolean(key);

// The browser needs the publishable key to send card details straight to
// Stripe. Card entry is only offered when both halves of the pair are present.
export const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;

export const cardPaymentsEnabled = stripeEnabled && Boolean(stripePublishableKey);

export const stripe = key
  ? new Stripe(key, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion })
  : null;
