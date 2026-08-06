# Phase 1 PR 4 — Synchronization Control Plane Final Correction Implementation Report

**Status:** `FINAL CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`
**Authority:** D-045
**PR:** #20 — OPEN, DRAFT, UNMERGED
**Branch:** `phase-1/sync-control-plane`
**PR 5:** BLOCKED
**Production / inventory writes:** UNAUTHORIZED; flags default OFF

```text
D-045 — PHASE 1 PR 4 FINAL CORRECTIONS REQUIRED.
NEW-PR4-SC01 THROUGH NEW-PR4-SC08 ARE IN SCOPE.
THE ORIGINAL REVIEW, FIRST CORRECTION-REVIEW, AND SECOND-CORRECTION
REVIEW REPORTS MUST REMAIN UNCHANGED.
PR 5 REMAINS BLOCKED.
PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.
```

This report records Cursor final-correction work only. It does **not** claim acceptance, readiness, merge authorization, or risk closure.

## D-045 authority and identity

| Identity | SHA / value |
|---|---|
| Unchanged `origin/main` / merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| Reviewed runtime/test implementation head (D-044) | `b73a22f67afd9aa29995486afdfc52147c90fb9f` |
| Independent second-correction review-report commit / D-045 starting head | `9d43ec9fce7a37b3b336972bbb41a4b0f34e83cd` |
| SC01 correction commit | `59f14feac8b5758f08e13ce63750737019d2ed9d` |
| SC02–SC06 / SC08 correction commit | `10a9154ee368674b68836065f9c164be5dbb0b19` |
| Primary D-045 runtime/test head before mechanical completions | `10a9154ee368674b68836065f9c164be5dbb0b19` |
| Receipt-hook removal runtime/test head (mechanical completion 1) | `7b908e05765263eb429ef9d6c9e487e349f44acf` |
| Dead-letter-hook removal runtime/test head / reviewed implementation | `c1c855494cefdca16d6d6571ebe8210a0cb94faf` |
| Independent D-045 review-report commit | `ef452bb9e6c9e4dd48ce7d6dfbe9e9cf0e7738f2` |
| Documentation / status commit | recorded after this report lands (see Git history; not a self-referential tip) |
| Live final PR tip / exact-head CI | Authoritative only in GitHub PR #20 body after green CI |

Immutable reports (unchanged):

- `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_SECOND_CORRECTION_REVIEW_REPORT.md`

## Migration

No additive migration required for D-045. Existing migrations were not edited. No production migration executed.

## Finding disposition (Cursor side only)

Every NEW-PR4-SC01…SC08 finding: **IMPLEMENTED — PENDING INDEPENDENT VERIFICATION**

| ID | Sev | Exact correction | Primary files | Tests |
|---|:---:|---|---|---|
| NEW-PR4-SC01 | P2 | Post-rollback `verifyApplicationReceiptAfterRollback` at Repeatable Read; shared `finalizeApplicationAfterRollback`; error semantics split (ALREADY_APPLIED / DIGEST_CONFLICT / OUTCOME_UNCERTAIN); v2+v3 processors call shared finalize | `application-receipt.server.ts`, `application-finalize.server.ts`, `webhook-processor.ts`, `tenant-db.server.ts` | `sync-exactly-once` NEW-PR4-SC01:* |
| NEW-PR4-SC02 | P3 | Test-only Redis fast-fail ms + `STOCKY_TEST_REDIS_FAST_FAIL`; timer clear; late reject absorb | `queue-presence.server.ts`, `queue.server.ts` | `sync-final-correction` SC02 |
| NEW-PR4-SC03 | P3 | 15-minute cooldown + advisory lock; SyncHealth always current | `dispatcher.server.ts` | `sync-final-correction` SC03 |
| NEW-PR4-SC04 | P3 | Null `activeDispatchSequence` fail-closed; heartbeat resolves attempt first | `dispatcher.server.ts`, `lifecycle.server.ts` | `sync-final-correction` SC04 |
| NEW-PR4-SC05 | P3 | FAILED→DEAD_LETTERED `RETURNING` must yield one row or roll back | `dispatcher.server.ts` | `sync-final-correction` SC05 |
| NEW-PR4-SC06 | P3 | Remove `paused` from runnable allowlist; pin BullMQ 5.81.2 note | `queue-presence.server.ts` | `sync-final-correction` SC06 |
| NEW-PR4-SC07 | P3 | Correct second-correction implementation identity labels; D-045 status docs | second-correction implementation report; PROJECT_STATUS; phase README; this backlog/report | documentation review |
| NEW-PR4-SC08 | P3 | Confirmed stranded recovery increments attempt budget; DL at maxAttempts; SC01 aligns v2/v3 | `dispatcher.server.ts`, architecture | `sync-final-correction` SC08 |

### Attempt-budget semantics (PR 4 / SC08)

```text
attemptCount represents consumed durable processing opportunities,
including a confirmed missing/terminal dispatch that requires redispatch
and the same opportunity when the job is dead-lettered instead of retried.
```

Confirmed stranded recovery is not free. `nextAttemptCount = attemptCount + 1`; if `>= maxAttempts` then `ENQUEUED → FAILED → DEAD_LETTERED` with `terminalReason = max_attempts_exceeded` and `attemptCount = nextAttemptCount` persisted on the `ENQUEUED → FAILED` update (NEW-CLAUDE-D045-04); else `ENQUEUED → RETRY_WAIT` with atomic increment. `NO_AUTOMATIC_RETRY` dead-letter paths persist the same increment. No increment for runnable, queue unavailable, unknown state, missing `activeDispatchSequence`, noop, failed transaction, or evidence-only observation.

## Focused test evidence (local / disposable — not acceptance)

| Suite / gate | Observed |
|---|---|
| `test:sync-exactly-once` NEW-PR4-SC01 | **14** passed |
| `test:sync-final-correction` | **16** passed |
| Full suites | Recorded in PR #20 body after exact-head CI |

Exact-head CI `head_sha`, run, and job are recorded in the PR #20 body after the pushed tip is green. Do not treat local green as acceptance.

## Open risks / questions

Keep **OPEN** (permanent `RISK_REGISTER.md` definitions). Do **not** close on Cursor evidence:

- **R-109** — D-045 final corrections pending independent verification (NEW-PR4-SC01 + prior exactly-once)
- **R-099** — D-045 final corrections pending independent verification (SC06/SC08 dispatch recovery)
- **R-104** — remains open (attempt recovery)
- **R-112** — D-045 final corrections pending independent verification (SC07 identity hygiene)
- **R-031 / R-032 / R-033** — open until PR 4 acceptance
- **Q-003** / **F-PR4-18** — OPEN (no live Shopify schema closure claimed)

## Remaining limitations

- Independent Claude Code D-045 review not yet run.
- Exact-head CI evidence belongs in the PR body, not a tip-identity commit.
- Q-003 / F-PR4-18 remain open without live Admin API schema validation.
- Owner Prisma shims remain test-only where disposable envs lack full `stocky_runtime` RLS.

## Safety statement

- No production migration, role change, queue execution, webhook replay, merchant data, ownership repair, or inventory mutation.
- Inventory-write flags remain OFF.
- No PR 5 work.
- No secrets committed.
- No force-push / amend / rebase of reviewed history.
- PR #20 remains OPEN, DRAFT, UNMERGED.

## Next action

```text
Return to ChatGPT for exact-head verification and a focused
independent Claude Code D-045 correction review.
```

Status remains **FINAL CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION**.
Do not close findings or risks on Cursor evidence alone.

## D-045 Mechanical Completion — Production Test Hook Removal

**Authority:** D-045 (no new decision number)
**Starting head:** `01030436c440cef6228d432798ac4dd0be5851ab`
**Prior verified exact-head CI:** run `31057886205`, job `92479281401`, success

### Why the runtime hook violated the approved brief

`application-receipt.server.ts` exported `__setForceMissingWinnerAfterConflictForTests` and gated production control flow on mutable module globals (`testForceMissingWinnerAfterConflict`, `testForceSkipInitialReceiptRead`). That introduced a production-reachable test bypass solely to force the no-readable-winner branch, violating:

```text
No production test hook may be introduced merely to force the branch.
```

Independent review is not authorized while that hook remains.

### Exact files changed

- `app/sync/application-receipt.server.ts` — removed all test globals/setters/conditionals; added pure `classifyReceiptVerification` and `classifyConflictWinnerReceipt`; production always performs initial receipt lookup, merchant writes only when absent, `ON CONFLICT DO NOTHING RETURNING`, then normal winner read + classification
- `app/sync/__tests__/sync-exactly-once.test.ts` — replaced hook-based test with pure classification + module-export/source static guards
- `app/sync/__tests__/sync-final-correction.test.ts` — export-guard regression
- this implementation report

No migration. Independent review reports unchanged.

### Replacement test architecture

1. **Finalization tests** — existing `finalizeApplicationAfterRollback` paths for matching / missing / digest conflict / verification failure (controlled TenantDb double for query failure).
2. **Pure classification** — `classifyConflictWinnerReceipt(null)` proves `outcome_uncertain`; `classifyReceiptVerification` covers verified / missing / digest_conflict without mutating runtime.
3. **Real PostgreSQL race** — retained concurrent winner/loser tests for one merchant effect, no `25P02`, post-rollback convergence.
4. **Module-export / source static guard** — fails if `__setForceMissingWinnerAfterConflictForTests` or `testForce*` returns to the production module.

No `NODE_ENV` guard, env var, mutable global, production-exported setter, or caller bypass was introduced as a replacement.

### Test evidence / final identity

Recorded after local validation and exact-head CI in the PR #20 body (not a tip-identity commit). Status remains:

```text
FINAL CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

### Safety confirmation

No production migration, role change, queue execution, webhook replay, merchant data, ownership repair, or inventory mutation. Inventory-write flags remain OFF. No PR 5 work. No secrets. No force-push. PR #20 remains OPEN, DRAFT, UNMERGED.

## D-045 Mechanical Completion 2 — Dead-Letter Transition Test Hook Removal

**Authority:** D-045 (no new decision number)
**Starting head:** `2cce2511ff760e77cec2c5ccfb28fc03d0a1028f`
**Prior verified exact-head CI:** run `31061206183`, job `92489367554`, success

### Exact hook removed

From `app/sync/dispatcher.server.ts`:

- `forceDeadLetterTransitionFailForTests` mutable global
- `__setForceDeadLetterTransitionFailForTests` production export
- ternary that substituted `[]` for the real `FAILED → DEAD_LETTERED` `$queryRaw`

Production now **always** executes the real SQL update and validates via pure `requireExactlyOneTransitionRow`.

### Safe test replacement

1. **Pure helper** — `requireExactlyOneTransitionRow(rows)` unit-tested for 0 / 1 / many rows (does not control SQL execution).
2. **Test-local Prisma interception** — `withForcedEmptyDeadLetterTransition` in `sync-final-correction.test.ts` only wraps the control-plane `$transaction` client so the final `DEAD_LETTERED` `$queryRaw` returns `[]`. Restored in `finally`. Production modules never import or know about it.
3. **Integration assertions** — forced empty RETURNING → throw → full rollback → job remains `ENQUEUED` (not `FAILED`) → zero OPEN dead letters → `deadLettered` counter stays 0.
4. **Normal path** — still reaches `DEAD_LETTERED` and increments the counter.
5. **Export/source guards** — fail if `__setForceDeadLetterTransitionFailForTests` / `forceDeadLetterTransitionFailForTests` return.

### Production-seam audit (`9d43ec9…` → tip)

| Seam | Predates D-045? | Changes runtime? | Production-reachable? | Disposition |
|---|---|---|---|---|
| Receipt `__setForceMissingWinner…` | No (D-045 then removed in MC1) | Was yes | Was yes | **REMOVED** (MC1) |
| Dispatcher `__setForceDeadLetter…` | No (introduced D-045 SC05) | Yes | Yes | **REMOVED** (this MC2) |
| Queue `__setQueueStateClassificationSeamForTests` | **Yes** (present at `9d43ec9…` / D-044) | Yes when set | Setter exported from runtime module | **Flag for Claude** — not altered in this focused correction |
| `resolveTestRedisFastFailMs` / `STOCKY_TEST_*` | D-045 SC02 hardened pre-existing timeout | Timeout only when `NODE_ENV===test` | Env ignored outside test | Intentional D-045 hardening; not a business-path bypass |
| `STOCKY_TEST_REDIS_FAST_FAIL` in `queue.server` | Pre-existing; D-045 gated to `NODE_ENV===test` | Connection fast-fail in test | Ignored outside test | Intentional D-045 hardening |

### Test evidence / final identity

Local focused suites and exact-head CI are recorded in the ChatGPT handoff / PR body (not a tip-identity commit). Status remains:

```text
FINAL CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

### Safety confirmation

No production migration, role change, queue execution, webhook replay, merchant data, ownership repair, or inventory mutation. Inventory-write flags remain OFF. No PR 5 work. No secrets. No amend/rebase/force-push. PR #20 remains OPEN, DRAFT, UNMERGED.
