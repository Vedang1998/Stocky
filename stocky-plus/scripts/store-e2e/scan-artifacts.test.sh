#!/usr/bin/env bash
# Self-test for scan-artifacts.sh. Run: bash scripts/store-e2e/scan-artifacts.test.sh
set -euo pipefail

scan="$(cd "$(dirname "$0")" && pwd)/scan-artifacts.sh"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
failures=0

expect() {
  local want="$1" label="$2"
  shift 2
  local got=0
  "$@" >/dev/null 2>&1 || got=$?
  if { [ "${want}" = pass ] && [ "${got}" -ne 0 ]; } || { [ "${want}" = fail ] && [ "${got}" -eq 0 ]; }; then
    echo "FAIL: ${label} (exit ${got})"
    failures=$((failures + 1))
  else
    echo "ok: ${label}"
  fi
}

case_dir() {
  rm -rf "${work}/logs" && mkdir -p "${work}/logs"
  printf '%s\n' "$1" >"${work}/logs/app.log"
}

case_dir "GET /app 200 - - 12 ms"
expect pass "clean log passes" env SHOPIFY_API_SECRET=fixture-secret-value "${scan}" "${work}/logs"

case_dir "boot with fixture-secret-value in config"
expect fail "client secret is found" env SHOPIFY_API_SECRET=fixture-secret-value "${scan}" "${work}/logs"

case_dir "key=fixture-generated-key-123"
expect fail "generated key is found" env SESSION_TOKEN_ENCRYPTION_KEY=fixture-generated-key-123 "${scan}" "${work}/logs"

case_dir "authorization: Bearer abcdefghijklmnopqrstuvwxyz0123"
expect fail "bearer header is found" "${scan}" "${work}/logs"

case_dir "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig"
expect fail "session token is found" "${scan}" "${work}/logs"

case_dir "offline token shpua_0123456789abcdef"
expect fail "Shopify token prefix is found" "${scan}" "${work}/logs"

case_dir "GET /app 200"
chmod 000 "${work}/logs/app.log"
if [ "$(id -u)" -ne 0 ]; then
  expect fail "unreadable file fails the scan" "${scan}" "${work}/logs"
fi
chmod 644 "${work}/logs/app.log"

expect pass "missing paths pass" "${scan}" "${work}/does-not-exist"

if output="$(env SHOPIFY_API_SECRET=fixture-secret-value bash -c "printf 'x fixture-secret-value' >'${work}/logs/app.log'; '${scan}' '${work}/logs'" 2>&1)"; then :; fi
if printf '%s' "${output}" | grep -qF fixture-secret-value; then
  echo "FAIL: scan output must not contain the matched value"
  failures=$((failures + 1))
else
  echo "ok: scan output does not echo the matched value"
fi

[ "${failures}" -eq 0 ]
