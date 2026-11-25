#!/usr/bin/env bash
# Starts the built app and the job worker, runs the dev-store E2E specs
# against them, and stops both. Runs from stocky-plus/ after `npm run build`
# and scripts/store-e2e/prepare-db.sh. Extra arguments go to Playwright.
set -euo pipefail

port="${PORT:-3000}"
logs="${STORE_E2E_LOG_DIR:-e2e-logs}"
mkdir -p "${logs}"

PORT="${port}" NODE_ENV=production npm start >"${logs}/app.log" 2>&1 &
app_pid=$!
npm run worker >"${logs}/worker.log" 2>&1 &
worker_pid=$!
trap 'kill "${app_pid}" "${worker_pid}" 2>/dev/null || true' EXIT

ready=false
for _ in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}/")" != "000" ]; then
    ready=true
    break
  fi
  sleep 1
done
if [ "${ready}" != true ]; then
  echo "app did not start on port ${port}; see ${logs}/app.log" >&2
  exit 1
fi

STORE_E2E_BASE_URL="http://localhost:${port}" npx playwright test --config e2e/playwright.config.ts "$@"
