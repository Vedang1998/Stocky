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
report() {
  echo "credential found ($1) in:" >&2
  printf '  %s\n' "$2" >&2
  found=1
}

for name in SHOPIFY_API_SECRET SESSION_TOKEN_ENCRYPTION_KEY TENANT_JOB_ENVELOPE_SECRET; do
  value="${!name:-}"
  [ -z "${value}" ] && continue
  if files="$(grep -rlaF -e "${value}" -- "${paths[@]}")"; then
    report "${name}" "${files}"
  fi
done

# Bearer headers, HS256 JWTs (session tokens), Shopify token prefixes.
pattern='Bearer [A-Za-z0-9._-]{20,}|eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|shp(at|ua|ss|rt|ca)_[A-Za-z0-9]{8,}'
if files="$(grep -rlaE -e "${pattern}" -- "${paths[@]}")"; then
  report "token pattern" "${files}"
fi

exit "${found}"
