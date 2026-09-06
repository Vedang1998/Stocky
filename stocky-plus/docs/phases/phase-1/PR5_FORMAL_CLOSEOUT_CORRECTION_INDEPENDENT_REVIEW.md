# PR5 Formal Closeout — Independent Correction Re-Review (PR #36)

**Reviewer role:** Independent adversarial documentation / governance reviewer (Claude Code).
**Review type:** Focused correction re-review of PR #36. The full original closeout review was not repeated; the original review remains immutable at blob `49dc7915ebb0bf99eaca5deb0fbdfebb38c35c54`.
**Verdict:** `CORRECTIONS REQUIRED`
**Findings:** P0 0 / P1 0 / **P2 1** / P3 2

This artifact is immutable once committed. It does not merge anything, does not authorize any merge, does not mark PR #36 ready, does not modify PR #36 or PR #34, does not authorize PR6 runtime, does not authorize production or merchant production data, does not enable any feature flag, and does not create D-055.

---

## 1. Identity gate — PASS

| Field | Required | Independently observed |
|---|---|---|
| `origin/main` | `36365e2535a2394fa53b0642db4dbf90a438316f` | `36365e2535a2394fa53b0642db4dbf90a438316f` ✓ |
| PR #36 exact head | `1925a7b260170483717b29d6978d614cd1033d39` | `refs/pull/36/head` = `1925a7b260170483717b29d6978d614cd1033d39` ✓ |
| PR #36 state | OPEN / DRAFT / UNMERGED | `state=open`, `draft=true`, `merged=false`, `mergeable_state=clean` ✓ |
| Merge base | exact current main | `36365e2535a2394fa53b0642db4dbf90a438316f` ✓ |
| Ahead / behind | — | ahead 4, behind 0 (2 original + 2 correction commits) ✓ |
| Previous reviewed head is an ancestor | required | `git merge-base --is-ancestor 3523e2af… 1925a7b…` = YES ✓ |
| PR #34 | `f5d429b7b3577c87e67c5ef3445e88560e565a5c` | `refs/pull/34/head` = `f5d429b7b3577c87e67c5ef3445e88560e565a5c` ✓ |

---

## 2. Correction delta — PASS (exactly two commits, docs/control only)

| SHA | Author | Timestamp | Subject |
|---|---|---|---|
| `b1c9263ee2a4d5e37cd797a2326b16b5cdd5114b` | Claude Opus 5 | `2026-09-06T03:18:12Z` | docs: PR5 formal closeout independent docs/governance review |
| `1925a7b260170483717b29d6978d614cd1033d39` | Cursor Agent | `2026-09-06T03:27:09Z` | docs: correct PR5 closeout review findings without runtime change |

`git rev-list --count 3523e2af…..1925a7b…` = **2**. Delta stat: `+460 / -44`, 7 files.

Delta paths — exactly the seven expected, no more, no fewer:

| Path | Status |
|---|---|
| `stocky-plus/docs/DECISIONS.md` | M |
| `stocky-plus/docs/PROJECT_STATUS.md` | M |
| `stocky-plus/docs/RISK_REGISTER.md` | M |
| `stocky-plus/docs/phases/phase-1/PR5_CLOSURE_REPORT.md` | M |
| `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md` | M |
| `stocky-plus/docs/phases/phase-1/PR5_FORMAL_CLOSEOUT_INDEPENDENT_REVIEW.md` | A |
| `stocky-plus/docs/phases/phase-1/README.md` | M |

**No executable code changed.** Filtering the full PR path set (`origin/main` → `1925a7b…`, 11 paths) against `\.github/|prisma/|package(-lock)?\.json|\.graphql|shopify\.app\.toml|/app/|/scripts/|\.ts$|\.tsx$|\.sql$|\.js$|\.mjs$|\.yml$|\.yaml$|\.toml$` returns **zero matches**. All 11 paths are `stocky-plus/docs/**/*.md`. `git diff --check` on the delta is clean.

---

## 3. Immutable review gates — PASS

| Artifact | Required blob | Observed at `1925a7b…` |
|---|---|---|
| `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` | `8d6d47a204d7976339c0023b6b28249f20a337a7` | `8d6d47a204d7976339c0023b6b28249f20a337a7` ✓ |
| `PR5_FORMAL_CLOSEOUT_INDEPENDENT_REVIEW.md` | `49dc7915ebb0bf99eaca5deb0fbdfebb38c35c54` | `49dc7915ebb0bf99eaca5deb0fbdfebb38c35c54` ✓ |

- The F3 review is byte-identical to source commit `b06e1ae2287f0d8fbf1ba6be87b8ee496a05f1ee` (empty diff).
- The first closeout review is byte-identical to its authoring commit `832d0e26cba9106f498a81ab5c00d37b2e10b47b` (empty diff). It was integrated as `b1c9263…` and **not** touched by the Cursor correction commit `1925a7b…`, whose changed-path set contains neither artifact.
- **The first review remains immutable despite carrying a `CORRECTIONS REQUIRED` verdict.** Its findings text, including the verbatim quotation of the stale PR6 sentence it identified, is preserved unaltered. ✓

---

## 4. Exact-head CI gate — PASS

| Field | Required | Observed |
|---|---|---|
| Run | `34009039405` | `34009039405` ✓ |
| Workflow / number | — | `CI` (`.github/workflows/ci.yml`), run 411, attempt 1 |
| Event | `pull_request` | `pull_request` ✓ |
| Head | `1925a7b260170483717b29d6978d614cd1033d39` | matches ✓ |
| Conclusion | SUCCESS | **success** ✓ |
| Classify `101421464406` | SUCCESS | **success** ✓ |
| Heavy `101421483697` | SKIPPED | **skipped** ✓ |
| CI Gate `101421482979` | SUCCESS | **success** ✓ |

Classifier outputs read directly from the Classify job log, not from PR prose:

```
pr_base_sha=36365e2535a2394fa53b0642db4dbf90a438316f
pr_head_sha=1925a7b260170483717b29d6978d614cd1033d39
compare_base=36365e2535a2394fa53b0642db4dbf90a438316f
compare_head=1925a7b260170483717b29d6978d614cd1033d39
changed_path_count=11        (all 11 tagged [docs])
classification_reason=every_changed_path_is_docs_allowlist
docs_only=true
full_ci=false
```

**No later push superseded this run.** The branch `cursor/pr5-formal-closeout-5191` has exactly two CI runs in its entire history — run `34007163436` on the superseded head `3523e2af…` and run `34009039405` on the reviewed head. No run exists after `34009039405`, and `refs/pull/36/head` still equals `1925a7b…`.

---

## 5. `P2-CLAUDE-PR36CO-01` — **RESOLVED**

The original defect was that all 28 rows R-129 … R-156 carried residual `OPEN — PR 5 planning (D-053)` with 26 of them naming `PR 5 implementation` — the lane this closeout closes — as their sole follow-up venue.

Mechanical verification at the corrected head:

| Check | Result |
|---|---|
| Rows still reading `OPEN — PR 5 planning` | **0** (was 28) ✓ |
| Rows R-129…R-156 whose Follow-up names `PR 5 implementation` | **0** (was 26) ✓ |
| Severity changes anywhere in the register vs `origin/main` | **none** — every Severity cell byte-identical ✓ |
| Row-ID set vs `origin/main` | identical; no row added or removed ✓ |
| Non-row lines changed vs `origin/main` | none ✓ |
| Rows changed by the correction | R-129 … R-158 (30). R-159 … R-165 byte-identical to the previously reviewed head ✓ |

The closeout also records the matrix in `PR5_CLOSURE_REPORT.md` (new "R-129 through R-156 post-PR5 dispositions" section), `PROJECT_STATUS.md`, `phases/phase-1/README.md`, and `DECISIONS.md` item 21, and correctly removed the now-obsolete instruction *"Do not invent closures for R-129 through R-156 in this packet."*

### 5.1 Independent adjudication of the 15 closures

I did not accept the matrix on Cursor's word. Each closure was checked against the immutable F3 exact-head review **and**, where the claim is a repository property, against the merged code and schema at `origin/main`.

| Risk | Sev | Claim | Independent verification | Verdict |
|---|---|---|---|---|
| **R-129** | P1 | `partialDataUrl` never canonical success | `admin-read/bulk-operation.ts:64-68`: `canonicalSuccessEligible = status === "COMPLETED" && url != null && url !== "" && partialDataUrl == null`. F3 review §5.1 PASS; §7 lists R-129 as materially advanced. | **SOUND** |
| **R-130** | P1 | GID identity, not SKU/barcode/title | Schema: `ShopifyProductFact`/`VariantFact`/`InventoryItemFact`/`LocationFact` each `@@unique([shopId, shopifyGid])`; `InventoryLevelFact` `@@unique([shopId, inventoryItemGid, locationGid])`. `sku`/`barcode` are `@@index` only — **no unique index on sku, barcode or title anywhere**. Tombstone columns `deletedAt` / `deletionSource` present on four fact models. | **SOUND** (verified in schema, not merely "not reopened") |
| **R-131** | P1 | Webhook is a signal; worker authoritatively refetches | F3 review §5.4 PASS; §7 lists R-131 as materially advanced ("refetch, not webhook quantities"). | **SOUND** |
| **R-133** | P1 | Forecast / low-stock coupling removed from canonical apply | `grep computeForecast\|LowStockAlert` over `app/lib/catalog-facts/**` and `app/jobs/workers/catalog-facts/**` returns **only two test files that assert their absence** (`compatibility-projection/safety.test.ts:32-33`, `legacy-consumer-characterization.test.ts:56-57`). `webhook-processor.ts` has zero matches. The decoupling is enforced by live regression gates. | **SOUND** (stronger than the row's own "did not reopen" phrasing) |
| **R-134** | P1 | `currentBulkOperation` removed; poll by id | `currentBulkOperation` survives in `app/` only as an AST **forbidden-field rejection** (`admin-read/safety/graphql-ast.ts:121,186`) and in tests asserting its absence. `bulkOperation(id:` is the poll. F3 review §5.3 PASS, probe C7. | **SOUND** |
| **R-135** | P1 | Bounded streaming; no whole-body ingest | `grep "\.text()"` over both catalog-facts trees (production files) returns **nothing**. F3 review §7 materially advanced. | **SOUND** |
| **R-136** | P1 | Complete location pagination | No `first: 50` on the canonical path; `readAllLocations` (`admin-read/locations.ts:78`) paginates. F3 review §7 materially advanced. | **SOUND** |
| **R-137** | P1 | RLS not weakened for ingest | No `BYPASSRLS`, `DISABLE ROW LEVEL SECURITY`, `SET ROLE`, or `row_security = off` anywhere in `app/` — the only hits are a doc comment and an isolation test asserting the runtime role **lacks** BYPASSRLS. F3 review §5.14 PASS, probes J1–J4; tenant CI suites green. | **SOUND** |
| **R-139** | P1 | Exact decimals; no `Number`/`parseFloat` | `grep -E "parseFloat|\bNumber\("` over `app/lib/catalog-facts/ingest/` production files returns **nothing**. F3 review §7 materially advanced. | **SOUND** |
| **R-144** | P1 | Omission is a candidate, not a tombstone | F3 review §5.5: `nominateAbsenceCandidates` requires proven owning-domain evidence and a `COMPLETE` epoch; dual circuit breaker; `deletionReconciliationHealthy: false` always. §7 materially advanced. | **SOUND** |
| **R-146** | P2 | Re-stream from byte 0; no HTTP Range | No `Range` header usage anywhere in either catalog-facts tree. F3 review §5.2 PASS, probes K1–K7. | **SOUND** |
| **R-149** | P1 | Stale delete → diagnostic | F3 review §5.5 and §7 ("stale delete → diagnostic, not tombstone"). | **SOUND** |
| **R-150** | P1 | Presence marker advances independently | F3 review §7 ("presence marker advances independently of clock-A apply"). | **SOUND** |
| **R-153** | P1 | No cross-role transaction | No `stocky_control_plane` reference in catalog-facts runtime; two-phase checkpointing. F3 review §7 materially advanced. | **SOUND** |
| **R-155** | P2 | Two non-overlapping LIVE confirmations | F3 review §5.6 PASS: one LIVE returns `terminal_first_confirmation` with `mutate: false`; overlapping second confirmations rejected at `(20,31)`, `(25,35)`, `(29,40)`, `(30,41)` against stored `(20,30)`; only `(31,32)` revives; `createdAt` mismatch blocks revival. Carry-forward table: `NEW-CLAUDE-F2CCM-01` **SATISFIED**. Probes F1–F5. | **SOUND, but see P3-CLAUDE-PR36CC-02** |

**No wrongly closed risk.** Every one of the fifteen closures is supported by direct evidence — F3-review attestation, independently reproduced probes, or repository facts I verified myself. Twelve are named in the F3 review's own §7 "materially advances" list; R-130, R-133 and R-137 are not named there but are verifiable repository properties with live regression gates, which is the stronger form of evidence for a *repository-implementation* obligation.

### 5.2 Independent adjudication of the 13 OPEN rows

| Risk | Sev | Class | Follow-up names a real surviving gate/venue? | Still at planning stage? |
|---|---|---|---|---|
| **R-132** | P1 | production/operational/readiness | Production permission-denial & catalog-submit consumption evidence; preserve unitCost preflight gates; `FEATURE_COST_SYNC` DEFAULT OFF | No ✓ |
| **R-138** | P0 | standing write-enablement control | Standing production-write-enablement control; preserve two-root scanner + negative-fixture gates (F3XH-01/-02) | No ✓ |
| **R-140** | P2 | production/operational/readiness | Production URL-expiry operational evidence; preserve expiry-recovery gates | No ✓ |
| **R-141** | P2 | production/operational/readiness | Standing bulk-document review; revisit if Shopify bulk-concurrency docs change | No ✓ |
| **R-142** | P2 | later approved PR / phase | Later focused cleanup PR; keep v1 writers fenced | No ✓ |
| **R-143** | P1 | production/operational/readiness | Preserve Race A / stale-attribute regression gates (standing control) | No ✓ |
| **R-145** | P1 | production/operational/readiness | Merchant-visible DEGRADED/HEALTHY wiring remains unauthorized; F3XH-03 tracked; preserve Race Z gates | No ✓ |
| **R-147** | P2 | later approved PR / phase | PR 8 / R-034 load, cost, cadence evidence | No ✓ |
| **R-148** | P1 | production/operational/readiness | Preserve Race H / J / AI / AJ clock-domain gates (standing control) | No ✓ |
| **R-151** | P1 | production/operational/readiness | Preserve Race L / M / T / AK nullable-version gates (standing control) | No ✓ |
| **R-152** | P1 | production/operational/readiness | Preserve Races P/Q/R/S/T/AD + AE–AL; do not regress to Shop-row convoy locking | No ✓ |
| **R-154** | P1 | production/operational/readiness | Production blast-radius evidence; preserve Races U/V/W/O and **F3XH-06** | No ✓ |
| **R-156** | P2 | production/operational/readiness | Production diagnostic-reconciler evidence; preserve Race Z/F; do not report false HEALTHY | No ✓ |

Every OPEN row keeps its original severity, states truthfully why it survives, and names a real surviving gate, venue, later PR/phase, production-readiness requirement, or standing control. **No wrongly open or stale risk.**

The ten rows in the "surviving production / operational / readiness" class align with the F3 review's own §7 statement that R-132, R-138, R-140, R-141, R-143, R-145, R-147, R-148, R-151 and R-152 "remain in the state the register records", plus R-154 and R-156, which the review materially advanced but for which production-scale evidence does not exist.

*Observation, not a finding:* four rows in that class (R-143, R-148, R-151, R-152) carry follow-ups that are purely standing repository regression gates rather than production evidence, so the class label is broader than the follow-up. The stated requirement — "a real surviving gate, venue, later PR/phase, production/readiness requirement, **or standing control**" — is satisfied by "standing control", so no finding is raised.

---

## 6. R-138 — **CORRECT**, all six required framing elements present

| Required framing | Present at `1925a7b…` |
|---|---|
| Severity | **P0**, unchanged ✓ |
| State | **OPEN** ✓ |
| PR5 repository scanner / deny-by-default / negative-fixture obligation satisfied | *"The PR5 repository scanner / deny-by-default / negative-fixture obligation is independently satisfied (two-root recursive semantic scanner, probes C1–C9 and H1–H5; R-163 closed for that scanner obligation only)."* ✓ |
| Accidental Shopify-write risk survives as a standing production/write-enablement safety control | *"**OPEN — standing P0 write-enablement / production-safety control.**"* ✓ |
| Production inventory writes remain UNAPPROVED | *"Production inventory writes remain UNAPPROVED."* ✓ |
| Write flags remain DEFAULT OFF | *"Write flags remain DEFAULT OFF."* ✓ |
| Scanner / negative-fixture gates remain mandatory | *"Scanner and negative-fixture gates remain mandatory."* + follow-up *"Preserve two-root scanner and negative-fixture regression gates (F3XH-01 / F3XH-02)."* ✓ |
| R-163 scanner closure does not globally close R-138 | *"This does not globally close accidental Shopify-write risk and is not production write authorization."* and R-163's own row still states **"R-138 remains OPEN"** ✓ |

Follow-up also carries *"Do not enable inventory writes without separate authorization."* No broader closure was asserted.

---

## 7. `P2-CLAUDE-PR36CO-02` — **RESOLVED**

The stale main-side sentence was actually corrected in the file the original finding named:

```
- | PR #34 | … PR6 planning — do not edit. PR6 planning is independently accepted. PR6 runtime remains NOT AUTHORIZED until PR 5 is fully closed. |
+ | PR #34 | … PR6 planning — do not edit. PR #34 PR6 planning correction remains OPEN / DRAFT; independent final
+   correction re-review remains pending. PR6 runtime remains NOT AUTHORIZED. |
```

All three substantive requirements are met: PR #34 planning correction **OPEN / DRAFT** ✓; independent final correction re-review **pending** ✓; PR6 runtime **NOT AUTHORIZED** ✓.

### Stale-phrase search result

`git grep "PR6 planning is independently accepted"` at `1925a7b…` over `stocky-plus/docs` returns hits in exactly **two files, both immutable independent review artifacts**, where the phrase appears as *quoted evidence of the defect*:

- `PR5_F2A_EMERGENCY_CONTROL_PACKET_INDEPENDENT_REVIEW.md:305,307` (the original NEW-CLAUDE-PR33CP-01 finding);
- `PR5_FORMAL_CLOSEOUT_INDEPENDENT_REVIEW.md:266,269,271,346,388` (my first review's P2-CO-02 finding).

**No mutable / live current-state control document carries the phrase.** ✓ Retention inside immutable historical review artifacts is expressly permitted.

### `NEW-CLAUDE-PR33CP-01` — correctly represented

Recorded consistently in four live locations (`PROJECT_STATUS.md:258` and `:303`, `PR5_CLOSURE_REPORT.md:196` and `:199`, `DECISIONS.md` item 21):

- main-side stale claim **corrected by PR #36** ✓;
- PR #34 itself **not edited** ✓;
- PR #34 still requires **its own current-main synchronization + final independent correction re-review** ✓.

The venue defect my first review raised is explicitly acknowledged and fixed, in `PR5_CLOSURE_REPORT.md:199`: *"PR #34 synchronization cannot alter a main-side file, so that stale sentence is corrected here."* The previously false "no longer repeat" assertion is now a true statement.

---

## 8. `P3-CLAUDE-PR36CO-03` (R-158) — **RESOLVED**

| Check | Observed |
|---|---|
| Severity | **P1**, unchanged ✓ |
| State | **OPEN** ✓ |
| Surviving follow-up | *"Preserve `pr5-f3-overlap-races` regression gates. Revisit if generation / interval semantics change. Revisit if production concurrency evidence contradicts the current interval / non-overlap contract. Do not invent a new PR5 implementation lane solely for R-158."* ✓ |

All three expected surviving controls are present. The row is no longer an OPEN P1 with no closure or revisit path. `PR5_CLOSURE_REPORT.md` mirrors the same surviving controls in its disposition table and retains *"Do not lower any remaining OPEN severity."* `pr5-f3-overlap-races.test.ts` exists in the repository, so the named gate is real.

---

## 9. `P3-CLAUDE-PR36CO-04` (R-157) — **NOT RESOLVED; escalated to P2**

Disposition and severity are correct: R-157 remains **`CLOSED FOR PR5 REPOSITORY IMPLEMENTATION`** at unchanged **P1**. The correction also added the allocation leg the original finding said was missing. **However, the added evidence is false.** See finding **P2-CLAUDE-PR36CC-01** in §12.

Leg-by-leg adjudication of the corrected residual:

| Claim in the corrected R-157 row | Independent result |
|---|---|
| `USAGE=true`, `SELECT=false`, `UPDATE=false` | **TRUE** — F3 review §7 reports exactly this via `has_sequence_privilege`. |
| `setval(...)` denied (`42501`) **for both `app_shop_tenant` and `app_privileged_bypass`** | **FALSE / UNSUPPORTED.** `git grep` over the **entire repository** at `1925a7b…` finds `app_shop_tenant` and `app_privileged_bypass` **only inside this one register row**. The real roles are `stocky_runtime` (78 occurrences) and `stocky_control_plane` (3) — which is what this row's **own Evidence column** and the immutable F3 review both name. Separately, the F3 review attests only `UPDATE=false` and "`setval` is unreachable by application roles"; it records **no executed `setval` returning `42501`** (its only `42501` is an unrelated harness note about `permission denied for table Shop`). |
| F3 allocation paths (`fenceGeneration`, direct start/end generation) use `SELECT nextval('stocky_catalog_observation_gen_seq')` | **TRUE** — independently verified: `app/lib/catalog-facts/observation-generation.ts:19` and `app/lib/catalog-facts/ingest/checkpoint.ts:89` are the only `nextval` sites; no `setval` call exists anywhere in `app/`. `fenceGeneration` is a real symbol (`app/jobs/workers/catalog-facts/catalog-sync.ts:119`). |
| "AE / AF / AG / AD sequence-allocation REG … remain in CI" | **UNSUPPORTED.** No test, script, or CI step anywhere in the repository references race labels AE, AF, AG or AD outside `docs/`. |
| "the tenant sequence-privilege suite remain[s] in CI" | **TRUE** — `scripts/tenant-enforcement/tests/sequence-privilege.test.ts` exists and runs as CI step *"Tenant sequence privilege tests"* (`.github/workflows/ci.yml:304-305`). |
| Follow-up: preserve `pr5-f3-sequence-allocation` regression gates | **FALSE.** No file, npm script, or CI step by that name exists. `find -name "*sequence-allocation*"` returns nothing. The eight real PR5-F3 PostgreSQL suites are `overlap-races`, `jsonl-checkpoint`, `webhook-refetch`, `absence-confirmation`, `inventory-reconcile`, `projection-health`, `lock-capacity-aw`, `scale-completeness`. |

**The closure itself remains substantively sound** — USAGE-only with `SELECT=false`/`UPDATE=false` makes `setval` unreachable, both real allocation sites use `SELECT nextval(...)`, and a real CI drift gate protects the privilege set. Only the citation is wrong, so the remedy is a single-row text fix, not engineering work. But a P1 closure in the authoritative register may not rest on identifiers that exist nowhere in the repository and on a regression suite that does not exist — particularly when those claims were introduced specifically to answer a finding that the evidence was incomplete.

---

## 10. `P3-CLAUDE-PR36CO-05` — **RESOLVED**

Both previously ambiguous rows now carry explicit historical markers, with the historical truth preserved verbatim rather than rewritten:

| Location | Before | After |
|---|---|---|
| `phases/phase-1/README.md:122` (Immutable PR #23 close block) | `\| PR 5 implementation \| **NOT STARTED — NOT AUTHORIZED** \|` | `\| PR 5 implementation \| **Historical PR #23 close row.** **NOT STARTED — NOT AUTHORIZED** \|` ✓ |
| `PROJECT_STATUS.md:55` (D-052 table) | `\| PR 5 implementation \| STARTED — PR5-F1 FOUNDATION ACCEPTED / MERGED / FROZEN \|` | `\| PR 5 implementation \| **Historical D-052 row.** STARTED — PR5-F1 FOUNDATION ACCEPTED / MERGED / FROZEN \|` ✓ |

Neither historical statement was altered; only a marker was prepended. A third instance of the same class was found during the consistency sweep — see **P3-CLAUDE-PR36CC-03**.

---

## 11. Full control-consistency check — PASS with one exception

| Check | Result |
|---|---|
| Any mutable/current control doc says **F3 NOT STARTED** as a live state | **No** ✓ |
| Any mutable/current control doc says **F3 NOT AUTHORIZED** as a live state | **No** ✓ |
| PR #35 shown as OPEN / DRAFT | **No** — CLOSED / MERGED everywhere ✓ |
| PR5 shown as still in implementation | **No**, except `DECISIONS.md:634` — see **P3-CLAUDE-PR36CC-03** |
| Formal PR5 closure still conditional on PR #36 merge | **Yes** — "effective upon merge" appears 21× across live docs ✓ |
| Phase 1 **IN PROGRESS** | 15 occurrences; every "Phase 1 complete" hit is a prohibition ("do **not** state that Phase 1 is complete") ✓ |
| D-054 **EFFECTIVE** | 27 occurrences ✓ |
| No D-055 | `## D-054 …` is the last decision heading; every "D-055" string is a prohibition or a "not created" status ✓ |
| PR6 planning final correction re-review **pending** | Recorded in all five live control docs ✓ |
| PR6 **runtime NOT AUTHORIZED** | 22 occurrences ✓ |
| Production NOT AUTHORIZED | ✓ |
| Merchant production data NOT AUTHORIZED | ✓ |
| Production migrations / deployment unauthorized | ✓ ("No production migrations have been executed. No production deployment is authorized.") |
| Shopify inventory writes unauthorized | ✓ |
| All write flags DEFAULT OFF | ✓ — verified in runtime source, not prose: `envFlag(name, defaultEnabled = false)` (`app/lib/feature-flags.server.ts:9`), `.env.example:40-44` all `false` |
| `FEATURE_PR5_ABSENCE_TOMBSTONE` DEFAULT OFF | ✓ — `.env.example:46 =false`; 17 documentary occurrences |

PR #36 changes no runtime file, so the flag state is `origin/main`'s and is unchanged by this correction.

---

## 12. Findings

### P2-CLAUDE-PR36CC-01 — R-157's corrected closure justification cites two non-existent database roles, an unattested SQLSTATE, and a non-existent regression suite

- **Severity:** P2 (blocking governance/correctness). Newly introduced by the correction commit `1925a7b…`.
- **File and line:** `stocky-plus/docs/RISK_REGISTER.md:162` (R-157, Residual and Follow-up columns).
- **Evidence:**
  1. The residual states *"`setval(...)` denied (`42501`) for both `app_shop_tenant` and `app_privileged_bypass`."* `git grep "app_shop_tenant\|app_privileged_bypass" 1925a7b…` over the **whole repository** returns exactly one hit: this register row itself. Neither identifier appears in `prisma/migrations/**`, `scripts/tenant-enforcement/**`, `app/**`, or the immutable F3 review. The real application roles are `stocky_runtime` and `stocky_control_plane` — named in **this same row's Evidence column** and in the F3 review §7. The row therefore contradicts its own evidence column.
  2. The `42501` attribution is unattested. The F3 review's R-157 entry reports `has_sequence_privilege` results and concludes "`setval` is unreachable by application roles"; it records no executed `setval` call. `sequence-privilege.test.ts` asserts privilege-**drift detection** (granting UPDATE is flagged `excess_sequence_priv`), not an executed `setval` denial.
  3. The follow-up instructs *"Preserve … F3 sequence-allocation (`pr5-f3-sequence-allocation` / AE–AG / AD) regression gates."* No such file, npm script, or CI step exists (`find -name "*sequence-allocation*"` → empty), and no test anywhere references race labels AE/AF/AG/AD outside `docs/`.
- **Merchant impact:** None. Production is unauthorized, no flag depends on this text, and the underlying disposition is correct — I independently confirmed both real allocation sites use `SELECT nextval('stocky_catalog_observation_gen_seq')` and that no `setval` call exists in `app/`. The impact is governance: the authoritative register records, as durable proof for a **P1** closure, roles that do not exist and a regression gate that does not exist. An operator asked to "preserve" that gate, or an auditor asked to re-verify the privilege proof against those roles, would find nothing.
- **Reproduction:** `git grep -n "app_shop_tenant\|app_privileged_bypass" 1925a7b260170483717b29d6978d614cd1033d39` and `find stocky-plus -name "*sequence-allocation*"`.
- **Expected behavior:** The closure justification names the real roles (`stocky_runtime`, `stocky_control_plane`), states only what the immutable F3 review attests (`USAGE=true`, `SELECT=false`, `UPDATE=false`, therefore `setval` unreachable) or evidence actually present in the repository, and names the real gate — `scripts/tenant-enforcement/tests/sequence-privilege.test.ts` (CI step "Tenant sequence privilege tests"). The verified allocation-path evidence should cite the real call sites (`app/lib/catalog-facts/observation-generation.ts:19`, `app/lib/catalog-facts/ingest/checkpoint.ts:89`) instead of an AE/AF/AG/AD suite that does not exist.
- **Recommended correction:** Documentary only, one register row. Do not change severity, do not reopen R-157, and do not add runtime or tests — the evidence that actually exists is sufficient once cited correctly.
- **Missing test:** A control-document lint asserting that every database role, test file, and npm script named in `RISK_REGISTER.md` resolves in the repository.

### P3-CLAUDE-PR36CC-02 — R-155 is closed although the immutable F3 review's §7 places it in the "remain in the state the register records" bucket

- **Severity:** P3
- **File and line:** `stocky-plus/docs/RISK_REGISTER.md:160` (R-155)
- **Evidence:** The F3 review's §7 integration-exposure paragraph lists "R-132, R-138, R-140, R-141, R-143, R-145, R-147, R-148, R-151, R-152, and **R-155** remain in the state the register records". The correction closes R-155 while leaving the other ten open. The closure is nonetheless **directly evidenced** by §5.6 (probes F1–F5: one LIVE does not revive; four overlapping second confirmations rejected; only a strictly non-overlapping pair revives; `createdAt` mismatch blocks revival) and by the carry-forward table's `NEW-CLAUDE-F2CCM-01` **SATISFIED**. §5.6 also records that `apply/existence.ts` is *"unchanged from `main`"* — the protocol pre-dated F3, which is the most likely reason §7 did not list it as advanced.
- **Merchant impact:** None. The revival path is reachable only through absence/tombstone machinery gated by `FEATURE_PR5_ABSENCE_TOMBSTONE`, which the row's own follow-up records as DEFAULT OFF.
- **Expected behavior:** The residual should note that F3 **verified** rather than delivered this protocol, and acknowledge the §7 bucketing so a later reader does not read the two documents as contradicting each other.

### P3-CLAUDE-PR36CC-03 — A third historical status row still lacks a marker, in the decisions register

- **Severity:** P3. Pre-existing on `origin/main` and untouched by PR #36; **I did not enumerate it in my first review**, which named only two rows.
- **File and line:** `stocky-plus/docs/DECISIONS.md:634` (D-052 item 13).
- **Evidence:** The item is headed *"**Current recorded status:**"* and states *"PR 5 **implementation** is **NOT STARTED** and **NOT AUTHORIZED**."* This is the same class of ambiguity as the two rows fixed under P3-CLAUDE-PR36CO-05, in a stronger authority document. The D-052 block is append-only — its item 1 likewise says "PR #20 remains OPEN, DRAFT, UNMERGED", superseded by items 11–12 — so the historical reading is available, and items 16–21 under D-054 record the live state. But the correction established the "**Historical … row.**" convention within this very PR and did not apply it here.
- **Merchant impact:** None. No gate depends on it; the live state is stated unambiguously in five other places.
- **Expected behavior:** Prepend the same "**Historical D-052 record.**" marker, preserving the historical text verbatim.

### Findings not raised

No defect was found in: the identity gate; the correction-delta scope; the absence of executable-code change; either immutable review blob; the exact-head CI evidence; the fifteen R-129…R-156 closures (each independently evidenced); the thirteen OPEN rows' severity, residual truthfulness, or follow-up venues; the R-138 P0 framing; the P2-CO-02 correction and the stale-phrase elimination; the NEW-CLAUDE-PR33CP-01 representation; the R-158 surviving follow-up; the historical-marker corrections; R-159 … R-165; the accepted P3 backlog; the D-054 / no-D-055 authority; the PR6 / PR #34 state; or any production, write, flag, or Phase-1 safety statement.

---

## 13. R-157 … R-165 final consistency

R-159 … R-165 are **byte-identical** to the previously reviewed head; only R-157 and R-158 changed in this delta.

| Risk | Sev | Disposition at `1925a7b…` | Status |
|---|---|---|---|
| R-157 | P1 | CLOSED FOR PR5 REPOSITORY IMPLEMENTATION | disposition correct; **citation false — P2-CLAUDE-PR36CC-01** |
| R-158 | P1 | OPEN, with surviving follow-up | ✓ corrected |
| R-159 | P2 | CLOSED FOR PR5 REPOSITORY IMPLEMENTATION | ✓ unchanged |
| R-160 | P1 | CLOSED FOR PR5 REPOSITORY IMPLEMENTATION | ✓ unchanged |
| R-161 | P2 | OPEN | ✓ unchanged |
| R-162 | P3 | OPEN | ✓ unchanged |
| R-163 | P3 | CLOSED FOR PR5 REPOSITORY SCANNER OBLIGATION | ✓ unchanged; still preserves **P3-CLAUDE-F3XH-01**, **P3-CLAUDE-F3XH-02**, and **"R-138 remains OPEN"** |
| R-164 | P3 | OPEN | ✓ unchanged |
| R-165 | P2 | CLOSED FOR PR5 REPOSITORY IMPLEMENTATION | ✓ unchanged |

---

## 14. Accepted F3 P3 backlog consistency — PASS

`PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md` is **byte-identical** to the previously reviewed head (empty diff; not in the correction-delta path set).

- All nine `P3-CLAUDE-F3XH-01` … `-09` present, severities unchanged ✓
- The "Mandatory pre-production classifications" table and both **Production-readiness requirement** gates for **F3XH-06** and **F3XH-08** intact ✓
- R-154's corrected follow-up additionally reinforces F3XH-06 as a pre-production requirement; R-145's reinforces F3XH-03; R-138's reinforces F3XH-01/-02 — the correction strengthened rather than disturbed the backlog ✓
- R-158 / R-161 / R-162 / R-164 intended OPEN state preserved ✓
- R-163 scanner-obligation closure with F3XH-01/-02 preserved ✓

---

## 15. PR #34 — PASS

| Check | Result |
|---|---|
| Exact head | `f5d429b7b3577c87e67c5ef3445e88560e565a5c` ✓ |
| State | OPEN / DRAFT / UNMERGED ✓ |
| Modified by any PR #36 correction? | **No** — PR #36's eleven paths are all on its own branch; PR #34's branch is untouched ✓ |
| Independent final correction re-review | **Pending** — PR #34's own body still states "INDEPENDENT FINAL CORRECTION RE-REVIEW PENDING" and "Independent correction approval — Not claimed" ✓ |
| PR6 runtime | **NOT AUTHORIZED** ✓ |

---

## 16. Verdict

The correction package resolves four of the five original findings cleanly and, in the case of P2-CLAUDE-PR36CO-01, does substantially more than the minimum: every one of the 28 R-129 … R-156 rows now carries an individually reasoned post-PR5 disposition, no severity was lowered, no closure was invented without evidence, no residual remains at planning stage, and no follow-up points at the closing lane. I independently re-derived all fifteen closures from the immutable F3 review and from the merged schema and code, and found none wrongly closed and none wrongly left open. R-138 correctly remains a standing **P0** write-enablement control with all six required framing elements. The main-side PR6 sentence is genuinely corrected, the previously false "no longer repeat" claim is now true, and the venue error is explicitly acknowledged and fixed. R-158 and both historical rows are resolved as specified. Every immutable artifact, CI identity, and safety gate holds.

One correction failed. `P3-CLAUDE-PR36CO-04` asked for the missing allocation-path leg of R-157's closure evidence. Rather than supplying it, the correction asserted it — naming two database roles that exist nowhere in the repository, an executed `setval` denial the immutable review never recorded, and a regression suite that does not exist — as the durable justification for a **P1** closure that contradicts its own row's evidence column. The disposition remains right and the fix is one row of text, but a control register may not certify a P1 closure on evidence that cannot be found.

Approval requires P0 = 0, P1 = 0, P2 = 0. With **P2 = 1**, that threshold is not met.

---

## 17. Non-authorization of this review

This artifact does **not**: authorize the merge of PR #36; mark PR #36 ready; authorize ChatGPT merge authorization; modify PR #36 or PR #34; edit any runtime, test, schema, migration, GitHub workflow, Shopify configuration, feature flag, or existing immutable review; close or reopen any risk; lower any severity; authorize PR6 planning acceptance or PR6 runtime; authorize production, merchant production data, deployment, production migrations, or Shopify inventory mutations; enable any feature flag; create D-055; or state that PR 5 or Phase 1 is complete.

PR #36 and PR #34 were not modified by this review. The user alone authorizes merges.
