# PR5 Formal Closeout — Independent Documentation / Governance Review (PR #36)

**Reviewer role:** Independent adversarial documentation / governance reviewer (Claude Code).
**Review type:** Docs / control packet only. The PR5-F3 runtime at `502b869eb540ea9071224bd4b5da52c6b55498f0` was independently approved separately and is not re-reviewed from scratch here.
**Verdict:** `CORRECTIONS REQUIRED`
**Findings:** P0 0 / P1 0 / **P2 2** / P3 3

This artifact is immutable once committed. It does not merge anything, does not authorize any merge, does not mark PR #36 ready, does not authorize PR6 runtime, does not authorize production or merchant production data, does not enable any feature flag, and does not create D-055.

---

## 1. Identity gate — PASS

| Field | Required | Independently observed |
|---|---|---|
| `origin/main` | `36365e2535a2394fa53b0642db4dbf90a438316f` | `36365e2535a2394fa53b0642db4dbf90a438316f` ✓ |
| PR #36 exact head (`refs/pull/36/head`) | `3523e2af01a7edcf3da01a05efd0c2c93f4a9e5a` | `3523e2af01a7edcf3da01a05efd0c2c93f4a9e5a` ✓ |
| PR #36 state | OPEN / DRAFT / UNMERGED | `state=open`, `draft=true`, `merged=false`, `mergeable_state=clean` ✓ |
| Merge base | equal to current main | `git merge-base origin/main pr/36` = `36365e2535a2394fa53b0642db4dbf90a438316f` ✓ |
| Ahead / behind | ahead 2, behind 0 | `git rev-list --left-right --count origin/main...pr/36` = `0 2` ✓ |
| Changed paths | exactly 9, all `stocky-plus/docs/**` | 9, all `stocky-plus/docs/**/*.md` ✓ |
| Base branch | `main` at `36365e25…` | `base.sha = 36365e2535a2394fa53b0642db4dbf90a438316f` ✓ |

Commits on PR #36 (2):

| SHA | Author | Timestamp | Subject |
|---|---|---|---|
| `c0ea2e3522640f2758c8bf0d5d74c0e0399f018a` | Cursor Agent | `2026-09-06T02:33:24Z` | docs: preserve immutable PR5-F3 exact-head independent review |
| `3523e2af01a7edcf3da01a05efd0c2c93f4a9e5a` | Cursor Agent | `2026-09-06T02:41:40Z` | docs: record PR5 repository-implementation closeout |

### Diff scope

| Path | Status |
|---|---|
| `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md` | M |
| `stocky-plus/docs/DECISIONS.md` | M |
| `stocky-plus/docs/PROJECT_STATUS.md` | M |
| `stocky-plus/docs/README.md` | M |
| `stocky-plus/docs/RISK_REGISTER.md` | M |
| `stocky-plus/docs/phases/phase-1/PR5_CLOSURE_REPORT.md` | A |
| `stocky-plus/docs/phases/phase-1/PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md` | A |
| `stocky-plus/docs/phases/phase-1/PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` | A |
| `stocky-plus/docs/phases/phase-1/README.md` | M |

Totals: `+1257 / -69`, 9 files.

**No runtime, test, Prisma schema, migration, `.github` workflow, package manifest, GraphQL document, Shopify configuration, or feature-flag code change.** Independently confirmed by filtering the changed-path set against `\.github/|prisma/|package(-lock)?\.json|\.graphql|shopify\.app\.toml|/app/|/scripts/|\.ts$|\.tsx$|\.sql$` — zero matches.

---

## 2. CI gate — PASS

Exact-head `pull_request` run on `3523e2af01a7edcf3da01a05efd0c2c93f4a9e5a`:

| Field | Observed |
|---|---|
| Run | [`34007163436`](https://github.com/Vedang1998/Stocky/actions/runs/34007163436) |
| Workflow | `CI` (`.github/workflows/ci.yml`), run number 410, attempt 1 |
| Event | `pull_request` |
| `head_sha` | `3523e2af01a7edcf3da01a05efd0c2c93f4a9e5a` |
| Conclusion | **SUCCESS** |
| Classify change set `101416395048` | **SUCCESS** |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) `101416418874` | **SKIPPED** |
| CI Gate `101416418650` | **SUCCESS** |

**No later push superseded the reviewed head.** A workflow-run listing filtered to branch `cursor/pr5-formal-closeout-5191` returns `total_count = 1` — run `34007163436` is the only CI run that branch has ever produced, and its head SHA equals the reviewed head. PR #36 `updated_at` is `2026-09-06T02:42:17Z`, before the run completed at `02:42:39Z`, and `head.sha` still equals the reviewed head.

Heavy SKIPPED is correct for this change set: all nine paths are docs-allowlist paths, so the classifier yields `docs_only=true` / `full_ci=false`.

---

## 3. Immutable artifact gate — PASS

| Check | Result |
|---|---|
| Blob of `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` on PR #36 | `8d6d47a204d7976339c0023b6b28249f20a337a7` ✓ (matches required) |
| Same path at source review commit `b06e1ae2287f0d8fbf1ba6be87b8ee496a05f1ee` | `8d6d47a204d7976339c0023b6b28249f20a337a7` ✓ |
| Byte identity | `git diff b06e1ae2… pr/36 -- <path>` produces **empty output** — byte-identical ✓ |
| Source commit provenance | `b06e1ae2…`, author `Claude Opus 5 <noreply@anthropic.com>`, `2026-09-06T00:19:13Z`, subject `docs: PR5-F3 exact-head independent Tier-A review`, reachable only from `origin/claude/pr35-f3-tier-a-review-phyzhj` ✓ |
| Editing / reformatting | **None.** Identical Git object hash proves byte-for-byte preservation. |
| Present on `origin/main` before PR #36 | No — PR #36 is what first lands it. Correct. |

No pre-existing immutable review artifact was modified by PR #36. The changed-path set contains no other `*_INDEPENDENT_REVIEW.md`.

---

## 4. PR5 lineage verification — PASS (no incorrect identity found)

Every merge SHA below was verified present in local Git and confirmed an ancestor of `origin/main`. Every accepted implementation head was verified to exist and — correctly, after squash merge — **not** be an ancestor of main. Every post-merge main CI run id was verified against the Actions API with matching `head_sha`, `event=push`, and `conclusion=success`. Every immutable review blob was verified to resolve on `origin/main` at the named path, and every verdict string was verified by reading the artifact itself.

| Lane | Claimed | Independently verified |
|---|---|---|
| **F1** PR #27 squash | `7827e535415c9acbacfbbb4bdedff08be6650d5c` @ `2026-08-17T13:48:17Z` | ancestor of main; commit date `2026-08-17T13:48:17Z` ✓ |
| F1 accepted review-record head | `56c764d00f8350cf22e8b37acf5c61a5b5757e7b` | exists; is exactly reviewed code head `63e157d918a4…` + the review-record commit (`--is-ancestor` = YES). Long-standing repository convention, internally consistent with DECISIONS item 17 on unchanged `main`. ✓ |
| F1 correction verdict / blob | `APPROVE PR5-F1 FOUNDATION CORRECTION` / `4b73536057fdb43e8f470385fd58b786c522edbe` | blob resolves to `PR5_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md`; verdict string present ✓ |
| F1 post-merge CI | run `32036740386` SUCCESS | `event=push`, `head_sha=7827e535…`, `conclusion=success` ✓ |
| F1 closeout PR #28 squash | `5129707ee684e66cadcf96b976e16eb57385a7cb` | ancestor of main; post-merge run `32063024421` SUCCESS on that SHA ✓ |
| **F2A** PR #29 squash | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` @ `2026-08-20T11:04:26Z` | ancestor of main; date matches ✓ |
| F2A accepted head | `bfbe369f590e38f36de8165e366dd7e84449ecd7` | exists; named as reviewed head inside the S01 review ✓ |
| F2A S01 verdict / blob | `APPROVE PR5-F2A ADMIN READ S01 CORRECTION` / `bba424c0dd8f3903bdffe79ffe803269b2dd2fd9` | blob → `PR5_F2A_ADMIN_READ_S01_INDEPENDENT_REVIEW.md`; verdict present ✓ |
| F2A post-merge CI | run `32362021387` SUCCESS | `head_sha=f65ab4b9…`, `event=push`, success ✓ |
| **F2B** PR #31 squash | `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` @ `2026-09-02T10:32:09Z` | ancestor of main; date matches ✓ |
| F2B accepted head | `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` | exists; dominant reviewed-head reference (6 occurrences) inside the F2B correction review ✓ |
| F2B verdict / blob | `APPROVE PR5-F2B CANONICAL APPLICATOR CORRECTION` / `b01569fd77455566438bcedbe869647beb24eda7` | blob → `PR5_F2B_CANONICAL_APPLICATOR_CORRECTION_INDEPENDENT_REVIEW.md`; verdict present ✓ |
| F2B post-merge CI | run `33619969867` SUCCESS | `head_sha=0284b66c…`, `event=push`, success ✓ |
| **F2C** PR #30 squash | `f9841691307583381695973600df3546dd1b9ee4` @ `2026-09-03T23:16:51Z` | ancestor of main; date matches ✓ |
| F2C isolated accepted head | `2d2e8801dd383a778c1237cec4ed068922859cf0` | exists; dominant reviewed-head reference inside the second-correction review ✓ |
| F2C verdicts / blobs | `APPROVE PR5-F2C COMPATIBILITY PROJECTION SECOND CORRECTION` / `d637a9ec…`; `APPROVE PR5-F2C CURRENT-MAIN INTEGRATION` / `e14fc21e…` | both blobs resolve at their named paths; both verdict strings present ✓ |
| F2C post-merge CI | run `33816908539` SUCCESS | `head_sha=f9841691…`, `event=push`, success ✓ |
| **Planning** PR #32 squash | `f1201f853b8a42f40e4d3e5565b6406410360c8a` @ `2026-09-05T13:01:09Z` | ancestor of main; date matches; post-merge run `33967677166` SUCCESS ✓ |
| **Control packet** PR #33 squash / F3 base | `28c810090394f319e599fc6c501b898befa39cad` @ `2026-09-05T16:35:47Z` | ancestor of main; date matches; post-merge run `33978361886` SUCCESS ✓ |
| **F3** PR #35 | CLOSED / MERGED | `state=closed`, `merged=true`, `merged_by=Vedang1998` ✓ |
| F3 base | `28c810090394f319e599fc6c501b898befa39cad` | PR #35 `base.sha` matches ✓ |
| F3 accepted exact head | `502b869eb540ea9071224bd4b5da52c6b55498f0` | PR #35 `head.sha` matches ✓ |
| F3 pre-merge exact-head CI | run `33996153641` SUCCESS, event `pull_request` | `head_sha=502b869e…`, `event=pull_request`, `conclusion=success` ✓ |
| F3 squash merge / current main | `36365e2535a2394fa53b0642db4dbf90a438316f` @ `2026-09-06T01:33:34Z` | `merged_at = 2026-09-06T01:33:34Z`; SHA equals `origin/main` ✓ |
| F3 post-merge main CI | run `34004211341` SUCCESS | `head_sha=36365e25…`, `event=push`, success ✓ |
| F3 post-merge Classify / Heavy / CI Gate | `101408364320` / `101408383357` / `101414546762`, all SUCCESS | all three job ids and conclusions match exactly ✓ |
| F3 review commit / blob / verdict / findings | `b06e1ae2…` / `8d6d47a2…` / `APPROVE PR5-F3 EXACT-HEAD IMPLEMENTATION` / P0 0 P1 0 P2 0 P3 9 | all four verified against the artifact ✓ |

Earlier-chain identities carried in `PROJECT_STATUS.md` were also spot-verified against the Actions API: PR #20 → `31756319986` @ `f618103c…`; PR #22 → `31768571828` @ `99d48db2…`; PR #23 → `31802835318` @ `de1bb193…`; PR #24 → `31959761072` @ `edabd8de…`; PR #26 → `31966584542` @ `ae1b4280…`. All SUCCESS with matching head SHAs.

**Lineage verdict: PASS.** No incorrect SHA, blob, PR number, verdict string, merge timestamp, CI run id, or stale lane state was found anywhere in `PR5_CLOSURE_REPORT.md`, `PROJECT_STATUS.md`, `DECISIONS.md` item 21, `ACCELERATED_SAFE_DELIVERY.md`, or `phases/phase-1/README.md`.

---

## 5. Primary governance question — R-158 (P1) and R-161 (P2)

**Question:** Is the statement *"Phase 1 PR5 repository implementation is technically accepted; formal PR5 closure becomes effective upon merge of PR #36"* governance-consistent while the register still carries R-158 at P1 and R-161 at P2 OPEN?

I did not rely on the prior F3 review's "OPEN non-blocking" label. I compared each risk's original register definition (severity, risk, evidence, mitigation, residual, follow-up on `origin/main`), the approved PR5 brief, the merged remaining-integration plan's §7 close-condition table, and the F3 exact-head implementation evidence.

### Authoritative closure conditions

The merged, independently corrected remaining-integration plan (`PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md` §7, lines 1105–1116) is the authoritative F3 close-condition table:

- **R-158** — *"Requires **F3 evidence**. Direct refetch workers allocate start **before** HTTP and end **after** usable response. Overlapping webhook vs confirmation must not LWW by `responseGen` (AH/AJ/AL through adapters)."*
- **R-161** — *"Requires **F3 evidence** **and** the derived concurrency envelope (C16, including F-CLAUDE-PR5F3EC-01). Race AW against disposable PostgreSQL with intended `max_locks_per_transaction`. Concurrent F3 multi-identity transactions at the **derived** ceiling."*

The approved brief's non-authorization list (line 2618) forbids the *planning packet* from closing R-157…R-161. That is a prohibition on premature closure. It is **not** a precondition that these risks must be closed before PR5 repository implementation may close.

Neither risk's register text, brief text, nor plan text states that PR5 repository implementation cannot close until the risk is closed. In both cases the "Follow-up" column names a **work venue**, not a closure gate.

### Explicit answers

> **R-158 may remain OPEN at P1 without blocking PR5 repository implementation closure.**
> **TRUE.**

R-158's damage class is that a single post-response generation cannot order Shopify observation completion across concurrent workers. Its own mitigation concedes this by design: *"Generations order **app request lifecycle only**, not Shopify mutation/snapshot time."* The mitigation is intervals plus non-overlap plus `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`, not elimination. F3 implemented that shape (`[requestGen, responseGen)` intervals allocated before HTTP and after usable response; no LWW by `responseGen`; `pr5-f3-overlap-races` 8/8), which materially satisfies the plan's stated F3 evidence condition — yet the residual limitation survives as an architectural property, not as unfinished repository work. Keeping it OPEN at P1 is the **conservative** disposition, and PR #36's rewritten residual ("architectural/operational residual… inherent to generation-as-app-lifecycle-order… Do not lower severity") is an accurate characterization, not a softening. Nothing about it is repository work that PR5 closure leaves undone.

> **R-161 may remain OPEN at P2 without blocking PR5 repository implementation closure.**
> **TRUE, and the remaining obligation is genuinely production/deployment/operational.**

R-161's register mitigation states verbatim: *"PR5-F1 landed the capacity evaluator; **arithmetic alone is not production proof**. Do **not** close this risk until **runtime/deployment/concurrency evidence** exists."* Deployment evidence is by definition outside repository implementation. F3 delivered the repository half (EC-01 derived envelope, fail-closed evaluation, 53200 sub-batch fallback, Race AW 12/12 on disposable PostgreSQL); production-scale measurement does not exist and cannot exist while production is NOT AUTHORIZED.

**The closeout wording correctly preserves this open risk without claiming production readiness.** Verified verbatim in the register: residual reads *"production-scale capacity evidence does not yet exist… This is a production/operational capacity residual"*; follow-up reads *"Keep OPEN at original P2 until production-scale lock-capacity evidence exists."* `PR5_CLOSURE_REPORT.md` states *"This closeout does **not** claim production validation. Disposable-environment and exact-head CI evidence are repository-implementation evidence only,"* and every closed risk carries an explicit "not production validation" qualifier.

### Conclusion on the primary question

Neither R-158 nor R-161 requires closure before PR5 **repository implementation** closure. The closeout statement is governance-consistent with respect to R-158 and R-161, and **neither of these two risks alone returns `CORRECTIONS REQUIRED`**.

The `CORRECTIONS REQUIRED` verdict in this review arises from §6 and §9 below, not from R-158 or R-161.

---

## 6. R-129 … R-156 governance verdict — **NOT COHERENT AS WRITTEN** (P2)

PR #36 deliberately invents no closures for R-129…R-156. That restraint is correct on the merits: the merged plan §7 explicitly assigns F3 *duties* for R-132, R-134, R-136, R-138, R-142, R-143, R-145, R-146, R-147, R-154, R-155, R-156 while stating *"F3 advances but does **not** close [them] as 'PR 5 complete'"*, and the F3 exact-head review reached the same conclusion. **Closing them would be inventing closures.**

**However, leaving their text untouched is not coherent with formal PR5 repository-implementation closure.**

At the reviewed head, all 28 rows R-129 … R-156 still carry residual **"OPEN — PR 5 planning (D-053)"**, and **26 of the 28** carry a Follow-up column naming **"PR 5 implementation"** as the resolution venue. Severity distribution of those 28 rows: **1 P0 (R-138), 20 P1, 7 P2**.

The moment PR #36 merges, PR5 repository implementation is formally closed. Those 26 rows then point their sole stated follow-up venue at a lane that no longer exists, and their residual asserts a planning-level mitigation status that is factually contradicted for the subset F3 demonstrably delivered.

### Which rows are specifically false rather than merely incomplete

The F3 exact-head review records, under independent evidence, that F3 *materially advances* R-129, R-131, R-134, R-135, R-136, R-139, R-142, R-144, R-146, R-149, R-150, R-153, R-154 and R-156. For those, "OPEN — PR 5 planning (D-053)" plus "Follow-up: PR 5 implementation" is no longer an accurate description of state: the mitigation is no longer planning-level and the named venue is closed.

**R-138 is the sharpest case, and it is P0.** Its mitigation is labelled *"Planning only"* and its follow-up condition is *"PR 5 implementation; **write-scanner negative fixture tests**."* The F3 review §5.11 independently proves exactly that condition satisfied at the accepted head: both required roots recursively scanned in production code and in CI, semantic deny-by-default via graphql-js operation kind (probe C8), planted `inventoryAdjustQuantities` fixtures caught at depths 0/1/2/3/5 under both policies (C1), write-service imports rejected in nested worker modules (C2, H5), and the `bulkOperationRunQuery` exception bound to one exact path and one exact root field (C5/C6). After PR #36 merges, the register will assert that a **P0** risk is at planning stage with its work pending in a closed lane, while the evidence for its own stated condition sits unrecorded in the same packet.

### Does any R-129…R-156 require closure *before* PR5 repository implementation can close?

**No.** I searched the register, the approved brief, and the merged plan for any follow-up or close condition phrased as a precondition on PR5 closure. None exists. No further *engineering* work is required before PR5 repository implementation can close, and this finding does **not** block PR5 closure on engineering grounds.

### Repository precedent contradicted

This repository has already faced the identical gate. At PR 4's formal repository-implementation closure under D-052, **every** analogous planning-risk row was dispositioned rather than left pointing at the closed lane:

- R-031 / R-032 / R-033 / R-039 / R-099 … R-121 / R-125 / R-126 → residual rewritten to *"**CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** (D-052 …). Production execution remains unauthorized."*, with follow-up rewritten to a **surviving** obligation (e.g. *"Preserve scanner/negative-fixture regression gates"*, *"Preserve readiness false-negative regression gates"*).
- R-095 … R-098 → **not** closed, but explicitly recharacterized as surviving gates: *"must correct before staging/production enforcement rehearsal"* with follow-up *"Phase 1 PR 3 accepted residual → rehearsal gate"*.

The register format is demonstrably capable of naming a surviving venue — R-142 (*"Later focused cleanup PR; not PR 5"*) and R-147 (*"PR 5 bounded-work tests; **PR 8 load evidence**"*) already do so correctly within this same block. The other 26 do not.

### Recommended remedy (documentary only — does not block the engineering)

For each of the 26 rows whose Follow-up names "PR 5 implementation":

1. **Where existing independent evidence supports it** (R-134 deprecated `currentBulkOperation` deleted; R-136 complete location pagination; R-138 two-root deny-by-default scanner with negative fixtures; R-139 exact decimal strings with no `Number`/`parseFloat` in `ingest/`; R-146 re-stream resume; R-135 bounded streaming) — record **"CLOSED FOR PR5 REPOSITORY IMPLEMENTATION"** with the same "not production validation" qualifier the R-157/R-159/R-160/R-165 rows already use, and a surviving follow-up of the form *"Preserve <X> regression gates."* For R-138 specifically, if the intent is to keep a P0 standing control risk open — which is defensible for an accidental-write risk — then **rewrite its residual to say so** (repository obligation satisfied; risk survives as a standing scanner/production-write-enablement control), rather than leaving it at "OPEN — PR 5 planning".
2. **Where the remaining obligation is genuinely production/operational** (R-129 catalog completeness under real bulk traffic, R-145 merchant-visible wiring, R-147 API/queue cost, R-154 mass-tombstone blast radius, R-156 diagnostic reconciler at scale) — **rewrite the residual/follow-up as a surviving production/operational risk** naming the real venue, exactly as R-095…R-098 were handled at PR4 close.
3. **Where the venue is a later PR** (R-142) — already correct; leave unchanged.

Do **not** lower any severity to make this pass. Do **not** block PR5 closure pending further engineering work — none is required.

---

## 7. Risk dispositions R-157 … R-165 — individually verified

Only rows R-157 … R-165 changed in `RISK_REGISTER.md`. I diffed the whole file row-by-row: the row-ID set is identical to `origin/main`, no non-row line changed, and no row outside 157–165 changed. Every disposition below was checked against the immutable F3 review §7 and against the merged plan's §7 close-condition table.

| Risk | Sev (unchanged) | PR #36 disposition | Independent adjudication |
|---|---|---|---|
| **R-157** | P1 | CLOSED FOR PR5 REPOSITORY IMPLEMENTATION | **CORRECT.** Review §7: `has_sequence_privilege` shows USAGE=t / SELECT=f / UPDATE=f for both `stocky_runtime` and `stocky_control_plane`; `setval` unreachable. A role holding USAGE-only cannot `setval` and cannot read the sequence, so "keep `SELECT nextval` as the allocation primitive" is enforced by the privilege set itself. Register text does not overclaim and carries "not production-privilege validation". |
| **R-158** | P1 | OPEN — architectural/operational residual | **CORRECT and conservative.** See §5. Evidence arguably met the plan's stated F3 condition; keeping it open is the safe direction. One P3 note in §9. |
| **R-159** | P2 | CLOSED FOR PR5 REPOSITORY IMPLEMENTATION | **CORRECT.** Review §7: DB-clock lease with validated bounds; `abandonDirectObservation` fenced on `(token, requestGen, ACTIVE, responseGen IS NULL)` requiring exactly one row; expired ACTIVE resultless blockers abandoned; every refetch error path abandons; no identity-freeze path found. Matches the plan's F3 condition. |
| **R-160** | P1 | CLOSED FOR PR5 REPOSITORY IMPLEMENTATION | **CORRECT.** Review §7: `acquireOrderedLocks` takes `pg_advisory_xact_lock` before the canonical row is read or inserted, so a nonexistent row is serialized; probes E1–E5; Race AW rollback-release passes. Register carries "not production lock-table validation". |
| **R-161** | P2 | OPEN — production/operational capacity residual | **CORRECT.** See §5. Register mitigation's own bar ("runtime/deployment/concurrency evidence") is unmet and unmeetable while production is unauthorized. |
| **R-162** | P3 | OPEN — no closure invented | **CORRECT and conservative.** The plan made R-162 "eligible after F2B merge plus actual downstream-consumer proof", and F3 supplies that consumer (`assertCanonicalWriterCapacityAtStartup`) with both layers guarded and probes D3/D4 unable to bypass. The reviewer withheld closure because the mitigation's "explicit upper bound for derived budgets" is satisfied only implicitly by the safe-integer ceiling. PR #36 records that reasoning faithfully and does not invent closure. |
| **R-163** | P3 | CLOSED FOR PR5 REPOSITORY SCANNER OBLIGATION | **CORRECT, and residuals preserved.** Review §5.11 proves both roots recursive plus semantic deny-by-default, planted fixtures at 5 nesting depths in both trees. **P3-CLAUDE-F3XH-01 and P3-CLAUDE-F3XH-02 are explicitly preserved** in the register row, in `PR5_CLOSURE_REPORT.md`, in `PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md` (each with "Preserve when closing R-163; do not erase this residual"), and in `phases/phase-1/README.md`. Neither is erased. **"R-138 remains OPEN" is preserved verbatim** in the row, and "Do not treat this as R-138 closure" is retained. Scope is correctly narrowed to the *repository scanner obligation*, not global closure, and carries "not production scanner-operations validation". |
| **R-164** | P3 | OPEN | **CORRECT, and accurately worded.** The row records that *"`stocky_runtime`, with valid tenant context, still has tenant-scoped physical DELETE capability at the database layer (`DELETE FROM \"ShopifyProductFact\"` committed)"* — faithful to probes M1/M2 (rowCount 1, no error; DELETE granted on all five fact tables; only `shopId` immutability triggers; `*_tenant_delete` RLS policies scope rather than forbid). It simultaneously records that *"ordinary canonical applicator/runtime remains tombstone-only and exposes no normal physical-delete API"* — faithful to `denyCanonicalFactPhysicalDelete`, DELETE-free writers, and scanner rule proven live by probe C8. **The tombstone-only ordinary runtime gate is not misrepresented, and the DB-layer capability is not concealed.** The row correctly forbids changing DELETE privilege or RLS in this closeout. |
| **R-165** | P2 | CLOSED FOR PR5 REPOSITORY IMPLEMENTATION | **CORRECT.** Review §5.8/§7: the `available ?? 0` writer and its whole handler are deleted, the topic routes to authoritative refetch, scanner rule proven live, NULL persists and is counted as health evidence (probes L3, N1, C8). The leftover unsubscribed route is correctly scoped to P3-CLAUDE-F3XH-05 only and does not reopen the closure. |

**No severity was lowered anywhere.** Independently confirmed: the Severity column of every one of R-157…R-165 is byte-identical to `origin/main`.

---

## 8. Accepted residual backlog — all nine verified

`PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md` was checked finding-by-finding against the immutable review §9.

| ID | Severity preserved | Faithful to source | Rationale not softened | Future disposition clear |
|---|---|---|---|---|
| **F3XH-01** root-relative `bulkOperationRunQuery` exception collides across roots | P3 ✓ | ✓ — records the worker-tree module inheriting the library exception | ✓ — states blast radius bounded *and* that an inventory mutation at that path is still rejected | ✓ Engineering hardening; "Preserve when closing R-163; do not erase" |
| **F3XH-02** scanner skips directories named `types` | P3 ✓ | ✓ | ✓ — records that no `types` dir existed at the accepted head, so nothing was unscanned | ✓ Engineering hardening; "Preserve when closing R-163" |
| **F3XH-03** projection retry budget computed and discarded | P3 ✓ | ✓ — both branches return the same value; `MAX_COMPATIBILITY_PROJECTION_ATTEMPTS` unused | ✓ — retains the source's sharpest point: *"the named `NEW-CLAUDE-F2CCM-01` invariant holds by accident rather than enforcement"* | ✓ Hardening of the named invariant |
| **F3XH-04** lock-capacity test expectation depends on `max_connections` | P3 ✓ | ✓ — fails at 200, passes at CI's 100 | ✓ — explicitly *"not a runtime capacity bypass"*, and *"**R-161** remains separately OPEN"* | ✓ Test hardening; "Does not close or reopen R-161" |
| **F3XH-05** unsubscribed legacy webhook route retained | P3 ✓ | ✓ | ✓ — *"Not a competing authority"*; *"R-165 closure is the live null→zero writer removal, not this leftover route"* | ✓ Delete or document as transition fallback |
| **F3XH-06** webhook refetch checks `processingEnabled` once, not per chunk | P3 ✓ | ✓ — JSONL asserts per sub-batch; webhook checks once at entry | ✓ — retains *"a mid-flight kill-switch disable still commits the remaining chunks"* | ✓ **Explicitly retained as a production-readiness requirement** — see below |
| **F3XH-07** capacity fallback cannot reach batch size 1 from 500 | P3 ✓ | ✓ — `capacityFailures > 6` aborts; halving from 500 reaches 7 | ✓ — *"fail-closed resilience ceiling… not unsafe apply"*; *"R-161 remains OPEN separately"* | ✓ Hardening of the fallback bound; "Does not close or reopen R-161" |
| **F3XH-08** non-concurrent `CREATE INDEX` on five fact tables | P3 ✓ | ✓ — five `CREATE INDEX IF NOT EXISTS` under `statement_timeout = '60s'` | ✓ — retains *"each build takes a `SHARE` lock that blocks writes; a 60s timeout fails the migration closed"* | ✓ **Explicitly retained as a production-readiness requirement** — see below |
| **F3XH-09** one control-plane `SyncRun` read omits `shopId` | P3 ✓ | ✓ | ✓ — *"Not exploitable at this head"* is the source's own wording, and the consistency-gap framing is retained | ✓ Fail closed on a shop-scoped read |

**F3XH-06 and F3XH-08 are explicitly retained as pre-production requirements — CONFIRMED.** The backlog carries a dedicated "Mandatory pre-production classifications" table naming exactly those two, each row's Gate field reads **"Production-readiness requirement"**, and the document states verbatim: *"Do **not** silently treat these as ordinary later polish because the repository implementation is accepted."* `PROJECT_STATUS.md` repeats *"**P3-CLAUDE-F3XH-06** and **P3-CLAUDE-F3XH-08** are production-readiness requirements despite remaining P3."*

The backlog also correctly refuses to convert the reviewer's "no P3 blocks acceptance" into "the production-readiness subset is irrelevant" — it says so explicitly. No finding.

---

## 9. Findings

### P2-CLAUDE-PR36CO-01 — R-129 … R-156 residual and follow-up become false at PR5 closure (1 P0, 20 P1, 7 P2 rows)

- **Severity:** P2 (blocking governance/correctness)
- **File and line:** `stocky-plus/docs/RISK_REGISTER.md:133-161` (rows R-129 … R-156); sharpest at `:142` (R-138, **P0**). Related live statements at `stocky-plus/docs/PROJECT_STATUS.md:247` and `stocky-plus/docs/phases/phase-1/README.md:197` ("R-129 through R-156: OPEN — this closeout does not invent closures for those planning risks").
- **Evidence:** At the reviewed head, all 28 rows carry residual `**OPEN — PR 5 planning** (D-053)`; 26 of 28 carry Follow-up naming `PR 5 implementation`. PR #36 formally closes PR5 repository implementation. For the subset the immutable F3 review records as materially advanced or delivered (R-129, R-131, R-134, R-135, R-136, R-138, R-139, R-142, R-144, R-146, R-149, R-150, R-153, R-154, R-156), the residual's "planning" status and the follow-up's venue are both false after merge. R-138 is P0 and its stated follow-up condition ("write-scanner negative fixture tests") is independently proven satisfied in review §5.11 (both roots recursive, semantic deny-by-default, planted fixtures at 5 depths, probes C1/C2/C5/C6/C8/H5) yet remains recorded as planning-stage work pending in a closed lane.
- **Merchant impact:** None directly — no flag, gate, write path, or authorization depends on this wording, and production remains unauthorized. The impact is governance: after merge the authoritative register cannot answer whether a P0 accidental-Shopify-write risk and twenty P1 risks are done, deferred, or abandoned, and the answer is not derivable from any merged document.
- **Reproduction:** `git show pr/36:stocky-plus/docs/RISK_REGISTER.md | awk -F' \| ' '/^\| R-1[3-5][0-9] \|/ {print $1, $2, $6, $7}'` then compare against `PR5_CLOSURE_REPORT.md` "Closure status".
- **Expected behavior:** At formal repository-implementation closure, every planning-risk row in the closing lane's block is dispositioned — closed for repository implementation with a surviving regression-gate follow-up, or explicitly recharacterized as a surviving production/operational/later-PR risk naming the real venue. This is this repository's own established standard at the analogous PR4/D-052 gate (R-031/R-032/R-033/R-039/R-099…R-121/R-125/R-126 closed with "Preserve <X> regression gates"; R-095…R-098 recharacterized as rehearsal gates). R-142 and R-147 already meet the standard within this same block.
- **Recommended correction:** Documentary only, on the PR #36 branch. See §6 remedy. Do not close any risk beyond what existing independent evidence supports; do not lower any severity; do not block PR5 closure pending engineering work — none is required.
- **Missing test:** A control-document consistency check asserting that no risk row's Follow-up names a lane recorded as formally closed in `PROJECT_STATUS.md`.

### P2-CLAUDE-PR36CO-02 — PR #36 asserts the PR6-acceptance wording is cleaned up from current-main control docs; it is not

- **Severity:** P2 (blocking governance/correctness — a false current-state claim newly introduced into a live control document)
- **File and line:** `stocky-plus/docs/PROJECT_STATUS.md:258` (added by this PR). Contradicted by `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md:47` (on `main`, unchanged by this PR).
- **Evidence:** `PROJECT_STATUS.md:258` states verbatim: *"Current-main control docs no longer repeat the false statement that PR6 planning is already independently accepted."* At the reviewed head, `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md:47` still reads: *"| PR #34 | … PR6 planning — **do not edit**. **PR6 planning is independently accepted.** PR6 **runtime** remains **NOT AUTHORIZED** until PR 5 is fully closed. |"*. `git grep "PR6 planning is independently accepted" pr/36 -- stocky-plus/docs` returns that line. NEW-CLAUDE-PR33CP-01 named **two** locations — `PROJECT_STATUS.md:211` and `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md:47`. PR #36 fixes the first and leaves the second, then asserts both are fixed.
- **Secondary defect — wrong remediation venue.** `PR5_CLOSURE_REPORT.md:185` states the stale statement *"must be corrected during that PR #34 synchronization."* The stale statement lives on **`main`**, not on PR #34's branch. A "PR #34 current-main synchronization" merges main *into* PR #34; it does not correct a main-side document. As written, the deferral routes the correction to a venue that structurally cannot perform it, so NEW-CLAUDE-PR33CP-01 would survive PR #34 indefinitely.
- **Merchant impact:** None — PR6 runtime remains NOT AUTHORIZED in every document and no gate depends on the wording. The impact is that a merge authorizer reading the closeout would reasonably conclude the PR33CP-01 correction is complete for current main when it is not, and that the residual is scheduled somewhere it cannot be performed.
- **Reproduction:** `git show pr/36:stocky-plus/docs/PROJECT_STATUS.md | sed -n '258p'` then `git grep -n "PR6 planning is independently accepted" pr/36 -- stocky-plus/docs`.
- **Expected behavior:** Either (a) correct `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md:47` within this closeout — it is a main-side docs file, in scope for a docs closeout, and correcting it is what the PROJECT_STATUS sentence already claims — or (b) remove the "no longer repeat" claim, state precisely which file and line still carries the stale wording, and name a venue that can actually correct a main-side document (a separately authorized docs PR, not PR #34 synchronization).
- **Note on the primary requirement:** PR #36 does **not** falsely claim PR6 planning is independently accepted in its own new or edited prose. `PR5_CLOSURE_REPORT.md`, `DECISIONS.md` item 21, `ACCELERATED_SAFE_DELIVERY.md`, `PROJECT_STATUS.md`, and `phases/phase-1/README.md` all correctly state that a planning correction exists in draft PR #34 and that independent final correction re-review remains pending. That requirement is met. This finding is about the *cleanup claim* and the *deferral venue*, not about the PR6 status wording itself.
- **Missing test:** The control-document consistency check already proposed by NEW-CLAUDE-PR33CP-01, extended to fail when a control document asserts that a stale phrase has been removed while that phrase still resolves under `stocky-plus/docs/`.

### P3-CLAUDE-PR36CO-03 — R-158's rewritten Follow-up removes its venue without naming a surviving one

- **Severity:** P3
- **File and line:** `stocky-plus/docs/RISK_REGISTER.md:163` (R-158, Follow-up column)
- **Evidence:** On `main`, R-158's Follow-up read *"PR 5 implementation; Races AH / AI / AJ / AK / AL"*. PR #36 replaces it with *"Keep OPEN at original P1. F3 interval/non-overlap residual; exact-head review did not support formal closure. See `phases/phase-1/PR5_CLOSURE_REPORT.md`."* That names no venue, gate, or condition under which a P1 risk could ever close. By contrast R-161's rewritten follow-up correctly names one (*"until production-scale lock-capacity evidence exists"*), and R-164's names the standing condition.
- **Merchant impact:** None. A P1 risk with no closure path is a tracking defect, not a runtime defect.
- **Expected behavior:** Name the surviving condition — e.g. *"Keep OPEN at original P1 as a standing architectural residual; revisit only if generation semantics change or production concurrency evidence contradicts the interval/non-overlap contract. Preserve `pr5-f3-overlap-races` regression gates."*
- **Missing test:** A register lint asserting every OPEN row has a non-empty, non-self-referential Follow-up.

### P3-CLAUDE-PR36CO-04 — R-157 closure evidence covers the privilege leg explicitly and the allocation-primitive leg only by implication

- **Severity:** P3
- **File and line:** `stocky-plus/docs/RISK_REGISTER.md:162` (R-157 residual)
- **Evidence:** The plan's F3 close condition for R-157 required both *"Every F3 allocation path … uses `SELECT nextval(…)`"* and *"Focused REG of AE/AF/AG/AD"* and *"Application roles still fail `setval`"*. The immutable review's §7 R-157 row cites only `has_sequence_privilege` results. The conclusion still holds — a role with USAGE-only, SELECT=false, UPDATE=false cannot `setval` and cannot read the sequence, so `nextval` is the only reachable operation — and the tenant sequence-privilege CI step passed. The register row does not overclaim; it states exactly the privilege evidence.
- **Merchant impact:** None. The closure is sound; the *citation* is narrower than the plan's stated condition.
- **Expected behavior:** The residual could cite the allocation-path and AE/AF/AG/AD regression evidence alongside the privilege evidence, or state explicitly that the privilege set subsumes the allocation-primitive requirement.
- **Missing test:** None beyond what exists.

### P3-CLAUDE-PR36CO-05 — Two historical status rows lack an explicit historical marker

- **Severity:** P3
- **File and line:** `stocky-plus/docs/phases/phase-1/README.md:122` (*"| PR 5 implementation | **NOT STARTED — NOT AUTHORIZED** |"*); `stocky-plus/docs/PROJECT_STATUS.md:55` (*"| PR 5 implementation | STARTED — PR5-F1 FOUNDATION ACCEPTED / MERGED / FROZEN |"*).
- **Evidence:** Both sit inside sections that are historical by construction — `## Immutable PR 4 formal-close (#23) merge evidence` and the D-052 table whose "Next gate" cell is explicitly labelled *"**Historical D-052 row.**"* Neither row itself carries the *"Historical … row"* marker that PR #36 correctly applies elsewhere (F1-close, F2A-close, DECISIONS item 18). Both are pre-existing on `main` and unchanged by PR #36. The sibling row at `README.md:107` does carry an explicit *"Historical next-unit note only"* marker, so the convention exists and is applied inconsistently.
- **Merchant impact:** None. The enclosing section headings make the historical framing unmistakable, and the live status is stated unambiguously elsewhere in both files.
- **Expected behavior:** Apply the same *"Historical … row."* prefix PR #36 already uses for comparable rows.

### Findings not raised

I found **no** defect in: the immutable artifact's preservation; the exact-head CI evidence; the identity gate; the diff scope; any lineage SHA, blob, PR number, verdict, timestamp, or CI run id; the R-157/R-159/R-160/R-163/R-165 closures; the R-161/R-162/R-164 open dispositions; the preservation of P3-CLAUDE-F3XH-01 and -02 under R-163 closure; the R-164 DELETE-capability wording; the nine-item residual backlog; the F3XH-06 / F3XH-08 pre-production classification; the D-054 / no-D-055 authority framing; the PR6 / PR #34 status wording; or any production, write, flag, or Phase-1 safety statement.

---

## 10. Authority — D-054 / no D-055 — PASS

| Check | Result |
|---|---|
| D-054 status | **EFFECTIVE** — unchanged. `DECISIONS.md` §D-054 activation record (item 16) is untouched by this PR. |
| D-055 created? | **No.** `## D-054 …` is the last decision heading in `DECISIONS.md` at the reviewed head. Every occurrence of the string "D-055" is a prohibition ("do not create D-055") or a "not created" status line. |
| New decision number required? | **No.** |

**Recording PR5 technical acceptance / formal closeout as a D-054 post-authorization action follows existing repository precedent.** `DECISIONS.md` items 16, 17, 18, 19 and 20 are all post-authorization execution/acceptance records filed *under D-054* with the explicit "(same D-054 — do not create D-055)" heading. PR #36's new **item 21** uses the identical heading form and records acceptance, merge identity, CI identity, risk dispositions, and closure effectiveness — structurally identical to item 17 (F1 acceptance) and item 18 (F2A acceptance). The same pattern holds one level up: PR 4's formal close was recorded under existing D-052 rather than as a new decision. Item 20 was correctly re-marked as a **"Historical authorization record"** with a forward pointer to item 21, rather than being rewritten — the right handling for a superseded authorization record.

`ACCELERATED_SAFE_DELIVERY.md` correctly keeps *"D-054 does **not** authorize production, merchant production data, inventory-write flags, Shopify inventory mutations, or PR6 runtime."*

---

## 11. Current-state consistency — PASS with one exception (P2-CLAUDE-PR36CO-02)

I searched every changed live control document for the specified stale/contradictory current-state statements.

| Stale statement searched | Present at reviewed head? |
|---|---|
| F3 NOT STARTED | **No** as a live claim. The two surviving instances are marked *"Historical F1-close row"* / *"historical at F2A close, later superseded by item 21"* / *"F3 runtime was then **NOT STARTED**"* — unmistakably historical. ✓ |
| F3 NOT AUTHORIZED | **No.** ✓ |
| F3 AUTHORIZED / IN PROGRESS | **No** — all instances converted to ACCEPTED / MERGED. ✓ |
| PR #35 OPEN / DRAFT | **No** as a live claim. `DECISIONS.md` item 20 retains the draft requirement explicitly labelled *"**Historical authorization record:**"*. ✓ |
| PR 5 / PR5 incomplete or "do not state PR 5 is complete" as a live gate | Correctly retired. `phases/phase-1/README.md` replaces *"Do not state that PR 5 is complete"* with *"Do not state that Phase 1 is complete"*. ✓ |
| Old current-main SHAs presented as current | **No.** `f1201f85…` is re-labelled *"(historical)"*; `28c81009…` is labelled *"PR #33 control-packet squash / F3 base"*; `36365e25…` is labelled *"current `origin/main`"*. ✓ |
| **PR6 planning independently accepted** | **YES — still present** at `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md:47`, while `PROJECT_STATUS.md:258` claims it is gone. **→ P2-CLAUDE-PR36CO-02.** |
| Phase 1 complete | **No.** Phase 1 is stated IN PROGRESS in all six live locations, with explicit "Do not state that Phase 1 is complete" retained. ✓ |
| Production authorized | **No.** ✓ |
| Inventory writes authorized | **No.** ✓ |
| Flags enabled | **No.** ✓ |

Historical statements retained are, with the two P3-CLAUDE-PR36CO-05 exceptions noted in §9, explicitly marked historical.

---

## 12. PR6 / PR #34 — PASS

| Check | Result |
|---|---|
| Does PR #36 claim PR6 planning is independently accepted? | **No.** Every new or edited statement reads *"PR6 planning correction exists in draft PR #34; independent final correction re-review remains pending."* Verified in `PR5_CLOSURE_REPORT.md`, `PROJECT_STATUS.md`, `DECISIONS.md` item 21, `ACCELERATED_SAFE_DELIVERY.md`, and `phases/phase-1/README.md`. ✓ |
| Is that wording accurate? | **Yes.** PR #34's own body at its exact head states *"**INDEPENDENT FINAL CORRECTION RE-REVIEW PENDING**"*, records *"Independent correction approval — **Not claimed**"*, and records the last independent verdict as **`CORRECTIONS REQUIRED`**. ✓ |
| `NEW-CLAUDE-PR33CP-01` deferred to PR #34 synchronization? | Labelled as deferred, but the deferral is defective — see **P2-CLAUDE-PR36CO-02**. The stale statement lives on `main`, which a PR #34 synchronization cannot correct. |
| PR #34 untouched at `f5d429b7b3577c87e67c5ef3445e88560e565a5c`? | **Yes.** `refs/pull/34/head` = `f5d429b7b3577c87e67c5ef3445e88560e565a5c`; `state=open`, `draft=true`, `merged=false`; `updated_at = 2026-09-02T18:39:11Z`, i.e. before PR #36 existed. No changed path in PR #36 touches PR #34's branch. ✓ |
| PR6 runtime | **NOT AUTHORIZED** in every changed document. ✓ |

---

## 13. Safety state — PASS

| Control | Required | Independently observed at the reviewed head |
|---|---|---|
| Phase 1 | IN PROGRESS | **IN PROGRESS** ✓ |
| Production | NOT AUTHORIZED | **NOT AUTHORIZED** ✓ |
| Merchant production data | NOT AUTHORIZED | **NOT AUTHORIZED** ✓ |
| Production migrations executed | none | **none** ✓ |
| Production deployment | NOT AUTHORIZED | **NOT AUTHORIZED** ✓ |
| Shopify inventory mutations | NOT AUTHORIZED | **NOT AUTHORIZED** ✓ |
| `FEATURE_STOCKTAKE_INVENTORY_WRITES` | DEFAULT OFF | `envFlag(name, defaultEnabled = false)`; `.env.example` `=false` ✓ |
| `FEATURE_ADJUSTMENT_WRITES` | DEFAULT OFF | same ✓ |
| `FEATURE_RECEIPT_WRITES` | DEFAULT OFF | same ✓ |
| `FEATURE_COST_SYNC` | DEFAULT OFF | same ✓ |
| `FEATURE_TRANSFER_WRITES` | DEFAULT OFF | same ✓ |
| `FEATURE_PR5_ABSENCE_TOMBSTONE` | DEFAULT OFF | `pr5AbsenceTombstone: () => envFlag("FEATURE_PR5_ABSENCE_TOMBSTONE")` with default `false`; `.env.example` `=false` ✓ |
| PR6 runtime | NOT AUTHORIZED | **NOT AUTHORIZED** ✓ |
| D-055 | not created | **not created** ✓ |

Flag defaults were verified directly in runtime source on `origin/main` (`stocky-plus/app/lib/feature-flags.server.ts:9-31` and `stocky-plus/.env.example:40-46`), not from PR prose. PR #36 changes no runtime code, so these are unchanged by the closeout.

No production system, merchant data, Shopify store, or deployment target was accessed while producing this review. No inventory mutation was performed. No feature flag was enabled.

---

## 14. Verdict

PR #36 is a substantially accurate and well-disciplined closeout packet. Its identity, CI, immutable-artifact, and lineage gates all pass without a single incorrect identity in a very large evidence surface. Its R-157…R-165 dispositions are individually correct and appropriately conservative, it does not lower any severity, it preserves both scanner residuals under R-163 closure, it records R-164's reproduced DB-layer DELETE capability without misrepresenting the tombstone-only runtime gate, it faithfully carries all nine P3 residuals with F3XH-06 and F3XH-08 explicitly retained as pre-production requirements, it correctly refuses to create D-055, it correctly refuses to claim PR6 planning acceptance or production readiness, and every safety gate holds.

R-158 at P1 and R-161 at P2 may both remain OPEN without blocking PR5 **repository implementation** closure, and the closeout's wording preserves them correctly without any false production-readiness claim.

Two P2 defects prevent approval, both entirely documentary and both remediable on the PR #36 branch without touching runtime, tests, schema, migrations, CI, flags, PR #34, or any immutable review:

1. **P2-CLAUDE-PR36CO-01** — 28 register rows (1 P0, 20 P1, 7 P2) still record residual "OPEN — PR 5 planning" with 26 naming "PR 5 implementation" as their follow-up venue, which this PR closes. The correct remedy is to close from existing independent evidence where it exists and otherwise rewrite the residual/follow-up as a surviving production/operational or later-PR risk — never to lower severity, and never to block PR5 closure pending engineering work, of which none is required.
2. **P2-CLAUDE-PR36CO-02** — `PROJECT_STATUS.md:258` asserts the "PR6 planning is independently accepted" wording no longer appears in current-main control docs; it still appears at `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md:47`, and the deferral routes the correction to a venue that cannot perform it.

Approval requires P0 = 0, P1 = 0, P2 = 0. That threshold is **not** met.

**`CORRECTIONS REQUIRED`**

---

## 15. Non-authorization of this review

This artifact does **not**: authorize the merge of PR #36; mark PR #36 ready; authorize ChatGPT merge authorization; modify PR #36; modify PR #34; edit any runtime, test, schema, migration, GitHub workflow, Shopify configuration, feature flag, or existing immutable review; close or reopen any risk; lower any severity; authorize PR6 planning acceptance or PR6 runtime; authorize production, merchant production data, deployment, production migrations, or Shopify inventory mutations; enable any feature flag; create D-055; or state that PR 5 or Phase 1 is complete.

PR #36 and PR #34 were not modified by this review. The user alone authorizes merges.
