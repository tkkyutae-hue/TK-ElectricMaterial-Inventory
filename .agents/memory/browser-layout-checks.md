---
name: Browser layout checks
description: Runtime requirements for browser-based layout regression checks in this Replit workspace.
---

Browser viewport tests should provision Chromium before running and retain the browser's Nix runtime libraries in the workspace configuration.

**Why:** Installing the Playwright package alone does not include a browser binary, and Chromium cannot launch in a minimal Nix runtime without its shared libraries.

**How to apply:** When adding or running a browser layout check, use a test command that installs Chromium when absent and keep the required system libraries configured for the workspace.

When server-rendering a component that imports the PDF viewer, provide a `DOMMatrix` global before dynamically importing that component in the Node-based test.

**Why:** pdf.js creates a DOMMatrix while its module loads, before a browser page is involved.

**How to apply:** Use the Node canvas DOMMatrix implementation in the test setup, then dynamically import the component after assigning it to `globalThis`.