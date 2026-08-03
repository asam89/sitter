# Sitbaby — agency-vetted model notes

This document records the business-model pivot from the original CircleCare
community-marketplace MVP to **Sitbaby**, an agency-vetted scheduling platform,
plus the configurable defaults and provisional decisions that need business/legal
sign-off.

## The pivot

The original build (PR #1) was a community-trust, peer-endorsement, on-demand
**dispatch** marketplace. This spec supersedes that concept. Sitbaby is:

- **Agency-vetted, not peer-endorsed.** Sitbaby staff manually review every
  sitter application. There are no community partners, endorsements, or trust
  tiers.
- **A scheduling tool, not a browse-and-dispatch marketplace.** Parents view
  real availability from currently-listed sitters and book a specific slot.
  There is no on-demand "request now → nearest sitter responds" dispatch.

The community/endorsement/dispatch schema and pages were removed (not layered
alongside). Free post-booking messaging is retained.

## The two-gate sitter model

A sitter has **two independent** states, both Admin-controlled:

1. **Vetted** — Admin accepted the application. Stored on
   `SitterApplication.status = VETTED`; vetting creates the `SitterProfile`
   (`vettedAt` recorded).
2. **Listed** — Admin explicitly made the sitter bookable
   (`SitterProfile.isListed`). **Only listed sitters and their open slots ever
   appear to parents.** Un-listing is instant and does **not** delete or alter
   application history or vetted status.

A sitter can be vetted-but-unlisted (ready, but not shown to parents).

## Target rate vs listed rate (kept distinct)

- `SitterApplication.targetPayRate` — the sitter's **requested/proposed** hourly
  rate. Stored permanently, never overwritten.
- `SitterProfile.listedPayRate` — the **Admin-set**, parent-facing hourly rate,
  entered at vetting time.

These are intentionally separate so the business can decide margin strategy.

## Configurable business rules (defaults — need sign-off)

All live-editable at `/admin/settings` (`BusinessSettings` singleton). Defaults:

| Setting | Default | Meaning |
| --- | --- | --- |
| `lastMinuteThresholdHours` | **12** | Bookings starting within this window are "last-minute" and incur a rush fee. |
| `rushFeeType` / `rushFeeAmount` | **PERCENT / 25** | 25% of base, or a flat CAD amount if `FLAT`. |
| `platformFeeType` / `platformFeeAmount` | **PERCENT / 15** | 15% of base, or flat CAD if `FLAT`. |

Env fallbacks (`.env.example`): `LAST_MINUTE_THRESHOLD_HOURS`, `RUSH_FEE_TYPE`,
`RUSH_FEE_AMOUNT`, `PLATFORM_FEE_TYPE`, `PLATFORM_FEE_AMOUNT`.

### Pricing snapshot

Each booking stores a **pricing snapshot** (`listedRateSnapshot`, `baseAmount`,
`isLastMinute`, `rushFeeAmount`, `platformFeeAmount`, `totalAmount`) at booking
time, so later settings changes never retroactively change an existing booking.
The rush fee is always shown as its own line item before the parent confirms.

## Legal waiver / liability (PROVISIONAL — needs a lawyer)

- The parent must tick an explicit waiver checkbox before a booking can be
  created; the booking records `waiverVersion` + `waiverAcceptedAt`.
- Terms are versioned in `TermsVersion`; the active version's full text is shown
  in the booking flow.
- **The seeded terms are placeholder copy explicitly marked
  `[PENDING LEGAL REVIEW]` and MUST be replaced with lawyer-drafted language
  before launch.** The copy states Sitbaby vets/lists sitters but sitters are
  **independent contractors, not employees or agents** of Sitbaby.
- Either party can file a booking-scoped incident report, which lands in the
  Admin reports queue.

## Payments (Stripe Connect Express — test/mock)

- Sitters onboard a Stripe Connect Express account ("Connect payouts").
- Parent is charged listed rate × duration + rush fee + platform fee.
- Funds are conceptually held until the booking is marked **completed**, at which
  point the sitter payout (base + rush) is transferred and `payoutReleasedAt`
  is set.
- **Mock mode:** when `STRIPE_SECRET_KEY` is absent (local/dev), payment and
  payout transition state without calling Stripe, so the full flow is testable
  without live keys.

### Open business decision

Margin can come from (a) the target/listed spread, (b) an explicit platform fee,
or (c) both. The code supports all three; the owner must choose the intended
model. Current default charges an explicit 15% platform fee on top of the listed
rate.

## Roles & lifecycle

- `PARENT` — books, pays, marks complete, reports.
- `SITTER` — applies → (Admin vets) → sets availability → (Admin lists) →
  bookable. Self-registration only creates the account; a `SitterProfile` is
  created **on vetting**, not at signup.
- `ADMIN` — reviews applications, sets listed rate, toggles listing, oversees
  availability/bookings/reports, edits business rules. Admins are **seeded**,
  not self-registered.

## Core flow (acceptance path)

sitter applies → Admin vets (sets listed rate) → Admin lists → sitter adds
availability → parent sees listed sitter's open slot → parent books (rush fee
disclosed, waiver accepted) → parent pays (held) → completed → payout released.

## Seed accounts

`password123` for all `*@sitbaby.test`:

- `admin@sitbaby.test` — Admin
- `parent@sitbaby.test` — Parent
- `sitter.listed@sitbaby.test` — vetted **and** listed, has an open future slot
- `sitter.unlisted@sitbaby.test` — vetted but **not** listed (must stay hidden)
- `sitter.applicant@sitbaby.test` — application in `APPLIED` (awaiting review)

## Production follow-ups

- Replace placeholder waiver/terms with lawyer-drafted copy; consider re-consent
  when the version changes.
- Decide the margin model (spread vs platform fee vs both).
- Real document upload for CPR/First Aid/police checks (currently URL paste).
- Confirm the last-minute threshold, rush fee, and platform fee values.
- Stripe: production keys, webhooks for payment/transfer confirmation, refunds
  on cancellation, and payout timing/held-funds compliance.
