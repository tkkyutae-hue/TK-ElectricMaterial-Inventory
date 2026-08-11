#!/bin/bash
set -e
npm install
# Idempotent schema migrations (safe to re-run):
psql "$DATABASE_URL" -c "ALTER TABLE project_scope_items ADD COLUMN IF NOT EXISTS sort_order integer;"
psql "$DATABASE_URL" -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR;"
psql "$DATABASE_URL" -c "CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL;"
# Push remaining schema changes non-interactively
npx drizzle-kit push --force
