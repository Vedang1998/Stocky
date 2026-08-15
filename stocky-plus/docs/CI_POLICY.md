# CI evidence policy

This is an engineering/tooling policy for GitHub Actions consumption and
exact-head evidence. It does not change product behavior.

The workflow is `.github/workflows/ci.yml`.

## Cost / safety principle

Run expensive evidence when it can detect a regression.

Docs-only diffs cannot change runtime, schema, or CI behavior, so they must not
start PostgreSQL or Redis. A workflow, application, schema, script, or mixed
diff must still run the full suite.

## Triggers

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
```

- Open PR automatic evidence: the `pull_request` workflow at the exact head.
  Duplicate feature-branch `push` CI is not required and is not configured.
- `main` retains post-merge `push` CI.
- `workflow_dispatch` is the explicit full-CI escape hatch. ChatGPT may request
  it when a manual exact-head full run is required.

## Classification (fail-closed)

A lightweight `classify` job compares:

- pull_request: `github.event.pull_request.base.sha` →
  `github.event.pull_request.head.sha`
- push: `github.event.before` → `github.sha`
- workflow_dispatch: always full CI
- missing, all-zero, or unusable comparison range: full CI
- empty or indeterminate changed-file set: full CI

Docs-only is a narrow allowlist. `docs_only=true` only when there is at least
one changed file and every changed file is:

- `stocky-plus/docs/**`
- `AGENTS.md`

Everything else is `full_ci=true`, including `.github/**`, `stocky-plus/app/**`,
`stocky-plus/prisma/**`, `stocky-plus/scripts/**`, lockfiles, Shopify config,
GraphQL documents, TypeScript/build/test config, unknown paths, and mixed
docs + runtime diffs.

Classifier logic lives in `.github/scripts/classify-ci-change-set.sh` and is
covered by `.github/scripts/classify-ci-change-set.test.sh`.

## Jobs

1. `Classify change set` — native `git` path listing (`actions/checkout@v4`,
   `fetch-depth: 0`). No third-party path-filter action. Prints changed paths
   and classification. Runs `git diff --check` on the compared range when the
   range is usable.
2. `Lint, typecheck, test, build, Prisma, GraphQL` — existing heavy validate
   job, unchanged in substance. Runs only when `full_ci=true`. Starts
   PostgreSQL and Redis only in that case.
3. `CI Gate` — stable final check (`if: always()`, needs classify + validate):
   - classify failure → FAIL
   - `docs_only=true` and classify succeeded → SUCCESS
   - `full_ci=true` → SUCCESS only if validate succeeded
   - full CI required but validate skipped, cancelled, or failed → FAIL

Skipped heavy CI must not count as success for a runtime change.

## Concurrency

`cancel-in-progress` remains enabled. The group is
`github.workflow` + pull-request number, falling back to `github.ref`, so:

- new commits to the same PR cancel obsolete runs for that PR;
- PR runs do not cancel `main` runs;
- one PR does not cancel another PR;
- this workflow does not cancel unrelated workflows.

## Branch-protection note

The heavy job keeps the historical check name
`Lint, typecheck, test, build, Prisma, GraphQL`. After this policy lands, the
stable always-present check is `CI Gate`. GitHub may treat a skipped required
check as success, so `CI Gate` should be the merge gate once the repository
ruleset is updated. This file does not change the ruleset.

## Out of scope

This policy does not authorize weakening tests, skipping full CI for workflow
changes, editing product documents, starting PR 5, or creating D-054.
