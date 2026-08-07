# Phase 1 PR 4 — D-046 Correction Independent Review Report

**Reviewer:** Claude Code (independent principal engineer / architecture, security, release-risk review)
**Decision under review:** D-046 — Phase 1 PR 4 review corrections required
**Review date:** 2026-08-06
**Status of this document:** IMMUTABLE — do not edit; supersede with a new report if further review occurs.

> This report records independent verification only. It does not authorize merge,
> ready-for-review, PR 5, inventory writes, or any production activity.

---

## 1. Identity gate

| Condition | Required | Observed | Result |
|---|---|---|---|
| PR #20 state | OPEN, DRAFT, UNMERGED | `state=open`, `draft=true`, `merged=false` | PASS |
| Reviewed head | `f8673b062eee59a6db2a053b2c20aca7ce756a0b` | PR `head.sha` = `f8673b06…`; local `git rev-parse HEAD` = `f8673b06…` | PASS |
| Base / merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | PR `base.sha` = `e69bc53d…`; `git merge-base` = `e69bc53d…` | PASS |
| Exact-head CI | run `31110954422` success on that SHA | workflow `CI`, run_number 196, `event=pull_request`, `head_sha=f8673b06…`, `status=completed`, `conclusion=success` | PASS |
| No later identity change | head is branch tip | `origin/phase-1/sync-control-plane` tip = `f8673b06…` | PASS |
| Inventory-write flags OFF | all OFF | `.env.example` `FEATURE_STOCKTAKE_INVENTORY_WRITES=false`; `vitest.db-isolation.config.ts` / `vitest.tenant-access.config.ts` force `"false"`; CI env sets all five write flags `"false"` | PASS |
| Q-003 OPEN | OPEN | `OPEN_QUESTIONS.md` line 7 — **Open — Decision target 2026-07 (D-042)** | PASS |
| F-PR4-18 OPEN | OPEN | `PROJECT_STATUS.md` line 64 — "F-PR4-18 residual remains" | PASS |
| PR 5 / production unauthorized | unauthorized | `PROJECT_STATUS.md` lines 17, 71–77 | PASS |

**Identity gate: PASS.** Review proceeded.

---

## 2. Commands executed (all directly run by this reviewer)

Environment reconstructed to match `.github/workflows/ci.yml`: PostgreSQL 16 (local
cluster, `stocky_plus_ci`), Redis 7, Node v22.22.2, npm pinned to `11.5.2`, identical
CI env block including all five inventory-write flags `false`.

Setup: `npm ci`; `npx prisma generate`; `npx prisma validate`; `npx prisma migrate deploy`;
`tenant:indexes:apply --apply`; `tenant:indexes:verify`; `tenant:schema:drift`;
`tenant:indexes:plan`; `tenant:enforcement:inventory:check`; `tenant:roles:provision --apply`;
`tenant:enforcement:preflight`; `tenant:enforcement:apply --apply`; `tenant:roles:verify`;
`tenant:rls:verify`; `tenant:immutability:verify`; `tenant:enforcement:verify`;
`tenant:enforcement:drift` — **all exit 0**.

| Command | Result | Exit |
|---|---|:---:|
| `npm run test:sync-exactly-once` | Test Files 2 passed (2); **Tests 42 passed (42)** | 0 |
| `npm run test:sync-final-correction` | **21 passed (21)** | 0 |
| `npm run test:sync-dispatch-recovery` | **29 passed (29)** | 0 |
| `npm run test:sync-attempt-recovery` | **16 passed (16)** | 0 |
| `npm run test:sync-envelope-fail-closed` | **6 passed (6)** | 0 |
| `npm run test:sync-uninstall` | **8 passed (8)** | 0 |
| `npm run test:sync-integration` | Test Files 14 passed (14); **175 passed (175)** | 0 |
| `npm run test:sync-role-isolation` | **9 passed (9)** | 0 |
| `npm run test:sync-inventory-audit` | **5 passed (5)** | 0 |
| `npm run test:db-isolation` | Test Files 2 passed (2); **19 passed (19)** | 0 |
| `npm run test:tenant-access` | Test Files 34 passed (34); **288 passed (288)** | 0 |
| `npm run test:migrations` | Test Files 47 passed (47); **219 passed (219)** | 0 |
| `SYNC_PERF_JOB_COUNT=50000 npm run test:sync-performance` ×5 | **1 passed (1)** each of 5 runs | 0 ×5 |
| All 27 CI `-t` focused gates (enumerated from `ci.yml`) | each executed 1–2 real tests, all passed | 0 ×27 |
| `npm run lint` | clean | 0 |
| `npm run typecheck` | `react-router typegen && tsc --noEmit` clean | 0 |
| `npm run build` | built | 0 |
| `npm run tenant:access:audit` | `tenant_access_audit_ok`, modelsCovered 19 | 0 |
| `npm run tenant:access:inventory:check` | `tenant_access_inventory_fresh` | 0 |
| `npm run sync:inventory:check` | `ok surfaces=36 digest=48e62809a4c8…` | 0 |
| `npm run graphql-codegen` | clean; working tree remained clean afterwards | 0 |

Every count above matches the Cursor implementation report exactly. No skipped or
`.only` tests exist in `app/sync/__tests__/`. No `continue-on-error`, retry action,
`|| true`, or `sleep` appears in `ci.yml`.

---

## 3. Finding-by-finding verification

### NEW-CLAUDE-D045-01 — queue-classification seam — **VERIFIED**

| Requirement | Evidence | Result |
|---|---|---|
| Production-reachable seam removed | `__setQueueStateClassificationSeamForTests` and `testStateClassificationSeam` return **zero** matches anywhere in `app/` outside the negative guards in `sync-final-correction.test.ts:565–575` | PASS |
| `classifyQueueState(state)` pure | `queue-presence.server.ts:59–67` — total function of its argument; no module state, no env read, no override parameter | PASS |
| `classifyExistingQueueJob` performs real `getState()` | `queue-presence.server.ts:96–110` — `await job.getState()`, no interception | PASS |
| Queue errors fail closed | `queue-presence.server.ts:100–107` — `catch` returns `{status:"QUEUE_UNAVAILABLE"}`; `inspectQueueDispatchPresence:145–150` does the same for `getJob` | PASS |
| Unknown future states test-local only | `sync-dispatch-recovery.test.ts:40` and `sync-final-correction.test.ts:47` use `vi.spyOn(Job.prototype,"getState")`, restored in `finally`; pure-classifier assertions at `sync-dispatch-recovery.test.ts:204–216` and `sync-final-correction.test.ts:554–560` | PASS |
| No mutable global / production seam remains | Runtime `ForTests` sweep returns only lifecycle resets (`resetQueueClientsForTests`, `resetControlPlanePrismaForTests`, `resetPrismaSingletonForTests`, `resetVerifiedPrismaSingletonForTests`, `resetLegacyEvidenceLimitForTests`) — none alters classification. `resolveTestRedisFastFailMs` (`:74–89`) is `NODE_ENV==="test"`-gated, timeout-only, bounded | PASS |

Executed gate: `test:sync-final-correction -t "production queue-presence exports no classification seam"` → 1 passed.

### NEW-CLAUDE-D045-02 — genuine v2/v3 worker catch path — **VERIFIED**

`app/sync/__tests__/sync-d046-worker-finalize.test.ts` imports the real
`processWebhookJob` from `../../jobs/workers/webhook-processor` (line 113) and invokes it
in all six cases. It is **not** a finalizer-only shim.

| Case | Assertion | Line | Result |
|---|---|---|---|
| v3 matching | `state === "SUCCEEDED"`, `applicationStatus === "already_applied_verified_after_rollback"` | 340–347 | PASS |
| v2 matching | same pair | 378–385 | PASS |
| v3 digest conflict | `DEAD_LETTERED`, `failureCode === APPLICATION_DIGEST_CONFLICT`, 1 OPEN dead letter | 406–415 | PASS |
| v2 digest conflict | `DEAD_LETTERED`, `APPLICATION_DIGEST_CONFLICT` | 430–431 | PASS |
| v3 missing outcome | `DEAD_LETTERED`, `APPLICATION_OUTCOME_UNCERTAIN`, zero receipts | 455–462 | PASS |
| v2 missing outcome | `DEAD_LETTERED`, `APPLICATION_OUTCOME_UNCERTAIN` | 480–481 | PASS |

All six are explicit and meaningful: each also asserts `salesDailyAggregate` count is
unchanged, so a silently-applied side effect would fail the test.

RepeatableRead is observed on the **real** Prisma call: the spy at lines 148–169 wraps
`PrismaClient.prototype.$transaction` and delegates to the captured original, recording
`options.isolationLevel`; assertions at 354–356 and 496–498 require
`Prisma.TransactionIsolationLevel.RepeatableRead`. The tenant DB shim (lines 81–95)
forwards `options` as the second argument to `client.$transaction`, so isolation is not
discarded — the earlier D-045 defect is corrected.

CI gates are genuine, not aliases. I enumerated every `-t` gate from `ci.yml` and ran
each: all 27 executed real tests (1–2 passed each). Specifically the five
NEW-CLAUDE-D045-02 gates run 1, 1, 2, 2, 1 tests respectively, and
`test:sync-exactly-once` genuinely includes the new file (`package.json:43`).

### NEW-CLAUDE-D045-03 — identity labels — **VERIFIED**

`PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_IMPLEMENTATION_REPORT.md` replaced the single
stale row `Final runtime/test head = 10a9154…` with four distinct rows. Each label was
checked against `git log -1 --format=%s`:

| SHA | Label | Actual commit subject | Result |
|---|---|---|---|
| `10a9154e…` | primary D-045 head before mechanical completions | `fix(sync): D-045 SC02–SC06 and SC08 reliability corrections` | accurate |
| `7b908e05…` | receipt-hook removal (completion 1) | `fix(sync): D-045 remove production receipt test hooks` | accurate |
| `c1c85549…` | dead-letter-hook removal / reviewed implementation | `fix(sync): D-045 remove dead-letter transition test hook` | accurate |
| `ef452bb9…` | independent D-045 review-report commit | `docs(review): add D-045 final correction review` | accurate |

Implementation, review, correction-start, and current review SHAs are no longer
conflated. **No immutable review report was rewritten**: `git log ef452bb9..f8673b06 --
'*REVIEW_REPORT.md'` returns **zero commits**. The correction was made in an
*implementation* report, which is the correct target. `PROJECT_STATUS.md` and
`docs/phases/phase-1/README.md` describe PR 4 as unaccepted, PR 5 blocked, production
unauthorized — truthful as of this head.

### NEW-CLAUDE-D045-04 — attempt-count persistence — **VERIFIED**

`dispatcher.server.ts:900–912` — the `ENQUEUED → FAILED` update now sets
`"attemptCount" = ${input.nextAttemptCount}` atomically with the state transition.

| Requirement | Evidence | Result |
|---|---|---|
| Stranded terminalization persists `nextAttemptCount` | `dispatcher.server.ts:904` | PASS |
| NO_AUTOMATIC_RETRY N → N+1 | `shouldDeadLetterStranded:983` computes `attemptCount+1`; test seeds `attemptCount:2`, asserts `3` (`sync-dispatch-recovery.test.ts:1177,1195`) | PASS |
| Budget exhaustion persists `maxAttempts` | `:991` `nextAttemptCount >= maxAttempts`; test seeds `attemptCount:2, maxAttempts:3`, asserts `3` (`:1214,1232`) | PASS |
| Forced-failure rollback leaks nothing | Whole terminalization runs inside one `tx`; test forces an empty dead-letter transition and asserts `state==="ENQUEUED"`, `attemptCount===7` (unchanged), 0 dead letters (`sync-final-correction.test.ts:487–496`) | PASS |
| Concurrent reapers terminalize exactly once | `SELECT … FOR UPDATE` (`:863–867`), unfinished-attempt guard (`:871–874`), conditional `WHERE state='ENQUEUED'` with `RETURNING` (`:910–913`), `requireExactlyOneTransitionRow` (`:951`); test seeds `attemptCount:4`, asserts `5` after concurrent reapers (`sync-dispatch-recovery.test.ts:1241–1260`) | PASS |
| Audit/failure records consistent | `DeadLetter` created once (OPEN dedupe `:917–933`), `DataIssue` records `terminalReason` and presence (`:953–965`), all within the same transaction as the persisted `attemptCount` | PASS |

---

## 4. Restoration-chain verification — **ZERO NET CONFIRMED**

Four commits between `dcd2b6ff26e832abba3f64e525503cdd555354c1` and
`cc89d3854d1be305486a9574ec3a5656f9e7db63`: `794f4f0` ("placeholder"), `97b29e3`,
`5f3c2b5` ("no-op"), `cc89d38`.

Verified by content, not by commit message:

- `git diff --stat dcd2b6ff cc89d385` → **empty output** (no differing files).
- `git rev-parse dcd2b6ff^{tree}` = `7db8824461455b6857f6492996e8716ef2beaac5`
  `git rev-parse cc89d385^{tree}` = `7db8824461455b6857f6492996e8716ef2beaac5` — **identical trees**.

Per-commit content: `794f4f0` deleted 82 lines of `PROJECT_STATUS.md`, restored by
`97b29e3` (+82/−1); `5f3c2b5` deleted 46 lines of `docs/README.md`, restored by `cc89d38`
(+46/−1). No runtime code, test, migration, configuration, or review report was touched
anywhere in the chain. **Zero net file-content difference: CONFIRMED.**

---

## 5. Performance-harness correction (`cc89d385` → `f8673b06`)

Diff scope: `sync-performance.test.ts` (+5/−1... one assertion line), `PROJECT_STATUS.md`,
`PR2_TENANT_ACCESS_INVENTORY.md`, D-046 implementation report. No runtime code. The only
functional change is widening the accepted plan-index regex.

| Claim | Verification | Result |
|---|---|---|
| Failed plan used `DurableJob_shop_eligible_pending_idx` | Index exists and is committed: `20260804210000_sync_control_plane_correction/migration.sql:89–91`; confirmed live in `pg_indexes` | CONFIRMED (index real and committed) |
| No prohibited sequential scan | `expect(planText).not.toMatch(/Seq Scan on "DurableJob"/i)` retained unchanged (`:103`) | CONFIRMED |
| No prohibited external sort | `expect(planText).not.toMatch(/Sort Method: external/i)` retained unchanged (`:104`) | CONFIRMED |
| Top-N heapsort in memory | Consistent with `work_mem='64MB'` set at `:86` and the retained external-sort ban | CONFIRMED (by inference from retained assertions; CI log not re-executed) |
| Old regex rejected the committed index | `/DurableJob_eligible_pending\|DurableJob_.*nextEligibleAt/i` does not match `DurableJob_shop_eligible_pending_idx` — the literal alternative requires `DurableJob_eligible_pending`, and the second alternative requires `nextEligibleAt` in the index **name**, which that index does not contain | CONFIRMED |
| Correction accepts only that valid index | Added alternative is exactly `DurableJob_shop_eligible_pending`; no wildcard broadening | CONFIRMED |
| Thresholds unchanged | Diff touches one assertion line plus a comment; all latency/fairness thresholds untouched | CONFIRMED |
| No retry / skip / sleep / env exemption / runtime workaround | Full diff `dcd2b6ff…f8673b06` touches only the one test file and three docs; no runtime file changed | CONFIRMED |
| Inventory line anchors refreshed accurately | `npm run tenant:access:inventory:check` → `tenant_access_inventory_fresh` | CONFIRMED |
| RISK_REGISTER unchanged justified | Unchanged between `cc89d385` and `f8673b06`; R-115…R-118 were already added for the four D-046 findings. Defensible for a test-harness fix that introduced no new *recorded* risk — but see P2-D046-01, which is a new risk that is not registered | PARTIALLY JUSTIFIED |

**Independent classification: this was a harness defect, not a dispatcher regression.**
Runtime code is provably unchanged across the entire window — `git diff dcd2b6ff f8673b06`
touches only `sync-performance.test.ts` and three Markdown files. A dispatcher regression
is therefore impossible by construction.

However, my independent reproduction shows the stated root cause is incomplete, and the
chosen fix does not close it. See **P2-D046-01**.

---

## 6. Seam and safety audit

| Search | Result |
|---|---|
| Production-reachable test seams | None. `__setQueueStateClassificationSeamForTests` / `testStateClassificationSeam` / `__setForceMissingWinnerAfterConflictForTests` / `__setForceDeadLetterTransitionFailForTests` / `testForceSkipInitialReceiptRead`: zero runtime matches |
| Mutable test globals | None affecting business classification; only lifecycle singleton resets |
| Lifecycle helpers in production paths | `resetControlPlanePrismaForTests` and `resetVerifiedPrismaSingletonForTests` throw when `NODE_ENV==="production"`. `resetQueueClientsForTests`, `resetPrismaSingletonForTests`, `resetLegacyEvidenceLimitForTests` lack that guard — pre-existing, merged before D-046, out of scope; noted only |
| Runtime queue-state overrides | None — `classifyQueueState` is pure |
| Mocked application outcomes outside test files | None. `vi.mock` of `applyWithApplicationReceipt` and `createTenantDb` is confined to `sync-d046-worker-finalize.test.ts`. The only non-`__tests__` vitest import is `app/test-utils/prisma-tenant-context-mock.ts`, imported solely by tests and pre-dating D-046 (`deef5d7`, PR 3) |
| Hidden retries / skipped gates | None. No `.skip`, `.only`, `.todo` in `app/sync/__tests__/`. No `continue-on-error`, retry action, `\|\| true`, or `sleep` in `ci.yml` |
| Weakened performance thresholds | No numeric threshold changed. Plan-index assertion *was* broadened — recorded as P2-D046-01 |
| Misleading workflow commands | All 27 `-t` gates executed and each ran ≥1 real test. Fail-open weakness recorded as P3-D046-01 |
| Inventory writes | None. No `inventorySetQuantities` / `inventoryAdjustQuantities` / `inventoryActivate` anywhere in `app/sync/` or `app/jobs/`. All five write flags default `false` |
| Production queue execution / webhook replay / merchant data / ownership repair | None in the D-046 delta |
| Secrets | None. Secret-shaped additions in the delta are the CI test-only envelope secret cache reset and documentation text |
| PR 5 work | None |
| Immutable review-report changes | **None** — zero commits touching `*REVIEW_REPORT.md` since `ef452bb9` |
| Migrations | No migration file changed in the D-046 delta |

**Safety and scope: PASS.**

---

## 7. Findings

### P0 — none
### P1 — none

### P2-D046-01 — F-PR4-11 plan gate no longer proves the index-ordered fast path

- **File / line:** `stocky-plus/app/sync/__tests__/sync-performance.test.ts:100–102`
- **Evidence:** The gate query is
  `SELECT id FROM "DurableJob" WHERE state='PENDING' AND "nextEligibleAt" <= NOW() ORDER BY "nextEligibleAt","createdAt",id LIMIT 50`.
  `DurableJob_eligible_pending_idx` is `("nextEligibleAt","createdAt",id) WHERE state='PENDING'` — it satisfies the `ORDER BY` directly and stops after 50 rows. The newly accepted
  `DurableJob_shop_eligible_pending_idx` is `("shopId","nextEligibleAt","createdAt") WHERE state='PENDING'`; its leading column `shopId` does not appear in the query's `WHERE`,
  so choosing it requires scanning every matching index entry and applying a top-N heapsort.
  I reproduced the optimal plan independently at 50 000 rows:
  `Limit → Index Only Scan using "DurableJob_eligible_pending_idx"`, `Buffers: shared hit=5`,
  `Execution Time: 0.084 ms`, **no Sort node at all**. The regex now accepts both, and the
  retained `Seq Scan` / external-sort bans do not distinguish them.
- **Root cause (independent):** the harness bulk-inserts 50 000 rows and runs `EXPLAIN`
  **without `ANALYZE "DurableJob"`**, so the planner works from stale/absent statistics and
  its index choice is environment-dependent. I confirmed the sensitivity is real and
  uncorrected: on this reviewer's PostgreSQL 16 the optimal index is chosen both with and
  without a stats refresh, while CI chose the shop-scoped index on the same commit.
  Widening the accepted set makes the gate pass either way; it does not make the plan
  deterministic.
- **Merchant impact:** a future regression that degrades the eligible-claim path from
  index-ordered retrieval to a full partial-index scan plus heapsort would pass CI
  unnoticed. At 50 000 pending jobs that is the difference between 5 buffer hits and
  reading the entire pending index on every dispatch tick — a dispatch-latency and
  database-load regression on the busiest merchants, invisible to the gate meant to catch it.
- **Reproduction:** seed 50 000 `PENDING` `DurableJob` rows across 5 shops; run the gate
  `EXPLAIN` with and without a preceding `ANALYZE "DurableJob"`; observe the plan is not
  pinned and that both the ordered and shop-scoped plans satisfy the current assertion.
- **Expected behaviour:** the F-PR4-11 gate should deterministically prove the
  index-ordered claim path.
- **Recommended correction:** run `ANALYZE "DurableJob"` after the bulk insert and before
  `EXPLAIN` (this pinned the optimal plan in my reproduction), and additionally assert the
  absence of a `Sort` node — or, if the shop-scoped plan is genuinely acceptable, record an
  explicit RISK_REGISTER entry stating that the gate no longer distinguishes the two plans
  and why that is accepted.
- **Missing test:** an assertion that the chosen plan performs no sort, and a
  stats-refresh step making the plan deterministic across environments.

### P3-D046-01 — CI `-t` focused gates fail open on name drift

- **File / line:** `.github/workflows/ci.yml:373–478` (27 `-t` gates)
- **Evidence:** control experiment —
  `npm run test:sync-exactly-once -- -t "zzz-no-such-test-zzz"` → `Tests 42 skipped (42)`,
  **exit 0**. Vitest treats a zero-match name filter as success. All 27 gates currently
  match real tests (I executed each; 1–2 tests passed per gate), so no gate is vacuous
  today — but any future test rename silently converts a named safety gate into a no-op
  that still reports green.
- **Merchant impact:** indirect. A renamed exactly-once or dead-letter test would remove
  its dedicated gate without any CI signal, eroding the evidence base for
  inventory-affecting correctness claims.
- **Expected behaviour:** a gate that matches no test must fail.
- **Recommended correction:** add `--passWithNoTests=false` (or assert a minimum executed
  test count) to the focused-gate invocations.
- **Missing test:** a meta-check asserting every `-t` string in `ci.yml` resolves to at
  least one test name in the repository.

### P3-D046-02 — restoration-chain commit messages misdescribe their content

- **File / line:** commits `794f4f0` ("placeholder") and `5f3c2b5` ("no-op")
- **Evidence:** `794f4f0` removed 82 lines from `PROJECT_STATUS.md`; `5f3c2b5` removed 46
  lines from `docs/README.md`. Neither is a placeholder or a no-op. Net effect across the
  chain is provably zero (§4), so no content risk remains.
- **Merchant impact:** none directly; chain-of-custody hygiene. A reviewer trusting commit
  messages over content would have missed two governance-document deletions.
- **Expected behaviour:** commit messages describe their actual change.
- **Recommended correction:** none to the history (amend/rebase is prohibited); note the
  discrepancy in the implementation report so the record is honest.
- **Missing test:** n/a.

### P3-D046-03 — worker-finalize suite substitutes the tenant DB (scope note)

- **File / line:** `sync-d046-worker-finalize.test.ts:67–111`
- **Evidence:** `createTenantDb` is mocked with an owner-Prisma shim. The six envelope
  cases therefore prove worker finalization semantics but exercise none of the tenant
  RLS / restricted-role enforcement on those write paths. This is disclosed in the file
  header (lines 4–10) and registered as access exception `EX-SYNC-TEST-013`, and tenancy is
  covered separately (`test:sync-role-isolation` 9 passed, `test:db-isolation` 19 passed).
- **Merchant impact:** none at present; the coverage exists elsewhere.
- **Recommended correction:** state the tenancy substitution alongside the "genuine v2/v3"
  claim in the D-046 implementation report so the evidence is not read as broader than it is.
- **Missing test:** none required.

---

## 8. Gate disposition (unchanged by this review)

Q-003 **OPEN**. F-PR4-18 **OPEN**. PR 5 **BLOCKED**. Production **UNAUTHORIZED**. Every
inventory-write flag **OFF**. R-115…R-118 remain **OPEN** — the underlying corrections are
verified, but closure is ChatGPT's decision, not this reviewer's.

---

## 9. Verdict

**CORRECTIONS REQUIRED**

All four D-046 findings (NEW-CLAUDE-D045-01 … 04) are independently verified as correctly
and completely implemented. The restoration chain is confirmed zero-net by tree identity.
Exact-head CI is confirmed green on `f8673b06…`. Every safety constraint holds: no
inventory writes, no production activity, no secrets, no immutable review report altered,
no production test seam, no weakened threshold, no hidden retry or skipped gate.

Closure is nonetheless withheld because the performance-harness correction — introduced
*within* the D-046 chain itself — leaves an open **P2** (P2-D046-01): the F-PR4-11 gate now
accepts a strictly worse query plan and no longer proves the index-ordered eligible-claim
path, while the underlying planner nondeterminism it was meant to resolve remains
uncorrected and unregistered. Under the project severity rubric a P2 performance-evidence
defect introduced by the correction under review blocks correction closure.

Required for `APPROVE D-046 CORRECTION CLOSURE`: resolve P2-D046-01 (determinize the plan
via a stats refresh and assert the absence of a sort, or record an explicit accepted-risk
entry), and disposition P3-D046-01 … 03.

This review does not merge, mark ready, unblock PR 5, enable inventory writes, or
authorize any production activity.
