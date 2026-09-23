# Phase 1 PR7 — Temporal attribution and writer coverage independent review

**Outcome: CORRECTIONS REQUIRED**

One unresolved **P2**, one **P3**. **F-CLAUDE-PR7GW-02 is closed. F-CLAUDE-PR7GW-01's overlap defect is closed**, but its replacement safeguard rests on a caller-asserted boolean with no specified provenance — that is the P2.

Planning review only. This does **not** accept the plan, authorize PR7 runtime, edit peer branches, mark ready, or merge. PR6 **CLOSED**. Phase 1 **IN PROGRESS**. R-176 **OPEN / P0**. R-164 unchanged. Q-008 **OPEN**. D-054; **no D-055**.

Authority: [PR45 comment 5751383407](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5751383407). Correction authority: `5750220159`. Prior review: `28b4399c99d54b1a16722418da3a67bfbb84a760` (subject `d6ac0432…`, blob `1d93b85a…`).

---

## 0. Headline

The GW-02 writer-coverage fix is the real thing. The completeness gate is no longer a symbol allowlist: it reconciles an **independently source-derived required set** against the inventory. I did not take that on the packet's word — I regenerated the source snapshot from actual X with the published scanner and **my `04_source_derived.sql` matched the declared digest exactly**, then injected six genuinely unlisted writes into a disposable X copy, re-ran the real discovery path, and watched the gate fail. My own CE-E counterexample is now one of the packet's negative controls.

GW-01's overlap defect is likewise closed, with both boundaries inclusive and a one-safeguard mutation that revives my CE-D exactly. The problem is the escape hatch: `p_origin_persisted` is a plain boolean parameter, `EXECUTE` is granted to both ordinary writer roles, **no table records an admission-time origin**, and the plan never says who may set the flag or where the provenance lives. Passing `true` with the successor's id admits the precise payload the new safeguard exists to reject.

---

## 1. Identity, scope and control synchronization

| Field | Value | Verification |
|---|---|---|
| Subject **P** | `500b476ad079de5f6a1282fd65b2576f0afc9a52` (OPEN/DRAFT/UNMERGED) | PR API + `git rev-parse` |
| Main / base **X** | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` | **full ancestor** of P; merge-base = X |
| Ahead / behind vs X | **14 / 0** | `git rev-list --left-right --count` |
| Claimed history-preserving X merge | `bfdb4a12594a6ce0c4f9700dc23d9d59bd6a7c94` | **verified independently** — a true merge commit, parents `28b4399c` (prior GW review) + `f057d98c` (X) |
| Changed paths X→P | exactly **13** | 7 added (2 proposals + 5 reviews), 6 modified control files |
| Sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` | unchanged |
| Review branch | `claude/pr45-temporal-attribution-writer-coverage-review` | rooted exactly at P |

**All five immutable review blobs intact:**

| Artifact | Blob |
|---|---|
| #1 corrected planning | `c1fa5c2fed74bf80d1006267b43d767258895c17` ✅ |
| #2 executable contract | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` ✅ |
| #3 topic authority / finalization | `e609e9526ed1ec043551ca68d6b977f5b5935d0c` ✅ |
| #4 customer completion | `e908770d9daea4f963b2fd09e38af79e07274d41` ✅ |
| #5 generation / W integration | `1d93b85aa8f61a6255fe2408148f1e5ea97c0b70` ✅ |

**Control edits are mechanical-only.** The six modified files total `+26/−24`. Word-diffing each one, every change records actual state: PR6 **FORMALLY CLOSED** at PR47 squash X with its SHA and timestamp, current `origin/main` updated from W to X, the PR6-D line annotated as historical executable D runtime, the PR6 closure report moved from "PENDING owner squash-merge" to "**effective** on PR #47 squash X", and "Next authorized action" repointed to this PR45 correction review. No approved rule, risk disposition, question state or historical attribution is altered; **D-054 remains authority with no new decision heading**; no implicit runtime authority appears. This is within the granted scope.

No executable or configuration tree is touched: the 13 paths are all Markdown under `stocky-plus/docs/`.

### 1.1 Exact-head CI

Run [`35517328045`](https://github.com/Vedang1998/Stocky/actions/runs/35517328045), event `pull_request`, attempt 1, `head_sha = 500b476a…`:

| Job | ID | Conclusion |
|---|---|---|
| Classify change set (incl. self-test) | `106095354419` | **success** |
| Lint, typecheck, test, build, Prisma, GraphQL | `106095367901` | **skipped** |
| CI Gate | `106095367360` | **success** |

Exactly as declared. Documentation integrity only — not execution of the PostgreSQL model and not certification of the discovery algorithm. **No Actions run was triggered by this review.**

---

## 2. Script fidelity and proof taxonomy

### 2.1 All six declared digests verify exactly

| Appendix | File | Declared | Match |
|---|---|---|---|
| A | `01_contract.sql` (3456 lines) | `ec92ac13…ceca61d` | ✅ |
| B | `02_seed.sql` (73 lines) | `d0d84842…4084f632` | ✅ |
| C | `03_run_proofs.py` (2742 lines) | `2b5d92e1…9b16c5d5` | ✅ |
| D | `04_discover_writers.py` (646 lines) | `666feaa8…2990220d` | ✅ |
| E | `04_source_derived.sql` (1530 lines) | `9f7aaa26…c0bf6baa` | ✅ |
| E | `source_derived_candidates.json` (21040 lines) | `0ce7a398…1546ecd` | see §2.2 |

The seed digest is byte-identical for a **fifth consecutive packet**.

### 2.2 Source candidates regenerated from X, not loaded

The mandate required regenerating the snapshot rather than running the precomputed INSERTs. I extracted X read-only (`git archive`) into an isolated tree and ran the published scanner against it:

```
scanned_files 506   discovered 1307   required 219   unknown 0   required_file_count 48
sha256_source_sql  9f7aaa26ecdbdf953b284b0813fb81f2693962c64870d7c2e61ea084c0bf6baa   <- MATCHES declared
```

**My independently regenerated `04_source_derived.sql` is byte-identical to the declared appendix.** The required-set SQL is genuinely derived from X source by the published scanner, not hand-authored. The claimed 506 / 1307 / 219 / 0 counts reconcile from my own run.

`source_derived_candidates.json` did **not** match (`352f3018…` vs declared `0ce7a398…`). I report the mismatch before any diagnostic variant, as instructed. Structural comparison shows the cause: `candidates` (1307), `required` (219), `scanned_files` (506) and `counts` are **all equal**; only `envelope` differs, and only in `app_root` / `scan_roots` — the declared run used `/workspace/stocky-plus`, mine `/tmp/pr45-X/stocky-plus`. This is an environment artifact, not a content divergence. See **F-TA-02**.

### 2.3 Clean execution and taxonomy — with my snapshot

Disposable PostgreSQL **16.13** under the declared restricted principals, on the documented socket/port, with contract and seed unmodified and **my own regenerated `04_source_derived.sql`** staged in place of the supplied one:

```
{ "total": 253, "pass": 253, "fail": 0,
  "unique_assertions": 160, "declared_reruns": 93,
  "postgres": "16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)" }   EXIT=0
```

No hidden grant, changed policy, dropped constraint or repaired driver was required or applied by me.

Taxonomy parsed independently (driver self-report agrees):

| Measure | Claimed | My parse |
|---|---|---|
| Records | 253 | **253** ✅ |
| Unique `(group,name)` | 160 | **160** ✅ |
| Reruns | 93 | **93** ✅ |
| Original G1–G6 | 59 | **59 records, 59 unique, 0 reruns** ✅ |

New groups: G13-temporal-attribution (30 records / 15 unique), G14-source-coverage (52 / 26), NEG-load-bearing grown to 7.

### 2.4 Declared failed attempts

§14 discloses the pre-clean failures (244/250) and their causes — a G11 case that passed a newly attached `'gen_a'` without `p_origin_persisted=true` and hit `customer_write_origin_ambiguous` under two LIVE rows, and G13 equality tests using runtime-role subqueries that hit `42501`. Both are driver-side corrections; it states "No hidden GRANT, dropped FK, or repaired unpublished script is credited." Consistent with what I observed.

---

## 3. GW-01 — overlap defect closed; new residual on provenance

### 3.1 What is fixed, executed

The contract carries an explicitly delimited `GW01_TEMPORAL_OVERLAP` block citing "ChatGPT option (a) / F-CLAUDE-PR7GW-01" — the option I recommended. For unattributed payloads it raises `customer_target_attribution_ambiguous` when a successor's `installedAt <= completedAt` and the payload falls inclusively within `[installedAt, completedAt]`.

**CE-D replay and boundary matrix** (overlap built exactly as in my prior review: successor installed T−3h, prior target completed T−2h):

| Case | Result |
|---|---|
| CE-D overlap payload T−2.5h, unattributed | `customer_target_attribution_ambiguous` ✅ **(was ADMITTED)** |
| exactly **at** successor `installedAt` (lower bound) | `attribution_ambiguous` ✅ inclusive |
| exactly **at** `completedAt` (upper bound) | `attribution_ambiguous` ✅ inclusive |
| 1 microsecond **after** `completedAt` | ADMITTED ✅ (strictly-after is outside the window) |
| before successor install | `customer_target_restore_denied` ✅ |
| `payloadAdmittedAt` NULL | `attribution_ambiguous` ✅ |
| two retained completions, payload after all | ADMITTED ✅ (correct; not lifetime suppression) |
| successor `installedAt` NULL | schema `NOT NULL` prevents it; guard also checks defensively ✅ |

**One-safeguard mutation (my own, CE-H).** I stripped only the 584 characters between `-- BEGIN GW01_TEMPORAL_OVERLAP` and `-- END GW01_TEMPORAL_OVERLAP`, changing nothing else, and reloaded:

```
CE-D overlap payload, overlap block removed:  ADMITTED   <- original counterexample revived
```

The packet's own `NEG-6 temporal_overlap_check_removed_revives_ced_admit` asserts the same property, and `NEG-7 floor_only_completeness_revives_cee_six_misses_undetected` reproduces **my prior CE-E finding** as a control. The NEG suite replaces one function at a time and reloads the declared contract afterwards.

### 3.2 F-CLAUDE-PR7TA-01 — P2 — `p_origin_persisted` is an unbacked assertion

**Anchors.** `stocky_customer_write_guard(..., p_origin_persisted boolean DEFAULT false)`; `v_trusted` derivation; plan §514 "Writer origin" and §515 "After COMPLETED".

**Mechanism.** `v_trusted := (p_origin_persisted IS TRUE) AND (p_origin_generation_id IS NOT NULL) AND (p_origin_generation_id <> '')`. When `v_trusted` is true the entire overlap block is skipped — it is guarded by `IF v_trusted IS NOT TRUE THEN`.

**Executed**, same overlap fixture:

| Invocation | Result |
|---|---|
| unattributed (`persisted` default false) | `customer_target_attribution_ambiguous` ✅ |
| `p_origin_persisted := false`, origin = successor | `customer_target_attribution_ambiguous` ✅ |
| `p_origin_persisted := true`, origin = **old completed** generation | `customer_target_restore_denied` ✅ |
| **`p_origin_persisted := true`, origin = successor `gen_a2`** | **ADMITTED** |

The last row is the exact CE-D payload the safeguard exists to reject, admitted on the strength of one boolean.

**Why this is a missing planning contract rather than a specified future binding** — the mandate's dichotomy. I checked all three places a binding could live:

1. **Capability.** `GRANT EXECUTE ON FUNCTION public.stocky_customer_write_guard(...) TO stocky_runtime, stocky_control_plane` — i.e. both ordinary participating-writer roles. No separate trusted-origin role exists.
2. **Persistence.** The contract declares 28 tables. **None** records an admission-time origin, and no column named for persisted origin exists anywhere in the contract. Nothing validates the flag against stored state; the guard takes the caller's word.
3. **Prose.** §514/§515 state the *meaning* forcefully — "A newly attached caller-provided generation, retry-time timestamp, or restamped envelope is **not** trusted origin", "Preserve original admission/provenance on retry" — but name **no** recording point, **no** capability restricted to setting it, and **no** mechanism by which a retry carries the original admission forward. The plan asserts the property the model cannot enforce.

**Merchant impact.** Any participating writer — including a retrying worker re-attaching a generation id at retry time, precisely the case §514 forbids — can restore erased customer data inside the overlap window by passing `true`. The unattributed path is genuinely fixed; this is a parallel path around it.

**Recommended correction.** Specify the binding, at the level the rest of this contract already achieves elsewhere:

- **(a) Persist it.** Record the origin generation at admission (e.g. on the durable work record alongside `payloadAdmittedAt`), have the guard read it from that row keyed by a work identity the caller passes, and drop the boolean entirely. The caller then cannot assert provenance — it can only name a record whose origin the database already holds. This matches how `stocky_privacy_capability_allows` derives authority from `PrivacyRequest`/`PrivacyAttempt` rather than parameters.
- **(b) Restrict it.** If the parameter must stay for the planning model, declare a distinct capability that may pass `true`, revoke it from `stocky_runtime`/`stocky_control_plane`, and state the recording point and the retry-preservation rule as an implementation-entry obligation.

Option (a) is materially stronger and is consistent with the contract's own established pattern.

**Missing tests.** A G13 case asserting an untrusted caller cannot obtain trusted-origin treatment by asserting the flag; and one asserting a retry cannot re-attach a generation at retry time.

---

## 4. GW-02 — closed

### 4.1 The gate is now source-derived

`stocky_inventory_is_complete()` conjoins six clauses: the seven-symbol floor (**retained as a floor**, as I recommended), a non-empty `SourceDerivedRequired`, no `UNKNOWN` candidate, no `WRITE`-kind candidate classified `NONWRITER`/`READ_ONLY`/`OPTIONAL`, **every** required `source_identity` present in `ParticipatingWriterInventory`, and no inventory `SOURCE_SITE` row without a matching candidate. Its header states it "does NOT generate its expectation from `ParticipatingWriterInventory` rows" — and the structure bears that out.

My prior gap is closed in substance too: the required set now contains the families I named — `catalog-facts/catalog-sync.ts`, `diagnostic-reconciler.ts`, `compatibility-projection/legacy-writer.ts`, `ingest/direct-observation.ts`, `order-facts/sync/control-plane.ts`, and TSX routes `app.buying-table.tsx`, `app.purchase-orders.tsx`, `app.transfers.tsx`.

### 4.2 Removal beyond the thirteen named — executed

The suite ships 13 `inventory_incomplete_when_*_removed` controls. The mandate asked me to go past them. I selected **eight required identities at random whose symbols are none of the thirteen**, removed each from the inventory one at a time on a fresh fixture:

| Removed required mapping | Detected |
|---|---|
| `app/sync/dispatcher.server.ts\|markDispatchFailed\|update\|jobDispatch` | ✅ |
| `scripts/tenant-backfill/engine.ts\|shopId\|upsert\|shop` | ✅ |
| `app/sync/lifecycle.server.ts\|receiptRows\|raw_sql_dml\|sql` | ✅ |
| `app/lib/order-facts/apply/writers.ts\|id\|queryRows_dml\|CanonicalApplyDb` | ✅ |
| `app/sync/lifecycle.server.ts\|rows\|create\|dataIssue` | ✅ |
| `app/sync/uninstall.server.ts\|updated\|updateMany\|durableJob\|tx` | ✅ |
| `app/lib/catalog-facts/ingest/checkpoint.ts\|current\|update\|syncRun\|tx` | ✅ |
| `app/routes/app.transfers.tsx\|shopifyTransfer\|update\|transferOrder\|db` | ✅ |

All eight detected — including a `scripts/` path, a raw-SQL DML site, a `queryRows_dml` site and a TSX route.

### 4.3 Source injection against the real discovery path — executed

The mandate was explicit that a fabricated candidate row is not coverage. I copied X to a disposable tree and injected **six genuinely unlisted write forms**, then ran the published scanner against that tree:

| Injected form | Discovery result |
|---|---|
| plain Prisma `update` in a new service file | `WRITE` / `REQUIRED_LIFECYCLE_AND_TARGET` ✅ |
| raw `$executeRaw` UPDATE | `WRITE` / `REQUIRED_LIFECYCLE` (`raw_sql_dml`) ✅ |
| **aliased** `$queryRaw` assigned to a local, invoked as `exec\`DELETE …\`` | `WRITE` / `REQUIRED_LIFECYCLE` (`aliased_queryRaw_dml`) ✅ |
| **dynamic** delegate target `db[model].deleteMany(...)` | `UNKNOWN` / `UNKNOWN` ✅ conservative |
| write inside a `.tsx` route `action` | `WRITE` / `REQUIRED_LIFECYCLE_AND_TARGET` ✅ |
| wrapper forwarding to an already-required symbol | not a candidate — see envelope note |

Scan moved 506→512 files, 1307→1312 candidates, 219→**223** required, unknown 0→**1**. Loading that snapshot into a fresh database with **no inventory rows added**:

```
floor_complete = true        <- the floor alone does NOT catch it
is_complete    = false       <- the source-derived clauses do
unmapped required rows:
  app/routes/app.injected-route.tsx|prisma|create|auditEvent
  app/services/injected-alias.server.ts|exec|aliased_queryRaw_dml
  app/services/injected-plain.server.ts|injectedPlainWrite|update|shopifyOrderFact
  app/services/injected-raw.server.ts|prisma|raw_sql_dml
```

The floor staying `true` while `is_complete` goes `false` isolates the mechanism: the source-derived reconciliation is what catches unlisted writes, exactly as the design claims.

**Envelope note (not a finding).** The wrapper forwarder performs no write itself and calls a symbol that is already required, so its absence from the candidate set is defensible — the guarded callee carries the obligation. The scanner does keep a `WRAPPER_FORWARDER` classification (1 row at baseline), so the concept exists. The declared supported envelope plus conservative `UNKNOWN` handling for unresolved constructs is the right posture; I did not require whole-language static proof.

### 4.4 Classification questions the mandate raised

I checked the three source-inspection questions and found them to be conservative dispositions rather than concealment: `raw_sql_select_or_unknown` dynamic forwarding that is genuinely unresolved surfaces as `UNKNOWN` (which independently blocks completeness — verified in §4.3), `WRITE`-kind candidates cannot be classified `NONWRITER`/`READ_ONLY`/`OPTIONAL` without failing the gate (clause 4), and phantom `SOURCE_SITE` inventory rows without a matching candidate fail clause 6. `unknown = 0` on X is therefore a checked property, not an assumption.

**F-CLAUDE-PR7GW-02 is closed.**

---

## 5. New findings

### F-CLAUDE-PR7TA-01 — P2
`p_origin_persisted` is a caller-asserted boolean with no capability restriction, no persistence and no specified recording or retry-preservation point; asserting `true` with the successor id admits the CE-D overlap payload. Full evidence and correction options in §3.2.

### F-CLAUDE-PR7TA-02 — P3 — the candidates digest is a run-environment identity, not a portable input digest
`source_derived_candidates.json` embeds absolute `app_root` and `scan_roots` in its `envelope`, so its SHA-256 cannot reproduce across checkout locations. Mine differed from the declared value while `candidates`, `required`, `scanned_files` and `counts` were all identical. By contrast the derived `04_source_derived.sql` — the artifact the model actually consumes — **is** portable and matched exactly. §14 should label the candidates digest the way `results.json` is already labelled (an original-run identity, not a reproducible-input requirement), or make the envelope record a repo-relative root so the digest becomes portable.

---

## 6. Evidence classification

**Independently executed by me:** ancestry and merge-commit parentage verification; thirteen-path scope; five review blobs; word-diff of all six control files; both CI runs via the Actions API; extraction and SHA-256 verification of all six appendices; read-only `git archive` of X and a full re-run of the published discovery scanner against it (matching the declared source-SQL digest and all four counts); disposable PostgreSQL 16.13 under the declared principals running the model with **my** regenerated snapshot → 253/253; independent taxonomy parse; CE-D replay plus the six-case boundary matrix; the `p_origin_persisted` assertion matrix; guard-grant and persistence audit across all 28 declared tables; CE-F removal of eight non-named required mappings; CE-G six-form source injection through the real discovery path; CE-H one-safeguard mutation reviving CE-D.

**Reused, correctly attributed, not re-executed here:** the prior `authenticate.admin` matrix remains **not independently reproduced** and is not upgraded; PR48's MATCH / NEW recovered digest / MISSING provenance classing stands as previously assessed; my own earlier independent results — numeric JWT `sub` precision loss on `jose@5.10.0` and active-job `remove`-is-not-drain on `bullmq@5.81.2` — stand as previously attributed; prior CC-01…04 closures stand, with no regression observed in the preserved 59 G1–G6 assertions.

**Unexecuted and explicitly not passed by this SQL model:** Redis job drain, export publication fences, D-scratch cross-process reclamation, installed-library binding, live Shopify, and PR7 processors (which do not exist). Their mechanisms remain adequately specified implementation-proof obligations. I ran no PR6 benchmark, no full runtime corpus, no million-line replay and no PR48 re-packaging.

**Isolation and teardown.** I owned every resource I removed: PGDATA `/var/lib/postgresql/pr45gw`, socket `/tmp/pr45-gw-pg16`, **port 5435**, and my disposable X/injection trees. I confirmed before cleanup that ports **5433 and 5434 were not mine** and stopped nothing on them; no other agent's service was signalled. My reviewer-only mutation file was deleted after use and the disposable source copies discarded. Residue check: none.

**Not done:** no CI rerun, no store calls, no merchant data, no production, no flags, no mark-ready, no merge; no change to the subject, either proposal, any of the five reviews, the control files, `main`, PR43/47/48, runtime, schema, grants, dependencies or CI.

---

## 7. Remaining decisions and entry gates

1. **F-TA-01** resolved by specifying the origin-provenance binding — option (a) persisted origin read by the guard is recommended over option (b) capability restriction.
2. **F-TA-02** dispositioned (label or make portable).
3. **Implementation-proof obligations carried forward, none claimed passed:** the installed-library actor/owner contract including the string-`sub` requirement; positive Redis/worker drain; export publication re-read under the publication lock; D-scratch cross-process reclamation with a truthful incomplete outcome and no synthesised `quiescenceConfirmed`.
4. **Owner decisions still open:** Q-008 retention language (production blocker); the residual D-PR7 choices recorded in the plan's decision register.
5. A further independent re-review with **no unresolved P0/P1/P2**.

Unchanged and mandatory: exact-head **full** CI on the implementation base, named single writer with exclusive file ownership, and a **subsequent explicit ChatGPT runtime authorization**. **No verdict, including this one, authorizes merge or PR7 runtime.**

---

## 8. Artifact identity and unchanged-subject confirmation

| Field | Value |
|---|---|
| Review branch | `claude/pr45-temporal-attribution-writer-coverage-review` |
| Rooted at | `500b476ad079de5f6a1282fd65b2576f0afc9a52` |
| Added path | `stocky-plus/docs/phases/phase-1/PR7_TEMPORAL_ATTRIBUTION_WRITER_COVERAGE_INDEPENDENT_REVIEW.md` |
| Files changed | exactly one, added |
| Proposals and control files | **not modified** |
| Immutable reviews #1–#5 | preserved |
| Subject before / after | `500b476ad079de5f6a1282fd65b2576f0afc9a52` — unchanged |
| Main **X** | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` — read-only |
| Sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` — unchanged |
| Actions runs triggered | none |

**Outcome: CORRECTIONS REQUIRED** — 1 P2 (`F-CLAUDE-PR7TA-01`), 1 P3 (`F-CLAUDE-PR7TA-02`); GW-02 closed, GW-01's overlap defect closed. A reviewer recommendation, not ChatGPT acceptance.
