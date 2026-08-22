# Booking policies: pricing, medical info, waiver, cancellation

Operational notes for the policy layer added on top of the booking lifecycle.
Every number below is Admin-editable at `/admin/settings`; nothing is baked
into code, and each booking snapshots the numbers in force when it was created
so later settings changes never alter an existing booking's price or refund.

## Pricing

Parent total = sitter's rate x hours + extras + Ri'aya's fee.

| Component | Source |
| --- | --- |
| Sitter's rate | Sitter sets it on their dashboard (`SitterProfile.baseRate`); the Admin-set `listedPayRate` is the fallback |
| Extra child | `extraChildFeeAmount` per child beyond the first |
| Late night | `lateNightFeeAmount` when the session touches `lateNightStartHour`–`lateNightEndHour` (default 22:00–06:00) |
| Overnight | `overnightFeeAmount` when it touches `overnightStartHour`–`overnightEndHour` |
| Rush | `rushFee` when booked inside `lastMinuteThresholdHours` |
| Ri'aya's fee | `platformFee`, percent or flat, **added on top** so the sitter keeps their full rate |

Late-night and overnight can both apply to the same session. Minimum booking
length is `minBookingHours` (default 2), enforced on direct bookings, open
requests and the forms for both.

Sitter payout = total − Ri'aya's fee, so every surcharge flows to the sitter.

## Confirmation

Unchanged: sitter accepts → booking `APPROVED` → parent pays → `paidAt` set.
"Confirmed" means paid; an unpaid `APPROVED` booking is not confirmed.

## Per-child medical information

Optional at booking time: allergies, conditions, medications, special needs.
This is health data about minors, so:

- encrypted at rest with AES-256-GCM (`MEDICAL_ENCRYPTION_KEY`);
- readable only by the parent who entered it and the assigned sitter, and only
  once the booking is paid — never before assignment, never by Admin, never on
  a public page, in a URL, on the request board, or in any marketing tool;
- deleted 60 days after the session by `POST /api/maintenance/purge-medical`
  (run it daily; it needs `MAINTENANCE_TOKEN`);
- shown with a collection notice at the point of entry.

**The retention window and the notice wording still need privacy/legal review
before real families use this.**

## Waiver and terms

Each booking stores the waiver version, acceptance timestamp, IP and
user-agent. The current waiver text is labelled `[PENDING LEGAL REVIEW]`: a
blanket "no responsibility" clause in childcare is commonly unenforceable, and
nothing here has been reviewed by a lawyer. Get counsel and consider liability
insurance before launch.

## Cancellation and refunds

Defaults, all editable:

| Who / when | Refund |
| --- | --- |
| Parent, `refundFullBeforeHours` (24h) or more before | 100% |
| Parent, between `lateCancelWindowHours` (2h) and 24h | `midRefundPercent` (100%) |
| Parent, less than 2h before | `lateRefundPercent` (50%) |
| Parent, at/after the start time or no-show | `afterStartRefundPercent` (0%) |
| Sitter or Ri'aya cancels | `sitterCancelRefundPercent` (100%), fee included |

Refunds include Ri'aya's fee. The policy is shown before payment, on the
booking page and again in the cancel form. Each cancellation records the tier,
percent, amount, who cancelled, their reason, and the processor's refund id and
status (`mock` when there was no real charge). With Stripe configured the
refund is issued against the original payment intent.

## Optional intro call

A parent can propose a short call before the session (default suggestion ~24h
ahead); the sitter accepts or declines. It is deliberately non-blocking — the
booking stands regardless of the interview status.

## Admin parent broadcast

`/admin/broadcast` emails only parents with express newsletter consent on file
(CASL), suppresses everyone else, and appends the sender identity
(`BUSINESS_IDENTITY`) and a working unsubscribe link. Each send is logged with
delivered, failed and suppressed counts. Transactional email still reaches
parents who have unsubscribed.
