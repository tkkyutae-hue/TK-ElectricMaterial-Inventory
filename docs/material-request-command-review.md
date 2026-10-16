# Material request command protocol — approval review

## Status and boundaries

Prepared code only. Do not run the app, `db:push`, migrations, seed, backfill,
post-merge setup or deployment against existing development/production databases
to evaluate this change. No existing database was inspected or changed.

The schema source changes below are **not yet applied to existing databases**.
This change adds no automatic startup/deploy DDL for the new revision/operation
structures and no production migration script. **The existing application startup
DOES call seed, migrations and backfill.** Starting the app with an existing DB
connection is not a safe read-only check, even when the new structures are absent.
Do not publish this version until schema and operational cutover are separately approved.

## Proposed database structures

- `material_requests.revision`: integer, NOT NULL, constant default 0.
  Increment once for every committed modification, including state changes and
  Undo. Never reset or derive from the current content. PostgreSQL integer
  overflow fails rather than wrapping. Existing rows need no corrective UPDATE.
  Review the actual target PostgreSQL version/default-column locking behavior
  before approving application of this additive change.
- `material_request_operations`: primary key `operation_id`; actor ID, request
  ID, action, canonical intent fingerprint, server-captured before-state, committed
  result, fulfillment movement snapshots, creation timestamp. No cascading FK
  to the request: a deletion must not delete its idempotency receipt.
- Snapshots contain existing request business fields, including requester/notes.
  Only the authenticated actor can query their operation result. Retention and
  access must be approved; do not purge receipts automatically, because removing
  them can allow an old operation ID to execute again.
- Ordinary request listings include the revision through the prepared schema.

## Command rules

- Each action requires a UUID operation ID. Existing-row actions also require
  the exact expected revision; absent preconditions return 428.
- A transaction-level operation lock serializes identical retries across server
  instances. The committed receipt and all business changes share one transaction.
  Same ID/actor/intent replays the original result. Reusing the ID for a different
  intent is rejected.
- Both receipt lookup and replay lock/re-read the current active actor and target
  request. Only staff/manager/admin are eligible; managers/admin can view any
  existing target and staff only the current submitter's target. Historical
  ownership or a formerly elevated role cannot authorize disclosure. These checks
  share a transaction with share locks, so ownership/role revocation coordinates
  with the authorization decision.
- For a missing/deleted target, all old create/edit/status/Undo results are denied.
  Only the original deletion actor who still has manager/admin authority can
  confirm their deletion, and receives only operation ID, request ID, revision and
  deleted=true. No deleted content, before-state or snapshots are disclosed.
  Other actors receive no receipt; demoted/inactive actors cannot confirm deletion.
  Rejection never re-executes the recorded command.
- Lock/re-read the active actor and request. Enforce current ownership, role,
  state and revision before changing anything. A user-row share lock coordinates
  with role/status updates. Item locks use increasing item ID order.
- Edit Undo references the successful edit operation. Restore editable fields
  from its server-captured original, not a client-supplied preimage. It requires
  that operation's resulting revision and a currently editable/unfulfilled state.
- Create Undo is explicitly a cancellation, guarded by the create operation and
  its resulting revision. State Undo also has revision checks.
- Completion validates all lines and deducts item/source-location stock, creates
  movements/project ledger entries, and sets the request marker in one transaction.
  Any invalid/missing item, insufficient stock or SQL failure rolls everything
  back. No skip-and-continue success.
- Completion Undo requires its original completion receipt, actor, unchanged
  request revision, and exact matching linked movement snapshots. All reversal
  effects and the prior state restoration commit together.
- Direct creation/edit/deletion/edit-Undo of `material_request`-linked movements
  through the general movement storage methods is rejected. Use the guarded
  request workflow instead. Unrelated movement references retain their old behavior.
- Versioned mutation handlers replace the legacy route handlers and terminate
  every response, including errors. There is no unconditional route fallback.

## Deliberate fail-closed cases / compatibility changes

- Old clients without operation/version preconditions must refresh; no unconditional
  compatibility fallback is safe.
- New request numbers use the allocated row ID and a short operation-ID suffix,
  rather than a full-table count. Review this display-format change before rollout.
- Legacy completed requests without the new completion receipts cannot use the
  new automatic completion Undo. No historic reconstruction or backfill is done.
- Transfer requests currently lack a reliable destination in this workflow.
  Completion is blocked with `TRANSFER_DESTINATION_REQUIRED`, not fabricated.
  A destination-aware transfer design needs separate review before enabling it.
- Explicit source warehouses need exactly one existing balance with sufficient
  stock. Missing/ambiguous balances or unresolved locations block completion;
  they are never initialized or repaired silently.
- Completed/cancelled requests are not editable through Undo. Managers do not
  bypass revision/state checks.
- Completed request details explain in all three languages that historical
  completions without safe records cannot be automatically undone. This is a
  conditional notice, not an assertion that every completed row lacks a receipt.
- General field/admin history screens explain linked movement restrictions in
  all three languages and disable direct editing/deletion, including mixed
  selections. Cancellation of selection remains available; blocked actions keep
  local drafts and issue no mutation. Server restrictions remain authoritative.
- These commands coordinate related request fulfillment operations, not every
  legacy inventory writer. Unrelated stock edits/syncs remain outside this scope;
  do not claim whole-inventory concurrency safety.

## Response loss and local draft preservation

- Client commands keep their operation ID in memory while unresolved. Duplicate
  clicks join the pending command; explicit unchanged retries use the same ID.
  A different intent for the same unresolved target is blocked.
- Server receipts survive process restart. A lost result can be retrieved through
  the actor-scoped operation-result endpoint or replayed using its original ID.
  No receipt means `unknown`, not proof of failure.
- A network/server/malformed-response failure is shown as unconfirmed and does
  not clear the draft. The client does not automatically retry with a new ID.
- A confirmed pre-commit SQL failure with successful rollback is reported as
  `COMMAND_ROLLED_BACK`; commit/connection ambiguity remains unconfirmed.
- Browser refresh intentionally does not persist drafts or personal information.
  The in-memory pending ID is also lost on refresh. The UI warns to confirm the
  server result before re-entering a submission. Automatic recovery across a
  browser refresh is **not implemented**. Distinct new operation IDs are distinct
  intents; content equality alone cannot determine whether a repeated order is
  intentional.
- Server success clears only the exact submitted draft. Undo keeps both the
  preflight replacement confirmation and the post-response recheck. Conflicts
  never replace local work. Server success with declined local restoration is
  explicitly distinguished from restoring the local draft.

## Verification performed without existing databases or app startup

- A newly initialized PostgreSQL 16 cluster in a unique private `/tmp` directory;
  no copied connection information or real rows. TCP disabled, private Unix
  socket only. Tests shut down/remove their own cluster afterward.
- SQL fixtures model the columns/constraints exercised by the service, not a
  copy or introspection of production. They verify real SQL transactions, row
  locks, rollback, revision conflicts, durable receipts, ABA, and concurrency.
- Browser tests bundle real selected field components, request command client,
  toast hook/toaster and person picker. Query/auth/transport boundaries are mocked;
  browser network is blocked. No HTTP preview server or exposed test port.
- Test-only UUID fallback supports isolated `about:blank` pages; production uses
  browser secure-context `crypto.randomUUID()`.
- No full app bootstrap, live DB/API, deployment, mixed-version rolling rollout,
  real production constraints, production load, or disaster recovery test.
- Additional real Express middleware-chain tests run entirely in memory (no
  listener/network): the same session guard, dependency-injected user loader,
  routes and command service, using only the fresh PostgreSQL fixture. Session
  objects are synthetic. Real cookie signing/session persistence/login/OAuth and
  external identity providers are not tested; the application's session-store
  module is deliberately not imported because it imports the existing DB.

## Approval gates and rollback restrictions

1. Review actual target schema, PostgreSQL version, existing constraints and
   integration writers only after read-access approval. Do not assume published
   code/DB matches the workspace.
2. Separately approve additive schema application to each existing database.
   Review automatic post-merge/publish behavior first; no automatic data overwrite.
3. Plan a coordinated writer cutover. **Old servers must not continue unconditional
   writes alongside new servers.** Revision increments only protect writers that
   participate. Block/retire old writers and refresh old clients.
4. Approve the fail-closed compatibility changes above and operation receipt
   access/retention before production use.
5. Preserve the operation ledger and revisions on rollback. Rolling back to old
   unconditional writers breaks the protection; dropping receipts destroys safe
   replay/Undo evidence. Replaying SQL or restoring a whole DB backup can erase
   newer staff data and is not an authorized rollback strategy.
6. Application rollback does not reverse completed inventory commands. Any later
   operational reversal must use its own approved guarded transaction, not a
   bulk restore or historical data correction.
