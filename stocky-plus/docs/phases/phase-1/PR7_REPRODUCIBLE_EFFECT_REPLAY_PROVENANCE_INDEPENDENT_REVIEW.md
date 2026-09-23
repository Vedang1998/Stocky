# Phase 1 PR7 — Reproducible-effect and replay-provenance independent review

**Outcome: CORRECTIONS REQUIRED**

Two unresolved **P2**, one **P3**. **AO-01, AO-02, AO-04 and AO-05 are independently closed.** AO-03 is closed for the renamed-capture and sighting-class cases the previous review raised, but two residuals survive: an already-issued capture is never reconciled against a later non-fresh sighting, and on the effect lane the provenance key absorbs a caller-chosen identifier.

Planning review only. This does **not** accept the plan, authorize PR7 runtime, edit peer branches, mark ready, or merge. PR6 **CLOSED**. Phase 1 **IN PROGRESS**. R-176 **OPEN / P0**. R-164 unchanged. Q-008 **OPEN**. D-054; **no D-055**.

Authority: [PR45 comment 5754390537](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5754390537). Correction authority: [`5753473534`](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5753473534). Prior review: `0cbb936d92bc079104d86a44bfc7bc1ed5bb76e2` (subject F `f70ceb5d…`, blob `0c318246…`).

---

## 0. Headline

This is the strongest packet in the chain. The delivery failure I raised as AO-01 is fully repaired, and I can say so from execution rather than inspection: I exported S into a directory with no prior proof tree, bootstrapped the published extractor by its declared markers, and got `02b066c3838b246bd53deb7f6467e31fc7d8b63d7349d1317c21b04ecfdc6177` — the declared hash, exactly. All twelve manifest entries extracted and every digest matched §14. Five extraction negatives of my own design — including an injected `GRANT ALL … TO stocky_runtime` block — all failed closed. The full declared model then ran to **416 records / 416 PASS / 0 FAIL = 244 unique + 172 reruns**, with G1–G6 = 59, G16 = 50 unique and NEG = 12. Every declared figure reconciles.

AO-02 is genuinely fixed. `p_actual_digest` is gone; `stocky_apply_bound_customer_effect` freezes `(domain, shop, kind, value, effectId)` into locals, computes `pr7-effect-v1` over that snapshot, compares it to the protected origin, and writes those same locals. I attacked it with a newer valid `work_id` plus old effect input, each effect-bearing field altered in turn, a second uncommitted effect id inside the guarded transaction, and a digest passed where the effect id belongs. Every one was rejected before any row, and the only `AuditEvent` row that landed was the committed one. The SQL and Python implementations agree with the plan's published sample. AO-04 and AO-05 are likewise closed on every probe I ran, including four concurrent duplicate captures collapsing to one row.

AO-03 is most of the way there. The mandatory reproduction — webhook root → unattributed child → guard-denied child → renamed ADMIN capture — is now **denied**, and it stays denied through multi-level lineage, `MANUAL_REPLAY`, and every identifier I changed (source identity, command id, work id). It is also layered: reverting the sighting classes alone does not revive the attack, because a second clause catches any origin row for that digest with no capture of its own. I had to remove both barriers to bring the counterexample back, and I have labelled that mutation composite.

What does not hold is the ordering the mandate specifically told me not to accept on the strength of a refused second capture. **In capture-first order the already-issued capture is never revoked.** I issued a capture for a clean digest, then had the control plane sight the same digest as queued work — accepted, no revocation — then consumed that capture: admission succeeded, the row recorded `BOUND` to the live generation, the guard admitted, and the effect reached a write. The ADMIN branch of `stocky_record_writer_admission` never re-reads `QueuedWorkSighting` at all. The packet's evidence shows only that a *subsequent* capture is refused, which is exactly the insufficiency the mandate named.

The second residual is the one the correction authority itself predicted: *"Adding a new effect/command id to the payload hash must not accidentally turn the replay attack into 'different content'."* On the G16 lane the source-to-effect transform is declared **identity**, so `sourceContentDigest` *is* `pr7-effect-v1(domain, shop, kind, value, effectId)`. Every AO-03 defense keys on that digest. A new `effectId` therefore produces a digest no sighting covers. I took a child whose effect was denied after a completed `customers/redact`, minted a new effect id for the same customer value, and the write landed.

---

## 1. Identity, scope and preservation

| Field | Value | Verified |
|---|---|---|
| Subject **S** | `fd5f7bbdf18fa12d75371686d8969d67fe68a158` | ✅ |
| S parent chain | `df478397…` → `64391ed…` → `bd86745…` → `0cbb936d…` (my prior review) → `f70ceb5d…` (**F**) | ✅ |
| Main / base **X** | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` | ✅ merge base |
| Sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` | read-only, untouched |
| Review branch | `claude/pr45-reproducible-effect-replay-provenance-review`, rooted exactly at S | ✅ |

**Sixteen-path X→S scope confirmed:** six modified controls (`ACCELERATED_SAFE_DELIVERY.md`, `DECISIONS.md`, `PROJECT_STATUS.md`, `README.md`, `PR6_CLOSURE_REPORT.md`, `phases/phase-1/README.md`) and ten added PR7 documents (two proposals, eight reviews).

**Three-path F→S correction delta confirmed:** `PR7_ADMIN_ORIGIN_EFFECT_BINDING_INDEPENDENT_REVIEW.md` (+359/−0 — my review, integrated unchanged), `…ACCEPTANCE_MATRIX.md` (+41/−7), `…EXECUTION_PLAN.md` (+12501/−321). It arrives as four commits; the path set is three, as declared.

**Controls byte-identical F→S** — the diff restricted to the six control paths is empty. **No non-`stocky-plus/docs/` path appears anywhere in X→S**: no application, schema, migration, grant, dependency, configuration or CI change.

**All eight immutable review blobs intact at S:**

| Artifact | Blob |
|---|---|
| `PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md` | `c1fa5c2fed74bf80d1006267b43d767258895c17` ✅ |
| `PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md` | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` ✅ |
| `PR7_TOPIC_AUTHORITY_FINALIZATION_INDEPENDENT_REVIEW.md` | `e609e9526ed1ec043551ca68d6b977f5b5935d0c` ✅ |
| `PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md` | `e908770d9daea4f963b2fd09e38af79e07274d41` ✅ |
| `PR7_GENERATION_W_INTEGRATION_INDEPENDENT_REVIEW.md` | `1d93b85aa8f61a6255fe2408148f1e5ea97c0b70` ✅ |
| `PR7_TEMPORAL_ATTRIBUTION_WRITER_COVERAGE_INDEPENDENT_REVIEW.md` | `b7e8ff338e715c79907aa633c75622958f60b4d4` ✅ |
| `PR7_DURABLE_ORIGIN_CORRECTION_INDEPENDENT_REVIEW.md` | `21b11b4af0adfce8e7044a40131190f001e9756e` ✅ |
| `PR7_ADMIN_ORIGIN_EFFECT_BINDING_INDEPENDENT_REVIEW.md` | `0c3182469f26b97beb4c23f86fcc2906d11adb5c` ✅ (my own, unaltered) |

### 1.1 Exact-head CI

Run [`35550295852`](https://github.com/Vedang1998/Stocky/actions/runs/35550295852), event `pull_request`, attempt **1**, head SHA `fd5f7bbd…`, conclusion **success**.

| Job | ID | Conclusion |
|---|---|---|
| Classify change set | `106183655325` | SUCCESS ✅ |
| Lint, typecheck, test, build, Prisma, GraphQL | `106183678706` | SKIPPED ✅ |
| CI Gate | `106183678181` | SUCCESS ✅ |

Documentation CI, correctly gated as docs-only. It is not proof execution and I do not treat it as such. **I triggered no Actions run.**

---

## 2. AO-01 — artifact fidelity: CORRECTED

### 2.1 Clean export and bootstrap

I exported `fd5f7bbd…` with `git archive` into a directory holding no previous proof tree, and ran the §14 bootstrap block **verbatim** — whole-line marker `.index()` on `<!-- PROOF-EXTRACT:begin path=current/00_extract_proofs.py -->`. Result:

```
02b066c3838b246bd53deb7f6467e31fc7d8b63d7349d1317c21b04ecfdc6177   (declared: identical)
```

No manual splicing, no missing-role repair, no reconstruction. This is the property AO-01 existed to demand.

### 2.2 All twelve manifest entries

| Extracted path | SHA-256 | Matches §14 |
|---|---|---|
| `current/01_contract.sql` | `b55bb88e758e1a7f7c124222af616c84053fbda89e8083839d5648c333e91814` | ✅ |
| `current/03_run_proofs.py` | `3edd193bfa18bec375bf020b8ccbabf24c28bee1f8a14bc66930e2a5be4c1f86` | ✅ |
| `current/02_seed.sql` | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` | ✅ seventh packet, byte-identical |
| `current/04_discover_writers.py` | `666feaa8f77359d75f70ffca5bb84bc91fc9d0e0891656f17d195ef92990220d` | ✅ unchanged |
| `current/04_source_derived.sql` | `9f7aaa26ecdbdf953b284b0813fb81f2693962c64870d7c2e61ea084c0bf6baa` | ✅ fifth confirmation |
| `current/00_extract_proofs.py` | `02b066c3838b246bd53deb7f6467e31fc7d8b63d7349d1317c21b04ecfdc6177` | ✅ |
| `current/regenerate_lower_bound.py` | `c79b03ad6c75e11fbfece767b33ac61b87820ee81140a5c3ac31553e39b0f23a` | ✅ |
| `current/reproduce_do01_overlap.py` | `b7c6e6da06e70bbe6216833b7f0a7918794ddd60b1e6ea8dee613faec3f8ae65` | ✅ new identity |
| `historical/q/01_contract.sql` | `d9bd880f7eb8e584b5e2139ce0d5fbc052a3b6ef61c1e9e59716fb3b285ec9c9` | ✅ |
| `historical/q/03_run_proofs.py` | `59bf35f541320301c7011ae94566ea28575def299f1d8d5cadb6c8cab18c6a5b` | ✅ |
| `historical/option_a/01_lower_bound_only.sql` | `75a168288ede88b267a3d08d225b5f4017bead2e40908c2fcac70c22a2ace284` | ✅ |
| `historical/gw/source_derived_candidates.json` | `0ce7a39853eae7cb4808c822b3af66157cd2f59e8f236ec0fdf76205f1546ecd` | ✅ environment artifact, correctly labelled |

The manifest declares exactly twelve entries and `current/proof_manifest.json` is the sole permitted unlisted block. F's `bc0d674a…` / `336b2795…` / `9872848c…` are carried as **Cursor-reported, unpublished-at-F, not current**, and my reconstruction `cb7958a5…` is carried as **reviewer-built, not Cursor current**. Both classifications are correct and I confirm them.

### 2.3 S versus the gated parent

The packet's mandatory clean-export gate was executed against `df478397…`, not S. The mandate allows S to be assessed on demonstrated input equivalence, so I extracted from both commits with the same published extractor and diffed the trees: `current/` and `historical/` are **byte-identical**. The gate transfers to S.

### 2.4 Extraction negatives — the packet's and my own

`--selftest` returns `extraction_selftest_ok`. I did not rely on it. Five negatives of my own construction, each against a mutated copy of the exported plan:

| My negative | Result |
|---|---|
| Delete the whole `current/01_contract.sql` block | `extraction_missing_block:current/01_contract.sql` ✅ |
| Silently weaken one contract line (`RAISE EXCEPTION` → `RAISE NOTICE` on `effect_digest_mismatch`) | `extraction_digest_mismatch:current/01_contract.sql` ✅ |
| Truncate the driver block | `extraction_end_path_mismatch` ✅ |
| Inject an unlisted block containing `GRANT ALL ON ALL TABLES IN SCHEMA public TO stocky_runtime` | `extraction_unlisted_block:current/99_backdoor.sql` ✅ |
| CRLF injection | `extraction_crlf_forbidden` ✅ |
| Control: unmodified plan | extracts, rc 0 ✅ |

The unlisted-block refusal is the important one: a hidden grant cannot ride along in this document.

### 2.5 Independent execution and taxonomy

Clean PostgreSQL 16 cluster of my own; the declared setup sequence, including `createuser --superuser pr45owner`; driver run from `$PROOF_ROOT` with no prior tree.

```
{"total": 416, "pass": 416, "fail": 0, "unique_assertions": 244, "declared_reruns": 172,
 "postgres": "16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)", "host": "/tmp/pr45r8-sock:5443"}
```

Independently re-parsed from `results.json` rather than trusting the driver's own summary:

| Group | records | unique |
|---|---|---|
| G1–G6 | 59 | **59** ✅ |
| G7 / G8 / G9 | 28 / 14 / 18 | 14 / 7 / 9 |
| G10 | 1 | 1 |
| G11 / G12 / G13 / G14 / G15 | 24 / 20 / 30 / 52 / 58 | 12 / 10 / 15 / 26 / 29 |
| **G16** | 100 | **50** ✅ |
| **NEG** | 12 | **12** ✅ |
| **Total** | **416** | **244** ✅ (reruns **172** ✅) |

**416 / 244 / 172 reconciles exactly**, as do G1–G6 = 59, G16 = 50 and NEG = 12. My `results.json` digest is `c58f1d5472eac7752d15547221029382179aa8b45966d45880382cbc4d06f45d`, differing from the declared `d140af76…` as a run log with timings and host should. PostgreSQL 16.13 here versus 16.15 declared — disclosed; no result below depends on the minor version.

**Setup-principal audit.** `pr45owner` is now created `--superuser`, a widening versus earlier packets' plain owner plus seed `BYPASSRLS`. I checked whether it leaks: every `stocky_*` role is non-superuser and non-`BYPASSRLS`; **zero** `SECURITY DEFINER` `stocky_*` functions are owned by a superuser; **zero** lack a locked `search_path`. The permission assertions still mean what they claim. Disclosed, not a finding.

### 2.6 F-CLAUDE-PR7AO-06 — P3 — the manifest is in-band and nothing cross-checks §14

`proof_manifest.json` states plainly that it does not hash itself, and the extractor permits it as the sole unlisted block. That is honest, and it is sufficient against accidental desync and silent repair — which is what AO-01 was about. It is not sufficient against a coordinated edit: I changed one contract line **and** its declared digest together, and extraction succeeded, yielding a contract whose `effect_digest_mismatch` had become a `RAISE NOTICE`. §14's prose table carries a second copy of the same digests, but nothing machine-compares the two.

**Merchant impact:** low and indirect — a reviewer reading the diff sees both edits. But the packet's own framing is that a hash row is not the source, and the same argument applies to a manifest that is only as trustworthy as the document containing it.
**Expected behaviour:** have `--selftest` parse §14's table and assert row-for-row equality with `proof_manifest.json`, so the two in-band copies must agree.
**Missing test:** `extraction_manifest_disagrees_with_section_14_table`.

---

## 3. AO-02 — actual effect commitment: CORRECTED

`stocky_apply_bound_customer_effect(p_canonical_domain, p_shop_id, p_kind, p_value, p_effect_id, p_work_id DEFAULT NULL)` — **no `p_actual_digest`**. It freezes the five semantic inputs into locals, computes `v_digest := stocky_effect_commitment(v_domain, v_shop, v_kind, v_value, v_effect)`, compares that to `wa."sourceContentDigest"`, and inserts **those same locals**. There is no path by which a validated object and a written object can diverge, because there is only one set of values.

Executed against two legitimate acked ADMIN admissions for the **same shop and target**:

| Case | Outcome |
|---|---|
| Positive control (`work_new` + `ae_new`) | writes ✅ |
| **Newer valid `work_id` + OLD effect input** | `effect_digest_mismatch` ✅ before any row |
| Altered `value` (`999999`) | `effect_digest_mismatch` ✅ |
| Altered `kind` (`ORDER_LEGACY_ID`) | `effect_digest_mismatch` ✅ |
| Altered `effectId` (`ae_other`) | `effect_digest_mismatch` ✅ |
| Altered tenant (`shop_b` / `pr7-b`) | `effect_tenant_mismatch` ✅ |
| Digest passed where `effect_id` belongs (7-arg form) | function does not exist ✅ |
| Second, uncommitted effect id in the same guarded transaction | `effect_digest_mismatch` ✅ |
| Final `AuditEvent` contents | only `ae_new/191167`; `ae_old`, `ae_other`, `ae_new2` absent ✅ |

Canonicalisation checks: the SQL helper reproduces the plan's published sample `959bb90441a81889549f265bd75ef5b84a512486b896023cf4f42f50b2566abd` exactly; the Python `effect_commitment` agrees with it; the helper is `STRICT` so a NULL field yields NULL rather than a hashable empty string; an empty `value` is rejected with `effect_input_required` **before** hashing; and moving an LF across a field boundary changes the digest, so the separator is not ambiguous.

**Declared limit, preserved:** `stocky_runtime` can still `INSERT INTO "AuditEvent"` directly, bypassing the host entirely. That is the honest SQL-guard-only boundary the packet retains and the mandate instructs me to keep separate; it is covered by the source-derived writer inventory requirement (G9/G14), not by the host. I do not count it as an AO-02 failure.

---

## 4. AO-03 — replay provenance: corrected in the main case, two residuals

### 4.1 What is now closed

`QueuedWorkSighting` is keyed `(canonicalDomain, sourceContentDigest)` — `sourceIdentity` removed from the key — and all three non-fresh classes sight under `stocky_source_content_lock`. The capture helper denies a sighted digest, an origin row for that digest with `originalCaptureId IS NULL`, or any other admin capture of that digest.

| Executed | Result |
|---|---|
| **Mandatory reproduction:** webhook root → unattributed `PARENT_LINEAGE` child → child guard-denied → renamed ADMIN capture of the same digest | `queued_work_cannot_acquire_fresh_admin_origin` ✅ |
| Capture of a webhook root digest | denied ✅ |
| Capture of a level-1 child digest | denied ✅ |
| Capture of a level-2 child digest | denied ✅ |
| Capture of a `MANUAL_REPLAY` digest | denied ✅ |
| All four non-fresh classes present in `QueuedWorkSighting` | ✅ |
| Rename `sourceIdentity` / `commandId` / `workId` | all denied ✅ |
| Legitimate fresh successor; unrelated tenant | both progress ✅ |

It is also defence-in-depth. Reverting the sighting classes to webhook-only did **not** revive the attack, nor did re-adding `sourceIdentity` to the sighting lookup — the `originalCaptureId IS NULL` clause held in both cases. Only a **composite** removal of both barriers brought the counterexample back, and I have labelled it as such.

### 4.2 F-CLAUDE-PR7RE-01 — P2 — an already-issued capture is never reconciled against a later sighting

The mandate is explicit: *"In the capture-first case, continue all the way through consuming that already-issued capture, admission, guard and effect; rejecting only a subsequent second capture is insufficient evidence."* I did, and the capture survives.

| Step | Result |
|---|---|
| 1. ADMIN capture issued for a clean digest | accepted |
| 2. Control plane sights the **same digest** as `QUEUED_INBOX` | **accepted — capture not revoked** |
| 3. Sighting row and capture row coexist | `1/1` |
| 4. `stocky_record_writer_admission` consumes the capture | **accepted** |
| 5. Recorded provenance | **`BOUND` to the live generation** |
| 6. `stocky_fact_write_guard` | **admits** |
| 7. A *second* capture of the now-sighted digest | denied — the packet's evidence |

Mechanically: the `ADMIN_SESSION_CURRENT_INSTALL` branch of `stocky_record_writer_admission` reads `OriginalAdminCapture` and validates time, epoch, install lower bound, target and consumption — it **never reads `QueuedWorkSighting`**. Step 7 is real but changes nothing about steps 4–6.

**Merchant impact:** content later shown to be queued or replayed work retains fresh admin provenance and reaches a write. The ordering is not exotic — an admin command and the webhook or queue carrying the same content routinely arrive in either order, and `stocky_source_content_lock` serialises them without reconciling this direction.
**Expected behaviour:** re-check `QueuedWorkSighting` for the digest inside the ADMIN admission branch, under the lock already taken, and refuse to consume a capture whose content has since been sighted as non-fresh; or mark the capture revoked when `stocky_note_queued_work` / a non-fresh admission sights a digest that already has an unconsumed capture.
**Missing test:** `capture_first_then_sighted_digest_cannot_be_consumed` — and the existing capture-first assertion should be extended past the second-capture refusal through admission, guard and effect.

### 4.3 F-CLAUDE-PR7RE-02 — P2 — the effect lane's provenance key absorbs a caller-chosen identifier

The correction authority named this risk directly: *"Adding a new effect/command id to the payload hash must not accidentally turn the replay attack into 'different content'."*

§1.9 and §12.6 declare the source-to-effect transform for modeled admin-bound writes to be **identity**: on the G16 lane `sourceContentDigest` *is* `pr7-effect-v1(domain, shop, kind, value, effectId)`. Every AO-03 defense — the sighting key, the capture conflict clauses, `admission_digest_conflict` — keys on that value. `effectId` is caller-chosen, so changing it produces a digest no sighting covers.

Executed on the overlap fixture (successor installed, prior `customers/redact` completed):

| Step | Result |
|---|---|
| Child admitted `PARENT_LINEAGE` with `pr7-effect-v1(…, 'ae_child')` | sighted |
| Child through the effect host | **denied** — `customer_target_attribution_ambiguous` ✅ |
| Capture with `pr7-effect-v1(…, 'ae_relabelled')` — same customer value, new effect id | **accepted** — no sighting matches |
| Admission | **accepted**, `BOUND` |
| Effect host writes `ae_relabelled` | **accepted** |
| Final `AuditEvent` | `ae_relabelled/191167` — the redacted value is back |

I also confirmed the lane is not ADMIN-only: a `WEBHOOK_PROVIDER_AUTH` admission whose digest is an effect commitment passes the host too. So the exposure is a property of the digest convention, not of the evidence class.

To be fair to the packet on two points. First, a genuinely fresh authenticated admin command that writes customer data after a completion is **deliberately permitted** (`genuine_admin_after_completion_progresses`), and this path is indistinguishable from that — which is the defect, not an exoneration: once content identity absorbs a caller-chosen id, the model can no longer evidence freshness on that lane. Second, the identity transform is **disclosed**, not hidden. But disclosure does not discharge the authority's instruction to *"name separate source and effect commitments plus the deterministic transformation/version tying them together"*; naming the transformation "identity" merges the two commitments the instruction exists to keep apart.

**Merchant impact:** a completed `customers/redact` can be undone for the same customer value by re-issuing the effect under a new effect id, and the provenance record will attest that it came from a freshly captured admin command.
**Expected behaviour:** define `pr7-source-v1` over the tenant, operation, target and source bytes **excluding** any generated or caller-chosen effect identifier; store that as `sourceContentDigest` and key every AO-03 defense on it; keep `pr7-effect-v1` as a separate effect commitment and state the source→effect transformation explicitly rather than collapsing it to identity.
**Missing test:** `same_source_new_effect_id_cannot_acquire_fresh_admin_capture`, on the G16 lane rather than the synthetic-digest lane.

### 4.4 AO-03 disposition

**PARTIALLY CORRECTED.** The named counterexample and the whole rename/class family are closed and layered. The capture-first ordering and the effect-lane key remain open.

---

## 5. AO-04 and AO-05 — CORRECTED

**AO-04.** The GUC is now documented and implemented as an untrusted locator, and the host revalidates regardless of how the identifier arrives.

| Executed | Result |
|---|---|
| Self-set GUC + correct work + correct input | writes ✅ (locator, not authority) |
| Self-set GUC + correct work + **wrong** input | `effect_digest_mismatch` ✅ |
| Self-set GUC naming another tenant's work | `effect_tenant_mismatch` ✅ |
| Nonexistent work id | `effect_tenant_mismatch` ✅ |
| Empty GUC | `effect_execution_context_required` ✅ |
| Unacked (`PENDING_LINK`) work via GUC | `customer_admission_not_acked` ✅ |
| Explicit `p_work_id` over a poisoned GUC | still input-checked ✅ |

The withdrawn claim is correctly withdrawn, and no nonce service was invented to defend the old wording.

**AO-05.** Capture id is `oac_ || sha256(domain ‖ 0x00 ‖ commandId)` with `(canonicalDomain, commandId)` uniqueness.

| Executed | Result |
|---|---|
| Two tenants, same `commandId` `order-sync-42` | both succeed, distinct surrogates ✅ |
| Same tenant, same command, same input | reconciles to the same capture id ✅ |
| Same tenant, same command, changed input | `admission_command_input_conflict` ✅ |
| `order-sync-42` vs `order_sync_42` | distinct ids, no collision ✅ |
| Four concurrent identical captures | **one** row ✅ |

---

## 6. Findings

| ID | Sev | Summary |
|---|---|---|
| **F-CLAUDE-PR7RE-01** | **P2** | An already-issued ADMIN capture is never reconciled against a later non-fresh sighting; consumed through admission, `BOUND`, guard and effect (§4.2) |
| **F-CLAUDE-PR7RE-02** | **P2** | On the effect lane `sourceContentDigest` is the effect commitment, so a new caller-chosen `effectId` is "different content" to every AO-03 defense (§4.3) |
| **F-CLAUDE-PR7AO-06** | **P3** | The in-band manifest is not self-hashed and nothing cross-checks §14's table; a coordinated edit extracts cleanly (§2.6) |

### AO crosswalk

| Original | Packet claim | My adjudication |
|---|---|---|
| **AO-01** | CORRECTED | **CLOSED** — extractor, twelve entries, my own negatives, 416/244/172 all independently reproduced from a clean export of S |
| **AO-02** | CORRECTED | **CLOSED** — no caller digest; commitment computed from and written as one frozen snapshot; every attack rejected before any row |
| **AO-03** | CORRECTED | **PARTIALLY CORRECTED** — mandatory reproduction and the rename/class family closed and layered; RE-01 and RE-02 open |
| **AO-04** | CORRECTED | **CLOSED** |
| **AO-05** | CORRECTED | **CLOSED** |
| **DO-01** | class closed via AO-03 | **not yet** — closed for the named 18:19 counterexample and the rename route; RE-01 and RE-02 keep the class open |
| **DO-02** | demonstrated via AO-02 | **DEMONSTRATED** in the disposable model, with the SQL-guard-only limit honestly retained |

---

## 7. Negative controls

Each mutation was applied to a disposable copy of the extracted contract, exercised, then the declared file restored; the restored file hashes back to `b55bb88e…`.

| Control | Removal | Counterexample | Kind |
|---|---|---|---|
| Effect commitment comparison | only the `effect_digest_mismatch` block | old effect under newer work **writes** | single |
| Commitment computation | host no longer computes `v_digest` | old effect under newer work **writes** | single |
| Sighting classes | back to webhook-only (the F behaviour) | **did not revive** — the `originalCaptureId IS NULL` clause held | single |
| Sighting lookup scope | `sourceIdentity` re-added to the capture check | **did not revive** — same clause held | single |
| Capture id derivation | back to the global `oac_ || commandId` | cross-tenant `duplicate key` **returns** | single |
| Both AO-03 barriers | sighting classes **and** the origin clause | renamed capture **succeeds** | **composite (2)** |

Restored contract re-verified: old effect rejected again, renamed capture denied again, two tenants with the same command id succeed again.

---

## 8. Evidence classification

**Independently executed this review:** S/X/F ancestry and the four-commit chain; sixteen-path scope; three-path F→S delta; eight review blobs; control byte-identity; docs-only confirmation; the three CI job identities; clean export of S; verbatim bootstrap of the published extractor to its declared hash; extraction of all twelve manifest entries with digest comparison against §14; the extractor's `--selftest` plus five negatives of my own including an injected backdoor `GRANT`; S-versus-`df478397` input equivalence; the complete declared model at **416/416 PASS** with independent taxonomy re-parse; the setup-principal audit (superuser leakage, definer ownership, locked search paths); the full AO-02 attack matrix including canonicalisation, framing, STRICT-null and empty-field cases; the AO-03 mandatory reproduction, all non-fresh classes, multi-level lineage, three identifier-rename variants, the capture-first sequence end-to-end, and the effect-lane replay; the AO-04 locator matrix; the AO-05 tenant/command matrix including four concurrent duplicates; five single-defense negative controls, one labelled composite, and full restoration.

**Reused with exact identity:** GW-02 scanner and portable source SQL evidence — `04_discover_writers.py` `666feaa8…` and `04_source_derived.sql` `9f7aaa26…` both byte-identical for a fifth packet, so the mechanism and source identities are unchanged and the earlier injection/removal campaign carries over. Q historical identities `d9bd880f…` / `59bf35f5…` re-verified. F's 375/223/152 preserved as **Cursor-reported, unpublished-at-F, not independently reproduced**; my reconstruction `cb7958a5…` preserved as reviewer-built.

**Not reproduced, not claimed passed:** the installed-library `authenticate.admin` matrix remains not independently reproduced — nothing here executes Shopify authentication, and the plan is right that PostgreSQL does not verify Shopify tokens. Redis job drain, export publication, D scratch reclamation, live Shopify, application `test:privacy`, and the proposed `original-admin-capture.server.ts` / `bound-effect.server.ts` runtime remain implementation obligations this SQL model does not test. PR48 MATCH/NEW/MISSING provenance preserved. No PR6 corpus, no million-line envelope, no PR48 repackaging, no store or merchant access, no legal-retention certification. **I did not inherit any result from the parallel Cursor evidence lane.**

**Isolation and teardown:** the container held no cluster, socket, listening port or data directory at session start — verified before allocating. I created PGDATA `/var/lib/postgresql/pr45r8` (0700, postgres-owned), socket directory `/tmp/pr45r8-sock` (0755), port **5443**, and confirmed postmaster pid **561** was mine. I deliberately avoided the packet's declared `/tmp/pr45-ao-gate-pg16:5442`. Only my own cluster, database and scratch files will be removed. All results are recorded under this review's identity.

---

## 9. Remaining decisions and entry gates

1. **F-CLAUDE-PR7RE-01** — reconcile an already-issued capture against later non-fresh sightings inside the ADMIN admission branch, under the existing lock.
2. **F-CLAUDE-PR7RE-02** — separate `pr7-source-v1` provenance from `pr7-effect-v1` commitment; key the AO-03 defenses on the source identity, which no caller-chosen effect id may vary.
3. **F-CLAUDE-PR7AO-06** — have `--selftest` assert that §14's table and `proof_manifest.json` agree.
4. Restate §1.9's AO-03 row and the DO-01 class claim to match the evidence: corrected for rename and class, open for capture-first ordering and the effect lane.
5. Carried forward unchanged: the `authenticate.admin` acceptance-test gate; Redis / export / D-scratch fences; PR7 processors; **Q-008 remains a production blocker**; R-176 **OPEN / P0**.

Then a further independent re-review with no unresolved P0/P1/P2. **No verdict in this document authorizes plan merge or PR7 runtime.**

---

## 10. Artifact identity and unchanged-subject confirmation

Subject S, main X, the six control documents, the two proposals, the eight prior reviews and sealed PR48 are **unchanged by this review**. I made no edit to any subject, control, proposal, peer branch, previous review, application file, schema, grant, dependency or CI definition; triggered no Actions run; made no store, merchant or production call; enabled no flag or scope; and neither marked ready nor merged anything. Every mutation was applied to a disposable copy outside the repository and restored.

This document is the only file added, on branch `claude/pr45-reproducible-effect-replay-provenance-review`, whose review commit has sole parent `fd5f7bbdf18fa12d75371686d8969d67fe68a158`.

**Verdict: CORRECTIONS REQUIRED.**
