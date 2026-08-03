# Sitbaby

**Agency-vetted babysitters, booked in seconds.**

Sitbaby is a scheduling and booking platform for childcare. Unlike an open
marketplace, **every sitter is manually vetted and hand-listed by the Sitbaby
team** — the trust layer is the agency, not anonymous reviews or peer
endorsements. Parents log in, see real availability from currently-listed
sitters, and book a specific time slot directly, with transparent pricing and a
liability waiver on every booking.

## Vision & business case

- **Trust is our product.** Parents are handing over their children; cold
  marketplace vetting isn't enough. Sitbaby staff review every applicant
  (experience, certifications, CPR/First Aid/police-check documents) and
  independently decide who is bookable. That curation is the core value.
- **A scheduling tool, not a browse-and-haggle marketplace.** No feeds to sift
  through and no back-and-forth to get started — parents pick an open slot from a
  vetted, listed sitter and book it.
- **Transparent, disclosed pricing.** Parents see the listed rate before
  booking. Last-minute bookings carry a clearly-itemised **rush fee**, never
  folded silently into the total.
- **Legal protection is first-class.** An explicit liability waiver (versioned,
  timestamped) is required on every booking. Sitters are independent
  contractors, not Sitbaby employees, and vetting/listing is not a guarantee of
  conduct.
- **Revenue.** A configurable platform fee and/or the spread between a sitter's
  requested rate and the Admin-set listed rate, plus rush fees on last-minute
  demand. Sitters are paid out via Stripe Connect on completion.

## How it works

### Roles
- **Parent** — browses listed availability, books a slot, accepts the waiver,
  pays, can mark a booking complete, and can file incident reports.
- **Sitter** — submits a vetting application, and once vetted **and** listed by
  Admin, publishes availability and receives bookings/payouts.
- **Admin** — manually vets applications, sets the listed rate, controls listing,
  oversees availability/bookings/reports, and configures business rules.

### The two-gate sitter model (core invariant)
A sitter has two **independent**, Admin-controlled states:

1. **Vetted** — Admin accepted the application (`SitterApplication.status = VETTED`);
   vetting creates the `SitterProfile`.
2. **Listed** — Admin explicitly made the sitter bookable (`SitterProfile.isListed`).

**Only listed sitters and their open slots ever appear to parents.** A sitter can
be vetted-but-unlisted. Un-listing is instant and never deletes application
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

Live-editable at `/admin/settings` (`BusinessSettings` singleton). Defaults —
**provisional, pending business sign-off**:

| Setting | Default | Meaning |
| --- | --- | --- |
| Last-minute threshold | **12h** | Bookings starting within this window incur a rush fee. |
| Rush fee | **25% (PERCENT)** | Percent of base, or a flat CAD amount. |
| Platform fee | **15% (PERCENT)** | Percent of base, or a flat CAD amount. |

Each booking stores a **pricing snapshot** so later settings changes never alter
existing bookings.

> **Legal note:** the seeded waiver/terms copy is a placeholder explicitly marked
> `[PENDING LEGAL REVIEW]` and **must** be replaced with lawyer-drafted language
> before launch. See [`docs/sitbaby-agency-model-notes.md`](docs/sitbaby-agency-model-notes.md).

## Tech stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Prisma 6 +
PostgreSQL · NextAuth (credentials) · Stripe Connect Express · Zod.

## Getting started

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
keys.

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
  the model in depth, configurable defaults, and the provisional decisions
  (legal copy, margin strategy) that need business/legal sign-off.
