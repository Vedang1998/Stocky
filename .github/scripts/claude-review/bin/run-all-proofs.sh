#!/usr/bin/env bash
# Credential-free authoring proofs for the bounded Claude review runner.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
CR="${ROOT}/.github/scripts/claude-review"
export PATH="${PATH}"

PASS=0
FAIL=0
ASSERTIONS=0

pass() { PASS=$((PASS + 1)); ASSERTIONS=$((ASSERTIONS + 1)); echo "PASS: $*"; }
fail() { FAIL=$((FAIL + 1)); ASSERTIONS=$((ASSERTIONS + 1)); echo "FAIL: $*"; }

echo "=== versions ==="
echo "node=$(node -v)"
echo "npm=$(npm -v || true)"
echo "psql=$(psql --version 2>/dev/null || echo missing)"
echo "redis=$(redis-server --version 2>/dev/null || echo missing)"
echo "actionlint=$(actionlint -version 2>/dev/null || echo missing)"
echo "docker=$(command -v docker >/dev/null && echo present || echo missing)"

echo "=== YAML parse ==="
python3 - "${ROOT}/.github/workflows/main.yml" "${ROOT}/.github/workflows/claude-review-execution.yml" <<'PY'
import pathlib, sys
try:
    import yaml
except ImportError:
    for p in sys.argv[1:]:
        text = pathlib.Path(p).read_text()
        assert "on:" in text
    print("yaml_fallback_ok")
    raise SystemExit(0)
for p in sys.argv[1:]:
    list(yaml.safe_load_all(pathlib.Path(p).read_text()))
    print(f"yaml_ok {p}")
PY
pass "yaml parse"

echo "=== actionlint ==="
if command -v actionlint >/dev/null; then
  actionlint -shellcheck= "${ROOT}/.github/workflows/main.yml" "${ROOT}/.github/workflows/claude-review-execution.yml"
  pass "actionlint"
else
  echo "BLOCKED: actionlint not installed"
  fail "actionlint missing"
fi

echo "=== node:test ==="
cd "${CR}"
set +e
node --test --test-reporter=spec tests/*.test.js
TEST_RC=$?
set -e
if [[ "${TEST_RC}" -ne 0 ]]; then
  fail "node:test exit ${TEST_RC}"
else
  pass "node:test"
fi

echo "=== classifier self-test (unmodified) ==="
bash "${ROOT}/.github/scripts/classify-ci-change-set.test.sh"
pass "classifier self-test"

echo
echo "assertions=${ASSERTIONS} pass=${PASS} fail=${FAIL}"
if [[ "${ASSERTIONS}" -eq 0 ]]; then
  echo "FAIL: zero assertions"
  exit 1
fi
if [[ "${FAIL}" -ne 0 ]]; then
  exit 1
fi
echo "run-all-proofs OK"
