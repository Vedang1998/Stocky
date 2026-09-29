# Phase 1 PR7 — Durable-origin correction independent review

**Outcome: CORRECTIONS REQUIRED**

One unresolved **P2**, one **P3**. **F-CLAUDE-PR7TA-02 is closed. F-CLAUDE-PR7TA-01's core defect is closed** — the caller-asserted boolean is gone and provenance now lives in a protected record no ordinary writer can touch. What remains is narrower: one evidence class accepts a caller-chosen historical timestamp without checking it against the install it binds to.

Planning review only. This does **not** accept the plan, authorize PR7 runtime, edit peer branches, mark ready, or merge. PR6 **CLOSED**. Phase 1 **IN PROGRESS**. R-176 **OPEN / P0**. R-164 unchanged. Q-008 **OPEN**. D-054; **no D-055**.

Authority: [PR45 comment 5752452287](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5752452287). TA correction authority: `5751868329`. Prior review: `b0d73cc7a4adc1488461aafdbd64bdb52bb87b8a` (subject P `500b476a…`, blob `b7e8ff33…`).

---

## 0. Headline

TA-01 is answered with the stronger of the two options I offered. The seven-argument guard is gone; the five-argument guard `(domain, shop, kind, value, work_id)` **derives** `originalAdmittedAt`, generation and trust from a protected `WriterAdmissionOrigin` row. I attacked the producer boundary from both ordinary writer roles across nine paths — mint, rebind, delete-and-recreate, direct DML on both tables, all three helpers, and `SET ROLE` to either privileged role — and **every one was denied**. Recovery does not upgrade `UNATTRIBUTED` or restamp a timestamp.

The residual is in the evidence class rather than the mechanism. `ADMIN_SESSION_CURRENT_INSTALL` binds to the current LIVE generation on the strength of `live_n = 1` alone; it never checks the caller-supplied `p_original_admitted_at` against that install. A payload timestamped inside the overlap window is recorded `BOUND` to the successor and admitted, skipping the GW-01 ambiguity rule an `UNATTRIBUTED` record would trigger. Timestamps *before* the successor's install are still caught downstream by `restore_denied`, which bounds the exposure to the overlap window.

---

## 1. Identity, scope and preservation

| Field | Value | Verification |
|---|---|---|
| Subject **Q** | `5040d5cd63e46e3385f8c692f25d88424311acd2` | PR API + `git rev-parse` |
| Q sole parent | `b0d73cc7a4adc1488461aafdbd64bdb52bb87b8a` | ✅ my prior review |
| That review's sole parent | `500b476ad079de5f6a1282fd65b2576f0afc9a52` (**P**) | ✅ |
| Main / base **X** | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` | full ancestor |
| Full scope X→Q | **14 paths** — 8 added (2 proposals + 6 reviews), 6 modified controls | `git diff --name-status` |
| P→Q delta | **3 paths** — matrix `+85/−23`, plan `+969/−228`, and the prior review added `+294/−0` | `git diff --numstat` |
| Runtime / configuration delta | **none** — every one of the 14 paths is Markdown under `stocky-plus/docs/` | verified |
| Controls P→Q | **byte-identical** — the six mechanical control files are untouched by this correction | `git diff --name-only` returned empty |
| Sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` | unchanged, read-only |
| Review branch | `claude/pr45-durable-origin-correction-review` | rooted exactly at Q |

**All six immutable review blobs intact:**

| Artifact | Blob |
|---|---|
| #1 corrected planning | `c1fa5c2fed74bf80d1006267b43d767258895c17` ✅ |
| #2 executable contract | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` ✅ |
| #3 topic authority / finalization | `e609e9526ed1ec043551ca68d6b977f5b5935d0c` ✅ |
| #4 customer completion | `e908770d9daea4f963b2fd09e38af79e07274d41` ✅ |
| #5 generation / W integration | `1d93b85aa8f61a6255fe2408148f1e5ea97c0b70` ✅ |
| #6 temporal attribution / writer coverage | `b7e8ff338e715c79907aa633c75622958f60b4d4` ✅ |

### 1.1 Exact-head CI

Run [`35534809084`](https://github.com/Vedang1998/Stocky/actions/runs/35534809084), event `pull_request`, attempt 1, `head_sha = 5040d5cd…`:

| Job | ID | Conclusion |
|---|---|---|
| Classify change set (incl. self-test) | `106141810637` | **success** |
| Lint, typecheck, test, build, Prisma, GraphQL | `106141826314` | **skipped** |
| CI Gate | `106141826125` | **success** |

Exactly as declared. Documentation integrity only — not a working-app certification and not execution of the model. **No Actions run was triggered by this review.**

---

## 2. Fidelity, execution and taxonomy

### 2.1 Declared digests

| Appendix | File | Declared | Match |
|---|---|---|---|
| A | `01_contract.sql` (3782 lines) | `d9bd880f…b3b285ec9c9` | ✅ |
| B | `02_seed.sql` (73 lines) | `d0d84842…4084f632` | ✅ |
| C | `03_run_proofs.py` (3111 lines) | `59bf35f5…cab18c6a5b` | ✅ |
| D | `04_discover_writers.py` (646 lines) | `666feaa8…2990220d` | ✅ **unchanged vs P/GW** |
| E | `04_source_derived.sql` (1530 lines) | `9f7aaa26…c0bf6baa` | ✅ **unchanged vs P/GW** |
| E | `source_derived_candidates.json` | declared an environment/run artifact, not a portable digest | see §5 |

The seed is byte-identical for a **sixth consecutive packet**.

### 2.2 Clean execution

Private PostgreSQL **16.13** cluster on a port I verified free and allocated myself (**5438**, socket `/tmp/pr45-ta-sock`), under the declared restricted principals, contract/seed/driver unmodified:

```
{ "total": 313, "pass": 313, "fail": 0,
  "unique_assertions": 191, "declared_reruns": 122,
  "postgres": "16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)" }   EXIT=0
```

No hidden grant, dropped constraint, repaired driver or privileged preseeded origin row was required or applied by me. The driver's `admit()` helper runs as `stocky_original_admission` and calls the **real** `stocky_record_writer_admission` — I confirmed this by reading the crosswalk and by exercising the same helper myself in §3.

### 2.3 Taxonomy — every declared figure reconciles

| Measure | Declared | My parse |
|---|---|---|
| Records | 313 | **313** ✅ |
| Unique `(group,name)` | 191 | **191** ✅ |
| Reruns | 122 | **122** ✅ |
| Original G1–G6 | 59 | **59 records, 59 unique, 0 reruns** ✅ |
| G15-durable-origin | 29 unique | **58 records, 29 unique** ✅ |
| NEG-load-bearing | 9 | **9** ✅ |

The nine NEG controls include two new ones that separate the two attack classes the mandate asked to be distinguished: `lookup_bypass_revives_ta01_admit` and `unauthorized_mint_revives_ta01_admit`.

### 2.4 Interface crosswalk

§1068 states the P 7-arg → Q 5-arg migration explicitly: consumers no longer pass `p_origin_persisted`, `p_origin_generation_id` or `p_payload_admitted_at`; G13 assertion **names** are preserved; the successor-overlap admit is now an ADMIN admission **after** `gen_a2` is LIVE with a **new** digest rather than a caller boolean; a newly attached old digest raises `admission_digest_conflict` rather than restamping. I checked the substantive point the mandate raised — that renamed setup must not turn old webhook input into a new admin event merely to pass — and §3.4 below is where that concern actually bites, not in the crosswalk itself.

---

## 3. TA-01 — core defect closed; one residual

### 3.1 The mechanism now in place

`WriterAdmissionOrigin` and `WriterAdmissionOriginTarget` are owned by nologin `stocky_admission_origin_owner`, carry `ENABLE`+`FORCE` RLS with owner-only write policies and SELECT-only for `stocky_lifecycle_gate_owner`, and are `REVOKE ALL … FROM PUBLIC`. All three helpers are `SECURITY DEFINER` owned by that role, granted `EXECUTE` **only** to `stocky_original_admission`, and each begins with `IF session_user IS DISTINCT FROM 'stocky_original_admission' THEN RAISE … 42501` — `session_user`, so a `SET ROLE` cannot spoof it. Uniqueness on `(canonicalDomain, sourceKind, sourceIdentity, sourceContentDigest)` plus a root-digest partial unique index make retries coalesce rather than remint.

The guard resolves everything from the record: `v_payload_admitted_at := wa."originalAdmittedAt"`, `v_trusted := (originStatus='BOUND') AND originGenerationId non-empty`, with fail-closed exits for missing record, wrong tenant, `PENDING_LINK`, `acked IS NOT TRUE` and unbound target (`customer_target_binding_mismatch`).

### 3.2 Producer boundary — executed, all nine paths denied

As **both** ordinary writer roles, on a clean fixture:

| Attempt | `stocky_runtime` | `stocky_control_plane` |
|---|---|---|
| `stocky_record_writer_admission` | permission denied | permission denied |
| `stocky_commit_writer_admission` | permission denied | permission denied |
| `stocky_recover_writer_admission` | permission denied | permission denied |
| direct `INSERT` into `WriterAdmissionOrigin` | permission denied | permission denied |
| direct `UPDATE` (rebind origin) | permission denied | permission denied |
| direct `DELETE` (delete-and-recreate) | permission denied | permission denied |
| `INSERT` into `WriterAdmissionOriginTarget` | permission denied | permission denied |
| `SET ROLE stocky_original_admission` | permission denied | permission denied |
| `SET ROLE stocky_admission_origin_owner` | permission denied | permission denied |

The TA-01 self-assertion defect is genuinely closed at the database layer. This is the stronger of the two corrections I offered.

### 3.3 Recovery — executed

`stocky_recover_writer_admission('w_old')` on an `UNATTRIBUTED` record left it `status=UNATTRIBUTED`, `gen=<null>`, `originalAdmittedAt` unchanged. Recovery reconciles; it does not upgrade or restamp. ✅

### 3.4 F-CLAUDE-PR7DO-01 — P2 — `ADMIN_SESSION_CURRENT_INSTALL` binds a caller-chosen historical timestamp to the current install

**Anchors.** `stocky_record_writer_admission` evidence-class branch; plan §548 producer map.

**Mechanism.** The entire check for this class is:

```sql
IF p_evidence_class = 'ADMIN_SESSION_CURRENT_INSTALL' THEN
  IF live_n <> 1 OR live_id IS NULL THEN
    RAISE EXCEPTION 'admission_generation_ambiguous' …
  END IF;
  v_origin := live_id;
  v_status := CASE WHEN v_mode = 'BEGIN' THEN 'PENDING_LINK' ELSE 'BOUND' END;
```

`p_original_admitted_at` is never compared with the LIVE generation it is about to be bound to, and nothing beyond the caller's choice of label evidences an authenticated current admin session. Plan §548 documents only the `live_n = 1` re-read after locks.

**Executed**, on the standard overlap fixture (`gen_a2` LIVE installed 17:49, `gen_a` target completed 18:49), all admissions made through the **real** helper as the producer principal:

| Admission | Recorded | Guard |
|---|---|---|
| `WEBHOOK_PROVIDER_AUTH`, admittedAt 18:19 (overlap) | `UNATTRIBUTED`, gen `<null>` ✅ | `customer_target_attribution_ambiguous` ✅ |
| `WEBHOOK_PROVIDER_AUTH`, admittedAt now (post-completion) | `UNATTRIBUTED` ✅ | ADMITTED ✅ correct |
| **`ADMIN_SESSION_CURRENT_INSTALL`, admittedAt 18:19 (overlap)** | **`BOUND`, gen `gen_a2`** | **ADMITTED** |
| `ADMIN_SESSION_CURRENT_INSTALL`, admittedAt 10:49 (pre-install) | `BOUND`, gen `gen_a2` | `customer_target_restore_denied` ✅ |

The webhook class behaves exactly as the mandate requires — it stays unattributed where historical origin is indistinguishable. The admin class does not: a payload timestamped inside the overlap window is recorded as trusted successor work and admitted, bypassing the GW-01 inclusive-overlap ambiguity that the identical timestamp would trigger under `UNATTRIBUTED`.

**Bounding, stated fairly.** This requires the protected `stocky_original_admission` principal — it is **not** reachable by ordinary writers (§3.2). And a clearly ancient timestamp is still caught downstream by `restore_denied`, so the exposure is the overlap window specifically, not all history. That is why this is P2 and not P1.

**Why it is a missing planning mechanism rather than a deferred boundary.** The mandate's test was whether the class is "explicitly tied to an authenticated original admin effect, not a caller-selected label for an old queued payload". Both of the two inputs that would establish that tie — the class string and the timestamp — are caller-supplied, and the contract cross-checks neither against the other nor against the install. A distinct DB login is real enforcement of *who may record*, but it supplies no evidence about *what* is being recorded, which the plan itself acknowledges is the point of the class.

**Recommended correction.** Either is sufficient and both are small:

- **(a) Constrain the timestamp to the install.** Require `p_original_admitted_at >= (LIVE generation).installedAt` for this class, raising `admission_generation_ambiguous` otherwise. A genuine current-install admin action always satisfies it; an old queued payload never does. This closes the overlap window with one predicate and matches the existing downstream `installedAt` comparison.
- **(b) Require session-bound evidence.** Derive the admitted-at from the authenticated admin session rather than accepting it as a parameter, and declare where that session evidence is captured.

**Missing test.** A G15 case recording `ADMIN_SESSION_CURRENT_INSTALL` with an `originalAdmittedAt` inside the overlap window and asserting it is refused or recorded `UNATTRIBUTED`.

### 3.5 F-CLAUDE-PR7DO-02 — P3 — no declared invariant binds the guard's `work_id` to the effect actually written

**Executed.** With two legitimate, acked admissions for the **same shop and the same target** — `w_old` (overlap, unattributed) and `w_new` (post-completion) — the honest lookups behave correctly (`attribution_ambiguous` and ADMITTED respectively). But an ordinary writer replaying the old effect while passing `w_new` is **ADMITTED**: the guard's inputs are `(domain, shop, kind, value, work_id)` and it cannot observe which payload the caller subsequently writes.

I want to be precise about what this is and is not. The database-side contract is complete: tenant, ack, `PENDING_LINK`, target binding, digest uniqueness and lineage are all enforced, and I could not defeat any of them. A SQL guard structurally cannot inspect a statement the caller has not issued yet, so this is not a mechanism the contract could have supplied. What is absent is the **declared application-side invariant** — that a writer must call the guard with the `work_id` of the work it is actually executing — together with its enforcement point and test home. Plan §527 says "Record id is lookup only", which is honest, and §540 lists consumer capabilities, but neither states the invariant nor names who supplies the protected execution link, which the mandate asked to be determined.

P3 rather than P2 because correct application code passes the `work_id` it is executing, the exposure requires an application defect or a writer already holding guard `EXECUTE`, and the corrective action is a specification addition with a bounded scope.

**Recommended correction.** State the invariant in §7.6.2 alongside the producer map, name the integration point that guarantees it (the TenantDb / apply-writer wrapper that owns both the work record and the effect), and require an implementation test asserting a writer cannot execute effect A under work record B.

---

## 4. Temporal and lifecycle regressions — preserved

Verified through the new 5-arg path rather than assumed:

| Guarantee | Result |
|---|---|
| GW-01 inclusive overlap, unattributed | `attribution_ambiguous` ✅ (via `w_old`) |
| Old-origin restore denial | `restore_denied` ✅ (via pre-install admin record) |
| Legitimate successor progress | ADMITTED ✅ (via post-completion `w_new`) |
| Active target barrier precedence | `customer_target_erasing` raised before origin resolution ✅ (guard order unchanged) |
| Unbound target for a valid work id | `customer_target_binding_mismatch` ✅ |
| Unacked / `PENDING_LINK` | `customer_admission_not_acked` ✅ |
| Missing / wrong-tenant work id | `attribution_ambiguous` ✅ |
| Multi-generation handling, `ORDER BY id` absence | unchanged from GW; 59 G1–G6 and G11/G13 preserved ✅ |

Admission does not erase the fresh-versus-delayed distinction for the webhook class; §3.4 is the one place where it does for the admin class.

---

## 5. TA-02 — closed

Re-ran the **unchanged** scanner (`666feaa8…`, byte-identical to P/GW) against a read-only `git archive` extraction of X:

```
scanned_files 506   discovered 1307   required 219   unknown 0
sha256_source_sql  9f7aaa26ecdbdf953b284b0813fb81f2693962c64870d7c2e61ea084c0bf6baa   <- MATCHES
```

The portable `04_source_derived.sql` matches for a **third** independent time (P and Q). Candidate payload equivalence confirmed field by field: `candidates` (1307), `required` (219), `scanned_files` (506) and `counts` all **equal**; the only differing envelope keys are `app_root` and `scan_roots`.

The plan now labels `source_derived_candidates.json` an "original-run / environment artifact, not a portable input digest", records both the historical GW/P bytes (`0ce7a398…`, roots `/workspace/stocky-plus`) and its own this-session X regeneration (`e93b23bf…`), and states the substantive payload is equal. That is exactly the correction I recommended. **TA-02 is closed.**

Per the mandate I reused my prior GW-02 injection and removal evidence rather than restarting the coverage campaign: the scanner digest, the source-SQL digest and the source identities are all unchanged, so the mechanism I exercised at P is the mechanism here.

---

## 6. Effective negative controls

The suite's nine NEG controls correctly separate the two classes, and I verified the producer-side one independently (§3.2 is a direct, single-defense demonstration that unauthorized mint/rebind is refused). `lookup_bypass_revives_ta01_admit` and `unauthorized_mint_revives_ta01_admit` are distinct entries, and the seven pre-existing controls — completion guard, epoch guard, writer gate, generation guess, residual guard, temporal overlap, floor-only completeness — are retained with their reviewed meanings, including the one that reproduces my own CE-E finding. Each replaces one function and reloads the declared contract afterwards.

My §3.4 and §3.5 results are **single-defense** observations on the declared contract itself, not composite mutations: I removed nothing and changed nothing to obtain them.

---

## 7. Evidence classification

**Independently executed by me:** Q/prior-review/P ancestry chain; 14-path scope and 3-path P→Q delta; six review blobs; control byte-stability P→Q; docs-only confirmation; CI identities; extraction and verification of all five portable digests; a private PostgreSQL 16.13 cluster on a self-allocated free port running the model unmodified (313/313); independent taxonomy parse including G15 and NEG; the nine-path producer escalation matrix from both writer roles; admission recording through the real helper for four evidence-class/timestamp combinations; the substitution test with two valid same-shop/same-target work records; the recovery non-upgrade test; the temporal/lifecycle regression set through the 5-arg path; and the TA-02 scanner re-run with field-by-field candidate comparison.

**Reused with explicit attribution:** my prior GW-02 injection/removal campaign (mechanism and source identity unchanged); the closures of CC-01…04, GW-01's overlap rule and GW-02; my earlier independent JWT-precision and active-job-remove results.

**Unexecuted and not claimed passed:** the `authenticate.admin` matrix remains **not independently reproduced**; Redis, export publication, D-scratch and PR7 processor proofs remain implementation obligations that this SQL model does not test; no live Shopify call, no legal-retention certification, no PR48 repackaging, no PR6 corpus or million-line envelope. PR48's MATCH / NEW / MISSING attribution is preserved unchanged.

**Isolation.** I verified ports 5433–5436 before doing anything: in this container all were free and no leftover `pr45` directories existed, so I neither found nor stopped any other agent's cluster. I allocated **5438** with socket `/tmp/pr45-ta-sock` and PGDATA `/var/lib/postgresql/pr45ta`, confirmed the postmaster pid was mine, and removed only those. The packet's own §1062 honestly records that it did not stop the leftover clusters it observed. Residue after cleanup: none. All results here are recorded under **this review's** identity, not as anyone else's outputs.

**Not done:** no CI rerun, no store or merchant access, no production, no flags, no mark-ready, no merge; no change to the subject, either proposal, the control files, any of the six reviews, `main`, PR48, runtime, schema, grants, packages or CI.

---

## 8. Remaining decisions and entry gates

1. **F-DO-01** resolved — constrain `ADMIN_SESSION_CURRENT_INSTALL` to the install window (option (a) recommended) or derive the timestamp from the authenticated session.
2. **F-DO-02** dispositioned — declare the work-id/effect invariant, its enforcement point and a test home.
3. **Implementation-proof obligations carried forward, none claimed passed:** installed-library actor/owner binding including the string-`sub` requirement; positive Redis/worker drain; export publication re-read under the publication lock; D-scratch cross-process reclamation with a truthful incomplete outcome.
4. **Owner decisions still open:** Q-008 retention language (production blocker; linkable provenance is correctly not described as anonymous) and the residual D-PR7 register items.
5. A further independent re-review with **no unresolved P0/P1/P2**.

Unchanged and mandatory: exact-head **full** CI on the implementation base, named single writer with exclusive file ownership, and a **subsequent explicit ChatGPT runtime authorization**. Documentation CI and a model result are not working-app certification. **No verdict, including this one, authorizes merge or PR7 runtime.**

---

## 9. Artifact identity and unchanged-subject confirmation

| Field | Value |
|---|---|
| Review branch | `claude/pr45-durable-origin-correction-review` |
| Rooted at | `5040d5cd63e46e3385f8c692f25d88424311acd2` |
| Added path | `stocky-plus/docs/phases/phase-1/PR7_DURABLE_ORIGIN_CORRECTION_INDEPENDENT_REVIEW.md` |
| Files changed | exactly one, added |
| Proposals, controls, six prior reviews | **not modified** |
| Subject before / after | `5040d5cd63e46e3385f8c692f25d88424311acd2` — unchanged |
| Main **X** | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` — read-only |
| Sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` — unchanged |
| Actions runs triggered | none |

**Outcome: CORRECTIONS REQUIRED** — 1 P2 (`F-CLAUDE-PR7DO-01`), 1 P3 (`F-CLAUDE-PR7DO-02`); TA-02 closed, TA-01's core defect closed. A reviewer recommendation, not ChatGPT acceptance.
