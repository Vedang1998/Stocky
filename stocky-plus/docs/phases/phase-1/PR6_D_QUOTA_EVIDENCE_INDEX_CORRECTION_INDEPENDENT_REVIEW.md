# PR6-D — quota-evidence and index correction: independent review

## 0. Verdict

**APPROVE PR6-D QUOTA-EVIDENCE AND INDEX CORRECTION**

NEW-SCQ-01 (P2) and NEW-SCQ-02 (P3) are **independently confirmed resolved**. The JSONL
test-isolation follow-up and PR43-CI-INDEX-02 are **independently confirmed resolved**.
No unresolved P0/P1/P2 remains, mandatory changed-path evidence is complete, and every P3
carries an explicit disposition (§7). No new defect was found.

This verdict is a review outcome only. It is not technical acceptance, mark-ready, merge,
formal PR6 closure, Phase 1 closure or production authorization.

## 1. Assignment, provenance and continuity

| Field | Value |
|---|---|
| Tool | Claude Code (Anthropic CLI), remote execution container, independent of Cursor and its delegated workers |
| Session | `https://claude.ai/code/session_01PDAFNDbmMZdKAra461t988` |
| Configured model | `claude-opus-5` |
| Chat continuity | Same chat that authored `e20cca5cfa983e516c26980e0ccbaf3a5e00a1cf` — a continuation, not a duplicate |
| Authority | PR43 comment 5742905459 |
| Review branch | `claude/pr43-quota-evidence-index-correction-review`, rooted exactly at C |

No `claude/pr43-quota-evidence-index-correction-review` branch existed beforehand; this is
the first publication of this review. Figures marked *executed* were produced by this
session on the environment in §6.1; figures marked *reported* are Cursor's claims; figures
marked *raw-log-confirmed* were read from the CI log for run `35440638530`.

## 2. Identity, scope and preservation (verified)

| Check | Result |
|---|---|
| Subject C | `ca33d9a7871fd0eef77d19d06cbe2bfae47dad0b` — verified tip of `origin/phase-1/pr6-d-order-webhook-import` |
| Base V | `a3ff480f1477237f8055f10c43298480a05728a1` — verified `origin/main` HEAD **and** the merge base of C |
| V ancestor of C | yes |
| PR #43 | OPEN / **DRAFT** / UNMERGED |
| Full PR scope | **91 changed paths** — verified, not forced |
| S → C | **8 commits / 17 paths** — matches the mandate exactly |
| INDEX-02 (`1e5c18ed…` → C) | **1 commit / 3 paths**: index test, D report, mechanical PR2 inventory — exactly as stated |
| Later push / competing writer | none; C is still the live head at review close |

The correction is **not** fixture-only: of the 17 paths, seven are D application files
(`constants.ts`, `control-plane.ts`, `import.ts`, `scratch-quota.ts`, `source-stage.ts`,
`transport-budget.ts`, `health.server.ts`).

Five preserved D review blobs at C — all byte-identical, none rewritten:

| Artifact | Blob | Observed |
|---|---|---|
| complete integration | `48ac291a781b2347cb6017af862f2de9677826a5` | **match** |
| first correction | `ba82a3c981cda4bec52ea453c2618319288fa66c` | **match** |
| source contract | `1eb18cae44cdf7a6660256e2632ebc8019d6da0d` | **match** |
| SC-recovery (`ec61089`) | `e8525c2fd2778c8baf118d0008a9213b7af4eca8` | **match** |
| final control (`e20cca5`) | `ee3f625ce2106b893e9018319e19ef2685e6beab` | **match** |

The earlier source-contract review-provenance qualification is preserved as written and
was not rewritten.

Frozen-boundary scan versus V — clean:

- accepted A/B/C application internals (`order-facts/admin-read/`, `order-facts/apply/`, `catalog-facts/`): **zero** changed files;
- `prisma/`, migrations, grants/RLS: **zero**;
- `.github/` workflows and CI configuration: **zero** — the 30-second local UTF-8 allowance did **not** touch any CI timeout;
- `package.json` / `package-lock.json` / vitest / eslint / tsconfig: **zero**;
- `shopify.app.toml`: **unchanged since H**;
- overlay (`pr6-c-b-pin-overlay.ts`, `.safety.test.ts`) and the D scale harness (`pr6-d-scale-envelope.test.ts`): **unchanged since S** — their established behaviour was verified unchanged, not reopened;
- no PR7/PR45/PR46 path touched; PR45's planning correction was not inspected as D authority.

## 3. Exact-head CI — independently confirmed, not re-triggered

Read from the Actions API and the raw Heavy log. No run was triggered and no historical
run substituted.

| Item | Observed |
|---|---|
| Run `35440638530` | event `pull_request`, **attempt 1**, head C, **SUCCESS** |
| Classify `105890696932` | **SUCCESS** |
| Heavy `105890713641` | **SUCCESS**, **150 executed steps** — not skipped |
| Gate `105898679904` | **SUCCESS** |

Raw-log reconciliation, with the two corpora kept distinct:

| Corpus | Step | Raw-log-confirmed | Independently reproduced here |
|---|---|---|---|
| unit | `npm test` | 72 files / **712 passed** | **72 files / 712 passed** |
| migrations | `npm run test:migrations` | 72 files / **727 passed / 2 skipped** | suites reproduced individually (§6.5) |

Suite counts, raw-log-confirmed **and** reproduced locally: index **30**, overlay **26**,
JSONL **33**, source-stage **46**. The 2 skips are the two opt-in scale envelopes
(`pr6-d-scale-envelope`, `pr6-c-scale-envelope`) — intentional opt-in skips, not
unexecuted jobs, and no opted-out envelope is claimed as having run in CI.

Failed runs `35412301750` and `35415196729`, and the historical successful `35400320443`,
retain their original identities and are not presented as C evidence.

## 4. NEW-SCQ-01 — reservation-evidence integrity → **RESOLVED**

### 4.1 What changed

`loadDScratchReservations`'s fail-open behaviour is replaced by
`readDScratchReservationFile` + `resolveDScratchLedger`, which classify evidence as
`ok`/`uninitialized`/`missing`/`unreadable`/`corrupt`/`wrong_version`/`malformed_entry`,
and by `refuseIndeterminateScratchQuota`, which refuses admission on any integrity
failure, on `unknownAttemptCount > 0`, and on outstanding orphan temp metadata. A missing
file counts as a genuine empty ledger **only** when the namespace marker was created by
that same call and there are zero attempt directories. Persistence is now exclusive-temp
→ complete write → `fsync` → `rename` → directory `fsync`.

### 4.2 The prior finding, re-run at the same parameters

Live child holding **33,554,432** reserved bytes of a **41,943,040** cap with 4 KiB
written, then the evidence damaged four ways:

| mode | classified | second admission | live writer dir | bytes before → after | over-committed |
|---|---|---|---|---|---|
| corrupt | `corrupt` | **REFUSED** | intact | 4,327 → 4,327 | **no** |
| truncated | `corrupt` | **REFUSED** | intact | 4,329 → 4,329 | **no** |
| deleted | `missing` | **REFUSED** | intact | 4,325 → 4,325 | **no** |
| wrong version | `wrong_version` | **REFUSED** | intact | 4,333 → 4,333 | **no** |

At S all four **admitted** a second 33,554,432-byte reservation and reached 160 % of cap.
At C all four refuse with a precise reason, the first writer's entitlement and bytes are
untouched, and `operatorInterventionRequired: true` surfaces the condition.

### 4.3 Further evidence cases

| case | outcome |
|---|---|
| genuine first init (new marker, no attempts) | **admits** |
| second valid under-cap admission | **admits** |
| missing file on an *initialized* namespace | **refuses** (`missing`) |
| valid empty ledger after a clean release | **admits** — no over-refusal |
| unknown attempt (marker-bearing `att-*` absent from ledger) | **refuses** — "identities are unknown (1)" |
| orphan temp metadata | **refuses** — "temp metadata is outstanding" |
| malformed row inside otherwise valid JSON | **refuses** (`malformed_entry`) |
| symlinked ledger file | **refuses** (`unreadable`) — symlink not followed |

### 4.4 Interrupted persistence — executed SIGKILL, not source inspection

Real child processes were killed at each persist boundary (`PR6_D_QUOTA_CRASH`); every
child died by SIGKILL (exit **137** = 128 + 9):

| kill point | ledger after | orphan temps | next admission |
|---|---|---|---|
| after temp write | **valid (`ok`)** | 1 | refused |
| after temp sync | **valid (`ok`)** | 1 | refused |
| before replace | **valid (`ok`)** | 1 | refused |
| after replace | **valid (`ok`)** | 0 | refused |
| after reservation | **valid (`ok`)** | 0 | refused |

The ledger was **never** left readable-but-wrong: the temp absorbs every interruption, so
the in-place truncation that made the S-era defect crash-reachable is gone. In this
schedule the refusal reason is the held `quota.lock` ("refusing admission without stealing
capacity") because the child died holding it — the correct conservative outcome, and no
lock stealing. The ledger-integrity refusal path is proven separately by §4.2–4.3.

*Scope statement required by the mandate:* `handle.sync()` and the directory `fsync` are
**source evidence** that the durability calls are issued. What is **executed** here is
SIGKILL process termination and injected failures at those boundaries. Physical
power-loss durability was neither demanded nor tested, and no such property is claimed.

### 4.5 Lifecycle, concurrency and recovery

- Capacity is **not** free while held: a second 30 MiB request was refused while a 30 MiB reservation was live; after `disposeOwnedScratch` removed the owned files, the same request **admitted**.
- Six simultaneous 6 MiB admissions against the 40 MiB cap: all six admitted, totalling **37,748,736 ≤ 41,943,040**, and the persisted ledger sum **exactly equalled** what was granted. No over-commit under real concurrency.
- Under the runbook: damaged evidence refuses; operator reclaim of the ledger file itself is rejected as `not_an_attempt_basename` — no ownership inferred from a path or prefix, no lock stealing, no automatic foreign/symlink deletion.

## 5. NEW-SCQ-02 and preserved SC-R-01 / SC-R-06 → **RESOLVED**

The mutable bypass is **gone**: `dTransportHardStop` no longer exists anywhere in `app/`
or `scripts/`, and the only surviving reference is a guard test asserting the module does
**not** export it. Counting moved into a private `accountDTransportAttempt`; the
exhaustion throw is now unconditional.

**Required mutation control.** I disabled **only** the real exhaustion throw inside
production `consumeDTransportAttempt` in a disposable checkout. The production-wrapper
test `refuses nested B graphql beyond the shared wrapper allowance` — which uses
`wrapAdminWithDTransportBudget`, not a double — **failed**; restoring the throw returned
the file to 19/19. The suite's test-local `wrapAdminCountingOnly` is used by exactly one
case and is treated here as a **control**, not as proof that production's throw was
mutated. Four of the five transport tests exercise the production wrapper.

**Production boundary re-run** through the real `runOrderFactsImportStep`, transport
counted at the outermost client boundary:

| cap | 1 | 2 | 3 | 4 | 5–8 |
|---|---|---|---|---|---|
| status | PARTIAL_FAILURE | PARTIAL_FAILURE | PARTIAL_FAILURE | **SUCCEEDED** | SUCCEEDED |
| parent attempts | — | — | — | **4** | 4 |

Exact-boundary success at 4, one-short refusal at 3, `run + parent == boundary` in every
success, `fallbackOrders 1` / `fallbackTransportAttempts 3`. Identical to the S-era
production result: SC-R-01 and SC-R-06 are preserved under the bypass removal.

## 6. JSONL isolation, INDEX-02, and evidence continuity

### 6.1 Environment

Node `v22.22.2`, npm `11.5.2` (pinned as CI does), Linux x86_64, 4 CPUs,
16,877,547,520 bytes RAM, PostgreSQL **16.13**, Redis reachable. Prerequisites in CI
order: `npm ci` → `prisma generate` → `prisma migrate deploy` → `graphql-codegen` →
`tenant:indexes:apply --apply` → `tenant:roles:provision --apply` →
`tenant:enforcement:apply --apply` → `sync:roles:provision --apply`.

### 6.2 JSONL isolation → **RESOLVED**

Each JSONL test now receives a unique `beforeEach` scratch root with `afterAll` cleanup,
and `source-stage.test.ts` tracks spawned children, SIGKILLs them in `afterEach`, and
deletes `PR6_D_QUOTA_FAIL_SAVE` / `PR6_D_QUOTA_CRASH` so injected state cannot leak.
Verified by diff that **no assertion was removed or weakened** — the only changed import
line is vitest's; MALFORMED/TRUNCATED/COMPLETE semantics, byte-split UTF-8 and whole-file
duplicate evidence are intact. No CI timeout was touched (§2).

Executed: the strict same-process sequence (`--no-file-parallelism`) over
`jsonl` + `source-stage` + `scratch-quota` — **83 passed**, run **twice**, identical, no
contamination. Full CI unit step reproduced at **72 files / 712 passed**.

### 6.3 INDEX-02 → **RESOLVED**

The change replaces a tuples-first remaining-work predicate with a phase-specific one:
`building index: scanning table`, `index validation: scanning index` and
`index validation: scanning table` are evaluated on **block** counters; other phases fall
back to tuples-or-blocks. The stated rationale is that PG16 `validate_index()` zeros
counters entering the index scan, zeros only blocks entering sort, then updates only the
phase entering the table scan — so leftover tuple counters must not mask an active
table-scan block walk.

**External-fact check against live PostgreSQL 16.13.** I ran a real
`CREATE INDEX CONCURRENTLY` over 900,000 rows and sampled
`pg_stat_progress_create_index` every 5 ms (58 samples):

| phase | tuples_done | blocks_done / total | advancing |
|---|---|---|---|
| `building index: scanning table` | 0 / 0 | 28 → 28,326 / 29,033 | **blocks** |
| `building index: sorting live tuples` | 0 | 0 → 29,033 | blocks |
| `building index: loading tuples in tree` | 46,280 → 900,000 | 0 / 0 | **tuples** |
| `index validation: scanning index` | 0 / 0 | 532 → 1,996 / 2,471 | **blocks** |
| `index validation: scanning table` | 0 / 0 | 19 → 26,900 / 29,033 | **blocks** |

The three phases the fix classifies as block-progress are exactly the three that report
block counters and zero tuple counters on this server. The classification is **empirically
correct** for PG16.13.

**Honest limit.** I observed tuple counters at `0/0` during the validation table scan, not
stale non-zero leftovers, so `staleTuplesLookComplete` was false in every phase and I did
**not** reproduce the precise stale-window condition. The documented `validate_index`
sequence makes that window plausible at a phase transition, and the fix is strictly safer
either way, but per the mandate the historical cause of run `35415196729` remains an
**inference**, not a proven reproduction. The sampler-completion explanation likewise
remains an inference.

**Predeclared batch.** Three consecutive full-file runs of `indexes.migration.test.ts`,
every outcome retained, no retry-until-green: **30/30, 30/30, 30/30**, exits 0/0/0 —
matching the raw-log index count of 30. The run includes the F-F03 three-iteration
overlap test, `cancels an in-flight CONCURRENTLY builder after injected assertion failure`
and the following `verify fails when indexes were dropped after apply` case.

**Mutation controls** (each reverted; tree left pristine):

| guard removed | suite response |
|---|---|
| phase-specific predicate reverted to tuples-first | **2 fail**: `does not let leftover validation-sort tuples hide an active table-scan block walk` and `fails validation overlap when the in-flight window sample is omitted from the snapshot (CI 35415196729)` |
| drain accepts any phase | **3 fail**, including the real-PostgreSQL F-F03 overlap test and `rejects loading-tuples / validation-index as substitutes for the required scan phases` |

The coverage added for this correction also includes
`does not treat a drained later-phase spanning sample as validation table-scan overlap`
and `accepts independent in-window scan samples even if after-burst has already left the
scan` — i.e. the drain retains genuinely in-window measurements without admitting
before/after-only samples, copied triggers or a merely unfinished builder.

**NEW-SCQ-03 remains explicit.** Overlap simultaneity is still client-side timed
(`process.hrtime` brackets); PostgreSQL exposes no server-timestamped write/scan
simultaneity. This is recorded as an accepted methodological limitation and is **not**
presented as server-timestamped proof. The sampler catch-up interval
(`FF03_SAMPLER_CATCH_UP_MS = 1000`) is a bound on completing an in-flight observer query
and is separate from the unchanged 15-second write bound.

### 6.4 Scale: executed on C rather than reused

The `e20cca5` million-line envelope and the earlier SIGKILL / positive-checkpoint recovery
remain **established for S** and are not relabelled. C changes quota persistence and the
admission-refusal guarantee on the same path the envelope's crash-prefix, scratch-deletion
and resume legs exercise, so that guarantee was not automatically current. I therefore ran
the envelope on C: **exit 0, 4/4 passed, 1324.53 s**.

| Metric | Executed on S (`e20cca5`) | **Executed on C** | |
|---|---|---|---|
| `lineFactsA` / live / absent | 1,000,000 / 1,000,000 / 0 | **1,000,000 / 1,000,000 / 0** | identical |
| `zeroCurrentLineFactsA` | 200,000 | **200,000** | identical |
| roots / applied / examined | 5,192 | **5,192** | identical |
| `bulkDirectApplies` | 5,190 | **5,190** | identical |
| `verifiedReplayApplies` / `followUpReads` | 1 / 1 | **1 / 1** | identical |
| `crashCheckpointOrdinal` | 201 | **201** | identical |
| `runTransportAttempts` + `parentTransportAttempts` | 2 + 10,391 | **2 + 10,391** | identical |
| `fallbackOrders` / `fallbackTransportAttempts` | 1 / 3 | **1 / 3** | identical |
| `graphqlCalls` | 10,393 | **10,393** | reconciles |
| `merchantSqlCalls` | 3,258,946 | **3,258,946** | identical |
| `controlPlaneEngineRequests` | 15,664 | **15,664** | identical |
| `peakScratchBytes` (250 ms) | 1,533,515,611 | 1,532,400,650 | sampled |
| `peakRssBytes` | 397,320,192 | 414,105,600 | sampled |
| `elapsedMs` | 2,040,212 | 1,308,622 | host variance |

Every deterministic counter is unchanged, so the quota-persistence and bypass-removal
changes demonstrably did not alter scale correctness or resource profile — established by
execution, not inference. The crash/scratch-loss leg still admits correctly under the new
integrity refusal.

Reviewer-external sampler at 1 Hz (1,820 samples): peak vitest RSS **630,173,696**, peak
scratch **1,469,042,024**, peak database **1,093,819,415** bytes. As before, the 1 Hz
sampler under-reads the 250 ms in-test peak — sampled peaks are observed high-water marks,
not bounds, and OS RSS and `process.memoryUsage().rss` are different units.

### 6.5 Suites executed here

| Command | Result |
|---|---|
| `vitest run app/lib/order-facts/sync` | **14 files, 156 passed** |
| strict same-process JSONL + source-stage + scratch-quota, ×2 | **83 passed**, twice |
| `npm test` (CI unit step) | **72 files, 712 passed** |
| `indexes.migration.test.ts` ×3 (predeclared) | **30 / 30 / 30 passed** |
| `pr6-d-sc-recovery` / `-integration` / `-worker` / `-correction` / overlay | **20 / 24 / 12 / 15 / 26 = 97 passed** |
| `pr6-d-scale-envelope` with `PR6_D_SCALE_1E6=1` | **4 passed**, 1324.53 s |
| `test:sync-exactly-once` | **42 passed** |
| `test:sync-envelope-fail-closed` | **6 passed** |
| `test:sync-dispatch-recovery` | **29 passed** |
| `test:sync-inventory-audit` | **5 passed** |
| `test:tenant-access -- job-envelope.test.ts` | **25 passed** |
| `tsc --noEmit`, `lint`, `build` | clean |
| `classify-ci-change-set.test.sh` | 40/40 |
| `git diff --check` | clean |
| inventory freshness ×3 | all **fresh**; `sync:inventory:check` surfaces **58**, digest `191b83498733…` |

**Reviewer environment notes, honestly attributed.** (1) `tenant:enforcement:apply` first
failed because I had not yet run `tenant:indexes:apply`; correcting the CI order fixed it.
(2) After the million-line envelope, the same command failed its preflight on
`orphan_parent_refs` left by the envelope's own fixture data — the tool fail-closing
correctly on dirty data. I recreated the database as CI does and reprovisioned, after
which all suites passed. Both are my sequencing, **not** subject defects.

## 7. Finding crosswalk

| ID | Severity | Disposition after this review |
|---|---|---|
| **NEW-SCQ-01** | P2 | **RESOLVED** — four damaged-evidence modes refuse with the live writer intact; missing/unknown/orphan/malformed/symlink all refuse; atomic persist survives SIGKILL at five boundaries; concurrency never over-commits (§4) |
| **NEW-SCQ-02** | P3 | **RESOLVED** — bypass removed and guarded by an export assertion; real-throw mutation control fails a production-wrapper test (§5) |
| **NEW-SCQ-03** | P3 | **Accepted limitation, scope unchanged** — overlap simultaneity is client-side timed and is stated as such, not as server-timestamped proof |
| JSONL isolation follow-up | — | **RESOLVED** — unique roots, owned-child termination, env restored, no assertion weakened, no CI timeout change (§6.2) |
| PR43-CI-INDEX-02 | — | **RESOLVED** — phase-specific predicate empirically correct on PG16.13; two binding mutation controls; 30/30 ×3 (§6.3) |
| SC-R-01 | P2 | **RESOLVED**, preserved — production boundary re-run identical to S (§5) |
| SC-R-02 | P2 | **RESOLVED** — the remaining arm (NEW-SCQ-01) is now closed |
| SC-R-03 | P2 | **RESOLVED**, preserved — occupancy now additionally reports `ledgerIntegrity` and `orphanMetadataPresent` |
| SC-R-04 | P2 | **RESOLVED**, preserved |
| SC-R-05 | P3 | **Accepted limitation**, scope unchanged — agreement membership not verified at final recheck |
| SC-R-06 | P3 | **RESOLVED** — negative control now targets the real production throw |
| SC-R-07 | P3 | **Accepted limitation**, unreachable through production staging |
| SC-R-08 | P3 | **Unattributed**, unchanged; the vendor's confirmatory SIGKILL test remains correctly labelled |
| D-R-01…12, N-01…N-09 | — | **Preserved**; re-executed via the 97-test D/overlay matrix, 156 sync unit tests and the sync regression suites. No regression observed |
| N-08 scale/resource | — | **Established for S and re-established on C** (§6.4) |
| R-176 | P0 | **OPEN**, unchanged — outside this adjudication |
| R-164 | — | unchanged |

No new defect was identified in this correction.

## 8. Executed / reused / unexecuted

**Executed here:** all of §6.5; the four damaged-evidence cases and the eight further
evidence cases; five SIGKILL persist-boundary kills; the release/concurrency/runbook
lifecycle probes; the production-throw mutation control and the production boundary sweep;
the strict same-process JSONL sequence ×2; the live PG16.13 progress-counter measurement;
the predeclared three-run index batch and two INDEX-02 mutation controls; the million-line
envelope on C with external sampling; and identity, scope and CI verification.

**Reused with rationale:** the overlay's established behaviour (files unchanged since S,
re-executed at 26/26 rather than reopened) and the `e20cca5` S-era full-module
conclusions, which remain attributed to S. The S envelope was **not** substituted for C —
§6.4 is an independent execution on C.

**Not executed (out of scope or prohibited):** live Shopify or store calls, production or
merchant data, deployment, scope/flag changes, mark-ready, merge, any new Actions run.
Physical power-loss durability was not tested and is not claimed. No implementation fix
was made and no subject, report, previous review, peer branch, schema, grant, package or
CI file was modified. All reviewer probes and mutations were reverted; the worktree was
verified pristine before the final gates and at publication.

**Blocked evidence:** none.

## 9. Disposition

**APPROVE PR6-D QUOTA-EVIDENCE AND INDEX CORRECTION.** No unresolved P0/P1/P2; mandatory
changed-path evidence complete; P3 dispositions explicit in §7.

PR #43 remains OPEN / DRAFT / UNMERGED at `ca33d9a7…`; `main` unchanged at `a3ff480f…`.
R-176 remains OPEN / P0. R-164 unchanged. PR6 and Phase 1 remain IN PROGRESS. D-054
remains authority; no D-055. This approval authorizes neither merge, formal PR6 closure,
production, nor inventory writes.
