#!/usr/bin/env bash
# Fails when any file under the given paths holds a credential: the E2E app's
# client secret, the run's generated keys, a session token, or a Shopify
# access token. Prints only file names, never the matched text.
# Usage: scan-artifacts.sh <path>...
set -euo pipefail

paths=()
for path in "$@"; do
  [ -e "${path}" ] && paths+=("${path}")
done
[ "${#paths[@]}" -eq 0 ] && exit 0

found=0

# grep exits 0 on a match, 1 on none, 2 on an error such as an unreadable
# file; an error must fail the scan, not pass it.
matching_files() {
  local status=0
  grep -rla "$@" -- "${paths[@]}" || status=$?
  if [ "${status}" -gt 1 ]; then
    echo "credential scan could not read every file" >&2
    exit 2
  fi
}

report() {
  echo "credential found ($1) in:" >&2
  printf '  %s\n' "$2" >&2
  found=1
}

for name in SHOPIFY_API_SECRET SESSION_TOKEN_ENCRYPTION_KEY TENANT_JOB_ENVELOPE_SECRET; do
  value="${!name:-}"
  [ -z "${value}" ] && continue
  files="$(matching_files -F -e "${value}")" || exit 2
  [ -n "${files}" ] && report "${name}" "${files}"
done

# Bearer headers, HS256 JWTs (session tokens), Shopify token prefixes.
pattern='Bearer [A-Za-z0-9._-]{20,}|eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|shp(at|ua|ss|rt|ca)_[A-Za-z0-9]{8,}'
files="$(matching_files -E -e "${pattern}")" || exit 2
[ -n "${files}" ] && report "token pattern" "${files}"

exit "${found}"
