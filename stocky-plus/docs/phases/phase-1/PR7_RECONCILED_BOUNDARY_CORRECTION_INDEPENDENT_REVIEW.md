# PR7 reconciled boundary correction — independent review (PR45 + PR49)

**Verdict: `APPROVE PR45/PR49 BOUNDARY CORRECTIONS`**, with one new non-blocking P3 (`F-CLAUDE-PR7PR49-02`) given an explicit disposition below.

This is a review-only artifact. It does **not** accept the overall PR7 plan, authorize PR7 runtime, accept PR49 as a whole, merge, or mark anything ready. PR6 **CLOSED**; Phase 1 **IN PROGRESS**; R-176 **OPEN / P0**; R-164 unchanged; Q-008 **OPEN**; D-054, **no D-055**.

## 1. Identity and authority

| Field | Value |
|---|---|
| Work order | PR45 comment `5881277339` (OWNER) |
| Authority | issue #52 `5794206091` (disposition), `5796056327` (reconciliation), `5881269429` (native resumption), `5881281106` (work order posted) |
| Dispatch-Key | `propo:5794206091:PR45_PR49_CORRECTION_REREVIEW:b319b7a3262de1ccfc26c60f653a451ee1eec9cc+44fa47f1fdb29f60d34c099ce7580807dad1c1f6:claude-review` |
| Claim | PR45 comment `5881350518` |
| Reviewer | actual Claude Code, Anthropic cloud container, session `session_01QQEmBMhUW2VxnfeytzLFXW`; model as reported by the runtime to this session: `claude-opus-5-5`. Owner-started manual run. No `get_session` metadata tool was available in this session, so that metadata was not read |
| PR45 subject | `b319b7a3262de1ccfc26c60f653a451ee1eec9cc` on `cursor/planning-pr7-audit-roles-privacy-20260916-63ef`; sole parent H `3cc2045107b54601c6b0e43c8690b7d090074b80` |
| PR49 subject | `44fa47f1fdb29f60d34c099ce7580807dad1c1f6` on `cursor/planning-pr7-final-boundary-evidence-20260920-b58d`; sole parent E `d63629077fcf29775c69161372c2cf903cfa62c6` |
| Evidence baseline X | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` (merge base of both subjects) |
| Main at review N | `ee77e4bf1e2fa3bf9642ec6b2e51657533ca0298` (X is an ancestor). Governance is read from N; pinned experiments stay on X |
| Prior immutable Claude review | `0677ef0a283b302e705a1a663d8b26582c239984`, sole parent H, blob `4bb936918c65ab6399f080d31b8f3bcf61ac96d1`. **Unchanged.** Branch `claude/pr45-reconciled-source-provenance-review` still points at it |

Both live heads matched the work order when this review started, and both PRs were still OPEN / DRAFT / UNMERGED. No earlier claim or result for this key existed on PR45, PR49 or issue #52.

On attribution: the prior artifact's opening sentence and its findings table disagree. The coordinator's disposition `5794206091` applies here: **SP-01 is against PR45 and PR49-01 is against PR49**. I use that mapping and did not edit the old artifact.

## 2. Scope verification

| Check | Result |
|---|---|
| H → PR45 | exactly 2 paths, both `M`: `PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md`, `PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md` (+104/−11) |
| X → PR45 | 17 paths, all `.md` |
| E → PR49 | exactly 2 paths, both `M`: the AUTH and EFF evidence documents (+268/−41) |
| X → PR49 | exactly 2 added paths (same two documents) |
| `git diff --check` H→PR45, E→PR49 | exit 0, exit 0 |
| Immutable reviews and controls | untouched by construction: H→PR45 changes only the two proposals, so the nine review blobs and six control files are byte-identical to H |
| Runtime / schema / packages / CI | unchanged. Both diffs are docs only; lockfile `6e3fbc2e…` is identical |
| PR49 document hashes | AUTH `0f49b18a9e2471f4e1adc7fee01dcc515f10a51ecdcbd0061042d96b0e24c39a`, EFF `aa0a077f39c70efe70cd25b6095a7b22362c1592271d24fa9606429375f8812f` (match declared) |

**Main drift (recorded only, not solved).** `git merge-tree --write-tree N b319b7a…` exits 1 with a content conflict in `stocky-plus/docs/PROJECT_STATUS.md`. `git merge-tree N 44fa47f…` exits 0 (clean). So the "PR45 mergeable=false" state comes from PROJECT_STATUS drift after #58/#65. It is a later integration gate and has nothing to do with the correction reviewed here. The PR45 body still describes H `3cc2045…`, not the live head. That is stale, and the coordinator already noted it.

## 3. PR45 — F-CLAUDE-PR7SP-01 (P3): **CLOSED**

Clean `git archive` of `b319b7a…`. The extractor was bootstrapped from the plan's `PROOF-EXTRACT` markers following §14. This environment has Python 3.11.15; the packet documents 3.12.3.

| Command | Exit | Output |
|---|---|---|
| bootstrap → `00_extract_proofs.py` | 0 | sha256 `4b31d5663d3c20e39180758625b0d6a9a6a93f971d4a87ac56c9d1b78aa7d068`, which matches the §14 table and manifest |
| `00_extract_proofs.py --plan PLAN --selftest` | 0 | `extraction_authenticity_limit:coordinated_in_repo_edit_not_prevented`, `extraction_selftest_ok` |
| `00_extract_proofs.py --plan PLAN --dest …` | 0 | all 14 manifest inputs extracted and hash-verified |

**Independent injections.** These came from my own harness (`inject.py`), which drives the published PR45 extractor CLI against mutated disposable copies of the plan. The published inputs were never edited. Result: **21 / 21 behave as required.**

| Mutation | Result |
|---|---|
| valid plan | rc 0 |
| exact byte-identical duplicate of `files[0]`, `files[3]` and the last row, inserted **first / last / adjacent** (9 cases) | all rc 1 `extraction_manifest_duplicate_path:<path>` |
| identical duplicate with JSON keys reordered | `extraction_manifest_duplicate_path` |
| identical triplicate | `extraction_manifest_duplicate_path` |
| conflicting-hash duplicate, first / last | `extraction_manifest_duplicate_path` (now caught before the table check) |
| manifest row removed | `extraction_table_missing_manifest_path` |
| extra unmapped entry | `extraction_table_unmapped_path` |
| version change | `extraction_manifest_version` |
| one-sided manifest hash | `extraction_table_manifest_mismatch` |
| one-sided §14 table hash | `extraction_table_manifest_mismatch` |
| §14 table row removed | `extraction_table_missing_path` |
| path variant `./current/02_seed.sql` | `extraction_table_unmapped_path` |

**Original defect reproduced on H.** H's published extractor `70684794…` **accepts** the byte-identical duplicate in all three positions (rc 0). It still rejects conflicting duplicates, but only through `extraction_table_manifest_mismatch`. That is exactly what the prior finding described.

**Negative control (single mutation).** On a disposable copy of the PR45 extractor, I replaced the body of `reject_duplicate_manifest_paths` with `return None` (copy sha256 `0d114703…`). One helper feeds all three call sites. With that change:
- byte-identical duplicates (first / last / adjacent / triplicate) are **accepted again** (rc 0);
- the **published `--selftest` catches the removal**: `extraction_selftest_should_fail:byte_identical_duplicate_path_second`, exit 1.

I then deleted the copy and re-ran the published extractor (`4b31d566…`): `extraction_selftest_ok`, exit 0. The published inputs were not repaired or changed at any point.

### Model equivalence and execution

H and PR45 extracted trees differ in **only** `00_extract_proofs.py` (both copies) and `proof_manifest.json`. The manifest diff is the single extractor row. Every model input is byte-identical to independently reviewed H:

`01_contract.sql` `d4c21ff9…`, `02_seed.sql` `d0d84842…`, `03_run_proofs.py` `d24afa33…`, `04_discover_writers.py` `666feaa8…`, `04_source_derived.sql` `9f7aaa26…`, `regenerate_lower_bound.py` `c79b03ad…`, `reproduce_do01_overlap.py` `b7c6e6da…`, option-(a) `75a16828…`.

The driver never reads the extractor or the proof manifest. So H's **505 = 290 + 215** transfers by equivalence, and the prior review's attribution stands.

I also re-executed the complete model this session, as extra evidence beyond the equivalence argument:

| Field | Value |
|---|---|
| Command | `PROOF_ROOT=… PGHOST=/var/lib/postgresql/r12 PGPORT=5461 python3 03_run_proofs.py` |
| Cluster | disposable, owned: PGDATA `/var/lib/postgresql/r12/data`, socket-only, port 5461 |
| Result | exit 0: **505 records / 505 PASS / 0 FAIL = 290 unique + 215 declared reruns** |
| PostgreSQL | 16.13 (`160013`); the packet recorded 16.15 |

505 is **not** a unique-assertion count. S's 416/244/172 remains S evidence. RE-01, RE-02 and AO-06 closures are preserved, and no regression was observed.

## 4. PR49 — F-CLAUDE-PR7PR49-01 (P2): **CLOSED as an evidence correction**

### Reproduction from a clean export of `44fa47f…`

**Environment.** Node v22.22.2. I installed npm 11.5.2 in a private prefix, because `.npmrc` sets `engine-strict=true`. I ran `npm ci --ignore-scripts` from the X lockfile (`6e3fbc2e…`, unchanged), then `npx prisma generate`. That step was my own environment repair, needed because `--ignore-scripts` skipped client generation. No package, lockfile or probe was edited.

| Command | Exit | Result |
|---|---|---|
| AUTH bootstrap / `--selftest` / extract | 0/0/0 | `extraction_selftest_ok` |
| EFF bootstrap / `--selftest` / extract | 0/0/0 | `extraction_selftest_ok` |
| `check_pins.py --kind auth …` | 0 | `ok: true`, lockfile `6e3fbc2e…` |
| `check_pins.py --kind effects …` | 0 | `ok: true` |
| AUTH `reproduce.sh` (`STOCKY_PLUS_ROOT=<export>/stocky-plus`) | 0 | **35 / 30 PASS / 5 FAIL / 0 other**. `assert_taxonomy` `ok`, `errors: []`. 73 fetch calls, **73/73 `mocked`**. `liveShopify: UNVERIFIED`. FAIL = AUTH-X-06, 07, 09, 14, 21 |
| EFF `reproduce.sh` (private Redis 7.0.15 on `127.0.0.1:19581`) | 0 | `assert_taxonomy` `ok`, `errors: []`. **24 observed ids** including `EFF-X-02d`. All probes `fatal: null`. EFF-X-06b `INCONCLUSIVE`, EFF-X-00 `UNEXECUTED` |

- **AUTH inputs.** The extracted AUTH input set is byte-identical to E. The AUTH correction is prose only.
- **EFF inputs.** Changed: `01-publication-boundary.mjs` (`2b06527b…` → `dbdceb36…`, adds 02d), `expected_taxonomy.json` (`daf4ddbc…` → `094a05f4…`), and in `03-shop-isolation.mjs` only the note string.
- **Worker.** `publication-worker.mjs` is `4394d813bff34b8196be9c249b4c325793e60b492682a42c5e3f4fdd76bb53c7`, byte-identical to E.

### Published EFF-X-02d (this run)

| Field | Value |
|---|---|
| Assertion | PASS as negative evidence |
| `late_write_landed` | `true` |
| Payload generation | `gen-1` |
| Current generation at write | `gen-2` |
| `sink_absent_immediately_before_generation_flip` | `true` |
| `wchan_after_go` | `wait_for_partner` |
| `refuse_absent_for_in_flight` | `true` |
| `post_flip_retry_refused` | `true` |
| `unrelated_shop_b_write_observed` | `true` |

The published case sequences with `sleep(150)`, not a positive handshake, and its `fifo_open_visible_in_procfd` was `false`. It is still sound. The worker reads generation, **then** the shop-fence FIFO, **then** writes, and its assertion requires the `gen-1` payload to land while the file reads `gen-2`. A slow worker would therefore produce a FAIL, never a false PASS.

### Independent reviewer replay (`rv02d.mjs`, sha256 `c7e216aa…`)

This replay uses the published worker **byte-unmodified** (hash re-computed at run time: `4394d813…`) on the same private Redis, with a unique queue per schedule. It adds a **kernel-level handshake**: the flip happens only after `/proc/<pid>/wchan == wait_for_partner` and `/proc/<pid>/syscall` = `257` (`openat`), i.e. the worker is blocked opening the shop-fence FIFO after its generation check. Exit 0.

| Schedule | Observed |
|---|---|
| A — barrier before the fence read | refused `stale_generation_publish_refused`; no sink ✅ |
| **B — barrier between the last generation read and the write** | handshake `wait_for_partner` / `openat`. Sink absent before flip; flip to `gen-2`; **sink lands with `generation: "gen-1"`**; no refusal ❌ (expected unsafe) |
| B2 — **shop** barrier (the last read) committed while blocked in that read | refused `shop_fence_publish_refused`; no sink ✅ |
| C — barrier after the write | sink present after flip; cannot un-write ✅ |
| D — post-flip retry of the same stale payload | refused; no sink ✅ |
| E — unrelated tenant, current-generation payload | writes ✅ |
| F — unrelated tenant carrying a `gen-1` payload | refused (see O-1) |

B2 matters. It shows the unsafe window is precisely *after the last fence read returns*. A barrier that lands before the final read is honoured; one that lands after it is not. That is check-then-act, exactly as PR49 now states.

### Document review

- **Wording.** PR49 now labels the modeled mode check-then-act and "not an atomic fence". It publishes 02d as negative evidence. It keeps application integration **UNEXECUTED** and says negative model evidence does not prove runtime is fixed.
- **Required contract.** It restates the frozen-H §7.6.2 restriction 2 verbatim: serialize publication with the privacy barrier, **or** sink-enforced generation/target fencing, **or** positive drain of that writer and its outstanding I/O. It no longer presents proximity as fencing.
- **Scope limits.** The whole-shop-only `ERASING` fence and the absence of a customer-target gate are stated in §3, §4 and §7, and in the 07b note. EFF-X-06b stays INCONCLUSIVE. The EFF-X-03 SIGKILL residual remains a pre-death write. The EFF-X-13 drain remains job-scoped.
- **Nothing overclaimed.** Neither this model nor this review proves the future integration exists. The obligation remains for PR7 runtime.

### AUTH taxonomy and defect mapping

The executed taxonomy is preserved: **35 / 30 / 5**. The eight adjudicated library defects are now carried separately, with a mapping table in §8 that I checked row by row against the matrix:

| Defect | Supporting rows |
|---|---|
| #1 session-id mismatch | FAIL 06/07/21 |
| #2 number ids | PASS 00/04/05/23/28 |
| #3 iss/dest | FAIL 14 |
| #4 stale cache | FAIL 09 |
| #5 offline fallback | PASS 27 |
| #6 missing `access_token` | attempt 03 |
| #7 opaque 500 | attempts 01/02/05 |
| #8 stdout log | PASS 34 |

The table is correct. §3 and §8 still say X's `shopifyApp` / `afterAuth` / `requireAdminTenant` were not driven, and `harness.mjs` confirms this: it builds its own `shopifyApp` with in-memory storage and a global `fetch` mock. The official oracles were not re-fetched this session. The prior review verified them live on 2026-09-23 and the AUTH inputs are unchanged since.

## 5. New finding

### F-CLAUDE-PR7PR49-02 — P3 — AUTH §8 prose miscounts the FAIL-to-defect relationship

| Field | Detail |
|---|---|
| File | `stocky-plus/docs/phases/phase-1/PR7_INSTALLED_AUTH_BOUNDARY_EVIDENCE.md`, §8 opening paragraph (the line beginning "Executed taxonomy remains **35 / 30 PASS / 5 FAIL**") and the "PASS rows that intentionally observe unsafe library behavior" line below the table (`44fa47f…`) |
| Evidence | The prose says "FAIL rows AUTH-X-06/07/09/14/21 are five of the eight; the other three are observed on PASS (auth ok) or harness-attempt rows." The mapping table directly below contradicts it: the five FAIL rows support only **three** defects (#1, #3, #4), and **five** defects (#2, #5, #6, #7, #8) are evidenced only on PASS or attempt rows. The follow-up line lists PASS rows 04/05/23/27 but omits PASS rows AUTH-X-00, AUTH-X-28 and AUTH-X-34, which the same table cites for defects #2 and #8 |
| Merchant impact | None directly; this is documentation. However, it re-creates the conflation the correction was meant to prevent: a reader could assume each FAIL row is a distinct defect and under-weight the defects that only appear on PASS rows |
| Reproduction | Read §8 prose against the §8 table and the §6 matrix rows 00/04/05/06/07/09/14/21/23/27/28/34 |
| Expected | "The five FAIL rows evidence three of the eight defects (#1, #3, #4); the other five defects are observed only on PASS or attempt rows." List every PASS row the table cites |
| Recommended correction | Two-sentence wording fix in the AUTH document on a later PR49 edit. No executed evidence changes |
| Missing test | Not applicable (prose). Optionally add a mechanical check that every ID cited in the §8 table exists in the matrix with the stated result |

**Disposition: non-blocking.** The authoritative mapping table is correct and executed results are unaffected. It is recorded for correction when PR49 is next edited, and does not hold this verdict. ChatGPT decides scheduling.

## 6. Observations (not findings)

- **O-1 — generation counter scope.** The modeled generation is one global file. "Unrelated tenant progresses" holds only for a current-generation payload; an unrelated tenant with a `gen-1` payload is refused (schedule F). PR49's wording ("shop-B with current generation") is accurate. The model simply does not demonstrate per-tenant generation isolation, which the future sink-enforced fence would need to be keyed on.
- **O-2 — empty generation file.** The modeled worker's generation check is `if (current && current !== generation)`, so an empty or missing generation file lets the write through. This is pre-existing, unchanged since E, and model only. A real sink-enforced fence must fail closed.
- **O-3 — stale PR45 body.** The PR45 description still describes H, not the live head.

## 7. Evidence classification

- **Executed and passed (this session):**
  - PR45 bootstrap, selftest and extract;
  - 21 extractor injections;
  - H baseline reproduction of the defect;
  - removed-defense control plus restore;
  - complete model 505/505 = 290 + 215;
  - PR49 AUTH and EFF selftest, extract, pins and `reproduce.sh`;
  - reviewer 02d replay (7 schedules);
  - `git diff --check` on both diffs;
  - N classifier on X→PR45 (17 paths) and X→PR49 (2 paths): `docs_only=true`, `full_ci=false`, `every_changed_path_is_docs_allowlist`;
  - classifier self-test `assertions=40 pass=40 fail=0`.
- **Executed with expected unsafe result:** EFF-X-02d stale write landed (published run and reviewer schedule B). H extractor accepts the byte-identical duplicate. The removed-defense copy accepts duplicates.
- **Executed and failed:** none.
- **Reused (attributed):** H's 505/290/215 and the RE-01/RE-02/AO-06 closures, from prior review `0677ef0a…` / PR45 comment `5794032197`, transferred by input equivalence and also re-run here. S 416/244/172 remains S evidence. Official Shopify oracle verification is from the same prior review. Cursor's SP-01 run (`bc-96502db7…`) and PR49 result `5794378462` are author evidence and were **not** relied on.
- **Exact-head CI (read, not re-run):**
  - PR45 run `35864866486`, attempt 1, `pull_request`, head `b319b7a…`: Classify `107193784618` SUCCESS, Heavy `107193830395` SKIPPED, Gate `107193829375` SUCCESS.
  - PR49 run `35857351326`, attempt 1, `pull_request`, head `44fa47f…`: Classify `107168901879` SUCCESS, Heavy `107168953386` SKIPPED, Gate `107168952252` SUCCESS.
  - Both are historical docs-only checks against X, not merge readiness on N.
- **Not executed:**
  - live Shopify, Partners or merchant data;
  - X's configured `shopifyApp` / `afterAuth` / `requireAdminTenant`;
  - installed PR7 processors and privacy adapters (`stocky-webhooks` / `stocky-cron`);
  - remote object store;
  - D-scratch beyond the packet's own EFF probe;
  - PR6 corpus and whole-application benchmarks (not required);
  - merge onto N.

## 8. Isolation and teardown

This was a fresh container with nothing pre-existing on 5461, 18379, 19379, 19479 or 19581, and 6379 at `connect_ex = 111` before and after.

- **PostgreSQL.** My only cluster was `/var/lib/postgresql/r12/data` on socket-only port 5461. I ran `dropdb pr45_proof`, then `pg_ctl stop -m fast`.
- **Redis.** My only Redis was PID 4611 on `127.0.0.1:19581` (`--save "" --appendonly no`), stopped with `redis-cli -p 19581 shutdown nosave`.
- **Workers.** The four reviewer worker PIDs 5141/5154/5168/5180 received exact-PID SIGKILL; probe-owned workers were killed by the probes' own `ownedPids`.
- **Final state.** 5461, 19581 and 6379 all at `connect_ex = 111`.
- **Not done.** No FLUSHALL, no pkill, no foreign port or PID touched, no production or Shopify call, no credentials used.

## 9. Unchanged subjects

PR45 remains at `b319b7a…` and PR49 at `44fa47f…`. Neither was edited, re-labelled, rebased or re-run. This artifact is the only file added, on branch `claude/pr45-pr49-boundary-correction-rereview`, in one commit whose sole parent is `b319b7a3262de1ccfc26c60f653a451ee1eec9cc`. The branch has no publication PR and is not integrated into either subject.

## 10. Verdict

**`APPROVE PR45/PR49 BOUNDARY CORRECTIONS`**

| Finding | Severity | Subject | Status |
|---|---|---|---|
| F-CLAUDE-PR7SP-01 | P3 | PR45 | **CLOSED** |
| F-CLAUDE-PR7PR49-01 | P2 | PR49 | **CLOSED** (evidence correction; runtime obligation unchanged and UNEXECUTED) |
| PR49 AUTH taxonomy clarification | — | PR49 | **CLOSED**, subject to the P3 below |
| PR49 whole-shop scope clarification | — | PR49 | **CLOSED** |
| F-CLAUDE-PR7PR49-02 | P3 | PR49 | **OPEN, non-blocking**; prose-only correction on a later PR49 edit |
| RE-01 / RE-02 / AO-06 | — | PR45 | preserved closed |

The approval covers only these two corrections. It does not authorize overall PR7 plan acceptance, PR7 runtime, merge, production, flags or scopes. The runtime publication contract (serialize with the barrier, or sink-enforced generation/target fence, or positive drain of that writer) remains an unexecuted requirement for PR7 implementation. PR45 merge readiness on current main is a separate later gate: `PROJECT_STATUS.md` conflicts with N.
