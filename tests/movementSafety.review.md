# General movement / supplier review

## Scope and status

Implemented and tested: item-row quantity serialization for ordinary movement
creation, one-shot draft confirmation, transactional inventory/history, supplier
preservation through draft form/storage/confirmation and bulk restore.

**Not a full inventory concurrency safety certification.** In particular,
ordinary reel-backed form submissions still perform separate reel HTTP mutations.
Those paths recompute item stock from reels outside the new movement transaction.
Request fulfillment does not allocate/decrement specific reels. These paths can
still disagree with or overwrite the base item quantity; reel-backed end-to-end
safety is NOT complete. Do not publish this as a solution for all inventory.

Original-issue return linkage and outstanding-return limits are explicitly
deferred pending the project/PO policy. This change does not impose new return
eligibility rules.

## Actual execution evidence

All SQL used fresh temporary PostgreSQL clusters, private Unix sockets, TCP
disabled, synthetic fixtures only. Helpers verify the fresh data directory before
DDL. No existing database connection strings were loaded/copied. Fixtures use
schema column types/defaults and relevant FKs; unrelated FKs/indexes are omitted.
The app was not booted.

`tests/helpers/disposableMovementPg.ts` bundles **actual server/storage.ts** and
replaces ONLY its database module with Drizzle on the fresh private pool.
It rejects inclusion of server/db.ts and server/index.ts. Tests execute actual
createInventoryMovement, confirmDraft, bulkRestoreMovements, createDraft/getDraft.
Cross-path cases use the actual MaterialRequestCommands on the same private pool.
This is not a reimplementation of the quantity calculation.

Before production-code edits, the first 12 SQL cases: **4 pass / 8 fail**.
Failures: simultaneous receives (110 instead of 120), returns (105 instead of
110), both competing 70-unit issues succeeding from stock 100, stale sequential
snapshots, duplicate draft confirmation, competing draft/ordinary issues,
supplier loss at confirmation and restore.

After edits:

- `node --import tsx --test tests/movementSafety.sql.test.ts`: **19 pass / 0 fail**.
  Includes concurrent receive/return/issues, same/different draft confirmation,
  reversed multi-item order, shortage rollback, injected UPDATE failure after
  history insertion, invalid supplier FK rollback, request-completion competition
  and stale post-completion issue rejection, current-quantity restore/supplier
  retention, optional legacy supplier, invalid/mixed supplier rejection, draft reel
  shortage rollback and incoming reel supplier, string quantity rejection.
- Existing `tests/materialRequestCommands.sql.test.ts`: **22 pass / 0 fail**.
  Actual isolated PostgreSQL request Undo/revision/replay/permission tests and
  existing in-memory Express adapter/identity tests. No live sign-in.
- `tests/movementSupplier.mock.test.ts`: **1 pass / 0 fail**, actual MovementForm,
  actual source/supplier picker and Save Draft button at 390 and 1280 pixels.
  Verified supplier A rehydration/saving and selection/saving of supplier B.
  Service hooks and fetch mocked, network blocked, no real app server.
- `tsc --noEmit --incremental false`: exit 0, no diagnostics.
- `git diff --check`: passed.

Total distinct automated tests: **42 pass / 0 fail** after corrections
(19 new SQL + 22 existing request regression + 1 browser test).
The earlier failures are reproduction evidence, not failures remaining in this
test set.

## Mechanism and compatibility

- Lock the item before calculating previous/new quantity. Ignore stale route
  snapshots; reject shortage inside the same transaction as history insertion.
- Lock and consume the draft in its transaction, then lock item IDs ascending.
  Rollback leaves the draft available. A second confirmation does not create a
  second movement; it returns not-found/already-confirmed, not a success replay.
- Supplier ID is stored per row in existing itemsJson, checked for consistency.
  No new column, migration, backfill or startup task. Legacy missing supplier stays
  null. Old clients may drop metadata on re-saving; no compatibility guarantee
  for mixed deployed client versions.
- Bulk restore remains per-snapshot transactional, not all-or-nothing across an
  entire batch. It retains supplier and records current before/after quantities.

## Remaining limits / release blockers

- Reel-backed general form submission and request completion need a common
  transactional reel allocation policy; see scope warning above. Draft reel
  shortage protection does not prove safety against independent reel CRUD.
- General movement edit/delete/edit-Undo and other direct stock writers were not
  made universally serializable in this task. Asset-status sync is still separate.
- The whole live HTTP/auth path, actual databases, deployment, real traffic,
  long-running contention and live language/theme rendering were not tested.
  Existing request middleware tests are not general-movement HTTP route coverage.
- Client multi-row submissions remain separate transactions; ambiguous responses
  and general-movement retries are not newly idempotent.
- No original-issue return cap or PO policy implementation, no historical fixes.

## Preservation and application

No existing dev/prod database access, application startup/restart, deployment,
configuration/port/package/credential changes, schema changes or real data copies
were performed. Separate Select diagnostics, common Select/layout, filter fixes,
design mockups and request command code were not modified.

Code is saved in the working tree; no commit or deployment was performed by this
work. Existing app startup has independent seed/migration/backfill behavior; do
not run it to validate these changes. Production application remains unapproved.
