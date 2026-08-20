---
name: Mobile material section navigation
description: Non-obvious alignment rule for Daily Report material section jumps and current-section tracking.
---

Mobile Daily Report material-section jumps must position the selected header at or just above the same sticky anchor used by active-section tracking.

**Why:** A header that stops even slightly below the tracking line can cause a scroll event to immediately reselect the preceding section, making the floating section menu appear wrong after a successful jump.

**How to apply:** When changing the mobile header, sticky navigation, or scroll behavior, verify normal and quick-entry mobile layouts with several BOQ sections, including a collapsed target and the final section.