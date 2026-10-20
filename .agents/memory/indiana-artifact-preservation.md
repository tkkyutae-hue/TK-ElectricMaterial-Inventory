---
name: Indiana artifact preservation boundary
description: Temporary working copies and historical test counts are not durable preservation or recoverable source.
---

Do not declare an Indiana phase recoverable or safely preserved merely because its
source, archive and test evidence once existed under `/tmp`. Establish durable,
approved private preservation of the exact source and evidence before depending
on them in a later execution environment.

**Why:** A later execution environment could not access the previously reported
temporary Indiana artifacts, and neither tracked files nor the inspected local
Git history supplied them. This does not establish deletion from every earlier
environment, but historical success reports alone cannot recover missing source.

**How to apply:** Check artifact existence before authentication retries or
follow-on integration. If absent, seek the original preserved archive through an
authorized recovery channel. Do not recreate code and present it as the tested
original, infer current test success from old counts, or equate a completed task
record with source preservation. Keep Savannah resources untouched.
