---
name: Daily Report staff scope
description: Authorization boundary between staff Daily Report access and broader Field Mode project visibility.
---

STAFF Daily Report access must be authorized on the server against projects assigned to the user's linked worker. UI filtering is only a convenience and must not be the security boundary.

**Why:** Field Mode intentionally uses a broader general project list, while Daily Report contains project scope, progress, crew, and report-writing data that must stay within the worker's dispatch assignments.

**How to apply:** Keep Daily Report project discovery and project-specific supporting reads on a dispatch-scoped server surface. Any new Daily Report endpoint must enforce the same project assignment check; do not narrow the general Field Mode project list as a side effect.