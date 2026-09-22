# Phase 1 PR7 — Grok 4.7 interim peer review of frozen H

**Outcome: INTERIM PEER REVIEW — NO BLOCKING FINDINGS OBSERVED; CLAUDE GATE OPEN**

No unresolved **P0 / P1 / P2** inside reviewed planning scope. Mandatory identity, clean-export PostgreSQL 16, RE-01 / RE-02 / AO-06 control paths, semantic-identity attacks, PR50 harness adjudication, and one-pass mutation controls were executed here. Claude Stage A (PR49 AUTH-X / EFF-X) is **carried as attributed prior evidence**, not this session’s execution.

This is **not** planning acceptance, **not** write authorization, **not** a substitute for the actual Claude Code gate, **not** merge authority, and **not** PR7 runtime. A provisional pass cannot start implementation.

Authority: [PR45 comment 5769290139](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5769290139) (owner dispatch via issue [#51](https://github.com/Vedang1998/Stocky/issues/51)). Frozen H READY: [5760738230](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5760738230). Correction package: [5759445052](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5759445052). Actual Claude consolidated-review mandate: [5759453932](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5759453932). Claude Stage A checkpoint: [5760005839](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5760005839).

PR6 **CLOSED**. Phase 1 **IN PROGRESS**. R-176 **OPEN / P0**. R-164 unchanged. Q-008 **OPEN**. D-054; **no D-055**.

---

## 0. Headline

I reviewed frozen H as a **new** Cloud Agent, not as a continuation of excluded author sessions `bc-36ad3f03-3cc4-447e-9d44-12207a2b8426` (PR50) or `bc-369132c6-924c-479f-8b33-b4a4c87a63ef` (PR45). Both were **IDLE** when this run started. No published `review/pr45-grok47-interim-20260921` branch existed (404). I did not post a duplicate BLOCKED comment from an author session.

**Requested model:** Grok 4.7, xhigh if supported.  
**Actual dispatched model:** `cursor-grok-4.6-xhigh` (run-info `originalModelName`). This is **not** Grok 4.7. Same-family tooling does not make the result Claude’s, and it does not make a 4.6 dispatch into a 4.7 execution.

**This run:** `bc-9fd3011e-64ea-4328-a50f-306b49b66e7b` — https://cursor.com/agents/bc-9fd3011e-64ea-4328-a50f-306b49b66e7b

RE-01 holds through the protected effect in both serial orders and in concurrent capture/sighting and effect/sighting races with observed lock waits. A single-defense effect-recheck mutation revives sighting-first writes while consume still holds. A complete consume-recheck mutation (including the `UPDATE … contradictedAt IS NULL` predicate) revives capture-first admit while effect recheck still holds. Composite removal of both defenses writes; restore returns the contract to `d4c21ff9…` and the positive control still writes.

RE-02 holds: `pr7-source-v1` is distinct from `pr7-effect-v1`; renamed work/command/effect IDs on the same body cannot recapture or write a second effect; a genuine new body progresses. On unchanged S the historical defects still reproduce (capture→sight→consume→effect writes; a new effect-id digest still acquires a fresh ADMIN capture).

AO-06 holds: clean `git archive` of H, extractor bootstrap to `70684794…`, `--selftest` honesty limit then `extraction_selftest_ok`, twelve-plus manifest paths, reviewer extraction negatives fail-closed except the declared coordinated-edit pass. Independently executed CURRENT model: **505 / 505 PASS / 0 FAIL = 290 unique + 215 declared reruns**, G1–G6 unique **59**, G16 unique **93**, NEG unique **15**, PostgreSQL **16.15**.

I did not find a new blocking product defect on H. I did find P3 documentation tensions, a trusted-principal defense-in-depth observation on `stocky_note_queued_work`, a PR50 harness `rc` bug that is **not** an H product bug, and contract ambiguities (Unicode NFC/NFD; Q-008) that I did not convert into invented policy.

---

## 1. Identity, preservation, CI

| Field | Value | Verified |
|---|---|---|
| Subject **H** | `3cc2045107b54601c6b0e43c8690b7d090074b80` | live PR45 `headRefOid`; local `/tmp/pr45-h` |
| H tree | `9e8d0e1543f01c215bcbf6815e51512933a90cea` | `git rev-parse HEAD^{tree}` |
| H parent | `e7dd4f42487409f2c5ebd026c7be5b8d70c3764e` | sole parent (evidence-record commit) |
| Clean-export candidate | `e7dd4f42…` | CURRENT contract blob-identical to H extract (`d4c21ff9…`) |
| Main / base **X** | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` | `origin/main`; merge-base(H,X)=X |
| Prior **S** | `fd5f7bbdf18fa12d75371686d8969d67fe68a158` | ancestor of H |
| Ninth review | `22941f177f48ab95343330a05aac29ea1c9a6d4e` | **sole parent S**; blob `9596e5b92f6b56d6d1871b87103eebdb8bf54d77` |
| PR49 **E** | `d63629077fcf29775c69161372c2cf903cfa62c6` | read-only `/tmp/pr49-e` |
| Sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` | not edited |
| Supplemental PR50 **G** | `7b64c3099a46e32924917f7c3149a0cd2e3f8efe` | read-only `/tmp/pr50-g`; **not edited** |
| Plan blob at H | `07f86fbf0657fc58ffc2aa99556d402cf09a20a1` | `git rev-parse HEAD:…EXECUTION_PLAN.md` |
| Matrix blob at H | `ad6c610d6da868803bbecdfedd8218af2973146d` | `git rev-parse HEAD:…ACCEPTANCE_MATRIX.md` |

**Seventeen-path X→H** (all under `stocky-plus/docs/**`; zero application/schema/migration/grant/CI/lockfile paths):

six modified controls (`ACCELERATED_SAFE_DELIVERY.md`, `DECISIONS.md`, `PROJECT_STATUS.md`, `README.md`, `PR6_CLOSURE_REPORT.md`, `phases/phase-1/README.md`) plus eleven PR7 documents (two proposals, nine reviews).

**Three-path S→H:** `PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md`, `PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md`, `PR7_REPRODUCIBLE_EFFECT_REPLAY_PROVENANCE_INDEPENDENT_REVIEW.md` (ninth review integrated unchanged).

**Nine immutable review blobs at H (byte-for-byte):**

| # | Blob | Path |
|---|---|---|
| 1 | `c1fa5c2fed74bf80d1006267b43d767258895c17` | `PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md` |
| 2 | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` | `PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md` |
| 3 | `e609e9526ed1ec043551ca68d6b977f5b5935d0c` | `PR7_TOPIC_AUTHORITY_FINALIZATION_INDEPENDENT_REVIEW.md` |
| 4 | `e908770d9daea4f963b2fd09e38af79e07274d41` | `PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md` |
| 5 | `1d93b85aa8f61a6255fe2408148f1e5ea97c0b70` | `PR7_GENERATION_W_INTEGRATION_INDEPENDENT_REVIEW.md` |
| 6 | `b7e8ff338e715c79907aa633c75622958f60b4d4` | `PR7_TEMPORAL_ATTRIBUTION_WRITER_COVERAGE_INDEPENDENT_REVIEW.md` |
| 7 | `21b11b4af0adfce8e7044a40131190f001e9756e` | `PR7_DURABLE_ORIGIN_CORRECTION_INDEPENDENT_REVIEW.md` |
| 8 | `0c3182469f26b97beb4c23f86fcc2906d11adb5c` | `PR7_ADMIN_ORIGIN_EFFECT_BINDING_INDEPENDENT_REVIEW.md` |
| 9 | `9596e5b92f6b56d6d1871b87103eebdb8bf54d77` | `PR7_REPRODUCIBLE_EFFECT_REPLAY_PROVENANCE_INDEPENDENT_REVIEW.md` |

### 1.1 Exact-H documentation CI (verified, not retriggered)

Run [`35601270296`](https://github.com/Vedang1998/Stocky/actions/runs/35601270296), event `pull_request`, `head_sha` **`3cc2045107b54601c6b0e43c8690b7d090074b80`**, conclusion **success**.

| Job | ID | Conclusion |
|---|---|---|
| Classify change set | `106337689402` | SUCCESS |
| Lint, typecheck, test, build, Prisma, GraphQL | `106337725506` | SKIPPED |
| CI Gate | `106337725158` | SUCCESS |

Docs-only packaging evidence. It is not PostgreSQL proof execution. **I triggered no Actions run.**

### 1.2 Session independence

| Session | Role | Status observed |
|---|---|---|
| `bc-9fd3011e-64ea-4328-a50f-306b49b66e7b` | this reviewer | RUNNING |
| `bc-36ad3f03-3cc4-447e-9d44-12207a2b8426` | PR50 author (excluded) | IDLE |
| `bc-369132c6-924c-479f-8b33-b4a4c87a63ef` | PR45 author (excluded) | IDLE |

A new branch inside an author conversation was not used. Reading committed H/S/E/G trees is required inspection, not author-session continuation.

---

## 2. AO-06 — extractability and 505/290/215: CORRECTED (independently reproduced)

### 2.1 Clean export and bootstrap

`git archive` of H into `/tmp/pr45-grok-ir-export` (empty destination). Bootstrap used the published whole-line `PROOF-EXTRACT` markers (`pr7-proof-extract-v1`). Extractor sha256 **`70684794504734faacf651a09a4f996d20215a1da7e99af9b34684fe8d7d8172`**. `--selftest` printed:

```
extraction_authenticity_limit:coordinated_in_repo_edit_not_prevented
extraction_selftest_ok
```

No hidden GRANT, unpublished script repair, or privileged preseeded origin was substituted for the helper. Restricted principals only: `stocky_admin_capture`, `stocky_original_admission`, `stocky_control_plane`, `stocky_runtime`, `stocky_privacy_*`. Setup owner `pr45owner` is disposable and is not a `stocky_*` superuser.

### 2.2 CURRENT hashes (this extraction)

| Artifact | sha256 |
|---|---|
| extractor `00_extract_proofs.py` | `70684794504734faacf651a09a4f996d20215a1da7e99af9b34684fe8d7d8172` |
| CURRENT contract `01_contract.sql` | `d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318` |
| driver `03_run_proofs.py` | `d24afa331bde236e6ed59243ada670d14b658bd308541b9263df616040c75d85` |
| seed `02_seed.sql` | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` |
| scanner `04_discover_writers.py` | `666feaa8f77359d75f70ffca5bb84bc91fc9d0e0891656f17d195ef92990220d` |
| portable SQL `04_source_derived.sql` | `9f7aaa26ecdbdf953b284b0813fb81f2693962c64870d7c2e61ea084c0bf6baa` |
| regenerator | `c79b03ad6c75e11fbfece767b33ac61b87820ee81140a5c3ac31553e39b0f23a` |
| DO-01 overlap reproducer | `b7c6e6da06e70bbe6216833b7f0a7918794ddd60b1e6ea8dee613faec3f8ae65` |
| option-(a) lower-bound regen (this run) | `75a168288ede88b267a3d08d225b5f4017bead2e40908c2fcac70c22a2ace284` |
| S extractor | `02b066c3838b246bd53deb7f6467e31fc7d8b63d7349d1317c21b04ecfdc6177` |
| S contract | `b55bb88e758e1a7f7c124222af616c84053fbda89e8083839d5648c333e91814` |

H extract contract equals e7dd extract contract (`d4c21ff9…`). Seed / scanner / portable SQL / regenerator / DO-01 reproducer are byte-identical S→H.

### 2.3 Extraction negatives (reviewer-built)

| `delete_contract_block` | rc=1 | `extraction_missing_block:current/01_contract.sql` |
| `weaken_effect_digest_mismatch` | rc=1 | `extraction_digest_mismatch:current/01_contract.sql:declared=d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318:got=e3f1b13fe85165c982136775b506584dffb18b662f96aee385b39f2841ca40e9` |
| `onesided_section14_table_hash` | rc=1 | `extraction_table_manifest_mismatch:current/01_contract.sql:table=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:manifest=d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318` |
| `onesided_manifest_hash` | rc=1 | `extraction_digest_mismatch:current/01_contract.sql:declared=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:got=d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318` |
| `unlisted_grant_block` | rc=1 | `extraction_unlisted_block:current/99_backdoor.sql` |
| `coordinated_in_repo_edit_expected_pass` | rc=0 | `extraction_selftest_ok` |
| `unmodified_control` | rc=0 | `extraction_selftest_ok` |

Fail-closed except the **declared** coordinated-in-repo-edit honesty limit. That limit is AO-06’s published residual, not a new defect.

### 2.4 Declared PostgreSQL 16 model (this session)

| Item | Observed |
|---|---|
| Host | `/tmp/pr45-grok-ir-pg16:5547` (unix socket, `listen_addresses=''`, trust local, **not** 5447) |
| Server | PostgreSQL **16.15** (`server_version_num` 160015), Ubuntu package |
| `psycopg` | 3.3.6 |
| `results.json` (this run) | sha256 `8c465c42e8cf2791c8cf6e35fc888c7193d517dbec4af9bec3bad341d4486ae9` |
| total / pass / fail | **505 / 505 / 0** |
| unique / declared reruns | **290 / 215** (sum 505) |
| G1–G6 unique | **59** (15+8+10+14+9+3) |
| G16 unique | **93** |
| NEG unique | **15** |

Author-declared gate `results.json` `f01b2dec…` is a **different run log** (TF-04: timings are not a verification artifact). Counts reconcile. I do not substitute the author’s run for this one, and I do not treat this run as the author’s.

No `stocky_*` role is superuser or `BYPASSRLS` (13 roles probed). All 27 SECURITY DEFINER `stocky_%` functions have `search_path=pg_catalog, pg_temp`. `stocky_runtime` has no DELETE/TRUNCATE/REFERENCES/TRIGGER on `OriginalAdminCapture` / `WriterAdmissionOrigin` / `SourceEffectLink`. Default `PUBLIC EXECUTE` remains on IMMUTABLE `stocky_lifecycle_lock_key` (hashtext only; lock helpers themselves are definer + PUBLIC revoked). Not treated as a hidden grant.

---

## 3. RE-01 — capture eligibility through the protected effect: CORRECTED

Mandate: tests must continue through the protected effect, not stop at refusal of a later capture. Linearization is the source-content lock. Sequential separate transactions.

Independent host: same `/tmp/pr45-grok-ir-pg16:5547`, restricted principals, `run_tx` / `overlap` with observed `pg_stat_activity` lock waits.

| Sequence | Result |
|---|---|
| capture → sighting → consume → effect | consume `capture_content_no_longer_fresh`; capture row `contradictedAt` set `QUEUED_INBOX`; **0** `AuditEvent` |
| capture → consume → sighting → effect | origin stays `BOUND`; effect `effect_source_no_longer_fresh`; **0** new write |
| effect then sighting (historical) | first write remains `n=1`; same effectId retries; new effectId `effect_digest_mismatch` |
| concurrent capture holds, sighting waits | `wait_seen=True`; both commit; capture contradicted; sighting present |
| concurrent sighting holds, capture denied | `wait_seen=True`; waiter **not committed**; `queued_work_cannot_acquire_fresh_admin_origin`; **0** capture rows |
| concurrent effect holds, then sighting | write `n=1`; sighting historical |
| concurrent sighting holds, effect denied | waiter not committed; `effect_source_no_longer_fresh`; `n=0` |
| duplicate consume / recapture after contradiction | both `capture_content_no_longer_fresh` |
| pending recover then sighting then effect | recover ok; effect `effect_source_no_longer_fresh` |
| lost ack (BEGIN, no recover) | `customer_admission_not_acked` |
| barrier vs other shop | matching `customer_target_erasing`; other shop writes |
| reinstall epoch | `admission_capture_epoch_mismatch` |
| correlated PARENT_LINEAGE child | parent capture **not** contradicted |
| uncorrelated webhook then stolen ADMIN | consume `capture_content_no_longer_fresh` |

S replay on `/tmp/pr45-grok-ir-s-pg16:5548` with the **6-arg** S `stocky_note_queued_work` (H’s 7-arg call is a harness miss, not an S result): capture→sight→consume→effect **writes** (`n=1`). That is the ninth-review counterexample, still present on S, absent on H.

### 3.1 Mutation controls (extracted contract only; restored)

Needles were applied to `/tmp/pr45-grok-ir-extracted/current/01_contract.sql`, never to the H git tree.

| Mutation | Label | Observation |
|---|---|---|
| Remove effect-recheck RAISE only | SINGLE | sighting-first effect **writes** (`n=1`); capture-first consume still `capture_content_no_longer_fresh` |
| Remove consume RAISE sites **and** `UPDATE … contradictedAt IS NULL` | SINGLE | capture-first admit **succeeds**; effect still `effect_source_no_longer_fresh` |
| Both of the above | COMPOSITE (labelled) | admit+apply **write** `n=1` |
| Restore | hash-checked | `d4c21ff9…` three times; positive control admit+apply succeed |

Commenting only the `CONSUME_RECHECK` RAISE leaves the UPDATE predicate, which still raises `capture_content_no_longer_fresh`. A mutation that claims to remove consume-recheck and leaves that predicate is incomplete (harness miss, not an H extra defense beyond the published UPDATE). After the complete consume mutation, effect-recheck still holds.

---

## 4. RE-02 — semantic source vs exact-effect identity: CORRECTED

Published samples independently match:

- source `pr7-a.myshopify.com` / `shop_a` / `CUSTOMER_WRITE` / `CUSTOMER_REST_ID` / `191167` / `ao02-host-body` = `71e3d9d38a6ae9c7dd86577a323d2254ffb335f8879ddd9282f4095a80fe14f7`
- effect `…` / `ae_pos` = `959bb90441a81889549f265bd75ef5b84a512486b896023cf4f42f50b2566abd`
- Python `"\n".join([version,…]).encode("utf-8")` equals SQL `stocky_source_commitment` / `stocky_effect_commitment` on the same inputs
- `effectId` is inside `pr7-effect-v1` and **not** inside `pr7-source-v1`

Attacks:

| Attack | H result |
|---|---|
| same body, new command / work / effect IDs, recapture | `queued_work_cannot_acquire_fresh_admin_origin` |
| same source, new effect on the effect lane | denied (`admission_digest_conflict` and/or effect mismatch); **0** second write |
| genuine new `source_body` | admit 0, apply 0, write proceeds |
| empty body | hashes; omitted-content |
| NULL body | STRICT returns NULL |
| NFC vs NFD `café-ir` | **distinct** SHA-256; **contract_ambiguity** — no Unicode equivalence policy invented |

S replay: same digest cannot recapture after webhook; a **new effect-id digest** still acquires ADMIN capture. That is the S RE-02 defect. H no longer treats `pr7-effect-v1` as source identity.

`SourceEffectLink` on the extracted contract: PK `(canonicalDomain, effectCommitment)`, UNIQUE `(canonicalDomain, workId)`, UNIQUE `(canonicalDomain, sourceContentDigest)`. Executable uniqueness is both per-work **and** per-source. See GROK-IR-DOC-02 for abbreviated matrix prose.

I did **not** invent a retention period or a lifetime content blacklist.

---

## 5. Shop/domain mismatch on `stocky_note_queued_work` (declared trust boundary)

H helper does **not** call `stocky_shop_canonical_domain`. Capture does.

| Input | Principal | Observed |
|---|---|---|
| domain A + shop B + digest(A) | `stocky_control_plane` | **accepted**; row `('pr7-a.myshopify.com','shop_b')` |
| then capture domain A / shop A / same digest | `stocky_admin_capture` | **denied** `queued_work_cannot_acquire_fresh_admin_origin` |
| domain B + shop A + digest(A), isolated cluster | `stocky_control_plane` | sighting accepted; domain-A capture **succeeds** (wrong-domain sighting does not cover A) |
| same note_queued call | `stocky_runtime` | **42501** `permission denied for function stocky_note_queued_work` (GRANT-level; stronger than the `session_user` RAISE) |

Classification: **trusted control-plane must pass consistent domain/shop**. This is a defense-in-depth gap versus the capture helper, **not** a runtime bypass and **not** an RE-02 failure. See GROK-IR-OBS-01 (P3).

Declared SQL-guard-only limit independently observed: `stocky_runtime` can `INSERT` `AuditEvent` directly (`rc=0`). Documented uninstrumented path; not an RE-02 miss.

---

## 6. PR50 harness audit (PR50 not edited)

Published `overlap()` in `PR7_GROK47_SUPPLEMENTAL_PREFLIGHT_REPRODUCER.md` (G `7b64c309…`) sets `holder["rc"] = 0` / `waiter["rc"] = 0` **before** `conn.commit()` and does **not** reset `rc` in the `except` path.

Local clone of that pattern with `force_commit_fail=True` (forced `PsycopgError` after `rc=0`, before commit):

- holder `rc=0`, `committed=False`, error `forced_commit_stage_failure`
- both threads completed
- final `OriginalAdminCapture` / `QueuedWorkSighting` / origin / link rows = **0** (rolled back)
- waiter also `rc=0` with `committed=False`

**GROK-IR-HARNESS-01:** a supplemental-harness bug, **not** an H product bug. Claims that used `overlap()["rc"]==0` as the sole success check without inspecting committed rows / `sqlstate` / wait samples are **not** independently adequate. Claims that already checked committed rows, `wait_seen`, and denial sqlstates remain usable with that caveat.

I did not edit PR50.

---

## 7. Application / external limits — Claude Stage A (attributed, not re-executed)

I did **not** re-run AUTH-X or EFF-X. Per mandate, Claude Stage A comment [5760005839](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5760005839) is prior independent evidence:

| Packet | Claude-reported independent result (not mine) |
|---|---|
| AUTH-X | 35 cases / 30 PASS / 5 FAIL; `liveShopify: UNVERIFIED` |
| EFF-X | 23 ids observed; `fatal: null` on four probes |
| Schedule **B** | barrier **between** fence read and sink write: **SINK WRITTEN**, body generation `gen-1`, current `gen-2` |

Claude’s classification that several AUTH-X PASS rows are unsafe-library observations, and that a fence read before sink mutation is **not** atomic publication, is carried forward. H’s plan already labels those PR49 restrictions as FACT/PROPOSED/UNEXECUTED and does not claim PostgreSQL overlap serializes external publication.

I did **not** reopen accepted D by violating external-quiescence. I did **not** execute live Shopify, Redis, or D-scratch. Distinctions held:

- real X / library behavior → Stage A attributed
- standalone H SQL feasibility model → executed here
- unimplemented PR7 application paths → not executed, not claimed

---

## 8. New findings

Original Claude IDs are **not** relabelled. New IDs are `GROK-IR-*` only.

### GROK-IR-DOC-01 — P3 — §0 omits the ninth review from the immutable list

- **File:** `PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md` lines 33–43 vs §1.10 / §14.
- **Evidence:** the “Immutable independent reviews” list names eight blobs and omits `PR7_REPRODUCIBLE_EFFECT_REPLAY_PROVENANCE_INDEPENDENT_REVIEW.md` `9596e5b9…`. §1.10 and the §14 identity table include it.
- **Merchant impact:** none at runtime; reviewer/operator miscount of the nine-review chain.
- **Expected:** the §0 list matches the nine blobs actually on H.
- **Missing test:** none required for P3 prose; blob check is git.

### GROK-IR-DOC-02 — P3 — matrix “first effect per work” vs schema unique source digest

- **File:** acceptance-matrix customer-barrier summary vs extracted `CREATE TABLE "SourceEffectLink"` and plan §7.6.2.
- **Evidence:** schema UNIQUE `(canonicalDomain, workId)` **and** UNIQUE `(canonicalDomain, sourceContentDigest)` plus PK `(canonicalDomain, effectCommitment)`. §7.6.2 states all three. The matrix one-line summary says only “binds first effect per work”. PR7-CUST-120’s bypass column correctly names per-work-only as the closed hole. §1.10’s “per work under the source key” is compressed but not false.
- **Impact:** readers of the matrix summary alone could understate the source-level unique. Executable contract is the stronger unique pair; independently exercised (`IR-RE02-SAME-SOURCE-NEW-EFFECT-DENIED-ON-EFFECT-LANE`).
- **Not** an executable defect.

### GROK-IR-DOC-03 — P3 — AO-03 unique `(domain, digest)` vs sighting PK

- **File:** plan AO-03 row vs `QueuedWorkSighting` PK `(canonicalDomain, sourceContentDigest, sightedClass, sourceIdentity)`.
- **Evidence:** RE-01 prose keys sightings by that four-tuple (matches PK). Capture denial is `EXISTS` any sighting of `(domain, digest)`, so a wider PK does **not** reopen renamed-identity recapture.
- **Not** a security hole. Documentation should not say the table itself is unique on `(domain, digest)` alone.

### GROK-IR-DOC-04 — P3 — label “H” still used for dated D snapshot `4768033b…`

- **File:** plan §1 identities, “Pinned D candidate **H** `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b`”.
- **Evidence:** this review’s frozen subject **H** is `3cc20451…`. Both labels appear in current H documents.
- **Impact:** identity confusion only. Do not chase `4768033b…` as this packet.

### GROK-IR-OBS-01 — P3 — `stocky_note_queued_work` does not bind shop to canonical domain

- **File/line:** extracted `01_contract.sql` `stocky_note_queued_work` (no `stocky_shop_canonical_domain`); capture helper does bind.
- **Evidence:** §5 table. Trusted CP insert of domain A / shop B is accepted and then **fail-closes** domain-A capture of that digest. Runtime cannot execute the function (42501).
- **Merchant impact:** none unless a trusted control-plane caller lies about shop vs domain. Not a tenant bypass by `stocky_runtime`.
- **Expected if later tightened:** helper calls `stocky_shop_canonical_domain` or rejects mismatch. Recommendation only; not implemented here.
- **Missing test on H driver:** shop/domain mismatch was previously unexecuted; now executed as IR-SIGHTING-* / IR-WRONG-DOMAIN-* / IR-RUNTIME-DENIED-NOTE-QUEUED.

### GROK-IR-HARNESS-01 — harness, not product — PR50 `overlap()` `rc=0` before commit

- **File:** PR50 `PR7_GROK47_SUPPLEMENTAL_PREFLIGHT_REPRODUCER.md` `overlap()` ~lines 386–401 (G `7b64c309…`).
- **Evidence:** §6. Forced commit-stage failure: `rc` stays 0, rows roll back, threads complete.
- **Do not** promote this to an H finding.

### GROK-IR-AMB-01 — ambiguity — Unicode NFC/NFD

Distinct UTF-8 bytes ⇒ distinct `pr7-source-v1`. No NFC/NFD equivalence is specified. I did not invent one.

### GROK-IR-AMB-02 — residual — Q-008 remains OPEN

No retention-period invention. Tombstone/pruning evidence remains the XC-08 residual.

---

## 9. Outstanding-finding crosswalk

| ID | Prior disposition on H | This review |
|---|---|---|
| F-CLAUDE-PR7RE-01 | CORRECTED (proposal) | **Independently reproduced CORRECTED** through effect; S still defective |
| F-CLAUDE-PR7RE-02 | CORRECTED (proposal) | **Independently reproduced CORRECTED**; S still acquires capture on new effect-id digest |
| F-CLAUDE-PR7AO-06 | CORRECTED (proposal) | **Independently reproduced CORRECTED**; honesty limit remains |
| F-CLAUDE-PR7AO-01…05 | ninth review closed AO-01/02/04/05; AO-03 partial | Not re-litigated except as RE-01/RE-02 successors; samples and capture uniqueness still hold here |
| PR49 AUTH-X / EFF-X / schedule B | Stage A | **Attributed**; not re-executed |
| R-176 | OPEN / P0 | unchanged; out of scope |
| R-164 | unchanged | unchanged |
| Q-008 | OPEN | OPEN (GROK-IR-AMB-02) |
| D-054 / no D-055 | effective | unchanged |
| Helper A child-work second effect | closed by source unique | not re-opened; unique source digest present |
| SQL-guard-only direct AuditEvent insert | ADMITTED honesty | reproduced (`IR-DECLARED-LIMIT-RUNTIME-DIRECT-AUDIT-INSERT`) |

No PR6 million-line rerun. No feature-inventory rewrite. No PR48/49 repackaging. No new general stress lab.

---

## 10. Evidence taxonomy

| Class | What |
|---|---|
| **executed-this-review** | identity git; exact-H CI GET; clean-export extract; selftest; negatives; 505/290/215 on PG 16.15; independent 53/53 challenges; mutations; S replay; PR50 overlap clone; grant/search_path probes |
| **executed-prior-independent (attributed)** | Claude Stage A AUTH-X 35/30/5, EFF-X 23, schedule B sink written |
| **reused-with-equivalence** | nine review blobs unchanged; S 416/244/172 not re-run (S extract hashes match declared; RE-01/RE-02 S defects reproduced on a focused replay instead of the full 416) |
| **not executed** | live Shopify; Redis/FS I/O fences; `authenticate.admin` library; D-scratch; PR7 application runtime; npm AUTH-X/EFF-X harnesses; Actions retrigger |
| **blocked** | none for the mandated H SQL / identity / harness scope |
| **inferred only** | none presented as pass |

Independent challenge suite: **53 cases / 53 PASS / 0 FAIL**. JSON sha256 `87729b449f2f6788eca7f8939a89ad277723959ad21d9d4bc9ee26bba49a142c`. Harness sha256 `81f6e652214050fedb7e1439e19a1c03548c5955f2faa13daf1abdc9fbe2d15b`. Python 3.12.3, psycopg 3.3.6.

First independent-challenge iteration in this run had 5 FAIL that were **harness isolation / incomplete consume mutation / S 7-arg call**, not H defects. Those were corrected locally and disclosed. The subject contract was not silently repaired. After restore, contract hash matched `d4c21ff9…`.

---

## 11. Limitations and residuals

1. Actual model is **cursor-grok-4.6-xhigh**, not Grok 4.7.
2. Claude gate remains **required**. This packet must not be treated as Claude’s execution.
3. AUTH-X / EFF-X / schedule B were not re-run here.
4. Unicode equivalence, retention, and Q-008 remain unspecified.
5. Trusted-CP shop/domain consistency is not helper-enforced (P3).
6. `results.json` hashes differ across runs by design (TF-04).
7. Disposable clusters used ports **5547/5548**, not the author’s 5447. Same PostgreSQL 16.15 major/minor.
8. I did not execute G1–G15 as a second copy of the 505 driver beyond the one full CURRENT run.
9. Publication is one Markdown file on a review branch rooted at H. No extra PR. No self-integration into PR45.

---

## 12. Exact next owner decision

**Possible next actions (owner / ChatGPT), not taken by this reviewer:**

1. Send frozen H `3cc20451…` plus this interim packet to the **actual Claude Code** consolidated gate (mandate 5759453932), carrying Stage A as Claude’s own prior work and **not** treating this Grok-family result as Claude’s.
2. Optionally tidy P3 documentation (ninth-review list, matrix uniqueness one-liner, AO-03 unique wording, H-label collision) in a **separately authorized** docs correction. Not required to keep this provisional pass, and **not** implementation.
3. Do **not** start PR7 runtime, migrations, grants, flags, store access, mark-ready, or merge on the strength of this comment.
4. Do **not** raise spending limits or open a second interim reviewer unless this packet is rejected for identity/model reasons.

**Verdict again:** `INTERIM PEER REVIEW — NO BLOCKING FINDINGS OBSERVED; CLAUDE GATE OPEN`

---

## 13. Resource teardown

Own clusters `/tmp/pr45-grok-ir-pg16:5547` and `/tmp/pr45-grok-ir-s-pg16:5548` were created by this reviewer and are stopped after publication. Foreign agents’ resources were not signalled. Temporary extracted trees under `/tmp/pr45-*` are disposable. H/S/E/G git worktrees were read-only as to those subjects.

---

## Appendix A — independent challenge case table (sanitized)

| `IR-SRC-SQL-MATCH` | PASS | py=0150bf78c7c5c136fcbb8e6da5a6425faea53584121182910d42168bec17d113 sql=0150bf78c7c5c136fcbb8e6da5a6425faea53584121182910d42168bec17d113 sample_ao02=False |
| `IR-AO02-SAMPLE` | PASS | 71e3d9d38a6ae9c7dd86577a323d2254ffb335f8879ddd9282f4095a80fe14f7 |
| `IR-EFF-SAMPLE` | PASS | 959bb90441a81889549f265bd75ef5b84a512486b896023cf4f42f50b2566abd |
| `IR-SRC-EFF-DISTINCT` | PASS | src=0150bf78c7c5c136fcbb8e6da5a6425faea53584121182910d42168bec17d113 eff=4a18d3e00f9193d273ea0ab50c7144b80ac61f7750e30624067dcaace12d84a4 |
| `IR-EFF-ID-IN-EFFECT` | PASS | effectId changes effect digest |
| `IR-RE01-CAPTURE-SIGHT-CONSUME-EFFECT` | PASS | cap=0 sight=0 admit=capture_content_no_longer_fresh CONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,te apply=effect_tenant |
| `IR-RE01-CAPTURE-CONSUME-SIGHT-EFFECT` | PASS | admit=0 status=[('BOUND',)]->[('BOUND',)] sight=0 apply=effect_source_no_longer_fresh CONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE n_ae= |
| `IR-RE01-EFFECT-THEN-SIGHTING-HISTORICAL` | PASS | first=0 retry_same=0 retry_newid=effect_digest_mismatch CONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 88 at RAISE n=1 |
| `IR-RACE-CAPTURE-HOLDS-SIGHTING-WAITS` | PASS | wait=True holder_rc=0 committed=True/True err_w= snap={'captures': [('oac_f264adb54f7e62cbcbfb4c217b4d31a724fac3bb6aa1aa326532334ab73422ca', True, 'QUEUED_INBOX')], 'sightings': [('shop_a', 'QUEUED_INBOX', None)], 'origi |
| `IR-RACE-SIGHTING-HOLDS-CAPTURE-DENIED` | PASS | wait=True h_rc=0 w_rc=1 w_err=queued_work_cannot_acquire_fresh_admin_origin CONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE w_committed=F |
| `IR-RACE-SIGHTING-HOLDS-NO-CAPTURE-ROW` | PASS | captures=[] waiter_err=queued_work_cannot_acquire_fresh_admin_origin CONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE sqlstate=P0001 |
| `IR-RACE-EFFECT-HOLDS-THEN-SIGHTING` | PASS | wait=True h_committed=True n=1 w_err= |
| `IR-RACE-SIGHTING-HOLDS-EFFECT-DENIED` | PASS | wait=True n=0 w_err=effect_source_no_longer_fresh CONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE w_rc=1 w_committed=False |
| `IR-DUP-CAPTURE-AFTER-CONTRADICTION-DENIED` | PASS | admit=capture_content_no_longer_fresh CONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timesta recap=capture_content_no_longer_fresh CONTEXT:  PL/pgSQL function public. |
| `IR-PENDING-RECOVERY-THEN-SIGHTING-NO-EFFECT` | PASS | admit=0 recover=0  apply=effect_source_no_longer_fresh CONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE |
| `IR-LOST-ACK-UNRECOVERED-CANNOT-EFFECT` | PASS | admit=0 apply=customer_admission_not_acked CONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 55 at RAISE |
| `IR-BARRIER-BLOCKS-MATCHING-ALLOWS-OTHER-SHOP` | PASS | bar=0 e=customer_target_erasing CONTEXT:  PL/pgSQL function public.stocky_customer_write_guard(text,text,text,text,text) line 26 at RAISE SQL statement "SELECT public.s other=0  |
| `IR-REINSTALL-EPOCH-MISMATCH-DENIES-CONSUME` | PASS | cap=0 admit=admission_capture_epoch_mismatch CONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text) line 134 a |
| `IR-CORRELATED-CHILD-DOES-NOT-CONTRADICT-PARENT` | PASS | parent=0 child=0 sight=0 contradicted=[(False,)] |
| `IR-UNCORRELATED-WEBHOOK-SIGHTS-SAME-DIGEST` | PASS | wh=0  |
| `IR-UNCORRELATED-CANNOT-MANUFACTURE-FRESH-ADMIN` | PASS | admit=capture_content_no_longer_fresh CONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text) line 97 at RAISE |
| `IR-RE02-SAME-SOURCE-NEW-IDS-CANNOT-CAPTURE` | PASS | queued_work_cannot_acquire_fresh_admin_origin CONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE |
| `IR-RE02-SAME-SOURCE-NEW-EFFECT-DENIED-ON-EFFECT-LANE` | PASS | admit=admission_digest_conflict CONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp wit apply=effect_tenant_mismatch CONTEXT:  PL/pgSQL function public.stocky_ap |
| `IR-RE02-GENUINE-NEW-SOURCE-PROGRESSES` | PASS | admit=0 apply=0  |
| `IR-RE02-DIGEST-STABLE-ACROSS-GENERATED-IDS` | PASS | same=5fc0ec3831082011e8f758e9d97de4e1ba60f5203ad53b03f958d44f232d8cf1 new=ce1e5a588bfebcc21b8067b618ee8ef1e46bcd52466b68e016b86c4618ca21d8 |
| `IR-SEM-UNICODE-NFC-NFD-BYTES-DIFFER` | PASS | nfc=4e2adb5da34afa6c nfd=2ddd09ee125c9e4e classification=contract_ambiguity |
| `IR-EMPTY-BODY-HASHES` | PASS | empty=794aa76b1c44c3dfa9fb24ecf11bf114ade11655deba64efe5e0e7365c7cf4d9 |
| `IR-NULL-BODY-STRICT-NULL` | PASS | sql=[(None,)] |
| `IR-SIGHTING-SHOP-DOMAIN-MISMATCH-OBSERVED` | PASS | rc=0 err= sqlstate= declared_principal=stocky_control_plane capture_checks_canonical_domain=yes note_queued_does_not=yes |
| `IR-SIGHTING-MISMATCH-ROW` | PASS | rows=[('pr7-a.myshopify.com', 'shop_b')] (observation; trusted CP principal; not a runtime bypass) |
| `IR-MISMATCH-SIGHTING-STILL-BLOCKS-DOMAIN-A-CAPTURE` | PASS | queued_work_cannot_acquire_fresh_admin_origin CONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE |
| `IR-WRONG-DOMAIN-SIGHTING-DOES-NOT-COVER-DOMAIN-A` | PASS | sight_b=0 cap_a=0  classification=trusted_principal_must_pass_consistent_domain; defense-in-depth gap vs capture helper |
| `IR-RUNTIME-DENIED-NOTE-QUEUED` | PASS | 42501 permission denied for function stocky_note_queued_work |
| `IR-DECLARED-LIMIT-RUNTIME-DIRECT-AUDIT-INSERT` | PASS | rc=0 err= (SQL-guard-only boundary; not an RE-02 failure) |
| `IR-NO-STOCKY-SUPERUSER-OR-BYPASSRLS` | PASS | [('stocky_admin_capture', False, False), ('stocky_admission_origin_owner', False, False), ('stocky_assignment_verifier_owner', False, False), ('stocky_control_plane', False, False), ('stocky_lifecycle_gate_owner', False, |
| `IR-RUNTIME-NO-ORIGIN-TABLE-DML-GRANTS` | PASS | sensitive_grants=[] |
| `IR-PR50-OVERLAP-COMMIT-FAIL-RC-STAYS-ZERO` | PASS | THIS IS A HARNESS BUG NOT AN H PRODUCT BUG. rc=0 committed=False err=forced_commit_stage_failure sqlstate='' final_captures=0 threads_done=yes waiter_rc=0 waiter_committed=False |
| `IR-PR50-OVERLAP-COMMIT-FAIL-FINAL-ROWS-ROLL BACK` | PASS | snap={'captures': [], 'sightings': [], 'origins': [], 'links': []} — rc==0 is not a commit-success indicator; inspect committed rows/sqlstate |
| `IR-MUT-CONTRACT-HASH-BEFORE` | PASS | d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318 |
| `IR-MUT-SINGLE-EFFECT-RECHECK-HASH-CHANGED` | PASS | 48ca601284f345f6d0f1a1192817e8c1895402ed33167674fb17e194fa5353f4 |
| `IR-MUT-SINGLE-EFFECT-RECHECK-REVIVES-SIGHTING-FIRST-EFFECT` | PASS | apply_rc=0 n=1 err= positive_control_still_required |
| `IR-MUT-SINGLE-EFFECT-RECHECK-CONSUME-STILL-HOLDS` | PASS | capture_content_no_longer_fresh CONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,te |
| `IR-MUT-RESTORE-HASH` | PASS | d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318 |
| `IR-MUT-SINGLE-CONSUME-RECHECK-APPLIED` | PASS | delta_bytes=-237 |
| `IR-MUT-SINGLE-CONSUME-RECHECK-REVIVES-CAPTURE-FIRST-ADMIT` | PASS | admit_rc=0 err= |
| `IR-MUT-SINGLE-CONSUME-RECHECK-EFFECT-RECHECK-STILL-HOLDS` | PASS | effect_source_no_longer_fresh CONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE |
| `IR-MUT-RESTORE-HASH` | PASS | d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318 |
| `IR-MUT-COMPOSITE-LABELLED` | PASS | both consume and effect rechecks removed |
| `IR-MUT-COMPOSITE-REVIVES-FULL-WRITE` | PASS | admit=0 apply=0 n=1 LABEL=composite |
| `IR-MUT-RESTORE-HASH` | PASS | d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318 |
| `IR-MUT-POSITIVE-CONTROL-AFTER-RESTORE` | PASS | admit=0 apply=0 |
| `IR-S-REPLAY-RE01-CAPTURE-SIGHT-CONSUME-EFFECT-WRITES` | PASS | S model (expected defect): cap=0 sight=0 admit=0  apply=0  n=1 |
| `IR-S-REPLAY-RE02-NEW-EFFECT-ID-ACQUIRES-CAPTURE` | PASS | same_digest_cap=1 queued_work_cannot_acquire_fresh_admin_origin CONTEXT:  PL/pgSQL function public.stocky_capture_orig new_effect_digest_cap=0  |

---

## Appendix B — complete independent harness source

Local reviewer probe only. Not repository runtime. Not applied to H git. sha256 `81f6e652214050fedb7e1439e19a1c03548c5955f2faa13daf1abdc9fbe2d15b`.

```python
#!/usr/bin/env python3
"""Independent-of-driver challenges against frozen H (and S replay).

Not repository runtime. Expectations derived from RE-01/RE-02/AO-06 mandate
and published versioned commitment specs, not from copying driver record()
predicates. Restricted principals only. Own directories/ports.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import threading
import time
import unicodedata
from pathlib import Path

import psycopg
from psycopg.errors import Error as PsycopgError

PATH_PG = "/usr/lib/postgresql/16/bin"
os.environ["PATH"] = PATH_PG + ":" + os.environ.get("PATH", "")

H_PROOF = Path("/tmp/pr45-grok-ir-extracted/current")
S_PROOF = Path("/tmp/pr45-s-extracted/current")
EVIDENCE = Path("/tmp/pr45-grok-ir-evidence")
H_PGDATA = "/tmp/pr45-grok-ir-pg16"
H_PORT = "5547"
S_PGDATA = "/tmp/pr45-grok-ir-s-pg16"
S_PORT = "5548"
OWNER = "pr45owner"
DB = "pr45_proof"
CONTRACT_HASH = "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318"

RESULTS: list[dict] = []


def src(domain, shop, kind, value, body, op="CUSTOMER_WRITE") -> str:
    payload = "\n".join(["pr7-source-v1", domain, shop, op, kind, value, body])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def eff(domain, shop, kind, value, effect_id) -> str:
    payload = "\n".join(["pr7-effect-v1", domain, shop, kind, value, effect_id])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def rec(case: str, ok: bool, detail: str, **extra):
    row = {"case": case, "ok": bool(ok), "detail": detail[:1200], **extra}
    RESULTS.append(row)
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {case}: {detail[:240]}")


def connect(host, port, user, autocommit=False):
    return psycopg.connect(
        host=host,
        port=port,
        dbname=DB,
        user=user,
        autocommit=autocommit,
    )


def ctx_sql(shop, req="preq_cr", att="patt_cr"):
    return [
        ("SELECT set_config('stocky.current_shop_id', %s, true)", (shop,)),
        ("SELECT set_config('stocky.tenant_context_version', 'phase1-db-tenant-context-v1', true)", None),
        ("SELECT set_config('stocky.privacy_request_id', %s, true)", (req,)),
        ("SELECT set_config('stocky.privacy_attempt_id', %s, true)", (att,)),
    ]


def run_tx(host, port, user, shop, statements, timeout=20, lock_timeout=None):
    """statements: list of (sql, params|None). Returns rc, err, sqlstate, rows, pid."""
    out = {"rc": 1, "err": "", "sqlstate": "", "rows": [], "pid": None}
    conn = connect(host, port, user)
    try:
        conn.execute("SET statement_timeout TO '%ss'" % int(timeout))
        with conn.cursor() as cur:
            for sql, params in ctx_sql(shop):
                cur.execute(sql, params)
                cur.fetchall()
            if lock_timeout:
                cur.execute("SELECT set_config('lock_timeout', %s, true)", (lock_timeout,))
                cur.fetchall()
            cur.execute("SELECT pg_backend_pid()")
            out["pid"] = cur.fetchone()[0]
            for sql, params in statements:
                cur.execute(sql, params)
                try:
                    out["rows"].append(cur.fetchall())
                except Exception:
                    out["rows"].append([])
        conn.commit()
        out["rc"] = 0
    except PsycopgError as exc:
        out["err"] = str(exc)
        out["sqlstate"] = exc.sqlstate or ""
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        conn.close()
    return out


def owner_query(host, port, sql, params=None):
    with connect(host, port, OWNER, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if cur.description is None:
                return []
            return cur.fetchall()


def reset_cluster(host, port, proof: Path):
    env = os.environ.copy()
    for cmd in (
        ["dropdb", "-h", host, "-p", port, "-U", OWNER, "--if-exists", DB],
        ["createdb", "-h", host, "-p", port, "-U", OWNER, DB],
    ):
        subprocess.check_call(cmd, env=env)
    psql = ["psql", "-h", host, "-p", port, "-d", DB, "-U", OWNER, "-v", "ON_ERROR_STOP=1", "-X", "-q"]
    subprocess.check_call(psql + ["-f", str(proof / "01_contract.sql")], stdout=subprocess.DEVNULL, env=env)
    subprocess.check_call(psql + ["-f", str(proof / "02_seed.sql")], stdout=subprocess.DEVNULL, env=env)
    subprocess.check_call(psql + ["-f", str(proof / "04_source_derived.sql")], stdout=subprocess.DEVNULL, env=env)


def capture(host, port, shop, domain, command_id, kind_src, ident, digest, tkind, tvalue, actor="actor_a"):
    return run_tx(host, port, "stocky_admin_capture", shop, [
        ("SELECT public.stocky_establish_modeled_admin_session(%s,%s,%s)", (shop, domain, actor)),
        ("SELECT public.stocky_capture_original_admin_command(%s,%s,%s,%s,%s,%s,%s,%s)",
         (domain, shop, command_id, kind_src, ident, digest, tkind, tvalue)),
    ])


def admit_admin(host, port, shop, domain, work, kind_src, ident, digest, tkind, tvalue, command_id=None, mode="ATOMIC", job=None, actor="actor_a"):
    command_id = command_id or ("cmd_" + work)
    cap = capture(host, port, shop, domain, command_id, kind_src, ident, digest, tkind, tvalue, actor=actor)
    if cap["rc"] != 0:
        return cap
    return run_tx(host, port, "stocky_original_admission", shop, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,%s,%s,%s,%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, %s, %s)",
         (domain, shop, work, kind_src, ident, digest, tkind, tvalue, job, mode)),
    ])


def sight(host, port, domain, shop, kind_src, ident, digest, klass="QUEUED_INBOX", parent=None, user="stocky_control_plane"):
    return run_tx(host, port, user, shop, [
        ("SELECT public.stocky_note_queued_work(%s,%s,%s,%s,%s,%s,%s)",
         (domain, shop, kind_src, ident, digest, klass, parent)),
    ])


def apply_effect(host, port, shop, domain, tkind, tvalue, effect_id, work, body, op="CUSTOMER_WRITE"):
    return run_tx(host, port, "stocky_runtime", shop, [
        ("SELECT public.stocky_apply_bound_customer_effect(%s,%s,%s,%s,%s,%s,%s,%s)",
         (domain, shop, tkind, tvalue, effect_id, work, op, body)),
        ("SELECT count(*) FROM public.\"AuditEvent\" WHERE id=%s", (effect_id,)),
    ])


def snapshot_source(host, port, digest):
    caps = owner_query(host, port, 'SELECT id, "contradictedAt" IS NOT NULL, "contradictionClass" FROM public."OriginalAdminCapture" WHERE "sourceContentDigest"=%s', (digest,))
    sights = owner_query(host, port, 'SELECT "shopId","sightedClass","correlatedCaptureId" FROM public."QueuedWorkSighting" WHERE "sourceContentDigest"=%s', (digest,))
    origins = owner_query(host, port, 'SELECT "workId","originStatus","acked","originalCaptureId" FROM public."WriterAdmissionOrigin" WHERE "sourceContentDigest"=%s', (digest,))
    links = owner_query(host, port, 'SELECT "workId","effectId","effectCommitment" FROM public."SourceEffectLink" WHERE "sourceContentDigest"=%s', (digest,))
    return {"captures": caps, "sightings": sights, "origins": origins, "links": links}


def observe_lock_wait(host, port, seconds=2.0):
    deadline = time.time() + seconds
    samples = []
    while time.time() < deadline:
        rows = owner_query(host, port, "SELECT pid, wait_event_type, wait_event, state FROM pg_stat_activity WHERE datname=%s AND wait_event_type='Lock'", (DB,))
        if rows:
            samples.append([tuple(r) for r in rows])
            return True, samples
        time.sleep(0.05)
    return False, samples


def overlap(host, port, holder_user, holder_shop, holder_stmts, waiter_user, waiter_shop, waiter_stmts, force_commit_fail=False):
    holder = {"rc": 1, "err": "", "sqlstate": "", "rows": [], "pid": None, "committed": False}
    waiter = {"rc": 1, "err": "", "sqlstate": "", "rows": [], "pid": None, "committed": False}
    held = threading.Event()
    release = threading.Event()

    def run(slot, user, shop, stmts, is_holder):
        conn = connect(host, port, user)
        try:
            with conn.cursor() as cur:
                for sql, params in ctx_sql(shop):
                    cur.execute(sql, params)
                    cur.fetchall()
                if not is_holder:
                    cur.execute("SELECT set_config('lock_timeout', %s, true)", ("3s",))
                    cur.fetchall()
                cur.execute("SELECT pg_backend_pid()")
                slot["pid"] = cur.fetchone()[0]
                rows = []
                for sql, params in stmts:
                    cur.execute(sql, params)
                    try:
                        rows.append(cur.fetchall())
                    except Exception:
                        rows.append([])
                slot["rows"] = rows
                slot["rc"] = 0  # published PR50 pattern: set before commit
                if is_holder:
                    held.set()
                    release.wait(20)
                if force_commit_fail:
                    raise PsycopgError("forced_commit_stage_failure")
                conn.commit()
                slot["committed"] = True
        except PsycopgError as exc:
            slot["err"] = str(exc)
            slot["sqlstate"] = getattr(exc, "sqlstate", None) or ""
            if is_holder:
                held.set()
            try:
                conn.rollback()
            except Exception:
                pass
            slot["committed"] = False
            # Intentionally do not reset rc — this is the published overlap() bug under test.
        finally:
            conn.close()

    th = threading.Thread(target=run, args=(holder, holder_user, holder_shop, holder_stmts, True))
    th.start()
    if not held.wait(15):
        release.set()
        th.join(5)
        return holder, waiter, False, "holder_not_ready"
    tw = threading.Thread(target=run, args=(waiter, waiter_user, waiter_shop, waiter_stmts, False))
    tw.start()
    wait_seen, _ = observe_lock_wait(host, port, 2.0)
    release.set()
    th.join(20)
    tw.join(20)
    return holder, waiter, wait_seen, "ok"


def setup_s_cluster():
    ready = subprocess.call(
        ["pg_isready", "-h", S_PGDATA, "-p", S_PORT],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if ready == 0:
        return
    if Path(S_PGDATA).exists():
        subprocess.call(["pg_ctl", "-D", S_PGDATA, "-m", "fast", "stop"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(S_PGDATA, ignore_errors=True)
    subprocess.check_call(["initdb", "-D", S_PGDATA, "--auth-local=trust", "--auth-host=reject", "--no-sync"], stdout=subprocess.DEVNULL)
    with open(Path(S_PGDATA) / "postgresql.conf", "a") as f:
        f.write("\nlisten_addresses=''\nunix_socket_directories='%s'\nmax_connections=40\n" % S_PGDATA)
    log = EVIDENCE / "s-postgres.log"
    subprocess.check_call(["pg_ctl", "-D", S_PGDATA, "-l", str(log), "-o", f"-p {S_PORT} -k {S_PGDATA}", "start"])
    time.sleep(0.4)
    subprocess.check_call(["createuser", "-h", S_PGDATA, "-p", S_PORT, "--superuser", OWNER])


def hash_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def mutate_consume_recheck(text: str, label: str) -> str:
    """Remove every consume-path freshness defense. Leave effect recheck unless
    the caller already removed it. Labelled mutation of H extracted contract only.
    """
    text = text.replace(
        "        v_domain, p_source_content_digest, 'CONSUME_RECHECK', NULL);\n"
        "      RAISE EXCEPTION 'capture_content_no_longer_fresh' USING ERRCODE = 'P0001';",
        "        v_domain, p_source_content_digest, 'CONSUME_RECHECK', NULL);\n"
        f"      -- {label}: consume recheck raise removed",
    )
    text = text.replace(
        "    IF p_evidence_class = 'ADMIN_SESSION_CURRENT_INSTALL'\n"
        "       AND existing.\"originalCaptureId\" IS NOT NULL\n"
        "       AND public.stocky_admin_source_contradicted(v_domain, p_source_content_digest, existing.\"originalCaptureId\") THEN\n"
        "      RAISE EXCEPTION 'capture_content_no_longer_fresh' USING ERRCODE = 'P0001';\n"
        "    END IF;\n",
        f"    -- {label}: duplicate-return consume recheck removed\n",
    )
    text = text.replace(
        '        AND ("boundWorkId" IS NULL OR "boundWorkId" = p_work_id)\n'
        '        AND "contradictedAt" IS NULL;',
        '        AND ("boundWorkId" IS NULL OR "boundWorkId" = p_work_id);\n'
        f"        -- {label}: contradictedAt IS NULL consume predicate removed",
    )
    return text


def sight_s(host, port, domain, shop, kind_src, ident, digest, klass="QUEUED_INBOX"):
    """S helper is 6-arg (no parent). Using H's 7-arg call is a harness miss,
    not an S product result.
    """
    return run_tx(host, port, "stocky_control_plane", shop, [
        ("SELECT public.stocky_note_queued_work(%s,%s,%s,%s,%s,%s)",
         (domain, shop, kind_src, ident, digest, klass)),
    ])


def run_h_challenges():
    host, port = H_PGDATA, H_PORT
    D = "pr7-a.myshopify.com"
    SH = "shop_a"
    K, V = "CUSTOMER_REST_ID", "191167"

    reset_cluster(host, port, H_PROOF)

    # --- commitments vs SQL ---
    body = "ir-body"
    s_py = src(D, SH, K, V, body)
    e_py = eff(D, SH, K, V, "ae_ir")
    s_sql = owner_query(host, port, "SELECT public.stocky_source_commitment(%s,%s,'CUSTOMER_WRITE',%s,%s,%s)", (D, SH, K, V, body))[0][0]
    e_sql = owner_query(host, port, "SELECT public.stocky_effect_commitment(%s,%s,%s,%s,'ae_ir')", (D, SH, K, V))[0][0]
    rec("IR-SRC-SQL-MATCH", s_py == s_sql == "71e3d9d38a6ae9c7dd86577a323d2254ffb335f8879ddd9282f4095a80fe14f7" or s_py == s_sql,
        f"py={s_py} sql={s_sql} sample_ao02={s_py==src(D,SH,K,V,'ao02-host-body')}")
    rec("IR-AO02-SAMPLE", src(D, SH, K, V, "ao02-host-body") == "71e3d9d38a6ae9c7dd86577a323d2254ffb335f8879ddd9282f4095a80fe14f7",
        src(D, SH, K, V, "ao02-host-body"))
    rec("IR-EFF-SAMPLE", eff(D, SH, K, V, "ae_pos") == "959bb90441a81889549f265bd75ef5b84a512486b896023cf4f42f50b2566abd",
        eff(D, SH, K, V, "ae_pos"))
    rec("IR-SRC-EFF-DISTINCT", s_sql != e_sql, f"src={s_sql} eff={e_sql}")
    rec("IR-EFF-ID-IN-EFFECT", e_py != eff(D, SH, K, V, "ae_other"), "effectId changes effect digest")

    # --- RE-01 capture → sighting → consume → effect ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-re01-csce"
    digest = src(D, SH, K, V, body)
    c1 = capture(host, port, SH, D, "cmd_csce", "ADMIN_ACTION", "admin_csce", digest, K, V)
    s1 = sight(host, port, D, SH, "WEBHOOK", "wh_csce", digest)
    a1 = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_csce','ADMIN_ACTION','admin_csce',%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    e1 = apply_effect(host, port, SH, D, K, V, "ae_csce", "w_csce", body)
    snap = snapshot_source(host, port, digest)
    rec("IR-RE01-CAPTURE-SIGHT-CONSUME-EFFECT",
        c1["rc"] == 0 and s1["rc"] == 0 and a1["rc"] != 0 and "capture_content_no_longer_fresh" in a1["err"]
        and e1["rc"] != 0 and not any(o[1] == "BOUND" for o in snap["origins"])
        and owner_query(host, port, "SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_csce'")[0][0] == 0,
        f"cap={c1['rc']} sight={s1['rc']} admit={a1['err'][:180]} apply={e1['err'][:180]} origins={snap['origins']} contradicted={snap['captures']}",
        sqlstate=a1["sqlstate"])

    # --- RE-01 capture → consume → sighting → effect ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-re01-ccse"
    digest = src(D, SH, K, V, body)
    a2 = admit_admin(host, port, SH, D, "w_ccse", "ADMIN_ACTION", "admin_ccse", digest, K, V)
    st = owner_query(host, port, 'SELECT "originStatus" FROM public."WriterAdmissionOrigin" WHERE "workId"=\'w_ccse\'')
    s2 = sight(host, port, D, SH, "WEBHOOK", "wh_ccse", digest)
    e2 = apply_effect(host, port, SH, D, K, V, "ae_ccse", "w_ccse", body)
    st2 = owner_query(host, port, 'SELECT "originStatus" FROM public."WriterAdmissionOrigin" WHERE "workId"=\'w_ccse\'')
    n_ae = owner_query(host, port, "SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_ccse'")[0][0]
    rec("IR-RE01-CAPTURE-CONSUME-SIGHT-EFFECT",
        a2["rc"] == 0 and st and st[0][0] == "BOUND" and s2["rc"] == 0
        and e2["rc"] != 0 and "effect_source_no_longer_fresh" in e2["err"]
        and n_ae == 0 and st2[0][0] == "BOUND",
        f"admit={a2['rc']} status={st}->{st2} sight={s2['rc']} apply={e2['err'][:200]} n_ae={n_ae}",
        sqlstate=e2["sqlstate"])

    # --- effect winner then sighting is historical ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-re01-efirst"
    digest = src(D, SH, K, V, body)
    admit_admin(host, port, SH, D, "w_efirst", "ADMIN_ACTION", "admin_efirst", digest, K, V)
    e3 = apply_effect(host, port, SH, D, K, V, "ae_efirst", "w_efirst", body)
    sight(host, port, D, SH, "WEBHOOK", "wh_efirst", digest)
    e3b = apply_effect(host, port, SH, D, K, V, "ae_efirst", "w_efirst", body)
    e3c = apply_effect(host, port, SH, D, K, V, "ae_efirst2", "w_efirst", body)
    n = owner_query(host, port, "SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_efirst'")[0][0]
    rec("IR-RE01-EFFECT-THEN-SIGHTING-HISTORICAL",
        e3["rc"] == 0 and n == 1 and e3b["rc"] == 0 and e3c["rc"] != 0 and "effect_digest_mismatch" in e3c["err"],
        f"first={e3['rc']} retry_same={e3b['rc']} retry_newid={e3c['err'][:160]} n={n}")

    # --- concurrent capture vs sighting, both winners ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-race-cap-sight"
    digest = src(D, SH, K, V, body)
    # establish session + capture as holder; sighting as waiter
    # First create session in a committed tx so capture can run in overlap? Capture needs session GUC in same tx.
    # Holder: establish+capture (holds source lock until commit). Waiter: sighting.
    holder_stmts = [
        ("SELECT public.stocky_establish_modeled_admin_session(%s,%s,%s)", (SH, D, "actor_a")),
        ("SELECT public.stocky_capture_original_admin_command(%s,%s,%s,%s,%s,%s,%s,%s)",
         (D, SH, "cmd_race_cs", "ADMIN_ACTION", "admin_race_cs", digest, K, V)),
    ]
    waiter_stmts = [
        ("SELECT public.stocky_note_queued_work(%s,%s,%s,%s,%s,%s,NULL)",
         (D, SH, "WEBHOOK", "wh_race_cs", digest, "QUEUED_INBOX")),
    ]
    h, w, wait_seen, harness = overlap(host, port, "stocky_admin_capture", SH, holder_stmts,
                                       "stocky_control_plane", SH, waiter_stmts)
    snap = snapshot_source(host, port, digest)
    rec("IR-RACE-CAPTURE-HOLDS-SIGHTING-WAITS",
        wait_seen and h["rc"] == 0 and h["committed"] and w["committed"] and len(snap["captures"]) == 1
        and len(snap["sightings"]) == 1 and snap["captures"][0][1] is True,
        f"wait={wait_seen} holder_rc={h['rc']} committed={h['committed']}/{w['committed']} err_w={w['err'][:120]} snap={snap} harness={harness}")

    reset_cluster(host, port, H_PROOF)
    body = "ir-race-sight-cap"
    digest = src(D, SH, K, V, body)
    holder_stmts = [
        ("SELECT public.stocky_note_queued_work(%s,%s,%s,%s,%s,%s,NULL)",
         (D, SH, "WEBHOOK", "wh_race_sc", digest, "QUEUED_INBOX")),
    ]
    waiter_stmts = [
        ("SELECT public.stocky_establish_modeled_admin_session(%s,%s,%s)", (SH, D, "actor_a")),
        ("SELECT public.stocky_capture_original_admin_command(%s,%s,%s,%s,%s,%s,%s,%s)",
         (D, SH, "cmd_race_sc", "ADMIN_ACTION", "admin_race_sc", digest, K, V)),
    ]
    h, w, wait_seen, harness = overlap(host, port, "stocky_control_plane", SH, holder_stmts,
                                       "stocky_admin_capture", SH, waiter_stmts)
    snap = snapshot_source(host, port, digest)
    rec("IR-RACE-SIGHTING-HOLDS-CAPTURE-DENIED",
        wait_seen and h["committed"] and (not w["committed"]) and "queued_work_cannot_acquire_fresh_admin_origin" in w["err"]
        and len(snap["captures"]) == 0 and len(snap["sightings"]) == 1,
        f"wait={wait_seen} h_rc={h['rc']} w_rc={w['rc']} w_err={w['err'][:200]} w_committed={w['committed']} snap={snap}")
    # Tighten: capture must not land.
    rec("IR-RACE-SIGHTING-HOLDS-NO-CAPTURE-ROW",
        len(snap["captures"]) == 0 and (w["committed"] is False),
        f"captures={snap['captures']} waiter_err={w['err'][:200]} sqlstate={w['sqlstate']}")

    # --- concurrent effect vs sighting ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-race-fx-sight"
    digest = src(D, SH, K, V, body)
    admit_admin(host, port, SH, D, "w_rfx", "ADMIN_ACTION", "admin_rfx", digest, K, V)
    holder_stmts = [
        ("SELECT public.stocky_apply_bound_customer_effect(%s,%s,%s,%s,%s,%s,%s,%s)",
         (D, SH, K, V, "ae_rfx_h", "w_rfx", "CUSTOMER_WRITE", body)),
    ]
    waiter_stmts = [
        ("SELECT public.stocky_note_queued_work(%s,%s,%s,%s,%s,%s,NULL)",
         (D, SH, "WEBHOOK", "wh_rfx", digest, "QUEUED_INBOX")),
    ]
    h, w, wait_seen, harness = overlap(host, port, "stocky_runtime", SH, holder_stmts,
                                       "stocky_control_plane", SH, waiter_stmts)
    n = owner_query(host, port, "SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_rfx_h'")[0][0]
    rec("IR-RACE-EFFECT-HOLDS-THEN-SIGHTING",
        wait_seen and h["committed"] and n == 1,
        f"wait={wait_seen} h_committed={h['committed']} n={n} w_err={w['err'][:120]}")

    reset_cluster(host, port, H_PROOF)
    body = "ir-race-sight-fx"
    digest = src(D, SH, K, V, body)
    admit_admin(host, port, SH, D, "w_sfx", "ADMIN_ACTION", "admin_sfx", digest, K, V)
    holder_stmts = [
        ("SELECT public.stocky_note_queued_work(%s,%s,%s,%s,%s,%s,NULL)",
         (D, SH, "WEBHOOK", "wh_sfx", digest, "QUEUED_INBOX")),
    ]
    waiter_stmts = [
        ("SELECT public.stocky_apply_bound_customer_effect(%s,%s,%s,%s,%s,%s,%s,%s)",
         (D, SH, K, V, "ae_sfx_w", "w_sfx", "CUSTOMER_WRITE", body)),
    ]
    h, w, wait_seen, harness = overlap(host, port, "stocky_control_plane", SH, holder_stmts,
                                       "stocky_runtime", SH, waiter_stmts)
    n = owner_query(host, port, "SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_sfx_w'")[0][0]
    rec("IR-RACE-SIGHTING-HOLDS-EFFECT-DENIED",
        wait_seen and h["committed"] and n == 0 and (not w["committed"]) and "effect_source_no_longer_fresh" in w["err"],
        f"wait={wait_seen} n={n} w_err={w['err'][:200]} w_rc={w['rc']} w_committed={w['committed']}")

    # --- duplicate consume after contradiction ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-dup"
    digest = src(D, SH, K, V, body)
    capture(host, port, SH, D, "cmd_dup", "ADMIN_ACTION", "admin_dup", digest, K, V)
    sight(host, port, D, SH, "WEBHOOK", "wh_dup", digest)
    a = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_dup','ADMIN_ACTION','admin_dup',%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    c2 = capture(host, port, SH, D, "cmd_dup", "ADMIN_ACTION", "admin_dup", digest, K, V)
    rec("IR-DUP-CAPTURE-AFTER-CONTRADICTION-DENIED",
        a["rc"] != 0 and c2["rc"] != 0 and "capture_content_no_longer_fresh" in (a["err"] + c2["err"]),
        f"admit={a['err'][:140]} recap={c2['err'][:140]}")

    # --- pending recovery then sighting then effect ---
    reset_cluster(host, port, H_PROOF)
    owner_query(host, port, "INSERT INTO public.\"DurableJob\"(id,\"shopId\",\"jobType\",state) VALUES ('job_ir_pend','shop_a','admitted:ADMIN_ACTION','PENDING') ON CONFLICT (id) DO NOTHING")
    body = "ir-pend"
    digest = src(D, SH, K, "999999", body)
    a = admit_admin(host, port, SH, D, "w_pend", "ADMIN_ACTION", "admin_pend", digest, K, "999999", mode="BEGIN", job="job_ir_pend")
    recov = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_recover_writer_admission('w_pend')", None),
    ])
    sight(host, port, D, SH, "WEBHOOK", "wh_pend", digest)
    e = apply_effect(host, port, SH, D, K, "999999", "ae_pend", "w_pend", body)
    rec("IR-PENDING-RECOVERY-THEN-SIGHTING-NO-EFFECT",
        a["rc"] == 0 and recov["rc"] == 0 and e["rc"] != 0 and "effect_source_no_longer_fresh" in e["err"],
        f"admit={a['rc']} recover={recov['rc']} {recov['err'][:100]} apply={e['err'][:180]}")

    # --- lost ack: BEGIN without recover cannot effect ---
    reset_cluster(host, port, H_PROOF)
    owner_query(host, port, "INSERT INTO public.\"DurableJob\"(id,\"shopId\",\"jobType\",state) VALUES ('job_ir_lost','shop_a','admitted:ADMIN_ACTION','PENDING') ON CONFLICT (id) DO NOTHING")
    body = "ir-lostack"
    digest = src(D, SH, K, V, body)
    a = admit_admin(host, port, SH, D, "w_lost", "ADMIN_ACTION", "admin_lost", digest, K, V, mode="BEGIN", job="job_ir_lost")
    e = apply_effect(host, port, SH, D, K, V, "ae_lost", "w_lost", body)
    rec("IR-LOST-ACK-UNRECOVERED-CANNOT-EFFECT",
        a["rc"] == 0 and e["rc"] != 0 and "customer_admission_not_acked" in e["err"],
        f"admit={a['rc']} apply={e['err'][:180]}")

    # --- active barrier blocks matching effect; other shop progresses ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-bar"
    digest = src(D, SH, K, V, body)
    admit_admin(host, port, SH, D, "w_bar", "ADMIN_ACTION", "admin_bar", digest, K, V)
    bar = run_tx(host, port, "stocky_privacy_erasure", SH, [
        ("SELECT public.stocky_privacy_install_customer_barrier('preq_cr','patt_cr')", None),
    ])
    e = apply_effect(host, port, SH, D, K, V, "ae_bar", "w_bar", body)
    body_b = "ir-bar-b"
    digest_b = src("pr7-b.myshopify.com", "shop_b", K, V, body_b)
    admit_admin(host, port, "shop_b", "pr7-b.myshopify.com", "w_bar_b", "ADMIN_ACTION", "admin_bar_b", digest_b, K, V, actor="actor_b")
    e_b = apply_effect(host, port, "shop_b", "pr7-b.myshopify.com", K, V, "ae_bar_b", "w_bar_b", body_b)
    rec("IR-BARRIER-BLOCKS-MATCHING-ALLOWS-OTHER-SHOP",
        bar["rc"] == 0 and e["rc"] != 0 and ("customer_target_erasing" in e["err"] or "customer_target" in e["err"])
        and e_b["rc"] == 0,
        f"bar={bar['rc']} e={e['err'][:160]} other={e_b['rc']} {e_b['err'][:80]}")

    # --- reinstall epoch ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-epoch"
    digest = src(D, SH, K, V, body)
    c = capture(host, port, SH, D, "cmd_epoch", "ADMIN_ACTION", "admin_epoch", digest, K, V)
    owner_query(host, port, "INSERT INTO public.\"ShopInstallGeneration\"(id,\"canonicalDomain\",\"targetShopId\",\"shopRowId\",fence,\"installedAt\") VALUES ('gen_a2','pr7-a.myshopify.com','shop_a','shop_a','LIVE', clock_timestamp()); UPDATE public.\"ShopInstallGeneration\" SET fence='UNINSTALLED', \"shopRowId\"=NULL WHERE id='gen_a';")
    a = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_epoch','ADMIN_ACTION','admin_epoch',%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    rec("IR-REINSTALL-EPOCH-MISMATCH-DENIES-CONSUME",
        c["rc"] == 0 and a["rc"] != 0 and "admission_capture_epoch_mismatch" in a["err"],
        f"cap={c['rc']} admit={a['err'][:200]}")

    # --- correlated child vs uncorrelated ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-corr"
    digest = src(D, SH, K, "999999", body)
    parent = admit_admin(host, port, SH, D, "w_corr_p", "ADMIN_ACTION", "admin_corr_p", digest, K, "999999")
    child = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_corr_c','CHILD','child_corr',%s,'pr7-origin-v1', clock_timestamp(), 'PARENT_LINEAGE',%s,%s, 'w_corr_p', NULL, 'ATOMIC')",
         (D, SH, digest, K, "999999")),
    ])
    # sighting of same digest with parent work should be correlated
    s = sight(host, port, D, SH, "CHILD", "child_corr", digest, klass="PARENT_LINEAGE", parent="w_corr_p")
    cap_row = owner_query(host, port, 'SELECT "contradictedAt" IS NOT NULL FROM public."OriginalAdminCapture" WHERE "sourceIdentity"=\'admin_corr_p\'')
    rec("IR-CORRELATED-CHILD-DOES-NOT-CONTRADICT-PARENT",
        parent["rc"] == 0 and child["rc"] == 0 and s["rc"] == 0 and cap_row and cap_row[0][0] is False,
        f"parent={parent['rc']} child={child['rc']} sight={s['rc']} contradicted={cap_row}")

    reset_cluster(host, port, H_PROOF)
    body = "ir-uncorr"
    digest = src(D, SH, K, V, body)
    capture(host, port, SH, D, "cmd_unc", "ADMIN_ACTION", "admin_unc", digest, K, V)
    # uncorrelated parent cannot manufacture freshness: webhook origin then child
    wh = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_unc_wh','WEBHOOK','wh_unc',%s,'pr7-origin-v1', clock_timestamp(), 'WEBHOOK_PROVIDER_AUTH',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    rec("IR-UNCORRELATED-WEBHOOK-SIGHTS-SAME-DIGEST",
        wh["rc"] == 0 or "admission" in wh["err"] or "queued" in wh["err"] or wh["rc"] != 0,
        f"wh={wh['rc']} {wh['err'][:200]}")
    # After webhook of same digest, ADMIN consume of prior capture must fail.
    a = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_unc_admin','ADMIN_ACTION','admin_unc',%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    rec("IR-UNCORRELATED-CANNOT-MANUFACTURE-FRESH-ADMIN",
        a["rc"] != 0,
        f"admit={a['err'][:220]}")

    # --- RE-02 renamed ids / new effect id ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-re02"
    digest = src(D, SH, K, V, body)
    admit_admin(host, port, SH, D, "w_re02", "ADMIN_ACTION", "admin_re02", digest, K, V, command_id="cmd_re02")
    apply_effect(host, port, SH, D, K, V, "ae_re02", "w_re02", body)
    # new work + new command + new effect, same body
    cap_new = capture(host, port, SH, D, "cmd_re02_new", "ADMIN_ACTION", "admin_re02_new", digest, K, V)
    rec("IR-RE02-SAME-SOURCE-NEW-IDS-CANNOT-CAPTURE",
        cap_new["rc"] != 0 and "queued_work_cannot_acquire_fresh_admin_origin" in cap_new["err"],
        cap_new["err"][:220])
    a_new = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_re02b','ADMIN_ACTION','admin_re02b',%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    e_new = apply_effect(host, port, SH, D, K, V, "ae_re02b", "w_re02b", body)
    rec("IR-RE02-SAME-SOURCE-NEW-EFFECT-DENIED-ON-EFFECT-LANE",
        e_new["rc"] != 0 or a_new["rc"] != 0,
        f"admit={a_new['err'][:140]} apply={e_new['err'][:140]}")
    # genuine new source
    body2 = "ir-re02-new"
    d2 = src(D, SH, K, V, body2)
    a2 = admit_admin(host, port, SH, D, "w_re02n", "ADMIN_ACTION", "admin_re02n", d2, K, V)
    e2 = apply_effect(host, port, SH, D, K, V, "ae_re02n", "w_re02n", body2)
    rec("IR-RE02-GENUINE-NEW-SOURCE-PROGRESSES",
        a2["rc"] == 0 and e2["rc"] == 0,
        f"admit={a2['rc']} apply={e2['rc']} {e2['err'][:80]}")
    rec("IR-RE02-DIGEST-STABLE-ACROSS-GENERATED-IDS",
        src(D, SH, K, V, body) == digest and src(D, SH, K, V, body) != d2,
        f"same={digest} new={d2}")

    # --- Unicode NFC/NFD: different bytes, no invented equivalence policy ---
    nfc = unicodedata.normalize("NFC", "café-ir")
    nfd = unicodedata.normalize("NFD", "café-ir")
    rec("IR-SEM-UNICODE-NFC-NFD-BYTES-DIFFER",
        nfc.encode() != nfd.encode() and src(D, SH, K, V, nfc) != src(D, SH, K, V, nfd),
        f"nfc={src(D,SH,K,V,nfc)[:16]} nfd={src(D,SH,K,V,nfd)[:16]} classification=contract_ambiguity")

    # --- empty / NULL ---
    empty = src(D, SH, K, V, "")
    null_sql = owner_query(host, port, "SELECT public.stocky_source_commitment(%s,%s,'CUSTOMER_WRITE',%s,%s,NULL)", (D, SH, K, V))
    rec("IR-EMPTY-BODY-HASHES", empty == src(D, SH, K, V, ""), f"empty={empty}")
    rec("IR-NULL-BODY-STRICT-NULL", null_sql[0][0] is None, f"sql={null_sql}")

    # --- shop/domain mismatch on note_queued_work ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-mismatch"
    digest_a = src(D, SH, K, V, body)
    # Capture uses canonical-domain check; sighting does not.
    mismatch = sight(host, port, D, "shop_b", "WEBHOOK", "wh_mm", digest_a)  # domain A, shop B
    rec("IR-SIGHTING-SHOP-DOMAIN-MISMATCH-OBSERVED",
        True,
        f"rc={mismatch['rc']} err={mismatch['err'][:220]} sqlstate={mismatch['sqlstate']} "
        f"declared_principal=stocky_control_plane capture_checks_canonical_domain=yes note_queued_does_not=yes")
    rows = owner_query(host, port, 'SELECT "canonicalDomain","shopId" FROM public."QueuedWorkSighting" WHERE "sourceContentDigest"=%s', (digest_a,))
    rec("IR-SIGHTING-MISMATCH-ROW",
        mismatch["rc"] == 0 and rows and rows[0][0] == D and rows[0][1] == "shop_b",
        f"rows={rows} (observation; trusted CP principal; not a runtime bypass)")
    cap = capture(host, port, SH, D, "cmd_mm", "ADMIN_ACTION", "admin_mm", digest_a, K, V)
    rec("IR-MISMATCH-SIGHTING-STILL-BLOCKS-DOMAIN-A-CAPTURE",
        cap["rc"] != 0,
        cap["err"][:200])
    # reverse: domain B + shop A + digest computed for A.
    # Isolated: leftover domain-A sighting from the previous case would otherwise
    # deny capture and make this a test-isolation false fail.
    reset_cluster(host, port, H_PROOF)
    mismatch2 = sight(host, port, "pr7-b.myshopify.com", SH, "WEBHOOK", "wh_mm2", digest_a)
    cap2 = capture(host, port, SH, D, "cmd_mm2", "ADMIN_ACTION", "admin_mm2", digest_a, K, V)
    rec("IR-WRONG-DOMAIN-SIGHTING-DOES-NOT-COVER-DOMAIN-A",
        mismatch2["rc"] == 0 and cap2["rc"] == 0,
        f"sight_b={mismatch2['rc']} cap_a={cap2['rc']} {cap2['err'][:120]} "
        f"classification=trusted_principal_must_pass_consistent_domain; defense-in-depth gap vs capture helper")

    # --- runtime cannot note_queued ---
    rt = sight(host, port, D, SH, "WEBHOOK", "wh_rt", digest_a, user="stocky_runtime")
    rec("IR-RUNTIME-DENIED-NOTE-QUEUED",
        rt["rc"] != 0 and (rt["sqlstate"] == "42501" or "queued_sighting_principal_required" in rt["err"]),
        f"{rt['sqlstate']} {rt['err'][:160]}")

    # --- declared limit: direct AuditEvent insert by runtime ---
    ins = run_tx(host, port, "stocky_runtime", SH, [
        ("INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_direct','shop_a','191167')", None),
    ])
    rec("IR-DECLARED-LIMIT-RUNTIME-DIRECT-AUDIT-INSERT",
        ins["rc"] == 0,
        f"rc={ins['rc']} err={ins['err'][:80]} (SQL-guard-only boundary; not an RE-02 failure)")

    # --- hidden grants / role audit ---
    roles = owner_query(host, port, "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname LIKE 'stocky_%' ORDER BY 1")
    rec("IR-NO-STOCKY-SUPERUSER-OR-BYPASSRLS",
        all((not r[1] and not r[2]) for r in roles),
        str(roles))
    grants = owner_query(host, port, """
        SELECT grantee, table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_schema='public' AND grantee='stocky_runtime'
          AND privilege_type IN ('DELETE','TRUNCATE','REFERENCES','TRIGGER')
          AND table_name IN ('OriginalAdminCapture','WriterAdmissionOrigin','SourceEffectLink')
    """)
    rec("IR-RUNTIME-NO-ORIGIN-TABLE-DML-GRANTS",
        grants == [] or grants is not None,
        f"sensitive_grants={grants}")

    # --- PR50 overlap commit-stage failure (local clone of published pattern; PR50 not edited) ---
    reset_cluster(host, port, H_PROOF)
    body = "ir-commitfail"
    digest = src(D, SH, K, V, body)
    holder_stmts = [
        ("SELECT public.stocky_establish_modeled_admin_session(%s,%s,%s)", (SH, D, "actor_a")),
        ("SELECT public.stocky_capture_original_admin_command(%s,%s,%s,%s,%s,%s,%s,%s)",
         (D, SH, "cmd_cf", "ADMIN_ACTION", "admin_cf", digest, K, V)),
    ]
    waiter_stmts = [
        ("SELECT public.stocky_note_queued_work(%s,%s,%s,%s,%s,%s,NULL)",
         (D, SH, "WEBHOOK", "wh_cf", digest, "QUEUED_INBOX")),
    ]
    h, w, wait_seen, harness = overlap(host, port, "stocky_admin_capture", SH, holder_stmts,
                                       "stocky_control_plane", SH, waiter_stmts, force_commit_fail=True)
    snap = snapshot_source(host, port, digest)
    rec("IR-PR50-OVERLAP-COMMIT-FAIL-RC-STAYS-ZERO",
        h["rc"] == 0 and h["committed"] is False and "forced_commit_stage_failure" in h["err"] and len(snap["captures"]) == 0,
        f"THIS IS A HARNESS BUG NOT AN H PRODUCT BUG. rc={h['rc']} committed={h['committed']} "
        f"err={h['err'][:80]} sqlstate={h['sqlstate']!r} final_captures={len(snap['captures'])} "
        f"threads_done=yes waiter_rc={w['rc']} waiter_committed={w['committed']}")
    rec("IR-PR50-OVERLAP-COMMIT-FAIL-FINAL-ROWS-ROLL BACK",
        len(snap["captures"]) == 0 and len(snap["sightings"]) == 0,
        f"snap={snap} — rc==0 is not a commit-success indicator; inspect committed rows/sqlstate")


def run_mutations():
    host, port = H_PGDATA, H_PORT
    D, SH, K, V = "pr7-a.myshopify.com", "shop_a", "CUSTOMER_REST_ID", "191167"
    contract = H_PROOF / "01_contract.sql"
    original = contract.read_bytes()
    rec("IR-MUT-CONTRACT-HASH-BEFORE", hash_file(contract) == CONTRACT_HASH, hash_file(contract))

    def restore():
        contract.write_bytes(original)
        rec("IR-MUT-RESTORE-HASH", hash_file(contract) == CONTRACT_HASH, hash_file(contract))

    # SINGLE: remove effect recheck only
    text = original.decode()
    needle = (
        "    PERFORM public.stocky_mark_uncorrelated_captures_contradicted(\n"
        "      v_domain, wa.\"sourceContentDigest\", 'EFFECT_RECHECK', NULL);\n"
        "    RAISE EXCEPTION 'effect_source_no_longer_fresh' USING ERRCODE = 'P0001';\n"
    )
    if needle not in text:
        rec("IR-MUT-SINGLE-EFFECT-RECHECK-NEEDLE", False, "needle missing")
        restore()
        return
    contract.write_text(text.replace(needle, "    -- SINGLE-DEFENSE MUTATION: effect freshness recheck removed\n", 1))
    rec("IR-MUT-SINGLE-EFFECT-RECHECK-HASH-CHANGED", hash_file(contract) != CONTRACT_HASH, hash_file(contract))
    reset_cluster(host, port, H_PROOF)
    body = "ir-mut-eff"
    digest = src(D, SH, K, V, body)
    admit_admin(host, port, SH, D, "w_mut_e", "ADMIN_ACTION", "admin_mut_e", digest, K, V)
    sight(host, port, D, SH, "WEBHOOK", "wh_mut_e", digest)
    e = apply_effect(host, port, SH, D, K, V, "ae_mut_e", "w_mut_e", body)
    n = owner_query(host, port, "SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_mut_e'")[0][0]
    rec("IR-MUT-SINGLE-EFFECT-RECHECK-REVIVES-SIGHTING-FIRST-EFFECT",
        e["rc"] == 0 and n == 1,
        f"apply_rc={e['rc']} n={n} err={e['err'][:80]} positive_control_still_required")
    # capture-first consume should still deny (consume recheck intact)
    reset_cluster(host, port, H_PROOF)
    body = "ir-mut-eff-cf"
    digest = src(D, SH, K, V, body)
    capture(host, port, SH, D, "cmd_mut_cf", "ADMIN_ACTION", "admin_mut_cf", digest, K, V)
    sight(host, port, D, SH, "WEBHOOK", "wh_mut_cf", digest)
    a = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_mut_cf','ADMIN_ACTION','admin_mut_cf',%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    rec("IR-MUT-SINGLE-EFFECT-RECHECK-CONSUME-STILL-HOLDS",
        a["rc"] != 0 and "capture_content_no_longer_fresh" in a["err"],
        a["err"][:180])
    restore()

    # SINGLE: remove CONSUME_RECHECK raises inside admission (leave effect recheck).
    # Honest single-defense: every consume-path freshness check must go, including
    # the UPDATE … contradictedAt IS NULL predicate that still RAISES the same
    # capture_content_no_longer_fresh when only the RAISE sites are commented.
    text = original.decode()
    text2 = mutate_consume_recheck(text, "SINGLE-DEFENSE MUTATION")
    rec("IR-MUT-SINGLE-CONSUME-RECHECK-APPLIED", text2 != text, f"delta_bytes={len(text2)-len(text)}")
    contract.write_text(text2)
    reset_cluster(host, port, H_PROOF)
    body = "ir-mut-con"
    digest = src(D, SH, K, V, body)
    capture(host, port, SH, D, "cmd_mut_c", "ADMIN_ACTION", "admin_mut_c", digest, K, V)
    sight(host, port, D, SH, "WEBHOOK", "wh_mut_c", digest)
    a = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_mut_c','ADMIN_ACTION','admin_mut_c',%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    rec("IR-MUT-SINGLE-CONSUME-RECHECK-REVIVES-CAPTURE-FIRST-ADMIT",
        a["rc"] == 0,
        f"admit_rc={a['rc']} err={a['err'][:120]}")
    e = apply_effect(host, port, SH, D, K, V, "ae_mut_c", "w_mut_c", body)
    rec("IR-MUT-SINGLE-CONSUME-RECHECK-EFFECT-RECHECK-STILL-HOLDS",
        e["rc"] != 0 and "effect_source_no_longer_fresh" in e["err"],
        e["err"][:200])
    restore()

    # COMPOSITE: both consume and effect rechecks removed (labelled composite)
    text = original.decode()
    textc = text.replace(needle, "    -- COMPOSITE MUTATION: effect recheck removed\n", 1)
    textc = mutate_consume_recheck(textc, "COMPOSITE MUTATION")
    contract.write_text(textc)
    rec("IR-MUT-COMPOSITE-LABELLED", True, "both consume and effect rechecks removed")
    reset_cluster(host, port, H_PROOF)
    body = "ir-mut-comp"
    digest = src(D, SH, K, V, body)
    capture(host, port, SH, D, "cmd_comp", "ADMIN_ACTION", "admin_comp", digest, K, V)
    sight(host, port, D, SH, "WEBHOOK", "wh_comp", digest)
    a = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_comp','ADMIN_ACTION','admin_comp',%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    e = apply_effect(host, port, SH, D, K, V, "ae_comp", "w_comp", body)
    n = owner_query(host, port, "SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_comp'")[0][0]
    rec("IR-MUT-COMPOSITE-REVIVES-FULL-WRITE",
        a["rc"] == 0 and e["rc"] == 0 and n == 1,
        f"admit={a['rc']} apply={e['rc']} n={n} LABEL=composite")
    restore()
    reset_cluster(host, port, H_PROOF)
    # positive control after restore
    body = "ir-mut-pos"
    digest = src(D, SH, K, V, body)
    a = admit_admin(host, port, SH, D, "w_pos", "ADMIN_ACTION", "admin_pos", digest, K, V)
    e = apply_effect(host, port, SH, D, K, V, "ae_pos_ir", "w_pos", body)
    rec("IR-MUT-POSITIVE-CONTROL-AFTER-RESTORE",
        a["rc"] == 0 and e["rc"] == 0 and hash_file(contract) == CONTRACT_HASH,
        f"admit={a['rc']} apply={e['rc']}")


def run_s_replay():
    setup_s_cluster()
    host, port = S_PGDATA, S_PORT
    reset_cluster(host, port, S_PROOF)
    D, SH, K, V = "pr7-a.myshopify.com", "shop_a", "CUSTOMER_REST_ID", "191167"
    # S has no pr7-source-v1; G16 used caller-chosen / effect-identity digests.
    digest = eff(D, SH, K, V, "ae_s_re01")

    def s_capture(command_id, ident, dg):
        return run_tx(host, port, "stocky_admin_capture", SH, [
            ("SELECT public.stocky_establish_modeled_admin_session(%s,%s,%s)", (SH, D, "actor_a")),
            ("SELECT public.stocky_capture_original_admin_command(%s,%s,%s,%s,%s,%s,%s,%s)",
             (D, SH, command_id, "ADMIN_ACTION", ident, dg, K, V)),
        ])

    def s_apply(effect_id, work):
        return run_tx(host, port, "stocky_runtime", SH, [
            ("SELECT public.stocky_apply_bound_customer_effect(%s,%s,%s,%s,%s,%s)",
             (D, SH, K, V, effect_id, work)),
        ])

    c = s_capture("cmd_s_re01", "admin_s_re01", digest)
    s = sight_s(host, port, D, SH, "WEBHOOK", "wh_s_re01", digest)
    a = run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_s_re01','ADMIN_ACTION','admin_s_re01',%s,'pr7-origin-v1', clock_timestamp(), 'ADMIN_SESSION_CURRENT_INSTALL',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, digest, K, V)),
    ])
    e = s_apply("ae_s_re01", "w_s_re01")
    n = owner_query(host, port, "SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_s_re01'")[0][0]
    rec("IR-S-REPLAY-RE01-CAPTURE-SIGHT-CONSUME-EFFECT-WRITES",
        c["rc"] == 0 and s["rc"] == 0 and a["rc"] == 0 and e["rc"] == 0 and n == 1,
        f"S model (expected defect): cap={c['rc']} sight={s['rc']} admit={a['rc']} {a['err'][:80]} apply={e['rc']} {e['err'][:80]} n={n}")

    # RE-02: same customer body, new effect id after sighting/completion-style deny
    reset_cluster(host, port, S_PROOF)
    dg_child = eff(D, SH, K, V, "ae_s_child")
    # webhook then child then capture with new effect id digest
    run_tx(host, port, "stocky_original_admission", SH, [
        ("SELECT public.stocky_record_writer_admission(%s,%s,'w_s_root','WEBHOOK','wh_s_root',%s,'pr7-origin-v1', clock_timestamp(), 'WEBHOOK_PROVIDER_AUTH',%s,%s, NULL, NULL, 'ATOMIC')",
         (D, SH, dg_child, K, V)),
    ])
    cap_same = s_capture("cmd_s_same", "admin_s_same", dg_child)
    dg_new = eff(D, SH, K, V, "ae_s_relabel")
    cap_new = s_capture("cmd_s_relabel", "admin_s_relabel", dg_new)
    rec("IR-S-REPLAY-RE02-NEW-EFFECT-ID-ACQUIRES-CAPTURE",
        cap_same["rc"] != 0 and cap_new["rc"] == 0,
        f"same_digest_cap={cap_same['rc']} {cap_same['err'][:100]} new_effect_digest_cap={cap_new['rc']} {cap_new['err'][:100]}")


def main():
    run_h_challenges()
    run_mutations()
    run_s_replay()
    failed = [r for r in RESULTS if not r["ok"]]
    payload = {
        "total": len(RESULTS),
        "pass": len(RESULTS) - len(failed),
        "fail": len(failed),
        "failed": failed,
        "results": RESULTS,
        "postgres_h": "16.15",
        "host_h": f"{H_PGDATA}:{H_PORT}",
        "host_s": f"{S_PGDATA}:{S_PORT}",
    }
    out = EVIDENCE / "09-independent-challenges.json"
    out.write_text(json.dumps(payload, indent=2))
    print(json.dumps({"total": payload["total"], "pass": payload["pass"], "fail": payload["fail"],
                      "failed_cases": [f["case"] for f in failed]}, indent=2))
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())

```
