#!/bin/bash
set -e
npm install
# Idempotent schema migrations (safe to re-run):
psql "$DATABASE_URL" -c "ALTER TABLE project_scope_items ADD COLUMN IF NOT EXISTS sort_order integer;"
psql "$DATABASE_URL" -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR;"
psql "$DATABASE_URL" -c "ALTER TABLE project_scope_items ADD COLUMN IF NOT EXISTS section text;"
psql "$DATABASE_URL" -c "ALTER TABLE project_scope_items ADD COLUMN IF NOT EXISTS report_target text;"
# Note: the unique constraint on google_id is managed by Drizzle (shared/models/auth.ts).
# Do NOT manually create users_google_id_unique here — Drizzle handles it and a duplicate
# index definition can cause conflicts on schema push.
