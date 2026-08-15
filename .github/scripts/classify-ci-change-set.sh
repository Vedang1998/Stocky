#!/usr/bin/env bash
# Tooling-only CI change-set classifier.
# Fail-closed: empty, unknown, mixed, unusable, or forced input => full_ci=true.
set -euo pipefail

ZERO_SHA="0000000000000000000000000000000000000000"

is_docs_only_path() {
  local path="${1-}"
  if [[ -z "${path}" ]]; then
    return 1
  fi
  case "${path}" in
    *$'\n'* | *$'\r'*) return 1 ;;
    *..*) return 1 ;;
    /*) return 1 ;;
    *\\*) return 1 ;;
    ./*) return 1 ;;
    AGENTS.md) return 0 ;;
    stocky-plus/docs) return 0 ;;
    stocky-plus/docs/*) return 0 ;;
  esac
  return 1
}

is_usable_sha() {
  local sha="${1-}"
  if [[ -z "${sha}" || "${sha}" == "${ZERO_SHA}" ]]; then
    return 1
  fi
  case "${sha}" in
    *[!0-9a-fA-F]*) return 1 ;;
  esac
  if [[ "${#sha}" -lt 7 ]]; then
    return 1
  fi
  return 0
}

ensure_commit() {
  local sha="$1"
  if git cat-file -e "${sha}^{commit}" 2>/dev/null; then
    return 0
  fi
  git fetch --no-tags --force origin "${sha}" >/dev/null 2>&1 || return 1
  git cat-file -e "${sha}^{commit}" 2>/dev/null
}

emit_classification() {
  local docs_only="$1"
  local full_ci="$2"
  echo "docs_only=${docs_only}"
  echo "full_ci=${full_ci}"
  if [[ -n "${GITHUB_OUTPUT-}" ]]; then
    {
      echo "docs_only=${docs_only}"
      echo "full_ci=${full_ci}"
    } >>"${GITHUB_OUTPUT}"
  fi
}

classify_paths() {
  local -a paths=("$@")
  local path
  if [[ "${#paths[@]}" -eq 0 ]]; then
    echo "changed_path_count=0"
    echo "classification_reason=empty_or_indeterminate_change_set"
    emit_classification "false" "true"
    return 0
  fi

  echo "changed_path_count=${#paths[@]}"
  local all_docs=1
  for path in "${paths[@]}"; do
    if is_docs_only_path "${path}"; then
      echo "changed_path [docs] ${path}"
    else
      echo "changed_path [full] ${path}"
      all_docs=0
    fi
  done

  if [[ "${all_docs}" -eq 1 ]]; then
    echo "classification_reason=every_changed_path_is_docs_allowlist"
    emit_classification "true" "false"
  else
    echo "classification_reason=non_docs_or_unknown_path"
    emit_classification "false" "true"
  fi
}

read_nul_paths() {
  local -a paths=()
  local path
  while IFS= read -r -d '' path; do
    paths+=("${path}")
  done
  classify_paths "${paths[@]+"${paths[@]}"}"
}

eval_ci_gate() {
  local classify_result="${1-}"
  local validate_result="${2-}"
  local full_ci="${3-}"
  local docs_only="${4-}"

  echo "gate_classify_result=${classify_result}"
  echo "gate_validate_result=${validate_result}"
  echo "gate_full_ci=${full_ci}"
  echo "gate_docs_only=${docs_only}"

  if [[ "${classify_result}" != "success" ]]; then
    echo "gate_result=FAIL classify_did_not_succeed"
    return 1
  fi
  if [[ "${full_ci}" == "true" ]]; then
    if [[ "${validate_result}" != "success" ]]; then
      echo "gate_result=FAIL full_ci_required_validate_${validate_result}"
      return 1
    fi
    echo "gate_result=SUCCESS full_validate_succeeded"
    return 0
  fi
  if [[ "${docs_only}" == "true" ]]; then
    echo "gate_result=SUCCESS docs_only_classify_succeeded"
    return 0
  fi
  echo "gate_result=FAIL indeterminate_classification"
  return 1
}

classify_from_git() {
  local base="${1-}"
  local head="${2-}"
  echo "compare_base=${base}"
  echo "compare_head=${head}"

  if ! is_usable_sha "${base}" || ! is_usable_sha "${head}"; then
    echo "range_usable=false"
    echo "classification_reason=unusable_comparison_range"
    emit_classification "false" "true"
    return 0
  fi
  if ! ensure_commit "${base}" || ! ensure_commit "${head}"; then
    echo "range_usable=false"
    echo "classification_reason=comparison_commits_unavailable"
    emit_classification "false" "true"
    return 0
  fi

  echo "range_usable=true"
  local -a paths=()
  local path
  while IFS= read -r -d '' path; do
    paths+=("${path}")
  done < <(git diff --name-only --no-renames -z "${base}" "${head}")

  classify_paths "${paths[@]+"${paths[@]}"}"

  echo "running git diff --check ${base} ${head}"
  git diff --check "${base}" "${head}"
}

usage() {
  cat <<'EOF'
Usage:
  classify-ci-change-set.sh --force-full
  classify-ci-change-set.sh --from-git <base-sha> <head-sha>
  classify-ci-change-set.sh --nul
  classify-ci-change-set.sh --eval-gate <classify> <validate> <full_ci> <docs_only>
  classify-ci-change-set.sh --paths <path>...
EOF
}

main() {
  if [[ $# -lt 1 ]]; then
    usage >&2
    exit 2
  fi
  case "$1" in
    --force-full)
      echo "classification_reason=force_full"
      emit_classification "false" "true"
      ;;
    --from-git)
      if [[ $# -ne 3 ]]; then
        usage >&2
        exit 2
      fi
      classify_from_git "$2" "$3"
      ;;
    --nul)
      read_nul_paths
      ;;
    --eval-gate)
      if [[ $# -ne 5 ]]; then
        usage >&2
        exit 2
      fi
      eval_ci_gate "$2" "$3" "$4" "$5"
      ;;
    --paths)
      shift
      classify_paths "$@"
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
