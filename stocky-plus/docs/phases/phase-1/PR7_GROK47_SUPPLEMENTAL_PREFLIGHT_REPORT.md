# PR7 Grok 4.7 supplemental concurrency and liveness preflight

**SUPPLEMENTAL CURSOR/GROK EVIDENCE — NOT CLAUDE REVIEW OR ACCEPTANCE**

This file is supplemental test engineering against frozen planning subject H. It is not an independent-approval verdict, not Claude review, not planning acceptance, and not PR7 implementation.

PR6 is CLOSED on X. Phase 1 is IN PROGRESS. R-176 remains OPEN/P0. R-164 is unchanged. Q-008 remains OPEN. D-054 is the implementation-authority record and D-055 does not exist. PR7 runtime remains NOT AUTHORIZED.

## 1. Identities

| Field | Value |
|---|---|
| Base X / `origin/main` at start | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` |
| X subject | `docs: Phase 1 PR6 A/B/C/D formal repository closeout and control sync (#47)` |
| Read-only test subject H (mandate) | `3cc2045107b54601c6b0e43c8690b7d090074b80` |
| H parent | `e7dd4f42487409f2c5ebd026c7be5b8d70c3764e` |
| Plan git blob at H | `07f86fbf0657fc58ffc2aa99556d402cf09a20a1` |
| Matrix git blob at H | `ad6c610d6da868803bbecdfedd8218af2973146d` |
| Prior subject S | `fd5f7bbdf18fa12d75371686d8969d67fe68a158` |
| Ninth review commit | `22941f177f48ab95343330a05aac29ea1c9a6d4e` (sole parent S) |
| Ninth review blob | `9596e5b92f6b56d6d1871b87103eebdb8bf54d77` |
| Read-only PR49 head E | `d63629077fcf29775c69161372c2cf903cfa62c6` |
| Sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` |
| Publication branch | `evidence/pr7-grok47-preflight-20260921-8426` |
| Platform suffix | `-8426` (required by this cloud-agent run; the requested name was `evidence/pr7-grok47-preflight-20260921`) |
| Coordinator run | `bc-36ad3f03-3cc4-447e-9d44-12207a2b8426` |
| CURRENT `01_contract.sql` sha256 | `d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318` |
| CURRENT `03_run_proofs.py` sha256 | `d24afa331bde236e6ed59243ada670d14b658bd308541b9263df616040c75d85` |
| `02_seed.sql` sha256 | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` |
| `04_discover_writers.py` sha256 | `666feaa8f77359d75f70ffca5bb84bc91fc9d0e0891656f17d195ef92990220d` |
| `04_source_derived.sql` sha256 | `9f7aaa26ecdbdf953b284b0813fb81f2693962c64870d7c2e61ea084c0bf6baa` |
| CURRENT `00_extract_proofs.py` sha256 | `70684794504734faacf651a09a4f996d20215a1da7e99af9b34684fe8d7d8172` |

The published harness sha256 is in `PR7_GROK47_SUPPLEMENTAL_PREFLIGHT_REPRODUCER.md`. Authoring harness sha256 `8b1c889b69c0668e4f687509ea72fecc134024d0d0ab0f7a20d5f0c749e3af92` bytes `78485`. H was not edited. Existing proposals, reviews, and controls were not edited.

## 2. Models and helpers

| Role | What actually ran |
|---|---|
| Coordinator | This cloud-agent run. `originalModelName` recorded by run-info is `grok-4.7`. A separate `grok-4.7-xhigh` route was not confirmed for this run. |
| Helper A | Not a second language-model agent. Isolated OS process on disposable PostgreSQL 16 cluster `/tmp/pr7-grok47-lab-pg16-8426` port `5462`, database `pr7_grok47_a`. |
| Helper B | Not a second language-model agent. Isolated OS process on disposable PostgreSQL 16 cluster `/tmp/pr7-grok47-sem-pg16-8426` port `5463`, database `pr7_grok47_b`. |
| Mutation cluster | Disposable cluster `/tmp/pr7-grok47-mut-pg16-8426` port `5464`, database `pr7_grok47_mut`. Separate from A and B so `DROP ROLE` in the contract load could not collide with another database's owned objects. |

The Task tool was not launched. Spending limits were not raised. No unlimited agents.

Workstreams A and B did not share a database. The coordinator was the only Git writer.

## 3. Assignment check

run-info for this session returned `bcId` `bc-36ad3f03-3cc4-447e-9d44-12207a2b8426`, name `Grok 4.7 supplemental preflight`, status `RUNNING`, `originalModelName` `grok-4.7`, `createdAtMs` `1790032065503`. This run continued that assignment. No second publication branch was created.

## 4. Reading and reported conflicts

Read for this preflight: `AGENTS.md`, `stocky-plus/docs/CI_POLICY.md`, `stocky-plus/docs/PROJECT_STATUS.md` header, `stocky-plus/docs/OPEN_QUESTIONS.md` Q-008, H plan header / §0 / evidence table, H matrix PR7-CUST-078, PR7-CUST-120, and the customer-barrier row, the extracted CURRENT contract and seed, READY comment `5760738230`, handoff comment `5763485875`, and Claude Stage A checkpoint `5760005839` on PR49.

Conflicts are reported here and were not resolved by editing H or `PROJECT_STATUS.md`.

1. **Name H.** The mandate's test subject H is `3cc2045107b54601c6b0e43c8690b7d090074b80`. The plan's identity table uses the letter H for a different, older pin: `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b`. This report uses the mandate SHA.
2. **PR6 status text.** X's commit subject is the formal PR6 closeout. The H plan header says PR6 is CLOSED on X. `stocky-plus/docs/PROJECT_STATUS.md` at X still says formal PR6 repository closure is PENDING in the header (updated 2026-09-19). This preflight follows the mandate: PR6 CLOSED. The status file was not edited.
3. **Ninth review in plan §0.** Plan §0's immutable-review bullet list names eight review files. The ninth blob `9596e5b92f6b56d6d1871b87103eebdb8bf54d77` appears later in the plan evidence table. The ninth review commit exists and was not edited.
4. **Matrix prose versus unique source.** Matrix customer-barrier row says `SourceEffectLink` binds the first effect per work. PR7-CUST-120 says a correlated child with a new effect id on the same source is `effect_digest_mismatch` because the source digest is unique. The executable contract enforces both a work-id unique key and a source-digest unique key. This lab tested the executable unique-source behavior. The prose tension is not classified as a reproduced defect.
5. **505/290/215.** Those counts are the plan's reported CURRENT-contract expectation and the observed result of one driver run in this session. They were not a target forced by changing tests or grants. S's 416/244/172 stays historical and was not re-run.

## 5. Baseline

One declared-model run was executed against the extracted CURRENT package on PostgreSQL 16.15 (`server_version_num` `160015`).

Observed `results.json` at `/tmp/pr7-grok47-h-extract-8426/current/results.json`:

| Field | Observed |
|---|---|
| total | 505 |
| pass | 505 |
| fail | 0 |
| unique_assertions | 290 |
| declared_reruns | 215 |
| host | `/tmp/pr7-grok47-h-pg16-8426:5461` |
| database | `pr45_proof` |

Group unique counts: G1 15, G2 8, G3 10, G4 14, G5 9, G6 3 (G1–G6 unique 59), G7 14, G8 7, G9 9, G10 1, G11 12, G12 10, G13 15, G14 26, G15 29, G16 93, NEG 15.

The driver also loads `04_source_derived.sql`. The supplemental lab does not. Race and semantics cases call the SECURITY DEFINER helpers directly and do not read the writer-inventory snapshot.

Extractor selftest, re-executed in this continuation against the git-archive plan:

- exit 0
- stdout: `extraction_authenticity_limit:coordinated_in_repo_edit_not_prevented` then `extraction_selftest_ok`

External truncated-plan control: the first 2000 bytes of the plan, passed to the same extractor `--selftest`, exited 1 with `extraction_no_blocks`. The plan blob remained `07f86fbf0657fc58ffc2aa99556d402cf09a20a1`.

The selftest inside the published extractor also requires a truncated block and a bad digest to fail before it prints `extraction_selftest_ok`. That internal pair ran as part of the exit-0 selftest.

## 6. Independent expectations

The oracle is a Python UTF-8 LF join. It is not the SQL function body.

- `pr7-source-v1` = sha256 of `pr7-source-v1`, domain, shop, operation, kind, value, source body.
- Sample `pr7-a.myshopify.com` / `shop_a` / `CUSTOMER_WRITE` / `CUSTOMER_REST_ID` / `191167` / `ao02-host-body` = `71e3d9d38a6ae9c7dd86577a323d2254ffb335f8879ddd9282f4095a80fe14f7`.
- `pr7-effect-v1` = sha256 of `pr7-effect-v1`, domain, shop, kind, value, effect id.
- Sample `pr7-a.myshopify.com` / `shop_a` / `CUSTOMER_REST_ID` / `191167` / `ae_pos` = `959bb90441a81889549f265bd75ef5b84a512486b896023cf4f42f50b2566abd`.
- A NULL argument to the STRICT SQL functions yields NULL. An empty body is a real digest. PostgreSQL text cannot contain NUL.
- NFC and NFD are different byte strings. The plan does not state an NFC normalization rule. Different hashes are `contract_ambiguity`, not a defect.
- Overlap evidence requires a lock wait observed in `pg_stat_activity` while both transactions are open. Serial permutations are labeled `serial_not_concurrency_proof`.
- Capture that arrives while a sighting holds the source lock does not become a fresh admin origin.
- A sighting that arrives while capture holds the source lock can commit and contradict the capture.
- Same source digest plus a new effect id is denied. The same effect id retried after commit returns without a second audit row.
- A BEGIN admission is not acked. Effect application requires an ack. Duplicate admission of the same source does not mint a second origin. Recovery with a durable job acks, and then one effect commits.
- Reinstall is not a SQL helper. The tested primitive is `stocky_lifecycle_exclusive_lock`. The fence change is an owner fixture applied only after the waiter is blocked. A capture taken under `gen_a` must not bind after `gen_a` is no longer the unique LIVE generation. A new capture taken after the new LIVE generation may admit.
- Customer-barrier install is not expected to block admin capture, because capture does not take the customer-target lock.
- Removing only the effect freshness recheck, on a disposable copy, must let a sighting-first effect commit. A fresh effect with no sighting must still commit. The original contract file must keep its sha256.

## 7. Predeclared limits

From the published harness `LIMITS`:

| Limit | Value |
|---|---|
| actors per schedule | 3 |
| seeds | 17001, 17002, 17003, 17004, 17005, 17006, 17007, 17008 |
| lock observe window | 2.0 seconds |
| poll | 0.02 seconds |
| holder release timeout | 20 seconds |
| uncertain commit attempts | 6 |
| serial permutations | 6 |
| statement timeout | 20s |
| waiter lock timeout | 8s (400ms only for the lock-timeout case, with a 1.0s hold) |

These limits were not raised to chase a result.

## 8. Sweeps

The published harness is the file embedded in the reproducer. Earlier JSON files are earlier harness bytes. They are not relabeled as the published run.

| Sweep | Harness | Result file in appendix | Counts |
|---|---|---|---|
| 0 A | Holder released as soon as a lock wait was seen. Fence flip and lock timeout raced the release. | `a-sweep0` | 38 cases; 3 labeled `reproduced_defect` at the time; 35 `tested_refuted_hypothesis` |
| 0 B | Semantics workstream. `overlap()` is not used. | `b-sweep0` | 15 cases; 0 defects; 13 `tested_refuted_hypothesis`; 2 `contract_ambiguity` |
| 1 A | Fence flip moved to `before_release`. Lock-timeout hold set to 1.0s. Uncertain-commit parent slept 0.35s and observed commit on all 6 attempts. | `a-sweep1` | 38 cases; 0 `reproduced_defect` |
| 2 A | Same as sweep 1 except uncertain attempts 0/2/4 sleep 0.05s and 1/3/5 sleep 1.2s. Behavior matches the published harness. The published file later dropped one trailing space on a comment. | `a-final` | 38 cases; 0 `reproduced_defect`; 38 `tested_refuted_hypothesis` |
| Mutation | Disposable contract copy on port 5464. | `mutation` | 4 cases; 0 defects; original sha256 unchanged |

Sweep 0's three `reproduced_defect` labels were `RACE-REINSTALL-ADMISSION`, `RACE-LOCK-TIMEOUT-RETRY`, and `MINIMIZE-PENDING`. They are reclassified in this report as `harness_failure`. The JSON files are preserved with their original labels. H was not changed to make them pass.

Sweep 1 is an intermediate harness. Its uncertain window did not sample an abort. Sweep 2 did. Do not treat sweep 1 as the published uncertain-commit result.

## 9. Taxonomy

### Reproduced defect

None on the published harness (sweep 2 A, sweep 0 B, mutation). No suspected product defect remained to minimize on a pristine reload. `MINIMIZE-NONE` was recorded on sweep 2 and on B and on the mutation run.

### Harness or environment failure

Sweep 0 `RACE-REINSTALL-ADMISSION`: the owner fence update slept 0.4s from thread start. The holder released when the lock wait was observed, often before that sleep. The admission committed against still-LIVE `gen_a`. The later flip did not prove a stale read. Classification: `harness_failure`.

Sweep 0 `RACE-LOCK-TIMEOUT-RETRY`: the holder released when the wait was observed, before the 400ms `lock_timeout`. The waiter committed. Classification: `harness_failure`.

Sweep 1 `LOSS-UNCERTAIN-COMMIT`: all 6 attempts observed `committed` because the parent slept 0.35s while the child slept only 0.3s before commit. The abort side was not sampled. Classification: `harness_failure` for that window. The case was retimed in the published harness.

### Tested and refuted hypotheses (published harness)

Sweep 2 A, 38 cases, all `tested_refuted_hypothesis`. Lock waits:

| Case | Wait seen | Outcome used as the expectation |
|---|---|---|
| `RACE-CAP-SIGHT-capture_holds` | yes | capture commits; sighting commits and contradicts |
| `RACE-CAP-SIGHT-sighting_holds` | yes | capture denied; no capture row |
| `RACE-ADMIT-SIGHT-admit_holds` | yes | admission commits; overlapping sighting does not mint a second origin |
| `RACE-ADMIT-SIGHT-sighting_holds` | yes | sighting-first consume denied |
| `RACE-EFFECT-SIGHT-effect_holds` | yes | effect commits; sighting does not unwrite |
| `RACE-EFFECT-SIGHT-sighting_holds` | yes | sighting-first effect denied |
| `RACE-SOURCE-LINK-e1` | yes | parent effect wins the source link |
| `RACE-SOURCE-LINK-e2` | yes | second effect id on the same source denied |
| `RACE-BARRIER-EFFECT-effect_holds` | yes | effect and barrier overlap on the target lock |
| `RACE-BARRIER-EFFECT-barrier_holds` | yes | barrier-first effect denied |
| `RACE-BARRIER-OTHER-SHOP` | recorded in the case detail | shop_b progress while shop_a barrier is held |
| `RACE-BARRIER-CAPTURE` | no | capture commits. Hypothesis "barrier blocks capture" refuted |
| `RACE-BARRIER-COMPLETION` | yes | second completion waits; holder returns `remnants` |
| `RACE-REINSTALL-ADMISSION` | yes | see below |
| `RACE-REINSTALL-REVERSE` | yes | exclusive lifecycle lock waits for a shared holder |
| `RACE-LOCK-TIMEOUT-RETRY` | yes | waiter sqlstate `55P03`; later retry commits one origin |
| `RACE-POISON-CONTEXT` | n/a | runtime capture `42501`; missing session; shop mismatch; stale barrier attempt |
| `SEED-17001` … `SEED-17007` | yes | capture holds |
| `SEED-17008-sighting_holds` | yes | sighting holds; capture denied |
| `SERIAL-*` (6) | n/a | recorded only; not concurrency proof |
| `LOSS-PRECOMMIT-CLIENT-CLOSE` | n/a | uncommitted capture absent; retry creates one |
| `LOSS-PRECOMMIT-BACKEND-TERMINATE` | n/a | `pg_terminate_backend` before commit; retry creates one |
| `LOSS-POSTCOMMIT-PREACK` | n/a | committed row survives client `SIGKILL` before an ack file; retry keeps one capture |
| `LOSS-ACK-PENDING-RECOVERY` | n/a | BEGIN effect denied `customer_admission_not_acked`; duplicate does not mint; recover then one effect |
| `LOSS-UNCERTAIN-COMMIT` | n/a | attempts 0,2,4 aborted; 1,3,5 committed; every retry left one capture |

`RACE-REINSTALL-ADMISSION` on sweep 2: fences observed while the exclusive lock was still held: `gen_a` `UNINSTALLED`, `gen_lab_new` `LIVE`. Waiter sqlstate `P0001`, error `admission_capture_epoch_mismatch`. Positive control after the flip: new capture rc 0 and new admission rc 0. The hypothesis that the admission re-read would keep `gen_a` after the committed flip was refuted.

Seed digests (capture-hold except 17008):

| Seed | Digest |
|---|---|
| 17001 | `3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c` |
| 17002 | `922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978` |
| 17003 | `b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38` |
| 17004 | `4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8` |
| 17005 | `edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432` |
| 17006 | `f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57` |
| 17007 | `868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2` |
| 17008 | `c1ecd1c0373cfb6b5d09f873f6bc5fd7b17419def50ca20390dd5921c4a8d6e0` |

Sweep 0 B, all executed against the same contract hash:

| Case | Classification | Observation |
|---|---|---|
| `SEM-ORACLE-SQL-AGREES` | tested_refuted_hypothesis | SQL source and effect hex match the Python oracle; NULL body returns None |
| `SEM-RENAME-IDS` | tested_refuted_hypothesis | renamed command/work/effect ids keep one capture; second effect id is `effect_digest_mismatch` |
| `SEM-RENAME-SOURCE-IDENTITY` | tested_refuted_hypothesis | renamed source identity is `queued_work_cannot_acquire_fresh_admin_origin` |
| `SEM-SOURCE-CLASSES-AND-CHILD` | tested_refuted_hypothesis | webhook admit succeeds; manual replay without parent is `admission_parent_required`; admin without capture is `admission_admin_capture_required`; child same effect id succeeds; child new effect id is `effect_digest_mismatch` |
| `SEM-EQUAL-AND-SUCCESSOR` | tested_refuted_hypothesis | equal-value retry succeeds; second effect id denied; new body successor succeeds |
| `SEM-TWO-SHOPS` | tested_refuted_hypothesis | same command id and customer value on two shops produce different digests and both commit. shop_a `0c04f5a7b94c2b6f9372512df47ceb82b86a8b7d4eb75166220ce1e83384df8d`; shop_b `d35cc4e2afaf81cbe0a337d9c5b692abb652d56f55c939a9cd2b45656ddbded7` |
| `SEM-EMPTY-NULL-UNICODE` | tested_refuted_hypothesis | empty body is a digest; NULL argument is NULL |
| `SEM-UNICODE-NFC-NFD` | contract_ambiguity | NFC and NFD bodies hash differently. No approved NFC rule was found beyond the positional UTF-8 join |
| `SEM-HISTORICAL-RETRY` | tested_refuted_hypothesis | retry of the committed effect returns; a newer effect id is `effect_digest_mismatch` |
| `SEM-GUC-NOT-CAPABILITY` | tested_refuted_hypothesis | `stocky.trusted_work_id` from shop_b does not apply shop_a work (`effect_tenant_mismatch`); no audit row |
| `SEM-BYPASS-DIRECT-INSERT` | tested_refuted_hypothesis | runtime `INSERT` into `OriginalAdminCapture` is permission denied |
| `SEM-EVIDENCE-EXPIRY` | contract_ambiguity | Q-008 is open. The contract has no evidence TTL. Missing admin capture is denied. No retention period was invented |
| `SEM-CROSS-CLASS-SAME-SOURCE` | tested_refuted_hypothesis | webhook of an already-admitted source digest is `admission_digest_conflict` |
| `FINAL-HASH` | tested_refuted_hypothesis | contract sha256 unchanged |
| `MINIMIZE-NONE` | tested_refuted_hypothesis | no suspected defect |

B was not re-executed after the A timing edits. Those edits do not change `workstream_b`. The clean-export section records whether the published bytes reproduce B.

### Contract ambiguity

- `SEM-UNICODE-NFC-NFD`
- `SEM-EVIDENCE-EXPIRY` (Q-008)
- Matrix "per work" sentence versus unique source digest, reported in §4. The executable unique-source denial was tested and matched PR7-CUST-120.
- `stocky_note_queued_work` does not call `stocky_shop_canonical_domain`. Capture does. A sighting with a shop id that does not match the domain was not executed. Expected behavior for that input is a question, not a defect found by this lab.

### Unexecuted application integration

- Whole-host power loss. The lab killed an owned client process and an owned backend (`pg_terminate_backend`). It did not cut power to the host.
- External I/O still running after the database transaction. No Shopify, Redis, or filesystem publication was in the transaction.
- Live `authenticate.admin` and any store call.
- PR49 GET-before-write / external publication. PostgreSQL overlap does not protect a publication that happens before the database commit. That boundary is not new evidence and was not re-packaged.
- Application reinstall. The fence flip is an owner fixture around `stocky_lifecycle_exclusive_lock`, labeled as such in the case.
- `04_source_derived.sql` writer-inventory load, inside the supplemental lab.

## 10. Minimized counterexamples

No product defect was reproduced on the published harness, so there is no minimized product counterexample.

The sweep 0 failures were minimized by changing the harness schedule, then repeated on a fresh `reset_database` of unchanged H (sweep 2, which reloads contract and seed). Positive controls stayed in the same cases: new capture after the fence flip admits; lock-timeout retry admits one origin; uncertain retries converge to one capture on both the aborted and committed sides.

## 11. Mutation control

`MUT-SINGLE-EFFECT-RECHECK` on database `pr7_grok47_mut`, port 5464:

- The only edit was deletion of the `effect_source_no_longer_fresh` recheck, in a copy at `/tmp/pr7-grok47-mut-contract-8426.sql`.
- Sighting-first effect committed (`effect_rc` 0, one audit). The safety assertion failed on the copy, which is what the control requires.
- Fresh effect with no sighting also committed (`fresh_rc` 0).
- The mutated file was deleted.
- `MUT-HASH-RESTORED`: before and after sha256 of the original contract file were `d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318`.

## 12. Preservation

Before any later teardown of owned clusters, the sweep JSON payloads are embedded in the appendices of this file. The harness, seeds, limits, and commands are in the reproducer. Failures from sweep 0 and the biased uncertain window from sweep 1 are kept.

`git diff` against X for this branch is limited to the two new Markdown paths named in the mandate. Runtime, schema, grants, dependencies, and CI configuration at X are unchanged by this branch.

## 13. Clean-export proof

<!-- CLEAN_EXPORT_SLOT -->
Clean-export against a git commit of these two files has not been executed yet. This section is incomplete until a later commit on this branch records the extracted-harness rerun.
<!-- /CLEAN_EXPORT_SLOT -->

## 14. Documentation CI

<!-- CI_SLOT -->
Exact-head pull-request documentation CI has not been observed yet.
<!-- /CI_SLOT -->

## 15. Owned resources

Disposable clusters owned by this run:

| PGDATA | Port | Role |
|---|---|---|
| `/tmp/pr7-grok47-h-pg16-8426` | 5461 | baseline `pr45_proof` |
| `/tmp/pr7-grok47-lab-pg16-8426` | 5462 | workstream A |
| `/tmp/pr7-grok47-sem-pg16-8426` | 5463 | workstream B |
| `/tmp/pr7-grok47-mut-pg16-8426` | 5464 | mutation copy |

Teardown, when performed, is limited to these PGDATA directories and the `/tmp/pr7-grok47-*-8426` files created by this run. No `FLUSHALL`, no broad `pkill`, and no foreign cluster was stopped.

## 16. What this file does not decide

ChatGPT triages this evidence. Claude's gate on H is still required. This file does not accept the plan, does not close R-176, and does not authorize PR7 runtime, migrations, grants, flags, Shopify writes, or merge.


## Appendix — preserved sweep JSON

These payloads keep original classifications. Sweep 0 defect labels are harness failures as explained in section 9. They are not rewritten inside the JSON.

### a-sweep0

sha256 `26a274b60730ecb82684117ff36bb1150adfcb677ecd933740e685a641b22dc8` bytes `77673`

<!-- GROK47-EVIDENCE:begin name=a-sweep0 -->
{
  "h": "3cc2045107b54601c6b0e43c8690b7d090074b80",
  "contract_sha256": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
  "seed_sha256": "d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632",
  "limits": {
    "actors_per_schedule": 3,
    "seeds": [
      17001,
      17002,
      17003,
      17004,
      17005,
      17006,
      17007,
      17008
    ],
    "lock_observe_seconds": 2.0,
    "poll_seconds": 0.02,
    "holder_release_timeout_seconds": 20,
    "uncertain_attempts": 6,
    "serial_permutations_bound": 6,
    "statement_timeout": "20s",
    "waiter_lock_timeout": "8s"
  },
  "postgres_note": "caller records server version",
  "cases": [
    {
      "id": "RACE-CAP-SIGHT-capture_holds",
      "family": "capture_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "capture committed then sighting contradicted it; wait=True",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "oas_shop_a_2026-09-21_23:20:26.051876+00"
              ]
            ],
            [
              [
                "oac_d34b7713fce5c44c5cb9d19c455b1b98894ff98fdfe423cd242003f882dc48b1"
              ]
            ]
          ],
          "pid": 8818
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8821
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8821,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ],
              [
                8818,
                "stocky_admin_capture",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_admin_capture",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_admin_capture",
                "ExclusiveLock",
                true,
                1347573587,
                2219418073
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                2219418073
              ]
            ],
            "waiting": [
              [
                8821,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_d34b7713fce5c44c5cb9d19c455b1b98894ff98fdfe423cd242003f882dc48b1",
            "cmd_cap_sight_capture_holds",
            "ident_cap_sight_capture_holds",
            "be197170bb1fd79e49f80bd647889258e40d7096582c33fd294448be9fb9e206",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_cap_sight_capture_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-CAP-SIGHT-sighting_holds",
      "family": "capture_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "sighting first blocks fresh capture; waiter_err=queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8831
        },
        "waiter": {
          "rc": 1,
          "err": "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 8834
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8831,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ],
              [
                8834,
                "stocky_admin_capture",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                10980750
              ],
              [
                "stocky_admin_capture",
                "ExclusiveLock",
                false,
                1347573587,
                10980750
              ],
              [
                "stocky_admin_capture",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                8834,
                "stocky_admin_capture",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_cap_sight_sighting_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-ADMIT-SIGHT-admit_holds",
      "family": "consume_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "admitted first; later sighting; effect refused and audit absent",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "wao_work_admit_sight_admit_holds"
              ]
            ]
          ],
          "pid": 8846
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8849
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8849,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ],
              [
                8846,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1932656354,
                345196999
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                3382847741
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                3382847741
              ]
            ],
            "waiting": [
              [
                8849,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_b8385c56ca346e4d86fb928d9288af46d33d0651498aa5d62e364c7821a89552",
            "cmd_admit_sight_admit_holds",
            "ident_admit_sight_admit_holds",
            "1e5b2cce07a4d9c36f32f1525273a1f1e80f86b731a11e3dfb6f520418e9c899",
            true,
            "QUEUED_INBOX",
            "work_admit_sight_admit_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_admit_sight_admit_holds",
            "BOUND",
            true,
            "1e5b2cce07a4d9c36f32f1525273a1f1e80f86b731a11e3dfb6f520418e9c899",
            "oac_b8385c56ca346e4d86fb928d9288af46d33d0651498aa5d62e364c7821a89552",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_admit_sight_admit_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-ADMIT-SIGHT-sighting_holds",
      "family": "consume_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "sighting first; consume refused; origins=0 err=capture_content_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,te",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8865
        },
        "waiter": {
          "rc": 1,
          "err": "capture_content_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text) line 97 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 8868
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8868,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ],
              [
                8865,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                138188087
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                138188087
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1932656354,
                4271544123
              ]
            ],
            "waiting": [
              [
                8868,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_47a1a43582a711afa3051017a8540eff85667ae62d7ea3aa289167c7df15d7bb",
            "cmd_admit_sight_sighting_holds",
            "ident_admit_sight_sighting_holds",
            "3f15f38bac721a1c600bbd95640a4ec0700be6fd4f9952992d5748b9e33f2316",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_admit_sight_sighting_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-EFFECT-SIGHT-effect_holds",
      "family": "admission_sighting_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "effect won; sighting did not unwrite; same-effect retry stayed one row",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8882
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8885
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8882,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                8885,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                1859414033
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                3921204883
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                1859414033
              ]
            ],
            "waiting": [
              [
                8885,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_3ca43fa7635350a1a13899b61569f77db043021d3ea200f10eded2722e48067d",
            "cmd_eff_sight_effect_holds",
            "ident_eff_sight_effect_holds",
            "15246f5d8c26075c65b17cd66cd906f37f3f1ec7535ac9d78587a5cc6afaaf89",
            true,
            "QUEUED_INBOX",
            "work_eff_sight_effect_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_eff_sight_effect_holds",
            "BOUND",
            true,
            "15246f5d8c26075c65b17cd66cd906f37f3f1ec7535ac9d78587a5cc6afaaf89",
            "oac_3ca43fa7635350a1a13899b61569f77db043021d3ea200f10eded2722e48067d",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_eff_sight_effect_holds",
            "work_eff_sight_effect_holds",
            "fffd22bf0140e055148e920c8ba2eb2dc4e3bbb8a5bf7ea172b5f4d5e2eb67f7",
            "15246f5d8c26075c65b17cd66cd906f37f3f1ec7535ac9d78587a5cc6afaaf89"
          ]
        ],
        "audits": [
          [
            "ae_lab_eff_sight_effect_holds",
            "shop_a",
            "c_eff_sight_effect_holds"
          ]
        ],
        "sightings": [
          [
            "sight_eff_sight_effect_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-EFFECT-SIGHT-sighting_holds",
      "family": "admission_sighting_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "sighting won; effect wrote nothing; err=effect_source_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8901
        },
        "waiter": {
          "rc": 1,
          "err": "effect_source_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 8903
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8903,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                8901,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                3558996425
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                25341538
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                false,
                1347573587,
                3558996425
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                8903,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_70fe6ce79633bf2b332c33938657fd9c823f6becce0cd14952e2e180cba7b559",
            "cmd_eff_sight_sighting_holds",
            "ident_eff_sight_sighting_holds",
            "3504c63eed6db023a6addec2c98bd2c6385b3838c53f2c4f89a7ff2d255cbc18",
            true,
            "QUEUED_INBOX",
            "work_eff_sight_sighting_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_eff_sight_sighting_holds",
            "BOUND",
            true,
            "3504c63eed6db023a6addec2c98bd2c6385b3838c53f2c4f89a7ff2d255cbc18",
            "oac_70fe6ce79633bf2b332c33938657fd9c823f6becce0cd14952e2e180cba7b559",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_eff_sight_sighting_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-SOURCE-LINK-e1",
      "family": "source_link_competition",
      "classification": "tested_refuted_hypothesis",
      "detail": "one link one audit; child_rc=0 denied=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 9",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8919
        },
        "waiter": {
          "rc": 1,
          "err": "effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 98 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 8922
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8922,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                8919,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                1425352039
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                663561782
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                false,
                1347573587,
                663561782
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                1425352039
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                8922,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_e075921d96c929c454f3e81ec26a01099409aa271ce8ce35497cf7a2a1e5630c",
            "cmd_link_e1",
            "ident_link_e1",
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744",
            false,
            null,
            "work_link_e1",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_link_e1",
            "BOUND",
            true,
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744",
            "oac_e075921d96c929c454f3e81ec26a01099409aa271ce8ce35497cf7a2a1e5630c",
            "gen_a",
            "shop_a"
          ],
          [
            "work_link_e1_child",
            "BOUND",
            true,
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744",
            null,
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_link_e1_1",
            "work_link_e1",
            "e081a6585bfd7f8522c52e3d88c72977696188007281887cd7f52ee4a89e3aa1",
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744"
          ]
        ],
        "audits": [
          [
            "ae_lab_link_e1_1",
            "shop_a",
            "c_link_e1"
          ]
        ],
        "sightings": [
          [
            "child_link_e1",
            "PARENT_LINEAGE",
            true
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-SOURCE-LINK-e2",
      "family": "source_link_competition",
      "classification": "tested_refuted_hypothesis",
      "detail": "one link one audit; child_rc=0 denied=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 9",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8940
        },
        "waiter": {
          "rc": 1,
          "err": "effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 98 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 8944
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8944,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                8940,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                2093348942
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                2231713478
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                2231713478
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                false,
                1347573587,
                2093348942
              ]
            ],
            "waiting": [
              [
                8944,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_fc90938e4578c7a59740bc90d4262828579bdb344c9b33d1a0f1ea948ea10e7f",
            "cmd_link_e2",
            "ident_link_e2",
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125",
            false,
            null,
            "work_link_e2",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_link_e2",
            "BOUND",
            true,
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125",
            "oac_fc90938e4578c7a59740bc90d4262828579bdb344c9b33d1a0f1ea948ea10e7f",
            "gen_a",
            "shop_a"
          ],
          [
            "work_link_e2_child",
            "BOUND",
            true,
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125",
            null,
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_link_e2_2",
            "work_link_e2_child",
            "3275acf5c42f3ed8b09fa8f210ddcbd07d5d50d66b9150122fa23bccaefd4f6d",
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125"
          ]
        ],
        "audits": [
          [
            "ae_lab_link_e2_2",
            "shop_a",
            "c_link_e2"
          ]
        ],
        "sightings": [
          [
            "child_link_e2",
            "PARENT_LINEAGE",
            true
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-BARRIER-EFFECT-effect_holds",
      "family": "barrier_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "effect committed; later barrier did not remove the audit row",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8959
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8961
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8959,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                8961,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_install_customer_barrier($1,$2)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                2994993137
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                1795976467
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                false,
                1932656354,
                1795976467
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1347573556,
                3952037960
              ],
              [
                "stocky_privacy_erasure",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                8961,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_install_customer_barrier($1,$2)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_0ecd0638a44a21566f6b001cfeef80273230cc742f4f8a3887575a7e0a3b1102",
            "cmd_bar_eff_effect_holds",
            "ident_bar_eff_effect_holds",
            "0dfdde09010a565f81e55fe71600a260feb0f52baf9765647e55b058fbfab7d2",
            false,
            null,
            "work_bar_eff_effect_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_bar_eff_effect_holds",
            "BOUND",
            true,
            "0dfdde09010a565f81e55fe71600a260feb0f52baf9765647e55b058fbfab7d2",
            "oac_0ecd0638a44a21566f6b001cfeef80273230cc742f4f8a3887575a7e0a3b1102",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_bar_eff_effect_holds",
            "work_bar_eff_effect_holds",
            "c65832af860fc4b41904452a98bc9df8e584e85875c0c19dfb4c203393657b76",
            "0dfdde09010a565f81e55fe71600a260feb0f52baf9765647e55b058fbfab7d2"
          ]
        ],
        "audits": [
          [
            "ae_lab_bar_eff_effect_holds",
            "shop_a",
            "191167"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 1
      },
      "other_shop_setup_rc": 0
    },
    {
      "id": "RACE-BARRIER-EFFECT-barrier_holds",
      "family": "barrier_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "barrier won; effect denied; audits=0",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8970
        },
        "waiter": {
          "rc": 1,
          "err": "customer_target_erasing\nCONTEXT:  PL/pgSQL function public.stocky_customer_write_guard(text,text,text,text,text) line 26 at RAISE\nSQL statement \"SELECT public.stocky_customer_write_guard(\n    p_canonical_domain, p_shop_id, p_kind, p_value, p_work_id\n  )\"\nPL/pgSQL function public.stocky_fact_write_guard(text,text,text,text,text) line 4 at PERFORM\nSQL statement \"SELECT public.stocky_fact_write_guard(v_domain, v_shop, v_kind, v_value, v_work)\"\nPL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 72 at PERFORM",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 8972
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                8972,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                8970,
                "stocky_privacy_erasure",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_privacy_install_customer_barrier($1,$2)"
              ]
            ],
            "locks": [
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                377500897
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                1795976467
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1347573556,
                3952037960
              ],
              [
                "stocky_privacy_erasure",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                false,
                1932656354,
                1795976467
              ]
            ],
            "waiting": [
              [
                8972,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_e032e14cbdf5b7c6d8020eed4d7856114b98489d66e0d3eec3ffc3fa06a702d3",
            "cmd_bar_eff_barrier_holds",
            "ident_bar_eff_barrier_holds",
            "5890a5c8cceb5e495b30452baac3b397a3cbf20493fac6418a59f38b581edb65",
            false,
            null,
            "work_bar_eff_barrier_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_bar_eff_barrier_holds",
            "BOUND",
            true,
            "5890a5c8cceb5e495b30452baac3b397a3cbf20493fac6418a59f38b581edb65",
            "oac_e032e14cbdf5b7c6d8020eed4d7856114b98489d66e0d3eec3ffc3fa06a702d3",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 1
      },
      "other_shop_setup_rc": 0
    },
    {
      "id": "RACE-BARRIER-OTHER-SHOP",
      "family": "barrier_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "shop_b wrote during shop_a barrier hold rc=0 err=",
      "schedule": {
        "holder": {
          "rc": 0
        },
        "during": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8993
        }
      },
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_bar_progress",
            "BOUND",
            true,
            "20485f57b953589df39c11f07b03f6c375ff0663ac4316e3e2a3cd46a59a754f",
            "oac_4858164835a6ff54d11e5916076c7e12e8a0b677396940773e5a84cfb1737afe",
            "gen_a",
            "shop_a"
          ],
          [
            "work_bar_progress_b",
            "BOUND",
            true,
            "ade3e760276ae0368a738e3ff393a300351f97baeec5834b76f8dcbc62156a33",
            "oac_696106dd1c1c919d04a61b3410406a204b220dfa978603985069f7a73915b3eb",
            "gen_b",
            "shop_b"
          ]
        ],
        "links": [
          [
            "ae_lab_bar_progress_b",
            "work_bar_progress_b",
            "8aec4418a5c32efc8b1aa07954f461d0b8e749eea354513e2a06335434fdb1c5",
            "ade3e760276ae0368a738e3ff393a300351f97baeec5834b76f8dcbc62156a33"
          ]
        ],
        "audits": [
          [
            "ae_lab_bar_progress_b",
            "shop_b",
            "c_other_b"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 1
      }
    },
    {
      "id": "RACE-BARRIER-CAPTURE",
      "family": "barrier_capture",
      "classification": "tested_refuted_hypothesis",
      "detail": "capture_rc=0 wait=False captures=1",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 8997
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "oas_shop_a_2026-09-21_23:20:26.881564+00"
              ]
            ],
            [
              [
                "oac_da123d09e514f85bdccc96d26056c1e8647ec629ad48dd785765175e4de1cad2"
              ]
            ]
          ],
          "pid": 8999
        },
        "observation": {
          "wait_seen": false,
          "sample": null
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_da123d09e514f85bdccc96d26056c1e8647ec629ad48dd785765175e4de1cad2",
            "cmd_bar_cap",
            "ident_bar_cap",
            "8509c9f867b6c56b99e034db5a75eb4c1b12d0f164e96d16bbc0ae72dcc22de9",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 1
      }
    },
    {
      "id": "RACE-BARRIER-COMPLETION",
      "family": "barrier_completion",
      "classification": "tested_refuted_hypothesis",
      "detail": "second completion waited; holder_rows=[[['remnants']]] waiter_err=",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "remnants"
              ]
            ]
          ],
          "pid": 9005
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "remnants"
              ]
            ]
          ],
          "pid": 9007
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                9007,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_complete_customer_redact($1,$2)"
              ],
              [
                9005,
                "stocky_privacy_erasure",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_privacy_complete_customer_redact($1,$2)"
              ]
            ],
            "locks": [
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                377500897
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                1795976467
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1347573556,
                3952037960
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                false,
                1347573556,
                3952037960
              ]
            ],
            "waiting": [
              [
                9007,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_complete_customer_redact($1,$2)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 1
      }
    },
    {
      "id": "RACE-REINSTALL-ADMISSION",
      "family": "reinstall_admission",
      "classification": "reproduced_defect",
      "detail": "old capture not consumed onto the new LIVE; new capture admitted rc=0 err=",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 9014
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "wao_work_reinstall"
              ]
            ]
          ],
          "pid": 9016
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                9014,
                "stocky_control_plane",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ],
              [
                9016,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ],
            "locks": [
              [
                "stocky_control_plane",
                "ExclusiveLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                false,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                9016,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [
          [
            "oac_0c89e67fd072e31db9996b8a809a167882d36e14b8f0905b3704edb614d7294f",
            "cmd_reinstall_new",
            "ident_reinstall_new",
            "73133f323ca2ed26d1a48fdecc43dd1ef6ca19ee1eb4fc8d68dc17aa93bf4fcf",
            false,
            null,
            "work_reinstall_new",
            "gen_lab_new"
          ],
          [
            "oac_1656b45aa97dd78de18dbf18e598058779b77420984bccfba562c83fc65ca2c7",
            "cmd_reinstall",
            "ident_reinstall",
            "2a5ec443e2bd42c67c42a9c662670204359547eeee94090af940e764e4f27505",
            false,
            null,
            "work_reinstall",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_reinstall",
            "BOUND",
            true,
            "2a5ec443e2bd42c67c42a9c662670204359547eeee94090af940e764e4f27505",
            "oac_1656b45aa97dd78de18dbf18e598058779b77420984bccfba562c83fc65ca2c7",
            "gen_a",
            "shop_a"
          ],
          [
            "work_reinstall_new",
            "BOUND",
            true,
            "73133f323ca2ed26d1a48fdecc43dd1ef6ca19ee1eb4fc8d68dc17aa93bf4fcf",
            "oac_0c89e67fd072e31db9996b8a809a167882d36e14b8f0905b3704edb614d7294f",
            "gen_lab_new",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      },
      "owner_fixture": "fence flip while exclusive lifecycle lock held; not an application reinstall function"
    },
    {
      "id": "RACE-REINSTALL-REVERSE",
      "family": "reinstall_admission",
      "classification": "tested_refuted_hypothesis",
      "detail": "exclusive gate waited for shared holder; wait=True",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 9027
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 9029
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                9027,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_lifecycle_shared_lock($1)"
              ],
              [
                9029,
                "stocky_control_plane",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_control_plane",
                "ExclusiveLock",
                false,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                9029,
                "stocky_control_plane",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_reinstall_rev",
            "BOUND",
            true,
            "826d0ce1d96011d77c23014369253136e81da618c4209af37f59328296951de7",
            "oac_7ad46777de2f5d145f5d01e00a0f7494a2c7aacdd0853d53af5140db5b855ac4",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-LOCK-TIMEOUT-RETRY",
      "family": "timeout_stale_context",
      "classification": "reproduced_defect",
      "detail": "timeout= retry_rc=0 err=",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 9035
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "wao_work_timeout"
              ]
            ]
          ],
          "pid": 9037
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                9035,
                "stocky_control_plane",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ],
              [
                9037,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ],
            "locks": [
              [
                "stocky_control_plane",
                "ExclusiveLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                false,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                9037,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ]
          }
        },
        "harness": "ok"
      },
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_timeout",
            "BOUND",
            true,
            "662eed7ff15eed1c76d85db1f514ca318133d5c56f3b7a30325b2e8b4db54b49",
            "oac_ff16a3cb95a64ba30f937869530476fa59a5c60572bb61c0e3530bcd878d27f7",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-POISON-CONTEXT",
      "family": "timeout_stale_context",
      "classification": "tested_refuted_hypothesis",
      "detail": "runtime_capture=42501 missing=admission_admin_session_required\nCONTEXT:  PL/pgSQL function public.stocky_captu mismatch=admission_session_tenant_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_esta stale=barrier_stale_attempt\nCONTEXT:  PL/pgSQL function public.stocky_privacy_install_",
      "schedule": {
        "denied": {
          "rc": 1,
          "err": "permission denied for function stocky_establish_modeled_admin_session",
          "sqlstate": "42501",
          "rows": [],
          "pid": 9042
        },
        "missing": {
          "rc": 1,
          "err": "admission_admin_session_required\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 20 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 9043
        },
        "mismatch": {
          "rc": 1,
          "err": "admission_session_tenant_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_establish_modeled_admin_session(text,text,text) line 15 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 9044
        },
        "stale": {
          "rc": 1,
          "err": "barrier_stale_attempt\nCONTEXT:  PL/pgSQL function public.stocky_privacy_install_customer_barrier(text,text) line 14 at RAISE",
          "sqlstate": "42501",
          "rows": [],
          "pid": 9045
        }
      },
      "snapshot": null
    },
    {
      "id": "SEED-17001-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17001 arrival=capture_holds digest=3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_fc99a3cfa658cdf1b85af1785db16204b315987d44925902ecf612cfb4c68202",
            "cmd_seed17001",
            "ident_seed17001",
            "3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17001",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17001,
      "digest": "3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c"
    },
    {
      "id": "SEED-17002-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17002 arrival=capture_holds digest=922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_9a825da8983e69977fd964a28652933d5d4edafeff76bbdc2bf3717123e4ac0f",
            "cmd_seed17002",
            "ident_seed17002",
            "922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17002",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17002,
      "digest": "922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978"
    },
    {
      "id": "SEED-17003-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17003 arrival=capture_holds digest=b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_83bb158bd11ea46e8b30ffa9977f50026848031b5f5bfbadbcd662781acbbf32",
            "cmd_seed17003",
            "ident_seed17003",
            "b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17003",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17003,
      "digest": "b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38"
    },
    {
      "id": "SEED-17004-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17004 arrival=capture_holds digest=4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_5e68684cc2da0caf93ea201d9cf429dfbf8e2d8eedcb7b8e23fe36ffa1fb0c40",
            "cmd_seed17004",
            "ident_seed17004",
            "4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17004",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17004,
      "digest": "4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8"
    },
    {
      "id": "SEED-17005-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17005 arrival=capture_holds digest=edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_edfd6eae54c28d89ebfe3196498bf21c7cd9554aa35230b719ae927b4f29876c",
            "cmd_seed17005",
            "ident_seed17005",
            "edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17005",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17005,
      "digest": "edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432"
    },
    {
      "id": "SEED-17006-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17006 arrival=capture_holds digest=f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_80baf02428ea2d8ba7b64a93b299d3da88d2aca2846d1c0168257a240e387d6e",
            "cmd_seed17006",
            "ident_seed17006",
            "f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17006",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17006,
      "digest": "f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57"
    },
    {
      "id": "SEED-17007-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17007 arrival=capture_holds digest=868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_4de24bf88771836325e69bfc9df8cc30d343606928d525d1d8caf9912e0038a1",
            "cmd_seed17007",
            "ident_seed17007",
            "868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17007",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17007,
      "digest": "868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2"
    },
    {
      "id": "SEED-17008-sighting_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17008 arrival=sighting_holds digest=c1ecd1c0373cfb6b5d09f873f6bc5fd7b17419def50ca20390dd5921c4a8d6e0 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 1,
        "waiter_err": "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE"
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17008",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17008,
      "digest": "c1ecd1c0373cfb6b5d09f873f6bc5fd7b17419def50ca20390dd5921c4a8d6e0"
    },
    {
      "id": "SERIAL-capture-sight-admit",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "capture",
          "sight",
          "admit"
        ],
        "rcs": [
          0,
          0,
          1
        ],
        "errs": [
          "",
          "",
          "capture_content_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,te"
        ]
      },
      "snapshot": {
        "captures": [
          [
            "oac_50ebe31a9ca1076524e1b21ef7d884d6b9f6e1e2e47a3e4c7af3b7a5493cfe14",
            "cmd_ser_csa",
            "ident_ser_csa",
            "058c5dd14f106684cd5efefaaf9bb1a764528008b740c8d6ae2c3a5596981fbc",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_csa",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-capture-admit-sight",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "capture",
          "admit",
          "sight"
        ],
        "rcs": [
          0,
          0,
          0
        ],
        "errs": [
          "",
          "",
          ""
        ]
      },
      "snapshot": {
        "captures": [
          [
            "oac_2ee829b43dc68de10f77131a11a0e97370262deaf3a41a071b20739b4972e7c8",
            "cmd_ser_cas",
            "ident_ser_cas",
            "a8488b21cca2bc304efca12ed2c5affbcb618df396327b1db278cb5322bf1d2c",
            true,
            "QUEUED_INBOX",
            "work_ser_cas",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_ser_cas",
            "BOUND",
            true,
            "a8488b21cca2bc304efca12ed2c5affbcb618df396327b1db278cb5322bf1d2c",
            "oac_2ee829b43dc68de10f77131a11a0e97370262deaf3a41a071b20739b4972e7c8",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_cas",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-sight-capture-admit",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "sight",
          "capture",
          "admit"
        ],
        "rcs": [
          0,
          1,
          1
        ],
        "errs": [
          "",
          "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(t",
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t"
        ]
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_sca",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-sight-admit-capture",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "sight",
          "admit",
          "capture"
        ],
        "rcs": [
          0,
          1,
          1
        ],
        "errs": [
          "",
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t",
          "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(t"
        ]
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_sac",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-admit-capture-sight",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "admit",
          "capture",
          "sight"
        ],
        "rcs": [
          1,
          0,
          0
        ],
        "errs": [
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t",
          "",
          ""
        ]
      },
      "snapshot": {
        "captures": [
          [
            "oac_aa5aa7241064df37c4f70d8251f272ab54672c49847c246bbc8ebc8d27632154",
            "cmd_ser_acs",
            "ident_ser_acs",
            "6849614e283e4df28e28a266f4c94211f7fc41e083d4b64e67eb50e1a97d446a",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_acs",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-admit-sight-capture",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "admit",
          "sight",
          "capture"
        ],
        "rcs": [
          1,
          0,
          1
        ],
        "errs": [
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t",
          "",
          "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(t"
        ]
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_asc",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-PRECOMMIT-CLIENT-CLOSE",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "uncommitted capture absent; retry created one",
      "schedule": {
        "retry_rc": 0
      },
      "snapshot": {
        "captures": [
          [
            "oac_41df7f35008c6eb4d577e48de0fc70d9aa6509cc68c7584e1b8976bc887c0e3b",
            "cmd_loss_pre",
            "ident_loss_pre",
            "b4f5b9558add0e2275bb9d2f113745d941ceab7193b246afa1d65528e6c8149c",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-PRECOMMIT-BACKEND-TERMINATE",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "terminated pid=9139 captures_after=0",
      "schedule": {
        "pid": 9139,
        "err": "terminating connection due to administrator command"
      },
      "snapshot": {
        "captures": [
          [
            "oac_97e5c5d4af6a99f6f866f0e6e8fb74fca16dc143b5788435d8cea506aa0e29e7",
            "cmd_loss_backend",
            "ident_loss_backend",
            "c051048d9230049bda7b00368ab56a9f66c7acab2cc8ba6858569b1b4b08677d",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-POSTCOMMIT-PREACK",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "row survived client SIGKILL before ack file; retry kept one capture; ack_written=False",
      "schedule": {
        "child_pid": 9147
      },
      "snapshot": {
        "captures": [
          [
            "oac_6d3e4e8d3dc67e1c5f6f15bd846e9f16acdb30784bd4148285408330ed59f204",
            "cmd_loss_post",
            "ident_loss_post",
            "521929e879e3029d0bd0a7c439d0b4252f6356cb344f55556c7f232c27c3376c",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-ACK-PENDING-RECOVERY",
      "family": "duplicate_recovery_lost_ack",
      "classification": "tested_refuted_hypothesis",
      "detail": "pending effect denied; duplicate did not mint; recover then one effect. origins_before=1 effect_err=customer_admission_not_acked\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,t",
      "schedule": {
        "pending": 0,
        "dup": 0,
        "recover": 0,
        "effect2": 0
      },
      "snapshot": {
        "captures": [
          [
            "oac_c845bc8bcc6bec9572e8c3955c7c9d70933ccffdb84d5e0ee46bd3c9a8185553",
            "cmd_loss_ack",
            "ident_loss_ack",
            "6a2961151fef0b81cdac40e5766d436a406afaf5e6b29cf2aa675712b32f43d3",
            false,
            null,
            "work_loss_ack",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_loss_ack",
            "BOUND",
            true,
            "6a2961151fef0b81cdac40e5766d436a406afaf5e6b29cf2aa675712b32f43d3",
            "oac_c845bc8bcc6bec9572e8c3955c7c9d70933ccffdb84d5e0ee46bd3c9a8185553",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_loss_ack",
            "work_loss_ack",
            "0199882321c9dd3908eebf05af9ec26faa0f576852806ce9b247478762cb5dba",
            "6a2961151fef0b81cdac40e5766d436a406afaf5e6b29cf2aa675712b32f43d3"
          ]
        ],
        "audits": [
          [
            "ae_lab_loss_ack",
            "shop_a",
            "c_loss_ack"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-UNCERTAIN-COMMIT",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "bounded terminate-during-commit; retry converged to one capture whether the original commit landed",
      "schedule": {
        "attempts": [
          {
            "n": 0,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 9165
          },
          {
            "n": 1,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 9172
          },
          {
            "n": 2,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 9179
          },
          {
            "n": 3,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 9205
          },
          {
            "n": 4,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 9212
          },
          {
            "n": 5,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 9220
          }
        ]
      },
      "snapshot": null,
      "power_loss": "unexecuted_application_integration",
      "external_io": "unexecuted_application_integration"
    },
    {
      "id": "FINAL-HASH",
      "family": "preservation",
      "classification": "tested_refuted_hypothesis",
      "detail": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
      "schedule": {},
      "snapshot": null
    },
    {
      "id": "MINIMIZE-PENDING",
      "family": "minimization",
      "classification": "reproduced_defect",
      "detail": "2 suspected defect(s) recorded for pristine rerun: RACE-REINSTALL-ADMISSION, RACE-LOCK-TIMEOUT-RETRY",
      "schedule": {
        "ids": [
          "RACE-REINSTALL-ADMISSION",
          "RACE-LOCK-TIMEOUT-RETRY"
        ]
      },
      "snapshot": null
    }
  ],
  "counts": {
    "cases": 38,
    "reproduced_defect": 3,
    "tested_refuted_hypothesis": 35,
    "harness_failure": 0,
    "contract_ambiguity": 0,
    "unexecuted_application_integration": 0
  }
}
<!-- GROK47-EVIDENCE:end name=a-sweep0 -->

### a-sweep1

sha256 `5a3f3c802214b87154a2fe1373756355978e4b906870ee66d7e365a2575fdb0d` bytes `78972`

<!-- GROK47-EVIDENCE:begin name=a-sweep1 -->
{
  "h": "3cc2045107b54601c6b0e43c8690b7d090074b80",
  "contract_sha256": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
  "seed_sha256": "d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632",
  "limits": {
    "actors_per_schedule": 3,
    "seeds": [
      17001,
      17002,
      17003,
      17004,
      17005,
      17006,
      17007,
      17008
    ],
    "lock_observe_seconds": 2.0,
    "poll_seconds": 0.02,
    "holder_release_timeout_seconds": 20,
    "uncertain_attempts": 6,
    "serial_permutations_bound": 6,
    "statement_timeout": "20s",
    "waiter_lock_timeout": "8s"
  },
  "postgres_note": "caller records server version",
  "cases": [
    {
      "id": "RACE-CAP-SIGHT-capture_holds",
      "family": "capture_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "capture committed then sighting contradicted it; wait=True",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "oas_shop_a_2026-09-21_23:24:50.867667+00"
              ]
            ],
            [
              [
                "oac_d34b7713fce5c44c5cb9d19c455b1b98894ff98fdfe423cd242003f882dc48b1"
              ]
            ]
          ],
          "pid": 10014
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10017
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10017,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ],
              [
                10014,
                "stocky_admin_capture",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_admin_capture",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_admin_capture",
                "ExclusiveLock",
                true,
                1347573587,
                2219418073
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                2219418073
              ]
            ],
            "waiting": [
              [
                10017,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_d34b7713fce5c44c5cb9d19c455b1b98894ff98fdfe423cd242003f882dc48b1",
            "cmd_cap_sight_capture_holds",
            "ident_cap_sight_capture_holds",
            "be197170bb1fd79e49f80bd647889258e40d7096582c33fd294448be9fb9e206",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_cap_sight_capture_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-CAP-SIGHT-sighting_holds",
      "family": "capture_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "sighting first blocks fresh capture; waiter_err=queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10022
        },
        "waiter": {
          "rc": 1,
          "err": "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10024
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10022,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ],
              [
                10024,
                "stocky_admin_capture",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                10980750
              ],
              [
                "stocky_admin_capture",
                "ExclusiveLock",
                false,
                1347573587,
                10980750
              ],
              [
                "stocky_admin_capture",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10024,
                "stocky_admin_capture",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_cap_sight_sighting_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-ADMIT-SIGHT-admit_holds",
      "family": "consume_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "admitted first; later sighting; effect refused and audit absent",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "wao_work_admit_sight_admit_holds"
              ]
            ]
          ],
          "pid": 10030
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10032
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10032,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ],
              [
                10030,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1932656354,
                345196999
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                3382847741
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                3382847741
              ]
            ],
            "waiting": [
              [
                10032,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_b8385c56ca346e4d86fb928d9288af46d33d0651498aa5d62e364c7821a89552",
            "cmd_admit_sight_admit_holds",
            "ident_admit_sight_admit_holds",
            "1e5b2cce07a4d9c36f32f1525273a1f1e80f86b731a11e3dfb6f520418e9c899",
            true,
            "QUEUED_INBOX",
            "work_admit_sight_admit_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_admit_sight_admit_holds",
            "BOUND",
            true,
            "1e5b2cce07a4d9c36f32f1525273a1f1e80f86b731a11e3dfb6f520418e9c899",
            "oac_b8385c56ca346e4d86fb928d9288af46d33d0651498aa5d62e364c7821a89552",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_admit_sight_admit_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-ADMIT-SIGHT-sighting_holds",
      "family": "consume_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "sighting first; consume refused; origins=0 err=capture_content_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,te",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10040
        },
        "waiter": {
          "rc": 1,
          "err": "capture_content_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text) line 97 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10042
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10042,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ],
              [
                10040,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                138188087
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                138188087
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1932656354,
                4271544123
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10042,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_47a1a43582a711afa3051017a8540eff85667ae62d7ea3aa289167c7df15d7bb",
            "cmd_admit_sight_sighting_holds",
            "ident_admit_sight_sighting_holds",
            "3f15f38bac721a1c600bbd95640a4ec0700be6fd4f9952992d5748b9e33f2316",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_admit_sight_sighting_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-EFFECT-SIGHT-effect_holds",
      "family": "admission_sighting_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "effect won; sighting did not unwrite; same-effect retry stayed one row",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10049
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10051
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10049,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10051,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                3921204883
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                1859414033
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                1859414033
              ]
            ],
            "waiting": [
              [
                10051,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_3ca43fa7635350a1a13899b61569f77db043021d3ea200f10eded2722e48067d",
            "cmd_eff_sight_effect_holds",
            "ident_eff_sight_effect_holds",
            "15246f5d8c26075c65b17cd66cd906f37f3f1ec7535ac9d78587a5cc6afaaf89",
            true,
            "QUEUED_INBOX",
            "work_eff_sight_effect_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_eff_sight_effect_holds",
            "BOUND",
            true,
            "15246f5d8c26075c65b17cd66cd906f37f3f1ec7535ac9d78587a5cc6afaaf89",
            "oac_3ca43fa7635350a1a13899b61569f77db043021d3ea200f10eded2722e48067d",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_eff_sight_effect_holds",
            "work_eff_sight_effect_holds",
            "fffd22bf0140e055148e920c8ba2eb2dc4e3bbb8a5bf7ea172b5f4d5e2eb67f7",
            "15246f5d8c26075c65b17cd66cd906f37f3f1ec7535ac9d78587a5cc6afaaf89"
          ]
        ],
        "audits": [
          [
            "ae_lab_eff_sight_effect_holds",
            "shop_a",
            "c_eff_sight_effect_holds"
          ]
        ],
        "sightings": [
          [
            "sight_eff_sight_effect_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-EFFECT-SIGHT-sighting_holds",
      "family": "admission_sighting_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "sighting won; effect wrote nothing; err=effect_source_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10060
        },
        "waiter": {
          "rc": 1,
          "err": "effect_source_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10062
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10062,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10060,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                3558996425
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                25341538
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                false,
                1347573587,
                3558996425
              ]
            ],
            "waiting": [
              [
                10062,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_70fe6ce79633bf2b332c33938657fd9c823f6becce0cd14952e2e180cba7b559",
            "cmd_eff_sight_sighting_holds",
            "ident_eff_sight_sighting_holds",
            "3504c63eed6db023a6addec2c98bd2c6385b3838c53f2c4f89a7ff2d255cbc18",
            true,
            "QUEUED_INBOX",
            "work_eff_sight_sighting_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_eff_sight_sighting_holds",
            "BOUND",
            true,
            "3504c63eed6db023a6addec2c98bd2c6385b3838c53f2c4f89a7ff2d255cbc18",
            "oac_70fe6ce79633bf2b332c33938657fd9c823f6becce0cd14952e2e180cba7b559",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_eff_sight_sighting_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-SOURCE-LINK-e1",
      "family": "source_link_competition",
      "classification": "tested_refuted_hypothesis",
      "detail": "one link one audit; child_rc=0 denied=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 9",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10070
        },
        "waiter": {
          "rc": 1,
          "err": "effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 98 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10072
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10072,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10070,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                663561782
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                1425352039
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                1425352039
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                false,
                1347573587,
                663561782
              ]
            ],
            "waiting": [
              [
                10072,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_e075921d96c929c454f3e81ec26a01099409aa271ce8ce35497cf7a2a1e5630c",
            "cmd_link_e1",
            "ident_link_e1",
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744",
            false,
            null,
            "work_link_e1",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_link_e1",
            "BOUND",
            true,
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744",
            "oac_e075921d96c929c454f3e81ec26a01099409aa271ce8ce35497cf7a2a1e5630c",
            "gen_a",
            "shop_a"
          ],
          [
            "work_link_e1_child",
            "BOUND",
            true,
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744",
            null,
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_link_e1_1",
            "work_link_e1",
            "e081a6585bfd7f8522c52e3d88c72977696188007281887cd7f52ee4a89e3aa1",
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744"
          ]
        ],
        "audits": [
          [
            "ae_lab_link_e1_1",
            "shop_a",
            "c_link_e1"
          ]
        ],
        "sightings": [
          [
            "child_link_e1",
            "PARENT_LINEAGE",
            true
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-SOURCE-LINK-e2",
      "family": "source_link_competition",
      "classification": "tested_refuted_hypothesis",
      "detail": "one link one audit; child_rc=0 denied=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 9",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10080
        },
        "waiter": {
          "rc": 1,
          "err": "effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 98 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10082
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10082,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10080,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                2093348942
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                2231713478
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                false,
                1347573587,
                2093348942
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                2231713478
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10082,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_fc90938e4578c7a59740bc90d4262828579bdb344c9b33d1a0f1ea948ea10e7f",
            "cmd_link_e2",
            "ident_link_e2",
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125",
            false,
            null,
            "work_link_e2",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_link_e2",
            "BOUND",
            true,
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125",
            "oac_fc90938e4578c7a59740bc90d4262828579bdb344c9b33d1a0f1ea948ea10e7f",
            "gen_a",
            "shop_a"
          ],
          [
            "work_link_e2_child",
            "BOUND",
            true,
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125",
            null,
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_link_e2_2",
            "work_link_e2_child",
            "3275acf5c42f3ed8b09fa8f210ddcbd07d5d50d66b9150122fa23bccaefd4f6d",
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125"
          ]
        ],
        "audits": [
          [
            "ae_lab_link_e2_2",
            "shop_a",
            "c_link_e2"
          ]
        ],
        "sightings": [
          [
            "child_link_e2",
            "PARENT_LINEAGE",
            true
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-BARRIER-EFFECT-effect_holds",
      "family": "barrier_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "effect committed; later barrier did not remove the audit row",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10091
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10093
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10091,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10093,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_install_customer_barrier($1,$2)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                2994993137
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                1795976467
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1347573556,
                3952037960
              ],
              [
                "stocky_privacy_erasure",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                false,
                1932656354,
                1795976467
              ]
            ],
            "waiting": [
              [
                10093,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_install_customer_barrier($1,$2)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_0ecd0638a44a21566f6b001cfeef80273230cc742f4f8a3887575a7e0a3b1102",
            "cmd_bar_eff_effect_holds",
            "ident_bar_eff_effect_holds",
            "0dfdde09010a565f81e55fe71600a260feb0f52baf9765647e55b058fbfab7d2",
            false,
            null,
            "work_bar_eff_effect_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_bar_eff_effect_holds",
            "BOUND",
            true,
            "0dfdde09010a565f81e55fe71600a260feb0f52baf9765647e55b058fbfab7d2",
            "oac_0ecd0638a44a21566f6b001cfeef80273230cc742f4f8a3887575a7e0a3b1102",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_bar_eff_effect_holds",
            "work_bar_eff_effect_holds",
            "c65832af860fc4b41904452a98bc9df8e584e85875c0c19dfb4c203393657b76",
            "0dfdde09010a565f81e55fe71600a260feb0f52baf9765647e55b058fbfab7d2"
          ]
        ],
        "audits": [
          [
            "ae_lab_bar_eff_effect_holds",
            "shop_a",
            "191167"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 1
      },
      "other_shop_setup_rc": 0
    },
    {
      "id": "RACE-BARRIER-EFFECT-barrier_holds",
      "family": "barrier_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "barrier won; effect denied; audits=0",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10102
        },
        "waiter": {
          "rc": 1,
          "err": "customer_target_erasing\nCONTEXT:  PL/pgSQL function public.stocky_customer_write_guard(text,text,text,text,text) line 26 at RAISE\nSQL statement \"SELECT public.stocky_customer_write_guard(\n    p_canonical_domain, p_shop_id, p_kind, p_value, p_work_id\n  )\"\nPL/pgSQL function public.stocky_fact_write_guard(text,text,text,text,text) line 4 at PERFORM\nSQL statement \"SELECT public.stocky_fact_write_guard(v_domain, v_shop, v_kind, v_value, v_work)\"\nPL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 72 at PERFORM",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10104
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10104,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10102,
                "stocky_privacy_erasure",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_privacy_install_customer_barrier($1,$2)"
              ]
            ],
            "locks": [
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1347573556,
                3952037960
              ],
              [
                "stocky_privacy_erasure",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                377500897
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                1795976467
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                false,
                1932656354,
                1795976467
              ]
            ],
            "waiting": [
              [
                10104,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_e032e14cbdf5b7c6d8020eed4d7856114b98489d66e0d3eec3ffc3fa06a702d3",
            "cmd_bar_eff_barrier_holds",
            "ident_bar_eff_barrier_holds",
            "5890a5c8cceb5e495b30452baac3b397a3cbf20493fac6418a59f38b581edb65",
            false,
            null,
            "work_bar_eff_barrier_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_bar_eff_barrier_holds",
            "BOUND",
            true,
            "5890a5c8cceb5e495b30452baac3b397a3cbf20493fac6418a59f38b581edb65",
            "oac_e032e14cbdf5b7c6d8020eed4d7856114b98489d66e0d3eec3ffc3fa06a702d3",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 1
      },
      "other_shop_setup_rc": 0
    },
    {
      "id": "RACE-BARRIER-OTHER-SHOP",
      "family": "barrier_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "shop_b wrote during shop_a barrier hold rc=0 err=",
      "schedule": {
        "holder": {
          "rc": 0
        },
        "during": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10125
        }
      },
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_bar_progress",
            "BOUND",
            true,
            "20485f57b953589df39c11f07b03f6c375ff0663ac4316e3e2a3cd46a59a754f",
            "oac_4858164835a6ff54d11e5916076c7e12e8a0b677396940773e5a84cfb1737afe",
            "gen_a",
            "shop_a"
          ],
          [
            "work_bar_progress_b",
            "BOUND",
            true,
            "ade3e760276ae0368a738e3ff393a300351f97baeec5834b76f8dcbc62156a33",
            "oac_696106dd1c1c919d04a61b3410406a204b220dfa978603985069f7a73915b3eb",
            "gen_b",
            "shop_b"
          ]
        ],
        "links": [
          [
            "ae_lab_bar_progress_b",
            "work_bar_progress_b",
            "8aec4418a5c32efc8b1aa07954f461d0b8e749eea354513e2a06335434fdb1c5",
            "ade3e760276ae0368a738e3ff393a300351f97baeec5834b76f8dcbc62156a33"
          ]
        ],
        "audits": [
          [
            "ae_lab_bar_progress_b",
            "shop_b",
            "c_other_b"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 1
      }
    },
    {
      "id": "RACE-BARRIER-CAPTURE",
      "family": "barrier_capture",
      "classification": "tested_refuted_hypothesis",
      "detail": "capture_rc=0 wait=False captures=1",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10129
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "oas_shop_a_2026-09-21_23:24:51.613239+00"
              ]
            ],
            [
              [
                "oac_da123d09e514f85bdccc96d26056c1e8647ec629ad48dd785765175e4de1cad2"
              ]
            ]
          ],
          "pid": 10131
        },
        "observation": {
          "wait_seen": false,
          "sample": null
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_da123d09e514f85bdccc96d26056c1e8647ec629ad48dd785765175e4de1cad2",
            "cmd_bar_cap",
            "ident_bar_cap",
            "8509c9f867b6c56b99e034db5a75eb4c1b12d0f164e96d16bbc0ae72dcc22de9",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 1
      }
    },
    {
      "id": "RACE-BARRIER-COMPLETION",
      "family": "barrier_completion",
      "classification": "tested_refuted_hypothesis",
      "detail": "second completion waited; holder_rows=[[['remnants']]] waiter_err=",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "remnants"
              ]
            ]
          ],
          "pid": 10139
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "remnants"
              ]
            ]
          ],
          "pid": 10141
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10141,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_complete_customer_redact($1,$2)"
              ],
              [
                10139,
                "stocky_privacy_erasure",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_privacy_complete_customer_redact($1,$2)"
              ]
            ],
            "locks": [
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1347573556,
                3952037960
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                377500897
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                1795976467
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                false,
                1347573556,
                3952037960
              ]
            ],
            "waiting": [
              [
                10141,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_complete_customer_redact($1,$2)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 1
      }
    },
    {
      "id": "RACE-REINSTALL-ADMISSION",
      "family": "reinstall_admission",
      "classification": "tested_refuted_hypothesis",
      "detail": "old capture not consumed onto the new LIVE; new capture admitted rc=0 err=admission_capture_epoch_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,t",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10147
        },
        "waiter": {
          "rc": 1,
          "err": "admission_capture_epoch_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text) line 134 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10149
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10147,
                "stocky_control_plane",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ],
              [
                10149,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ],
            "locks": [
              [
                "stocky_control_plane",
                "ExclusiveLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                false,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10149,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_0c89e67fd072e31db9996b8a809a167882d36e14b8f0905b3704edb614d7294f",
            "cmd_reinstall_new",
            "ident_reinstall_new",
            "73133f323ca2ed26d1a48fdecc43dd1ef6ca19ee1eb4fc8d68dc17aa93bf4fcf",
            false,
            null,
            "work_reinstall_new",
            "gen_lab_new"
          ],
          [
            "oac_1656b45aa97dd78de18dbf18e598058779b77420984bccfba562c83fc65ca2c7",
            "cmd_reinstall",
            "ident_reinstall",
            "2a5ec443e2bd42c67c42a9c662670204359547eeee94090af940e764e4f27505",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_reinstall_new",
            "BOUND",
            true,
            "73133f323ca2ed26d1a48fdecc43dd1ef6ca19ee1eb4fc8d68dc17aa93bf4fcf",
            "oac_0c89e67fd072e31db9996b8a809a167882d36e14b8f0905b3704edb614d7294f",
            "gen_lab_new",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      },
      "owner_fixture": "fence flip while exclusive lifecycle lock held; not an application reinstall function",
      "fences_while_held": [
        [
          "gen_a",
          "UNINSTALLED"
        ],
        [
          "gen_lab_new",
          "LIVE"
        ]
      ],
      "positive_control": {
        "new_capture_rc": 0,
        "new_admit_rc": 0
      }
    },
    {
      "id": "RACE-REINSTALL-REVERSE",
      "family": "reinstall_admission",
      "classification": "tested_refuted_hypothesis",
      "detail": "exclusive gate waited for shared holder; wait=True",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10161
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10163
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10161,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_lifecycle_shared_lock($1)"
              ],
              [
                10163,
                "stocky_control_plane",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_control_plane",
                "ExclusiveLock",
                false,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10163,
                "stocky_control_plane",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_reinstall_rev",
            "BOUND",
            true,
            "826d0ce1d96011d77c23014369253136e81da618c4209af37f59328296951de7",
            "oac_7ad46777de2f5d145f5d01e00a0f7494a2c7aacdd0853d53af5140db5b855ac4",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-LOCK-TIMEOUT-RETRY",
      "family": "timeout_stale_context",
      "classification": "tested_refuted_hypothesis",
      "detail": "timeout=55P03 retry_rc=0 err=canceling statement due to lock timeout\nCONTEXT:  SQL statement \"SELECT pg_advisory_xact_lock_shared(1347573553, public.stocky_lifecycle_lock_key(p_canonical_do",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10169
        },
        "waiter": {
          "rc": 1,
          "err": "canceling statement due to lock timeout\nCONTEXT:  SQL statement \"SELECT pg_advisory_xact_lock_shared(1347573553, public.stocky_lifecycle_lock_key(p_canonical_domain))\"\nPL/pgSQL function public.stocky_lifecycle_shared_lock(text) line 3 at PERFORM\nSQL statement \"SELECT public.stocky_lifecycle_shared_lock(v_domain)\"\nPL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text) line 30 at PERFORM",
          "sqlstate": "55P03",
          "rows": [],
          "pid": 10171
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10169,
                "stocky_control_plane",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ],
              [
                10171,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ],
            "locks": [
              [
                "stocky_control_plane",
                "ExclusiveLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                false,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10171,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_timeout",
            "BOUND",
            true,
            "662eed7ff15eed1c76d85db1f514ca318133d5c56f3b7a30325b2e8b4db54b49",
            "oac_ff16a3cb95a64ba30f937869530476fa59a5c60572bb61c0e3530bcd878d27f7",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-POISON-CONTEXT",
      "family": "timeout_stale_context",
      "classification": "tested_refuted_hypothesis",
      "detail": "runtime_capture=42501 missing=admission_admin_session_required\nCONTEXT:  PL/pgSQL function public.stocky_captu mismatch=admission_session_tenant_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_esta stale=barrier_stale_attempt\nCONTEXT:  PL/pgSQL function public.stocky_privacy_install_",
      "schedule": {
        "denied": {
          "rc": 1,
          "err": "permission denied for function stocky_establish_modeled_admin_session",
          "sqlstate": "42501",
          "rows": [],
          "pid": 10176
        },
        "missing": {
          "rc": 1,
          "err": "admission_admin_session_required\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 20 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10177
        },
        "mismatch": {
          "rc": 1,
          "err": "admission_session_tenant_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_establish_modeled_admin_session(text,text,text) line 15 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10178
        },
        "stale": {
          "rc": 1,
          "err": "barrier_stale_attempt\nCONTEXT:  PL/pgSQL function public.stocky_privacy_install_customer_barrier(text,text) line 14 at RAISE",
          "sqlstate": "42501",
          "rows": [],
          "pid": 10179
        }
      },
      "snapshot": null
    },
    {
      "id": "SEED-17001-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17001 arrival=capture_holds digest=3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_fc99a3cfa658cdf1b85af1785db16204b315987d44925902ecf612cfb4c68202",
            "cmd_seed17001",
            "ident_seed17001",
            "3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17001",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17001,
      "digest": "3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c"
    },
    {
      "id": "SEED-17002-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17002 arrival=capture_holds digest=922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_9a825da8983e69977fd964a28652933d5d4edafeff76bbdc2bf3717123e4ac0f",
            "cmd_seed17002",
            "ident_seed17002",
            "922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17002",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17002,
      "digest": "922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978"
    },
    {
      "id": "SEED-17003-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17003 arrival=capture_holds digest=b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_83bb158bd11ea46e8b30ffa9977f50026848031b5f5bfbadbcd662781acbbf32",
            "cmd_seed17003",
            "ident_seed17003",
            "b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17003",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17003,
      "digest": "b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38"
    },
    {
      "id": "SEED-17004-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17004 arrival=capture_holds digest=4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_5e68684cc2da0caf93ea201d9cf429dfbf8e2d8eedcb7b8e23fe36ffa1fb0c40",
            "cmd_seed17004",
            "ident_seed17004",
            "4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17004",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17004,
      "digest": "4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8"
    },
    {
      "id": "SEED-17005-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17005 arrival=capture_holds digest=edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_edfd6eae54c28d89ebfe3196498bf21c7cd9554aa35230b719ae927b4f29876c",
            "cmd_seed17005",
            "ident_seed17005",
            "edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17005",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17005,
      "digest": "edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432"
    },
    {
      "id": "SEED-17006-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17006 arrival=capture_holds digest=f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_80baf02428ea2d8ba7b64a93b299d3da88d2aca2846d1c0168257a240e387d6e",
            "cmd_seed17006",
            "ident_seed17006",
            "f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17006",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17006,
      "digest": "f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57"
    },
    {
      "id": "SEED-17007-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17007 arrival=capture_holds digest=868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_4de24bf88771836325e69bfc9df8cc30d343606928d525d1d8caf9912e0038a1",
            "cmd_seed17007",
            "ident_seed17007",
            "868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17007",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17007,
      "digest": "868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2"
    },
    {
      "id": "SEED-17008-sighting_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17008 arrival=sighting_holds digest=c1ecd1c0373cfb6b5d09f873f6bc5fd7b17419def50ca20390dd5921c4a8d6e0 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 1,
        "waiter_err": "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE"
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17008",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17008,
      "digest": "c1ecd1c0373cfb6b5d09f873f6bc5fd7b17419def50ca20390dd5921c4a8d6e0"
    },
    {
      "id": "SERIAL-capture-sight-admit",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "capture",
          "sight",
          "admit"
        ],
        "rcs": [
          0,
          0,
          1
        ],
        "errs": [
          "",
          "",
          "capture_content_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,te"
        ]
      },
      "snapshot": {
        "captures": [
          [
            "oac_50ebe31a9ca1076524e1b21ef7d884d6b9f6e1e2e47a3e4c7af3b7a5493cfe14",
            "cmd_ser_csa",
            "ident_ser_csa",
            "058c5dd14f106684cd5efefaaf9bb1a764528008b740c8d6ae2c3a5596981fbc",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_csa",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-capture-admit-sight",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "capture",
          "admit",
          "sight"
        ],
        "rcs": [
          0,
          0,
          0
        ],
        "errs": [
          "",
          "",
          ""
        ]
      },
      "snapshot": {
        "captures": [
          [
            "oac_2ee829b43dc68de10f77131a11a0e97370262deaf3a41a071b20739b4972e7c8",
            "cmd_ser_cas",
            "ident_ser_cas",
            "a8488b21cca2bc304efca12ed2c5affbcb618df396327b1db278cb5322bf1d2c",
            true,
            "QUEUED_INBOX",
            "work_ser_cas",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_ser_cas",
            "BOUND",
            true,
            "a8488b21cca2bc304efca12ed2c5affbcb618df396327b1db278cb5322bf1d2c",
            "oac_2ee829b43dc68de10f77131a11a0e97370262deaf3a41a071b20739b4972e7c8",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_cas",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-sight-capture-admit",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "sight",
          "capture",
          "admit"
        ],
        "rcs": [
          0,
          1,
          1
        ],
        "errs": [
          "",
          "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(t",
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t"
        ]
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_sca",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-sight-admit-capture",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "sight",
          "admit",
          "capture"
        ],
        "rcs": [
          0,
          1,
          1
        ],
        "errs": [
          "",
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t",
          "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(t"
        ]
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_sac",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-admit-capture-sight",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "admit",
          "capture",
          "sight"
        ],
        "rcs": [
          1,
          0,
          0
        ],
        "errs": [
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t",
          "",
          ""
        ]
      },
      "snapshot": {
        "captures": [
          [
            "oac_aa5aa7241064df37c4f70d8251f272ab54672c49847c246bbc8ebc8d27632154",
            "cmd_ser_acs",
            "ident_ser_acs",
            "6849614e283e4df28e28a266f4c94211f7fc41e083d4b64e67eb50e1a97d446a",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_acs",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-admit-sight-capture",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "admit",
          "sight",
          "capture"
        ],
        "rcs": [
          1,
          0,
          1
        ],
        "errs": [
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t",
          "",
          "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(t"
        ]
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_asc",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-PRECOMMIT-CLIENT-CLOSE",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "uncommitted capture absent; retry created one",
      "schedule": {
        "retry_rc": 0
      },
      "snapshot": {
        "captures": [
          [
            "oac_41df7f35008c6eb4d577e48de0fc70d9aa6509cc68c7584e1b8976bc887c0e3b",
            "cmd_loss_pre",
            "ident_loss_pre",
            "b4f5b9558add0e2275bb9d2f113745d941ceab7193b246afa1d65528e6c8149c",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-PRECOMMIT-BACKEND-TERMINATE",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "terminated pid=10273 captures_after=0",
      "schedule": {
        "pid": 10273,
        "err": "terminating connection due to administrator command"
      },
      "snapshot": {
        "captures": [
          [
            "oac_97e5c5d4af6a99f6f866f0e6e8fb74fca16dc143b5788435d8cea506aa0e29e7",
            "cmd_loss_backend",
            "ident_loss_backend",
            "c051048d9230049bda7b00368ab56a9f66c7acab2cc8ba6858569b1b4b08677d",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-POSTCOMMIT-PREACK",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "row survived client SIGKILL before ack file; retry kept one capture; ack_written=False",
      "schedule": {
        "child_pid": 10285
      },
      "snapshot": {
        "captures": [
          [
            "oac_6d3e4e8d3dc67e1c5f6f15bd846e9f16acdb30784bd4148285408330ed59f204",
            "cmd_loss_post",
            "ident_loss_post",
            "521929e879e3029d0bd0a7c439d0b4252f6356cb344f55556c7f232c27c3376c",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-ACK-PENDING-RECOVERY",
      "family": "duplicate_recovery_lost_ack",
      "classification": "tested_refuted_hypothesis",
      "detail": "pending effect denied; duplicate did not mint; recover then one effect. origins_before=1 effect_err=customer_admission_not_acked\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,t",
      "schedule": {
        "pending": 0,
        "dup": 0,
        "recover": 0,
        "effect2": 0
      },
      "snapshot": {
        "captures": [
          [
            "oac_c845bc8bcc6bec9572e8c3955c7c9d70933ccffdb84d5e0ee46bd3c9a8185553",
            "cmd_loss_ack",
            "ident_loss_ack",
            "6a2961151fef0b81cdac40e5766d436a406afaf5e6b29cf2aa675712b32f43d3",
            false,
            null,
            "work_loss_ack",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_loss_ack",
            "BOUND",
            true,
            "6a2961151fef0b81cdac40e5766d436a406afaf5e6b29cf2aa675712b32f43d3",
            "oac_c845bc8bcc6bec9572e8c3955c7c9d70933ccffdb84d5e0ee46bd3c9a8185553",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_loss_ack",
            "work_loss_ack",
            "0199882321c9dd3908eebf05af9ec26faa0f576852806ce9b247478762cb5dba",
            "6a2961151fef0b81cdac40e5766d436a406afaf5e6b29cf2aa675712b32f43d3"
          ]
        ],
        "audits": [
          [
            "ae_lab_loss_ack",
            "shop_a",
            "c_loss_ack"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-UNCERTAIN-COMMIT",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "bounded terminate-during-commit; retry converged to one capture whether the original commit landed",
      "schedule": {
        "attempts": [
          {
            "n": 0,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 10303
          },
          {
            "n": 1,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 10312
          },
          {
            "n": 2,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 10319
          },
          {
            "n": 3,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 10358
          },
          {
            "n": 4,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 10365
          },
          {
            "n": 5,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 10374
          }
        ]
      },
      "snapshot": null,
      "power_loss": "unexecuted_application_integration",
      "external_io": "unexecuted_application_integration"
    },
    {
      "id": "FINAL-HASH",
      "family": "preservation",
      "classification": "tested_refuted_hypothesis",
      "detail": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
      "schedule": {},
      "snapshot": null
    },
    {
      "id": "MINIMIZE-NONE",
      "family": "minimization",
      "classification": "tested_refuted_hypothesis",
      "detail": "No suspected defect required a pristine rerun.",
      "schedule": {},
      "snapshot": null
    }
  ],
  "counts": {
    "cases": 38,
    "reproduced_defect": 0,
    "tested_refuted_hypothesis": 38,
    "harness_failure": 0,
    "contract_ambiguity": 0,
    "unexecuted_application_integration": 0
  }
}
<!-- GROK47-EVIDENCE:end name=a-sweep1 -->

### a-final

sha256 `ac39dbb4d62e1e3816da6cc1cf3498df7716541d92ccc717f779a57f8cfa7f5c` bytes `78895`

<!-- GROK47-EVIDENCE:begin name=a-final -->
{
  "h": "3cc2045107b54601c6b0e43c8690b7d090074b80",
  "contract_sha256": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
  "seed_sha256": "d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632",
  "limits": {
    "actors_per_schedule": 3,
    "seeds": [
      17001,
      17002,
      17003,
      17004,
      17005,
      17006,
      17007,
      17008
    ],
    "lock_observe_seconds": 2.0,
    "poll_seconds": 0.02,
    "holder_release_timeout_seconds": 20,
    "uncertain_attempts": 6,
    "serial_permutations_bound": 6,
    "statement_timeout": "20s",
    "waiter_lock_timeout": "8s"
  },
  "postgres_note": "caller records server version",
  "cases": [
    {
      "id": "RACE-CAP-SIGHT-capture_holds",
      "family": "capture_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "capture committed then sighting contradicted it; wait=True",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "oas_shop_a_2026-09-21_23:27:30.44551+00"
              ]
            ],
            [
              [
                "oac_d34b7713fce5c44c5cb9d19c455b1b98894ff98fdfe423cd242003f882dc48b1"
              ]
            ]
          ],
          "pid": 10731
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10733
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10733,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ],
              [
                10731,
                "stocky_admin_capture",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_admin_capture",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_admin_capture",
                "ExclusiveLock",
                true,
                1347573587,
                2219418073
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                2219418073
              ]
            ],
            "waiting": [
              [
                10733,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_d34b7713fce5c44c5cb9d19c455b1b98894ff98fdfe423cd242003f882dc48b1",
            "cmd_cap_sight_capture_holds",
            "ident_cap_sight_capture_holds",
            "be197170bb1fd79e49f80bd647889258e40d7096582c33fd294448be9fb9e206",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_cap_sight_capture_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-CAP-SIGHT-sighting_holds",
      "family": "capture_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "sighting first blocks fresh capture; waiter_err=queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10738
        },
        "waiter": {
          "rc": 1,
          "err": "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10740
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10738,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ],
              [
                10740,
                "stocky_admin_capture",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                10980750
              ],
              [
                "stocky_admin_capture",
                "ExclusiveLock",
                false,
                1347573587,
                10980750
              ],
              [
                "stocky_admin_capture",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10740,
                "stocky_admin_capture",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_cap_sight_sighting_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-ADMIT-SIGHT-admit_holds",
      "family": "consume_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "admitted first; later sighting; effect refused and audit absent",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "wao_work_admit_sight_admit_holds"
              ]
            ]
          ],
          "pid": 10746
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10748
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10748,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ],
              [
                10746,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                3382847741
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1932656354,
                345196999
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                3382847741
              ]
            ],
            "waiting": [
              [
                10748,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_b8385c56ca346e4d86fb928d9288af46d33d0651498aa5d62e364c7821a89552",
            "cmd_admit_sight_admit_holds",
            "ident_admit_sight_admit_holds",
            "1e5b2cce07a4d9c36f32f1525273a1f1e80f86b731a11e3dfb6f520418e9c899",
            true,
            "QUEUED_INBOX",
            "work_admit_sight_admit_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_admit_sight_admit_holds",
            "BOUND",
            true,
            "1e5b2cce07a4d9c36f32f1525273a1f1e80f86b731a11e3dfb6f520418e9c899",
            "oac_b8385c56ca346e4d86fb928d9288af46d33d0651498aa5d62e364c7821a89552",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_admit_sight_admit_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-ADMIT-SIGHT-sighting_holds",
      "family": "consume_vs_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "sighting first; consume refused; origins=0 err=capture_content_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,te",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10756
        },
        "waiter": {
          "rc": 1,
          "err": "capture_content_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text) line 97 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10758
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10758,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ],
              [
                10756,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                138188087
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                true,
                1932656354,
                4271544123
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                138188087
              ]
            ],
            "waiting": [
              [
                10758,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_47a1a43582a711afa3051017a8540eff85667ae62d7ea3aa289167c7df15d7bb",
            "cmd_admit_sight_sighting_holds",
            "ident_admit_sight_sighting_holds",
            "3f15f38bac721a1c600bbd95640a4ec0700be6fd4f9952992d5748b9e33f2316",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_admit_sight_sighting_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-EFFECT-SIGHT-effect_holds",
      "family": "admission_sighting_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "effect won; sighting did not unwrite; same-effect retry stayed one row",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10765
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10767
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10765,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10767,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                3921204883
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                1859414033
              ],
              [
                "stocky_original_admission",
                "ExclusiveLock",
                false,
                1347573587,
                1859414033
              ]
            ],
            "waiting": [
              [
                10767,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_3ca43fa7635350a1a13899b61569f77db043021d3ea200f10eded2722e48067d",
            "cmd_eff_sight_effect_holds",
            "ident_eff_sight_effect_holds",
            "15246f5d8c26075c65b17cd66cd906f37f3f1ec7535ac9d78587a5cc6afaaf89",
            true,
            "QUEUED_INBOX",
            "work_eff_sight_effect_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_eff_sight_effect_holds",
            "BOUND",
            true,
            "15246f5d8c26075c65b17cd66cd906f37f3f1ec7535ac9d78587a5cc6afaaf89",
            "oac_3ca43fa7635350a1a13899b61569f77db043021d3ea200f10eded2722e48067d",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_eff_sight_effect_holds",
            "work_eff_sight_effect_holds",
            "fffd22bf0140e055148e920c8ba2eb2dc4e3bbb8a5bf7ea172b5f4d5e2eb67f7",
            "15246f5d8c26075c65b17cd66cd906f37f3f1ec7535ac9d78587a5cc6afaaf89"
          ]
        ],
        "audits": [
          [
            "ae_lab_eff_sight_effect_holds",
            "shop_a",
            "c_eff_sight_effect_holds"
          ]
        ],
        "sightings": [
          [
            "sight_eff_sight_effect_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-EFFECT-SIGHT-sighting_holds",
      "family": "admission_sighting_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "sighting won; effect wrote nothing; err=effect_source_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10776
        },
        "waiter": {
          "rc": 1,
          "err": "effect_source_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 107 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10778
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10778,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10776,
                "stocky_original_admission",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)"
              ]
            ],
            "locks": [
              [
                "stocky_original_admission",
                "ExclusiveLock",
                true,
                1347573587,
                3558996425
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                25341538
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                false,
                1347573587,
                3558996425
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10778,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_70fe6ce79633bf2b332c33938657fd9c823f6becce0cd14952e2e180cba7b559",
            "cmd_eff_sight_sighting_holds",
            "ident_eff_sight_sighting_holds",
            "3504c63eed6db023a6addec2c98bd2c6385b3838c53f2c4f89a7ff2d255cbc18",
            true,
            "QUEUED_INBOX",
            "work_eff_sight_sighting_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_eff_sight_sighting_holds",
            "BOUND",
            true,
            "3504c63eed6db023a6addec2c98bd2c6385b3838c53f2c4f89a7ff2d255cbc18",
            "oac_70fe6ce79633bf2b332c33938657fd9c823f6becce0cd14952e2e180cba7b559",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_eff_sight_sighting_holds",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-SOURCE-LINK-e1",
      "family": "source_link_competition",
      "classification": "tested_refuted_hypothesis",
      "detail": "one link one audit; child_rc=0 denied=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 9",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10786
        },
        "waiter": {
          "rc": 1,
          "err": "effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 98 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10788
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10788,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10786,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                1425352039
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                663561782
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                false,
                1347573587,
                663561782
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                1425352039
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10788,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_e075921d96c929c454f3e81ec26a01099409aa271ce8ce35497cf7a2a1e5630c",
            "cmd_link_e1",
            "ident_link_e1",
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744",
            false,
            null,
            "work_link_e1",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_link_e1",
            "BOUND",
            true,
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744",
            "oac_e075921d96c929c454f3e81ec26a01099409aa271ce8ce35497cf7a2a1e5630c",
            "gen_a",
            "shop_a"
          ],
          [
            "work_link_e1_child",
            "BOUND",
            true,
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744",
            null,
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_link_e1_1",
            "work_link_e1",
            "e081a6585bfd7f8522c52e3d88c72977696188007281887cd7f52ee4a89e3aa1",
            "c3608d7a8b217e202e85737b2442f064a1832e4423c268a5de2e674821965744"
          ]
        ],
        "audits": [
          [
            "ae_lab_link_e1_1",
            "shop_a",
            "c_link_e1"
          ]
        ],
        "sightings": [
          [
            "child_link_e1",
            "PARENT_LINEAGE",
            true
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-SOURCE-LINK-e2",
      "family": "source_link_competition",
      "classification": "tested_refuted_hypothesis",
      "detail": "one link one audit; child_rc=0 denied=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 9",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10796
        },
        "waiter": {
          "rc": 1,
          "err": "effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 98 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10798
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10798,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10796,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                2093348942
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                2231713478
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                2231713478
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                false,
                1347573587,
                2093348942
              ]
            ],
            "waiting": [
              [
                10798,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_fc90938e4578c7a59740bc90d4262828579bdb344c9b33d1a0f1ea948ea10e7f",
            "cmd_link_e2",
            "ident_link_e2",
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125",
            false,
            null,
            "work_link_e2",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_link_e2",
            "BOUND",
            true,
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125",
            "oac_fc90938e4578c7a59740bc90d4262828579bdb344c9b33d1a0f1ea948ea10e7f",
            "gen_a",
            "shop_a"
          ],
          [
            "work_link_e2_child",
            "BOUND",
            true,
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125",
            null,
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_link_e2_2",
            "work_link_e2_child",
            "3275acf5c42f3ed8b09fa8f210ddcbd07d5d50d66b9150122fa23bccaefd4f6d",
            "00c1c4519d4a04fc04da120ec20e12e2745bfc00e2f01873e6da89a3e4635125"
          ]
        ],
        "audits": [
          [
            "ae_lab_link_e2_2",
            "shop_a",
            "c_link_e2"
          ]
        ],
        "sightings": [
          [
            "child_link_e2",
            "PARENT_LINEAGE",
            true
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-BARRIER-EFFECT-effect_holds",
      "family": "barrier_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "effect committed; later barrier did not remove the audit row",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10807
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10809
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10807,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10809,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_install_customer_barrier($1,$2)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1932656354,
                1795976467
              ],
              [
                "stocky_runtime",
                "ExclusiveLock",
                true,
                1347573587,
                2994993137
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1347573556,
                3952037960
              ],
              [
                "stocky_privacy_erasure",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                false,
                1932656354,
                1795976467
              ]
            ],
            "waiting": [
              [
                10809,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_install_customer_barrier($1,$2)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_0ecd0638a44a21566f6b001cfeef80273230cc742f4f8a3887575a7e0a3b1102",
            "cmd_bar_eff_effect_holds",
            "ident_bar_eff_effect_holds",
            "0dfdde09010a565f81e55fe71600a260feb0f52baf9765647e55b058fbfab7d2",
            false,
            null,
            "work_bar_eff_effect_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_bar_eff_effect_holds",
            "BOUND",
            true,
            "0dfdde09010a565f81e55fe71600a260feb0f52baf9765647e55b058fbfab7d2",
            "oac_0ecd0638a44a21566f6b001cfeef80273230cc742f4f8a3887575a7e0a3b1102",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_bar_eff_effect_holds",
            "work_bar_eff_effect_holds",
            "c65832af860fc4b41904452a98bc9df8e584e85875c0c19dfb4c203393657b76",
            "0dfdde09010a565f81e55fe71600a260feb0f52baf9765647e55b058fbfab7d2"
          ]
        ],
        "audits": [
          [
            "ae_lab_bar_eff_effect_holds",
            "shop_a",
            "191167"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 1
      },
      "other_shop_setup_rc": 0
    },
    {
      "id": "RACE-BARRIER-EFFECT-barrier_holds",
      "family": "barrier_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "barrier won; effect denied; audits=0",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10818
        },
        "waiter": {
          "rc": 1,
          "err": "customer_target_erasing\nCONTEXT:  PL/pgSQL function public.stocky_customer_write_guard(text,text,text,text,text) line 26 at RAISE\nSQL statement \"SELECT public.stocky_customer_write_guard(\n    p_canonical_domain, p_shop_id, p_kind, p_value, p_work_id\n  )\"\nPL/pgSQL function public.stocky_fact_write_guard(text,text,text,text,text) line 4 at PERFORM\nSQL statement \"SELECT public.stocky_fact_write_guard(v_domain, v_shop, v_kind, v_value, v_work)\"\nPL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 72 at PERFORM",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10820
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10820,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ],
              [
                10818,
                "stocky_privacy_erasure",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_privacy_install_customer_barrier($1,$2)"
              ]
            ],
            "locks": [
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1347573556,
                3952037960
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                377500897
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                1795976467
              ],
              [
                "stocky_privacy_erasure",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_runtime",
                "ShareLock",
                false,
                1932656354,
                1795976467
              ]
            ],
            "waiting": [
              [
                10820,
                "stocky_runtime",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_e032e14cbdf5b7c6d8020eed4d7856114b98489d66e0d3eec3ffc3fa06a702d3",
            "cmd_bar_eff_barrier_holds",
            "ident_bar_eff_barrier_holds",
            "5890a5c8cceb5e495b30452baac3b397a3cbf20493fac6418a59f38b581edb65",
            false,
            null,
            "work_bar_eff_barrier_holds",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_bar_eff_barrier_holds",
            "BOUND",
            true,
            "5890a5c8cceb5e495b30452baac3b397a3cbf20493fac6418a59f38b581edb65",
            "oac_e032e14cbdf5b7c6d8020eed4d7856114b98489d66e0d3eec3ffc3fa06a702d3",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 1
      },
      "other_shop_setup_rc": 0
    },
    {
      "id": "RACE-BARRIER-OTHER-SHOP",
      "family": "barrier_effect",
      "classification": "tested_refuted_hypothesis",
      "detail": "shop_b wrote during shop_a barrier hold rc=0 err=",
      "schedule": {
        "holder": {
          "rc": 0
        },
        "during": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10841
        }
      },
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_bar_progress",
            "BOUND",
            true,
            "20485f57b953589df39c11f07b03f6c375ff0663ac4316e3e2a3cd46a59a754f",
            "oac_4858164835a6ff54d11e5916076c7e12e8a0b677396940773e5a84cfb1737afe",
            "gen_a",
            "shop_a"
          ],
          [
            "work_bar_progress_b",
            "BOUND",
            true,
            "ade3e760276ae0368a738e3ff393a300351f97baeec5834b76f8dcbc62156a33",
            "oac_696106dd1c1c919d04a61b3410406a204b220dfa978603985069f7a73915b3eb",
            "gen_b",
            "shop_b"
          ]
        ],
        "links": [
          [
            "ae_lab_bar_progress_b",
            "work_bar_progress_b",
            "8aec4418a5c32efc8b1aa07954f461d0b8e749eea354513e2a06335434fdb1c5",
            "ade3e760276ae0368a738e3ff393a300351f97baeec5834b76f8dcbc62156a33"
          ]
        ],
        "audits": [
          [
            "ae_lab_bar_progress_b",
            "shop_b",
            "c_other_b"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 1
      }
    },
    {
      "id": "RACE-BARRIER-CAPTURE",
      "family": "barrier_capture",
      "classification": "tested_refuted_hypothesis",
      "detail": "capture_rc=0 wait=False captures=1",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10845
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "oas_shop_a_2026-09-21_23:27:31.230098+00"
              ]
            ],
            [
              [
                "oac_da123d09e514f85bdccc96d26056c1e8647ec629ad48dd785765175e4de1cad2"
              ]
            ]
          ],
          "pid": 10847
        },
        "observation": {
          "wait_seen": false,
          "sample": null
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_da123d09e514f85bdccc96d26056c1e8647ec629ad48dd785765175e4de1cad2",
            "cmd_bar_cap",
            "ident_bar_cap",
            "8509c9f867b6c56b99e034db5a75eb4c1b12d0f164e96d16bbc0ae72dcc22de9",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 1
      }
    },
    {
      "id": "RACE-BARRIER-COMPLETION",
      "family": "barrier_completion",
      "classification": "tested_refuted_hypothesis",
      "detail": "second completion waited; holder_rows=[[['remnants']]] waiter_err=",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "remnants"
              ]
            ]
          ],
          "pid": 10854
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                "remnants"
              ]
            ]
          ],
          "pid": 10856
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10856,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_complete_customer_redact($1,$2)"
              ],
              [
                10854,
                "stocky_privacy_erasure",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_privacy_complete_customer_redact($1,$2)"
              ]
            ],
            "locks": [
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                1795976467
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1932656354,
                377500897
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                true,
                1347573556,
                3952037960
              ],
              [
                "stocky_privacy_erasure",
                "ExclusiveLock",
                false,
                1347573556,
                3952037960
              ]
            ],
            "waiting": [
              [
                10856,
                "stocky_privacy_erasure",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_privacy_complete_customer_redact($1,$2)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 1
      }
    },
    {
      "id": "RACE-REINSTALL-ADMISSION",
      "family": "reinstall_admission",
      "classification": "tested_refuted_hypothesis",
      "detail": "old capture not consumed onto the new LIVE; new capture admitted rc=0 err=admission_capture_epoch_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,t",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10862
        },
        "waiter": {
          "rc": 1,
          "err": "admission_capture_epoch_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text) line 134 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10864
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10862,
                "stocky_control_plane",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ],
              [
                10864,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ],
            "locks": [
              [
                "stocky_control_plane",
                "ExclusiveLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                false,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10864,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [
          [
            "oac_0c89e67fd072e31db9996b8a809a167882d36e14b8f0905b3704edb614d7294f",
            "cmd_reinstall_new",
            "ident_reinstall_new",
            "73133f323ca2ed26d1a48fdecc43dd1ef6ca19ee1eb4fc8d68dc17aa93bf4fcf",
            false,
            null,
            "work_reinstall_new",
            "gen_lab_new"
          ],
          [
            "oac_1656b45aa97dd78de18dbf18e598058779b77420984bccfba562c83fc65ca2c7",
            "cmd_reinstall",
            "ident_reinstall",
            "2a5ec443e2bd42c67c42a9c662670204359547eeee94090af940e764e4f27505",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_reinstall_new",
            "BOUND",
            true,
            "73133f323ca2ed26d1a48fdecc43dd1ef6ca19ee1eb4fc8d68dc17aa93bf4fcf",
            "oac_0c89e67fd072e31db9996b8a809a167882d36e14b8f0905b3704edb614d7294f",
            "gen_lab_new",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      },
      "owner_fixture": "fence flip while exclusive lifecycle lock held; not an application reinstall function",
      "fences_while_held": [
        [
          "gen_a",
          "UNINSTALLED"
        ],
        [
          "gen_lab_new",
          "LIVE"
        ]
      ],
      "positive_control": {
        "new_capture_rc": 0,
        "new_admit_rc": 0
      }
    },
    {
      "id": "RACE-REINSTALL-REVERSE",
      "family": "reinstall_admission",
      "classification": "tested_refuted_hypothesis",
      "detail": "exclusive gate waited for shared holder; wait=True",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10875
        },
        "waiter": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10877
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10875,
                "stocky_runtime",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_lifecycle_shared_lock($1)"
              ],
              [
                10877,
                "stocky_control_plane",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ]
            ],
            "locks": [
              [
                "stocky_runtime",
                "ShareLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_control_plane",
                "ExclusiveLock",
                false,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10877,
                "stocky_control_plane",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_reinstall_rev",
            "BOUND",
            true,
            "826d0ce1d96011d77c23014369253136e81da618c4209af37f59328296951de7",
            "oac_7ad46777de2f5d145f5d01e00a0f7494a2c7aacdd0853d53af5140db5b855ac4",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-LOCK-TIMEOUT-RETRY",
      "family": "timeout_stale_context",
      "classification": "tested_refuted_hypothesis",
      "detail": "timeout=55P03 retry_rc=0 err=canceling statement due to lock timeout\nCONTEXT:  SQL statement \"SELECT pg_advisory_xact_lock_shared(1347573553, public.stocky_lifecycle_lock_key(p_canonical_do",
      "schedule": {
        "holder": {
          "rc": 0,
          "err": "",
          "sqlstate": "",
          "rows": [
            [
              [
                ""
              ]
            ]
          ],
          "pid": 10883
        },
        "waiter": {
          "rc": 1,
          "err": "canceling statement due to lock timeout\nCONTEXT:  SQL statement \"SELECT pg_advisory_xact_lock_shared(1347573553, public.stocky_lifecycle_lock_key(p_canonical_domain))\"\nPL/pgSQL function public.stocky_lifecycle_shared_lock(text) line 3 at PERFORM\nSQL statement \"SELECT public.stocky_lifecycle_shared_lock(v_domain)\"\nPL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text) line 30 at PERFORM",
          "sqlstate": "55P03",
          "rows": [],
          "pid": 10885
        },
        "observation": {
          "wait_seen": true,
          "sample": {
            "activity": [
              [
                10883,
                "stocky_control_plane",
                "idle in transaction",
                "Client",
                "ClientRead",
                "SELECT public.stocky_lifecycle_exclusive_lock($1)"
              ],
              [
                10885,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ],
            "locks": [
              [
                "stocky_control_plane",
                "ExclusiveLock",
                true,
                1347573553,
                3639852879
              ],
              [
                "stocky_original_admission",
                "ShareLock",
                false,
                1347573553,
                3639852879
              ]
            ],
            "waiting": [
              [
                10885,
                "stocky_original_admission",
                "active",
                "Lock",
                "advisory",
                "SELECT public.stocky_record_writer_admission($1,$2,$3,$4,$5,$6,'pr7-origin-v1', clock_timestamp(), $7,$8,$9,$10,$11,$12)"
              ]
            ]
          }
        },
        "harness": "ok",
        "before_release_error": null
      },
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_timeout",
            "BOUND",
            true,
            "662eed7ff15eed1c76d85db1f514ca318133d5c56f3b7a30325b2e8b4db54b49",
            "oac_ff16a3cb95a64ba30f937869530476fa59a5c60572bb61c0e3530bcd878d27f7",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "RACE-POISON-CONTEXT",
      "family": "timeout_stale_context",
      "classification": "tested_refuted_hypothesis",
      "detail": "runtime_capture=42501 missing=admission_admin_session_required\nCONTEXT:  PL/pgSQL function public.stocky_captu mismatch=admission_session_tenant_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_esta stale=barrier_stale_attempt\nCONTEXT:  PL/pgSQL function public.stocky_privacy_install_",
      "schedule": {
        "denied": {
          "rc": 1,
          "err": "permission denied for function stocky_establish_modeled_admin_session",
          "sqlstate": "42501",
          "rows": [],
          "pid": 10891
        },
        "missing": {
          "rc": 1,
          "err": "admission_admin_session_required\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 20 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10892
        },
        "mismatch": {
          "rc": 1,
          "err": "admission_session_tenant_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_establish_modeled_admin_session(text,text,text) line 15 at RAISE",
          "sqlstate": "P0001",
          "rows": [],
          "pid": 10893
        },
        "stale": {
          "rc": 1,
          "err": "barrier_stale_attempt\nCONTEXT:  PL/pgSQL function public.stocky_privacy_install_customer_barrier(text,text) line 14 at RAISE",
          "sqlstate": "42501",
          "rows": [],
          "pid": 10894
        }
      },
      "snapshot": null
    },
    {
      "id": "SEED-17001-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17001 arrival=capture_holds digest=3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_fc99a3cfa658cdf1b85af1785db16204b315987d44925902ecf612cfb4c68202",
            "cmd_seed17001",
            "ident_seed17001",
            "3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17001",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17001,
      "digest": "3ef574cfdce60bcb5b2ea86c34b3f3d67eb4ec3d823839eecf7b27a01510252c"
    },
    {
      "id": "SEED-17002-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17002 arrival=capture_holds digest=922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_9a825da8983e69977fd964a28652933d5d4edafeff76bbdc2bf3717123e4ac0f",
            "cmd_seed17002",
            "ident_seed17002",
            "922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17002",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17002,
      "digest": "922cc35d3954b81cea3d40c7dfb8348800b76205ea8528a4c77488205e72d978"
    },
    {
      "id": "SEED-17003-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17003 arrival=capture_holds digest=b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_83bb158bd11ea46e8b30ffa9977f50026848031b5f5bfbadbcd662781acbbf32",
            "cmd_seed17003",
            "ident_seed17003",
            "b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17003",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17003,
      "digest": "b328492abe3308d80c504564ebd507c3f441ea60e1063771e9371ffb81d54f38"
    },
    {
      "id": "SEED-17004-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17004 arrival=capture_holds digest=4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_5e68684cc2da0caf93ea201d9cf429dfbf8e2d8eedcb7b8e23fe36ffa1fb0c40",
            "cmd_seed17004",
            "ident_seed17004",
            "4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17004",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17004,
      "digest": "4a49a816f6707a46a70c849b8fd7ebbb6a5750d8dda74261d794b9a8d749e9d8"
    },
    {
      "id": "SEED-17005-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17005 arrival=capture_holds digest=edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_edfd6eae54c28d89ebfe3196498bf21c7cd9554aa35230b719ae927b4f29876c",
            "cmd_seed17005",
            "ident_seed17005",
            "edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17005",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17005,
      "digest": "edd072e7d409fd7cd4f7e7a9869ab04d442c39cf2dce5944587102d50825c432"
    },
    {
      "id": "SEED-17006-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17006 arrival=capture_holds digest=f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_80baf02428ea2d8ba7b64a93b299d3da88d2aca2846d1c0168257a240e387d6e",
            "cmd_seed17006",
            "ident_seed17006",
            "f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17006",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17006,
      "digest": "f4170afdab1c54622c34ea1b8ea5e8c051cb6adb2d647ec275af2aea48770e57"
    },
    {
      "id": "SEED-17007-capture_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17007 arrival=capture_holds digest=868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 0,
        "waiter_err": ""
      },
      "snapshot": {
        "captures": [
          [
            "oac_4de24bf88771836325e69bfc9df8cc30d343606928d525d1d8caf9912e0038a1",
            "cmd_seed17007",
            "ident_seed17007",
            "868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17007",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17007,
      "digest": "868313cd48f2b6330ee96c659cd5a3519e3c91ad7e26f168a96f8f147ae7bfa2"
    },
    {
      "id": "SEED-17008-sighting_holds",
      "family": "seeded_capture_sighting",
      "classification": "tested_refuted_hypothesis",
      "detail": "seed=17008 arrival=sighting_holds digest=c1ecd1c0373cfb6b5d09f873f6bc5fd7b17419def50ca20390dd5921c4a8d6e0 wait=True",
      "schedule": {
        "wait_seen": true,
        "holder_rc": 0,
        "waiter_rc": 1,
        "waiter_err": "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE"
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_seed17008",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      },
      "seed": 17008,
      "digest": "c1ecd1c0373cfb6b5d09f873f6bc5fd7b17419def50ca20390dd5921c4a8d6e0"
    },
    {
      "id": "SERIAL-capture-sight-admit",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "capture",
          "sight",
          "admit"
        ],
        "rcs": [
          0,
          0,
          1
        ],
        "errs": [
          "",
          "",
          "capture_content_no_longer_fresh\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,te"
        ]
      },
      "snapshot": {
        "captures": [
          [
            "oac_50ebe31a9ca1076524e1b21ef7d884d6b9f6e1e2e47a3e4c7af3b7a5493cfe14",
            "cmd_ser_csa",
            "ident_ser_csa",
            "058c5dd14f106684cd5efefaaf9bb1a764528008b740c8d6ae2c3a5596981fbc",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_csa",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-capture-admit-sight",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "capture",
          "admit",
          "sight"
        ],
        "rcs": [
          0,
          0,
          0
        ],
        "errs": [
          "",
          "",
          ""
        ]
      },
      "snapshot": {
        "captures": [
          [
            "oac_2ee829b43dc68de10f77131a11a0e97370262deaf3a41a071b20739b4972e7c8",
            "cmd_ser_cas",
            "ident_ser_cas",
            "a8488b21cca2bc304efca12ed2c5affbcb618df396327b1db278cb5322bf1d2c",
            true,
            "QUEUED_INBOX",
            "work_ser_cas",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_ser_cas",
            "BOUND",
            true,
            "a8488b21cca2bc304efca12ed2c5affbcb618df396327b1db278cb5322bf1d2c",
            "oac_2ee829b43dc68de10f77131a11a0e97370262deaf3a41a071b20739b4972e7c8",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_cas",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-sight-capture-admit",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "sight",
          "capture",
          "admit"
        ],
        "rcs": [
          0,
          1,
          1
        ],
        "errs": [
          "",
          "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(t",
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t"
        ]
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_sca",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-sight-admit-capture",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "sight",
          "admit",
          "capture"
        ],
        "rcs": [
          0,
          1,
          1
        ],
        "errs": [
          "",
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t",
          "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(t"
        ]
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_sac",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-admit-capture-sight",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "admit",
          "capture",
          "sight"
        ],
        "rcs": [
          1,
          0,
          0
        ],
        "errs": [
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t",
          "",
          ""
        ]
      },
      "snapshot": {
        "captures": [
          [
            "oac_aa5aa7241064df37c4f70d8251f272ab54672c49847c246bbc8ebc8d27632154",
            "cmd_ser_acs",
            "ident_ser_acs",
            "6849614e283e4df28e28a266f4c94211f7fc41e083d4b64e67eb50e1a97d446a",
            true,
            "QUEUED_INBOX",
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_acs",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SERIAL-admit-sight-capture",
      "family": "serial_not_concurrency_proof",
      "classification": "tested_refuted_hypothesis",
      "detail": "serial history recorded only; not used as overlap evidence",
      "schedule": {
        "order": [
          "admit",
          "sight",
          "capture"
        ],
        "rcs": [
          1,
          0,
          1
        ],
        "errs": [
          "admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,t",
          "",
          "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(t"
        ]
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [
          [
            "sight_ser_asc",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-PRECOMMIT-CLIENT-CLOSE",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "uncommitted capture absent; retry created one",
      "schedule": {
        "retry_rc": 0
      },
      "snapshot": {
        "captures": [
          [
            "oac_41df7f35008c6eb4d577e48de0fc70d9aa6509cc68c7584e1b8976bc887c0e3b",
            "cmd_loss_pre",
            "ident_loss_pre",
            "b4f5b9558add0e2275bb9d2f113745d941ceab7193b246afa1d65528e6c8149c",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-PRECOMMIT-BACKEND-TERMINATE",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "terminated pid=10988 captures_after=0",
      "schedule": {
        "pid": 10988
      },
      "snapshot": {
        "captures": [
          [
            "oac_97e5c5d4af6a99f6f866f0e6e8fb74fca16dc143b5788435d8cea506aa0e29e7",
            "cmd_loss_backend",
            "ident_loss_backend",
            "c051048d9230049bda7b00368ab56a9f66c7acab2cc8ba6858569b1b4b08677d",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-POSTCOMMIT-PREACK",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "row survived client SIGKILL before ack file; retry kept one capture; ack_written=False",
      "schedule": {
        "child_pid": 11039
      },
      "snapshot": {
        "captures": [
          [
            "oac_6d3e4e8d3dc67e1c5f6f15bd846e9f16acdb30784bd4148285408330ed59f204",
            "cmd_loss_post",
            "ident_loss_post",
            "521929e879e3029d0bd0a7c439d0b4252f6356cb344f55556c7f232c27c3376c",
            false,
            null,
            null,
            "gen_a"
          ]
        ],
        "origins": [],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-ACK-PENDING-RECOVERY",
      "family": "duplicate_recovery_lost_ack",
      "classification": "tested_refuted_hypothesis",
      "detail": "pending effect denied; duplicate did not mint; recover then one effect. origins_before=1 effect_err=customer_admission_not_acked\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,t",
      "schedule": {
        "pending": 0,
        "dup": 0,
        "recover": 0,
        "effect2": 0
      },
      "snapshot": {
        "captures": [
          [
            "oac_c845bc8bcc6bec9572e8c3955c7c9d70933ccffdb84d5e0ee46bd3c9a8185553",
            "cmd_loss_ack",
            "ident_loss_ack",
            "6a2961151fef0b81cdac40e5766d436a406afaf5e6b29cf2aa675712b32f43d3",
            false,
            null,
            "work_loss_ack",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_loss_ack",
            "BOUND",
            true,
            "6a2961151fef0b81cdac40e5766d436a406afaf5e6b29cf2aa675712b32f43d3",
            "oac_c845bc8bcc6bec9572e8c3955c7c9d70933ccffdb84d5e0ee46bd3c9a8185553",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_loss_ack",
            "work_loss_ack",
            "0199882321c9dd3908eebf05af9ec26faa0f576852806ce9b247478762cb5dba",
            "6a2961151fef0b81cdac40e5766d436a406afaf5e6b29cf2aa675712b32f43d3"
          ]
        ],
        "audits": [
          [
            "ae_lab_loss_ack",
            "shop_a",
            "c_loss_ack"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "LOSS-UNCERTAIN-COMMIT",
      "family": "process_loss",
      "classification": "tested_refuted_hypothesis",
      "detail": "bounded terminate-during-commit; retry converged to one capture whether the original commit landed",
      "schedule": {
        "attempts": [
          {
            "n": 0,
            "observed": "aborted",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 11098
          },
          {
            "n": 1,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 11105
          },
          {
            "n": 2,
            "observed": "aborted",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 11114
          },
          {
            "n": 3,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 11121
          },
          {
            "n": 4,
            "observed": "aborted",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 11128
          },
          {
            "n": 5,
            "observed": "committed",
            "retry_rc": 0,
            "final_captures": 1,
            "pid": 11171
          }
        ]
      },
      "snapshot": null,
      "power_loss": "unexecuted_application_integration",
      "external_io": "unexecuted_application_integration"
    },
    {
      "id": "FINAL-HASH",
      "family": "preservation",
      "classification": "tested_refuted_hypothesis",
      "detail": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
      "schedule": {},
      "snapshot": null
    },
    {
      "id": "MINIMIZE-NONE",
      "family": "minimization",
      "classification": "tested_refuted_hypothesis",
      "detail": "No suspected defect required a pristine rerun.",
      "schedule": {},
      "snapshot": null
    }
  ],
  "counts": {
    "cases": 38,
    "reproduced_defect": 0,
    "tested_refuted_hypothesis": 38,
    "harness_failure": 0,
    "contract_ambiguity": 0,
    "unexecuted_application_integration": 0
  }
}
<!-- GROK47-EVIDENCE:end name=a-final -->

### b-sweep0

sha256 `5f9183aa1aa8fa1f30d8f7bf15f638d1044a4c884690d929e8641bd434e25577` bytes `18029`

<!-- GROK47-EVIDENCE:begin name=b-sweep0 -->
{
  "h": "3cc2045107b54601c6b0e43c8690b7d090074b80",
  "contract_sha256": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
  "seed_sha256": "d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632",
  "limits": {
    "actors_per_schedule": 3,
    "seeds": [
      17001,
      17002,
      17003,
      17004,
      17005,
      17006,
      17007,
      17008
    ],
    "lock_observe_seconds": 2.0,
    "poll_seconds": 0.02,
    "holder_release_timeout_seconds": 20,
    "uncertain_attempts": 6,
    "serial_permutations_bound": 6,
    "statement_timeout": "20s",
    "waiter_lock_timeout": "8s"
  },
  "postgres_note": "caller records server version",
  "cases": [
    {
      "id": "SEM-ORACLE-SQL-AGREES",
      "family": "source_commitment",
      "classification": "tested_refuted_hypothesis",
      "detail": "sql_source_match=True sql_effect_match=True null=None",
      "schedule": {},
      "snapshot": null
    },
    {
      "id": "SEM-RENAME-IDS",
      "family": "renamed_identifiers",
      "classification": "tested_refuted_hypothesis",
      "detail": "second effect err=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 88 at RAISE captures=1 second_admit_rc=0",
      "schedule": {
        "second_cap": 0
      },
      "snapshot": {
        "captures": [
          [
            "oac_e39c7479ac03d8f33ae320b96cb48d8716937b8b37ca4d8794f221218ec21657",
            "cmd_rename1",
            "ident_rename1",
            "e285de2d506266c57b72127b889e9fd75b70e0a4b29bfd5aeadcd40fe7c19949",
            false,
            null,
            "work_rename1",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_rename1",
            "BOUND",
            true,
            "e285de2d506266c57b72127b889e9fd75b70e0a4b29bfd5aeadcd40fe7c19949",
            "oac_e39c7479ac03d8f33ae320b96cb48d8716937b8b37ca4d8794f221218ec21657",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_rename1",
            "work_rename1",
            "f75696f0a9d7078efd3d5327c32937fd0e7a81d8ee4e1ec0f41a0d0dbd21964e",
            "e285de2d506266c57b72127b889e9fd75b70e0a4b29bfd5aeadcd40fe7c19949"
          ]
        ],
        "audits": [
          [
            "ae_lab_rename1",
            "shop_a",
            "c_rename"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SEM-RENAME-SOURCE-IDENTITY",
      "family": "renamed_identifiers",
      "classification": "tested_refuted_hypothesis",
      "detail": "queued_work_cannot_acquire_fresh_admin_origin\nCONTEXT:  PL/pgSQL function public.stocky_capture_original_admin_command(text,text,text,text,text,text,text,text) line 86 at RAISE",
      "schedule": {},
      "snapshot": {
        "captures": [
          [
            "oac_048fdb3eb4eee2a692ce71fbd24d8068008d2cb3c5586731e0fa8fcf5069bf13",
            "cmd_identb",
            "ident_identb",
            "cb0b24c1f95053acc6ad9cf8ff940b68db870ad15d28c16addeb684384ac30b2",
            false,
            null,
            "work_identb",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_identb",
            "BOUND",
            true,
            "cb0b24c1f95053acc6ad9cf8ff940b68db870ad15d28c16addeb684384ac30b2",
            "oac_048fdb3eb4eee2a692ce71fbd24d8068008d2cb3c5586731e0fa8fcf5069bf13",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SEM-SOURCE-CLASSES-AND-CHILD",
      "family": "source_classes_child",
      "classification": "tested_refuted_hypothesis",
      "detail": "wh=0 manual=admission_parent_required\nCONTEXT:  PL/pgSQL function public.stocky_record_write nocap=admission_admin_capture_required\nCONTEXT:  PL/pgSQL function public.stocky_recor child_new=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_cus",
      "schedule": {},
      "snapshot": {
        "captures": [
          [
            "oac_9c10181056b9456acd3977ad87803515f09d55ef093e00fd299238a5d3adf2f7",
            "cmd_parent",
            "ident_parent",
            "fb36a707bc5b6aecf404c20d1c916c8335ba1fe51ddd8b2b8b5572a29cc67f7d",
            false,
            null,
            "work_parent",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_child_same",
            "BOUND",
            true,
            "fb36a707bc5b6aecf404c20d1c916c8335ba1fe51ddd8b2b8b5572a29cc67f7d",
            null,
            "gen_a",
            "shop_a"
          ],
          [
            "work_parent",
            "BOUND",
            true,
            "fb36a707bc5b6aecf404c20d1c916c8335ba1fe51ddd8b2b8b5572a29cc67f7d",
            "oac_9c10181056b9456acd3977ad87803515f09d55ef093e00fd299238a5d3adf2f7",
            "gen_a",
            "shop_a"
          ],
          [
            "work_wh",
            "UNATTRIBUTED",
            true,
            "148a1ff62124ac1a296aec8f10d8690341c30611d01f88519386f4a8ba9e9520",
            null,
            null,
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_parent",
            "work_parent",
            "f2f23dbe36b9772960658e9b9911093f6835401c9eb5cc3c74f0e805490bbf50",
            "fb36a707bc5b6aecf404c20d1c916c8335ba1fe51ddd8b2b8b5572a29cc67f7d"
          ],
          [
            "ae_lab_wh",
            "work_wh",
            "7f0f7b4b5dee39090f7757a8cdca314ef881d70691a3651dd0fdd723b8f2a149",
            "148a1ff62124ac1a296aec8f10d8690341c30611d01f88519386f4a8ba9e9520"
          ]
        ],
        "audits": [
          [
            "ae_lab_parent",
            "shop_a",
            "c_parent"
          ],
          [
            "ae_lab_wh",
            "shop_a",
            "c_wh"
          ]
        ],
        "sightings": [
          [
            "ident_wh",
            "WEBHOOK_PROVIDER_AUTH",
            false
          ],
          [
            "ident_child_same",
            "PARENT_LINEAGE",
            true
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SEM-EQUAL-AND-SUCCESSOR",
      "family": "legitimate_progress",
      "classification": "tested_refuted_hypothesis",
      "detail": "retry=0 new_effect=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_cus successor=0",
      "schedule": {},
      "snapshot": {
        "captures": [
          [
            "oac_4a1c153c546f95d5e9492638ceaf6c886e54905e57f1d440ec46af555fbb642e",
            "cmd_eq_new",
            "ident_eq_new",
            "cf8109abaaba7ff09b48317564286c9128933baa53e3b7d1d2db9c96e07565d6",
            false,
            null,
            "work_eq_new",
            "gen_a"
          ],
          [
            "oac_b8c143ddde73b8414c9ce44a19d0b60d4481df4cdbea952d0e44551d3504bf9e",
            "cmd_eq",
            "ident_eq",
            "c402a77e5a1fc0f9d7ae4689cb0b4b0b8f69d46f77f31e3121d465be62cf09fc",
            false,
            null,
            "work_eq",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_eq",
            "BOUND",
            true,
            "c402a77e5a1fc0f9d7ae4689cb0b4b0b8f69d46f77f31e3121d465be62cf09fc",
            "oac_b8c143ddde73b8414c9ce44a19d0b60d4481df4cdbea952d0e44551d3504bf9e",
            "gen_a",
            "shop_a"
          ],
          [
            "work_eq_new",
            "BOUND",
            true,
            "cf8109abaaba7ff09b48317564286c9128933baa53e3b7d1d2db9c96e07565d6",
            "oac_4a1c153c546f95d5e9492638ceaf6c886e54905e57f1d440ec46af555fbb642e",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_eq",
            "work_eq",
            "a162b6f6354d83644aab96b9cc123563f0612b73d0bebb2bfd90d3e7e69b92f3",
            "c402a77e5a1fc0f9d7ae4689cb0b4b0b8f69d46f77f31e3121d465be62cf09fc"
          ],
          [
            "ae_lab_eq_new",
            "work_eq_new",
            "cc7137d73744cd724b0ffdb89268cd6f93f390c2c6c23aea47b5415549191ace",
            "cf8109abaaba7ff09b48317564286c9128933baa53e3b7d1d2db9c96e07565d6"
          ]
        ],
        "audits": [
          [
            "ae_lab_eq",
            "shop_a",
            "c_eq"
          ],
          [
            "ae_lab_eq_new",
            "shop_a",
            "c_eq"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SEM-TWO-SHOPS",
      "family": "legitimate_progress",
      "classification": "tested_refuted_hypothesis",
      "detail": "digests_differ=True rows=[('shopa', 0, 0, 0, '0c04f5a7b94c2b6f9372512df47ceb82b86a8b7d4eb75166220ce1e83384df8d'), ('shopb', 0, 0, 0, 'd35cc4e2afaf81cbe0a337d9c5b692abb652d56f55c939a9cd2b45656ddbded7')]",
      "schedule": {},
      "snapshot": {
        "captures": [
          [
            "oac_89d2e5c6811567ceb3e67b3c6307d34ccb3f0113aec007b57b2f90b496eb81e2",
            "cmd_same",
            "ident_same",
            "d35cc4e2afaf81cbe0a337d9c5b692abb652d56f55c939a9cd2b45656ddbded7",
            false,
            null,
            "work_shopb",
            "gen_b"
          ],
          [
            "oac_e4c902afe366ce4412d48d7238a313694e9362b42fffe35423fe3922f7129539",
            "cmd_same",
            "ident_same",
            "0c04f5a7b94c2b6f9372512df47ceb82b86a8b7d4eb75166220ce1e83384df8d",
            false,
            null,
            "work_shopa",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_shopa",
            "BOUND",
            true,
            "0c04f5a7b94c2b6f9372512df47ceb82b86a8b7d4eb75166220ce1e83384df8d",
            "oac_e4c902afe366ce4412d48d7238a313694e9362b42fffe35423fe3922f7129539",
            "gen_a",
            "shop_a"
          ],
          [
            "work_shopb",
            "BOUND",
            true,
            "d35cc4e2afaf81cbe0a337d9c5b692abb652d56f55c939a9cd2b45656ddbded7",
            "oac_89d2e5c6811567ceb3e67b3c6307d34ccb3f0113aec007b57b2f90b496eb81e2",
            "gen_b",
            "shop_b"
          ]
        ],
        "links": [
          [
            "ae_lab_shopa",
            "work_shopa",
            "cfdd96b815f856b55b570ca79eed83a479ea341017de2bdf22ab4d302251a657",
            "0c04f5a7b94c2b6f9372512df47ceb82b86a8b7d4eb75166220ce1e83384df8d"
          ],
          [
            "ae_lab_shopb",
            "work_shopb",
            "c2e0ad6b6e57382a70f5c34a1d94aa6f79ba25283844e4de8b51e54137fe60c1",
            "d35cc4e2afaf81cbe0a337d9c5b692abb652d56f55c939a9cd2b45656ddbded7"
          ]
        ],
        "audits": [
          [
            "ae_lab_shopa",
            "shop_a",
            "c_same"
          ],
          [
            "ae_lab_shopb",
            "shop_b",
            "c_same"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SEM-EMPTY-NULL-UNICODE",
      "family": "canonicalization",
      "classification": "tested_refuted_hypothesis",
      "detail": "empty body is a real digest; NULL argument to the STRICT function is NULL",
      "schedule": {
        "empty": "e4fe34625290d844f1900a720b78cac211a6d5b8e295650e80b40acad7cd969f",
        "nfc": "7ce17ec3f58cee49aa34637492307a6a96371beb66c876d4916002f8111610c8",
        "nfd": "aaccfbc03487f945d5badb96234c8bfdcefa12c59b5c25b5c6227422dba396d2",
        "nfc_equals_nfd": false,
        "sql_null": null
      },
      "snapshot": {
        "captures": [],
        "origins": [],
        "links": [
          [
            "ae_lab_empty",
            "work_empty",
            "1819e47306a23dcac8879fcaf1ef787a39f073001fafd5a9951fabee9f065bf9",
            "e4fe34625290d844f1900a720b78cac211a6d5b8e295650e80b40acad7cd969f"
          ]
        ],
        "audits": [
          [
            "ae_lab_empty",
            "shop_a",
            "c_empty"
          ]
        ],
        "sightings": [],
        "active_barrier_191167": 0
      },
      "classification_note": "contract_ambiguity",
      "unicode_note": "Plan says canonical source content and does not specify NFC. Executable hash is byte-exact UTF-8, so NFC and NFD differ. Reported as ambiguity, not a defect."
    },
    {
      "id": "SEM-UNICODE-NFC-NFD",
      "family": "canonicalization",
      "classification": "contract_ambiguity",
      "detail": "NFC and NFD customer-body strings hash differently. No approved NFC rule is stated beyond the positional UTF-8 join.",
      "schedule": {
        "nfc": "7ce17ec3f58cee49aa34637492307a6a96371beb66c876d4916002f8111610c8",
        "nfd": "aaccfbc03487f945d5badb96234c8bfdcefa12c59b5c25b5c6227422dba396d2",
        "equal": false
      },
      "snapshot": null
    },
    {
      "id": "SEM-HISTORICAL-RETRY",
      "family": "committed_idempotency",
      "classification": "tested_refuted_hypothesis",
      "detail": "retry=0 newer=effect_digest_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,te",
      "schedule": {},
      "snapshot": {
        "captures": [
          [
            "oac_76dc53d7caf9fddf47f9f2c792e6d03eeb8706b0c8628f49b89e2cf9a3677cc4",
            "cmd_hist",
            "ident_hist",
            "660b9ed8c084d4fa51b7fafe7fc7fa874bf67adfc344d3022d3c46fb2d0b5902",
            true,
            "QUEUED_INBOX",
            "work_hist",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_hist",
            "BOUND",
            true,
            "660b9ed8c084d4fa51b7fafe7fc7fa874bf67adfc344d3022d3c46fb2d0b5902",
            "oac_76dc53d7caf9fddf47f9f2c792e6d03eeb8706b0c8628f49b89e2cf9a3677cc4",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_hist",
            "work_hist",
            "a5a426b564264b3b9ca211b5f97069df2455bf60239111217e9e03c508ae31c5",
            "660b9ed8c084d4fa51b7fafe7fc7fa874bf67adfc344d3022d3c46fb2d0b5902"
          ]
        ],
        "audits": [
          [
            "ae_lab_hist",
            "shop_a",
            "c_hist"
          ]
        ],
        "sightings": [
          [
            "sight_hist",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SEM-GUC-NOT-CAPABILITY",
      "family": "exact_effect_binding",
      "classification": "tested_refuted_hypothesis",
      "detail": "effect_tenant_mismatch\nCONTEXT:  PL/pgSQL function public.stocky_apply_bound_customer_effect(text,text,text,text,text,text,text,text) line 52 at RAISE",
      "schedule": {},
      "snapshot": {
        "captures": [],
        "origins": [
          [
            "work_guc",
            "BOUND",
            true,
            "6a9c4367b8856895f4cc26df412947ee0ac0e10023ff18aefe23ccb1519762b3",
            "oac_5280977d31cd1fae74aa8b12c8767305b7a6337519e3a4e47bee8fee76d69462",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "SEM-BYPASS-DIRECT-INSERT",
      "family": "bypass",
      "classification": "tested_refuted_hypothesis",
      "detail": "permission denied for table OriginalAdminCapture",
      "schedule": {},
      "snapshot": null
    },
    {
      "id": "SEM-EVIDENCE-EXPIRY",
      "family": "evidence_expiry",
      "classification": "contract_ambiguity",
      "detail": "Q-008 remains open. The extracted contract has no evidence TTL. Missing ADMIN capture is denied (SEM-SOURCE-CLASSES). No retention period was invented.",
      "schedule": {},
      "snapshot": null,
      "question": "Q-008"
    },
    {
      "id": "SEM-CROSS-CLASS-SAME-SOURCE",
      "family": "source_classes_child",
      "classification": "tested_refuted_hypothesis",
      "detail": "webhook of an already-admitted source digest: admission_digest_conflict\nCONTEXT:  PL/pgSQL function public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,tex",
      "schedule": {},
      "snapshot": {
        "captures": [
          [
            "oac_09997f1153c03d68aadd6d96adb23344010469d393b19079de567cb89fb26250",
            "cmd_cross",
            "ident_cross",
            "ac8156643e0e602a13bc1c82f469d2c79b18d801f187d089716eb61aa2514c11",
            false,
            null,
            "work_cross",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_cross",
            "BOUND",
            true,
            "ac8156643e0e602a13bc1c82f469d2c79b18d801f187d089716eb61aa2514c11",
            "oac_09997f1153c03d68aadd6d96adb23344010469d393b19079de567cb89fb26250",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [],
        "audits": [],
        "sightings": [],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "FINAL-HASH",
      "family": "preservation",
      "classification": "tested_refuted_hypothesis",
      "detail": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
      "schedule": {},
      "snapshot": null
    },
    {
      "id": "MINIMIZE-NONE",
      "family": "minimization",
      "classification": "tested_refuted_hypothesis",
      "detail": "No suspected defect required a pristine rerun.",
      "schedule": {},
      "snapshot": null
    }
  ],
  "counts": {
    "cases": 15,
    "reproduced_defect": 0,
    "tested_refuted_hypothesis": 13,
    "harness_failure": 0,
    "contract_ambiguity": 2,
    "unexecuted_application_integration": 0
  }
}
<!-- GROK47-EVIDENCE:end name=b-sweep0 -->

### mutation

sha256 `20e3b54e224f9be258487e522c034690350e586d94fbbad6eae447f11bfe9766` bytes `3413`

<!-- GROK47-EVIDENCE:begin name=mutation -->
{
  "h": "3cc2045107b54601c6b0e43c8690b7d090074b80",
  "contract_sha256": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
  "seed_sha256": "d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632",
  "limits": {
    "actors_per_schedule": 3,
    "seeds": [
      17001,
      17002,
      17003,
      17004,
      17005,
      17006,
      17007,
      17008
    ],
    "lock_observe_seconds": 2.0,
    "poll_seconds": 0.02,
    "holder_release_timeout_seconds": 20,
    "uncertain_attempts": 6,
    "serial_permutations_bound": 6,
    "statement_timeout": "20s",
    "waiter_lock_timeout": "8s"
  },
  "postgres_note": "caller records server version",
  "cases": [
    {
      "id": "MUT-SINGLE-EFFECT-RECHECK",
      "family": "mutation_control",
      "classification": "tested_refuted_hypothesis",
      "detail": "Removing only the effect freshness recheck lets a sighting-first effect commit. Fresh effect still commits. Original file not edited.",
      "schedule": {
        "sight_rc": 0,
        "effect_rc": 0,
        "fresh_rc": 0,
        "audits": 1
      },
      "snapshot": {
        "captures": [
          [
            "oac_8c6e719d8386a6fb8bcd126f7d9c3ad1fe886aeed11b42a8ffef14a1fbd5a2c9",
            "cmd_mut1",
            "ident_mut1",
            "aa3c876ae3c60bf34f24a577f9145ac9beb909a45278b30da7699d7eaaea7aa4",
            true,
            "QUEUED_INBOX",
            "work_mut1",
            "gen_a"
          ]
        ],
        "origins": [
          [
            "work_mut1",
            "BOUND",
            true,
            "aa3c876ae3c60bf34f24a577f9145ac9beb909a45278b30da7699d7eaaea7aa4",
            "oac_8c6e719d8386a6fb8bcd126f7d9c3ad1fe886aeed11b42a8ffef14a1fbd5a2c9",
            "gen_a",
            "shop_a"
          ]
        ],
        "links": [
          [
            "ae_lab_mut",
            "work_mut1",
            "9f6b3e6a950c768bde07c243a13f7e30439ef70a034b4027fef1b9df929551a8",
            "aa3c876ae3c60bf34f24a577f9145ac9beb909a45278b30da7699d7eaaea7aa4"
          ]
        ],
        "audits": [
          [
            "ae_lab_mut",
            "shop_a",
            "c_mut"
          ]
        ],
        "sightings": [
          [
            "sight_mut",
            "QUEUED_INBOX",
            false
          ]
        ],
        "active_barrier_191167": 0
      }
    },
    {
      "id": "MUT-HASH-RESTORED",
      "family": "mutation_control",
      "classification": "tested_refuted_hypothesis",
      "detail": "before=d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318 after=d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
      "schedule": {},
      "snapshot": null
    },
    {
      "id": "FINAL-HASH",
      "family": "preservation",
      "classification": "tested_refuted_hypothesis",
      "detail": "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318",
      "schedule": {},
      "snapshot": null
    },
    {
      "id": "MINIMIZE-NONE",
      "family": "minimization",
      "classification": "tested_refuted_hypothesis",
      "detail": "No suspected defect required a pristine rerun.",
      "schedule": {},
      "snapshot": null
    }
  ],
  "counts": {
    "cases": 4,
    "reproduced_defect": 0,
    "tested_refuted_hypothesis": 4,
    "harness_failure": 0,
    "contract_ambiguity": 0,
    "unexecuted_application_integration": 0
  }
}
<!-- GROK47-EVIDENCE:end name=mutation -->
