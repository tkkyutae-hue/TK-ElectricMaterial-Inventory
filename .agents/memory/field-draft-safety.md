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
