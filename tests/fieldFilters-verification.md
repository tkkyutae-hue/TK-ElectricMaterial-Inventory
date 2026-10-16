# Field filter consistency — isolated verification

## Scope and isolation

Only the field inventory filter/query paths were changed. The independent design
mockup is not integrated. Common Select, layout, diagnostics, cart/request mutation
code, schema, startup code, settings, packages and deployment were not changed.

No existing development or production DB was connected to, even for a read.
No application server was started or restarted. No credentials or environment
values were used. No PostgreSQL instance was created for these checks.

## Executed checks

- `tsx --test tests/fieldFilters.storage.test.ts`: **11 passed, 0 failed**.
  Bundles and evaluates the actual `server/storage.ts`, intercepting `./db`
  before evaluation. Only a synthetic select-only database facade is provided;
  real DB drivers/bootstrap are excluded and unexpected module loads fail.
  Checks brand candidates, shared tokenized name/SKU/size/description search,
  existing broader supplier search, minimum stock, synthetic live reel totals,
  ordered vs empty stock, pagination and candidate sizes.
- The same suite extracts and executes the three exact route registration
  statements from the TypeScript AST of `server/routes.ts` for items, sizes and
  subcategories. The query conversion/forwarding and handler are actual source;
  the authentication boundary is a stub, not a full HTTP/auth test.
- `tsx --test tests/fieldFilters.ui.test.ts`: initial **9 passed, 0 failed**.
  Actual FieldInventory, React Query, the shared Select and field request function
  run in an in-memory Chromium page. Other service/cart boundaries are mocked.
  Covers category change/clear, brand forwarding/cache keys, retry and retained
  conditions in ko/en/es and both themes, and delayed old item/size responses.
- After adding the remaining failure cases:
  `tsx --test --test-name-pattern='failure is not empty success|malformed response' tests/fieldFilters.ui.test.ts`:
  **7 additional passed, 0 failed**, 9 previously passed cases intentionally skipped.
  Covers failures on every remaining query endpoint, malformed successful JSON,
  rejected transport, cached rows not presented as fresh success, and recovery.
- Total distinct automated cases: **27 passed, 0 failed**.
- `tsc --noEmit --incremental false --pretty false`: passed after the language
  hook binding was corrected. No incremental build output was written.
- `git diff --check`: passed. Protected file diff was empty.

## Limits

- SQL execution, actual joins/SQL predicates, PostgreSQL behavior, full HTTP/auth,
  real data, production behavior, and real-device/Safari operation are unverified.
- The browser fixture intentionally replaces cart/business service hooks and does
  not claim to retest the prior request Undo/concurrency or draft protection work.
  Those implementations were not edited.
- Browser tests verify behavior, not the complete production stylesheet/layout.
  An offline English synthetic screenshot was inspected, not the running app.
- Size choices now share item filtering, including supplier/category search and
  live reel quantities, and skip image loading. This adds a read-only reel
  aggregate to the size path. Large-data SQL cost remains unmeasured.
- Separate item/candidate HTTP requests are not a transactionally consistent
  snapshot if business data changes between reads. Query-key isolation prevents
  stale UI selections being overwritten; it is not a DB concurrency guarantee.
- Explicit choices survive failures and out-of-order candidate responses.
  An incompatible retained size can legitimately yield zero rows; it is not
  silently cleared by an asynchronous candidate result.
- Independent select-error diagnosis remains unresolved and was not changed.

Any real DB access, app startup/restart, schema operation or deployment still
requires separate explicit approval. No existing data correction or backfill is
required by these filter code changes.
