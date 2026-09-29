# Phase 1 PR7 — Topic-authority and finalization independent re-review

**Outcome: CORRECTIONS REQUIRED**

One unresolved **P1**, two unresolved **P2**, one **P3**. Approval requires no unresolved P0/P1/P2, so approval is withheld — narrowly.

This is a planning review. It does **not** accept the plan, authorize PR7 runtime, close PR6, edit PR43/PR46, mark ready, or merge. R-176 remains **OPEN / P0**. R-164 unchanged. Q-008 remains **OPEN**. D-054 authority; **no D-055**. Phase 1 / PR6 **IN PROGRESS**.

Authority: [PR45 comment 5736596751](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5736596751). Controlling correction order: [comment 5729229659](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5729229659) and its `PR45_PR7_Topic_Authority_and_Finalization_Corrections.md` (Decisions 1–7). Earlier comments apply only where not superseded.

---

## 0. Headline

**Both P0 findings are resolved, and all four prior P1 findings are resolved.** The per-topic operation×row authority model (Decision A) and the Shop-independent coordinator (Decision B) are materially correct, and I independently reproduced the declared **59/59** proof model from hash-verified scripts with no repairs of my own.

The three remaining findings are new and narrower. They share one root cause: **the correction hardened `shop/redact` thoroughly, and customer topics inherited the hardening only where it happens to transfer.** `shop/redact` gets an exclusive barrier, a root-delete backstop and an epoch-fenced consumer path. `customers/redact` deliberately runs on a LIVE generation — correctly — but the completion-integrity machinery that makes erasure provable was not re-derived for that case.

---

## 1. Verified identity and scope

| Field | Value | Verification |
|---|---|---|
| Subject | `9d9919057992e9c7ba1f7bfcee73d671f2fadbab` (OPEN/DRAFT/UNMERGED) | PR API + `git rev-parse` |
| Base **V** | `a3ff480f1477237f8055f10c43298480a05728a1` | `git merge-base` = V |
| Ahead / behind | **6 / 0** | `git rev-list --left-right --count` |
| Ancestry | `9d99190 → 64649470 → 253ab202 → 86c1c52 → f1b0364 → 4158254 → a3ff480` | linear; subject's parent is the second immutable review |
| Changed paths V→subject | exactly **4**, all `A` | `git diff --name-status` |
| Review branch | `claude/pr45-pr7-topic-finalization-rereview-20260918` | rooted exactly at subject |

Four-path diff:

```
779   0  PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md
2896  0  PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md
571   0  PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md      (immutable #1)
576   0  PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md  (immutable #2)
```

The subject commit touches only the plan (`+2327/-175`) and matrix (`+226/-41`).

**Both immutable reviews preserved byte-for-byte:**

| Artifact | Declared | Observed at subject |
|---|---|---|
| Review #1 | `c1fa5c2fed74bf80d1006267b43d767258895c17` | `c1fa5c2fed74bf80d1006267b43d767258895c17` ✅ |
| Review #2 | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` ✅ |

No runtime, schema, grant, dependency, CI or peer-branch file is touched by the subject. Subject and `main` re-checked after evidence collection and before publication: unchanged.

### 1.1 Exact-head CI

Run [`35344782793`](https://github.com/Vedang1998/Stocky/actions/runs/35344782793), event `pull_request`, `run_attempt=1`, `head_sha=9d9919057992e9c7ba1f7bfcee73d671f2fadbab`:

| Job | ID | Conclusion |
|---|---|---|
| Classify change set (incl. classification self-test) | `105598704284` | **success** |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `105598746909` | **skipped** |
| CI Gate | `105598745438` | **success** |

Exactly as declared. Per `CI_POLICY.md` §3–4 this is documentation-integrity evidence for a provably docs-only diff — **not** verification of the 59-case model, and not runtime evidence. No CI rerun was triggered by this review.

---

## 2. Proof fidelity

### 2.1 Script hashes — all three verify exactly

I extracted the fenced appendix bodies from the subject's plan and hashed them. The natural extraction (content lines, excluding the cosmetic blank line before the closing fence, with a trailing newline) reproduces every declared digest:

| File | Declared SHA-256 | Extracted | Match |
|---|---|---|---|
| `01_contract.sql` (720 lines) | `b29ef463…858db054` | `b29ef463c26a9a3ad745fc7a56bc40901ced1c55429a59c441d89634858db054` | ✅ |
| `02_seed.sql` (73 lines) | `d0d84842…4084f632` | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` | ✅ |
| `03_run_proofs.py` (1155 lines) | `69005537…08667ebb4` | `6900553779c3d2e8237fc189fcad42a1810262d3110ab60f30ab32208667ebb4` | ✅ |

The scripts in the document are byte-identical to the scripts that were hashed. **The appendices are the artifact, not a paraphrase of it.**

### 2.2 Independent reproduction — 59/59

I built a disposable PostgreSQL **16.13** cluster at the declared path (`initdb -D /tmp/pr45-pg16`, port 5433, socket `/tmp/pr45-pg16`), created `pr45owner` and `pr45_proof`, loaded the two hash-verified SQL files, and ran the hash-verified driver **unmodified**:

```
{ "total": 59, "pass": 59, "fail": 0 }   EXIT=0
```

| Group | Cases | Result |
|---|---|---|
| G1-topics | 15 | 15 PASS |
| G2-grants | 8 | 8 PASS |
| G3-shop-delete | 10 | 10 PASS |
| G4-authz | 14 | 14 PASS |
| G5-barrier | 9 | 9 PASS |
| G6-tombstone | 3 | 3 PASS |

**No hidden GRANT, dropped FK, added policy, or driver repair was required or applied by me.** The contract loads and the driver passes as published. The declared 59/59 is honest.

### 2.3 Disclosure of failed attempts — verified adequate

Plan §12 discloses the failure history rather than only the green run: first run 29 pass / 15 fail (driver parser treated `COMMIT`/`set_config` as data; reader `SELECT PrivacyTargetKey` without grant), second run 57/59, then clean 59/59. Critically, it states that the one repair that was *not* driver-only — **enumerator publisher-only grants + FORCE RLS on `PrivacyTargetKey`** — was folded **into the contract**. I confirmed both are present in the hash-verified `01_contract.sql` (policy `target_key_definer_all`, and `42501` on an erasure-role INSERT). This satisfies the work order's "every repair needed by a probe must first enter the contract".

### 2.4 Two fidelity limits (reported, not charged as defects)

- **`results.json` is a run log, not a verifiable artifact.** Its `detail` fields embed elapsed timings (`exclusive_waits_on_shared: … elapsed=2.04`), so its declared hash `ecc9acd1…` is not reproducible by re-running. Mine was `185dd1b8…`. The three *script* hashes are the meaningful fidelity control and they verify.
- **The `postgres` field in `results.json` is a hardcoded literal.** The driver writes `"postgres": "16.15"` rather than querying `version()`. My 16.13 run also emitted `16.15`. It matches the packet's declared environment, so it is not a misstatement — but it cannot serve as evidence of the server version. See **F-TF-04**.

---

## 3. Adjudication of F-CLAUDE-PR7XC-01…11

Original meanings and severities preserved. Adjudicated against the contract, the matrix, my reproduction and my own counterexamples — not against the packet's `CORRECTED` labels.

| ID | Sev | Independent disposition | Basis |
|---|---|---|---|
| **XC-01** | P0 | **SUBSTANTIALLY CORRECTED** — residual P1 (**F-TF-01**) | Decision A is real. `stocky_privacy_capability_allows(op, shop)` gates topic×operation×fence; `stocky_privacy_row_in_manifest` gates rows; `stocky_privacy_reader` holds **no** DELETE grant. The prior P0 is genuinely gone: `customers/redact` now works on a `LIVE` generation without switching it to shop-erasure state, and a broad `DELETE` with no `WHERE` removes only manifest rows. My own escalation attempts (§4.2) were all denied. Residual is a *completion-integrity* gap, not an authority gap |
| **XC-02** | P0 | **CORRECTED** | Decision B is correct and verified. `PrivacyRequest`/`PrivacyAttempt` carry no Shop or DurableJob FK; both survive root deletion (G3 `coordinator_request_survives`, `coordinator_attempt_survives`). The RESTRICT ordinary-job family still blocks root delete until cleaned child-first (`restrict_job_family_blocks_root_delete`), and `already_absent` retry plus `finalizer_stale_attempt` close the recovery cases. `DurableJob.shopId` is left non-nullable with accepted FKs intact, as Decision B requires |
| **XC-03** | P1 | **CORRECTED** | §7.7.4 catalogues the dependencies, and G2 supplies real negative controls: revoking EXECUTE on the capability helper or on `stocky_current_tenant_id` breaks the probe (`revoke_capability_execute_fails_probe`, `revoke_tenant_id_execute_fails_probe`), proving the grants are load-bearing rather than decorative. `runtime_not_member_of_erasure` and `privacy_erasure_no_processing_helper` close the membership/bypass angles |
| **XC-04** | P1 | **CORRECTED** | The finalizer no longer UPDATEs the generation; it relies on the declared `ON DELETE SET NULL`. G3 `finalizer_no_generation_update_grant` confirms the owner holds `SELECT` only, and `generation_set_null_keeps_target` confirms the FK does the work. This is the tighter of the two options I offered |
| **XC-05** | P1 | **CORRECTED** | Decision C replaces `SELECT … FOR UPDATE` with `stocky_authz_lock` (transaction-scoped advisory) plus a **SELECT-only** verifier, so no `UPDATE` privilege on `ShopRoleAssignment` is needed anywhere — removing the escalation surface I flagged. G4 proves the ordering: `revoke_before_effect_denies`, `fresh_read_after_wait_sees_revoke`, `effect_before_revoke_remains`, `cross_tenant_denied` |
| **XC-06** | P1 | **CORRECTED as a mechanism; honest LIMIT** — residual P2 (**F-TF-03**) | A real primitive now exists: versioned shared/exclusive advisory gate keyed by canonical domain (valid when `Shop` is absent) plus the durable `fence`. G5 shows the exclusive admission genuinely waits on a shared holder (lock timeout at 2.04s) and that post-freeze writers and same-domain bootstrap are rejected. §7.6.2 correctly cites PostgreSQL 16 that advisory locks are **cooperative** and states plainly that uninstrumented writers are a rollout drain prerequisite, not a claimed lock. Residual is inventory completeness |
| **XC-07** | P2 | **CORRECTED** | `PlatformReplayCommand` supplies the stable app-issued command id the prior contract lacked, with random correlation ids demoted to tracing. G4 proves the three required behaviours: same command reconciles after revocation without new work, another actor gets no row, and a changed digest conflicts rather than falsely succeeding |
| **XC-08** | P2 | **CORRECTED** | `PrivacyDeliveryTombstone` is separated from payload prune with a finite `expiresAt`. G6 proves post-prune duplicates reconcile, expired evidence becomes uncorrelated rather than falsely remembered, and a new generation does not inherit an older completion. §7.11 explicitly declines permanent retention, declines an invented legal period, keeps **Q-008 OPEN**, and states the tombstone is linkable/pseudonymous — not anonymous. The privacy-versus-replay trade-off is stated in both directions |
| **XC-09** | P3 | **CORRECTED** | Named phase anchors replace step numbers; prune is **P-PRUNE-PAYLOAD**, explicitly after **P-COMPLETE** |
| **XC-10** | P3 | **CORRECTED** | §3.1 now labels the Shopify payload keys as documented field names with synthetic fixture *values* |
| **XC-11** | P3 | **CORRECTED** | §12 and matrix §10 use the distinct class `executed-prior-planning-head-not-re-run` |

### 3.1 Carried-forward dispositions

The eight substantively addressed `F-CLAUDE-PR7CP` findings and the P7-C01/C03/C04/C06 dispositions from review #2 remain valid and are not reopened. **P7-C02** and **P7-C05**, previously PARTIAL / NOT SATISFIED because the capability was unexecutable, are now **SATISFIED as executable contracts** — this packet's G1/G2 demonstrate the privacy path running end-to-end under the named restricted principals. Per plan §1.3 I did not reopen first-login ownership, in-place audit minimization, timestamp supersession, or two-connection atomicity.

---

## 4. New findings

### F-CLAUDE-PR7TF-01 — P1 — Customer-topic erasure has no completion-integrity mechanism; post-enumeration arrivals survive and are invisible to the residual probe

**Anchors.** Plan §7.6.2 ("Topic scope"), §7.6.3 phase table (**P-FREEZE**, **P-ENUMERATE**, **P-COMPLETE**), §7.7.2 enumerator; contract `stocky_privacy_enumerate_targets`; matrix `PR7-TOP-001…014`, `PR7-CUST-005`.

**The structural gap.** Three plan decisions are individually correct and jointly leave a hole:

1. **P-FREEZE is `shop/redact` only** — correct, and required by Decision 1 ("Customer redaction must work on a LIVE generation, cannot switch it to shop-erasure state").
2. **The manifest is published once at P-ENUMERATE.** There is no re-enumeration phase. I grepped the plan: no `re-enumerat*` / `converge*` appears anywhere.
3. **The customer audit predicate is open-ended**, not a closed list: `AuditEvent WHERE customerRestId = r."lookupCustomerRestId"`. It means "all audit rows for this customer" — a set that keeps growing on a LIVE shop.

Because the consumer SELECT policy also carries `stocky_privacy_row_in_manifest`, the erasure role's residual probe sees **only** manifest rows. A row that arrives after enumeration is both undeleted and unobservable.

**Executed (my counterexample CE-1, on a clean unmodified model).** Enumerate `preq_cr` (customers/redact, customer `191167`, shop_a LIVE) → manifest = `{ShopifyOrderFact:of_a1, ShopifyOrderLineFact:ol_a1, AuditEvent:ae_a1}`. Then, as ordinary runtime on a live shop, insert `ae_a3` (shopId `shop_a`, customerRestId `191167`). Then run the erasure:

```
DELETE FROM "ShopifyOrderLineFact"; DELETE FROM "ShopifyOrderFact"; DELETE FROM "AuditEvent";

-- survivors for the redacted customer:
AUDIT  ae_a3  customer=191167

-- residual as seen by stocky_privacy_erasure under the request GUCs:
residual visible to erasure role: 0
```

The redacted customer's audit row survives, and the worker responsible for proving residual emptiness observes **zero**.

(For completeness: surviving `of_a2` and `of_a3` is *correct* — neither is in the request's `lookupOrderLegacyIds`, and Shopify's `customers/redact` names specific `orders_to_redact`. The order path is closed-list and sound. The defect is specific to the open-ended audit predicate.)

**Why the plan's own justification does not cover it.** §7.6.3 states: *"Nothing can repopulate the target between residual and completion because: exclusive freeze is still in force; participating writers re-check and reject; uninstrumented writers are a rollout drain prerequisite."* The first clause is `shop/redact`-only by §7.6.2's Topic scope; the second follows from it (writers reject only when the fence is `ERASING`/`FINALIZING`, which customer topics never set). So for customer topics the stated rationale is inapplicable, and **P-COMPLETE**'s "residual predicate true" is satisfied by a manifest-filtered zero — exactly the inference §7.7.2 itself forbids ("Zero RLS-visible consumer rows **never** prove successful absence"). The principle is stated; the customer-topic completion path contradicts it.

`shop/redact` has a second backstop that customer topics lack: the RESTRICT job family blocks **P-ROOT-DELETE** while any child remains (G3), so a missed remnant surfaces as a blocked erasure. Customer topics perform no root delete, so nothing catches the miss.

**Merchant impact.** A legally mandated customer erasure reports COMPLETED while operational audit rows keyed to that customer remain, on exactly the topic that runs against a live, actively-writing store. Under D-021 the receipt is the durable proof of erasure, so an incorrect one is a compliance misstatement.

**Matrix gap.** `PR7-TOP-001…014` are all static-state cases — I re-read every row. None injects a concurrent write during customer-topic erasure, and none exercises a customer-topic residual/completion predicate. `PR7-CUST-005` still reads `COMPLETED skipped_absent` after a "complete scan", where the scan is manifest-filtered.

**Recommended correction (planning).** Specify a customer-topic completion rule that does not rest on a manifest-filtered read. Options, in my order of preference:

1. **Converge-then-complete.** Re-run the enumerator under the active epoch immediately before **P-COMPLETE**; require the freshly published manifest to be empty of undeleted rows, and loop with a bounded attempt count. This closes the window without freezing the shop and reuses the existing definer.
2. **Unfiltered residual probe.** Give the residual check a definer-owned counter that evaluates the open-ended predicates (`customerRestId = lookup…`) directly, outside `row_in_manifest`, and require it to return zero at **P-COMPLETE**.
3. **Request-scoped short barrier.** Take the exclusive gate only for the final converge-and-complete interval. Effective but it briefly freezes a live shop for a customer request, which Decision 1 discourages.

Whichever is chosen, state explicitly that the customer-topic residual predicate is **not** the manifest.

**Missing tests.** A `PR7-TOP-*` row inserting a matching audit row between enumerate and delete, asserting the request does **not** reach COMPLETED; and a row asserting the customer-topic residual predicate is evaluated outside the manifest.

---

### F-CLAUDE-PR7TF-02 — P2 — The manifest publisher is the only privacy mechanism that is not epoch-fenced; a superseded worker can mutate a live request's state

**Anchors.** Contract `stocky_privacy_enumerate_targets`; plan §7.6.2 ("Epoch"), §7.7.2; matrix `PR7-COORD-*`, `PR7-TOP-012/014`.

**Evidence.** The enumerator validates only two things: that `p_request_id` equals the GUC (`enumerator_request_guc_mismatch`), and that the request exists. It reads **no** `PrivacyAttempt`, checks **no** lease, and compares **no** `activeAttemptId`. Every consumer policy does (`capability_allows` requires `r."activeAttemptId" = a.id`, `a.state IN ('LEASED','RUNNING')`, live `leaseUntil`), and G5 proves that fencing works (`lost_epoch_capability_false`, `new_epoch_capability_true`).

Executed (CE-6). I reproduced the exact lease-loss transition §7.6.2 describes — mark epoch 1 `LOST`, insert epoch 2, rebind `activeAttemptId` — then had epoch 2 enumerate and complete the erasure:

```
enumerationComplete=true  missingLinkages=0        <- live epoch finished cleanly
```

Then the **superseded** epoch-1 worker (state `LOST`, lease expired) called the enumerator on the same request. Its consumer capability correctly returned `false`, so it could not delete anything — but the enumerator ran:

```
AFTER stale re-enumerate: enumerationComplete=false  missingLinkages=1
manifest rows now: 0
```

A worker that no longer owns the request reverted a completed enumeration and emptied the manifest.

**Merchant impact.** The demonstrated direction is fail-safe — "incomplete stays incomplete" blocks **P-COMPLETE**, so a finished customer erasure gets stuck rather than falsely completing, and an operator sees an unexplained incomplete request with the 30-day clock running. The opposite ordering (stale re-enumeration landing *before* the live epoch's deletes) silently changes the scope the live epoch is working from. Either way a superseded process writes request-scoped shared state, which the packet's own epoch rule ("Capability and residual evidence are bound to the **active** epoch") is designed to prevent. P2 rather than P1 because deletes stay properly fenced and the failure mode demonstrated is conservative.

**Recommended correction.** Give the enumerator the same epoch check the consumers have: read `stocky.privacy_attempt_id`, require it to equal `PrivacyRequest.activeAttemptId` with a live lease and `state IN ('LEASED','RUNNING')`, and raise `42501` otherwise. This is a few lines in an existing definer and needs no new privilege.

**Missing test.** A `PR7-COORD-*` row asserting a superseded epoch cannot publish, delete or recompute a manifest.

---

### F-CLAUDE-PR7TF-03 — P2 — The participating-writer inventory omits control-plane writers that are not gated by `processingEnabled`

**Anchors.** Plan §7.6.2 ("Uninstrumented writers"), §7.9 shared-edit table; G5 `uninstrumented_cp_writer_still_inserts_limit`.

**What the packet gets right.** §7.6.2 is candid: control-plane tables have no RLS on V, a raw CP `INSERT` without the gate still succeeds, advisory locks are cooperative (with the official PostgreSQL 16 citation), legacy processes must be **stopped/drained** before privacy execution is enabled, and "Do not claim accepted B/C internals automatically honor this gate". I reproduced the limit (CE-5): as `stocky_control_plane`, an `INSERT` into `WebhookDelivery` for the frozen `shop_red` generation succeeded. I also confirmed those tables are not even readable by the privacy role (`has_table_privilege(stocky_privacy_erasure, "WebhookDelivery", SELECT) = false`), so the erasure worker's probe can never see CP remnants.

**The gap.** The mandate asked whether the future integration inventory and the drain prerequisite actually address that path. §7.9 names the guard for `after-auth.server.ts`, `bootstrap.server.ts`, `shopify.server.ts` and `uninstall.server.ts`, and marks the `db-context.server.ts` / `tenant-db.server.ts` fact-writer guard **"optional"**. §7.6.2 adds generic families ("CP write helpers for DurableJob/intake/bootstrap").

Several V control-plane writers are covered incidentally by `processingEnabled` — intake (`createDurableJob` throws `shop_processing_disabled`), replay (`replay_denied_disabled_shop`), fair-claim (`WHERE r."processingEnabled" = true`) — and P-FREEZE does set the Shop disabled with reason `REDACTED`, so those are gated in practice. But **`app/sync/lifecycle.server.ts` is neither guarded nor `processingEnabled`-gated.** Verified on V: the file contains no `processingEnabled` or `assertShopProcessingEnabled` reference, and `completeAttemptRetry` writes `JobAttempt`, `DurableJob`, `JobDispatch` and `WebhookDelivery` rows for the target shop while finishing an already-running attempt — precisely the "already-running work" case Decision 4 asks to quiesce. It appears nowhere in §7.9. The dispatcher's shop-disabled path is likewise unnamed.

**Impact.** For `shop/redact` this is fail-safe: the RESTRICT family means a late CP row blocks **P-ROOT-DELETE** (G3), converting a silent race into a stuck erasure with no diagnostic pointing at the cause. For customer topics there is no root delete, so no backstop — this compounds **F-TF-01**. The mechanism is sound; the inventory is what is incomplete, so this is a specification defect rather than a design defect.

**Recommended correction.** Replace the generic families with an exact file/symbol inventory of every V writer that can persist tenant-linked rows, explicitly including `lifecycle.server.ts` `completeAttemptRetry` and the `dispatcher.server.ts` disabled-shop path; state for each whether it is covered by the shared gate, by `processingEnabled`, or by the stop/drain prerequisite; and promote the `db-context`/`tenant-db` guard from "optional" to required or justify the option. The inventory must be refreshed against formally closed PR6, which §7.11 already requires.

**Missing test.** A `PR7-GATE-*` row asserting the integration inventory is complete — e.g. an architecture test that fails when a CP write helper persists a tenant-linked row without the guard.

---

### F-CLAUDE-PR7TF-04 — P3 — `results.json` is presented as a hash-verifiable artifact but is a timing-dependent run log

§14 lists `results.json` with SHA-256 `ecc9acd1…` beside the three script hashes. Unlike the scripts, it cannot be reproduced: its `detail` fields embed elapsed timings, so my run produced `185dd1b8…` from byte-identical inputs. Its `"postgres"` field is a hardcoded literal (`16.15`) rather than a queried `version()` — my 16.13 run emitted `16.15` too. Label it a run log, drop its hash from the verification table or mark it non-reproducible, and have the driver query `version()` if the field is meant to be evidence.

---

## 5. Proof-group coverage against the mandate

| Group | Mandate requirement | Finding |
|---|---|---|
| **1** Topic/operation/row authority | LIVE and disabled generations; two customers/two shops and children; read-only cannot delete; publisher cannot widen; invisible ≠ absent | **Met for static state.** Reader holds no DELETE grant; enumerator derives scope from persisted authenticated lookup keys, not caller input; `42501` on caller INSERT into `PrivacyTargetKey`. My CE-2/CE-3 escalations all denied (§4.2 below). **Gap: no concurrent-write case** → **F-TF-01** |
| **2** Helper/role/policy dependencies, removal of load-bearing privileges | No PUBLIC/membership bypass | **Met.** G2 revocation controls are genuine negative controls, and I reproduced them |
| **3** Non-Shop-FK coordinator survives root deletion; restrictive job family; missing-Shop retry; stale attempt deny | | **Met.** All ten G3 cases reproduced |
| **4** Advisory serialization, fresh read after waiting, grant/revoke/bootstrap participation, stable command reconciliation, changed actor/target/digest rejection | | **Met.** All fourteen G4 cases reproduced |
| **5** Shared/exclusive gate, running and new writers, coordinator loss, finalization interval, unrelated-shop progress; **verify the uninstrumented CP path is actually addressed** | | **Mechanism met; inventory incomplete** → **F-TF-03**. The packet does not claim the gate fences uninstrumented writers — it declares the limit and makes drain a prerequisite, which is the honest framing |
| **6** Payload prune vs finite tombstones, post-expiry uncertainty, genuine new-installation erasure, Q-008 open | | **Met.** Q-008 explicitly OPEN; no legal period invented; no infinite-horizon dedup promised |

### 5.1 My independent counterexamples

Beyond replaying the supplied script, on clean unmodified models:

| ID | Attack | Result |
|---|---|---|
| **CE-1** | Concurrent matching write during a LIVE `customers/redact` | **Survivor, invisible to residual probe** → F-TF-01 |
| **CE-2** | Erasure role extends its own lease / rewrites its request topic / widens `lookupOrderLegacyIds` | All three `permission denied` ✅ |
| **CE-3** | Cross-request GUC pairing (attempt from another request); `shop/redact` GUCs aimed at a different shop | `false` in both cases ✅ |
| **CE-4** | Expired lease | Capability `false`; delete filtered to zero ✅ |
| **CE-5** | Control-plane INSERT into a frozen generation | Succeeds — the declared LIMIT, reproduced → F-TF-03 |
| **CE-6** | Superseded epoch re-runs the enumerator | **Reverts a completed enumeration** → F-TF-02 |

CE-2 and CE-3 are the escalation paths that would have broken Decision A. The design held.

---

## 6. Evidence classification

**Independently executed by me (this session):** git ancestry/four-path/blob verification; PR and Actions APIs; SHA-256 extraction and verification of all three appendix scripts; disposable PostgreSQL 16.13 cluster built at the declared path; unmodified load of `01_contract.sql` + `02_seed.sql`; unmodified run of `03_run_proofs.py` → 59/59; six independent counterexamples; V source re-reads (`lifecycle.server.ts` gating, control-plane table RLS classification).

**Reused, not re-executed:** the packet's IEEE-754 and `test:privacy` observations, correctly labelled `executed-prior-planning-head-not-re-run`; the Shopify and PostgreSQL external facts I verified against official sources during review #2 (unchanged in this correction).

**Explicitly unexecuted — external boundaries the SQL model cannot test.** The packet states this and I confirm it: **Redis job drain, export publication, D scratch reclamation, live Shopify, the installed `node_modules` `authenticate.admin` / `sessionToken.sub` binding, and PR7 processors are not exercised by this model.** `node_modules` is absent in my environment, so the library-binding claims remain neither confirmed nor refuted. A PostgreSQL transcription is not a Redis or filesystem fence, and I make no such claim. These are **adequately specified future implementation-proof obligations**, not absent planning mechanisms — §7.6.2's LIMIT paragraph and §7.11 state the required evidence (generation-fenced publication or positive per-target drain) and correctly refuse TTL/PID/cancel-label substitutes.

**Rollout limitation carried forward.** The stop/drain prerequisite in §7.6.2 is a deployment-ordering obligation that no database proof can discharge. It must appear in the implementation PR's rollout plan, not only in the architecture text.

**Not done:** no CI rerun, no store calls, no production or merchant data, no changes to the subject, `main`, PR43, PR46, either existing review, runtime, schema, grants, dependencies or CI. PR43 and its pinned H `4768033b…` were neither inspected nor waited for.

---

## 7. Remaining implementation-entry conditions

Plan §10's conditions stand unweakened, plus:

1. **F-TF-01 resolved** by an explicit customer-topic completion rule (§4 options), synchronized into plan and matrix.
2. **F-TF-02 resolved** by epoch-fencing the enumerator.
3. **F-TF-03 resolved** by an exact CP-writer inventory naming `completeAttemptRetry` and the dispatcher disabled-shop path, with the stop/drain prerequisite carried into the rollout plan.
4. **F-TF-04** dispositioned.
5. A further independent re-review confirming **no unresolved P0/P1/P2** — matrix §1 and P7-C06.

Unchanged and mandatory: formal independently accepted **PR6 closure on merged `main`** (with the integration inventory refreshed against it), exact-head **full** CI on that base, named single writer with exclusive §7.9 ownership, and a **subsequent explicit ChatGPT runtime authorization**. Q-008 remains **OPEN** and a production blocker. **No review outcome, including this one, authorizes merge or production.**

---

## 8. Artifact identity and unchanged-subject confirmation

| Field | Value |
|---|---|
| Review branch | `claude/pr45-pr7-topic-finalization-rereview-20260918` |
| Rooted at | `9d9919057992e9c7ba1f7bfcee73d671f2fadbab` |
| Added path | `stocky-plus/docs/phases/phase-1/PR7_TOPIC_AUTHORITY_FINALIZATION_INDEPENDENT_REVIEW.md` |
| Files changed | exactly one, added |
| Planning documents | **not modified** |
| Immutable review #1 | preserved — `c1fa5c2fed74bf80d1006267b43d767258895c17` |
| Immutable review #2 | preserved — `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` |
| Subject before / after | `9d9919057992e9c7ba1f7bfcee73d671f2fadbab` — unchanged |
| `origin/main` before / after | `a3ff480f1477237f8055f10c43298480a05728a1` — unchanged |
| Actions runs triggered | none |
| Disposable cluster | destroyed after evidence collection |

**Outcome: CORRECTIONS REQUIRED** — 1 P1, 2 P2, 1 P3; both prior P0s and all four prior P1s resolved. A reviewer recommendation, not ChatGPT acceptance. No runtime, merge, production, scope or flag authorization follows.
