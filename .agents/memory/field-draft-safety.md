---
name: Field request draft safety
description: Product constraints for local drafts and safely validating field-mode changes.
---

Closing a request panel must preserve the full local draft; removing its last item must not implicitly end an existing-request edit. Ending the local edit is distinct from cancelling a saved request. Do not add persistent storage of requester details without explicit approval.

**Why:** An unnoticed switch between new-request and existing-request editing can submit changes to the wrong request. The user requires draft continuity without adding personal-data retention across refreshes.

**How to apply:** Treat items and form fields as one draft. Confirm replacement of different in-progress work, and distinguish local draft actions from server request actions.

Do not use existing development or production business databases to test field request changes, or start the app just to validate them, without explicit permission.

**Why:** Employees continuously enter live operational data; startup can run migrations, seeds or backfills. The user repeatedly requires preservation of existing inventory, requests and history.

**How to apply:** Prefer pure state tests and isolated client tests with mocked services and blocked network. Report live integration checks as unverified rather than connecting to existing databases or restarting the application.

Use in-memory browser pages for these isolated tests; do not start a preview HTTP server or expose an additional port without explicit approval.

**Why:** A temporary preview used for a test left an extra port registration in the project configuration after its process stopped. Stopping the process alone does not remove that configuration.

**How to apply:** Bundle selected client components with mocked service boundaries, render with browser `setContent`/inline scripts, and block browser networking. Test the real UI handlers without importing the app entry point.

Staff data may also exist in the development database. Permission for a new
disposable test database does not authorize connecting to the existing development
database, running application bootstrap, or applying the prepared schema there.

**Why:** The user explicitly treats development and production business data as
equally protected and requires separate approval for schema application/deployment.

**How to apply:** Keep tests on fresh private Unix-socket clusters with synthetic
fixtures. Prepare schema/review documents only; never add startup DDL, run a
migration against an existing database, or assume an app rollback can discard
newer employee entries.

Do not infer missing historical supplier values or automatically associate legacy
returns with an original issue. Return-to-stock and supplier-return policies must
not be conflated.

**Why:** The user explicitly prohibits guessed historical repairs and requires
project/PO identity and outstanding-return rules to reflect actual business
policy rather than assumptions.

**How to apply:** Preserve unknown values as unknown, report unverifiable return
links, and continue independent quantity/draft safety work without waiting for a
return-policy decision.
