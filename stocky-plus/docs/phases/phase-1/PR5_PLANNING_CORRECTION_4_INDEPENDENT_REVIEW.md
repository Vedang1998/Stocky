# PR 5 planning — independent correction-4 re-review

**Reviewer:** Claude Code
**Review type:** independent correction-4 planning re-review (corrections 1–4 plus base refresh)
**Date:** 2026-08-15

This report is planning review only. It does **not** authorize PR 5 implementation, does **not** create D-054, does **not** authorize production, deployment, backfill, or any Shopify mutation. D-053 remains "Phase 1 PR 5 planning authorization" only. D-052 remains PR 4 technical-acceptance authority.

---

## 1. Exact review identity

| Field | Value |
|---|---|
| Reviewed base (`origin/main`) | `a15d58e0a9d99dd9497fe3243068d4a728aee52a` |
| Reviewed planning head | `578276313d730cc196979939ca51ec4debd6f8e8` |
| Merge base with `main` | `a15d58e0a9d99dd9497fe3243068d4a728aee52a` |
| Branch | `phase-1/pr5-planning` |
| PR #24 state | OPEN / DRAFT / UNMERGED |
| Immutable prior review blob | `f6e62fe16a63a79f778daaee6991296868a8285b` (verified unchanged) |
| Original review-report commit | `541c652b90fa7329332bb49a7532c605d986ad7c` |
| Original reviewed planning head | `b33cf33a3ee72bd30f1dac6a9117538118157725` |
| Correction-3 head | `f06db86ca367f9e429ba1aa4be0c41d16a6e6218` |
| Correction-4 head | `f03148ec4245e10970c43e2b216b7a9557efcd0e` |

Effective changed paths versus `main` before this review artifact — 7 files, all under `stocky-plus/docs/**`:

```
M  stocky-plus/docs/DECISIONS.md
M  stocky-plus/docs/OPEN_QUESTIONS.md
M  stocky-plus/docs/PROJECT_STATUS.md
M  stocky-plus/docs/RISK_REGISTER.md
A  stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md
A  stocky-plus/docs/phases/phase-1/PR5_PLANNING_INDEPENDENT_REVIEW.md
M  stocky-plus/docs/phases/phase-1/README.md
```

No `.github/**`, no runtime, no schema, no migration, no Shopify configuration.

**Base refresh is metadata-only.** `578276313…` is a true merge commit with parents `f03148ec…` and `a15d58e0…`. The diff `f03148ec… → 578276313…` consists exclusively of the PR #25 CI-cost-control files arriving from `main`. The brief blob is byte-identical across the refresh (`6377a245fb8e4f78b0f837da857a6613daf2a2c1` at both heads). No planning document changed during the refresh.

**Stop conditions checked and clear:** implementation branch `phase-1/catalog-location-inventory-facts` absent from `origin`; no D-054 exists (all matches are "do not create D-054" instructions); this review artifact path did not previously exist; the immutable review blob is unchanged.

## 2. Exact-head CI evidence

Run `31907457108`, event `pull_request`, attempt 1, head `578276313d730cc196979939ca51ec4debd6f8e8`:

| Job | ID | Result |
|---|---|---|
| Classify change set | `95067398083` | **SUCCESS** |
| Lint, typecheck, test, build, Prisma, GraphQL | `95067410665` | **SKIPPED** |
| CI Gate | `95067410355` | **SUCCESS** |

Classifier log at this head:

```
compare_base=a15d58e0a9d99dd9497fe3243068d4a728aee52a
compare_head=578276313d730cc196979939ca51ec4debd6f8e8
changed_path_count=7
classification_reason=every_changed_path_is_docs_allowlist
docs_only=true
full_ci=false
```

Automatic runs at this head: **1**, event `pull_request`. **No duplicate feature-branch push run.** No `workflow_dispatch` was issued. The docs-only skip is valid evidence under the CI policy merged as PR #25.

## 3. Official documentation verified by this reviewer

- PostgreSQL 18 sequence functions (`https://www.postgresql.org/docs/18/functions-sequence.html`): `nextval()` requires **USAGE or UPDATE**; `setval()` requires **UPDATE**; `currval()` / `lastval()` require **USAGE or SELECT**. Confirms the brief's privilege model verbatim.
- Shopify bulk operations guide (`https://shopify.dev/docs/api/usage/bulk-operations/queries`): contains **no** statement of snapshot isolation, point-in-time consistency, or completeness relative to submission time; documents "Maximum of two levels deep for nested connections." Confirms both the brief's completeness posture and its variant-media deferral.

## 4. Original finding-by-finding disposition

All fifteen findings from the immutable original review (blob `f6e62fe…`).

### P1

| ID | Disposition | Evidence |
|---|---|---|
| **F-CLAUDE-PR5PLAN-01** — generation allocation has no atomic pattern | **SUPERSEDED BY A SAFER DESIGN** | §6.F.2 replaces `Shop.catalogObservationGen` with the platform sequence `stocky_catalog_observation_gen_seq`. `nextval` is atomic, takes no merchant row lock, and never returns duplicates (Race P). Gaps are explicitly harmless; a burned value is never reused (Race Q). Fence allocation is a control-plane transaction that **commits before** `bulkOperationRunQuery` (§6.F.2 "Full-sync fence", steps 1–4). The impossible cross-role allocation is gone rather than patched. |
| **F-CLAUDE-PR5PLAN-02** — counter on bootstrap, non-RLS `Shop` row | **RESOLVED** | §6.F.2 and §13 classify the sequence explicitly as platform synchronization infrastructure: not merchant data, not a `Shop` column, not a tenant table, not bootstrap, not merchant-domain RLS, never part of a key or merchant identity. "Bootstrap Shop rows receive **zero** generation writes" (§6.F.2), asserted by Race R and by test A ("Bootstrap Shop row receives zero generation writes"; "architecture audit still fails on bootstrap merchant access"). No bootstrap or privilege circularity remains. |
| **F-CLAUDE-PR5PLAN-03** — absence sweep rests on an unpublished completeness guarantee | **RESOLVED** | §6.F.10 states plainly that the converse ("missing from one COMPLETED extraction = authoritatively absent") is **unsupported** and is an engineering assumption only, recorded as R-144 (extended) and R-154. `ABSENT_FULL_SYNC_SWEEP` is **not approved** anywhere in the document (only two occurrences, both denials). Bulk omission nominates **candidates only**; canonical `ABSENT` requires `ABSENT_CONFIRMED_QUERY`. A mass-absence circuit breaker (absolute + proportional, configurable) aborts **all** tombstones for the epoch and opens a `DataIssue`. Races U, V, W, AL cover it. |
| **F-CLAUDE-PR5PLAN-04** — inventory-level identity contradictory, no unique constraint | **RESOLVED** | §5 rule 2, §6.E, and §13 all declare canonical identity `(shopId, inventoryItemGid, locationGid)` with required `@@unique([shopId, inventoryItemGid, locationGid])`. The level GID is "lineage/reference only, **not** the uniqueness key and **never required** to process disconnect." All locking, existence, quantities, presence markers, nomination, and tombstones key on the pair. Race X and test A assert exactly one canonical row across bulk → disconnect (item+location only) → reconnect. |

### P2

| ID | Disposition | Evidence |
|---|---|---|
| **F-CLAUDE-PR5PLAN-05** — same-transaction checkpoint stated as primary rule | **RESOLVED** | §6.F.11 opens by deleting that wording: the architecture is "**unavailable** and **prohibited**." A repository-wide grep of the brief for "same transaction" / "one transaction" / "single transaction" returns **zero** matches. Two-phase only: facts commit with `ingestBatchId` on the runtime connection, then the control-plane connection advances `jsonlCommittedLineOrdinal`. "Checkpoint may lag facts; checkpoint must NEVER lead." Runtime remains denied DML on `SyncRun` (Race Y, test A, test G). |
| **F-CLAUDE-PR5PLAN-06** — `DataIssue` / `SyncHealth` treated as atomic with fact decisions | **RESOLVED** | §6.F.12 makes them explicitly derived, non-atomic control-plane projections. Durable correctness evidence moves to merchant-side columns: `attributeFreshnessState`, `compatibilityProjectionState`, `existenceDiagnosticState`, `absenceNominationState`. A bounded, idempotent diagnostic reconciler recreates missing issues, closes orphans, and may not change canonical truth. Race Z and test D3.6 cover the crash between fact commit and `DataIssue` write. |
| **F-CLAUDE-PR5PLAN-07** — clock B orders commits, not observations | **SUPERSEDED BY A SAFER DESIGN** | The single-generation claim is withdrawn. §6.F.2 and §6.F.3 replace it with the interval `[observationRequestGen, observationResponseGen]` and state directly: "Do **not** treat a larger `existenceResponseGen` as proof of a later Shopify observation across concurrent workers." Ordering is claimed **only** for non-overlapping intervals, which is sound: sequence allocations are totally ordered in real time, so `A.responseGen < B.requestGen` proves A's usable response was in hand before B's request was issued. |
| **F-CLAUDE-PR5PLAN-08** — per-shop counter convoy and `Shop` row churn | **RESOLVED** | Eliminated by construction. §6.F.2: "`nextval` is atomic and does not take a merchant or `Shop` row lock. Concurrent allocators never receive the same value. Allocation does **not** convoy on the tenant-root `Shop` row." The counter column no longer exists (Race R). Both constraints the original review asked for are stated: no lock across Shopify I/O (§6.F.2, Race S) and the value is "**never** part of a unique key, foreign key, or merchant identity." |
| **F-CLAUDE-PR5PLAN-09** — sweep isolation level unspecified | **RESOLVED** | §6.F.10 "Candidate-nomination isolation (READ COMMITTED)" states the level, names EvalPlanQual predicate re-evaluation as the relied-upon mechanism, forbids `REPEATABLE READ` / `SERIALIZABLE` without separate approval, explicitly denies that PR 4's `RepeatableRead` usage is a precedent, and specifies retry semantics. Race AA covers it. |
| **F-CLAUDE-PR5PLAN-10** — unbounded terminal revival | **RESOLVED** (with a P3 precision gap — see F-CLAUDE-PR5C4-02) | §6.F.7 "Terminal-identity revival (safety valve, not expected lifecycle)": one LIVE response must not revive; a `TERMINAL_IDENTITY_REVIVAL_CONFLICT` diagnostic opens on **any** post-tombstone LIVE; two independent authoritative LIVE confirmations are required; `shopifyCreatedAt` must match where available; only then controlled recovery with audit evidence. The inventory-level reconnectable pair is correctly kept exempt. Race AB covers single-response non-revival. |
| **F-CLAUDE-PR5PLAN-15** — scanner omits `inventoryBulkToggleActivation` | **RESOLVED** | §12 now lists `inventoryDeactivate` **and** `inventoryBulkToggleActivation` explicitly, then goes further as the original review asked: "Do **not** solve this with another hand-maintained finite list. **R-110** is precedent." Deny-by-default mutation detection over families `inventory*`, `inventoryItem*`, `product*`, `productVariant*`, `transfer*`, cost-write surfaces, via GraphQL-AST / semantic inspection rather than substring matching, distinguishing QUERY fields sharing those prefixes. Negative fixture required (Race AC). |

### P3

| ID | Disposition | Evidence |
|---|---|---|
| **F-CLAUDE-PR5PLAN-11** — `products/delete` payload described inaccurately | **RESOLVED** | §10.1: "Official 2026-07 `products/delete` sample payload includes `id`, `published_scope`, and `admin_graphql_api_id`. **Use the supplied GID where present.** Keep numeric-id fallback mapping only where the GID is absent." |
| **F-CLAUDE-PR5PLAN-12** — variant `mediaUrl` mandated in §6.B, deferred in §8.2 | **RESOLVED** | §6.B now marks `mediaUrl` "**Not a mandatory PR 5 acceptance field**", names product `featuredMedia` as PR 5 canonical media support, and cites the official two-level nesting limit. §8.2 matches. The contradiction between acceptance criterion and forbidden query shape is gone. |
| **F-CLAUDE-PR5PLAN-13** — `currentBulkOperation` replacement guidance incomplete | **RESOLVED** | §8.1: "`bulkOperations` is **officially valid**; it is **not** portrayed as invalid" — Stocky "**deliberately chooses**" persisted BulkOperation GID + `bulkOperation(id:)` because multiple simultaneous operations are supported and exact-operation identity is stronger. The forbidden-symbol gate no longer reads as contradicting the official deprecation notice. |
| **F-CLAUDE-PR5PLAN-14** — currency provenance not bound to stamped amounts | **RESOLVED** | §8.6 and §15: persist currency with every stamped amount, record the source `SyncRun` / observation lineage that produced the stamp, and a detected `Shop.currencyCode` change requires a **full catalog restamp/rebuild** rather than mixed incremental provenance. |

**Original findings: 15 of 15 discharged — 12 RESOLVED, 3 SUPERSEDED BY A SAFER DESIGN, 0 PARTIALLY RESOLVED, 0 STILL OPEN.**

## 5. ChatGPT blocker A — sequence least privilege

**Disposition: RESOLVED.**

§6.F.2, §13, and test A specify: owner is the migration/schema role only; `stocky_runtime` and `stocky_control_plane` receive **USAGE only** on **this named sequence only**; no SELECT; no UPDATE; no ownership; no PUBLIC privilege; no schema-wide `GRANT … ON SEQUENCES`; explicit `NO CYCLE`; allocation primitive `SELECT nextval('stocky_catalog_observation_gen_seq')`.

Verified adversarially against official PostgreSQL 18 documentation:

- **USAGE permits `nextval`** — confirmed: `nextval()` requires USAGE **or** UPDATE. USAGE-only allocation works.
- **UPDATE would enable `setval` and is therefore correctly forbidden** — confirmed: `setval()` requires UPDATE. Withholding UPDATE is exactly sufficient to deny `setval`, and SELECT is not needed for `nextval`, so the grant is genuinely minimal rather than merely conservative.
- **Application roles cannot reset or rewind generations.** `setval` denied (no UPDATE). `ALTER SEQUENCE … RESTART` requires ownership, which both roles are denied and which `excess_sequence_ownership` keeps as a verifier failure. `DROP`/recreate likewise requires ownership. `currval`/`lastval` are reachable under USAGE but are read-only and cannot alter sequence state.
- **`NO CYCLE` prevents wraparound reuse** — on reaching the limit `nextval` errors instead of wrapping, so the never-reuse invariant holds at the boundary rather than silently recycling.
- **Ownership / PUBLIC / default privileges cannot recreate the bypass** — the brief forbids PUBLIC, forbids blanket `ON SEQUENCES`, forbids application-role ownership, and keeps F-PR3C-05 plus a named-allowlist verifier against each of those routes. PR 3's existing role-membership escalation suite covers the indirect-membership route.

**Tests AE–AG sufficiency: sufficient**, and stronger than the blocker required. AE asserts `nextval` succeeds for **both** application roles under USAGE-only; AF asserts `setval` fails for **both** roles **and** that PUBLIC `nextval` fails; AG asserts `NO CYCLE`. Race AD adds the standing privilege allowlist (no SELECT, no UPDATE, PUBLIC none, no application-role ownership, schema-wide `ON SEQUENCES` fails verify), and test A repeats the whole matrix as a schema/tenancy gate.

**No route permitting generation reset, reuse, or application-controlled rewinding was found.**

## 6. ChatGPT blocker B — response-scheduling inversion

**Disposition: RESOLVED**, subject to the P2 specification gap in §8.

The correction-3 "allocate after response" model is withdrawn and replaced by the direct observation interval `[observationRequestGen, observationResponseGen]`. All six required semantics are present:

1. `requestStartGen` allocated **before** the Shopify request (§6.F.2 step 1).
2. Durable merchant-side in-flight start evidence committed in a **short** tenant transaction (step 1).
3. **All row locks released** before network I/O (steps 1–2); "No PostgreSQL / merchant row lock may be held across Shopify HTTP / network I/O."
4. `responseEndGen` allocated after an authoritative usable response and **before** entering the tenant fact transaction / identity lock (steps 3–4).
5. Generations "order **app request lifecycle only**. They do **not** claim Shopify mutation ordering or snapshot time" — stated three times across §6.F.2, §6.F.3, §6.F.9.
6. Failed / throttled / timed-out requests may burn the start generation, create no authoritative fact, cannot cause deletion, and must clear in-flight evidence (§6.F.2).

The brief states the inversion counter-example explicitly and refuses the unsound inference: "Do **not** claim that allocating a generation immediately after Shopify response completion proves observation-completion order across concurrent workers."

**Does this eliminate the failure?** Yes, for completed observations. Applying the documented overlap test to the canonical inversion: worker A requests at G10 and is descheduled after its response; worker B requests at G11 and completes at G12; A resumes and takes G13. A = `[10,13]`, B = `[11,12]`. `A.req(10) ≤ B.resp(12)` and `B.req(11) ≤ A.resp(13)` — the intervals **overlap**, so conflicting LIVE/ABSENT results cannot be resolved by end-generation order. The "last response wins" path is closed. Conversely, non-overlap is a sound ordering claim: because `nextval` allocations are totally ordered in real time, `A.responseGen < B.requestGen` proves A's usable response preceded B's request.

**No remaining "last response wins" path for overlapping conflicting evidence was found.** Request-scheduling inversion is covered by the same symmetric test. Duplicate retries and concurrent workers serialize on `(shopId, identity)` `FOR UPDATE` taken **after** I/O, with the conflict rule applied inside the lock.

## 7. Area verdicts

| Area | Verdict |
|---|---|
| Overlap / conflict model (§6.F.3, §6.F.9) | **SOUND.** Closed-interval overlap test is correct; conflicting overlaps preserve last unambiguous state, persist `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`, derive `DataIssue`, and refetch after both complete; only a later non-overlapping observation resolves. Agreeing overlaps may converge with attributes still on clock A. Null-version conflicts follow the same rule with no LWW and no `attributeResponseGen` winner (commit rules 1–5). Terminal safeguards are explicitly not bypassed; the reconnectable pair uses the same model. |
| Tenant / bootstrap | **SOUND.** No per-shop counter exists. No merchant-domain write through the bootstrap surface; zero generation writes to `Shop`. The sequence is platform infrastructure with no tenant row to protect, reachable by both application roles under USAGE-only, with no privilege or bootstrap circular dependency at shop creation, uninstall, or reinstall. |
| Cross-role / two-phase | **SOUND.** No cross-role atomic transaction is promised anywhere. Facts-then-checkpoint ordering with "checkpoint may lag, never leads"; idempotent orphan-batch acknowledgement on resume; merchant-durable state remains authoritative enough to re-derive control-plane health; `JobAttempt` covers failures before any fact transaction runs. |
| Bulk omission / deletion | **SOUND.** No path leads from "not in bulk output" to canonical ABSENT. Candidate nomination requires six preconditions; failed/canceled/partial bulk may neither nominate nor tombstone; the circuit breaker aborts all tombstones on anomaly; confirmation is anomaly-only, batched, and bounded; a candidate cannot tombstone while an overlapping direct LIVE observation is unresolved. |
| InventoryLevel identity | **CONSISTENT.** `(shopId, inventoryItemGid, locationGid)` in §5, §6.E, §8.3, §13, and the test plan. No contradictory alternative identity remains; the level GID is lineage-only throughout. |
| Terminal deletion / revival | **SOUND** with one P3 precision gap (F-CLAUDE-PR5C4-02). Deletion evidence is authoritative-only; history preserved; recreated resources are new GIDs; stale signals cannot overwrite newer unambiguous facts; direct/bulk/webhook evidence cannot race into resurrection. |
| Shopify mutation denial | **SOUND.** Deny-by-default AST/semantic scanner over mutation families, `inventoryBulkToggleActivation` and `inventoryDeactivate` named, negative fixture required, no write-helper imports, all inventory-write flags DEFAULT OFF. |
| Tests A–AD preserved | **PRESERVED.** All 30 races A–AD are present and unchanged in intent in §6.F.13. |
| Tests AE–AL sufficiency | **SUFFICIENT** for the eight stated failure modes; each maps to a required outcome precise enough to fail an incorrect implementation. One coverage gap identified (F-CLAUDE-PR5C4-01). |
| Risk / control-record consistency | **CONSISTENT.** R-157 and R-158 are recorded P1 and **OPEN — PR 5 planning**, each carrying "Do **not** close this risk merely because the planning mitigation exists." All 30 risks R-129…R-158 are OPEN; none prematurely closed. `PROJECT_STATUS.md`, `DECISIONS.md`, `OPEN_QUESTIONS.md`, `RISK_REGISTER.md`, and `phases/phase-1/README.md` agree on PR 5 planning IN PROGRESS, implementation NOT STARTED / NOT AUTHORIZED, implementation branch not created, no D-054, Q-002 / Q-004 OPEN, production NOT AUTHORIZED, inventory writes UNAPPROVED. No internal contradiction found. |
| Approved-product consistency | **CONSISTENT.** Shopify remains authoritative for catalog, location, and sellable inventory (§5.1); the app "does not become a second commerce/inventory authority"; variant identity preserved and never merged by SKU/barcode/title; deletion tombstones with auditable history; inventory writes remain off (§12); no Smart Forecast leakage — the canonical applicator must not import forecasting and must not invoke ABC/low-stock (§11); tenant isolation stays database-enforced with no RLS weakening for bulk ingest (§13); reads are paginated/completeness-safe; JSONL ingest is streamed and bounded-memory (§8.3). |

## 8. New findings

**P0 = 0 · P1 = 0 · P2 = 1 · P3 = 1.**

### F-CLAUDE-PR5C4-01 — P2 — In-flight observation evidence has no specified abandonment owner, bound, or recovery, and its blocking semantics are ambiguous

**Document / sections:** `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` §6.F.2 steps 1 and 5, §6.F.2 failed-request list; §6.F.3 in-flight paragraph; §6.F.10 confirmation rule. Tests: §6.F.13 Races Q and S.

**Failure scenario.** A worker allocates `requestStartGen = G`, commits merchant-durable in-flight observation evidence for identity X, releases locks, and issues the Shopify request. The process is hard-killed (SIGKILL, pod eviction, OOM) before allocating `responseEndGen` and before clearing the record. Nothing in the brief clears it: §6.F.2 step 5 clears in-flight evidence "as part of apply or abandon", and the failed/timeout/throttled list is the graceful path executed by a **live** worker. Per §6.F.3 the record is then "treated as unresolved and overlapping any other interval that intersects `[observationRequestGen, +∞)` until it completes or is abandoned."

**Evidence.** A full-document search for `in-flight`, `abandon`, `reaper`, `lease`, `expire`, and `stale observation` returns only §6.F.2 lines for persisting and clearing, §6.F.3's `[requestGen, +∞)` rule, §6.F.9's concurrent-observation paragraph, and Race S. There is **no** lease, TTL, expiry, reaper, or ownership statement anywhere. Race Q asserts only that the **generation value** is burned and never reused — not that the in-flight **record** is ever released. Race S asserts in-flight evidence is committed before I/O, not that it is cleared after an abnormal exit.

**Why the current mitigation is insufficient.** Both clearing triggers require the originating worker to still be running; "or is abandoned" names an outcome with no actor, mechanism, or bound. Separately, the brief never states whether an in-flight observation carrying **no existence result** counts as a "conflict" under §6.F.3's conflict rule. The two readings diverge materially:

- **Blocking reading.** §6.F.3 decides LIVE vs TOMBSTONED from "the last unambiguous **non-overlapping** existence observation", and §6.F.10 forbids tombstoning "while an overlapping direct LIVE existence observation is unresolved." A permanently stuck record then overlaps every later observation for X forever: X's existence state can never change again — a genuine deletion can never be recorded, a reconnect can never restore LIVE, and absence confirmation is permanently blocked for X.
- **Non-blocking reading.** Resultless intervals are ignored, in which case the durable in-flight evidence does no work at all and the crash-window protection the interval model appears to offer does not actually bind.

Neither reading corrupts data — no false tombstone and no false revival arises either way, which is why this is P2 and not P1 — but the two produce materially different systems, and the blocking reading introduces an unbounded liveness defect with no specified recovery.

**Required correction.**
1. State explicitly whether an unresolved in-flight observation (no existence result) blocks a later observation from being "unambiguous", or participates in conflict evaluation only once it has a result.
2. Name the abandonment mechanism: a lease / TTL on in-flight observation evidence bounded by the Shopify request timeout plus a margin; the actor that expires it (the PR 4 `JobAttempt` / job lifecycle or an explicit bounded reaper); and the rule that an expired record is abandoned — burning its start generation, producing no existence fact, and never authorizing deletion.
3. Add a mandatory race (for example **AM**): hard-kill a worker after in-flight evidence commits and before `responseEndGen`; assert the record is abandoned within the stated bound, that no tombstone or revival occurred while it was unresolved, and that a subsequent non-overlapping authoritative observation can change existence state normally.

### F-CLAUDE-PR5C4-02 — P3 — "Two independent authoritative LIVE confirmations" for terminal revival is not required to be non-overlapping

**Document / section:** `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` §6.F.7, "Terminal-identity revival (safety valve, not expected lifecycle)", requirement 2. Test: Race AB.

**Failure scenario.** Two concurrent authoritative refetches for a tombstoned terminal GID are issued during the **same** transient Shopify anomaly window (replication lag, cache, partial outage) and both return LIVE. Their intervals overlap. Under §6.F.3, overlapping observations that **agree** "may converge idempotently on that existence state." Read together, two overlapping LIVE responses drawn from a single anomaly can satisfy "two independent … confirmations" — the precise scenario F-CLAUDE-PR5PLAN-10 was raised to prevent, since the word "independent" is nowhere defined in terms of the interval machinery the correction otherwise uses everywhere.

**Evidence.** §6.F.7 requirement 2 reads "Require **two independent** authoritative LIVE confirmations" with no interval constraint, while every other ordering claim in §6.F is expressed as a non-overlap condition.

**Why the current mitigation is insufficient — and why it is only P3.** Requirement 3 (`shopifyCreatedAt` must match the tombstoned row where available), requirement 1 (a `TERMINAL_IDENTITY_REVIVAL_CONFLICT` diagnostic opens on any post-tombstone LIVE and the tombstone is kept initially), and the explicit framing as controlled recovery with audit evidence substantially bound the damage. The gap is one of precision in a defensive path, not an open revival route.

**Required correction.** State that the two confirmations must be **non-overlapping with each other** — the second observation's `observationRequestGen` after the first's `observationResponseGen` — and extend Race AB to assert that two **overlapping** LIVE responses do not satisfy the revival threshold.

## 9. Remaining risks

- **R-157** (sequence UPDATE / `setval` reset-reuse) and **R-158** (response scheduling inversion) are correctly **OPEN**, severity P1, each explicitly barred from closure on the strength of a planning mitigation alone. Both are properly linked to Races AE/AF/AG/AD and AH/AI/AJ/AK/AL respectively.
- **R-129 … R-156** all remain **OPEN — PR 5 planning**. R-102 and R-137 are preserved and not closed. R-122 / R-123 remain accepted residuals.
- Planning mitigations in this brief close **no** implementation risk. Every acceptance test named here is a future obligation, not evidence.
- The circuit-breaker thresholds (absolute 250 / 2%) and the confirmation concurrency ceiling (≤2 in-flight) are correctly labelled configurable pre-production hypotheses rather than product truth.
- F-CLAUDE-PR5C4-01 should be tracked as a new OPEN risk when the planning correction is made.

## 10. Verdict

**APPROVE PR5 PLANNING**

All fifteen findings from the immutable original review are discharged — twelve resolved and three superseded by designs that remove the failure mode rather than guard it. Both ChatGPT post-correction-3 blockers are resolved, with blocker A's privilege model confirmed against official PostgreSQL 18 documentation and blocker B's interval model verified to close the inversion by construction. No P0 and no P1 finding was identified.

Approval means the corrected planning architecture is technically ready for ChatGPT's planning acceptance / merge decision. It does **not** authorize PR 5 runtime implementation, production, deployment, or inventory writes.

**F-CLAUDE-PR5C4-01 (P2) must be corrected before implementation authorization**, not before planning acceptance: the in-flight observation lifecycle needs an explicit blocking semantic, a bounded abandonment mechanism with a named owner, and a covering race. **F-CLAUDE-PR5C4-02 (P3)** should be folded into the same correction.

Implementation remains NOT STARTED and NOT AUTHORIZED. The implementation branch `phase-1/catalog-location-inventory-facts` remains absent. D-053 is unchanged and no D-054 is created by this report. The immutable review report `PR5_PLANNING_INDEPENDENT_REVIEW.md` (blob `f6e62fe16a63a79f778daaee6991296868a8285b`) was not modified. PR #24 remains DRAFT and UNMERGED.
