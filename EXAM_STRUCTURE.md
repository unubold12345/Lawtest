# Exam catalog and edition access

Lexlab is organized as **exam type → edition → question bank and study workspace**.
Plans purchase one edition. Categories are subjects inside a bank, not products.

## Current structure

- `/` and `/exams`: exam catalog.
- `/exams/lawyer/2026`: existing question bank and dashboard.
- Its `/browse`, `/browse/unanswered`, `/quiz`, `/v2`, `/history`, `/calendar`: existing tools.
- `/plans`: plan catalog and ownership status.
- `/plans/lawyer-2026-full`: 39,900 MNT checkout for lawyer 2026 only.
- Accounts, profile, and administration remain platform-wide.
- Old study URLs redirect permanently; query strings are preserved by Next.js.

The global header stays the same across the catalog and all editions: brand,
theme, notifications, and account menu. Admin is available only in an admin's
profile dropdown. Study tabs live in the edition workspace beneath its title.
In-app pricing links use `PlanLink` to open a native modal for plan selection and
checkout without navigating away. The `/plans` routes remain direct-link fallbacks.
The modal reads live payment status; approval refreshes access without reloading
the underlying study page. Native dialogs provide focus trapping and Escape dismissal,
including a separate nested terms dialog.

All existing files under `data/` are exclusively lawyer 2026. Existing question IDs,
saved answers, notes, local storage keys, and history remain intact. Loading the bank
adds an edition ID without modifying the source questions.

## Commercial rules

`src/lib/catalog.ts` is the reviewed registry of published editions and plans.
`ExamEntitlement` grants access by `(userId, editionId)`. There is no platform-wide
paid plan. Administrators can access published editions for administration.

`User.paidAt`, session `hasPaid`, existing mobile endpoints, and the existing study
APIs are compatibility interfaces for **lawyer 2026 only**. They must never be used
to authorize another bank. New bank APIs must call `hasEditionAccess(editionId, access)`
with live `userAccessScope()` data. The legacy question API rejects other editions.

Payment requests store `planId`, `editionId`, and the price snapshot `amount`.
The server chooses the price; clients cannot override it. Approval grants only the
recorded edition. An atomic pending-state decision prevents repeated approvals.
Pending keys prevent duplicate new requests for the same user and edition.
Historical duplicate pending requests are preserved; new requests first check them.
Finance totals sum recorded amounts rather than multiplying by today's price.
The existing manual admin grant button is explicitly for 2026; its API also accepts
a registered `planId` to grant/revoke a particular edition.

## Database rollout

Apply `prisma/migrations/20261105000000_exam_edition_access/migration.sql` before
releasing the new application. It adds the grant table and payment columns, assigns
all historical payment requests to lawyer 2026 at the original price, and backfills
all existing paid members into that edition. It does not delete content or progress.

Test on a Neon development branch first. This repository previously used `db push`
as well as migrations; verify the existing migration baseline before running
`prisma migrate deploy` on an existing database. Do not use `db push` as a substitute
for this migration: it would omit the entitlement backfill. Generate the Prisma
client after the schema change. Application builds do not apply database migrations.

## Adding a new exam or year

1. Give it a new immutable edition ID, e.g. `exam-slug-2027`.
2. Store its questions outside the legacy bank at `content/exams/<exam>/<edition>/`.
   Namespace new question IDs with the edition ID to isolate notes/answers/progress.
3. Implement its workspace and bank API, using the edition ID on every authorization
   check and separate scoped storage for attempt histories, saved runs, and study todos.
   The existing engine and its APIs remain bound to 2026; publishing another bank
   requires adapting these study APIs and clients, not merely adding a catalog card.
4. Register the edition and its free subjects in `EXAM_EDITIONS`, and one or more
   independently priced plans in `EXAM_PLANS`. Publish only when its workspace works.
5. The plan catalog, checkout, requests, grant approvals, and price snapshots use the
   registry. Future checkout free-sample counts and study CTA routes should match the
   new workspace's bank and routes.
6. Verify a 2026 purchase cannot retrieve the new bank, and vice versa.

No future exam types or prices are invented or sold before their content is ready.

## Checks

`npx tsx --test tests/edition-access.test.ts`

`npx prisma validate`

`npm run build`
