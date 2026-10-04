# PR7 implementation report — checkpoint A

**Status:** `CHECKPOINT_B IMPLEMENTATION IN PROGRESS` (author evidence; not independent acceptance)

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
| Exact-head Classify / Heavy / Gate on the repaired head | historical success on C: `pull_request` `36791202683` (Classify `110144259801`, Heavy `110144293456`, Gate `110161831666`); A0 failure `36662919664` retained |

## 5. R1 correction (F-01…F-07)

**Dispatch-Key:** `propo:issue67:PR68_CHECKPOINT_A_R1:51c4b701b79249833ec22ed6bc96415fa8d8f3a4:cursor`

**Subject C:** `51c4b701b79249833ec22ed6bc96415fa8d8f3a4` · **Review R:** `12c7a709da01f28c739a5698ec040a5faceedbcb` (sole parent C; tree `0710c9ccbeee170b82e9f6882a55de359311365c`; blob `5ff31d304a5806e0b6640f7070ef7e595fffb106` for `PR7_CHECKPOINT_A_INDEPENDENT_REVIEW.md`). R is original history; this section is additive author evidence, not a rewrite of that review.

Round 1 of maximum 2. Not checkpoint B. Owner proof is still not consumed downstream. `useOnlineTokens` remains unset.

### Crosswalk

| Finding | Disposition |
|---|---|
| F-01 | Invalid/expired/malformed embedded credentials are converted at `requireAdminTenant` into the library refresh contract: Authorization present → thrown `Response` 401 + `X-Shopify-Retry-Invalid-Session-Request: 1`; document request → bounce `/auth/session-token`. The invalid token is **not** sent through `authenticate.admin`. Inner `gateAdminRequestIdentity` still throws `ActorBoundaryError` (not a route response). |
| F-02 | Executed `requireAdminTenant` tests call installed `shopifyApp().authenticate.admin` with synthetic tokens and mocked outbound transport (`require-admin-tenant-boundary.test.ts`). Source-text regex remains supplementary only. Success + dest/`session.shop` agreement with canonical Shop is in `authority.test.ts` (tenant-access / Heavy). |
| F-03 | Memo slot is `{binding, pending}` keyed by `Request`. Binding is request + idToken + actorSub + destShop + verifier apiKey, captured synchronously before any await. Identical concurrent calls coalesce. Changed inputs return `BINDING_CONFLICT` with no extra exchange and no cached owner. Production `fresh` bypass removed. Ordinary cached path is exercised without a test-only skip. |
| F-04 | Access token lives only in a module-private `WeakMap` on an authentic issued handle. No credential own-property/Symbol. Spread/clone/forged status cannot use the token. `toJSON` / `util.inspect.custom` redact. This does **not** stop a trusted callback that already received the string from logging it. |
| F-05 | Missing/non-finite provider expiry is `MISSING_EXPIRY` (unsupported). Invented now+24h default removed. Private `expiresAtMs` is rechecked at last protected use. Test clock is `__setOwnerProofNowMsForTests` only. Exact expiry boundary (`<=`) fails closed. Expiry during exchange await denies. Synthetic 401/403 remain; live Shopify revocation is UNEXECUTED. |
| F-06 | OPEN independent-evidence item, not a production-stager defect. Linux `/proc` ppid+cmdline ownership and sampled stable length (test-readiness, **not** fsync/durability/cross-process quiescence/production drain) are stated in the process-loss waiter comments and this section. Disposable premature parked-only control is in `source-stage.test.ts` (`DISPOSABLE NEGATIVE CONTROL (F-06)`): `readFileSync` of `source.jsonl` is `ENOENT` at `parked`; restored `waitOwnedNonemptySourceJsonl` then observes nonempty bytes. The next independent reviewer must execute that control; this author's run is not a substitute. |
| F-07 | Removed always-false `blocksAuthentication` and no-op `assertIdentityDoesNotBlock`. `verifyEmbeddedIdToken` now calls `decodeIdTokenAllowingUnsupportedSub`. Test-only `clientAccountOwner` input removed; forged body/JWT `account_owner` is ignored; grant still requires exchange `associated_user.account_owner === true` and not collaborator. `destHost` vs `session.shop` is compared in `requireAdminTenant` after auth and before tenant issuance. Intentionally retained: `ActorBoundaryError.toResponse()` JSON helper (unused by merchandising routes; HTTP path is `denyInvalidEmbeddedSession`). |

### Failed attempt (recorded)

First `npm run test:privacy` after the adapter change: 1 failed / 68 passed. `expires_in: Number.NaN` JSON-serializes as `null`, so Shopify session construction treated it as `expires_in=0` (`EXPIRED`) rather than `MISSING_EXPIRY`. Corrected the case to a malformed string `expires_in` (`"not-a-number"`). Privacy then 69/69.

### Local evidence (Node v22.14.0, vitest 3.2.7)

This section does not embed its own future commit SHA.

| Check | Result |
|---|---|
| `npm run test:privacy` | executed and passed — 6 files, **69 tests**, exit 0 |
| `npx vitest run --config vitest.privacy.config.ts -t "this-pattern-matches-zero-tests-on-purpose"` | executed and failed closed — 69 skipped, `[ci-guard]` zero-match, exit 1 |
| `npx vitest run app/lib/order-facts/sync/source-stage.test.ts` | executed and passed — **50 tests**, exit 0 (includes F-06 control; never-ready ~20216–20260ms) |
| process-loss + disposable subset | executed and passed — 6 passed / 44 skipped |
| `npx vitest run app/lib/order-facts` | executed and passed — 33 files, **343 tests**, exit 0 |
| `npm test` (after `graphql-codegen`) | executed and passed — 72 files, **716 tests**, exit 0 |
| `npx eslint` on R1 TS paths; `npm run lint` | executed and passed, exit 0 |
| `npx tsc --noEmit` | executed and passed, exit 0 |
| `npx prisma validate` | executed and passed |
| `npm run graphql-codegen` | executed and passed, exit 0 |
| `npm run build` | executed and passed, exit 0 |
| `authority.test.ts` installed-auth describe (local disposable Postgres) | authenticate.admin **did run** (offline token-exchange logs for `phase1-pr2-shop-a.myshopify.com`); dest vs `session.shop` check did not 401. Tenant issuance then failed `runtime_identity_rejected` (`expected=stocky_runtime:got=stocky`) because this environment is not the CI restricted-runtime catalog. **Not** counted as tenant-suite pass. Exact-head Heavy `test:tenant-access` is the required execution of that describe. |

### Limits (honest)

- Live Shopify / App Bridge tokens: UNEXECUTED.
- Real-provider revocation: UNEXECUTED (synthetic 401/403 only).
- F-06 independent re-execution: required of the next reviewer; author execution recorded above is not a substitute.
- Full tenant-access / migration / sync suites: not re-run locally; Heavy CI is the attributed execution when that run succeeds on the R1 head.
- Historical C success `36791202683` and A0 failure `36662919664` are retained; not rerun-to-green.

### Exact-head CI on `5470d69` (failed; not rerun-to-green)

Automatic `pull_request` run [36954009774](https://github.com/Vedang1998/Stocky/actions/runs/36954009774) · `head_sha=5470d695a789a1ae6b263e74712a6c39da75199c`.

| Job | ID | Result |
|---|---|---|
| Classify | `110672836583` | SUCCESS |
| Heavy | `110672865306` | FAILURE at **Tenant enforcement preflight** (`npm run tenant:enforcement:preflight`) |
| Gate | `110673754492` | FAILURE |

Preflight JSON: merchant tables all `ok:true`; `globalFailures:["tenant:access:inventory:check_failed_exit_1"]`; `driftClass:known_safe_partial_state`. Step 15 Tenant enforcement inventory freshness was SUCCESS. Privacy, unit, lint, typecheck, and build on that job were skipped after preflight.

Local `npm run tenant:access:inventory:check` on that same tree: exit 1, `PR2_TENANT_ACCESS_INVENTORY.md is stale`. Fresh `--stdout` vs checked-in:

| Field | Checked-in (`5470d69`) | Fresh scan |
|---|---|---|
| Content digest | `813ae4ad26a6c0e91cedf3ca64a5fafa8e14db7a256d05dc0a0e2fce10e7091a` | `efb65bb46f4f0b545036d7581cb09d70b333b7fa640065b98c992aeeaaf12361` |
| Scanned files | 521 | 522 |
| Findings | 1761 | 1764 |
| Approved exception findings | 1229 | 1232 |
| Violations | 0 | 0 |

Exact drifted paths (reported before expanding inventory scope):

1. `app/rbac/__tests__/require-admin-tenant-boundary.test.ts` — new R1 test home; scannedFiles +1; **no** Prisma findings.
2. `app/tenant/__tests__/authority.test.ts` — already EX-TEST-002. Existing write sites 37/38/43 moved to 52/53/58 (import/header growth). F-02 success describe added the same fixture at 202/203/207 (`shopSettings.deleteMany`, `supplier.deleteMany`, `shopSettings.createMany`).

No new exception IDs. No production Prisma/schema change. Regenerated only `docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`. After regen, `npm run tenant:access:inventory:check` printed `tenant_access_inventory_fresh` and exited 0. Findings **1764**, violations **0**, scannedFiles **522**, digest `efb65bb46f4f0b545036d7581cb09d70b333b7fa640065b98c992aeeaaf12361`.

Checkpoint B mark-ready, merge, production, and live Shopify certification remain forbidden until a complete B0 READY packet.

## 5. Checkpoint B implementation (author evidence; not independent acceptance)

**Dispatch-Key:** `propo:issue67:PR68_CHECKPOINT_B:02defc9233c4f8da66194eabad0cb77d30079e91:cursor`

RA `43c93e5` is the local parent of this B work. Exact-head CI and READY are recorded only after complete B proof.

Implemented in this pass (local coherent checkpoint, not B0 READY):

- R1-02/R1-03 owner-proof residuals.
- Additive Prisma models + `20260918120000_pr7_audit_roles_privacy` + helper SQL/roles/apply/verify.
- Audit emit, assignment grant/revoke, original-admin capture, writer admission, bound-effect host.
- Compliance intake + three processors + coordinator loop + owner download / escalation (same-origin; R1-01 deferred).
- Participating-write guards on named §7.9/W-derived hosts listed in the execution brief.
- Redis shop-scoped drain and D-scratch leftover fail-closed residual (no operator reclaim).
- Source scanner `scripts/privacy/participating-writers.ts` with omission controls.

This is **not** `PR7_IMPLEMENTATION_READY_FOR_INDEPENDENT_REVIEW`. Exact-head Classify+FULL Heavy+Gate and the remaining matrix executions are still required.
