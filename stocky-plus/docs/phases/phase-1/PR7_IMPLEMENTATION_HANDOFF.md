# Phase 1 PR7 — Implementation handoff (planning / feasibility)

**Status:** `PR48 EVIDENCE SEALED FOR CONSOLIDATED PR45 REVIEW — NO RUNTIME AUTHORIZED`
**Companion evidence:** `PR7_MERGED_MAIN_ENTRY_EVIDENCE.md` (appendices seal recovered probe sources)
**Proposal input (not accepted authority):** PR45 `a292bc8a6ea26192bc295af7338dd6d653a3e65c`
**Measured merged-main snapshot:** W `ee193f38491245a10fb2fa60d2cf9a29f3271605` (contains the D module this packet inspected).
**Implementation-entry base:** **not automatically W.** The eventual implementation SHA is an entry decision after actual PR6 closure on main, accepted integrated PR45 planning, and later explicit runtime authorization. It is **not** the PR45 SHA.
**D-054 / no D-055. R-176 OPEN/P0. R-164 unchanged. Q-008 OPEN.**

This handoff does not authorize runtime, migrations, grants, `useOnlineTokens`, flags, mark-ready, or merge. Constrained D-PR7 / Decision A–E / TF items stay constrained. Coordinator does **not** decide open legal/product questions.

**ID qualification:** Helper A `PREP-A-*` ≠ coordinator `PREP-A-*`. Helper B `PREP_B_*` ≠ coordinator `PREP-B-*` / `PREP-COORD-B-*`. Helper C `PREP-C-*` are the inventory IDs used in the packet’s §6 unless labelled otherwise. Load-bearing reproducers are sealed in the evidence appendices; `/tmp` paths are historical execution locations, not durable-only references.

## 1. Implementation-entry decisions (still OPEN)

Do **not** start PR7 runtime until every row is closed by ChatGPT (or explicitly accepted as an implementation proof with a failing test).

| ID | Question | Constrained direction (PR45) | This packet’s executed delta | Blocks runtime start? |
|---|---|---|---|---|
| **D-PR7-01** | Actor source | Persist verified `sessionToken.sub` **string**; no recovery from rounded numbers | **Executed (mocked transport):** embedded `authenticate.admin` already returns `sessionToken.sub` with `useOnlineTokens: false` (Helper A PREP-A-01). W `requireAdminTenant` still ignores it. `String(associated_user.id)` is unsafe (collision + **mixedToken** reuse, Helper A PREP-A-09). Implementation must still *read* `sessionToken` and refuse numeric/rounded `sub`. | **Yes** until implementation bind tests (not blocked on enabling online tokens) |
| **D-PR7-02** | Online tokens | FUTURE `useOnlineTokens: true` for human platform only; offline for jobs; **no config now** | Enabling the flag is what populates `associated_user` (D-PR7-04 owner proof). It is **not** what makes `sub` appear. W still offline-default. Cached online sessions are **not** re-checked against current `sub` (Helper A PREP-A-11). Live token exchange **UNVERIFIED**. | **Yes** for owner/`associated_user` proof; **not** a prerequisite for reading JWT `sub` |
| **D-PR7-03** | Receipts as audit? | **No** | unchanged | Yes |
| **D-PR7-04** | First owner | Same-context verified `account_owner`; unsafe correlation → unassigned | Staff vs owner fields exist on `OnlineAccessUser` (PREP-A-10). Numeric correlation is unsafe (PREP-A-02). | Yes |
| **D-PR7-05** | redact vs reinstall | Classifier §7.6.1; old receipts never exempt new work | not re-probed (PG model already on PR45) | Yes |
| **D-PR7-06** | afterAuth REDACTED | No revival of ERASING/FINALIZING | W `runAfterAuthTenantBootstrap` still swallows `reinstall_denied` then upserts `ShopSettings` — **must** gain fence | Yes |
| **D-PR7-07** | Gate merchandising? | **No** | frozen | Frozen **No** |
| **D-PR7-08** | Audit vs redact | Append-only runtime; restricted DELETE; Q-008 | unchanged | Yes |
| **D-PR7-09** | Pause | Privacy-local default OFF | unchanged | Frozen home |
| **D-PR7-10** | Redis / coordinator | Not DurableJob; optional Redis hint; poll recovers; no FLUSHALL | Completeness cannot use cancel/TTL/PID. Helper B `PREP_B_06b` (9143 rerun after 4169 isolation error): `Job.remove` of an **active** job throws locked and the worker keeps writing. Helper B `PREP_B_06` waiting-job remove stays **INCONCLUSIVE**. Generation-fenced Redis API **absent** on W. | **Yes** |
| **D-PR7-11** | Delete Shop? | Checked finalizer | not re-probed | Yes |
| **D-PR7-12** | Revoke mid-job | `stocky_authz_lock` + SELECT-only verifier; stable `commandId` | W `replayDeadLetter` still a single CP `$transaction` (FACT V/W) | Yes |
| **D-PR7-13** | DB roles | Per-topic reader/erasure; complete grants | not installed | Yes |
| **D-PR7-14** | data_request | Distinct owner download | W export is HTTP CSV only on **current source inventory**. That does **not** prove historical object-store bytes never existed. | Align before runtime; residual unknown for historical bytes |
| **Q-008** | Retention | OPEN; legal review required | unchanged | **Production** blocker |
| Plan residual 2 | `X-Shopify-Event-Id` on compliance | nullable handling | **UNVERIFIED** | Implementation proof |
| Plan residual 3 | D scratch reclaim API after D merge | infeasible → named follow-up | **API exists on W**. Helper B `PREP_B_19`: `quiescenceConfirmed: true` from another process deleted a live child’s `att-*`. W `live_writer` skip is **process-local** (`isLiveScratchBasename` / `marker.pid === process.pid`), **not** a cross-process PID/liveness guarantee. Occupancy still required. Do not auto-call reclaim from PR7 until real quiescence of every writer process is established. | Implementation must still refuse COMPLETED while occupancy uncertain; do not treat the boolean as liveness |
| **PR45 acceptance** | Plan + matrix after Claude re-review | no unresolved P0/P1/P2 | PR45 still OPEN/DRAFT | **Yes** |
| **PR47 / §10.3** | Formal PR6 closure on merged main | ChatGPT/owner | PR47 `fde01dc5…` unmerged | **Required** later gate. This evidence lane did not wait; that does **not** make the gate optional. |
| **Runtime sentence** | Explicit ChatGPT authority | plan §10.6 | **not issued** | **Yes**. Also required: the implementation-entry SHA is **not** automatically W. |

Smallest remaining auth contract choice: persist JWT `sub` as a **string** from `sessionToken` (available on embedded `authenticate.admin` without enabling online tokens). Never stringify `associated_user.id`. Do not treat a cached online session as corroborated against the current `sub`. `account_owner` still requires D-PR7-02 / online tokens. Add dest/iss hostname equality in **app** code (library accepted mismatch). Do not enable `useOnlineTokens` in this docs lane.

## 2. Exclusive file ownership (FUTURE implementation PR)

Refresh of plan §7.9 against **W**. Still **not** this evidence PR.

**Owned by the future PR7 writer:**

```
stocky-plus/app/audit/**
stocky-plus/app/rbac/**
stocky-plus/app/privacy/**
stocky-plus/app/routes/webhooks.compliance.tsx
stocky-plus/app/routes/app.platform.*.tsx
stocky-plus/scripts/privacy/**
stocky-plus/prisma/schema.prisma          # additive only; no privacy DurableJob strategy
stocky-plus/prisma/migrations/2026*_pr7_*
stocky-plus/app/tenant/models.ts          # additive
stocky-plus/scripts/tenant-enforcement/manifest.ts  # additive
stocky-plus/scripts/tenant-enforcement/roles.ts     # additive
stocky-plus/scripts/tenant-enforcement/sql.ts       # additive privacy SQL; do not change runtime predicate
stocky-plus/package.json                  # test:privacy only
stocky-plus/docs/phases/phase-1/PR7_*IMPLEMENTATION*
```

**Narrow shared FUTURE edits (exact symbols).** Each needs the lifecycle shared gate and, where facts can restore a customer target, the customer-target gate. `processingEnabled` is admission, **not** drain.

| File | W symbol / delta |
|---|---|
| `app/tenant/after-auth.server.ts` | `runAfterAuthTenantBootstrap` — fence; no settings revival on ERASING/FINALIZING |
| `app/tenant/bootstrap.server.ts` | `upsertCanonicalShop` — `assertNoErasureFence` before create |
| `app/tenant/db-context.server.ts` | **REQUIRED** `withTenantBoundTransaction` participating-write guard |
| `app/tenant/tenant-db.server.ts` | local `withTenantBoundTransactionState` — **same required wrapper**; future inventory test must fail on bypass |
| `app/shopify.server.ts` | skip catalog enqueue on fence; `useOnlineTokens: true` **only after** D-PR7-02 authority |
| `app/sync/uninstall.server.ts` | `processUninstall` / local `cancelAllCancellable` — generation `UNINSTALLED`; cancel ordinary jobs only |
| `app/sync/reinstall.server.ts` | keep REDACTED deny |
| `app/sync/intake.server.ts` | ordinary `createDurableJob` unchanged; privacy does **not** gain `allowWhenProcessingDisabled` |
| `app/sync/execution-strategy.server.ts` | unknown remains `NO_AUTOMATIC_RETRY` |
| `app/sync/dispatcher.server.ts` | `dispatchPendingJobs`, local `ensureDispatchRecord`, `enqueueWithDispatch`, **`dispatcher_disabled_shop_path`**, `recoverStrandedEnqueuedJobs`, `recoverExpiredDispatchLeases` (PREP-C-20), `claimBatchFair`, `ackEnqueued` |
| `app/sync/fair-claim-query.server.ts` | do **not** add privacy claim SQL; keep `processingEnabled=true` admission |
| `app/sync/lifecycle.server.ts` | **every** exported attempt writer including `completeAttemptRetry` and `recoverExpiredRunningAttempts` |
| `app/sync/replay.server.ts` | `stocky_authz_lock` + verifier + `PlatformReplayCommand` in the **existing** CP txn |
| `app/sync/health.server.ts` | `computeSyncHealth` **upserts** `SyncHealth` (PREP-C-04) — **not** optional/read-only |
| `app/jobs/workers/catalog-facts/bulk-finish.ts` | W `updateMany` RETRY_WAIT list now includes order-facts jobs; wrap CP write (PREP-C-28) |
| `app/lib/order-facts/sync/**` | entire W tree: source-stage, control-plane, observations, shop-metadata, webhook, import, reconcile, apply-composition |
| `app/sync/application-receipt.server.ts` | `applyWithApplicationReceipt` (V-omitted) |
| `app/lib/order-facts/apply/writers.ts` / `receipts.ts` / `index.ts` | `requireProcessingEnabled` is pre-lock; **REQUIRED** both gates |
| `app/lib/catalog-facts/apply/writers.ts` | same class as order-facts apply |
| `app/lib/catalog-facts/ingest/checkpoint.ts` | local `lockSyncRun` + exported persist/complete helpers |
| `app/lib/order-facts/sync/source-stage.ts` | occupancy/reclaim/stage — generation/target fence or incomplete request |
| `app/jobs/queue.server.ts` | **add** shop/generation-scoped ordinary-job remove; never FLUSHALL; include W-new order-facts enqueue |
| `app/jobs/workers/webhook-processor.ts` | keep `assertShopProcessingEnabled`; **separate** coordinator loop at worker bootstrap |
| `app/jobs/workers/order-facts/sync-jobs.ts` | W-new; long I/O + scratch |
| `app/sync/envelope-v3.server.ts` | `privacy:*` strings are not authority |
| `app/routes/app.analytics_.export.tsx` | HTTP CSV today; **current W source inventory** has no object-store adapter. That is **not** proof historical export bytes never existed. Durable export remains a missing dependency plus a residual unknown for historical bytes |
| `.github/workflows/ci.yml` | add `test:privacy` distinct command that fails on zero tests |
| `scripts/sync-control-plane/roles.ts` | no Shop DELETE; SELECT-only verifier EXECUTE |

**Forbidden now:** treating `processingEnabled` as drain; marking `withTenantBoundTransaction` optional; omitting `completeAttemptRetry` or `dispatcher_disabled_shop_path`; claiming Redis TTL/cancel as quiescence; implementing runtime outside the repo to evade the gate.

## 3. Participating-writer inventory (W)

Legend: **L** = lifecycle shared gate required; **C** = customer-target gate when the write can restore `CUSTOMER_REST_ID` / `ORDER_LEGACY_ID`; **adm** = `processingEnabled` admission only.

| File | Symbol | Host / role | Surfaces | Target keys | Guard on W | Already-running | Test home |
|---|---|---|---|---|---|---|---|
| `db-context.server.ts` | `withTenantBoundTransaction` | Prisma `$transaction` / `stocky_runtime` | caller facts | shopId from TenantAuthority | L+C **required** (absent) | holds txn | future `scripts/privacy/inventory-guard.test.ts` |
| `tenant-db.server.ts` | `withTenantBoundTransactionState` (local) | same | tenant facts | same | L+C **required** | same | same |
| `order-facts/apply/writers.ts` | `insertOrderFact`, existence/line/refund writers, `requireProcessingEnabled` | TenantDb + `stocky_shop_processing_enabled` | order/refund facts | ORDER_LEGACY_ID | adm pre-lock; L+C missing | in-flight commit then residual | `app/lib/order-facts/apply/*.test.ts` |
| `order-facts/apply/receipts.ts` | `insertReceiptFinal`, locks | TenantDb | `SyncApplicationReceipt` | shop-level | adm re-check ≠ drain | already-open receipt txn | same |
| `order-facts/apply/index.ts` | `applyOrderFacts` | TenantDb | facts | order/customer via payload | via writers | already-open apply | `apply-safety.test.ts` |
| `catalog-facts/apply/index.ts` | `applyCanonicalFacts` | TenantDb | catalog facts | shop-level | **no** explicit processingEnabled pre-lock (PREP-C-15); L still required | in-flight | catalog apply tests |
| `catalog-facts/ingest/checkpoint.ts` | local `lockSyncRun` + persist/complete | CP `FOR UPDATE` | `SyncRun`/`SyncCursor` | shopId | adm `shop_processing_disabled` | already-running checkpoint | catalog ingest tests |
| `lifecycle.server.ts` | `claimAttempt` | CP `$transaction` | JobAttempt, DurableJob, JobDispatch | shopId | **ABSENT** | claim conflict if RUNNING | `app/sync/__tests__/sync-attempt-recovery.test.ts` |
| same | `renewAttemptHeartbeat` | CP | JobAttempt | shopId | ABSENT | heartbeat of running | same |
| same | `completeAttemptSuccess` | CP | attempt/job/delivery/dispatch | shopId | ABSENT | finalizes running | same |
| same | `completeAttemptRetry` | CP | attempt/job RETRY_WAIT | shopId | ABSENT — **must not omit** | finishing attempt | same |
| same | `completeAttemptFail` / `completeAttemptDeadLetter` | CP | + DeadLetter | shopId | ABSENT | already-running fail | same |
| same | `recoverExpiredRunningAttempts` | CP reaper **in this file** | attempt/job/DL | shopId | ABSENT | recovery of running | same |
| `dispatcher.server.ts` | `enqueueWithDispatch` | CP + Redis add | JobDispatch, DurableJob, BullMQ | shopId | reads processingEnabled then **still writes** | claimed job | `sync-dispatch-recovery.test.ts` |
| same | `dispatcher_disabled_shop_path` | CP raw UPDATE PENDING/CANCELLED | JobDispatch, DurableJob | shopId | **not a drain** | already-claimed | same |
| same | `dispatchPendingJobs` | CP | same | shopId | re-check after claim | already-claimed | same |
| same | `recoverStrandedEnqueuedJobs` | CP + queue presence | DurableJob, Redis | shopId | none | stranded ENQUEUED | same |
| same | `recoverExpiredDispatchLeases` | CP raw SQL | DurableJob DISPATCH_LEASED | shopId | **no** processingEnabled filter (PREP-C-20) | expired lease of any shop | same |
| same | `claimBatchFair` | CP write DISPATCH_LEASED | DurableJob | shopId | admission SQL only | leased row | fair-claim tests |
| `jobs/workers/catalog-facts/bulk-finish.ts` | RETRY_WAIT `updateMany` | CP | DurableJob | shopId | none (PREP-C-28) | already RETRY_WAIT | bulk-finish tests |
| `fair-claim-query.server.ts` | `buildFairClaim*` SQL | CP SELECT | DurableJob read | n/a | admission only | does not finish in-flight | fair-claim tests |
| `intake.server.ts` | `ingestAuthenticatedWebhook`, `createDurableJob` | CP | DurableJob, WebhookDelivery | shopId | deny unless uninstall | new intake only | `sync-intake-corrections.test.ts` |
| `replay.server.ts` | `replayDeadLetter` | CP `$transaction` | DurableJob, JobReplay, DL | shopId | `replay_denied_disabled_shop` | committed effects stay | sync CP integration |
| `uninstall.server.ts` | `processUninstall` + local `cancelAllCancellable` | CP | Shop, DurableJob, Session delete after commit | domain | sets processingEnabled false | in-flight admitted | `sync-uninstall.test.ts` |
| `reinstall.server.ts` | `reactivateShopAfterVerifiedReinstall` | CP Shop update | Shop | domain | REDACTED/MANUAL deny | n/a | reinstall tests |
| `bootstrap.server.ts` | `upsertCanonicalShop`, `deleteSessionsForShop` | rawPrisma | Shop, Session | domain | **no** FINALIZING fence | bootstrap vs freeze | `app/tenant/__tests__/bootstrap.test.ts` |
| `after-auth.server.ts` | `runAfterAuthTenantBootstrap` | bootstrap + TenantDb `shopSettings.upsert` | Shop, ShopSettings | domain | swallows reinstall_denied | n/a | after-auth |
| `require-admin-tenant.server.ts` | `requireAdminTenant` | session.shop → TenantDb | n/a (auth) | none | shop authority only | n/a | tenant tests |
| `webhook-processor.ts` | `processWebhookJob` / `processCronJob`; local `assertShopProcessingEnabled` | runtime + lifecycle | facts via apply | shopId | adm before v3 work | already-running job | `pr6-d-worker.test.ts` |
| `queue.server.ts` | enqueue* including **order-facts** | CP via intake + dispatcher kick | DurableJob | shopId | via intake | n/a | `queue-redis.test.ts` (needs Redis+PG — not rerun) |
| `order-facts/sync-jobs.ts` | `runOrderFactsSyncJob`, `runOrderFactsReconcileJob` | worker + scratch + apply | facts + scratch bytes | shop + orders | via processor | process-loss ≠ privacy drain | `source-stage.test.ts`, `pr6-d-sc-recovery.test.ts` |
| `source-stage.ts` | `createOwnedScratchDir`, `disposeOwnedScratch`, `reclaimOperatorSelectedDScratch`, `inspectDScratchOccupancy`, `stageOrderFactsJsonl` | filesystem | D scratch | shop via basename, **not** customer | symlink/unowned/live refusal; **`live_writer` is process-local** | live_writer skip (same process only) | `source-stage.test.ts` (3 cases executed) |
| `health.server.ts` | `computeSyncHealth` | CP **upsert** SyncHealth | SyncHealth | shopId + domain | reads processingEnabled then **writes** | n/a | health callers; **must take L** |
| `app.analytics_.export.tsx` | `loader` | TenantDb read → HTTP CSV | none durable | shop via requireAdminTenant | no object store | n/a | none privacy; **dependency** |
| `webhooks.compliance.tsx` | `action` | `authenticate.webhook` then empty 200 | **no persist** | n/a | stub | n/a | future privacy intake |

A future architecture test **must fail** when a tenant-linked writer is missing from this inventory or persists `probe_unguarded%` without the guard (plan G9). Paths may sit outside the **customer** barrier only with proof they cannot invalidate that request’s completion; they still take **L** where inventoried.

## 4. Additive migration order (proposed; not implemented)

1. Roles/owners for privacy reader, erasure, lifecycle-gate, authz-lock, residual probe (nologin; no PUBLIC EXECUTE; no BYPASSRLS).
2. Tables: `ShopInstallGeneration` (if still absent as a first-class fence row — verify vs W Shop columns before writing DDL), `PrivacyRequest`, `PrivacyAttempt`, checkpoints, `PrivacyCustomerTargetBarrier`, `PrivacyCompletedTarget`, `PlatformReplayCommand`, finite replay-evidence tombstones. **No** `DurableJob.shopId` nullability change. Optional `shopRowId` `ON DELETE SET NULL` only.
3. Helpers: capability, row-in-manifest, lifecycle shared/exclusive locks, customer-target locks, residual count, complete-customer-redact, claim-attempt, enumerator CAS, Shop finalizer (SELECT-only; SET NULL does generation cleanup).
4. Grants/RLS/policies per topic (Decision A). `customers/data_request` **no** DELETE.
5. Enum additive **only if** a later decision needs `BOUNDED_CHECKPOINT_RETRY` for **ordinary** jobs — **not** required for privacy (Decision B).
6. Rollback: drop new objects in reverse; do not drop accepted A–D tables.

Empty-table isolation tests (0-row vs error matrix) land with step 1–4, not after writers.

## 5. Ordered internal milestones (after runtime authority + §1 gates)

Foundation freeze **first**. Do not open parallel runtime branches before the freeze.

1. Additive migration + roles/helpers/policies + empty-table isolation + inventory-guard failing test for unguarded writers.
2. Actor/`sub` + assignment + `stocky_authz_lock` + denial tests (D-PR7-01/02 bind against **installed** libraries; dest/iss check).
3. Audit immutability; coordinator events; privacy-erasure DELETE while shop disabled / customer LIVE.
4. Compliance intake + three identities + classifier (replace stub `webhooks.compliance.tsx`).
5. Privacy coordinator poll/claim loop + pause switch (in existing worker process; **not** fair-claim).
6. Enumerator + topic policies + checked Shop delete + crash/epoch recovery (TF-01/02).
7. afterAuth fence; **Redis generation-scoped ordinary-job remove**; D-scratch occupancy gate; residual probe; `computeSyncHealth` under L.
8. Platform routes; owner download; operator CLI; export-storage dependency explicit.
9. Exact-head **full** CI (`test:privacy` nonzero) + independent Tier-A review with no unresolved P0/P1/P2.

No calendar estimate. No fake completion percentage.

## 6. Parallel slices AFTER foundation freeze only

ChatGPT may later authorize up to 2–4 parallel Cursor lanes **after** schema/interfaces/gates freeze. **Not now.** Candidate slices (exclusive files, one branch each):

| Slice | Owns after freeze | Must not touch |
|---|---|---|
| Coordinator loop + attempt/epoch | `app/privacy/coordinator/**`, worker bootstrap hook only | DurableJob fair-claim SQL |
| Customer redact completion | residual/complete helpers, customer barrier | shop exclusive gate |
| Shop redact + finalizer | exclusive gate, Shop delete function | customer LIVE path |
| Redis/export/scratch drain adapters | `queue.server.ts` remove helper, export adapter **if** a store is chosen | FLUSHALL; D reclaim semantics rewrite |

Do **not** create those branches in this evidence lane.

## 7. Required safety fixtures / test homes

Reuse PR45 fixtures FXT-* (shops A/B, two customers, LIVE vs shop-erasure). Add W-specific:

- FXT-D-SCRATCH: owned `att-*` vs symlink vs foreign vs live_writer (already in `source-stage.test.ts`); include **cross-process** `quiescenceConfirmed` deleting a live child’s `att-*` (Helper B `PREP_B_19`) because W `live_writer` is process-local only
- FXT-REDIS-STALE-GEN: job for generation N-1 after N current (SYNTHETIC until remove API exists)
- FXT-REDIS-ACTIVE-LOCKED: `Job.remove` of an `active` job must not count as drain (PREP-B-06b)
- FXT-HEALTH-UPSERT: `computeSyncHealth` during ERASING must not look “read-only”
- FXT-DISABLED-DISPATCH: existing dispatcher disabled-shop path
- FXT-UNSAFE-USER-ID: `associated_user.id` `9007199254740993` vs `sub` string; include B-then-A `mixedToken` reuse and stale cached `associated_user.id` vs current `sub`

`test:privacy` must be a **distinct** CI command that fails on zero tests. Do not rely on `npm test` name filters that can match nothing.

Existing W tests to **extend** (not replace): `sync-attempt-recovery`, `sync-dispatch-recovery`, `sync-uninstall`, `bootstrap.test.ts`, `source-stage.test.ts`, `scratch-quota.test.ts`, `queue-redis.test.ts` (needs isolated Redis+PG).

## 8. Integration ownership (when runtime is authorized)

| Concern | Owner | Note |
|---|---|---|
| Git writer | one named Cursor chat | this evidence coordinator is **not** that writer |
| Independent review | actual Claude Code | this packet is not that review |
| Product/legal | ChatGPT + Q-008 counsel | retention window not invented here |
| PR45 merge onto W | later docs/runtime integration | PR45 is V-based; do not chase in this lane |
| PR47 closeout | separate docs PR; **required** later gate, not optional | not reused here |
| D scratch reclaim | already on W | privacy completion still needs occupancy; do not auto-call reclaim; `live_writer` is process-local |
| Shopify inventory / flags | unauthorized | remain DEFAULT OFF |

## 9. Stop line

PR7 application runtime remains **NOT AUTHORIZED**.
R-176 **OPEN/P0**. R-164 unchanged. Q-008 **OPEN**. D-054 / **no D-055**.
Formal PR6 closure on merged main remains **required**. Measured W is **not** automatically the implementation-entry base.

`PR48 EVIDENCE SEALED FOR CONSOLIDATED PR45 REVIEW — NO RUNTIME AUTHORIZED`
