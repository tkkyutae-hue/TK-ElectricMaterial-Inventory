---
name: Gemini model retirement
description: Gemini model names get retired; verify with ListModels before hardcoding
---

Google retires Gemini model names aggressively. As of Aug 2026 with this API key:

**Working models (tested via generateContent):**
- `gemini-flash-latest` ✅ — alias, always resolves to current flash
- `gemini-3.5-flash` ✅ — best for BOQ/PDF extraction (newest working)
- `gemini-3-flash-preview` ✅

**Not available for this API key:**
- `gemini-2.5-flash` ❌ "no longer available to new users"
- `gemini-2.5-flash-lite` ❌ same
- `gemini-2.0-flash-latest` ❌ not found

**Why:** Hardcoded model names broke the BOQ extraction feature multiple times. The ListModels response lists models that may still be restricted by API key tier.

**How to apply:** Before changing a model name, test with a quick `generateContent({ model, contents: [{ parts: [{ text: 'say ok' }] }] })` call. Use `gemini-3.5-flash` for vision/extraction tasks. Currently used for BOQ PDF extraction in `/api/projects/:id/scope-items/extract-from-file`.
