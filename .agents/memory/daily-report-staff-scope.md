---
name: Daily Report staff scope
description: Authorization boundary between staff Daily Report access and broader Field Mode project visibility.
---

STAFF Daily Report access must be authorized on the server against projects assigned to the user's linked worker. UI filtering is only a convenience and must not be the security boundary.

**Why:** Field Mode intentionally uses a broader general project list, while Daily Report contains project scope, progress, crew, and report-writing data that must stay within the worker's dispatch assignments.

**How to apply:** Keep Daily Report project discovery and project-specific supporting reads on a dispatch-scoped server surface. Any new Daily Report endpoint must enforce the same project assignment check; do not narrow the general Field Mode project list as a side effect.

An account-to-worker link is valid only when the linked app account is active. A missing, deactivated, or deleted linked account must be treated as unresolved and require an explicit manager-confirmed replacement; never infer the identity from names or email fragments.

**Why:** A dispatch without a usable account link leaves a foreman with an empty Daily Report list, while automatic matching could expose another worker's project data.

**How to apply:** Validate account activity on every link write, prioritize unresolved links for recently dispatched foremen in manager audits, and keep staff access empty until the mapping is explicitly confirmed.