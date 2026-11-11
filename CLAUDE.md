# CLAUDE.md

Ri'aya Babysitters (riaya.ca): an agency-vetted babysitter booking platform.
Parents book specific sitters' published hours; every sitter is vetted and
listed by hand. Read `README.md` for the product and `docs/` for each area
before changing it.

Naming: the brand is **Ri'aya**. "Sitbaby" (Docker, seed emails, the host
path) and "circlecare" (`package.json`) are older names for the same app.
Don't rename them without a reason; keep user-facing copy as Ri'aya.

## Stack and commands

Next.js 14 App Router · React 18 · TypeScript · Tailwind · Prisma 6 + Postgres
(Supabase in production) · NextAuth credentials · Stripe · Twilio · Resend · Zod.

```bash
npm ci                 # also runs prisma generate
npm run typecheck      # tsc --noEmit
npm run lint
npm run build
npx prisma migrate deploy && npm run db:seed   # needs DATABASE_URL / DIRECT_URL
npm run dev
```

There is no test suite. Before pushing, run typecheck, lint and build (CI runs
the same on every PR). For anything touching the database or a route, run it
against a local Postgres with the seed data and exercise it. Seed logins all
use `password123`: `admin@sitbaby.test`, `parent@sitbaby.test`,
`sitter.listed@sitbaby.test`, `sitter.unlisted@sitbaby.test`,
`sitter.applicant@sitbaby.test`.

Without provider keys everything runs in stub mode: payments are mocked,
emails and texts are logged to the server console as `[email:stub]` lines.

## Layout

- `src/app/` – pages and API routes, split by role: `admin/`, `parent/`,
  `sitter/`, public pages, and `api/` (Stripe and Twilio webhooks,
  `api/maintenance/*` cron jobs, `api/health/*`).
- `src/lib/` – all business logic. Server actions live in `*actions.ts`
  files; client components call them through `runAction()` so a redirect or
  stale deploy shows an error instead of crashing.
- `src/components/ui.tsx` – shared Card, PageTitle, Badge, ButtonLink,
  EmptyState. Reuse these rather than new styling.
- `prisma/schema.prisma`, `prisma/migrations/` – migrations are hand-named
  `YYYYMMDDHHMMSS_snake_case`. Always add a migration with a schema change;
  `migrate deploy` runs on every container start.
- `prisma/rls.sql` – re-applied on every boot; enables RLS on every table.
  New tables are covered automatically.

## Rules that must not break

- **Two-gate sitters.** Vetted (`SitterApplication.status = VETTED`) and
  Listed (`SitterProfile.isListed`) are independent. Only listed,
  non-suspended sitters and their slots are ever shown to parents.
- **Rates stay separate.** `SitterApplication.targetPayRate` is what the
  sitter asked for and is never overwritten; `SitterProfile.listedPayRate` is
  the Admin-set rate parents see.
- **Pricing snapshots.** A booking stores its own pricing; changing
  `/admin/settings` must never alter existing bookings.
- **Versioned waiver/terms.** Editing publishes a new version; past
  acceptances keep pointing at the version that was accepted.
- **Sensitive data.** Police / vulnerable-sector checks and child medical
  notes are encrypted at rest (`SCREENING_ENCRYPTION_KEY`,
  `MEDICAL_ENCRYPTION_KEY`), stored privately, and screening views are
  audit-logged. Parents only ever see "vulnerable sector check verified".
  Never log, email, return from a job, or put in a GitHub issue any of: these
  documents, medical notes, addresses, phone numbers or emails of other users.
- **Notifications never throw.** Alerts and messages are best-effort and must
  not roll back the user action that triggered them.
- **Consent.** Broadcast email/SMS respects consent and STOP replies;
  commercial email needs `BUSINESS_IDENTITY` in the footer (CASL).
- **Times** are Toronto local (`TZ=America/Toronto` in the image); the
  production host clock is UTC for cron.

## Scheduled jobs

The production host's crontab calls `/api/maintenance/*` with
`x-maintenance-token`. Every route goes through `runMaintenanceJob()` in
`src/lib/automations.ts`, which records a `JobRun`. A new job needs an entry
in `AUTOMATIONS`, a crontab line on the host, and a row in
`docs/automations.md`. Health: `/admin/automations` and
`GET /api/health/automations`.

## Production

- riaya.ca runs as a Docker container (this repo's `Dockerfile`) on an Oracle
  Cloud host, against Supabase Postgres. Env file on the host:
  `/home/ubuntu/sitbaby/.env.prod`; app on `127.0.0.1:3003`.
- Deploys are manual on the host; there is no deploy automation in this repo.
  Nothing merged to `main` is live until someone rebuilds the container there.
- Errors: `/admin/errors` (Admins are emailed); user "Report a problem"
  files a GitHub issue labelled `user-report`.

## Working conventions

- One feature per branch and PR. PR and commit titles are plain-English
  sentences describing the user-visible change ("Email registered parents
  every other week with ...").
- Keep comments explaining *why* (the existing code does this well); update
  the relevant `docs/*.md` when behaviour changes.
- New env vars go in `.env.example` with a comment.
