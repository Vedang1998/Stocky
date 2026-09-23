# Phase 1 PR7 — Customer-completion correction independent re-review

**Outcome: CORRECTIONS REQUIRED**

One unresolved **P1**, one **P2**, two **P3**. Approval requires no unresolved P0/P1/P2, so approval is withheld.

Planning review only. This does **not** accept the plan, authorize PR7 runtime, close PR6, edit peer branches, mark ready, or merge. R-176 **OPEN / P0**. R-164 unchanged. Q-008 **OPEN**. D-054 authority; **no D-055**. Phase 1 **IN PROGRESS**.

Authority: [PR45 comment 5746513019](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5746513019). Customer-completion mandate: [comment 5737038796](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5737038796). Decisions A–E: [comment 5729229659](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5729229659).

---

## 0. Headline

**All four TF findings are substantively answered, and three of them are closed.** I independently reproduced both of my own prior counterexamples against the new contract: CE-6 (stale publisher) is now rejected byte-identically, and CE-1 (late audit row) is now both denied at the writer and visible to a genuinely source-derived residual. The 115/115 model reproduced exactly from hash-verified scripts with no repairs.

The remaining P1 is a new and narrow one, and it is the same class of defect the correction was built to eliminate — **a barrier that stops matching writes on a single-generation shop stops nothing once the shop has a second generation row.** The seed has exactly one generation per shop, so none of the 30 new unique assertions can reach it.

---

## 1. Verified identity and scope

| Field | Value | Verification |
|---|---|---|
| Subject | `a292bc8a6ea26192bc295af7338dd6d653a3e65c` (OPEN/DRAFT/UNMERGED) | PR API + `git rev-parse` |
| Planning merge base **V** | `a3ff480f1477237f8055f10c43298480a05728a1` | `git merge-base` = V |
| Current merged main **W** | `ee193f38491245a10fb2fa60d2cf9a29f3271605` | read-only; PR6-D (#43) |
| Ahead / behind vs V | **8 / 0** | `git rev-list --left-right --count` |
| Ahead / behind vs **W** | **8 / 1** | subject does not contain W |
| Ancestry | `a292bc8 → dee96cf → 9d99190 → 64649470 → 253ab202 → 86c1c52 → f1b0364 → 4158254 → a3ff480` | linear; parent is the third immutable review |
| Changed paths V→subject | exactly **5**, all `A` | `git diff --name-status` |
| Review branch | `claude/pr45-customer-completion-correction-review` | rooted exactly at subject |

Five-path scope:

```
862   0  PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md
4364  0  PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md
571   0  PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md                (immutable #1)
576   0  PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md    (immutable #2)
309   0  PR7_TOPIC_AUTHORITY_FINALIZATION_INDEPENDENT_REVIEW.md      (immutable #3)
```

The subject commit touches only the plan (`+1576/-108`) and matrix (`+102/-19`).

**All three preserved reviews are byte-for-byte intact:**

| Artifact | Declared | Observed at subject |
|---|---|---|
| Review #1 | `c1fa5c2fed74bf80d1006267b43d767258895c17` | identical ✅ |
| Review #2 | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` | identical ✅ |
| Review #3 | `e609e9526ed1ec043551ca68d6b977f5b5935d0c` | identical ✅ |

No runtime, schema, grant, dependency, CI or peer-branch file is touched. Subject and `main` re-checked after evidence collection and before publication: unchanged.

### 1.1 Exact-head CI

Run [`35405125841`](https://github.com/Vedang1998/Stocky/actions/runs/35405125841), event `pull_request`, `run_attempt=1`, `head_sha=a292bc8a6ea26192bc295af7338dd6d653a3e65c`:

| Job | ID | Conclusion |
|---|---|---|
| Classify change set (incl. classification self-test) | `105793178319` | **success** |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `105793201195` | **skipped** |
| CI Gate | `105793200250` | **success** |

Exactly as declared. Documentation integrity for a docs-only five-path diff — **not** verification of the 115-case model and not runtime evidence. No CI rerun was triggered by this review.

---

## 2. Proof fidelity

### 2.1 Script hashes — all three verify exactly

| File | Declared SHA-256 | Extracted | Match |
|---|---|---|---|
| `01_contract.sql` (1414 lines) | `75ab1c02…349846de` | `75ab1c02fc01560d975a78737bccbc7c2fa6330a07100ad98d2b243d349846de` | ✅ |
| `02_seed.sql` (72 lines) | `d0d84842…4084f632` | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` | ✅ |
| `03_run_proofs.py` (1861 lines) | `566e0f28…7823251a` | `566e0f289f2ca4da526286b3ca831c906030973958318eb60b55a0237823251a` | ✅ |

The seed digest is **byte-identical to the 59-case packet's seed**, independently confirming the "unchanged fixture" claim rather than accepting it.

### 2.2 Independent reproduction — 115/115

Disposable PostgreSQL **16.13** cluster, contract and seed loaded unmodified, supplied driver run unmodified:

```
{ "total": 115, "pass": 115, "fail": 0,
  "postgres": "16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)" }   EXIT=0
```

**No hidden GRANT, dropped policy, removed FK, relaxed check or driver repair was required or applied by me.**

### 2.3 Unique cases versus reruns — the taxonomy the mandate asked for

Parsed from `results.json` rather than from the headline:

| Measure | Count |
|---|---|
| Total records | **115** |
| Unique `(group, name)` pairs | **89** |
| Re-executed pairs (the declared clean G7–G9 rerun) | **26** |
| Preserved G1–G6 | **59** — all unique ✅ |
| New unique (G7 14, G8 7, G9 5, G10 1, NEG 3) | **30** |

| Group | Records | Unique |
|---|---|---|
| G1-topics / G2-grants / G3-shop-delete / G4-authz / G5-barrier / G6-tombstone | 15/8/10/14/9/3 = **59** | 59 |
| G7-customer-complete (TF-01) | 28 | 14 |
| G8-epoch-publish (TF-02) | 14 | 7 |
| G9-writer-inventory (TF-03) | 10 | 5 |
| G10-evidence-meta (TF-04) | 1 | 1 |
| NEG-load-bearing | 3 | 3 |

The declared "unique G1–G6 = 59" is **exactly correct**, and §14's command comment does disclose the "clean G7–G9 rerun". The honest statement of the result is **89 unique assertions, 26 of them re-executed a second time on a clean fixture, 115 records total** — the headline "115/115" alone invites reading 115 as 115 distinct assertions. Noted under **F-CC-03**, not charged as misrepresentation.

The driver uses real `threading.Thread` concurrency for the lock/barrier schedules, not sequential simulation — I verified the thread bodies. That satisfies the mandate's "a repeated green sequential script is not a substitute for controlled concurrency".

### 2.4 TF-04 verified fixed by observation

The driver now queries `current_setting('server_version')`. On my **16.13** server it reported 16.13 — the previous packet's hardcoded `16.15` would have reported 16.15 regardless. §14 relabels `results.json` a "run log, not a verification artifact", retains historical digests as original-run identities, and no longer asserts cross-execution equality. This is exactly the correction requested.

---

## 3. Crosswalk — TF-01…04 and preserved findings

| ID | Sev | Independent disposition | Basis |
|---|---|---|---|
| **TF-01** | P1 | **SUBSTANTIALLY CORRECTED** — residual P1 (**F-CC-01**) | The mechanism is right and I verified each required property below. Residual is a generation-resolution gap that defeats the writer guard on multi-generation shops |
| **TF-02** | P2 | **CORRECTED — independently verified** | I replayed my own CE-6 on the new contract: the superseded epoch-1 worker is rejected with `enumerator_stale_attempt`, and keys / `enumerationComplete` / `missingLinkages` remain **byte-identical at 3 / true / 0**. Last round the same sequence corrupted them to 0 / false / 1 |
| **TF-03** | P2 | **CORRECTED** — W refresh outstanding (§5, an entry requirement it already names) | Every V claim I checked holds exactly (§3.2) |
| **TF-04** | P3 | **CORRECTED** | §2.4 |

### 3.1 TF-01 properties I verified individually

| Required property | Result |
|---|---|
| Barrier keyed by something real writers can resolve | ✅ `key1 = hashtext('pr7-ctgt-v1:'‖shopId‖':'‖generationId)`, `key2 = hashtext(kind‖':'‖value)` with kind ∈ {`CUSTOMER_REST_ID`, `ORDER_LEGACY_ID`} — derived from shop/generation plus authenticated lookup keys, **not** a request id writers never see |
| No whole-shop freeze for a customer request | ✅ `install_customer_barrier` takes the domain **shared** lock, and refuses if fence is `ERASING`/`FINALIZING` (`superseded_by_shop_erasure`) |
| Matching writer denied while active | ✅ executed — `customer_target_erasing` |
| Residual independent of the old manifest | ✅ `stocky_privacy_customer_residual_count` re-derives from `r.lookupCustomerRestId` / `lookupOrderLegacyIds` against live tables, with the **open-ended** audit predicate retained and child lines matched by reconstructed GID so deleted roots are not confused with unknown input |
| Late row survives ⇒ residual sees it | ✅ executed — residual returned **1**, not 0. This is my prior P1 closed |
| Residual and completion share a serialization boundary | ✅ completion takes **exclusive** target locks in sorted order (deadlock-safe), re-reads barriers for this request+attempt, re-enumerates, then counts and completes in the same transaction |
| Bounded, not infinite convergence | ✅ `completeRetryCount` with `max_retries := 5` → `remnants` / `budget_exhausted` / `ESCALATED`; no receipt while residual > 0 |
| Pre-erasure payload cannot restore after release | ✅ in the single-generation case — `PrivacyCompletedTarget` + `payload_admitted_at < completedAt` → `customer_target_restore_denied`. **Defeated in the multi-generation case** (F-CC-01) |
| No lifetime suppression of legitimate later data | ✅ a payload admitted at or after completion is allowed |
| `data_request` stays read-only | ✅ reader holds no DELETE; coverage is a snapshot rule, not an erasure-empty predicate |

### 3.2 TF-03 V claims I verified directly

| Claim | Result |
|---|---|
| Dispatcher disabled-shop path **still writes** after reading `processingEnabled=false` | ✅ confirmed verbatim at the cited V lines: `if (!shopLive?.processingEnabled)` is followed by `ensureDispatchRecord(...)` then `enqueueWithDispatch(...)` |
| V has **no separate reaper module**; the reaper is in `lifecycle.server.ts` | ✅ no reaper file under `app/sync/`; `recoverExpiredRunningAttempts` at `lifecycle.server.ts:520` |
| `lifecycle.server.ts` has **no** `processingEnabled` reference | ✅ confirmed |
| `withTenantBoundTransaction` exists and is now **REQUIRED, not optional** | ✅ present in `db-context.server.ts` / `tenant-db.server.ts`; §7.9 marks it required |
| `completeAttemptRetry` and `dispatcher_disabled_shop_path` are inventoried | ✅ both present as named inventory rows with host, surfaces, guard order and test home |
| An architecture gate fails on an omitted writer / unguarded probe | ✅ G9 `inventory_incomplete_when_required_writer_removed` and `inventory_gate_detects_unguarded_tenant_linked_write` both reproduced |

`processingEnabled` is now correctly stated as an admission filter, not a transaction drain, and the cooperative-lock limitation and stop/drain rollout prerequisite are preserved.

### 3.3 Preserved findings

`F-CLAUDE-PR7CP-01…10`, `P7-C01…06` and `F-CLAUDE-PR7XC-01…11` dispositions from the three preserved reviews are carried forward unchanged. The 59 preserved G1–G6 assertions all still pass on this contract, so no regression was introduced into the Decision A–E surface. I found **no** regression in the resolved CP/XC findings.

---

## 4. New findings

### F-CLAUDE-PR7CC-01 — P1 — The customer write guard resolves the wrong generation on any shop with more than one generation row, defeating both the active barrier and restore-denial

**Anchors.** `01_contract.sql` `stocky_shop_generation_id` (the only caller is `stocky_customer_write_guard`), `stocky_customer_target_lock_key1`; plan §7.6.2, §7.7.2; matrix `PR7-TOP-015…`, `PR7-CUST-014…`; G7.

**Mechanism.** Barriers and completed-target rows are keyed on the **request's bound** `generationId`. The writer guard does not read the request — it independently resolves a generation:

```sql
SELECT g.id FROM public."ShopInstallGeneration" g
WHERE g."targetShopId" = p_shop_id OR g."shopRowId" = p_shop_id
ORDER BY g.id DESC LIMIT 1;
```

That is a **lexicographic ordering on a text id**, with no temporal column, no fence filter and no "current generation" predicate. `ShopInstallGeneration` is designed to accumulate — §7.6.1 classifier rule 6 explicitly contemplates a fresh generation after `fence=ERASED`, and `PrivacyCompletedTarget` retains prior generations by design. So a shop that has ever been reinstalled normally holds several rows, and the one that sorts highest need not be the request's.

Because `generationId` is also inside `key1`, a mis-resolved generation makes the writer take a **different advisory lock** as well — so the lock-based drain is defeated at the same time as the barrier-row check.

**Executed — CE-A (barrier defeated).** Clean fixture, barrier ACTIVE on `gen_a` for `CUSTOMER_REST_ID=191167`:

```
baseline, one generation:   ERROR: customer_target_erasing          <- correct
add gen_a_zz (a reinstall): guard resolves generation: gen_a_zz
                            request is bound to generation: gen_a
same matching write:        (no error — ADMITTED while the barrier is ACTIVE)
```

**Executed — CE-B (restore-denial defeated).** Barrier RELEASED, `PrivacyCompletedTarget` recorded for `gen_a`, a delayed **pre-erasure** payload (`payload_admitted_at = now() - 1 hour`):

```
with only gen_a present:    ERROR: customer_target_restore_denied   <- correct
with gen_a_zz present:      (no error — ADMITTED)
```

**Merchant impact.** Two distinct failures of TF-01's required guarantees:

- *During* the erasure the target repopulates. This one is partly caught downstream: the source-derived residual is scoped by `shopId` (not generation), so it counts the row and completion returns `remnants`. The erasure therefore **stalls** to `budget_exhausted`/`ESCALATED` rather than falsely completing — bad, but visible.
- *After* completion the restore-denial is bypassed, and a queued pre-erasure payload **silently restores erased customer data**. Nothing downstream catches this: there is no residual check after `P-COMPLETE`, and a completion receipt has already been issued. This is the more serious half and is why the finding is P1.

**Why the 30 new assertions miss it.** Neither `02_seed.sql` nor the driver ever inserts a second `ShopInstallGeneration` for a shop — I checked both. Every G7 case runs in a one-generation world, where `ORDER BY id DESC LIMIT 1` is trivially correct.

**Recommended correction (planning).** Pick one and state it in both documents:

1. **Preferred — make the guard barrier-driven rather than generation-guessing.** Have `stocky_customer_write_guard` match on any `PrivacyCustomerTargetBarrier` / `PrivacyCompletedTarget` row for `(shopId, targetKind, targetValue)` regardless of generation, and take the lock on each matching generation. A writer cannot then miss a barrier by resolving a different generation.
2. **Resolve the generation deterministically** — add an explicit current-generation predicate (`fence IN ('LIVE','UNINSTALLED')` plus a real `installedAt`/`createdAt` ordering, and a uniqueness rule for the live generation per shop), and make the resolver raise rather than guess when it is ambiguous.
3. **Drop `generationId` from `key1`** and scope the lock to `(shopId, kind, value)`, keeping generation as data on the barrier row rather than part of its identity.

Option 1 is the smallest change that removes the class of defect; option 2 alone still leaves `ORDER BY id` semantics to be defined.

**Missing tests.** A `PR7-TOP-*` / G7 case with **two** generation rows for one shop where the request is bound to the lexicographically-lower id, asserting (a) a matching write is still denied while the barrier is ACTIVE and (b) a delayed pre-erasure payload is still denied after completion. A negative control asserting the guard fails when the resolver is removed.

---

### F-CLAUDE-PR7CC-02 — P2 — The source-derived residual counter silently returns 0 when its RLS GUC is absent or points at another request

**Anchors.** `stocky_privacy_customer_residual_count` (SECURITY DEFINER, owner `stocky_privacy_target_owner`); the `*_enumerate` SELECT policies; `stocky_privacy_complete_customer_redact`.

**Mechanism.** The function counts using the **parameter** `p_request_id`, but its row visibility is governed by the `*_enumerate` policies, which key on the **GUC** `stocky.privacy_request_id`. `AuditEvent` is `FORCE ROW LEVEL SECURITY` and the definer owner is subject to its own policies, so when the two disagree the count is computed over rows the owner cannot see — and the function returns a number rather than raising.

**Executed — CE-C.** Clean fixture; three real matching rows exist for `preq_cr`:

```
no stocky.privacy_request_id set        -> residual = 0     (true value 3)
GUC = 'preq_cr'                         -> residual = 3     correct
GUC = 'preq_sr'  (a different SHOP)     -> residual = 0     (true value 3)
```

The **enumerator** guards precisely this mismatch (`enumerator_request_guc_mismatch`, executed), which shows the pattern is known and was applied there but not to the residual counter.

**Reachability — why P2 and not P1.** I traced the one internal call site. `stocky_privacy_complete_customer_redact` performs `stocky_privacy_enumerate_targets(p_request_id)` immediately **before** reading the residual, and that call raises on a GUC mismatch. Executed confirmation: calling the completion function with a mismatched GUC raises inside the re-enumerate and never reaches the count. So the silent zero is **not** a live false-completion path today.

It remains a real hazard because the function is independently `GRANT EXECUTE`-granted to `stocky_privacy_erasure` and `stocky_control_plane`, is designated in the plan as *the* source-derived residual for residual verification, and is protected only by an adjacent call in one code path. Any operator/diagnostic caller, or any future reordering of the completion body, gets a silent false-clean on the predicate that gates a compliance receipt.

**Recommended correction.** Give the counter its own guard, identical to the enumerator's: assert `current_setting('stocky.privacy_request_id', true) = p_request_id` and raise `42501` on absence or mismatch. Add a G7 case asserting it raises rather than returning 0 when the GUC is unset.

---

### F-CLAUDE-PR7CC-03 — P3 — Inventory row count and the "115/115" headline

Two small accuracy points:

- §7.9 states the `ParticipatingWriterInventory` table lists "26 rows"; the contract seeds **27**. The count is load-bearing for the G9 gate `inventory_incomplete_when_required_writer_removed`, so it should match.
- §14's headline "**115/115 PASS** (unique G1–G6 = 59)" is accurate but incomplete: the honest shape is 89 unique assertions plus 26 declared reruns. State the unique total beside the record total.

### F-CLAUDE-PR7CC-04 — P3 — §14's reproduction commands omit the path the driver requires

The driver hardcodes `/tmp/pr45-tf/01_contract.sql` and `/tmp/pr45-tf/02_seed.sql` in `reset()` and writes `results.json` there, but §14's command block never stages the scripts into `/tmp/pr45-tf`. Following §14 verbatim fails at `reset()` with `No such file or directory` — I hit this on the first run. Add the staging step (or make the directory a variable) so the published procedure is self-contained.

---

## 5. W-integration requirements

Reported as entry requirements, **not** defects: comment 5746513019 states W integration "remains a separate entry requirement, not grounds to relabel V as current", and the plan already carries the obligation to "refresh against formally closed PR6 before implementation". PR6-D (#43) is now merged, so that refresh is actionable and outstanding.

V→W is **92 files, +25,501 / −327**. Against the inventoried surfaces:

| Inventoried surface | V→W | Consequence |
|---|---|---|
| `app/sync/lifecycle.server.ts` | **unchanged** | The TF-03 focus symbols (`claimAttempt`, `renewAttemptHeartbeat`, `completeAttemptSuccess`, `completeAttemptRetry`, `completeAttemptFail`, `completeAttemptDeadLetter`, `recoverExpiredRunningAttempts`) are exactly as inventoried |
| `app/sync/dispatcher.server.ts` | **unchanged** | `dispatcher_disabled_shop_path` is exactly as inventoried |
| `app/jobs/workers/webhook-processor.ts` | **+260 / −18** | Inventoried row needs re-derivation |
| `app/sync/intake.server.ts` | +31 | Re-derive |
| `app/jobs/queue.server.ts` | +59 | Re-derive |
| `app/sync/sanitize.server.ts` | +64 | Re-derive |
| `app/sync/health.server.ts` | +53 | Re-derive |
| `app/sync/execution-strategy.server.ts` | +7 | Re-derive |
| `app/tenant/job-envelope.server.ts` | +10 | Re-derive |
| `scripts/sync-control-plane/manifest.ts` | +71 / −1 | Control-plane table manifest changed — directly affects the grants/roles catalogue in §7.7 |

**New tenant-linked writer family absent from the 27-row inventory.** W adds `app/jobs/workers/order-facts/sync-jobs.ts`, whose `runOrderFactsSyncJob` takes a `TenantAuthority` and an `OrderFactsTxnHost` and drives `runOrderFactsImportStep` / `runOrderFactsReconcileStep` under `app/lib/order-facts/sync/**`. The inventory covers `app/lib/order-facts/apply/writers.ts` and `apply/receipts.ts` but neither the new worker nor `lib/order-facts/sync/**`. The inventory is **V-complete and not W-complete**.

Entry requirement: re-derive the participating-writer inventory against W before implementation, adding at minimum the order-facts sync/import/reconcile writer family, and re-check the §7.7 grant catalogue against the changed control-plane manifest. I did **not** certify the V model as a W implementation.

---

## 6. Evidence classification

**Independently executed by me (this session):** ancestry / five-path / three-blob verification; PR and Actions APIs; SHA-256 extraction and verification of all three appendix scripts; disposable PostgreSQL 16.13 cluster; unmodified contract + seed load; unmodified driver run → 115/115; `results.json` taxonomy parse (89 unique / 26 reruns); counterexamples CE-A, CE-B, CE-C; independent replays of my own prior CE-1 and CE-6 against the new contract; driver concurrency inspection; V source verification of all six TF-03 claims; V→W diff analysis and inspection of the new W worker.

**Reused, not re-executed:** the 59 preserved G1–G6 assertions retain their meaning from my previous review; the packet's own reproduction of CE-1/CE-6 on the *old* model (I verified the outcome independently on the *new* model instead); external Shopify/PostgreSQL facts verified in earlier rounds and unchanged here.

**Explicitly unexecuted — external boundaries this SQL model cannot test.** Redis job drain, export publication, D scratch reclamation, live Shopify, and the installed `node_modules` `authenticate.admin` / `sessionToken.sub` binding. The packet states this in §14 and I confirm it. **I make no claim that this model tests Redis or filesystem behaviour**, and I did not inherit any parallel Cursor entry-evidence lane as passing evidence — per the mandate I neither waited for it nor read its results into this verdict. Reviewing the *completeness of their specified contracts*: §7.6.2 and §7.11 continue to name the required evidence (generation-fenced publication or positive per-target drain), refuse TTL/PID/cancel-label substitutes, and forbid completion when that evidence is absent. Those obligations are adequately specified; they remain future implementation proofs.

**Not done:** no CI rerun, no store calls, no production or merchant data, no changes to the subject, plan, matrix, any existing review, `main`, PR43, PR46, PR47, runtime, schema, grants, dependencies or CI. PR47 and the parallel Cursor lane were neither waited for nor consumed. The disposable cluster and all probe directories were destroyed.

---

## 7. Remaining conditions

1. **F-CC-01 resolved** by a generation-resolution decision (§4 options; option 1 recommended), with the multi-generation G7 cases added.
2. **F-CC-02 resolved** by giving the residual counter its own GUC guard.
3. **F-CC-03 / F-CC-04 dispositioned.**
4. **W-integration refresh** per §5 — re-derive the writer inventory and grant catalogue against merged W, including the order-facts sync writer family.
5. A further independent re-review confirming **no unresolved P0/P1/P2**.

Unchanged and mandatory: formal independently accepted **PR6 closure on merged main**, exact-head **full** CI on that base, named single writer with exclusive §7.9 ownership, and a **subsequent explicit ChatGPT runtime authorization**. Q-008 remains **OPEN** and a production blocker. **Planning approval is not runtime or merge authorization, and no outcome here — including this one — authorizes either.**

---

## 8. Artifact identity and unchanged-subject confirmation

| Field | Value |
|---|---|
| Review branch | `claude/pr45-customer-completion-correction-review` |
| Rooted at | `a292bc8a6ea26192bc295af7338dd6d653a3e65c` |
| Added path | `stocky-plus/docs/phases/phase-1/PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md` |
| Files changed | exactly one, added |
| Planning documents | **not modified** |
| Immutable reviews #1 / #2 / #3 | preserved — `c1fa5c2…`, `0a29e79…`, `e609e95…` |
| Subject before / after | `a292bc8a6ea26192bc295af7338dd6d653a3e65c` — unchanged |
| `origin/main` (W) | `ee193f38491245a10fb2fa60d2cf9a29f3271605` — read-only, unchanged |
| Actions runs triggered | none |

**Outcome: CORRECTIONS REQUIRED** — 1 P1, 1 P2, 2 P3; TF-02, TF-03 and TF-04 closed, TF-01 substantially corrected. A reviewer recommendation, not ChatGPT acceptance.
