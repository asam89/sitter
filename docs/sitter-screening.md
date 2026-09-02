# Sitter background checks (police / vulnerable sector)

A police vulnerable sector check (VSC) is one of the most sensitive documents
Ri'aya will ever hold: it is about a named person, it can reveal charges and
outcomes, and the sitters handing them over are often young. This is how the
platform holds them.

## What is stored

`SitterScreening`, one row per document, per sitter:

| Field | Why |
| --- | --- |
| `checkType` | vulnerable sector, police record, CPR, first aid, reference, other |
| `issuer` | the police service or body that issued it |
| `issuedOn`, `renewBy` | drives the "current vs. expired" question and renewal nudges |
| `status` | `PENDING` → `VERIFIED` / `REJECTED` |
| `adminNotes` | internal only; never shown to the sitter or a family |
| `uploadedByUserId`, `verifiedByAdminId`, `verifiedAt` | who vouched for it, and when |
| `storagePath`, `originalMime`, `fileBytes` | the encrypted blob; `null` once destroyed |

`ScreeningAccessLog` records **every** time an Admin opens a document, with the
Admin's id and the timestamp. It is written before the file is decrypted, so an
opened document cannot go unlogged.

## Encryption at rest

Documents are encrypted with AES-256-GCM *before* they reach storage
(`src/lib/screening.ts`), and stored as `iv | authTag | ciphertext` under the
private storage directory — outside `public/`, so nothing is web-served and no
URL exists that returns a document. Decryption happens only inside
`/admin/screening/doc/[id]`, which requires an ADMIN session, responds
`Cache-Control: no-store`, and 404s (never 403) for anyone else so the route
doesn't confirm that a document exists.

The key is `SCREENING_ENCRYPTION_KEY` (32 bytes, hex or base64). It falls back
to `MEDICAL_ENCRYPTION_KEY` and then to a key derived from `NEXTAUTH_SECRET`
for development — in production set it explicitly, or rotating
`NEXTAUTH_SECRET` makes existing documents unreadable. A database dump on its
own is useless without it.

The private storage directory is `KYC_PRIVATE_DIR`, which defaults to
`.private/` inside the working directory. In a container that is ephemeral, so
point it at a persistent volume (riaya.ca uses `/data/private` on the `uploads`
volume) or every stored check is lost on the next rebuild.

## Who sees what

- **Admins** — everything, including the document, and every view is logged.
- **The sitter** — their own list with status and dates, but not the file back.
- **Families** — only "Police vulnerable sector check verified by Ri'aya" on a
  sitter's card. Never the document, the police service, the dates, or notes.

## Current vs. expired

A check counts as current when it is `VERIFIED` **and** `renewBy` is in the
future. A verified check with no `renewBy` never auto-expires — record a
renewal date if you want it chased. An expired check stops counting
immediately, so the family-facing badge disappears on its own rather than
outliving the document.

## Renewal chasing

`POST /api/maintenance/screening-expiry` (header `x-maintenance-token`, guarded
by `MAINTENANCE_TOKEN`, disabled entirely if unset) emails every sitter whose
verified check expires within 60 days or already has, and sends Admin one
digest. Run it **once a day** — each run emails every affected sitter.

## Retention

Documents are retained indefinitely, by decision. That is the strongest audit
position and the largest liability: a breach or a subpoena reaches every sitter
ever screened, and privacy law generally expects retention only as long as the
purpose lasts.

The escape hatch is per-document and Admin-only: "Destroy the stored file"
deletes the encrypted blob and sets `deletedAt`, while keeping the row — what
was checked, by whom, when, and its access history. So Ri'aya can stop holding
the file (or honour a deletion request) without losing the evidence that the
screening happened. Switching to a purge window later is a scheduled job over
`deletedAt`/`verifiedAt`; no history is lost either way.

## Deliberately not done

- Sitters cannot delete their own documents — that would let someone remove a
  rejected check and re-upload elsewhere.
- Listing is not blocked on a current VSC. `/admin/screening` and the Admin
  dashboard flag a listed sitter with no current check instead, because a hard
  block would silently unlist working sitters the day a check lapses. Making it
  a hard gate is a one-line change in the listing action if that's preferred.
