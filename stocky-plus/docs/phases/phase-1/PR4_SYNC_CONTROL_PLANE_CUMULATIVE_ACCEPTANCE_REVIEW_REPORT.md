# Phase 1 PR 4 — Cumulative Independent Acceptance Review Report

**Reviewer:** Claude Code (independent review agent)
**Review type:** Cumulative independent Phase 1 PR 4 acceptance review (first of its kind for this PR)
**Review date:** 2026-08-13
**Authority note:** This report is advisory evidence. ChatGPT retains PR 4 acceptance authority. Merge authorization remains separate.

---

## 1. Exact reviewed SHA

| Field | Value |
|---|---|
| Reviewed implementation head | `eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3` |
| Head commit subject | `docs(sync): record D-051 correction closure and architectural truth` |
| Head commit tree | `b1670ae01d50475174f2a2013a01ee59ccd2f25e` |
| Head author/date | Cursor Agent — 2026-08-13 16:27:35 +0000 |

## 2. Computed merge base

```
$ git merge-base origin/main eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3
e69bc53d91db75472b0d0998bf1b74ee6246adb1
```

| Field | Value | Expected | Match |
|---|---|---|---|
| Computed merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | `e69bc53d…` | YES |
| `origin/main` current | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | unchanged | YES |

`origin/main` has not advanced past the authorized merge base; base and merge base are the same commit.

## 3. PR state

| Field | Observed | Required | Match |
|---|---|---|---|
| PR number | #20 | #20 | YES |
| State | `open` | OPEN | YES |
| Draft | `true` | DRAFT | YES |
| Merged | `false` | UNMERGED | YES |
| Head SHA | `eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3` | exact | YES |
| Base ref | `main` | `main` | YES |
| Base SHA | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | exact | YES |
| `mergeable_state` | `clean` | — | informational |
| Size | 147 files, +35,797 / −612, 132 commits | — | informational |

### Identity gate — all 16 conditions

| # | Condition | Result |
|---|---|---|
| 1 | PR #20 OPEN | PASS |
| 2 | PR #20 DRAFT | PASS |
| 3 | PR #20 UNMERGED | PASS |
| 4 | Head `eb757119…` | PASS |
| 5 | Base `main` | PASS |
| 6 | Merge base `e69bc53d…` | PASS |
| 7 | `origin/main` still `e69bc53d…` | PASS |
| 8 | PUSH CI `31720795422` success @ `eb757119…` | PASS |
| 9 | PR CI `31720798487` success @ `eb757119…` | PASS |
| 10 | D-051 runtime/test head `05bcb88c…` | PASS — commit exists, is ancestor of head |
| 11 | D-051 reviewed pre-sync head `938e9981…` | PASS — commit exists, is ancestor of head |
| 12 | D-051 review blob `d17df5900b26740a32e4408618166abce2495f3a` | PASS — exact blob match at head |
| 13 | D-050 review blob `8247d8aea868818b8e904d196fee1a80fad283f5` | PASS — exact blob match at head |
| 14 | Inventory-write flags default OFF | PASS — see §23 |
| 15 | Production execution unauthorized | PASS — no production activity performed |
| 16 | PR 5 blocked | PASS — see §24 |

No material identity condition failed. Substantive review proceeded.

## 4. Exact-head CI verification

| Run | Event | Head SHA | Conclusion | Run # |
|---|---|---|---|---|
| `31720795422` | `push` | `eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3` | **success** | 285 |
| `31720798487` | `pull_request` | `eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3` | **success** | 286 |

Both runs are bound to the exact reviewed head SHA and both concluded `success`. Per the review mandate, green CI was **not** treated as proof of correctness; every material claim below was independently re-executed or re-derived (§6).

**Step-level verification of the PR run** (job `94516999137`): I enumerated all **135 steps**; every one concluded `success`, with **no `continue-on-error`, no skipped step, and no neutral conclusion**. Substantive steps confirmed present and green include `Sync control-plane integration tests` (5m36s), `Sync dispatch performance/fairness (F-PR4-11/13)` (5m04s), `Migration and tenant-backfill tests` (9m17s), `Tenant access tests` (2m19s), `Lint`, `Typecheck`, `Unit tests`, `Build`, and `GraphQL codegen / schema validation`. A workflow-level `success` here is therefore not masking a disabled or vacuous gate.

## 5. Independent environment

Disposable local environment; no production database, queue, credentials, migrations, merchant data, or Shopify writes.

| Component | Version |
|---|---|
| OS | Linux 6.18.5-fc-v20 x86_64 |
| Node.js | v22.22.2 (CI pins 22.19.0; both satisfy `>=22.12`) |
| npm | 11.5.2 (matches `packageManager` / CI pin exactly) |
| PostgreSQL | 16.13 (CI uses `postgres:16-alpine`) |
| Redis | 7.0.15 (CI uses `redis:7-alpine`) |
| Vitest | 3.2.7 |
| Prisma | 6.19.3 |
| TypeScript | 5.9.3 |

Environment variables mirrored the CI `validate` job exactly, including all five inventory-write flags set to `false`.

## 6. Command table — actual exit codes

Working directory `stocky-plus/` unless noted. `EXIT` is the real observed exit status.

### 6.1 Build, schema, and clean migration chain

| # | Command | EXIT | Result |
|---|---|---|---|
| C01 | `npm ci` | 0 | dependencies installed from committed lockfile |
| C02 | `npx prisma generate` | 0 | client generated |
| C03 | `npx prisma validate` | 0 | schema valid |
| C04 | `npx prisma migrate deploy` (fresh DB) | 0 | **full chain applied clean**, incl. `…d051_readiness_lock_scope` |

### 6.2 Provisioning, enforcement, and drift chain (18/18)

| # | Command | EXIT |
|---|---|---|
| C05 | `npm run tenant:indexes:apply -- --apply` | 0 |
| C06 | `npm run tenant:indexes:verify` | 0 |
| C07 | `npm run tenant:schema:drift` | 0 |
| C08 | `npm run tenant:enforcement:inventory:check` | 0 |
| C09 | `npm run tenant:roles:provision -- --apply` | 0 |
| C10 | `npm run tenant:enforcement:preflight` | 0 |
| C11 | `npm run tenant:enforcement:apply -- --apply` | 0 |
| C12 | `npm run tenant:roles:verify` | 0 |
| C13 | `npm run tenant:rls:verify` | 0 |
| C14 | `npm run tenant:immutability:verify` | 0 |
| C15 | `npm run tenant:enforcement:verify` | 0 |
| C16 | `npm run tenant:enforcement:drift` | 0 |
| C17 | `npm run tenant:access:audit` | 0 |
| C18 | `npm run tenant:access:inventory:check` | 0 |
| C19 | `npm run sync:inventory:check` | 0 |
| C20 | `npm run sync:roles:provision -- --apply` | 0 |
| C21 | `npm run sync:roles:verify` | 0 |

### 6.3 Sync control-plane suites (all green)

| # | Command | EXIT | Files | Tests |
|---|---|---|---|---|
| C22 | `npm run test:sync-integration` | 0 | 20 passed | **241 passed** |
| C23 | `npm run test:sync-exactly-once` | 0 | 2 passed | **42 passed** |
| C24 | `npm run test:sync-dispatch-recovery` | 0 | 1 passed | **29 passed** |
| C25 | `npm run test:sync-uninstall` | 0 | 1 passed | **8 passed** |
| C26 | `npm run test:sync-attempt-recovery` | 0 | 1 passed | **16 passed** |
| C27 | `npm run test:sync-envelope-fail-closed` | 0 | 1 passed | **6 passed** |
| C28 | `npm run test:sync-final-correction` | 0 | 1 passed | **21 passed** |
| C29 | `npm run test:sync-role-isolation` | 0 | 1 passed | **9 passed** |
| C30 | `npm run test:sync-inventory-audit` | 0 | 1 passed | **5 passed** |

**Sync control-plane total: 29 files, 377 tests, 0 failures, 0 skipped.**

### 6.4 Q-003 / F-PR4-18 GraphQL validation

| # | Command | EXIT | Result |
|---|---|---|---|
| C31 | `npm run graphql-codegen` (live schema) | 0 | fetched live `admin-2026-07.schema.json` (6,978,270 bytes); all documents validate |
| C32 | `npm run graphql-codegen` **with deliberately invalid document injected** | **1** | gate genuinely rejects invalid fields — not tautological |

### 6.5 Reviewer-environment artifact (recorded, not a project defect)

| # | Command | Original EXIT | Diagnosis |
|---|---|---|---|
| C33 | batch of 9 npm scripts | **254** (all nine) | Background shell started in repo root; `npm error code ENOENT … open '/home/user/Stocky/package.json'`. Direct mechanism evidence captured from `log_lint.txt`. Not a project defect; re-run from `stocky-plus/` (§6.6). |

Per the review mandate the original exit code is recorded before re-run, and the failure was diagnosed to a concrete mechanism rather than dismissed as "environmental."

### 6.6 Performance, guards, quality gates

| # | Command | EXIT | Result |
|---|---|---|---|
| C34 | `npm run test:sync-performance` (run 1, `SYNC_PERF_JOB_COUNT=50000`) | 0 | 6 files, **64 passed**, 259.7 s |
| C35 | `npm run test:sync-performance` (run 2, repeat — concurrency-sensitive) | 0 | 6 files, **64 passed** — identical to run 1 |
| C36 | `npm run test:sync-dispatch-recovery -- -t "claude-nonexistent-zzz"` (zero-pass guard probe) | **1** | guard fires — see below |
| C37 | `npm run test:vitest-reporters` | 0 | 1 file, 4 passed |
| C38 | `npm run test:migrations-name-filter-probes` | 0 | skip-only / todo-only probes cannot vacuous-pass |
| C39 | `npm run lint` | 0 | clean |
| C40 | `npm run typecheck` | 0 | clean |
| C41 | `npm test` (unit) | 0 | 6 files, **56 passed** |
| C42 | `npm run build` | 0 | client + server built |
| C43 | `npm run test:migrations` (full migration suite) | **1** | 48/49 files passed; **225 passed, 1 failed** — the single failure is F-F03, analysed in §15.1 |

The performance suite is run **twice** because its properties are concurrency-sensitive; both runs were identical (64/64).

**Zero-pass guard falsification (C36).** Under a name filter matching nothing, Vitest alone would exit 0 with everything skipped. Observed instead:

```
 Test Files  1 skipped (1)
      Tests  29 skipped (29)
[ci-guard] testNamePattern /claude-nonexistent-zzz/ matched zero passing tests — refusing vacuous success (P3-D046-01)
EXIT=1
```

The many `-t`-filtered CI gates in `ci.yml` therefore cannot silently pass by matching nothing. Combined with C32 (invalid GraphQL document → exit 1), the two most load-bearing "green means green" assumptions in this PR were independently falsification-tested.

## 7. Base → head diff and scope assessment

```
$ git diff --stat e69bc53d…..eb757119…
147 files changed, 35797 insertions(+), 612 deletions(-)
```

| Area | +/− | Assessment |
|---|---|---|
| `docs/phases` | +11,222 / −220 | review/correction chain records |
| `scripts/sync-control-plane` | +2,281 / −0 | roles, inventory, claim indexes, tests |
| `prisma/migrations` | +1,992 / −0 | **additive only** — 11 new migration dirs |
| `prisma/schema.prisma` | +467 / −4 | 13 new control-plane models |
| `app/sync` (38 files) | — | control-plane runtime |
| `.github/workflows/ci.yml` | +163 / −2 | new PR 4 gates |
| `app/services` | +1 / −0 | `forecasting.server.ts`: adds `shopId` to a create — PR 2/3 tenancy completion, not new domain logic |
| `app/shopify.server.ts`, `shopify.app.toml` | +2 / −2 | API version `2025-10` → `2026-07` |

### Scope compliance

All 13 new Prisma models are control-plane models (`WebhookDelivery`, `DurableJob`, `JobDispatch`, `JobAttempt`, `SyncApplicationReceipt`, `DeadLetter`, `JobReplay`, `SyncRun`, `SyncCursor`, `ReconciliationRun`, `DataIssue`, `SyncHealth`, `DispatchReadyShop`).

| Prohibited later-phase scope | Found at head? |
|---|---|
| Inventory mutation | **NO** — no inventory mutation added or enabled |
| Receiving / stocktake / transfer execution | **NO** |
| Cost sync | **NO** |
| Purchasing expansion | **NO** |
| Forecasting / ABC | **NO** |
| Billing / entitlement | **NO** |
| AI | **NO** |
| PR 7 privacy-redaction implementation | **NO** — sanitizer projections only |
| PR 5 catalog/location fact models | **NO** — zero catalog/location fact models added |
| Production deployment / backfill / ownership repair | **NO** |

**Scope verdict: COMPLIANT.** PR 4 remains a synchronization-control-plane implementation.

## 8. PR 4 acceptance-criteria matrix

Criteria from `PHASE_BRIEF.md` §"PR 4 — Synchronization control plane".

| # | Criterion | Mechanism at exact head | Independent evidence | Status |
|---|---|---|---|---|
| 1 | Persistent webhook inbox | `WebhookDelivery` + `intake.server.ts` | C22, schema, §10 | **MET** |
| 2 | Sync runs and cursors | `SyncRun`, `SyncCursor` models | schema §7 | **MET (scaffolding, as briefed)** |
| 3 | Job attempts, dead letters, replay, correlation | `JobAttempt`, `DeadLetter`, `JobReplay`, `correlationId`/`causationId` | C22–C28 | **MET** |
| 4 | Validated job-envelope creation, persistence, replay, rejection | `envelope-v2/v3.server.ts`, HMAC + digest + identity checks | C27 (6 tests), §12 | **MET** |
| 5 | Data issues and reconciliation records | `DataIssue`, `ReconciliationRun` | C22, §10 | **MET** |
| 6 | Uninstall job shutdown | `uninstall.server.ts`, all 5 cancellable states | C25 (8 tests), §14 | **MET** |
| 7 | Sync-health states | `SyncHealth`, `health.server.ts` | schema, C22 | **MET** |

## 9. Architecture / source re-derivation

Re-derived from exact-head source, not from architecture documents.

- **Durable source of truth:** DB is authoritative. The worker resolves `durableJobId`, loads the `DurableJob` row from the control-plane client, and derives authority from that row — not from the queue payload (`webhook-processor.ts:358–404`).
- **Redis/BullMQ as delivery only:** `queue-presence.server.ts` exports pure `classifyQueueState`, `isRunnableBullmqState`, `isTerminalBullmqState`. Runnable allowlist excludes `paused`; unknown states fail closed.
- **Correlation/causation identity:** carried on `DurableJob` and enforced in envelopes (`envelope-v3.server.ts:278–292` requires non-empty `correlationId`; rejects empty/non-string `causationId`).
- **Payload digest idempotency:** `digest.server.ts` canonical-JSON digest; enforced at intake, envelope, and receipt layers.
- **State machine:** `state-machine.server.ts` encodes 16 legal edges, rejects self-transitions, fails closed via `assertTransition`, and `assertCancellableTransitionCoverage()` proves every cancellable state has a legal `→ CANCELLED` edge.

## 10. Security, tenancy, and role assessment

Directly probed against the live provisioned database.

**Role attributes** — all three roles `rolsuper=f`, `rolbypassrls=f`, `rolinherit=f`, `rolcreaterole=f`, `rolcreatedb=f`:

```
stocky_runtime|f|f|f|f|f
stocky_control_plane|f|f|f|f|f
stocky_receipt_probe_owner|f|f|f|f|f
```

**Control-plane role vs merchant-domain tables** — query over `information_schema.table_privileges` for `PurchaseOrder`, `POLineItem`, `InventorySnapshot`, `Session`, `LowStockAlert`, `ForecastOverride`, `LeadTimeSnapshot`, `BomComponent` returned **zero rows**. The control-plane role cannot become a merchant-domain bypass.

**Shop column grants** — exactly the 9 approved lifecycle columns (`id`, `myshopifyDomain`, `processingEnabled`, `processingDisabledReason`, `processingDisabledAt`, `uninstalledAt`, `reinstalledAt`, `createdAt`, `updatedAt`), each SELECT+UPDATE, column-level. No broad `Shop.*` grant. Session/token tables remain revoked.

**RLS** — `relrowsecurity` **and** `relforcerowsecurity` are both `true` on all seven control-plane tables (`DurableJob`, `JobAttempt`, `WebhookDelivery`, `DispatchReadyShop`, `SyncApplicationReceipt`, `DeadLetter`, `JobDispatch`).

**Control-plane client separation** — `control-plane-db.server.ts` binds `DATABASE_CONTROL_PLANE_URL` and throws `control_plane_url_missing` unless `STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK=1` (disposable tests only). `resetControlPlanePrismaForTests` throws in production.

Role/RLS/grant drift is verified by C12–C16 and C21, all exit 0.

## 11. Durability, idempotency, and exactly-once assessment

**Webhook intake idempotency** (`intake.server.ts`):

| Case | Behavior | Evidence |
|---|---|---|
| Duplicate `(shopId, shopifyWebhookId)` | `duplicateCount` increment + `lastSeenAt`, no second job | C22 |
| Divergent payload, same webhook ID | conflict recorded (`F-PR4-08` test passes) | C22 |
| Missing/blank webhook ID | `QUARANTINED` + `DataIssue(missing_shopify_webhook_id)`, **job = null** | source §100–170, C22 |
| Unsupported/missing API version | durable quarantine, no job (F-PR4-18) | source §173+, C22 |
| `processingEnabled=false` (non-uninstall) | denied `shop_processing_disabled` | source §106 |

DB commit precedes HTTP success; Redis is not on the durability path (`shopify.server.ts` afterAuth catches enqueue failure and comments that the durable PENDING job still exists).

**Exactly-once application** (`application-receipt.server.ts`, `application-finalize.server.ts`):

- `verifyApplicationReceiptAfterRollback` opens a **new top-level `TenantDb` transaction at `RepeatableRead`** — explicitly never the failed transaction object.
- Finalization is strictly: `verified` → `completeAttemptSuccess`; `digest_conflict` → dead-letter `APPLICATION_DIGEST_CONFLICT`; `missing`/`verification_failed` → dead-letter `APPLICATION_OUTCOME_UNCERTAIN`.
- `APPLICATION_ALREADY_APPLIED` never yields success from an error code alone — success requires a positively verified receipt.
- v2 and v3 workers share the same finalizer; v1 fails closed (C27).

42 exactly-once tests pass (C23), including the named `NEW-PR4-SC01` and `NEW-CLAUDE-D045-02` matrix cases.

**Database-enforced invariants — independently queried from `pg_indexes` / `pg_trigger` on the provisioned schema.** These are enforced by the database, not merely by application code:

| Invariant | Mechanism at head |
|---|---|
| Exactly-once application key | `SyncApplicationReceipt_shopId_applicationKey_key` UNIQUE `("shopId","applicationKey")` |
| Single active attempt per job | `JobAttempt_one_active_per_durable_job` UNIQUE `("durableJobId") WHERE "finishedAt" IS NULL` |
| Webhook duplicate detection, null-ID excluded | `WebhookDelivery_shopId_shopifyWebhookId_nonnull_key` UNIQUE `("shopId","shopifyWebhookId") WHERE "shopifyWebhookId" IS NOT NULL` |
| One OPEN dead letter per job | `DeadLetter_one_open_per_job` UNIQUE `("durableJobId") WHERE "resolutionState" = 'OPEN'` |
| State-machine enforcement in SQL | trigger `stocky_durable_job_transition_guard_trg` on `DurableJob` |
| Tenant-safe composite FK targets | `(shopId, id)` UNIQUE on `SyncApplicationReceipt`, `JobAttempt`, `WebhookDelivery`, `DeadLetter` |

The null-webhook-ID exclusion is what makes the quarantine path in §11 correct rather than a constraint violation: many null-ID deliveries can coexist, each quarantined, while any non-null ID is unique per shop.

## 12. Queue, dispatcher, and recovery assessment

- **Fair claim:** `FOR UPDATE … SKIP LOCKED` on both the scheduler (`DispatchReadyShop`) and candidate (`DurableJob`) statements, with `LIMIT`, deterministic `ORDER BY`, and a bounded refill loop capped by `FAIR_CLAIM_MAX_REFILL_ROUNDS`.
- **Lease lifecycle:** creation, expiry, and recovery covered; `recoverExpiredDispatchLeases` is a single bounded `SKIP LOCKED + LIMIT` statement.
- **Retained terminal BullMQ jobs:** dedicated CI gates plus `classifyQueueState`; retained FAILED/completed jobs must not false-acknowledge `ENQUEUED` (C24).
- **Unknown queue state:** fails closed.
- **Stranded `ENQUEUED` recovery:** per-job transaction, `FOR UPDATE`, null-`activeDispatchSequence` fails closed (NEW-PR4-SC04), and attempt budget is **persisted** (`attemptCount = nextAttemptCount`) on both the retry and terminalize paths — R-118 mechanism present at `dispatcher.server.ts:932`, `:1120`, `:1273`.
- **Terminal transitions:** `requireExactlyOneTransitionRow` prevents silent success on lost races.

29 dispatch-recovery tests pass (C24) covering every named `NEW-PR4-C01` / `NEW-PR4-SC0x` gate.

## 13. Uninstall / reinstall assessment

- `processUninstall` is single-shop end-to-end; sets `processingEnabled=false`, `processingDisabledReason=UNINSTALLED`, `uninstalledAt`.
- `cancelAllCancellable` locks the shop's non-terminal jobs `FOR UPDATE`, then cancels **all five** cancellable states — `PENDING`, `DISPATCH_LEASED`, `ENQUEUED`, `RUNNING`, `RETRY_WAIT` — each with a state-CAS `updateMany` and `assertTransition`, and closes unfinished attempts.
- `assertCancellableTransitionCoverage()` runs at the top of `processUninstall`, so a future state lacking a `→ CANCELLED` edge fails loudly rather than silently skipping.
- Workers already holding tenant context fail closed: `assertShopProcessingEnabled` re-reads `processingEnabled` live from the control-plane DB before merchant work (`webhook-processor.ts:306–318`, called at `:375`); the dispatcher re-checks at `:1376`.
- Reinstall (`reinstall.server.ts`) re-enables only from the allowed UNINSTALLED state; REDACTED is not casually reactivated.

8 uninstall tests pass (C25).

## 14. Concurrency, fairness, and readiness assessment — D-051 core

This is the deepest part of the review. The mandate required proving or disproving the **runtime transaction-shape invariant** rather than accepting `stocky.ready_lock_max_shop` as the correctness boundary.

### 14.1 Complete readiness-changing writer inventory

Readiness locks are taken only by three statement triggers: `DurableJob` INSERT, `DurableJob` UPDATE (filtered to `PENDING`/`RETRY_WAIT` arrivals or earlier schedules), and `Shop.processingEnabled` UPDATE. I enumerated every writer that can fire them.

| Writer | Shops per transaction | Statements | Invariant |
|---|---|---|---|
| `intake.ingestAuthenticatedWebhook` (4 tx sites) | 1 | many | single-shop — SAFE |
| `intake.createDurableJob` | 1 | 1 | SAFE |
| `replay.replayDeadLetter` | 1 | many | single-shop — SAFE |
| `lifecycle.claimAttempt` / `completeAttemptSuccess` / `completeAttemptRetry` / `completeAttemptFail` / `completeAttemptDeadLetter` | 1 (`input.shopId`) | many | single-shop — SAFE |
| `lifecycle.renewAttemptHeartbeat` | 1 | many (no tx) | SAFE |
| `lifecycle.recoverExpiredRunningAttempts` | **1 per transaction** — cross-shop candidates iterated with a **separate `prisma.$transaction` per attempt** | many | SAFE |
| `dispatcher.recoverStrandedEnqueuedJobs` | **1 per transaction** — separate transaction per job | many | SAFE |
| `dispatcher.recoverExpiredDispatchLeases` | many | **1 statement** (trigger iterates `shopId ASC`) | SAFE |
| `dispatcher.claimBatchFair` | many | many | **takes no readiness advisory lock** — lease CAS targets `DISPATCH_LEASED`, outside the trigger filter (empirically confirmed, P8) |
| `uninstall.processUninstall` / `cancelAllCancellable` | 1 | many | single-shop — SAFE |
| `reinstall.reactivateShopAfterVerifiedReinstall` | 1 | many | single-shop — SAFE |

**Result: the invariant HOLDS at exact head.** Every multi-shop readiness writer is single-statement; every multi-statement readiness writer is single-shop. No supported runtime transaction takes readiness advisory locks for different shops in separate statements in a dangerous order.

### 14.2 Independent raw-SQL falsification probe

A reviewer-authored `pg` probe (outside the project's own tests) exercised the mechanism directly against the provisioned database. **8/8 passed.**

| Probe | Result | Observation |
|---|---|---|
| P1 cross-shop non-blocking | PASS | other-shop insert completed in **6 ms** while shop A's readiness tx held its lock — the D-050 global convoy is genuinely gone |
| P2 same-shop serialization | PASS | second same-shop writer BLOCKED while lock held |
| P3 descending multi-statement | PASS | fails closed **`SQLSTATE P0001` / `stocky_dispatch_ready_lock_order`**, not `40P01` |
| P4 ascending multi-statement | PASS | allowed |
| P5 multi-shop single statement, VALUES in descending order | PASS | succeeds — trigger iterates `shopId ASC` internally |
| P6 savepoint-rollback bypass attempt | PASS | after `ROLLBACK TO SAVEPOINT` the register reverts to its pre-savepoint value and descending acquisition is **still blocked** — no bypass via savepoints |
| P7 `stocky_control_plane` clears register | PASS | register cleared to `null` — confirms **F-CLAUDE-D051-01 is accurate**: defense-in-depth, not an enforcement boundary |
| P8 lease CAS takes no readiness advisory | PASS | `DISPATCH_LEASED` update completed in 45 ms while `advisory(probe_a)` was held externally |

P1, P3 and P8 independently reproduce the D-051 correction's three core claims. P7 independently confirms the recorded residual is stated correctly rather than overstated.

### 14.3 Deadlock freedom vs the dispatcher

Writers order locks `DurableJob → advisory(shop) → DispatchReadyShop`. The dispatcher orders `DispatchReadyShop → DurableJob` — nominally opposite. No cycle is possible because **every dispatcher lock is `SKIP LOCKED`**, so the dispatcher never waits on a contended row and cannot be a cycle participant. Confirmed by source (`fair-claim-query.server.ts:175, 294, 415, 474, 547`) and by the project's own zero-deadlock benchmark.

### 14.4 Project D-051 suite

`d051-corrections.test.ts` (11 tests) passed within C22, including `distinct-shop concurrency benchmark: no global convoy, zero deadlocks` (16.8 s), `head-of-line: held 100-shop readiness tx does not stall an unrelated merchant`, `opposite-order multi-statement txs: lock-order fail-closed, zero 40P01, readiness intact`, and `expired-lease recovery matrix still recreates readiness (1/2/100 shops)`. These match my independent probe results.

## 15. Migration assessment

- **Clean chain:** `prisma migrate deploy` on a fresh database applied the entire chain through `20260812230000_sync_control_plane_d051_readiness_lock_scope` — EXIT 0 (C04).
- **Additive:** all 11 PR 4 migration directories are additions; `prisma/migrations` shows +1,992 / −0.
- **No silent modification of reviewed migrations.** Three migration files have more than one commit; each was checked against its review date:

| Migration | Commits | Latest edit | Its review incorporated | Verdict |
|---|---|---|---|---|
| `…d050_split_claim_statement_triggers` | 4 | 2026-08-11 20:08 | 2026-08-12 23:01 (`747cf35`) | all edits **predate** review — clean |
| `20260804180000_sync_control_plane` | 2 | 2026-08-04 18:24 | initial implementation window | clean |
| `…d051_readiness_lock_scope` | 2 | 2026-08-13 16:27 (`eb75711`) | post-review, comment-only | see below |

- **D-051 post-review change is header-comment-only — independently verified.** Comment-stripped MD5 of the executable SQL is byte-identical across the reviewed and head revisions:

```
at d94f5d2 (reviewed): 2b63c359ed0196cf472398e8c698e625
at eb75711 (head):     2b63c359ed0196cf472398e8c698e625   => IDENTICAL
```

The diff replaces an over-strong "runtime writers never…" claim with the accurate CORRECTNESS BASIS / DEFENSE-IN-DEPTH split. This is a truthfulness improvement, not a behavior change.

- **Role lifecycle/provisioning and drift:** C05–C21 all exit 0, including `tenant:schema:drift` and `tenant:enforcement:drift`.
- **Migration retries/resets do not conceal privilege or state problems:** the suite repeatedly calls `resetPublicSchema` + `prisma migrate deploy` and re-verifies; `NEW-PR4-C07` role-present and role-absent fixtures both passed, as did "parking cleanup restores migration tree after injected assertion failure".

### 15.1 The one failing test in my environment — F-F03 (investigated, not dismissed)

`npm run test:migrations` (C43) **exited 1**: `Test Files 1 failed | 48 passed (49)`, `Tests 1 failed | 225 passed (226)`. The single failure was:

```
× tenant compatibility indexes on PostgreSQL
  > DML overlaps active build-scan and validation-scan phases (F-F03), 3 iterations
  → expected true to be false // Object.is equality
```

The review mandate requires distinguishing a project defect from a reviewer-environment artifact **with direct mechanism evidence**, not by appearance. Evidence gathered:

**1. The failing assertion is a harness precondition, not a safety property.** The assertion is `expect(buildSettled).toBe(false)` — it requires the `CREATE INDEX CONCURRENTLY` to still be *in progress* so the test can write during the active phase. "expected true to be false" means the index build **finished early**, before the harness could observe the phase.

**2. The actual safety assertions passed with ~4 orders of magnitude of margin.** From the emitted evidence for the iteration that completed:

| Phase | Write windows observed | Threshold | Locks |
|---|---|---|---|
| build scan | insert 1.696 ms, update 1.234 ms, delete 2.479 ms | 15,000 ms | `ShareUpdateExclusiveLock`, **no** `AccessExclusiveLock` |
| validation scan | insert 1.348 ms, update 0.975 ms, delete 1.504 ms | 15,000 ms | `ShareUpdateExclusiveLock`, **no** `AccessExclusiveLock` |

`indexVerification: "valid_exact"`. The merchant-facing property this test exists to protect — that DML is not blocked during concurrent index build — **held**. Observed `buildDurationMs` was only **357.8 ms**, i.e. the build was fast enough to race the observer.

**3. The test and its subject are outside PR 4's change surface.** The test file is **byte-identical to base `main`** (md5 `1fa0717dc961477185162c14025d4ae0` at both `e69bc53d` and `eb757119`); `scripts/tenant-indexes/` is untouched by the diff (last modified by the PR 3 merge `deef5d7`, already in the base); and no PR 4 migration contains any `Supplier` DDL. It exercises PR 1/PR 3 tenant compatibility indexes, with no sync control-plane code participating.

**4. The same test at the same commit passes in CI.** Exact-head PR CI job `94516999137` step 130 `Migration and tenant-backfill tests` — which runs this suite — concluded **success** (9m17s), as did the push run.

**5. It passes locally in isolation — 3 out of 3.** Re-running only F-F03 on an otherwise idle machine:

| Isolated run | Command | EXIT | Result |
|---|---|---|---|
| 1 | `npm run test:migrations -- scripts/tenant-indexes/tests/indexes.migration.test.ts -t "F-F03"` | 0 | 1 passed |
| 2 | same | 0 | 1 passed |
| 3 | same | 0 | 1 passed |

My single failing execution occurred immediately after two consecutive 50,000-job performance suites plus a full migration suite on a shared container — a load profile that starves the observer thread relative to a 357 ms index build.

**Conclusion: reviewer-environment timing artifact on out-of-scope PR 1/PR 3 tooling. Not a PR 4 defect and not a PR 4 regression.** It matches the previously recorded F-CLAUDE-D051-03 characterization, now on stronger evidence than the prior report carried. It is recorded below as P3 with a concrete durability recommendation, because a timing-sensitive assertion that can fail under load is real (if minor) test debt — it is simply **not** a defect in this PR.

## 16. Performance and boundedness assessment

Performance suite (C34) executed at the CI population `SYNC_PERF_JOB_COUNT=50000`: **6 files, 64 tests passed, 259.7 s.**

Named gates that passed:

- `operational fair-claim plan at ≥50k mixed eligible rows (no Shop/DurableJob Seq Scan)`
- `active-due scaling 10/100/1k/5k/20k uses schedule index (F-D048-03 release gate)`
- `Shop scaling: readiness rows returned/locked stay bounded as total Shop grows`
- `fairness matrix through 2,000 shops with identical timestamps`
- `repeated-cycle fairness: every eligible shop progresses within documented bound`
- `concurrent 2-way and 4-way dispatch refill aggregate capacity`
- `equality shopId predicate regresses to eligible_* filter; range-pair retains shop-claim` — **the live R-122 regression gate**
- `≥1000 claim-vs-insert false-negative races: zero missing readiness` (94.4 s)
- `multi-shop deadlock stress: zero 40P01 under statement triggers` (25.1 s)
- `≥500 concurrent same-shop races produce ZERO false-negative readiness` (32.6 s)

### D-051 distinct-shop concurrency benchmark (emitted at exact head)

| workload | concurrency | tps | p99 (ms) | max (ms) | deadlocks | errors | advisoryWaitMax |
|---|---|---|---|---|---|---|---|
| control | 1 | 1104.08 | 1.61 | 5.74 | 0 | 0 | **0** |
| control | 2 | 2258.58 | 1.65 | 6.25 | 0 | 0 | **0** |
| control | 4 | 3681.16 | 3.34 | 11.55 | 0 | 0 | **0** |
| control | 10 | 5504.58 | 4.06 | 15.22 | 0 | 0 | **0** |
| intake | 1 → 10 | 1180.98 → 4247.72 | 1.28 → 5.80 | 6.67 → 26.42 | 0 | 0 | **0** |
| retry | 1 → 10 | 587.07 → 2055.84 | 3.28 → 9.27 | 9.41 → 30.75 | 0 | 0 | **0** |
| recovery | 1 → 10 | 362.68 → 1313.80 | 5.66 → 16.25 | 10.71 → 37.29 | 0 | 0 | **0** |
| mixed | 1 → 10 | 1332.45 → 2838.54 | 1.31 → 9.00 | 6.30 → 22.63 | 0 | 0 | **0** |

Throughput rises monotonically with concurrency in every workload (control ~5× from concurrency 1→10), with **zero deadlocks, zero errors, and `advisoryWaitMax = 0` in all 20 rows**. Zero advisory-wait samples is the decisive measurement: unrelated merchants are not queueing on a shared readiness lock. R-127 is closed on independent evidence, and the D-050 convoy is not reintroduced.

### Other boundedness properties

- **Claim plan shape is asserted, and the assertions are real:** `eligible-claim-plan.test.ts` *rejects* `Seq Scan on "DurableJob"`, `Seq Scan on "Shop"`, `WindowAgg`, and bitmap-scan plans, and *accepts* only ordered index scans on `DispatchReadyShop_dispatch_schedule_idx` / `DurableJob_shop_claim_*_idx`. These are falsifying assertions, not tautologies.
- **Projection bounds are explicit and fail closed** (`sanitize.server.ts`): 256 KiB UTF-8, depth 8, 2,000 nodes, 500 array elements, 250 line items, 4,096-char strings, 64 object keys. Overflow raises `projection_bounds_exceeded` — no silent truncation.
- **Recovery paths are bounded:** `LIMIT` + `SKIP LOCKED` on lease recovery; `take: limit` on stranded/expired candidate scans; bounded refill rounds on fair claim.
- No unbounded materialization or hidden O(N) platform scan was found in the control-plane paths.

- **Claim plan shape is asserted, and the assertions are real:** `eligible-claim-plan.test.ts` *rejects* `Seq Scan on "DurableJob"`, `Seq Scan on "Shop"`, `WindowAgg`, and bitmap-scan plans, and *accepts* only ordered index scans on `DispatchReadyShop_dispatch_schedule_idx` / `DurableJob_shop_claim_*_idx`. These are falsifying assertions, not tautologies.
- **Projection bounds are explicit and fail closed** (`sanitize.server.ts`): 256 KiB UTF-8, depth 8, 2,000 nodes, 500 array elements, 250 line items, 4,096-char strings, 64 object keys. Overflow raises `projection_bounds_exceeded` — no silent truncation.
- **Recovery paths are bounded:** `LIMIT` + `SKIP LOCKED` on lease recovery; `take: limit` on stranded/expired candidate scans; bounded refill rounds on fair claim.
- **No unbounded materialization** was found in the control-plane paths.

## 17. Privacy assessment

Independently grepped `sanitize.server.ts` and `intake.server.ts` for `email`, `phone`, `customer`, `address`, `firstName`, `lastName`, `accessToken`, `authorization`, `cookie` — **zero occurrences**.

Projections are strict allowlists built field-by-field:

| Topic | Persisted fields | PII present |
|---|---|---|
| `orders/create` / `orders/cancelled` | ids, name, timestamps, cancel reason, financial/fulfillment status, currency, 4 money fields, bounded line items | **none** — no customer, email, phone, billing/shipping address |
| `refunds/create` | ids, timestamps, `note: null` (hardcoded), bounded refund line items | **none** — note deliberately dropped |
| `inventory_levels/update` | `inventory_item_id`, `location_id`, `available`, `updated_at` | **none** |
| `app/uninstalled` | `id`, `domain`, `myshopify_domain` | **none** |

No raw webhook payload is persisted. No tokens, cookies, or authorization headers are stored.

**Decimal-safe money:** `moneyString()` keeps money as exact strings and explicitly never applies `Number`/`parseFloat`; non-finite or object values are rejected. The only `Number(...)` calls in `app/sync` are on integer ordinals and dispatch sequences (`dispatcher.server.ts:125,197`, `fair-claim-query.server.ts:644`, `queue-presence.server.ts:84`) — **no money passes through lossy numeric conversion.**

## 18. Shopify API gate — Q-003 / F-PR4-18

Independently validated; not accepted from prior reports.

**1. Correct supported target.** Official Shopify versioning documentation (fetched during this review) states a new version ships quarterly and each is supported ≥12 months. As of 2026-08-13 the accessible stable versions are `2025-10`, `2026-01`, `2026-04`, and `2026-07`, with **`2026-07` the latest stable** (released 2026-07-01, accessible until 2027-07-16). The repository's `2026-07` target is therefore the current, correct, non-near-retirement choice.

**2. Configuration agreement.** All three independent declaration points agree:

| Location | Value |
|---|---|
| `shopify.app.toml` → `[webhooks] api_version` | `2026-07` |
| `app/shopify.server.ts` → `apiVersion` / exported `apiVersion` | `ApiVersion.July26` |
| `.graphqlrc.ts` → codegen `apiVersion` | `ApiVersion.July26` |

`ApiVersion.July26 = "2026-07"` verified in the installed `@shopify/shopify-api` enum. No mixed-version path: the `2025-10` strings remaining in `app/services/*` are documentation/guard text for the still-disabled transfer-receive workflow, not an active version pin.

**3. Codegen against the live schema.** `npm run graphql-codegen` (C31) exited 0 and downloaded the live `app/types/admin-2026-07.schema.json` (6,978,270 bytes) at review time. All Phase 1 GraphQL documents in the current application (`shopify-sync.server.ts`, `shopify-gql.server.ts`, `app.billing.tsx`) validate against it.

**4. The gate is not tautological.** I injected a deliberately invalid document (`shop { thisFieldDoesNotExistOnShop2026 }`) and re-ran codegen: **EXIT 1** (C32). The source file was restored and `git status` confirmed clean. The gate genuinely falsifies.

**5. Webhook / `X-Shopify-API-Version` handling.** `api-version.server.ts` validates the received version; unsupported or missing versions produce a durable quarantine with a `DataIssue` and **no processing job** (F-PR4-18 mechanism). Webhook fixtures across the sync suites assert `apiVersion: "2026-07"`, and the intake-corrections suite passed (C22).

**6. No inventory mutation introduced or enabled.** The only inventory mutation document (`StockyAdjustInventory`) is pre-existing on `main`, untouched by this diff, and gated behind `assertInventoryWriteEnabled`. PR 4 introduces none.

**Disposition: Q-003 and F-PR4-18 — RECOMMEND CLOSURE FOR PR 4 REPOSITORY IMPLEMENTATION.** Evidence is live, independent, exact-head, and falsification-tested. (Partner-Dashboard/deployment concerns remain with Q-002; they are not PR 4 repository-implementation gates.)

## 19. Historical-finding regression matrix

Current exact-head mechanism re-derived; prior "closed" status was not taken at face value.

| Finding / risk | Origin | Exact-head mechanism | Disposition | Evidence |
|---|---|---|---|---|
| F-PR4-01 exactly-once application | original | `SyncApplicationReceipt` + verified-after-rollback finalizer | **Not reproduced** | C23 (42) |
| F-PR4-03 uninstall cancel | original | all 5 cancellable states + coverage assertion | **Not reproduced** | C25, §13 |
| F-PR4-06 role isolation | original | column-level grants, forced RLS, NOINHERIT | **Not reproduced** | C29, §10 probes |
| F-PR4-07 inventory audit | original | semantic scanner + negative fixtures | **Not reproduced** | C30, C19 |
| F-PR4-08 divergent same-ID payload | original | conflict record | **Not reproduced** | C22 |
| F-PR4-11/13 dispatch plan/fairness | original | ordered index-scan assertions | **Not reproduced** | §6.7, §16 |
| F-PR4-12 projection bounds | original | 7 explicit bounds, fail closed | **Not reproduced** | §17 |
| F-PR4-18 API version | original | quarantine on unsupported version | **Closed — recommend** | §18 |
| F-PR4-20 missing webhook ID | original | quarantine + DataIssue, no job | **Not reproduced** | C22, source |
| NEW-PR4-C01 retained terminal queue job | 1st correction | `classifyQueueState`, runnable allowlist | **Not reproduced** | C24 |
| NEW-PR4-C02 nullable delivery in reaper | 1st correction | poison-row isolation | **Not reproduced** | C26 |
| NEW-PR4-C06 `completeAttemptFail` dead-letters | 1st correction | always dead-letters | **Not reproduced** | C26 |
| NEW-PR4-C07 migration fixture hygiene | 1st correction | role-present/absent fixtures | **Not reproduced** | §6.7 |
| NEW-PR4-C08 receipt-probe ownership | 1st correction | `stocky_receipt_probe_owner`, no superuser | **Not reproduced** | C29, §10 |
| NEW-PR4-SC01 ALREADY_APPLIED without verify | 2nd correction | post-rollback receipt verification | **Not reproduced** | C23 |
| NEW-PR4-SC04 nullable selector | 2nd correction | fails closed | **Not reproduced** | C24, C28 |
| NEW-PR4-SC05 terminal transition result | 2nd correction | `requireExactlyOneTransitionRow` | **Not reproduced** | C28 |
| NEW-PR4-SC06 paused allowlist | 2nd correction | `paused` excluded | **Not reproduced** | C28 |
| NEW-PR4-SC08 stranded attempt budget | 2nd correction | budget increments | **Not reproduced** | C24, C28 |
| NEW-CLAUDE-D045-01 / R-115 classification seam | D-045 | **seam absent from production source**; test asserts absence | **Not reproduced** | grep + C28 |
| NEW-CLAUDE-D045-02 / R-116 v2/v3 worker evidence | D-045 | real v2/v3 catch matrix + RepeatableRead | **Not reproduced** | C23 |
| NEW-CLAUDE-D045-04 / R-118 attempt budget on terminalize | D-045 | `attemptCount = nextAttemptCount` persisted | **Not reproduced** | source `:932/:1120/:1273` |
| R-114 corrupted `[REDACTED]` source string | D-044 | now a **fail-closed guard** rejecting the placeholder | **Not reproduced** | `queue.server.ts:20–42` |
| F-D048-01 / R-121 readiness false-negative | D-048 | fresh-snapshot reconcile | **Not reproduced** | C22, §6.7 |
| F-CLAUDE-D049-01 / R-125 same-statement snapshot delete | D-049 | split claim/reconcile | **Not reproduced** | C22 |
| F-CLAUDE-D049-02 / R-126 GUC platform abort | D-049 | GUC removed; statement-level multi-shop | **Not reproduced** | C22, P5 |
| P2-D046-01 / R-119 unordered claim plan accepted | D-046 | `ANALYZE` + ordered-plan assertion | **Not reproduced** | §16, §6.7 |
| R-120 full-scan/sort of eligible backlog | D-047/48/49 | schedule index + ordered scans | **Not reproduced** | §6.7 |
| F-CLAUDE-D050-01 / R-127 global readiness convoy | D-050 | per-shop advisory keys | **Not reproduced — independently falsified** | **P1: 6 ms cross-shop**; C22 benchmark |
| F-CLAUDE-D050-02 stale identity records | D-050 | identity records corrected | **Not reproduced** | §22 |
| F-CLAUDE-D050-03A/B / R-128 non-independent contract tests | D-050 | expectations decoupled | **Not reproduced** | C22 |
| P3-D046-01 vacuous name-filter success | D-046 | zero-pass reporter guard | **Not reproduced** | §6.7 guard probe |

**No previously closed safety or correctness finding regressed at exact head.**

## 20. Risk / open-question disposition

| ID | Recommended disposition | Basis |
|---|---|---|
| R-031 queued jobs after uninstall | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | all 5 cancellable states cancelled; worker + dispatcher re-check `processingEnabled`; C25 |
| R-032 webhook replay/reconciliation | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | durable inbox, digest idempotency, dead letters, `JobReplay` lineage; C22–C24 |
| R-033 API-version retirement / invalid ops | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | §18 — live 2026-07 validation + falsification probe |
| R-039 unvalidated job envelopes | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | HMAC v3 + digest/identity binding to durable row; C27 |
| R-099 DB/Redis dispatch gap | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | C24 (29 tests incl. outage, stranded, retained-terminal) |
| R-100 replay authority/lineage | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | fresh envelope, digest match, disabled-shop deny; C22 |
| R-101 uninstall race | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | §13; C25 |
| R-102 control-plane merchant access | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | §10 direct privilege probes — zero merchant grants |
| R-103 projection PII | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | §17 — zero PII terms |
| R-104 stuck leases / duplicate attempts | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | partial unique active attempt enforced by DB; C26 |
| R-105 version pin/fixture/schema drift | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | §18 — three-point agreement + live codegen |
| R-106 over-broad idempotency | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | conflict + null-ID quarantine; C22 |
| R-107 state-machine corruption | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | fail-closed graph + DB trigger + CAS; C22 |
| R-108 dead-letter/replay rewrite | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | one OPEN DL per job; immutable original |
| R-109 duplicate merchant effects | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | §11; C23 |
| R-110 scanner blind spots | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | semantic scanner + negative fixtures; C19, C30 |
| R-111 dispatch plan / starvation | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | §16, §6.7 |
| R-112 report/count inconsistency | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | records reconcile; §22 |
| R-113 unbounded projection | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | 7 bounds, fail closed; §17 |
| R-114 redaction source corruption | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | now a fail-closed guard |
| R-115 production-reachable classification seam | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | seam absent; absence asserted in CI |
| R-116 overstated v2/v3 evidence | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | real worker matrix; C23 |
| R-117 stale runtime-head label | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | identity records distinguish roles correctly |
| R-118 attempt budget on terminalize | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | persisted; source-verified |
| R-119 unordered claim plans accepted | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | ordered-plan assertions falsify |
| R-120 full-scan/sort fair-claim | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | §6.7, §16 |
| R-121 readiness false-negative | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** | not reproduced |
| **R-122** range-pair planner dependency | **ACCEPTED NONBLOCKING RESIDUAL** | The `shopId >= x AND shopId <= x` form is load-bearing for plan shape, but an equality-regression CI gate exists and the ordered-plan assertions fail closed if the planner changes. A planner regression degrades performance and is *caught*, not silently accepted; it cannot corrupt inventory, tenancy, or correctness. Does not threaten PR 4 correctness or its acceptance criteria. |
| **R-123** multi-shop readiness lock-order / deadlock | **ACCEPTED NONBLOCKING RESIDUAL** | Independently re-derived: the transaction-shape invariant **holds** at exact head across the complete writer inventory (§14.1), and the mechanism was falsification-probed 8/8 (§14.2). Descending acquisition fails closed with P0001 rather than deadlocking; savepoint rollback does not bypass it. Residuals F-CLAUDE-D051-01/02 are accurately characterized. No current correctness threat. |
| R-124 harness flake | **CLOSED** (remains) | no regression observed. The F-F03 load sensitivity I hit (§15.1) is the **distinct** F-CLAUDE-D051-03 item, not R-124's deadlock-timeout harness; per D-051, R-124 is **not** reopened. |
| R-125 same-statement snapshot delete | **CLOSED** (remains) | not reproduced |
| R-126 GUC platform abort | **CLOSED** (remains) | not reproduced |
| **R-127** global readiness convoy | **CLOSED — no regression** | P1 probe: 6 ms cross-shop completion under a held lock; project benchmark zero deadlocks |
| **R-128** non-independent contract tests | **CLOSED — no regression** | expectations independently derived; C22 |
| **Q-003** Admin API version | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION — recommended** | §18 |
| **F-PR4-18** version residual | **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION — recommended** | §18 |

Production-operational risks (R-028, R-029, R-095–R-098, Q-002, Q-008) are **not** closed by this review; disposable-environment evidence does not close production-operational gates.

## 21. New findings

**P0: 0 · P1: 0 · P2: 0 · P3: 4**

No P0, P1, or P2 finding was identified at exact head. No correctness defect was downgraded to reach a readiness verdict; the four P3 items below are the complete set of new issues found.

---

### F-CLAUDE-PR4ACC-01 — Stale PR #20 description (P3, evidence hygiene)

* **Severity:** P3
* **Location:** GitHub PR #20 description (not a repository file)
* **Evidence:** The body records `Current PR head: 938e9981dc5f4e551e0cebd37250ae7a40507575` and exact-head CI runs `31658195375` / `31658197379`. The actual head is `eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3` with CI runs `31720795422` / `31720798487`. The body also states "Q-003 and F-PR4-18 remain OPEN" and "R-127, R-128 remain OPEN pending independent review", both superseded by the incorporated D-051 review and this review.
* **Merchant impact:** None. Documentation only.
* **Reproduction:** Compare the PR body against `PROJECT_STATUS.md` and `DECISIONS.md` at head.
* **Expected behavior:** The PR body should not contradict current branch control records at merge time.
* **Governance consequence — assessed and found none.** The authoritative identity records (`PROJECT_STATUS.md`, `DECISIONS.md`, the architecture doc) and the PR comments are current and correct, and no approval decision was taken on the basis of the stale text. The implementation agent recorded that it could not rewrite the body through the available integration. This is therefore **evidence-hygiene debt, not a material governance defect**.
* **Recommended correction:** Refresh the PR body before merge so the permanent merge record is not misleading. This is a documentation update and must **not** be turned into a runtime correction cycle.
* **Missing test:** None appropriate — PR body content is not repository-testable.

---

### F-CLAUDE-PR4ACC-02 — `2025-10` intake adapter will outlive its supported window (P3, future maintenance)

* **Severity:** P3
* **Location:** `app/sync/api-version.server.ts:19` — `SUPPORTED_API_VERSION_ADAPTERS = ["2025-10", "2026-07"]`
* **Evidence:** Intake accepts both `2025-10` and `2026-07`. Per official Shopify versioning documentation, `2025-10` remains an accessible supported version until **2026-10-16**.
* **Assessment — not a current defect.** Accepting the immediately-prior version during a migration window is correct: Shopify may briefly deliver webhooks on the previous version after a target bump. This is **not** a silent mixed-version path: the target is a single constant (`TARGET_API_VERSION = "2026-07"`), all outbound Admin calls use `ApiVersion.July26` only, and the received version is persisted verbatim on `WebhookDelivery`, so any `2025-10` delivery is auditable rather than invisible.
* **Merchant impact:** None today.
* **Expected future behavior:** After 2026-10-16, `2025-10` should be removed from the adapter list so a retired version is quarantined rather than accepted.
* **Recommended correction:** Track as scheduled maintenance tied to the `2025-10` retirement date. **Do not change it in this PR.**
* **Missing test:** A dated guard asserting the adapter list contains no retired version would make this self-enforcing.

---

### F-CLAUDE-PR4ACC-03 — No static guard binds future readiness writers to the transaction-shape invariant (P3, confirms F-CLAUDE-D051-02)

* **Severity:** P3 — **nonblocking, and the mandate's three conditions for nonblocking status are independently satisfied**
* **Location:** `app/sync/*` readiness writers; `prisma/migrations/20260812230000_.../migration.sql`
* **Evidence:** D-051 deadlock freedom rests on the audited transaction-shape invariant. Nothing mechanically prevents a *future* writer from issuing readiness-changing statements for different shops in separate statements in a dangerous order. `stocky.ready_lock_max_shop` reduces the blast radius but is defense-in-depth, not enforcement (independently confirmed: probe P7 cleared it as `stocky_control_plane`).
* **Mandate conditions:**
  1. *Writer inventory independently complete* — **YES.** I enumerated every `$transaction` site in `app/`, every `DurableJob` create/update/updateMany/raw-UPDATE, and every `Shop.processingEnabled` writer, and classified each by shop-count and statement-count (§14.1).
  2. *No current writer violates the invariant* — **YES.** Every multi-shop readiness writer is single-statement; every multi-statement readiness writer is single-shop; the only multi-shop multi-statement transaction (`claimBatchFair`) takes no readiness advisory lock at all, confirmed empirically by probe P8.
  3. *Residual explicitly recorded as future-maintenance risk* — **YES**, here and on R-123.
* **Merchant impact:** None at exact head.
* **Recommended correction (future, not this PR):** A static guard or lint rule asserting that readiness-changing writers are either single-shop or single-statement. Per D-051, this must **not** be implemented in this synchronization.
* **Missing test:** A source-level architecture assertion over the writer inventory.

---

### F-CLAUDE-PR4ACC-04 — F-F03 index-overlap test is load-sensitive (P3, out-of-scope test debt)

* **Severity:** P3 — **out of PR 4 scope; does not block PR 4 acceptance**
* **Location:** `scripts/tenant-indexes/tests/indexes.migration.test.ts:625` (PR 1 / PR 3 tooling; byte-identical to base `main`)
* **Evidence:** `npm run test:migrations` in my environment exited **1** (`225 passed, 1 failed`) on `expect(buildSettled).toBe(false)`. Full analysis in §15.1.
* **Why it is not a PR 4 defect:** test file and subject are untouched by this diff; no `Supplier` DDL in any PR 4 migration; the same test at the same SHA passes in exact-head CI (job `94516999137` step 130); and it passes locally 3/3 in isolation. The failing assertion is a harness precondition — the merchant-facing safety properties (DML latency 0.98–2.48 ms vs a 15,000 ms threshold, `ShareUpdateExclusiveLock` only, `valid_exact`) all held.
* **Merchant impact:** None.
* **Reproduction:** Run the full migration suite immediately after two 50k-row performance suites on a shared/loaded container.
* **Expected behavior:** The test should either deterministically hold the build open (e.g. an explicit gate released only after the phase writes complete) or skip with a recorded reason when it cannot observe an active phase, rather than asserting on a race it does not control.
* **Recommended correction:** Harden in **PR 1/PR 3 tooling maintenance, not in PR 4**. Do not open a D-052 runtime cycle for this.
* **Missing test:** N/A — this *is* the test; it needs determinism, not new coverage.

---

### Explicitly checked and NOT found

To be clear about what was actively hunted rather than assumed absent: cross-tenant exposure via the control-plane role; inventory mutation introduced or enabled; PII in persisted projections; money through lossy `Number`/`parseFloat`; raw payload persistence; `continue-on-error` or skipped material CI paths; vacuous name-filter CI gates; tautological GraphQL validation; post-review edits to reviewed migrations or approved review reports; regression of any previously closed safety/correctness finding. **None was found.**

## 22. Documentation and chain of custody

- `PR4_SYNC_CONTROL_PLANE_ARCHITECTURE.md` describes D-051 correctly, states the **CORRECTNESS BASIS** is the audited transaction-shape invariant, and explicitly labels `stocky.ready_lock_max_shop` as **defense-in-depth, not a security or correctness enforcement boundary** — matching what I independently measured (P7).
- No document at head claims PR 4 is accepted. `PROJECT_STATUS.md` states `D-051 CORRECTION CLOSURE — APPROVED — not accepted`, next gate `PENDING CUMULATIVE INDEPENDENT PR 4 ACCEPTANCE REVIEW`, and `PR 5: BLOCKED`.
- **Review-report immutability:** two PR 4 review reports have two commits each (`PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT`, `…D051_CORRECTION_REVIEW_REPORT`). In both cases the second commit is the reviewer completing their own report before incorporation/approval — for D-051 both commits share timestamp 2026-08-13 16:24:18 and are the documented two-commit incorporation (`768a1d2` then `dd0f9e7`) recorded in `PROJECT_STATUS.md`. **No post-incorporation edit of an approved review report was found.**
- Review-report blob identities reconcile exactly: D-050 `8247d8ae…`, D-051 `d17df590…`.
- No report claims execution that did not occur, so far as I could verify.
- **Stale PR body (evidence-hygiene debt).** The PR #20 description still records head `938e9981…` and CI runs `31658195375`/`31658197379`, superseded by `eb757119…` and `31720795422`/`31720798487`. Branch control records (`PROJECT_STATUS.md`, architecture doc) and PR comments are current and correct. **Classification: P3 evidence hygiene — the body should be refreshed before merge so the merge record is not misleading, but this is a documentation update, not a runtime correction, and no governance decision was made on the stale text.**

## 23. Inventory-write safety statement

**Inventory writes remain OFF and unauthorized.**

- `app/lib/feature-flags.server.ts` — `envFlag(name, defaultEnabled = false)`; all five capabilities (`stocktakeInventoryWrites`, `adjustmentWrites`, `receiptWrites`, `costSync`, `transferWrites`) default **OFF** when unset or empty.
- `assertInventoryWriteEnabled` throws unless explicitly enabled.
- The PR 4 diff does **not** touch `feature-flags.server.ts` or any inventory-write service path.
- CI sets all five flags to `"false"`; my environment mirrored that.
- **No inventory mutation was introduced, enabled, or executed during this review.** No production database, merchant data, production queue, production credentials, production migrations, or production Shopify writes were used at any point.

## 24. PR 5 status statement

**PR 5 remains BLOCKED** pending ChatGPT PR 4 acceptance and merge. No PR 5 catalog, location, or inventory-fact work exists at exact head (§7), and none was performed by this review.

## 25. Accepted residuals and final verdict

### 25.1 Accepted residuals — complete enumeration

Every residual carried into acceptance, with justification:

| ID | Severity | Why acceptable for PR 4 |
|---|---|---|
| **R-122** — fair-claim range-pair planner dependency | P3 | `shopId >= x AND shopId <= x` is load-bearing for index selection, but a live equality-regression gate exists and **passed** in C34 (`equality shopId predicate regresses to eligible_* filter; range-pair retains shop-claim`), and the ordered-plan assertions fail closed on planner drift. Worst case is a *caught* performance regression, never silent corruption of inventory, tenancy, or financial data. |
| **R-123** — multi-shop readiness lock-order / deadlock | P2 risk, nonblocking residual | The correctness basis — the transaction-shape invariant — was independently re-derived across the complete writer inventory (§14.1) and falsification-probed 8/8 (§14.2). Descending acquisition fails closed with `P0001`; savepoint rollback does not bypass it; the dispatcher takes no readiness advisory lock. Zero `40P01` across every stress suite. No current correctness threat. |
| **F-CLAUDE-D051-01** — GUC is defense-in-depth, bypassable by `stocky_control_plane` | P3 | **Independently confirmed accurate** (probe P7 cleared the register as that role). The documentation and migration header state this correctly rather than overclaiming. Correctness does not rest on it. |
| **F-CLAUDE-D051-02** — no static guard for future readiness writers | P3 | The mandate's three conditions are satisfied: writer inventory independently complete, no current violator, residual recorded as future-maintenance risk (F-CLAUDE-PR4ACC-03). |
| **F-CLAUDE-D051-03 / F-CLAUDE-PR4ACC-04** — F-F03 load sensitivity | P3 | Out of PR 4 scope; CI-green at exact head; 3/3 isolated passes; safety properties held (§15.1). |
| **F-CLAUDE-PR4ACC-01** — stale PR #20 body | P3 | Documentation only; authoritative control records are current; refresh before merge. |
| **F-CLAUDE-PR4ACC-02** — `2025-10` adapter outlives its window | P3 | Correct today (2025-10 supported until 2026-10-16); received version persisted verbatim so nothing is silent; scheduled maintenance item. |

Not closed by this review, and explicitly **not** acceptance residuals: R-028, R-029, R-095–R-098, Q-002, Q-008 and all production-operational gates. Disposable-environment evidence cannot close production-operational risk.

### 25.2 Readiness rule evaluation

| Requirement for `READY FOR CHATGPT PR 4 ACCEPTANCE` | Status |
|---|---|
| P0 = 0 | **YES** — 0 |
| P1 = 0 | **YES** — 0 |
| No P2 materially blocking the approved PR 4 contract | **YES** — 0 P2 |
| Q-003 / F-PR4-18 independently satisfied | **YES** — §18, live schema + falsification probe |
| No unresolved contradiction with the approved Phase 1 brief | **YES** — all 7 PR 4 criteria met (§8); no later-phase scope (§7) |
| No material regression of a previously closed safety/correctness finding | **YES** — §19, none reproduced |
| All remaining P3 / accepted residuals enumerated and justified | **YES** — §25.1 |

The single failing command in my environment (C43) was investigated to a concrete mechanism and shown to be an out-of-scope, load-induced harness race that is CI-green at this exact SHA and passes 3/3 in isolation. It was **not** dismissed as "environmental" by appearance, and it is recorded as a P3 finding rather than suppressed.

### 25.3 Final verdict

```
READY FOR CHATGPT PR 4 ACCEPTANCE
```

**P0: 0 · P1: 0 · P2: 0 · P3: 4 (all enumerated and justified)**

This verdict covers **PR 4 repository implementation only**. It is advisory evidence for the acceptance authority and confers no other permission.

Explicitly **not** authorized or implied by this report:

* merge of PR #20 — **merge authorization remains separate and is not granted here**;
* marking PR #20 ready for review;
* ChatGPT PR 4 acceptance itself — that authority is retained by ChatGPT;
* starting PR 5 — **remains BLOCKED** pending acceptance and merge;
* production deployment, production backfill, or ownership repair;
* enabling any inventory-write flag or performing any inventory mutation;
* closure of production-operational risks or Q-002 / Q-008.

**Recommended before merge (documentation only, not a runtime correction cycle):** refresh the PR #20 description per F-CLAUDE-PR4ACC-01 so the permanent merge record reflects head `eb757119…` and CI runs `31720795422` / `31720798487`.
