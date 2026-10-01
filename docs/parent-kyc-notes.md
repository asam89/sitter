# Parent KYC (identity verification) — implementation notes

Ri'aya places a (often young) sitter into a parent's home. Safety runs both
directions: parents vet sitters, but the platform must also verify that a real,
reachable, identifiable adult is behind each **parent** account. This document
records what we collect, why, and the decisions still owned by the business.

## Verification levels

Parent accounts have a `verificationLevel` derived from underlying facts (never
set by hand), so it can't drift:

| Level | Name | Requirements | Booking |
| --- | --- | --- | --- |
| `LEVEL_0_REGISTERED` | Registered | email + password | browse only |
| `LEVEL_1_CONTACT` | Contact verified | email **and** phone verified | book (if gate ≤ L1) |
| `LEVEL_2_IDENTITY` | Identity verified | L1 **and** gov-ID verified **and** service address on file | full booking |

The level is recomputed by `recomputeVerificationLevel()` after every
verification event (`src/lib/verification.ts`).

## Booking gate (configurable)

`BusinessSettings.minParentVerificationLevelToBook` (Admin → Business rules)
sets the minimum level required to create a booking. It is **not hardcoded**:
launch at `LEVEL_1_CONTACT` for low friction and tighten to `LEVEL_2_IDENTITY`
later, or require L2 from day one.

- **Default (this build): `LEVEL_1_CONTACT`.** Confirm with the business owner
  whether to launch at L1 or require L2 immediately.
- Env override for a fresh DB: `MIN_PARENT_VERIFICATION_LEVEL_TO_BOOK`.
- Enforced server-side in `createBooking` (`src/lib/actions.ts`) and again via
  redirects on the schedule/booking pages. The gate is authoritative on the
  server — the UI redirects are convenience only.

## Feature 1 — Contact verification (email + phone)

- 6-digit codes, **bcrypt-hashed** at rest (`VerificationCode`), single-use,
  10-minute TTL. The raw code is never stored.
- Delivery sits behind swappable provider interfaces
  (`src/lib/notifications.ts`): `EmailProvider`, `SmsProvider`.
- **Provider chosen: none yet — stub only.** The stub logs the code to the
  server console and (only in stub mode) returns it to the client so the flow
  is fully exercisable in dev/test. When the business confirms vendors
  (recommended: **Resend** for email, **Twilio** for SMS), add the concrete
  provider in the `switch` in `notifications.ts` and set `EMAIL_PROVIDER` /
  `SMS_PROVIDER` + keys. No call sites change.
- A verified, reachable phone is the single highest-value lightweight KYC
  signal — it ties the account to a billable, traceable line.

## Feature 2 — Identity verification (government ID)

Two approaches; **confirm which with the business owner**:

1. **(Preferred) Third-party provider** — Stripe Identity / Persona / Certn
   verifies the ID and returns pass/fail + verified name. Ri'aya stores only the
   result, never the raw image. Lowest liability. Not wired in this build (no
   keys). To adopt: implement a provider and set
   `ParentProfile.idVerificationProvider` accordingly.
2. **(MVP path used here) Manual review** — parent uploads a gov-ID; an Admin
   reviews and marks verified.

### Manual-review path as built

- Upload accepts JPEG/PNG/WebP/PDF, ≤ 8 MB.
- Stored via a swappable `PrivateStorage` interface (`src/lib/storage.ts`).
  **The document is never in a public URL.** The dev implementation
  (`LocalPrivateStorage`) writes to `.private/id-docs/` — **outside** the Next
  `public/` web root and git/docker-ignored — so it is never served or shipped.
- Admins view a pending document only through an **authenticated, Admin-only**
  route (`/admin/parents/id-doc/[id]`) that streams from private storage with
  `Cache-Control: no-store`. There is no public link.
- **Retention/deletion policy:** the raw document is **deleted immediately**
  once the review completes — on **approve** and on **reject**. On approval we
  keep only `identityVerified`, `verifiedName`, `idVerifiedAt`, and
  `idVerificationProvider = "manual"`; `storagePath` is cleared and `deletedAt`
  is set. We do not retain ID scans.

### Production storage (follow-up)

`LocalPrivateStorage` is fine for a single-box deploy but is node-local. For
production, wire `SupabasePrivateStorage` (a **private** bucket, no public URLs)
in the `getPrivateStorage()` switch and set `KYC_STORAGE=supabase` + bucket/key.
Needs a bucket name + service key from the business owner.

## Feature 3 — Service address

- `ParentProfile` gains `streetAddress`, `unit`, `city`, `province`,
  `postalCode` (legacy free-text `address`/`city` retained; additive migration).
- Address is captured during onboarding, stored **server-side only**, and never
  placed in a URL, query string, or client state.
- It is released to a sitter **only after a booking is CONFIRMED** (paid), via
  the authenticated booking view — consistent with the existing
  address-on-acceptance pattern. Before that, the sitter never sees it.

## Feature 4 — Admin visibility

- `/admin/parents`: every parent's level + per-signal badges (email/phone/ID),
  plus the **ID review queue** with view/approve/reject.
- Admins can soft-suspend a parent (`User.suspended`) — records preserved,
  consistent with existing report handling.

## Privacy & PIPEDA

- Collection is limited to what the safety purpose justifies; each step shows a
  short "Why we ask" note at collection time.
- No child legal name/photo is collected (unchanged).
- Prefer the third-party ID provider specifically to avoid holding raw ID
  images. On the manual path, images are deleted post-review.
- No personal data (address, phone, ID) appears in URLs or client-exposed state.

## Data model (additive migration `parent_kyc`)

- `User`: `emailVerified DateTime?`, `phoneVerified Boolean`,
  `verificationLevel VerificationLevel`.
- `ParentProfile`: `streetAddress`, `unit`, `postalCode`, `province`,
  `identityVerified`, `verifiedName`, `idVerificationProvider`, `idVerifiedAt`.
- `VerificationCode`: hashed single-use email/phone codes.
- `IdVerificationDocument`: `parentProfileId`, `storagePath` (private, cleared
  on deletion), `reviewStatus`, `reviewedByAdminId`, `reviewedAt`, `deletedAt`.
- `BusinessSettings`: `minParentVerificationLevelToBook VerificationLevel`
  (default `LEVEL_1_CONTACT`).

All columns are additive/nullable or defaulted; no existing data is altered.

## Decisions still owned by the business owner

1. Launch gate at **Level 1** (default) or require **Level 2** from day one?
2. ID verification: adopt a **third-party provider** (preferred) or keep
   **manual review**? If provider, which (Stripe Identity / Persona / Certn)?
3. SMS + email providers (recommended Twilio + Resend) — supply keys.
4. Production private storage bucket (Supabase private bucket name + key).
