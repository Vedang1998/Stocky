# PR7 implementation report — checkpoint A

**Status:** `CHECKPOINT_A IMPLEMENTATION IN PROGRESS` (author evidence; not independent acceptance)

**Date:** 2026-09-30

**Dispatch key:** `propo:5900247427:PR7_RUNTIME_IMPLEMENTATION:338717b8299016b37c02e5bdd452cc64f6161bdb:cursor`

**Run:** `bc-dedc6c27-79fa-409b-8a95-c0a3d36efff3` · model `cursor-grok-4.6-xhigh`

**Base M:** `338717b8299016b37c02e5bdd452cc64f6161bdb` · tree `aeb8653755718c25daeef8399777c4a5b9a96700`

**Branch:** `phase-1/pr7-audit-roles-privacy-fff3`

This report is updated as implementation and local/CI evidence land. It does **not** claim `PR7_AUTH_CHECKPOINT_READY` until coherent checkpoint A code/tests and exact-head full Classify/Heavy/Gate success exist. It does **not** start checkpoint B.

## 1. What was implemented (checkpoint A)

- Embedded ID-token gate using installed `decodeSessionToken` (HS256 / aud / exp / nbf) plus in-app iss/dest hostname agreement and exact-string `sub`.
- Request-bound owner-proof adapter: isolated online token-exchange, `associated_user` binding check **before** any use of the returned access token, no adoption of the library online session cache, no offline fallback after failed human permissions.
- Narrow `requireAdminTenant` attachment of actor resolution. Merchandising remains tenant-only. Owner proof is **not** consumed by merchandising, afterAuth, or downloads.
- `test:privacy` + CI step with zero-collection failure.
- AUTH-X counterexample regressions against the real `authenticate.admin` boundary (mocked transport only).

## 2. What remains unexecuted / blocked

| Item | State |
|---|---|
| Live Shopify / App Bridge ID tokens | UNEXECUTED |
| Global `useOnlineTokens` | still disabled (required) |
| Owner role bootstrap / owner-only download | not started (A freeze) |
| Checkpoint B module | not authorized until CONTINUE |
| Q-008 | OPEN |
| Production / inventory writes / merge | NOT AUTHORIZED |
| Exact-head CI | recorded below when available |

## 3. Evidence

See `PR7_TEST_TO_REQUIREMENT_MAP.md`. Exact commit SHA is recorded after push; this file does not embed its own future SHA.

| Check | Result |
|---|---|
| `npm run test:privacy` | executed and passed — 5 files, **45 tests**, exit 0 (vitest 3.2.7, Node v22.14.0) |
| `npx vitest run --config vitest.privacy.config.ts -t "this-pattern-matches-zero-tests-on-purpose"` | executed and failed closed — 45 skipped, `[ci-guard] testNamePattern … matched zero passing tests`, process exit 1 |
| `npx eslint` on `app/rbac`, `require-admin-tenant.server.ts`, `authority.test.ts`, `vitest.privacy.config.ts` | executed and passed, exit 0 |
| `npx tsc --noEmit` | executed and passed, exit 0 |
| `npm run tenant:access:inventory` | regenerated; scanned files 507 → 521; **violations 0**; digest unchanged |
| `npm run sync:inventory:check` | executed and passed |
| Local PostgreSQL / Redis for remaining CI suites | not observed running in this environment; remaining lint/typecheck/build/unit/tenant/sync suites follow on this candidate and on exact-head Actions |
| Exact-head Classify / Heavy / Gate | recorded after the draft PR run terminates |
