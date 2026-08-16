# PR 5 planning — independent correction-5 re-review

**Reviewer:** Claude Code
**Review type:** focused independent Correction 5 planning re-review
**Date:** 2026-08-15

This report is planning review only. It does **not** authorize PR 5 implementation, does **not** create D-054, and does **not** authorize production, deployment, backfill, or any Shopify mutation. D-053 remains "Phase 1 PR 5 planning authorization" only. D-052 remains PR 4 technical-acceptance authority.

---

## 1. Exact review identity

| Field | Value |
|---|---|
| Reviewed base (`origin/main`) | `a15d58e0a9d99dd9497fe3243068d4a728aee52a` |
| Reviewed planning head (correction 5) | `8262bdb9d123042edaab5c11778751be1c7989d5` |
| Correction-5 starting head / prior review commit | `f7b78f1c0444abf471d9deb9bf951cedf6392900` |
| Commits in `f7b78f1…..8262bdb…` | **1** ("Correct PR 5 planning for in-flight observation lease and terminal revival.") |
| Branch | `phase-1/pr5-planning` |
| PR #24 | **OPEN / DRAFT / UNMERGED**, `mergeable_state: clean`, 8 changed files |
| Prior immutable blob — original review | `f6e62fe16a63a79f778daaee6991296868a8285b` — **verified unchanged at the reviewed head** |
| Prior immutable blob — correction-4 review | `e645c81c38419c962d6b8670542aee082fee56ee` — **verified unchanged at the reviewed head** |

Both immutable blobs were verified directly by `git rev-parse <head>:<path>` against the correction-5 tree, not inferred from the diff.

### Correction-5 delta (`f7b78f1…` → `8262bdb…`)

```
M  stocky-plus/docs/DECISIONS.md                                              (+1)
M  stocky-plus/docs/PROJECT_STATUS.md                                         (+7 −2)
M  stocky-plus/docs/RISK_REGISTER.md                                          (+2 −1)
M  stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md (+290 −41)
M  stocky-plus/docs/phases/phase-1/README.md                                  (+2 −2)
```

Five files, all under `stocky-plus/docs/**`. One commit. Documentation only. **No** runtime, schema, migration, Shopify configuration, or `.github/**` change. `OPEN_QUESTIONS.md` is part of the overall PR but is **unchanged in correction 5** (0 paths in the correction-5 delta).

### Stop conditions checked and clear

- `origin/main` is exactly `a15d58e0…`; PR head did not move during review.
- PR #24 remains OPEN, DRAFT, UNMERGED.
- Neither prior immutable review blob differs.
- This review artifact did not exist at `8262bdb…` (verified `git cat-file -e` → path absent) and was re-verified absent on the working tree immediately before creation.
- No D-054 exists. Every `D-054` occurrence in the repository is a prohibition ("do not create D-054").
- Implementation branch `phase-1/catalog-location-inventory-facts` is **absent** from `origin` (`git ls-remote --heads` → 0 matches).
- No runtime/schema/config change appears anywhere in the PR.

## 2. Exact-head pre-review CI evidence

Run `31911817468`, workflow `CI` (`.github/workflows/ci.yml`), event `pull_request`, attempt 1, head `8262bdb9d123042edaab5c11778751be1c7989d5`, conclusion **success**.

| Job | ID | Result |
|---|---|---|
| Classify change set | `95077952833` | **SUCCESS** |
| Lint, typecheck, test, build, Prisma, GraphQL | `95077970574` | **SKIPPED** |
| CI Gate | `95077970267` | **SUCCESS** |

Classifier log at this head (read directly from job logs):

```
event_name=pull_request
compare_base=a15d58e0a9d99dd9497fe3243068d4a728aee52a
compare_head=8262bdb9d123042edaab5c11778751be1c7989d5
range_usable=true
changed_path_count=8
classification_reason=every_changed_path_is_docs_allowlist
docs_only=true
full_ci=false
```

All eight enumerated paths are classified `[docs]`. The eight paths are the **full PR diff versus `main`**, and correctly include both immutable review files — expected, and not a correction-5 edit of those files.

Automatic runs at this head: **1**, event `pull_request`. **No duplicate feature-branch push CI** (push CI on this branch stops after PR #25, consistent with `CI_POLICY.md` rule 2). **No `workflow_dispatch`.** Docs-only skip is valid evidence under `AGENTS.md` §"CI evidence policy" rules 3–4.

## 3. F-CLAUDE-PR5C4-01 (P2) — disposition

**RESOLVED.**

The correction-4 finding required exactly three things. All three are delivered, and the mechanism chosen removes the failure mode rather than guarding it.

| Required correction | Delivered |
|---|---|
| 1. State explicitly whether an unresolved resultless in-flight observation blocks | §6.F.2.1 "Explicit blocking semantics" and §6.F.3: an **ACTIVE, UNEXPIRED, resultless** observation participates as `[requestGen, +∞)` and **blocks overlapping later observations from mutating canonical existence**, but does **not** prevent the later Shopify request from being issued. The ambiguity between the two readings identified in correction 4 is gone. |
| 2. Name the abandonment mechanism, its bound, and its owner | §6.F.2.1 "Finite lease is the liveness boundary" + "Logical abandonment at lease expiry": finite `leaseExpiresAt` = configured finite Shopify request timeout + finite bounded recovery margin, validated finite maximum, test-configurable short values; expiry is **logical**, so no actor needs to run for correctness to progress. This is stronger than the reaper the finding asked for. |
| 3. Add a covering race | Race **AM** added (hard crash after ACTIVE evidence, before `responseGen`), plus Race **AN** (late response after abandonment), plus the fencing rule they exercise. |

The unbounded-liveness defect is closed by construction: "This removes any possibility that a hard-crashed worker freezes an identity forever," and "Physical cleanup **MUST NOT** be the correctness boundary."

Four new findings in §14 are residuals **inside the newly introduced mechanism**, not a failure to discharge the original finding.

### 3.1 `CatalogObservationInFlight` representation — **SOUND**

§6.E.1 introduces the model with the required merchant-domain contract: non-null `shopId`, `@@unique([shopId, id])`, tenant-leading indexes, ENABLE+FORCE RLS with `USING`/`WITH CHECK`, immutable `shopId`, restricted `stocky_runtime` DML only, **no** `stocky_control_plane` DML, **no** cross-role FK to `DurableJob` / `JobAttempt` / `SyncRun` / `DataIssue` / `SyncHealth`. §13 repeats the classification (`merchant_domain`) and §15 adds the privilege tests. Job/attempt lineage is explicitly **opaque correlation strings**, lineage/diagnostics only.

Canonical identity is sufficient and unambiguous for all five kinds: `(resourceKind, shopifyGid)` for Product / Variant / InventoryItem / Location, and `(resourceKind, inventoryItemGid, locationGid)` for InventoryLevel — the same keys as the canonical fact tables and consistent with §5 rule 2, §6.E, §8.3 and §13. The level GID remains lineage-only.

### 3.2 Multiple simultaneous observations — **SOUND**

Stated as a `MUST`: "It **MUST** support **multiple simultaneous** observations for the same canonical identity," with two explicit prohibitions — "Do **not** model this as one mutable 'current in-flight observation' slot on the fact row" and "Do **not** unique-constrain `(shopId, canonical identity)` to a single in-flight row." Step 1 of the required algorithm says **insert a new** row, not upsert a slot.

Because every observation owns its own immutable row and token, and no worker may write another observation's row (§6.F.2.1: a late worker "**MUST NOT** … clear a newer observation's evidence"; step 5: complete or clear "**that exact** observation"), observation replacement, accidental clearing, and ABA on a shared slot are all unrepresentable. The prior single-slot ABA hazard is removed structurally.

### 3.3 Token vs `observationRequestGen` — **SOUND**

The `id` / observation token is "the expected-observation token used by late-worker fencing." `observationRequestGen` is explicitly "**not** merchant identity, **not** the uniqueness key, **not** a foreign key, and **not** a replacement for the observation token," and stays a generation/order primitive only. D-053 correction 5 and R-159 repeat this.

### 3.4 Lease duration and configuration validation — **SOUND**

Derivation is bounded on both terms (finite request timeout + finite bounded recovery margin). "Do **not** invent an unlimited lease. Do **not** invent a renewable-without-bound lease." A retry after abandonment is a **new** observation with a new token and a new `observationRequestGen` — so there is no unlimited renewal path and no generation reuse. Configuration validation "must reject missing, non-positive, unbounded, or greater-than-maximum timeout / margin / lease values" — fail-closed as required. Test-configurable short values are mandatory.

Lease time is barred from ordering duty in two places: the §6.F forbidden-comparison list ("Wall-clock `leaseExpiresAt` / observation-lease time as Shopify mutation order, existence ordering, attribute ordering, or a replacement for `requestGen` / `responseGen`") and §6.F.2.1. `createdAt`/`updatedAt` are explicitly "**not** an ordering key and **not** the liveness boundary." **The lease does not become a fourth clock.**

### 3.5 Logical abandonment — **SOUND**

Every property required by this review is present in §6.F.2.1 and mirrored in §6.F.3: an expired resultless observation does not block, is excluded from live overlap, creates no LIVE/ABSENT fact, never authorizes deletion, never authorizes revival, permanently burns its request generation, and "**may** be marked `ABANDONED` by the next tenant-scoped transaction or recovery pass." Correctness therefore does **not** wait on a cleanup pass — physical cleanup is explicitly maintenance-only in both §6.E.1 and §6.F.2.1. §6.F.10 and the fence-survivor rule were both updated so that expired/abandoned resultless observations no longer block absence confirmation or nomination.

**No path was found in which a hard-crashed row freezes an identity forever.**

### 3.6 Multiple active blockers — **SOUND (rule); test-coverage gap, see F-CLAUDE-PR5C5-03**

The blocking rule is stated existentially over observations, not over a single designated blocker: a later observation may not mutate canonical existence while *an* ACTIVE unexpired resultless observation overlaps it, and §6.F.10 forbids tombstoning while "an unresolved **ACTIVE unexpired resultless** observation or an unresolved overlapping LIVE existence observation" exists. Nothing in the wording scopes the check to one row, the most recent row, or the observation's own row.

Applying it to the required scenario — A active, B active, C's response arrives, A expires — C still overlaps B, so C still may not mutate canonical existence. **Expiry of A alone does not release C.** The design does **not** accidentally check only one blocker. No mandatory race asserts this, which is F-CLAUDE-PR5C5-03.

### 3.7 Held response / refetch — **SOUND**

A blocked later response must not be applied and must not be replayed: "do **not** later replay that held response as if it were fresh," and "The blocked later observation is completed / abandoned **without** becoming an authoritative completed interval. Its request generation remains burned." Recovery is a **fresh** authoritative observation obtained through the accepted PR 4 durable retry/refetch lifecycle after the blocker settles, explicitly "**bounded** and **auditable**." Step 5 repeats it: "A blocked later response is discarded for canonical application and is **not** replayed later as if it were fresh."

### 3.8 Late-worker atomic fence — **SOUND on atomicity; predicate time-source is unspecified, see F-CLAUDE-PR5C5-01**

Step 4 places the fence **inside** the same tenant fact transaction that takes the identity `SELECT … FOR UPDATE`: "In that **same** tenant transaction, **fence** this observation token." §6.F.2.1 requires the transaction to "**atomically** prove" the token is still the expected observation, is `ACTIVE`, has not been `ABANDONED`, and has not expired. The prohibition list is complete for the damage classes in scope — no `LIVE`, no `ABSENT`, no tombstone, no revive, no null-version attribute update, no clearing of a newer observation's evidence, and no resurrection of an expired observation "merely because a Shopify response eventually arrived." A burned `responseGen` is explicitly acceptable. "A stale worker must not be able to flip `ABANDONED` / expired evidence back to `ACTIVE` in order to apply."

The fence is genuinely atomic with the fact decision. What is **not** specified is which clock evaluates "has not expired" — see F-CLAUDE-PR5C5-01.

Race-boundary walkthrough:

| # | Boundary | Verdict |
|---|---|---|
| 1 | Response before expiry; fact lock acquired after expiry | **Covered normatively.** The fence runs in the fact transaction, not at response time; "It **may** burn `responseGen` if `responseGen` was already allocated" is a direct acknowledgement of this case. **Not covered by a mandatory race** — F-CLAUDE-PR5C5-04. |
| 2 | `responseGen` allocated, then lease expires before the fact transaction | Same as #1. Fence fails; response discarded; `responseGen` burned. |
| 3 | Recovery path abandons the token while the original worker is paused | **Covered.** Fence requires "has not been `ABANDONED`". |
| 4 | Physical cleanup deletes the row before the old worker resumes | **Not explicitly fail-closed** — F-CLAUDE-PR5C5-02. |
| 5 | A new observation for the same identity starts while the old worker is paused | **Covered.** Multi-row model; each worker fences its own token; the old worker cannot clear the newer row. |
| 6 | Duplicate job delivery/retry reuses an old token | **Covered by construction.** Tokens are generated at insert, so a redelivered job inserts a new row; a reused token is by then `COMPLETED` / `ABANDONED` / expired and fails the fence. |
| 7 | Old worker tries to clear another observation's evidence | **Covered.** Explicit `MUST NOT`, plus "that exact observation" in step 5. |
| 8 | Two workers present the same token | **Covered by construction.** Completion is atomic with the fact decision inside the tenant transaction; the second arrival finds a non-`ACTIVE` row and is fenced. |

### 3.9 Cross-role / tenant isolation — **SOUND**

No FK or atomicity dependency runs from merchant-domain observation rows to PR 4 control-plane rows. §6.F.2.1 "Role boundary" preserves PR 3 / PR 4 separation: PR 4 durable job/attempt recovery "**may trigger or retry**" tenant-scoped PR 5 work, while insert / fence / complete / abandon / cleanup / fact application stay under `stocky_runtime` + `TenantDb`. "Do **not** introduce an impossible cross-role atomic transaction." §13 adds: "Control-plane does **not** write merchant facts or in-flight observation rows." §15 adds the negative privilege tests (control-plane denied DML on fact tables and `CatalogObservationInFlight`; cross-shop denial for `CatalogObservationInFlight`; multiple simultaneous ACTIVE rows permitted). §6.F non-goals add "grant `stocky_control_plane` DML on merchant fact or in-flight tables" to the prohibition list.

`stocky_control_plane` receives **no** merchant fact/in-flight DML authority anywhere in correction 5. No RLS weakening, no `shopId` mutability, no bootstrap surface change.

## 4. Correction-4 interval-model regression check — **NO REGRESSION**

| Correction-4 invariant | State at `8262bdb…` |
|---|---|
| `requestGen` before the Shopify request | Preserved (step 1) and strengthened by the row insert |
| `responseGen` after a usable response, before the fact lock | Preserved (step 3), plus "Do **not** allocate the end generation only after waiting for the identity lock" |
| No lock across network I/O | Preserved and strengthened: step 1 now ends with **COMMIT** before release; step 2 adds that an active blocker does not prevent the request being issued |
| Non-overlapping completed observations may order app-issued checks | Preserved verbatim and re-stated in a new "Concurrent completed observations (correction 4, preserved)" block |
| Overlapping conflicting completed observations do not LWW | Preserved |
| Overlapping agreeing observations may converge only where already allowed | Preserved |
| Shopify `updatedAt` remains clock A | Preserved |
| Null-version conflicting overlaps preserve last unambiguous value + refetch | Preserved, and extended so an expired/abandoned late worker cannot update null-version attributes (§6.F.9) |
| Generations never claim Shopify snapshot/mutation order | Preserved in three places, including the inversion counter-example |
| Lease is not a fourth clock | Explicitly barred in the §6.F forbidden-comparison list |

The correction-5 additions are strictly subtractive on the blocking side (they *remove* expired resultless observations from live overlap) and additive on the fencing side. No completed-observation rule was loosened.

## 5. Race sufficiency

### 5.1 Race AM — hard crash / orphaned in-flight observation

**SUFFICIENT ON ASSERTIONS, INSUFFICIENT ON CLOCK.**

AM asserts every required outcome: no tombstone or revival from A; while A's lease is active, overlapping later evidence cannot mutate canonical existence; after the finite deadline A is logically abandoned "even if the row is not yet rewritten"; A no longer blocks; `requestGen` is never reused; a fresh authoritative observation can subsequently change existence normally. Crucially it specifies "**No graceful cleanup** runs," which forces the logical-expiry path rather than a reaper.

It does **not** say which clock advances past the deadline. Because the lease's time source is unspecified (F-CLAUDE-PR5C5-01), AM can be satisfied by advancing an application timer, which would not exercise the authoritative expiry boundary an implementation actually relies on. See F-CLAUDE-PR5C5-01 required correction 3.

### 5.2 Race AN — late response after abandonment

**SUFFICIENT for the post-expiry arrival case.**

AN asserts the full required set: A fails the observation-token / active-lease fence; A cannot mutate canonical existence or attributes; A cannot clear B's evidence; A cannot tombstone or revive; no response-end LWW; B/fresh evidence remains authoritative.

Its setup is "A's lease expires … **then** A's old request finally returns." That is response-**after**-expiry. It does not cover response-**before**-expiry with apply-after-expiry — see §5.3.

### 5.3 Response-before-expiry / apply-after-expiry — **NOT COVERED BY A MANDATORY RACE**

The normative rule covers it (the fence is in the fact transaction, and "may burn `responseGen` if `responseGen` was already allocated" presupposes exactly this ordering). No race forces it. This is the single most discriminating fencing test in the whole model: an implementation that validates the lease at response time rather than inside the fact transaction passes AM and AN and is still wrong. Recorded as **F-CLAUDE-PR5C5-04**.

### 5.4 Race AB — terminal revival

**SUFFICIENT.** AB is extended with an explicit Case 2 — "two **overlapping** later LIVE responses (`second.observationRequestGen` **not greater than** `first.observationResponseGen`)" — and the required outcome states both the negative ("Two overlapping LIVE responses **do not** satisfy the two-confirmation revival threshold") and the positive ordering condition. Case 1 (single transient LIVE) is retained unchanged.

## 6. F-CLAUDE-PR5C4-02 (P3) — disposition

**RESOLVED.**

§6.F.7 requirement 2 now reads: "Those two confirmations **MUST be NON-OVERLAPPING with each other**. Required ordering: `second.observationRequestGen > first.observationResponseGen`. Two overlapping LIVE responses **MUST NOT** satisfy the two-confirmation revival threshold." This is the exact condition the correction-4 finding specified, expressed in the same interval machinery used everywhere else in §6.F.

Nothing was weakened:

- initial tombstone retention — requirement 1 unchanged ("Keep the canonical tombstone **initially**");
- `TERMINAL_IDENTITY_REVIVAL_CONFLICT` on **any** post-tombstone LIVE — unchanged;
- `createdAt` match where available — requirement 3 unchanged;
- controlled recovery with audit evidence — requirement 4 unchanged;
- attributes of a restored row still follow clock A — requirement 5 unchanged;
- InventoryLevel reconnectable-pair exemption — unchanged;
- a new belt-and-braces line was added: "Do **not** weaken the existing createdAt / audit / conflict safeguards."

R-155 was updated to carry the non-overlap condition and link F-CLAUDE-PR5C4-02. §15 acceptance criteria and the D-checklist both record the AB extension.

## 7. Risk and control-record consistency

| Check | Result |
|---|---|
| R-159 exists exactly once in `RISK_REGISTER.md` | **YES** (line 164; the other four `R-159` references are range statements and non-goals, not duplicate register rows) |
| R-159 substance | Matches: "Orphaned/expired direct-observation evidence or an unfenced late worker can permanently block an identity or apply stale evidence" |
| R-159 severity | **P2** |
| R-159 status | **OPEN — PR 5 planning** (D-053) |
| R-159 mitigation completeness | Finite lease, logical expiry, late-worker tenant-transaction fencing, Races AM and AN, bounded PR 4 retry/refetch, no control-plane DML — all present |
| R-159 closed by planning? | **NO** — "Do **not** close this risk merely because the planning mitigation exists" |
| R-157 / R-158 | Both remain **OPEN — PR 5 planning** (P1), each retaining the do-not-close clause |
| D-053 title | Exactly "Phase 1 PR 5 planning authorization" — unchanged |
| D-053 correction 5 recorded | **YES** — `DECISIONS.md` entry 15 under D-053, "same D-053 — do not create D-054" |
| D-054 | **ABSENT** — every occurrence in the repository is a prohibition |
| Cross-document agreement | **CONSISTENT.** `PROJECT_STATUS.md`, `phases/phase-1/README.md`, `DECISIONS.md` and `RISK_REGISTER.md` all carry R-129 → R-159 OPEN, PR 5 planning IN PROGRESS, implementation NOT STARTED / NOT AUTHORIZED, implementation branch not created, no D-054, Q-002 / Q-004 OPEN, production NOT AUTHORIZED, inventory-write flags DEFAULT OFF, and both immutable reports unmodified. `PROJECT_STATUS.md` adds the PR #24 state row and a correction-5 truth line reading "Correction implemented — pending independent verification," which is the correct posture at this head. No contradiction found. |

§6.F non-goals were extended to state that this section does not close R-157, R-158, or R-159, and does not grant `stocky_control_plane` DML on merchant fact or in-flight tables.

## 8. Approved-product boundary

Unchanged by correction 5 and re-verified: Shopify remains authoritative for catalog, location, and sellable inventory; the app does not become a second commerce authority; variant identity is preserved and never merged by SKU/barcode/title; deletion tombstones retain auditable history; inventory-write mutations remain forbidden in PR 5 code with all flags DEFAULT OFF; no forecast/ABC coupling enters the applicator; tenant isolation stays database-enforced with no RLS weakening — and `CatalogObservationInFlight` is added **inside** that enforcement contract rather than beside it.

## 9. New findings

**P0 = 0 · P1 = 0 · P2 = 1 · P3 = 3.**

### F-CLAUDE-PR5C5-01 — P2 — The lease's authoritative clock is unspecified, so the correctness boundary rests on unstated application-node clock agreement

**Document / sections:** `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` §6.E.1 line 351 (`leaseExpiresAt` — "Finite UTC deadline"); §6.F.2.1 lines 575–606 ("Finite lease is the liveness boundary") and line 671 ("has not expired (`leaseExpiresAt` still in the future)"); §6.F line 423; §6.F.3 line 799; Race **AM** line 1494.

**Evidence.** A full-document search of the brief for `clock_timestamp`, `now()`, `current_timestamp`, `statement_timestamp`, `database time`, `NTP`, `skew`, `monotonic`, `node clock`, and `authoritative clock` returns **zero** matches. The only time-source language is "Finite UTC deadline" (§6.E.1) and "**Wall-clock** lease time" (§6.F line 423, §6.F.2.1 line 600). The brief therefore never states:

- **A.** which clock produces `leaseExpiresAt` at insert (§6.F.2 step 1);
- **B.** which clock evaluates "not expired" inside the tenant fact transaction (§6.F.2.1 line 671) and inside the blocker scan (§6.F.2.1 line 608 ff., §6.F.10);
- **C.** that A and B must be the same time source, or that B must be a single read consistent across the fence and the blocker predicate within one transaction.

The default an implementer will inherit is decisive: this repository's **accepted** PR 4 lease implementation computes and compares leases on independent application-node wall clocks — `stocky-plus/app/sync/lifecycle.server.ts:52` (`const leaseExpiresAt = new Date(now.getTime() + leaseMs)`) and `lifecycle.server.ts:540` (`leaseExpiresAt: { lt: now }` where `now = new Date()`). Correction 5 gives no instruction to depart from that precedent.

**Why this is materially different from PR 4's lease.** In PR 4, lease expiry only re-dispatches work; the control plane still fences on the `DurableJob` state machine and `lockDurableJob`. In PR 5, correction 5 promotes lease expiry to a **correctness** boundary in the brief's own words ("This is the correctness boundary," §6.F.2.1 line 635 ff.) and makes it a predicate of a **tenant fact decision**. A predicate that decides canonical existence must have a defined evaluator.

**Failure scenario (premature abandonment + simultaneously passing fence).** Worker A inserts an ACTIVE observation for identity X with `leaseExpiresAt = T` computed on A's clock. Worker B's clock runs ahead by δ.

1. At real time `T − δ/2`, B evaluates blockers on B's clock, which reads `T + δ/2 > T`, so B treats A as logically abandoned and excludes it from live overlap.
2. B holds a usable `ABSENT_CONFIRMED_QUERY` result for X (or a bulk absence candidate reaching confirmation). With A excluded, §6.F.10's "no tombstone while an ACTIVE unexpired resultless observation is unresolved" no longer fires, and B tombstones X.
3. At real time `T − δ/4`, A's LIVE response arrives. A evaluates the fence on **A's own** clock, which reads `< T`, so A passes the fence.

Both workers are internally consistent and both act. B mutated canonical existence while A was, by A's own reckoning, a valid blocker — the precise outcome the blocking rule exists to prevent. A's subsequent LIVE apply then overlaps B and is resolved as a conflict ("preserve the last unambiguous canonical existence state"), so the false tombstone **persists** until a later non-overlapping refetch; for a terminal GID, restoring it now requires the §6.F.7 two-non-overlapping-confirmation safety valve.

The symmetric conditions are equally unaddressed:

- **B's clock behind:** A's lease is honoured past its real deadline, so blocking exceeds the "finite bounded" guarantee the section claims by an amount the brief neither bounds nor detects.
- **Exact boundary at `leaseExpiresAt`:** the comparison is stated as "still in the future" with no `>` vs `>=` convention, and no requirement that the fence and the blocker predicate use the same comparison and the same time read.
- **Transaction begins before expiry, applies after:** unspecified whether the predicate uses a time captured before `BEGIN` or read at statement time inside the transaction — two different answers from the same deployment.
- **VM/container time adjustment:** an NTP step, live migration, or suspend/resume can expire many leases at once or extend them; nothing requires a monotonic or database-derived boundary.

**Merchant impact.** Under ordinary multi-pod clock drift, a live product, variant, inventory item, location, or item+location pair can be tombstoned while an authoritative LIVE check is legitimately in flight, and a stale worker can pass a fence that another worker has already treated as expired. This is the R-159 damage class re-entering through the mechanism introduced to close it.

**Why P2 and not P1.** No cross-tenant, authentication, or financial corruption occurs; a tombstone still requires an authoritative `ABSENT_CONFIRMED_QUERY` rather than a bulk sweep; the terminal-revival safety valve provides audited recovery; and the required correction is one paragraph of specification, not a redesign. It is not P3 because the failure is reachable in an ordinary deployment, is silent, and produces merchant-visible false deletion.

**Required correction.**

1. Name **one authoritative time source** for both the creation of `leaseExpiresAt` and every expiry evaluation. A database-derived boundary (a single `now()` / `clock_timestamp()` read taken inside the same tenant transaction that performs the fence and the blocker predicate) is consistent with the accepted tenant architecture, requires no new role or privilege, and makes premature abandonment and a passing fence mutually exclusive by construction. If a different model is preferred, the brief must state a demonstrably safe one — including the maximum tolerated skew, how it is enforced, and what happens when it is exceeded.
2. State that the fence and the blocker/overlap predicate within one tenant transaction must use the **same** time read and the **same** boundary convention, and define the `leaseExpiresAt` boundary explicitly (expired iff `leaseExpiresAt <= t`, or the converse — either is fine, but it must be written down).
3. Amend Race **AM** — and the new race required by F-CLAUDE-PR5C5-04 — to advance the **authoritative** expiry clock rather than an application timer, and add an assertion that a worker whose local clock disagrees with the authoritative boundary cannot pass the fence.

**Missing test.** A race in which two workers evaluating the same lease disagree under injected clock skew, asserting that at most one outcome is possible: either the blocker is honoured (no existence mutation by the later worker) or the original worker is fenced — never both actions in the same window.

### F-CLAUDE-PR5C5-02 — P3 — The fence is not explicitly fail-closed when the in-flight row is absent

**Document / sections:** §6.F.2.1 lines 660–672 ("Late-worker fencing"); §6.E.1 line 356 and §6.F.2.1 line 657 (physical cleanup).

**Evidence.** The fence is defined purely as positive properties of an existing row: the transaction must prove the token "is still the expected observation," "is `ACTIVE`," "has not been `ABANDONED`," "has not expired." Separately, the brief permits physical cleanup to delete `COMPLETED` / `ABANDONED` rows, and logical abandonment permits an expired ACTIVE row to be "marked `ABANDONED` by the next tenant-scoped transaction or recovery pass" — after which it becomes eligible for deletion.

**Failure scenario.** Worker A's lease expires; a recovery pass marks the row `ABANDONED`; maintenance cleanup deletes it; A's Shopify response finally arrives and A enters the fact transaction. The fence lookup returns **no row**. The brief never states what happens. An implementation written as `if (row && row.lifecycleState !== 'ACTIVE') reject` — a natural reading of "prove it has not been `ABANDONED`" — treats a missing row as nothing-to-object-to and proceeds to apply, which is exactly the stale apply Race AN forbids in the not-yet-deleted case.

**Why P3.** A strict reading of "must prove" already makes a missing row unprovable, and the brief's methodology elsewhere is explicitly fail-closed (CI classification, configuration validation). This is a precision gap in a defensive path rather than an approved bypass — the same grade the correction-4 review assigned F-CLAUDE-PR5C4-02.

**Required correction.** State that a missing / physically removed in-flight row **fails the fence closed**: the late response is discarded for canonical application exactly as an expired or `ABANDONED` row is.

**Missing test.** Extend Race AN with a case in which A's row is physically deleted before A resumes, asserting the same outcome set as AN's abandoned-row case.

### F-CLAUDE-PR5C5-03 — P3 — No mandatory race covers multiple simultaneous blockers with partial expiry

**Document / sections:** §6.F.2.1 lines 608–634; §6.F.3 lines 791–806; §6.F.13 Races AM / AN.

**Evidence.** The blocking rule is correct for the multi-blocker case (see §3.6 above), but every mandatory race exercises exactly one in-flight observation: AM has one crashed observation, AN has one abandoned observation plus one fresh observation. No race sets up two simultaneous ACTIVE blockers.

**Failure scenario.** A and B are both ACTIVE, unexpired and resultless for identity X. C obtains a usable response. A's lease expires. An implementation that resolves blocking by looking at the most recent in-flight row, or that caches "is X blocked?" once per apply, releases C on A's expiry even though B still overlaps C — permitting C to mutate canonical existence while a valid blocker is live. Nothing in the mandatory test set would fail.

**Why P3.** The specification is correct and unambiguous; only the mandatory-test coverage is missing, and the brief's own standard is that every correctness rule carries a race.

**Required correction.** Add a race (or extend AM): A and B both ACTIVE unexpired resultless for one identity; C's response arrives; A expires. Assert C still cannot mutate canonical existence while B is unexpired, and that C becomes eligible only after **all** overlapping ACTIVE unexpired resultless observations have settled or expired.

**Missing test.** As stated above.

### F-CLAUDE-PR5C5-04 — P3 — No mandatory race covers a response obtained before expiry but applied after expiry

**Document / sections:** §6.F.2 steps 3–5 (lines 528–540); §6.F.2.1 lines 660–678; §6.F.13 Races AM / AN (lines 1494–1495).

**Evidence.** The normative rule covers this ordering — the fence sits in the fact transaction, and "It **may** burn `responseGen` if `responseGen` was already allocated" presupposes a worker that reached step 3 before expiry. But Race AM crashes **before** `responseGen`, and Race AN has A's response return **after** expiry. Neither sets up: A obtains a usable response and allocates `responseGen` while its lease is valid, then waits on the `(shopId, identity)` `FOR UPDATE` lock (or is descheduled) until after `leaseExpiresAt`, and only then reaches the fence.

**Failure scenario.** An implementation that validates the lease at response time — a natural optimisation, since the worker "knows" it responded in time — passes AM and AN and still allows a stale apply, because by the time the fact decision is taken the lease has expired and another worker may already have acted on the identity being unblocked. This is the highest-value discriminating case for the entire fencing rule and it is the one the mandatory test set omits.

**Why P3.** The rule is stated and atomic; this is test sufficiency, not a design defect.

**Required correction.** Extend Race AN with a Case 2, or add a race: A allocates `requestGen`, receives a usable response and allocates `responseGen` **before** expiry, then blocks on the identity lock past `leaseExpiresAt` (advanced on the authoritative clock per F-CLAUDE-PR5C5-01). Assert A fails the fence, cannot write LIVE/ABSENT, cannot tombstone or revive, cannot update null-version attributes, cannot clear a newer observation's evidence, and that a burned `responseGen` is the only residue.

**Missing test.** As stated above.

## 10. Findings summary

| ID | Severity | One-line disposition |
|---|---|---|
| F-CLAUDE-PR5C4-01 | P2 | **RESOLVED** — multi-row `CatalogObservationInFlight`, finite lease, logical abandonment, in-transaction fencing, Races AM/AN, bounded refetch, role boundary preserved |
| F-CLAUDE-PR5C4-02 | P3 | **RESOLVED** — `second.observationRequestGen > first.observationResponseGen` required; Race AB Case 2 added; no safeguard weakened |
| F-CLAUDE-PR5C5-01 | **P2** | **NEW** — lease has no authoritative clock; skew permits premature abandonment and a simultaneously passing fence |
| F-CLAUDE-PR5C5-02 | **P3** | **NEW** — fence not explicitly fail-closed when the in-flight row has been physically deleted |
| F-CLAUDE-PR5C5-03 | **P3** | **NEW** — no mandatory race for multiple simultaneous blockers with partial expiry |
| F-CLAUDE-PR5C5-04 | **P3** | **NEW** — no mandatory race for response-before-expiry / apply-after-expiry |

**P0 = 0 · P1 = 0 · P2 = 1 · P3 = 3.**

## 11. Verdict

**CORRECTIONS REQUIRED**

Both correction-4 findings are fully discharged. F-CLAUDE-PR5C4-01 is resolved by a design that removes the failure mode — multiple simultaneous durable observations, a finite lease, logical abandonment that needs no reaper, and a fence atomic with the fact decision — rather than guarding it. F-CLAUDE-PR5C4-02 is resolved exactly as specified, with Race AB extended and no existing safeguard weakened. Correction 5 preserves every correction-4 interval invariant, adds no cross-role dependency, keeps `stocky_control_plane` out of merchant fact and in-flight DML, and leaves all control records mutually consistent with R-159 correctly OPEN at P2.

The verdict is nevertheless CORRECTIONS REQUIRED because F-CLAUDE-PR5C5-01 sits **inside the newly introduced mechanism**: correction 5 elevates lease expiry to the stated correctness boundary for a tenant fact decision, yet never names the clock that evaluates it, and this repository's accepted PR 4 precedent would lead an implementer straight to independent application-node wall clocks. Under ordinary drift that permits premature abandonment and a passing stale fence in the same window — the R-159 damage class re-entering through its own remedy. The three P3 findings are narrow: one fail-closed sentence and two mandatory races that the brief's own test methodology would otherwise require.

All four corrections are documentation-only and narrow in scope. No finding invalidates the correction-5 architecture.

Implementation remains **NOT STARTED** and **NOT AUTHORIZED**. The implementation branch `phase-1/catalog-location-inventory-facts` remains absent. D-053 is unchanged and no D-054 is created by this report. Both immutable review reports — `PR5_PLANNING_INDEPENDENT_REVIEW.md` (blob `f6e62fe16a63a79f778daaee6991296868a8285b`) and `PR5_PLANNING_CORRECTION_4_INDEPENDENT_REVIEW.md` (blob `e645c81c38419c962d6b8670542aee082fee56ee`) — were not modified. PR #24 remains DRAFT and UNMERGED. Production remains unauthorized and every inventory-write flag remains DEFAULT OFF.

This report records findings only. Any correction is Cursor's work after ChatGPT's decision.
