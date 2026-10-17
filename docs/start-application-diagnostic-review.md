# Start application diagnostic status

## Status

Investigation is incomplete: the reported preview failure has not been reproduced
in isolated real-component tests. No application fix is justified yet. Do not
mark this investigation as a successful repair or infer the newest business-code
commit caused the screenshot.

## Existing evidence

- The previously collected development workflow log records successful database
  connectivity, startup seed execution, listening on port 5000 and subsequent
  successful API responses. This is not a failed server startup in that log.
- The previously collected browser log at 2026-10-17 02:01:27.858 UTC contains a
  non-Error uncaught-exception report and a redacted diagnostic classifying an
  error event as `resize-observer-delivery` in an embedded frame.
- The user subsequently identified movement type selectors on receive/issue
  screens and the inventory status selector, after the screen had already loaded.
  A later existing log snapshot contains non-Error reports at 02:10:18.426 and
  02:10:28.215 UTC while the development workflow remains running. Those later
  records contain no original message, stack or new diagnostic classification,
  so they cannot independently be classified as ResizeObserver notices.
- Their coincidence is evidence to investigate preview error reporting, not
  proof of the originating component or of a specific preview-monitor listener.
- A cookie-free read of the already-running development root HTML found the
  inline development guard, with its mode placeholder correctly expanded.
  Vite module scripts precede it in document order but are deferred. The response
  itself does not demonstrate a synchronous monitor running before the guard.
  No returned JavaScript was executed during this HTML inspection.
- The recent business-code change concerns movement serialization and draft
  supplier preservation, not startup configuration or shared Select.

## Isolated checks performed

`node --import tsx --test tests/devSelectRuntime.mock.test.ts tests/devResizeObserverGuard.test.ts`

Final result: **8 tests passed, 0 failed**.

- Actual MovementForm and shared Select with actual source CSS: 390/1024 widths,
  ko/en/es and dark/light, 12 combinations with repeated open/select.
  No native errors or network requests in these fixtures.
- Actual FieldInventory and receive/issue FieldMovement inside actual FieldLayout
  in a 1024x680 iframe. Header, cart and service boundaries are mocked.
  No notice suppression is installed for these three screen checks; no native
  errors, network requests or attempted service mutations were observed.
- Six guard checks cover native Chromium delivery loops, real error visibility,
  production inactivity, redaction, diagnostic rate limiting and earlier-listener
  ordering. A synthetic loop proves that a previously registered capture listener
  can see a notice even though the later guard prevents default and stops later
  listeners. This is a demonstrated limitation, NOT confirmation of Replit's
  actual monitor implementation.
- `git diff --check` passed.

No dependencies were installed. The test bundlers reject server modules, and all
browser networking is blocked. The stylesheet is compiled in memory; this is not
an application build or a live server startup.

## Preservation and remaining blocker

Only tests and this investigation record were added/updated; application source,
configuration, ports, database schema and deployment were not changed.
No existing DB was connected to and no app startup/restart was requested by this
investigation. Existing startup log entries describe a process that was already
running, not an action performed here.

The actual failing preview event must be correlated with its reporting path
before modifying application behavior. Safe isolated reproductions do not prove
that the complete app or preview integration is fixed. Existing DB-connected
startup remains prohibited because it executes seed/migration/backfill.

The eight tests were not re-run after the user's clarification: they already
cover the named movement type and inventory status controls. No additional
production-code changes have been made in response to the later generic logs.

## Full frontend follow-up

An additional one-off Playwright inspection used the already-running Vite asset
server to load the actual frontend entry, providers, header, theme and routes.
The document itself was fulfilled from the previously fetched HTML. Every
`/api/` request was intercepted with synthetic JSON, service workers were blocked,
WebSocket routes were closed locally and external requests were blocked.
Only whitelisted same-origin JavaScript/CSS asset GETs reached the development
server; no business API reached it, and no existing cookies/session were used.
This executed browser frontend code, not server bootstrap.

Receive, issue and inventory all rendered successfully. Their movement-type /
inventory-status dropdowns opened and accepted selection. No page exceptions or
ResizeObserver notices were observed. The deliberately blocked external font
stylesheet produced a resource-error diagnostic, which is distinct from the
reported uncaught exception. Synthetic screenshots were inspected locally.

This check does not reproduce the user's Replit-hosted preview monitoring
environment, original fonts, data or session. It is not a post-fix test: no fix has
been made. The investigation remains blocked on direct evidence from the failing
preview event or a comparison outside that preview. Do not mark it completed.
