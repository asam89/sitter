# Booking Lifecycle — implementation notes

The end-to-end booking loop for Ri'aya Babysitters:

```
Sitter posts availability
  → Parent books an open slot          (REQUESTED, slot held)
  → Sitter notified (email + optional SMS/WhatsApp)
  → Sitter approves or declines        (APPROVED / DECLINED)
  → Parent pays into escrow            (still APPROVED, paidAt set)
  → Job occurs                         (IN_PROGRESS)
  → Completed & closed                 (COMPLETED, payout released, reviews unlock)
```

## Booking states

`REQUESTED → APPROVED (or DECLINED) → IN_PROGRESS → COMPLETED (or CANCELLED)`

| State | Meaning | Slot | Payment |
|-------|---------|------|---------|
| `REQUESTED` | Parent booked; awaiting sitter approval | `BOOKED` (held) | not charged |
| `APPROVED` | Sitter accepted at the Admin-set rate; full address released | `BOOKED` | parent pays into escrow |
| `DECLINED` | Sitter declined | back to `OPEN` | — |
| `IN_PROGRESS` | Job underway (approved + paid) | `BOOKED` | held |
| `COMPLETED` | Confirmed done; payout released; reviews unlock | `BOOKED` | released to sitter |
| `CANCELLED` | Cancelled before completion | back to `OPEN` | refund/charge per policy |

Legacy `CONFIRMED` bookings from the pre-lifecycle model are migrated to
`APPROVED` (with `approvedAt`/`addressReleasedAt` backfilled) in
`prisma/migrations/20260805120000_booking_lifecycle`.

## Rate ownership (unchanged — Admin only)

Sitters never enter, propose, or edit a rate anywhere. The figure shown to the
sitter on approval is read-only and comes from the Admin-set
`SitterProfile.listedPayRate` snapshotted onto the booking
(`listedRateSnapshot`, `baseAmount`, `rushFeeAmount`, `platformFeeAmount`,
`totalAmount`) at booking time. `SitterApplication.targetPayRate` remains
Admin-only reference data and is never surfaced to parents or used as a price.

## Notifications

- **Provider:** none configured — all channels run as **dev stubs** that log to
  the server console (`[email:stub]`, `[sms:stub]`, `[whatsapp:stub]`). Real
  providers drop in behind the existing `EmailProvider` / `SmsProvider` /
  `WhatsappProvider` interfaces in `src/lib/notifications.ts` via env vars
  (`EMAIL_PROVIDER`, `SMS_PROVIDER`, `WHATSAPP_PROVIDER`) — e.g. Twilio for
  SMS + WhatsApp. No secret is ever written to a Notification row or log.
- **Enabled channels:** Email is the baseline and always sent. SMS and WhatsApp
  are independent per-business toggles in Admin → Business rules
  (`notifySmsEnabled`, `notifyWhatsappEnabled`), **default off**.
- **Dispatch:** `src/lib/booking-notifications.ts` fans one event out to the
  recipient across every enabled channel and records a `Notification` audit row
  (`bookingId`, `recipientUserId`, `channel`, `status` = SENT/STUBBED/FAILED,
  `sentAt`) per attempt. Delivery/audit errors are swallowed so a notification
  failure can never break a booking state change.
- **Privacy:** notification bodies include the **city only** until approval.
  The full service address is released on approval and only ever through the
  authenticated booking page — never in a notification or a URL.

Events sent: `REQUESTED` (→ sitter), `APPROVED` (→ both), `DECLINED` (→ parent),
`COMPLETED` (→ both), `CANCELLED` (→ both).

## Completion confirmer (configurable)

`BusinessSettings.completionConfirmedBy` — **default `PARENT`**. With `PARENT`
the parent or an Admin can confirm completion; with `ADMIN` only an Admin can.
Completion releases the Stripe Connect transfer to the sitter's connected
account (mock/no-op when Stripe is not configured) and unlocks two-way reviews.

## Cancellation policy (configurable)

- `BusinessSettings.cancellationWindowHours` — **default 24**.
- `BusinessSettings.cancellationChargePercent` — **default 0** (no penalty).

A **paid** booking cancelled within the window incurs
`round(baseAmount * cancellationChargePercent / 100)`, stored on
`Booking.cancellationChargeAmount`. With the 0% default the mechanism is present
but never charges. Actual money movement (partial capture / refund) is a follow-up
once the business confirms a penalty policy.

## Reviews

Two-way `Review` model (`rating` 1–5 + optional comment), one per author per
booking, created only once the booking is `COMPLETED`.

## Availability

Listed sitters self-manage slots (add / edit / remove — edit & remove limited to
`OPEN` slots) from `/sitter/availability`. `AvailabilitySlot.isLastMinuteEligible`
lets a sitter opt a slot in for short-notice work; a booking inside
`lastMinuteThresholdHours` still flags last-minute and adds the rush fee. The
Admin `isListed` gate still governs whether a sitter's open slots are visible to
parents — this lifecycle does not change vetting/listing.

## Data model additions (all additive)

- `AvailabilitySlot.isLastMinuteEligible`
- `Booking`: `status` (new enum), `approvedAt`, `declinedAt`, `addressReleasedAt`,
  `startedAt`, `cancelledAt`, `cancellationChargeAmount`
- `Notification` model + `NotificationChannel` / `NotificationStatus` enums
- `Review` model
- `BusinessSettings`: `completionConfirmedBy` (+ `CompletionConfirmer` enum),
  `notifySmsEnabled`, `notifyWhatsappEnabled`, `cancellationWindowHours`,
  `cancellationChargePercent`

## Unresolved business decisions

1. Which notification provider (Twilio recommended for SMS+WhatsApp) and which
   channels to enable at launch — currently all stubbed, SMS/WhatsApp off.
2. Whether to require ADMIN completion confirmation (default is PARENT).
3. The cancellation penalty policy (window + percent) — mechanism ships at
   24h / 0%; and whether a late-cancel charge should trigger a Stripe partial
   capture vs. be advisory only.
