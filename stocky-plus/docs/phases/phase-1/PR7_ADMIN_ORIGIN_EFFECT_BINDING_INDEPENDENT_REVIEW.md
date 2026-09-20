# Phase 1 PR7 — Admin-origin and effect-binding correction independent review

**Outcome: CORRECTIONS REQUIRED**

Three unresolved **P2**, two **P3**. **F-CLAUDE-PR7DO-01 is partially corrected** — the exact counterexample is closed and the caller's timestamp can no longer mint `BOUND` — but the laundering class it stood for survives by a second route. **F-CLAUDE-PR7DO-02's specification is now written, but the supplied boundary model does not demonstrate it**: the modeled effect host still admits the substitution it exists to stop.

Planning review only. This does **not** accept the plan, authorize PR7 runtime, edit peer branches, mark ready, or merge. PR6 **CLOSED**. Phase 1 **IN PROGRESS**. R-176 **OPEN / P0**. R-164 unchanged. Q-008 **OPEN**. D-054; **no D-055**.

Authority: [PR45 comment 5753166291](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5753166291). DO correction authority: [`5752617452`](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5752617452). Prior review: `bfebe412818e42b4c92f87ca1c927f0dda12cad5` (subject Q `5040d5cd…`, blob `21b11b4a…`).

---

## 0. Headline

The capture mechanism itself is good work. `ADMIN_SESSION_CURRENT_INSTALL` is no longer a label a caller can attach to an arbitrary historical timestamp: it now requires a matching `OriginalAdminCapture` row minted by a separate `stocky_admin_capture` principal, and `originalAdmittedAt` is **derived** from the server's `capturedAt`. I attacked the new capture API from five roles across fourteen paths — both helpers, direct DML on all three new tables, and `SET ROLE` — and every one was denied. Session forgery, cross-tenant capture, label-only ADMIN, stale capture across reinstall, pre-install capture, time-only retry restamping, recovery upgrade of `UNATTRIBUTED`, and target substitution at admission are all rejected. G1–G6 = **59/59 PASS** under the new contract.

Three things do not hold up.

**First, the executable artifact is no longer in the repository.** §14 names `01_contract.sql` `bc0d674a…` and `03_run_proofs.py` `336b2795…` as the runnable contract and driver, but Appendix A and Appendix C are explicitly relabelled *"Q historical transcription; **not** the runnable DO contract/driver"*, and Appendix F transcribes *"the additive fragments only"*. Neither hashed file exists in the document, and neither does `reproduce_q_do.py` `9872848c…` or the lower-bound variant `75a16828…`. Every prior packet (V, W, P, Q) published its complete runnable contract and driver and I verified each digest byte-for-byte. This one cannot be extracted, hashed, or executed, so the declared **375 / 223 / 152** is the first headline figure in this chain I cannot independently reproduce.

**Second, the proposed effect host does not bind the digest to the effect it writes.** `stocky_apply_bound_customer_effect` takes `p_kind`, `p_value`, `p_actual_digest` and `p_effect_id` as four independent caller arguments, compares the caller's digest string against the protected row, and then writes the caller's payload. The digest is never recomputed from the input being written, and the scoped callback receives no frozen input. The packet's own test passes an *old* digest with a *new* `work_id` and is correctly rejected — but the attacker passes the *new* digest, and the write lands.

**Third, replayed work can still acquire fresh ADMIN origin.** `QueuedWorkSighting` is auto-inserted only for `WEBHOOK_PROVIDER_AUTH`, and its key includes `sourceIdentity`. Child and manual-replay admissions are never sighted, and `admission_digest_conflict` does not fire for them because it requires an existing row with `parentWorkId IS NULL`. I took bytes that the overlap guard had just denied, re-captured them as a fresh admin command under a new source identity, and the guard admitted them against the completed customer target.

On the mandate's second priority I can be unambiguous: I re-executed the exact 17:49 install / 18:19 admission / 18:49 completion fixture on unchanged Q and on a lower-bound-only variant. **Both recorded `BOUND` and both were ADMITTED.** The lower-bound-only patch — my own Review 6 recommendation (a) — is **not** the fix, and the packet is right to say so.

---

## 1. Identity, scope and preservation

| Field | Value | Verified |
|---|---|---|
| Subject **F** | `f70ceb5d08276352f8d907046d8fdf92ae6d0522` | ✅ |
| F sole parent | `bfebe412818e42b4c92f87ca1c927f0dda12cad5` (my DO review) | ✅ single parent |
| That review's parent | `5040d5cd63e46e3385f8c692f25d88424311acd2` (**Q**) | ✅ |
| Main / base **X** | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` | ✅ merge base |
| Sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` | read-only, untouched |
| Review branch | `claude/pr45-admin-origin-effect-binding-review`, rooted exactly at F | ✅ |

**Fifteen-path X→F scope confirmed:** five modified control documents (`ACCELERATED_SAFE_DELIVERY.md`, `DECISIONS.md`, `PROJECT_STATUS.md`, `README.md`, `PR6_CLOSURE_REPORT.md`) plus modified `phases/phase-1/README.md`, and nine added PR7 documents (two proposals, seven reviews).

**Three-path Q→F delta confirmed:** `…ACCEPTANCE_MATRIX.md` (+74/−14), `…EXECUTION_PLAN.md` (+619/−49), and `PR7_DURABLE_ORIGIN_CORRECTION_INDEPENDENT_REVIEW.md` (+272/−0, added at the integration).

**Controls byte-identical Q→F** — the diff restricted to the six control paths is empty. **No non-`stocky-plus/docs/` path appears anywhere in X→F**: no application, schema, migration, grant, dependency, configuration or CI change.

**All seven immutable review blobs intact at F:**

| Artifact | Blob |
|---|---|
| `PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md` | `c1fa5c2fed74bf80d1006267b43d767258895c17` ✅ |
| `PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md` | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` ✅ |
| `PR7_TOPIC_AUTHORITY_FINALIZATION_INDEPENDENT_REVIEW.md` | `e609e9526ed1ec043551ca68d6b977f5b5935d0c` ✅ |
| `PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md` | `e908770d9daea4f963b2fd09e38af79e07274d41` ✅ |
| `PR7_GENERATION_W_INTEGRATION_INDEPENDENT_REVIEW.md` | `1d93b85aa8f61a6255fe2408148f1e5ea97c0b70` ✅ |
| `PR7_TEMPORAL_ATTRIBUTION_WRITER_COVERAGE_INDEPENDENT_REVIEW.md` | `b7e8ff338e715c79907aa633c75622958f60b4d4` ✅ |
| `PR7_DURABLE_ORIGIN_CORRECTION_INDEPENDENT_REVIEW.md` | `21b11b4af0adfce8e7044a40131190f001e9756e` ✅ (my own, unaltered) |

### 1.1 Exact-head CI

Run [`35539299444`](https://github.com/Vedang1998/Stocky/actions/runs/35539299444), event `pull_request`, attempt **1**, head SHA `f70ceb5d…`, conclusion **success**.

| Job | ID | Conclusion |
|---|---|---|
| Classify change set | `106153927046` | SUCCESS ✅ |
| Lint, typecheck, test, build, Prisma, GraphQL | `106153947486` | SKIPPED ✅ |
| CI Gate | `106153946984` | SUCCESS ✅ |

Documentation CI, correctly gated as docs-only. It is not execution of the model and I do not treat it as such. **I triggered no Actions run.**

---

## 2. Fidelity — what could and could not be verified

### 2.1 Declared digests

I extracted every fenced appendix from the plan at F and hashed the bytes:

| Appendix | Extracted SHA-256 | Declared as | Result |
|---|---|---|---|
| A — `01_contract.sql` | `d9bd880f7eb8e584b5e2139ce0d5fbc052a3b6ef61c1e9e59716fb3b285ec9c9` | **Q historical** contract | ✅ exact |
| B — `02_seed.sql` | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` | runnable seed | ✅ exact, byte-identical for a seventh packet |
| C — `03_run_proofs.py` | `59bf35f541320301c7011ae94566ea28575def299f1d8d5cadb6c8cab18c6a5b` | **Q historical** driver | ✅ exact |
| D — `04_discover_writers.py` | `666feaa8f77359d75f70ffca5bb84bc91fc9d0e0891656f17d195ef92990220d` | scanner, unchanged | ✅ exact |
| E — `04_source_derived.sql` | `9f7aaa26ecdbdf953b284b0813fb81f2693962c64870d7c2e61ea084c0bf6baa` | portable snapshot | ✅ exact, fourth confirmation |
| E — `source_derived_candidates.json` | `0ce7a39853eae7cb4808c822b3af66157cd2f59e8f236ec0fdf76205f1546ecd` | historical GW/P/Q bytes | ✅ exact, correctly labelled an environment artifact |
| **§14 `01_contract.sql`** | **`bc0d674a…` — not present in the repository** | runnable DO contract | ❌ **unpublished** |
| **§14 `03_run_proofs.py`** | **`336b2795…` — not present in the repository** | runnable DO driver | ❌ **unpublished** |
| **§14 `reproduce_q_do.py`** | **`9872848c…` — not present** | Q + lower-bound repro | ❌ **unpublished** |
| **§14 lower-bound variant SQL** | **`75a16828…` — not present** | option (a) demonstration | ❌ **unpublished** |

Appendix F contains four fenced fragments (62, 109 and 256 SQL lines and 50 Python lines) with no declared digests of their own. They are additive deltas, not the hashed files, and they are **incomplete as a contract**: they never create the `stocky_admin_capture` role that §1.8 declares as `LOGIN NOINHERIT`.

This is finding **F-CLAUDE-PR7AO-01** (§6.1).

### 2.2 What I executed instead, and how it is labelled

I did not stop. I reconstructed an executable contract by splicing Appendix F's fragments into Appendix A at their declared insertion points: F.1's table/policy/grant block before `stocky_record_writer_admission`; F.1's second fragment replacing the evidence-class block through the `WriterAdmissionOrigin` insert; F.2 appended; the `DECLARE` block extended with the four variables the fragment references (`v_admitted_at`, `v_capture_id`, `cap`, `inst_at`); and `stocky_admin_capture` added to the role array exactly as §1.8 declares it. Nothing else was changed, and no grant, policy or constraint was added or dropped.

**This reconstruction is reviewer-built evidence (SHA-256 `cb7958a5447ac1febf0e8e9ebd5ae0935dc00cdefb45d69257a336eff3b81371`). It is attributed to this review and must not be reported as Cursor's `bc0d674a…`.** The parts under review — the capture helpers, the ADMIN consume branch, and the effect host — are transcribed verbatim from Appendix F, so the findings below are findings about the declared text.

Environment: private PostgreSQL **16.13** (`160013`), socket `/tmp/pr45do-sock`, port **5441**, PGDATA `/var/lib/postgresql/pr45do`. The matrix declares 16.15 at `/tmp/pr45-do-pg16:5439`; the minor-version difference is disclosed and is not load-bearing for any result below.

### 2.3 Taxonomy — arithmetic verifies, execution does not

The declared figures are internally consistent. Reruns `14+7+9+12+10+15+26+29+30 = 152`; `375 − 152 = 223`; `191 (Q unique) + 32 (30 G16 + 2 NEG) = 223`; `313 + 30 + 2 + 30 = 375`. The matrix lists exactly **30** named `G16-admin-origin-effect-host` assertions and **2** `NEG-load-bearing` assertions, matching the claimed 32.

What I could execute:

| Run | Result |
|---|---|
| Q-hashed driver (`59bf35f5…`), G1–G6, against the reconstructed F contract | **59 records / 59 unique / 0 reruns / 0 FAIL** ✅ preserved |
| Q-hashed driver, full `main()`, against the reconstructed F contract | 313 records / **191 unique / 122 reruns** — Q's taxonomy exactly; 54 record-level failures (27 unique) |

Those 54 failures are the crosswalk working as declared, not a regression: the Q driver's `admit()` has no capture step, so every `ADMIN_SESSION_CURRENT_INSTALL` admission now raises `admission_admin_capture_required` and its downstream consumers fall through to `customer_target_attribution_ambiguous`. This is useful evidence in both directions — it confirms the ADMIN semantics genuinely changed and that F.3's crosswalk is real rather than cosmetic, and it confirms that **375 / 223 / 152 is reachable only through the unpublished driver**.

**375 / 223 / 152 is therefore reported as declared-but-not-independently-reconciled.** G1–G6 = 59 is independently reconciled.

### 2.4 Crosswalk honesty

Mandate §4 asks whether a renamed passing setup silently converts an old webhook payload into a new admin command. It does not. F.3 states the crosswalk openly, `PR7-CUST-037` explicitly discloses that the caller's `-150 minutes` is no longer provenance, and `PR7-CUST-072` still records the SQL-only substitution as **ADMITTED** rather than falsifying it. Assertion names match their stated inputs — `effect_host_rejects_old_digest_with_new_work_id` really does test an old *digest*. The problem is not the test names; it is that the conclusions drawn from them in §1.8 and §12.5 are broader than the tests support (§6.3).

---

## 3. DO-01 — the exact counterexample is closed; the class is not

### 3.1 The lower-bound-only experiment (mandate priority 2)

I rebuilt the G13 overlap fixture exactly: successor `gen_a2` installed at `now − 3h`, prior completion at `now − 2h`, claimed admission at `now − 150min` — the 17:49 / 18:19 / 18:49 structure.

| Contract | `originStatus` | `originalAdmittedAt` | 5-arg guard |
|---|---|---|---|
| Unchanged **Q** | `BOUND` / `gen_a2` | 20:26 (caller's) | **ADMITTED** — DO-01 reproduced |
| **Lower-bound-only** (`originalAdmittedAt >= installedAt`) | `BOUND` / `gen_a2` | 20:26 (caller's) | **ADMITTED** — still |
| Reconstructed **F** | `BOUND` / `gen_a2` | 22:56 (server `capturedAt`) | ADMITTED — correct: a genuinely fresh command post-dating the completion |

Confirmed, independently and on the packet's own fixture: **18:19 ≥ 17:49 holds, so option (a) admits.** It is not the correction, and the packet does not present it as one. My Review 6 recommendation (a) was insufficient; the authority was right to reject it.

Under F the caller's historical timestamp is discarded entirely — `originalAdmittedAt` becomes the server's `capturedAt`. That is the right shape of answer.

### 3.2 Capture boundary — executed, fourteen paths denied

All probes ran through the declared helpers under the declared principals.

| Path | `stocky_runtime` | `stocky_control_plane` | `stocky_original_admission` | `stocky_privacy_reader` / `_operator` |
|---|---|---|---|---|
| `stocky_establish_modeled_admin_session` | denied | denied | denied | denied |
| `stocky_capture_original_admin_command` | denied | denied | denied | denied |
| `INSERT "OriginalAdminCapture"` | denied | denied | denied | — |
| `UPDATE "OriginalAdminCapture"` | denied | denied | denied | — |
| `DELETE "QueuedWorkSighting"` | denied | denied | denied | — |
| `SET ROLE stocky_admin_capture` | denied | denied | denied | — |

`session_user` (not `current_user`) gates both helpers, so `SECURITY DEFINER` is not an escalation path. The producer cannot capture; the capture principal cannot INSERT origin. Additionally rejected: capture with no established session (`admission_admin_session_required`), a forged `stocky.admin_session_id` GUC (`admission_admin_session_mismatch`), cross-tenant capture (`admission_admin_session_mismatch`), a session whose shop disagrees with the tenant GUC (`admission_session_tenant_mismatch`), and label-only ADMIN with no capture (`admission_admin_capture_required`).

Supplementary consistency checks all fire as specified: stale capture consumed after a reinstall → `admission_capture_epoch_mismatch`; capture predating `installedAt` → `admission_capture_before_install`; capture target ≠ admission target → `admission_capture_target_mismatch`; changed digest for the same source identity → `admission_binding_conflict`; duplicate command returns the same capture id; a time-only retry leaves `originalAdmittedAt` unchanged to the microsecond.

Lifecycle preserved: `BEGIN` → `PENDING_LINK` / `acked = false` → consumers see `customer_admission_not_acked`; `stocky_recover_writer_admission` with the linked job promotes to `BOUND` **without** changing `originalAdmittedAt`; recovery of a `WEBHOOK_PROVIDER_AUTH` admission leaves it `UNATTRIBUTED`; a child inherits `BOUND` with `originalCaptureId` NULL, i.e. without minting its own capture. Unattributed overlap still raises `customer_target_attribution_ambiguous`; the unrelated shop and the unrelated customer both progress.

Per the mandate I judged the declared trust boundary rather than treating privileged fixture manipulation as an exploit. Every result above was produced through the declared helper with ordinary arguments.

### 3.3 F-CLAUDE-PR7AO-03 — P2 — replayed bytes can acquire fresh ADMIN origin

§1.8 and §7.6.2 both state that *"Queued/webhook/**replayed**/coalesced work cannot capture ADMIN or mint fresh origin from a current login."* The webhook half holds. The replayed half does not.

Three facts combine:

1. `stocky_record_writer_admission` inserts a `QueuedWorkSighting` row **only** when `p_evidence_class = 'WEBHOOK_PROVIDER_AUTH'`. `PARENT_LINEAGE` and `MANUAL_REPLAY` admissions leave no sighting. I confirmed this directly: after admitting a child under `PARENT_LINEAGE`, `QueuedWorkSighting` contained **0** rows for its source identity.
2. The sighting key is `(canonicalDomain, sourceKind, sourceIdentity, sourceContentDigest)`. The same content digest under a **new** source identity is not covered.
3. The producer's `admission_digest_conflict` guard requires an existing row with `parentWorkId IS NULL`. A child/replay row has a parent, so it does not fire.

Executed counterexample, on the overlap fixture:

| Step | Result |
|---|---|
| Admit `work_root2` (`WEBHOOK_PROVIDER_AUTH`, `dg_root2`, `now − 150min`) | UNATTRIBUTED |
| Admit `work_child2` (`PARENT_LINEAGE`, `dg_child2`, parent `work_root2`) | UNATTRIBUTED — inherits correctly |
| Guard `work_child2` against the completed target | **DENIED** — `customer_target_attribution_ambiguous` ✅ |
| Capture `dg_child2` as a fresh admin command under a **new** `sourceIdentity` | **ACCEPTED** — no sighting to block it |
| Admit `work_l4` (`ADMIN_SESSION_CURRENT_INSTALL`, `dg_child2`) | **`BOUND`**, `capturedAt = now` |
| Guard `work_l4` against the same completed target | **ADMITTED** ❌ |

The same bytes the overlap rule had just denied are written against a completed customer-redact target one relabel later. This is the DO-01 class — old data acquiring successor provenance — surviving at F through the replay route rather than the timestamp route.

**Merchant impact:** post-completion customer data that a `customers/redact` erased can be re-introduced and treated as trusted successor data, defeating the completion-integrity guarantee F-CLAUDE-PR7TF-01 and GW-01 were raised to establish. **Bounded fairly:** it requires the protected `stocky_admin_capture` principal, i.e. an authenticated admin path, and the bytes must previously have been admitted as child/replay work rather than as a webhook root. Hence P2, not P1.

**Expected behaviour:** the sighting must cover every non-ADMIN admission class, not only `WEBHOOK_PROVIDER_AUTH`, and the capture-time check must be keyed on the content digest within the canonical domain rather than on `sourceIdentity` as well — otherwise a rename defeats it. Equivalently, `admission_digest_conflict` must apply to a digest already bound to *any* origin row, regardless of `parentWorkId`.

**Missing test:** an assertion in the `G16` family — `replay_lineage_digest_cannot_acquire_fresh_admin_capture` — admitting under `PARENT_LINEAGE` / `MANUAL_REPLAY`, then attempting ADMIN capture of the same digest under a different source identity, and requiring `queued_work_cannot_acquire_fresh_admin_origin`.

### 3.4 DO-01 disposition

**PARTIALLY CORRECTED.** The mechanism is sound and the named counterexample is closed. §12.5's flat **CORRECTED** overstates it while §3.3 stands.

---

## 4. DO-02 — the specification is written; the boundary model does not demonstrate it

### 4.1 F-CLAUDE-PR7AO-02 — P2 — the effect host's digest is a caller argument

The mandate is explicit: *"Independently verify the digest is recomputed from the actual immutable effect input and compared to protected executing context, not merely compared between two caller-supplied equal strings."* I did, and it is not.

```sql
CREATE OR REPLACE FUNCTION public.stocky_apply_bound_customer_effect(
  p_canonical_domain text, p_shop_id text, p_kind text, p_value text,
  p_actual_digest text, p_effect_id text
) …
  IF wa."sourceContentDigest" IS DISTINCT FROM p_actual_digest THEN
    RAISE EXCEPTION 'effect_digest_mismatch' …
  …
  INSERT INTO public."AuditEvent"(id, "shopId", "customerRestId")
  VALUES (p_effect_id, p_shop_id, CASE WHEN p_kind = 'CUSTOMER_REST_ID' THEN p_value ELSE NULL END);
```

`p_actual_digest` is supplied by the caller and is never derived from `p_kind`, `p_value` or `p_effect_id` — the three values that constitute the effect actually written. There is no frozen input: the scoped write takes the caller's payload directly.

Executed, with two legitimate acked ADMIN admissions for the **same shop and the same target** (`work_old` / `dg_old`, `work_new` / `dg_new`):

| Case | Arguments | Outcome |
|---|---|---|
| Positive control | bind `work_new`, digest `dg_new`, effect `ae_pos` | writes ✅ |
| Packet's declared test (`PR7-CUST-073`) | bind `work_new`, digest **`dg_old`**, effect `ae_honest` | `effect_digest_mismatch` ✅ — zero rows |
| **The actual DO-02 attack** | bind `work_new`, digest **`dg_new`**, effect **`ae_substituted`** | **writes** ❌ |
| Arbitrary alternate payload | bind `work_new`, digest `dg_new`, effect **`ae_foreign_payload`** | **writes** ❌ |

The declared test only rejects a caller who *honestly reports* the digest of the old payload it is replaying. The adversary the invariant exists to stop reports the bound work's digest — which is trivially available, since it is the row the caller itself just selected — and the write lands. So §1.8's *"Independently supplied `work_id` and payload are not freely interchangeable"* is, in the supplied model, false: they are exactly interchangeable, with a third caller-supplied string as the only coupling.

This is not the honestly-declared SQL-guard-only limit. The mandate expressly sets that limit aside: *"The honest SQL-only old-effect/new-work-id control remaining ADMITTED is an explicitly declared limit."* That concerns `stocky_fact_write_guard`, and the packet retains it honestly at `PR7-CUST-072`. The finding here is that the **proposed remedy** — the effect host that exists to close it — is defeated in its own boundary model by the same class of caller-asserted authority that TA-01 removed from `p_origin_persisted` and DO-01 removed from `p_original_admitted_at`. This is the third instance of that pattern in the chain.

**Merchant impact:** if the future `applyBoundCustomerEffect` is implemented against this model, a handler that holds a valid successor `work_id` can write any customer payload for that tenant and target — the provenance record says the write is bound to a freshly captured admin command that did not produce it. Every audit trail downstream is then wrong in a way no later reconciliation can detect.

**Expected behaviour:** the host must compute the canonical digest over the exact frozen input it is about to write, compare **that** to the protected row, and accept no independent digest argument. In the disposable model, `stocky_apply_bound_customer_effect` should derive the digest from `(p_kind, p_value, p_effect_id)` — the model's proxy for the effect input — and drop `p_actual_digest`. In the application specification, §7.6.2 and §7.9 must say the host *computes* the digest from the frozen input rather than *matches* a supplied one, and that the scoped callback receives only that frozen input.

**Missing test:** `effect_host_rejects_alternate_payload_under_matching_digest` — bind a valid `work_id`, supply its own digest, and pass an effect payload the digest does not cover; require rejection before the write.

### 4.2 F-CLAUDE-PR7AO-04 — P3 — `stocky.trusted_work_id` is mintable by the consumer

§7.6.2 states: *"Transaction-local `stocky.trusted_work_id` is **set only** by `stocky_bind_execution_context` after a protected-row lookup; callers cannot mint it as authority."*

Executed as `stocky_runtime`:

```sql
SELECT set_config('stocky.trusted_work_id','work_new',true);
SELECT public.stocky_apply_bound_customer_effect(…,'dg_new','ae_forged_guc');
-- row written
```

The named mandatory derivation point is bypassed entirely. Impact is bounded because the host re-reads `WriterAdmissionOrigin` filtered by domain and shop, so cross-tenant substitution is still rejected (`effect_tenant_mismatch`, verified) — which is why this is P3 rather than P2. But the documented invariant is untrue as written, and `stocky_bind_execution_context` is not in fact a mandatory enforcement point in the modeled host.

**Expected behaviour:** either have the bind helper set a value the consumer cannot forge (e.g. a per-transaction nonce the host re-verifies against a protected row), or drop the claim and state plainly that the GUC is a convenience and the host's own re-validation is the enforcement. **Missing test:** `apply_with_self_set_trusted_work_guc_rejected`.

### 4.3 F-CLAUDE-PR7AO-05 — P3 — `OriginalAdminCapture` primary key has no tenant component

`stocky_capture_original_admin_command` derives `v_id := 'oac_' || replace(p_command_id, '-', '_')` against `id text PRIMARY KEY`. The declared uniqueness constraint is `(canonicalDomain, sourceKind, sourceIdentity, sourceContentDigest)`, but the PK is global. Executed: shop A captures command `order-sync-42`; shop B's capture of its own command `order-sync-42` fails with a raw `duplicate key value violates unique constraint "OriginalAdminCapture_pkey"` (SQLSTATE 23505) rather than any modeled contract error — and B's genuinely new admin command then cannot be admitted as ADMIN at all.

**Merchant impact:** one tenant's choice of command identifier can deny another tenant's fresh-admin capture, and the failure is an unmodeled constraint violation rather than a handled condition. It is also a weak cross-tenant existence oracle. `WriterAdmissionOrigin.id = 'wao_' || workId` carries the same shape from Q; because that PK makes `workId` globally unique, `stocky_bind_execution_context`'s missing `canonicalDomain` predicate is harmless in practice — I checked that specifically and am **not** raising it as a finding.

**Expected behaviour:** key the capture id on `(canonicalDomain, commandId)` or a surrogate. **Missing test:** `two_shops_same_command_id_both_capture`.

### 4.4 DO-02 disposition

**NOT DEMONSTRATED.** The application invariant, the caller-to-host map, the named files and the test homes are now written, which is real progress — §7.6.2's effect-host table and §7.9's ownership rows are specific and checkable. But the mandate asks whether they are *"complete and demonstrably effective in the supplied boundary model"*, and the supplied model admits the substitution. §12.5's **CORRECTED** is not supported.

---

## 5. Preserved closures

| Closure | Status at F | Evidence |
|---|---|---|
| **TA-01 core** (protected origin, producer/owner separation, 5-arg guard) | preserved | fourteen-path escalation matrix, all denied |
| **TA-02** (portable snapshot; JSON digest labelled an environment artifact) | preserved | `04_source_derived.sql` = `9f7aaa26…`, fourth confirmation; candidates JSON = historical `0ce7a398…` |
| **GW-02** (source-derived completeness) | preserved | scanner byte-identical (`666feaa8…`); prior injection/removal campaign reused with exact identity, per mandate |
| **GW-01 inclusive overlap** | preserved | unattributed overlap → `customer_target_attribution_ambiguous`; equality boundaries unchanged |
| **CC-01 / CC-02, TF-01…04, CP/XC** | preserved | G1–G6 59/59 under the new contract; residual and barrier paths unchanged |
| **G1–G6 = 59** | preserved | independently executed, 0 FAIL |

---

## 6. Findings

### 6.1 F-CLAUDE-PR7AO-01 — P2 — the declared runnable contract and driver are not published

**File / line:** `PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md` §14 (hash table) and Appendix F header, line 31424.
**Evidence:** §14 declares `01_contract.sql` `bc0d674a…` and `03_run_proofs.py` `336b2795…` as the executable artifacts. Appendix A (`d9bd880f…`) and Appendix C (`59bf35f5…`) are labelled *"Q historical transcription; **not** the runnable DO contract/driver"* and hash to the Q identities. Appendix F states it *"transcribes the additive fragments only"* and its four fragments carry no declared digests and omit the `stocky_admin_capture` role creation. `reproduce_q_do.py` `9872848c…` and the lower-bound variant `75a16828…` are declared with hashes and not published at all.
**Reproduction:** extract every fenced block from the plan at F and hash it; no extraction yields `bc0d674a…` or `336b2795…`.
**Merchant impact:** the planning record for the load-bearing capture and effect contract cannot be re-executed, re-verified or regression-tested from the repository by a later reviewer, auditor or implementer. Every prior packet in this chain satisfied that property and this mandate requires it (*"Extract/hash the exact declared SQL, seed and driver; execute a clean PostgreSQL 16 model"*). The declared **375 / 223 / 152** rests entirely on artifacts no one else holds.
**Expected behaviour:** publish the complete runnable `01_contract.sql` and `03_run_proofs.py` as full appendices whose extracted bytes hash to the declared digests, as Appendix A and C did at Q; publish `reproduce_q_do.py` and the lower-bound variant, or remove their hash rows.
**Missing test:** an extraction self-check in §14 asserting that each hashed file is reproducible from a named appendix.

### 6.2 F-CLAUDE-PR7AO-02 — P2 — effect host validates a caller-supplied digest, not the effect it writes

See §4.1. Appendix F.2, `stocky_apply_bound_customer_effect`.

### 6.3 F-CLAUDE-PR7AO-03 — P2 — replay/child-lineage bytes can acquire fresh ADMIN origin

See §3.3. Appendix F.1 (`QueuedWorkSighting` insert guarded by `p_evidence_class = 'WEBHOOK_PROVIDER_AUTH'`), F.2 (`stocky_capture_original_admin_command` sighting predicate).

### 6.4 F-CLAUDE-PR7AO-04 — P3 — `stocky.trusted_work_id` claim is false

See §4.2. Plan §7.6.2, line 556.

### 6.5 F-CLAUDE-PR7AO-05 — P3 — capture primary key has no tenant component

See §4.3. Appendix F.1 DDL and F.2 id derivation.

### 6.6 Crosswalk corrections required

§1.8 and §12.5 must be brought back to what the evidence supports: DO-01 **partially corrected**, DO-02 **specified but not demonstrated**. `PR7-CUST-073`'s claim is accurate for its stated input and should stay; what must change are the summary rows that generalise from it.

---

## 7. Effective negative controls

Each is a single-defense removal against the reconstructed contract, with the declared contract reloaded afterwards.

| Control | Removal | Counterexample returns | Kind |
|---|---|---|---|
| Capture requirement | only the `admission_admin_capture_required` raise, falling back to the caller timestamp | overlap 18:19 recorded `BOUND`, guard **ADMITTED** — DO-01 revives | single |
| Queued sighting | only the `queued_work_cannot_acquire_fresh_admin_origin` raise | a sighted webhook identity captures ADMIN | single |
| Effect-host digest comparison | only the `effect_digest_mismatch` block | old digest + new `work_id` writes | single |
| Effect-host context requirement | only the `effect_execution_context_required` block | apply without any bound context writes | single |

Contract restored after each; `admission_admin_capture_required` fires again on the restored contract. One earlier attempt at the first control was a **composite** mutation — it left `cap."liveGenerationId"` NULL so `admission_capture_epoch_mismatch` fired instead, masking the result. I discarded that run and redid it as a clean single-defense removal; the row above is the corrected one.

---

## 8. Evidence classification

**Independently executed this review:** ancestry, fifteen-path scope, three-path delta, seven blobs, control byte-identity, docs-only confirmation; the three CI job identities; extraction and hashing of all six published appendix artifacts; the three-way lower-bound experiment (Q / option (a) / F) on the exact 17:49 / 18:19 / 18:49 fixture; the fourteen-path capture escalation matrix; session forgery, cross-tenant capture and tenant-GUC probes; label-only ADMIN; queued-sighting and pre-sighted-inbox denial; same-digest-new-identity relabel at both layers; duplicate and changed-digest commands; capture consume and re-consume; target mismatch; reinstall epoch mismatch; pre-install capture; `BEGIN` / `PENDING_LINK` / recover-with-job non-restamping; `UNATTRIBUTED` non-upgrade; child inheritance without fresh capture; overlap and unrelated-shop/customer preservation; the full effect-host substitution matrix including the forged-GUC path and its cross-tenant rejection; the cross-tenant capture-PK collision; G1–G6 = 59/59; the full Q-hashed driver against the F reconstruction (313 / 191 / 122); four single-defense negative controls with restoration.

**Reused with exact identity:** GW-02 injection and removal evidence from the temporal-attribution review (scanner `666feaa8…` and portable SQL `9f7aaa26…` both byte-identical, so the mechanism and source identities are unchanged — the mandate permits this reuse explicitly). Q taxonomy 313 / 191 / 122 from Review 6, re-confirmed here.

**Declared but not independently reconciled:** **375 records / 223 unique / 152 reruns**, and the thirty `G16` plus two `NEG` assertion outcomes — the driver that produces them is unpublished (§6.1). Their names, arithmetic and internal consistency check out; their execution does not.

**Not reproduced, not claimed passed:** the installed-library `authenticate.admin` matrix remains not independently reproduced — nothing in this review executes Shopify authentication, and the plan is correct that PostgreSQL does not verify Shopify tokens. Redis job drain, export publication, D scratch reclamation, live Shopify, application `test:privacy`, and the proposed `original-admin-capture.server.ts` / `bound-effect.server.ts` runtime remain implementation obligations this SQL model does not test. PR48 MATCH/NEW/MISSING provenance preserved unchanged. No PR6 corpus, no million-line envelope, no PR48 repackaging, no store or merchant access, no legal-retention certification.

**Isolation and teardown:** the container held no PostgreSQL cluster, socket, listening port or data directory at session start — verified before allocating. I created PGDATA `/var/lib/postgresql/pr45do` (0700, postgres-owned), socket directory `/tmp/pr45do-sock` (0755), port **5441**, and confirmed postmaster pid **549** was mine. I touched nothing on 5433–5440. Only my own cluster, database and scratch files will be removed. All results are recorded under this review's identity, never as Cursor's.

---

## 9. Remaining decisions and entry gates

1. **F-CLAUDE-PR7AO-01** — republish the runnable contract and driver as complete hashed appendices.
2. **F-CLAUDE-PR7AO-02** — the effect host must compute the digest over the frozen input it writes and accept no independent digest argument; update §7.6.2, §7.9 and the `G16` assertions accordingly.
3. **F-CLAUDE-PR7AO-03** — extend the queued-sighting defense to every non-ADMIN admission class and key it on the content digest within the canonical domain.
4. **F-CLAUDE-PR7AO-04 / 05** — correct the `stocky.trusted_work_id` claim and give the capture primary key a tenant component.
5. **Crosswalk** — restate DO-01 as partially corrected and DO-02 as specified-but-not-demonstrated.
6. Carried forward unchanged: the `authenticate.admin` acceptance-test gate; Redis / export / D-scratch fences; PR7 processors; **Q-008 remains a production blocker**; R-176 **OPEN / P0**.

Then a further independent re-review with no unresolved P0/P1/P2. **No verdict in this document authorizes plan merge or PR7 runtime.**

---

## 10. Artifact identity and unchanged-subject confirmation

Subject F, main X, the six control documents, the two proposals, the seven prior reviews and sealed PR48 are **unchanged by this review**. I made no edit to any subject, control, proposal, peer branch, previous review, application file, schema, grant, dependency or CI definition; triggered no Actions run; made no store, merchant or production call; enabled no flag or scope; and neither marked ready nor merged anything.

This document is the only file added, on branch `claude/pr45-admin-origin-effect-binding-review`, whose review commit has sole parent `f70ceb5d08276352f8d907046d8fdf92ae6d0522`.

**Verdict: CORRECTIONS REQUIRED.**
