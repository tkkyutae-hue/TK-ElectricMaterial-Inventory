---
name: Safe Excel scope extraction
description: Memory-safe handling of uploaded BOQ workbooks in constrained deployments.
---

For Scope Item extraction, do not load an entire user-uploaded `.xlsx` workbook with ExcelJS. Read only the OOXML workbook metadata, shared strings, and relevant worksheet cells, with explicit limits on ZIP entries and inflated XML sizes.

**Why:** A workbook can be small on disk but expand dramatically through styles, links, formulas, and defined names. Full ExcelJS loading exhausted the deployment Node.js heap and terminated the server, even when the user only needed a B.O.Q sheet.

**How to apply:** Keep B.O.Q direct parsing separate from general spreadsheet preview extraction. Ignore styles, external links, images, and calculations. Return a normal user-facing error when resource limits are exceeded rather than increasing the process heap.