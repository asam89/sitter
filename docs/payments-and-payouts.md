# Payments and sitter payouts

How money moves through Ri'aya: what the parent is charged, where it sits, when
it reaches the business chequing account, and how the sitter gets their share.

## Do we need a second Stripe account?

No. **One** Stripe account for Ri'aya, with **Connect** enabled.

- Ri'aya's account is the *platform*. Every parent charge is made by it, and the
  money lands in Ri'aya's Stripe balance.
- Each sitter gets their own **Express connected account** inside that same
  platform. The sitter onboards themselves (legal name, DOB, address, bank
  details, ID if Stripe asks) — Ri'aya never sees or holds those details.
- Sitter payouts are **transfers** out of Ri'aya's balance into the sitter's
  connected account; Stripe then pays that sitter's own bank on its schedule.

## The money flow

```
parent enters card (Stripe Elements, in Stripe's iframe)
  → Stripe charges the card
  → funds appear in Ri'aya's Stripe balance ("pending", then "available")
  → Stripe pays Ri'aya's balance out to the business chequing account
    on Stripe's payout schedule (Canada: typically 2–7 days for the first
    payout, then rolling daily/weekly per your Stripe settings)

booking completed
  → Ri'aya transfers (total − Ri'aya's fee) to the sitter's connected account
  → Stripe pays the sitter's own bank
```

Important consequence: an available balance can be lower than what is owed to
sitters if Stripe has already paid the whole balance to the chequing account.
`/admin/payouts` shows both numbers side by side (owed vs. Stripe balance) so
that gap is visible before a transfer fails.

## What the parent experiences

1. Parent books → the slot is reserved at that moment, before any payment.
2. The sitter accepts → booking is `APPROVED`.
3. The parent opens the booking, accepts the waiver, confirms the service
   address, then presses **Pay by card**. That call (`startCardPayment`) creates
   a Stripe PaymentIntent for the booking total in CAD and returns only its
   client secret.
4. Stripe's Payment Element appears. The card number, expiry and CVC are typed
   into **Stripe's** iframe and sent directly to Stripe.
5. Stripe confirms the payment. The browser then calls `finalizeCardPayment`,
   which re-reads the intent from Stripe and marks the booking paid **only** if
   Stripe reports `succeeded` and the intent's metadata names that booking.
6. If the parent closes the tab mid-way, the `payment_intent.succeeded` webhook
   marks it paid instead. Both paths are idempotent.

e-Transfer is unchanged: it records an intention only, and an Admin marks the
booking paid when the money arrives.

## What we store

Stored: the Stripe PaymentIntent id, the paid timestamp, the payment method, the
sitter's connected-account id, and payout state.

**Never** stored: card number, expiry, CVC, cardholder name, bank details. There
is no card field in our database and no card data in our logs — Stripe's Element
means those bytes never touch our server.

## Sitter payout lifecycle

On completion, the booking records what is owed and the result of the automatic
attempt:

| `payoutStatus` | Meaning |
| --- | --- |
| `OWED` | Completed, nothing sent yet |
| `BLOCKED` | Can't be sent automatically — sitter hasn't finished Stripe onboarding, or Stripe isn't configured |
| `FAILED` | Stripe rejected the transfer (see `payoutError`; usually insufficient balance) |
| `PAID` | Money left Ri'aya — by Stripe transfer (`payoutTransferId`) or recorded by hand |

The sitter's share is `totalAmount − platformFeeAmount` (see `sitterPayout()`),
frozen onto the booking as `payoutAmount` at completion so a later fee change
can't rewrite what was owed.

Completion never fails because of Stripe. If the transfer can't happen the
booking still completes and shows up as outstanding on `/admin/payouts`.

Retries are safe: transfers use the idempotency key `payout_<bookingId>`, so
pressing "Send via Stripe" twice cannot pay a sitter twice.

## Admin: /admin/payouts

- **Owed to sitters** — everything completed and unpaid, oldest first.
- **Stripe balance available / still settling** — read live from Stripe.
- Per booking: amount, sitter, session date, booking reference, why it's blocked,
  and the last Stripe error.
- **Send via Stripe** — only offered when that sitter's connected account has
  payouts enabled.
- **Mark paid** with an optional reference — for cash or e-Transfer. Records
  which Admin did it and when.
- **Recently paid** — the last 50, with the Stripe transfer id or the Admin and
  note for manual ones.

## Sitters who haven't onboarded

A sitter can be listed and booked without a Stripe account; they just can't be
paid automatically. Their dashboard shows "Connect payouts", then what Stripe
still wants, and a "Check status" button that re-reads Stripe (onboarding often
completes asynchronously, so returning from the Stripe flow is not proof). The
`account.updated` webhook keeps the same fields fresh.

## Configuration

Server-side only:

- `STRIPE_SECRET_KEY` — enables real charges and transfers. Absent ⇒ mock mode:
  card "payment" stamps the booking paid with no processor involved. Fine for
  dev, never for production.
- `STRIPE_WEBHOOK_SECRET` — required for `/api/stripe/webhook`; unsigned or
  badly-signed requests are rejected.

Browser:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — card entry is only offered when this
  and the secret key are both present.

Webhook endpoint to register in Stripe (Developers → Webhooks):

```
https://riaya.ca/api/stripe/webhook
events: payment_intent.succeeded, account.updated
```

Also required in Stripe: Connect enabled, Express accounts, and a bank account
on the platform for Ri'aya's own payouts.

## Test mode first

Use `sk_test_…` / `pk_test_…` keys and card `4242 4242 4242 4242` (any future
expiry, any CVC) to run book → accept → pay → complete → payout end to end.
Express onboarding in test mode accepts Stripe's test values, so a test sitter
can be made payout-enabled without real bank details. Only swap in live keys
once that whole path is green.
