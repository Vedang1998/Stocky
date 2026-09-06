# Phase 1 PR #34 — Current-main synchronization report

**Document type:** Evidence / control only. Not implementation authority.
**PR:** [#34](https://github.com/Vedang1998/Stocky/pull/34)
**Branch:** `cursor/pr6-order-refund-planning-87c7`
**Synchronization method:** Merge current `origin/main` into the existing PR #34 branch. No rebase. No force-push. No history rewrite.
**PR6 runtime:** **NOT AUTHORIZED**
**Production:** **NOT AUTHORIZED**
**Inventory writes:** **NOT AUTHORIZED**
**Inventory-write flags:** **DEFAULT OFF**
**`FEATURE_PR5_ABSENCE_TOMBSTONE`:** **DEFAULT OFF**
**Merge of PR #34:** **NOT AUTHORIZED**
**Mark-ready:** **NOT AUTHORIZED**
**Independent correction approval:** **Not claimed** — **INDEPENDENT FINAL CORRECTION RE-REVIEW PENDING**
**Phase 1:** **IN PROGRESS**
**Phase 1 PR5 repository implementation:** **FORMALLY CLOSED**

This report records the previously authorized **final current-main synchronization** of PR #34 after PR #36 merged. It does **not** authorize PR6-A/B/C/D runtime.

---

## 1. Identities

| Field | Value |
|---|---|
| PR #34 head **before** this synchronization | `f5d429b7b3577c87e67c5ef3445e88560e565a5c` |
| Historical merge-base (F2A-era) | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` |
| Pre-sync divergence vs then-current main | 6 behind / 5 ahead (live GitHub before merge) |
| Required current main / merge target | `58bf62b4d1c5f51dac70ee96fed4ece0a109b25f` |
| Current-main subject | `Record Phase 1 PR5 repository-implementation closeout (#36)` |
| Current-main timestamp | `2026-09-06T16:51:22Z` |
| Merge commit (this branch) | `ba47ecba8bfd2433f48673d0a109d00c0810c280` |
| Merge parents | `f5d429b7…` (PR #34) + `58bf62b4…` (`origin/main`) |
| Post-merge merge-base with `origin/main` | `58bf62b4d1c5f51dac70ee96fed4ece0a109b25f` |
| Behind count after merge | **0** |
| First docs commit after merge | `2860885f54cec09bd21bd18f9a1379377ab8836e` |
| Classifier recorded against first docs commit | `--from-git 58bf62b4d1c5f51dac70ee96fed4ece0a109b25f 2860885f54cec09bd21bd18f9a1379377ab8836e` → `docs_only=true` `full_ci=false` (11 docs paths) |
| Live synchronized HEAD | tip of `cursor/pr6-order-refund-planning-87c7` after this planning-docs sequence; recorded in the PR body. This file does **not** embed its own future commit SHA. |

### PR5 / PR36 closure identity (live)

| Item | State |
|---|---|
| PR #35 F3 | **CLOSED / MERGED** squash `36365e2535a2394fa53b0642db4dbf90a438316f` at `2026-09-06T01:33:34Z` |
| PR #36 closeout | **CLOSED / MERGED** squash `58bf62b4d1c5f51dac70ee96fed4ece0a109b25f` |
| Post-merge PR36 main CI | run `34046777505` **SUCCESS** |
| Classify | `101523117557` SUCCESS |
| Heavy | `101523133707` SKIPPED |
| CI Gate | `101523133212` SUCCESS |
| PR5 repository implementation | **FORMALLY CLOSED** |
| Phase 1 | **IN PROGRESS** (not closed; no D-055) |
| PR #30 F2C | **CLOSED / MERGED** squash `f9841691…` (historical OPEN/CONFLICTING status retired) |
| PR #31 F2B | **CLOSED / MERGED** squash `0284b66c…` (**historical**; not current main) |

---

## 2. Conflict resolution

**Only conflict:** `stocky-plus/docs/phases/phase-1/README.md`

**Resolution:** Keep **current-main** PR5/F3/PR36 identities (F2A, F2B, F2C, PR #32, PR #33, PR #35, PR #36). Layer PR6 planning records on top. Do **not** revert any merged PR5 identity.

Mutable PR6 planning content that already existed on the PR #34 side was preserved in `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md` (no conflict on that file). Immutable review artifacts were not in conflict and were not edited.

---

## 3. Allowed / prohibited scope

**Allowed:** `stocky-plus/docs/**` only.

**Not modified in this synchronization:**

- application runtime
- tests
- Prisma / migrations
- `.github/**`
- packages
- GraphQL runtime documents
- `shopify.app.toml`
- feature flags
- `RISK_REGISTER.md` (current-main R-165 left in place; PR6 IDs remapped in-plan only)

**Not performed:** PR6 runtime, PR5 runtime edits, production access, Shopify writes, `write_orders`, `read_all_orders`, merge, mark-ready, D-055, force-push.

---

## 4. PO-10 — unit classification (frozen)

The parent-agreement-reason-only formula is **insufficient**.

**Authority:** unit **direction** is determined by (1) `Sale.actionType` and (2) signed `Sale.quantity`. `SalesAgreement.reason` supplies business context/category and dating. It does **not** independently determine unit direction.

For eligible `ProductSale`:

- `actionType = ORDER` — valid `quantity > 0`; contribution `+quantity`. Reason `ORDER`: original ordered units; metric date = order `processedAt` in shop IANA timezone. Later reason (`ORDER_EDIT`, `RETURN`, other valid non-original): true later addition / exchange addition; metric date = agreement `happenedAt`. Do **not** classify an `ORDER` sale as a refund merely because the parent agreement is return/refund-like.
- `actionType = RETURN` — valid `quantity < 0`; contribution is the negative quantity as supplied. Reason ∈ `{REFUND, RETURN}` → `refunded_units += -quantity`. Reason `ORDER_EDIT` → `removed_units += -quantity`.
- `actionType = UPDATE` — unit contribution **0** (price/tax/discount only). Persist lineage/money; exclude from the unit-event sum.
- `actionType = UNKNOWN` — persist raw evidence; mark unit diagnostics untrustworthy; do **not** silently include in operational demand.
- Contradictory sign or action/reason combination — persist raw Shopify value; record `UNIT_SALE_SIGN_INCONSISTENT` (or approved equivalent); do **not** use `abs()`; do **not** manufacture a corrected quantity; derived magnitudes remain untrusted / fail closed.

The sole authoritative unit-event ledger remains `ShopifyOrderAgreementSaleFact`. Refund-line quantity remains excluded from the demand ledger.

**T58** (added): mixed agreement containing positive `ORDER` ProductSale(s) **and** negative `RETURN` ProductSale(s) must **not** false-fire `UNIT_SALE_SIGN_INCONSISTENT`. T47 / T54 / T55 / T29 updated for actionType + sign + agreement context.

---

## 5. PO-11 — `LineItem.priceAfterAllDiscountsBeforeTaxesSet` (frozen)

In Shopify Admin API **2026-07** this field **exists** and is `MoneyBag!`.

Official changelog (version 2026-07, dated 2026-04-27, accessed 2026-09-06): equivalent to REST `current_subtotal_price_set`; current line subtotal after all discounts, excluding refunded and removed quantities, before tax.

Generated schema on current main (`app/types/admin.types.d.ts`): `priceAfterAllDiscountsBeforeTaxesSet: MoneyBag`.

**PR6 policy:** Do **not** establish this field as a second canonical net-sales/revenue authority. Canonical money remains SalesAgreement / Sale lineage, Refund lineage, successful refund transaction settlement, and exact shop-money/currency handling. PR6 runtime **must not depend** on the field. Optional / reconciliation-capable only. Do **not** derive per-unit price by dividing it. Do **not** expand PR6-A schema merely because it exists.

Every live statement that the field does not exist was removed from the mutable plan. Remaining mentions are historical correction language in PO-11 itself. Immutable reviews retain the historical false claim as reviewed evidence.

---

## 6. Shopify facts refreshed (Admin API 2026-07; do not bump)

Accessed 2026-09-06 from official `shopify.dev` plus current-main generated `admin.types.d.ts`. Unresolved external behavior remains **UNVERIFIED**.

| Fact | Result |
|---|---|
| `Refund.processedAt` | `DateTime!` (non-null). `createdAt` nullable. `updatedAt` `DateTime!`. |
| `RefundLineItem.priceSet` | `MoneyBag!`. `id` nullable. `lineItem` `LineItem!`. |
| `Shop.ianaTimezone` | `String!`. `Shop.currencyCode` `CurrencyCode!`. |
| LIST vs connection | `Order.refunds` / `Order.transactions` are LISTs. `Order.lineItems` / `Order.agreements`, `Refund.refundLineItems` / `orderAdjustments` / `refundShippingLines` / `transactions` are connections. |
| `Sale` interface | No `lineItem` on the interface. Concrete `ProductSale` / `GiftCardSale` / `TipSale` do. |
| `SaleActionType` | `ORDER` / `RETURN` / `UNKNOWN` / `UPDATE`. |
| `OrderActionType` | `ORDER` / `ORDER_EDIT` / `REFUND` / `RETURN` / `UNKNOWN`. |
| Concrete agreements | `SalesAgreement` only; **do not implement `Node`**. Continuation via parent order, not `node(id:)`. |
| `ORDER_TRANSACTIONS_CREATE` | Exists; `read_orders` (or marketplace/buyer-membership). Fires on create **or status update**; **only** `success` / `failure` / `error`. Does **not** fire for `PENDING`. |
| `ORDERS_DELETE` | Exists; `read_orders`. Payload shape **UNVERIFIED**. Official sample contains only REST `"id"`; not a completeness guarantee. Sanitizer fail-closed; do not assume `admin_graphql_api_id`. |
| Bulk | Official: max five total connections; max two nested connection levels; connections **must implement `Node`**; bulk query must include a connection. `orders { agreements { sales } }` remains illegal (three levels). `2026-01+`: up to **five bulk operations of each type** per shop simultaneously. Generated types: `Sale` / `*Sale` / `*Agreement` do **not** implement `Node`. |
| Bulk B connection-under-LIST | Remains **UNVERIFIED** / PR6-B executable/schema gate. Official docs say validate supplied queries; they do not exhaustively enumerate LIST-vs-connection combinations. Costed per-order refund refetch remains the fallback. |

---

## 7. Risk-ID remapping

Current main already owns **R-165** (F2C null→zero; **CLOSED FOR PR5 REPOSITORY IMPLEMENTATION**). `RISK_REGISTER.md` was **not** edited.

Entire PR6 proposed block remapped +1, contiguous:

| Historical proposed ID (immutable reviews) | Synchronized ID (mutable plan) |
|---|---|
| R-165 | **R-166** |
| R-166 | **R-167** |
| R-167 | **R-168** |
| R-168 | **R-169** |
| R-169 | **R-170** |
| R-170 | **R-171** |
| R-171 | **R-172** |
| R-172 | **R-173** |
| R-173 | **R-174** |
| R-174 | **R-175** |
| R-175 | **R-176** |
| R-176 | **R-177** |
| R-177 | **R-178** |
| R-178 | **R-179** |
| R-179 | **R-180** |
| R-180 | **R-181** |
| R-181 | **R-182** |
| R-182 | **R-183** |
| R-183 | **R-184** |
| R-184 | **R-185** |

Immutable reviews keep the old proposed IDs as evidence of the reviewed historical packet.

---

## 8. OPEN_QUESTIONS

Highest canonical ID on current main before this pass: **Q-011**. Added **Q-012 … Q-016**. PO-10 and PO-11 are **resolved**, not open questions.

| ID | Topic | Class | PR6-A blocker? |
|---|---|---|---|
| Q-012 | Multi-currency ABC policy | later metric/product | **No** |
| Q-013 | Later “net sales” presentation definition | later metric/product | **No** (PO-11 already forbids a second canonical bag) |
| Q-014 | Future location-grain demand | later metric/product | **No** (PO-09 shop-wide) |
| Q-015 | Cancelled/unpaid later metrics | later metric/product | **No** |
| Q-016 | `read_all_orders` Partner timing | production/Partner | **No** (PO-01: correctness must not depend on the grant) |

---

## 9. `read_all_orders`

Frozen PO-01 unchanged. Stocky will pursue Partner approval. PR6 correctness **MUST NOT** depend on the grant. Without the grant: default Shopify historical window remains explicit; aged-out null is not deletion authority; retained app facts survive; inaccessible history is represented honestly. Scope **not** added. `shopify.app.toml` **not** changed. Current scopes on disk: `read_orders` present; `read_all_orders` absent; `write_orders` absent.

---

## 10. Current-main PR5 primitive references (planning only)

PR6-C copies **patterns** from merged PR5 into **order-domain sibling** modules. Do **not** widen `CatalogResourceKind`.

Referenced surfaces on `58bf62b4…`:

- tenant-scoped DB (`app/tenant/tenant-db.server.ts`, `app/tenant/models.ts`)
- advisory identity locks (`app/lib/catalog-facts/advisory-lock.ts`; `stocky-pr5-canonical-lock-v1` → planned `stocky-pr6-canonical-lock-v1`)
- deterministic lock ordering / capacity (`lock-capacity.ts`)
- exact money helpers (`app/lib/catalog-facts/apply/money.ts`)
- observation-generation sequence / intervals / fencing
- no Shopify I/O under canonical locks
- application receipts / idempotence
- projection pending/health patterns where applicable
- physical-delete denial pattern
- F3 authoritative refetch (`app/jobs/workers/catalog-facts/resource-refetch.ts`)
- F3 JSONL / checkpoint (`app/lib/catalog-facts/ingest/jsonl-stream.ts`, `checkpoint.ts`)

Lane structure unchanged and **not started:** after later ChatGPT runtime authorization, **PR6-A → (PR6-B ∥ PR6-C) → PR6-D**.

---

## 11. Independently verified implementation-readiness leads

Used as leads only; verified on current main before treating as planning facts:

| Claim | Verification |
|---|---|
| PR #34 was behind current main | Live GitHub before merge: CONFLICTING; 6 behind / 5 ahead vs `58bf62b4…` |
| README conflict | Observed during merge; resolved as §2 |
| Tenant hard-coded counts | `DIRECT_MERCHANT_MODELS` 20, `CHILD_MERCHANT_MODELS` 6, total 26; `manifest.ts` asserts `MERCHANT_TABLES.length !== 26`; `tenant-db.test.ts` `toHaveLength(26/20/6)`. PR6-A must update these later. **Not changed now.** |
| No `write_orders` / no `read_all_orders` | `shopify.app.toml` scopes line: `read_products,write_products,read_inventory,write_inventory,read_orders,read_locations` |
| Legacy `parseFloat`/`Number` | Present in `app/jobs/workers/webhook-processor.ts` order/refund handlers. Must **not** become PR6 canonical logic. |
| 2026-07 generated field shapes | Confirmed in `app/types/admin.types.d.ts` as §6 |
| `priceAfterAllDiscountsBeforeTaxesSet` | Exists as `MoneyBag` on `LineItem` in generated types and official changelog |

Prisma validate / PR5 apply-safety suites were **not** re-run in this docs-only planning PR. Those are runtime/main facts from prior merged work, not new evidence produced here.

---

## 12. Stale claims retired (mutable docs)

Live (non-historical) claims removed or marked historical:

- current main is `0284b66…`
- PR #30 is still open / CONFLICTING
- F3 is not started
- PR5 has not closed
- PR6 is waiting for PR5 closeout
- `LineItem.priceAfterAllDiscountsBeforeTaxesSet` does not exist
- PR #35 / PR #36 still open
- this closeout PR is not yet merged (live header of `PR5_CLOSURE_REPORT.md`)

Historical statements remain only when explicitly marked historical.

---

## 13. Immutable PR6 review artifacts

Never edited.

| Artifact | Required blob | `git hash-object` at this report |
|---|---|---|
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md` | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` | must remain equal |
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` | `fca2b260d03e3105782ed216f7773c53e6aef2a7` | must remain equal |

---

## 14. Changed-file scope

Unique paths vs current main after the docs commit are listed by:

```text
git diff --name-only origin/main...HEAD
```

Every path must be under `stocky-plus/docs/**`. Expected include:

- `stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md`
- `stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md` (unchanged bytes vs prior PR #34; new vs main)
- `stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` (unchanged bytes vs prior PR #34; new vs main)
- `stocky-plus/docs/phases/phase-1/PR6_CURRENT_MAIN_SYNC_REPORT.md` (this file)
- `stocky-plus/docs/phases/phase-1/README.md`
- `stocky-plus/docs/phases/phase-1/PR5_CLOSURE_REPORT.md` (live-status only)
- `stocky-plus/docs/PROJECT_STATUS.md`
- `stocky-plus/docs/DECISIONS.md` (item 22)
- `stocky-plus/docs/OPEN_QUESTIONS.md` (Q-012…Q-016)
- `stocky-plus/docs/DATA_AUTHORITY_MAP.md`
- `stocky-plus/docs/README.md`

Exact list is the `git diff --name-only` output at the synchronized HEAD.

---

## 15. Local validation

Executed on the working tree immediately before the docs commit (classifier vs main re-run against HEAD after commit).

| Check | Result |
|---|---|
| `git diff --check` | **clean** (exit 0) |
| Classifier self-test | `.github/scripts/classify-ci-change-set.test.sh` — `assertions=40 pass=40 fail=0`; `classify-ci-change-set self-test OK` |
| Classifier vs current main | `--from-git 58bf62b4d1c5f51dac70ee96fed4ece0a109b25f 2860885f54cec09bd21bd18f9a1379377ab8836e` → `range_usable=true`; `changed_path_count=11`; `classification_reason=every_changed_path_is_docs_allowlist`; **`docs_only=true`**; **`full_ci=false`**. Follow-up docs-commit that records this output is classified the same way. |
| Risk-ID uniqueness | `RISK_REGISTER.md`: 165 unique IDs, max **R-165**, no duplicates. Plan §21.1 proposed block **R-166…R-185** (20 contiguous). Overlap with register: **none**. |
| OPEN_QUESTIONS uniqueness | table IDs **Q-001…Q-016**, 16 unique, no duplicates |
| Immutable blob checks | original `d72340c01dd9c662d0e8bb4aa8d43482940470d9`; correction `fca2b260d03e3105782ed216f7773c53e6aef2a7` |
| No executable changed path vs main | required: every `git diff --name-only origin/main...HEAD` path under `stocky-plus/docs/**` |

---

## 16. Exact-head CI

This report is committed **before** the exact-head `pull_request` run of the synchronized HEAD.

Authoritative CI identity is the exact-head `pull_request` run of that HEAD. Required:

- Classify **SUCCESS**
- Heavy **SKIPPED**
- CI Gate **SUCCESS**

This file is **not** rewritten after that green run. No push after green.

---

## 17. Explicit non-authorization

PR6 runtime remains **NOT AUTHORIZED**.

This synchronization does **not**:

- implement PR6-A/B/C/D
- modify PR5 runtime
- add `read_all_orders` or `write_orders`
- enable flags
- access production or merchant data
- merge or mark PR #34 ready
- create D-055
- close Phase 1
