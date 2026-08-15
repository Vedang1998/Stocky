#!/usr/bin/env bash
# Deterministic self-test for the CI change-set classifier and gate.
# No packages or GitHub API tokens. Fails if zero assertions run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLASSIFY="${ROOT}/.github/scripts/classify-ci-change-set.sh"
PASS=0
FAIL=0
ASSERTIONS=0

fail() {
  FAIL=$((FAIL + 1))
  ASSERTIONS=$((ASSERTIONS + 1))
  echo "FAIL: $*"
}

pass() {
  PASS=$((PASS + 1))
  ASSERTIONS=$((ASSERTIONS + 1))
  echo "PASS: $*"
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local name="$3"
  if grep -F -q -- "${needle}" <<<"${haystack}"; then
    pass "${name}"
  else
    fail "${name}: expected to contain ${needle}"
    echo "--- output ---"
    echo "${haystack}"
    echo "--------------"
  fi
}

assert_exit() {
  local expected="$1"
  local actual="$2"
  local name="$3"
  if [[ "${expected}" == "${actual}" ]]; then
    pass "${name}"
  else
    fail "${name}: expected exit ${expected}, got ${actual}"
  fi
}

classify_paths() {
  bash "${CLASSIFY}" --paths "$@"
}

echo "=== positive: docs-only paths ==="
out="$(classify_paths "stocky-plus/docs/CI_POLICY.md" "stocky-plus/docs/README.md")"
assert_contains "${out}" "docs_only=true" "docs tree is docs_only"
assert_contains "${out}" "full_ci=false" "docs tree is not full_ci"

echo "=== positive: AGENTS.md only ==="
out="$(classify_paths "AGENTS.md")"
assert_contains "${out}" "docs_only=true" "AGENTS.md is docs_only"
assert_contains "${out}" "full_ci=false" "AGENTS.md is not full_ci"

echo "=== positive: mixed allowlist docs + AGENTS.md ==="
out="$(classify_paths "AGENTS.md" "stocky-plus/docs/phases/README.md")"
assert_contains "${out}" "docs_only=true" "allowlist mix is docs_only"

echo "=== negative: runtime path ==="
out="$(classify_paths "stocky-plus/app/root.tsx")"
assert_contains "${out}" "docs_only=false" "app path is not docs_only"
assert_contains "${out}" "full_ci=true" "app path is full_ci"

echo "=== negative: workflow path ==="
out="$(classify_paths ".github/workflows/ci.yml")"
assert_contains "${out}" "full_ci=true" "workflow change is full_ci"
assert_contains "${out}" "docs_only=false" "workflow change is not docs_only"

echo "=== negative: mixed docs + runtime ==="
out="$(classify_paths "stocky-plus/docs/README.md" "stocky-plus/package.json")"
assert_contains "${out}" "full_ci=true" "mixed docs+runtime is full_ci"
assert_contains "${out}" "docs_only=false" "mixed docs+runtime is not docs_only"

echo "=== fail-closed: empty change set ==="
out="$(classify_paths)"
assert_contains "${out}" "full_ci=true" "empty set is full_ci"
assert_contains "${out}" "docs_only=false" "empty set is not docs_only"

echo "=== fail-closed: unknown path ==="
out="$(classify_paths "mystery/file.txt")"
assert_contains "${out}" "full_ci=true" "unknown path is full_ci"

echo "=== fail-closed: force-full ==="
out="$(bash "${CLASSIFY}" --force-full)"
assert_contains "${out}" "full_ci=true" "force-full is full_ci"
assert_contains "${out}" "docs_only=false" "force-full is not docs_only"

echo "=== bypass: docs prefix without slash ==="
out="$(classify_paths "stocky-plus/docs-secret/README.md")"
assert_contains "${out}" "full_ci=true" "docs-secret prefix is full_ci"

echo "=== bypass: path traversal ==="
out="$(classify_paths "stocky-plus/docs/../../.github/workflows/ci.yml")"
assert_contains "${out}" "full_ci=true" "traversal is full_ci"

echo "=== bypass: AGENTS.md suffix/prefix ==="
out="$(classify_paths "AGENTS.md.bak")"
assert_contains "${out}" "full_ci=true" "AGENTS.md.bak is full_ci"
out="$(classify_paths "stocky-plus/AGENTS.md")"
assert_contains "${out}" "full_ci=true" "nested AGENTS.md is full_ci"
out="$(classify_paths "./AGENTS.md")"
assert_contains "${out}" "full_ci=true" "./AGENTS.md is full_ci"

echo "=== bypass: absolute path ==="
out="$(classify_paths "/workspace/AGENTS.md")"
assert_contains "${out}" "full_ci=true" "absolute path is full_ci"

echo "=== drift: scripts and prisma are full ==="
out="$(classify_paths "stocky-plus/scripts/foo.sh")"
assert_contains "${out}" "full_ci=true" "scripts path is full_ci"
out="$(classify_paths "stocky-plus/prisma/schema.prisma")"
assert_contains "${out}" "full_ci=true" "prisma path is full_ci"

echo "=== gate: classify failure ==="
set +e
bash "${CLASSIFY}" --eval-gate failure skipped false true
gate_rc=$?
set -e
assert_exit 1 "${gate_rc}" "gate fails when classify failed"

echo "=== gate: docs-only success ==="
set +e
bash "${CLASSIFY}" --eval-gate success skipped false true
gate_rc=$?
set -e
assert_exit 0 "${gate_rc}" "gate succeeds for docs-only classify"

echo "=== gate: full_ci + validate success ==="
set +e
bash "${CLASSIFY}" --eval-gate success success true false
gate_rc=$?
set -e
assert_exit 0 "${gate_rc}" "gate succeeds when full validate succeeded"

echo "=== gate: full_ci + validate skipped (false pass prevention) ==="
set +e
bash "${CLASSIFY}" --eval-gate success skipped true false
gate_rc=$?
set -e
assert_exit 1 "${gate_rc}" "gate fails when full CI required but validate skipped"

echo "=== gate: full_ci + validate cancelled ==="
set +e
bash "${CLASSIFY}" --eval-gate success cancelled true false
gate_rc=$?
set -e
assert_exit 1 "${gate_rc}" "gate fails when full CI required but validate cancelled"

echo "=== gate: full_ci + validate failure ==="
set +e
bash "${CLASSIFY}" --eval-gate success failure true false
gate_rc=$?
set -e
assert_exit 1 "${gate_rc}" "gate fails when validate failed"

echo "=== gate: indeterminate outputs ==="
set +e
bash "${CLASSIFY}" --eval-gate success skipped false false
gate_rc=$?
set -e
assert_exit 1 "${gate_rc}" "gate fails closed on indeterminate classification"

echo "=== gate: full_ci takes precedence over docs_only ==="
set +e
bash "${CLASSIFY}" --eval-gate success skipped true true
gate_rc=$?
set -e
assert_exit 1 "${gate_rc}" "gate does not false-pass inconsistent full_ci+docs_only"

echo "=== git range: docs-only repo fixture ==="
tmp="$(mktemp -d)"
cleanup() { rm -rf "${tmp}"; }
trap cleanup EXIT
git -C "${tmp}" init -q
git -C "${tmp}" config user.email "ci-classifier@example.test"
git -C "${tmp}" config user.name "CI Classifier"
mkdir -p "${tmp}/stocky-plus/docs"
echo "a" >"${tmp}/stocky-plus/docs/a.md"
echo "agents" >"${tmp}/AGENTS.md"
git -C "${tmp}" add AGENTS.md stocky-plus/docs/a.md
git -C "${tmp}" commit -q -m "base"
base="$(git -C "${tmp}" rev-parse HEAD)"
echo "b" >"${tmp}/stocky-plus/docs/b.md"
git -C "${tmp}" add stocky-plus/docs/b.md
git -C "${tmp}" commit -q -m "docs only"
head="$(git -C "${tmp}" rev-parse HEAD)"
out="$(
  cd "${tmp}"
  bash "${CLASSIFY}" --from-git "${base}" "${head}"
)"
assert_contains "${out}" "docs_only=true" "git docs-only range is docs_only"
assert_contains "${out}" "range_usable=true" "git docs-only range is usable"

echo "=== git range: mixed runtime change ==="
echo "runtime" >"${tmp}/stocky-plus/app.ts"
git -C "${tmp}" add stocky-plus/app.ts
git -C "${tmp}" commit -q -m "runtime"
head2="$(git -C "${tmp}" rev-parse HEAD)"
out="$(
  cd "${tmp}"
  bash "${CLASSIFY}" --from-git "${base}" "${head2}"
)"
assert_contains "${out}" "full_ci=true" "git mixed range is full_ci"

echo "=== git range: unusable all-zero before ==="
out="$(
  cd "${tmp}"
  bash "${CLASSIFY}" --from-git "0000000000000000000000000000000000000000" "${head2}"
)"
assert_contains "${out}" "full_ci=true" "all-zero before is full_ci"
assert_contains "${out}" "range_usable=false" "all-zero before is unusable"

echo "=== git range: empty comparison ==="
out="$(
  cd "${tmp}"
  bash "${CLASSIFY}" --from-git "${head2}" "${head2}"
)"
assert_contains "${out}" "full_ci=true" "empty git range is full_ci"
assert_contains "${out}" "docs_only=false" "empty git range is not docs_only"

echo "=== git range: rename out of docs is full (no-renames) ==="
mkdir -p "${tmp}/stocky-plus/app"
git -C "${tmp}" mv stocky-plus/docs/b.md stocky-plus/app/b.ts
git -C "${tmp}" commit -q -m "rename docs to app"
head3="$(git -C "${tmp}" rev-parse HEAD)"
out="$(
  cd "${tmp}"
  bash "${CLASSIFY}" --from-git "${head2}" "${head3}"
)"
assert_contains "${out}" "full_ci=true" "rename out of docs is full_ci"

if [[ "${ASSERTIONS}" -eq 0 ]]; then
  echo "FAIL: no assertions executed"
  exit 1
fi

echo
echo "assertions=${ASSERTIONS} pass=${PASS} fail=${FAIL}"
if [[ "${FAIL}" -ne 0 ]]; then
  exit 1
fi
if [[ "${PASS}" -eq 0 ]]; then
  echo "FAIL: zero passing assertions"
  exit 1
fi
echo "classify-ci-change-set self-test OK"
