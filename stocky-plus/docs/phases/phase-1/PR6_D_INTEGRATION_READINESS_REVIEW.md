# PR6-D Integration Readiness Review — adversarial preparation package

**PLANNING ONLY — NOT IMPLEMENTATION APPROVAL.**

This artifact is one-dependency-level-ahead preparation authorized by PR #37 comment
[5638553192](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5638553192)
("Claude may separately perform one-dependency-ahead PR6-D integration/reconciliation planning and
fixture design after the same admission gate; that is not D runtime or final implementation
approval"). It is **not**:

- approval of PR6-B or PR6-C;
- a PR6-D implementation authorization or design freeze;
- a downstream admission record;
- a claim that any B/C/D runtime exists, was tested, or passed CI.

No runtime, schema, migration, worker, reader, applicator, route, configuration, package, or
workflow file was created or modified by this task. No production system, merchant store, or
Shopify mutation was touched.

| Field | Value |
|---|---|
| Review date | 2026-09-11 |
| Reviewer | Claude Code (independent) |
| Review branch | `claude/pr6-d-integration-readiness-8vs1ar` |
| Branch base SHA | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` (current `origin/main`) |
| Content source read | `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02` (accepted PR6-A head, read-only) |
| **M (post-merge squash SHA)** | **UNRESOLVED — PR #37 is not merged. See §1.** |
| Verdict | None. This task produces no verdict. |

---

## 1. Admission gate — status: **NOT PASSED**

The work order requires seven admission conditions before any downstream implementation or
downstream admission record. Verified 2026-09-11 against GitHub and the local clone.

| # | Required condition | Observed | Result |
|---|---|---|---|
| 1 | PR #37 CLOSED/MERGED, merged subject head exactly `f7a39c36…` | `state: open`, `draft: true`, `merged: false`, head `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02` | **FAIL — not merged** |
| 2 | M is the squash commit, sole parent `09feffd3…` | M does not exist | **BLOCKED** |
| 3 | `git rev-parse M^{tree}` equals accepted head tree | accepted tree is `9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc`; no M to compare | **BLOCKED** |
| 4 | Remote `main` equals M | `git ls-remote` → `main = 09feffd3f36eb4698f2ed8a152efe414cd9b77bd` (unchanged, pre-merge) | **BLOCKED** |
| 5 | Exact-M **push** CI SUCCESS (Classify + full Heavy + CI Gate) | no push run can exist for a commit that does not exist | **BLOCKED** |
| 6 | Review artifact at M is `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md`, blob `da388c5d…`, verdict `APPROVE PR6-A FOUNDATION CORRECTION` | at accepted head: `git rev-parse f7a39c36:…/PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` → `da388c5d2ffa8bc0e04312de9c14a831b5ba4010`; verdict text confirmed in file | **PASS at accepted head** (M unverifiable) |
| 7 | Original review immutable at `198e5554…`; accepted planning review at `4f5ea10f…` | not re-verified at M because M does not exist; both blobs are referenced as immutable in D-054 item 23 and the PR #37 body | **DEFERRED** |

**Independently confirmed facts (not merge evidence):**

- Accepted head `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02`, sole parent
  `1f615c516ff4db927fb641bb96418dd217fe3a22`, tree `9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc`.
- Pre-merge exact-head `pull_request` CI run
  [`34137287606`](https://github.com/Vedang1998/Stocky/actions/runs/34137287606) — verified
  directly from the Actions API, not from the PR body:
  - Classify `101791087231` — `success`
  - Heavy `Lint, typecheck, test, build, Prisma, GraphQL` `101791122346` — `success`, 146 numbered
    steps plus post steps, every step `conclusion: success`, none skipped
  - CI Gate `101806131016` — `success`
  - all three jobs carry `head_sha: f7a39c3664a8a45b7a7cd3055079b4ebc888bb02`
- **This is `pull_request` CI, not the required exact-M `push` CI.** Gate item 5 explicitly rejects
  a green pre-merge run as sufficient.

### F-CLAUDE-PR6DR-01 — P1 — admission gate not passed; downstream runtime must not start

- **File / evidence:** GitHub PR #37 state; `git ls-remote --heads origin` → `main = 09feffd3…`.
- **Merchant impact:** None directly. Indirect: if a lane starts from an unmerged branch or a guessed
  M, its entire CI and review evidence chain is void and must be redone.
- **Reproduction:** `git fetch origin main && git rev-parse origin/main` → `09feffd3f36eb4698f2ed8a152efe414cd9b77bd`.
- **Expected behavior:** Owner squash-merges PR #37; M is resolved from GitHub, not guessed; gate
  items 1–5 re-verified; only then may B publish the control commit and may B/C branch from M.
- **Recommended correction:** Owner action. No agent may merge. Before any downstream coding, re-run
  the §1 table and pin the literal M.
- **Missing test:** n/a (process gate).

**Consequence for this artifact:** every base-dependent statement below is pinned to the *accepted
head* `f7a39c36…`, which carries the accepted file contents. When M exists, its tree must equal
`9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc`; if it does, every content claim here transfers unchanged.
If it does not, this package must be re-verified before use.

---

## 2. Work-in-progress inspected

**None. No B or C branch exists.**

`git ls-remote --heads origin` (2026-09-11) lists no `phase-1/pr6-b-order-admin-read` and no
`phase-1/pr6-c-order-fact-applicator`. The only PR6 branches are
`phase-1/pr6-a-order-refund-fact-foundation` (`f7a39c36…`) and prior Claude review branches.

Therefore:

- zero WIP SHAs were inspected;
- no contract mismatch against B/C implementation could be recorded;
- §7 of this artifact derives B/C interface expectations from the **approved plan and A's actual
  merged contracts only**, and each item is marked as an expectation to verify, not a finding
  against code that exists.

### F-CLAUDE-PR6DR-09 — P2 — no B/C control records exist; this package is unreconciled against the execution brief

- **File / evidence:** `git ls-remote --heads origin`; no
  `stocky-plus/docs/phases/phase-1/PR6_A_CLOSURE_REPORT.md` or `PR6_BC_EXECUTION_BRIEF.md` at
  `f7a39c36…` or on any remote branch; no `PR6_BC_ADMISSION_READY` comment on PR #37 (the PR has
  exactly one comment, `5638553192`, the ChatGPT decision).
- **Merchant impact:** None today.
- **Expected behavior:** After the gate passes, B publishes the docs-only control commit and the
  `PR6_BC_ADMISSION_READY` comment; C and this package are then reconciled against the published
  `PR6_BC_EXECUTION_BRIEF.md`.
- **Recommended correction:** Treat §7 and §9 of this artifact as **provisional** until the
  execution brief is published; re-reconcile file ownership and test-home assignments against it.
- **Missing test:** n/a.

---

## 3. Source → requirement matrix (D-owned surface)

Every D-owned signal, route, queue element, observation step, import step, cursor and reconcile step
mapped to the approved plan clause and to the **existing repository function it must integrate with**.
"Exists" is verified against the working tree at `f7a39c36…`.

### 3.1 Webhook topics and routes

| Topic | Plan clause | Sanitizer version | Route (D-owned, new) | Existing integration point | Status |
|---|---|---|---|---|---|
| `orders/create` | §9.1, PO-02 | **keep `webhook-projection-orders-create-v1`** | `app/routes/webhooks.orders.create.tsx` **exists** | `sanitizeOrderProjection`, `runLegacyWebhookHandler` | additive canonical apply only |
| `orders/cancelled` | §9.1, PO-02 | keep `…-orders-cancelled-v1` | exists | same | additive canonical apply only |
| `refunds/create` | §9.1, PO-02 | keep `…-refunds-create-v1` | exists | `sanitizeRefundProjection` | additive; refetch refund **and** parent if accessible |
| `orders/edited` | §9.1, §9.2 | **new identity-only** | `webhooks.orders.edited.tsx` — **absent** | must add to `WEBHOOK_PROJECTION_SCHEMA_VERSIONS`, `WEBHOOK_ATOMIC_TOPICS`, `shopify.app.toml` | new |
| `orders/delete` | §9.1, §8.12 | **new identity-only, fail-closed** | `webhooks.orders.delete.tsx` — **absent** | same | new |
| `order_transactions/create` | §9.1, PO-06 | **new identity-only** | `webhooks.order_transactions.create.tsx` — **absent** | same | new |
| `orders/updated` | §9.1 | — | — | — | **post-Monday; not in scope** |

`shopify.app.toml` at `f7a39c36…` subscribes `orders/create`, `orders/cancelled`, `refunds/create`
and the catalog topics. Scopes are
`read_products,write_products,read_inventory,write_inventory,read_orders,read_locations` —
**`read_all_orders` is absent and must not be added** (PO-01; D file ownership says "additive topics
only; do not add `read_all_orders`").

### 3.2 Job types, strategy, envelope

| Element | Plan clause | Existing repository fact (verified) | D obligation |
|---|---|---|---|
| `webhook:orders/{edited,delete}`, `webhook:order_transactions/create` | §9.4 | `WEBHOOK_ATOMIC_TOPICS` in `app/sync/execution-strategy.server.ts` contains 17 topics; **none of the three** | add all three, else `executionStrategyForJobType` falls through to `NO_AUTOMATIC_RETRY` |
| `order-facts-sync` | §9.4 | `executionStrategyForJobType` switch has `catalog-sync`, `inventory-state-reconcile`, `abc-analysis-shop`, `abc-analysis`; no order job | add as `REBUILDABLE_IDEMPOTENT` |
| `order-facts-reconcile` | §9.4, §11 | absent | add as `REBUILDABLE_IDEMPOTENT` |
| Envelope | §9.4 | `app/sync/envelope-v3.server.ts` present; `tenant-job-envelope-v3` | **unchanged** — no new envelope version |
| Application key | §9.4, §13 | `webhookApplicationKey(deliveryId)` → `webhook-delivery:<id>`; `SyncApplicationReceipt` keyed `(shopId, applicationKey)` | reuse unchanged |
| Unknown job types | §9.4 | `default: NO_AUTOMATIC_RETRY` already fail-closed | preserve |

### 3.3 Observation lifecycle (A's merged contract)

`OrderFactObservationInFlight` (verified at `f7a39c36…`) carries `resourceKind OrderResourceKind`,
`observationRequestGen BigInt`, `observationResponseGen BigInt?`, `lifecycleState`, `terminalOutcome`,
`failureCode`, `failureDetail`, `accessScopeSnapshot String[]`, `leaseDurationMs`, `leaseExpiresAt`,
`durableJobId`, `jobAttemptId`, `correlationId`.

`ORDER_RESOURCE_KINDS = ["Order","OrderLine","Refund","RefundLine"]` (constants.ts). There is
**no** `Agreement`, `Sale`, `Adjustment` or `Transaction` resource kind.

**Derived constraint for D (not a defect):** an `OrderAgreementSalesPage` continuation and a
`Refund.transactions` page are *parts of* the parent Order / Refund observation, not observations of
their own. One `Order` observation must therefore span the entire nested walk — `lineItems` +
`agreements` + every `sales` continuation — and `observationResponseGen` may only be allocated once
the whole walk is complete. This is consistent with §4.3.6 ("canonical apply occurs only after every
required connection for that snapshot is complete") and §4.3.10.

`ORDER_OBSERVATION_TERMINAL_OUTCOMES = ["SNAPSHOT_PAGINATION_INCOMPLETE"]` — the only terminal
outcome. Every other non-success path (throttle, 5xx, timeout, DB rollback) is expressed as
`lifecycleState = ABANDONED` with `failureCode`/`failureDetail`, **not** a terminal outcome. D must
not invent a second terminal outcome string without a plan amendment.

Generations come from the platform sequence `stocky_catalog_observation_gen_seq`
(`ORDER_OBSERVATION_GEN_SEQ`) — **do not create a second sequence**, per the constants.ts header.

### 3.4 Initial import and cursors

| Step | Plan clause | Existing primitive to reuse | Notes |
|---|---|---|---|
| Kill switch | §10.1 | `Shop.processingEnabled`; fail-closed precedent at `webhook-processor.ts:244-246`, `catalog-facts/resource-refetch.ts:346-349`, `catalog-sync.ts:69-72` | must gate before merchant DML |
| `SyncRun` domain | §10.2 | `app/jobs/workers/catalog-facts/catalog-sync.ts` `syncDomain` usage | `orders` / `orders_full` |
| Fence before submit | §10.3 | `persistBulkSubmitIntentAndFence`, `persistFullSyncFence` (`ingest/checkpoint.ts`) | allocate before `bulkOperationRunQuery` |
| Bulk A submit / poll | §4.5, §10.4 | `ingest/bulk-operation-submitter.ts`, `attachBulkOperationGid`, `assertPolledBulkOperationMatches` | persist BulkOperation GID; **never** `currentBulkOperation` |
| Bulk B | §4.5 | — | **only if PR6-B records it legal.** Otherwise costed per-order fallback |
| Bulk C | §4.5 | — | **never submit** (three connection levels, illegal) |
| JSONL stream | §10.6 | `ingest/jsonl-stream.ts` `streamJsonlBatches`, `ingest-batch-id.ts` | bounded memory, two-phase |
| Batch ack | §10.6 | `acknowledgeJsonlBatch`, `persistBulkCounts` | control-plane ordinal after merchant persist |
| Partial / failure | §10.8 | `markSyncRunPartialFailure` | run not successful; resume from last committed ordinal |
| Completion | §10.9 | `completeSyncRunAndCursor`, `fullSyncCursorValue` | absence nomination **only** in-window, **only** after a complete run |
| Cursors | §4.4 | `SyncCursor.syncDomain` | `orders_full`, `orders_incremental`, `orders_reconcile` |
| Incremental watermark | §4.4 | — | max applied Shopify `updatedAt` among **successfully applied** orders; 2-minute skew overlap; never webhook `receivedAt`, never job start time |
| Reconcile sweep | §11 | `app/jobs/workers/catalog-facts/diagnostic-reconciler.ts` pattern | exhaustive sweep heals missed webhooks **in-window**; sampling is drift detection only and must never be reported as completeness |
| Health | §11.7 | `app/sync/health.server.ts` `computeSyncHealth(shopId, syncDomain)`; `jobDomainFilter` maps `"webhooks"` → `startsWith: "webhook:"`, everything else `equals` | new order domains are accepted without a code change to `jobDomainFilter`, but `order-facts-*` job types must equal the domain string used, or health counts nothing |

### 3.5 Authoritative apply path (§9.3) mapped to existing code

```
HMAC (route)
  → ingestAuthenticatedWebhook            app/sync/intake.server.ts
  → sanitizeWebhookPayload                app/sync/sanitize.server.ts      [D adds 3 topics]
  → WebhookDelivery + DurableJob          intake.server.ts                 [ATOMIC_APPLICATION_RECEIPT]
  → dispatcher kick                       app/sync/dispatcher.server.ts
  → webhook-processor                     app/jobs/workers/webhook-processor.ts
      ├─ processingEnabled gate           line 244-246 (exists)
      ├─ isCatalogFactAtomicWebhookTopic  line 417  → D needs an order-domain sibling
      ├─ canonical order path (NEW)       allocate requestGen → PR6-B reader (complete pagination)
      │                                   → allocate responseGen → tenant txn:
      │                                   advisory locks ascending (key1,key2) → PR6-C apply → receipt
      └─ runLegacyWebhookHandler(topic)   line 255-272, 474, 632 — **must remain, unchanged**
```

`runLegacyWebhookHandler` switches on `orders/create` / `orders/cancelled` / `refunds/create` and
throws `topic_unsupported` for anything else. Under PO-02 the canonical path is **purely additive**:
the legacy v1 consumption stays until a separately authorized cutover PR.

---

## 4. Synthetic fixture matrix — cases, expected transitions, executed arithmetic

All fixtures are synthetic. No merchant data, no live Shopify call, no production database.

Each row links: incoming signal → authoritative reader response → applicator decision → canonical
rows → receipt → cursor → diagnostic → recovery outcome.

### 4.1 Core case matrix

| ID | Incoming signal | Reader response | Applicator decision | Canonical rows | Receipt | Cursor | Diagnostic | Recovery |
|---|---|---|---|---|---|---|---|---|
| D-01 | `orders/create`, new order, 3 lines | complete `OrderFactById` walk | apply | Order + 3 lines + agreements | one, `webhook-delivery:<id>` | `orders_incremental` ← order `updatedAt` | none | n/a |
| D-02 | same delivery replayed | not re-read (receipt short-circuit) | no-op | unchanged | existing receipt returned | unchanged | none | idempotent (T04) |
| D-03 | `orders/create` **duplicate `shopifyWebhookId`** | — | intake dedupe | unchanged | existing | unchanged | none | `intake.server.ts` `existing` branch |
| D-04 | `refunds/create` for in-window order | refund walk complete | apply refund + refund lines + adjustments + transactions | Refund rows; Order clock untouched | one | `orders_incremental` | none | T05 |
| D-05 | `refunds/create` twice, same refund GID | complete | idempotent upsert on `(shopId, shopifyGid)` | refund rows replaced, not duplicated | one per delivery | — | none | `refunded_units` not doubled (T05) |
| D-06 | `orders/delete`, order **in-window** | `order(id:)` → null, `processedAt ≥ observedAt − 60d`, scopes intact | tombstone | `existenceState=ABSENT`, `existenceKind=ABSENT_CONFIRMED_QUERY`, `deletedAt` set, `deletionSource=WEBHOOK`; **children retained** | one | — | none | T43 in-window |
| D-07 | `orders/delete`, order **out-of-window** | `order(id:)` → null, `processedAt < observedAt − 60d` | **no tombstone** | `existenceState=ABSENT`, `existenceKind=ABSENT_SIGNALLED_DELETE_UNVERIFIED`, **`deletedAt` NOT set**, `deletionSource=WEBHOOK`; rows retained | one | — | `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` | T43 out-of-window |
| D-08 | `orders/delete`, order still live (delayed/stale delete) | `order(id:)` → live | stale-signal diagnostic, **no tombstone** | `existenceKind=LIVE_REFETCH`, existing state kept | one | — | stale-signal record | PR5 Race H analog |
| D-09 | aged-out order refetch (61 d) | `order(id:)` → null | **no tombstone** | `existenceKind=INACCESSIBLE_HISTORY_WINDOW`, previous `existenceState` **preserved** | one | — | `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` | T41 |
| D-10 | scope downgrade then null refetch, order in-window | null; `accessScopeSnapshot` lost `read_orders` vs last LIVE | **absence authority void** | `INACCESSIBLE_HISTORY_WINDOW`, state preserved | one | — | existence diagnostic | T50 |
| D-11 | restore of access after D-10 (scope regranted), order live | live | first LIVE confirmation | `LIVE_REFETCH` | one | — | cleared | revival needs **two** non-overlapping LIVE confirmations for a true `ABSENT_CONFIRMED_QUERY` tombstone only |
| D-12 | stale order refetch (older `updatedAt`) | complete but stale | **reject wholesale** | **no attribute write, no child writes** | one | unchanged | none | T09 / T44 |
| D-13 | equal-`updatedAt` refetch | complete | **re-apply** (reject only `<`) | children repaired | one | — | none | T45 |
| D-14 | `order_transactions/create` status `success` | refund refetch (+ order if accessible) | apply transaction child | `ShopifyOrderRefundTransactionFact` status success | one | — | none | PO-06 money now counted |
| D-15 | refund transaction **PENDING**, **no webhook** | observed only via refund snapshot | apply from snapshot | transaction row status pending | one | — | none | **T36 — must not require a PENDING webhook**; money excluded until SUCCESS, units follow ledger |
| D-16 | `orders/edited`, exchange | complete order + agreements walk | apply | mixed agreement: `+ORDER` and `−RETURN` sales | one | — | **none** | T58; see F-CLAUDE-PR6DR-05 |
| D-17 | `refunds/create` on order **older than window** | `refund(id:)` / `order(id:)` unqueryable | record signal; **do not tombstone parent** | refund rows may persist (no FK to order) | one | — | `REFUND_OUTSIDE_ACCESSIBLE_WINDOW` | reconcile must **not** claim it healed this |
| D-18 | `orders/cancelled` | complete | apply `cancelledAt`, `cancelReason` | Order updated | one | — | none | cancellation is status, **not** a second unit event (§7.2) |
| D-19 | unknown / unrecognised webhook topic | — | intake rejects | none | none | unchanged | `topic_unsupported` | fail closed |
| D-20 | `orders/delete` payload of unrecognised shape | — | **identity sanitizer fail-closed** | none | quarantine receipt | unchanged | quarantine `DataIssue` | §8.12; do **not** assume `admin_graphql_api_id` |
| D-21 | two refunds, each child connection exceeding one page | continuation via `RefundFactById` per-connection first/after | apply **only when complete** | complete refund rows eventually | one | — | none on success | T56 |
| D-22 | nested walk exhausted / request budget spent | incomplete | **no canonical apply at all** | **no partial refund snapshot, no child absence, no parent apply** | — | unchanged | `SNAPSHOT_PAGINATION_INCOMPLETE` on `OrderFactObservationInFlight`; reconciler derives `DataIssue` | T57 |
| D-23 | `orders/create` with **>250 line items** | — | **intake quarantines before any job exists** | **none** | quarantine `WebhookDelivery`, **`job: null`** | unchanged | `projection_bounds_exceeded` `DataIssue` | **only** the in-window `orders_incremental` sweep can heal — see F-CLAUDE-PR6DR-02 |
| D-24 | bulk import overlapping live webhooks | — | locks + clocks serialize | consistent | per delivery | `orders_full` fence | none | §10.10 required Phase 1 test |
| D-25 | required MoneyBag invalid / unparsable | complete | **fail-apply whole snapshot** | **no partial row** | — | unchanged | no apply | T48 |
| D-26 | required bag currency mismatch | complete | **fail-apply entire snapshot** | `moneyDiagnosticState=MONEY_CURRENCY_MISMATCH` only if a prior row exists and this observation is rejected | — | unchanged | `MONEY_CURRENCY_MISMATCH` | not "skip the bag" |
| D-27 | refund money identity fails, all bags parsed | complete | **persist Shopify fields + diagnostic** | rows written | one | — | `REFUND_MONEY_UNBALANCED` | T49; never invent a balancing entry |

### 4.2 Executed expected-outcome arithmetic

A throwaway, untracked Node script
(`<scratchpad>/pr6d-fixture-validator.mjs`, **not committed, not repository runtime**) encodes the
frozen §6.6 money identity, the §7.1/PO-10 unit ledger, and the §8.6 window/existence predicate as
an independent specification, and checks each fixture's expected outcome against it. Exact decimal
arithmetic uses BigInt at scale 6 (`FROZEN_ORDER_NUMERIC_SCALE`); the helper throws if a money value
is supplied as a JavaScript `Number`.

Command actually executed:

```
node <scratchpad>/pr6d-fixture-validator.mjs
```

Result: **23/23 expected-outcome fixtures consistent** (exit 0).

| Fixture | Assertion proven consistent |
|---|---|
| T49a | `7.000000 == 5.00+0.40+2.00+0.16+(−0.56)+0.00` balances exactly |
| T49b | `8.00` vs computed `7.560000` ⇒ `REFUND_MONEY_UNBALANCED`, **still applied** |
| T15 / T15b | `1.234567` and `0.123456` survive at scale 6, not rounded to 2dp |
| T28 | mixed shop currencies in one refund sum ⇒ `MONEY_CURRENCY_MISMATCH`, not applied |
| T47 | 3 ordered − 1 refunded ⇒ `refunded_units = 1`, **not 2**, with both agreement and refund facts present |
| T55 | documented Shopify `actionType: RETURN, quantity: -2` ⇒ magnitude 2 |
| T58 | mixed `+ORDER` / `−RETURN` on one agreement ⇒ no `UNIT_SALE_SIGN_INCONSISTENT`, no identity failure, **with post-edit `ordered_units`** |
| **T58-TRAP** | the **same** sales with **pre-edit** `ordered_units` spuriously fire `LINE_UNIT_IDENTITY_INCONSISTENT` — the exact false positive T54 forbids |
| T54 | a consistent exchange stays clean |
| T06 | two partial refunds ⇒ `refunded_units = 2` (1+1), not agreement+line double-count |
| T07 | `ORDER_EDIT` removal and `REFUND` separate into `removed_units = 2`, `refunded_units = 1` |
| T29 | contradictory identity on a **valid-sign** snapshot **does** fire `LINE_UNIT_IDENTITY_INCONSISTENT` |
| SIGN | `RETURN` with positive quantity ⇒ `UNIT_SALE_SIGN_INCONSISTENT`; identity **not** evaluated; no `abs()` |
| UPD | `actionType=UPDATE` contributes 0 units |
| T18 | `GiftCardSale` / `TipSale` excluded from the variant unit ledger |
| T41 | 61-day null ⇒ `INACCESSIBLE_HISTORY_WINDOW`, state preserved, no `deletedAt` |
| T42 | 30-day null ⇒ `ABSENT_CONFIRMED_QUERY`, `deletedAt` |
| BND | exact 60-day boundary is **inside** the window (predicate is `>=`) |
| T43a / T43b | `orders/delete` in-window tombstones; out-of-window ⇒ `ABSENT_SIGNALLED_DELETE_UNVERIFIED`, no `deletedAt`, rows retained |
| T13 | delete signal + live re-check ⇒ stale signal, no tombstone |
| T50 | scope downgrade voids absence authority **even in-window** |

**This proves the fixtures are internally consistent with the frozen contract. It proves nothing
about PR6-C or PR6-D runtime, which does not exist.**

---

## 5. Crash-boundary matrix

For each boundary: what must survive, and — critically — **how a test proves recovery rather than
merely a successful job exit**. A job that exits 0 after a crash proves nothing; each row names the
observable that must be asserted.

| ID | Crash boundary | Required surviving state | Must **not** happen | Proof obligation (beyond exit code) |
|---|---|---|---|---|
| CB-01 | Before `observationRequestGen` allocated | nothing allocated | no orphan in-flight row | assert zero `OrderFactObservationInFlight` rows for that identity; assert job re-runs from scratch |
| CB-02 | After `requestGen`, before Shopify response | `lifecycleState=ACTIVE`, `responseGen IS NULL`, lease set | apply must not proceed on the stale request | assert `ACTIVE`+`responseGen IS NULL` invariant (A's declared contract); assert lease expiry reclaims it; assert the retry allocates a **new** `requestGen` |
| CB-03 | Mid nested-page walk (`lineItems` / `agreements` / `sales` continuation) | partial pages held **in memory only** | **no partial canonical rows**; no child absence | assert row count for that order is unchanged; assert no `ShopifyOrderLineFact` for the partially-read page; assert observation is `ACTIVE` or `ABANDONED`, never `COMPLETED` |
| CB-04 | After complete Shopify response, before `responseGen` | response not yet authoritative | must not apply using an unallocated response generation | assert no canonical write occurred; assert retry performs a **fresh** refetch, not a replay of the cached response (§15 "DB rollback after Shopify read") |
| CB-05 | Canonical rows committed, **receipt not written** | canonical rows present | duplicate merchant effect on retry | assert the retry path detects the missing receipt and **dead-letters uncertain** rather than re-applying — existing precedent: `NEW-PR4-SC01: missing receipt dead-letters uncertain` |
| CB-06 | Receipt written, **JSONL checkpoint ordinal not acknowledged** | receipt present; ordinal stale | reprocessing the same ordinal must not double-apply | assert resume from last **committed** ordinal; assert canonical row counts identical after resume (two-phase, `acknowledgeJsonlBatch`) |
| CB-07 | Control-plane diagnostic recreation | merchant-durable `*DiagnosticState` columns on the fact rows | runtime must not DML `DataIssue` | assert reconciler **derives** the `DataIssue` from merchant columns; assert runtime role cannot DML `DataIssue` (existing sync-role-isolation precedent) |
| CB-08 | Cursor advancement vs applied watermark | `orders_incremental` cursor ≤ max **successfully applied** `updatedAt` | cursor must never advance past a failed/unapplied order | inject a mid-batch apply failure; assert the cursor did **not** move past it; assert the next sweep re-reads that order |
| CB-09 | `processingEnabled` flips false / uninstall mid-job | control rows; **no merchant DML after the flip** | merchant writes after uninstall | assert fail-closed before merchant DML (precedent `webhook-processor.ts:244-246`); assert `sync-uninstall` cancels queued order jobs |
| CB-10 | Partial bulk JSONL output | `SyncRun` **not** successful; resume state | partial JSONL counted as a complete full sync | assert `markSyncRunPartialFailure`; assert **no absence nomination** from an incomplete run (§10.9) |
| CB-11 | Repeated resume from the same ordinal | idempotent re-apply | duplicated lines / doubled units | assert canonical row counts and `refunded_units` identical after N resumes |
| CB-12 | Crash between parent order insert and child line insert (bulk batch boundary) | parent order row | FK violation on the child; orphaned children | see F-CLAUDE-PR6DR-04 — assert a batch never splits a parent from its FK-dependent children |

---

## 6. Shopify API facts — verified vs unverified

Official `shopify.dev` Admin GraphQL **2026-07** unless noted. Retrieval date for every row in this
section: **2026-09-11** (independent of the plan's 2026-09-02 / 2026-09-06 accesses).

### 6.1 Verified this pass

| Fact | Source | Result |
|---|---|---|
| `ORDERS_DELETE` exists; scope **`read_orders` only** | `WebhookSubscriptionTopic` 2026-07 | **confirms plan** |
| `ORDERS_EDITED` exists; `read_orders` / `read_marketplace_orders` / `read_buyer_membership_orders` | same | confirms; scope alternatives newly recorded |
| `ORDER_TRANSACTIONS_CREATE` exists — verbatim: *"Occurs when a order transaction is created or when it's status is updated. Only occurs for transactions with a status of success, failure or error."* | same | **confirms PO-06 and T36** — PENDING is **not** webhooked |
| `ORDERS_UPDATED`, `ORDERS_CREATE`, `ORDERS_CANCELLED`, `REFUNDS_CREATE` exist | same | confirms |
| Default Admin order access — verbatim: *"By default, you have access to the last 60 days' worth of orders for a store."* | Access scopes | **confirms `orderHistoryWindowDays = 60`** |
| `read_all_orders` grants *"All relevant orders rather than the default window of orders created within the last 60 days"*; requires Shopify approval via Partner Dashboard | Access scopes | **confirms PO-01** |
| `LineItem.quantity` — verbatim: *"The number of units ordered, including refunded and removed units."* | LineItem 2026-07 | confirms |
| `LineItem.currentQuantity` — verbatim: *"The number of units ordered, excluding refunded and removed units."* | same | confirms |
| `LineItem.refundableQuantity` — verbatim: *"The number of units ordered, excluding refunded units and removed units."* | same | **confirms `refundableQuantity ≡ currentQuantity`**; no formula may depend on a difference |
| Bulk: *"Maximum of five total connections in the query"*, *"Maximum of two levels deep for nested connections"*, *"Connections must implement the `Node` interface"*, *"The top-level `node` and `nodes` fields can't be used"* | Bulk operations queries | **confirms Bulk C is illegal** |
| Bulk concurrency: *"In API versions `2026-01` and higher, each app can run up to five bulk query operations per shop simultaneously."* | same | confirms |
| Order editing: raising the quantity of an existing line *"appears in `additions`"* and increments that line **in place** (deltas by line-item id), rather than creating a new line | Edit existing orders | **new — see F-CLAUDE-PR6DR-05** |

### 6.2 Explicitly UNVERIFIED — must be treated as fail-closed

| Item | Status | D obligation |
|---|---|---|
| `orders/delete` **payload contract** | **UNVERIFIED.** A sample payload is published; see F-CLAUDE-PR6DR-07 for a divergence from the plan's recorded observation. A sample is not a completeness or stability guarantee. | identity sanitizer **fail-closed** on unrecognised shapes; do **not** assume `admin_graphql_api_id` |
| `orders/edited` payload contract | **UNVERIFIED** as a stable contract. The edit-orders guide describes `additions` / `removals` delta arrays; the webhook reference publishes no payload body for this topic. Plan note 9 stands: the payload reports *what changed*, not the new full order. | identity-only projection; **always** refetch the order by GID |
| `order_transactions/create` payload contract | **UNVERIFIED.** No payload body published in the webhook reference. | identity-only projection (`id`, `order_id`, `status` if present without PII); refetch refund |
| **Bulk B legality** (`orders { refunds { refundLineItems } }` — connection nested under a non-connection LIST) | **UNVERIFIED.** Official bulk docs state the connection/nesting/`Node` rules but **do not address non-connection list fields**; confirmed again 2026-09-11. | **PR6-B executable schema-gate deliverable.** D must plan for the **costed per-order refund refetch fallback** and must not assume Bulk B |
| `read_all_orders` grant for this app | **NOT GRANTED.** `shopify.app.toml` scopes verified: `read_products,write_products,read_inventory,write_inventory,read_orders,read_locations`. | D must **not** add it; complete-history import is **not** available |
| Live merchant order volumes / refund-bearing-order ratio | **NOT MEASURED.** No merchant store access. | the §4.5 request-count envelope remains an engineering hypothesis PR6-B must prove |

**No MCP schema observation was used to override any documented 2026-07 fact.** No Shopify store was
accessed and no Shopify mutation was issued.

### 6.3 Complete import vs read-window truncation

| Question | Answer |
|---|---|
| Can D import complete order history? | **No.** Without `read_all_orders`, live Shopify returns ~60 days rolling. |
| Does that make retained facts incomplete? | No. Facts already stored are retained permanently; `attributeFreshnessState` freezes for out-of-window orders. |
| Which Phase-1/Phase-2 consumers are affected? | ABC/U last-eight-weeks (56 d) **may** fit inside 60 d. Last-X of 90 d, custom ranges, and same-period-last-year are **not** obtainable from live Shopify (Q-016). |
| Is truncation a deletion? | **Never.** `ORDER_HISTORY_WINDOW_TRUNCATED` (import depth) is distinct from `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` (existence). Window aging must never tombstone. |
| Can reconcile heal out-of-window refunds/edits? | **No.** Permanently unobservable until `read_all_orders` is granted. Record the signal, emit `REFUND_OUTSIDE_ACCESSIBLE_WINDOW`, do not claim reconcile healed it. |
| Fallback request envelope vs D's needs | Documented fallback (§4.5) = one additional Admin request per refund-bearing order, plus explicitly counted `OrderAgreementSalesPage` and `RefundFactById` continuations, counted against the 1,000,000-line envelope. **Unverified against real ratios.** If Bulk B is illegal, D's import cost is dominated by `N_edit_or_refund` + continuations, which PR6-B must measure and bound before D can size the import job. |

---

## 7. Cross-lane findings

Findings are reported together, as required. Severity per `CLAUDE.md`. Each is classified as a
**requirement gap** (something the plan or a shared contract does not settle) or a **D-owned
implementation responsibility** (settled, D must simply do it).

### F-CLAUDE-PR6DR-02 — **P1** — requirement gap — frozen v1 sanitizer silently drops orders with >250 lines from the webhook path

- **File / line:** `stocky-plus/app/sync/sanitize.server.ts:45-53` (`PROJECTION_BOUNDS.maxLineItems = 250`),
  `:173-186` (`sanitizeOrderProjection` throws `projection_bounds_exceeded`);
  `stocky-plus/app/sync/intake.server.ts:247-291`.
- **Evidence:** `sanitizeOrderProjection` throws when `line_items.length > 250`. `intake.server.ts`
  catches `projection_bounds_exceeded`, creates a `WebhookDelivery` with
  `state: "QUARANTINED"`, `payloadSchemaVersion: "quarantine-projection-bounds-v1"`, records a
  `DataIssue`, and returns **`job: null`**. No `DurableJob` is created, so **no canonical refetch is
  ever enqueued** for that order. PO-02 freezes the v1 projection, so D cannot resolve this by
  trimming or restructuring the projection.
- **Merchant impact:** A merchant order with more than 250 line items produces **no canonical order
  facts from the webhook path**. Demand, refund and ABC/U inputs for every line on that order are
  missing until an independent sweep picks it up — and only while the order is inside the 60-day
  window. Wholesale/B2B merchants are the realistic exposure.
- **Reproduction:** POST an authenticated `orders/create` webhook with 251 line items; observe
  `WebhookDelivery.state = QUARANTINED`, `quarantineReason = projection_bounds_exceeded`, and no
  `DurableJob` row.
- **Expected behavior:** The plan must state explicitly that the `orders_incremental` exhaustive
  sweep (§4.4 / §11.1) is the **designated** recovery path for bounds-quarantined order deliveries,
  and that this recovery is in-window only.
- **Recommended correction:** (a) record the quarantine→sweep recovery as an explicit D requirement
  rather than an emergent property; (b) have the reconciler treat a `projection_bounds_exceeded`
  `DataIssue` on an order topic as a **targeted** refetch trigger for that order id, so recovery does
  not wait for a full sweep; (c) do **not** raise `maxLineItems` — that is a PO-02 projection change
  requiring separate authorization.
- **Missing test:** a D test asserting that a >250-line `orders/create` delivery is quarantined with
  `job: null` **and** that the subsequent sweep/targeted refetch produces complete canonical facts.
  **Falsely-failing-test warning:** a naive D test that posts a 300-line `orders/create` webhook and
  asserts canonical facts appear **will fail**, and the failure is correct behavior, not a bug. T19
  ("large order 300 lines, no silent 250 cap") is about **reader pagination** in PR6-B, not about the
  webhook projection.

### F-CLAUDE-PR6DR-03 — **P2** — requirement gap — C/D have no named serialized test home; PostgreSQL tests placed under `app/lib/order-facts/**` run in the parallel unit suite

- **File / line:** `stocky-plus/vitest.config.ts` (`include: ["app/**/*.test.ts"]`, excludes only
  `app/tenant/**` and `app/sync/__tests__/**`, `fileParallelism` default **ON**);
  `stocky-plus/vitest.migrations.config.ts` (`fileParallelism: false`);
  plan §17.2 file-ownership rows for PR6-C ("`app/lib/order-facts/apply/**`; applicator DB tests")
  and PR6-D ("`app/lib/order-facts/sync/**`").
- **Evidence:** Verified that **zero** tests currently reachable by the default `npm test` suite open
  a database connection — `grep -rn 'new PrismaClient|new Client\(|from "pg"' app --include=*.test.ts`
  excluding `app/tenant/` and `app/sync/__tests__` returns nothing. Every PR5 DB/adversarial test
  lives under `scripts/tenant-enforcement/tests/pr5-f3-*.test.ts` (8 files, all using
  `PrismaClient`/`DATABASE_URL`), run by the serialized `vitest.migrations.config.ts`. CI step
  "Unit tests" (`npm test`) completed in **9 seconds** on run `34137287606`, consistent with a
  pure-unit suite. Plan §17.2 names `scripts/tenant-enforcement/tests/pr6-*.test.ts` for **PR6-A
  only**; C and D are given no serialized test location.
- **Merchant impact:** None directly. The risk is **falsely passing or flaky acceptance evidence**
  for the applicator and the import/webhook integration — exactly the evidence the final reviews rely
  on.
- **Reproduction:** Place a test that opens a `PrismaClient` at `app/lib/order-facts/apply/x.test.ts`;
  `npm test` will execute it in the default suite with file parallelism against the same CI
  PostgreSQL service used by the serialized suites.
- **Expected behavior:** PostgreSQL-touching order-domain tests run serialized, as PR5's do.
- **Recommended correction:** C and D place **all** Postgres-touching tests under
  `scripts/tenant-enforcement/tests/pr6-*.test.ts` (serialized, already covered by the bare
  `npm run test:migrations` CI step), and keep `app/lib/order-facts/**/*.test.ts` pure-unit. The
  published `PR6_BC_EXECUTION_BRIEF.md` should state this explicitly, since the plan does not.
- **Missing test:** a guard asserting that no file matched by `vitest.config.ts` instantiates a
  database client — the order-domain analogue of the existing architecture-audit scanners.

### F-CLAUDE-PR6DR-04 — **P2** — requirement gap — FK asymmetry between refunds (no parent FK) and lines/agreements (Restrict FK) is unspecified for out-of-window parents

- **File / line:** `stocky-plus/prisma/schema.prisma` at `f7a39c36…` — `ShopifyOrderRefundFact`
  (`shopifyOrderGid` is a plain `@db.VarChar(256)` column with `@@index([shopId, shopifyOrderGid])`
  and **no relation** to `ShopifyOrderFact`); `ShopifyOrderLineFact.order` and
  `ShopifyOrderAgreementFact.order` both
  `@relation(fields: [shopId, shopifyOrderGid], references: [shopId, shopifyGid], onDelete: Restrict)`.
- **Evidence:** `ShopifyOrderFact` declares back-relations `lines` and `agreements` but **not**
  `refunds`, confirming the asymmetry is deliberate. Refund lines, adjustments and transactions FK to
  the **Refund**, not the Order.
- **Merchant impact:** Two concrete unspecified behaviors:
  1. An `orders/edited` signal for an order whose parent `ShopifyOrderFact` row does not exist
     (out-of-window at install, never imported) **cannot** persist agreement/sale facts — the sole
     unit-event ledger (§7.2) — without an FK violation. The plan does not say whether D creates a
     minimal parent row, or skips and emits a diagnostic.
  2. In bulk JSONL ingest, a batch boundary that separates a parent order from its line rows will
     fail the line insert. The parent must be committed before its FK-dependent children.
- **Reproduction:** Insert a `ShopifyOrderAgreementFact` with a `shopifyOrderGid` that has no
  `ShopifyOrderFact` row → FK violation. Insert a `ShopifyOrderRefundFact` the same way → succeeds.
- **Expected behavior:** Explicit, documented policy for both cases.
- **Recommended correction:** C and D jointly specify: (a) for an out-of-window parent with no row,
  skip agreement apply and emit `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` / `REFUND_OUTSIDE_ACCESSIBLE_WINDOW`
  rather than fabricating a parent order fact with invented attributes; (b) the JSONL applicator
  batches by **parent order**, never splitting an order from its lines/agreements. Note this is a
  *specification* gap — A's schema shape itself is sound and enables the out-of-window refund case.
- **Missing test:** agreement apply for a non-existent parent order (expect skip + diagnostic, not a
  crash and not a fabricated parent); bulk batch boundary landing between an order and its lines.

### F-CLAUDE-PR6DR-05 — **P2** — requirement gap — unit identity holds only with **post-edit** `ordered_units`; the plan's wording admits a spurious-failure fixture

- **File / line:** plan §7.1 (`ordered_units` = `LineItem.quantity`, "Units ordered including later
  refunds and removals"), §19 T54 / T58.
- **Evidence — reproduced.** The identity `ordered_units − current_units − refunded_units = removed_units`
  evaluated on a T58 exchange (original `+5 ORDER`, exchange `+1 ORDER` on a later agreement,
  `−3 RETURN`, `currentQuantity = 3`):
  - with `ordered_units = 5` (pre-edit reading) → `5 − 3 − 3 = −1 ≠ 0` ⇒ **spurious**
    `LINE_UNIT_IDENTITY_INCONSISTENT`;
  - with `ordered_units = 6` (post-edit reading) → `6 − 3 − 3 = 0` ⇒ clean.
  Shopify's `LineItem.quantity` description (retrieved 2026-09-11) says only *"including refunded and
  removed units"* — it is **silent on units added by a later edit** — and the plan's §7.1 wording
  inherits that silence. The edit-orders guide separately confirms that raising the quantity of an
  existing line *"appears in `additions`"* and increments that line **in place**, which is what makes
  the post-edit reading correct. Both readings are reachable from the plan text alone.
- **Merchant impact:** If C implements or tests against the pre-edit reading, every exchange produces
  a false `LINE_UNIT_IDENTITY_INCONSISTENT`, suppressing trustworthy derived magnitudes for
  legitimate orders. T54 exists specifically to forbid this false positive, and the plan text as
  written does not prevent a fixture author from encoding it.
- **Reproduction:** the two `ledger()` cases above; both are encoded as `T58` and `T58-TRAP` in the
  executed validator and both behave as stated.
- **Expected behavior:** §7.1 states explicitly that `ordered_units` is the **post-edit**
  `LineItem.quantity` of the same snapshot, i.e. it absorbs later `actionType=ORDER` additions on that
  line, and that the identity is evaluated only within one consistent snapshot.
- **Recommended correction:** B (as control-document owner) records the clarification in
  `PR6_BC_EXECUTION_BRIEF.md`; C pins post-edit quantity in its T58/T54 fixtures.
- **Missing test:** commit the **negative control** (`T58-TRAP`) alongside T58, so the review can see
  that the implementation distinguishes a genuine contradiction from an exchange, rather than passing
  T58 by accident.

### F-CLAUDE-PR6DR-06 — **P2** — D-owned responsibility — the existing `payloadSchemaVersion` fence is a hard-fail and must **not** be copied onto the three frozen legacy topics

- **File / line:** `stocky-plus/app/jobs/workers/webhook-processor.ts:806-820`.
- **Evidence:** `job.name === "catalog-sync" && durable.payloadSchemaVersion !== "catalog-facts-v1"`
  → `completeAttemptFail(... "LEGACY_CATALOG_SYNC_V1_DISABLED")`. That is a deliberate **cutover
  fence** for a job type whose v1 was retired.
- **Merchant impact:** If D copies this shape for `orders/create` / `orders/cancelled` /
  `refunds/create`, a v1-projected delivery in flight across a deploy would hard-fail — violating T51
  ("neither crash nor silently no-op") and PO-02, which freezes those three topics at v1 until a
  separately authorized cutover.
- **Expected behavior:** dispatch on the **persisted** `payloadSchemaVersion` of that delivery and
  handle v1 normally; the fence pattern applies only where a version has actually been retired by an
  authorized cutover.
- **Recommended correction:** D implements version **dispatch**, not a version **fence**, for the
  three legacy order topics.
- **Missing test:** T51 — a v1-projected delivery executed after a v2 deploy of other topics completes
  normally (neither crash nor silent no-op).

### F-CLAUDE-PR6DR-08 — **P2** — D-owned responsibility — three registration points must be updated together or new topics fail closed

- **File / line:** `app/sync/sanitize.server.ts:8-29` (`WEBHOOK_PROJECTION_SCHEMA_VERSIONS`);
  `app/sync/execution-strategy.server.ts:18-34` (`WEBHOOK_ATOMIC_TOPICS`); `shopify.app.toml`
  `[webhooks]`.
- **Evidence:** `isSanitizedWebhookTopic` is `Object.hasOwn(WEBHOOK_PROJECTION_SCHEMA_VERSIONS, topic)`;
  an unregistered topic fails intake with `topic_unsupported`. `WEBHOOK_ATOMIC_TOPICS` currently
  contains the 17 catalog/order topics and **none** of `orders/edited`, `orders/delete`,
  `order_transactions/create`; without registration `executionStrategyForJobType("webhook:orders/edited")`
  returns `NO_AUTOMATIC_RETRY` instead of `ATOMIC_APPLICATION_RECEIPT`.
- **Merchant impact:** A partially registered topic either never ingests, or ingests with the wrong
  retry/idempotency strategy — a transient failure would not retry, silently losing the signal.
- **Expected behavior:** all three registration points updated in the same D change, plus the
  `sanitizeWebhookPayload` switch (which has an exhaustive `never` check that will fail typecheck if
  a topic is added to the map but not the switch — a useful built-in guard).
- **Recommended correction:** treat the three as one atomic edit; assert strategy per new topic.
- **Missing test:** for each new topic, assert `executionStrategyForJobType` returns
  `ATOMIC_APPLICATION_RECEIPT` and that intake produces a `DurableJob`, not `topic_unsupported`.

### F-CLAUDE-PR6DR-10 — **P2** — requirement gap — effective-scope snapshot source is unnamed in D's file ownership

- **File / line:** plan §8.6 / §8.16 (absence authority depends on the recorded effective scope set);
  `ShopifyOrderFact.accessScopeSnapshot String[]` and
  `OrderFactObservationInFlight.accessScopeSnapshot String[]` (A, merged);
  `app/routes/webhooks.app.scopes_update.tsx` **exists** but is not listed in D's §17.2 file ownership.
- **Evidence:** Official 2026-07 scope requirements differ per topic — `ORDERS_DELETE` requires
  `read_orders` only, while `ORDERS_EDITED` / `ORDER_TRANSACTIONS_CREATE` / `ORDERS_CANCELLED` /
  `REFUNDS_CREATE` also accept `read_marketplace_orders` / `read_buyer_membership_orders`. The app's
  toml grants `read_orders` and not `read_all_orders`.
- **Merchant impact:** If `accessScopeSnapshot` is populated from the **static toml** rather than the
  **effective granted token scopes at observation time**, T50 (scope downgrade voids absence
  authority) cannot fire, and R-176's scope-continuity obligation is unmet — a merchant who revokes
  `read_orders` could have orders falsely tombstoned.
- **Expected behavior:** snapshot the effective granted scopes from the session/token at observation
  time, persist on both the observation and the fact row, and compare against the scopes recorded at
  the last LIVE confirmation.
- **Recommended correction:** name the scope source and the `app/scopes_update` integration in
  `PR6_BC_EXECUTION_BRIEF.md` and in D's file ownership.
- **Missing test:** T50 driven by an actual effective-scope change, not a fixture constant.

### F-CLAUDE-PR6DR-07 — **P3** — documentation divergence — `orders/delete` sample payload; does **not** relax fail-closed

- **Evidence:** The plan records (accessed 2026-09-06) that the official `orders/delete` sample
  payload "contains only REST `\"id\"`". Retrieved **2026-09-11**, the official webhook reference
  sample for `orders/delete` shows top-level keys **`id` and `admin_graphql_api_id`**.
- **Merchant impact:** None. Recorded so the divergence is not mistaken for evidence.
- **Expected behavior:** **No change to the fail-closed rule.** §8.12 stands: the payload shape is
  unverified as a production contract, a published sample is not a completeness or stability
  guarantee, and the identity sanitizer must fail closed on unrecognised shapes. Note that the
  existing helper `assertScalarId` returns `null` for a missing value rather than throwing
  (`sanitize.server.ts:63-65`), so a delete projection that requires a GID must validate presence
  **explicitly** — reusing `assertScalarId` alone would silently admit a payload with no identity.
- **Recommended correction:** record the divergence; keep fail-closed; add the explicit presence check.
- **Missing test:** `orders/delete` payload lacking any recognised identity ⇒ quarantine, not a
  null-identity apply.

### 7.1 File-ownership map (single-writer files)

| File | Owner | This package's position |
|---|---|---|
| `prisma/schema.prisma` | **A (merged)** | frozen; D must not touch |
| `app/lib/order-facts/types.ts`, `constants.ts`, `lock-key.ts`, `advisory-lock.ts` | **A (merged)** | frozen; B and C **consume**, never edit |
| `app/lib/order-facts/admin-read/**`, `app/types/**` | **B** | D calls B's readers; D must not author documents |
| `app/lib/order-facts/apply/**` | **C** | D calls C's applicator; D must not author apply internals |
| `app/sync/sanitize.server.ts`, `app/sync/execution-strategy.server.ts`, `app/tenant/job-envelope.server.ts`, `app/jobs/workers/webhook-processor.ts`, `app/routes/webhooks.*`, `app/lib/order-facts/sync/**`, `scripts/sync-control-plane/manifest.ts`, `shopify.app.toml` | **D** | listed for completeness; **no D runtime authorized** |
| `stocky-plus/docs/phases/phase-1/PR6_A_CLOSURE_REPORT.md`, `PR6_BC_EXECUTION_BRIEF.md`, live status/navigation/authority records | **B (sole control writer)** | **this task did not create, edit, or anticipate these files** |
| `.github/workflows/ci.yml` | **unassigned** | see §9 — no lane owns it, yet C/D may need new serialized test steps |
| `stocky-plus/docs/phases/phase-1/PR6_D_INTEGRATION_READINESS_REVIEW.md` | **this task** | the only file created |

---

## 8. Tests actually run vs merely designed

Distinguished exactly as required.

### 8.1 Executed / passed

| Command | Result |
|---|---|
| `git fetch origin main && git rev-parse origin/main` | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| `git fetch origin f7a39c36… && git cat-file -t f7a39c36…` | `commit` |
| `git log -1 --format='%H %P %T' f7a39c36…` | head / parent `1f615c51…` / tree `9e5a700b…` |
| `git rev-parse f7a39c36:…/PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` | `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` — **matches required blob** |
| `git ls-remote --heads origin` | no `pr6-b` / `pr6-c` branch exists |
| `git diff --stat 09feffd f7a39c36` | 36 files, +8219 / −536 |
| GitHub Actions API, run `34137287606` jobs | Classify / Heavy / CI Gate all `success` at `head_sha f7a39c36…`; Heavy 146 numbered steps, all `success` |
| `grep -rn 'new PrismaClient\|new Client(\|from "pg"' app --include=*.test.ts` (excl. tenant/sync) | **no matches** — default unit suite opens no DB |
| `node <scratchpad>/pr6d-fixture-validator.mjs` | **23/23 expected-outcome fixtures consistent**, exit 0 |

### 8.2 Executed / failed (then corrected)

| Case | What happened |
|---|---|
| `T58` (first run) | **FAILED** with `LINE_UNIT_IDENTITY_INCONSISTENT` against an expected clean result. Investigation established the *fixture* was wrong (pre-edit `ordered_units`), not the identity — see F-CLAUDE-PR6DR-05. The corrected fixture passes, and the failing form is retained deliberately as the `T58-TRAP` negative control. |

### 8.3 NOT executed

- **No repository test suite was run.** `node_modules` is absent in this environment and no
  dependency install was performed; PostgreSQL is installed but not running (`pg_isready` → no
  response). No disposable database was created and no destructive reset was attempted.
- No PR6-B, PR6-C or PR6-D runtime test was run — **none exists**.
- No Prisma generate, migrate, lint, typecheck, build, or codegen was run.
- No exact-M push CI exists to inspect.

### 8.4 Designed but not executed (D's future obligation)

Every row of §4.1 (D-01 … D-27) and §5 (CB-01 … CB-12) is **designed only**. None is implemented,
none is committed, and no claim is made that any of them passes.

### 8.5 External facts not independently verified

- ChatGPT's acceptance reasoning and technical judgement (relayed via comment `5638553192`).
- The immutability of blobs `198e5554…` and `4f5ea10f…` at M (M does not exist; asserted in D-054
  item 23 and the PR body, not re-verified here).
- Any statement in the PR #37 body other than the CI identities, head/parent/tree, and review blob,
  which I verified independently.

---

## 9. Final-review checklist for each future B/C PR

Provided as required. **This does not replace the exact-head independent review each lane needs after
implementation returns to ChatGPT.**

### 9.1 Common gate (both lanes)

| Check | Requirement |
|---|---|
| Base | Branch base is exactly **M**, pinned literally in branch, report and PR body. Not `f7a39c36…`, not a moving `main`. |
| Subject | PR head SHA recorded; the reviewed head is the **exact** head, not "latest". |
| Classification | `docs_only=false`, `full_ci=true`. |
| CI event | **`pull_request`** at the exact head. No `workflow_dispatch`. No duplicate feature-branch `push` run. |
| Jobs | Classify **SUCCESS**, full Heavy **SUCCESS** (not skipped), CI Gate **SUCCESS**. Heavy SKIPPED is a **fail** for a runtime PR. |
| Superseded runs | Any earlier run on a superseded head recorded as superseded, not presented as current evidence. |
| No post-green push | No push after the final green head merely to embed a run id in a tracked document. |
| Test discovery | **Directly verify** each new test file is actually executed: confirm which vitest config's `include` matches it, and that a CI step runs that config. Do not infer from the file's existence. |
| Serialized DB tests | Any Postgres-touching test is under a `fileParallelism: false` config (F-CLAUDE-PR6DR-03). |
| Mutable vs immutable | Prior review artifacts unmodified (blob-compare `198e5554…`, `4f5ea10f…`, `da388c5d…`). Implementation reports are mutable; reviews are not. |
| Ownership | Changed paths ⊆ the lane's §17.2 ownership. Any single-writer file touched by the wrong lane is a blocking finding. |
| Flags | Inventory-write flags DEFAULT OFF; `FEATURE_PR5_ABSENCE_TOMBSTONE` DEFAULT OFF; no `read_all_orders`; no `write_orders`. |
| Authority | No D-055. D-054 cited as the lane authority. |

### 9.2 PR6-B specific

| Check | Direct independent probe |
|---|---|
| Changed paths | `app/lib/order-facts/admin-read/**`, `app/types/**` only |
| Mutation deny | Feed a mutation document to the AST scanner; assert reject **and** that no network call is reachable (T02) |
| GID cross-check | Request GID ≠ returned `id` ⇒ fail closed, no apply (T-identity) |
| Decimal | Assert money values are strings end-to-end; grep the reader path for `parseFloat` / `Number(` / `/` on money (T26, T30) |
| `DateTime` | No `Date.parse` rewrite of Shopify timestamps |
| Named LIST fields | Assert **no** `first` on `Order.refunds`, `Order.transactions`, `LineItem.taxLines`, `LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties` — **and** assert the check does **not** flag connections, including `Refund.transactions` (T20) |
| Connections paginate | `Order.lineItems`, `Order.agreements`, `SalesAgreement.sales`, `Refund.refundLineItems`, `Refund.orderAdjustments`, `Refund.refundShippingLines`, `Refund.transactions` all use `first`/`after` and loop to `hasNextPage=false` |
| Bulk C | Three-level document **rejected** by the schema gate (T53) |
| **Bulk B gate result** | A recorded, reproducible legality verdict — **not** a claim. If illegal/truncating, the costed fallback and the observed refund-bearing-order ratio must be reported (R-185) |
| Continuation counting | `OrderAgreementSalesPage` and `RefundFactById` continuation calls counted explicitly in query-count assertions (T56/T57) |
| `Sale` fragments | Selection without inline fragments fails codegen (T52) |
| PO-11 | `priceAfterAllDiscountsBeforeTaxesSet` is **not** on any canonical money path |
| Types | `app/lib/order-facts/types.ts` **unmodified** (A-owned) |

### 9.3 PR6-C specific

| Check | Direct independent probe |
|---|---|
| Changed paths | `app/lib/order-facts/apply/**` + serialized tests only |
| No Shopify I/O | Assert no `admin.graphql` / fetch reachable from the apply path; assert **no Shopify I/O under advisory lock** |
| Lock rule | Refund job locks Order **and** Refund; order-only job locks Order **only** unless the apply includes refund snapshots; dedupe then ascending `(key1,key2)`; `lock_timeout` 5000 ms (§5.1 / §13 — these must agree, and both must match `ORDER_CANONICAL_LOCK_VERSION = stocky-pr6-canonical-lock-v1`) |
| First-insert lock | Exclusive lock acquired **before** the row exists (T35) |
| Clocks | Reject only `<`; equal re-applies (T45); stale parent discards **all** children (T44); Clock C never decides freshness; Refund Clock A independent of Order Clock A, both interleavings |
| Window | T41 (no tombstone at 61 d), T42 (tombstone in-window), exact 60-day boundary inclusive, T50 scope downgrade |
| Revival | Two independent non-overlapping LIVE confirmations, **only** for true `ABSENT_CONFIRMED_QUERY`; `INACCESSIBLE_HISTORY_WINDOW` remains reversible and is **not** terminal |
| Preservation | An inaccessible later observation keeps the confirmed/unverified kind and deletion lineage — it must **not** downgrade to ordinary window uncertainty (A review §4.7 residual) |
| Money | T48 whole-snapshot rejection; T49 unbalanced ⇒ persist + diagnostic; currency mismatch ⇒ fail-apply, not skip-bag; no FX conversion (T27); no cross-currency sum (T28) |
| Units | T47, T55, T58 **and** the T58-TRAP negative control; T29/T54 must genuinely detect and genuinely not false-fire; never `abs()` |
| Ledger | Sole unit ledger is `ShopifyOrderAgreementSaleFact`; refund-line quantities are **not** unit events (R-181) |
| No physical delete | Ordinary apply tombstones; no `delete`/`deleteMany` on canonical order facts (R-164 analog) |
| No `DataIssue` DML | Runtime writes merchant-durable diagnostic columns only; reconciler derives `DataIssue` (R-183) |
| Tenancy | Cross-shop identical Shopify order id isolated (T14); foreign `shopId` insert denied; raw-SQL reassignment denied (T38) |

---

## 10. R-176 — not closable by A's SQL predicates alone

**R-176 remains OPEN at P0.** Nothing in this package closes it, and nothing in this package should
be read as reducing its severity.

A's contribution is **representability only**: the five approved existence kinds and their impossible
combinations are constrained at the database level across the eight canonical order fact tables
(migration `20260907020000_pr6_a_order_refund_existence_coherence`). The independent A correction
review states plainly that a row `CHECK` has no access to `OLD` and therefore **cannot** prevent an
applicator from clearing a tombstone and re-classifying the row — that transition was reproduced and
*passes* the constraint.

**C/D evidence still required before R-176 can be considered for closure:**

| # | Obligation | Owner | Evidence required |
|---|---|---|---|
| 1 | Window predicate applied at runtime — `storedProcessedAt` (fallback `shopifyCreatedAt`) `>= observedAt − 60d`, using the named constant | C | T41 / T42 / exact-boundary tests against real rows, not fixtures |
| 2 | Previous-state **preservation** across an inaccessible transition | C | assert prior `existenceState` survives an `INACCESSIBLE_HISTORY_WINDOW` observation |
| 3 | Shopify **query-completion** evidence gates absence | C | assert an abandoned/incomplete observation can never yield absence |
| 4 | Historical **scope continuity** | C + D | T50 driven by an effective-scope change (F-CLAUDE-PR6DR-10), not a constant |
| 5 | **Two-confirmation terminal revival**, restricted to true `ABSENT_CONFIRMED_QUERY` | C | two independent non-overlapping LIVE confirmations; assert `INACCESSIBLE_HISTORY_WINDOW` is reversible by a single later LIVE refetch |
| 6 | Inaccessible later observation keeps confirmed/unverified kind **and** deletion lineage | C | assert no downgrade to ordinary window uncertainty |
| 7 | `orders/delete` in-window vs out-of-window behavior | D | T43 both branches, with `deletedAt` set only in-window |
| 8 | Bulk omission **never** nominates an out-of-window order; nomination only after a **complete** run | D | assert zero nominations from a partial run and from out-of-window orders |
| 9 | Import-depth truncation reported honestly and **never** as absence | D | `ORDER_HISTORY_WINDOW_TRUNCATED` distinct from `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` (T34) |
| 10 | Canonical health never reports HEALTHY over `DEGRADED` merchant diagnostics | D | `computeSyncHealth` assertions for the order domains |

**Explicitly: passing A's SQL coherence predicates is not evidence for any of rows 1–10.**

---

## 11. Blocking decisions, later obligations, safety limits

### 11.1 Blocking — must be resolved by an authorized decision, not by an agent

| # | Item | Blocks |
|---|---|---|
| B-1 | **PR #37 is not merged; M does not exist** (F-CLAUDE-PR6DR-01) | all downstream runtime, B's control commit, C's branch point, any use of this package as a base-pinned document |
| B-2 | Bulk B legality is unverified | D's import sizing; the §4.5 request envelope; R-185 |
| B-3 | `orders/delete` / `orders/edited` / `order_transactions/create` payload contracts unverified | D's identity sanitizers must stay fail-closed; no shape may be assumed |
| B-4 | >250-line order webhook recovery path is unspecified (F-CLAUDE-PR6DR-02) | D's acceptance criteria for webhook completeness |
| B-5 | `ordered_units` post-edit reading unstated (F-CLAUDE-PR6DR-05) | C's T54/T58 fixtures; correctness of exchange handling |
| B-6 | Out-of-window parent + agreement FK behavior unspecified (F-CLAUDE-PR6DR-04) | C/D apply behavior for `orders/edited` on out-of-window orders |
| B-7 | C/D serialized test home unassigned (F-CLAUDE-PR6DR-03) | reliability of C's and D's acceptance evidence |

### 11.2 Later obligations (not this task, not B/C)

- PO-02 legacy consumer cutover is a **separate authorized PR**. Until then the three legacy
  projections keep their v1 line arrays. **Never silently empty them** (R-182).
- `read_all_orders` Partner approval (Q-016) — out-of-window refunds/edits remain permanently
  unobservable until granted.
- A rebuildable daily projection, if the §14 p95 target is missed, is **post-Monday** and must never
  become a second authority.
- `orders/updated` subscription is post-Monday.
- PR 7 uninstall/redact must delete these operational facts with the tenant.

### 11.3 Safety limits observed by this task

- No tracked executable, schema, migration, worker, reader, applicator, route, config or package
  change. Exactly one file created: this artifact.
- No runtime PR opened; no merge; no mark-ready; no shared control document edited; no immutable
  prior review altered.
- No B/C branch modified; none exists.
- No production deployment, Shopify mutation, merchant data access, scope addition, write flag,
  billing or AI feature.
- No D-055. D-054 remains the lane authority. R-176 remains OPEN/P0; R-164 unchanged.
- The only script executed was an untracked scratchpad file operating purely on synthetic in-memory
  values; it touched no database and no network.

---

## 12. Resume checkpoint

State at the time of writing, for continuation if this session ends.

| Field | Value |
|---|---|
| Branch | `claude/pr6-d-integration-readiness-8vs1ar` |
| HEAD before this commit | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| Working tree | clean apart from this artifact |
| Artifact path | `stocky-plus/docs/phases/phase-1/PR6_D_INTEGRATION_READINESS_REVIEW.md` |
| Deliverable state | **complete** — no partial section |
| `node_modules` | absent; no install performed |
| PostgreSQL | installed, **not running**; no disposable database created |
| Scratchpad script | `pr6d-fixture-validator.mjs` — untracked, disposable, 23/23 pass; regenerate from §4.2 if lost |

**Next actions, in order:**

1. Owner squash-merges PR #37. Resolve **M** from GitHub. Do not guess it.
2. Re-run the §1 gate table against M. Require the exact-M **push** CI (Classify + full Heavy + CI
   Gate all SUCCESS). Stop and report on any mismatch.
3. When `PR6_BC_EXECUTION_BRIEF.md` is published by B, reconcile §3, §7.1 and §9 of this artifact
   against it; re-issue as a correction if ownership or test homes differ.
4. Route F-CLAUDE-PR6DR-02, -03, -04, -05 and -10 to B (sole control writer) for inclusion in the
   execution brief — **do not edit B's or C's branches to resolve them**.
5. B's and C's exact-head implementation reviews remain separate, subject-specific tasks.

---

## 13. Summary of findings

| ID | Severity | Class | Subject |
|---|---|---|---|
| F-CLAUDE-PR6DR-01 | **P1** | admission gate | PR #37 unmerged; M unresolved; no downstream runtime may start |
| F-CLAUDE-PR6DR-02 | **P1** | requirement gap | >250-line orders quarantined with `job: null`; no canonical facts from the webhook path |
| F-CLAUDE-PR6DR-03 | **P2** | requirement gap | C/D have no named serialized test home; DB tests would run in the parallel unit suite |
| F-CLAUDE-PR6DR-04 | **P2** | requirement gap | refund/line/agreement FK asymmetry unspecified for out-of-window parents |
| F-CLAUDE-PR6DR-05 | **P2** | requirement gap | unit identity needs post-edit `ordered_units`; spurious-failure fixture reproduced |
| F-CLAUDE-PR6DR-06 | **P2** | D responsibility | catalog-sync version **fence** must not be copied onto frozen legacy topics (T51) |
| F-CLAUDE-PR6DR-08 | **P2** | D responsibility | three topic-registration points must be updated atomically |
| F-CLAUDE-PR6DR-09 | **P2** | process | no B/C branches or control records exist; package unreconciled against the execution brief |
| F-CLAUDE-PR6DR-10 | **P2** | requirement gap | effective-scope snapshot source unnamed; T50 / R-176 scope continuity at risk |
| F-CLAUDE-PR6DR-07 | **P3** | documentation | `orders/delete` sample payload divergence; fail-closed rule unchanged |

P0 = 0 · P1 = 2 · P2 = 7 · P3 = 1.

**No verdict is issued by this task.** PR6-B, PR6-C and PR6-D remain **NOT APPROVED**. PR6-D runtime
remains **NOT AUTHORIZED**. Production, merchant production data, deployments, Shopify writes,
inventory writes, scope additions and flag enablement remain **NOT AUTHORIZED**.
