# PR6 B/C CI Reliability — Independent Tooling Review

Immutable independent review artifact. Adversarial tooling review of PR #42.

This is **not** PR6-B or PR6-C product acceptance, **not** merge authorization,
**not** a D-055, and it does **not** close R-176. D-054 remains EFFECTIVE.

Reviewer: Claude (independent tooling reviewer), separate review branch.
Review executed 2026-09-14.

---

## 1. Identity, scope and PR state

### 1.1 Verified identity

| Item | Value | How verified |
| --- | --- | --- |
| Subject (review head) | `c4253ba82d24178f9a9d9c9d8c5fb89f569a0152` | `git cat-file -t` = commit; equals live `origin/tooling/pr6-bc-ci-reliability` |
| Base / live `main` | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` | equals live `origin/main` |
| Merge base | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` | `git merge-base` — identical to base |
| Ahead / behind | **4 ahead, 0 behind** | `git rev-list --left-right --count bdbb5bba...c4253ba8` → `0  4` |
| PR #42 state | OPEN, DRAFT, UNMERGED, `mergeable_state=blocked` | GitHub API |
| Subject parent | `5ec61bd3eb024cfa1e8e98cfe043d4b7c133676b` (superseded head) | `git log -1 --format=%P` |

Branch commits (base → subject):

```
ba281ab  Raise Heavy CI job timeout from 70 to 120 minutes.
fb25954  Repair F-F03 overlap harness without weakening concurrency proof.
5ec61bd  Record PR6 B/C CI budget and F-F03 harness reliability evidence.
c4253ba  Keep F-F03 helpers inside the existing EX-IDX-014 test file.
```

### 1.2 Verified scope — exactly four paths

`git diff --name-status bdbb5bba c4253ba8`:

| Path | Status | +/− | Blob at subject |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | M | 1 / 1 | `8d1fa98a53db95f4e5b641fee76322cfe4f7ac13` |
| `stocky-plus/scripts/tenant-indexes/tests/indexes.migration.test.ts` | M | 546 / 128 | `8bfc6d8bacf4d307fff7e0b61fbf6315a734e347` |
| `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` | M | 5 / 5 | `df93df44f5b48ee852fbcad0f75d3dae023f4ffc` |
| `stocky-plus/docs/phases/phase-1/PR6_BC_CI_RELIABILITY_REPORT.md` | A | 427 / 0 | `37dd3ba989019eaf505e9702430e934dc030a731` |

Total 4 files, 979 additions, 134 deletions — matches the GitHub PR record.

**Confirmed absent from the diff:** no tenant-access allowlist change, no
runtime/application code, no Prisma schema or migration, no privilege/role
change, no global Vitest config change, no dependency or lockfile change, no
Shopify call, no feature-flag or scope change.

### 1.3 Peer PRs — pins verified live, nothing borrowed

| PR | Branch | Live head | Pin in report | Match | State |
| --- | --- | --- | --- | --- | --- |
| #39 (B) | `phase-1/pr6-b-order-admin-read` | `57bebc6b1415…` | `57bebc6b…` | ✅ | OPEN / DRAFT / UNMERGED |
| #40 (C) | `phase-1/pr6-c-order-fact-applicator` | `4a5fc80417f9…` | `4a5fc804…` | ✅ | OPEN / DRAFT / UNMERGED |
| #41 (parked alt) | `tooling/pr6-ci-stability` | `78fa81b02c41…` | n/a | — | OPEN / DRAFT / UNMERGED |

PR #41's 90-minute variant, its observer-miss-retry implementation and its
CI evidence were **not** borrowed and are **not** substituted for PR #42
evidence anywhere in this review. (Noted only as a design contrast: PR #42
contains **no** observer-retry counter at all, so there is no mechanism by
which retried observations could be converted into concurrency evidence.)

### 1.4 This is a shared-main correction, not a silent B/C rewrite

Independently confirmed by blob identity — `indexes.migration.test.ts` is the
**same blob** `db25d5556af25d3eb231587901f3753e0cfc0d98` on all four peer
trees, and the Heavy timeout is `70` on all three peer trees:

| Tree | test-file blob | Heavy `timeout-minutes` |
| --- | --- | --- |
| main `bdbb5bba…` | `db25d555…` | 70 |
| B pin `57bebc6b…` | `db25d555…` | 70 |
| C pin `4a5fc804…` | `db25d555…` | 70 |
| C failed head `e5af0494…` | `db25d555…` | 70 |

PR #42 therefore corrects shared main content; it does not patch B or C, and
applying this tooling to either branch would require separate delta review and
new exact-head CI.

---

## 2. Gate A — Workflow

**Verdict: PASS.**

`git diff -U10 bdbb5bba c4253ba8 -- .github/workflows/ci.yml` is a single
hunk, one changed line:

```diff
-    timeout-minutes: 70
+    timeout-minutes: 120
```

Independently verified unchanged:

- `timeout-minutes` occurrences across the whole file are exactly three:
  line 24 = `10` (Classify), line 78 = `120` (validate), line 735 = `5` (Gate).
  Classify and Gate budgets untouched.
- Triggers (`push: [main]`, `pull_request: [main]`, `workflow_dispatch`),
  `permissions: contents: read`, concurrency group and `cancel-in-progress`.
- Services, every `run:` command, and all step names/ordering.
- Grep for `continue-on-error`, `strategy`, `matrix`, `fail-fast` as YAML keys
  returns **no matches**. There is no sharding, no retry-to-green, no
  `continue-on-error`, no test skipping introduced.

**CI Gate remains fail-closed.** The `gate` job is `if: always()` with
`needs: [classify, validate]` and evaluates:

```
CLASSIFY_RESULT != success                  -> exit 1
full_ci=true AND VALIDATE_RESULT != success -> exit 1   # cancelled fails here
docs_only=true                              -> exit 0
otherwise (indeterminate)                   -> exit 1
```

A cancelled or failed Heavy therefore still fails the Gate. This was confirmed
not only in source but in live history: run `34714619941` had
`validate=cancelled` and CI Gate concluded **failure**.

Classifier reproduced locally at the subject:

- `bash .github/scripts/classify-ci-change-set.test.sh` → `assertions=40
  pass=40 fail=0`, `classify-ci-change-set self-test OK`.
- `classify-ci-change-set.sh --from-git bdbb5bba c4253ba8` →
  `changed_path_count=4`, `classification_reason=non_docs_or_unknown_path`,
  `docs_only=false`, **`full_ci=true`**.

This diff can never take the docs-only path.

The timeout increase is **execution headroom only**. It is explicitly not
treated anywhere in this review as evidence that F-F03 is repaired.

---

## 3. Gate B — Inventory, exception surface and test discovery

**Verdict: PASS.**

### 3.1 Inventory is mechanical

Regenerated at the subject head with `npm run tenant:access:inventory`
(exit 0); `git diff` against the committed file is **empty** — the committed
inventory is byte-identical to a fresh generation.

Header values unchanged from base except the digest: scanned files **372**,
findings **1741**, converted paths **513**, approved exception findings
**1228**, violations **0**. Digest
`d4fc4027…` → `8e9b1ed9…`.

The 5/5 changed lines are: the two digest occurrences plus three EX-IDX-014
line-number shifts caused by the test edit
(`$executeRawUnsafe` 49→53 within the 49–52/50–53 block,
`new PrismaClient` 88→506, populate `$executeRawUnsafe` 969→1387).

### 3.2 No new exception path

Distinct `(path → exception ID)` rows under `scripts/tenant-indexes/` are
**identical** at base and subject:

```
scripts/tenant-indexes/tests/indexes.migration.test.ts   => EX-IDX-014
scripts/tenant-indexes/tests/schema-drift.migration.test.ts => EX-IDX-016
```

EX-IDX-014 remains the existing exact-path exception; no ID was added and the
allowlist is not in the diff. The superseded head `5ec61bd` had added two new
files (`ff03-active-phase-overlap.ts`, `ff03-active-phase-overlap.unit.test.ts`)
which are **deleted** at the subject — that is what the inlining removed.

Freshness gates executed at the subject head:

| Command | Exit | Output |
| --- | --- | --- |
| `npm run tenant:access:audit` | 0 | `{"event":"tenant_access_audit_ok"}` |
| `npm run tenant:access:inventory:check` | 0 | `{"event":"tenant_access_inventory_fresh",…}` |
| `npm run tenant:enforcement:inventory:check` | 0 | `{"event":"tenant_enforcement_inventory_fresh",…}` |

### 3.3 Test discovery is genuine, with no lost tests

| Revision | `it()` count in `indexes.migration.test.ts` |
| --- | --- |
| base `bdbb5bba` | 13 (2 manifest + 11 PostgreSQL) |
| subject `c4253ba` | **20** (2 manifest + **7 F-F03 helper** + 11 PostgreSQL) |

All 11 original PostgreSQL tests and both manifest tests are present at the
subject by name — **no original test was lost or renamed**.

Executed at the subject head:

```
npx vitest run --config vitest.migrations.config.ts \
  scripts/tenant-indexes/tests/indexes.migration.test.ts \
  -t "F-F03 active-scan overlap helper"
→ Tests  7 passed | 13 skipped (20)   exit 0
```

The seven helper tests are therefore really discovered and really executed,
not merely present as source.

**Discovery guard proven live.** Running the same `-t` filter against the
*base* tree produced `13 tests | 13 skipped` and the reporter refused it:

```
[ci-guard] testNamePattern /F-F03 active-scan overlap helper/ matched zero
passing tests — refusing vacuous success (P3-D046-01)
```

This is direct evidence that an inlining that silently failed to register the
helper tests could not pass as a vacuous success.

---

## 4. Gate C — Actual PostgreSQL overlap evidence

**Verdict: PASS**, with one non-blocking assertion-quality finding (F-TOOL-04).

### 4.1 Environment (isolated, disposable)

- PostgreSQL **16.13** (Ubuntu), freshly `initdb`-ed disposable cluster on
  `localhost:54329`, database `stocky_plus_migrations` only.
- Node **v22.22.2**, npm pinned to **11.5.2** (matching the workflow's
  `npm install -g npm@11.5.2` and its `test "$(npm --version)" = "11.5.2"`).
- No production access, no merchant database, no Shopify call, no store
  credentials.

### 4.2 What the repaired test actually asserts

Per phase, per iteration, the chain is:

1. `waitForActiveScanTrigger` polls a **single combined round-trip**
   (`pg_stat_activity` + `pg_stat_progress_create_index` + granted `Supplier`
   relation locks) and accepts a sample only when `isActiveScanSample` holds:
   exact target phase, `ShareUpdateExclusiveLock` present, `AccessExclusiveLock`
   absent, builder query still matches `CREATE INDEX CONCURRENTLY`, **and**
   remaining scan work above a floor (>10% of `blocks_total`, min 32 blocks —
   or the equivalent tuples branch).
2. `expect(buildSettled).toBe(false)` and `expect(buildSettledAtNs).toBeNull()`
   at the trigger; `schema === "public"`; `relid` truthy; locks non-empty.
3. INSERT + UPDATE + DELETE burst with **no intervening observer round-trip**
   before the first write; each `startNs > trigger.sampledAtNs`; each
   `durationMs < 15_000`.
4. An **independent after-burst re-sample**: same target phase, locks still
   `ShareUpdateExclusiveLock` without `AccessExclusiveLock`,
   `after.sampledAtNs > writeWindows[2].endNs`, `buildSettled` still false, and
   **strictly increasing `blocks_done`** (or `tuples_done`).
5. After `await buildPromise`: every write window strictly inside
   `[buildStartedAtNs, buildSettledAtNs]`.
6. `classifyIndex(...) === "valid_exact"` with `indisvalid` and `indisready`
   true.

Step 4 is the load-bearing independent observation. Steps 1 and 3 alone would
not distinguish overlap from a trigger copied into a record.

**Margin analysis.** The 10% floor is a backstop, not the operating point. In
practice the trigger fires in the first few percent of the scan — observed
`blocksDone` at trigger was 79–206 of `blocksTotal` 5324 (1.5–3.9%), leaving
~5100–5250 blocks, against an observed burst advance of only ~290–570 blocks.
That is a ~10–14× margin, and the floor still guarantees ≥532 blocks remaining
even if the observer were starved and sampled late.

Critically, the **failure direction is closed**: if a burst ever did outrun the
remaining scan, the after-burst phase equality would fail and the test would
**fail**, not silently pass. NC5 demonstrates exactly this. There is no
configuration in which a lost race is reported as successful overlap.

### 4.3 Preserved invariants — all confirmed in executed evidence

| Required | Observed |
| --- | --- |
| 3 successful F-F03 iterations | 3 `tenant_index_active_phase_write_evidence` events per passing run |
| 400,000-row fixture | `"rowCount":400000` in every event |
| Building-index scan phase | `building index: scanning table` trigger + after-burst |
| Index-validation scan phase | `index validation: scanning table` trigger + after-burst |
| Real INSERT/UPDATE/DELETE in active phase | 3 write windows per phase, ops `insert`/`update`/`delete` |
| Non-empty ShareUpdateExclusiveLock | `"lockModes":["ShareUpdateExclusiveLock"]` on every trigger and after-burst sample |
| No AccessExclusiveLock | never present in any sample |
| 15-second DML bound unchanged | `"writeThresholdMs":15000`; observed DML **0.35–2.3 ms** |
| Exact index identity | `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")` in `builderQueryPreview` |
| `valid_exact` final state | `"indexVerification":"valid_exact"` every iteration |
| Relation/schema identity | `schema":"public"`, stable `relid` per run (e.g. `50794`, `16464`) |
| Backend identity | `builderPid` recorded and used for every sample |
| Remaining-work counters advance | e.g. `blocksDone` 94→455, 206→779, 82→375, 79→621, 122→514, 127→675 of `blocksTotal` 5324 |
| Full phase ladder observed | `phasesSeen` = all 8 CIC phases including both writer-wait gates |
| Old-snapshot-wait NOT counted as F-F03 | separate RR test; see 4.6 |

`tuples_total` is `0` on this PostgreSQL 16 heap scan, so `blocks_*` is the
operative remaining-work signal. The helper handles this correctly: the tuples
branch is guarded by `tuplesTotal > 0` and falls through to blocks.

### 4.4 Attempt ledger — every attempt recorded

| Attempt | Scheduling | Result | Evidence events |
| --- | --- | --- | --- |
| runA | ordinary | PASS | 3 |
| runB | ordinary | PASS | 3 |
| runC | ordinary | PASS | 3 |
| **runD** | ordinary | **FAIL — reviewer environment** | 0 |
| ord1–ord5 | ordinary | PASS ×5 | 3 each |
| cont1 | contended (loadavg 3.71) | PASS | 3 |
| cont2 | contended (loadavg 5.73) | PASS | 3 |
| cont3 | contended (loadavg 6.81) | PASS | 3 |
| cont4 | contended (loadavg 7.78) | PASS | 3 |

**12 passing runs = 36 successful F-F03 iterations**, 5 ordinary + 4 contended
on a 4-CPU host at up to ~2× oversubscription. Plus one further full-suite run
(§6) = 39 iterations total.

**runD is disclosed, not discarded.** It failed at fixture population with
`PrismaClientKnownRequestError: Server has closed the connection` at
`clientPopulateSuppliers` (`indexes.migration.test.ts:1387`). Root cause was my
sandbox, not the subject: the PostgreSQL log shows

```
PANIC:  could not open file ".../pgdata/global/pg_control": Permission denied
LOG:  checkpointer process (PID 2103) was terminated by signal 6: Aborted
FATAL:  could not stat data directory ".../pgdata": Permission denied
```

The scratchpad directory's permissions changed underneath the running cluster.
The cluster was recreated on stable storage and all subsequent runs are from
that cluster. This failure is **not** attributed to PR #42, and it is **not**
counted as an F-F03 flake.

No retry-to-green was used anywhere: no failing F-F03 run was re-run and then
reported as a pass, and the harness contains no observer-miss retry counter.

### 4.5 Negative controls — the assertions can fail

Each mutation was applied to the subject tree, executed, then reverted
(`git checkout --`; working tree verified clean after each).

| # | Mutation | Expected | Observed | Proves |
| --- | --- | --- | --- | --- |
| NC1 | `expect(after.blocksDone).toBeGreaterThan(...)` → `toBeLessThan` | FAIL | **FAIL** — `expected 545 to be less than 83` | The after-burst advance check really executes on real advancing counters; it is not skipped by its null guard |
| NC2 | Replace the independent after-burst sample with `const after = trigger` | FAIL | **FAIL** — `expected false to be true` | The after-burst sample is a genuinely independent observation; a copy of the trigger cannot satisfy it |
| NC3 | `.not.toContain("AccessExclusiveLock")` → `.toContain(...)` | FAIL | **FAIL** — `expected [ 'ShareUpdateExclusiveLock' ] to include 'AccessExclusiveLock'` | Lock-mode assertion is real; CIC genuinely never takes ACCESS EXCLUSIVE |
| NC4 | Build-scan target phase → `"waiting for old snapshots"` | FAIL | **FAIL** — `build settled before in-progress "waiting for old snapshots" overlap` | Old-snapshot-wait is **rejected** as active-scan coverage and fails closed |
| NC5 | Invert the remaining-work floor (`remaining > 0 && remaining <= floor`) — trigger only on the last sliver | FAIL | **FAIL** — `expected 'building index: sorting live tuples' to be 'building index: scanning table'` | **The remaining-work floor is the load-bearing repair.** Without it the scan completes during the burst — exactly the original defect class |

NC5 is the strongest corroboration in this review: it reproduces the original
failure mode on demand and shows the repaired harness catches it with a
*stricter* assertion (after-burst phase) than the original `buildSettled` flag.

### 4.6 Old-snapshot-wait remains separate

The RR test `deterministic REPEATABLE READ overlap: ShareUpdateExclusiveLock,
no AccessExclusiveLock, 10 iterations` is unchanged by this diff and executed
with **10** `"waitingForOlderSnapshots":true` iterations in the full-suite run.
It is not counted as F-F03 coverage anywhere, and NC4 proves the F-F03 test
would reject it if it were.

### 4.7 Challenge matrix

| Challenge | Handling | Status |
| --- | --- | --- |
| Missing / null progress counters | `isActiveScanSample` returns false when both totals are null/0; helper test 7 covers it | Handled |
| Malformed counters | `asNullableNumber` coerces non-finite to null → rejected | Handled |
| Completed counters with stale phase text | remaining-work floor rejects; helper tests 2 and 6 | Handled |
| Stale/idle builder, previous CIC query | `builderStillCreatingConcurrentIndex` + `builderState` recorded; helper test 5 | Handled |
| Wrong relation / schema | lock subquery is constrained to `relname='Supplier'`; `expect(trigger.schema).toBe("public")`; `relid` recorded | Handled |
| Wrong PID | all sampling keyed on `builderPid` from `pg_backend_pid()` on the builder connection | Handled |
| Wrong phase | exact string equality at trigger **and** after burst | Handled |
| Early completion between sample and DML | no observer round-trip between trigger and first write; floor guarantees margin; `buildSettled`/`buildSettledAtNs` checked | Handled |
| Phase transition during the burst | after-burst phase equality catches it — demonstrated by NC5 | Handled |
| Absent / non-advancing after-burst counters | strict `toBeGreaterThan` — demonstrated by NC1 | Handled |
| Builder error | captured in `buildError`, rethrown after evidence capture | Handled |
| Observer error | propagates; no swallow | Handled |
| Cleanup failure | `finally` rolls back and ends gates, builder, writer, observer | Handled |

One residual gap: if a trigger qualified solely via the **tuples** branch while
`blocksTotal` were null, and `after.tuplesDone` were null, both after-burst
advance checks would be skipped. Not reachable on PostgreSQL 16 for this scan
(`tuples_total = 0`, blocks always populated), and `expect(after.phase)` would
still have to hold. Recorded as an observation, not a finding.

---

## 5. Gate D — Root cause and report accuracy

**Verdict: PASS with corrections required on report wording** (F-TOOL-01,
F-TOOL-02). The causes are correctly kept separate.

### 5.1 Run `34714619941` (C, head `e5af0494…`) — assertion **and** budget

Independently verified from the job record and the full 308,221-line
downloaded log of Heavy job `103609595251`:

- Classify `103609574612` **SUCCESS**.
- Heavy started `22:19:23Z`, completed `23:29:45Z`, conclusion **cancelled**;
  job wall **70m12s** — consistent with `timeout-minutes: 70`.
- Step 142 `Migration and tenant-backfill tests` started `23:12:56Z`, cancelled
  `23:29:36Z` — still running at cancel.
- CI Gate `103638944625` **failure**.
- Separate F-F03 assertion at `2026-09-12T23:15:25.5992637Z`:
  `× … DML overlaps active build-scan and validation-scan phases (F-F03), 3
  iterations 8092ms` / `→ expected true to be false // Object.is equality`,
  file summary `13 tests | 1 failed`.
- Iteration 1 evidence was emitted at `23:15:23.1036604Z` with
  `buildDurationMs: 184.368583`, both scan phases and `valid_exact`; **no**
  iteration 2 or 3 evidence. The failure is therefore in iteration 2+.

Both causes are real and distinct, and the cancellation does not retract the
assertion failure. That part of the report is accurate.

### 5.2 The "old line 811" attribution is **inference, not executed fact**

This was checked directly, as required.

- The downloaded Heavy log contains **zero** occurrences of
  `indexes.migration.test.ts:<line>` — grep for
  `indexes\.migration\.test\.ts:[0-9]+` returns **0**. There is no code frame
  and no stack for the failing test; the run was cancelled before Vitest
  printed its final failure block, leaving only the compact one-line message.
- Within the failing F-F03 test (base lines 625–950) there are exactly **two**
  `toBe(false)` assertions, and both are `expect(buildSettled).toBe(false)`:
  base line **807** (before `await writer.query`) and base line **811** (after
  it).

So *"a `buildSettled` assertion failed"* **is** established by elimination.
*"Line 811 specifically"* is **not** established by the logs.

The report's stated reasoning — "Combined with iter-1 success, the demonstrated
failure is line **811**" — does not hold. Iteration-1 success does not exclude
line 807, because in the base harness:

```
847  const buildLocks = await grantedTargetLocks();   // ← await: buildSettled may flip here
848-850  (synchronous lock assertions)
851  await timedWritesDuringPhase(...)
806  for (const {op, sql} of ops) {
807    expect(buildSettled).toBe(false);              // ← first op reached with no intervening await
```

For the *first* op of a phase burst there **is** an await (line 847) between
the phase observation and line 807, so `buildSettled` can legitimately be true
at 807. (For the second and third ops, 807 is unreachable as a first failure,
since no await separates the previous 811 from the next 807.) Both sites remain
reachable in iteration 2, and the log cannot distinguish them.

This distinction is not cosmetic. Under line 811 the build settled *during* a
write, so the write still overlapped the scan and the report's characterisation
("the Node flag is no longer a contemporaneous overlap proof") is apt. Under
line 807 the build had settled *before* any write in that phase, meaning that
phase produced **no overlap at all** — a materially different description of
what the original evidence showed.

What is *not* affected: in **both** cases the fault is the harness selecting a
trigger point too late in the scan, not a PostgreSQL, index-tooling or
migration defect; and in **both** cases the repair's remaining-work floor
eliminates it — which NC5 demonstrates empirically. The engineering conclusion
and the "not a product defect" classification therefore stand.

The cached-build element of the causal story ("cached subsequent CIC is
faster") is **plausible and consistent** with the measured data — I observed
`buildDurationMs` of only **238–326 ms** across 39 iterations, so a sub-second
CIC racing three awaited writes is entirely credible — but the CI log does not
record per-iteration timings for iterations 2–3, so this remains **inference**
rather than executed fact.

### 5.3 Run `34722422036` (B) — budget only

Heavy `103630630199` cancelled at the `timeout-minutes: 70` wall (~70m27s /
~4227 s) during step 142 `Migration and tenant-backfill tests`, with F-F03
**passing** on that job, and CI Gate `103638964261` **FAILURE** emitting
`CI Gate FAIL: full CI required but validate result is cancelled`.

This is corroborated from a second independent source — the PR #39 body records
the same job IDs, the same ~4227 s wall, the same step 142, and quotes the same
Gate failure string. The two root causes are correctly kept separate: B is
**budget-only**, with no assertion failure. I did **not** re-download this
job's raw log, and state that rather than implying I did.

### 5.4 Run `34790452855` (superseded tooling head `5ec61bd`) — preflight only

Correctly kept separate from both the timeout and the F-F03 causes: Classify
`103813562888` SUCCESS, Heavy `103813576174` FAIL at **Tenant enforcement
preflight** with
`globalFailures: ["tenant:access:inventory:check_failed_exit_1"]`, Gate FAIL.
The stated cause — new non-allowlisted files under
`scripts/tenant-indexes/tests/` plus stale line numbers — is corroborated by
the tree comparison in §3.2: `5ec61bd` did add two such files and `c4253ba`
deletes them. This is a mechanical freshness failure, not a budget or F-F03
failure. Accurate.

### 5.5 Test-count reconciliation — 13 / 20 / 55

Measured at the **subject head**:

| Measurement | Subject head `c4253ba` (measured) | Report §6.3/§6.4 text |
| --- | --- | --- |
| F-F03 filtered run | `1 passed \| 19 skipped (20)` | "1 passed / 12 skipped" |
| tenant-indexes suite | **6 files**, 55 passed / 55, 60.14 s | "**7 files**, 55 passed / 55, 44.17s" |
| `indexes.migration.test.ts` | **20 / 20** (35,576 ms) | "**13/13** (28157ms)" *and* "20/20 in that file" |

Per-file breakdown measured at the subject head (`20 + 16 + 3 + 5 + 7 + 4 = 55`):

```
✓ indexes.migration.test.ts      (20 tests) 35576ms
✓ drift-redaction.unit.test.ts   (16 tests)
✓ schema-drift.migration.test.ts  (3 tests) 22309ms
✓ maintenance-url.unit.test.ts    (5 tests)
✓ classify.unit.test.ts           (7 tests)
✓ timeouts.unit.test.ts           (4 tests)
Test Files 6 passed (6) | Tests 55 passed (55)
```

The **55 total is correct** — the 7 helper tests moved into the file rather
than being added, so the total is invariant across the inline. But "12 skipped",
"7 files" and "13/13" are the **superseded head `5ec61bd`** shapes (where the
file had 13 tests and a separate 7-test helper file existed), presented in §6.3
and §6.4 as this head's repaired-run evidence. §6.4 is additionally
self-contradictory, asserting both "13/13" and "20/20 in that file" for the same
run. This is precisely the "do not label old test results as current-head
execution" concern. Recorded as **F-TOOL-02**.

---

## 6. Gate E — Regressions executed at the subject head

All commands run from `stocky-plus/` at `c4253ba`, isolated PostgreSQL 16.13,
no Shopify, no production, no merchant data.

| Gate | Command | Exit | Result |
| --- | --- | --- | --- |
| Full tenant-indexes suite | `npm run test:migrations -- scripts/tenant-indexes/tests` | 0 | **6 files, 55/55**, 60.14 s |
| F-F03 helper unit tests | `… -t "F-F03 active-scan overlap helper"` | 0 | **7 passed / 13 skipped (20)** |
| F-F03 overlap | `… -t "DML overlaps active build-scan and validation-scan phases"` | 0 | 12 passing runs, 36 iterations (§4.4) |
| Helper negatives | NC1–NC5 mutations | 1 (each) | All five fail as required (§4.5) |
| Classifier self-test | `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | **40/40** |
| Access audit | `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok` |
| Access inventory freshness | `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| Enforcement inventory freshness | `npm run tenant:enforcement:inventory:check` | 0 | `tenant_enforcement_inventory_fresh` |
| Lint | `npm run lint` | 0 | clean |
| Typecheck | `npm run typecheck` | 0 | clean |
| Build | `npm run build` | 0 | built in 801 ms |
| Unit tests (no schema artifact) | `npm test` | 1 | 387 passed, **5 failed** — all `bulk-query-schema.test.ts`, missing gitignored `admin-2026-07.schema.json` |
| GraphQL codegen | `npm run graphql-codegen` | 0 | generated `app/types/admin-2026-07.schema.json` (public, version-pinned `ApiVersion.July26`; **no store credentials**) |
| Unit tests (schema artifact present) | `npm test` | 0 | **392 passed (392)** |

The GraphQL schema gate was **executed**, not assumed: the documented
version-pinned public-schema generation path was used, after which the five
failures resolve to passes. The missing-artifact failures are **not** counted
as passes anywhere in this review. Generated artifacts are gitignored and the
working tree remained clean.

### 6.1 Environment deltas versus CI (disclosed)

- Node **v22.22.2** locally vs **22.19.0** in CI (npm matched at 11.5.2).
- PostgreSQL **16.13** (Ubuntu) locally vs `postgres:16-alpine` in CI.
- 4 CPUs locally; no Redis-dependent gate was part of this review's scope.

Neither delta affects the lock-mode, phase-text or progress-counter semantics
that the F-F03 proof depends on, but they are recorded rather than glossed.

---

## 7. Exact-head CI

Run **`34790950894`**, event `pull_request`, head
`c4253ba82d24178f9a9d9c9d8c5fb89f569a0152`, attempt 1.

Independently re-verified at finalization time: `origin/tooling/pr6-bc-ci-reliability`
is still `c4253ba82d24178f9a9d9c9d8c5fb89f569a0152` and `origin/main` is still
`bdbb5bba91ac8af82e49a99e36cce5db8b401c68`. **The reviewed subject has not
changed.** Run status re-read directly from the GitHub API: `status=completed`,
`conclusion=success`.

### 7.1 Required job identities — all three independently confirmed

| Job | ID | Required | Observed | Evidence |
| --- | --- | --- | --- | --- |
| Classify change set | `103814938318` | SUCCESS | **SUCCESS** | `23:52:49Z`–`23:52:56Z`; classification self-test + classify steps both success |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `103814957031` | **full** SUCCESS, not SKIPPED | **SUCCESS (full)** | `23:52:58Z`–`00:52:38Z`, ~**59m40s**; all numbered steps 1–146 ran, including step 142 and Build |
| CI Gate | `103823653840` | SUCCESS | **SUCCESS** | see gate log below |

The Heavy job was **executed, not skipped** — verified by the presence of the
`npm run test:migrations` and `npm run build` step groups and their output in
the downloaded job log, not merely by the job's conclusion field.

CI Gate log, read directly:

```
classify_result=success
validate_result=success
full_ci=true
docs_only=false
CI Gate SUCCESS: full validate succeeded
```

This is the `full_ci=true` → `validate == success` branch — the same branch that
correctly emitted `CI Gate FAIL: full CI required but validate result is
cancelled` on runs `34714619941` and `34722422036`. The Gate's fail-closed
logic is therefore confirmed on **both** polarities against live runs.

### 7.2 Step-142 evidence — the repaired F-F03 and the inlined tests really ran

Extracted by me from the downloaded Heavy job log (73 MB / 631,200 lines), not
taken from any summary:

- `scripts/tenant-indexes/tests/indexes.migration.test.ts` **20 tests**, 37,051 ms.
  **This is the decisive discovery proof at the exact head:** the file reports
  **20**, not 13, so the seven inlined helper tests genuinely executed in CI.
- Exactly **three** `tenant_index_active_phase_write_evidence` events
  (iterations 1, 2, 3), each `"rowCount":400000` and `"writeThresholdMs":15000`
  — iteration count, fixture size and latency bound all unchanged.
- `phasesSeen` contains all eight CIC phases including both writer-wait gates
  and both scan phases.
- Trigger → after-burst `blocks_done` advance, per iteration, both phases,
  all against `blocksTotal 5324`, `schema=public`, `relid=545294`:

| Iter | CIC duration | Build scan | Validation scan |
| --- | --- | --- | --- |
| 1 | 252.105986 ms | 155 → **970** | 253 → **1009** |
| 2 | 237.961417 ms | 138 → **809** | 170 → **1085** |
| 3 | 260.991010 ms | 223 → **833** | 131 → **884** |

- `"lockModes":["ShareUpdateExclusiveLock"]` on every sample.
  **`AccessExclusiveLock` appears in the log only inside the RR test's *name*
  string; it occurs zero times inside any `lockModes` array** (verified by a
  targeted grep rather than a bare substring count).
- `indexVerification: valid_exact` ×13 (3 F-F03 + 10 RR).
- RR old-snapshot proof intact and separate: **10** `"waitingForOlderSnapshots":true`.
- Compact `expected true to be false` count: **0**. `##[error]` / `FAIL` count
  across the whole Heavy job: **0**. Job not cancelled.
- Aggregate `npm run test:migrations`: **60 files / 474 tests passed**,
  1,087.54 s, started `00:33:40Z`.
- CI Node is **v22.19.0** (vs my local v22.22.2) — the delta disclosed in §6.1.

The CI-measured CIC durations (238–261 ms) sit inside the band I measured
locally (238–326 ms). This independently corroborates the sub-second-CIC
premise underlying the original race, on the real runner.

### 7.3 Honest qualification on the timeout

**This Heavy run finished in ~59m40s — under even the old 70-minute cap.** The
120-minute budget is therefore *not* the reason this particular run succeeded,
and this run is not by itself proof that 120 was required. What justifies the
increase remains the two observed overruns (~70m22s on `34714619941`, ~70m27s
on `34722422036`) against a ~60–61 min successful band: 70 left effectively no
headroom, and both B and C were cut mid-`test:migrations` as a result. The cap
is a bounded cancellation guard, not evidence about F-F03 and not an SLA.

---

## 8. Findings

No **P0**, **P1** or **P2** findings. Four **P3** findings, each with an
explicit disposition.

### F-TOOL-01 — P3 — "old line 811" stated as demonstrated fact

- **File/line:** `stocky-plus/docs/phases/phase-1/PR6_BC_CI_RELIABILITY_REPORT.md`
  §3.1 ("the demonstrated failure is line **811**") and §5.1 point 3.
- **Evidence:** the Heavy `103609595251` log contains no
  `indexes.migration.test.ts:<line>` reference at all (grep count 0); only the
  compact `expected true to be false` is recorded. Base lines 807 and 811 are
  both `expect(buildSettled).toBe(false)` and both are reachable in iteration 2
  (§5.2).
- **Merchant impact:** none. Impact is to the accuracy of the historical
  root-cause record.
- **Reproduction:** download Heavy job `103609595251` log; grep for
  `indexes\.migration\.test\.ts:[0-9]+` → 0 matches; grep
  `expected true to be false` → 1 match with no frame.
- **Expected behaviour:** state the attribution as inference — "a
  `buildSettled` assertion at base line 807 or 811" — or state 811 as the
  likely site while marking it inferred.
- **Recommended correction:** additive amendment to the report (the existing
  immutable text must not be rewritten in place).
- **Missing test:** none. NC5 already demonstrates the repair covers both sites.
- **Disposition:** Non-blocking. The classification "test-harness observation
  race, not an index/migration product defect" is correct for **both** candidate
  sites, and the repair provably eliminates both. Correction is a wording
  accuracy matter, not an engineering defect.

### F-TOOL-02 — P3 — superseded-head test shapes presented as this head's evidence

- **File/line:** same report, §6.3 table ("1 passed / 12 skipped") and §6.4
  ("7 files, 55 passed / 55", "`indexes.migration.test.ts` **13/13**
  (28157ms)").
- **Evidence:** measured at `c4253ba` — `1 passed | 19 skipped (20)`; **6**
  files; that file is **20/20**. The quoted shapes belong to parent `5ec61bd`,
  where the file had 13 tests and a separate 7-test helper file existed. §6.4
  simultaneously asserts "13/13" and "20/20 in that file".
- **Merchant impact:** none. Impact is evidence provenance.
- **Reproduction:** §5.5 and §6 of this artifact.
- **Expected behaviour:** restate §6.3/§6.4 at the subject head, or label them
  explicitly as `5ec61bd` executions.
- **Recommended correction:** additive amendment.
- **Missing test:** none.
- **Disposition:** Non-blocking. The headline **55** total is correct and I
  re-executed every one of these gates at the subject head with passing
  results, so no claimed gate is unverified — only mislabelled.

### F-TOOL-03 — P3 — vacuous assertion in the F-F03 test

- **File/line:** `stocky-plus/scripts/tenant-indexes/tests/indexes.migration.test.ts`
  — `expect(w.phaseAtWriteStart).toBe(targetPhase)` in
  `overlapWritesWithActiveScan`, and the later
  `expect(w.phaseAtWriteStart).toBe(phaseWrites.phaseAtStart)`.
- **Evidence:** `burstRepresentativeSupplierDml` assigns
  `phaseAtWriteStart: options.trigger.phase`, and `expect(trigger.phase)
  .toBe(targetPhase)` is asserted earlier in the same function. The assertion
  restates the trigger and cannot fail independently — a trigger phase copied
  into a write record is not an observation at write time.
- **Merchant impact:** none.
- **Expected behaviour:** drop it, or replace it with a value actually sampled
  at write time.
- **Recommended correction:** optional test-only cleanup; **must not** be
  counted as overlap evidence.
- **Missing test:** none required.
- **Disposition:** Non-blocking and **not** load-bearing. The real proof is the
  independent after-burst re-sample, which NC1 and NC2 prove is genuinely
  independent and genuinely fails when broken. The report's §5.2 correctly
  identifies the after-burst re-sample (not this field) as the proof, so the
  report does not over-claim here.

### F-TOOL-04 — P3 — raised Heavy budget has no duration-trend guard

- **File/line:** `.github/workflows/ci.yml:78`.
- **Evidence:** successful Heavy runs are ~60–61 min; the cap moves 70 → 120,
  roughly doubling headroom. Nothing in the workflow alerts on Heavy duration
  growth, so a future ~2× slowdown would be absorbed silently instead of
  surfacing.
- **Merchant impact:** none directly; CI feedback-latency and cost risk.
- **Expected behaviour:** a duration budget/trend check, or a periodic review of
  the cap.
- **Recommended correction:** none within this PR's authorized scope.
- **Missing test:** none.
- **Disposition:** Accepted for this PR. The change is the minimum that stops a
  budget cancel from masquerading as suite completion, the report already caps
  further increases ("do not increase beyond 120 without another decision"), and
  widening this PR to add trend guards would exceed its authorized scope.

---

## 9. Conclusions on the two objective questions

**Does this change safely resolve the shared CI-budget problem?** Yes, within
what a timeout change can do. The diff is a single scalar with every command,
trigger, permission, classification rule and Gate condition verified unchanged;
the Gate remains fail-closed against cancelled and failed Heavy, confirmed both
in source and against run `34714619941`. Nothing was skipped, sharded, retried
or made `continue-on-error`. The 70-minute cap demonstrably cut both B and C
mid-`test:migrations` at ~70m12s and ~70m27s against a ~60–61 min successful
band; 120 restores headroom without weakening any gate.

**Does it provide adequate F-F03 active-scan concurrency evidence?** Yes, and
the repaired harness is **stricter** than the original, not weaker. The original
proved overlap only through a Node-side boolean sampled after a phase-text
match; the repair requires PostgreSQL-side remaining-work at the trigger, takes
no observer round-trip before the first write, and then demands an independent
after-burst sample in the same phase with strictly advancing `blocks_done` and
locks still held. I reproduced 36 iterations across ordinary and contended
scheduling with zero subject-attributable failures, and five negative controls
confirm the load-bearing assertions genuinely fail when broken — including NC5,
which reproduces the original defect class on demand.

The timeout increase is **not** treated as evidence that F-F03 is repaired; the
overlap evidence and negative controls are.

---

## 10. Scope statement

This review does **not**:

- accept PR6-B or PR6-C product work, or authorize merge, mark-ready or
  cherry-pick into PR #39 / PR #40;
- close **R-176** (OPEN/P0), authorize PR6-D, or authorize production;
- perform or dispose C's separate F-CR-01 / P3 corrections;
- create D-055 — **D-054 remains EFFECTIVE**;
- borrow, merge or substitute any PR #41 implementation or CI evidence.

No PR42, PR41, PR39, PR40 or `main` content was edited. No existing review was
modified. No runtime, schema, migration, role, flag or CI implementation change
was made by this reviewer. No store or production access occurred.

---

## 11. Verdict

### 11.1 Severity counts

| Severity | Count | Unresolved |
| --- | --- | --- |
| P0 | 0 | 0 |
| P1 | 0 | 0 |
| P2 | 0 | 0 |
| P3 | 4 | 0 — all four explicitly dispositioned (§8) |

### 11.2 Approval conditions

| Condition | Status |
| --- | --- |
| No unresolved P0/P1/P2 | ✅ met |
| Every P3 explicitly dispositioned | ✅ met (F-TOOL-01…04) |
| Exact-head `pull_request` Classify SUCCESS | ✅ `103814938318` |
| Exact-head **full** Heavy SUCCESS, not SKIPPED | ✅ `103814957031`, all steps 1–146 executed |
| Exact-head CI Gate SUCCESS | ✅ `103823653840` |
| Repaired F-F03 proven to have executed at the exact head | ✅ 20/20 in file; 3 iterations; both scan phases; advancing counters |
| Subject unchanged since review start | ✅ still `c4253ba8…` |

### 11.3 What successful CI does and does not settle

Successful CI confirms the four-file change executes cleanly at the exact head
and that the repaired F-F03 and the seven inlined tests genuinely ran there. It
does **not** retroactively validate the report's unsupported exact-line causal
attribution (**F-TOOL-01**) or its superseded-head test counts
(**F-TOOL-02**); those remain open documentation corrections to be made
**additively**. Green CI is also not evidence that the 120-minute cap was
necessary — this run finished in ~59m40s (§7.3).

### 11.4 Evidence status summary

| Claim | Status |
| --- | --- |
| Workflow diff is one line, gates unchanged, Gate fail-closed | **Demonstrated fact** (source + both live polarities) |
| Inventory mechanical, no new exception, allowlist untouched | **Demonstrated fact** (byte-identical regenerate) |
| 20 tests discovered; 7 helper tests execute | **Demonstrated fact** (local *and* exact-head CI) |
| Real INSERT/UPDATE/DELETE overlap in both active scan phases | **Demonstrated fact** (39 local iterations + 3 exact-head CI iterations, advancing `blocks_done`) |
| Load-bearing assertions can fail | **Demonstrated fact** (NC1–NC5) |
| Original failure was *a* `buildSettled` assertion | **Demonstrated fact** (by elimination — only two such sites) |
| Original failure was specifically old line **811** rather than 807 | **Inference, not proven** (F-TOOL-01) |
| Cached/faster subsequent CIC as the mechanism | **Inference**, consistent with measured 238–326 ms locally and 238–261 ms in CI |
| Report §6.3/§6.4 counts ("12 skipped", "7 files", "13/13") | **Historical / superseded-head**, not current-head (F-TOOL-02) |
| Current-head counts (19 skipped, 6 files, 20/20, 55/55) | **Demonstrated fact** (re-executed by me) |
| B run `34722422036` budget-only | Verified from job record + PR #39 body; **raw log not re-downloaded** |
| Report's `34642536795` / `34726234237` baseline timings | **Reported, not re-verified** by me |

### 11.5 Limitations of this review

- Node **v22.22.2** locally vs **v22.19.0** in CI; PostgreSQL **16.13** (Ubuntu)
  locally vs `postgres:16-alpine` in CI.
- One reviewer-environment failure (runD) is disclosed in §4.4 and excluded from
  flake accounting with its PostgreSQL PANIC quoted.
- I did not re-download the raw log for B run `34722422036`, and did not
  re-verify the report's baseline-timing table.
- No production, merchant-database, or Shopify access occurred. The GraphQL
  schema gate was executed using the public version-pinned codegen path with
  **no store credentials**.

---

## APPROVE PR6 B/C CI RELIABILITY

Scope of this approval: the **four-file shared tooling change** at
`c4253ba82d24178f9a9d9c9d8c5fb89f569a0152` only — the Heavy `timeout-minutes`
70 → 120 change, the F-F03 harness repair, the mechanical PR2 inventory
regeneration, and the implementation report.

The change safely resolves the shared CI-budget problem without weakening any
gate, and the repaired F-F03 harness provides **stronger** active-scan
concurrency evidence than the version it replaces — verified by 39 local
iterations across ordinary and contended scheduling, five negative controls
that fail as required, and three iterations executed at the exact head under
successful full CI.

Conditions attached:

1. **F-TOOL-01** and **F-TOOL-02** should be corrected **additively** in a
   follow-up — the published report must not be rewritten in place. Neither
   blocks this tooling approval.
2. **F-TOOL-03** (vacuous `phaseAtWriteStart` assertion) must never be cited as
   overlap evidence; optional test-only cleanup.
3. **F-TOOL-04** is accepted as-is; do not raise the Heavy cap beyond 120
   without a separate decision.

This approval is **tooling acceptance only**. It is **not** ChatGPT technical
acceptance and **not** merge authorization — both remain separate and
outstanding. It does not accept PR6-B or PR6-C, authorize mark-ready, merge,
or integration into PR #39 / PR #40, close **R-176** (OPEN/P0), dispose C's
separate F-CR-01/P3 corrections or the combined-tree overlay safety concern,
authorize PR6-D, production, scopes or flag enablement, or create D-055.
**D-054 remains EFFECTIVE.** PR #41 remains parked and unmerged.
