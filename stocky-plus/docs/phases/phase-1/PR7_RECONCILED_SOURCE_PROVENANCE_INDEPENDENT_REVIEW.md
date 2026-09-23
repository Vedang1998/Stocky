# Phase 1 PR7 — Reconciled-source provenance independent review

**Outcome: CORRECTIONS REQUIRED**

One unresolved **P2**, one **P3** — both against the **PR49 boundary-evidence packet**, not against this PR45 head. **F-CLAUDE-PR7RE-01, F-CLAUDE-PR7RE-02 and F-CLAUDE-PR7AO-06 are all independently closed at H.** The two P2s I raised on S are gone, and I could not revive either through the schedules the correction authority named.

The reason this is not an approval is narrow and specific: PR49's external-effect packet claims a modeled publication fence "immediately before the sink write", and the one schedule that matters — commit the barrier *after* the fence read and *before* the sink mutation — is absent from all 23 of its cases. I ran it against PR49's own worker, unmodified, and the write landed.

Planning review only. This does **not** accept either plan, authorize PR7 runtime, edit peer branches, mark ready, or merge. PR6 **CLOSED**. Phase 1 **IN PROGRESS**. R-176 **OPEN / P0**. R-164 unchanged. Q-008 **OPEN**. D-054; **no D-055**.

Authority: [PR49 comment 5759453932](https://github.com/Vedang1998/Stocky/pull/49#issuecomment-5759453932). Cursor correction mandate: [`5759445052`](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5759445052). Admission marker: [`5760738230`](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5760738230). Prior review: `22941f177f48ab95343330a05aac29ea1c9a6d4e` (subject S `fd5f7bbd…`, blob `9596e5b9…`).

---

## 0. Headline

RE-01 is fixed at both boundaries the authority demanded, not just the one I found. Consuming a capture whose content has since been sighted as non-fresh now raises `capture_content_no_longer_fresh`, no origin row is minted, and the capture record itself survives — eligibility is invalidated without rewriting history. The harder half is also there: when the admission succeeded *before* the contradictory sighting landed, the effect boundary still refuses with `effect_source_no_longer_fresh` and zero rows are written. That is the "next boundary" the mandate said a one-time admission check must not leave open.

RE-02 is fixed by separating the two commitments rather than by weakening either. `pr7-effect-v1` still includes `effectId` — the AO-02 enforcement I verified at S is untouched — and a new `pr7-source-v1` over tenant, domain, semantic operation, target and canonical source body carries provenance. I re-ran the S attack on the real effect lane: the denied child's source, re-presented under a brand-new command id, source identity, work id and effect id, is refused at capture; the new effect id for the same source is refused at the guard; no replayed row reached `AuditEvent`. A genuinely different source body and an unrelated tenant both still progress, and effect tampering under a valid work id is still denied.

AO-06 does what I recommended and slightly more: the selftest now compares the §14 table, the embedded manifest and the extracted inputs row-for-row, and it prints the honest limit I asked for rather than pretending in-band hashes authenticate anything.

I want to be precise about one thing I got wrong on the first pass. My initial AO-06 negatives appeared to show three failures; they were mutating the wrong JSON block. Testing precisely, a manifest hash edit, a §14 table hash edit, an extra unmapped entry, a duplicate path with a conflicting hash in either order, and a version change are **all** caught. Only an exact byte-identical duplicate row passes, and it carries no disagreement to exploit.

---

## 1. Identity, scope and preservation

H was resolved from the marker **and** the live head, and only after the four admission conditions were checked independently. I did not pin the earlier `e7dd4f42…` push, even though it satisfied the structural conditions, because no marker existed at the time.

| Field | Value | Verified |
|---|---|---|
| Final **H** | `3cc2045107b54601c6b0e43c8690b7d090074b80` | ✅ equals the live PR head |
| H parent chain | `e7dd4f42…` → `22941f17…` (my ninth review) → S `fd5f7bbd…` | ✅ no history rewrite |
| Base **X** | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` | ✅ merge base |
| Prior subject **S** | `fd5f7bbdf18fa12d75371686d8969d67fe68a158` | not approved; its P2s replayed below |
| Clean-export candidate | `e7dd4f42487409f2c5ebd026c7be5b8d70c3764e` | ✅ input equivalence proved, §2.2 |
| PR49 pin **E** | `d63629077fcf29775c69161372c2cf903cfa62c6` | read-only, unchanged |
| Sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` | read-only, untouched |
| Review branch | `claude/pr45-reconciled-source-provenance-review`, rooted exactly at H | ✅ |

**Seventeen-path X→H scope confirmed**; docs-only — no application, schema, migration, grant, dependency, configuration, lockfile or CI path appears anywhere in X→H. **S→H is three paths**: the two mutable proposals and my ninth review integrated unchanged (+346/−0). **The six mechanical controls are byte-identical to S.**

**All nine review blobs verified at H**, including both of mine:

| # | Artifact | Blob |
|---|---|---|
| 1 | `PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md` | `c1fa5c2fed74bf80d1006267b43d767258895c17` ✅ |
| 2 | `PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md` | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` ✅ |
| 3 | `PR7_TOPIC_AUTHORITY_FINALIZATION_INDEPENDENT_REVIEW.md` | `e609e9526ed1ec043551ca68d6b977f5b5935d0c` ✅ |
| 4 | `PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md` | `e908770d9daea4f963b2fd09e38af79e07274d41` ✅ |
| 5 | `PR7_GENERATION_W_INTEGRATION_INDEPENDENT_REVIEW.md` | `1d93b85aa8f61a6255fe2408148f1e5ea97c0b70` ✅ |
| 6 | `PR7_TEMPORAL_ATTRIBUTION_WRITER_COVERAGE_INDEPENDENT_REVIEW.md` | `b7e8ff338e715c79907aa633c75622958f60b4d4` ✅ |
| 7 | `PR7_DURABLE_ORIGIN_CORRECTION_INDEPENDENT_REVIEW.md` | `21b11b4af0adfce8e7044a40131190f001e9756e` ✅ |
| 8 | `PR7_ADMIN_ORIGIN_EFFECT_BINDING_INDEPENDENT_REVIEW.md` | `0c3182469f26b97beb4c23f86fcc2906d11adb5c` ✅ |
| 9 | `PR7_REPRODUCIBLE_EFFECT_REPLAY_PROVENANCE_INDEPENDENT_REVIEW.md` | `9596e5b92f6b56d6d1871b87103eebdb8bf54d77` ✅ |

Proposal blobs at H match the marker exactly: plan `07f86fbf0657fc58ffc2aa99556d402cf09a20a1`, matrix `ad6c610d6da868803bbecdfedd8218af2973146d`.

### 1.1 Exact-head CI

Run [`35601270296`](https://github.com/Vedang1998/Stocky/actions/runs/35601270296), event `pull_request`, attempt **1**, `head_sha = 3cc2045107b54601c6b0e43c8690b7d090074b80`.

| Job | ID | Conclusion |
|---|---|---|
| Classify change set | `106337689402` | SUCCESS ✅ |
| Lint, typecheck, test, build, Prisma, GraphQL | `106337725506` | SKIPPED ✅ |
| CI Gate | `106337725158` | SUCCESS ✅ |

The superseded `e7dd4f42…` run `35600678311` is historical and is not substituted. Documentation CI is packaging evidence, not a pass on the tested properties. **I triggered no Actions run.**

---

## 2. Proof inputs and taxonomy

### 2.1 Extraction from H

Clean `git archive` of H into a directory with no prior proof tree; the §14 bootstrap block run verbatim. Extractor `70684794504734faacf651a09a4f996d20215a1da7e99af9b34684fe8d7d8172`; `--selftest` returns `extraction_authenticity_limit:coordinated_in_repo_edit_not_prevented` followed by `extraction_selftest_ok`. All twelve manifest entries extract.

| Input | SHA-256 |
|---|---|
| `current/01_contract.sql` | `d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318` |
| `current/03_run_proofs.py` | `d24afa331bde236e6ed59243ada670d14b658bd308541b9263df616040c75d85` |
| `current/00_extract_proofs.py` | `70684794504734faacf651a09a4f996d20215a1da7e99af9b34684fe8d7d8172` |
| `current/proof_manifest.json` | `f5f0f0862bb518828ac5ae3f067553bf51d9fec1c14efecee981a5ff6d9cf328` |
| `current/02_seed.sql` | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` (eighth packet, unchanged) |
| `current/04_discover_writers.py` | `666feaa8f77359d75f70ffca5bb84bc91fc9d0e0891656f17d195ef92990220d` (unchanged) |
| `current/04_source_derived.sql` | `9f7aaa26ecdbdf953b284b0813fb81f2693962c64870d7c2e61ea084c0bf6baa` (sixth confirmation) |

### 2.2 Successor equivalence, proved not asserted

The marker's clean-export gate was executed against candidate `e7dd4f42…`, not H. I extracted from **both** commits with the published extractor and diffed the trees: the published `current/` and `historical/` inputs are **byte-identical** (the only differences were `results.json` and `__pycache__`, which my own run created). The `e7dd4f42…`→H diff is 1 line in the matrix and 3 in the plan, all prose recording the gate outcome. The gate therefore transfers to H, and my execution is attributed to H's own extracted bytes.

### 2.3 Taxonomy

On my own PostgreSQL 16 cluster, from H's extracted inputs: **505 records / 505 PASS / 0 FAIL = 290 unique assertions + 215 declared reruns**, independently re-parsed from `results.json` rather than taken from the driver summary.

| Group | records | unique |
|---|---|---|
| G1–G6 | 59 | **59** ✅ preserved |
| G7 / G8 / G9 / G10 | 28 / 14 / 18 / 1 | 14 / 7 / 9 / 1 |
| G11 / G12 / G13 / G14 / G15 | 24 / 20 / 30 / 52 / 58 | 12 / 10 / 15 / 26 / 29 |
| **G16** | 186 | **93** ✅ |
| **NEG** | 15 | **15** ✅ |
| **Total** | **505** | **290** ✅ (reruns **215** ✅) |

Every declared sub-count reconciles. S's **416 / 244 / 172** remains independently established S evidence — I re-ran it in this session from S's own inputs (contract `b55bb88e…`, driver `3edd193b…`) and got exactly that, with G1–G6 = 59, G16 = 50, NEG = 12. PostgreSQL 16.13 here versus 16.15 declared; disclosed, and no result below depends on the minor version.

The marker's two published vectors verify against H's contract: `pr7-source-v1(pr7-a…, shop_a, CUSTOMER_WRITE, CUSTOMER_REST_ID, 191167, ao02-host-body)` = `71e3d9d38a6ae9c7dd86577a323d2254ffb335f8879ddd9282f4095a80fe14f7`, and `pr7-effect-v1(…, ae_pos)` = `959bb90441a81889549f265bd75ef5b84a512486b896023cf4f42f50b2566abd`. Both `SourceEffectLink` unique constraints exist as declared.

---

## 3. RE-01 — CLOSED at both boundaries

### 3.1 The S baseline, re-proved in this session

From S's own published inputs, before touching H:

| Step | S |
|---|---|
| Capture issued | accepted |
| Contradictory `QUEUED_INBOX` sighting committed | accepted, capture not revoked |
| Same capture consumed | **accepted** |
| Recorded provenance | **`BOUND` to live** |
| Guard | **admits** |
| Second capture | refused — the only thing S demonstrated |

A useful sharpening: `stocky_record_writer_admission` at S **already held** `stocky_source_content_lock` before the ADMIN branch. RE-01 was never a missing-lock problem; serialization was in place and the eligibility predicate was simply absent.

### 3.2 H, schedule A — capture → sighting → consume

| Step | H |
|---|---|
| Capture issued | accepted |
| Contradictory sighting committed | accepted |
| Same capture consumed | **`capture_content_no_longer_fresh`** ✅ |
| Origin rows minted | **0** ✅ |
| Capture record | **still present** ✅ — eligibility invalidated, history preserved |

### 3.3 H, schedule B — consume/ACK → sighting → effect

This is the boundary the authority said a one-time admission check must not leave open.

| Step | H |
|---|---|
| ADMIN admitted (ACKed) before any sighting | accepted |
| Contradictory sighting lands afterwards | accepted |
| Effect through `stocky_apply_bound_customer_effect` | **`effect_source_no_longer_fresh`** ✅ |
| `AuditEvent` rows written | **0** ✅ |

The recheck sits after the lock order `fact_write_guard` → `stocky_source_content_lock` and after a post-lock re-read of the origin row, so the linearization point is the same serialization the admission path uses. The gap is not shifted from capture to admission to effect; it is closed at each.

The consume-time check is enforced at **six sites** across two functions — four inside `stocky_record_writer_admission` (covering the existing-capture and duplicate-return shortcuts the authority required be fixed) and two inside `stocky_capture_original_admin_command`. That is genuine defence-in-depth, and it is why my first single-site removal did not revive the counterexample (§6).

---

## 4. RE-02 — CLOSED

### 4.1 The S baseline, re-proved in this session

On S: the child's effect was denied (`customer_target_attribution_ambiguous`), then the same customer value was written under a new effect id — final `AuditEvent` held `ae_relabelled/191167`. The redacted value came back.

### 4.2 H — the attack on the real effect lane

`stocky_effect_commitment` still includes `effectId` (AO-02 intact). `stocky_source_commitment` is a separate `pr7-source-v1` over `(canonicalDomain, shopId, operation, kind, value, sourceBody)` — no work, command, transport or effect identifier. The provenance key compared against `WriterAdmissionOrigin.sourceContentDigest` is the **source** commitment.

| Attack on H | Result |
|---|---|
| Child admitted, effect attempted | **denied** — `customer_target_attribution_ambiguous` ✅ |
| Same source re-captured under a brand-new command id, source identity and work id | **denied** — `queued_work_cannot_acquire_fresh_admin_origin` ✅ |
| Admission of that relabelled source | **denied** ✅ |
| **New effect id for the same source** | **denied** ✅ |
| Replayed rows in `AuditEvent` | **none** — only seed rows remain ✅ |
| Genuinely different source body | **progresses** ✅ |
| Unrelated tenant (`shop_b`) | **progresses** ✅ |
| Target tampered under a valid work id | **denied** — `effect_digest_mismatch` ✅ |
| Second effect for the same source | **denied** — `effect_digest_mismatch` ✅ |

Nineteen probes, nothing unexpected. The fix is on the right side of the authority's line: changing *identifiers* cannot change provenance, while changing the *source body* legitimately is new content — which is correct, and is why no lifetime content blacklist or raw-PII cache was needed.

---

## 5. AO-06 — CLOSED, with one cosmetic residual

The selftest compares the §14 table, the embedded manifest and the extracted inputs row-for-row. My own one-sided edits:

| My negative | Result |
|---|---|
| Manifest `sha256` of `01_contract.sql` changed only | `extraction_table_manifest_mismatch` ✅ |
| §14 table hash cell changed only | `extraction_table_manifest_mismatch` ✅ |
| §14 table row removed only | `extraction_table_missing_path` ✅ |
| Extra manifest entry with no block | `extraction_table_unmapped_path` ✅ |
| Duplicate path, **conflicting** hash appended | caught ✅ |
| Duplicate path, **conflicting** hash inserted first | caught ✅ |
| Manifest `version` changed | `extraction_manifest_version` ✅ |
| Exact byte-identical duplicate row | **accepted** ❌ (see below) |
| Control: unmodified plan | extracts, rc 0 ✅ |

The honest limit is printed rather than papered over, exactly as the authority asked, and no self-hash cycle was invented.

### F-CLAUDE-PR7SP-01 — P3 — an exact-duplicate manifest row is accepted

**File:** `current/00_extract_proofs.py` (published at H), manifest comparison.
**Evidence:** the authority requires "missing/extra/**duplicate**/path/version/hash disagreements must fail". Appending a byte-identical copy of an existing `files[]` entry passes both `--dest` and `--selftest`.
**Merchant impact:** none that I can construct. A duplicate that *disagrees* in any field is caught in both orders, so nothing can be smuggled through the identical case; the row is redundant, not contradictory. I am recording it because the wording says duplicate, not because it is exploitable.
**Expected behaviour:** reject a repeated `path` in `files[]` regardless of whether the rows agree.
**Missing test:** `extraction_manifest_duplicate_identical_row_rejected`.

---

## 6. Negative controls

Each mutation was applied to a disposable copy of H's extracted contract and the declared file restored; the restored file hashes back to `d4c21ff9…`.

| Control | Removal | Counterexample | Kind |
|---|---|---|---|
| Effect-boundary freshness | only the `effect_source_no_longer_fresh` raise (1 site) | RE-01 schedule B effect **writes** | **single** |
| Provenance key | `v_source_digest := v_effect_digest` (reverting to the S defect) | legitimate path breaks (`effect_digest_mismatch`) — the split is load-bearing both ways | **single** |
| Consume-time freshness, admission side | the four raises inside `stocky_record_writer_admission` | **did not revive** — the capture-side check still fired | **composite (4 sites), labelled** |

I report the third honestly as a composite that failed to revive its counterexample, rather than presenting a layered mutation as a single-defence removal. Reviving RE-01 schedule A requires removing all six sites across both functions.

Restoration verified: schedule A refuses again, schedule B refuses again, contract byte-identical.

---

## 7. PR49 adjudication (Stage A)

PR49 **E** `d63629077f…` verified: X is the merge base, exactly the two named evidence documents, AUTH doc `1cf97530…`, EFF doc `524a252d…`, X lockfile `6e3fbc2e…` unchanged. Exact-head run [`35589847523`](https://github.com/Vedang1998/Stocky/actions/runs/35589847523) attempt 1: Classify `106301515586` SUCCESS, Heavy `106301557439` SKIPPED, Gate `106301556550` SUCCESS.

Both packets extract and reproduce from a clean export of E: **AUTH 35 cases / 30 PASS / 5 FAIL**, **EFF all 23 ids**, both taxonomy asserts `ok` with `errors: []`. I installed the pinned dependencies myself; `npm ci` needs npm 11.5.2 because `.npmrc` sets `engine-strict=true`, and with that `check_pins.py --kind auth` returns `ok: true` including the installed `authenticate.mjs` `87b9721b…` and `token-exchange.mjs` `9a7539a4…`. The library under test is the real pinned one.

### 7.1 Authentication — verified, with a counting correction

All five declared failures reproduce, including AUTH-X-06 (user A's first outbound GraphQL carried user B's token `0bc9c117…`), AUTH-X-09 (`exchangeCount: 0, usedStale: true`) and AUTH-X-14 (`iss` other-shop, `dest` this-shop, `libraryRejected: false`). AUTH-X-01's first-outbound token hash is `f54449bc…`, exactly as declared.

I verified the oracle against the live Shopify documentation myself (accessed 2026-09-21): *"iss and dest — The issuer and destination. Their hostnames must match"*, plus `exp`/`nbf`/`aud`, and on the access-token page `associated_user.id` "Uniquely identifies the user. Use it to key per-user data", `email_verified` trusted only when true, and offline-default/online-optional. Every §4 oracle rule holds against the primary source.

The packet does **not** make the false real-X-execution claim the mandate warned about: §3 states plainly that X's `shopifyApp`, `afterAuth` and `requireAdminTenant` were not driven, and `harness.mjs` confirms it builds its own `shopifyApp` with `MemorySessionStorage`. §6 also states up front that PASS/FAIL is the security property, not "did authenticate return 200".

**My independent classification:** four PASS rows are expected observations of *unsafe* library behavior — AUTH-X-04 and -05 (wide ids fold; lookup id ≠ stored id), AUTH-X-23 (owner proof unsupported), AUTH-X-27 (an "online" exchange without `associated_user` yields an offline session). The figure to carry forward is §8's **eight** library defects, not five. 30/5 is not a security acceptance target.

### 7.2 F-CLAUDE-PR7PR49-01 — P2 — the modeled publication fence is check-then-act

Every EFF case is labelled `EXISTING_X` / `MODELED_PROPOSED` / `UNEXECUTED_APPLICATION_INTEGRATION`, and the audits hold: SIGKILL residual is a **pre-death** write (`sink_before_kill` and `sink_after_kill` share sha256 `c5556b69…`, `done_file_after_kill: false`, `power_loss_tested: false`); EFF-X-06b stays **INCONCLUSIVE**; `Job.remove` of an active locked job throws and the processor appended 11 further ticks; EFF-X-13's positive drain is `.done` + `TERMINAL_EXISTING/completed` + sink and is explicitly not shop-wide.

The gap is the schedule the mandate called crucial. EFF-X-02a/04b/07b are barrier-**before**-check; EFF-X-02c is barrier-**after**-write. None commits the barrier *between* the fence read and the sink mutation.

Using the published `probes/publication-worker.mjs` **byte-unmodified** (sha256 `4394d813…`, matching its manifest), with `CURRENT_FENCE_PATH` as a FIFO so the worker blocks in the shop-fence read *after* the generation fence has already passed:

| Reviewer schedule | Generation flip | Sink |
|---|---|---|
| A — barrier before the fence read | gen-1 → gen-2 before GO | **refused** ✅ (reproduces EFF-X-02a) |
| **B — barrier BETWEEN fence read and write** | gen-1 → gen-2 while blocked after the generation check | **WRITTEN**, body `generation: "gen-1"`, current `gen-2` ❌ |
| C — barrier after the write | flip once the sink exists | present, cannot un-write ✅ (reproduces EFF-X-02c) |

Reproduced a second time, with controls: the same payload retried *after* the flip is correctly **refused** (stale at check), and an unrelated tenant still progresses while shop-A is `ERASING`. The fence is correct on both sides; the hole is exactly the in-flight window.

**Merchant impact:** a privacy barrier committed while a writer is in flight does not stop that writer's publication. Post-erasure bytes land with the stale generation recorded in the payload.
**Expected behaviour:** as the plan itself already requires — serialize the publication with the barrier, or make the sink enforce the generation/target, or positively drain that writer and its outstanding I/O. Proximity is not fencing.
**Missing test:** an EFF-X case that pauses after the last fence read and before the sink mutation, commits the barrier, and requires no sink.

I also confirmed from source that the modeled shop fence is `fence[shopId] === "ERASING"` — **whole-shop only**, with no customer-target gate — and that X has no object-store client, so EFF-X-00's HTTP-CSV-after-`requireAdminTenant` characterisation is accurate.

### 7.3 Why this does not block H

H carries the correct requirement rather than the weaker claim. §7.6.2 restriction 2 states: *"A read immediately before an external write is not by itself atomic fencing. The actual publication must be serialized with the privacy barrier, **or** the sink must enforce the generation/target fence, **or** that specific writer and its outstanding I/O must be positively drained"*, and marks installing the fence in `stocky-webhooks` / `stocky-cron` / privacy processors **UNEXECUTED APPLICATION INTEGRATION**. My counterexample corroborates that restriction; it does not contradict anything H asserts. H also correctly declines to treat PR49's rows as independently accepted.

**F-CLAUDE-PR7PR49-01 is therefore a finding against the PR49 evidence packet's presentation of its modeled fence, not a planning defect in H.** PR49 is not approved by this review.

---

## 8. Findings

| ID | Sev | Against | Summary |
|---|---|---|---|
| **F-CLAUDE-PR7PR49-01** | **P2** | PR49 **E** | The modeled publication fence is check-then-act; the barrier-between-check-and-write schedule is absent from all 23 cases and the write lands when it is run (§7.2) |
| **F-CLAUDE-PR7SP-01** | **P3** | PR45 **H** | An exact-duplicate manifest row is accepted where the authority's wording says duplicates must fail; no exploitable disagreement (§5) |

### Crosswalk

| Original | Packet claim | My adjudication |
|---|---|---|
| **F-CLAUDE-PR7RE-01** | CORRECTED | **CLOSED** — refused at consume *and* at the effect boundary; evidence preserved; six enforcement sites |
| **F-CLAUDE-PR7RE-02** | CORRECTED | **CLOSED** — source and effect commitments separated; identifier changes cannot launder source; positives preserved |
| **F-CLAUDE-PR7AO-06** | CORRECTED | **CLOSED** — row-for-row comparison works; honest limit printed; one P3 residual |
| AO-01 / AO-02 / AO-04 / AO-05 | closed at S | **preserved** — AO-02's effectId-bearing commitment explicitly retained and re-verified |
| PR49 AUTH-X | 30/5 | **verified**; effective library-defect count is **eight**, not five |
| PR49 EFF-X | modeled fence | **P2** — see §7.2 |

---

## 9. Evidence classification

**Independently executed:** H/S/X ancestry and the four admission conditions; seventeen-path scope, three-path delta, nine blobs, control byte-identity, proposal blobs; the three exact-H CI job identities; clean export of H, verbatim extractor bootstrap, all twelve manifest entries; **input equivalence between `e7dd4f42…` and H**; H's complete model at 505/505 with independent taxonomy re-parse; both marker sample vectors and both `SourceEffectLink` constraints; the S baselines for RE-01 and RE-02 re-proved from S's own inputs plus S's 416/244/172; nineteen RE-01/RE-02 attacks against H; eight AO-06 one-sided-edit negatives of my own design; three negative controls with restoration; and the whole of Stage A on PR49 — identity, CI, both extractions and selftests, a fresh pinned `npm ci` with library-hash verification, the full AUTH and EFF suites, the five auth failures, the oracle checked against primary Shopify documentation, the SIGKILL and drain audits, the check-to-write schedule with retry and unrelated-tenant controls, and the export/object-store claim.

**Reused with exact identity:** `04_discover_writers.py` `666feaa8…` and `04_source_derived.sql` `9f7aaa26…`, byte-identical for a sixth packet, so the GW-02 scanner campaign carries over without repetition. S's 416/244/172 stays S evidence.

**Not reproduced, not claimed passed:** the live `authenticate.admin` matrix against a real store remains unexecuted — exploitability of AUTH-X-06 depends on real `associated_user.id` magnitudes, which PR49 correctly lists as UNEXECUTED. Redis job drain in the real queues, export publication, D scratch reclamation, live Shopify, application `test:privacy`, and installed PR7 processors/adapters remain implementation obligations. PR48 MATCH/NEW/MISSING provenance preserved. No PR6 corpus, no million-line envelope, no PR48/49 packaging restart, no store or merchant access, no production, no flags.

**Isolation and teardown:** fresh container, nothing pre-existing — verified before allocating. PostgreSQL PGDATA `/var/lib/postgresql/pr45r11` (0700), socket `/tmp/pr45r11-sock`, port **5445**; Redis on **19379** with my own dir and pidfile. I kept off PR49's declared `18379` and the packet's `5442`/`5444`/`5447`, ran no `FLUSHALL` and no `pkill`, and touched no foreign PID or port; 6379 stayed `connect_ex = 111`. Both services were stopped when the container idled between sessions; I restarted only my own PostgreSQL from my own PGDATA. Every contract mutation was made on a disposable copy and restored.

---

## 10. Remaining decisions and entry gates

1. **F-CLAUDE-PR7PR49-01** — PR49 should add the barrier-between-check-and-write case and stop describing proximity as a fence; H's restriction already states the correct requirement and needs no change.
2. **F-CLAUDE-PR7SP-01** — reject repeated `path` entries in the manifest.
3. PR49's AUTH-X summary should carry **eight** library defects rather than five, since four PASS rows are observations of unsafe behavior.
4. Carried forward unchanged: the live `authenticate.admin` acceptance gate; Redis / export / D-scratch fences; PR7 processors; **Q-008 remains a production blocker**; R-176 **OPEN / P0**.

**No verdict in this document authorizes plan merge, PR49 acceptance, or PR7 runtime.**

---

## 11. Artifact identity and unchanged-subject confirmation

Subject H, PR49 subject E, main X, the six control documents, the two proposals, the nine prior reviews and sealed PR48 are **unchanged by this review**. I made no edit to any subject, control, proposal, peer branch, previous review, application file, schema, grant, dependency or CI definition; triggered no Actions run; made no store, merchant or production call; enabled no flag or scope; and neither marked ready nor merged anything.

This document is the only file added, on branch `claude/pr45-reconciled-source-provenance-review`, whose review commit has sole parent `3cc2045107b54601c6b0e43c8690b7d090074b80`.

**Verdict: CORRECTIONS REQUIRED.**
