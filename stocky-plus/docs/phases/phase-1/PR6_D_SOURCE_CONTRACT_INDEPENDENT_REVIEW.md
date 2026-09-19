# PR6-D C3 source-contract — Independent complete-module re-review

**Reviewer:** independent Tier-A review (this chat)
**Subject PR:** #43 — `phase-1/pr6-d-order-webhook-import`
**Exact subject:** `09029c09ea7468e6ff676a11fdf020dde5deb694`
**Base / current main V:** `a3ff480f1477237f8055f10c43298480a05728a1`
**Review admission:** PR #43 comment `5705068258`
**Controlling contract:** C3 work order + PR #43 comment `5692110528`
**Review date:** 2026-09-16

## Verdict

**CORRECTIONS REQUIRED**

Eight original findings remain independently resolved. Indexed parent
membership, selected `confirmed`, and a queried ledger on first import are
real improvements over `7e0329f…`. They do not make the submitted C3 package
approvable.

Three new P1 defects were independently reproduced on this exact runtime tree:

1. **SC-01** — `createOwnedScratchDir` deletes a live same-shop/run directory
   (valid marker, process still running) and also deletes a markerless
   directory that only contains recognized artifact filenames.
2. **SC-02** — `skipThroughOrdinal` is taken from the persisted checkpoint after
   fingerprint/GID match, then applied to a newly staged download whose content
   digest is not bound to that ordinal. A reordered re-download of the same
   Bulk GID certified `SUCCEEDED` while the unapplied second order had **zero**
   facts.
3. **SC-03** — when shared remaining requests are `<= 0`, the ledger still
   calls `readRefundFact` with `maxRequests: 1` and can return `complete`.

Cursor’s million-line packet is **not** independent evidence. It was not
re-executed here: SC-02 already proves the resume/skip path can certify
coverage that did not happen. The packet also omits the C3-required SQL-call
and peak-scratch measurements, and its crash checkpoint is null.

This is not technical acceptance, evidence-completeness certification,
mark-ready, merge, or production authorization. R-176 remains OPEN/P0. R-164
and upstream residuals unchanged. PR6 and Phase 1 remain IN PROGRESS. D-054
remains authority; no D-055.

---

## 1. Identity, ancestry, scope

Independently recomputed on 2026-09-16. Nothing inherited from Cursor’s packet.

| Item | Expected | Verified |
|---|---|---|
| PR #43 | OPEN / DRAFT / UNMERGED | **Confirmed** (`mergedAt` null, `isDraft` true) |
| Subject | `09029c09ea7468e6ff676a11fdf020dde5deb694` | **Confirmed** (live head = `origin/phase-1/pr6-d-order-webhook-import`) |
| Base V | `a3ff480f1477237f8055f10c43298480a05728a1` | **Confirmed** (`origin/main`) |
| Merge base | V | **Confirmed** |
| Ahead / behind vs main | — | **18 / 0** |
| Parent of subject | `f470e6a16486fcdfb52aa636178c6b958ccd370c` | **Confirmed**; **one parent** (not a merge) |
| Runtime/test head | `1e04ddcac612a7748b5567debee324ef1e6b6167` | **Confirmed** |
| `1e04ddc..09029c0` | five docs/inventory files | **Confirmed** (report, brief, plan, PROJECT_STATUS, PR2 inventory) |
| Full PR vs V | 75 paths | **Confirmed** |
| C3 delta `7e0329f..HEAD` | 31 paths / 9 commits | **Confirmed** |
| Suggested review branch | `claude/pr43-pr6d-source-contract-review` | Did not exist; this artifact creates it |

`shopify.app.toml` adds three webhook topic/route blocks only. Scopes string and
`api_version = "2026-07"` are unchanged. `git diff origin/main -- admin-read/ apply/ prisma/ .github package.json package-lock.json` is empty.

## 2. Immutable evidence preservation

| Artifact | Required blob | At `09029c0` |
|---|---|---|
| D original complete-integration review | `48ac291a781b2347cb6017af862f2de9677826a5` | ✅ byte-identical |
| D prior correction review | `ba82a3c981cda4bec52ea453c2618319288fa66c` | ✅ byte-identical |
| C final | `0daa0e5395c69b1fb86508f133f6ade3f8430f56` | ✅ same as main |
| C original | `a90ae442a80ee593bb43bee3b15c2228f32d6e15` | ✅ same as main |
| C correction | `8c384b698bc45a7a9ac0a1dffa2ab8fdbcc65704` | ✅ same as main |
| B correction | `e902a1ce07e30174cd56cea13114be7325195c98` | ✅ same as main |
| B original | `b4533610b5af305816aef5434b884c3065b06f94` | ✅ same as main |
| Tooling | `5a47f6f8133806848ad71a545e07c030a2137e37` | ✅ same as main |
| Planning | `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` | ✅ same as main |
| A original / correction | `198e55548a2ca09942843798a9ebd3e03a30d0fa` / `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` | ✅ same as main |

`a72b403` still has sole parent `7e0329f` and adds only
`PR6_D_CORRECTION_INDEPENDENT_REVIEW.md`. Neither D review file was edited after
fast-forward.

## 3. Exact-head CI (inspected, not re-dispatched)

Run [`35088765421`](https://github.com/Vedang1998/Stocky/actions/runs/35088765421):
event `pull_request`, attempt **1**, head `09029c0…`, conclusion **success**.

| Job | ID | Outcome |
|---|---|---|
| Classify change set | `104769796828` | SUCCESS; live classification `docs_only=false` `full_ci=true` |
| Lint, typecheck, test, build, Prisma, GraphQL | `104769840097` | SUCCESS, **not skipped**; includes `npm test` and `npm run test:migrations` |
| CI Gate | `104790827245` | SUCCESS: `FULL_CI=true` `VALIDATE_RESULT=success` `CI Gate SUCCESS: full validate succeeded` |

No `workflow_dispatch`. Historical runs stay bound to their SHAs (`35086810833`
= `1e04ddc` inventory failure; `35059069898` = `4e1ad0d` typecheck). Green CI
does not override the P1 reproductions below.

## 4. Reviewer environment and independently executed suites

Disposable PostgreSQL 16 + Redis 7, Node v22.14.0, npm 11.5.2. No production or
merchant data. No Shopify store calls. Temporary probes lived under
`/tmp/pr43-c3-review-probes/` and are **not** in this commit.

| Suite | Result | Class |
|---|---|---|
| `jsonl` / `source-stage` / `mapper-bulk` / `supplemental-ledger` / `safety` / `bulk` | **61 / 61** | parser / source-query / helper |
| `bulk-query-schema` + `merchant-host` | **22 / 22** | schema gate / helper |
| `pr6-d-correction.test.ts` | **15 / 15** | D import PG |
| `pr6-d-worker.test.ts` | **12 / 12** | real `processWebhookJob` |
| `pr6-d-integration.test.ts` | **24 / 24** | D orchestration PG |
| `test:sync-exactly-once` | **35** exactly-once + **7** D046 | real-worker / queue |
| Scratch/ledger probes (tsx, not committed) | 4 probes | adversarial |
| Resume-reorder PG probe (tsx, not committed) | 1 probe | adversarial |
| `PR6_D_SCALE_1E6=1` | **not executed** | blocked by SC-02 |
| Local `graphql-codegen` | **not executed** | schema gate ran via `bulk-query-schema.test.ts`; CI Heavy codegen succeeded |
| Cursor 1e6 RSS/SQL/scratch figures | **not reused as independent measurements** | — |

## 5. Original-ID crosswalk (immutable meanings, not §14.2 labels)

Cursor §14.2 reuses N-04…N-08 for different scenarios. Dispositions below use
the **correction-review** meanings from blob `ba82a3c…`.

| ID | Original meaning | Disposition | Independent evidence |
|---|---|---|---|
| D-R-01 | Legacy worker gets query-only client | **RESOLVED** (preserved) | `pr6-d-worker.test.ts` **12/12** |
| D-R-04 | First LIVE confirmation reported applied | **RESOLVED** (preserved) | same worker suite (overlap / pending) |
| D-R-05 | Legacy skipped on no-receipt retry | **RESOLVED** (preserved) | worker + composition tests |
| D-R-06 | Checkpoint units never read | **RESOLVED** for the original defect | resume test still reads `jsonlCommittedLineOrdinal`; **new** skip-binding hole is SC-02, not a reopen of D-R-06 |
| D-R-07 | D046 weakened | **RESOLVED** (preserved) | D046 **7/7** |
| D-R-08 | Split UTF-8 corrupted | **RESOLVED** (preserved) | jsonl UTF-8 tests |
| D-R-09 | Poll budget dead | **RESOLVED** (preserved) | correction poll-exhaust test |
| D-R-12 | 53336 as peak bound | **RESOLVED** (measurement retraction) | report still dates 53336; not reopened |
| D-R-02 | 32-root total cap / never-close under qty>1 | **RESOLVED** | jsonl 33/40/100/1000 COMPLETE; qty≠child-count assembly; 40 PG ledger applies |
| D-R-03 | Empty/truncated JSONL certifies coverage | **RESOLVED** for count-token / truncation | empty-nonzero, newline truncation, proven-zero; **new** false-complete after skip is SC-02 |
| D-R-10 | Bulk A as ID list / discard required fields | **RESOLVED** for original meaning | default inner query is `ORDER_FACTS_D_BULK_A_ORDERS_LINES`; `confirmed` selected; 40 `OrderFactsImportLedger` and 0 `OrderFactById` |
| D-R-11 | Whole-stream `seenIds` then 64-root ring | **RESOLVED** | duplicate after 70 / 3000 / sort-run; child reuse same/different parent |
| N-01 | LineItem **record count** vs unit sum | **RESOLVED** | PG: qty 10 → **1** `ShopifyOrderLineFact`; jsonl indexed membership |
| N-02 | Incomplete parent committed before failure | **RESOLVED** | `onCompleteAssembly` never before EOF validation (jsonl test) |
| N-03 | Zero-current parent released with zero children | **RESOLVED** | PG three retained lines, two `currentQuantity=0` |
| N-04 | Fabricated `confirmed:true` | **RESOLVED** | mapper omit throws; `confirmed:false` maps; D query selects `confirmed` |
| N-05 | Manufactured `agreements:[]` + `agreementsComplete:true` | **RESOLVED** for first-import manufacture | mapper leaves `agreementsComplete:false`; import queries ledger for every order; SalesAgreement persisted |
| N-06 | Zero-money refund treated as no history | **RESOLVED** for the original gate | correction PG still reads refund txns when parent `updatedAt` is unchanged; **new** budget/recheck holes are SC-03 / SC-04 |
| N-07 | Duplicates beyond the release ring | **RESOLVED** | jsonl 70 / 3000 / 70000-sort-run |
| N-08 | Self-confirming all-qty-1 scale fixture | **PARTIALLY ADDRESSED, NOT APPROVED** | fixture now mixes qty 2 and zero-current; Cursor 1e6 not independently run; crash checkpoint null; SC-02 invalidates skip/recovery claims |
| N-09 | Unselected properties written as NULL | **RESOLVED** | omitted `confirmed`/`closedAt` fail closed; selected null `closedAt` remains null |

**Relabel warning:** report §14.2 “N-04 true zero-line” is **not** original N-04.
Original N-04 is fabricated `confirmed`. A passing zero-line test does not
dispose N-04 (N-04 is disposed by the mapper/query evidence above).

**Counter-evidence preserved:** the prior tested bulk import of a later order
did **not** delete an already-populated agreement ledger. Independently
reproduced: after `d-sales-agr` has one `ShopifyOrderAgreementFact`, importing
`d-sales-agr-later` leaves that count at **1**.

## 6. New findings

### SC-01 (P1) — live and markerless scratch deletion

`source-stage.ts` `isAbandonedDScratch` returns true when a valid ownership
marker exists **without** testing whether `pid` is still alive. On marker
failure it also returns true for an empty directory or one whose names are only
`source.jsonl` / `index.tsv` / `ids.tsv` / `grouped.tsv` / `emit.tsv` /
`manifest.json` / `ack.bits` / `sort-*.part` / `*.sorted`.
`createOwnedScratchDir` then `rm(..., { recursive: true })` on the
deterministic `{prefix}/{shop}/{run}` path.

`disposeOwnedScratch` does require a valid marker. The report’s “marker
required before cleanup” describes dispose, not create-time replacement.

**Reproduction (tsx probe, this review):**

- Same `shopId`/`syncRunId`, write `LIVE-WORKER-BYTES` into `source.jsonl`,
  call `createOwnedScratchDir` again: `liveStillThere=false`.
- Markerless dir containing only `source.jsonl` with
  `UNRELATED-BUT-ARTIFACT-NAMED`: create succeeds (`error: null`) and the
  file is deleted.

Job `claimAttempt` may reduce overlap in the worker, but
`runOrderFactsImportStep` itself has no mutex around this delete. Lease expiry,
direct import, and a still-running stager on the same run path are enough.

### SC-02 (P1) — skipThroughOrdinal is not bound to the newly validated source

`import.ts` computes `skipThroughOrdinal` from `jsonlCommittedLineOrdinal` when
fingerprint and Bulk GID match. `onValidatedStage` opens a **new**
`DiskOrdinalAck` with `contiguous: skipThroughOrdinal`. Assemblies whose
physical ordinals are all `<= skipThroughOrdinal` are skipped. The new
manifest hashes the new files; those hashes are not compared to the source
that produced the older ordinal.

**Reproduction (PG probe, this review):**

1. Bulk GID `gid://shopify/BulkOperation/d-reorder`, four objects: A line, A
   root, B line, B root with `confirmed` omitted.
2. First step: `PARTIAL_FAILURE` / `confirmed omitted…`; A facts = 1;
   `jsonlCommittedLineOrdinal = 2`.
3. Resume, **same** fingerprint and Bulk GID, JSONL reordered to B line, B
   root (valid), A line, A root.
4. Result: `SUCCEEDED`, `applied=1`, `examined=2`, **factsA=1, factsB=0**.

Merchant impact: an unapplied order is omitted while coverage is certified.
This is not “bytes re-read, effects not re-executed”; B never applied.

Same-order resume (correction test `d-ckpt-*`) still works. That is not a
source-identity proof.

### SC-03 (P1) — exhausted parent budget still issues a refund read and can complete

`supplemental-ledger.ts`:

```ts
const remaining = maxRequests - cost.requests;
maxRequests: remaining > 0 ? remaining : 1
```

`executeBudgetedQuery` would refuse `cost.requests >= maxRequests`. The
ternary hides that by giving the child reader a fresh allowance of 1.

**Reproduction:** `maxRequests: 1`, store has one refund. Result
`status=complete`, `graphqlCalls=2`
(`OrderFactsImportLedger`, `RefundFactById`), `counts.refund=1`.

C3 requires bounded requests with visible incomplete outcomes. A complete
ledger after exceeding the stated aggregate budget is not that.

### SC-04 (P2) — final Order recheck is continuation-gated; refund LIST is first-page only

`usedContinuation` is set only on agreement/sale extra pages. The
`version_recheck` `loadLedgerPage` runs only then, **before** refund reads, and
`assertOrderClockPin` checks identity/`updatedAt`/currency — not refund
membership. `refunds` are taken from `first.refunds`.

One-page ordinary order probe: `complete`, `recheck=0`, one GraphQL call.
Cursor’s 1e6 `ledgerCounts.recheck=0` is the same shape, not a measurement of
the required bounded final recheck.

C3: verify anchors on continuations **and** a bounded final recheck; refund
clock is independent of parent `updatedAt`. SC-04 is the contract gap. N-06’s
original “zero-money means no refund read” remains separately resolved.

## 7. Staging, projection, ledger — what did improve

Default submit/fingerprint payload is `ORDER_FACTS_D_BULK_A_ORDERS_LINES`
(`bulk.ts` `innerQuery ??` D v2). Both B gates still run (`bulk.test.ts`).
`groupObjects:false` fingerprinting remains. Frozen B document is unchanged.

Staging: spool → TSV indexes → external sort uniqueness → grouped membership →
`emit.tsv` in min-ordinal order → `onCompleteAssembly` only after EOF. Blank
physical lines do not occupy ordinals (jsonl test). Quantity is not used as
child-record count (jsonl qty≠count test + PG qty-10).

Mapper: `agreementsComplete` starts false; `confirmed` is selected boolean;
with-code money is required. Import attaches ledger agreements and sets
`agreementsComplete=true` only after `ledger.status === "complete"`. Drift
falls back to `applyNominatedOrderGid`.

Those are necessary C3 pieces. SC-01…SC-03 show they are not sufficient.

## 8. Scale and resource evidence

Cursor packet on `1e04ddc` (same runtime as this subject): 5,192 roots,
1,005,192 JSONL objects, 1,000,000 line facts, 5,192 initial ledgers, zero
rechecks/extra pages, one fallback, 5,200 GraphQL calls, two downloads, null
crash checkpoint, sampled RSS/heap, **no SQL-call count, no peak scratch
bytes**.

C3 §6 required those measurements and nonzero-prefix recovery. They remain
unresolved as independent proof. This review did **not** repeat the long
benchmark: SC-02 already falsifies skip/recovery certification.

Opt-in scale being absent from default Actions is **not** a new defect.

## 9. Required corrective tests (recommendations only; not implemented)

1. **SC-01** — live same-run stager vs second `createOwnedScratchDir`;
   markerless artifact-named dir; pid-alive marker; concurrent shops remain
   isolated.
2. **SC-02** — nonzero committed prefix, scratch gone, re-download **reordered
   or mutated** under the same fingerprint/GID: must not `SUCCEEDED` with
   missing facts. Bind skip to prior source digest or reconstruct skip only
   from accepted receipts / GIDs, not raw ordinals of a new file.
3. **SC-03** — `remaining <= 0` must not start `readRefundFact`; outcome
   incomplete; transport count ≤ maxRequests.
4. **SC-04** — bounded final recheck including refund membership; drift when a
   refund appears without parent `updatedAt` change.
5. After those gates: repeat 1e6 with SQL, scratch-byte, and after-checkpoint
   recovery instrumentation. Do not relabel the historical million-object run.

## 10. Findings summary

| ID | Severity | Location | Status |
|---|---|---|---|
| SC-01 | P1 | `sync/source-stage.ts` `isAbandonedDScratch` / `createOwnedScratchDir` | **New** — live and markerless recursive delete |
| SC-02 | P1 | `sync/import.ts` skipThroughOrdinal + `ordinal-ack.ts` | **New** — skip unbound to new source bytes; false complete |
| SC-03 | P1 | `sync/supplemental-ledger.ts` remaining `<= 0 ? 1` | **New** — extra refund read; complete after budget exhaustion |
| SC-04 | P2 | `sync/supplemental-ledger.ts` `usedContinuation` / `first.refunds` | **New** — required final recheck skipped on one-page path |
| N-08 | P2 | scale envelope + missing SQL/scratch/checkpoint | **Partial** — fixture improved; evidence still incomplete |
| N-01, N-02, N-03, N-04, N-05, N-07, N-09 | — | mapper/jsonl/PG | **Resolved** |
| N-06 | P2 original | refund gate | **Resolved**; SC-03/SC-04 are new |
| D-R-02, D-R-03*, D-R-10, D-R-11 | — | jsonl/import/mapper | **Resolved** for original meanings; *new completeness hole is SC-02 |
| D-R-01, 04, 05, 06, 07, 08, 09, 12 | — | — | **Resolved** (preserved) |

## 11. Residual ownership

R-176 remains **OPEN / P0**. R-164 unchanged. PR6 and Phase 1 remain
**IN PROGRESS**. D-054 remains authority; no D-055. Accepted A/B/C internals
were not reopened and were not modified.

Neither this verdict nor green CI run `35088765421` authorizes merge,
deployment, inventory writes, live subscription registration, or later-phase
work.

---

*Produced by read-only inspection of the exact subject, isolated synthetic
PostgreSQL and Redis, temporary reviewer probes kept outside the scanned source
tree, and the repository’s version-pinned generated Admin 2026-07 schema. No
implementation branch, peer branch, main branch, schema, grant, scope, flag,
workflow or prior review artifact was modified. No production or merchant data
was accessed and no Shopify store calls were made.*
