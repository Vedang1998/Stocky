# PR6-D — final control and integration correction: independent review

## 0. Verdict

**CORRECTIONS REQUIRED**

One unresolved **P2** (NEW-SCQ-01, reservation-ledger evidence loss re-grants committed
capacity) plus three P3 dispositions. SC-R-01, SC-R-03, SC-R-04 and SC-R-06 are
**independently confirmed resolved**. PR43-CI-CLEANUP-01 and PR43-CI-INDEX-01 are
**independently confirmed resolved**. Mandatory changed-path evidence, including an
independently executed million-line envelope on the current runtime, is **complete**;
nothing is blocked for want of evidence.

Not technical acceptance, mark-ready, merge, PR6 closure, Phase 1 closure or production
authorization.

## 1. Assignment, provenance and continuity

| Field | Value |
|---|---|
| Tool | Claude Code (Anthropic CLI), remote execution container, independent of Cursor's implementation environment |
| Session | `https://claude.ai/code/session_01PDAFNDbmMZdKAra461t988` |
| Configured model | `claude-opus-5` |
| Chat continuity | Same chat that authored `ec61089dcfc0530b81c64bc09fcea7f3b70b7aa5` — this is a continuation, not a duplicate review |
| Authority | PR43 comment 5737374141 |
| Review branch | `claude/pr43-final-control-integration-review`, rooted exactly at S |

No existing `claude/pr43-final-control-integration-review` branch was present; this is the
first publication of this review. No credentials or private environment values appear
here. Figures marked *executed* were produced by this session on the machine in §7.1;
figures marked *reported* are Cursor's claims.

## 2. Identity, scope and preservation (verified)

| Check | Result |
|---|---|
| Subject S | `dab5accc4cd949bdaf1078fe6240fc602ba1629b` — verified tip of `origin/phase-1/pr6-d-order-webhook-import` |
| Base V | `a3ff480f1477237f8055f10c43298480a05728a1` — verified `origin/main` HEAD **and** the merge base of S |
| V ancestor of S | yes |
| PR #43 | OPEN / **DRAFT** / UNMERGED |
| Scope S vs V | **89 changed paths** — verified, not forced |
| H → S | **9 commits / 30 changed paths** — matches the mandate exactly |
| Competing writer / later push | none; S is still the live head at review close |

Correction sub-deltas, each verified against the mandate's claim:

| Sub-delta | Expected | Observed |
|---|---|---|
| INDEX-01 `2084aeb…` → S | 3 commits; index test + D report + PR2 inventory | **exactly that** |
| CLEANUP-01 `62f7a06…` → `2084aeb…` | two overlay files + D report | **exactly that** |
| `b2471676…` → S | no later D application/scale-harness change | **confirmed** — only docs plus the two fixture harnesses |

The last row is load-bearing: **D application code and the D scale harness are frozen at
`b2471676`**, which is what licenses the equivalence rationale in §7.

Four retained D review blobs at S — all byte-identical, none rewritten:

| Artifact | Expected blob | Observed |
|---|---|---|
| complete integration | `48ac291a781b2347cb6017af862f2de9677826a5` | **match** |
| first correction | `ba82a3c981cda4bec52ea453c2618319288fa66c` | **match** |
| source contract | `1eb18cae44cdf7a6660256e2632ebc8019d6da0d` | **match** |
| final SC-recovery (`ec61089`) | `e8525c2fd2778c8baf118d0008a9213b7af4eca8` | **match** |

The earlier source-contract provenance qualification (Git author/committer and publishing
app recorded as Cursor) is **preserved unchanged**; it remains a provenance limitation,
not a refutation, and no artifact was amended.

Prohibited-surface scan versus V — clean:

- accepted A/B/C application internals (`order-facts/admin-read/`, `order-facts/apply/`, `catalog-facts/`): **zero** changed files;
- `prisma/`, migrations, grants/RLS: **zero**;
- `.github/` workflows and CI configuration: **zero**;
- `package.json` / `package-lock.json` / vitest / eslint / tsconfig: **zero**;
- production index helpers under `scripts/tenant-indexes/`: **only** `tests/indexes.migration.test.ts`, which is the authorized INDEX-01 scope exception;
- `shopify.app.toml`: **unchanged since H**; API version `2026-07` and the scope string untouched;
- no PR7/PR45/PR46 path touched. PR45's planning correction is untouched and was not used as D authority.

No pre-existing immutable review artifact is modified. The only modified documents are the
two mechanical inventories, the PR6 plan (C3/SC addenda) and the phase README.

## 3. Exact-head CI — independently confirmed, not re-triggered

Read directly from the Actions API. No run triggered, no `workflow_dispatch`, no rerun.

| Item | Observed |
|---|---|
| Run `35400320443` | event `pull_request`, **attempt 1**, head S, **SUCCESS** |
| Classify `105778489865` | **SUCCESS** |
| Heavy `105778526582` | **SUCCESS**, **150 executed steps** (146 at H), ~64 min — not skipped |
| Gate `105792459915` | **SUCCESS** |

Raw-log reconciliation of the mandate's figures, from the `npm run test:migrations` step
(1260.59 s):

- **72 files / 724 passed / 2 skipped** — confirmed verbatim in the log;
- the **2 skips are exactly the two opt-in envelopes** (`pr6-d-scale-envelope` 1 skipped, `pr6-c-scale-envelope` 1 skipped). These are intentional opt-in skips, **not** unexecuted jobs, and no opted-out envelope is claimed as executed in CI;
- **index `indexes.migration.test.ts`: 27 tests passed** (40,129 ms) — matches the mandate's "index 27";
- **overlay `pr6-c-b-pin-overlay.safety.test.ts`: 26 tests passed** (3,870 ms) — matches "overlay 26";
- D suites executed: integration **24**, sc-recovery **20**, worker **12**, correction **15**.

## 4. SC-R findings — independent re-adjudication

Original IDs and severities retained; Cursor's closure labels were not adopted.

### SC-R-01 (P2) — aggregate parent transport allowance → **RESOLVED**

Transport counted at the outermost client boundary, invisible to production counters,
driven through the real `runOrderFactsImportStep`.

*Full attribution.* One drifted parent: boundary total **5** = `runTransportAttempts` **1**
+ `parentTransportAttempts` **4**; by operation `{scopes: 2, ledger: 1, shop: 1,
OrderFactById: 1}`. `fallbackOrders` **1**, `fallbackTransportAttempts` **3**. At H the
same shape reported 7 boundary calls as 2; nothing now escapes accounting, and the
fallback carries a real transport count rather than the old `+1` approximation.

*One finite allowance.* Cap sweep 1…12 with a forced drift fallback:

| cap | 1 | 2 | 3 | 4 | 5–12 |
|---|---|---|---|---|---|
| status | PARTIAL_FAILURE | PARTIAL_FAILURE | PARTIAL_FAILURE | **SUCCEEDED** | SUCCEEDED |
| parent attempts | — | — | — | **4** | 4 |

Exact-boundary success at 4, one-short refusal at 3, and `parentTransportAttempts ≤ cap`
with `run + parent == boundary` in every success. **Exhaustion never certified a complete
candidate.**

*Nested readers cannot renew the allowance.* Nested `readRefundFact` now receives the
250 default rather than `remaining`, which I probed directly at the ledger boundary with
4 refunds: caps 1–5 → `incomplete` with boundary exactly equal to cap; cap 6 (initial +
4 refunds + recheck) → `complete` with boundary 6; caps 8 and 10 → still 6. The D wrapper,
not the nested budget, is the binding constraint.

*Throttle and transport errors.* A throttled first response consumed an attempt and the
walk stayed within cap 3, returning `incomplete`.

### SC-R-06 (P3) — throw-only negative control → **RESOLVED**

Disabling **only** `consumeDTransportAttempt`'s exhaustion throw, leaving counting intact:

| level | guard on | guard off |
|---|---|---|
| import, cap 2 | PARTIAL_FAILURE, boundary 3 | **SUCCEEDED**, parent attempts **4 > cap** |
| nested ledger, cap 3 | `incomplete`, boundary 3 | **`complete`, boundary 6 — double the cap** |

The outer hard stop is load-bearing at both levels, and disabling it does not merely
overspend: it **certifies a complete candidate the guard would have refused**. The guard
was restored in both cases and the tree left pristine.

### SC-R-02 (P2) — atomic scratch reservation → **PARTIALLY RESOLVED**

*What is fixed.* Admission is now serialized by an exclusive `mkdir` lock over a
persistent reservation ledger, and each attempt is bounded by its **own** `reservedBytes`
(enforced incrementally and by tree measurement) rather than a stale namespace snapshot.
Real two-process control: a live holder reserving 33,554,432 of a 41,943,040 cap caused a
second same-size admission to be **refused** (`D scratch quota 33554432+33554432+65536
exceeds 41943040`) while a 2 MiB admission succeeded; the ledger held 2 rows summing
35,651,584 ≤ cap. The H-era routine over-commit is gone.

*What is not.* See NEW-SCQ-01 below.

### SC-R-03 (P2) — occupancy truth, health and operator recovery → **RESOLVED**

Occupancy now has real production callers — `control-plane.ts` (normal coverage-health
path) and `import.ts` `failImport` (typed `order_facts_scratch_resource` DataIssue with
sanitized occupancy) — resolving the H finding that the inspector had none.
`computeSyncHealth` degrades to `DEGRADED` on `operatorInterventionRequired` and, by
construction, cannot override `DISABLED`/`FAILED`/`RUNNING` nor clear a worse state.

Executed lifecycle: a live under-cap writer alone → `intervention: false` (no false
alarm); an abandoned attempt → `leftover 2, unknown 1, intervention: true` (no false
HEALTHY over leftovers); reclaim without quiescence → **refused** (`scratch_unowned`);
authorized reclaim removed only the named orphan; after dispose `observedBytes: 0`.

Reclaim safety matrix, all protected resources byte-intact:

| target | outcome |
|---|---|
| live owned writer | `live_writer` (skipped) |
| markerless dir | `not_verified_d_resource` |
| foreign marker | `not_verified_d_resource` |
| symlink to outside tmpdir | `symlink_refused`; target intact |
| `plain-dir`, `../escape` | `not_an_attempt_basename` |

PID/age/TTL are not treated as authority. Cross-process liveness is delegated to the
runbook's quiescence step, which the helper enforces via a mandatory
`quiescenceConfirmed` argument — a documented, accepted division of responsibility.

### SC-R-04 (P2) — receipt epoch binding → **RESOLVED**

Every dimension the correction order named now binds, and the application key stays
stable so an incompatible epoch produces a **digest conflict** rather than silently
selecting a new key:

| mutation | digest changes | key stable |
|---|---|---|
| fence generation | **yes** | yes |
| SyncRun id | **yes** | yes |
| BulkOperation GID | **yes** | yes |
| shop, API version, query fingerprint | **yes** | yes |
| child quantity, dropped child, nulled field | **yes** | yes |
| parent key reordering | no (correct — representation-only) | yes |

Fence, SyncRun and Bulk GID were precisely the three gaps at H; all three are closed.
Missing/invalid epoch identity fails closed with `import_epoch_fields_required` in all six
probed cases (null fence, undefined fence, empty run, blank shop, non-Bulk GID, empty
query). A stored **v1** digest is detected (`true`) and a v2 digest is not misdetected as
v1 (`false`), so an old epoch cannot certify a v2 apply.

### SC-R-05, SC-R-07 — accepted P3 limitations, scope unchanged

SC-R-05 (final recheck verifies refund but not agreement membership) and SC-R-07
(`importParentContentDigest` order-instability for id-less children, unreachable because
staging fails closed on a missing string id) are **unchanged in scope** by this package
and remain explicitly accepted P3 limitations. No regression touches either.

### SC-R-08 — remains unattributed

The vendor added `SC-R-08 confirmatory: SIGKILL during staging leaves bytes and does not
complete the killed attempt`. It is correctly framed as **confirmatory** and is not
presented as fixing an unproved bug. My H-era observation remains unattributed; I did not
re-reproduce it and do not convert it into a finding.

## 5. NEW-SCQ-01 (P2) — reservation-ledger evidence loss re-grants committed capacity

**File:** `app/lib/order-facts/sync/scratch-quota.ts` — `loadDScratchReservations` (lines
85–128), `saveDScratchReservations` (130–142); admission at
`app/lib/order-facts/sync/source-stage.ts:471–484`.

**Evidence (executed).** A real child process was admitted holding a reservation of
33,554,432 bytes against a 41,943,040 cap, having written only 4,096 bytes and remaining
alive and entitled to grow. The reservation file was then damaged four ways. In **all
four** cases the ledger silently collapsed from 1 row to 0 and a second admission for the
same 33,554,432 bytes was **granted**:

| mode | ledger rows before → after | second admission | total reserved across live writers | over cap |
|---|---|---|---|---|
| corrupt JSON | 1 → 0 | **admitted** 33,554,432 | 67,108,864 | **160 %** |
| truncated file | 1 → 0 | **admitted** 33,554,432 | 67,108,864 | **160 %** |
| deleted file | 1 → 0 | **admitted** 33,554,432 | 67,108,864 | **160 %** |
| unknown version | 1 → 0 | **admitted** 33,554,432 | 67,108,864 | **160 %** |

**Reachability.** `saveDScratchReservations` writes directly to the live path with no
temp-file + rename and no fsync, and the whole ledger is rewritten on **every** admission
and **every** release. A crash or ENOSPC at any point in that recurring window leaves
exactly the truncated state probed above — the same class of ungraceful loss SC-R-02
exists to survive. The module already contemplates crash points (`maybeCrash("after-lock")`,
`maybeCrash("after-reservation")`), but none covers a crash *inside* the save.

**Why the existing signal does not save it.** The condition is detected —
`unknownAttemptCount: 1` and `operatorInterventionRequired: true` in every case — but
`createOwnedScratchDir` decides admission solely from `stats.occupied` and never consults
either field. Detection without enforcement.

**Merchant impact.** Concurrent writers can jointly exceed the declared namespace byte
cap (2 GiB in production) after a single interrupted ledger write, exhausting worker disk
on a shared host. Bounded, not unlimited: the live writer's *measured* bytes still count,
so the loss is (reserved − written), and each attempt remains individually capped by its
own reservation.

**Expected.** Correction order SC-R-02: "Every admitted writer's future allocation must
remain covered until files are closed/removed or authorized reclamation."

**Recommended correction (not implemented here).** Persist the ledger atomically
(temp file + `rename`, with fsync), and/or refuse admission while
`unknownAttemptCount > 0` until operator reclamation, rather than proceeding on
`occupied` alone.

**Missing test.** Admission against a corrupted, truncated, missing or wrong-version
reservation ledger while a live writer holds an unconsumed reservation. The vendor suite
covers crash-*after*-reservation (`crash after reservation still occupies capacity until
operator reclaim`) but not loss of the reservation evidence itself.

## 6. Inherited fixture corrections

### PR43-CI-CLEANUP-01 → **RESOLVED**

26/26 overlay safety tests pass locally and in CI. Removal is restricted to
**registered** roots (a filename prefix is explicitly not ownership), excluded from
`APP_ROOT`/`REPO_ROOT`, contained within tmpdir, symlink-refused along the whole parent
walk, bounded to 4 attempts over a closed transient-code set, final-absence checked after
each attempt and after the budget, and persistent/unexpected errors are raised, not
swallowed. Every registered root is attempted and multiple failures aggregate. Git
auto-maintenance suppression is **per invocation** and is applied only to disposable
fixture repos — live `REPO_ROOT` invocations receive unmodified args. No global/system Git
config, no unrelated process kill, and the single `readdirSync(os.tmpdir())` is a
read-only leak assertion, not a sweep.

Reviewer mutation controls (each reverted, tree left pristine):

| guard removed | vendor suite response |
|---|---|
| registered-root ownership check | `refuses an unowned path even when the filename prefix matches` **fails** |
| transient-error classification | `propagates unexpected removal errors without retrying` **fails** |
| final-absence verification | **3 tests fail**, incl. persistent-ENOTEMPTY and all-roots-reported |

The historical ENOTEMPTY and its truthful non-reproduction are preserved; preventive
maintenance settings are not claimed as proven causation.

### PR43-CI-INDEX-01 → **RESOLVED**

27/27 index tests pass locally (25.8 s) and in CI (40.1 s). I adjudicated the two
historical failures separately from raw job `105572298557` / run `35336443725`:

1. **Phase transition** — `expected 'building index: loading tuples in tree' to be 'building index: scanning table'`: the old harness asserted an exact phase label at a sampled instant and lost the race against the builder's own progression.
2. **40P01 lock graph** — `verify fails when indexes were dropped after apply` deadlocked: one process waiting on `AccessExclusiveLock`, blocked by a process waiting on a `ShareLock` on its virtual transaction, i.e. a still-running owned CIC builder not settled before the following dropped-index test.

Against the **current harness**, not its report: failure 1 is addressed by
`isActiveScanSample`, which requires the target phase **and** `ShareUpdateExclusiveLock`
without `AccessExclusiveLock` **and** `CREATE INDEX CONCURRENTLY` still being the builder
query **and** remaining scan work above a 10 % floor — phase-text-only samples are
explicitly rejected. Failure 2 is addressed by owned-builder cleanup that cancels with a
targeted `pg_cancel_backend` on the owned PID only (never blanket termination), rolls back
owned gates, awaits the build promise under a bounded deadline, and records
`builder_inflight` rather than passing silently.

On the mandate's sharpest question — whether intersecting client timing intervals prove
database-phase overlap: `sampleIntersectsWindow` alone would not, and it is never
sufficient. A sample counts only if it also carries independent server-side state
(`pg_stat_progress_create_index` phase, granted lock modes, live builder query, remaining
work). A copied pre-write trigger label is a named hard failure
(`copied_trigger_phase_is_not_independent_overlap`), as are `no_independent_in_window_sample`,
`wrong_or_finished_phase`, `blocked_or_nonconcurrent_write`,
`access_exclusive_during_write_window` and `missing_representative_dml`.

Reviewer mutation controls (each reverted, tree left pristine):

| guard removed | vendor suite response |
|---|---|
| lock + CIC + remaining-work qualification (accept phase text only) | **5 tests fail**, incl. `rejects phase-text-only samples with no remaining-work counters` and `rejects a completed scan that still carries the phase text` |
| copied-trigger rejection | `fails overlap proof when the after-burst phase is later and no in-window scan was observed (CI 35336443725)` **fails** |
| blocked/nonconcurrent write duration guard | `fails overlap proof for blocked writes, AccessExclusiveLock, and omitted progress` **fails** |

**Accepted methodological limitation (recorded, not a finding).** The time correlation is
client-side (`process.hrtime` brackets around the observer round trip and the write).
PostgreSQL exposes no server-timestamped write/scan simultaneity, so the proof is "the
database reported an unfinished concurrent build scan, holding the right lock, during an
interval overlapping the write's in-flight interval" — not server-side simultaneity. Given
the qualification gates above, an RPC-only or label-only pass is impossible, and this is
the strongest practical evidence available.

## 7. Scale, reuse and measurement

### 7.1 Environment

Node `v22.22.2`, npm `11.5.2` (pinned as CI does), Linux x86_64, 4 CPUs,
16,877,547,520 bytes RAM, PostgreSQL **16.13**, Redis reachable. Prerequisites in CI
order: `npm ci` → `prisma generate` → `prisma validate` → `prisma migrate deploy` →
`graphql-codegen` → `tenant:roles:provision --apply` → `tenant:enforcement:apply --apply`
→ `sync:roles:provision --apply`.

### 7.2 Reuse rationale and what still needed proving

The `ec61089` H-era evidence — the H million-line envelope and the genuine SIGKILL /
positive-checkpoint / reversed-source recovery — **remains established for H** and is not
relabelled missing, nor are its measurements presented as S results.

H → `b2471676` changed the quota, request-enforcement and epoch-binding paths, so H counts
alone cannot prove them; `b2471676` → S changed **no** D application or scale-harness code
(§2), so S-runtime scale behaviour is identical to `b2471676`. I therefore ran the small
adversarial boundaries first (§4), then executed the envelope independently rather than
reusing Cursor's, because the changed controls are exactly what it now measures.

### 7.3 Independently executed million-line envelope on the S runtime

`PR6_D_SCALE_1E6=1` → **exit 0, 4/4 passed, 2059.25 s**.

| Metric | Cursor (reported, `b2471676`) | **Executed here (S)** | |
|---|---|---|---|
| `lineFactsA` / live / absent | 1,000,000 / — / — | **1,000,000 / 1,000,000 / 0** | match |
| `zeroCurrentLineFactsA` | 200,000 | **200,000** | match |
| `plannedRoots`, `applied`, `examined` | 5,192 | **5,192** | match |
| `bulkDirectApplies` | 5,190 | **5,190** | match |
| `verifiedReplayApplies` / `followUpReads` | 1 / 1 | **1 / 1** | match |
| `crashCheckpointOrdinal` | 201 | **201** | match |
| **`runTransportAttempts`** | 2 | **2** | match |
| **`parentTransportAttempts`** | 10,391 | **10,391** | match |
| **`fallbackOrders`** | 1 | **1** | match |
| **`fallbackTransportAttempts`** | 3 | **3** | match |
| `graphqlCalls` | 10,393 | **10,393** | reconciles |
| `merchantSqlCalls` | 3,258,946 | **3,258,946** | exact |
| `controlPlaneEngineRequests` | 15,664 | **15,664** | exact |
| `ledgerCounts.recheck` | 5,190 | **5,190** | match |
| `peakScratchBytes` (250 ms) | 1,509,576,295 | 1,533,515,611 | sampled |
| `peakRssBytes` (`process.memoryUsage`) | — | 397,320,192 | sampled |
| `elapsedMs` | 924,730 | 2,040,212 | slower host |

Every deterministic counter reproduces **exactly**, including the four new attribution
counters that are the substance of the SC-R-01 repair:
`runTransportAttempts 2 + parentTransportAttempts 10,391 = graphqlCalls 10,393`, and
`fallbackTransportAttempts 3` — a real per-order transport count, not a single-request
approximation. Only sampled peaks and wall time differ, as expected.

`interruptKind` still honestly declares the scale interruption to be an injected Admin
throw plus test-operator scratch deletion, **not** ungraceful process death. That
classification is accurate. Genuine process loss remains established by the `ec61089`
SIGKILL schedule at H and, for the scratch layer at S, by the vendor's SIGKILL child
tests, which I executed.

### 7.4 Reviewer-external instrumentation

Independent OS-level sampler at 1 Hz, 2,276 samples: peak vitest RSS
**609,587,200 bytes**; peak scratch **1,471,067,244**; peak `stocky_plus_ci` database size
**1,066,368,023 bytes** (~1.0 GiB, a figure absent from the implementation ledger). My
1 Hz scratch sampler missed ~62 MB of the peak the in-test 250 ms sampler caught, and OS
RSS for the process tree is ~1.5× the in-process self-report. Sampled peaks are observed
high-water marks, not bounds, and the two RSS figures are different units.

### 7.5 Other suites executed here

| Command | Result |
|---|---|
| `indexes.migration.test.ts` | **27 passed** |
| `pr6-c-b-pin-overlay.safety.test.ts` | **26 passed** |
| `pr6-d-sc-recovery` / `-integration` / `-worker` / `-correction` | **20 / 24 / 12 / 15 passed** (124 across the six files) |
| `vitest run app/lib/order-facts/sync` | **13 files, 130 passed** |
| `test:sync-exactly-once` | **42 passed** |
| `test:sync-envelope-fail-closed` | **6 passed** |
| `test:sync-dispatch-recovery` | **29 passed** |
| `test:sync-inventory-audit` | **5 passed** |
| `test:tenant-access -- job-envelope.test.ts` | **25 passed** |
| `tsc --noEmit`, `lint`, `build`, `prisma validate`, `graphql-codegen` | clean |
| `classify-ci-change-set.test.sh` | 40/40 |
| `git diff --check` | clean |
| `tenant:access` / `sync` / `tenant:enforcement` inventory checks | all **fresh**; `sync:inventory:check` surfaces **58**, digest `191b83498733…` |

**Review-environment note, not an implementation failure.** On first execution the sync
suites failed with `42501 permission denied for table Shop` for the control-plane role,
because the D suites' schema reset drops grants that CI re-establishes in separate
provisioning steps. After running `tenant:roles:provision`, `tenant:enforcement:apply` and
`sync:roles:provision` in CI order, all suites passed at their CI counts. Recorded as an
ordering issue I corrected within my authority; it is not attributed to the subject.

## 8. Outstanding-finding crosswalk

| ID | Severity | Disposition after this review |
|---|---|---|
| SC-R-01 | P2 | **RESOLVED** — boundary-counted attribution, one finite parent allowance, exact-boundary and one-short behaviour, fallback inside the allowance |
| SC-R-02 | P2 | **PARTIALLY RESOLVED** — atomic reservation proven under real processes; **NEW-SCQ-01 open** |
| SC-R-03 | P2 | **RESOLVED** — occupancy surfaced in production, truthful health, safe operator reclaim |
| SC-R-04 | P2 | **RESOLVED** — fence/run/Bulk/shop/API/query/content all bind; stable key; v1 detection; required-field fail-closed |
| SC-R-05 | P3 | **Accepted limitation**, scope unchanged — agreement membership not verified at final recheck |
| SC-R-06 | P3 | **RESOLVED** — throw-only negative control exists and is load-bearing at both levels |
| SC-R-07 | P3 | **Accepted limitation**, unreachable through production staging |
| SC-R-08 | P3 | **Unattributed**, unchanged; vendor's confirmatory SIGKILL test correctly labelled |
| **NEW-SCQ-01** | **P2** | **OPEN** — reservation-ledger evidence loss re-grants committed capacity (§5) |
| **NEW-SCQ-02** | **P3** | **OPEN** — `dTransportHardStop.throwOnExhaustion` is a mutable exported switch in production code, with no `NODE_ENV`/test-only guard, that disables a control proven load-bearing in §4. No production caller flips it today. Recommend gating it or replacing it with a test-time spy. |
| **NEW-SCQ-03** | **P3** | **Recorded limitation** — INDEX-01 overlap simultaneity is client-side timed (§6); accepted as the strongest practical evidence, to be stated as such rather than as server-side proof |
| PR43-CI-CLEANUP-01 | — | **RESOLVED** — 26/26 plus three binding mutation controls |
| PR43-CI-INDEX-01 | — | **RESOLVED** — 27/27, both historical failures adjudicated, three binding mutation controls |
| D-R-01…12, N-01…N-09 | — | **Preserved**; re-executed via the 124-test D matrix, 130 sync unit tests and the sync regression suites. No regression observed |
| N-08 scale/resource | — | **Closed at H by `ec61089`, and now independently re-established on the S runtime** (§7.3) |
| R-176 | P0 | **OPEN**, unchanged — outside this adjudication |
| R-164 | — | unchanged |

## 9. Executed / reused / unexecuted

**Executed here:** everything in §7.5 and §7.3; the SC-R-01/06 boundary and cap-sweep
probes; the nested-reader and throttle probes; the two-process quota control and the
four-mode reservation-loss adjudication; the SC-R-03 occupancy lifecycle and reclaim
safety matrix; the SC-R-04 binding, required-field and v1-detection probes; six reviewer
mutation controls across CLEANUP-01 and INDEX-01; raw-log adjudication of run
`35336443725` / job `105572298557`; and identity, scope and CI verification.

**Reused with rationale, not re-executed:** the `ec61089` H envelope and H SIGKILL
recovery (established for H; §7.2 explains why they do not transfer to the changed
controls, which is why §7.3 was executed instead). Cursor's `b2471676` envelope is
recorded as a reported claim and is separately attributed throughout.

**Not executed (out of scope or prohibited):** live Shopify or store calls, production or
merchant data, deployment, scope/flag changes, mark-ready, merge. No fix was implemented,
and no subject, report, immutable review, peer branch, schema, grant, package or CI file
was modified. All reviewer probes and mutations were reverted; the review worktree was
verified pristine before the final gates and at publication.

**Blocked evidence:** none.

## 10. Disposition

**CORRECTIONS REQUIRED**, on NEW-SCQ-01 (P2) alone. SC-R-01, SC-R-03, SC-R-04, SC-R-06,
PR43-CI-CLEANUP-01 and PR43-CI-INDEX-01 are independently confirmed resolved; SC-R-02 is
resolved except for that defect; SC-R-05, SC-R-07, NEW-SCQ-02 and NEW-SCQ-03 carry
explicit P3 dispositions. Mandatory changed-path evidence is complete.

PR #43 remains OPEN / DRAFT / UNMERGED at `dab5accc…`; `main` unchanged at `a3ff480f…`.
R-176 remains OPEN / P0. R-164 unchanged. PR6 and Phase 1 remain IN PROGRESS. D-054
remains authority; no D-055. This verdict authorizes neither merge, formal closure,
production, nor inventory writes.
