# Phase 1 PR6 — Repository Implementation Closure Report

**Status:** `PR6 REPOSITORY IMPLEMENTATION TECHNICALLY ACCEPTED AND MERGED; FORMAL REPOSITORY CLOSURE PENDING THIS CLOSEOUT PR’S INDEPENDENT ACCEPTANCE AND OWNER MERGE`
**Phase 1:** `IN PROGRESS`
**PR 6 overall:** `IN PROGRESS` until this closeout PR is independently reviewed, ChatGPT-accepted, and owner-merged
**PR6-A:** `ACCEPTED / MERGED / CLOSED` (repository-foundation lane)
**PR6-B:** `ACCEPTED / MERGED / CLOSED` (repository Admin READ lane)
**PR6-C:** `ACCEPTED / MERGED / CLOSED` (repository canonical-applicator lane)
**PR6-D:** `TECHNICALLY ACCEPTED AND MERGED` (repository webhook / import / reconciliation module)
**PR7 runtime:** `NOT AUTHORIZED`
**PR45:** separate unaccepted planning assignment — **not** closeout authority
**Production:** `NOT AUTHORIZED`
**Merchant production data:** `NOT AUTHORIZED`
**Shopify writes / inventory writes:** `NOT AUTHORIZED`
**Inventory-write flags:** `DEFAULT OFF`
**`FEATURE_PR5_ABSENCE_TOMBSTONE`:** `DEFAULT OFF`
**`read_all_orders` / `write_orders` / live subscription registration:** `NOT AUTHORIZED`
**D-054:** `EFFECTIVE` — remains the implementation-authority / current-lane record (**no D-055**)
**Monday 7 September 2026 target:** **missed** (not re-dated)

This report is the durable A/B/C/D repository closeout dossier for Phase 1 PR 6 after independently reviewed squash-merges onto `main` and independently verified exact-squash push CI.

It is **not** D-055. Existing **D-054 EFFECTIVE** remains the implementation authority.

It does **not** state that Phase 1 is complete.

It does **not** authorize PR7 runtime, production, merchant production data, deployment, production migrations, Shopify inventory mutations, live webhook registration, `read_all_orders`, `write_orders`, or any inventory-write / absence-tombstone flag enablement.

**Present state (truthful at publication of this closeout branch):** PR6 repository implementation is **technically accepted and merged**. Formal PR6 repository closure is **pending** this closeout/control PR’s independent Claude documentary/control review, ChatGPT closeout/risk disposition, and owner merge. This file does **not** invent a closeout squash SHA or a premature closure timestamp.

**Effective-on-merge clause:** Formal PR6 **repository** closure becomes effective only when this closeout/control PR is independently reviewed, ChatGPT-accepted, and owner-squash-merged to `main`. Until that merge, live wording remains **technically accepted and merged; formal closure pending**. After that merge, later current-main synchronization may record the actual squash identity. Do **not** treat this documentation commit’s own SHA as that future squash.

Do **not** edit any immutable independent-review artifact.

## Authority

| Field | Value |
|---|---|
| Implementation authority | **D-054** — Phase 1 PR 5 implementation authorization under Accelerated Safe Delivery v1 — **EFFECTIVE** (PR [#26](https://github.com/Vedang1998/Stocky/pull/26)). PR6 A/B/C/D executed under this same heading. |
| D-055 | **Not created** |
| Closeout authority | PR [#43](https://github.com/Vedang1998/Stocky/pull/43) comment [5745082755](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5745082755) — documentation-only closeout/control PR; not a new decision number |
| D technical acceptance | **ACCEPT PR6-D REPOSITORY IMPLEMENTATION** — comment [5744256383](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5744256383) |
| Earlier C-head technical acceptance | **ACCEPT PR6-D QUOTA-EVIDENCE AND INDEX CORRECTION** — comment [5743346411](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5743346411) |
| Owner squash-merge verification | comment [5744321465](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5744321465) |
| Post-merge CI acceptance | comment [5745082755](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5745082755) |
| Canonical governance | `../../ACCELERATED_SAFE_DELIVERY.md` |
| Closure report | this file |
| Accepted residual backlog | `PR6_ACCEPTED_RESIDUAL_BACKLOG.md` |
| Planning packet | `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md` (**ACCEPTED / MERGED** via PR #34) |
| A closure | `PR6_A_CLOSURE_REPORT.md` (dated source record; live current-main sentences in that file are **historical**) |
| B/C closure | `PR6_BC_CLOSURE_REPORT.md` (dated source record; live current-main sentences in that file are **historical**) |
| D execution brief | `PR6_D_EXECUTION_BRIEF.md` (dated admission/execution contract; not rewritten here) |
| D implementation report | `PR6_D_IMPLEMENTATION_REPORT.md` (dated Cursor execution record; header still says draft PR #43 — **historical**; not rewritten) |
| D scratch runbook | `PR6_D_SCRATCH_OPERATOR_RUNBOOK.md` (operator-only; not a production order) |

ChatGPT owns risk-status closure. This closeout **recommends** scoped dispositions; it does **not** autonomously close register rows.

## Frozen identities independently verified for this closeout

Verified at closeout start against `origin/main` after `git fetch origin main`, Git objects, and GitHub API. Unexpected main drift was not observed.

| Identity | Value | Evidence class |
|---|---|---|
| Required current `origin/main` / squash **W** | `ee193f38491245a10fb2fa60d2cf9a29f3271605` | Git `origin/main` HEAD |
| **W** sole parent **V** | `a3ff480f1477237f8055f10c43298480a05728a1` | `git log -1 --format='%P'` |
| **W** tree | `b24d75b56a6b371608c450c87bcd887dd4a056c1` | `git rev-parse W^{tree}` |
| Final accepted PR43 head **R** | `ef2b98c42c69f76303c44d0809058ca3c7f3052b` | Git object; PR #43 merged source |
| **R** sole parent / accepted implementation **C** | `ca33d9a7871fd0eef77d19d06cbe2bfae47dad0b` | `git rev-parse R^` |
| **R** tree | `b24d75b56a6b371608c450c87bcd887dd4a056c1` | equals **W** tree |
| C→R delta | one commit, one added file: `PR6_D_QUOTA_EVIDENCE_INDEX_CORRECTION_INDEPENDENT_REVIEW.md` | `git diff --name-only C R` |
| PR #43 | **CLOSED / MERGED** at `2026-09-19T18:22:10Z` by `Vedang1998` | `gh pr view 43` |
| Merge commit | **W** | GitHub `mergeCommit.oid` |
| Exact-R pre-merge `pull_request` | run [`35454095462`](https://github.com/Vedang1998/Stocky/actions/runs/35454095462) SUCCESS — Classify `105926221581`; full Heavy `105926241939` (not SKIPPED); Gate `105935283293` | GitHub Actions; **R-only** |
| Exact-W post-merge `push` | run [`35460969411`](https://github.com/Vedang1998/Stocky/actions/runs/35460969411) SUCCESS — Classify `105944643820`; full Heavy `105944660979` (not SKIPPED); Gate `105953807735` | GitHub Actions; **W-only** |
| Exact-C `pull_request` (implementation subject) | run [`35440638530`](https://github.com/Vedang1998/Stocky/actions/runs/35440638530) SUCCESS — Classify `105890696932`; full Heavy `105890713641`; Gate `105898679904` | **C-only**; not a substitute for R or W |

Use merged **W** as live-main authority. Older uploaded packets and historical admission records do not override **W** or the completed reviews.

This closeout branch: `phase-1/pr6-formal-closeout-b15d` created from exact **W**. Platform-required suffix `-b15d` is reported verbatim. No existing matching closeout writer/PR was found before starting (open PRs to `main` were #45 planning, #41 parked tooling, #38 docs audit).

## Implementation lineage

```text
PR6 planning (#34) → PR6-A M (#37) → PR6-B U (#39) ∥ PR6-C V (#40)
                                              └─ PR6-D W (#43)  → this closeout (pending)
```

Parked PR [#41](https://github.com/Vedang1998/Stocky/pull/41) remains unmerged tooling and is **not** a D writer. PR [#45](https://github.com/Vedang1998/Stocky/pull/45) remains a **separate, unaccepted** PR7 planning lane and is **not** edited or adopted here.

### PR6 planning — ACCEPTED / MERGED

| Field | Value |
|---|---|
| PR | [#34](https://github.com/Vedang1998/Stocky/pull/34) — **CLOSED / MERGED** |
| Squash | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` at `2026-09-07T00:53:25Z` |
| Independent verdict | `APPROVE PR6 CURRENT-MAIN PLANNING` |
| Immutable review blob | `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` (never edit) |
| Earlier planning reviews (never edit) | original `d72340c01dd9c662d0e8bb4aa8d43482940470d9` (`CORRECTIONS REQUIRED`); correction `fca2b260d03e3105782ed216f7773c53e6aef2a7` (`CORRECTIONS REQUIRED`) |
| Post-merge CI | run `34071226302` SUCCESS (Classify `101588830168` SUCCESS; Heavy `101588852919` SKIPPED; Gate `101588852489` SUCCESS) |
| Lane state | **ACCEPTED / MERGED** (planning). PO-01 … PO-11 frozen. Proposed risks remapped **R-166…R-185**. |

### PR6-A foundation — ACCEPTED / MERGED / CLOSED

| Field | Value |
|---|---|
| PR | [#37](https://github.com/Vedang1998/Stocky/pull/37) — **CLOSED / MERGED** |
| Accepted merged subject | `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02` |
| Squash **M** | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` at `2026-09-11T20:07:27Z` |
| `M^{tree}` | `9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc` |
| ChatGPT disposition | **ACCEPT PR6-A FOUNDATION** — [5638553192](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5638553192) |
| Original review blob | `198e55548a2ca09942843798a9ebd3e03a30d0fa` — `CORRECTIONS REQUIRED` (never edit) |
| Correction review blob | `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` — **`APPROVE PR6-A FOUNDATION CORRECTION`** (never edit) |
| Exact-M push CI | run [`34642536795`](https://github.com/Vedang1998/Stocky/actions/runs/34642536795) SUCCESS — Classify `103405479267`; full Heavy `103405514450` (not SKIPPED); Gate `103422700596` |
| Closure | `PR6_A_CLOSURE_REPORT.md` |
| Lane state | **ACCEPTED / MERGED / CLOSED** for the repository-foundation lane |

**A-only scope closed:** additive order/refund schema and successor existence CHECKs, tenant/RLS/grants, observation-in-flight, lock-key/advisory-lock foundation, types-only `app/lib/order-facts/{types,constants,lock-key,advisory-lock}.ts`, nullable-first `Shop.ianaTimezone` / `Shop.currencyCode`, exact-money-capable columns. Not Admin extraction, apply, webhooks, import, or production.

### Tooling PR #42 — ACCEPTED / MERGED (historical)

| Field | Value |
|---|---|
| PR | [#42](https://github.com/Vedang1998/Stocky/pull/42) — **CLOSED / MERGED** |
| Squash **T** | `f5ec7abb01d14d5803e186b3e883fa15defad38f` at `2026-09-14T02:27:29Z` |
| Independent verdict | `APPROVE PR6 B/C CI RELIABILITY` |
| Immutable review blob | `5a47f6f8133806848ad71a545e07c030a2137e37` (never edit) |
| Scope | Heavy `timeout-minutes: 120` + F-F03 index-harness repair. No B/C product runtime. |
| Later | superseded as current main by **U** then **V** then **W** |

### PR6-B Admin READ — ACCEPTED / MERGED / CLOSED

| Field | Value |
|---|---|
| PR | [#39](https://github.com/Vedang1998/Stocky/pull/39) — **CLOSED / MERGED** |
| Accepted integration subject | `7338aaa45294c28526330aa259779308bd6d851e` |
| Squash **U** | `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505` at `2026-09-14T20:15:14Z` |
| Original review blob | `b4533610b5af305816aef5434b884c3065b06f94` — `CORRECTIONS REQUIRED` (never edit) |
| Correction review blob | `e902a1ce07e30174cd56cea13114be7325195c98` — **`APPROVE PR6-B ADMIN READ CORRECTION`** (never edit) |
| Exact-U push CI | run [`34891789836`](https://github.com/Vedang1998/Stocky/actions/runs/34891789836) SUCCESS — Classify `104136027179`; full Heavy `104136080253` (not SKIPPED); Gate `104154438171` |
| Lane state | **ACCEPTED / MERGED / CLOSED** |
| Ownership | `app/lib/order-facts/admin-read/**`. D imports those APIs. |

Accepted residual **NEW-CLAUDE-PR6B-C01** remains **not fixed**. Detail: `PR6_ACCEPTED_RESIDUAL_BACKLOG.md`.

### PR6-C canonical applicator — ACCEPTED / MERGED / CLOSED

| Field | Value |
|---|---|
| PR | [#40](https://github.com/Vedang1998/Stocky/pull/40) — **CLOSED / MERGED** |
| Reviewed implementation subject | `b4a9aeb3453b42ea74e499e0cb7b152d5635911f` |
| Accepted final head | `88251df1d22639c021aa083bfb953c50dd6bc8a1` |
| Squash **V** | `a3ff480f1477237f8055f10c43298480a05728a1` at `2026-09-15T02:28:09Z` |
| `V^{tree}` | `ba55f5d5d138911aca83fd715e6f2c8a455e9917` (equals accepted final head) |
| ChatGPT disposition | **ACCEPT PR6-C CANONICAL APPLICATOR FINAL INTEGRATION** — [5672938250](https://github.com/Vedang1998/Stocky/pull/40#issuecomment-5672938250) |
| Original review blob | `a90ae442a80ee593bb43bee3b15c2228f32d6e15` (never edit) |
| Correction review blob | `8c384b698bc45a7a9ac0a1dffa2ab8fdbcc65704` (never edit) |
| Final integration review blob | `0daa0e5395c69b1fb86508f133f6ade3f8430f56` — **`APPROVE PR6-C CANONICAL APPLICATOR FINAL INTEGRATION`** (never edit) |
| Pre-merge exact-head PR CI | run [`34914597052`](https://github.com/Vedang1998/Stocky/actions/runs/34914597052) SUCCESS on `88251df1…` |
| Exact-V push CI | run [`34921292975`](https://github.com/Vedang1998/Stocky/actions/runs/34921292975) SUCCESS — Classify `104229798042`; full Heavy `104229820630` (not SKIPPED); Gate `104241657531` |
| Lane state | **ACCEPTED / MERGED / CLOSED** |
| Ownership | `app/lib/order-facts/apply/**`. D maps B results into accepted C inputs. |

Accepted residuals **P3-FINAL-01 / 02 / 03** remain **not fixed**. Detail: `PR6_ACCEPTED_RESIDUAL_BACKLOG.md`.

### PR6-D webhook / import / reconciliation — TECHNICALLY ACCEPTED AND MERGED

| Field | Value |
|---|---|
| PR | [#43](https://github.com/Vedang1998/Stocky/pull/43) — **CLOSED / MERGED** |
| Branch | `phase-1/pr6-d-order-webhook-import` (historical writer; not reused by this closeout) |
| Accepted implementation **C** | `ca33d9a7871fd0eef77d19d06cbe2bfae47dad0b` |
| Final accepted head **R** | `ef2b98c42c69f76303c44d0809058ca3c7f3052b` |
| Squash **W** / current `origin/main` | `ee193f38491245a10fb2fa60d2cf9a29f3271605` |
| ChatGPT technical acceptance | **ACCEPT PR6-D REPOSITORY IMPLEMENTATION** including quota-evidence and index corrections |
| Independent final verdict at C | **`APPROVE PR6-D QUOTA-EVIDENCE AND INDEX CORRECTION`** |
| Exact-R pre-merge CI | `35454095462` SUCCESS (R-only) |
| Exact-W post-merge CI | `35460969411` SUCCESS (W-only) |
| Lane state | **TECHNICALLY ACCEPTED AND MERGED**. Formal PR6 repository closure waits on this closeout PR. |

**D-owned scope (repository module):** six-topic registration **declarations** (three frozen v1 sanitizers retained; three new identity-only topics), production B→C mapping, legacy exactly-once, >250 quarantine recovery, Bulk A historical/incremental import with C3 staging/EOF/per-order ledgers, reconcile/health, cancellation/off switches, D-owned scratch quota/transport/receipt-digest controls. **Not** live Shopify subscription registration, Partner approval, production, or flag enablement.

## Six immutable D review blobs (preserved at W and on this closeout branch)

Verified `git rev-parse HEAD:<path>` equals the frozen blob IDs. Do **not** edit.

| Artifact | Blob at **W** | Reviewed head | Verdict (exact) |
|---|---|---|---|
| `PR6_D_COMPLETE_INTEGRATION_INDEPENDENT_REVIEW.md` | `48ac291a781b2347cb6017af862f2de9677826a5` | `25226e46905b082fe3af09bb1d9f5c68a8e39785` | `CORRECTIONS REQUIRED` |
| `PR6_D_CORRECTION_INDEPENDENT_REVIEW.md` | `ba82a3c981cda4bec52ea453c2618319288fa66c` | `7e0329f61f2f049ebe1a58f1171b93a34d819d82` | `CORRECTIONS REQUIRED` |
| `PR6_D_SOURCE_CONTRACT_INDEPENDENT_REVIEW.md` | `1eb18cae44cdf7a6660256e2632ebc8019d6da0d` | `09029c09ea7468e6ff676a11fdf020dde5deb694` | `CORRECTIONS REQUIRED` |
| `PR6_D_SC_RECOVERY_FINAL_INDEPENDENT_REVIEW.md` | `e8525c2fd2778c8baf118d0008a9213b7af4eca8` | `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` (**H**) | `CORRECTIONS REQUIRED` |
| `PR6_D_FINAL_CONTROL_INTEGRATION_INDEPENDENT_REVIEW.md` | `ee3f625ce2106b893e9018319e19ef2685e6beab` | `dab5accc4cd949bdaf1078fe6240fc602ba1629b` (**S**) | `CORRECTIONS REQUIRED` |
| `PR6_D_QUOTA_EVIDENCE_INDEX_CORRECTION_INDEPENDENT_REVIEW.md` | `74e57479c15cb8c8ed7ca8a98b07ad820da62e85` | `ca33d9a7871fd0eef77d19d06cbe2bfae47dad0b` (**C**) | **`APPROVE PR6-D QUOTA-EVIDENCE AND INDEX CORRECTION`** |

**Source-contract provenance qualification (preserved, not resolved):** review commit `7710758b181b5a49f1affa260a56b331adafdf7e` (sole parent `09029c09…`, blob `1eb18cae…`) carries GitHub author/committer metadata `Cursor Agent` / `cursor[bot]`. Later SC-recovery and final reviews re-derived blocking claims independently and recorded that the provenance limitation **stands**. This closeout does not rewrite that artifact or convert the metadata into ChatGPT-verified independence.

Upstream planning / A / B / C / tooling review blobs listed in lineage tables were re-hashed at **W** and match the previously frozen IDs.

## D correction families and final independent disposition

Original ID meanings, severities, and negative reviews are **preserved**. Cursor execution reports are **not** independent acceptance. Relabel warning: some Cursor packets reused “N-04…N-08” for different scenarios; dispositions below use correction-review blob `ba82a3c…` meanings.

### Original D-R family (complete-integration review of `25226e46…`)

| ID | Original severity | Original meaning | Final independent disposition |
|---|---|---|---|
| D-R-01 | P1 | Legacy handlers get `$queryRaw`-only object; frozen v1 topics fail in production worker | **RESOLVED** (correction review `ba82a3c…`; preserved through C) |
| D-R-02 | P1 | 32-root cap is total import size; ≥33 orders cannot import | Original meaning **RESOLVED** by C3 staging/EOF (source-contract and later reviews). Do **not** treat the later SC-02 skip-unbound hole as the original D-R-02. |
| D-R-03 | P1 | Empty/truncated JSONL completes coverage / HEALTHY | Original meaning **RESOLVED** (later hole became SC-02). |
| D-R-04 | P1 | First LIVE confirmation reported as completed application | **RESOLVED** |
| D-R-05 | P1 | Legacy effects silently skipped on no-receipt retry while reporting `applied` | **RESOLVED** |
| D-R-06 | P2 | Checkpoint ordinal wrong units and never read | **RESOLVED** |
| D-R-07 | P2 | Accepted PR4/D046 real-worker coverage weakened | **RESOLVED** |
| D-R-08 | P2 | Split multi-byte UTF-8 silently corrupted | **RESOLVED** |
| D-R-09 | P2 | Bulk poll retry budget is dead code | **RESOLVED** |
| D-R-10 | P2 | Bulk A reduced to ID list; discarded fields | Original meaning **RESOLVED** by C3 selected fields / per-order ledger |
| D-R-11 | P3 | Whole-stream `seenIds` retention | Original meaning **RESOLVED** (staging/index path) |
| D-R-12 | P3 | Reported heap delta not a peak bound | **RESOLVED** as a measurement claim (sampled peaks remain observations, not bounds) |

Historical negative review of `25226e46…` remains immutable. Exact-head CI `34934317232` SUCCESS on that SHA is **not** scale evidence; the million-line envelope was **UNEXECUTED — BLOCKED** at that head.

### Original N family (correction review of `7e0329f…`)

| ID | Original severity | Original meaning | Final independent disposition |
|---|---|---|---|
| N-01 | P1 | Parent closure compares LineItem **record count** against `currentSubtotalLineItemsQuantity` (unit sum) | **RESOLVED** (source-contract review and later) |
| N-02 | P1 | Premature close commits an incomplete parent snapshot to C | **RESOLVED** |
| N-03 | P1 | Zero-current-subtotal order released with zero children | **RESOLVED** |
| N-04 | P1 | `confirmed: true` manufactured unconditionally in Bulk A mapper | **RESOLVED** |
| N-05 | P1 | `agreements: []` with `agreementsComplete: true` manufactures absence | **RESOLVED** |
| N-06 | P2 | Zero-money refund classified as no refund history | **RESOLVED**; remaining holes became SC-03/SC-04 then later repaired |
| N-07 | P2 | Duplicate identities undetected beyond the ~64-root ring | **RESOLVED** |
| N-08 | P2 | Scale fixture encodes the same false assumption (self-confirming) | Scale/resource **independently executed** at **H**, re-established at **S** and **C**. Refund-clock portion **RESOLVED**. |
| N-09 | P3 | Unselected Bulk A fields written as NULL | **RESOLVED** |

### SC family (source-contract review of `09029c09…`)

| ID | Original severity | Original meaning | Final independent disposition |
|---|---|---|---|
| SC-01 | P1 | Live and markerless scratch recursive delete | Corrected then residualized into SC-R-02/03; those P2s later **RESOLVED** at C |
| SC-02 | P1 | `skipThroughOrdinal` unbound to new source bytes; false complete | Corrected then residualized into SC-R-04; **RESOLVED** at C |
| SC-03 | P1 | Exhausted budget still issues refund read / can complete | Corrected then residualized into SC-R-01; **RESOLVED** at C |
| SC-04 | P2 | Final Order recheck continuation-gated; refund LIST first-page only | **CORRECTED**; remaining agreement-membership gap is accepted limitation **SC-R-05** |

Million-line at this review: **not executed** (`PR6_D_SCALE_1E6=1` blocked by SC-02). Cursor packet on `1e04ddc` is **not** independent evidence.

### SC-R family (SC-recovery review of **H** `4768033b…`)

| ID | Original severity | Original meaning | Final independent disposition |
|---|---|---|---|
| SC-R-01 | P2 | Drift fallback transport escapes aggregate budget | **RESOLVED** (final-control then quota-evidence reviews) |
| SC-R-02 | P2 | Aggregate scratch-byte cap not enforced across concurrent attempts | **RESOLVED** (remaining arm was NEW-SCQ-01; closed at C) |
| SC-R-03 | P2 | Orphaned attempts unreclaimable/unsurfaced | **RESOLVED** |
| SC-R-04 | P2 | Receipt binding omits fence generation and Bulk/run identity | **RESOLVED** |
| SC-R-05 | P3 | Final recheck does not verify agreement membership | **Accepted limitation** (unchanged) |
| SC-R-06 | P3 | No negative control binds transport wrapper hard-stop throw | **RESOLVED** (NEW-SCQ-02 closed the production bypass) |
| SC-R-07 | P3 | `importParentContentDigest` order-unstable for id-less children | **Accepted limitation** (unreachable through production staging) |
| SC-R-08 | P3 | Unreproduced ENOENT ack.bits after SIGKILL | **Unattributed** — not a fabricated fixed bug |

**H** is the first head at which the million-line envelope was **independently executed** (`PR6_D_SCALE_1E6=1 npx vitest run --config vitest.migrations.config.ts scripts/tenant-enforcement/tests/pr6-d-scale-envelope.test.ts` → exit 0, 4/4). Exact-head CI `35168858541` SUCCESS is **H-only** and is not a substitute for later heads. Ordinary CI skips the opt-in envelope when `PR6_D_SCALE_1E6` is unset.

### NEW-SCQ / JSONL isolation / CLEANUP / INDEX (final-control of **S** `dab5accc…` then quota-evidence of **C**)

| ID | Original severity | Original meaning | Final independent disposition |
|---|---|---|---|
| NEW-SCQ-01 | P2 | Reservation-ledger evidence loss re-grants committed capacity | **RESOLVED** at C (quota-evidence review) |
| NEW-SCQ-02 | P3 | Mutable `dTransportHardStop.throwOnExhaustion` in production code | **RESOLVED** at C |
| NEW-SCQ-03 | P3 | INDEX overlap simultaneity is client-side timed | **Accepted methodological limitation** |
| JSONL isolation follow-up | — | Unique scratch roots / owned-child SIGKILL cleanup | **RESOLVED** at C |
| PR43-CI-CLEANUP-01 | — | Overlay fixture cleanup safety (`ENOTEMPTY`) | **RESOLVED** (final-control review of S) |
| PR43-CI-INDEX-01 | — | Index overlap / lock-graph harness | **RESOLVED** (final-control of S); standing F-F03 timing residual remains **P3-FINAL-01** |
| PR43-CI-INDEX-02 | — | Phase-specific remaining-work predicate | **RESOLVED** at C as a **fixed failure instance** of run `35415196729`. Historical causal explanation of that run remains an **inference**, not a proven reproduction. |

Preserved failed CI (not rewritten as success): `35219870613` (`62f7a060…`, FAILURE); `35336443725` (`2084aebdea65`, FAILURE); `35412301750` (`28d93421…`, FAILURE); `35415196729` (`1e5c18ed…`, FAILURE).

## Evidence attribution

| Claim class | What it may support | What it may not support |
|---|---|---|
| Independent Claude review blobs | Finding existence, severity, verdict, independently executed probes named in that blob | Cursor’s unreproduced counts; later heads unless the review says it re-ran |
| Cursor implementation report | What Cursor built and which commands Cursor attributed to which SHA | Independent acceptance; “green CI” as scale proof |
| Source inspection (this closeout) | Git identities, blob hashes, PR/merge metadata, Actions run identities | Runtime behaviour, merchant data, Partner approval |
| Exact-head CI | Lint/typecheck/test/build/Prisma/GraphQL/Gate for **that SHA only** | Opt-in envelopes that CI skipped; other SHAs |
| Inference | INDEX-02 historical cause of `35415196729`; sampler-completion explanation | Proven reproduction; do not upgrade to fact |

This closeout **did not** rerun PostgreSQL, Redis, million-line, Shopify, or application suites. It verified identities and hashed review blobs against **W**.

## Million-line envelope and CI job vs opt-in skip

| Head | Independent 1e6 envelope | Ordinary exact-head CI |
|---|---|---|
| `25226e46…` | **Not executed — blocked** (32-root / N-01…03) | `34934317232` SUCCESS — not scale evidence |
| `7e0329f…` | **Blocked / not waived** (self-confirming fixture) | `35044093460` SUCCESS; `PR6_D_SCALE_1E6` requires non-Actions env so CI never runs it |
| `09029c09…` | **Not executed** (SC-02) | `35088765421` cited in D report as that SHA only |
| **H** `4768033b…` | **Independently executed** (4/4) | `35168858541` SUCCESS; envelope **opt-in skipped** in CI |
| **S** `dab5accc…` | **Independently re-executed** (4/4, 2059.25 s) | `35400320443` SUCCESS; envelope skipped in CI |
| **C** `ca33d9a7…` | **Independently re-executed** (4/4, 1324.53 s; `lineFactsA` 1,000,000) | `35440638530` SUCCESS; two opt-in envelopes skipped (`pr6-d-scale-envelope`, `pr6-c-scale-envelope`) |
| **R** / **W** | **Not rerun.** W tree = R tree = C runtime + the sixth review file. Runtime on W equals C. | Exact-R `35454095462` and exact-W `35460969411` are full Heavy SUCCESS for those SHAs. They are **not** independent 1e6 executions. |

Sampled RSS/heap/scratch peaks are **high-water observations**, not mathematical bounds. SIGKILL process-kill recovery was independently established at H and confirmatory persist-boundary kills at C; **physical power-loss is not claimed**.

## Approved PR6 scope / acceptance-to-evidence crosswalk

Plan source: `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md` §17.2 / §18.2 / C3 / C3.6 / C3.7. This table is repository-implementation evidence only.

| Plan obligation | Lane | Independent evidence | Remaining |
|---|---|---|---|
| Additive schema, RLS, locks, types, Shop timezone/currency | A | Correction verdict `APPROVE PR6-A FOUNDATION CORRECTION`; squash **M**; exact-M push CI | None for A repository foundation |
| QUERY-only Admin documents; LIST not paginated with `first`; connections complete; bulk schema + bulk-rule gates; Bulk C reject; Bulk B disabled/costed | B | `APPROVE PR6-B ADMIN READ CORRECTION`; squash **U**; exact-U push CI | **NEW-CLAUDE-PR6B-C01**; no live store submission |
| Frozen `net-units-order-date-v1`; independent Order/Refund clocks; snapshot atomicity; unverified-delete / window kinds; unit-event ledger = agreement sales | C | `APPROVE PR6-C CANONICAL APPLICATOR FINAL INTEGRATION`; squash **V**; exact-V push CI | **P3-FINAL-01/02/03** |
| Webhooks as signals + Admin refetch; six-topic declarations; B→C mapping; legacy v1 retained; Bulk A + C3 staging; reconcile; health; quota/scratch | D | Six D blobs ending in `APPROVE PR6-D QUOTA-EVIDENCE AND INDEX CORRECTION`; ChatGPT ACCEPT; squash **W**; exact-R and exact-W CI | Live registration, Partner `read_all_orders`, production, **R-176** operational control, accepted P3 limitations |
| Inventory-write flags DEFAULT OFF | all | Unchanged toml/flags; every review’s non-authorization | Production enablement unauthorized |
| Exact-head CI + independent review + ChatGPT + owner merge | all lanes | Recorded per lane | This closeout still needs its own docs-only exact-head CI + Claude + ChatGPT + owner merge |

§18.2 checkboxes in the **planning** packet remain historical planning text and are **not** rewritten. Live satisfaction is this closeout + the immutable reviews, not a silent edit of the approved brief.

## Source and production limits (do not upgrade)

- No live Shopify merchant calls.
- No live subscription registration / Partner Dashboard approval.
- No `read_all_orders` grant and **no claim** of such a grant.
- No production migrations, deployment, merchant data, or inventory writes.
- Sampled resource peaks are not bounds.
- SIGKILL is not physical power-loss proof.
- INDEX-02 historical causal explanation remains inferred.
- Source-contract GitHub author metadata is not ChatGPT-verified independence.
- Scratch reclaim is operator-only (`PR6_D_SCRATCH_OPERATOR_RUNBOOK.md`); no automatic reaper; do not run against production.

## Risk recommendations (ChatGPT disposition required)

Register **OPEN/CLOSED statuses and severities are preserved** until ChatGPT’s scoped closeout disposition. This matrix is a recommendation, not an autonomous closure. **R-176 stays OPEN/P0. R-164 stays unchanged.** No new risk IDs. No severity reduction.

Full row text updates (evidence + follow-up venue only) live in `../../RISK_REGISTER.md`. Detail of accepted residuals: `PR6_ACCEPTED_RESIDUAL_BACKLOG.md`.

| Risk | Severity (unchanged) | Register status (unchanged) | Repository obligation | Recommendation pending ChatGPT |
|---|---|---|---|---|
| **R-166** | P1 | OPEN | B LIST/connection gates at **U**; D refetch independently accepted on **W** must not reintroduce REST-delta/`first` truncation | **Scoped closure of the repository obligation**; retain a **standing regression control**. Not live-store proof. |
| **R-167** | P1 | OPEN | A columns + C existence-kind apply + D webhook/import/reconcile independently accepted on **W** | **Scoped closure of the repository honesty/window-representation obligation.** Operational 60-day / `read_all_orders` limitation remains with **R-176** / **Q-016**. |
| **R-168** | P1 | OPEN | C net-units contract at **V**; D did not invent a second arithmetic authority (accepted D reviews) | **Scoped repository closure** + standing regression control (no second arithmetic authority). |
| **R-169** | P1 | OPEN | C location contract at **V**; D must not invent `"default"` | **Scoped repository closure** + standing regression control. |
| **R-170** | P1 | OPEN | D webhook-as-signal + Admin GraphQL refetch independently accepted | **Scoped repository closure.** Live traffic not observed. |
| **R-171** | P1 | OPEN | A: no historical line → `ShopifyVariantFact` FK (independent A review). C/D must not add one. | **Scoped closure of the schema/writer repository obligation** + standing schema guard. Stale “until independently verified” language is **corrected as evidence**, not as a silent status close. |
| **R-172** | P1 | OPEN | A persists both bag sides; C persist/no-FX independently tested (T27). Later ABC labels are **Q-012**. | **Scoped closure of the persist/no-FX repository obligation.** Keep **Q-012** open. Do not invent a new risk. |
| **R-173** | P2 | OPEN | D toml topic/route/sanitizer/worker **declarations** independently accepted | **Scoped closure of the repository declaration obligation.** **Live subscription registration remains unfulfilled** (same row; production/Partner). |
| **R-174** | P1 | OPEN | C independent Order/Refund clocks at **V**; D uses them | **Scoped repository closure** + standing regression control. |
| **R-175** | P1 | OPEN | B schema + bulk-rule gates at **U**; D runs both before any submitter call; Bulk B disabled; Bulk C rejected | **Scoped repository closure.** No live store submission. |
| **R-176** | **P0** | **OPEN** | A representability + C window/unverified-delete/two-confirmation revival + D webhook/import/reconcile **repository evidence is now independently accepted on merged W** | **KEEP OPEN / P0.** Replace the stale “D review/merge still pending” statement. Retain the access-window / tombstone safety control and future-change obligations. This closeout does **not** imply production safety or risk closure. |
| **R-177** | P1 | OPEN | C unverified-delete shape at **V**; D `orders/delete` topic/route/sanitizer/worker | **Scoped closure of the repository deletion-signal obligation.** Live registration remains with R-173’s live portion. |
| **R-178** | P1 | OPEN | C window diagnostics + D reconcile/coverage repository evidence accepted | **Scoped closure of the repository reconcile/diagnostics obligation.** Aged-out history remains unhealable without a later authorized grant (**Q-016** / **R-176**). |
| **R-179** | P1 | OPEN | C snapshot atomicity at **V**; D maps incomplete parents to no receipt | **Scoped repository closure** + standing regression control. |
| **R-180** | P1 | OPEN | A ordinal composite unique key independently reviewed | **Scoped closure of the identity repository obligation** + standing schema guard. |
| **R-181** | P1 | OPEN | C unit-event ledger at **V**; D does not invent a second unit-event writer | **Scoped repository closure** + standing regression control. |
| **R-182** | P1 | OPEN | D retains frozen v1 projections (PO-02). Cutover date is a **later authorized PR**, not this closeout. | **KEEP OPEN.** Follow-up = later cutover product/runtime authority, **not** the completed D branch and **not** fabricated unfinished D work. |
| **R-183** | P1 | OPEN | A merchant-durable diagnostic columns; C writers at **V**; D mirrors `DataIssue` via control-plane | **Scoped repository closure.** Not production-ops proof. |
| **R-184** | P2 | OPEN | C refund-snapshot persist at **V**; D `order_transactions/create` signal code accepted | **Scoped closure of persist/signal-code obligation.** Live registration remaining. |
| **R-185** | P2 | OPEN | B Bulk C reject + Bulk B disabled at **U**; D does not enable Bulk B or submit Bulk C | **Scoped repository closure.** No live store submission. |
| **R-164** | P3 | OPEN | Unchanged PR5 residual: tenant-scoped physical DELETE remains reachable; ordinary apply remains tombstone-only | **UNCHANGED.** This closeout does not alter DELETE privilege, RLS, or tombstone contract. |

Standing PR5 production-readiness residuals **P3-CLAUDE-F3XH-06** and **P3-CLAUDE-F3XH-08** remain in `PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md`. This PR6 closeout does **not** discharge them.

## Remaining Phase 1 / PR7 entry conditions

After **accepted** PR6 formal closeout (this PR independently reviewed, ChatGPT-disposed, owner-merged):

1. Phase 1 remains **IN PROGRESS**. PR 7 (audit / roles / privacy) and PR 8 (reconciliation / performance / exit) remain later Phase 1 units per `PHASE_BRIEF.md`.
2. PR [#45](https://github.com/Vedang1998/Stocky/pull/45) still owns its planning corrections. It is **OPEN / DRAFT**, unaccepted, and **not** merged, synchronized, or edited from this branch. Its proposed contract is **not** adopted as approved. After accepted PR6 closeout, PR45 still requires **separate** current-main integration and independent planning acceptance, then **explicit ChatGPT runtime authority**.
3. No PR7/PR8 runtime, migration, Shopify configuration, or production action is authorized by this closeout.
4. Production, merchant data, inventory-write flags, Shopify writes, `read_all_orders`, `write_orders`, live subscription registration, and deployment remain **NOT AUTHORIZED** / flags **DEFAULT OFF**.
5. **Q-008**, **Q-012…Q-016**, **Q-002**, and other unresolved product/production questions remain open.

## Explicit non-authorization

- Formal PR6 repository closure is **not** declared by this file’s publication.
- Phase 1 is **not** complete.
- Public App Store / production readiness is **not** claimed.
- No D-055.
- No PR7 runtime.
- Cursor did **not** author Claude’s independent closeout review.

## Historical records with stale live-status sentences (not rewritten)

Allowlist forbids editing these. They remain dated source records:

| File | Stale live sentence class |
|---|---|
| `PR6_A_CLOSURE_REPORT.md` | **M** as current `origin/main`; PR6-D runtime not authorized |
| `PR6_BC_CLOSURE_REPORT.md` | **V** as current `origin/main`; D **ADMITTED** |
| `PR6_D_EXECUTION_BRIEF.md` | D **ADMITTED**; current main **V**; PR number not predetermined |
| `PR6_D_IMPLEMENTATION_REPORT.md` | PR #43 OPEN / DRAFT / UNMERGED; current main **V** |
| `PR6_BC_EXECUTION_BRIEF.md` | Historical B/C start contract |
| Six D independent reviews | Each freeze their reviewed head (including “PR #43 remains DRAFT” on the C review) |

Live status belongs in `../../PROJECT_STATUS.md`, `../../DECISIONS.md` D-054 item 26, `../../ACCELERATED_SAFE_DELIVERY.md` current-authority paragraph, `../../README.md`, and `README.md` in this folder.

## Related records

- Residuals: `PR6_ACCEPTED_RESIDUAL_BACKLOG.md`
- Risks: `../../RISK_REGISTER.md`
- Questions: `../../OPEN_QUESTIONS.md`
- Decisions: `../../DECISIONS.md` D-054 item 26
- CI policy: `../../CI_POLICY.md`
- PR5 closeout (structural precedent only, not PR6 evidence): `PR5_CLOSURE_REPORT.md`
