# Phase 1 PR7 — Generation and W-integration independent review

**Outcome: CORRECTIONS REQUIRED**

Two unresolved **P2**. All four prior `F-CLAUDE-PR7CC` findings are **closed**. Approval requires no unresolved P0/P1/P2, so approval is withheld on the two P2s below.

Planning review only. This does **not** accept the plan, authorize PR7 runtime, close PR6, edit peer branches, mark ready, or merge. R-176 **OPEN / P0**. R-164 unchanged. Q-008 **OPEN**. D-054 authority; **no D-055**. Phase 1 **IN PROGRESS**.

Authority: [PR45 comment 5750016269](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5750016269). CC-GEN/W authority: `5747828826`. TF authority: `5737038796`. Decisions A–E: `5729229659`. PR48 seal authority: `5747831255`.

---

## 0. Headline

The generation-independent target lock is the right fix and it holds: my prior P1 (CE-A/CE-B) is closed under multi-generation shops in **both** lexical directions, and the residual counter now self-protects without relying on an adjacent caller, closing my prior P2. The 169-record model reproduced exactly from hash-verified scripts, and the taxonomy reconciles to **169 = 117 unique + 52 reruns** with the original 59 assertions intact.

Both remaining findings are about **coverage, not mechanism**:

1. The participating-writer inventory grew 27 → 50 rows and now includes the W order-facts families I flagged last round — but the gate that is supposed to enforce completeness is a **7-symbol allowlist**. I removed six genuinely inventoried tenant-linked writers and it still reported complete, and I found real W tenant writers never enumerated at all.
2. The origin-attribution contract fails closed on every **structural** ambiguity I could construct, but not on **temporal** overlap: an unattributed payload admitted after a successor's install and before the prior generation's completion is admitted as successor data, where the plan's stated principle says indistinguishable data should raise ambiguity.

---

## 1. Verified identity and scope

| Field | Value | Verification |
|---|---|---|
| Primary subject | `d6ac0432bec5e0ee8b586681ee53c1fa7ea4ba79` (OPEN/DRAFT/UNMERGED) | PR API + `git rev-parse` |
| Executable baseline **W** | `ee193f38491245a10fb2fa60d2cf9a29f3271605` | `git merge-base` = W; **W is a full ancestor** of the subject |
| Ahead / behind vs W | **11 / 0** | `git rev-list --left-right --count` |
| W merge into planning branch | `0b21604e` — a true merge commit, parents `c7b47807` (review #4) + `ee193f38` (W) | `git log --format='%H %P'` |
| Changed paths W→subject | exactly **6**, all `A` | `git diff --name-status` |
| Supplemental sealed PR48 | `c97adda285b5625836a582deb03983099a7b3461` | branch `planning/pr7-entry-evidence-20260919-37c6` |
| Earlier PR48 observation pin | `275292d19b583c04c3afe01ef7d9feb48fee0f6c` | sealed pin adds `+6783/−23` (evidence) and `+19/−13` (handoff) |
| Review branch | `claude/pr45-generation-w-integration-review` | rooted exactly at the subject |

Six-path scope (two proposals + four immutable reviews):

```
947   0  PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md
5043  0  PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md
571   0  PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md                (immutable #1)
576   0  PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md    (immutable #2)
309   0  PR7_TOPIC_AUTHORITY_FINALIZATION_INDEPENDENT_REVIEW.md      (immutable #3)
320   0  PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md    (immutable #4)
```

**All four immutable review blobs intact:**

| Artifact | Blob | Status |
|---|---|---|
| #1 corrected planning | `c1fa5c2fed74bf80d1006267b43d767258895c17` | ✅ |
| #2 executable contract | `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` | ✅ |
| #3 topic authority / finalization | `e609e9526ed1ec043551ca68d6b977f5b5935d0c` | ✅ |
| #4 customer completion | `e908770d9daea4f963b2fd09e38af79e07274d41` | ✅ |

No runtime, schema, grant, dependency, CI or peer file is touched by the subject.

### 1.1 Exact-head documentation CI

| Run | Head | Attempt | Classify | Heavy | Gate |
|---|---|---|---|---|---|
| PR45 [`35499984298`](https://github.com/Vedang1998/Stocky/actions/runs/35499984298) | `d6ac0432…` ✅ | 1 | `106049913514` **success** | `106049935798` **skipped** | `106049935243` **success** |
| PR48 [`35499544920`](https://github.com/Vedang1998/Stocky/actions/runs/35499544920) | `c97adda2…` ✅ | 1 | `106048722383` **success** | `106048755849` **skipped** | `106048755530` **success** |

Both exactly as declared. Documentation-integrity checks only — **not** independent proof of the database model or the library/Redis experiments. No CI rerun was triggered by this review.

### 1.2 Later main, reported separately

`origin/main` has advanced to **`f057d98c8a321b3e06875a6e9a83b787bcbc101f`** ("docs: Phase 1 PR6 A/B/C/D formal repository closeout and control sync (#47)") — the separately authorized documentation-only PR47 merge. Per the mandate I did **not** wait for it and did **not** restart: this review stays pinned to **d6 / W**. The implementation-entry synchronization gate is preserved: the subject does not contain `f057d98`, so a later re-derivation against the then-current main remains required.

---

## 2. Proof fidelity and taxonomy

### 2.1 Script hashes — all three verify exactly

| File | Declared | Extracted | Match |
|---|---|---|---|
| `01_contract.sql` (1561 lines) | `7a1d4611…2dc4544c` | `7a1d461182ab4b3ab066747cbad73d8d586d19a566cc61dbdebb38452dc4544c` | ✅ |
| `02_seed.sql` (73 lines) | `d0d84842…4084f632` | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` | ✅ |
| `03_run_proofs.py` (2328 lines) | `e9bd3c18…97001f34` | `e9bd3c187451ea989fcf1b0a6c1385f3e4d93281744127d44b46621f97001f34` | ✅ |

The fence convention tightened this packet (no cosmetic trailing blank); I tested both conventions and only the exact body matches. The seed digest is **byte-identical across all four packets**, independently confirming the unchanged fixture rather than accepting the claim.

### 2.2 Independent reproduction — 169/169

Disposable PostgreSQL **16.13**, declared restricted principals, contract and seed loaded unmodified, driver run unmodified:

```
{ "total": 169, "pass": 169, "fail": 0,
  "unique_assertions": 117, "declared_reruns": 52,
  "postgres": "16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)",
  "host": "/tmp/pr45-cc-pg16:5434" }        EXIT=0
```

**No hidden GRANT, replaced constraint, dropped policy or driver repair was required or applied by me.**

### 2.3 Taxonomy reconciled independently

Parsed from `results.json` rather than trusting the driver's self-report (both agree):

| Measure | Mandate | My parse |
|---|---|---|
| Records | 169 | **169** ✅ |
| Unique `(group,name)` | 117 | **117** ✅ |
| Reruns | 52 | **52** ✅ |
| Original distinct assertions (G1–G6) | 59 | **59 records, 59 unique, 0 reruns** ✅ |

| Group | Records | Unique | Reruns |
|---|---|---|---|
| G1/G2/G3/G4/G5/G6 (preserved) | 15/8/10/14/9/3 = **59** | 59 | 0 |
| G7-customer-complete | 28 | 14 | 14 |
| G8-epoch-publish | 14 | 7 | 7 |
| G9-writer-inventory | 18 | 9 | 9 |
| G10-evidence-meta | 1 | 1 | 0 |
| G11-generation-namespace | 24 | 12 | 12 |
| G12-residual-guard | 20 | 10 | 10 |
| NEG-load-bearing | 5 | 5 | 0 |

New unique this packet = 117 − 89 = **28**, matching §14's declaration. §14 now states explicitly "Do not label 169 or 115 as unique-assertion counts", and `results.json` is labelled a run log. My run reported my actual **16.13** from a queried value.

---

## 3. Crosswalk — F-CLAUDE-PR7CC-01…04

| ID | Sev | Disposition | Basis |
|---|---|---|---|
| **CC-01 / CC-GEN** | P1 | **CLOSED** — residual P2 (**F-GW-01**) | §3.1 |
| **CC-02** | P2 | **CLOSED** | §3.2 |
| **CC-03** | P3 | **CLOSED** | §2.3 — driver computes and emits the unique/rerun split; §14 forbids the ambiguous label |
| **CC-04** | P3 | **CLOSED** | §14 is now self-contained with `PROOF_ROOT`/`PGHOST`/`PGPORT`, explicitly warns against hardcoding `/tmp/pr45-tf` and against stopping a leftover cluster on 5433. My first run failed only because I started my own cluster on 5433 without exporting `PGPORT` — my setup error, not a document defect |

### 3.1 CC-01 — closed; executed evidence

The lock key is now `pr7-ctgt-v2:` × **canonical domain** × `kind:value`, with `generationId` removed from the key entirely; `ORDER BY id` is gone and explicitly forbidden; the lock is taken **before** any barrier lookup; and both the ACTIVE-barrier and `PrivacyCompletedTarget` checks are **domain-scoped** (joined through `canonicalDomain`) rather than generation-scoped.

**CE-A replay** (my prior P1), clean fixture, barrier ACTIVE on `gen_a`:

| State | Matching write |
|---|---|
| single generation (baseline) | `customer_target_erasing` ✅ |
| + lexically **greater** `gen_a_zz` (defeated the prior contract) | `customer_target_erasing` ✅ |
| + lexically **lesser** `AAA_gen` (reverse order) | `customer_target_erasing` ✅ |

**CE-B replay + origin attack matrix**, after completion on `gen_a` with successor `gen_a2` LIVE:

| Case | Result |
|---|---|
| declared origin = completed generation, old payload | `customer_target_restore_denied` ✅ |
| no origin, payload predates successor install | `customer_target_restore_denied` ✅ |
| forged / nonexistent origin id | `customer_write_origin_missing` ✅ |
| origin from a different canonical domain | `customer_write_origin_namespace_mismatch` ✅ |
| no origin, **two** LIVE rows | `customer_write_origin_ambiguous` ✅ |
| payload predating both generations | `customer_target_restore_denied` ✅ |
| legitimate successor data (post-completion) | admitted ✅ (correct — not lifetime suppression) |

Every structural ambiguity fails closed. The unique-LIVE fallback is **not** a latest-generation guess: it requires exactly one LIVE binding, an origin that is not the completed generation, the completed generation not LIVE, and `payloadAdmittedAt >= origin.installedAt`.

### 3.2 CC-02 — closed; the helper now self-protects

Called **directly**, without relying on the completion path's adjacent enumerator:

| Invocation | Prior packet | This packet |
|---|---|---|
| no GUC at all | silent `0` | `residual_request_guc_mismatch` ✅ |
| GUC = different request, same shop | `3` (wrong basis) | `residual_request_guc_mismatch` ✅ |
| GUC = **different shop's** request | silent `0` (true value 3) | `residual_request_guc_mismatch` ✅ |
| correct GUCs | `3` | `3` ✅ (true count) |
| wrong tenant GUC, right request | — | `residual_tenant_mismatch` ✅ |
| stale/expired attempt | — | `residual_stale_attempt` ✅ |
| `stocky_privacy_reader` EXECUTE | — | `permission denied` ✅ |

This exceeds the single GUC guard I recommended: tenant, attempt-liveness and capability are all enforced inside the helper.

---

## 4. New findings

### F-CLAUDE-PR7GW-01 — P2 — Origin attribution fails closed on structural ambiguity but not on temporal overlap

**Anchors.** `stocky_customer_write_guard` (the `p_payload_admitted_at < og."installedAt"` test); `stocky_writer_origin_generation`; plan §497 and the CC-GEN row at §143.

**The stated principle vs the implemented test.** Plan §497 says: *"Indistinguishable shared data → `customer_target_attribution_ambiguous` (visible block/escalate; not a silent admit…)"*. The implemented ambiguity test fires only on **structural** conditions — `live_n <> 1 OR og.fence <> 'LIVE' OR cg.fence = 'LIVE'`. Temporal indistinguishability is decided solely by `payloadAdmittedAt >= origin.installedAt`.

**Executed — CE-D.** I constructed the overlap: successor `gen_a2` installed at **T−3h**, prior generation `gen_a`'s customer target completed at **T−2h**, so both generations coexisted for an hour.

| Payload admitted | Declared origin | Result |
|---|---|---|
| T−2.5h (inside the overlap) | *(none)* | **ADMITTED** as successor data |
| T−2.5h (same payload) | `gen_a` (the completed generation) | `customer_target_restore_denied` ✅ |
| T−2.5h (same payload) | `gen_a2` (the successor) | ADMITTED ✅ (consistent) |
| T−4h (predates both) | *(none)* | `customer_target_restore_denied` ✅ |

So an **unattributed** payload admitted during the overlap silently becomes a new-generation write — the precise shape the mandate asked me to examine ("an old or unattributed payload must not silently become a new-generation write merely because only one LIVE row remains"). Note the declared-origin path resolves it correctly; only the fallback is affected.

**Merchant impact.** A queued payload admitted while the prior generation's customer erasure was still in flight, replayed after release, can restore erased customer data. Reachability is narrow: it needs a reinstall that overlaps an in-flight customer erasure, and during the erasure itself the domain-scoped barrier blocks the write. The exposure is the queued-and-replayed-after-release path.

**Why P2, not P1.** This is a deliberate, documented trade-off — the plan explicitly refuses lifetime suppression of legitimate later customer data, and admitting post-install payloads is the natural counterpart. It is not the CC-01 defect returning; every structural ambiguity still fails closed. What is missing is that the stated principle promises more than the test delivers, and the owner has not been given the overlap case to disposition.

**Recommended correction.** Either (a) extend the ambiguity test so that a payload admitted while **both** the completed generation and the successor were alive — `payloadAdmittedAt < completedAt AND payloadAdmittedAt >= origin.installedAt AND origin.installedAt < completedAt` — raises `customer_target_attribution_ambiguous` for **unattributed** writers only, leaving declared-origin writers unaffected; or (b) amend §497 to state plainly that overlap-window unattributed payloads are admitted as successor data, with the reasoning and the residual erasure risk recorded, and require declared origin from every inventoried writer so the fallback is genuinely a last resort.

**Missing test.** A G11 case with `origin.installedAt < completedAt` and a payload inside the overlap, asserting the chosen disposition.

---

### F-CLAUDE-PR7GW-02 — P2 — The inventory completeness gate is a seven-symbol allowlist and the inventory is still incomplete against W

**Anchors.** `stocky_inventory_is_complete()`; `ParticipatingWriterInventory` (50 rows); plan §7.9/§7.6.2; G9 negative controls.

**The gate.** `stocky_inventory_is_complete()` is a conjunction of seven `COUNT(*) FILTER (WHERE symbol = …)` clauses — `completeAttemptRetry`, `dispatcher_disabled_shop_path`, `withTenantBoundTransaction`, `claimAttempt`, `enqueueWithDispatch`, `runOrderFactsSyncJob`, `computeSyncHealth`. It verifies those seven exist and are marked REQUIRED. It is structurally incapable of noticing anything else.

**Executed — CE-E**, one clean fixture per case (baseline 50 rows, `is_complete = true`):

| Removed symbol | `is_complete` | Detected? |
|---|---|---|
| `completeAttemptRetry` | false | **DETECTED** (allowlisted) |
| `runOrderFactsSyncJob` | false | **DETECTED** (allowlisted) |
| `runOrderFactsReconcileJob` | **true** | *not detected* |
| `applyOrderFactsNominated` | **true** | *not detected* |
| `recordApplicationReceipt` | **true** | *not detected* |
| `lockSyncRun` | **true** | *not detected* |
| `upsertCanonicalShop` | **true** | *not detected* |
| `processUninstall` | **true** | *not detected* |

Six genuinely inventoried tenant-linked writers — including canonical-shop bootstrap and uninstall — can be deleted from the inventory with the gate still reporting complete. The G9 controls (`inventory_incomplete_when_required_writer_removed`, `…_w_sync_job_removed`) only ever remove allowlisted symbols, so they cannot reveal this.

**The inventory itself.** I enumerated W independently rather than counting rows: of 208 non-test `app/**/*.ts` files at W, 45 contain write operations; 24 are absent from the 50-row inventory. Sampling the strongest candidates confirms several are **real tenant-linked writers**:

| W file | Evidence |
|---|---|
| `app/lib/catalog-facts/apply/writers.ts` | raw SQL `UPDATE … WHERE "shopId" = ${shopId}` |
| `app/services/forecasting.server.ts` | `db.variantAbcClass.upsert({ … shopId: db.authority.shopId })` |
| `app/services/landed-cost.server.ts` | `db.pOLineItem.update(...)` (tenant-scoped PO lines) |
| `app/lib/catalog-facts/compatibility-projection/legacy-writer.ts` | `shopifyVariantCache.upsert` / `deleteMany`, `inventorySnapshot.upsert` |
| `app/lib/catalog-facts/ingest/collection-memberships.ts` | `shopifyProductCollectionMembership.upsert({ shopId: authority.shopId })` |

The inventory covers `catalog-facts/apply/index.ts` and `ingest/checkpoint.ts` but not the actual `apply/writers.ts`, `apply/fencing.ts`, `apply/projection-state.ts`, the compatibility-projection legacy writer, or several ingest modules. These are not customer-keyed, so they cannot repopulate a customer target — but they are tenant-linked, and the §7.6.2 **domain/lifecycle** participating-write guard governs all tenant-linked writers during a `shop/redact` freeze. An unguarded catalog-facts or forecasting writer can repopulate shop data inside that freeze.

**Credit where due.** The inventory grew 27 → 50 and now covers exactly the order-facts families I flagged last round (`sync-jobs.ts`, `sync/apply-composition.ts`, `apply-nominated.ts`, `control-plane.ts`, `shop-metadata.ts`, `source-stage.ts`, `webhook.ts`), plus `catalog-facts/apply/index.ts` and `application-receipt.server.ts`. PR48's Helper C classified 86 entries. The gap is the **gate's semantics** and the remaining catalog/services families, not the order-facts work.

**Merchant impact.** The plan assigns this gate the job of failing "when a tenant-linked writer bypasses its declared guard". It does not do that; it is a seven-symbol regression guard. So the W-integration closure that this correction was commissioned to deliver (mandate item 4) is not established.

**Recommended correction.** Replace the allowlist with a derived completeness check: enumerate tenant-linked writers from source (an architecture test that walks `app/**` for tenant-scoped persistence and fails on any symbol absent from `ParticipatingWriterInventory`), and keep the seven named clauses only as an additional regression floor. Add the catalog-facts apply/ingest, compatibility-projection and `app/services/**` writers to the inventory with their hosts, surfaces and guard order, or record an explicit proof that each cannot invalidate a freeze.

**Missing test.** A G9 case that removes a **non**-allowlisted inventoried writer and requires detection; and one that adds an unlisted tenant-linked writer and requires detection.

---

## 5. Sealed PR48 evidence — verification and disposition

### 5.1 Provenance classing is sound

Appendix A separates **MATCH recovered** (bytes equal a digest recorded at `275292d` or in Helper B `hashes.txt`), **NEW recovered digest** (recovered from transcript with size corroboration, never previously recorded, explicitly "not claimed as an old packet hash"), and **MISSING** (full original bytes absent, "not fabricated"). It states "Reconstructed-and-re-executed: **None.**" and names the three artifacts not reconstructed as originals: Helper A `probe-results.json`, Helper B hashed `02-dscratch.json`, and the PREP_B_06b tick-log bytes. This satisfies the mandate's item 7 — a report, fragment or hash is correctly not presented as the original execution evidence.

The sealed pin `c97adda` versus the observation pin `275292d` adds `+6783/−23` to the evidence document (the recovered reproducer appendices) and `+19/−13` to the handoff. I found **no material contradiction** between the two pins in the load-bearing claims; the sealed pin adds provenance and the recovered sources, and the one rendering caveat (three markdown hard-break trailing spaces stripped so `git diff --check` passes) is disclosed at the point of use.

### 5.2 My own executions against the load-bearing claims

Because the originals are missing for two items, I produced my own results with the **W-pinned** dependencies. **These are new reviewer executions, separately attributed; they are not the missing original bytes and I make no claim to reproduce those digests.**

**PREP-A-12 (JWT `sub` precision)** — installed `jose@5.10.0` (exact W lockfile pin), synthetic secret, no transport:

| Observation | Result |
|---|---|
| `sub` minted as a JSON **number** `9007199254740993` | payload carries `9007199254740992`, `typeof number`, digits **lost in the token itself** |
| `sub` minted as a **string** | payload carries `"9007199254740993"`, round-trips losslessly |
| verifier output, numeric vs string | `9007199254740992` vs `9007199254740993` |
| `associated_user.id` as a JSON number | `9007199254740992` — lossy |

**This independently confirms PREP-A-12**: a numeric JWT `sub` is already lossy *before* any library stringification, so D-PR7-01 must require a **string** `sub` in the JWT — avoiding `String(number)` downstream is insufficient. That is a material input to D-PR7-01/02 and it is now established by my own execution rather than inherited.

**PREP_B_06b (cancel is not drain)** — private Redis 7.0.15 on port **16390** that I started and owned, `bullmq@5.81.2` / `ioredis@5.11.1` (exact W pins):

```
active_found: 1
remove_threw: "Job cancel-me could not be removed because it is locked by another worker"
state_after_remove: "active"
ticks_before: 1   ticks_after: 16   ticks_appended_after_remove: 15
jobs_present_after: ["cancel-me"]
```

**Independently confirms the authoritative claim**: `Job.remove()` on an active job throws `locked by another worker`, the job stays `active`, and the worker appends **15 further filesystem writes** afterwards. Queue cancellation is not a drain. PR48's conclusion holds on my own run.

### 5.3 Not reproduced here — reported honestly

I installed the exact W pins (`@shopify/shopify-app-react-router@1.2.1`, `@shopify/shopify-api@13.1.0`) in a disposable directory and drove `shopifyApp` with a fail-closed mocked transport (only `/admin/oauth/access_token` may succeed; all other URLs throw). The library initialised at the pinned versions and entered token exchange ("Requesting offline access token"), but every case terminated in a thrown `Response` with status **500** and an empty body under my mock. **I did not complete the `authenticate.admin` matrix and I do not certify it.** Consequently these PR48 rows remain **reused-not-reproduced** by me:

- exact string `sub` with offline tokens; online owner/staff/collaborator cases;
- mixed-token / stale `associated_user` / cache reuse;
- `iss`/`dest` hostname mismatch **accepted** by the library, and forged `dest` producing a session whose `shop` follows `dest`;
- rejection of invalid signature / wrong audience / expiry.

The `iss`/`dest` rows are security-relevant and remain single-sourced to PR48's recovered coordinator reproducers (both **MATCH recovered**). Per the mandate this does not require another packaging cycle, but it should be recorded as an implementation-entry proof obligation, not as established behaviour.

Also unexecuted by me and correctly unexecuted by the SQL model: live Shopify, export publication to a real provider, and PR7 processors (which do not exist).

### 5.4 Dispositions the mandate asked for specifically

- **PREP_B_06 (waiting-job removal)** — PR48 labels it **INCONCLUSIVE** and says "Do not treat as drain proof". I accept that and did not upgrade it. The interrupted 4169-era run is excluded; the authoritative result is the 9143 rerun with separate attribution, which I reproduced in shape (§5.2).
- **D operator helper / `quiescenceConfirmed` (PREP_B_19)** — PR48 states the probe supplied the admission token while a writer was alive, that this is "an integration hazard for a future privacy caller", that it "does not execute the runbook precondition and does not revoke D acceptance". That is the correct reading and I **do not reopen merged D**. The finding that matters for PR7 is forward-looking: a future privacy caller must not synthesise `quiescenceConfirmed`, and the plan must demand a real fence / positive drain with a truthful incomplete outcome.
- **Does PR7 demand positive drain?** Yes in text — §7.6.2 and §7.11 require generation-fenced publication or positive per-target drain, refuse TTL / PID / cancelled-label substitutes, and forbid completion when that evidence is absent. PR48's `PREP_B_26/27` adds a concrete requirement (an export writer that snapshots `fence=LIVE` then publishes after `ERASING` still lands a file unless it re-reads under the publication lock) that belongs in the implementation contract. These are **adequately specified implementation-proof obligations**, not absent planning mechanisms — distinct from F-GW-02, where the named mechanism exists but does not do its job.

---

## 6. Evidence classification

**Independently executed by me:** six-path/W-ancestry/four-blob verification; PR and Actions APIs for both runs; extraction and SHA-256 verification of all three appendix scripts under both fence conventions; disposable PostgreSQL 16.13 with the declared principals; unmodified contract+seed load and unmodified 169/169 driver run; independent `results.json` taxonomy parse; CE-A and CE-B replays under multi-generation in both lexical directions; CE-D overlap-window attribution matrix; CE-C direct residual-guard matrix; CE-E per-case inventory-gate detection; independent enumeration of W writers (208 files scanned, 45 writers, 24 uninventoried, 5 confirmed tenant-linked); JWT precision reproduction on W-pinned `jose@5.10.0`; BullMQ active-job cancel reproduction on W-pinned `bullmq`/`ioredis` with private Redis.

**Reused, not re-executed:** the preserved 59 G1–G6 assertions retain their established meaning; PR48's `authenticate.admin` matrix (§5.3); PR48's Helper B/C results beyond the one schedule I reproduced; external Shopify/PostgreSQL facts verified in earlier rounds.

**Unexecuted / not certified:** live Shopify and any upstream security certification; real export-storage publication; PR7 processors (none exist); the full `authenticate.admin` matrix (§5.3). I did not repeat PR6 million-line or runtime campaigns.

**Isolation and teardown.** I owned every resource I cleaned up: my PostgreSQL cluster (separate PGDATA from the socket directory), my Redis on port 16390 (started by me, pid recorded, shut down by me), and my disposable npm trees. I did **not** signal or stop any other agent's service — the helper cluster on 5433 was left untouched, as §14 instructs. Residue check after teardown: none.

**Not done:** no CI rerun, no store calls, no merchant data, no flag changes, no candidate PR7 implementation, no edits to the subject, either proposal, any of the four reviews, `main`, PR43/46/47/48, runtime, schema, grants, dependencies or CI. No dependency in the repository was installed or changed — all library probes were in disposable trees outside the working copy.

---

## 7. Remaining decisions and implementation-entry gates

1. **F-GW-01** dispositioned — extend the ambiguity test to the overlap window, or amend §497 and require declared origin from every inventoried writer.
2. **F-GW-02** resolved — replace the seven-symbol allowlist with a source-derived completeness check, and close the catalog-facts / `app/services/**` inventory gap.
3. **Implementation-proof obligations carried forward** (adequately specified, not blocking): the installed-library actor/owner contract including the string-`sub` requirement confirmed in §5.2 and the `iss`/`dest` behaviour in §5.3; positive Redis/worker drain; export publication re-read under the publication lock; D-scratch cross-process reclamation with a truthful incomplete outcome and no synthesised `quiescenceConfirmed`.
4. **Synchronization gate preserved** — the subject is pinned to W and does not contain `f057d98` (PR47). Re-derive the writer inventory and grant catalogue against the then-current main before implementation.
5. A further independent re-review with **no unresolved P0/P1/P2**.

Unchanged and mandatory: formal independently accepted **PR6 closure**, exact-head **full** CI on that base, named single writer with exclusive §7.9 ownership, and a **subsequent explicit ChatGPT runtime authorization**. Q-008 remains **OPEN** and a production blocker. **No verdict, including this one, authorizes merge or PR7 runtime.**

---

## 8. Artifact identity and unchanged-subject confirmation

| Field | Value |
|---|---|
| Review branch | `claude/pr45-generation-w-integration-review` |
| Rooted at | `d6ac0432bec5e0ee8b586681ee53c1fa7ea4ba79` |
| Added path | `stocky-plus/docs/phases/phase-1/PR7_GENERATION_W_INTEGRATION_INDEPENDENT_REVIEW.md` |
| Files changed | exactly one, added |
| Proposals (plan / matrix) | **not modified** |
| Immutable reviews #1–#4 | preserved — `c1fa5c2…`, `0a29e79…`, `e609e95…`, `e908770…` |
| Primary subject before / after | `d6ac0432bec5e0ee8b586681ee53c1fa7ea4ba79` — unchanged |
| Sealed PR48 supplement before / after | `c97adda285b5625836a582deb03983099a7b3461` — unchanged |
| Executable baseline **W** | `ee193f38491245a10fb2fa60d2cf9a29f3271605` — read-only |
| Later main (reported, not reviewed) | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` |
| Actions runs triggered | none |

**Outcome: CORRECTIONS REQUIRED** — 2 P2 (`F-CLAUDE-PR7GW-01`, `F-CLAUDE-PR7GW-02`); all four prior CC findings closed. A reviewer recommendation, not ChatGPT acceptance.
