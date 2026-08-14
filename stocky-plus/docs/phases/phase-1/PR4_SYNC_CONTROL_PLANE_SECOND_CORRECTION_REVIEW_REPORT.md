# Phase 1 PR 4 — Independent Second-Correction Review Report

```text
INDEPENDENT PR 4 SECOND-CORRECTION REVIEW IN PROGRESS.
PR #20 REMAINS OPEN, DRAFT, AND UNMERGED.
PR 5, PRODUCTION EXECUTION, PRODUCTION MIGRATIONS,
WEBHOOK REPLAY, AND INVENTORY WRITES REMAIN UNAUTHORIZED.
```

**Reviewer:** Claude Code (independent technical reviewer)
**Decision context:** D-044 second corrections + NEW-PR4-C01 mechanical completion
**Acceptance authority:** ChatGPT. **Merge authority:** the user.
**Review date:** 2026-08-05

---

## 1. Executive verdict

```text
NOT READY — CORRECTIONS REQUIRED
```

This verdict rests on **one P2 finding (NEW-PR4-SC01)**, not on a broad failure.

The D-044 second corrections are, on independent evidence, substantially and
genuinely implemented. All eight first correction-review findings
(NEW-PR4-C01…C08), both P1s among them, and the F-PR4-01 concurrent
receipt-race residual are closed with reproducible evidence. The three
mechanical-completion defects ChatGPT identified after `1f5b74b` —
`UNKNOWN_STATE` treated as terminal, `QUEUE_UNAVAILABLE` treated as absence,
and non-retryable/exhausted stranded jobs routed to retry — are all correctly
fixed and independently reproduced. **No P0 or P1 defect is open.**

The blocking item is narrow and specific. The D-044 review mandate required
confirming that the worker's `APPLICATION_ALREADY_APPLIED` handler
"does not finalize success without actually verifying the existing receipt and
digest," and explicitly directed that comments be treated as non-evidence. It
does not verify. `app/jobs/workers/webhook-processor.ts:477-492` carries a
comment stating success is finalized "only if receipt exists; otherwise
dead-letter uncertain," while the code beneath it unconditionally calls
`completeAttemptSuccess()` with no receipt read of any kind. Because this sits
directly on the exactly-once finalization path — the core safety property this
PR exists to establish — and because a named mandatory check failed, it is
reported as a required correction rather than waved through as a residual.

The required correction is small and localized (verify the receipt and digest
before finalizing; dead-letter `application_outcome_uncertain` otherwise), plus
one acceptance test. Everything else found is P3.

I did not implement any correction, per instruction.

---

## 2. Identity and chain of custody

| Role | SHA | Verified |
|---|---|---|
| Authorized base / `origin/main` | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ exact |
| Merge base (`git merge-base origin/main HEAD`) | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ exact |
| Original reviewed implementation | `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` | ✅ present in history |
| First correction runtime/test head | `0697a2878eed3ce8013f59af54de7d0adf98d548` | ✅ present in history |
| First correction-review tip / D-044 start | `4c15028f72be20e4138bdbf85bc5e1d3894b53c6` | ✅ present in history |
| Original second-correction tip | `1f5b74bca35e580278b9980cb18aa81f0e9c6568` | ✅ present in history |
| Mechanical-completion runtime/test head | `0158a09eb3b0f1b62c9459e2db4df344183a6f59` | ✅ present in history |
| Documentation synchronization commit | `71bb576005501155a2965568db0d6b08b30ca48e` | ✅ present in history |
| **Reviewed implementation head (PR tip at review)** | **`b73a22f67afd9aa29995486afdfc52147c90fb9f`** | ✅ exact `HEAD` |
| Working tree | clean (`git status --porcelain` empty) | ✅ |
| PR #20 state | `open`, `draft: true`, `merged: false`, `mergeable_state: clean` | ✅ |
| Exact-head CI run / job | `31029829525` / `92387401357`, `head_sha = b73a22f…`, conclusion `success` | ✅ |

Branch history from `e69bc53…` to `b73a22f…` contains all listed review and
correction commits, in order, with no rebase, amend, squash, or force-push.
No identity mismatch. Review proceeded.

**Report-only commit:** recorded separately in §14 after creation. A report-only
commit moves the PR tip but does **not** change the reviewed runtime/test
implementation head, which remains `b73a22f67afd9aa29995486afdfc52147c90fb9f`.

### Immutable review records — verified unchanged

| File | Authoritative commits | Modified since? |
|---|---|---|
| `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md` | `329aa92`, `944cd59` | ❌ no |
| `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md` | `4c15028` | ❌ no |

`git log --follow` on both files returns only their authoring commits.

### Migrations — verified not edited

`git diff --stat e69bc53..HEAD -- prisma/migrations/` shows **only insertions
of new files** (945 lines across 6 new migration directories); zero deletions
and zero modifications to previously committed migration SQL. The five prior
migrations named in the mandate are byte-identical to their authoring commits.
The only mechanical-completion migration is the additive
`20260805140000_sync_control_plane_enqueued_failed`, exactly as required.

---

## 3. Scope and methodology

**Commit ranges reviewed:** full PR diff `e69bc53…b73a22f` (100 files, +20,074 /
−597) with focused re-review of `4c15028…b73a22f` (the D-044 + mechanical
completion range).

**Files inspected in depth:** `app/sync/dispatcher.server.ts`,
`queue-presence.server.ts`, `lifecycle.server.ts`,
`application-receipt.server.ts`, `state-machine.server.ts`,
`envelope-v3.server.ts`, `control-plane-db.server.ts`, `intake.server.ts`,
`execution-strategy.server.ts`, `app/jobs/workers/webhook-processor.ts`,
`app/tenant/tenant-db.server.ts`, `db-context.server.ts`,
`scripts/sync-control-plane/roles.ts`, all six new migrations, the full sync
test suites, `.github/workflows/ci.yml`, `package.json`, the vitest configs,
and the phase status/evidence documents.

**Infrastructure used:** disposable local PostgreSQL **16.13** (`initdb`,
trust auth, ephemeral `/tmp/pgdata`) and local Redis **7.x** on `localhost`.
BullMQ pinned at **5.81.2**, Prisma **6.19.3**, Node **v22.22.2**, npm
**11.5.2** (pinned to match CI). Environment variables mirrored from
`.github/workflows/ci.yml` verbatim (test-only placeholders).

**No production resources of any kind were used.** No production database,
role, queue, shop, credential, or merchant data. No production migration, no
webhook replay against a real shop, no ownership repair, no inventory mutation.
All inventory-write feature flags remained `false` throughout.

### Limitations

1. **No outbound internet to `shopify.dev`.** `curl https://shopify.dev/`
   returns HTTP `000`; `npx graphql-codegen` exits `1` because it cannot fetch
   the Admin GraphQL schema. Local GraphQL schema validation was therefore
   **not possible**. CI executed this step successfully at the exact head.
2. **No live Shopify Admin API access.** Q-003 / F-PR4-18 cannot be closed by
   this review (see §12).
3. Two intermediate observations of mine were contaminated by a concurrently
   running `test:migrations` suite that drops and recreates the `public` schema.
   Both were re-verified from a pristine, from-scratch database rebuild in CI
   order before any conclusion was drawn; the corrected results are what this
   report states. This is recorded for transparency — it changed no finding.

---

## 4. Finding-count reconciliation

### Previous findings

| Source | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Original review (`F-PR4-01…20`, detailed sections) | 0 | 4 | 10 | 6 | **20** |
| First correction review (`NEW-PR4-C01…C08`) | 0 | 2 | 2 | 4 | **8** |
| **Previous total** | **0** | **6** | **12** | **10** | **28** |

> **Observed discrepancy (not corrected here):** the original review's §2
> summary table records `P1 4 / P2 7 / P3 4` (15), while that same report
> contains **20** detailed `### F-PR4-nn` finding sections whose stated
> severities total `P1 4 / P2 10 / P3 6`. The summary table understates P2 by 3
> and P3 by 2. I reconcile against the 20 detailed sections, which are the
> authoritative enumeration. The original report is immutable and was not
> edited.

### Previous residuals carried into this review

| Residual | Severity | Disposition this review |
|---|---|---|
| F-PR4-01 concurrent receipt race (`25P02`) | P1 | **CLOSED** |
| Mechanical-completion: `UNKNOWN_STATE` treated as terminal | P1 | **CLOSED** |
| Mechanical-completion: `QUEUE_UNAVAILABLE` treated as absence | P1 | **CLOSED** |
| Mechanical-completion: non-retryable/exhausted routed to retry | P1 | **CLOSED** |

### Newly discovered findings (this review)

| Severity | Count | IDs |
|---|---|---|
| P0 | **0** | — |
| P1 | **0** | — |
| P2 | **1** | NEW-PR4-SC01 |
| P3 | **7** | NEW-PR4-SC02 … NEW-PR4-SC08 |
| **New total** | **8** | |

### Reconciled totals

| | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Previous findings | 0 | 6 | 12 | 10 | 28 |
| — of which now closed | 0 | 6 | 12 | 10 | 28 |
| — of which still open/blocking | 0 | **0** | **0** | **0** | **0** |
| Previous residuals (4) | 0 | 4 | 0 | 0 | 4 → all closed |
| **New findings** | **0** | **0** | **1** | **7** | **8** |
| **Open after this review** | **0** | **0** | **1** | **7** | **8** |

Counts reconcile exactly: 28 previous findings + 4 tracked residuals, all
closed; 8 new findings open, of which 1 is P2 (blocking per §1) and 7 are P3
nonblocking.

---

## 5. Full closure matrix

Dispositions use only the permitted vocabulary. None were copied from Cursor.

### Original findings

| ID | Orig. severity | Disposition | Evidence |
|---|---|---|---|
| F-PR4-01 | P1 | **CLOSED WITH NONBLOCKING RESIDUAL** | `ON CONFLICT DO NOTHING RETURNING` (`application-receipt.server.ts:99-125`); real two-client race test passes; residual = NEW-PR4-SC01 |
| F-PR4-02 | P1 | **CLOSED** | `formatQueueJobId` per-sequence IDs; retained-terminal supersede + new sequence; dispatch-recovery suite |
| F-PR4-03 | P1 | **CLOSED** | `DISPATCH_LEASED→CANCELLED` and `RUNNING→CANCELLED` legal in TS **and** SQL; `test:sync-uninstall` 8/8 |
| F-PR4-04 | P1 | **CLOSED** | `recoverExpiredRunningAttempts`; `test:sync-attempt-recovery` 16/16 |
| F-PR4-05 | P2 | **CLOSED** | `SELECT … FOR UPDATE` + CAS `WHERE state = …` on every transition |
| F-PR4-06 | P2 | **CLOSED** | `sync:roles:verify` fails closed on 3 injected drifts (§9) |
| F-PR4-07 | P2 | **CLOSED** | `sync:inventory:check` ok, 36 surfaces, digest `48e62809a4c8…` |
| F-PR4-08 | P2 | **CLOSED** | digest conflict fails closed; `APPLICATION_DIGEST_CONFLICT` test |
| F-PR4-09 | P3 | **CLOSED WITH NONBLOCKING RESIDUAL** | residual = NEW-PR4-SC07 |
| F-PR4-10 | P3 | **CLOSED** | `PROJECT_STATUS.md` names PR #20 and its state |
| F-PR4-11 | P2 | **CLOSED** | indexed per-state claim; `test:sync-performance` passes at `SYNC_PERF_JOB_COUNT=50000` |
| F-PR4-12 | P2 | **CLOSED** | `sanitize.server.ts` size/depth/node limits |
| F-PR4-13 | P2 | **CLOSED** | `claimBatchFair` round-robin `ROW_NUMBER() OVER (PARTITION BY "shopId")`; perf/fairness test passes |
| F-PR4-14 | P3 | **CLOSED** | asserts against live `preDeadLetter.state`, not a literal pair (`lifecycle.server.ts:434-441`) |
| F-PR4-15 | P3 | **CLOSED** | `replay.server.ts` asserts `DEAD_LETTERED` origin |
| F-PR4-16 | P3 | **CLOSED** | explicit `durable.shopId !== ctx.envelope.shopId` on v2 and v3 paths |
| F-PR4-17 | P3 | **CLOSED** | documented in uninstall runbook |
| F-PR4-18 | P2 | **OUT OF SCOPE — REMAINS OPEN** | no live Shopify schema validation available (§12) |
| F-PR4-19 | P2 | **CLOSED** | no `"[REDACTED]"` default remains |
| F-PR4-20 | P2 | **CLOSED** | missing webhook ID rejected at intake (`intake.server.ts:119`) |

### First correction-review findings (D-044 scope)

| ID | Orig. severity | Disposition | Root cause closed? |
|---|---|---|---|
| NEW-PR4-C01 | **P1** | **CLOSED WITH NONBLOCKING RESIDUAL** | **Yes** — residuals SC02/SC03/SC05/SC06/SC08 |
| NEW-PR4-C02 | **P1** | **CLOSED** | **Yes** |
| NEW-PR4-C03 | P2 | **CLOSED WITH NONBLOCKING RESIDUAL** | Yes — residual: owner-shim limitation + missing SC01 case |
| NEW-PR4-C04 | P2 | **CLOSED** | Yes |
| NEW-PR4-C05 | P3 | **CLOSED WITH NONBLOCKING RESIDUAL** | Yes — residual SC07 |
| NEW-PR4-C06 | P3 | **CLOSED** | Yes |
| NEW-PR4-C07 | P3 | **CLOSED** | Yes |
| NEW-PR4-C08 | P3 | **CLOSED** | Yes |

### Post-`1f5b74b` mechanical-completion defects

| Defect | Disposition | Independent evidence |
|---|---|---|
| `UNKNOWN_STATE` treated as terminal | **CLOSED** | `UNKNOWN_STATE` yields `outcome: "queue_state_unknown"`; dispatch stays `PENDING_ENQUEUE` at sequence 1; no supersede, no `FAILED`, no new sequence, no ack, no Redis mutation. Tests assert exact counts (`toHaveLength(1)`, `dispatchSequence === 1`). |
| `QUEUE_UNAVAILABLE` treated as absence | **CLOSED** | Both indeterminate statuses short-circuit before any mutation in `recoverStrandedEnqueuedJobs` (`dispatcher.server.ts:1069-1090`); counted as `indeterminate`. Cross-shop test proves shop A stays `ENQUEUED` while shop B recovers to `RETRY_WAIT`. |
| Non-retryable / exhausted stranded jobs routed to retry | **CLOSED** | `shouldDeadLetterStranded` + `terminalizeStrandedEnqueuedJob`. My repro: 10 exhausted jobs → 10 `DEAD_LETTERED`, `terminalReason = max_attempts_exceeded`, `finalAttemptId = NULL`, **0 duplicate dead letters** under 3 concurrent reapers. |

---

## 6. Detailed findings

### NEW-PR4-SC01 — P2 — Worker finalizes SUCCEEDED on `APPLICATION_ALREADY_APPLIED` without verifying the receipt

**Files/functions:** `app/jobs/workers/webhook-processor.ts:477-492`
(v3 webhook path, `catch` block); interacts with
`app/sync/application-receipt.server.ts:136-159`.

**Root cause.** `applyWithApplicationReceipt` throws
`APPLICATION_ALREADY_APPLIED` from **two** distinct places:

- line 144-149 — the winner's row was read back and its digest **matches**
  (genuinely already applied; safe);
- line 156-159 — `"SyncApplicationReceipt conflict without readable winner
  row"`, i.e. the unique insert conflicted but **no receipt row could be read**.

The worker's handler does not distinguish them. It carries the comment
"finalize success without duplicate merchant effects **only if receipt exists;
otherwise dead-letter uncertain**", then unconditionally executes
`completeAttemptSuccess(...)` with `applicationStatus: "already_applied_race"`.
There is **no** receipt read in this branch — no
`syncApplicationReceipt.findUnique`, no `stocky_has_application_receipt` probe.
Verified by inspection and by `grep`: the only call site of the receipt probe in
the entire worker/lifecycle surface is `lifecycle.server.ts:610`, inside the
expired-attempt reaper.

The receipt is also never verified **outside** the rolled-back tenant
transaction, which the D-044 mandate names as a requirement. The winner row is
read at `application-receipt.server.ts:136` while still inside the loser's
transaction, which is then rolled back.

**Merchant/operational impact.** A durable job can reach terminal `SUCCEEDED`,
its `WebhookDelivery` marked `COMPLETED`, and its dispatch marked `COMPLETED`,
with **no proof that the merchant-domain writes were ever applied by anyone**.
The job is then unrecoverable through normal means: `SUCCEEDED` is terminal, no
dead letter is opened, no `DataIssue` is recorded, and reconciliation has no
signal. For an `orders/create` webhook this silently loses sales-aggregate,
inventory, BOM, and low-stock effects for that delivery.

**Reachability (stated honestly).** Under the isolation level actually in use
today the unsafe branch is not reachable: the webhook processor calls
`ctx.db.$transaction(...)` with no options, so Prisma uses PostgreSQL's default
**READ COMMITTED**. There, `ON CONFLICT DO NOTHING` blocks on the conflicting
tuple until the winner commits or aborts; if it returns zero rows the winner has
committed, so the subsequent statement-level snapshot always sees it. The
defect is therefore latent rather than currently exploitable. It is **not**
structurally prevented: `app/tenant/tenant-db.server.ts:1350` already exposes a
`serializable` transaction option, and any caller enabling it — or any future
`REPEATABLE READ` use — converts this into a silent wrong-`SUCCEEDED` with no
code change at the failure site. The correctness of the current behavior rests
on an unstated, unasserted isolation-level assumption.

**Reproducible evidence.**
- Code inspection of `webhook-processor.ts:477-492` (branch performs zero reads).
- `grep -rn "has_application_receipt\|syncApplicationReceipt.findUnique" app/jobs/` → no match in the handler.
- Isolation level confirmed: no `isolationLevel` passed on the webhook apply path.
- **No committed test** exercises `APPLICATION_ALREADY_APPLIED` with the receipt
  absent. The existing race test
  (`sync-exactly-once.test.ts:910`) only covers the digest-match case.

**Required correction.** In the `APPLICATION_ALREADY_APPLIED` branch, after the
tenant transaction has rolled back, re-read the receipt for
`(shopId, applicationKey)` on a fresh connection/transaction and require both
that it exists and that `payloadDigest` equals `durable.payloadDigest`. Finalize
`completeAttemptSuccess` only then. Otherwise dead-letter with
`APPLICATION_OUTCOME_UNCERTAIN`. Align the v2 path's behavior or document the
divergence (see SC08 note below). Delete or correct the comment either way.

**Acceptance test.** Force `applyWithApplicationReceipt` to raise
`APPLICATION_ALREADY_APPLIED` with no receipt row present, and assert the
durable job ends `DEAD_LETTERED` with `terminalReason =
application_outcome_uncertain`, exactly one OPEN dead letter, and **not**
`SUCCEEDED`. Add the digest-mismatch variant.

**Related risks:** R-109, R-104.

---

### NEW-PR4-SC02 — P3 — Production-reachable environment variable alters Redis lookup behavior

**File:** `app/sync/queue-presence.server.ts:101-113`.

`inspectQueueDispatchPresence` reads
`process.env.STOCKY_TEST_REDIS_FAST_FAIL_MS` unconditionally, with no
`NODE_ENV` guard, and when set races `queue.getJob()` against a timeout that
rejects into `QUEUE_UNAVAILABLE`. Despite the `_TEST_` name this is live
production code on the dispatch hot path: setting it in a production
environment would convert slow-but-healthy Redis lookups into synthetic queue
outages. The `setTimeout` is also never cleared, so each call keeps a timer
alive for the full duration.

**Impact:** bounded — the induced state is `QUEUE_UNAVAILABLE`, which fails
closed (no ack, no new sequence, no mutation). No correctness or safety loss;
this is a test seam leaking into production reachability, which the review
mandate flags explicitly.

**Correction:** gate on `NODE_ENV !== "production"` (mirroring
`resetControlPlanePrismaForTests`, which already does this), and
`clearTimeout` on settle. **Test:** assert the variable is ignored when
`NODE_ENV=production`.

---

### NEW-PR4-SC03 — P3 — Indeterminate recovery evidence has no deduplication or cooldown

**File:** `app/sync/dispatcher.server.ts:679-735`, called at `1073-1087` and
`489-497`, `575-583`, `631-639`.

`recordIndeterminateDispatchEvidence` unconditionally `create`s a `DataIssue`
row on every invocation. `SyncHealth` is an `upsert` (correctly deduplicated),
but `DataIssue` is not. A durable job that remains genuinely indeterminate is
never mutated — by design — so it stays `ENQUEUED`, stays the oldest candidate,
and is re-inspected on every reaper cycle, writing a fresh `DataIssue` each
time. Under a sustained indeterminate condition this grows without bound and
floods the merchant-facing data-issue surface with duplicates of one fact.

The same applies to `dispatchPendingJobs`: `queue_state_unknown` and
`queue_unavailable` leave the job `DISPATCH_LEASED` with `nextEligibleAt`
unchanged, so lease expiry (30 s) returns it to `PENDING` for immediate
re-claim, with no backoff and no `attemptCount` increment — a tight loop, each
iteration writing another `DataIssue`.

**Honest limitation:** I could **not** stage a sustained indeterminate
condition in my harness. In every state I actually reproduced, growth was
bounded and self-terminating (5 jobs → 5 rows in cycle 1, then 0, 0, 0 as they
left `ENQUEUED`). This finding rests on code inspection of an unbounded write
path, not on an observed unbounded run.

**Correction:** deduplicate indeterminate `DataIssue` rows per
`(shopId, durableJobId, reasonCode)` within a cooldown window, or upsert as
`SyncHealth` already does. Add backoff on the `queue_state_unknown` /
`queue_unavailable` dispatch outcomes. **Test:** N recovery cycles over one
persistently indeterminate job produce a bounded number of `DataIssue` rows.

**Related risks:** R-099, R-112.

---

### NEW-PR4-SC04 — P3 — Nullable selector values become omitted filters

**Files:** `app/sync/dispatcher.server.ts:985-993`;
`app/sync/lifecycle.server.ts:147-160`.

Two instances of the pattern the mandate flags:

1. `dispatchSequence: live.activeDispatchSequence ?? undefined` — in Prisma,
   `undefined` **omits the filter entirely** rather than matching NULL. For a
   legacy `ENQUEUED` row predating `activeDispatchSequence` (nullable, added by
   migration), the reaper silently widens to "the highest-sequence live
   dispatch" instead of failing closed on unknown dispatch identity.
2. `renewAttemptHeartbeat` builds `where: { id: (await findUnique(...))?.durableJobId, … }`.
   If that inline lookup returned `undefined`, the `id` filter would vanish and
   the `updateMany` would extend leases across every `RUNNING` job of that shop
   held by that worker.

**Impact:** bounded in both cases. (1) is scoped to the same `durableJobId` and
`shopId` and picks a deterministic newest live dispatch. (2) is guarded by the
preceding `updated.count === 0` early return, so the attempt provably exists,
and the write only extends a lease. Neither crosses a tenant boundary. Reported
because both are fail-open relaxations on identity selectors in a control plane
whose stated posture is fail-closed.

**Correction:** treat a null `activeDispatchSequence` as indeterminate and skip
(or resolve explicitly), and hoist the `renewAttemptHeartbeat` lookup into a
checked local. **Test:** legacy `ENQUEUED` row with NULL
`activeDispatchSequence` is not mutated by the reaper.

---

### NEW-PR4-SC05 — P3 — Final `FAILED → DEAD_LETTERED` update result is not checked

**File:** `app/sync/dispatcher.server.ts:885-896`.

`terminalizeStrandedEnqueuedJob` checks the `RETURNING id` of the
`ENQUEUED → FAILED` update (line 851-863) but discards the result of the
subsequent `FAILED → DEAD_LETTERED` `$executeRaw`. Every other terminalization
path in the codebase checks its counterpart (`lifecycle.server.ts:461-482`
inspects `updatedRows` and re-reads on empty).

**Impact:** none observed. The row is held under `FOR UPDATE` from line 815 and
was just set to `FAILED` in the same transaction, so the `WHERE state = 'FAILED'`
predicate cannot fail to match. My concurrent-reaper repro produced 10/10
`DEAD_LETTERED` with zero jobs stranded in `FAILED`. This is defensive-coding
hygiene on a terminalization path, not a live defect.

**Correction:** use `$queryRaw … RETURNING id` and raise if empty. **Test:**
assert no durable job can be observed in terminal-intent `FAILED` after the
stranded reaper completes.

---

### NEW-PR4-SC06 — P3 — Runnable-state allowlist contains a state the pinned BullMQ cannot emit

**File:** `app/sync/queue-presence.server.ts:10-17`.

I decompiled the pinned BullMQ **5.81.2** Lua scripts. `Job.getState()` calls
`getStateV2`, whose only possible returns are:
`completed`, `failed`, `delayed`, `prioritized`, `active`, `waiting`,
`waiting-children`, `unknown`. Jobs on the paused list are explicitly mapped to
**`"waiting"`** (`getStateV2-8.js`, line 45), so `"paused"` is never returned.

The committed allowlist includes `"paused"` — a dead entry. Assessed against the
mandate's two questions:

- **Should any listed state not qualify for durable `ENQUEUED`?** No. Every
  other listed state is genuinely runnable. `"paused"` is unreachable and
  therefore harmless.
- **Is any runnable state omitted?** No. All six reachable runnable states are
  covered; `unknown` correctly falls through to `UNKNOWN_STATE` and fails closed.

`getJob()` object existence is never treated as runnable — `classifyExistingQueueJob`
always calls `getState()` first, and a `getState()` throw becomes
`QUEUE_UNAVAILABLE` (indeterminate), not absence. Terminal is correctly limited
to `completed`/`failed`.

**Correction:** remove `"paused"` or comment it as intentional
forward-compatibility. **Test:** assert `RUNNABLE_BULLMQ_STATES` is a subset of
the pinned version's reachable states, so a BullMQ upgrade must revisit it.

---

### NEW-PR4-SC07 — P3 — Chain-of-custody labelling inaccuracies in the second-correction implementation report

**File:** `docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_SECOND_CORRECTION_IMPLEMENTATION_REPORT.md`
lines 30-33, 128-132.

This is the C05 audit item the mandate required me to classify. Three
inaccuracies:

1. Line 129 records **"Final PR tip: `71bb576…`"**. The live PR tip is
   `b73a22f…`.
2. Lines 32-33 leave exact-head CI run/job/`head_sha` as **"pending"**.
3. Lines 31/128 label `71bb576` as **"Documentation / this report tip"** and
   name `0158a09` the "mechanical-completion runtime/test head". `git show`
   proves `71bb576` also modified **two test files**
   (`sync-dispatch-recovery.test.ts`, +21/−28;
   `tenant-expansion.migration.test.ts`, +12), so a test-bearing commit is
   labelled documentation-only.

**Classification:**

```text
a nonblocking evidence-hygiene residual
```

Not a material chain-of-custody defect, on this evidence:

- `b73a22f` is genuinely documentation-only (2 doc files, +3/−3) — verified by
  `git show --stat`. It changes no runtime, test, migration, or CI file, so the
  reviewed runtime/test surface is unaffected by the stale tip line.
- The report explicitly delegates authority for tip and CI to the PR body
  ("authoritative in PR #20 body after green"), and the **PR body records the
  correct live tip `b73a22f…` and the correct CI run/job**. The authoritative
  record is right; the snapshot inside the report is stale.
- I inspected the two test edits in `71bb576` for weakened assertions and found
  none: one is a TypeScript type refinement, one removes genuinely dead
  contradictory seam-assignment code (the prior version assigned the seam twice,
  the second overwriting the first) and is behaviourally equivalent to what
  already executed, and the rest **add** assertions for the new migration.

**Correction:** update the identity table to the live tip and CI, and relabel
`71bb576` as "documentation + test-fixture synchronization".

---

### NEW-PR4-SC08 — P3 — Stranded retry does not increment `attemptCount`; v2/v3 divergence on the already-applied path

**Files:** `app/sync/dispatcher.server.ts:1012-1033`, `1145-1173`;
`app/jobs/workers/webhook-processor.ts:626-661`.

Two related loose ends:

1. The stranded-reaper retry transitions `ENQUEUED → RETRY_WAIT` without
   incrementing `attemptCount`. Because `shouldDeadLetterStranded` gates
   dead-lettering on `attemptCount >= maxAttempts`, a job that is repeatedly
   stranded **without ever running** never advances toward exhaustion and can
   recycle indefinitely, writing a `stranded_enqueued` `DataIssue` each pass
   (compounding SC03).
2. On the **v2** path, `APPLICATION_ALREADY_APPLIED` neither completes nor fails
   the attempt — it rethrows (line 646-649 deliberately excludes it from
   `completeAttemptFail`), leaving the durable job `RUNNING` until the
   expired-attempt reaper converges it. That reaper *does* verify the receipt
   properly, so v2 is in fact **safer** here than v3 (SC01). The asymmetry is
   undocumented and works in the opposite direction from what a reader would
   expect given v2 is the legacy drain path.

**Impact:** low. (1) is a liveness/noise concern with no data-integrity effect
and requires a persistent dispatch anomaly. (2) is correct behavior, merely
inconsistent and unexplained.

**Correction:** add a bounded stranded-recycle counter (or reuse `attemptCount`)
with terminalization on exhaustion; document the v2/v3 divergence, and prefer
converging v3 onto the v2/reaper receipt-verification model when fixing SC01.
**Test:** a job stranded N > maxAttempts times terminalizes rather than
recycling forever.

---

### NEW-PR4-C03 acceptance-matrix limitation (recorded, not a numbered finding)

The mandate required explicit identification of scenarios using an
owner/superuser shim instead of full runtime RLS. `ownerTenantShim` appears
**20 times** in `sync-exactly-once.test.ts` and is used by every crash-window
and race scenario. These tests therefore prove **exactly-once application
semantics** but do **not** simultaneously prove RLS enforcement during those
paths.

**Determination: not blocking.** RLS enforcement is separately and directly
proven by `test:sync-role-isolation` (9/9), `test:db-isolation` (19/19),
`test:tenant-access` (288/288), and `tenant:rls:verify`. The shim is a
deliberate separation of concerns, not a gap that hides a defect. It should
remain a documented standing limitation of the exactly-once suite.

---

## 7. Test and execution evidence

All commands run from `stocky-plus/` against disposable local PostgreSQL 16.13
and Redis 7, with CI-mirrored environment variables.

| Command | Exit | Result |
|---|---|---|
| `node --version` | 0 | `v22.22.2` |
| `npm --version` | 0 | `11.5.2` (pinned to match CI) |
| `npm ci` | 0 | clean install (required npm 11.5.2 — engine-strict) |
| `npx prisma generate` | 0 | client v6.19.3 |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma migrate deploy` | 0 | all 12 migrations applied to empty DB |
| `npx prisma migrate deploy` (repeat) | 0 | **`No pending migrations to apply.`** |
| `npm run tenant:indexes:apply -- --apply` | 0 | 44 indexes created |
| `npm run tenant:indexes:verify` | 0 | `ok: true, mismatches: []` |
| `npm run tenant:schema:drift` | 0 | no drift |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npm run tenant:roles:provision -- --apply` | 0 | provisioned |
| `npm run tenant:enforcement:preflight` | 0 | ok |
| `npm run tenant:enforcement:apply -- --apply` | 0 | applied |
| `npm run tenant:roles:verify` | 0 | ok |
| `npm run tenant:rls:verify` | 0 | ok |
| `npm run tenant:immutability:verify` | 0 | ok |
| `npm run tenant:enforcement:verify` | 0 | ok |
| `npm run tenant:enforcement:drift` | 0 | ok |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok`, 19 models |
| `npm run tenant:access:inventory:check` | 0 | fresh |
| `npm run sync:inventory:check` | 0 | `surfaces=36 digest=48e62809a4c8…` |
| `npm run sync:roles:provision -- --apply` | 0 | provisioned |
| `npm run sync:roles:verify` | 0 | `{"ok": true, "errors": []}` |
| `npm run test:sync-integration` | 0 | **12 files, 129 tests passed** |
| `npm run test:sync-exactly-once` | 0 | **19 passed** |
| `npm run test:sync-dispatch-recovery` | 0 | **27 passed** (matches the claim) |
| `npm run test:sync-attempt-recovery` | 0 | **16 passed** |
| `npm run test:sync-envelope-fail-closed` | 0 | **6 passed** |
| `npm run test:sync-role-isolation` | 0 | **9 passed** |
| `npm run test:sync-uninstall` | 0 | **8 passed** |
| `npm run test:sync-inventory-audit` | 0 | **5 passed** |
| `npm run test:sync-performance` | 0 | **1 passed** at `SYNC_PERF_JOB_COUNT=50000` |
| `npm run test:db-isolation` | 0 | **2 files, 19 passed** |
| `npm run test:tenant-access` | 0 | **34 files, 288 passed** |
| `npm test` | 0 | **6 files, 56 passed** |
| `npm run test:migrations` | 0 | **47 files, 219 passed** |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm run build` | 0 | clean |
| `npm run graphql-codegen` | **1** | **environment limitation** — no outbound HTTPS to `shopify.dev` (`curl` → HTTP `000`); CI ran this successfully at the exact head |
| `git diff --check` | 0 | clean |
| `git status --porcelain` | 0 | empty |

**Aggregate independently executed: 792 tests passed, 0 failed** (excluding
graphql-codegen, blocked by the sandbox network policy).

### Focused CI-filter selection proof

Each filter was run exactly as CI invokes it. **Every one selects exactly one
test — none match zero:**

| Filter | Exit | Selected |
|---|---|---|
| `-t "existing unknown queue state does not create another dispatch sequence"` | 0 | **1 passed**, 26 skipped |
| `-t "Redis outage cannot create duplicate dispatches"` | 0 | **1 passed**, 26 skipped |
| `-t "NO_AUTOMATIC_RETRY stranded job dead-letters"` | 0 | **1 passed**, 26 skipped |
| `-t "max-attempt stranded job dead-letters"` | 0 | **1 passed**, 26 skipped |

### Independent adversarial reproductions (my own harness, not the repo's tests)

| Scenario | Result |
|---|---|
| **Transition-graph parity** — extracted the 16 pairs from the **live** `stocky_durable_job_transition_guard()` via `pg_proc.prosrc` and diffed against `DURABLE_JOB_TRANSITIONS` | **EXACT MATCH, 16/16** — verified against the deployed function, not the migration file |
| **Concurrent stranded reapers** — 10 exhausted jobs, 3 concurrent `recoverStrandedEnqueuedJobs` | 10 `DEAD_LETTERED`, **0 duplicate dead letters**, `terminalReason = max_attempts_exceeded`, `finalAttemptId = NULL` on all 10; only one reaper reported work (`deadLettered: 10 / 0 / 0`) |
| **Nullable `finalAttemptId`** | Supported — 10/10 dead letters created with NULL |
| **Drift fail-closed: `GRANT EXECUTE … TO PUBLIC`** | `sync:roles:verify` → `ok: false`, errors `runtime_has_receipt_probe_execute`, `public_has_receipt_probe_execute` |
| **Drift fail-closed: ownership back to superuser** | `ok: false`, error `receipt_probe_owner_not_restricted:stocky` |
| **Drift fail-closed: probe owner granted LOGIN** | `ok: false`, errors `receipt_probe_owner_not_restricted:stocky`, `receipt_probe_owner_can_login` |
| **Repeat provisioning + repeat deploy** | Ownership and grants preserved; `sync:roles:verify` returns `ok: true` |
| **BullMQ 5.81.2 state decompilation** | `getStateV2` returns only the 8 states listed in SC06; paused → `"waiting"` |

---

## 8. CI audit

**The exact-head CI evidence is credible.**

| Check | Result |
|---|---|
| Belongs to the exact implementation head | ✅ `head_sha = b73a22f67afd9aa29995486afdfc52147c90fb9f` |
| Run / job | `31029829525` / `92387401357`, workflow `CI`, `run_attempt: 1` |
| Conclusion | `success` |
| Total steps | **119**, every one `conclusion: success` |
| Material `continue-on-error` | **none** — no step in `ci.yml` sets it |
| Material skips | **none** — zero steps with `conclusion: skipped` |
| Zero-test success | **none** — I re-ran all four new focused gates locally; each selects exactly 1 test |
| PostgreSQL service | **real** — `postgres:16-alpine` with `pg_isready` health gate |
| Redis service | **real** — `redis:7-alpine` with `redis-cli ping` health gate |
| Migrations applied | ✅ step 10 `prisma migrate deploy` |
| Build | ✅ step 118 |
| GraphQL codegen / schema validation | ✅ step 119 (requires outbound HTTPS; succeeded in CI, unavailable to me) |
| Role provisioning + verification | ✅ steps 53-54 |
| New NEW-PR4-C01 gates | ✅ steps 61-64, all success |
| NEW-PR4-C07 role-present / role-absent fixtures | ✅ steps 115-116, **both reachable in the same run** |
| NEW-PR4-C08 probe-ownership gate | ✅ step 73 |

Job ran 17:23:58 → 17:56:23 UTC (~32 min), consistent with genuinely executing
the full matrix (the migrations suite alone accounts for ~11 min).

Green CI is treated as evidence, not as a substitute: every material claim in
this report is backed by my own execution, except GraphQL schema validation,
which the sandbox network policy made impossible and which is explicitly
flagged as CI-only evidence.

---

## 9. Security and tenancy verdict

**PASS — no P0 or P1 security or tenancy defect. No cross-tenant exposure was
found.**

**Cross-shop isolation.** Every control-plane query is shop-scoped. The stranded
reaper isolates per job in its own transaction with its own `try`/`catch`, so
one shop's failure cannot abort another's recovery — proven by the committed
cross-shop test (shop A indeterminate stays `ENQUEUED` at dispatch sequence 1;
shop B recovers to `RETRY_WAIT` in the same pass) and by my repro
(`isolatedFailures: 0` across mixed-shop batches). No cross-shop lookup mistakes
were found.

**Merchant-domain DML.** All merchant writes flow through
`applyWithApplicationReceipt` inside a single tenant transaction, with the
receipt as the final write. v1 envelopes cannot reach a merchant handler
(`legacy_envelope_unsupported`, thrown before any tenant DB access). v2 requires
`webhookDeliveryId` and fails closed **before** `resolveTenantJobContextV2` or
`createTenantDb` is called. Cron paths introduce no equivalent bypass —
`processCronJob` requires an envelope and a durable job, and rejects unknown
versions.

**Control-plane role.** `stocky_control_plane` holds table privileges on exactly
the 11 control-plane tables, plus deliberate **column-level** SELECT/UPDATE on
the eight `Shop` lifecycle columns the dispatcher reads (`id`,
`myshopifyDomain`, `processingEnabled`, `uninstalledAt`, …) and **no table-wide
`Shop` grant**. I initially read the absent table-level grant as a defect; it is
correct least-privilege design, confirmed against `information_schema.column_privileges`.

**Receipt-probe owner (NEW-PR4-C08).** Verified on a pristine, from-scratch
provisioning run:

| Property | Observed |
|---|---|
| Owner of `stocky_has_application_receipt(text,text)` | `stocky_receipt_probe_owner` — **not** the migration/superuser role |
| `rolcanlogin` / `rolsuper` / `rolbypassrls` / `rolcreaterole` / `rolcreatedb` / `rolinherit` | `f` / `f` / `f` / `f` / `f` / `f` — all six required attributes hold |
| `prosecdef` | `t` |
| `proconfig` | `search_path=pg_catalog, pg_temp` — pinned, injection-safe |
| `proacl` | `{probe_owner=X/probe_owner, stocky_control_plane=X/probe_owner}` — **PUBLIC has none; `stocky_runtime` has none** |
| Role memberships involving these roles | **zero rows** — control plane is not a member of the owner; runtime is not a member of either |
| Ownership transfer ordering | EXECUTE is granted to the control plane **after** `ALTER FUNCTION … OWNER TO`, in `provisionReceiptProbeOwner` |
| Drift verification | **fails closed** on all three injected regressions (§7) |
| Empty-DB, upgrade, repeat-provision, repeat-deploy | all correct; `CREATE OR REPLACE` preserves owner and ACL |

The `20260805130000` migration's `oidvectortypes(p.proargtypes) = 'text, text'`
predicate does match the live function (confirmed by direct catalog query), so
the REVOKE is **not** a no-op — the concern that motivated that migration is
resolved.

**RLS.** Verified by `tenant:rls:verify`, `test:sync-role-isolation` (9/9),
`test:db-isolation` (19/19), `test:tenant-access` (288/288). Standing limitation:
the exactly-once suite runs under an owner shim (§6), with RLS covered
separately.

**SECURITY DEFINER.** Exactly one such function on this surface, owned by a
restricted NOLOGIN/NOINHERIT/NOBYPASSRLS role, existence-only in its return
shape, argument-identity matched, `search_path` pinned. Correct.

**Envelope authority.** v3 envelopes are HMAC-signed and carry
`durableJobId`, `dispatchId`, `dispatchSequence`, `queueJobId`, `shopId`,
`topic`, and a 64-char `payloadDigest`; all are asserted against the durable
record before merchant access, with a redundant explicit `shopId` check at the
worker. Only v3 is produced for new dispatches. Unsupported versions raise
`unknown_envelope_version`. No unsupported envelope can reach a merchant-domain
handler.

**Operational limitation (kept separate from repository correctness):** no
production queue drain is authorized, so pre-existing v1/v2 messages that may
sit in a real Redis instance have not been drained. The repository correctly
refuses to apply them; draining remains a deployment prerequisite, not a code
defect.

**No secrets** were introduced, logged, or exposed; all credentials used were
disposable local test-only values.

---

## 10. Exactly-once and recovery verdict

**PASS with one required correction (NEW-PR4-SC01).**

**Receipt race (F-PR4-01 residual) — CLOSED.** The `25P02` path is eliminated by
construction: `INSERT … ON CONFLICT ("shopId","applicationKey") DO NOTHING
RETURNING id` never aborts the transaction, so the loser's transaction stays
usable. The committed test spawns two independent `PrismaClient`s, holds both
inside real concurrent transactions at a barrier until both have written
distinct merchant rows, then releases them into the receipt race, and asserts:
exactly 1 `applied`, exactly 1 `APPLICATION_ALREADY_APPLIED`, no `25P02` in the
error text, **exactly 1 surviving merchant row** (loser fully rolled back), and
exactly 1 receipt. Same key + same digest converges; same key + different digest
fails closed with `APPLICATION_DIGEST_CONFLICT`. Crash after tenant commit but
before control-plane success converges without reapplication.

**Residual on this path:** the winner's receipt is read *inside* the loser's
soon-to-be-rolled-back transaction, and the worker then finalizes `SUCCEEDED`
without re-verifying it — **NEW-PR4-SC01**, the blocking finding.

**Crash windows.** Covered and asserted: before first merchant write; after the
first merchant write (partial); after all writes but before receipt insert;
after receipt insert but before commit; after tenant commit but before
control-plane success. All converge to exactly-once.

**Dispatch/Redis gap.** Closed. `getJob()` existence alone is never runnable;
`getState()` is always consulted; ack requires a confirmed runnable job.

**Retained terminal jobs.** `completed`/`failed` deterministic IDs are
superseded and a new dispatch sequence is allocated — never acknowledged as
`ENQUEUED`.

**Unknown states.** Fail closed. No supersede, no `FAILED`, no new sequence, no
ack, no Redis mutation. Independently reproduced with exact assertions.

**Outages.** `QUEUE_UNAVAILABLE` is indeterminate everywhere: in dispatch it
leaves the job `DISPATCH_LEASED` with the sequence preserved; in the reaper it
mutates nothing. Redis recovery after outage produces no duplicate dispatch.

**Stranded `ENQUEUED`.** Correctly routed: retryable & below limit →
`ENQUEUED → RETRY_WAIT`; `NO_AUTOMATIC_RETRY` → `ENQUEUED → FAILED →
DEAD_LETTERED` with `terminalReason = application_outcome_uncertain`;
`attemptCount >= maxAttempts` → same chain with `max_attempts_exceeded`.

**TOCTOU between Redis inspection and the second transaction — closed.** Both
terminalization and retry re-acquire `SELECT … FOR UPDATE` with `state =
'ENQUEUED'`, re-count unfinished attempts, and re-validate the exact dispatch
identity **inside** the second transaction. Under READ COMMITTED a concurrent
commit causes the locked re-read to return zero rows and the operation becomes a
no-op. A dispatch that became runnable in the gap therefore cannot be
terminalized: a live worker moves the job out of `ENQUEUED`, which the in-transaction
re-check detects.

**Atomic acknowledgment (`ackEnqueued`).** Single transaction; the durable-job
CAS requires `state = 'DISPATCH_LEASED'` and the exact `shopId`; the dispatch
update requires exact `dispatchId`, `shopId`, `durableJobId`, `dispatchSequence`,
`queueName`, `queueJobId`, `payloadDigest`, and `state = 'PENDING_ENQUEUE'`.
A dispatch mismatch **throws**, rolling back the durable-job acknowledgment.
Disabled shops are diverted before ack. Concurrent dispatchers cannot acknowledge
two active sequences: the durable-job CAS serializes, and
`ensureDispatchRecord` reuses an existing `PENDING_ENQUEUE` dispatch so a
lease-expiry re-claim does not create a second Redis job. The
`@@unique([durableJobId, dispatchSequence])` constraint backstops it.

**Expired `RUNNING` attempts.** One malformed attempt cannot abort the batch —
each is a separate transaction inside its own `try`/`catch`, so no transaction
is left poisoned; `isolatedFailures` reflects real isolated failures and a
`DataIssue` is recorded per failure. Missing `webhookDeliveryId` dead-letters
with `application_outcome_uncertain`, the attempt is finished, and the durable
job cannot remain `RUNNING`. Receipt-present jobs finalize `SUCCEEDED` **without
reapplying merchant writes** (verified via the restricted probe). Receipt-absent
retryable jobs retry legally; non-retryable and exhausted jobs dead-letter.
Concurrent reapers cannot double-complete an attempt — the
`updateMany … finishedAt: null` CAS admits exactly one winner.

**Dead letters.** Exactly one OPEN dead letter per job. Concurrent reapers
produced **0 duplicates** across 10 jobs and 3 racing reapers in my repro;
uniqueness is enforced by serialization on the `FOR UPDATE` row lock rather than
by a partial unique index. A terminalized job cannot be redispatched (terminal
states have no outgoing edges). Leases are cleared on every terminal path.

**Replay.** Requires a `DEAD_LETTERED` original; application key is stable across
retry and replay, so replay cannot duplicate merchant effects.

**Webhook duplication.** Two independent layers: intake dedup on the
`@@unique([shopId, idempotencyKey])` constraint with `idempotencyKey =
webhook:<webhookId>` and a catch-and-return-existing fallback; plus the
application receipt at apply time.

---

## 11. Migration verdict

**PASS.**

| Property | Result |
|---|---|
| Empty database | 12 migrations apply cleanly from scratch (exit 0) |
| Upgrade | New `20260805140000` applies additively over the prior 11 |
| Repeat deployment | `No pending migrations to apply.` — exact string, and a true no-op |
| Prior migrations edited | **No** — diff against `main` is insertion-only |
| Additive-only | `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` / `CREATE TRIGGER`; no destructive DDL |
| Ownership/ACL preserved across repeat deploy | Yes — verified by catalog inspection before and after |
| Role-present / role-absent fixtures | Genuinely separate, both reachable in the same CI run (steps 115-116) |
| Prior role state captured and restored | Yes — `afterAll` restore; no temporary roles, schemas, databases, or folders leaked (verified: only the three expected `stocky_*` roles exist post-run) |
| New migration in empty-DB and upgrade tests | Yes — added to `ALL_MIGRATION_NAMES`, the init-only/rest parking fixture, and both `restOut` assertions |
| Migration count assertions | Backed by a real `_prisma_migrations` count (`assertMigrationRecordedExactlyOnce`), not string-only |
| Migrations run serially | Yes — `vitest.migrations.config.ts`; 47 files / 219 tests pass |
| **Transition-graph parity** | **EXACT 16/16** between `state-machine.server.ts` and the **live** deployed `stocky_durable_job_transition_guard()` |

The `ENQUEUED → FAILED` edge added by the mechanical completion is present and
identical in both TypeScript and PostgreSQL. Illegal transitions raise
`check_violation` at the database level, so the guard holds even against direct
SQL that bypasses the application.

---

## 12. Risk and question disposition

No risk is closed automatically. Recommendations only — ChatGPT decides.

| ID | Subject | Recommendation |
|---|---|---|
| **R-039** | Envelope fail-closed authority (C04) | **Recommend CLOSE** on repository correctness — v1/v2/v3 fail-closed independently verified, 6/6 envelope tests pass. Keep an operational note that no production queue drain is authorized. |
| **R-099** | DB/Redis dispatch gap or duplicate enqueue (C01) | **Recommend DOWNGRADE, keep OPEN.** Root cause closed and adversarially reproduced. Keep open pending SC03 (evidence amplification) and SC02/SC06 hygiene. |
| **R-102** | Receipt-probe owner / privilege boundary (C08) | **Recommend CLOSE.** Strongest evidence in this review: correct ownership, attributes, ACL, membership, ordering, and drift fails closed on three injected regressions. |
| **R-104** | Stuck leases / concurrent attempts duplicate application (C02) | **Recommend DOWNGRADE, keep OPEN** until SC01 is corrected — the already-applied finalization path is the residual exposure. |
| **R-107** | Non-retryable attempt completion (C06) | **Recommend CLOSE.** `completeAttemptFail` has no caller-controlled bypass; `RUNNING → FAILED → DEAD_LETTERED` is atomic; repeated and concurrent calls converge. |
| **R-109** | Duplicate merchant effects after retry/replay (C03 + F-PR4-01) | **KEEP OPEN.** Exactly-once is proven for the tested paths, but SC01 leaves a finalization path that records `SUCCEEDED` without receipt proof. Close once SC01 is corrected and tested. |
| **R-112** | Evidence/status hygiene (C05/C07) | **KEEP OPEN** pending SC07 (stale "Final PR tip", pending CI fields, test-bearing commit labelled documentation-only). Trivial to close. |
| **Q-003** | Shopify API version `2026-07` | **KEEP OPEN — do not close.** I had **no** outbound access to `shopify.dev` (HTTP `000`) and no live Admin API access. CI's `graphql-codegen` success is *generated-schema validation* against a fetched schema — supporting evidence, but **not** live Shopify schema validation and **not** behavioral validation of `2026-07`. F-PR4-18 remains open with it. |

**Separation of evidence classes for Q-003 / F-PR4-18, as required:**

- *Repository adapter correctness* — verified locally (lint, typecheck, build, unit tests all pass).
- *Generated-schema validation* — verified **in CI only** (step 119); unavailable to me.
- *Live Shopify schema validation* — **NOT PERFORMED** by anyone in this cycle.
- *Unavailable external-network evidence* — sandbox network policy blocks `shopify.dev`.

**Other risks affected:** R-031 / R-032 / R-033 should remain OPEN until PR 4 is
accepted and merged. R-095…R-098 are accepted PR 3 residuals and were not
touched by this PR.

---

## 13. Safety confirmation

Confirmed for this review:

- ❌ No production migration was run.
- ❌ No production role was created, altered, or dropped.
- ❌ No production queue execution.
- ❌ No webhook replay against a real shop.
- ❌ No merchant data was accessed.
- ❌ No ownership repair was performed on any real system.
- ❌ No inventory mutation.
- ✅ Inventory-write feature flags remained **OFF** for the entire review
  (`FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`,
  `FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES` all `false`).
- ❌ No PR 5 work was started.
- ❌ No secrets were used, introduced, or exposed — all credentials were
  disposable local test-only values.
- ❌ No force-push, rebase, amend, squash, or history rewrite.
- ✅ Only this new report file was created; no runtime code, test, migration,
  configuration, status file, backlog, or prior review report was modified
  (`git status --porcelain` empty before writing this report).
- ✅ PR #20 remains **OPEN, DRAFT, and UNMERGED**. Not marked ready. Not merged.
  PR body unchanged.

All execution used disposable local PostgreSQL and Redis instances created for
this review and discarded afterward.

---

## 14. Required next action

```text
Return to ChatGPT for correction-scope determination.
Do not implement corrections until ChatGPT authorizes them.
```

**Recommended correction scope (for ChatGPT's determination):**

- **Required to clear the verdict:** NEW-PR4-SC01 (P2) — verify receipt and
  digest before finalizing `SUCCEEDED` on `APPLICATION_ALREADY_APPLIED`;
  dead-letter `application_outcome_uncertain` otherwise; add the acceptance test.
- **Recommended in the same pass (cheap, low-risk):** NEW-PR4-SC02 (production
  guard on the test env var) and NEW-PR4-SC07 (identity/CI fields in the
  implementation report).
- **Deferrable as accepted residuals:** NEW-PR4-SC03, SC04, SC05, SC06, SC08.

No corrections were implemented by this review, per instruction.

### Identity of this report

```text
Reviewed implementation head:
b73a22f67afd9aa29995486afdfc52147c90fb9f
```

This report-only commit moves the PR tip but does **not** change the reviewed
runtime/test implementation head. No second commit will be created to record CI
for the report-only commit.

| Role | SHA |
|---|---|
| Reviewed implementation head | `b73a22f67afd9aa29995486afdfc52147c90fb9f` |
| Report-only commit | recorded in the handoff after creation |
| Final PR tip | the report-only commit |
