#!/usr/bin/env bash
# Prepares an empty PostgreSQL database for the dev-store E2E run with the
# same sequence the CI jobs use (.github/workflows/ci.yml): migrations,
# compatibility indexes, tenant roles and enforcement, sync roles.
# Runs from stocky-plus/ with the CI-style DATABASE_* variables exported.
set -euo pipefail

export TENANT_MAINTENANCE_DATABASE_URL="${DATABASE_URL}"
export DATABASE_MIGRATION_URL="${DATABASE_URL}"

npx prisma generate
npx prisma migrate deploy
npm run tenant:indexes:apply -- --apply
npm run tenant:roles:provision -- --apply
npm run tenant:enforcement:preflight
npm run tenant:enforcement:apply -- --apply
npm run tenant:rls:verify
npm run sync:roles:provision -- --apply
npm run sync:roles:verify
