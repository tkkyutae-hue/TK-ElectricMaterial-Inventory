#!/bin/bash
set -e
npm install
# Idempotent schema migrations (safe to re-run):
psql "$DATABASE_URL" -c "ALTER TABLE project_scope_items ADD COLUMN IF NOT EXISTS sort_order integer;"
npm run db:push
