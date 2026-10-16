---
name: Request receipt privacy policy
description: Why historical operation ownership must not become permanent access to request contents.
---

Past authorization is not a permanent entitlement to a request snapshot. Result
recovery must respect the currently accessible request, even when the old command
really succeeded. A deleted target cannot establish current access to its former
contents; deletion confirmation is deliberately limited to minimal proof for the
original executor who still has deletion authority.

**Why:** The user explicitly requires protection after ownership/role changes,
while allowing legitimate confirmation of one's own deletion. Returning the
historical snapshot to a demoted actor would defeat that requirement.

**How to apply:** Keep future recovery UI, receipt APIs and retry policies aligned
with current authorization. Do not broaden deleted-record disclosure or use
historical permission as a substitute without a separately reviewed policy.
