# PR 4 — Synchronization Control Plane — D-045 Final-Correction Independent Review Report

**Reviewer:** Claude Code (independent technical review)
**Decision:** D-045 — Phase 1 PR 4 final corrections
**Implementation owner:** Cursor
**Technical acceptance authority:** ChatGPT (this report is input to that decision, not a decision)
**Merge authority:** User, only after ChatGPT acceptance

```text
VERDICT: NOT READY — CORRECTIONS REQUIRED
```

**Finding totals:** P0: 0 · P1: 0 · **P2: 2** · P3: 2

---

## 1. Review identity and exact reviewed SHA

| Identity | SHA / value | Verified |
|---|---|---|
| Reviewed implementation tip | `c1c855494cefdca16d6d6571ebe8210a0cb94faf` | ✅ |
| `origin/main` / merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ |
| D-045 starting head | `9d43ec9fce7a37b3b336972bbb41a4b0f34e83cd` | ✅ ancestor of tip |
| Prior reviewed D-044 runtime/test head | `b73a22f67afd9aa29995486afdfc52147c90fb9f` | ✅ ancestor of `9d43ec9…` |
| Repository | `https://github.com/Vedang1998/Stocky` | ✅ |
| Branch | `phase-1/sync-control-plane` | ✅ |

Review was performed against a checkout of `c1c855494cefdca16d6d6571ebe8210a0cb94faf`.
No production system, merchant data, production queue, or production database was accessed.

## 2. Base, merge base, branch, PR state, and ancestry

```text
git rev-parse origin/main                        → e69bc53d91db75472b0d0998bf1b74ee6246adb1
git rev-parse origin/phase-1/sync-control-plane  → c1c855494cefdca16d6d6571ebe8210a0cb94faf
git merge-base origin/main HEAD                  → e69bc53d91db75472b0d0998bf1b74ee6246adb1
git merge-base --is-ancestor 9d43ec9… c1c8554…   → true
git log --merges 9d43ec9…..c1c8554…              → (empty)
git diff --name-status 9d43ec9…..c1c8554… -- '*migrations*' → (empty)
git diff --check                                 → exit 0
git status --short                               → clean
```

**PR #20 state (GitHub API, live):** `state: open`, `draft: true`, `merged: false`,
head `c1c855494cefdca16d6d6571ebe8210a0cb94faf`, base `main` @ `e69bc53d…`.
Requirement `OPEN, DRAFT, UNMERGED` — **satisfied**.

### Verified commit chain (linear, 10 commits, no merges)

| SHA | Classification |
|---|---|
| `59f14feac8b5758f08e13ce63750737019d2ed9d` | Runtime/test — SC01 post-rollback receipt verification |
| `10a9154ee368674b68836065f9c164be5dbb0b19` | Runtime/test — SC02–SC06, SC08 (primary D-045 runtime head before mechanical completions) |
| `1e8d730107b7831bccc39f15894872a107c75d74` | Documentation / status |
| `7131222782837c45a15bb9db9907c84f42c9f3d2` | Generated-inventory / allowlist synchronization |
| `d34dc12345cd3c898ae01548d6ebf09c31ee0eca` | CI workflow correction (branch trigger) |
| `3efe1f8fed156e2233b82f71f81353006b8f5fad` | CI trigger commit |
| `01030436c440cef6228d432798ac4dd0be5851ab` | CI workflow correction (quoting) |
| `7b908e05765263eb429ef9d6c9e487e349f44acf` | **Runtime/test** — receipt-hook mechanical completion |
| `2cce2511ff760e77cec2c5ccfb28fc03d0a1028f` | Generated-inventory refresh (documentation only) |
| `c1c855494cefdca16d6d6571ebe8210a0cb94faf` | **Runtime/test** — dead-letter-hook mechanical completion; reviewed final tip |

Confirmed: no rewritten review history, no force-push replacement, no merge commit,
**no migration added or modified during D-045**, no PR 5 work, no secrets or merchant data
in the diff. The three prior independent review reports are unmodified.

Note: `7b908e0…` and `c1c8554…` are **runtime** commits (they modify
`application-receipt.server.ts` and `dispatcher.server.ts`), not documentation-only
mechanical completions. See finding **NEW-CLAUDE-D045-03**.

## 3. Documents and code inspected

**Documents:** `AGENTS.md`; `docs/README.md`; `docs/PROJECT_STATUS.md`;
`docs/DECISIONS.md`; `docs/RISK_REGISTER.md`; `docs/OPEN_QUESTIONS.md`;
`docs/product/00_READ_ME_FIRST.md`; `docs/phases/README.md`;
`docs/phases/phase-1/README.md`; the PR 4 architecture, implementation, review,
correction, second-correction and final-correction backlog/implementation reports;
`PR2_TENANT_ACCESS_INVENTORY.md`; live PR #20 body.

**Runtime code:** `app/sync/application-receipt.server.ts`;
`app/sync/application-finalize.server.ts`; `app/sync/dispatcher.server.ts`;
`app/sync/queue-presence.server.ts`; `app/sync/lifecycle.server.ts`;
`app/sync/execution-strategy.server.ts`; `app/jobs/workers/webhook-processor.ts`;
`app/jobs/queue.server.ts`; `app/tenant/tenant-db.server.ts`.

**Tests / config:** `app/sync/__tests__/sync-exactly-once.test.ts`;
`app/sync/__tests__/sync-final-correction.test.ts`;
`app/sync/__tests__/sync-dispatch-recovery.test.ts`;
`app/sync/__tests__/sync-envelope-fail-closed.test.ts`;
`scripts/tenant-access/allowlist.ts`; `scripts/sync-control-plane/inventory-check.ts`;
`package.json`; `.github/workflows/ci.yml`.

## 4. Commands executed and environment used

**Environment (disposable, local to this review):**
PostgreSQL **16.13**, Redis **7.0.15**, Node **v22.22.2**, npm **11.5.2** (pinned to match CI),
`NODE_ENV=test`, CI-equivalent environment variables, all inventory-write feature flags `false`.
Node differs from CI's pinned 22.19.0 at the patch level (22.22.2 was the image's Node 22);
this is recorded as an environment deviation, not a substitution of CI evidence.

| Command | Exit | Result |
|---|---|---|
| `npx prisma generate` / `validate` | 0 / 0 | schema valid |
| `npx prisma migrate deploy` | 0 | all migrations applied cleanly to disposable PG16 |
| `npm run tenant:roles:verify` | 0 | pass |
| `npm run tenant:rls:verify` | 0 | pass |
| `npm run tenant:enforcement:verify` | 0 | pass |
| `npm run sync:roles:verify` | 0 | pass |
| `npm run test:sync-exactly-once` | 0 | 1 file, **35 passed**, 0 skipped |
| `npm run test:sync-final-correction` | 0 | 1 file, **19 passed**, 0 skipped |
| `npm run test:sync-dispatch-recovery` | 0 | 1 file, **27 passed**, 0 skipped |
| `npm run test:sync-attempt-recovery` | 0 | 1 file, **16 passed**, 0 skipped |
| `npm run test:sync-integration` | 0 | 13 files, **164 passed**, 0 skipped |
| `npm run test:sync-uninstall` | 0 | **8 passed** |
| `npm run test:sync-envelope-fail-closed` | 0 | **6 passed** |
| `npm run test:sync-role-isolation` | 0 | **9 passed** |
| `npm run test:sync-inventory-audit` | 0 | **5 passed** |
| `SYNC_PERF_JOB_COUNT=50000 npm run test:sync-performance` | 0 | **1 passed** |
| `npm run test:db-isolation` | 0 | 2 files, **19 passed** |
| `npm run test:tenant-access` | 0 | 34 files, **288 passed** |
| `npm run test:migrations` | 0 | 47 files, **219 passed** |
| `npm run tenant:access:audit` | 0 | pass |
| `npm run tenant:access:inventory:check` | 0 | pass (fresh) |
| `npm run sync:inventory:check` | 0 | pass (fresh) |
| `npm run tenant:enforcement:inventory:check` | 0 | pass (fresh) |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm test` | 0 | 6 files, **56 passed** |
| `npm run build` | 0 | built |
| `npm run graphql-codegen` | 0 | schema validation passed |
| `git diff --check` | 0 | clean |

`npm run tenant:schema:drift` returned exit 1 **in my environment only**, because I applied
tenant enforcement before running drift, whereas CI runs drift *before* enforcement apply.
The tool's own output identifies this as expected enforcement divergence. CI executed this
step at the correct point and it passed. **Not a defect; not a finding.**

### Focused SC gate selection proof

Every focused `-t` filter was executed independently and selected at least one test
(remaining counts are filter-deselections, not disabled tests):

| Gate | Selected |
|---|---|
| `matching receipt verified after rollback` | 1 passed / 34 deselected |
| `missing receipt dead-letters uncertain` | 1 passed / 34 deselected |
| `digest mismatch dead-letters conflict` | 1 passed / 34 deselected |
| `NEW-PR4-SC01: v[23]` | **4 passed** / 31 deselected |
| `production ignores Redis test timeout` | 1 passed / 18 deselected |
| `indeterminate evidence deduplicates` | 1 passed / 18 deselected |
| `nullable activeDispatchSequence fails closed` | 1 passed / 18 deselected |
| `terminal transition result required` | 1 passed / 18 deselected |
| `BullMQ runnable-state allowlist excludes paused` | 1 passed / 18 deselected |
| `stranded recovery budget increments` | 1 passed / 18 deselected |

## 5. Exact-head CI verification

Inspected the live run and job via the GitHub API — not the PR body's assertion.

| Field | Verified value |
|---|---|
| Workflow | `CI` (`.github/workflows/ci.yml`) |
| Run | `31064898219`, run_number 170, attempt 1 |
| Job | `92500473785` — "Lint, typecheck, test, build, Prisma, GraphQL" |
| `head_sha` | `c1c855494cefdca16d6d6571ebe8210a0cb94faf` ✅ exact head |
| `head_branch` | `phase-1/sync-control-plane` |
| Conclusion | **success** |
| Steps | **130 steps, every one `conclusion: success`** |
| Material failures | **0** |
| Material skips | **0** (no step reported `skipped`) |
| Services | `postgres:16-alpine`, `redis:7-alpine`, both health-checked |
| Node / npm | 22.19.0 / npm pinned and asserted `= 11.5.2` |

Workflow static review: **no `continue-on-error` anywhere**, **no `if:` conditions on any
step**, so no step could be silently skipped. Prisma generate/validate/migrate-deploy,
tenant role + RLS + immutability + privilege enforcement, sync role provisioning/verification,
all focused SC01–SC08 gates, full synchronization suites, migration and tenant suites, lint,
typecheck, unit tests, build, and GraphQL codegen/schema validation all executed and passed.

Exact-head CI evidence is **valid and sufficient**. Green status alone was not treated as proof;
the underlying step list and workflow definition were inspected.

## 6. SC01–SC08 disposition

| ID | Subject | Disposition |
|---|---|---|
| NEW-PR4-SC01 | Post-rollback application receipt verification | **PARTIALLY CLOSED** — runtime correct; test evidence for v2/v3 alignment and isolation level is not what the gate name claims (NEW-CLAUDE-D045-02) |
| NEW-PR4-SC02 | Redis timeout hardening | **CLOSED** |
| NEW-PR4-SC03 | Bounded indeterminate evidence | **CLOSED** |
| NEW-PR4-SC04 | Nullable selectors and heartbeat identity | **CLOSED** |
| NEW-PR4-SC05 | `FAILED` → `DEAD_LETTERED` transition | **CLOSED** |
| NEW-PR4-SC06 | BullMQ state compatibility | **CLOSED** |
| NEW-PR4-SC07 | Chain of custody and documentation | **PARTIALLY CLOSED** — stale "Final runtime/test head" label (NEW-CLAUDE-D045-03) |
| NEW-PR4-SC08 | Attempt-budget accounting | **CLOSED** (with P3 asymmetry, NEW-CLAUDE-D045-04) |

### SC01 — verification detail

Verified against `application-receipt.server.ts`, `application-finalize.server.ts`,
`webhook-processor.ts`, `tenant-db.server.ts`.

1. ✅ Verification runs after the merchant transaction has fully rolled back — both catch
   blocks (`webhook-processor.ts:496`, `:650`) execute after `ctx.db.$transaction` rejected.
2. ✅ Uses `ctx.db` (the top-level `TenantDb`), **not** the failed transaction object;
   `verifyApplicationReceiptAfterRollback` opens a new top-level transaction
   (`application-receipt.server.ts:250`).
3. ✅ `Prisma.TransactionIsolationLevel.RepeatableRead` explicitly set and now actually
   threaded through `TenantDb.$transaction` → `PrismaClient.$transaction`
   (`tenant-db.server.ts:1899-1929`). Semantically appropriate for a single-row read-verify.
4. ✅ Exact `(shopId, applicationKey)` compound identity, with `shopId` taken from
   `tx.authority.shopId`.
5. ✅ Only a digest match returns `verified` (`classifyReceiptVerification`, lines 79-97).
6. ✅ Match finalizes `already_applied_verified_after_rollback`.
7. ✅ Missing → `APPLICATION_OUTCOME_UNCERTAIN` → `completeAttemptFail` → dead-letter.
8. ✅ Query failure → caught (line 269) → `verification_failed` → uncertain → dead-letter.
9. ✅ Digest mismatch → `APPLICATION_DIGEST_CONFLICT` → dead-letter.
10. ✅ `classifyConflictWinnerReceipt` returns `outcome_uncertain` for an absent/unreadable
    winner; there is no path from an unreadable winner to `ALREADY_APPLIED`.
11. ✅ **In code**, v2 and v3 call the identical `finalizeApplicationAfterRollback` with
    identical arguments and classification. ⚠️ **Not proven by test** — see NEW-CLAUDE-D045-02.
12. ✅ Merchant writes are guarded by the receipt insert as the final write in the tenant
    transaction; the loser throws and rolls back.
13. ✅ Proven by the real PostgreSQL race test (`sync-exactly-once.test.ts:826-921`): two
    independent `PrismaClient` connections, a barrier forcing both past merchant writes,
    asserting exactly one `applied`, one rejection with `APPLICATION_ALREADY_APPLIED`,
    exactly **one** `SalesDailyAggregate` row and exactly **one** `SyncApplicationReceipt`.
14. ✅ `INSERT … ON CONFLICT DO NOTHING RETURNING` avoids the aborted-transaction state;
    the test explicitly asserts no `25P02` / "current transaction is aborted".
15. ✅ Real PostgreSQL race test present and passing (executed independently).
16. ⚠️ `ownerTenantShim` bypasses tenant scoping and **silently drops the `isolationLevel`
    option**. It conceals no production tenant-scope defect (production uses the real
    `TenantDb`, whose scoping is separately covered by 288 passing tenant-access tests), but
    it means no test exercises RepeatableRead. Folded into NEW-CLAUDE-D045-02.
17. ✅ `__setForceMissingWinnerAfterConflictForTests`, `testForceMissingWinnerAfterConflict`,
    and `testForceSkipInitialReceiptRead` are absent from all runtime modules; only negative
    source-guard assertions and documentation reference the names.
18. ✅ `classifyReceiptVerification` / `classifyConflictWinnerReceipt` are pure and are
    consumed by the runtime path; they cannot be used to bypass runtime receipt behavior.

**Catch/re-verification ordering:** the v3 and v2 catch blocks intercept
`APPLICATION_ALREADY_APPLIED`, `APPLICATION_DIGEST_CONFLICT`, and
`APPLICATION_OUTCOME_UNCERTAIN` and route all three through the same post-rollback
verification, so classification is decided by the *observed receipt*, not by the inbound
error code. A transaction failure unrelated to a receipt race raises a non-
`SyncControlPlaneError` (or a different code) and falls through to the ordinary
retryable/non-retryable handling. No misclassification path was identified.

### SC02 — verification detail

- ✅ `resolveTestRedisFastFailMs` returns `null` unless `NODE_ENV === "test"`
  (`queue-presence.server.ts:76-78`); development is also excluded, and both are unit-tested.
- ✅ `STOCKY_TEST_REDIS_FAST_FAIL` is gated on `NODE_ENV === "test"` (`queue.server.ts:52-53`).
- ✅ Bounded: positive integer, `≤ MAX_TEST_REDIS_FAST_FAIL_MS` (5000); non-integer, zero,
  negative, and over-max values all return `null`.
- ✅ Successful lookup clears its timer via `.finally`, and a `finally` block clears it again
  on every exit path — no timer leak on either branch.
- ✅ Late rejection is absorbed (`void getJobPromise.catch(...)`). `Promise.race` attaches
  handlers to **both** race entries, including the derived `.finally` promise, so no
  unhandled rejection is possible on either arm.
- ✅ Production/development cannot be altered via the test variables.
- ✅ Real Redis outage still classifies as `QUEUE_UNAVAILABLE` — verified by an executed test
  ("real Redis outage still returns QUEUE_UNAVAILABLE").

### SC03 — verification detail

- ✅ `SyncHealth` is upserted **unconditionally**, outside the dedup gate, so it always
  reflects the current degraded condition.
- ✅ `DataIssue` creation is bounded by `INDETERMINATE_DATA_ISSUE_COOLDOWN_MS` (15 min).
- ✅ Dedup identity = `shopId` + `reasonCode` + `redactedEvidence.durableJobId` +
  `redactedEvidence.dispatchId` + `redactedEvidence.dispatchSequence` + cooldown window.
- ✅ Advisory-lock key `indet:{shopId}:{durableJobId}:{dispatchSequence}:{reasonCode}` is
  tenant- and dispatch-qualified. `hashtext` collisions can only cause serialization, never
  suppression, because the dedup query itself is exact. No cross-tenant or cross-dispatch
  suppression is possible.
- ✅ Concurrent reapers converge — proven by the executed "concurrent same-reason recovery →
  one issue" test.
- ✅ A changed `reasonCode` or `dispatchSequence` produces new evidence.
- ✅ The function writes only `SyncHealth` and `DataIssue`; it never mutates durable-job or
  dispatch state, and a throw is isolated into `isolatedFailures` without job mutation.
- ✅ Redacted evidence contains only identifiers, queue state, and a reason string — no
  payloads, no merchant data.

### SC04 — verification detail

- ✅ Null `activeDispatchSequence` returns `{ kind: "null_sequence" }` **before** any query
  or mutation (`dispatcher.server.ts:1050-1052`), replacing the previous
  `?? undefined` which Prisma would have silently omitted.
- ✅ The stale `orderBy: { dispatchSequence: "desc" }` fallback was removed, so the selector
  is now exact rather than "newest matching".
- ✅ Null sequence records indeterminate evidence and increments `indeterminate` with **no**
  durable-job or dispatch mutation.
- ✅ `renewAttemptHeartbeat` now resolves the exact unfinished attempt first
  (`lifecycle.server.ts:133-144`), filtered on `id` + `shopId` + `finishedAt: null` +
  `leaseOwner`, and returns `null` when absent — eliminating the prior nested
  `findUnique(...)?.durableJobId` that could evaluate to `undefined` and widen the update.
- ✅ Missing, foreign-shop, wrong-worker, and completed attempts cannot renew another job;
  the durable-job update is keyed on the resolved `attempt.durableJobId` plus `shopId`,
  `state: "RUNNING"`, and `leaseOwner`. Covered by two executed tests.

### SC05 — verification detail

- ✅ Production **always** executes the real `FAILED → DEAD_LETTERED` SQL
  (`dispatcher.server.ts:932-946`); the forced-fail ternary is gone.
- ✅ Predicates are exact: `id`, `"shopId"`, and `state = 'FAILED'`, with `RETURNING id`.
- ✅ `requireExactlyOneTransitionRow` throws `SyncControlPlaneError("illegal_job_transition")`
  on zero **or** multiple rows.
- ✅ Throwing rolls back the whole transaction — the `ENQUEUED → FAILED` update, the
  dead-letter insert, the dispatch disposition update, and the `DataIssue` write are all
  inside the same `prisma.$transaction`. The executed test asserts the job remains
  `ENQUEUED` (not `FAILED`) and that zero dead letters exist.
- ✅ The job is never committed stranded in `FAILED`.
- ✅ `deadLettered` is not falsely incremented — the rejection propagates to the per-job
  catch, which increments `isolatedFailures` only. The test asserts
  `deadLettered === 0 && isolatedFailures >= 1`.
- ✅ The normal path still reaches `DEAD_LETTERED` and increments the counter (separate test).
- ✅ Concurrent reapers converge — `SELECT … FOR UPDATE` on `state = 'ENQUEUED'` plus a
  re-check of the dispatch state; a loser returns `"noop"`.
- ✅ No mutable production test hook remains in `dispatcher.server.ts`.

**`withForcedEmptyDeadLetterTransition` critique (test-local harness):**
it exists only in `sync-final-correction.test.ts`; the original `$transaction` is restored in
a `finally`, so thrown assertions cannot bypass cleanup; the interception is scoped to the
single `run()` call and cannot leak into another test; matching on the `DEAD_LETTERED` string
intercepts only the intended final update, because no other `$queryRaw` in the reaper path
(the `FOR UPDATE` selects, the `ENQUEUED → FAILED` update, the `RETRY_WAIT` update) contains
that literal — I confirmed this by reading every `$queryRaw` on the path; and the test proves
genuine full rollback by asserting persisted post-transaction state, not merely a thrown error.
The Vitest config runs this file in its own worker, so the singleton mutation is not exposed
to cross-file parallelism. `requireExactlyOneTransitionRow` is a pure validator: it takes rows
and returns/throws, cannot control whether SQL executes, and is not caller-parameterised into
a transition switch. **No objection.**

### SC06 — verification detail

- ✅ Committed runnable allowlist is exactly `waiting`, `delayed`, `active`, `prioritized`,
  `waiting-children` (`queue-presence.server.ts:16-22`).
- ✅ `paused` is excluded, and a dedicated executed test asserts its exclusion.
- ✅ Terminal states (`completed`, `failed`) are a separate set handled separately.
- ✅ Unknown/future states fail closed to `UNKNOWN_STATE`, which is treated as indeterminate
  and never mutates job or dispatch state.
- ✅ Retained terminal jobs cannot be acknowledged as runnable — `classifyAfterQueueAdd`
  re-inspects the job returned by `queue.add()` and only promotes `RUNNABLE_EXISTING` to
  `RUNNABLE_CREATED`.
- ✅ Upgrade documentation requiring revalidation is present in the module header.
- ✅ Retained-failed, retained-completed, and outage behaviors are covered by primary BullMQ
  integration tests against real Redis, not by assumption alone.

### SC07 — verification detail

Verified independently against the live PR body and the repository documents.

- ✅ `b73a22f…` labelled as the prior reviewed runtime/test head.
- ✅ `9d43ec9…` labelled as the independent second-correction review report and D-045 start.
- ✅ `10a9154…` is genuinely the primary D-045 runtime/test head before mechanical completions.
- ✅ `7b908e0…` removes the receipt test hook; `2cce251…` refreshes generated inventory;
  `c1c8554…` removes the dead-letter test hook and is the reviewed final tip. The PR body
  states all three correctly.
- ✅ CI `31064898219` / `92500473785` recorded, and independently confirmed exact-head success.
- ✅ No document makes a self-referential final-tip claim; the implementation report explicitly
  defers tip identity to the PR body.
- ✅ No document claims acceptance, risk closure, merge authority, production authorization,
  or Phase 1 completion. `PROJECT_STATUS.md` and `phases/phase-1/README.md` both state
  "not accepted"; PR 5 is recorded as BLOCKED.
- ✅ `Q-003` remains OPEN in `OPEN_QUESTIONS.md`; `F-PR4-18` remains recorded as an open
  residual in `PROJECT_STATUS.md`. No live `2026-07` schema-closure claim is made.
- ⚠️ One stale label — see NEW-CLAUDE-D045-03.

### SC08 — verification detail

- ✅ A confirmed missing/terminal dispatch consumes one durable processing opportunity.
- ✅ `nextAttemptCount = job.attemptCount + 1` (`dispatcher.server.ts:978`).
- ✅ The increment and the `ENQUEUED → RETRY_WAIT` transition are one atomic UPDATE
  (lines 1082-1094 and 1234-1247), each guarded by `WHERE … state = 'ENQUEUED'`.
- ✅ Retryable work below the limit moves to `RETRY_WAIT`.
- ✅ Dead-letters when `nextAttemptCount >= job.maxAttempts` — i.e. the budget is now
  evaluated against the opportunity being consumed, not the one already consumed.
- ✅ `NO_AUTOMATIC_RETRY` terminalizes immediately with `APPLICATION_OUTCOME_UNCERTAIN`.
- ✅ Runnable, indeterminate, queue-unavailable, unknown-state, null-sequence, failed-
  transaction, and noop paths all `continue` without touching `attemptCount` — verified by
  reading every branch and by the executed "indeterminate does not increment attemptCount" test.
- ✅ Two reapers cannot consume the same opportunity twice: the `SELECT … FOR UPDATE`
  serializes them and the second observes a non-`ENQUEUED` state, returning `"noop"`.
- ✅ Durable job, active dispatch, dead letter, and evidence remain mutually consistent —
  all mutations for a decision occur inside one transaction.
- ✅ v2/v3 already-applied behavior is aligned through SC01 in code.
- ⚠️ Dead-letter path does not persist the increment — see NEW-CLAUDE-D045-04.

## 7. Prior finding reconciliation

The eight D-045 findings (NEW-PR4-SC01…SC08) originate from the independent second-correction
review at `9d43ec9…` (P0:0 P1:0 P2:1 P3:7). Six are fully closed; SC01 and SC07 are partially
closed as detailed above. No previously closed PR 4 finding (F-PR4-*, NEW-PR4-C0*) was observed
to regress: the full dispatch-recovery, attempt-recovery, envelope-fail-closed, uninstall,
role-isolation, inventory-audit, exactly-once, and integration suites were executed
independently and all passed with zero skips.

`F-PR4-18` and `Q-003` remain **OPEN** and were not closed by this review.

## 8. New findings

### NEW-CLAUDE-D045-01 — P2 — Production-reachable queue-classification bypass

- **Severity:** P2
- **File / line:** `stocky-plus/app/sync/queue-presence.server.ts:50-58` (mutable global +
  exported setter), consumed at `:107-110` inside `classifyExistingQueueJob`.
- **Affected behavior:** `__setQueueStateClassificationSeamForTests` installs a
  module-global function that can override the result of every queue-presence classification.
  Because `classifyExistingQueueJob` and `inspectQueueDispatchPresence` feed
  `recoverStrandedEnqueuedJobs` and the dispatch acknowledgement path, an installed seam can
  turn a terminal or missing queue job into `RUNNABLE_EXISTING` (suppressing recovery of a
  genuinely stranded job) or turn a runnable job into `MISSING` (causing a spurious
  `RETRY_WAIT`/`DEAD_LETTERED` transition and consuming attempt budget).
- **Reasoning / reproduction:** The setter is exported from a production runtime module that
  ships in the server build. There is **no** `NODE_ENV` guard, no build-time boundary, no
  bundler `define` elimination, and no import restriction — any module in the process
  (including a future application module or a compromised dependency reachable at import
  time) can call it. The state is a mutable module singleton, so an installed seam persists
  process-wide across requests, workers, tenants, and jobs until explicitly reset. Reproduce
  by importing the setter from any server module and installing
  `() => ({ status: "RUNNABLE_EXISTING", queueState: "waiting" })`; every stranded-job reaper
  decision in the process then reports runnable, and `recoverStrandedEnqueuedJobs` silently
  stops recovering.
- **Assessment against the required criteria:** exported by a production runtime module — **yes**;
  invocable by arbitrary production imports — **yes**; changes queue classification and durable-job
  behavior — **yes**; real environment or build boundary preventing production use — **no**;
  mutable global state can leak between requests/workers/tenants — **yes**.
- **Why P2 and not P1:** it is not reachable from merchant input, webhook payloads, or any
  external request surface. Exploitation or accidental activation requires in-process code to
  call the setter. It is therefore a significant reliability and safety-net defect, not a
  demonstrated incorrect-inventory or cross-tenant exposure.
- **Consistency note:** D-045 removed two functionally identical seams
  (`__setForceMissingWinnerAfterConflictForTests`, `__setForceDeadLetterTransitionFailForTests`)
  as mandatory mechanical completions. This seam is the same construct in the same subsystem
  and is not distinguishable on principle. Pre-existence at `9d43ec9…` is not a justification;
  it is not waived.
- **Required correction:** remove the exported setter and the mutable module global. Replace
  the eleven test call sites in `sync-dispatch-recovery.test.ts` and
  `sync-final-correction.test.ts` with either (a) pure classification tests that call an
  exported pure `classifyQueueState(state: string): QueueDispatchPresence` directly, or
  (b) test-local mocking of `Job.getState()` / `vi.mock` of the module, which requires no
  production surface at all. Option (a) is preferred: the only capability the seam provides
  that real BullMQ 5.81.2 cannot produce is an unreachable future state string, which a pure
  classifier accepts as an ordinary argument.
- **Missing test / acceptance test:** an export/source guard in the D-045 suite asserting
  `expect(Object.keys(queuePresenceModule)).not.toContain("__setQueueStateClassificationSeamForTests")`
  and `expect(source).not.toMatch(/testStateClassificationSeam/)` — mirroring the guards
  already added for the two removed seams — plus retained coverage that an unknown state
  string still classifies as `UNKNOWN_STATE` and fails closed.

### NEW-CLAUDE-D045-02 — P2 — SC01 v2/v3 alignment is asserted by a gate that does not exercise v2 or v3

- **Severity:** P2
- **Files / lines:** `stocky-plus/app/sync/__tests__/sync-exactly-once.test.ts:1921`, `:1965`,
  `:1996`, `:2039` (the four tests selected by the CI gate) and `:43-62` (`ownerTenantShim`);
  CI gate `.github/workflows/ci.yml` step "NEW-PR4-SC01: v2 and v3 already-applied alignment".
- **Affected behavior:** exactly-once merchant application — the highest-consequence guarantee
  in PR 4.
- **Reasoning / reproduction:** The four tests named `v2 …` and `v3 …` all call
  `finalizeApplicationAfterRollback(...)` **directly**, passing `ownerTenantShim(prisma, shopId)`.
  None of them invokes `processWebhookJob`. I confirmed by exhaustive search that
  `processWebhookJob` is imported by exactly one test file in the repository
  (`sync-envelope-fail-closed.test.ts`), which covers envelope fail-closed behavior, not the
  SC01 catch branches. Consequently:
  1. The v2 branch (`webhook-processor.ts:637-659`) and the v3 branch (`:487-506`) — the two
     call sites whose *alignment* is the entire subject of SC01 item 11 — are never executed
     by any test. The four tests are byte-for-byte the same code path as each other; the
     `v2`/`v3` labels carry no discriminating power. Deleting either catch block, or changing
     one to finalize `SUCCEEDED` on the error code alone (precisely the P2 defect SC01 was
     raised to fix), leaves the entire suite and CI green.
  2. `ownerTenantShim.$transaction` accepts only `(fn)` and **silently discards the options
     argument**, so `Prisma.TransactionIsolationLevel.RepeatableRead` — SC01 item 3 — is
     dropped in every SC01 finalization test. The test named "RepeatableRead verification
     never succeeds without matching receipt" (`:2069`) therefore does not actually run under
     RepeatableRead. No test exercises the isolation level that production uses.
  I verified the production code itself is **correct** by reading both catch blocks and the
  `TenantDb.$transaction` option pass-through; this finding is about the validity of the
  evidence, not a runtime defect. Per the D-045 review standard — "do not mark an item closed
  because a test name exists" — SC01 cannot be recorded as CLOSED on this evidence, and the
  CI gate's name materially overstates what it verifies.
- **Required correction:** (a) add at least one test per worker version that drives
  `processWebhookJob` through the already-applied / digest-conflict / uncertain catch path
  with a real `TenantDb`, asserting the verified-after-rollback success, the dead-letter
  classifications, and that no duplicate merchant row is produced; (b) either give
  `ownerTenantShim.$transaction` an options passthrough or replace it with a real `TenantDb`
  in the SC01 finalization tests, so RepeatableRead is genuinely exercised; (c) rename the CI
  gate to match whatever it actually selects.
- **Missing test / acceptance test:** `NEW-PR4-SC01: v3 worker already-applied race finalizes
  verified-after-rollback` and `NEW-PR4-SC01: v2 worker already-applied race finalizes
  verified-after-rollback`, both invoking `processWebhookJob` end-to-end against real
  PostgreSQL, plus a mutation check that removing either catch block turns the suite red.

### NEW-CLAUDE-D045-03 — P3 — Stale "Final runtime/test head" label in the D-045 implementation report

- **Severity:** P3
- **File / line:**
  `stocky-plus/docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_IMPLEMENTATION_REPORT.md:30`
- **Affected behavior:** chain-of-custody accuracy (SC07).
- **Reasoning:** the identity table records `| Final runtime/test head | 10a9154… |`. Two later
  commits modify production runtime modules: `7b908e0…` changes
  `app/sync/application-receipt.server.ts` (153 lines) and `c1c8554…` changes
  `app/sync/dispatcher.server.ts` (32 lines). The same document's own "Mechanical Completion
  1/2" sections describe exactly these runtime edits, so the table is internally contradicted.
  A reader relying on the table alone would review the wrong runtime head. The PR body is
  correct, which bounds the impact.
- **Required correction:** relabel `10a9154…` as "primary D-045 runtime/test head before
  mechanical completions" and add `7b908e0…` and `c1c8554…` as subsequent runtime/test heads,
  or remove the "Final" qualifier and defer to the PR body as the other rows already do.
- **Missing test:** none (documentation).

### NEW-CLAUDE-D045-04 — P3 — Attempt-budget increment is asymmetric between the retry and dead-letter paths

- **Severity:** P3
- **File / line:** `stocky-plus/app/sync/dispatcher.server.ts:971-998` (`shouldDeadLetterStranded`
  computes `nextAttemptCount` for every branch) versus `:846-964`
  (`terminalizeStrandedEnqueuedJob`, which never persists it).
- **Affected behavior:** attempt-budget bookkeeping on dead-lettered stranded jobs.
- **Reasoning:** the documented SC08 semantics are that "a confirmed missing or terminal
  dispatch consumes one durable processing opportunity". The `RETRY_WAIT` transitions persist
  `attemptCount = nextAttemptCount`, but the dead-letter transition persists neither the
  increment nor `nextAttemptCount`, so a dead-lettered job's final `attemptCount` under-reports
  consumed opportunities by one. Because `DEAD_LETTERED` is terminal and no further scheduling
  decision reads the value, there is no incorrect retry or duplicate-effect consequence. The
  impact is on operator-facing reporting and on any future replay logic that reads
  `attemptCount` from a dead-lettered job.
- **Required correction:** persist `"attemptCount" = ${nextAttemptCount}` in the
  `ENQUEUED → FAILED` update inside `terminalizeStrandedEnqueuedJob`, or document explicitly
  that the budget is not accounted on terminal transitions.
- **Missing test:** assert the final `attemptCount` on a job dead-lettered through
  `recoverStrandedEnqueuedJobs`, for both the `NO_AUTOMATIC_RETRY` and budget-exhausted paths.

## 9. Production test-seam audit

Searched every runtime file changed between `9d43ec9…` and `c1c8554…` for `__set`, `ForTests`,
`force`, "test seam", `NODE_ENV`, `STOCKY_TEST`, mutable module globals, and caller-controlled
bypasses.

| Runtime file | Seam findings |
|---|---|
| `app/sync/application-receipt.server.ts` | **None** — clean |
| `app/sync/application-finalize.server.ts` | **None** — clean |
| `app/sync/dispatcher.server.ts` | **None** — clean |
| `app/sync/lifecycle.server.ts` | **None** — clean |
| `app/jobs/workers/webhook-processor.ts` | **None** — clean |
| `app/tenant/tenant-db.server.ts` | **None** — clean |
| `app/jobs/queue.server.ts` | `STOCKY_TEST_REDIS_FAST_FAIL` — gated on `NODE_ENV === "test"`; connection fast-fail only; **acceptable** |
| `app/sync/queue-presence.server.ts` | `resolveTestRedisFastFailMs` / `STOCKY_TEST_REDIS_FAST_FAIL_MS` — test-gated, bounded, timeout-only; **acceptable**. `__setQueueStateClassificationSeamForTests` — **NEW-CLAUDE-D045-01 (P2)** |

All five removed seams confirmed **absent** from runtime code; the names survive only in
negative source-guard assertions and in the implementation report:

```text
__setForceMissingWinnerAfterConflictForTests   → absent from runtime ✅
testForceMissingWinnerAfterConflict            → absent from runtime ✅
testForceSkipInitialReceiptRead                → absent from runtime ✅
__setForceDeadLetterTransitionFailForTests     → absent from runtime ✅
forceDeadLetterTransitionFailForTests          → absent from runtime ✅
```

`resetQueueClientsForTests` (`queue.server.ts:251`) is a lifecycle reset, not a behavior
bypass — it cannot alter any classification or business decision. Not a finding.

The queue-state seam was **not altered** during this review.

## 10. Tenant-isolation and database-integrity assessment

- **Migrations:** D-045 added and modified **zero** migrations; prior PR 4 migrations are
  byte-identical. `prisma migrate deploy` applied the full chain cleanly to a disposable
  PostgreSQL 16.13 instance.
- **Isolation level:** `Prisma.TransactionIsolationLevel.RepeatableRead` is supported by the
  installed Prisma client and by PostgreSQL 16; the `TenantDb.$transaction` type and
  implementation now thread the option through to `PrismaClient.$transaction` correctly.
- **Tenant scoping:** every new query is shop-qualified. The post-rollback verification uses
  the compound `shopId_applicationKey` selector sourced from `tx.authority.shopId`. The
  dead-letter transition added an explicit `"shopId"` predicate it previously lacked. The
  indeterminate-evidence dedup query filters on `shopId`. The heartbeat resolution filters on
  `shopId` for both the attempt and the durable job. No new cross-tenant read or write path
  was identified.
- **Raw-client exposure:** the `$queryRaw` escape on `TenantDb` remains restricted to
  in-transaction use for the receipt insert; the proxy in `tenant-db.server.ts:1933-1948`
  still blocks every other unsafe client key.
- **Role/privilege posture:** no production role, schema, policy, or privilege change occurred
  during D-045. `tenant:roles:verify`, `tenant:rls:verify`, `tenant:enforcement:verify`, and
  `sync:roles:verify` all passed in my disposable environment.
- **Inventory/allowlist:** the two additions (`EX-SYNC-007`, `EX-SYNC-TEST-012`) are narrowly
  scoped to the single new test file, both marked non-production-runtime, with owner and
  removal condition recorded. No merchant-owned model was exempted, and no production
  direct-Prisma access was concealed as a test exception. All three inventory freshness
  checks pass deterministically.
- **Inventory writes:** no inventory-write surface was introduced; all inventory-write feature
  flags remain `false`; `test:sync-inventory-audit` passes.

## 11. Safety assessment

No production migration, role change, schema change, or privilege change. No production queue
execution, no webhook replay, no merchant or production data access, no ownership repair, no
inventory mutation. All inventory-write flags remain OFF. No PR 5 work is present in the diff.
No secrets or production credentials appear in the changed files; CI credentials are
test-only placeholders carrying `pragma: allowlist secret`. No force-push, amend, or rebase.
PR #20 was not merged, not marked ready, and its body was not edited. All test execution used
a disposable local PostgreSQL 16 and Redis 7.

## 12. Q-003 / F-PR4-18 status

Both remain **OPEN**. No live Shopify `2026-07` webhook or GraphQL schema-closure evidence was
produced or claimed by D-045, and this review neither obtained nor accepted any such evidence.
`npm run graphql-codegen` validates against the fetched Admin schema but does not constitute
the live exact-head webhook validation Q-003 requires. Neither item may be closed on this
review's evidence.

## 13. Residual risks

1. **NEW-CLAUDE-D045-01 (P2)** — a production-reachable mutable seam remains in the queue
   presence classifier, in the same subsystem whose two sibling seams were just removed.
2. **NEW-CLAUDE-D045-02 (P2)** — the exactly-once worker catch branches for v2 and v3 have no
   executing test; a regression there would ship green.
3. Isolation-level behavior (RepeatableRead) is verified only by code inspection.
4. `hashtext` advisory-lock collisions can serialize unrelated evidence writes under high
   concurrency — bounded, non-correctness-affecting, no action required.
5. **Q-003 / F-PR4-18** remain open pending live `2026-07` validation.
6. Prior accepted nonblocking PR 3 residuals R-095…R-098 are untouched and out of scope.

## 14. Final readiness verdict

```text
NOT READY — CORRECTIONS REQUIRED
```

P0: 0 · P1: 0 · **P2: 2** · P3: 2.

`READY FOR CHATGPT PR 4 ACCEPTANCE` requires zero open P2. Two open P2 findings
(NEW-CLAUDE-D045-01, NEW-CLAUDE-D045-02) prevent that verdict.

Both are narrow and mechanically correctable — one seam removal with test-local replacement,
and worker-level test coverage for the two catch branches plus an isolation-level passthrough.
Neither indicates a defect in the D-045 corrections' runtime logic: SC01–SC08 are, on code
inspection and independent execution, materially correct, and no P0 or P1 defect was found in
correctness, tenancy, security, or data integrity. The exact-head CI evidence is valid,
complete, and independently confirmed.

This report is advisory input to ChatGPT's PR 4 acceptance decision. It is not an acceptance,
not an approval to merge, not authorization for PR 5, and not authorization for any production
activity.
