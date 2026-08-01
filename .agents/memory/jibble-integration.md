---
name: Jibble integration pattern
description: How the Jibble time-tracking integration is structured; known API quirks and working endpoints.
---

# Jibble Integration Pattern

## Auth
- OAuth2 Client Credentials: POST `https://identity.prod.jibble.io/connect/token`
- Basic Auth header (`Authorization: Basic base64(id:secret)`), NOT body params
- Scope: `api1`

## Microservice URLs (confirmed via OData $metadata)
- `JIBBLE_WORKSPACE  = https://workspace.prod.jibble.io/v1`   → People, Organizations
- `JIBBLE_TRACKING   = https://time-tracking.prod.jibble.io/v1` → TimeEntries, HourEntries
- `JIBBLE_ATTENDANCE = https://time-attendance.prod.jibble.io/v1` → Timesheets

## TimeEntry Schema (from $metadata)
- Entity: `TimeEntry` (one record per punch event, NOT a start→end range)
- Key fields: `id`, `personId` (Guid), `type` (enum: In=0/Out=1/StartBreak=2), `localTime` (DateTimeOffset), `nextTimeEntryId` (Guid, null = no subsequent event), `belongsToDate` (Date)
- Person currently on site = ClockIn entry where `nextTimeEntryId` is null

## /TimeEntries OData Filtering — BROKEN
- **Any OData $filter expression causes Jibble to return HTTP 500** (confirmed with both `nextTimeEntryId eq null` and `type eq 'In' and belongsToDate eq {date}`)
- Workaround: fetch without $filter (use `$top=500 $orderby=localTime desc`) and filter server-side
- Server-side logic: keep entries where `type === "In"`, `localTime.slice(0,10) === today`, `nextTimeEntryId == null`

**Why:** Jibble's OData server appears to have indexing/query issues on some fields; their web app likely uses non-OData APIs internally.

## Timesheets Schema (from $metadata)
- Entity: `TimesheetModel`, key: `personId` (Guid)
- Key-based access: `/Timesheets({personId})?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Response has `daily: DailyTimesheetModel[]` with `firstInTimestamp`, `lastOutTimestamp`, `trackedHours.total` (ISO 8601 duration)
- Entity set is `Timesheets` (confirmed via $metadata EntitySet)

## People / Members
- Endpoint: `/People` on workspace service
- Field names: `id` (OData key, Guid) or `uid` (legacy), `employeeCode` (primary) / `employeeNumber` (alias)
- `fetchJibbleMembers` normalizes: always sets `uid = uid ?? id`

## App Storage Keys
- `jibble_client_id`, `jibble_client_secret`, `jibble_access_token`, `jibble_token_expires_at`
- `jibble_org_name`, `jibble_active_cache`, `jibble_last_sync_at`

## DB columns added to workers table
- `employeeId` (text) — human-readable employee number
- `jibblePersonId` (text) — Jibble person Guid used for mapping
