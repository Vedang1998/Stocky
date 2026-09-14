# PR6-B Admin READ — independent Tier-A complete-module implementation review

**Reviewer:** Claude Code (independent adversarial reviewer; not the implementation owner)
**Review date:** 2026-09-12
**Subject PR:** [#39](https://github.com/Vedang1998/Stocky/pull/39) — `phase-1/pr6-b-order-admin-read`
**Subject head:** `d9717f68ea981aa68f108428a31d7726d0ba2a8f`
**Base / squash M:** `bdbb5bba91ac8af82e49a99e36cce5db8b401c68`
**Review branch:** `claude/pr6-b-admin-read-review-4u0qiz` (environment-assigned name; rooted exactly at the subject head)

**Verdict:** **CORRECTIONS REQUIRED** — P0 0 / P1 2 / P2 4 / P3 5.

Approval requires P0 = P1 = P2 = 0. Two findings (F-01, F-02) let a structurally incomplete or
self-inconsistent snapshot leave the reader labelled `status: "complete"`. Both are silent and
both corrupt merchant-visible refund and demand facts once PR6-C applies them.

---

## 1. Identity, admission and scope — all independently verified

Every pinned identity in the work order was recomputed from the repository rather than read from
the implementation report or the PR body.

| Claim | Method | Result |
|---|---|---|
| Merge base = M | `git merge-base d9717f68 bdbb5bb` | `bdbb5bba91ac…` ✓ |
| 5 ahead / 0 behind | `git rev-list --count` both directions | 5 / 0 ✓ |
| 49 changed paths | `git diff --name-status \| wc -l` | 49 ✓ |
| 6698 insertions / 46 deletions | `git diff --stat` | matches ✓ |
| Runtime/test predecessor `748b84f9…` | `git rev-parse d9717f68^` | is the parent of the head ✓ |
| M sole parent `09feffd3…` | `git rev-parse bdbb5bb^` | ✓ |
| M tree `9e5a700b…` | `git rev-parse bdbb5bb^{tree}` | ✓ |
| PR #39 OPEN / DRAFT / UNMERGED | GitHub API | `state=open`, `draft=true`, `merged=false`, `mergeable_state=clean` ✓ |
| Exact-M push run `34642536795` | GitHub API | `event=push`, `head_sha=bdbb5bb…`, SUCCESS ✓ |

**Admission ordering holds.** Commit timestamps: M at `20:07:27Z`, exact-M push CI completed
`21:08:00Z`, control/admission commit `4a5478dd` at `21:15:07Z`, first runtime commit `3031119`
at `21:36:21Z`. B began runtime strictly after admission.

**Authority documents unchanged between the control commit and the subject head.**
`PR6_A_CLOSURE_REPORT.md` blob `25b2f2bac6031c4ab91d92b618a2466f62567d26` and
`PR6_BC_EXECUTION_BRIEF.md` blob `fa982c10a48aeec2f58ebd1936a207a56185208e` are byte-identical at
`4a5478dd` and at `d9717f68`. No silent authority edit.

**Immutable blobs verified at both base and subject** — all five match and are unchanged:

| Artifact | Blob | base | subject |
|---|---|---|---|
| Original PR6 planning review | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` | ✓ | ✓ |
| Planning correction review | `fca2b260d03e3105782ed216f7773c53e6aef2a7` | ✓ | ✓ |
| Final planning review | `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` | ✓ | ✓ |
| Original A review | `198e55548a2ca09942843798a9ebd3e03a30d0fa` | ✓ | ✓ |
| Correction A review | `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` | ✓ | ✓ |

**Scope is clean.** The 49 paths are 39 files under `app/lib/order-facts/admin-read/**` and 10
documentation files. Confirmed by explicit path-filtered diff that the subject touches **no**
`prisma/**`, **no** `shopify.app.toml`, **no** `app/lib/order-facts/types.ts` or `constants.ts`
(A-owned), **no** `scripts/**`, **no** `app/sync/**`, **no** `app/routes/**`, **no**
`app/tenant/**`, and **no** `.github/**`. A grep for `prisma`, `.create(`, `.update(`,
`.upsert(`, `.delete(`, `$executeRaw`, `SalesDailyAggregate` and `DataIssue` across the B
production modules returns **zero** hits — the reader boundary (T48) holds statically.

`app/types/**` is declared B-owned codegen output but is `.gitignore`d
(`stocky-plus/.gitignore:42`). This is the previously **accepted** PO-11 carry-forward P3
(gitignored-codegen provenance), not a new finding — but see §4 note on gate reproducibility.

---

## 2. CI evidence — reproduced, not inherited

Run [`34651155935`](https://github.com/Vedang1998/Stocky/actions/runs/34651155935): `event=pull_request`,
`head_sha=d9717f68ea981aa68f108428a31d7726d0ba2a8f`, `run_attempt=1`, conclusion **SUCCESS**. No
`workflow_dispatch`.

- Classify `103433380234` **SUCCESS** — log shows `classification_reason=non_docs_or_unknown_path`,
  `docs_only=false`, `full_ci=true`.
- Heavy `103433404863` **SUCCESS, not SKIPPED** — 146 steps, all green.
- CI Gate `103448086235` **SUCCESS** — `classify_result=success`, `validate_result=success`,
  `full_ci=true`, `docs_only=false`, `CI Gate SUCCESS: full validate succeeded`.

**B tests genuinely ran.** I downloaded the full run log archive and grepped the Unit-tests step
rather than trusting the summary. All nine B test files appear individually with per-file counts:

```
orders.test.ts 13 · bulk-query-schema.test.ts 9 · mutation-safety.test.ts 6 · money.test.ts 5
documents.test.ts 4 · static-safety.test.ts 3 · cursor-pagination.test.ts 3
decimal.test.ts 2 · tenant.test.ts 2                                   = 47
Test Files  51 passed (51)
      Tests  439 passed (439)
```

Both of Cursor's reported counts — **47 focused B tests** and **439 total unit tests** — are
confirmed in the CI log *and* reproduced independently in my own environment (identical 51/439).

**Superseded run adjudicated.** Run `34650235398` on `3031119dbb79…` (the first runtime commit)
failed at `tenant:access:inventory:check`. The regeneration in `748b84f9` addressed the root
cause genuinely, not cosmetically: running `npm run tenant:access:inventory:check` at the subject
head emits `{"event":"tenant_access_inventory_fresh"}` with exit 0. Inventory reports
`scannedFiles 411, findings 1741, violations 0` — matching the claim. No new Actions runs were
triggered by this review.

**Local gates re-executed at the subject head** (Node v22.22.2, npm 11.5.2 pinned to match the
repo engine constraint, disposable container):

| Command | Exit | Result |
|---|---:|---|
| `npx vitest run app/lib/order-facts/admin-read --reporter=verbose` | 0 | 9 files, **47 passed** |
| `npx vitest run` (full unit) | 0 | 51 files, **439 passed** |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm run build` | 0 | clean |
| `npm run graphql-codegen` | 0 | materialized real Admin 2026-07 schema |
| `npx prisma validate` | 0 | valid (requires `DATABASE_URL`; fails without it — environmental) |
| `npx tsx scripts/pr5-f3-safety-scan.ts` | 0 | `filesScanned 182, findings []` |
| `npm run tenant:access:inventory:check` | 0 | fresh |

One environmental note worth recording honestly: **before** running codegen, 7 of the 47 B tests
fail with `Admin 2026-07 schema artifact is absent`. These are exactly the schema-dependent gates
(T20, T52, T53, Bulk A/B eligibility, top-level-node rejection, tagged-query validation). CI runs
`npm run graphql-codegen` at step 129 before Unit tests at step 141 in the **same** job, so CI
genuinely exercised them. This is not a subject defect — it is a reproducibility precondition that
any reviewer or contributor must satisfy, and it is worth stating because the entire schema-gate
half of B's contract is unverifiable without it.

---

## 3. Findings

Severity: **P0** critical safety/data loss · **P1** blocking high correctness/security ·
**P2** blocking correctness/governance/reliability · **P3** nonblocking residual.

All reproductions below were executed against the subject modules in a scratch probe suite under
`app/lib/order-facts/admin-read/__probes__/`, which was **deleted after use**; `git status` at the
subject head is clean and no subject file was modified.

---

### F-CLAUDE-PR6B-01 — P1 — Missing required `Order.refunds` is reported as an authoritative empty refund collection

**File:** `stocky-plus/app/lib/order-facts/admin-read/orders.ts:423`

```ts
const refundNodes = Array.isArray(first.refunds) ? first.refunds : [];
```

**Evidence.** `Order.refunds` is **`[Refund!]!`** in the generated Admin 2026-07 schema — verified
by introspecting the real artifact, not assumed. A non-null list cannot legitimately arrive absent
or null. The ternary converts that schema violation into an empty array inside a result the reader
labels `status: "complete"`.

**Reproduction** (three variants, all returning `status: "complete"`, `refunds: []`):

| Probe | `order.refunds` in the response | Result |
|---|---|---|
| P1.8 | key absent entirely | `complete`, `refunds: []` |
| P1.9 | `null` | `complete`, `refunds: []` |
| P1.10 | malformed object `{ edges: [] }` | `complete`, `refunds: []` |

**Merchant impact.** PR6-C consumes `OrderFactSnapshot.refunds` as the complete refund set for the
order. An order that actually has refunds, whose `refunds` field is dropped by transport truncation,
partial-error shaping, or schema drift, is applied as an order with **zero refunds**: derived
`refunded_units` collapses to 0, the frozen §6.6 refund money-reconciliation identity is evaluated
against a fabricated empty child set, and returned stock never appears in demand. Nothing is logged
— the snapshot is reported as authoritative and complete.

**Contract violated.** §6.3 "Treating a required bag as absent is fail-apply. Defensive
transport/schema-drift handling is **policy**, not API nullability." §4.2 "never accept a different
node because a field is null." T48 requires a missing/invalid required element to reject the **whole**
snapshot, with no partial row. The module already applies exactly this discipline to every
connection (`mapConnectionPage` throws when a connection is missing) and to every required MoneyBag;
`refunds` is the one required child collection that is silently defaulted instead.

**Expected behaviour.** A missing, null, or non-array `Order.refunds` must fail closed —
`ADMIN_READ_ERROR` (malformed required collection), never a complete snapshot.

**Recommended correction.**

```ts
if (!Array.isArray(first.refunds)) {
  throw new OrderFactReadWalkError(
    "ADMIN_READ_ERROR",
    "order.refunds is [Refund!]! and is missing or malformed; refusing an empty refund set",
  );
}
const refundNodes = first.refunds;
```

**Missing test.** A negative case asserting that absent / `null` / non-array `Order.refunds` does
**not** produce `status: "complete"`.

---

### F-CLAUDE-PR6B-02 — P1 — Mixed-version snapshots are assembled across requests and reported complete

**Files:** `orders.ts:263` (header pinned from the first page) and `refunds.ts:267`
(`mapRefundHeader(node, …)` where `node` is the **last** page fetched).

No code path anywhere in the module compares `updatedAt` — the plan's Clock A — between the first
page and any continuation. The only cross-page check is the GID identity assertion, which a
*modified* order still passes because its GID does not change.

**Evidence — order walk (probe P2.1).** Page 1 returns the order at `updatedAt=2026-01-02`,
`edited=false`. The line continuation returns the same order at `updatedAt=2026-06-30`,
`edited=true`. Result:

```
status=complete  headerUpdatedAt=2026-01-02T00:00:00Z  lines=2
```

The snapshot carries a **v1 header with v2 line items** and is presented as authoritative.

**Evidence — refund walk (probe P2.3).** Children paginated at `pageSize: 1`. The first page carries
`updatedAt=2026-01-02`, `totalRefundedSet=1.00`; the continuation carries `updatedAt=2026-09-09`,
`totalRefundedSet=999.00`. Because `walkRefundChildren` maps the header from whichever node it
fetched **last**, the result is:

```
status=complete  updatedAt=2026-09-09T09:09:09Z  total=999.00  childrenComplete=true  lines=2
```

A **v2 header over v1 children**, flagged `childrenComplete: true`.

**Merchant impact.** `Refund.updatedAt` and `Order.updatedAt` are Clock A (§5.4, §9.5). C decides
staleness, child repair, and snapshot atomicity from that clock. A snapshot whose clock belongs to
one version and whose children belong to another is applied under the wrong clock: T09/T44 ("stale
order response must **not** write its children") is defeated in the inverse direction — newer
children are written under an older clock and will not be re-repaired, because T45's equal-clock
repair path sees a clock it has already processed. On the refund side the self-inconsistent
snapshot makes the frozen §6.6 identity fail arithmetically, emitting `REFUND_MONEY_UNBALANCED`
(T49) that blames Shopify for an inconsistency the reader itself assembled.

Order edits during a multi-page walk are not hypothetical: `orders/edited` is a first-class PR6-D
signal, and a 300-line order (T19) takes at least three round trips.

**Expected behaviour.** A snapshot is one version or it is not complete. Capture `updatedAt` (and
`currencyCode`) from the first page; if any continuation returns a different `updatedAt`, fail
closed as `SNAPSHOT_PAGINATION_INCOMPLETE` so the observation is retried rather than applied.

**Recommended correction.** Add a `assertSameSnapshotVersion(expectedUpdatedAt, node.updatedAt)`
check immediately after each `assertReturnedGidMatches` in `orders.ts` (both continuation loops),
in `agreements.ts:83`, and in `refunds.ts:148`; and in `refunds.ts` map the header from the **first**
node rather than the last.

**Missing tests.** Continuation with a changed parent `updatedAt` must not yield `status: "complete"`
— one case for the order walk, one for the refund child walk.

---

### F-CLAUDE-PR6B-03 — P2 — A shrinking child collection is reported as a complete snapshot

**File:** `orders.ts:284-320`.

**Evidence (probe P2.4).** Page 1 reports three line items with `hasNextPage: true`; the
continuation returns an empty slice with `hasNextPage: false`. Result: `status=complete`, **1 line**.
Completeness is inferred from cursor exhaustion alone. `mapConnectionPage` only rejects the inverse
shape (empty page *while* `hasNextPage` is true), so a collection that shrinks between requests
exits the loop cleanly.

**Merchant impact.** Silent line loss understates demand for every affected variant, with no
diagnostic. B already selects `currentSubtotalLineItemsQuantity` and `subtotalLineItemsQuantity`
on the header, so the evidence needed to detect this is present and unused.

**Recommended correction.** Either fix F-02 (version pinning makes this unreachable) or cross-check
collected line count against the header quantities before returning `complete`. Both is better.

**Missing test.** Continuation returning fewer items than the first page advertised must not yield
`status: "complete"`.

---

### F-CLAUDE-PR6B-04 — P2 — Every null collapses to the existence kind `INACCESSIBLE_HISTORY_WINDOW`; C/D must parse English to recover

**Files:** `orders.ts:256-261`, `orders.ts:298-303`, `orders.ts:367-372`, `agreements.ts:77-82`;
public shape in `types.ts:206-229` (`failure` carries only `kind` and a free-text `detail`).

**Evidence.** Four structurally different envelopes produce the **identical** kind *and* the
identical detail string:

| Probe | Response envelope | Result |
|---|---|---|
| P1.1 | `{data:{order:null}}` — completed query, genuine null | `failure` / `INACCESSIBLE_HISTORY_WINDOW` |
| P1.2 | `{data:{}}` — `order` key absent | `failure` / `INACCESSIBLE_HISTORY_WINDOW` |
| P1.3 | `{data:null}` — no errors | `failure` / `INACCESSIBLE_HISTORY_WINDOW` |
| P1.4 | `{}` — neither data nor errors | `failure` / `INACCESSIBLE_HISTORY_WINDOW` |
| P1.7 | null on continuation, **after** a confirmed-LIVE first page | `failure` / `INACCESSIBLE_HISTORY_WINDOW` |

**Contract violated.** §8.5 defines `INACCESSIBLE_HISTORY_WINDOW` as requiring a completed null
**and** that the order is "**not** provably inside `orderHistoryWindowDays` at observation time."
B evaluates neither conjunct — it has no stored `processedAt` and consults no scope snapshot, and
cannot, being a stateless reader. §8.9 states "Transport errors are not absence"; P1.3/P1.4 are
protocol failures wearing an existence kind. §8.6's T42 path (`ABSENT_CONFIRMED_QUERY`) requires
"completed query returned null" as evidence distinct from every other failure — which B's public
result does not carry. T57 requires an incomplete nested walk (P1.7) to surface as
`SNAPSHOT_PAGINATION_INCOMPLETE` on `OrderFactObservationInFlight`, not as a window classification.

**Direction is fail-safe, and that matters.** `INACCESSIBLE_HISTORY_WINDOW` is the non-terminal,
reversible kind, so B never causes a false tombstone. **T41 and R-176 hold.** This is why the
finding is P2 and not P1.

**Why it still blocks.** B publishes an *existence classification* — a C/D-owned vocabulary — that
it cannot substantiate, and the only way a consumer can tell a completed in-window null (T42) from
a malformed envelope or a mid-walk disappearance is to parse the English `detail`. The work order
is explicit that no downstream component may have to do that or override a falsely authoritative
existence classification.

**Recommended correction.** Return neutral query evidence and let C/D classify:

```ts
type OrderReadNullOutcome = {
  status: "absent-observed";
  queryCompleted: true;          // no GraphQL errors, envelope well-formed
  nodeReturned: null;
  phase: "initial" | "line-continuation" | "agreement-continuation" | "sales-continuation";
  cost: RequestCostAccumulator;
};
```

Route a malformed envelope (`data` absent or `null`) to `ADMIN_READ_ERROR`, and route continuation
nulls to `SNAPSHOT_PAGINATION_INCOMPLETE` per T57. Remove `INACCESSIBLE_HISTORY_WINDOW` from
`OrderReadFailureKind` — B should not name existence kinds at all.

**Missing tests.** Distinct expected outcomes for completed-null, malformed-envelope, and
mid-walk-null; and an assertion that no consumer needs `detail` to distinguish them.

---

### F-CLAUDE-PR6B-05 — P2 — An inaccessible refund is classified as a pagination failure

**File:** `refunds.ts:306-310` (first fetch) and `refunds.ts:143-147` (continuation).

**Evidence (probe P1.11).** `readRefundFact` against `{data:{refund:null}}` returns
`status: "incomplete"`, outcome `SNAPSHOT_PAGINATION_INCOMPLETE` — on the very **first** fetch,
before any pagination has occurred.

**Contract violated.** §4.7 is explicit that refunds on orders older than the window are
"**permanently unobservable** via `order(id:)` / `refund(id:)` until `read_all_orders` is granted",
and that the correct signal is `REFUND_OUTSIDE_ACCESSIBLE_WINDOW` — with an instruction not to
"claim reconcile healed it." T57 makes `SNAPSHOT_PAGINATION_INCOMPLETE` durable on
`OrderFactObservationInFlight` with a reconciler-derived `DataIssue`.

**Merchant impact.** A permanently unobservable out-of-window refund is recorded as a *pagination*
problem, producing a `DataIssue` the reconciler will retry indefinitely and never heal, plus
merchant-visible diagnostic noise misattributed to a pagination bug. It is also internally
inconsistent: the order reader treats the same condition (`node == null` on first fetch) as a
window/existence matter, the refund reader as a pagination matter.

**Recommended correction.** Separate the two call sites. A null on the **first** refund fetch is a
window/existence observation (same neutral treatment as F-04); a null **during** continuation is
genuinely `SNAPSHOT_PAGINATION_INCOMPLETE`.

**Missing test.** `readRefundFact` on an inaccessible refund must not report a pagination outcome.

---

### F-CLAUDE-PR6B-06 — P2 — The bulk-eligibility validator returns a false PASS and loses depth across fragments; T53 does not prove what it appears to

**File:** `bulk-operation-rules.ts:92-138`.

`visit(ast, visitWithTypeInfo(typeInfo, …))` walks every definition in the document independently
and never follows a fragment spread. Four consequences, each reproduced against the **real**
generated Admin 2026-07 schema.

**(a) Affirmative false PASS — the most serious.** A schema-valid document containing one legal
connection plus a fragment-hidden top-level `nodes`:

```graphql
query M { orders(first:1){ edges { node { id } } } ...Hidden }
fragment Hidden on QueryRoot { nodes(ids:["gid://shopify/Order/1"]) { id } }
```

```
C2: schemaValid=true  hasTopLevelNodeOrNodes=false  eligible=true  reasons=[]
```

The gate declares an illegal bulk document **eligible with zero reasons**.

**(b) Nesting depth is lost across fragment spreads.** Semantically identical documents:

```
C1 INLINE   : maxDepth=3  conns=products@1,variants@2,media@3   → depth rule fires
C1 FRAGMENT : maxDepth=1  conns=products@1,variants@1,media@1   → depth rule never fires
```

**(c) Top-level `node`/`nodes` is missed behind named *and* inline fragments** (P3.3): direct →
`hasTopLevelNodeOrNodes=true`; via named fragment → `false`; via `... on QueryRoot { node }` → `false`.

**(d) Counting is mis-scoped.** Unused fragment definitions are counted as executed connections
(P3.4: four connections from six dead fragments), and connections are summed across *all*
operations rather than scoped to the selected one (P3.5: four operations → six connections →
false reject at the five-connection limit). Shopify executes exactly one operation.

**Impact — bounded honestly.** `evaluateBulkOperationRules` has **no production caller**:
`assertBulkOperationEligible` has zero callers repo-wide, `bulk-operation-rules.ts` is not exported
from `index.ts`, `BULK_B_PRODUCTION_ENABLED === false`, and no live-store submission is authorized.
**There is no exploitable runtime vulnerability today.** No server execution was performed, and a
documented-rule rejection is not claimed here as proven server behaviour.

**Why it still blocks.** T53 requires that an illegal Bulk C document be rejected by the bulk gate.
The in-repo Bulk C *is* rejected — but the passing test asserts `maxDepth > 2`, and probe C1 shows
that property survives only because that document happens to be written inline. Restructured behind
fragments, the same three-level document reports `maxDepth=1`; the in-repo Bulk C is then caught
only incidentally, by the unrelated Node-interface rule. The gate does not establish the property
the plan relies on, and becomes unsound the moment any later lane enables bulk submission. A gate
that returns `eligible: true` for an illegal document is worse than no gate, because it is trusted.

**Recommended correction.** Resolve `FragmentSpread` against the document's `FragmentDefinition`s
while carrying the connection-ancestor stack through the spread; scope traversal to the selected
operation (or reject multi-operation bulk documents outright); detect root `node`/`nodes` through
both named and inline fragments on the root type. Guard against fragment cycles.

**Missing tests.** The five adversarial documents above (C1 fragment form, C2, P3.3 named + inline,
P3.4, P3.5), each asserting the same verdict as its inline-equivalent.

---

### F-CLAUDE-PR6B-07 — P3 — Refund-line `restocked` and `location { id }` are never selected, leaving A columns permanently unfillable

**Files:** `documents.ts:380` (`fragment RefundLineFactFields on RefundLineItem`) and the inline
refund-line selection in `RefundFactById` at `documents.ts:657`. Both select `restockType` only.

A's merged `ShopifyOrderRefundLineFact` declares `restocked Boolean?` and
`restockLocationGid String?`. Plan §5.4's source table maps `restockType` / `restocked` and
`restockLocationGid ← location.id`. Introspection of the real 2026-07 schema confirms
`RefundLineItem` exposes both: `id, lineItem, location, price, priceSet, quantity, restockType,
restocked, subtotal, subtotalSet, totalTax, totalTaxSet`.

**Severity rationale — deliberately P3, not higher.** PO-09 makes Monday rescue metrics shop-wide
and §16.2 defers location-grain sales to Q-014; §5.4 marks both fields "inventory restock **signal
only** — PR 6 does not mutate inventory." No Monday-critical metric consumes them, the columns are
nullable, and they stay honestly NULL rather than wrong. This is an extraction-completeness gap
against §5.4, not a correctness defect.

**Recommended correction.** Add `restocked` and `location { id }` to both refund-line selections and
surface them on `RefundLineRead` as `restocked: boolean | null` and `restockLocationId: string | null`.

---

### F-CLAUDE-PR6B-08 — P3 — `RefundLineRead` carries no explicit ordinal

§5.4 keys refund lines on `refundLineOrdinal`, "zero-based position within the **complete,
fully-paginated** `refundLineItems` connection of that refund snapshot", because
`RefundLineItem.id` is nullable lineage and not the unique key. B preserves the ordering correctly
— lines are appended in cursor order and `childrenComplete` guarantees the list is whole — so the
ordinal *is* recoverable as the array index. But the contract is implicit: nothing in the type or a
comment tells C that array position is load-bearing identity. Recommend an explicit `ordinal:
number` on `RefundLineRead`, or at minimum a documented invariant.

---

### F-CLAUDE-PR6B-09 — P3 — `pageSize` and `maxRequests` are unvalidated

Probe P5.1: `pageSize: 1.5` → `status=complete`; `pageSize: Infinity` → `status=complete`
(serializes to `null` for an `Int!` variable and would be rejected by Shopify, but is not caught
locally). `0`, `-1` and `NaN` fail closed as `SNAPSHOT_PAGINATION_INCOMPLETE`.

Budget handling is **correct** and worth noting positively: probe P5.2 shows `maxRequests` of `0`
and `-5` fail closed with **zero** network calls, because `executeBudgetedQuery` checks the budget
before transport.

Both options are server-only structural inputs and not externally reachable, so this is a
robustness nit. Recommend validating both to positive integers, `pageSize ≤ 250`.

---

### F-CLAUDE-PR6B-10 — P3 — `lineItem.quantity` accepts negative and unsafe-magnitude integers

Probe P4.3: `quantity: -1` → `status=complete`, stored `-1`; `quantity: 9007199254740992`
(> `MAX_SAFE_INTEGER`) → `status=complete`; `quantity: 1.5` → correctly rejected.
`LineItem.quantity` is a non-negative `Int!`.

`Sale.quantity` correctly uses `optionalInteger` and **must** permit negatives (§7.1 / T55 store
`-2` for a documented RETURN) — that is right and must not be "fixed". The recommendation applies
only to `LineItem` counts.

---

### F-CLAUDE-PR6B-11 — P3 — PR #39 body wording contradicts the recorded admission

The PR body states "PR6-C apply, PR6-D runtime, production … remain **NOT AUTHORIZED**". The
`DECISIONS.md` item 24 added **in this same diff** records that "PR6-B and PR6-C complete-module
work is **AUTHORIZED** after this admission", and PR [#40](https://github.com/Vedang1998/Stocky/pull/40)
is open in draft at the pinned C reference head `04a3e276c9d607e440051603e54e7c96dc9ad19f`.

The in-repo control record is the correct one; the PR body is stale. Metadata only, no code impact,
and per the work order this review was not paused for a metadata-only push.

---

## 4. ChatGPT's source-inspection hypotheses — adjudicated

These were treated as review targets, not findings. Four did not survive reproduction.

### Refuted — `requireDecimalString` lacking decimal grammar is **not** a B defect

The observation is factually correct. Probe P4.1: all fifteen malformed inputs are **accepted**,
none rejected — `"abc"`, `"1.2.3"`, `"NaN"`, `"Infinity"`, `"1e5"`, `"--5"`, `"12,34"`, `"$5.00"`,
`" 5 "`, `"0x10"`, `"5."`, `".5"`, `"+5"`, `"1_000"`, and a 40-digit overflow value. Probe P4.2
confirms `"not-a-number"` reaches a `status: "complete"` snapshot as `netPaymentSet.shopAmount`.

But the frozen contract specifies exactly this boundary. §6.1: "`requireDecimalString` /
`optionalDecimalString` from F2A decimal helpers … **Empty/non-string fails closed**." §6.3 assigns
rejection of malformed decimals to the **apply** boundary: "present-but-invalid decimal still
**fail-applies** the snapshot" — fail-apply is C's verb throughout the plan, and PostgreSQL
`NUMERIC(20,6)` is the enforcing boundary. B implements the approved contract precisely.

**Accepted residual, not a finding:** C must not read `status: "complete"` as an assertion of
decimal validity. Worth one sentence in B's report and one assertion in C's suite. I decline to
demand lossy normalization or rejection of valid raw text here.

### Refuted — authorization and transport failures are **not** misclassified as window-inaccessibility

Probe P1.5 (`data.order: null` **plus** non-throttle errors) and P1.6 (an `ACCESS_DENIED`-shaped
error) both return `ADMIN_READ_ERROR`, never an existence kind. `executeAdminReadQuery` throws on
any GraphQL error unless `allowFieldErrors` is set (it never is on these paths), and
`executeBudgetedQuery` maps that to `ADMIN_READ_ERROR`. The error path is correct; only the
*error-free* null envelopes are conflated, which is F-04 and narrower than hypothesized.

### Refuted — `tenant.ts` early return is not a vulnerability

`assertTrustedOrderAdminReadContext` returns early when `context.request` is absent
(`tenant.ts:14`). `denyConflictingClientShop` exists to reject a **client-supplied** shop claim
against trusted server identity; with no request there is no claim to conflict with, so there is
nothing to deny. T03 passes and the deny path is exercised.

**Residual (P3-adjacent, recorded not raised):** nothing cross-checks that `context.admin` and
`context.shop` refer to the same shop. Both are server-only structural inputs assembled by a
trusted caller, and the work order is explicit that structural server-only inputs are not
automatically a vulnerability. Recommend PR6-D's orchestration cross-check
`readShopTimezoneCurrency().shopGid` against the session's shop once per worker run — this belongs
to D's revocation/orchestration lane, not to B's extraction.

### Refuted — T20 does not incorrectly block `Refund.transactions`

`list-pagination.ts:60-87` resolves each field's real type through `TypeInfo` against the generated
schema and flags a pagination argument **only** when the field is a LIST and *not* a Connection.
`Refund.transactions` is a Connection and is correctly permitted; `constants.ts:28` documents this
explicitly. The T20 test passes against the real 2026-07 schema. The implementation is sound.

---

## 5. Contract coverage — B-owned §19 rows

| Case | Outcome | Basis |
|---|---|---|
| T02 mutation AST reject, no network | **PASS** | `assertCanonicalReadDocument` runs before transport in `execute.ts:61`; non-query operations and 16 forbidden field names rejected; test passes |
| T03 client shop header sets tenant | **PASS** | `denyConflictingClientShop`; deny and matching-header cases both tested |
| T17/T18 test order, gift-card/tip lines | **PASS** | `test` and `isGiftCard` preserved; reproduced |
| T19 300 lines, no silent 250 cap | **PASS** | reproduced at `pageSize: 100` |
| T20 named LIST `first`, `Refund.transactions` allowed | **PASS** | correct Connection/LIST discrimination; `refunds { }` selected with no pagination args (`documents.ts:171`) |
| T30 Number money rejected | **PASS** | `money.ts:34` explicit Number guard |
| T39 boundary extra page (101 lines) | **PASS** | reproduced |
| T41 aged-out null must not tombstone | **PASS** (direction) | returns the non-terminal kind; classification quality is F-04 |
| T48 one invalid required MoneyBag rejects whole snapshot | **PASS** for money bags; **GAP** for `Order.refunds` | F-01 |
| T52 `Sale` without inline fragments fails codegen | **PASS** | `specifiedRules` against real 2026-07 schema |
| T53 Bulk C rejected by the bulk gate | **PASS as written; unsound as a gate** | F-06 |
| T56 two refunds each exceeding one child page | **PASS** | reproduced; truncated embeds correctly re-fetched via `RefundFactById` |
| T57 exhausted/incomplete walk | **PARTIAL** | budget exhaustion correct (zero calls past the limit); mid-walk nulls misrouted (F-04) and inaccessible refunds misrouted (F-05) |
| Reader boundary (no canonical DML) | **PASS** | static grep + `static-safety.test.ts` |
| API 2026-07 field authority | **PASS** | codegen against the live 2026-07 schema; all five named operations match the plan; no forbidden field present |

**Downstream adapter sufficiency.** Field lineage was traced GraphQL selection → mapper → public
DTO for all eight required money-bag groups (§6.3) — Order 7, Line 4 (with both
`discountedTotalSet` argument aliases mapped as required), Refund 1, Refund line 3 including
`priceSet`, Refund shipping line 2, Order adjustment 2, Sale 1, Order transaction 1 — and all are
present and required-checked. Structurally different DTO names (e.g.
`discountedTotalSetWithCodeDiscounts`) are a legitimate lossless adapter concern for D, not a
defect. The two genuine source gaps are F-01 (refund collection completeness) and F-07
(`restocked` / `location`). Refund-line ordinal reconstruction is sound but implicit (F-08).

**Not executed / not claimed.** No Shopify store query, submission or mutation; no
`bulkOperationRunQuery`; no production or merchant data access; no new Actions run; no live
refund-bearing-order ratio (remains **UNVERIFIED**, correctly labelled as such by the subject).
The historical PostgreSQL suites (`test:migrations`, `test:tenant-access`, `test:sync-*`) were not
re-run locally — they are unrelated to B's reader boundary and were verified green in the exact-head
CI evidence above. The B→C scratch round-trip probe belongs to C's reviewer and was not performed.
`prisma validate` requires `DATABASE_URL`; it passes when supplied.

---

## 6. Safety state

- PR #39 unmodified — head remains `d9717f68ea981aa68f108428a31d7726d0ba2a8f`.
- PR #40 unmodified — head remains `04a3e276c9d607e440051603e54e7c96dc9ad19f`.
- `main` unmodified — remains `bdbb5bba91ac8af82e49a99e36cce5db8b401c68`.
- No merge, no rebase, no mark-ready, no CI reconfiguration, no new Actions run.
- No production, Shopify store, or merchant-data access. No scope addition or flag enablement.
- No implementation, test, schema or configuration file changed by this review. Scratch probes were
  created under a `__probes__/` directory and deleted; `git status` at the subject head is clean.
- This review commit adds exactly one new file and has the subject head as its sole parent.
- Shared generated `PR2_TENANT_ACCESS_INVENTORY.md` was **not** edited. B reports `scannedFiles 411`
  and C `392` from separate trees; a future combined tree requires regeneration by the tool.

---

## 7. Required corrections before approval

1. **F-01 (P1)** — fail closed on missing / null / non-array `Order.refunds`; never emit an
   authoritative empty refund collection.
2. **F-02 (P1)** — pin the snapshot version from the first page and fail closed on an `updatedAt`
   change during any continuation; map the refund header from the first page, not the last.
3. **F-03 (P2)** — reject a child collection that shrinks across pages, or cross-check against the
   header line quantities.
4. **F-04 (P2)** — return neutral query evidence instead of an unconditional existence kind; route
   malformed envelopes to `ADMIN_READ_ERROR` and continuation nulls to
   `SNAPSHOT_PAGINATION_INCOMPLETE`.
5. **F-05 (P2)** — classify an inaccessible refund as a window/existence observation, not a
   pagination failure.
6. **F-06 (P2)** — resolve fragment spreads with depth, scope counting to the selected operation,
   and detect fragment-hidden top-level `node`/`nodes`.

P3 items F-07 through F-11 are nonblocking and may be carried forward with an owner disposition.

---

## 8. Assessment

The module is careful work. Cursor's reported evidence is accurate in every particular I checked —
47 and 439 both reproduce exactly, locally and in the CI log; the local gate table is truthful; the
superseded-run root cause was genuinely fixed rather than papered over; and the report does not
overclaim the unverified refund-bearing-order ratio. The mutation AST deny, the T20
Connection/LIST discrimination, the required-versus-optional MoneyBag tables, the shop-currency
mismatch rule, the pre-transport request budget, the cursor fail-closed primitives, and the
`RefundFactById` continuation for truncated embedded refunds are all correctly built, and four of
the five hypotheses handed to me did not survive contact with the evidence.

What blocks approval is a single recurring pattern rather than sloppiness: **completeness is
inferred where it should be proven.** An absent required list becomes an empty one; cursor
exhaustion is taken as proof of a stable version; a null is given a name that requires evidence the
reader does not hold; a validator walks definitions it will not execute and skips the ones it will.
Each is a place where the reader answers "I don't know" with "nothing here" — and because PR6-C
trusts `status: "complete"` as authoritative, that answer becomes a merchant-visible fact about
refunds and demand.

The corrections are narrow and local. None requires redesign, and F-01 in particular is a
three-line change.

**P0 0 · P1 2 · P2 4 · P3 5**

CORRECTIONS REQUIRED
