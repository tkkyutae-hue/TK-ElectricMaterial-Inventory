---
name: TypeScript target cache
description: How to validate compiler-target changes when an incremental TypeScript cache already exists.
---

After changing `compilerOptions.target`, validate once without the incremental cache (or remove the generated build-info file) before interpreting remaining diagnostics.

**Why:** Cached diagnostics may continue to report downlevel iterable errors from the previous target even when the resolved configuration shows the new target.

**How to apply:** For a target or module-setting change, run a clean type check first; then run the normal project type-check command again to confirm its incremental path is healthy.