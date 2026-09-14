# PR #40 / PR6-C — final integrated independent Tier-A review

**Reviewer:** Claude Code (independent adversarial reviewer; not an implementation owner)
**Review date:** 2026-09-14
**Authority:** PR #40 comment [5671417865](https://github.com/Vedang1998/Stocky/pull/40#issuecomment-5671417865) (`user=Vedang1998`, `created_at=2026-09-14T22:02:09Z`)
**Scope:** one consolidated verdict over the original applicator findings (F-01…F-12), the evidence corrections (F-CR-01…F-CR-05), C-INTEGRATION-01, the shallow-checkout follow-up, and integration with merged B.
**Verdict:** `APPROVE PR6-C CANONICAL APPLICATOR FINAL INTEGRATION` — P0 0 / P1 0 / P2 0 / P3 3 (all dispositioned).

This artifact is additive and immutable. No previous review file was edited; both earlier C review blobs are byte-identical on this head.

---

## 1. Reviewed identities, ancestry and scope

| Item | Value | Verified |
|---|---|---|
| Subject PR | #40 | OPEN / DRAFT / UNMERGED, `mergeable_state: clean` |
| Exact integrated subject | `b4a9aeb3453b42ea74e499e0cb7b152d5635911f` | equals live PR head; no later push |
| Base / current main **U** | `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505` | equals `origin/main` |
| U sole parent **T** | `f5ec7abb01d14d5803e186b3e883fa15defad38f` | "Tooling: PR6 B/C Heavy timeout 120m and F-F03 harness repair (#42)" |
| U integration commit in C | `c76a5d3704e3e4285f4e1152b0ada005a5e946a6` | parents **exactly** `042e83563c8a8d367ae11df3fda6c0e10c6badd0` + `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505` |
| Ancestry | 36 ahead / **0 behind** U; merge-base(C, U) = U | |
| PR diff | **36** paths (21 apply, 11 C tests/harness, 3 docs, 1 mechanical inventory) | |
| `U^{tree}` | `84dbb800d45e7c7037ab87ee4dfc8a77de19ae56` — **equals** `7338aaa^{tree}` | U is a faithful squash of accepted B onto T |

Only one commit follows the integration: `b4a9aeb` ("Record authorized U merge identities and combined-tree evidence"), a documentation commit.

### 1.1 Preservation gate — all pass

| Check | Result |
|---|---|
| C `apply/` tree unchanged by the U integration | `cfdbb98fdd6e8db9238ac26a9648d69dde3baade` at `042e835…` **and** at `b4a9aeb…` |
| B `admin-read/` tree equals U | `8ae3d688c78ad71566a0b20071f395821a1fece6` at U **and** subject; **44/44** tracked paths both |
| Workflow blob equals accepted tooling | `8d1fa98a53db95f4e5b641fee76322cfe4f7ac13` at T, U and subject |
| Index-test blob equals accepted tooling | `8bfc6d8bacf4d307fff7e0b61fbf6315a734e347` at T, U and subject (matches the work order's stated blob) |
| Tooling review blob retained | `5a47f6f8133806848ad71a545e07c030a2137e37` at `PR6_BC_CI_RELIABILITY_INDEPENDENT_REVIEW.md` |
| First C review blob | `a90ae442a80ee593bb43bee3b15c2228f32d6e15` — unchanged |
| C correction review blob | `8c384b698bc45a7a9ac0a1dffa2ab8fdbcc65704` — unchanged |
| Combined inventory mechanically correct | U 416 + C's 32 scanned code files = **448**; findings 1741; violations 0; diff vs U is the count only |
| Unapproved schema / grant / scope / flag / D-runtime changes | **none** — no `prisma/`, `.github/`, `roles.ts`, `manifest.ts`, `shopify.app.toml`, `app/routes/`, `app/jobs/`, `app/sync/` paths in the diff |

`npm run tenant:access:inventory:check` on the combined tree returned `tenant_access_inventory_fresh`, independently confirming the 448 count.

---

## 2. Executed evidence — environment

| Property | Value |
|---|---|
| PostgreSQL | **16.13** (Ubuntu 16.13-0ubuntu0.24.04.1), disposable cluster, port 55433, `max_connections=100` |
| Roles / enforcement | `migrate deploy`, `tenant:indexes:apply --apply`, `tenant:roles:provision --apply`, `tenant:enforcement:apply --apply`, `tenant:enforcement:verify` — all exit 0 |
| Node / npm | v22.22.2 / 11.5.2 (CI-pinned) |
| Codegen prerequisite | `npm run graphql-codegen` exit 0 before unit tests |
| Worktrees | disposable: integrated subject `b4a9aeb`, pre-integration `042e8356`, plus two genuinely shallow clones |
| Subject tree | left pristine; all reviewer probes removed before gates |

### 2.1 Local gates on the integrated subject

| Gate | Exit | Result |
|---|---|---|
| `npm run lint` | 0 | pass |
| `npm run typecheck` | 0 | pass (combined B+C) |
| `npm run build` | 0 | pass |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| `npm test` (unit) | 0 | **58 files / 556 tests passed** — matches integrated CI |
| C-owned PostgreSQL suites | 0 | **140 passed / 1 skipped** (canonical 82, gates 9, process-loss 11, safety 15, probe 17, scale 7-with-1-skipped) |
| Actual-reader PostgreSQL suite | 0 | **18/18** |

---

## 3. Original findings F-01 … F-12 — independent adjudication

The prior correction artifact explicitly did **not** re-derive F-01–F-08. That gap is filled here. I re-ran **my own first-pass adversarial probes** (PROBE-A…H, J/L/M, F04) against the corrected module rather than relying on the submitted tests. Nine of ten passed on the first execution; the tenth was my own fixture error and is resolved below.

| ID | Sev | Verdict | Independent evidence |
|---|---|---|---|
| F-01 | P1 | **CLOSED** | Direct Refund `ABSENT_CONFIRMED_QUERY` now tombstones the refund row: `outcome=applied reason=confirmed_tombstone`, `existenceState=ABSENT`, `existenceKind=ABSENT_CONFIRMED_QUERY`, `deletedAt` set, `deletionSource=CONFIRMED_QUERY`. Previously a silent `noop`. |
| F-02 | P1 | **CLOSED (Order and Refund)** | Order: interval advances to `[9,10]` after the newer LIVE; delayed ABSENT `[5,6]` yields `outcome=conflict reason=absent_not_later` and the row stays `LIVE` with `deletedAt` NULL. Refund root: same rule, interval ≥ 9, stays LIVE. |
| F-03 | P1 | **CLOSED** | Active unexpired Refund blocker under a *valid* Order: `outcome=blocked reason=active_blocker`, `childrenApplied=false`, **0** `ShopifyOrderRefundFact` rows and **0** refund lines. Previously a LIVE refund subtree was created. |
| F-04 | P1 | **CLOSED** | See §3.1 — five recovery variants executed. |
| F-05 | P1 | **CLOSED** | Forged `lastConfirmedAccessScopes: []` against a persisted `read_all_orders` floor: `outcome=noop reason=scope_continuity_denied`, diagnostic `ORDER_SCOPE_DOWNGRADE_VOIDS_ABSENCE`, row stays LIVE. The caller value is no longer authority. |
| F-06 | P1 | **CLOSED** | Complete newer parent omitting a line/sale marks **both** omitted children `ABSENT` and retains them (no DELETE). Refund child shrink: omitted ordinal 1 becomes `ABSENT`, exactly one LIVE child, parent total `10.000000` consistent. |
| F-07 | P2 | **CLOSED** | Fabricated `read_all_orders` against a durable row holding only `read_orders` throws `order_apply_access_scope_mismatch` and writes **0** rows. |
| F-08 | P2 | **CLOSED** | Empty new batch returns `receiptStatus: "none"` with **0** receipt rows. |

### 3.1 F-04 — failed/incomplete/blocked cannot certify, and the corrected retry must write

Five variants, all executed on real PostgreSQL:

| Variant | Result |
|---|---|
| Rejected apply (malformed `netPaymentSet`) | throws `order_apply_receipt_not_certifiable`; **0 orders / 0 receipts** |
| **A** stale in-flight row from the rolled-back attempt, lease still valid | fresh token is `blocked:active_blocker`; still **0/0**. Correct fail-closed — no receipt minted on a blocked batch |
| **B′** after the stale lease **genuinely** expires | applicator abandons it (`abandonedBlockerTokens: ["f04bp1"]`, row → `ABANDONED`), applies, **1 order / 1 receipt** |
| **C** retry reusing the same observation token | applies, **1 order / 1 receipt** |
| **D** second apply, same key + digest | `already_applied`, still **1 order / 1 receipt** — no duplication |
| **E** same key, **different** digest | `order_apply_receipt_digest_conflict`; the original single receipt preserved |

My first F-04 probe failed because I gave the stale observation an artificial one-hour lease. Investigating that produced a **positive control worth recording**: trigger `trg_orderfactobservationinflight_set_lease` fires `BEFORE INSERT OR UPDATE` and re-derives `leaseExpiresAt` from `leaseDurationMs`, so a lease **cannot be forged** — my direct `UPDATE … leaseExpiresAt = now() - 1 hour` was silently re-derived. Variant B′ therefore used a genuine short lease. This is an A+C fencing strength, not a defect.

### 3.2 Batch atomicity, duplicate-receipt concurrency and lock ordering

Covered by evidence gates (§5) and independently re-run: Gate D serializes on the application key **before** the missing-receipt lookup so a loser cannot commit a disjoint identity set, and the different-digest loser fails closed writing no disjoint facts. Gate B proves reverse identity input order completes without unbounded wait. Per the work order I did **not** demand a fabricated deadlock: deterministic lock ordering prevents that schedule, and the prevention itself is what Gate B demonstrates.

### 3.3 The four original P3 compatibility dispositions

| ID | Verdict | Evidence |
|---|---|---|
| F-09 restock / location / ordinal | **CLOSED by B, preserved by C** | My original finding was accurate against the then-current B (pin `d9717f68`), which selected only `restockType`. The integrated B now selects `restocked` and `location { id }` and emits a real `refundLineOrdinal`; `RefundLineRead` carries all three. C persists them. Verified in B source at the integrated tree and by the actual-reader suite. |
| F-10 null parent identity | **CLOSED** | A real B refund with `orderId=null` is blocked and writes no canonical row; an enclosing Order GID from a nested refund is used; a contradictory returned parent GID is blocked. No `String(null)` cast, no nullable schema change. |
| F-11 at-sale identity provenance | **CLOSED with documented residual** | Two real B reads with a later differing current variant do not overwrite stored `variantGidAtSale`. First-read copying of the current GID onto the at-sale field remains a source limitation, correctly documented and owned as a D residual. |
| F-12 decimal / discount authority | **CLOSED** | Malformed required decimal on a `status:"complete"` B payload is rejected by C before any success or receipt. `discountedTotalSetWithCodeDiscounts` is the single canonical authority; `withoutCodeDiscounts` is not a fallback. |

---

## 4. F-CR-01 … F-CR-05 — verified

| ID | Verdict | Independent verification |
|---|---|---|
| F-CR-01 | **CLOSED** | §6.5.1 now states the skipped envelope (2 ms) and process-loss (~8.2 s) did **not** explain the 70-minute cancellation, and labels `5e8fbd2` **defensive hardening, not a demonstrated fix**. It separates **queued** time (~162 min before `startedAt`) from **executing** time (~70m22s) explicitly — "Queued time is not executing time." This is the correction I asked for. |
| F-CR-02 | **CLOSED** | The policy assertions are no longer tautologies. They parse the **live** `.github/workflows/ci.yml` validate-job `timeout-minutes` (120), assert it differs from the classify job's 10, and — decisively — mutation-test the parser (`fixture.replace("120","45")` → 45), plus negatives rejecting a `beforeAll` reset and a `describe.skipIf` reset. |
| F-CR-03 | **CLOSED** | The 1e6 counts/timing are attributed to the pre-delta harness, with the current discovery (7 collected / 1 skipped) recorded separately. My own runs observe exactly `7 tests | 1 skipped`. |
| F-CR-04 | **CLOSED** | Both parks are asserted **individually** (`killBeforeParkMs`, `killAfterParkMs`), and two separate mutation tests prove effectiveness: changing **either** park alone to 60 s makes `assertChildParksAtMost` throw. My original weak-regex finding is resolved. Interruption schedules and `reapAbandonedBackend` / `pg_terminate_backend` / 2 s `waitExit` preserved. |
| F-CR-05 | **CLOSED** | §6.5 keeps historical-failed, historical-successful, exact-T, exact-U and current-head CI as distinct rows and refuses to mark pending runs green. The report was written before the two runs finished and says so; the **PR metadata now records both as SUCCESS**. Per the work order this is not a defect and no stamping commit is warranted. |

---

## 5. Evidence gates A–E

Executed by me on disposable PostgreSQL — 9/9 pass:

| Gate | Coverage confirmed |
|---|---|
| A | interrupt **before** commit leaves neither facts nor receipt; interrupt **after** commit keeps facts+receipt and the retry does not duplicate; adversarial receipt deletion is labelled separately and does not mint a second order row |
| B | reverse identity input order completes without unbounded wait (prevention proof, not a fabricated deadlock) |
| C | contended identity lock times out, rolls back and retries on a **fresh** transaction; `processingEnabled` flip while waiting is re-checked after the lock grant |
| D | application-key lock serializes before the missing-receipt lookup; different-digest loser fails closed with no disjoint facts |
| E | C-specific apply / child-replacement scale on synthetic order facts |

Real process/session loss is covered by the separate 11-test suite (SIGKILL before/after commit, `pg_terminate_backend`, uncertain commit, socket destroy, plus the four park-bound source tests), which I re-ran: 11/11.

### 5.1 Million-line envelope — independent scale coverage executed

The historical 1,000,000-line measurement (912.06 s, `lineFacts=1000000`) was taken against an **earlier apply tree**. The apply tree changed afterwards at `360d958` (F-01–F-08 fixes, tree `0b9ce373`) and `0474fec` (receipt certification / Refund existence, tree `cfdbb98f`). F-06 in particular **added child-absence marking on complete-parent replacement**, which is exactly the write path the envelope's 500→1 replacement exercises. An equivalence argument therefore does **not** hold, so I did not reuse it.

The envelope is opt-in (`PR6_C_SCALE_1E6=1`, asserted off under `GITHUB_ACTIONS`) and is intentionally skipped in CI — confirmed in the integrated Heavy log as `7 tests | 1 skipped` in **7 ms**, which also proves the skip performs no database setup.

**Executed independently on the current apply tree `cfdbb98f…`** (`PR6_C_SCALE_1E6=1`, disposable PostgreSQL 16.13):

| Field | Observed |
|---|---|
| Result | **7 / 7 passed**, exit 0 (envelope not skipped) |
| Duration | **1657.95 s** (envelope `it` 1 657 204 ms) |
| `lineFacts` | **exactly 1 000 000** (verified directly: `SELECT count(*) FROM "ShopifyOrderLineFact"` = 1000000) |
| `batches` | 1000 |
| `setupMs` / `applyMs` / `replacementMs` | 1681 / 1 645 177 / 151 |
| `queryCount` | 3 484 058 |
| RSS | 148 291 584 → 154 832 896 bytes (bounded, +6.5 MB across 1e6 facts) |
| High-child parent after 500→1 replacement | **LIVE = 1, ABSENT = 499** |

The `LIVE=1 / ABSENT=499` result is the point of re-executing: it exercises the **F-06 child-absence correction at 1 000 000-fact scale on the corrected code**, showing the 499 omitted children are marked `ABSENT` and **retained** (no physical delete) while exactly one child stays LIVE. The historical measurement could not have covered this, because that behaviour did not exist when it was taken.

`queryCount` is identical to the historical run (3 484 058), confirming the same workload shape. `applyMs` is higher than the historical 904 601 ms purely because this reviewer container is single-core-bound; that is an environment difference, not a regression. Memory remained bounded.

**Conclusion:** required independent scale coverage is **executed, not reused and not reported as a gap**.

---

## 6. C-INTEGRATION-01 and the shallow-checkout follow-up

### 6.1 Mode selection and source identity — independently proven

I did not rely on the suite's own reporting. A reviewer-authored probe called the real `prepareBAdminReadForCTests` and inspected what it returned and what Node actually loaded:

```
MODE:   {"mode":"integrated","dir":"<checkout>/stocky-plus/app/lib/order-facts/admin-read","scratchRoot":null}
BLOBS:  {"tracked":44,"acceptedPaths":44,"matchAccepted":44,"mismatches":[]}
ONDISK: {"files":44,"agree":44}
READER: {"resolved":"<checkout>/.../admin-read/orders.ts","insideThisCheckout":true,
         "blob":"b5ce0d53cf29c8b370065330f1a3e84c55c7096d","trackedBlob":"b5ce0d53cf29c8b370065330f1a3e84c55c7096d"}
PRESERVE: {"equal":true,"statusEqual":true,"diffEqual":true}
```

- Combined mode selects **integrated**, points at the live checkout, and creates **no** scratch worktree.
- All 44 tracked blobs equal the **accepted** B tree.
- The executed reader module resolves inside this checkout and its `git hash-object` equals `HEAD`'s blob — this is real reader execution, not copied types or a test-local mapper.
- On-disk hashes are non-empty (44) and agree with the index.
- Working-tree bytes, `status --porcelain` and `diff` are byte-identical across preparation.

**Material fact recorded rather than asserted.** My probe initially asserted the accepted tree must differ from pin `610ed050`. It does not: the `admin-read` subtree object is **identical** (`8ae3d688`) at the pin, at accepted `7338aaa`, and at U. B's readers did not change between pin and acceptance. A substitution is therefore content-neutral for reader behaviour; only commit identity distinguishes them, and the code correctly requires the accepted commit.

### 6.2 C-only mode

Executed on a genuine pre-integration worktree (`042e8356`, **0** tracked admin-read paths): safety **15/15** and actual-reader **18/18**, selecting `pinned-scratch`. Repeating the whole run: **33/33** again, with no stale or orphaned git worktrees (`git worktree prune --dry-run` empty).

### 6.3 Shallow checkout — reproduced from a genuinely shallow clone

A fresh `git clone --depth=1 --single-branch` of the subject (`is-shallow-repository = true`) in which `7338aaa`, `610ed050` and U were all **absent**:

| Requirement | Observed |
|---|---|
| Missing accepted-B commit before fetch | `7338aaa` → `fatal: … could not get object info` |
| Fetching `610ed050` does not substitute for `7338aaa` | after fetching the pin, `610ed050` is a `commit` while `7338aaa` remains missing |
| Archive of the absent accepted commit fails clearly | `git archive 7338aaa…` → exit 128, `fatal: not a tree object: 7338aaa…` |
| Archive uses the requested accepted commit | after an explicit `--depth=1` fetch: exit 0, 286 720 bytes, **44** `.ts` entries, tree `8ae3d688` |
| Missing / unknown objects fail clearly | `fatal: remote error: upload-pack: not our ref deadbeef…` |
| No dependency on session-local objects | both suites run **inside the fresh shallow clone**: **33/33** pass; the clone remains shallow with no orphaned worktrees or leftover `refs/tmp` |

The fetch path is genuinely exercised: both B commits were absent at clone time and present after the run.

### 6.4 Fail-closed, partial failure, cleanup ownership and idempotence

The 15-test safety suite — which I executed in three distinct environments (integrated worktree, pre-integration worktree, fresh shallow clone) — covers every contract item: pre-existing unowned production path fails closed and is not deleted; a symlink production path is refused and not followed; a **real** failure is induced via `afterScratchCreated` after the owned worktree exists and only that scratch is cleaned; cleanup refuses foreign and planted-marker paths and refuses to delete a repository path; repeated materialize stays on owned scratch; an empty inventory map is valid only on an isolated C-only fixture and is rejected for tracked-B.

---

## 7. Pre-U F-F03 failure — adjudication

**Run** [34886822386](https://github.com/Vedang1998/Stocky/actions/runs/34886822386) on `042e83563c8a8d367ae11df3fda6c0e10c6badd0`, Heavy job `104119441376`: terminal **FAILURE** (not cancelled). Migrations **1 failed / 631 passed / 1 skipped (633)**. C overlay safety **15/15** and actual-reader **18/18** passed in that same job.

**Correction to the reported location.** PR metadata cites `indexes.migration.test.ts:1130`. The raw log shows the assertion at **line 1210** inside `overlapWritesWithActiveScan`, with the caller at line 1284:

```
AssertionError: expected true to be false
 ❯ overlapWritesWithActiveScan scripts/tenant-indexes/tests/indexes.migration.test.ts:1210:32
    1210|           expect(buildSettled).toBe(false);
 ❯ scripts/tenant-indexes/tests/indexes.migration.test.ts:1284:38
```

**Mechanism (determined from source, not inherited).** The merged T repair makes phase *entry* deterministic with two gate transactions: `gate1` parks CIC at "waiting for writers before build" and `gate2` at "waiting for writers before validation". It does **not** and cannot hold a scan phase *open*. The failing assertion is the **post-burst** re-check that the build is still in the same scan phase after the trigger observation, a three-statement DML burst and a post-sample.

**Quantified margin.** The whole `CREATE INDEX CONCURRENTLY` over `ACTIVE_PHASE_ROW_COUNT = 400 000` completes in ~170–250 ms (`buildDurationMs` 200.8 / 212.0 / 166.5 in the failing run; 247.6 in the passing integrated run), while each individual DML write takes ~1–5 ms. The observation window inside a *single* scan phase is a fraction of ~200 ms with no mechanism to extend it.

**Disposition.** This is a **remaining timing-sensitive observation assertion**, not a concurrency-proof defect:

- Every trigger-time safety assertion passed even in the failing run — `ShareUpdateExclusiveLock` present, `AccessExclusiveLock` absent, remaining tuples/blocks non-zero.
- The failure mode is `buildSettled` turning true, i.e. the index finished building. That is not a lock escalation, anomaly or data defect.
- The sibling deterministic test "REPEATABLE READ overlap: ShareUpdateExclusiveLock, no AccessExclusiveLock, 10 iterations" **passed in both runs** and is the genuine lock-safety proof.
- The harness blob `8bfc6d8b…` is byte-identical at M, `042e8356` and this subject; C never touched `scripts/tenant-indexes/`. Identical code produced one failure and one pass.

**Severity P3. Owner: tooling (T / PR #42 lane), not C and not B.** A subsequent pass does **not** prove resolution — the ~200 ms window with no holding mechanism means recurrence should be expected. I did not edit, relax, retry-to-green, or open a tooling lane, per scope. **It does not block PR6-C**: it is outside C's ownership, C cannot influence it, and the integrated exact-head run is green.

---

## 8. Exact-head CI — independently verified

| Class | Run | Head | Jobs | Result |
|---|---|---|---|---|
| Exact-U post-merge `push` | [34891789836](https://github.com/Vedang1998/Stocky/actions/runs/34891789836) | `1ec7af31…` | Classify `104136027179`, Heavy `104136080253` (**150 steps**), Gate `104154438171` | all **SUCCESS** |
| Exact integrated C `pull_request` | [34893896613](https://github.com/Vedang1998/Stocky/actions/runs/34893896613) | `b4a9aeb…` | Classify `104142965104`, Heavy `104143005584` (**150 steps, not SKIPPED**), Gate `104163586700` | all **SUCCESS** |

All job IDs and head SHAs match the work order exactly. Distinguishing the four categories the work order asks for, from the integrated Heavy log:

- **Full Heavy execution** — 150 steps executed; `event=pull_request`; head equals the live PR head.
- **Intentional opt-in envelope skip** — `pr6-c-scale-envelope.test.ts (7 tests | 1 skipped) 7ms`; the 7 ms proves the skip opens no database.
- **Complete migration-corpus counts** — **67 files, 632 passed / 1 skipped (633)**, 1204.83 s. The pre-U failing run was the same 633 with **1 failed / 631 passed**; the sole delta is F-F03.
- **Focused local counts** — my own C-suite runs (140 passed / 1 skipped) and unit suite (58 files / 556 tests) reconcile file-for-file with the CI job.

---

## 9. Findings and residual risk

No P0, P1 or P2 finding survived this review. Three P3 residuals, each with an explicit disposition:

### P3-FINAL-01 — F-F03 remains an intermittent tooling assertion
As adjudicated in §7. **Owner:** tooling lane. **Disposition:** accepted as a non-blocking residual for PR6-C; C must not edit it. Recurrence is expected until the harness gains a way to hold a scan phase open (or the post-burst assertion is reframed as an observation rather than a requirement). Recorded so a future pass is not mistaken for resolution.

### P3-FINAL-02 — safety-fixture temporary directories are not cleaned
Each safety-suite run leaves ~13 directories under `/tmp` (`pr6-c-overlay-repo-*` ×9 plus `pr6-c-foreign-*`, `pr6-c-marked-*`, `pr6-c-symlink-target-*`, `pr6-c-unowned-keep-*`), ~3 MB per run; I measured 39 dirs / 9.1 MB across three runs. **These are standalone git repos with their own `.git`, not worktrees of the subject**, and `git worktree list` / `git worktree prune --dry-run` stay clean, so the contract item "cleanup removes only owned resources and leaves no new orphaned worktrees" is **satisfied**. Several (`unowned-keep`, `foreign`, `symlink-target`) are deliberately preserved to prove cleanup does not delete unowned paths. **Disposition:** non-blocking hygiene residual; worth a fixture-local cleanup in a future tooling pass, no C change required.

### P3-FINAL-03 — F-11 at-sale provenance on first read
A first B read necessarily copies the current catalog GID onto both at-sale and current fields, because the source cannot verify the checkout-time link. Later reads correctly never overwrite `variantGidAtSale`. **Disposition:** documented source limitation, already recorded as a D residual; no C change available.

**Carried risks, unchanged by this review:** **R-176 remains OPEN / P0** — D still owns fetch/window/scope integration, webhook/import and reconciliation evidence. **R-164** unchanged. Phase 1 remains **IN PROGRESS**. **D-054** remains the authority; **no D-055**. No D runtime or production authorization follows from this review.

---

## 10. Mandatory coverage still unexecuted

None material. For completeness, the following were reasoned rather than executed and are unchanged from the earlier artifacts' disclosures: a forced `40P01` deadlock (deliberately not demanded — §3.2 proves prevention instead), and multi-shop production-scale load beyond the executed 1,000,000-line envelope.

---

## 11. Safety state

- PR #40 was **not** modified, rebased, marked ready, or merged. Head remains `b4a9aeb3453b42ea74e499e0cb7b152d5635911f`.
- PR #39 / `phase-1/pr6-b-order-admin-read`, `main` (`1ec7af31…`), and the accepted tooling files were **not** modified.
- Both earlier immutable C review artifacts are byte-identical on this head; no historical `CORRECTIONS REQUIRED` artifact was edited.
- No schema, privilege, dependency, CI configuration or D-runtime change. No production or merchant data, no store calls, no scope or flag changes.
- All database work ran on a disposable local cluster; all reviewer probes were removed before the gates and are not part of any commit.

---

## 12. Verdict

Every original P1/P2 finding was independently re-derived against the corrected module with my own first-pass adversarial probes — not by trusting the submitted tests — and every one is genuinely closed, including the Refund-identity existence family, interval ordering on both roots, blocked-refund fencing, receipt certification with all five same-key recovery paths, the persisted scope floor, and §5.1 child absence. The four P3 compatibility dispositions are closed or correctly owned. All five F-CR items are corrected with real, mutation-effective assertions. C-INTEGRATION-01 and the shallow-checkout hole are closed and reproduced from a genuinely shallow clone with real integrated-reader execution. Evidence gates A–E pass, and I executed the 1,000,000-line envelope on the current apply tree rather than reusing non-equivalent historical evidence.

The one outstanding failure, F-F03, is a timing-sensitive assertion in tooling-owned code that C never touched and cannot influence; it is dispositioned P3 with its mechanism and margin quantified, and it does not block this module.

Exact-head full CI is SUCCESS on both the U push and the integrated C pull request, mandatory coverage is complete, and no P0, P1 or P2 finding remains.

`APPROVE PR6-C CANONICAL APPLICATOR FINAL INTEGRATION`
