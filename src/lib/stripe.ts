import Stripe from "stripe";

// Stripe is optional in local/dev: when no key is configured the app runs in a
// "mock" payment mode so core flows work without live Stripe calls (test-mode
// only per spec). Provide STRIPE_SECRET_KEY to enable real Stripe Connect.
const key = process.env.STRIPE_SECRET_KEY;

export const stripeEnabled = Boolean(key);

export const stripe = key
  ? new Stripe(key, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion })
  : null;
