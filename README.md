# Ri'aya Babysitters

**Agency-vetted babysitters, booked in seconds.** Live at
[riaya.ca](https://riaya.ca) (also www.riaya.ca), deployed on an Oracle Cloud
host against a Supabase PostgreSQL database.

Ri'aya is a scheduling and booking platform for childcare. Unlike an open
marketplace, **every sitter is manually vetted and hand-listed by the Ri'aya
team** — the trust layer is the agency, not anonymous reviews or peer
endorsements. Parents log in, see real availability from currently-listed
sitters, and book a specific time slot directly, with transparent pricing and a
liability waiver on every booking.

## What the platform does today

### For parents
- Register, verify email and phone (real SMS codes), accept the versioned
  liability waiver.
- ID/KYC capture with an admin-controlled gate on booking.
- Browse listed sitters, see profiles, photos and bios.
- Book a specific sitter's published availability, or post an open request that
  listed sitters can claim.
- Mandatory service address, number of children, medical/allergy notes.
- Transparent itemised pricing: sitter rate × hours, rush fee for last-minute,
  extra-child, late-night and overnight surcharges, platform fee.
- Pay by credit card (Stripe) or e-Transfer to info@riaya.ca.
- Booking reminders before the sitter arrives; sitter contact details released
  once the booking is accepted.
- Public policies page: waiver text, pricing rules, refunds, minimums.
- Incident reporting after a booking.

### For sitters
- Public application with references, experience, target rate and a
  WhatsApp-reachable number.
- Agency vetting workflow: application → interview booking → admin review →
  approval.
- Two-stage gate, so being vetted and being publicly bookable are separate
  decisions.
- Police and vulnerable-sector check upload; stored encrypted, admin-only
  access, every view logged, renewal reminders.
- Weekly availability grid, published hour by hour.
- Accept or decline booking requests; the parent's name, phone, email and full
  service address are visible so they can coordinate and chase the waiver.
- Stripe Express onboarding to receive payouts directly to their own bank
  account.

### For admins
- Full application review queue with interview scheduling and
  approval/decline.
- Activate a sitter account that never went through applications (e.g. someone
  recruited directly).
- Create parent and sitter accounts directly, with an emailed set-password
  link.
- Manual booking entry on a parent's behalf, with overlap warnings and an
  explicit override.
- Bookings calendar, per-booking pricing snapshot, mark-as-paid for offline
  payments.
- Admin-set rates and platform fees; nobody bids, we price.
- Editable, versioned waiver and terms: editing publishes a new version and
  preserves who accepted which version.
- Screening dashboard: check type, issuing police service, issue and renew-by
  dates, verifier and timestamp.
- Payouts dashboard: what's owed per completed booking, what's been
  transferred, and which sitters can't be paid because onboarding is
  incomplete.
- Email and SMS broadcast with consent tracking, an automatic "Reply STOP to
  opt out", and campaign history.
- Newsletter sign-up with double opt-in.
- Error dashboard: admins are emailed the moment a page or action breaks, and
  any user can file a "Report a problem" that opens a GitHub issue.

## Money flow

The parent's card is charged through Stripe — card details go straight from the
browser to Stripe, so nothing sensitive is ever stored in this database. Funds
land in Ri'aya's Stripe balance and pay out weekly to the Ri'aya chequing
account. The sitter's share is transferred to their own Stripe Express account
after the booking is completed; the platform fee stays with Ri'aya. Stripe is
live in production: real charges, webhook confirmation and Connect onboarding
are all verified. See
[`docs/payments-and-payouts.md`](docs/payments-and-payouts.md).

## Communications

- Transactional email (welcome, application status, booking notifications,
  reminders, password resets) with reply-to info@riaya.ca and support@riaya.ca
  in the footer.
- Real SMS via Twilio from +1 269 415 8195: phone verification codes and
  consented broadcasts. Inbound replies are forwarded to the admin inbox and
  info@riaya.ca; STOP replies suppress that number automatically.
- WhatsApp is built but **not yet operational** — it needs a Twilio sender
  approved by Meta.

## Trust and safety

- Sitters are manually vetted; encrypted police and vulnerable-sector checks
  are held with an audit trail of every admin view, and families only ever see
  "vulnerable sector check verified".
- Parents are verified too — email, phone, ID tier and a required service
  address — because sitters are entering strangers' homes.
- Versioned waiver acceptance is recorded per booking.
- Database locked down: row-level security enabled on every table and public
  API-role access revoked.
- Screening documents live on encrypted private storage, never web-served,
  never visible to parents. See
  [`docs/sitter-screening.md`](docs/sitter-screening.md).

## Known gaps

- WhatsApp is pending Meta approval.
- The Twilio number is a Michigan one; a 416 number costs about US$1.15/month.
- No real card payment has run through the live parent flow yet — the first
  genuine booking will be the proof.
- Sitters must each complete Stripe onboarding before they can be paid.

## How it works

### Roles
- **Parent** — browses listed availability, books a slot, accepts the waiver,
  pays, can mark a booking complete, and can file incident reports.
- **Sitter** — submits a vetting application, and once vetted **and** listed by
  Admin, publishes availability and receives bookings/payouts.
- **Admin** — manually vets applications, sets the listed rate, controls
  listing, oversees availability/bookings/reports, and configures business
  rules.

### The two-gate sitter model (core invariant)
A sitter has two **independent**, Admin-controlled states:

1. **Vetted** — Admin accepted the application (`SitterApplication.status = VETTED`);
   vetting creates the `SitterProfile`.
2. **Listed** — Admin explicitly made the sitter bookable (`SitterProfile.isListed`).

**Only listed sitters and their open slots ever appear to parents.** A sitter
can be vetted-but-unlisted. Un-listing is instant and never deletes application
history or vetted status.

### Rates are kept distinct
- `SitterApplication.targetPayRate` — the sitter's *requested* rate (never overwritten).
- `SitterProfile.listedPayRate` — the Admin-set, parent-facing rate.

### Core booking flow
```
sitter applies → Admin vets (sets listed rate) → Admin lists →
sitter adds availability → parent picks an open slot →
parent books (rush fee disclosed, waiver accepted) →
parent pays (held) → booking completed → sitter payout released
```

## Configurable business rules

Live-editable at `/admin/settings` (`BusinessSettings` singleton):

| Setting | Default | Meaning |
| --- | --- | --- |
| Last-minute threshold | **12h** | Bookings starting within this window incur a rush fee. |
| Rush fee | **25% (PERCENT)** | Percent of base, or a flat CAD amount. |
| Platform fee | **15% (PERCENT)** | Percent of base, or a flat CAD amount. |

Each booking stores a **pricing snapshot** so later settings changes never alter
existing bookings. The waiver and terms are versioned and editable at
`/admin/terms`; publishing an edit creates a new version and leaves prior
acceptances intact.

## Tech stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Prisma 6 +
PostgreSQL · NextAuth (credentials) · Stripe (Payment Intents + Connect
Express) · Twilio · Resend · Zod.

## Quick start with Docker Compose

The fastest way to stand up a dev environment (Postgres + the app, migrated and
seeded) is Docker Compose — no local Node/Postgres required:

```bash
docker compose up --build      # app on http://localhost:3000
```

On first boot the app container applies migrations and (because `SEED_ON_START`
defaults to `true`) seeds the demo accounts below. Then:

```bash
docker compose down            # stop
docker compose down -v         # stop and wipe the database volume
```

Everything runs out-of-the-box with dev defaults; override any value via a shell
env or an `.env` file next to `docker-compose.yml` (e.g. `NEXTAUTH_SECRET`,
`APP_PORT`, `SEED_ON_START`, Stripe keys). Stripe is optional — unset keys run in
mock payment mode.

## Getting started (without Docker)

Requires Node.js 18+ and a PostgreSQL database.

```bash
# 1. Install dependencies (runs `prisma generate` via postinstall)
npm install

# 2. Configure environment
cp .env.example .env   # then fill in DATABASE_URL / DIRECT_URL / NEXTAUTH_SECRET

# 3. Apply migrations and seed demo data
npx prisma migrate deploy   # or `npx prisma migrate dev` in development

npm run db:seed

# 4. Run the dev server
npm run dev                 # http://localhost:3000
```

### Payments in development

Stripe is **optional locally**. If `STRIPE_SECRET_KEY` is unset, the app runs in
**mock mode**: payment and payout state transitions happen without calling
Stripe, so the full book → pay → complete → payout flow is testable without
keys. Card entry (Stripe Elements) only appears when both
`STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are set;
`STRIPE_WEBHOOK_SECRET` is required for Stripe to confirm payments and Connect
onboarding out of band.

### Seed accounts

All use password `password123`:

| Email | Role |
| --- | --- |
| `admin@sitbaby.test` | Admin |
| `parent@sitbaby.test` | Parent |
| `sitter.listed@sitbaby.test` | Vetted **and** listed (has an open slot) |
| `sitter.unlisted@sitbaby.test` | Vetted but **not** listed (hidden from parents) |
| `sitter.applicant@sitbaby.test` | Application awaiting review |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:seed` | Seed demo data |

## Documentation

- [`docs/sitbaby-agency-model-notes.md`](docs/sitbaby-agency-model-notes.md) —
  the agency model in depth and the configurable defaults.
- [`docs/payments-and-payouts.md`](docs/payments-and-payouts.md) — the money
  flow, Stripe configuration and payout mechanics.
- [`docs/sitter-screening.md`](docs/sitter-screening.md) — how police and
  vulnerable-sector checks are stored, accessed and audited.
- [`docs/booking-policies.md`](docs/booking-policies.md) — pricing rules,
  refunds and booking minimums.
