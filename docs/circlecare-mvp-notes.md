# CircleCare MVP — build notes & deviations

Working name **CircleCare** — a community-trust, on-demand babysitter marketplace.
This document records deviations from the spec, decisions made with placeholder
defaults, and the exact values that still need business confirmation.

## Values needing business confirmation (built as configurable, not hardcoded)

| Setting | Placeholder default | Where it lives | Action needed |
| --- | --- | --- | --- |
| **Flat platform fee** | **15%** | `PlatformSetting` table + `PLATFORM_FEE_PCT` env; editable at `/admin/settings` | Confirm the real number (flat % or flat per-booking). |
| **Dispatch fallback window** | **300s (5 min)** | `PlatformSetting` + `DISPATCH_FALLBACK_WINDOW_SECONDS` env; editable at `/admin/settings` | Confirm timing. |

Both are snapshotted onto each `Booking` at request time, so changing them never
retroactively re-prices existing bookings.

## Step 0 items (business/legal — outside code)

1. **Launch community**: FaezSports is seeded as the first Community Partner
   (`prisma/seed.ts`), onboarded through the generic partner flow — no
   FaezSports-specific logic is hardcoded. Any org applies at `/partner/apply`.
2. **ToS / liability**: The app *displays and requires* the marketplace framing
   ("community endorsement is a trust signal, not a guarantee of conduct") on the
   landing page, request flow, and safety section. The actual legal copy needs a
   lawyer — only the display/consent mechanism is built.
3. **Data minimization (PIPEDA)**: Children are represented only by
   `childrenAgeRange` (string, e.g. "2-5") + `numberOfChildren`. No field
   anywhere collects a child's name or photo.

## Architecture

- **Next.js 14 App Router, TypeScript, Tailwind**. Server Actions for mutations,
  API routes for messaging (poll) and the SSE status stream.
- **Prisma + PostgreSQL** (Supabase-ready: `DATABASE_URL` pooled + `DIRECT_URL`
  for migrations). Schema in `prisma/schema.prisma`, migration in
  `prisma/migrations/`.
- **NextAuth v4**, Credentials provider, JWT sessions (no adapter tables needed).
  Roles: `PARENT | SITTER | COMMUNITY_ADMIN | PLATFORM_ADMIN`.
- **Zod** validates all external input (`src/lib/validation.ts`).

## Feature mapping to acceptance criteria

1. **Community Partner self-service** — `/partner/apply` creates a PENDING
   partner + COMMUNITY_ADMIN; platform approves at `/admin`. The community admin
   endorses/de-endorses sitters at `/community` independent of the platform.
2. **Community-endorsed-only filter** — `/sitters?communityOnly=1` and the
   `communityOnly` checkbox on the request flow.
3. **On-demand dispatch** — `startDispatch` offers to community-endorsed sitters
   first; the SSE stream (`/api/bookings/[id]/events`) triggers
   `expandDispatchIfNeeded` after the fallback window to include
   platform-verified-only sitters (never for `communityOnly` requests). First to
   accept wins via an atomic `updateMany` guard.
4. **Messaging always free** — unlocks purely on booking status `ACCEPTED+`.
   There is no tier/paywall table anywhere; it cannot be "turned on" later.
5. **Transparent pricing** — rate + fee shown as a single line item on the
   request form and booking page before payment.
6. **Report visibility** — a report against an endorsed sitter is stamped with
   `visibleToCommunityPartnerId`; that partner's admin sees it at `/community` in
   addition to the platform queue.
7. **No child PII** — see data minimization above.
8. **`npm run build` passes**; core flows work locally (see seed logins below).

## Deviations / MVP simplifications

- **Verification document upload** is a pasted URL, not a file-storage upload
  (object storage is a later phase). Manual review by Platform Admin marks the
  sitter `PLATFORM_VERIFIED`.
- **Stripe Connect** is wired in test-mode-friendly form: when `STRIPE_SECRET_KEY`
  is set, `payBooking` creates a PaymentIntent; when unset, the app runs a mock
  payment path so flows work without live Stripe. Payout release on completion is
  modeled via `payoutReleasedAt` (real Connect transfers are the next step).
- **Geolocation** uses stored lat/lng + Haversine radius filtering. Address
  geocoding is not integrated; `serviceArea`/lat-lng are stored so multi-city
  isn't hardcoded, but no multi-city UI is built (per scope).
- **Notifications** are in-app only (email/SMS out of scope for MVP).
- **SSE fallback expansion** is driven opportunistically by connected clients
  (parent's booking page) rather than a background worker/cron. A scheduled job
  is the production hardening step.

## Seed logins (`npm run db:seed`, password `password123`)

- `admin@circlecare.test` — Platform Admin
- `faez.admin@circlecare.test` — Community Admin (FaezSports)
- `parent@circlecare.test` — Parent (FaezSports member)
- `sitter.endorsed@circlecare.test` — Community-endorsed + platform-verified sitter
- `sitter.platform@circlecare.test` — Platform-verified-only sitter

## Local setup

```bash
cp .env.example .env   # fill DATABASE_URL etc.
npm install
npx prisma migrate deploy   # or: prisma migrate dev
npm run db:seed
npm run dev
```
