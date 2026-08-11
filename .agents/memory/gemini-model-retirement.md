---
name: Gemini model retirement
description: Gemini model names get retired; verify with ListModels before hardcoding
---

Google retires Gemini model names aggressively (`gemini-2.0-flash`, `gemini-1.5-flash` both 404 as of Aug 2026).

**Why:** Hardcoded model names broke the BOQ extraction feature twice in one session.

**How to apply:** Before setting a Gemini model name, verify with
`curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_AI_API_KEY"`.
Prefer alias names like `gemini-flash-latest` for resilience, or currently-valid `gemini-2.5-flash`.
Use the new `@google/genai` SDK (the old `@google/generative-ai` is deprecated).
