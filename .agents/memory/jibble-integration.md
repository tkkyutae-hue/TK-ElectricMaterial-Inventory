---
name: Jibble integration pattern
description: How Jibble time-tracking is integrated into the manpower section
---

# Jibble Integration

## Architecture
Same pattern as Monday.com: PAT token stored in `app_settings` (key: `jibble_pat`), service file wraps REST API, routes added to `server/routes.ts`.

**Why:** Read-only — workers punch in/out in Jibble app (with face recognition), our app just displays the data.

## Key settings keys in app_settings
- `jibble_pat` — Personal Access Token
- `jibble_org_name` — display name for the connected org
- `jibble_active_cache` — JSON array of current active time entries (refreshed every 10 min)
- `jibble_last_sync_at` — ISO timestamp of last sync

## API endpoints added
- `GET /api/jibble/status` — connection status + active punch-in count
- `POST /api/jibble/connect` — save PAT, test it, run initial sync
- `DELETE /api/jibble/connect` — remove token
- `GET /api/jibble/members` — fetch people from Jibble
- `POST /api/jibble/sync` — manual refresh of active cache
- `POST /api/jibble/map` — link a Jibble person UID to a local worker
- `GET /api/jibble/active` — cached active punch-ins with matched workers
- `GET /api/jibble/attendance/:workerId` — live attendance for last 60 days

## DB schema added (workers table)
- `employee_id` (text) — human-readable employee number synced from Jibble
- `jibble_person_id` (text, unique) — Jibble internal UID for the person

## Jibble API shape notes
- Base URL: `https://api.jibble.io/v2`
- Auth: `Authorization: Bearer {token}`
- Response shape may be `{ value: [...] }` or `{ data: [...] }` or bare array — service handles all three
- People: `GET /people`
- Active entries: `GET /timesheets?status=active`
- Attendance history: `GET /attendance?personUid=...&from=...&to=...`
- Organisation info: `GET /organization`

**How to apply:** If Jibble changes API shape, update `server/services/jibble.ts`. The response normalization (`data?.value ?? data?.data ?? array`) is defensive by design.
