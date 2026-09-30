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

## 4. SC-R-08 process-loss test-readiness repair

**Repair key:** `propo:issue67:PR68_PROCESS_LOSS_READINESS_REPAIR:efc1a17c77537fcf98bcca05fa190f14a1696e24:cursor`

**Input head (frozen BLOCKED candidate):** `efc1a17c77537fcf98bcca05fa190f14a1696e24`

**Historical exact-head failure (retained, not rerun-to-green):** `pull_request` run `36662919664` · Heavy `109721380748` FAILURE · Gate `109731058087` FAILURE · `source-stage.test.ts:573` `ENOENT` on `source.jsonl` after `stage=parked`.

### Diagnosis (verified by source, not by replaying Actions timing)

The process-loss child publishes `stage=parked` from its generator at record 40 (`readiness: "generator_only"`). That status word does not mean the `createWriteStream` consumer has created or flushed `source.jsonl`. SC-R-08 previously `readFileSync`'d immediately; the sibling process-loss test used `existsSync` then `readFileSync` on the same signal. Both files were unchanged from base M (child blob `2f0430f750a68e0cbcc37e89d722b5da8bf04323`, test blob `deca125c116dc0601ec070494e922bd56add0e0a`). This is a harness readiness race, not an accepted PR6 semantics change.

### Repair

Parent tests now require, within the existing 20s `waitStatus` bound:

1. this test's child pid matching the status pid;
2. an owned `att-*` directory with a real marker file;
3. a readable nonempty `source.jsonl` prefix (actual bytes, re-read until the observed length is stable).

Generator progress, directory existence, a status word, or a fixed sleep are not treated as flushed bytes. The generator does not wait for the file (no circular wait); the child event loop remains able to complete consumer open/write while the parent polls. Kill uses only this child after pid match; observed `exit` is awaited. Cleanup is this child only.

Disposable negative variants (kept in the suite, labeled):

- delayed-write: child parks with no file until a parent release file; proves `parked` is premature and that the repaired wait observes nonempty bytes;
- never-ready: parks forever; wait fails at the existing 20s bound rather than hanging or passing;
- child-error: injected error fails fast inside that bound rather than passing.

These controls demonstrate the old premature-ready behavior under an explicit schedule. They do not claim to have reproduced the original Actions scheduler timing on every incidental local run.

Allowed paths only: `source-stage-process-loss-child.ts`, `source-stage.test.ts`, this report section. No production `source-stage.ts` change.

### Local evidence (this repair tree)

Recorded after execution on this tree. This section does not embed its own future commit SHA. Environment: Node v22.14.0, vitest 3.2.7.

Failed attempt (recorded, then corrected): first focused run after the wait-for-bytes change treated `child.pid` (tsx wrapper) as identical to `status.pid` (`process.pid` inside the script). Result: 4 failed / 1 passed / 44 skipped in 1.38s — `process-loss pid mismatch child.pid=11152 status.pid=11163` (and three sibling mismatches). Repair: prove the status pid is this spawn or a `/proc` descendant whose cmdline contains `source-stage-process-loss-child`, then SIGKILL only that inner pid plus the wrapper. No `pkill`.

| Check | Result |
|---|---|
| Focused process-loss + disposable negatives (after pid-ownership fix) | executed and passed — 5 passed / 44 skipped / 49 collected, exit 0, 21.47s. Never-ready case 20220ms (existing 20s bound). |
| `npx vitest run app/lib/order-facts/sync/source-stage.test.ts` | executed and passed — **49 tests**, exit 0, 31.07s |
| `npx vitest run app/lib/order-facts` | executed and passed — 33 files, **342 tests**, exit 0 |
| `npm run test:privacy` | executed and passed — 5 files, **45 tests**, exit 0 |
| `npm test` | executed and passed — 72 files, **715 tests**, exit 0 (712 on the blocked head plus 3 labeled disposable negatives) |
| `npx eslint` on the two repaired TS files; `npm run lint` | executed and passed, exit 0 |
| `npx tsc --noEmit` | executed and passed, exit 0 |
| `npx prisma validate` | executed and passed, schema valid |
| `npm run build` | executed and passed, exit 0 |
| Exact-head Classify / Heavy / Gate on the repaired head | pending automatic `pull_request` run after push; historical `36662919664` retained |
