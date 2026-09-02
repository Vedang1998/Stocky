# PR5 Emergency Remaining Integration Plan — Correction Independent Re-Review (Claude)

**Reviewer:** Claude Code, acting as independent principal engineer / architecture, security and
release-risk reviewer under `AGENTS.md`, `CLAUDE.md`, and `ACCELERATED_SAFE_DELIVERY.md`.

**Review class:** CORRECTION re-review of the PR5-F3 emergency remaining-integration **planning**
packet. This is not the mandatory final exact-head review of F3 runtime, which remains required.

**Mandate constraints observed:** no runtime, schema, migration, test, or Shopify configuration
file modified; PR #32 not edited, not pushed to, not merged; PR #30 / #31 / #32 / #33 not merged,
not marked ready, not closed; `RISK_REGISTER.md` / `DECISIONS.md` not edited; no risk closed; no
D-055; no F3 implementation; no PR 6 implementation; no feature flag enabled; no production or
merchant production data accessed; no Shopify mutation issued. Only this new artifact is committed.

**Scope discipline:** the mandate directs that the plan not be redesigned unless a correction is
still materially defective. No redesign is proposed. Every disposition below is a verification
result, not a new design preference.

---

## 1. Verified identity and provenance

All values obtained by direct inspection of the Git object store and the GitHub Actions API in this
session. None is inherited from the PR #32 body, from the correction commit message, or from chat
summary. The PR body's claim that all 25 findings are addressed was explicitly **not** relied on;
each finding was re-derived against the corrected document and against live repository facts.

| Item | Observed value | How verified |
|---|---|---|
| Repository | `Vedang1998/Stocky` | `git remote -v` |
| **Reviewed corrected head** | `a6b65f155de480354c66d147149fd98effb87430` | `git rev-parse FETCH_HEAD` on the PR branch |
| Corrected-head subject | `docs(pr5-f3): correct remaining-integration architecture from early Tier-A review` | `git log -1` |
| Original reviewed planning head | `b886bb562a0f77cfb9a8964e24b9a348b310514a` | `git log b886bb5..a6b65f1` |
| **Current `origin/main`** | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` | `git rev-parse origin/main` |
| Commits added since original review | `94730f1` (review artifact), `a6b65f1` (correction) | `git log --oneline b886bb5..a6b65f1` |
| Correction diff | 3 files, +903 / −242; **docs only** | `git show --stat a6b65f1` |
| Correction changed paths | `docs/PROJECT_STATUS.md`, `docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md`, `docs/phases/phase-1/README.md` | `git diff --name-only 94730f1 a6b65f1` |
| Working tree before this artifact | clean | `git status --short` |

**Prohibited-surface check.** The correction touches no runtime module, no `prisma/schema.prisma`,
no migration, no test file, and no `shopify.app.toml`. The prohibition set is respected in full.

### 1.1 Immutable original-review blob verification

| Item | Value | Result |
|---|---|---|
| Original review artifact | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_INDEPENDENT_REVIEW.md` | — |
| Expected immutable blob | `ebf2e87bf108bbd5eaa7d31a323842de13ae53ca` | — |
| Blob at review commit `f352633` | `ebf2e87bf108bbd5eaa7d31a323842de13ae53ca` | **BYTE-IDENTICAL** |
| Blob at branch review commit `94730f1` | `ebf2e87bf108bbd5eaa7d31a323842de13ae53ca` | **BYTE-IDENTICAL** |
| Blob at **corrected head** `a6b65f1` | `ebf2e87bf108bbd5eaa7d31a323842de13ae53ca` | **BYTE-IDENTICAL — UNMODIFIED** |

**Provenance note (recorded, not a finding).** The stated review source commit
`f35263307dd0da18e1039790ab76dc65bd620470` is **not** an ancestor of the corrected head. The branch
carries an equivalent commit `94730f1095cc67f854dcce2c93e99812d38313a1` with the identical subject,
the identical parent `b886bb56…`, and the **identical artifact blob** `ebf2e87b…`. The two are
re-authored instances of the same content (`f352633` is authored by `Vedang1998`, `94730f1` by the
same identity at a different commit time). Because the immutable artifact is verified byte-identical
under **both** commits and under the corrected head, artifact integrity is intact and no finding
arises. The correction did not edit the immutable review.

### 1.2 Corrected-head CI — independently verified

Verified via the GitHub Actions API against the exact corrected head, not from the PR narrative.

| Field | Observed |
|---|---|
| Run id | `33580902597` |
| Workflow | `CI` (`.github/workflows/ci.yml`), run number 378, attempt 1 |
| Event | `pull_request` |
| Head SHA | `a6b65f155de480354c66d147149fd98effb87430` — **exact corrected head** |
| Associated PR | `#32` |
| Overall status / conclusion | `completed` / **`success`** |

| Job | Expected | Observed conclusion | Result |
|---|---|---|---|
| `Classify change set` (`100094791789`) | SUCCESS | `success` | **MATCH** |
| `Lint, typecheck, test, build, Prisma, GraphQL` (Heavy, `100094814705`) | SKIPPED | `skipped` | **MATCH** |
| `CI Gate` (`100094814172`) | SUCCESS | `success` | **MATCH** |

Heavy `skipped` is correct and expected for a docs-only change set under the repository's
classification gate; it is **not** recorded as heavy-validation evidence, and nothing in this review
treats it as such. Correct CI posture for a planning PR.

---

## 2. Method

For each of `F-CLAUDE-PR5F3EA-01` … `-25` I re-read the original finding's *expected behavior* and
*recommended correction*, then located the corresponding text in the corrected packet and tested it
against three questions:

1. Does the correction state a **frozen, single** decision (not an "or"), so Cursor cannot invent one?
2. Is the correction **internally consistent** with §5.1 / §5.2 / §5.3 scope rules — the failure mode
   that produced four of the original P1s?
3. Are the **repository facts** the correction asserts actually true on the current tree?

Question 3 was answered by direct inspection, not by trusting the document. Facts independently
re-verified in this session include: `envFlag` and its `defaultEnabled = false` signature
(`app/lib/feature-flags.server.ts:9`, with `FEATURE_STOCKTAKE_INVENTORY_WRITES` / 
`FEATURE_ADJUSTMENT_WRITES` at `:18`, `:20`); `stringifyUnsignedCount`
(`app/lib/catalog-facts/admin-read/decimal.ts:149`) and its use for `objectCount` / `rootObjectCount`
(`admin-read/bulk-operation.ts:121-122`); `canonicalSuccessEligible` (`bulk-operation.ts:64`);
`DEFAULT_DISPATCH_BATCH_SIZE = 50` and `DEFAULT_MAX_PER_SHOP = 2`
(`app/sync/dispatcher.server.ts:43,45`); `WEBHOOK_ATOMIC_TOPICS` and the `app/uninstalled`
`CONTROL_ONLY` branch (`app/sync/execution-strategy.server.ts:14-36`);
`PR5_DEFAULT_WORST_CASE_CONCURRENT_CANONICAL_TRANSACTIONS = 4`
(`app/lib/catalog-facts/constants.ts:28`); the lock-capacity condition-B arithmetic
(`app/lib/catalog-facts/lock-capacity.ts:104,120-123`); queue worker concurrency
(`app/jobs/queue.server.ts:236,243`); and the live PR #30 / #31 heads, merge-bases and review blobs.

---

## 3. Disposition — `F-CLAUDE-PR5F3EA-01` … `-25`

### 3.1 Summary table

| ID | Sev | Disposition | Corrected location |
|---|---|---|---|
| **-01** JSONL completeness proof | P1 | **CORRECTED** | §C1, §4.1, §4.2 step 5, §4.4, §4.6 |
| **-02** Tombstone kill switch | P1 | **CORRECTED** | §C2, §2.3, §4.7, §4.11, §5.2 |
| **-03** Three-domain presence ownership | P1 | **CORRECTED** | §C3, §4.3, §4.6, §4.7, §C15 |
| **-04** False initial compatibility `HEALTHY` | P1 | **CORRECTED** | §C4, §4.3, §4.10, §4.11, §5.2, §5.3 |
| **-05** `bulkOperationRunQuery` exception | P1 | **CORRECTED** | §C5, §5.1, §5.2, §5.3, §9.2 |
| **-06** Two-root scanner / R-163 | P1 | **CORRECTED** | §C6, §5.2, §7, §9.1, §6 (Race AC) |
| **-07** `catalog-sync-v1` competing authority | P1 | **CORRECTED** | §C7, §2.3 commit 2, §5.2, §C13 |
| **-08** Checkpoint GID pairing / `ingestBatchId` | P1 | **CORRECTED** | §C8, §4.4, §4.9, §5.2, §C18 |
| **-09** Orphan BulkOperation recovery | P2 | **CORRECTED** | §C9, §4.2 steps 1–3 & 9, §4.9 |
| **-10** Malformed/truncated = `PARTIAL_FAILURE` | P2 | **CORRECTED** | §C10, §C1, §4.1, §4.6, §6 (Race D/O) |
| **-11** Webhook anti-starvation / bounded polling | P2 | **CORRECTED** | §C11, §4.2 step 4, §4.8, §5.2, §5.3 |
| **-12** Disabled shop mid-ingest | P2 | **CORRECTED** | §C12, §4.3, §4.4, §4.9 |
| **-13** Whole-app legacy-pattern gates | P2 | **CORRECTED** | §C13, §9.2, §4.5, §7 (R-165) |
| **-14** Domain retry topology | P2 | **CORRECTED** | §C14, §4.4, §C19 |
| **-15** Deterministic JSONL line discrimination | P2 | **CORRECTED** | §C15, §4.1, §C1 |
| **-16** Real concurrency-derived lock envelope | P2 | **CORRECTED** | §C16, §4.3, §7 (R-161), §6 (Race AW) |
| **-17** Corrected F2B/F2C status statements | P2 | **CORRECTED** | §0, §2.2, §C17, `PROJECT_STATUS.md`, `README.md` |
| **-18** Ordinal representation | P3 | **CORRECTED** | §C18, §4.4 |
| **-19** `bulk_operations/finish` strategy | P3 | **CORRECTED** | §C19, §4.4, §4.5 |
| **-20** Refetch receipt digest | P3 | **CORRECTED** | §C20, §4.5 |
| **-21** Session-lock scanner variants | P3 | **CORRECTED** | §C21, §9.2 |
| **-22** `SyncCursor` success semantics | P3 | **CORRECTED** | §C22, §4.4 |
| **-23** Retry ceilings | P3 | **CORRECTED** | §C23, §4.8, §4.10 step 4 |
| **-24** PR32/PR33 serialization | P3 | **CORRECTED** | §C24, §0, §13 item 5 |
| **-25** PR6 planning-vs-runtime governance | P3 | **CORRECTED** | §C25, §11 item 6, §12, §13 item 7 |

**Totals: CORRECTED 25 · PARTIALLY CORRECTED 0 · NOT CORRECTED 0 · REGRESSED 0.**

### 3.2 Verification detail for the specifically mandated items

**-01 JSONL completeness proof — CORRECTED.** §C1 replaces "clean EOF" with a seven-part
mechanical gate: `COMPLETED` status, complete `url` with null `partialDataUrl`, persisted
`objectCount` / `rootObjectCount`, transfer completed without abort, every line parsed,
`streamedParsedLineCount == objectCount`, and `streamedRootLineCount == rootObjectCount`. The
counts are persisted and compared as **string tokens** under the existing F2A
`stringifyUnsignedCount` contract — verified to return `string | null` and to throw on `Number`
(`decimal.ts:149`), so the plan's "never JavaScript `Number`" instruction matches the real function.
Root-line definition is given per domain by GID prefix, and Locations is correctly excluded from
count reconciliation because it is F2A pagination, not JSONL. Omitted Shopify counts **fail closed**
— the exact disposition the finding demanded. `FX-JSONL-010` / `-011` are specified as the finding
required. §4.4 adds the four count columns that make the gate persistable.

**-02 Terminal-tombstone DEFAULT-OFF kill switch — CORRECTED.** `FEATURE_PR5_ABSENCE_TOMBSTONE`,
**default `false`**, on the existing `envFlag` mechanism — verified present with a
`defaultEnabled = false` parameter, so "default OFF" is the mechanism's natural behavior rather than
an aspiration. §C2 checks it server-side immediately before any tombstone write, keeps it
runtime-disableable without a deploy, and explicitly distinguishes it from the breaker, the
inventory-write flags, and `processingEnabled` — the conflation the original finding warned about.
The OFF semantics are correct and non-destructive: presence applies, nomination collects candidates,
**zero** tombstones, and health is explicitly **not** `HEALTHY` for deletion reconciliation (§4.11).
`app/lib/feature-flags.server.ts` is added to §5.2 so the change is in scope. Breaker thresholds now
have a named configuration location (`absenceBreakerAbsoluteCount` / `absenceBreakerProportionBps`),
closing §5.13 item 6, and are correctly stated as *not* a substitute for the kill switch.

Critically, §2.3 now uses the flag to fix the **internal** ordering hazard §3.2 of the original
review raised: the flag is DEFAULT OFF through F3 merge, the v1 cutover fence moves to commit 2
ahead of the JSONL streamer, and commit 6 states that confirmation code may exist but cannot write
tombstones while the flag is OFF. The unsafe intermediate state is removed rather than reordered
around.

**-03 Three-domain presence ownership — CORRECTED.** §C3 gives the explicit fact-type → owning-domain
table the finding requested, and resolves the `ShopifyInventoryItemFact` double-observation in the
safe direction: the `inventory_levels` epoch treats the bare `inventoryItems` line as
**parent-link only** — no `full_sync` presence, no `lastSeenFullSyncRunId` write, no nomination.
That makes the existing one-slot column sufficient, so the correction correctly concludes that no
merchant-side per-domain presence migration is required and explicitly does not authorize one.
Domain execution order is frozen (`locations → catalog → inventory_levels`). `FX-ABS-003` is
specified. §4.6 and §4.7 both carry the "owning domain only" qualifier, so the contract is not
stranded in §C.

**-04 No false initial compatibility `HEALTHY` — CORRECTED.** The original finding stated that
option (a) alone was insufficient because a default change does not cover rows F2B *updates*. §C4
adopts **both** legs: the additive merchant migration (`PROJECTION_PENDING` enum value plus a column
default change on all five fact models) **and** a narrow F2B writer extension that writes
`PROJECTION_PENDING` inside the canonical transaction on INSERT **and** on any UPDATE that changes
the canonical row. §4.3 repeats the in-transaction requirement. The scope contradiction is genuinely
resolved rather than papered over: §5.2 now authorizes the merchant enum/default change (the
"SyncRun-only migration" restriction is explicitly **amended** in text), and §5.3 now reads
"`writers.ts` except the `compatibilityProjectionState` field (C4)". `FX-PROJ-009` is specified.

**-05 Narrowly scoped `bulkOperationRunQuery` exception — CORRECTED.** §C5 freezes a single exact
module path (`app/lib/catalog-facts/ingest/bulk-operation-submitter.ts`) and a single exact root
field, with "no glob; no prefix match" stated explicitly, implemented as
`CANONICAL_SUBMIT_MUTATION_EXCEPTIONS` keyed on **both** exact root field and exact module path.
§5.2 authorizes the named change to `admin-read/safety/{graphql-ast.ts,scan.ts}` and §5.3's freeze
now carries the matching carve-out, so the self-contradiction is closed on both sides. The three
negative/positive tests the finding demanded are specified verbatim, including
`inventoryBulkToggleActivation` planted **in the submitter module itself** — the case that proves
the exception cannot be widened. §9.2 restates the single-file restriction. §5.1 names the submitter
file, so the module stays inside the scanned tree rather than being relocated out of it, which was
the "worse outcome" the finding predicted.

**-06 Two recursive scanner roots with correct per-root import policy — CORRECTED.** §C6 withdraws
the word "remain" in terms ("Workers were **never** inside it"), and specifies Root A
(`app/lib/catalog-facts/**`, today's deny-by-default import policy) and Root B
(`app/jobs/workers/catalog-facts/**`, a **worker** import policy that permits `unauthenticated` from
`app/shopify.server` while still rejecting Shopify write services). This is exactly the per-root
policy split the finding required, and it correctly notes that the submitter exception is exact-path
under Root A, so Root B cannot host a mutation. R-163 is explicitly **OPEN**, "not closed by F2A
merge" and "not closed by this planning packet" — the §7 row is corrected. §9.1 adds a two-root
scanner CI step and §6's Race AC row now reads "F2A scanner (Root A only today)" with plants
required in both trees.

**-07 `catalog-sync-v1` fail-closed / drain contract — CORRECTED.** §C7 requires the worker to
branch on `payloadSchemaVersion` rather than job name, fails closed with a stable outcome code
`LEGACY_CATALOG_SYNC_V1_DISABLED`, and states the drain disposition the finding asked for across
**all three** row classes: PENDING / RETRY_WAIT / DISPATCH_LEASED jobs dead-letter, `JobReplay`
fails closed, and existing `DeadLetter` v1 rows must not be replayed onto a live v1 applicator.
`startCatalogSync`, `pollBulkOperation` / `currentBulkOperation`, full-body `response.text()`
ingestion and legacy `shopifyVariantCache` authority writes are all named as must-not-execute, and
§5.2 now permits the four files required to enforce that
(`shopify-sync.server.ts`, `shopify-gql.server.ts`, `queue.server.ts`, `webhook-processor.ts`) —
closing the scope contradiction. The cross-binding hazard is addressed at its root: §C13 extends the
`currentBulkOperation` gate to the whole application tree, so no live path can bind F3's operation.
`FX-BULK-010` / `-011` are specified.

**-08 Checkpoint BulkOperation-GID pairing and `ingestBatchId` — CORRECTED.** §C8 declares the GID
and ordinal "**one logical checkpoint identity**", requires the ordinal to reset to `NULL`
atomically with a new GID in the **same** control-plane transaction, requires resume to compare
polled GID against persisted GID and **fail closed** on mismatch, and states "checkpoint may lag
facts, never lead". The expired-URL case is resolved more strongly than the finding required: a new
domain `SyncRun` with a new fence and new GID, rather than reuse of the burned row. `ingestBatchId`
is given a fully deterministic SHA-256 derivation over
`(schema tag, syncRunId, bulkOperationGid, startLineOrdinal)`, so the orphan-batch recognition claim
becomes true rather than false precision — and §5.2 authorizes the `@@index([shopId, ingestBatchId])`
the lookup needs, which the original scope rules forbade. The finding's either/or is satisfied by
the stronger branch. `FX-BULK-012` / `-013` are specified.

**-09 Orphan operation recovery — CORRECTED.** §C9 adds the pre-submit intent row the finding
offered as an alternative *and* the bounded read-only list recovery, and §4.2 is re-sequenced so
intent persistence is step 1, before the mutation. Recovery uses `bulkOperations(first: 25)` — a
QUERY field, admissible under the F2A scanner — and never `currentBulkOperation`. The adoption rule
is fully specified (fingerprint match, `createdAt` window, status set including terminal statuses so
a second submit is not issued), with **exactly one** match required, zero matches meaning wait then
`PARTIAL_FAILURE`, and more than one match **failing closed**. Both ambiguous directions resolve to
no-double-submit, which is the correct posture against the five-per-shop ceiling. `FX-BULK-014`
specified.

**-10 Malformed / truncated stream = `PARTIAL_FAILURE` — CORRECTED.** §C10 enumerates the full set
(malformed line, aborted transfer, truncated transfer, count mismatch, unknown line, any stream
without proven complete end) and routes **all** of them to `PARTIAL_FAILURE` + zero nomination +
zero tombstone + zero success watermark. `FX-JSONL-006` is explicitly upgraded to assert **zero
nominations**, not merely "domain DEGRADED" — the precise change the finding demanded. §6's Race D/O
row records that C1/C10 extend the prohibition beyond `partialDataUrl` / `FAILED` / `CANCELED`.

**-11 Webhook anti-starvation and bounded polling — CORRECTED.** §C11 opens by conceding the
original point (PR4 fair claim is per-shop FIFO, not a webhook-class reservation) and then freezes a
concrete mechanism rather than an assertion: webhook-class preference in the fair-claim `ORDER BY`
ahead of `catalog-sync` and `inventory-state-reconcile`, deferral of catalog-sync continuation and
reconcile enqueue while a webhook backlog exists for that shop, a defined webhook class, a bounded
poll (5 s interval / 120 attempts / 600 s wall, exceeding → `PARTIAL_FAILURE`), and — answering the
finding's "whether polling holds or releases the claim" — an explicit requirement that polling
**releases** the claim between attempts via re-enqueued continuation. `app/sync/fair-claim-query.server.ts`
is added to §5.2 and §5.3 carries a matching carve-out stating the ORDER BY preference is a smallest
extension, not a PR4 major version. §9.1 retains the PR4 control-plane regression suite, so the
change is guarded. `FX-WH-011` specified.

**-12 Disabled-shop checkpoint behavior — CORRECTED.** §C12 requires a live `processingEnabled`
re-read **and** affected-row-count verification between canonical batches, and on either failing:
STOP, do not acknowledge the checkpoint, do not advance the watermark, do not call the domain or
parent job successful. This closes the exact gap the finding identified — that an RLS-filtered
`UPDATE` affects zero rows rather than raising, while `SyncRun` has no processing predicate.
Reflected in §4.3, §4.4 phase 2, and §4.9. `FX-JSONL-012` specified.

**-13 Whole-app legacy-pattern gates — CORRECTED.** §C13 re-scopes the gates from the F3 trees to
the whole `stocky-plus/app/**` tree, states "canonical path gets **no** exception", and permits
temporary legacy occurrences only on an explicit reviewed allowlist that must be **empty on live
paths after the C7 cutover**. §9.2 lists the patterns at whole-tree scope. I checked the practical
surface: `app/**` production modules currently contain exactly **one** `.text()` occurrence
(`app/services/shopify-sync.server.ts:33` — the legacy call C7 removes) and **two** `available ?? 0`
occurrences, so the whole-tree gate is operationally practical rather than an allowlist treadmill.
§7's R-165 row now requires whole-path removal/fencing "including `webhook-processor.ts`".

**-14 Domain retry topology — CORRECTED.** §C14 answers every question the finding listed, as a
frozen table with no "or": one parent `catalog-sync` DurableJob at `catalog-facts-v1`, three **child
`SyncRun`** rows executed inside that one job (not three dispatched jobs), fixed sequence, parent
success only when all three domains are `SUCCEEDED`, `REBUILDABLE_IDEMPOTENT` retry that **reuses
already-`SUCCEEDED` domains and re-runs only the failed/incomplete domain**, and new fence allocation
only when starting a new BulkOperation. This directly removes the retry-amplification hazard against
the five-per-shop ceiling.

**-15 Deterministic JSONL line discrimination — CORRECTED.** §C15 states the GID-prefix classifier
table explicitly, as the finding required, given that neither frozen document selects `__typename`.
Collection lines are ignored for identity but — correctly, and consistently with §C1 — still counted
in `streamedParsedLineCount`. The bare `InventoryItem` parent line receives the explicit disposition
that was missing, tied to §C3. Unknown, unclassifiable, or missing-id lines **fail closed** to
`PARTIAL_FAILURE` rather than being guessed, which is the correct interaction with C1/C10.

**-16 Real concurrency-derived lock-capacity envelope — CORRECTED** (with a non-blocking P3
observation at §4.1 below). §C16 states plainly that the `= 4` constant is a unit-test default and
not deployment truth, enumerates the five canonical writer classes sharing the lock pool — including
the diagnostic projection-state writer and the absence-confirmation writer that the finding said
were missing — justifies peak-per-job = 1, and freezes a derivation
`configuredWorstCaseConcurrentCanonicalTransactions = D * B` from a required, fail-closed
`STOCKY_DISPATCHER_PROCESS_COUNT` and the in-effect dispatch batch size. `FX-RACE-AW` is required to
use the derived envelope rather than the default 4, and §7's R-161 row and §6's Race AW row are both
updated to match. The finding's stated correction is delivered.

I verified the arithmetic behaves safely: with the verified defaults (`B = 50`, and queue worker
concurrency of 5 and 1 per process at `app/jobs/queue.server.ts:236,243`), `D * B` over-approximates
true in-flight canonical concurrency by roughly 8×, so condition B
(`requestedBatch * concurrency <= floor(sharedLockObjectBudget * 0.25)`) binds conservatively and the
evaluator reduces identities-per-transaction rather than permitting lock exhaustion. Erring large is
the correct direction for this parameter.

**-17 Corrected F2B/F2C status statements — CORRECTED.** §0 was re-inspected and every material
claim independently re-verified in this session: PR #31 head `cd3b87e2d0a146fc4d73d5609207f7361c4d0e27`
with merge-base `f65ab4b…` (F2A **is** an ancestor); the F2B correction review present on PR #31 at
`dba3b24d29fe257584c1f1d9d1ad6a8139114f69` with blob `b01569fd77455566438bcedbe869647beb24eda7`;
PR #30 head `2d2e8801dd383a778c1237cec4ed068922859cf0` with merge-base `5129707…` (pre-F2A); and the
F2C second-correction review at commit `7015c6e83e1b6aebbb65eaf03f4da2cc0e1251f3`, blob
`d637a9ecf0f42c3ae62f87e0391abb0b80e2e2ad`, confirmed **not** an ancestor of PR #30. Every one of
these matches the corrected §0 exactly. The corrections propagate into durable governance state:
`PROJECT_STATUS.md` no longer claims F2B is missing its correction review and now states F2C's
review exists off-branch, and `phases/phase-1/README.md` carries the same corrections plus a new
index entry `43g` recording the immutable review blob. §2.2's preconditions are restated accordingly.
The correction also correctly refuses to over-claim: F2B's in-progress CI is explicitly "**not**
recorded as a pass", and neither PR is claimed accepted or merged.

**-18 Ordinal representation — CORRECTED.** §C18 pins `Int?` (dropping the "or `BigInt?`"), fixes
1-based semantics with `NULL` before first acknowledgement, adds
`CHECK (… IS NULL OR … >= 1)`, and states monotonic-non-decreasing **within one BulkOperation GID**
with reset only under the C8 paired rule. §4.4 carries the type and the CHECK.

**-19 `bulk_operations/finish` strategy — CORRECTED.** §C19 chooses `CONTROL_ONLY` (no longer an
"or"), forbids merchant DML on that path, names the `@@index([shopId, bulkOperationGid])` lookup
index, requires toml registration, and — as the finding required, given that
`executionStrategyForJobType` fails closed to `NO_AUTOMATIC_RETRY` for unknown topics — enumerates
**every** new topic's strategy in a 19-row table, with an explicit instruction to add the atomic
topics to `WEBHOOK_ATOMIC_TOPICS` and `bulk_operations/finish` beside `app/uninstalled`. I verified
both anchor facts in `execution-strategy.server.ts`.

**-20 Refetch receipt digest — CORRECTED.** §C20 states that the webhook body is neither canonical
fact nor digest basis, and defines `payloadDigest` as SHA-256 over a canonical JSON object of
schema tag, applying DurableJob id, topic, shopId and the **sorted unique resolved identity set** —
i.e. delivery identity plus resolved identities, exactly as the finding specified. It adds a
correct refinement: APPLIED vs NOOP is deliberately excluded so concurrent writers cannot change the
digest. It requires a receipt on a canonical **no-op** so replay cannot loop, and preserves PR4's
final-write ordering. It also distinguishes this from the PR4 intake `payloadDigest`, removing a
likely implementation confusion.

**-21 Session-lock scanner variants — CORRECTED.** §C21 enumerates all four session-scoped forms
(including `pg_try_advisory_lock_shared(`, which the finding's own suggested regex arguably
under-covered), gives the broadened pattern, and preserves the `pg_advisory_xact_lock` /
`pg_try_advisory_xact_lock` exclusion. §9.2 lists all four literals.

**-22 `SyncCursor` success semantics — CORRECTED.** §C22 concedes there is no Shopify cursor for
bulk JSONL and defines an app-owned success token `full-sync-epoch:<SyncRun.id>` written **only**
when brief §8.5 and C1 both hold. Attempted/incomplete runs must not write or overwrite the cursor,
which supplies the "succeeded vs attempted" distinction the finding said was missing. Locations
in-progress pagination is correctly routed to `SyncRun.cursorAfter` control-plane state instead.
Value shape fits the verified `VarChar(512)` column.

**-23 Retry ceilings — CORRECTED.** §C23 freezes projection retry to the **PR4 attempt lifecycle**
(no longer an "or"), with the important constraint that retry must not re-apply canonical facts;
restates the bounded poll ceiling; and bounds reconcile with at-most-one pending job per shop and a
15-minute minimum enqueue interval, while correctly demoting the 60-minute figure to an engineering
test target rather than a merchant SLO (R-034 remains PR 8).

**-24 PR32/PR33 serialization — CORRECTED.** §C24 acknowledges the overlap, instructs that
**neither** PR be merged from this packet, and gives a durable ordering (runtime critical path
first, then one docs/control PR, then refresh the other against then-current main), with an explicit
prohibition on resolving overlapping control docs in parallel. §0 and §13 item 5 carry it.

**-25 PR6 planning-vs-runtime governance — CORRECTED.** The over-broad prohibition is removed at
every location the finding cited. §C25, §11 item 6, §12 and §13 item 7 now consistently state that
PR6 **runtime**, migrations, Shopify configuration and production actions remain forbidden while
expressly authorized PR6 **planning / architecture / acceptance criteria / fixtures / test
matrices** one dependency level ahead are permitted and must be marked speculative. §12 adds an
affirmative "**does** allow" bullet, and `PROJECT_STATUS.md` / `README.md` carry the same
correction, so durable governance state no longer misclassifies authorized planning as a violation.

---

## 4. New findings

Two non-blocking observations arose from this re-review. Neither reopens a corrected finding, and
neither is a scope contradiction or a data-loss path. Both are recorded as P3 because each states a
precise, mechanically checkable action — implementation cannot interpret either ambiguously.

### 4.1 `F-CLAUDE-PR5F3EC-01` (P3) — the C16 envelope derives from dispatch batch size, not worker concurrency

- **Where:** corrected plan §C16.
- **Evidence:** the frozen derivation is `configuredWorstCaseConcurrentCanonicalTransactions = D * B`
  where `B` is the dispatch batch size (`DEFAULT_DISPATCH_BATCH_SIZE = 50`,
  `app/sync/dispatcher.server.ts:43`). The quantity actually bounding simultaneously open canonical
  transactions is worker concurrency — `concurrency: 5` and `concurrency: 1`
  (`app/jobs/queue.server.ts:236,243`) — not the size of a dispatch batch. `B` is a dispatch-rate
  proxy that happens to exceed aggregate worker concurrency (50 ≫ 6) under the verified defaults.
- **Impact:** none at current configuration, and the error direction is safe: `D * B`
  over-approximates, so condition B binds conservatively and the evaluator shrinks the batch. The
  latent case is a deployment that lowers `batchSize` below aggregate worker concurrency, where
  `D * B` would **under**-approximate and permit a batch larger than the lock pool supports.
- **Expected behavior:** the envelope should be provably ≥ the real ceiling under any supported
  configuration.
- **Recommended correction (F3, non-blocking for this planning approval):** state the envelope as
  `D * max(B, Σ worker concurrency across canonical-writer queues)`, or assert at startup that
  `B ≥ Σ worker concurrency` and fail closed otherwise. `FX-RACE-AW` already exercises the derived
  value, so no new fixture class is required.
- **Missing test:** an `FX-RACE-AW` variant with `batchSize` configured below aggregate worker
  concurrency.

### 4.2 `F-CLAUDE-PR5F3EC-02` (P3) — count-token equality assumes a canonical decimal shape that `stringifyUnsignedCount` does not enforce

- **Where:** corrected plan §C1 items 6–7.
- **Evidence:** §C1 compares `streamedParsedLineCount` to the persisted `objectCount` "as unsigned
  decimal strings". `stringifyUnsignedCount` (`decimal.ts:149`) returns any `string` input
  **unchanged** — it validates neither digits-only nor absence of leading zeros/whitespace; it only
  rejects `Number`.
- **Impact:** benign and fail-safe. Shopify serializes `UnsignedInt64` canonically, so equality holds
  in practice; and if a non-canonical token ever arrived, string comparison would produce a false
  **mismatch**, which C1 routes to `PARTIAL_FAILURE` with zero nomination. The failure mode is
  availability, never tombstoning — the opposite of finding `-01`'s hazard.
- **Expected behavior:** token shape is validated before it is relied on as a completeness proof.
- **Recommended correction (F3, non-blocking):** require F3 to validate both persisted tokens against
  `^[0-9]+$` before comparison and to treat a non-conforming token exactly as an omitted count
  (fail closed, per C1's existing rule), rather than comparing raw strings.
- **Missing test:** a fixture supplying a non-canonical `objectCount` token; assert fail-closed, no
  nomination.

---

## 5. Regression check

No regression was introduced by the correction.

- The immutable review artifact is byte-identical at the corrected head (§1.1).
- No prohibited surface was touched: no runtime, schema, migration, test, or Shopify config file
  appears in the correction diff (§1).
- No risk is closed. §7 preserves every "**No**" in the "may close at F2B/F2C merge?" column and
  strengthens two rows: R-162 now reads "**Not** closed by F2B merge alone", and R-163 "**Not**
  closed by F2A merge". R-160 gains the nomination/confirmation writer the original review said was
  missing. R-161 is bound to the derived envelope. R-165 is bound to the whole-path gate.
- No verdict inflation. §0.1 records the original verdict as `CORRECTIONS REQUIRED` and states
  "This correction packet … does **not** claim independent correction approval." §12 repeats that
  it does not claim PR 5 or Phase 1 complete, does not authorize F3 runtime, does not create D-055,
  and does not enable the tombstone flag.
- No scope creep into F3 runtime: §8 states fixtures are specifications only and that this PR adds
  no runtime fixture files.
- Governance state moved strictly toward accuracy (§3.2, `-17`, `-25`).

I specifically checked whether the new §C contracts were stranded in a summary section while §4
retained the old ambiguous text — a common failure mode in correction packets. They were not: §4.1
through §4.11, §5.1 through §5.3, §6, §7 and §9.2 all carry the corresponding contract references
and the corrected wording.

---

## 6. One-F3-PR architecture

**RETAINED. No new material reason to reject it was found.**

The original review upheld the single-lane recommendation after a falsification attempt, on the
ground that a JSONL-first intermediate `main` would carry terminal-tombstone capability without the
webhook overlap protections that prevent tombstoning. The correction does not weaken that argument;
it **strengthens** the safety case in a way that also mitigates the residual hazard the original
review raised against the plan's own internal ordering:

- `FEATURE_PR5_ABSENCE_TOMBSTONE` is DEFAULT OFF through F3 merge (§C2, §2.3), so the destructive
  capability is not active at the merge boundary at all — the intermediate-state hazard is now
  governed by a flag rather than by commit ordering alone.
- The v1 cutover fence moves to commit 2, ahead of the JSONL streamer at commit 3, so a competing
  legacy authority cannot execute during the sequence (§2.3, §C7).
- §2.3 retains the instruction that if F3 is later judged too large, the allowable split is still
  **not** JSONL-vs-webhook and overlap races must not be split, with ChatGPT asked first.

The corrections are scope and contract corrections inside the single lane, as the original review
anticipated. Nothing in the correction creates a new merge-boundary hazard.

---

## 7. Finding counts (this correction re-review)

| Severity | Count |
|---|---|
| **P0** | **0** |
| **P1** | **0** |
| **P2** | **0** |
| **P3** | **2** (`F-CLAUDE-PR5F3EC-01`, `-02`) |

Original findings: 25 CORRECTED, 0 PARTIALLY CORRECTED, 0 NOT CORRECTED, 0 REGRESSED.

Both P3 items are genuinely non-blocking: each names an exact file, an exact rule, and an exact
mechanical remedy, and each currently fails in the safe direction (conservative over-approximation;
fail-closed on mismatch). Neither can be interpreted ambiguously at implementation time, and neither
needs to be resolved before F3 runtime is authorized — both should be folded into the F3
implementation and checked at the F3 exact-head review.

---

## 8. Verdict

**APPROVE PR5-F3 PLANNING CORRECTION**

All eight P1 findings are closed, including the four that were self-contradictions between the
packet's requirements and its own §5.2 / §5.3 scope rules (`-04`, `-05`, `-06`, `-07`). Those are the
ones that mattered most: each would have surfaced during a rescue week as either a CI-blocked lane or
a silent boundary violation. In every case the correction amended **both** sides — the contract and
the allowlist/freeze — rather than restating the requirement, which is the resolution the original
review demanded. All nine P2 and all eight P3 findings are closed with frozen single decisions;
notably, the packet's remaining "or" choices (`-19`, `-22`, `-23`, and the ordinal type in `-18`)
are now committed values, so the implementation ambiguities enumerated in §5.13 of the original
review are genuinely closed rather than deferred.

The four findings that admitted a path to unrecoverable loss of live merchant catalog identities
(`-01`, `-02`, `-03`, `-08`) are each closed by a mechanical, fail-closed rule anchored to a verified
repository primitive, and the destructive capability is additionally gated behind a DEFAULT-OFF
runtime kill switch. That is a materially safer contract than the one reviewed at `b886bb56…`.

The corrected head's CI is independently confirmed at the exact SHA with the expected job matrix,
and the immutable review artifact is byte-identical.

**Scope of this approval.** This approves the **planning correction only**. It is explicitly **not**:
F3 acceptance; F2B or F2C acceptance; PR 5 closure; authorization to begin F3 runtime; authorization
to merge PR #30, #31, #32 or #33; closure of R-157..R-165; or authorization of any PR 6 runtime. The
mandatory final exact-head independent review of F3 remains required, and should mechanically check
the §14 closure table plus the two P3 items in §4 above.

---

## 9. Review artifact identity

| Item | Value |
|---|---|
| Artifact | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` |
| Reviewed corrected SHA | `a6b65f155de480354c66d147149fd98effb87430` |
| Original reviewed planning SHA | `b886bb562a0f77cfb9a8964e24b9a348b310514a` |
| Current `main` at review time | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` |
| Original immutable review blob | `ebf2e87bf108bbd5eaa7d31a323842de13ae53ca` — verified unmodified |
| Review branch base | `a6b65f155de480354c66d147149fd98effb87430` (the exact reviewed corrected head) |
| Review branch | `claude/pr5-f3-planning-correction-review-vzjfw0` |
| Files changed by this review | this file only |
| Corrected-head CI | run `33580902597` — Classify SUCCESS / Heavy SKIPPED / CI Gate SUCCESS |

**Branch-base note.** This session is bound to the designated Claude review branch
`claude/pr5-f3-planning-correction-review-vzjfw0` and may not push to a different branch name. The
branch carried no unique commits and was reset from `f65ab4b…` to the exact reviewed corrected head
`a6b65f15…`, with this artifact committed on top. The requested base is honored exactly; only the
branch **name** differs from "new". PR #32 was not pushed to and was not modified.

This artifact is **immutable**. Do not edit it. Any further correction is recorded in a separate
re-review artifact.
