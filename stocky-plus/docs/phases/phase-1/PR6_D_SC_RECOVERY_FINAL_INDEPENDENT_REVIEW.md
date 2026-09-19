# PR6-D — SC-recovery and complete-module final independent review

## 0. Verdict

**CORRECTIONS REQUIRED**

Four unresolved **P2** defects (SC-R-01…SC-R-04). No P0 and no P1 were found. The
mandatory independent scale/resource evidence **was executed and is now closed**; the
remaining blockers are correctness-of-control defects and one operability gap, not
missing evidence.

This verdict is a review outcome only. It is not technical acceptance, evidence
certification beyond what is listed as executed, mark-ready, merge, PR6 closure,
Phase 1 closure, or production authorization.

## 1. Assignment and provenance

| Field | Value |
|---|---|
| Tool | Claude Code (Anthropic CLI), remote execution container, separate from Cursor's implementation environment |
| Session | `https://claude.ai/code/session_01PDAFNDbmMZdKAra461t988` |
| Configured model | `claude-opus-5` |
| Role | Independent reviewer. No implementation performed. |
| Review branch | `claude/pr43-sc-recovery-independent-20260916`, rooted exactly at H |
| Authority | PR43 comment 5707545217 |

No credentials or private environment values are reproduced here. Every figure
below that is labelled *executed* was produced by this session on the machine
described in §8.1; every figure labelled *reported* is Cursor's claim.

## 2. Identity, ancestry and preservation (all verified)

| Check | Result |
|---|---|
| Subject H | `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` — verified tip of `origin/phase-1/pr6-d-order-webhook-import` |
| Base V | `a3ff480f1477237f8055f10c43298480a05728a1` — verified `origin/main` HEAD **and** the merge base of H |
| V ancestor of H | yes (`git merge-base --is-ancestor` → true) |
| PR #43 | OPEN / **DRAFT** / UNMERGED, head H, base V, `mergeable_state: clean` |
| Changed-path count | **81** — matches the expected count; verified, not forced |
| R → H delta | docs only (`PROJECT_STATUS.md`, `PR2_TENANT_ACCESS_INVENTORY.md`, `PR6_D_EXECUTION_BRIEF.md`, `PR6_D_IMPLEMENTATION_REPORT.md`, `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md`). Runtime/test tree equivalence of R `4fd98ce` and H **confirmed** |
| Review workspace | isolated `git worktree` at H; pristine before and after (`git status --untracked-files=all` empty) |

Pinned immutable artifacts — all three blobs byte-identical at H:

| Artifact | Expected blob | Observed |
|---|---|---|
| `PR6_D_COMPLETE_INTEGRATION_INDEPENDENT_REVIEW.md` | `48ac291a781b2347cb6017af862f2de9677826a5` | **match** |
| `PR6_D_CORRECTION_INDEPENDENT_REVIEW.md` | `ba82a3c981cda4bec52ea453c2618319288fa66c` | **match** |
| `PR6_D_SOURCE_CONTRACT_INDEPENDENT_REVIEW.md` | `1eb18cae44cdf7a6660256e2632ebc8019d6da0d` | **match** |

Source-contract review commit `7710758b181b5a49f1affa260a56b331adafdf7e`: sole parent
`09029c09ea7468e6ff676a11fdf020dde5deb694`, one-file delta, author and committer
recorded as `Cursor Agent`. **Provenance limitation stands and is recorded, not
resolved**: that metadata does not establish which reasoning agent performed the work.
The artifact is retained unedited and unamended. Its blocking claims were
independently re-derived here rather than accepted.

Prohibited-surface scan versus V — **all clean, no exceptions**:

- accepted A/B/C internals (`app/lib/order-facts/admin-read/`, `app/lib/order-facts/apply/`, `app/lib/catalog-facts/`): **zero** changed files;
- `prisma/`, migrations, grants/RLS: **zero**;
- `.github/` workflows and CI configuration: **zero**;
- `package.json` / `package-lock.json` / vitest / eslint / tsconfig: **zero**.

`shopify.app.toml` adds exactly the three authorized D topic subscriptions
(`orders/edited`, `orders/delete`, `order_transactions/create`); API version `2026-07`
and the scope string are unchanged. `sanitize.server.ts` and `job-envelope.server.ts`
changes are purely additive; frozen v1 projections are untouched and the
`order_transactions/create` projection deliberately omits `payment_details`.

## 3. Exact-head CI — independently confirmed, not re-triggered

Queried directly from the GitHub Actions API this session. No run was triggered, no
`workflow_dispatch`, no empty commit, no rerun.

| Item | Observed |
|---|---|
| Run `35168858541` | event `pull_request`, **attempt 1**, head `4768033b…`, conclusion **SUCCESS** |
| Classify `105035935823` | **SUCCESS** |
| Heavy `105035968371` | **SUCCESS**, job `Lint, typecheck, test, build, Prisma, GraphQL`, **146 executed steps**, ~63 min — **not skipped** |
| CI Gate `105048329066` | **SUCCESS** |

D and recovery execution inside that Heavy job is real but **implicit**: there are no
`PR6-D`-named steps. The D unit suites run under step 141 `Unit tests`
(`vitest.config.ts`, `app/**/*.test.ts`) and the D PostgreSQL suites under step 142
`Migration and tenant-backfill tests` (`vitest.migrations.config.ts`, which includes
`scripts/tenant-enforcement/tests/**`, elapsed 01:42:23→02:02:50). The 1e6 envelope's
CI skip is the intended opt-in skip (`PR6_D_SCALE_1E6` unset), distinct from an
unexecuted job. All verified by reading the configs and the job step list.

## 4. SC-01 — attempt ownership and filesystem safety

**Implementation, as read at H.** One `mkdtemp` attempt directory per physical attempt
under a uid-checked, marker-guarded namespace; shop/run are name metadata only. No
create-time recursive deletion of any deterministic path. Disposal requires all of: an
authentic in-process capability handle (module `WeakSet`), prefix containment,
`lstat` symlink refusal, path-substitution refusal, uid ownership, and an on-disk
marker whose token matches the handle. A caller-supplied path string is refused
outright.

**Executed evidence (this session).** `app/lib/order-facts/sync/source-stage.test.ts`
— **15/15 passed**, including two cases that spawn real child processes and `SIGKILL`
them. Plus my own probes:

| Probe | Result |
|---|---|
| Markerless dir (`source.jsonl` only) and foreign-marker dir survive an unrelated attempt's full create→dispose cycle | **PASS** — `markerlessBytes: 16` retained, foreign dir retains `.stocky-pr6-d-owned` + `source.jsonl`, own dir removed. Non-empty on-disk inventory, not an empty-map proof |
| Real `SIGKILL` of a separate process running the production import path | **PASS** — see §6 |

**Defects found:** SC-R-02 and SC-R-03 below.

## 5. SC-02 — replay, receipts and source binding

**Implementation, as read at H.** `DiskOrdinalAck.open({ contiguous: 0 })` is the only
call site (`import.ts:519-523`) — a newly staged source always starts positional
processing at zero; the persisted ordinal is retained as progress evidence only.
Completion is reconstructed per parent through the accepted C receipt path
(`probeReceiptBeforeShopifyIo`) against a content-bound key plus payload digest.
Identity-only legacy receipts raise `import_legacy_receipt_fresh_run_required`;
content conflict raises `import_receipt_content_conflict_fresh_run_required`. Any
`incomplete > 0` forces `failImport` — `SUCCEEDED` cannot be returned with a missing
parent.

**Executed evidence.** `pr6-d-sc-recovery.test.ts` **13/13** and
`pr6-d-correction.test.ts` **15/15** passed on live PostgreSQL 16.13. My own digest
probes:

| Mutation | Digest changes? | Required |
|---|---|---|
| child `quantity` | **yes** | yes |
| `shopId` | **yes** | yes |
| `queryFingerprint` | **yes** | yes |
| `apiVersion` | **yes** | yes |
| dropped child | **yes** | yes |
| field nulled | **yes** | yes |
| parent key reordering | no (correct — representation-only canonicalization) | no |
| child array reordering (ids present) | no (correct) | no |
| child value swap between ids | **yes** | yes |
| **`fenceGeneration` 1n → 999n** | **no** | **yes → SC-R-04** |

**Defect found:** SC-R-04 below.

## 6. Recovery under genuine process loss — independently established

The supplied 1e6 interruption is, by its own honest declaration, an *injected Admin
throw plus test-operator scratch deletion* — `interruptKind` says so verbatim. That
classification is accurate and I confirm it. It is **not** ungraceful process death, so
I established that invariant separately, as instructed, on a representative schedule
rather than at one million rows.

Reviewer-authored probe: a child process ran the production `runOrderFactsImportStep`
over 40 parents; the parent polled the control plane and sent `SIGKILL` the moment a
positive committed checkpoint existed; the dead attempt's scratch was then destroyed;
the import was resumed under the same `durableJobId` with the source **reversed**.

```
childKilledWhileAlive: true      childSignal: "SIGKILL"   childExitCode: null
childOutputAtKillDecision: ""    (no output had been produced when the kill was decided)
committedOrdinalAtKill: 2        factsAfterKill: 2  of 40
leftoverAttemptDirsAfterKill: 1  leftoverBytesAfterKill: 139809   scratchDeleted: true
resumedStatus: "SUCCEEDED"
resumed: applied 40, examined 40, bulkDirectApplies 37,
         verifiedReplayApplies 3, followUpReads 0,
         ledgerCounts { initial 37, recheck 37, agreement 0, sale 0, refund 0, fallback 0, throttle 0 }
finalFactRows: 40   distinctOrders: 40   lineFacts: 40
```

Exactly-once recovery from real process loss after a positive committed prefix, with
scratch loss and source reordering, is **independently established**: no duplicated
fact, no false completion, and the three already-receipted parents were reconstructed
through content-bound receipts rather than positional skipping.

*Unattributed observation (SC-R-08).* In that probe the killed child's import step
returned `PARTIAL_FAILURE` with `ENOENT … ack.bits`. An identical standalone child run
with no parent polling and no kill returned `SUCCEEDED` with clean scratch disposal, and
the 1e6 envelope and every D suite pass. I therefore do **not** attribute this to the
implementation; I could not isolate it within this session and record it as a probe
artifact deserving one confirmatory run.

## 7. SC-03 / SC-04 — transport budget and end-of-walk coherence

`supplemental-ledger.test.ts` **14/14** passed. Independent boundary-counted probes
(counter installed outside the implementation, invisible to it):

| Probe | Result |
|---|---|
| Budget sweep 1…12 with three refunds | **PASS** — observed transport ≤ configured allowance for **every** value; `transport.used` equalled the boundary count exactly in all 12 cases |
| One-page, no-refund order | **PASS** — 2 calls (`initial` + `recheck`), `transport.recheck: 1`. The final Order check is genuinely unconditional |
| Same-cardinality refund swap, parent `updatedAt` unchanged | **PASS** — `drift` / `ledger_refund_membership_drift` |
| **Agreement** GID swapped at final recheck, parent `updatedAt` unchanged | **`complete`** → SC-R-05 (P3) |

**Defect found:** SC-R-01 below.

## 8. Independent scale, recovery and resource execution

### 8.1 Environment

Node `v22.22.2`, npm `11.5.2` (pinned as CI does), Linux x86_64, **4** CPUs,
16,877,793,280 bytes RAM, PostgreSQL **16.13** (local disposable cluster), Redis
reachable. Prerequisites run in CI order: `npm ci` → `prisma generate` → `prisma
validate` → `prisma migrate deploy` → `npm run graphql-codegen`. Source SHA
`4768033b6b9c09804a6d417f0bb10ab3e8fdab9b`.

### 8.2 The 1,000,000-line envelope, executed by this reviewer

`PR6_D_SCALE_1E6=1 npx vitest run --config vitest.migrations.config.ts
scripts/tenant-enforcement/tests/pr6-d-scale-envelope.test.ts` → **exit 0, 4/4 passed,
1637.11 s**. Prior Cursor execution is *not* relabelled as independent; this is a fresh
run on this machine.

| Metric | Cursor reported | **Executed here** | |
|---|---|---|---|
| `lineFactsA` | 1,000,000 | **1,000,000** | match |
| `liveLineFactsA` / `absentLineFactsA` | 1,000,000 / 0 | **1,000,000 / 0** | match |
| `zeroCurrentLineFactsA` | 200,000 | **200,000** | match |
| `plannedRoots` | 5,192 | **5,192** | match |
| `applied` / `examined` | 5,192 / 5,192 | **5,192 / 5,192** | match |
| `bulkDirectApplies` | 5,190 | **5,190** | match |
| `verifiedReplayApplies` | 1 | **1** | match |
| `followUpReads` | 1 | **1** | match |
| `crashCheckpointOrdinal` | 201 | **201** | match |
| `ledgerCounts.recheck` | 5,190 | **5,190** | match |
| `graphqlCalls` | 10,393 | **10,393** | match |
| `adminClassified` sum | 10,393 | **10,393** | reconciles |
| `merchantSqlCalls` | 3,258,946 | **3,258,946** | exact match |
| `controlPlaneEngineRequests` | 15,664 | **15,664** | exact match |
| `agreementCountA` / `refundCountA` | 103 / 3 | **103 / 3** | match |
| `peakScratchBytes` (250 ms sampler) | 1,507,608,226 | **1,512,200,051** | sampled, differs as expected |
| `peakRssBytes` (`process.memoryUsage`) | 440,074,240 | **413,937,664** | sampled |
| `peakHeapBytes` | 239,110,640 | **250,833,224** | sampled |
| `elapsedMs` | 1,060,381 | **1,619,473** | slower host |

Every deterministic counter reproduces **exactly**. Only sampled resource peaks and
wall time differ, which is the expected behaviour of high-water sampling.

### 8.3 Reviewer-external instrumentation (independent of the test's own samplers)

A separate OS-level sampler at **1 Hz** (`ps` RSS of all vitest processes; `du -sb` of
the scratch root; `pg_database_size`; `df` of `/`), 1,870 samples:

| Quantity | Value |
|---|---|
| peak vitest RSS (OS, all processes) | **623,427,584 bytes** |
| peak scratch bytes at 1 Hz | **1,343,905,636** |
| peak `stocky_plus_ci` database size | **1,048,534,039 bytes** (~1.0 GiB) |
| peak host root-filesystem used | 12,494,060 KiB |
| max concurrent `att-*` directories | 1 |

Two measurement lessons, stated rather than glossed: my 1 Hz scratch sampler missed
**168 MB** of the peak that the in-test 250 ms sampler caught — a direct demonstration
that a sampled high-water mark is an observation, not a bound. And OS RSS for the
process tree (623 MB) is ~1.5× the in-process `process.memoryUsage().rss` self-report
(414 MB); these are different units and must not be conflated. The peak database size
is a figure absent from the implementation ledger entirely and is contributed here.

I confirm the report's own instrumentation caveat is accurate: `pg.Client.prototype.query`
calls (3,258,946) and Prisma engine requests (15,664) are **different units**; they are
correctly reported separately and are not summed into a "wire-level SQL statements"
total.

### 8.4 Other suites executed here

| Command | Exit | Result |
|---|---|---|
| `vitest run app/lib/order-facts` | 0 | **31 files, 296 tests passed** |
| `pr6-d-sc-recovery.test.ts` + `pr6-d-correction.test.ts` | 0 | **28 passed** |
| `pr6-d-integration.test.ts` + `pr6-d-worker.test.ts` | 0 | **36 passed** |
| `pr6-d-scale-envelope.test.ts` with `PR6_D_SCALE_1E6=1` | 0 | **4 passed**, 1637.11 s |
| `npm run test:sync-exactly-once` | 0 | **42 passed** |
| `npm run test:sync-envelope-fail-closed` | 0 | **6 passed** |
| `npm run test:sync-dispatch-recovery` | 0 | **29 passed** |
| `npm run test:sync-inventory-audit` | 0 | **5 passed** |
| `npm run test:tenant-access -- app/tenant/__tests__/job-envelope.test.ts` | 0 | **25 passed** |
| `npx tsc --noEmit` | 0 | clean |
| `npm run lint` | 0 | clean |
| `npm run build` | 0 | built |
| `npx prisma validate` / `migrate deploy` / `graphql-codegen` | 0 | clean |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | 40/40 |
| `git diff --check` | 0 | clean |
| `tenant:access:inventory:check` | 0 | fresh |
| `sync:inventory:check` | 0 | surfaces **58**, digest `191b83498733…` (matches the reported digest) |
| `tenant:enforcement:inventory:check` | 0 | fresh |

### 8.5 Negative controls (reviewer-authored; each reverted, tree left pristine)

| Guard removed | Vendor suite response | Verdict |
|---|---|---|
| Unconditional final Order recheck made conditional on refunds existing | **4 tests fail** | guard is bound |
| Entire aggregate transport mechanism neutered (no throw, no counting) | **7 tests fail** | mechanism is bound |
| `AUTHENTIC_SCRATCH_HANDLES` capability check removed | **1 test fails** | guard is bound (thinly) |
| **Only** the transport wrapper's hard-stop throw disabled | **all 14 pass** | **not bound** → SC-R-06 |

## 9. Findings

### SC-R-01 — P2 — drift fallback transport escapes the aggregate budget and is under-counted

- **Files:** `app/lib/order-facts/sync/import.ts:436` (passes the raw `input.admin`); `app/lib/order-facts/sync/apply-nominated.ts:65` (`context = { admin: input.admin }`).
- **Evidence (executed).** One drifted parent through the real import path, transport counted at the outermost client boundary:
  - production `ledgerCounts` = `{initial:1, recheck:0, agreement:0, sale:0, refund:0, fallback:1, throttle:0}` → **2**;
  - actual boundary calls → **7**: `CatalogFactBulkOperationRunQuery` 1, `CatalogFactBulkOperation` 1, `CurrentAppInstallationAccessScopes` 2, `OrderFactsImportLedger` 1, `ShopTimezoneCurrency` 1, `OrderFactById` 1.
- **Merchant impact.** The declared per-order hard cap can be roughly doubled on a drifted order (up to 250 budgeted ledger calls plus an independent full-reader walk of up to ~250), raising Admin throttling and import-stall risk; the production-visible cost signal understates real transport by 71% on this workload.
- **Expected.** Work order §5: enforce before *every* actual Admin transport attempt at the D boundary; a fallback needs a finite predeclared allowance and must appear in the total per-order accounting; do not approximate a child-reader walk as one transport call.
- **Correction.** Route the drift fallback through a D-owned wrapper carrying a declared, finite fallback allowance, and report its real transport count.
- **In fairness.** The *scale harness* does count these at the boundary (`adminClassified.poll/scope/shop/fallback`, reconciling to `graphqlCalls` 10,393). The gap is in production enforcement and production-visible accounting, not the scale ledger.
- **Missing test.** A boundary-counted assertion that total per-order Admin transport, fallback included, stays within a declared allowance.

### SC-R-02 — P2 — aggregate scratch-byte cap is not enforced across concurrent attempts

- **Files:** `app/lib/order-facts/sync/source-stage.ts:681-685` (start-of-attempt snapshot) and `:707` (enforcement against that stale snapshot).
- **Evidence (executed).** Cap 61,440 bytes; two concurrent attempts in one namespace both returned `COMPLETE`; on-disk total **97,068 bytes = 158% of the declared cap** (`exceededCap: true`).
- **Merchant impact.** With `ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES = 2 GiB` and `MAX_SCRATCH_ATTEMPTS = 32`, worst case is ~64 GiB against a declared 2 GiB bound. This is not hypothetical: the envelope executed here peaked at **1,512,200,051 bytes for a single attempt** — 70% of the whole cap — so two concurrent million-line imports on one host exceed it and can exhaust worker disk.
- **Expected.** Work order §3: finite per-attempt **and aggregate/concurrency** resource accounting.
- **Correction.** Re-evaluate namespace bytes during spool, or reserve per-attempt quota atomically at creation.
- **Missing test.** Two concurrent attempts whose combined bytes exceed the aggregate cap must not both succeed.

### SC-R-03 — P2 — orphaned attempts are unreclaimable and unsurfaced; 32 crashes wedge D imports host-wide

- **Files:** `app/lib/order-facts/sync/source-stage.ts:78` (in-process `WeakSet` capability), `:349-361` (exhaustion), `:232` (`inspectDScratchNamespace`).
- **Evidence (executed).** Four orphaned attempt directories → the next `createOwnedScratchDir` threw `scratch_resource_exhausted`; `reclaimedAny: false`. The `SIGKILL` probe produced a genuine orphan (1 directory, 139,809 bytes) after real process death. `inspectDScratchNamespace` has **no production caller** — it is used only internally at create time.
- **Merchant impact.** After 32 crashed attempts, every D import on that host fails permanently. The operator sees only a generic `OPEN_PARENT_BOUND` import failure, with no exposed scratch/recovery status and no runbook.
- **Expected.** Work order §3 permits leaving unowned resources untouched, but requires exposing **bounded resource/recovery status**. Refusing to delete is correct; the absent status surface is the defect.
- **Correction.** Surface namespace occupancy (attempt count, bytes, oldest attempt age) through the existing diagnostics/health path and document the manual reclamation procedure.
- **Missing test.** Health/diagnostics output asserting leftover attempt count and bytes.

### SC-R-04 — P2 — receipt binding omits fence generation and Bulk/run identity

- **File:** `app/lib/order-facts/sync/import-receipt-binding.ts:67` (`void input.fenceGeneration;`) and `:88-104` (payload digest).
- **Evidence (executed).** For `fenceGeneration` 1n vs 999n: application keys identical (`order-facts-d-import-src-v1:order-facts-sync:job-1:gid://shopify/Order/1`) **and** payload digests identical. `syncRunId` and `bulkOperationGid` are likewise absent from both.
- **Merchant impact.** Bounded — content equality is still required, so no incorrect fact can be certified by content drift. But a changed fence, sync run or Bulk identity cannot fail closed at the receipt layer, and the source-epoch manifest that does bind them only protects scratch reuse within a single attempt.
- **Expected.** Work order §4: "changed query/API/**fence**/shop/**run**/**Bulk** identity … fail closed or use the tested safe fresh-run policy." Query, API version, shop and content are correctly bound; fence, run and Bulk identity are not.
- **Correction.** Either bind fence/run/Bulk identity into the payload digest, or record an explicit, reasoned decision that logical-epoch plus content binding supersedes them — and test it.
- **Missing test.** A changed fence generation on an already-receipted parent.

### SC-R-05 — P3 — final recheck does not verify agreement membership

Executed probe: an entirely different agreement GID at final recheck with an unchanged
parent `updatedAt` yields `complete`. §6 scoped the mandatory membership comparison to
refunds, so this is within contract; but the rationale that justified refund-membership
checking (an unchanged parent clock is not proof) applies equally to agreements, and the
recheck requests `agrFirst: 1`, so the response could not support a full comparison even
if one were added. Record as an accepted limitation or close it.

### SC-R-06 — P3 — no negative control binds the transport wrapper's hard-stop throw

Disabling only `consumeDTransportAttempt`'s throw leaves all 14 supplemental-ledger
tests green, because the ledger's own pre-checks and the frozen B per-walk budget mask
it; neutering the whole mechanism fails 7. Work order §9 required deterministic
negative controls for important guards. The backstop that stops a nested B reader
overrunning the aggregate allowance is currently unguarded by test.

### SC-R-07 — P3 — `importParentContentDigest` is order-unstable for id-less children

Executed probe confirms reordering two children without a string `id` changes the
digest. **Unreachable in production**: staging fails closed on a missing string id
(`source-stage.ts:750`). Defensive hardening of the exported helper only.

### SC-R-08 — P3 — unreproduced probe observation

See §6. Not attributed to the implementation.

## 10. Original-ID crosswalk

Original meanings preserved; nothing renamed or repurposed.

| ID | Disposition after this review |
|---|---|
| D-R-01, 04, 05, 06, 07, 08, 09, 12 | **RESOLVED** — independently re-executed (36 integration/worker tests, 42 exactly-once/D046, 29 dispatch recovery) |
| D-R-02, 03, 10, 11 | C3.5 dispositions hold; staging/EOF/unsigned-count/selected-field behaviour re-executed clean |
| N-01…N-07, N-09 | preserved; re-executed within the 296-test order-facts suite |
| N-04, N-05, N-06 | original meanings intact; **not** relabelled to unrelated passing scenarios |
| N-08 refund clock | **RESOLVED** — independent Refund clocks preserved; refund LIST membership compared even when parent `updatedAt` is unchanged (probe-confirmed) |
| N-08 scale/resource | **CLOSED by independent execution** — 1e6 envelope executed here; deterministic counters reproduce exactly (§8.2). No severity downgrade was taken on Cursor's word |
| Counter-evidence | preserved — the tested prior import did not destroy an already-populated agreement ledger; nothing here contradicts it |
| SC-01 | **PARTIALLY CORRECTED** — ownership/takeover/symlink/marker safety verified; SC-R-02, SC-R-03 open |
| SC-02 | **PARTIALLY CORRECTED** — zero-start replay, content-bound receipts, fail-closed mutation and legacy paths verified under real process loss; SC-R-04 open |
| SC-03 | **PARTIALLY CORRECTED** — ledger-scope aggregate cap verified by boundary counting; SC-R-01 open |
| SC-04 | **CORRECTED** — unconditional post-Refund recheck and refund-membership drift detection verified; SC-R-05 is a recorded limitation |
| R-176 | **OPEN / P0**, unchanged — outside this adjudication |
| R-164 | unchanged |

## 11. Executed / reused / unexecuted

**Executed by this reviewer:** everything in §8.4 and §8.5, the four probe families in
§4–§7, the `SIGKILL` recovery schedule in §6, the 1e6 envelope in §8.2, the external
sampler in §8.3, and the CI and identity verification in §2–§3.

**Reused as reported, not re-executed:** Cursor's before-fix reproduction JSON
(`sc_repro_before.json`, not present in the repository) and its three earlier failed
1e6 attempts. These are recorded as Cursor's claims; my conclusions do not rest on them.

**Not executed (out of scope or prohibited):** live Shopify or store calls, production
or deployment, flag enablement, merchant data, inventory writes, mark-ready, merge. No
implementation, no fix, and no modification of PR43, main, or any approved code, test,
schema, package or workflow.

**Blocked evidence:** none. No defect prevented any planned measurement.

## 12. Residual limitations of this review

1. Sampled peaks are observations, not bounds (§8.3 quantifies the miss).
2. The 1e6 envelope exercises the direct helper `runOrderFactsImportStep`; durable-worker dispatch/retry/receipt behaviour is covered by the separate suites and by the `SIGKILL` schedule, not at one million rows.
3. Admin transport is mocked throughout; no real Shopify endpoint was contacted.
4. The bounded-recheck contract is multi-request consistency checking, **not** server snapshot isolation. The implementation states this correctly and I confirm the characterisation.
5. The source-contract artifact's provenance limitation is recorded, not resolved.

## 13. Disposition

**CORRECTIONS REQUIRED.** Approval is withheld solely on SC-R-01…SC-R-04 (P2).
Mandatory independent scale/recovery/resource evidence is complete. PR #43 remains
OPEN / DRAFT / UNMERGED. D-054 remains the decision heading; no D-055. R-176 remains
OPEN / P0. R-164 unchanged. PR6 and Phase 1 remain IN PROGRESS. No later-phase or
production authorization follows.
