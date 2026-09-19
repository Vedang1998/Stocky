# PR6-D Consolidated Correction — Independent Re-Review

**Reviewer:** Claude Code (same independent chat that authored `53541112832f8da3dcfa65adea8e9a4447b0f18b`)
**Subject PR:** #43 — `phase-1/pr6-d-order-webhook-import`
**Exact subject:** `7e0329f61f2f049ebe1a58f1171b93a34d819d82`
**Base / current main V:** `a3ff480f1477237f8055f10c43298480a05728a1`
**Review date:** 2026-09-16

## Verdict

**CORRECTIONS REQUIRED**

Eight of the twelve original findings are genuinely resolved, several of them
well. However **D-R-02 is not resolved** — it has regressed into a subtler form
that affects ordinary merchant data — and the new Bulk A path introduces
**five further P1 defects**, two of which commit incorrect canonical facts. The
large-scale gate is **blocked**: its fixture encodes the same false semantic
assumption as the code under test, so the million-line run is self-confirming.

This is not acceptance, merge authorization, or deployment authorization.
R-176 remains OPEN/P0. R-164 and upstream residuals unchanged. PR6 and Phase 1
remain IN PROGRESS. D-054 remains authority; no D-055.

---

## 1. Identity, ancestry, scope

Independently recomputed; nothing inherited from the packet.

| Item | Expected | Verified |
|---|---|---|
| PR #43 state | OPEN / DRAFT / UNMERGED | **Confirmed** |
| Subject | `7e0329f6` | **Confirmed** (live head) |
| Base V | `a3ff480f` | **Confirmed** (equals live `origin/main`) |
| Merge base | V | **Confirmed** |
| Ahead / behind | — | **9 / 0** |
| Full PR scope | 64 paths | **Confirmed** (64) |
| Correction delta `25226e4..7e0329f` | 25 paths incl. review | **Confirmed** (25) |

Chain verified exactly as required:

```
25226e46  (defective subject)
  └─ 53541112  docs: PR6-D complete integration independent Tier-A review   [+1 file, review only]
      └─ 7e0329f6  fix(pr6-d): repair D-R-01–D-R-12 and complete million-line evidence
```

The first transition adds exactly one file and its sole parent is the defective
subject. The second transition's sole parent is the review commit.

**No unauthorized surface touched.** The 25-path delta contains no A schema, no
migration, no role/grant, no B reader, no C applicator, no workflow, no
dependency, no global test config, no scope and no feature-flag change. Changes
are confined to `app/lib/order-facts/sync/**`, `webhook-processor.ts`, D test
files and docs. B/C acceptance and D admission are not reopened.

## 2. Immutable evidence preservation

| Artifact | Required blob | At `7e0329f6` |
|---|---|---|
| D original complete-integration review | `48ac291a781b2347cb6017af862f2de9677826a5` | ✅ **byte-identical** |
| C final integration review | `0daa0e5395c69b1fb86508f133f6ade3f8430f56` | ✅ match |
| C original review | `a90ae442a80ee593bb43bee3b15c2228f32d6e15` | ✅ match |
| C correction review | `8c384b698bc45a7a9ac0a1dffa2ab8fdbcc65704` | ✅ match |
| B correction review | `e902a1ce07e30174cd56cea13114be7325195c98` | ✅ match |
| B original review | `b4533610b5af305816aef5434b884c3065b06f94` | ✅ match |
| Tooling review | `5a47f6f8133806848ad71a545e07c030a2137e37` | ✅ match |

No prior review was edited. The only review-file change in the delta is the
addition of the D review itself via fast-forward.

## 3. Reviewer environment and reproduced evidence

Disposable PostgreSQL 16 + Redis 7, Node v22.22.2, npm pinned 11.5.2. No
production or merchant data, no Shopify store calls. Full 14-gate provisioning
chain executed in CI order on a pristine subject, **all exit 0**.

| Suite | Result |
|---|---|
| `npm run test` (unit) | **618 / 618** — matches the report |
| D suites (`pr6-d-integration`, `-correction`, `-worker`, `-scale-envelope`) | **47 passed / 1 skipped** |
| `sync-d046-worker-finalize` | **7 / 7** |

**Exact-head CI independently read from GitHub.** Run
[`35044093460`](https://github.com/Vedang1998/Stocky/actions/runs/35044093460),
event `pull_request`, `head_sha` `7e0329f6…`, `run_attempt` 1, **success**:
Classify `104630072438`, Full Heavy `104630102099` (146 numbered steps, none
skipped), CI Gate `104641093343`. Codegen (step 129) precedes the D migration
suite (step 142). The report's CI claims are **accurate**. The older run
`34934317232` belongs to defective head `25226e46` and is not current.

**Reviewer-environment errors, not charged against the PR:** my carried-over
database from the previous head had stale role grants
(`tenant:roles:verify` missing_priv) and an already-complete enforcement state
(`preflight ok:false`, `driftClass: clean`). Rebuilding the database in CI order
cleared both. Probe files were kept out of the scanned tree and the inventory
gate passes on the pristine subject.

---

## 4. Source-contract authority — verified against the pinned 2026-07 schema

Read from the repository's own generated
`app/types/admin-2026-07.schema.json`, not from model memory:

- **`Order.currentSubtotalLineItemsQuantity`** — *"The current **sum of the
  quantities** for all line items that contribute to the order's subtotal price,
  after returns, refunds, order edits, and cancellations."*
- **`Order.confirmed`** — *"Whether **inventory has been reserved** for an order.
  Returns `true` if inventory quantities for an order's line items have been
  reserved."*

Both confirm the source-derived concerns. `currentSubtotalLineItemsQuantity` is
a **unit sum**, never a record cardinality; `confirmed` is an inventory-
reservation fact, not import provenance.

---

## 5. New findings

### N-01 (P1) — parent closure compares record count against a unit sum

`sync/jsonl.ts:66-71` defines `lineItemCount` as the number of LineItem
**records**. `sync/jsonl.ts:73-83` reads `currentSubtotalLineItemsQuantity`, a
**unit sum**. `tryClose` (line 208) releases when they are equal, and stream-end
(lines 371-385) rejects survivors on the same comparison. The two quantities are
only equal when every line has quantity exactly 1.

Executed against the real parser:

| Case | Result |
|---|---|
| One LineItem record, `quantity: 10` (units 10, records 1) | **TRUNCATED** — `LineItem count 1 !== currentSubtotalLineItemsQuantity 10` |
| 33 sequential orders, 1 record × quantity 2 | **OPEN_PARENT_BOUND** |
| 40 sequential orders, 2 records × quantity 3 | **OPEN_PARENT_BOUND** |
| 2 records × quantity 1 (control) | COMPLETE |

Confirmed end-to-end through D → C → PostgreSQL:

```
one record x quantity 10 -> {"status":"PARTIAL_FAILURE","reason":"Order … LineItem count 1 !== currentSubtotalLineItemsQuantity 10"}
33 orders x quantity 2   -> {"status":"PARTIAL_FAILURE","reason":"open parent assemblies exceeded 32"}
```

A customer buying ten of one item produces an order that **cannot be imported**.

### N-02 (P1) — premature close commits an incomplete parent snapshot to C

When retained lines have `currentQuantity: 0` (refunded, removed or cancelled),
the unit sum is smaller than the record count, so `tryClose` fires **before all
children have arrived**. Because `onCompleteAssembly` applies to C inline during
the stream (`import.ts:388`), the incomplete snapshot is applied and committed;
the later children then become orphans and the import finally fails. The failure
does **not** roll back what was already committed.

Executed (1 current unit, 3 LineItem records, two fully refunded):

```
parser : released to C with children=1  evidence=currentSubtotalLineItemsQuantity  -> final MIS_PARENTED
PG     : {"status":"PARTIAL_FAILURE","reason":"JSONL children referenced 1 missing parent(s)"}
         persisted: {"orderFacts":1,"lineFacts":1}   (expected 3)
         *** COMMITTED INCOMPLETE SNAPSHOT: 1 of 3 line facts persisted after a FAILED import ***
```

A correct final `PARTIAL_FAILURE` does not make the prior partial-snapshot
mutation acceptable. The order fact is written with `linesComplete: true`.

### N-03 (P1) — a zero-current-subtotal order is released with zero children

A fully refunded or fully cancelled order has
`currentSubtotalLineItemsQuantity: 0`, so `tryClose` fires **on the root line
itself**, before any LineItem is read:

```
parser : released to C with children=0
PG     : persisted {"orderFacts":1,"lineFacts":0}  (expected 1)
         *** ORDER PERSISTED WITH ZERO LINE FACTS and linesComplete asserted ***
```

The canonical store then asserts that a real order has no line items and that
this is complete.

### N-04 (P1) — `confirmed: true` is manufactured

`mapper-bulk.ts:53` writes `confirmed: true` unconditionally, with a comment
acknowledging Bulk A does not select it and justifying it as *"import provenance
because this `orders` connection excludes DraftOrder."* The pinned 2026-07
schema defines `confirmed` as **inventory reservation**. Verified persisted on a
first-ever pure bulk import: `confirmed = true`. Every bulk-imported order is
recorded as having reserved inventory regardless of its real state.

### N-05 (P1) — `agreements: []` with `agreementsComplete: true` manufactures absence

`mapper-bulk.ts:113-114`. Bulk A does not fetch `SalesAgreement`/`Sale`, yet the
snapshot asserts the agreement ledger is **empty and complete**. Confirmed: an
ordinary unedited, zero-refund order imports `SUCCEEDED` with
`agreementFacts: 0`, and `bulkRootNeedsAgreementRefundFollowUp` returns `false`
for it, so **no follow-up read is ever scheduled** and coverage health reports
success. Bulk-imported orders permanently lack the sale-agreement ledger that
carries at-sale identity and cost attribution.

**Counter-evidence, stated fairly:** I tested whether this *destroys* an
existing ledger. It does not. An order whose agreements were already populated
by the authoritative webhook path retained them across a subsequent Bulk A
import (`agreementFacts: 1 → 1`). The defect is manufactured absence on import,
**not** destruction of existing canonical children.

### N-06 (P2) — a zero-money refund is classified as no refund history

`mapper-bulk.ts:137-145`. Executed:
`totalRefundedSet 0.00 → follow-up false`; `1.00 → true`. A refund with no
monetary value (full restock, zero-priced line) is treated as "no refund
history", so no agreement/refund follow-up occurs and the manufactured
`agreements: []` stands.

### N-07 (P2) — duplicate identities are undetected beyond the release ring

`ReleasedRootRing` retains `max(maxOpenParents * 2, 32)` = **64** root GIDs by
default, and released child ids are deleted from `liveIds`. Executed:

| Case | Result |
|---|---|
| Duplicate root within horizon (10 released) | `DUPLICATE` detected ✅ |
| Duplicate root beyond horizon (70 released) | **COMPLETE** — 71 released to C, 70 distinct; **same root applied twice** |
| Duplicate child id reused under a later parent | **COMPLETE** — undetected |

Both count tokens still agree, because a duplicate inflates the streamed and
reported counts alike. Counts agreeing is not identity completeness. For the
advertised 126,439-root workload the ring covers 0.05 % of the stream.

### N-08 (P2) — the scale fixture encodes the same false assumption

`pr6-d-scale-envelope.test.ts:141` emits
`currentSubtotalLineItemsQuantity: children` — the **record count** — and
`pr6-d-pg-harness.ts:588-589` gives every generated line `quantity: 1,
currentQuantity: 1`. Units therefore equal records for all 126,439 generated
roots, which is precisely the only shape N-01 permits. The million-line run can
only exercise the degenerate case and cannot detect N-01, N-02 or N-03. It is
self-confirming.

Separately, `runEnvelope` requires `GITHUB_ACTIONS !== "true"`
(`pr6-d-scale-envelope.test.ts:37-38`), so the million-line envelope **never
executes in CI**. The successful exact-head CI does not contain it.

### N-09 (P3) — unselected fields are written as NULL

Verified persisted on a pure bulk import: `displayFulfillmentStatus`,
`subtotalLineItemsQuantity`, `displayFinancialStatus`, `sourceName`,
`retailLocationGid`, and all `refundDiscrepancy*`, `cartDiscount*` and
`currentCartDiscount*` columns are NULL. These are indistinguishable from
legitimately null source values, so no reconciliation can tell "Shopify says
null" from "Bulk A never asked".

---

## 6. Twelve-finding disposition

| ID | Sev | Disposition | Evidence |
|---|---|---|---|
| **D-R-01** | P1 | **RESOLVED** | `runLegacy` now receives the real transaction client; `isOrderFactsMerchantHost(tx)` rejects a query-only view (`apply-composition.ts:186-191`); new `pr6-d-worker.test.ts` drives the real `processWebhookJob` for all three frozen topics incl. `refunds/create`, mocking only the Shopify transport and using the real TenantDb. 12 tests reproduced. |
| **D-R-02** | P1 | **NOT RESOLVED — REGRESSED** | 33 ordinary orders (1 record × quantity 2) still return `OPEN_PARENT_BOUND`. The cap no longer keys on total roots but on roots that never close, and under N-01 ordinary quantity>1 orders never close. See N-01. |
| **D-R-03** | P1 | **PARTIALLY RESOLVED** | Count tokens are now validated and compared (`jsonl.ts:334-361`) — a real fix, reproduced. But parent-completeness evidence is wrong (N-01) and incomplete parents are committed before the failure is raised (N-02, N-03). Complete export and complete parent snapshots are **not** separately proven. |
| **D-R-04** | P1 | **RESOLVED** | First confirmation now returns `first_confirmation_pending` and the worker issues `completeAttemptRetry` with `retryClassification: "first_confirmation_pending"` — never `completeAttemptSuccess`. Suite covers worker death before scheduling, duplicate continuation, overlapping second confirmation and budget exhaustion. Reproduced. |
| **D-R-05** | P1 | **RESOLVED** | Legacy effects run only when `receipt != null && receiptStatus === "applied"`, inside the same transaction; the no-receipt retry no longer reports `applied`. |
| **D-R-06** | P2 | **RESOLVED** | `skipThroughOrdinal` is read from `jsonlCommittedLineOrdinal` (`import.ts:292`) and used to skip; `contiguousCommitted` + `pendingCommitted` acknowledge only the contiguous physical prefix (`import.ts:306-322`), so the checkpoint cannot leap an uncommitted gap. Reproduced. |
| **D-R-07** | P2 | **RESOLVED** | `already_applied_verified_after_rollback` assertions restored (lines 439, 470); `dWebhookMock` removed; injection moved to `applyOrderFactsWithRetry`, the real D composition boundary; a functional admin replaces the inert `{ data: {} }` mock. 7/7 reproduced. |
| **D-R-08** | P2 | **RESOLVED** | `new TextDecoder("utf-8", { fatal: true })` with `{ stream: true }` across chunks and a final `decode()`; CRLF stripped at framing. Decode failures map to `MALFORMED`. |
| **D-R-09** | P2 | **RESOLVED** | Cumulative poll budget persists across durable CONTINUE/restart and exhausts visibly; reproduced ("exhausts the cumulative poll budget across durable continuations"). |
| **D-R-10** | P2 | **PARTIALLY RESOLVED** | Bulk body is now applied directly (`bulkDirectApplies: 40`, `followUpReads: 0`), removing the N-refetch cost. But the zero-refetch result is obtained by **discarding required fields** — `agreements`, `confirmed`, and the NULL set in N-09 — which the correction order explicitly disallows. See N-04, N-05, N-09. |
| **D-R-11** | P3 | **PARTIALLY RESOLVED** | Live state is genuinely bounded (`maxLiveBytes`, per-assembly release). Duplicate detection is **not** whole-stream: it is bounded to a 64-root ring (N-07). `pendingCommitted` remains unbounded in principle behind a persistent early gap, though N-01 currently prevents reaching that scale. |
| **D-R-12** | P3 | **RESOLVED (measurement)** | The 53,336-byte heap delta is correctly retracted as a bound; sampled RSS/heap maxima are now reported as observed high-water marks. The **workload** those measurements describe is invalid (N-08), which is recorded under the scale gate rather than here. |

**Score: 8 resolved, 3 partially resolved, 1 not resolved.**

## 7. Complete-matrix items re-checked

Window sweeps vs sampling, >250-line quarantine behind the watermark, scope
invalidation and continuity, parentless complete refunds, settlement, the two
independent clocks, cancellation, health/diagnostic resolution and tenant
isolation all remain covered by the reproduced `pr6-d-integration` suite (22
tests) and are unaffected by the correction delta. Real scheduler registration
and worker/queue recovery are now genuinely covered by `pr6-d-worker.test.ts`
(D-R-01/D-R-04). No regression was found in these areas.

## 8. Scale assessment and metric units

**Gate status: BLOCKED — not satisfied, and not waived.**

Two independent reasons:

1. **The fixture is self-confirming (N-08).** Its roots declare
   `currentSubtotalLineItemsQuantity = child count` and every line has
   `quantity: 1`, so the workload exercises only the one shape N-01 permits.
2. **The real path cannot process ordinary input (N-01/N-02/N-03).** Per the
   correction order I did not consume a long benchmark to repeat a
   self-confirming fixture.

**Metric units must be restated.** The reported "1,000,000" is **JSONL objects**,
comprising 126,439 root records plus ~873,561 child records. It is **not**
1,000,000 order-line facts. A corrected run must report separately: physical
JSONL lines, root objects, child objects, expected canonical order-line facts,
actual database row counts, retained ABSENT facts, follow-up output,
crash-prefix skips, receipts, source rereads, SQL calls, Admin calls, and
queue/worker execution — and state the shortfall against the Phase 1 envelope
explicitly.

The gate must be re-executed on a corrected path with a fixture carrying
realistic line quantities (>1), refunded/removed lines with `currentQuantity 0`,
zero-current-subtotal parents, out-of-order children, and duplicate identities
spaced beyond the release ring.

## 9. Required contract decision (for owner adjudication — not implemented)

Frozen Bulk A cannot currently produce a complete canonical snapshot. The
smallest evidenced options, in increasing scope:

- **(a) Closure primitive.** Bulk A selects no field that states a parent's
  LineItem **record count**. The minimal change is to add one
  `lineItems { … }`-derived count, or to close parents only on the accepted
  physical-framing evidence rather than on any quantity sum. Changing the
  comparison to a different unit sum (e.g. `subtotalLineItemsQuantity`) is
  **not** sufficient — it is the same category error against a different
  denominator, and still breaks on refunded/removed lines.
- **(b) Completeness flags.** `agreementsComplete` and `confirmed` should carry
  the honest value for a Bulk A source: agreements **unknown/incomplete** (so
  reconciliation nominates them), and `confirmed` **unavailable** rather than
  `true`. This may require a nullable/unknown representation in the C input
  contract — a B/C contract change, which is ChatGPT's decision, not mine.
- **(c) Follow-up classification.** Refund history must not be inferred from
  refunded **money**; a zero-value refund still has refund records.

I am not authorized to implement any of these and have not done so. These are
recommendations for adjudication only.

## 10. Required corrective acceptance tests

1. **N-01** — orders with a single line of quantity 10; 33 and 40 sequential
   orders with quantity > 1; all must import completely.
2. **N-02** — parent with 1 current unit and 3 retained records: no snapshot may
   reach C until every child has arrived; a failed import must leave no partial
   canonical facts.
3. **N-03** — fully refunded order (`currentSubtotalLineItemsQuantity: 0`) must
   persist its LineItem facts, never an empty complete line set.
4. **N-04 / N-05 / N-09** — assert that unselected Bulk A fields are recorded as
   unavailable and nominate follow-up, and that `confirmed` is never fabricated.
5. **N-06** — zero-money refund must still trigger agreement/refund follow-up.
6. **N-07** — duplicate root and duplicate child identities separated by more
   than the ring horizon must fail closed.
7. **N-08** — the scale fixture must carry realistic quantities and the
   degenerate all-quantity-1 shape must not be the only coverage.

## 11. Findings summary

| ID | Severity | Location | Status |
|---|---|---|---|
| N-01 | P1 | `sync/jsonl.ts:66-83,201-210,371-385` | New — record count vs unit sum |
| N-02 | P1 | `sync/jsonl.ts:201-210` + `sync/import.ts:324-388` | New — incomplete parent committed to C |
| N-03 | P1 | `sync/jsonl.ts:201-210` | New — parent released with zero children |
| N-04 | P1 | `sync/mapper-bulk.ts:53` | New — `confirmed: true` manufactured |
| N-05 | P1 | `sync/mapper-bulk.ts:113-114` | New — manufactured complete-empty agreements |
| D-R-02 | P1 | `sync/jsonl.ts` | **Not resolved / regressed** |
| D-R-03 | P1 | `sync/import.ts` | Partially resolved |
| N-06 | P2 | `sync/mapper-bulk.ts:137-145` | New — zero-money refund misclassified |
| N-07 | P2 | `sync/jsonl.ts:97-116,190-197` | New — duplicates undetected beyond ring |
| N-08 | P2 | `pr6-d-scale-envelope.test.ts:141` | New — self-confirming scale fixture |
| D-R-10 | P2 | `sync/mapper-bulk.ts` | Partially resolved |
| D-R-11 | P3 | `sync/jsonl.ts` | Partially resolved |
| N-09 | P3 | `sync/mapper-bulk.ts` | New — unselected fields written as NULL |
| D-R-01, 04, 05, 06, 07, 08, 09, 12 | — | — | **Resolved** |

## 12. Residual ownership

R-176 remains **OPEN / P0**, pending a separate ChatGPT risk decision. R-164 and
upstream residuals unchanged. The accepted F-F03 timing residual remains
tracked. PR6 and Phase 1 remain **IN PROGRESS**. D-054 remains authority; no
D-055 was created. All prior immutable reviews, including the D complete-
integration review at blob `48ac291a…`, are preserved byte-identically.

Nothing in this review authorizes merging, deployment, inventory writes,
subscription registration, or later-phase application work.

---

*Produced by read-only inspection of the exact subject, isolated synthetic
PostgreSQL and Redis, temporary reviewer probes kept outside the scanned source
tree, and the repository's own version-pinned generated Admin 2026-07 schema. No
implementation branch, peer branch, main branch, schema, grant, scope, flag,
workflow or prior review artifact was modified. No production or merchant data
was accessed and no Shopify store calls were made.*
