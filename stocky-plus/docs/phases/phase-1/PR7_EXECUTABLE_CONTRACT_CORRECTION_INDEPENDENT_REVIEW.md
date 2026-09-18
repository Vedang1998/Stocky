# Phase 1 PR7 — Executable-contract correction independent review

**Outcome: CORRECTIONS REQUIRED**

**Status:** independent planning review. This document is **not** acceptance of the execution plan, **not** PR7 runtime/migration/grant/Shopify-configuration authority, **not** PR6 closure, **not** a mark-ready or merge, and **not** legal-compliance certification.

R-176 remains **OPEN / P0**. R-164 unchanged. Q-008 remains **OPEN**. D-054 remains the decision heading; **no D-055**. Phase 1 / PR6 remain **IN PROGRESS**. Formal independently accepted PR6 closure on merged `main` and a subsequent explicit ChatGPT runtime work order remain mandatory.

Authority: [PR45 comment 5728802757](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5728802757). Controlling correction order: [comment 5714629032](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5714629032). Prior constraints: [comment 5713121021](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5713121021).

---

## 0. Label discipline

| Label | Meaning in this document |
|---|---|
| **FACT (V)** | Read from merged baseline `a3ff480f1477237f8055f10c43298480a05728a1` in this session |
| **OFFICIAL** | Shopify / PostgreSQL published documentation checked **2026-09-18** |
| **EXECUTED** | Run by this reviewer in this session; command and result recorded in §7 |
| **SOURCE-DERIVED** | Concluded by reading source; not executed |
| **NOT EXECUTED** | Specified but not run here |
| **BLOCKED** | Could not be executed in this environment; reason recorded |
| **DESIGNED** | A proposed future test or contract, not a passing processor |

A **probe** in this document is a disposable PostgreSQL 16 transcription of declared V code plus declared PR45 contract text. Where a probe required a privilege or transition the PR45 documents do **not** declare, that addition is labelled **REVIEWER-SUPPLIED REPAIR** and is reported as a finding rather than silently applied.

---

## 1. Verified identity and scope

| Field | Value | How verified |
|---|---|---|
| Subject PR | #45 — OPEN / DRAFT / UNMERGED | GitHub PR API |
| Subject branch | `cursor/planning-pr7-audit-roles-privacy-20260916-63ef` | PR API + `git rev-parse` |
| Exact subject | `253ab202dbee53dc842bb1389db4a19c6e3fb058` | matches declared head |
| Exact base **V** | `a3ff480f1477237f8055f10c43298480a05728a1` | `git merge-base` = V; 4 ahead / 0 behind |
| Ancestry | `253ab20 → 86c1c52 → f1b0364 → 4158254 → a3ff480` | `git log --format='%H %P'`, linear |
| Changed paths V→subject | exactly **3**, all `A` (added) | `git diff --name-status` |
| Immutable review blob | `c1fa5c2fed74bf80d1006267b43d767258895c17` | identical at `86c1c52` and at subject |
| Review branch | `claude/pr45-pr7-executable-contract-review-20260918` | rooted exactly at subject |
| Pinned D candidate **H** | `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` | dated provisional dependency; **not** inspected or modified |

Three-path diff (`git diff --numstat a3ff480 253ab202`):

```
594  0  stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md
744  0  stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md
571  0  stocky-plus/docs/phases/phase-1/PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md
```

The subject commit `253ab202` changes only the plan and matrix (`+522/-551` and `+226/-88`); it does **not** touch the immutable review. **Confirmed: the prior independent review is byte-for-byte preserved.**

Subject and `origin/main` were re-checked after evidence collection and before publication: both unchanged, blob still `c1fa5c2…`.

### 1.1 Exact-head CI

Run [`35295884356`](https://github.com/Vedang1998/Stocky/actions/runs/35295884356), event `pull_request`, `run_attempt=1`, `head_sha=253ab202dbee53dc842bb1389db4a19c6e3fb058` (equals live PR head):

| Job | ID | Conclusion |
|---|---|---|
| Classify change set | `105448200799` | **success** |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `105448231851` | **skipped** |
| CI Gate | `105448231453` | **success** |

Exactly as declared. Per `CI_POLICY.md` §3–4 this is **documentation-integrity evidence for a provably docs-only diff**. It is **not** privacy-runtime, security, migration or implementation evidence, and this review does not treat it as such. No additional Actions run was triggered.

### 1.2 Reviewer independence

`list_sessions` shows exactly one session reviewing this subject — this one (`session_01DkK8T6ijvxmv5YHdBJgsbb`, "PR45 executable-contract independent review", model `claude-opus-5`). No duplicate Claude Code review of `253ab202` exists, so this is a new review rather than a continuation. The prior artifact `86c1c52` carries Cursor Agent commit metadata; per comment 5728802757 that metadata is preserved unchanged and is **not** treated here as establishing or refuting who reasoned.

---

## 2. Verdict summary

**CORRECTIONS REQUIRED.** Two P0, four P1, two P2, three P3 new findings. Approval is withheld because §10 of the plan and §1 of the matrix both set the bar at **no unresolved P0/P1/P2**.

The correction is a genuine and substantial improvement. Adjudicated independently, **eight of the ten** original `F-CLAUDE-PR7CP` findings are substantively addressed at the contract level, and the central RLS design of `F-CLAUDE-PR7CP-02` — previously **source-derived only** — is now **executed-verified** by this reviewer (§4.1). The blocking defects are not a return of the old errors. They are three new classes:

1. **The declared privilege set does not execute.** Three separate declared functions/roles fail with `permission denied` when the PR45 grants are transcribed literally (§4.2, F-XC-03/04/05).
2. **A foreign-key deadlock in Shop finalization.** The plan simultaneously requires the in-flight privacy job to survive Shop deletion and keeps V's `Restrict` FK, which makes the deletion impossible (§4.3, F-XC-02).
3. **The privacy authority helper is unfit for two of the three mandatory topics.** `customers/data_request` and `customers/redact` on a live installed shop either silently no-op or, if forced, acquire whole-shop erasure authority (§4.4, F-XC-01).

Items 1 and 2 are correctable by precise declaration changes. Item 3 requires a design decision by ChatGPT, not merely more text.

---

## 3. Original finding and decision crosswalk

Adjudicated independently against both complete documents and the V source — not from the packet's own disposition table.

### 3.1 F-CLAUDE-PR7CP-01…10 (original IDs and severities preserved)

| ID | Sev | Independent disposition | Basis |
|---|---|---|---|
| **F-CLAUDE-PR7CP-01** | P0 | **SUBSTANTIALLY ADDRESSED** — residual P2 | Three identities are genuinely separated (§7.4). Domain/body HMAC withdrawn as lifetime work key. Classifier §7.6.1 keys on lifecycle evidence, not clocks. **OFFICIAL** confirms `shop/redact` carries only `shop_id` + `shop_domain` — no generation field — so an app-owned generation is the correct construct. Residual: **F-XC-08** (pruned journal destroys rule-4 evidence) |
| **F-CLAUDE-PR7CP-02** | P0 | **DESIGN CORRECT AND NOW EXECUTED-VERIFIED; NOT EXECUTABLE AS DECLARED** | The §7.7 row-versus-error matrix reproduced exactly under PostgreSQL 16 (§4.1). But **F-XC-03**: the privacy role cannot execute the context helpers the policies call. And **F-XC-01**: the helper is unfit for the two customer topics |
| **F-CLAUDE-PR7CP-03** | P1 | **PARTIALLY ADDRESSED** | **FACT (V)** confirmed: runtime `Shop` privileges are `SELECT, INSERT, UPDATE` only (`BOOTSTRAP_TABLES`), and `scripts/sync-control-plane/roles.ts` does `REVOKE ALL` then column-level `SELECT`/`UPDATE` — neither role has `DELETE ON Shop`. The checked finalizer is a sound construct. Blocked by **F-XC-02** and **F-XC-04** |
| **F-CLAUDE-PR7CP-04** | P1 | **ADDRESSED IN SEQUENCING** — residual P1 | Residual-proof-then-conditional-completion ordering is correct, and post-deletion residual verification by `targetShopId` is **executed-verified** to work (§4.5). Coordinator survival via `SET NULL` + text copy is **executed-verified**. Residual: **F-XC-06** (no real quiescence primitive) and **F-XC-02** |
| **F-CLAUDE-PR7CP-05** | P1 | **ADDRESSED** | `sessionToken.sub` digit string is canonical; `Number(...)`/`String(associated_user.id)`/`Session.userId`/`as bigint` are all explicitly forbidden; unsafe numeric correlation yields `OWNER_PROOF_UNSUPPORTED`, not a grant. IEEE-754 collision independently reproduced (§7). Declared residual (library binding proof) is correctly labelled UNVERIFIED by the plan and is **BLOCKED** here (§8) |
| **F-CLAUDE-PR7CP-06** | P1 | **ADDRESSED IN PRINCIPLE** — residual P1/P2 | **FACT (V)** confirmed: `replayDeadLetter` is a single control-plane `prisma.$transaction` containing the DL `FOR UPDATE`, the job `FOR UPDATE`, the `DurableJob` create, the `JobReplay` create and the DL update. A lock-helper call placed before the inserts is therefore a **real** serialization point, not a best-effort pre-check. Residual: **F-XC-05** (helper unexecutable) and **F-XC-07** (reconciliation unachievable) |
| **F-CLAUDE-PR7CP-07** | P1 | **ADDRESSED** | Every V file named in §4.2/§7.9 exists; every named exported symbol resolves; the two the plan describes as local (`cancelAllCancellable`, `assertShopProcessingEnabled`) are indeed local, not exported. `PRIVACY_JOB_TYPES` is closed; unknown types remain `NO_AUTOMATIC_RETRY`; job-type-alone-is-not-authority is stated. `BOUNDED_CHECKPOINT_RETRY` is correctly disclosed as an additive future enum |
| **F-CLAUDE-PR7CP-08** | P2 | **ADDRESSED** | `platform.privacy.data_request.download` is separated from `platform.export.operational`; `shop_admin` is explicitly denied. **OFFICIAL** confirms data must be provided "to the store owner directly", supporting owner-only fulfilment. Uninstalled-shop operator channel is named |
| **F-CLAUDE-PR7CP-09** | P2 | **ADDRESSED** | Owner route and restricted operator CLI both named with files; `escalation_evidence_v1` schema, compare-and-set on `rowVersion`, `--dry-run` default, 6h/+20d/+27d/+30d clocks, and an explicit ban on `retain_live` and generic mark-complete |
| **F-CLAUDE-PR7CP-10** | P3 | **ADDRESSED — independently verified** | **OFFICIAL**: the privacy-law-compliance page still says a redact payload arrives ~10 days if no order in six months, otherwise withheld six months. The **2026-03-23** changelog states erasure requests are processed 10 days after submission regardless of most recent order, with a scheduled-gift-card exception. The plan's transcription of both, and its "handle on arrival, no local 180-day wait" rule, are accurate. Minor label issue at **F-XC-10** |

### 3.2 P7-C01…06

| ID | Disposition | Basis |
|---|---|---|
| **P7-C01** | **SATISFIED** | First-login ownership forbidden; owner proof requires same freshly verified online context (`account_owner === true`, `collaborator !== true`, shop/`dest` match); unknown actors stay `unassigned` with `owner_assignment_pending`; support cannot click a user into ownership |
| **P7-C02** | **PARTIALLY SATISFIED** | Runtime append-only preserved; erasure DELETE scoped to a restricted role; receipt correctly described as identifiable, not anonymous; Q-008 left open. Not executable: **F-XC-03**; audit erasure shares the helper defect in **F-XC-01** |
| **P7-C03** | **SATISFIED** | Timestamp-only `SUPERSEDED` withdrawn; `SUPERSEDED_EVIDENCED` requires operator/owner evidence, never clocks; classifier rule 6 permits a genuinely fresh reinstall after `fence=ERASED`, so no permanent domain blacklist |
| **P7-C04** | **SATISFIED as contract** | Human vs autonomous split is explicit; job types are server-derived; a caller cannot relabel a human command as `actorKind=system`. Execution defects are **F-XC-05/07**, not a C04 regression |
| **P7-C05** | **NOT SATISFIED as an executable contract** | The while-disabled capability is unexecutable under the declared grants (**F-XC-03**) and cannot serve two of the three mandatory topics (**F-XC-01**) |
| **P7-C06** | **SATISFIED** | Matrix §1 sets the bar at no unresolved **P0/P1/P2** with explicit P3 dispositions; blocked suites are labelled BLOCKED rather than passing; plan §10 requires accepted plan, PR6 closure on merged `main`, exact-head full CI, named single writer and a subsequent explicit runtime authority sentence; no V-only base is claimed |

### 3.3 D-PR7-01…14 and remaining residuals

All fourteen are carried as **constrained** with original IDs, and the register states a current→replacement transition and a runtime-blocking flag for each. This reviewer found no D-PR7 item silently converted into an accepted default, and no contradicted option left marked as accepted.

Decisions materially affected by the findings below, and therefore **not** safe to treat as settled:

| ID | Status after this review |
|---|---|
| **D-PR7-10 / D-PR7-13** | Reopened by **F-XC-01**. The single `stocky_privacy_target_allows` fence gate cannot serve all three topics. ChatGPT must choose a topic-aware authority model (§5.1) |
| **D-PR7-11** | Reopened by **F-XC-02**. The FK map and the coordinator-survival requirement are mutually unsatisfiable as written |
| **D-PR7-12** | Contract sound; execution blocked by **F-XC-05**; reconciliation semantics unspecified per **F-XC-07** |
| **D-PR7-03 / D-PR7-08 / D-PR7-14** | Unchanged and coherent |
| **Q-008** | **OPEN.** Correctly left open. No retention period is invented anywhere in the packet — confirmed by reading §7.3, §7.4 and §7.12 |

The five explicit residuals in plan §9 are appropriately surfaced rather than buried as implementation detail. Residual 1 (library `sub`/online binding) is **BLOCKED** here (§8) and remains an implementation-entry proof.

---

## 4. New findings

Severities follow `CLAUDE.md`: **P0** destructive/unrecoverable or cross-tenant; **P1** incorrect core behaviour or App Store blocker; **P2** significant reliability/maintainability; **P3** minor.

### 4.1 Positive result established first (context for the findings)

The plan's §7.7 expected row-versus-error table was transcribed verbatim into a PostgreSQL 16.13 cluster and **every predicted outcome reproduced**:

| Scenario | Plan prediction | Executed result |
|---|---|---|
| `stocky_runtime`, shop disabled, SELECT facts | 0 rows (filter) | `0` |
| `stocky_runtime`, shop disabled, DELETE facts | 0 rows (filter) | `DELETE 0` |
| `stocky_runtime`, shop disabled, INSERT `AuditEvent` | **error** (WITH CHECK) | `ERROR: new row violates row-level security policy for table "AuditEvent"` |
| `stocky_privacy_erasure`, missing/wrong request GUC | 0 rows | `0` |
| `CREATE POLICY … FOR DELETE … WITH CHECK` | not permitted | `ERROR: WITH CHECK cannot be applied to SELECT or DELETE` |

The prior review's `F-CLAUDE-PR7CP-02` conclusion was explicitly **source-derived, not a live DB execution** (comment 5714629032 says so). **This review upgrades that evidence class to EXECUTED.** The finding was correct, and the correction's response to it is architecturally sound.

**FACT (V)** supporting this: `scripts/tenant-enforcement/sql.ts` `rlsPoliciesSql` builds one predicate — `"shopId" IS NOT NULL AND "shopId" = stocky_current_shop_id() AND stocky_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId")` — and applies it to SELECT/INSERT/UPDATE/DELETE, with `ENABLE` + `FORCE ROW LEVEL SECURITY`.

---

### F-CLAUDE-PR7XC-01 — P0 — Privacy authority helper cannot serve `customers/data_request` or `customers/redact`, and forcing it grants whole-shop erasure authority

**File / line.** Plan §7.7 (`stocky_privacy_target_allows` definition); §7.6.2 step 2 (fence transitions); §7.2 and §7.13 (customer topics); matrix §6.7 `PR7-CUST-001…005`, §6.5 `PR7-PRIV-014`.

**Evidence.** The helper returns true only when the request is in `ENUMERATING|APPLYING|CHECKPOINTING|FINALIZING` **and the generation fence is `ERASING|FINALIZING`**. §7.6.2 defines the transition to `ERASING` for exactly one trigger: "On bound shop/redact". A live installed shop's generation is `LIVE`. No fence transition is defined anywhere in the packet for `customers/data_request` or `customers/redact`.

Executed against the faithful transcription:

```
-- customers/redact against a LIVE installed shop
helper_verdict                   = f
rows_visible_for_customer_redact = 0
DELETE 0

-- customers/data_request against a LIVE installed shop
rows_readable_for_data_request   = 0
```

The converse was then executed. Binding a `customers/redact` request to a generation with `fence='ERASING'` makes the helper return true — and because neither the policy nor the helper carries any customer or topic predicate, the request holds delete authority over the entire shop:

```
 id      | customerRestId
 of_red1 | cust_777
 of_red2 | cust_OTHER      <- a different customer
DELETE 2                   <- both rows removed under a customers/redact request
```

**Merchant impact.** Two failure modes, both severe and both legally material:

- **Silent false completion.** A `customers/redact` for a live shop deletes nothing and observes an empty residual — because RLS filtered every row to zero, not because the data is gone. Plan §7.6.3 step 8 completes on exactly that predicate ("INSERT receipt **iff** residual predicate true"). The completion predicate cannot distinguish *erased* from *invisible*. Matrix `PR7-CUST-005` would record `COMPLETED skipped_absent` — a green test over an unperformed legal erasure. `customers/data_request` correspondingly delivers an empty artifact to the store owner, asserting the app holds no data.
- **Over-broad erasure.** The only way to make the helper admit the request is to move the live generation to `ERASING`, which §7.6.2 step 2 also defines as setting `processingEnabled=false` and `processingDisabledReason=REDACTED` and cancelling jobs. A single customer's redaction would disable a live merchant's shop **and** arm whole-shop delete authority — the outcome matrix `PR7-CUST-005` itself lists as forbidden ("shop-wide delete").

**Reproduction.** §7 probes B2, B3, C.

**Expected behaviour.** Erasure authority must be scoped to the topic and to the request's target rows. A read-only `customers/data_request` must never acquire DELETE authority (comment 5728802757 §4 states this requirement explicitly), and a customer-scoped redaction must not become whole-shop erasure.

**Recommended correction.** Replace the single fence gate with a topic-aware authority contract. Minimum shape:

1. Add `PrivacyRequest.topic` to the helper predicate, and split the helper (or add a second one) so `customers/data_request` grants **SELECT only** and never satisfies a DELETE policy.
2. Define the admissible generation fences per topic. `customers/*` must be servable while the generation is `LIVE`; only `shop/redact` requires `ERASING|FINALIZING`. Do **not** reuse the `ERASING` transition — which disables the shop — for customer-scoped work.
3. Either carry the customer scope into the DELETE policy predicate, or state explicitly and testably that RLS provides tenant+request scoping only and that customer scoping is an application `WHERE` obligation with its own negative tests. The current documents claim the former and implement neither.
4. Add the distinction to the privilege matrix: `stocky_privacy_erasure` should not hold `DELETE` when serving a data request.

**Missing test.** No matrix row exercises a customer topic against the privacy GUC/policy path. `PR7-PRIV-014` covers only `processingEnabled=false` + `REDACTED` (the shop/redact case). Required new rows: `customers/data_request` on a live shop returns the merchant's actual rows; `customers/redact` on a live shop deletes the target customer's rows **and** leaves another customer's rows intact; a `customers/data_request` request cannot satisfy any DELETE policy.

---

### F-CLAUDE-PR7XC-02 — P0 — Checked Shop deletion is impossible: the surviving privacy job holds a `Restrict` FK on the row it must delete

**File / line.** Plan §7.6.3 step 4 and step 6; §7.6.4 FK map ("Control-plane jobs/deliveries | Restrict; ordered CP DELETE **except in-flight privacy job/request/generation**"); §7.11 steps 3–8; matrix `PR7-RED-001`, `PR7-RED-006`, `PR7-RED-017`, `PR7-RED-018`.

**Evidence.** **FACT (V)**, `prisma/schema.prisma`:

```prisma
model DurableJob {
  shop Shop @relation(fields: [shopId], references: [id], onDelete: Restrict)
}
model JobAttempt {
  shop       Shop       @relation(fields: [shopId], references: [id], onDelete: Restrict)
  durableJob DurableJob @relation(fields: [durableJobId], references: [id], onDelete: Restrict)
}
model DeadLetter { /* same Restrict pair */ }
```

The plan requires the in-flight `privacy:shop_redact` `DurableJob` to survive Shop deletion: §7.6.2 step 2 has `processUninstall`/`cancelAllCancellable` skip `PRIVACY_JOB_TYPES`, §7.11 step 7 has the worker still executing, and §7.6.3 steps 6–8 plus `PR7-RED-017/018` require it to resume after a crash *around the deletion*.

Executed, with all merchant surfaces already erased and only the preserved privacy job remaining:

```
surviving in-flight privacy job: job_priv (RUNNING)
ERROR: update or delete on table "Shop" violates foreign key constraint
       "DurableJob_shopId_fkey" on table "DurableJob"
DETAIL: Key (id)=(shop_red) is still referenced from table "DurableJob".
CONTEXT: SQL statement "DELETE FROM public."Shop" WHERE id = p_target_shop_id ..."
```

**Merchant impact.** `shop/redact` can never reach terminal `COMPLETED`. Step 6 fails on every attempt, the request stays `FINALIZING`, and the 30-day compliance clock in §7.12 runs to `OVERDUE` on every shop erasure. This is a total failure of the module's primary obligation, not an edge case.

The circularity is not resolvable by reordering. Deleting the privacy job first to satisfy the FK destroys the recovery coordinator that steps 6–8 and `PR7-RED-017/018` depend on, and destroys the executing worker's own lease and attempt rows.

The two documents also contradict each other here: matrix `PR7-RED-001` lists "leftover … DurableJob" as **forbidden**, while plan §7.6.4 **requires** the in-flight privacy `DurableJob` to be retained. `PR7-RED-006` asserts "shop not removed until children gone" — which, for this child, is unsatisfiable.

**Reproduction.** §7 probe D.

**Expected behaviour.** The erasure coordinator must not be a tenant-FK child of the row it deletes.

**Recommended correction.** Decide and declare one of:

- **(a) Detach the privacy job from the tenant FK.** Give privacy work a separate control-plane coordinator table whose shop reference is an immutable `targetShopId` **text copy with no FK**, mirroring the treatment §7.6.4 already applies to `PrivacyRequest` and `PrivacyCompletionReceipt`. This is the most consistent with the packet's own design and is this reviewer's recommendation.
- **(b) `ON DELETE SET NULL` for the privacy job's `shopId`.** Requires making `DurableJob.shopId` nullable — a non-additive change to a frozen PR4/PR6 control-plane model, affecting every tenant-scoped query and the `@@unique([shopId, idempotencyKey])` constraint. Not recommended.
- **(c) Finalize the privacy job before the Shop delete and drive steps 6–9 from a non-job coordinator.** Requires naming that coordinator and re-specifying crash recovery for `PR7-RED-017/018`.

Whichever is chosen, §7.6.4's FK map, §7.6.3's step table, and matrix `PR7-RED-001/006/017/018` must all be updated together, and the "except in-flight privacy job" exemption must be removed or made FK-consistent.

**Missing test.** A row asserting the checked finalizer succeeds **while** the executing privacy job's coordinator record still exists, and a row asserting crash-resume across step 6 with the coordinator intact.

---

### F-CLAUDE-PR7XC-03 — P1 — `stocky_privacy_erasure` cannot execute the tenant-context helpers its own policies call

**File / line.** Plan §7.7 privilege matrix and privacy policy definitions; matrix `PR7-RED-021`. **FACT (V)**: `scripts/tenant-enforcement/sql.ts` `helperFunctionsSql()` / `grantHelpersToRuntimeSql()`.

**Evidence.** V revokes the helpers from `PUBLIC` and grants them to the runtime role only:

```sql
REVOKE ALL ON FUNCTION stocky_current_shop_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION stocky_tenant_context_version() FROM PUBLIC;
-- grantHelpersToRuntimeSql(runtimeRole):
GRANT EXECUTE ON FUNCTION stocky_current_shop_id() TO "stocky_runtime";
GRANT EXECUTE ON FUNCTION stocky_tenant_context_version() TO "stocky_runtime";
```

The plan's privacy policies are `USING (tenant + version + stocky_privacy_target_allows("shopId"))` — the "tenant + version" terms are those two functions. Plan §3.5 correctly states the governing rule: *"Policy expressions run with the rights of the querying user; helpers they call must be EXECUTE-granted."* The §7.7 privilege matrix grants `stocky_privacy_erasure` its table DML and `EXECUTE` on `stocky_privacy_target_allows`, but **never** grants these two helpers. §7.9's `sql.ts` delta says only "additive privacy policy SQL generators"; no grant generator for the privacy role is named.

Executed — the declared happy path, first statement:

```
BEGIN; SET LOCAL "stocky.current_shop_id" = 'shop_red'; ...
SELECT count(*) FROM public."ShopifyOrderFact";
ERROR:  permission denied for function stocky_current_shop_id
```

**Merchant impact.** The entire privacy erasure capability is non-functional at its first statement. Note this fails **loudly** with an error rather than silently returning zero rows, which is the safer of the two failure modes — but it means every erasure job dead-letters.

**Reproduction.** §7 probe A. All downstream probes required a **REVIEWER-SUPPLIED REPAIR** granting these two functions; that repair is reported here, not folded into the design.

**Expected behaviour.** Every role subject to a policy must hold `EXECUTE` on every function that policy's expression calls.

**Recommended correction.** Add to §7.7 a `grantHelpersToPrivacySql(privacyRole)` equivalent granting `EXECUTE` on `stocky_current_shop_id()` and `stocky_tenant_context_version()` to `stocky_privacy_erasure`, and add both to the privilege matrix as an explicit row. Do **not** grant `stocky_shop_processing_enabled(text)` to the privacy role — the privacy policies deliberately omit it, and withholding it is a useful guard against a later policy accidentally reintroducing the runtime predicate.

**Missing test.** `PR7-RED-021` inspects grants but its expectation list stops at "privacy-erasure EXECUTE function only" — as written it would pass while the capability is dead. Extend it to assert `EXECUTE` on every function named in every privacy policy expression, derived from `pg_policies` rather than hand-listed.

---

### F-CLAUDE-PR7XC-04 — P1 — The Shop finalizer's generation `UPDATE` exceeds its declared owner privileges, and is redundant with the declared FK

**File / line.** Plan §7.6.4 body step 7; §7.7 privilege matrix row for `PrivacyRequest`/generation (finalizer owner: "SELECT request/generation"); §7.4 (`ShopInstallGeneration.shopRowId` … **ON DELETE SET NULL**).

**Evidence.** The function is `SECURITY DEFINER` owned by `stocky_privacy_finalizer_owner`, so its body runs with that role's privileges. Step 7 is `UPDATE ShopInstallGeneration SET shopRowId=NULL`. The declared grants for that owner are `SELECT, DELETE` on `Shop` and `SELECT` on request/generation. Executed with exactly those grants:

```
ERROR:  permission denied for table ShopInstallGeneration
CONTEXT: SQL statement "UPDATE public."ShopInstallGeneration" SET "shopRowId" = NULL ..."
-- post-state:
Shop rows for shop_red: 1        <- the whole function rolled back
```

The failure is worse than a missing privilege: because step 6 and step 7 share one function invocation, the `permission denied` aborts the transaction and the **Shop row survives**. The finalizer is atomic-fail, so it never leaves partial state — but it can never succeed either.

The step is also unnecessary. §7.4 already declares `shopRowId` as `ON DELETE SET NULL`, so the step-6 `DELETE` nulls it automatically. Executed confirmation after supplying the missing `UPDATE` grant: `generation shopRowId=<null>`, reached via the FK, with the explicit `UPDATE` a no-op.

**Merchant impact.** Independently of F-XC-02, `shop/redact` cannot complete. Two distinct blockers sit on the same statement sequence.

**Reproduction.** §7 probes E and H.

**Expected behaviour.** A `SECURITY DEFINER` function's body must be within its owner's declared privileges, and the declared grants must be the minimum that the declared body requires.

**Recommended correction.** Prefer **deleting step 7** and relying on the declared `ON DELETE SET NULL`, leaving the finalizer owner at `SELECT, DELETE` on `Shop` + `SELECT` on request/generation — the tighter grant. If an explicit `UPDATE` is wanted for auditability, §7.7 must grant `UPDATE ("shopRowId")` — column-scoped — on `ShopInstallGeneration` to the finalizer owner, and the matrix must say so. Do not grant table-wide `UPDATE`: the owner would then be able to rewrite `fence` and `targetShopId`, the very fields step 2 of the body validates against.

**Missing test.** A row asserting the finalizer executes end-to-end under exactly the catalogued grants, with no additional privilege present — i.e. a grant-catalogue test that runs the function rather than only reading `information_schema`.

---

### F-CLAUDE-PR7XC-05 — P1 — `stocky_lock_platform_assignment` is unexecutable under the declared grants; its owner is absent from the privilege matrix

**File / line.** Plan §7.10 (helper definition and EXECUTE grants); §7.7 privilege matrix row `ShopRoleAssignment` and role table.

**Evidence.** §7.7's role table introduces `stocky_assignment_lock_owner` ("Owns `stocky_lock_platform_assignment(...)`"), but the privilege matrix below it has **no column and no row** for that owner. The `ShopRoleAssignment` row lists only runtime DML, control-plane "EXECUTE lock helper only", and migration DDL. §7.10 declares `EXECUTE` to `stocky_control_plane` and `stocky_runtime`, and describes the RLS as "FORCE RLS + policy TO the owner: tenant match … still include shopId match".

Transcribed literally and executed as `stocky_control_plane`:

```
ERROR:  permission denied for table ShopRoleAssignment
CONTEXT: SQL statement "SELECT a.role FROM public."ShopRoleAssignment" a ... FOR UPDATE"
```

Characterising the gap required four separate **REVIEWER-SUPPLIED REPAIRS** before the helper returned `t`:

| # | Missing item | Why |
|---|---|---|
| 1 | `GRANT SELECT ON "ShopRoleAssignment"` to the owner | Matrix omits the owner entirely |
| 2 | `GRANT UPDATE ON "ShopRoleAssignment"` to the owner | PostgreSQL requires `UPDATE` privilege for `SELECT … FOR UPDATE`; `SELECT` alone raises `permission denied` |
| 3 | An RLS policy `FOR UPDATE TO stocky_assignment_lock_owner` | Under `FORCE ROW LEVEL SECURITY` a `SELECT … FOR UPDATE` is also checked against UPDATE policies; the §7.10 SELECT-only policy is insufficient |
| 4 | `GRANT EXECUTE ON FUNCTION stocky_current_shop_id()` to the owner | Same root cause as F-XC-03, now on the assignment path |

This is precisely the concern raised in comment 5728802757 §2 — *"Assignment helper `SELECT ... FOR UPDATE` needs adequate privileges and a correctly installed RLS policy/context, not just an EXECUTE grant."* **Confirmed by execution.**

**Merchant impact.** `platform.replay.execute` fails closed for every authorized operator. Fail-closed is the safe direction, so this is P1 rather than P0 — but the serialization guarantee that `F-CLAUDE-PR7CP-06` was raised to obtain does not exist in the declared contract.

**Security note requiring an explicit decision.** Repair #2 means the `SECURITY DEFINER` owner of the lock helper necessarily holds `UPDATE` on the role-assignment table. That is a privilege-escalation surface: any future definer function owned by that role, or any dynamic SQL introduced into this one, could rewrite grants. The §7.10 body is static SQL with a locked `search_path`, which contains it today, but the packet must state the risk and forbid additional functions under that owner. An alternative worth costing is `FOR NO KEY UPDATE` or an advisory lock keyed on `(shopId, actorId)`, which would avoid granting `UPDATE` at all.

**Reproduction.** §7 probe G.

**Recommended correction.** Add `stocky_assignment_lock_owner` as an explicit column in the §7.7 privilege matrix with `SELECT, UPDATE` on `ShopRoleAssignment`; declare both the SELECT and UPDATE RLS policies `TO` that owner in §7.10; add the context-helper `EXECUTE` grant; and record the escalation trade-off with the chosen mitigation.

**Missing test.** `PR7-RBAC-019`/`PR7-RBAC-015` assert lock behaviour but not lock *executability*. Add a row that calls the helper under exactly the catalogued grants and asserts it returns a verdict rather than raising `permission denied`.

---

### F-CLAUDE-PR7XC-06 — P1 — No real writer-quiescence primitive; the emptiness-to-completion interval is asserted, not established

**File / line.** Plan §7.6.2 ("PROPOSED fence", steps 1–6); §7.6.3 steps 5–8; §7.11 ("Redis cleanup"); matrix `PR7-RED-020`. **FACT (V)**: `app/sync/uninstall.server.ts`.

**Evidence.** Comment 5714629032 §3 required the packet to "fence/drain old writers and bootstrap before using emptiness as evidence", and comment 5728802757 §3 required it to "identify the real shared transaction lock/drain/CAS mechanism honored by all affected writers and bootstrap, including already-running work" and to "prove the emptiness-to-completion interval cannot be invalidated", adding that "a state label alone is not proof of serialization".

§7.6.2's fence is six steps, and every one is either a state-label write (`fence=UNINSTALLED`/`ERASING`/`FINALIZING`) or an entry-point gate (intake, dispatcher, fair-claim, `assertShopProcessingEnabled`, a FUTURE `assertNoErasureFence` in bootstrap). Entry-point gates stop *new* work; they do not drain work already inside a transaction. The packet acknowledges the problem — §7.6.2 opens by conceding a stale transaction is not quiescence proof, and §7.11 correctly declines to "claim instantaneous cancel of an already-completed statement" — but then proceeds to completion on the strength of the labels.

The only lock V actually holds is in `cancelAllCancellable`:

```sql
SELECT id FROM "DurableJob"
WHERE "shopId" = $1 AND state IN ('PENDING','DISPATCH_LEASED','ENQUEUED','RUNNING','RETRY_WAIT')
FOR UPDATE
```

This locks **job control rows**. No merchant-fact writer takes or waits on that lock for its data statements, so it does not serialize the erasure against in-flight application work. `uninstall.server.ts`'s own header says so: *"Long-running transactions and external side effects remain outside this guarantee unless explicitly prevented."*

What this reviewer **can** confirm (executed, §4.1) is that the *runtime role* is genuinely fenced by RLS: while disabled, its SELECT/DELETE filter to zero and its `AuditEvent` INSERT errors. That is a real and valuable protection, and after Shop deletion `stocky_shop_processing_enabled` returns `false` via `COALESCE`, so the fence holds for a missing Shop too.

What remains **unestablished** in the documents:

1. **Control-plane writers.** `DurableJob`, `JobAttempt`, `WebhookDelivery` and `DeadLetter` are `classification: platform_control_plane` with `rlsRequired: false` (**FACT (V)**, `manifest.ts`). They carry no processing-enabled predicate. The packet does not say what prevents a CP-role writer from inserting tenant-linked control-plane rows between the step-7 residual probe and the step-8 completion. The FK to `Shop` blocks this *after* step 6, but steps 5 and 7 straddle that boundary and step 5 runs while the Shop row still exists.
2. **Bootstrap.** `assertNoErasureFence` is a FUTURE application-level check in `upsertCanonicalShop`. Nothing makes it transactional with respect to the residual probe, and `Shop.myshopifyDomain` is `UNIQUE` with `rlsRequired: false`, so the race is at the application layer only.
3. **`PR7-RED-020`** states the desired property ("residual fails if a row reappears → not COMPLETED") but names no mechanism that would make the residual observation and the completion commit mutually exclusive with a concurrent writer.

**Merchant impact.** A completion receipt may be issued for an erasure that a concurrent or stale writer has already partially undone. Under D-021 the receipt is the durable proof of erasure, so an incorrect one is a compliance misstatement, not merely a stale cache.

**Expected behaviour.** A named serialization primitive honoured by every writer that can touch the target tenant, such that the interval between the final residual observation and the completion commit cannot be invalidated.

**Recommended correction.** Specify one concrete mechanism and state its limits honestly. The most tractable given V's shape:

- Take a transaction-scoped **advisory lock** keyed on the target shop (`pg_advisory_xact_lock(hashtext(targetShopId))`) in the step-7 residual probe **and** the step-8 completion **and** in `upsertCanonicalShop`, `createDurableJob` and `ingestAuthenticatedWebhook` for that tenant. Name each call site in §7.9's shared-edit table.
- State explicitly that this serializes *future* writers only, and that transactions already open before the lock was introduced are covered by the RLS fence for the runtime role and by the `Shop` FK after step 6 — and that anything outside both (external side effects, long-running CP transactions) is a residual risk carried into `PR7-RED-020`.
- If ChatGPT prefers not to add an advisory lock, the alternative is a CAS on a generation `rowVersion` checked in the step-8 conditional update, with every tenant writer bumping it. That must then be declared for all writers, not just privacy.

**Missing test.** `PR7-RED-020` needs a genuinely concurrent adversarial case: a writer transaction opened before the fence, committing between the residual probe and the completion commit, asserting the completion is refused. A sequential fixture cannot demonstrate this.

---

### F-CLAUDE-PR7XC-07 — P2 — Replay retry reconciliation is unachievable with the named delta; V generates a fresh idempotency key per call

**File / line.** Plan §7.10 timeline, "Effect-before-revoke" row; §7.9 `app/sync/replay.server.ts` delta; matrix `PR7-RBAC-016`. **FACT (V)**: `app/sync/replay.server.ts`.

**Evidence.** §7.10 promises: *"Retry of the **same** command: helper or idempotency key finds existing JobReplay; **reconcile** (return existing ids) without creating a second job."* `PR7-RBAC-016` requires "reconcile existing ids; **no** second job; do not report as never-happened".

V's transaction computes:

```ts
const correlationId = randomUUID();
const replayIdempotency = `replay:${originalJob.id}:${correlationId}`;
```

The key embeds a **fresh UUID on every invocation**, so `@@unique([shopId, idempotencyKey])` can never match a retry. `replayDeadLetter`'s signature is `{deadLetterId, shopId, reason}` — there is no command id to reconcile on. A second call instead hits:

```ts
if (deadLetter.resolutionState !== "OPEN") {
  throw new SyncControlPlaneError("dead_letter_not_open", ...);
}
```

which is a **false failure** — precisely the "claim they never happened" outcome that comment 5714629032 §5 forbids.

§7.9's only declared change to this file is "hook: call `stocky_lock_platform_assignment` inside the existing txn **before** insert". That delta cannot deliver the reconciliation contract.

**Merchant impact.** An operator whose replay request times out at the HTTP layer retries and is told the operation failed, when it succeeded. Repeated attempts produce no further effect but also no truthful status, driving unnecessary escalation.

**Recommended correction.** Declare the missing mechanism in §7.9 and §7.10: add a caller-supplied stable `commandId` to `replayDeadLetter`'s input, derive `idempotencyKey` from it (`replay:${originalJobId}:${commandId}`), and on a conflict or a non-`OPEN` dead letter, look up the existing `JobReplay` by `commandId` and return its ids as a successful reconciliation rather than throwing. Note that this changes a PR6-era control-plane signature and so belongs in the §7.9 shared-edit table with its own regression coverage.

**Missing test.** `PR7-RBAC-016` needs its "same command id" made concrete — currently no column of the matrix names where that id comes from.

---

### F-CLAUDE-PR7XC-08 — P2 — Pruning the delivery journal destroys the evidence classifier rules 1 and 4 depend on

**File / line.** Plan §7.6.3 step 9 ("delete lookup keys, delivery bindings (after operational window)"); §7.4 "Journal retention"; §7.6.1 classifier rules 1 and 4; matrix `PR7-PRIV-003`.

**Evidence.** Classifier rule 1 continues an existing request when `shopifyWebhookId` is "already in `PrivacyDeliveryBinding`". Rule 4 returns the old outcome for a "positively correlated retry of a **completed** request (same `shopifyWebhookId` or proven same event+digest **and** recorded `generationId`)". Both key on rows that step 9 deletes.

After prune and `fence=ERASED`, a genuine Shopify redelivery of the same `shopifyWebhookId`:

- rule 1 — no binding row → no match;
- rule 2 — requires `erasedAt IS NULL` → no match;
- rule 4 — requires the `shopifyWebhookId` correlation that was just pruned → **cannot fire**;
- rule 5 — no Shop row → runs a remnants check, finds nothing, but rule 5 defines no terminal outcome;
- rule 3 — "insufficient delivery/lifecycle correlation" → **`ESCALATED`**.

So a correctly-handled duplicate produces a spurious escalation with a 30-day clock and operator alerts at +20d/+27d (§7.12).

The packet does not specify the "operational window" duration, and §7.4 offers only "tests may use a synthetic TTL (e.g. 30 days) labelled test-only". **OFFICIAL** confirms redeliveries occur on retry, and that multiple subscriptions to one topic produce distinct `X-Shopify-Webhook-Id` values sharing one `X-Shopify-Event-Id` — so redelivery and fan-out are both normal.

**Merchant impact.** Operational noise that is indistinguishable from a real attribution failure, on the single most safety-critical state in the module.

**Recommended correction.** Either (a) retain a minimal tombstone — `shopifyWebhookId`, `privacyRequestId`, `generationId`, `completedAt` — beyond the prune so rule 4 remains decidable, and state its retention basis under Q-008 since it is linkable; or (b) declare an explicit operational window that exceeds Shopify's redelivery horizon and have rule 3 distinguish "beyond the retention window" from "genuinely unknown", escalating only the latter. Option (a) is preferable but is a Q-008 input and must be labelled as such rather than decided here.

**Missing test.** `PR7-PRIV-003` covers duplicate delivery only while the binding exists. Add a post-prune redelivery row asserting the outcome is not a spurious `ESCALATED`.

---

### F-CLAUDE-PR7XC-09 — P3 — Cross-reference error in the prune step number

Plan §7.4 "Journal retention" says the bindings are pruned "in §7.6.3 **step 7**". In §7.6.3, step 7 is the post-deletion residual verification; prune is **step 9**. Pruning at step 7 would delete the evidence before completion. Correct §7.4 to reference step 9.

### F-CLAUDE-PR7XC-10 — P3 — Compliance payload keys are described as "synthetic"

Plan §3.1 introduces the payload table with "Payloads (**synthetic field names** from the compliance page)". **OFFICIAL** (checked 2026-09-18) shows these are the documented payload field names, published verbatim — `shop_id`, `shop_domain`, `orders_requested`, `customer.{id,email,phone}`, `data_request.id`, `orders_to_redact`. The *values* on the page are examples; the field names are the contract. Since §7.4's lookup-key design depends on those names being authoritative, the "synthetic" label understates the evidence. Replace with "documented field names; example values".

### F-CLAUDE-PR7XC-11 — P3 — Self-contradictory evidence label in matrix §10

Matrix §10 labels the `sync-control-plane.test.ts` run **"executed-this-planning-session (prior planning head; not re-run this correction)"**. A run that was not performed in this session is not "executed-this-planning-session". The qualifier is honest, but the label contradicts it and weakens the very evidence discipline P7-C06 was raised to enforce. Use a distinct class such as **executed-prior-planning-head-not-re-run**.

---

## 5. Decision-ready recommendations for ChatGPT

### 5.1 The one genuine design choice (F-XC-01)

The other findings have a single obviously-correct repair. This one does not, and should not be defaulted by the writer.

| Option | Shape | Trade-off |
|---|---|---|
| **A — topic-aware helper (recommended)** | Split into `stocky_privacy_read_allows` (SELECT, admits `LIVE`) and `stocky_privacy_erase_allows` (DELETE, topic-scoped fences). `customers/*` never requires the shop-disabling `ERASING` transition | Most faithful to the packet's existing structure; two helpers and two policy families instead of one; requires a per-topic fence table |
| **B — separate customer-scope role** | A third role holding SELECT-only for `data_request`, with DELETE reserved to `shop/redact` | Cleanest privilege separation; adds a role and a connection class to an already-wide role inventory |
| **C — application-scoped erasure with RLS as tenant guard only** | Keep one helper; state plainly that RLS provides tenant+request scoping only and that customer scoping is an application `WHERE` obligation | Smallest documentation delta; weakest guarantee, and contradicts the packet's current claim that RLS is the boundary. Needs strong negative tests |

This reviewer recommends **A**, with **B** as the stronger alternative if ChatGPT wants the read path provably incapable of deletion. **C** should be chosen only with an explicit acknowledgement that a single application bug then yields whole-shop erasure.

### 5.2 Straightforward corrections

F-XC-02 option (a); F-XC-03 add the helper grants; F-XC-04 delete step 7; F-XC-05 add the owner to the matrix with `SELECT, UPDATE` plus both policies, and record the escalation trade-off; F-XC-07 add a `commandId`; F-XC-08 option (a) subject to Q-008; F-XC-09/10/11 textual.

F-XC-06 needs a named primitive (advisory lock recommended) plus an honest statement of what it does not cover.

---

## 6. Remaining implementation-entry conditions

Plan §10's six conditions are correct and are **not** weakened by this review. They remain in force, plus:

1. **F-XC-01 resolved by an explicit ChatGPT decision** among §5.1's options, synchronized into plan and matrix.
2. **F-XC-02 through F-XC-08 corrected**, with the plan's role/policy/grant tables and the matrix's expectation rows updated together.
3. **P3 items dispositioned explicitly** (corrected or accepted with reasons).
4. A further independent re-review confirming **no unresolved P0/P1/P2** — per matrix §1 and P7-C06.
5. The plan §9 residuals unchanged in status: the installed-library `sub`/online-binding proof remains an implementation-entry test; Q-008 remains **OPEN** and a production blocker; the D scratch reclamation boundary remains pending D's merge.

Unchanged and mandatory regardless of this review: formal independently accepted **PR6 closure on merged `main`**, exact-head **full** CI on that base (docs-only CI is insufficient for implementation), named single writer with exclusive §7.9 ownership, and a **subsequent explicit ChatGPT runtime authorization sentence**. **No review outcome, including this one, authorizes merge or production.**

---

## 7. Evidence: executed, with commands and results

Environment: Linux 6.18.44, Node `v22.22.2`, PostgreSQL **16.13** (disposable cluster, port 5433, initialized and destroyed within this session). No repository file was modified outside the single added artifact. No store calls. No production or merchant data. No dependency, schema, grant, configuration or CI change.

| # | Check | Command / method | Result | Class |
|---|---|---|---|---|
| 1 | Subject identity | `git rev-parse` / PR API | `253ab202…`, OPEN/DRAFT/UNMERGED | **EXECUTED** |
| 2 | Ancestry | `git log --format='%H %P'` | linear to V; 4 ahead / 0 behind | **EXECUTED** |
| 3 | Three-path diff | `git diff --name-status a3ff480 253ab202` | 3 files, all `A` | **EXECUTED** |
| 4 | Review blob preserved | `git rev-parse <sha>:<path>` at `86c1c52` and subject | both `c1fa5c2…` | **EXECUTED** |
| 5 | Exact-head CI | Actions API, run `35295884356` | Classify success / Heavy skipped / Gate success, attempt 1, correct head | **EXECUTED** |
| 6 | Reviewer uniqueness | `list_sessions` | one session on this subject | **EXECUTED** |
| 7 | V RLS predicate | read `scripts/tenant-enforcement/sql.ts` | includes `stocky_shop_processing_enabled` on all four commands; `ENABLE` + `FORCE` RLS | **FACT (V)** |
| 8 | V Shop privileges | read `manifest.ts`, `sync-control-plane/roles.ts` | runtime `SELECT,INSERT,UPDATE`; CP column-level only; no `DELETE` either side | **FACT (V)** |
| 9 | V job FKs | read `prisma/schema.prisma` | `DurableJob`/`JobAttempt`/`DeadLetter` → `Shop` all `onDelete: Restrict` | **FACT (V)** |
| 10 | V replay transaction | read `app/sync/replay.server.ts` | single CP `$transaction`; idempotency key embeds a fresh `randomUUID()` | **FACT (V)** |
| 11 | V symbol inventory | grep across `app/`, `scripts/` | all §4.2/§7.9 files exist; all named exports resolve; the two described as local are local | **EXECUTED** |
| 12 | **Probe A** — declared privacy grants | psql as `stocky_privacy_erasure` | `ERROR: permission denied for function stocky_current_shop_id` | **EXECUTED** → F-XC-03 |
| 13 | **Probe B1** — shop/redact, fence `ERASING` | psql | 1 fact, 1 audit visible | **EXECUTED** |
| 14 | **Probe B2** — customers/redact, live shop | psql | helper `f`; 0 rows; `DELETE 0` | **EXECUTED** → F-XC-01 |
| 15 | **Probe B3** — data_request, live shop | psql | 0 rows readable | **EXECUTED** → F-XC-01 |
| 16 | **Probe C** — customer-scoped breadth | psql | `DELETE 2` — another customer's row removed | **EXECUTED** → F-XC-01 |
| 17 | **Probe D** — checked Shop delete | psql, finalizer per §7.6.4 | `violates foreign key constraint "DurableJob_shopId_fkey"` | **EXECUTED** → F-XC-02 |
| 18 | **Probe E** — finalizer step 7 | psql, declared owner grants | `permission denied for table ShopInstallGeneration`; Shop row survives | **EXECUTED** → F-XC-04 |
| 19 | **Probe F** — §7.7 row-vs-error matrix | psql | all five predictions reproduced (§4.1) | **EXECUTED** → confirms F-CLAUDE-PR7CP-02 design |
| 20 | **Probe G** — assignment lock helper | psql as `stocky_control_plane` | `permission denied for table ShopRoleAssignment`; four repairs needed before `t` | **EXECUTED** → F-XC-05 |
| 21 | **Probe H** — coordinator survival | psql | Shop deleted; request + generation survive; `shopRowId` null; helper still `t`; residual probe works with Shop gone | **EXECUTED** → confirms F-CLAUDE-PR7CP-04 sequencing |
| 22 | IEEE-754 | `node -e` | `Number("9007199254740993") === 9007199254740992`; round-trip `false`; `isSafeInteger false` | **EXECUTED** |
| 23 | `test:privacy` absence | read `package.json` | `<<MISSING>>` | **EXECUTED** |
| 24 | Shopify compliance facts | official docs, 2026-09-18 | three topics; 401 on bad HMAC; 200-class ack; 30-day completion with legal-retention exception; payload keys as listed; `shop/redact` = `shop_id` + `shop_domain` only, 48h after uninstall | **OFFICIAL** |
| 25 | Shopify redact timing | official docs + changelog, 2026-09-18 | page still says 10 days / six months; **2026-03-23** changelog: 10 days regardless, gift-card exception | **OFFICIAL** |
| 26 | Shopify delivery identity | official docs, 2026-09-18 | `X-Shopify-Webhook-Id` deduplicates deliveries; `X-Shopify-Event-Id` correlates same merchant action; multiple subscriptions → distinct webhook ids, shared event id | **OFFICIAL** |
| 27 | PostgreSQL 16 DELETE policy | psql | `ERROR: WITH CHECK cannot be applied to SELECT or DELETE` | **EXECUTED** |

### 7.1 Reviewer-supplied repairs, declared

Applied only to continue probing past a blocker, each reported as a finding and never folded into the design: EXECUTE on the two context helpers for `stocky_privacy_erasure` (F-XC-03); removal of the preserved privacy `DurableJob` to reach step 7 (F-XC-02); `UPDATE` on `ShopInstallGeneration` for the finalizer owner (F-XC-04); `SELECT` + `UPDATE` + an UPDATE policy + context-helper EXECUTE for the assignment lock owner (F-XC-05). One probe omission was the reviewer's own and not a plan defect: `GRANT SELECT ON "Shop" TO stocky_runtime` was initially missing from the transcription and was corrected to match `BOOTSTRAP_TABLES` before probe F was recorded.

---

## 8. Environment limitations and evidence not executed

| Item | Status | Reason |
|---|---|---|
| `node_modules` | **absent** in this environment | The plan's **FACT (library)** claims — `OnlineAccessUser.id: number`, `JwtPayload.sub: string`, the Prisma adapter's `associated_user.id as unknown as bigint` — could be **neither confirmed nor refuted** here. They remain as the plan labels them. Declared pins read from `package.json`: `@shopify/shopify-app-react-router ^1.1.0`, `@shopify/shopify-app-session-storage-prisma ^9.0.0` |
| `sessionToken.sub` / online binding under `useOnlineTokens: true` | **NOT EXECUTED** | Requires the installed library and an authenticated session. Remains an implementation-entry proof (plan §9 residual 1), correctly labelled UNVERIFIED |
| `test:sync-uninstall`, `test:tenant-access`, `test:db-isolation` | **NOT EXECUTED** | Require `node_modules` and app-configured Postgres/Redis. **Present on V, not run here.** Not failures |
| Redis / BullMQ behaviour (`removeShopQueueJobsExceptPrivacy`, queue presence) | **NOT EXECUTED** | `redis-server` is present but the functions are future code; nothing to exercise |
| PR7 runtime suite | **does not exist** | No such suite was demanded; per comment 5728802757 this is a planning review |
| PR43 / candidate **H** `4768033b…` | **not inspected, not modified** | Dated provisional dependency; this review did not wait for or chase D |
| Legal/regulatory sufficiency | **out of scope** | Q-008 remains open for counsel. Nothing here is legal advice or a compliance certification |

My probes are **synthetic transcriptions**, not the PR7 implementation. They establish what the *declared* contracts do when executed literally under PostgreSQL 16. They do not establish that any PR7 code exists, works, or has been tested — none does.

---

## 9. Artifact identity and unchanged-subject confirmation

| Field | Value |
|---|---|
| Review branch | `claude/pr45-pr7-executable-contract-review-20260918` |
| Rooted at | `253ab202dbee53dc842bb1389db4a19c6e3fb058` (the exact subject) |
| Added path | `stocky-plus/docs/phases/phase-1/PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md` |
| Files changed | exactly one, added |
| Planning documents | **not modified** |
| Immutable prior review | **not modified**; blob `c1fa5c2fed74bf80d1006267b43d767258895c17` preserved |
| Subject before and after evidence collection | `253ab202dbee53dc842bb1389db4a19c6e3fb058` — unchanged |
| `origin/main` before and after | `a3ff480f1477237f8055f10c43298480a05728a1` — unchanged |
| Actions runs triggered | none |
| PR43 / PR46 / main / subject writes | none |

**Outcome: CORRECTIONS REQUIRED.** Two P0, four P1, two P2, three P3. This is a reviewer recommendation, not ChatGPT acceptance. No runtime, merge, production, scope or flag authorization follows.
