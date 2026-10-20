---
name: Agreed inventory operating policy
description: Confirmed business rules and deferred decisions; these are requirements, not claims of implementation or deployment.
---

The agreed flow is supplier receipt → warehouse stock → issue to a PO →
warehouse return of leftovers. Material for another job must return to the
warehouse before a new issue to that job. One PO equals one job/project.
Savannah and Indiana must operate separate servers and databases.

**Why:** The user explicitly confirmed these operational boundaries. Source code
and deployment state cannot establish them, and a development/production split is
not the same as regional separation.

**How to apply:** Check each requirement against actual implementation and label
unverified deployments explicitly. Do not silently enable direct job-to-job
reassignment or merge regional data.

Ordinary employees are read-only. Staff are team leaders who may request
materials and write daily reports for their assigned POs. Admins/managers perform
actual stock movements, quantity changes and management.

**Why:** The user defined the target role policy; older code allowing staff to
perform movements is not authoritative business intent.

**How to apply:** Enforce mutation permissions and assigned-PO authorization on
the server. Do not equate arbitrary historic worker dispatch with explicit
team-leader authority without checking the assignment model.

Requests reserve stock, with physical stock deducted only at pickup. Reserve the
available portion and leave shortages waiting. Receipts allocate to the oldest
requests first, subject to manager adjustment. Cancellation releases unissued
reservations; reservations do not expire automatically.

**Why:** Reservation and warehouse stock represent different stages of the
agreed workflow; existing request status changes do not themselves implement it.

**How to apply:** Design reservation ownership and availability separately from
physical stock. Preserve atomic issue transactions; partial reservation is not
permission to report partial failed inventory writes as success.

Issues record the PO and actual recipient. Admins/managers inspect quantity and
condition before accepting returns. The return limit is cumulative issues minus
prior returns for the same PO and item, not necessarily a chosen single issue.

**Why:** The user clarified the return accounting rule after earlier discussion
had left original-issue versus PO-level limits unresolved.

**How to apply:** Apply the PO/item aggregate policy to new guarded return
workflows. Do not guess or backfill missing historical links. Treatment of
completed/cancelled POs remains deferred.

Each wire reel retains its identity and remaining length. A returning original
reel keeps its number; detached cut leftovers get a new number. A requirement for
200 continuous feet cannot be met by two 100-foot reels. Exhausted reels retain
their history.

**Why:** Physical continuity and traceability matter independently of total feet.

**How to apply:** Distinguish original-reel returns from new offcuts and audit
every depletion path, not just the normal reel-delete endpoint.

Compatible materials of the same specification may share an item despite
different manufacturers; compatibility-critical products remain separate. EMT is
managed in feet, with only intact lengths included in returned available stock.
Zero-stock items stay listed.

**Why:** These are explicit catalog and return-condition rules, not automatic
equivalence inferred from similar names.

**How to apply:** Preserve units and explicit compatibility decisions. Never
auto-merge existing items or recalculate historical stock to enforce the policy.

Changes/cancellations should retain original records and reasons. Existing
operational data must not be arbitrarily modified. Stock-adjustment reason entry
has already been confirmed by the user as an existing feature.

**Why:** Staff continuously accumulate real operational records; desired audit
preservation must not be implemented by rewriting those records.

**How to apply:** Distinguish existing UI capability from consistent server
enforcement. Require separate approval for actual code changes, deployment and
any existing database application.

RMS as a whole, detailed daily-report workflow, additional labels/QR decisions,
and movements against completed/cancelled POs remain deferred. The agreed daily
report principle is installation usage/progress without deducting warehouse stock
a second time.

**Why:** The user explicitly reserved these decisions and stated that agreed
requirements do not mean every feature has been implemented.

**How to apply:** Preserve prior RMS materials/questions without resuming RMS
work. Classify each requirement as present, needing work, or deferred, and keep
production verification separate.

Purchase-price work is deferred until the user explicitly resumes it.

**Why:** On 2026-10-19 the user stated “가격은 보류” after purchase-price
visibility and preservation work was explained.

**How to apply:** Do not continue price-related changes, additional validation,
or application to development/production. Retain existing isolated proposals
without applying or deleting them. Do not interpret this as permission to undo
existing app behavior or to start another workstream.

Indiana should reuse the Savannah inventory application's functionality and
material catalog, but start its own inventory quantities at zero. The intended
entry flow is login → authorized branch or Central Management selection →
authorized Field/Admin mode selection.

**Why:** The user explicitly described these goals when requesting review of the
multi-branch architecture prompt. Regional servers and databases remain separate.

**How to apply:** Treat this as target scope, not an assertion that the attached
architecture has been implemented or that its implementation is authorized.
Preserve Savannah data and keep price work deferred. Resolve catalog acquisition
and authentication design safely before any environment creation or integration.

The approved first multi-branch implementation phase is Indiana development only.
Central Management is a permission-separated Coming Soon placeholder; Savannah
is unconnected. Actual SSO, central catalog CRUD/approval/synchronization, price
work, Savannah integration and deployment are outside this phase.

**Why:** The user approved the narrowed Indiana-first prompt and allowed splitting
the work into smaller units. Existing Savannah development data must be protected
alongside production data.

**How to apply:** Work in a separate source copy without modifying or migrating
the running Savannah project. Use only new synthetic test resources; do not copy
accounts, sessions, environment secrets, operational records or database dumps.
Real item catalogs require approved exports. Label synthetic UI/SQL checks and
unconnected authentication accurately rather than calling them a running branch.
