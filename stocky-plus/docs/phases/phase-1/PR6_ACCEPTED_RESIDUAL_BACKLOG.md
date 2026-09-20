# Phase 1 PR6 — Accepted Residual Backlog

**Status:** `ACCEPTED RESIDUALS CARRIED FORWARD AFTER PR6 REPOSITORY-IMPLEMENTATION TECHNICAL ACCEPTANCE AND CHATGPT DOCUMENTARY CLOSEOUT ACCEPT — FORMAL PR6 CLOSURE PENDING OWNER MERGE — NOT PRODUCTION-ROLLOUT CLOSED`

**Authority:** ChatGPT technical acceptance under **D-054 EFFECTIVE** (post-authorization closeout; **not** D-055)
**ChatGPT D disposition:** **ACCEPT PR6-D REPOSITORY IMPLEMENTATION** (comment `5744256383`) plus post-merge identity acceptance (comment `5745082755`)
**ChatGPT documentary closeout ACCEPT:** comment [5747824848](https://github.com/Vedang1998/Stocky/pull/47#issuecomment-5747824848) — twenty-row risk disposition; P3-CLOSEOUT-01/02/03 accepted nonblocking
**Independent closeout review:** `PR6_FORMAL_CLOSEOUT_INDEPENDENT_REVIEW.md` blob `c17e7150a39afe625f6b90c538a96e08a42e5808` (never edit); verdict **`APPROVE PR6 FORMAL REPOSITORY CLOSEOUT`**
**Live main / squash W:** `ee193f38491245a10fb2fa60d2cf9a29f3271605`
**Accepted D implementation C:** `ca33d9a7871fd0eef77d19d06cbe2bfae47dad0b`
**Final accepted PR43 head R:** `ef2b98c42c69f76303c44d0809058ca3c7f3052b`
**Closure report:** `PR6_CLOSURE_REPORT.md`

This backlog carries **exact source IDs**. It distinguishes:

1. **accepted / not fixed** residuals;
2. **implemented and independently resolved** failure instances (must not be kept incorrectly open);
3. **standing regression controls** (future recurrence is not claimed impossible);
4. **accepted source limitations**;
5. **unattributed observations**;
6. **later product / cutover / production** obligations that this repository closeout does not discharge.

No runtime fix is included. Severities are not lowered. ChatGPT documentary ACCEPT is recorded. Formal PR6 closure remains **pending owner squash-merge**.

## How to read a row

| Field | Meaning |
|---|---|
| Class | accepted residual / standing control / fixed instance / source limitation / unattributed / later product |
| Blocks repository closure? | Whether ChatGPT should treat it as blocking **this** closeout |
| Blocks PR7 admission? | Whether it is a PR7 **runtime** entry blocker (usually no; PR7 still needs its own planning/runtime authority) |
| Blocks later metrics / cutover / production? | Remaining true obligations outside this closeout |

## A / B / C accepted residuals (not fixed)

### NEW-CLAUDE-PR6B-C01 — duplicate fragment names last-wins in the bulk-rule gate alone

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Accepted residual / not fixed** |
| Source | `PR6_B_ADMIN_READ_CORRECTION_INDEPENDENT_REVIEW.md` blob `e902a1ce07e30174cd56cea13114be7325195c98` |
| Affected scope | `app/lib/order-facts/admin-read/bulk-operation-rules.ts` rule gate considered **alone** |
| Evidence | Duplicate `fragment D on Order` → `evaluateBulkOperationRules` returns `eligible: true` (last definition wins). Mandatory `specifiedRules` / `assertQuerySchemaValid` still rejects via `UniqueFragmentNames`. Bulk B disabled; no submit path on the B branch. |
| Owner | PR6-B accepted residual; **not** a D repair |
| Follow-up trigger | A future bulk submitter, or a test that the schema gate rejects duplicate fragment names with a comment that the rule gate delegates uniqueness |
| Blocks repository closure? | **No** (accepted at B approval) |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | Only if a later bulk submitter relies on the rule gate alone |

### P3-FINAL-01 — F-F03 remains a timing-sensitive tooling assertion

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Standing regression control** (tooling). INDEX-01/02 repaired **specific failure instances**; they do **not** make every future timing-sensitive failure impossible. |
| Source | `PR6_C_APPLICATOR_FINAL_INTEGRATION_INDEPENDENT_REVIEW.md` blob `0daa0e5395c69b1fb86508f133f6ade3f8430f56` |
| Affected scope | F-F03 harness / index overlap observation; **not** B/C/D product apply |
| Evidence | Claude: recurrence expected until the harness can hold a scan phase open or the post-burst assertion is reframed. Failure is **not waived**. No assertion relaxation, skipped gate, or retry-to-green. |
| Owner | Tooling lane (PR #41 remains parked / unmerged). Not B, not C, not D runtime. |
| Follow-up trigger | Recurring F-F03 failure on exact-head CI, or an authorized tooling PR |
| Blocks repository closure? | **No** (accepted at C final integration) |
| Blocks PR7 admission? | **No** as a product contract; CI still fails closed if F-F03 fails |
| Blocks later metrics / cutover / production? | Tooling reliability only |

### P3-FINAL-02 — standalone temporary fixture-directory leakage

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Accepted residual / fixture hygiene** |
| Source | C final integration review blob `0daa0e53…` |
| Affected scope | Safety-suite `/tmp/pr6-c-*` overlay repos. CLEANUP-01 repaired an inherited C shallow-git `ENOTEMPTY` **teardown failure instance**; it does **not** erase this hygiene residual or authorize broad `/tmp` deletion. |
| Evidence | ~13 dirs per run; several deliberately preserved (`unowned-keep`, `foreign`, `symlink-target`) to prove cleanup does not delete unowned paths. `git worktree` stays clean. |
| Owner | Tooling / fixture hygiene (not D runtime) |
| Follow-up trigger | Fixture-local cleanup in an authorized tooling pass |
| Blocks repository closure? | **No** |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | Host hygiene only |

### P3-FINAL-03 — first-read at-sale provenance copies current catalog GID

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Accepted source limitation** |
| Source | C final integration review blob `0daa0e53…`; carried as D residual in B/C closure |
| Affected scope | First B read of variant/product identity at sale |
| Evidence | Source cannot verify checkout-time link. Later reads correctly never overwrite `variantGidAtSale`. Preserving the identifier does **not** certify checkout-time provenance. Never relink by SKU. |
| Owner | Standing order-facts identity limitation (not a D code defect) |
| Follow-up trigger | A later authorized product/source contract that can prove checkout-time GID independently of first read |
| Blocks repository closure? | **No** |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | Metrics that treat `variantGidAtSale` as proven checkout-time identity |

## D accepted limitations, unattributed observation, and resolved instances

### SC-R-05 — final recheck does not verify agreement membership

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Accepted source / contract limitation** |
| Source | SC-recovery review blob `e8525c2f…`; preserved at C quota-evidence review blob `74e57479…` |
| Affected scope | D final Order recheck |
| Evidence | Independent reviews: agreement membership is not re-paginated at final recheck; recorded as within-contract limitation, not a remaining P2. |
| Owner | Order-facts import contract |
| Follow-up trigger | Explicit later contract change requiring agreement-membership recheck |
| Blocks repository closure? | **No** |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | Only if production import is later required to certify agreement membership at recheck |

### SC-R-07 — parent content digest order-unstable for id-less children

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Accepted limitation** (unreachable through production staging) |
| Source | SC-recovery blob `e8525c2f…`; preserved at C blob `74e57479…` |
| Affected scope | `importParentContentDigest` for id-less children |
| Evidence | Independent reviews: accepted; unreachable through production staging. |
| Owner | D import digest |
| Follow-up trigger | Production staging starting to emit id-less children, or a digest-stability contract change |
| Blocks repository closure? | **No** |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | Only if that unreachable path becomes reachable |

### NEW-SCQ-03 — INDEX overlap simultaneity is client-side timed

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Accepted methodological limitation** |
| Source | Final-control review blob `ee3f625c…`; quota-evidence review blob `74e57479…` §6.3 / §7 |
| Affected scope | F-F03 / INDEX overlap tests (`process.hrtime` brackets) |
| Evidence | PostgreSQL exposes no server-timestamped write/scan simultaneity. **Not** presented as server-timestamped proof. |
| Owner | Tooling / index harness |
| Follow-up trigger | A later harness that can prove server-timestamped overlap, if ChatGPT requires it |
| Blocks repository closure? | **No** |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | Tooling evidence quality only |

### SC-R-08 — unreproduced SIGKILL ack.bits observation

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Unattributed observation — not a fabricated fixed bug** |
| Source | SC-recovery blob `e8525c2f…`; preserved unchanged at C |
| Affected scope | Confirmatory SIGKILL / scratch ack.bits |
| Evidence | ENOENT `ack.bits` after SIGKILL was **not reproduced** as a attributed defect. Vendor confirmatory SIGKILL remains correctly labelled. Do **not** close this as “fixed.” |
| Owner | D scratch recovery evidence |
| Follow-up trigger | Independent reproduction of the observation as a defect, or ChatGPT explicit retirement as unattributed |
| Blocks repository closure? | **No** (unattributed, not a blocking finding) |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | Only if later reproduced as a real recovery defect |

### Mapped CLEANUP / INDEX / JSONL repairs (do not keep the fixed instances open)

| ID | Class | What was fixed | What remains |
|---|---|---|---|
| PR43-CI-CLEANUP-01 | **Fixed failure instance** | Inherited C overlay `ENOTEMPTY` teardown; independently **RESOLVED** at S | Does not erase **P3-FINAL-02** hygiene residual; no broad `/tmp` deletion |
| PR43-CI-INDEX-01 | **Fixed failure instance** + standing control | Overlap/lock-graph harness repaired; independently **RESOLVED** at S | **P3-FINAL-01** / **NEW-SCQ-03** remain; future timing-sensitive F-F03 failures still fail CI |
| PR43-CI-INDEX-02 | **Fixed failure instance** | Phase-specific remaining-work predicate independently **RESOLVED** at C (30/30 ×3; mutation controls fail if reverted). Historical cause of CI `35415196729` remains an **inference**. | **NEW-SCQ-03**; standing F-F03 control |
| JSONL isolation follow-up | **Fixed failure instance** | Unique per-test scratch roots, owned-child SIGKILL cleanup; independently **RESOLVED** at C (83 passed twice; no assertion weakened) | Not a claim that every future isolation leak is impossible |
| NEW-SCQ-01 | **Resolved P2** | Reservation-ledger evidence integrity; independently **RESOLVED** at C | Standing quota-integrity regression control |
| NEW-SCQ-02 | **Resolved P3** | Production transport hard-stop bypass removed; independently **RESOLVED** at C | Standing export-guard |

Do **not** keep NEW-SCQ-01, NEW-SCQ-02, JSONL isolation, CLEANUP-01, INDEX-01, or INDEX-02 open as unfinished D implementation. Do **not** claim every timing-sensitive future F-F03 failure is impossible.

## Planning carry-forwards (not closed by A/B/C/D runtime)

| ID / topic | Severity / status | Class | Follow-up |
|---|---|---|---|
| Refund-money reconciliation diagnostic noise on unsettled/failed transactions | Planning accepted P3 (PR #34 / D-054 item 23) | Later metric / diagnostic presentation | Not closed by A schema or D import |
| PO-11 gitignored-codegen provenance | Planning accepted P3 | Tooling / codegen provenance | Not closed here |
| PO-02 v1 sanitizer cutover date | Product freeze; **R-182 OPEN / P1** | **Later authorized cutover PR** | Keep **R-182** open; do not route to completed D branch |
| Q-012 multi-currency ABC labels | OPEN | Later metric/product | Persist already exists; labels remain open |
| Q-013 later “net sales” presentation | OPEN | Later metric/product | PO-11 still optional/reconciliation-only |
| Q-014 future location-grain demand | OPEN | Later metric/product | Do not invent `"default"` |
| Q-015 cancelled / unpaid orders in later metrics | OPEN | Later metric/product | Storage-neutral |
| Q-016 `read_all_orders` Partner timing | OPEN | Production / Partner | No grant claimed |
| Q-008 privacy policy legal review | OPEN | Production / legal | Unchanged |

## PR5 production-readiness requirements (cross-reference only)

These remain in `PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md`. This PR6 closeout **does not discharge** them:

| ID | Why they remain |
|---|---|
| **P3-CLAUDE-F3XH-06** | Kill-switch / refetch chunk hardening before production enablement |
| **P3-CLAUDE-F3XH-08** | Non-concurrent index rollout before applying F3 migration to populated production tables |

**R-164** remains **OPEN / P3** unchanged (physical DELETE reachable at DB layer; ordinary apply tombstone-only). **R-176** remains **OPEN / P0** as the access-window / tombstone safety control even after D repository evidence is accepted on **W**.

## P3-CLOSEOUT findings (accepted nonblocking; no new hardening assignment)

ChatGPT comment [5747824848](https://github.com/Vedang1998/Stocky/pull/47#issuecomment-5747824848) accepts these three P3 findings as-is. They do **not** block documentary closeout. No new hardening assignment is required. The out-of-scope PR5 brief named by -02 is **not** edited here.

### P3-CLOSEOUT-01 — risk→evidence traceability is contract-level, not case-level (18 of 20 rows)

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Accepted documentary residual / not fixed** |
| Source | Closeout independent review blob `c17e7150a39afe625f6b90c538a96e08a42e5808` §6 |
| Affected scope | `RISK_REGISTER.md` rows R-166…R-185; original closeout recommendation matrix |
| Evidence | Most rows justified scoped-closure with lane-level assertions rather than specific approved test cases. Mapping is substantively supportable via C review §6 / plan §19 (`T07`/`T08`/`T47`/`T55`, `T27`, `T41`/`T42`/`T43`, `T09`/`T44`/`T45`, `T46`, `T11`/`T12`) plus schema re-verify of R-171 and R-180 on **W**. This packaging records those already-verified pointers; it does **not** invent test names. |
| Owner | Documentary auditability (not runtime) |
| Follow-up trigger | Later authorized docs pass if ChatGPT requires case IDs beside every register row |
| Blocks repository closure? | **No** (accepted as-is) |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | Auditability only |

### P3-CLOSEOUT-02 — one stale live sentence outside the allowlist is not disclosed

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Accepted documentary residual / location recorded; out-of-scope file not edited** |
| Source | Closeout independent review blob `c17e7150…` §6 |
| Affected scope | `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` **line 18** and **line 54** |
| Evidence | Both lines name PR #27 squash `7827e535415c9acbacfbbb4bdedff08be6650d5c` as current `origin/main`. That SHA is the PR5-F1 squash. Live `origin/main` is **W** `ee193f38491245a10fb2fa60d2cf9a29f3271605`. Pre-existing on **W** since PR #29. This closeout must **not** edit that brief. |
| Owner | Later authorized docs pass (ChatGPT) |
| Follow-up trigger | A later authorized docs pass that is allowed to touch that PR5 brief |
| Blocks repository closure? | **No** (accepted as-is; locations identified) |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | None |

### P3-CLOSEOUT-03 — a historical identity is dropped when a T-era row is re-labelled

| Field | Value |
|---|---|
| Original severity | **P3** (unchanged) |
| Class | **Accepted documentary residual / not fixed** |
| Source | Closeout independent review blob `c17e7150…` §6 |
| Affected scope | `PROJECT_STATUS.md` PR #42 / T-era snapshot table, PR6-B row |
| Evidence | Replacement row preserves “technically accepted, not yet merged” but drops identity `57bebc6b…` and the byte-identity statement. The identity remains in four dated source records: `PR6_BC_CI_RELIABILITY_INDEPENDENT_REVIEW.md`, `PR6_BC_CI_RELIABILITY_REPORT.md`, `PR6_BC_EXECUTION_BRIEF.md`, `PR6_B_ADMIN_READ_IMPLEMENTATION_REPORT.md`. |
| Owner | Historical snapshot hygiene (not runtime) |
| Follow-up trigger | None required; identity is preserved in dated records |
| Blocks repository closure? | **No** (accepted as-is) |
| Blocks PR7 admission? | **No** |
| Blocks later metrics / cutover / production? | None |

## Explicit non-authorization

- None of these residuals authorizes application, test, schema, migration, privilege, CI, package, Shopify configuration, or feature-flag edits in this closeout.
- None authorizes production activation, live subscription registration, Partner approval, or inventory writes.
- Inventory-write flags remain **DEFAULT OFF**.
- `FEATURE_PR5_ABSENCE_TOMBSTONE` remains **DEFAULT OFF**.
- Phase 1 remains **IN PROGRESS**.
- PR7 runtime remains **NOT AUTHORIZED**.
- PR45 remains a separate unaccepted planning assignment.
