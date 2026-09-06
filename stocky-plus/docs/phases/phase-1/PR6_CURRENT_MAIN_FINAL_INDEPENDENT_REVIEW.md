# Phase 1 PR 6 — Final Current-Main Independent Planning Re-Review (PR #34)

**Document type:** Immutable independent review artifact. Evidence and verdict only.
**Reviewer:** Claude Code (independent Tier-A planning reviewer)
**Review date:** 2026-09-06
**Scope:** Planning review only. No PR6 runtime. No modification of PR #34. No modification of `main`. No production or merchant production data access.
**Status:** IMMUTABLE — never edit this file.

This artifact records the final independent current-main correction re-review of the synchronized Phase 1 PR6 order/refund facts planning packet, so ChatGPT can decide whether to authorize merge of PR #34 as the final PR6 planning contract.

This review does **not** merge anything, does **not** authorize PR6 runtime, and does **not** authorize production, merchant production data, Shopify writes, or inventory mutations.

---

## 1. Reviewed identity (independently verified from Git / GitHub)

| Field | Verified value | Method |
|---|---|---|
| PR #34 head | `fc09413ac1f2caf9ff653c30f12937aef35c8d5d` | `git rev-parse refs/pull/34/head`; GitHub PR API `head.sha` |
| Current `origin/main` | `58bf62b4d1c5f51dac70ee96fed4ece0a109b25f` | `git fetch origin main` + `git rev-parse origin/main`; GitHub PR API `base.sha` |
| PR state | **OPEN / DRAFT / UNMERGED** (`state=open`, `draft=true`, `merged=false`) | GitHub PR API |
| Mergeable state | **clean** | GitHub PR API `mergeable_state` |
| Merge base | `58bf62b4d1c5f51dac70ee96fed4ece0a109b25f` — exact current main | `git merge-base origin/main origin/pr34` |
| Behind / ahead | **0 behind / 8 ahead** | `git rev-list --left-right --count origin/main...origin/pr34` → `0  8` |
| Changed files | **11**, all under `stocky-plus/docs/**` | `git diff --name-status origin/main...origin/pr34` |
| Diff size | `+5119 / −44` | `git diff --stat` |

**Verdict:** identity **CONFIRMED** exactly as specified.

### 1.1 Synchronization merge identity

| Field | Verified value |
|---|---|
| Merge commit | `ba47ecba8bfd2433f48673d0a109d00c0810c280` |
| Parent 1 (old PR #34 head) | `f5d429b7b3577c87e67c5ef3445e88560e565a5c` |
| Parent 2 (current main) | `58bf62b4d1c5f51dac70ee96fed4ece0a109b25f` |

Verified by `git cat-file -p ba47ecb` showing exactly those two parents. Merge, not rebase; no force-push (the full historical commit chain `76a8f33 → f629fff → 11d9cf6 → aa3c839 → f5d429b → ba47ecb → 2860885 → fc09413` is intact and reachable).

**Verdict:** synchronization identity **CONFIRMED**.

### 1.2 Changed-file scope (documentation only)

```
M  stocky-plus/docs/DATA_AUTHORITY_MAP.md
M  stocky-plus/docs/DECISIONS.md
M  stocky-plus/docs/OPEN_QUESTIONS.md
M  stocky-plus/docs/PROJECT_STATUS.md
M  stocky-plus/docs/README.md
M  stocky-plus/docs/phases/phase-1/PR5_CLOSURE_REPORT.md
A  stocky-plus/docs/phases/phase-1/PR6_CURRENT_MAIN_SYNC_REPORT.md
A  stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md
A  stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md
A  stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md
M  stocky-plus/docs/phases/phase-1/README.md
```

Exactly the 11 expected paths. `git diff --name-only origin/main...origin/pr34 | grep -v '^stocky-plus/docs/'` returns **empty**. No runtime, schema, migration, test, `.github`, GraphQL production document, Shopify config, package, or feature-flag change. `RISK_REGISTER.md` is **not** modified.

**Verdict:** scope **CONFIRMED documentation-only**.

---

## 2. Immutable review gate

| Artifact | Required blob | Observed blob | Result |
|---|---|---|---|
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md` | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` | **BYTE-IDENTICAL** |
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` | `fca2b260d03e3105782ed216f7773c53e6aef2a7` | `fca2b260d03e3105782ed216f7773c53e6aef2a7` | **BYTE-IDENTICAL** |

Verified via `git ls-tree origin/pr34 <path>`. Neither immutable review was edited. Both retain their historical proposed risk IDs and their historical Shopify observations.

**Verdict:** immutable review gate **PASSED**.

---

## 3. Exact-head CI

Independently verified through the GitHub Actions API.

| Field | Verified value |
|---|---|
| Run | `34050245829` (`CI`, run number **415**, attempt 1) |
| Head SHA | `fc09413ac1f2caf9ff653c30f12937aef35c8d5d` |
| Event | `pull_request` |
| Conclusion | **SUCCESS** |
| Classify change set | job `101532443368` — **SUCCESS** |
| Lint/typecheck/test/build/Prisma/GraphQL (Heavy) | job `101532457870` — **SKIPPED** |
| CI Gate | job `101532457607` — **SUCCESS** |

`docs_only=true` / `full_ci=false` are consistent with Heavy SKIPPED plus Classify and CI Gate SUCCESS, and with the recorded local classifier evidence (`--from-git 58bf62b4… 2860885f…` → `docs_only=true`, `full_ci=false`, 11 docs paths).

**No later push superseded the exact head.** Listing all `ci.yml` runs on `cursor/pr6-order-refund-planning-87c7` returns four runs; run `34050245829` (number 415) is the newest and is bound to `fc09413…`.

**Verdict:** exact-head CI **CONFIRMED**.

---

## 4. Current-main state verdict

| Required state | Verified |
|---|---|
| PR #35 CLOSED / MERGED | Yes — squash `36365e2535a2394fa53b0642db4dbf90a438316f`, ancestor of current main |
| PR #36 CLOSED / MERGED | Yes — squash `58bf62b4…` = current `origin/main` (`git log` subject `Record Phase 1 PR5 repository-implementation closeout (#36)`) |
| Current main `58bf62b4…` | Yes |
| PR5 repository implementation FORMALLY CLOSED | Yes — `PROJECT_STATUS.md`, `PR5_CLOSURE_REPORT.md`, phase-1 `README.md` all state FORMALLY CLOSED |
| Phase 1 IN PROGRESS | Yes |
| D-054 remains PR5 authority | Yes |
| No D-055 | Yes — no `D-055` decision heading exists anywhere; every occurrence is a prohibition ("Do **not** create D-055") or a "Not created" status row |
| PR6 planning review pending | Yes — stated in the plan header, sync report, PROJECT_STATUS, phase-1 README, and the PR body |
| PR6 runtime NOT AUTHORIZED | Yes |
| Production NOT AUTHORIZED | Yes |
| Merchant production data NOT AUTHORIZED | Yes |
| Inventory writes NOT AUTHORIZED | Yes |
| Flags DEFAULT OFF | Yes — including `FEATURE_PR5_ABSENCE_TOMBSTONE` |

### 4.1 Stale live-claim scan

Every changed mutable document was scanned for the retired claims. Results:

- `0284b66…` and `f65ab4b…` appear **only** as historical F2B / F2A squash-merge identities, explicitly labelled historical where they could be misread as current main.
- "PR #30 still open / CONFLICTING", "F3 not started", "PR5 not closed", "PR6 waiting for PR5 closeout", "PR #35 / #36 still open", and "`priceAfterAllDiscountsBeforeTaxesSet` does not exist" survive **only** inside the sync report's §12 *"Stale claims retired"* list, which is by construction a register of removed claims.
- `PR5_CLOSURE_REPORT.md` converts its publication-time sentences ("this closeout PR is not yet merged", "this closeout branch does not edit PR #34") into explicitly **historical at publication** statements and adds a live post-merge status block. No PR5 identity is reverted.
- The phase-1 `README.md` conflict resolution **kept** current-main PR5 / F3 / PR #36 identities and layered PR6 planning on top. No old F3 state was restored.

**Verdict:** current-main synchronization **did not rewind or falsify current-main truth**. **PASS.**

---

## 5. Shopify Admin API 2026-07 verification (independent)

Verified against official `shopify.dev` 2026-07 documentation and live Admin GraphQL schema introspection. Not taken from the plan or from the 2026-09-02 reviews.

| Item | Verified 2026-07 fact | Plan agrees |
|---|---|---|
| `Shop.ianaTimezone` | `String!` (non-null) | Yes |
| `Shop.currencyCode` | `CurrencyCode!` (non-null) | Yes (PC-04: non-null; defensive handling is policy, not nullability) |
| `Refund.processedAt` | `DateTime!` | Yes |
| `Refund.createdAt` | `DateTime` — **nullable** | Yes (F-22) |
| `Refund.updatedAt` | `DateTime!` | Yes (bound independently — clock table) |
| `RefundLineItem.id` | `ID` — **nullable** | Yes (F-05 ordinal composite identity) |
| `RefundLineItem.priceSet` | `MoneyBag!` | Yes (required refund-line bag) |
| `RefundLineItem.lineItem` | `LineItem!` | Yes |
| `RefundLineItem.subtotalSet` / `totalTaxSet` | `MoneyBag!` | Yes |
| `Order.refunds` | `[Refund!]!` — **LIST**, arg `first` only | Yes (§4.3 item 8) |
| `Order.transactions` | `[OrderTransaction!]!` — **LIST**, args `first`/`capturable`/`manuallyResolvable` | Yes (§4.3 item 8) |
| `Order.agreements` | `SalesAgreementConnection!` — **connection** | Yes (§4.3 item 9) |
| `Order.lineItems` | `LineItemConnection!` — **connection** | Yes (§4.3 item 9) |
| `Refund.refundLineItems` / `orderAdjustments` / `refundShippingLines` / `transactions` | all **connections** | Yes — `Refund.transactions` explicitly called out in §4.3 item 9 and T20 |
| `Refund.duties` | LIST (not a connection) | Yes |
| `Sale` interface | `actionType SaleActionType!`, `id ID!`, `lineType SaleLineType!`, `quantity Int` (**nullable**), `totalAmount MoneyBag!`, discount/tax bags | Yes |
| `Sale.quantity` | `Int` — **nullable** | Yes (F-22; null persisted, never a unit event) |
| `Sale.actionType` | `SaleActionType!` | Yes |
| `SaleActionType` | `ORDER`, `RETURN`, `UPDATE`, `UNKNOWN` — exactly four | Yes (PO-10 covers all four) |
| `ProductSale` / `GiftCardSale` / `TipSale` | concrete types; `ProductSale.lineItem` is `LineItem!`; `Sale` interface has no `lineItem` | Yes (inline fragments + `__typename` required; T52) |
| `SalesAgreement.reason` | `OrderActionType!` | Yes |
| `SalesAgreement.sales` | `SaleConnection!` — connection | Yes |
| `OrderActionType` | `ORDER`, `ORDER_EDIT`, `REFUND`, `RETURN`, `UNKNOWN` | Yes — PO-10 handles each |
| `ReturnAgreement` | concrete `SalesAgreement` implementer with `return Return!` and `sales SaleConnection!` | Yes (fragment required; F-06 / PC-05) |
| `ORDER_TRANSACTIONS_CREATE` | Exists. "Occurs when a order transaction is created or when it's status is updated. Only occurs for transactions with a status of success, failure or error." | Yes — **exact match** to PO-06, including no PENDING fire |
| `ORDERS_DELETE` | Exists. "Occurs whenever an order is deleted. Requires the `read_orders` scope." | Yes (F-02) |
| Bulk operation limits | "Maximum of five total connections in the query." / "Maximum of two levels deep for nested connections." | Yes |
| Default historical order-access window | Order object: "Only the last 60 days' worth of orders from a store are accessible from the `Order` object by default… request access to all orders… `read_all_orders`" | Yes (`orderHistoryWindowDays = 60`) |
| Root queries | `order(id:)`, `orders(query:)`, `refund(id:)`, `shop` all exist | Yes |

Target API version remains `2026-07`; `.graphqlrc.ts` on current main pins `ApiVersion.July26` and is **not** changed by this PR.

**No material discrepancy** was found between current official 2026-07 authority and the mutable plan.

**Verdict:** Shopify 2026-07 verification **PASS**.

---

## 6. PO-11 — `LineItem.priceAfterAllDiscountsBeforeTaxesSet`

### 6.1 Present official 2026-07 truth

The field **EXISTS** in official Admin API 2026-07 authority as **`MoneyBag!`**.

Independently verified by two separate reads of the official 2026-07 `LineItem` object page (`https://shopify.dev/docs/api/admin-graphql/2026-07/objects/LineItem`), which place it alphabetically between `originalUnitPriceSet` and `product` and describe it as "the total price of the line item in shop and presentment currencies, after all discounts are applied and excluding refunded and removed quantities. This value doesn't include taxes."

The changelog cited by the plan (`https://shopify.dev/changelog/lineitem-priceafteralldiscountsbeforetaxesset-field-now-available`) is **real**, names API version **2026-07**, and states the field is equivalent to the REST API's `current_subtotal_price_set` on line items — exactly as PO-11 records.

*Reviewer note on method:* live Admin schema introspection through the connected Shopify MCP server did **not** list this field, because that connection introspects a different (older) API version than 2026-07. Official 2026-07 documentation is the authority the target version requires, and it is unambiguous. The repository's own corroboration (`app/types/admin.types.d.ts`) is a **gitignored** codegen output (`.gitignore:43`, generated by `npm run graphql-codegen` against `ApiVersion.July26`), so it is legitimately absent from a fresh clone; it could not be regenerated here because dependencies are not installed. This does not weaken the finding — the official docs settle it.

### 6.2 Disposition of the historical conflict

The 2026-09-02 immutable review stated the field did not exist. Under present official 2026-07 authority that observation is **superseded**. Per the review mandate it is treated as a **valid historical observation that must remain unchanged**, and is **not** a reason to reject the synchronized plan. The immutable artifact was verified byte-identical (§2) and was not edited.

**PO-11 is therefore not a blocking factual defect.**

### 6.3 Policy consistency

Every one of the nine references to the field in the mutable plan was inspected (lines 63, 258, 284, 349, 502, 546, 569, 834, 942, 1490) plus the `OPEN_QUESTIONS.md` Q-013 entry:

- **No** remaining mutable statement claims the field does not exist. Confirmed by exhaustive grep.
- It is classified **optional / reconciliation-capable only** everywhere it appears.
- It is **explicitly excluded** from the canonical money path (§4.2 "Do not select as a canonical money path"), from Bulk A (§4.5), and from the net-sales bag (§7.4 line 1490).
- No part of the plan makes it required: it appears in **neither** the required-bag table **nor** the optional-bag list of §6.3, and no schema column is proposed for it.
- Division to manufacture per-unit price is forbidden in §6.1 and restated at line 1490 — consistent with §6.1's general prohibition on division-derived unit money.
- Q-013 records it as **not** a second canonical authority, consistent with the exact-money/refund-settlement model.

**PO-11 verdict: CORRECT AND CONSISTENT. No finding.**

---

## 7. PO-10 — unit-event classification

### 7.1 Frozen rule as written

Unit **direction** = `Sale.actionType` + signed `Sale.quantity`. `SalesAgreement.reason` supplies business context/category and metric dating and does **not** alone decide direction. This is stated in PO-10 (§C1) and restated identically in §7.1 and §7.2.

### 7.2 Required semantics — line-by-line audit

| Required semantic | Plan location | Result |
|---|---|---|
| `ORDER`: valid sign `quantity > 0`; contributes `+quantity` | PO-10, §7.1 table, §7.2.2 | **Correct** |
| `ORDER` on parent reason `ORDER` → original units, date = order `processedAt` (shop IANA) | PO-10, §7.1 table, §7.2.2 row 1 | **Correct** |
| `ORDER` on a later valid context → true later addition, date = agreement `happenedAt` | PO-10, §7.1 table, §7.2.2 row 2 | **Correct** — and explicitly "never a refund" |
| `RETURN`: valid sign `quantity < 0`; contributes the negative quantity | PO-10, §7.1 table | **Correct** |
| `RETURN` + reason ∈ {REFUND, RETURN} → `refunded_units += -quantity` | PO-10, §7.1 formula block | **Correct** |
| `RETURN` + reason `ORDER_EDIT` → `removed_units += -quantity` | PO-10, §7.1 formula block | **Correct** |
| `UPDATE` contributes zero units; remains available for money/lineage | PO-10, §7.1 table, §7.2.2 | **Correct** |
| `UNKNOWN`: raw evidence retained; operational derivation untrusted / fails closed | PO-10, §7.1, §7.2.2 | **Correct** |
| Contradictory action/sign/context: retain raw, diagnostic, never `abs()`, never fabricate, derived magnitudes untrusted | PO-10, §7.1, §8 code list, §15 failure table | **Correct** — all four obligations stated in every location |
| Sole unit-event ledger = `ShopifyOrderAgreementSaleFact` | §7.1 header, §7.2 header | **Correct** |
| Refund-line quantity excluded as a demand event | §7.1, §7.2, §7.2.2 last rows | **Correct** |

### 7.3 Hidden-contradiction sweep

An exhaustive grep for `refunded_units`, `removed_units`, and `net_units` across the full 2332-line mutable plan returns hits **only** at: PO-10 (§C1 lines 212–220), the F-07 disposition row, §7.1/§7.2 (the frozen model), the test matrix rows T05/T06/T47/T55/T58, and the correction-matrix row 34. Every one is consistent with the actionType-primary rule.

**No parent-reason-only formula survives anywhere in the mutable plan.** Formulas, the eligibility table, `net_units`, `refunded_units`, `removed_units`, the ordered/current/refund/removal identity, dating (§7.2.2), diagnostics (§8, §15), examples (T47/T55), acceptance criteria (§18), and implementation notes (§17) were each checked individually and all agree.

### 7.4 Mixed exchange

Shopify can validly return mixed actions inside one agreement: `SalesAgreement.sales` is a `SaleConnection!` of the `Sale` interface, each element carrying its own independent `actionType`, and `OrderActionType` includes `ORDER_EDIT` and `RETURN` — nothing in the schema constrains an agreement's sales to a single `actionType`. An exchange (positive `ORDER` ProductSale plus negative `RETURN` ProductSale on one agreement) is therefore legitimate.

The plan handles this correctly and in three places states it must **not** false-fire `UNIT_SALE_SIGN_INCONSISTENT` (PO-10, §7.1, §7.2.2). **T58** is the required fixture and is present in the test matrix (line 2045) with the correct expectation, including "net_units = signed sum; refunded/removed magnitudes follow PO-10 reason rules".

Affected prior tests were re-read:

- **T29** (line 2016) — now requires the injected contradictory identity to **actually fire** `LINE_UNIT_IDENTITY_INCONSISTENT`, closing the "must not pass on a broken system" gap.
- **T47** (line 2034) — reversal sale stores `−1` with `actionType=RETURN` and derived `refunded_units = 1`, not 2, with both agreement and refund facts present. Correctly prevents Option-A double subtraction.
- **T54** (line 2041) — dual-sided: must **not** produce a spurious diagnostic when the valid-sign identity holds, **and must** detect an injected contradictory identity.
- **T55** (line 2042) — pins Shopify's documented RETURN example (`actionType: RETURN`, `quantity: -2`) with derived magnitude 2.

### 7.5 Arithmetic soundness of the final unit formulas

Verified against official 2026-07 `LineItem` semantics: `quantity` = "number of units ordered, **including** refunded and removed units"; `currentQuantity` = "number of units ordered, **excluding** refunded and removed". Therefore `quantity − currentQuantity ≡ refunded + removed`, so the frozen identity

```
ordered_units − current_units − refunded_units = removed_units
```

is **arithmetically sound**. Later `ORDER` additions on an `ORDER_EDIT` raise both `quantity` and `currentQuantity` and correctly enter neither `refunded_units` nor `removed_units`, so the identity is preserved across edits. The signed sum `net_units = Σ Sale.quantity` over eligible valid-sign ProductSales converges to `currentQuantity`, consistent with the identity. Guarding evaluation to a **consistent valid-sign snapshot pair** is correct and prevents both cross-observation mixing and evaluation over contradictory data.

**PO-10 verdict: CORRECT, COMPLETE, AND INTERNALLY CONSISTENT. No finding.**

---

## 8. Exact money model

| Requirement | Result |
|---|---|
| No JS `Number` / `parseFloat` for authoritative money | **Met** — §6.1 forbids `Number(...)`, `parseFloat`, `* 1.0`, JS-number mixing, deprecated `Money` scalars, and silent 2-decimal rounding |
| Exact decimal text → NUMERIC | **Met** — `MoneyV2.amount` persisted as the exact JSON decimal string into `NUMERIC`/`Decimal(20,6)`; `requireDecimalString` / `optionalDecimalString`; empty/non-string fails closed; sub-cent `0.123456` tested |
| Currency preserved | **Met** — `currencyCode` persisted with every amount; per-order `Order.currencyCode` survives a later shop-currency change |
| `shopMoney` policy explicit | **Met** — §6.2: operational/forecast/ABC use `shopMoney` only; presentment is lineage; both sides persisted; **no app FX** |
| Required vs optional MoneyBag behavior deterministic | **Met** — §6.3 gives an explicit per-resource required-bag table and a closed optional list; present-but-invalid optional still fail-applies |
| Invalid required bag fails the whole canonical snapshot | **Met** — §6.2, §6.3, §15: "fail-apply the entire resource snapshot. No 'skip bag'. No partial-freshness model" |
| Refund money enters revenue/net-sales only after transaction SUCCESS | **Met** — PO-06, backed by the verified `order_transactions/create` semantics |
| PENDING remains snapshot-observed | **Met** — PO-06 and the §5.1 clock table both state PENDING never fires the webhook and is observed through refund snapshots |
| Refund unit evidence separate from money settlement | **Met** — PO-06 and §7.2 |
| No division-derived unit prices | **Met** — §6.1 forbids `bag / quantity` in JS **and** NUMERIC; per-unit comes from `Sale.totalAmount` or `RefundLineItem.subtotalSet` |
| Refund reconciliation identity arithmetically sound | **Met with a P3 residual** — see F-P3-01 |
| Current money definition does not double-count Sale + Refund | **Met** — Option A: one unit ledger (agreement sales); refund lines are money/restock/reconciliation evidence only |

**Money-model verdict: PASS** (one non-blocking P3).

---

## 9. Pagination / nested continuation

The corrected nested-pagination contract that produced NEW-CLAUDE-PR6PC-02 was re-reviewed against the verified schema shapes.

| Requirement | §4.3 item | Result |
|---|---|---|
| `OrderFactById` authoritative order snapshot | 1 | Met |
| Agreement edge cursors retained | 2 | Met ("**Retain agreement edge cursors**") |
| Dedicated `OrderAgreementSalesPage` | 3 | Met — exactly one agreement per request, walked to `hasNextPage=false` |
| Separate continuation per agreement | 3 | Met |
| `RefundFactById` for truncated refund children | 3 | Met |
| Separate continuation pair per refund child connection | 3 | Met — "**per-connection** first/after pairs" |
| No shared cursor across different parents | 3, 4 | Met — per-agreement and per-connection pairs; item 4 forbids assuming `SalesAgreement` is a generic `Node` |
| No partial canonical apply | 5, 6, 10 | Met — a truncated refund contributes no partial snapshot; apply only after every required connection completes |
| Incomplete walk → `SNAPSHOT_PAGINATION_INCOMPLETE` | 11 | Met — durable on `OrderFactObservationInFlight`; no canonical row created merely to hold the diagnostic; reconciler derives `DataIssue` |
| Continuation counted against request/cost envelope | §4.5 | Met — `OrderAgreementSalesPage` and `RefundFactById` continuation calls each explicitly counted |
| No silent page cap | 7 | Met — 100–250 transport page size allowed, loop mandatory |

**LIST-vs-connection treatment is correct in every field.** Item 8 (forbid pagination args) names exactly `Order.refunds`, `Order.transactions`, `LineItem.taxLines`, `LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties` — all six confirmed LIST types by introspection. Item 9 (must paginate) names exactly `Order.lineItems`, `Order.agreements`, `SalesAgreement.sales`, `Refund.refundLineItems`, `Refund.orderAdjustments`, `Refund.refundShippingLines`, `Refund.transactions` — all seven confirmed connections. **T20** asserts the LIST set only and explicitly forbids flagging `Refund.transactions`, correctly preventing the inverse error. **T56** and **T57** cover multi-page refund children and exhausted walks.

**Pagination verdict: PASS.**

---

## 10. Bulk planning

| Requirement | Result |
|---|---|
| Bulk C prohibited | **Met** — `orders { agreements { sales } }` is three connection levels; official limit is two. Deleted, and T53 requires the schema gate to reject it |
| Bulk A legal under current official limits | **Met** — `orders { lineItems }` is two connections at two levels, within "five total connections" and "two levels deep". Independently confirmed legal |
| Bulk B connection-under-LIST not falsely asserted legal | **Met** — `orders { refunds { refundLineItems } }` nests a connection under a **LIST**; the plan states bulk documentation does not address non-connection list fields and marks legality **UNVERIFIED**, gated as a PR6-B executable/schema-validation deliverable that must **record the result** |
| Bulk B remains an executable/schema validation gate in PR6-B | **Met** |
| Costed fallback exists | **Met** — per-order `refund(id:)` / `order(id:)` refund pagination for every refund-bearing Bulk A order; bound stated; observed refund-bearing ratio must be reported; no REST-only import invented |
| No runtime correctness depends on Bulk B succeeding | **Met** — the agreement/sale primary path is paginated `order(id:) { agreements { sales } }`, independent of Bulk B |
| No silent N+1 explosion against the 1M-line envelope | **Met** — `N_edit_or_refund` plus explicitly counted continuation calls; PR6-B must batch/limit concurrency, assert query counts including continuations, and **fail the lane** if the envelope cannot be met without silent truncation; dropping agreements to save requests is forbidden |

**Bulk A/B/C verdict: PASS.**

---

## 11. Identity / clocks / existence

| Requirement | Result |
|---|---|
| Shopify GID identity | **Met** — §8.1; SKU/barcode/title/handle/`name`/`number` are attributes only |
| Nullable `RefundLineItem.id` / ordinal composite | **Met** — `@@unique([shopId, shopifyRefundGid, shopifyLineItemGid, refundLineOrdinal])`, nullable `shopifyGid` kept as lineage; matches the verified nullable `ID`; T46 |
| No SKU/title identity analog | **Met** — §4.6 and §8.3: "Never merge history by SKU"; recreated variants are new GIDs |
| Order Clock A | **Met** — `Order.updatedAt` (`DateTime!` verified) |
| Refund Clock A | **Met** — `Refund.updatedAt` (`DateTime!` verified), **bound independently** of the order gate even when the refund node arrives inside an order refetch |
| Child parent-version semantics | **Met** — LineItem, RefundLineItem, OrderAdjustment, Sale have **no** clock A; `SalesAgreement.happenedAt` correctly declared event time, immutable, **not** a version; single legal writer named per child set |
| Equal-timestamp repair | **Met** — gate rejects on `<` **only**; equal `updatedAt` must re-apply idempotently (T45) |
| Stale snapshot whole-child rejection | **Met** — all-or-nothing; every child from a rejected response discarded (T44) |
| Transaction status with no child `updatedAt` | **Met** — `OrderTransaction` has no clock A; `createdAt` immutable, `processedAt` nullable, `status` mutable; refreshed via refund snapshot apply **and** transaction-topic refetch; `createdAt` never treated as a status version |
| Order access-window semantics | **Met** — `orderHistoryWindowDays = 60`, matching the verified official default |
| `INACCESSIBLE_HISTORY_WINDOW` | **Met** — preserves last unambiguous `existenceState`; not a terminal tombstone; reversible by later LIVE refetch |
| `ABSENT_SIGNALLED_DELETE_UNVERIFIED` | **Met** — out-of-window `orders/delete` with `deletionSource = DELETE_WEBHOOK`, rows retained; declared an explicit narrow derogation |
| In-window confirmed absence | **Met** — requires completed null **AND** provably in-window **AND** no scope loss vs last LIVE |
| Scope downgrade invalidates absence authority | **Met** — §8.16, observation-scope snapshot persisted, T50 |
| No aged-out tombstone | **Met** — §8.5, §8.7, §8.8, T41 |
| No physical delete | **Met** — §8.11; tombstone-only, no cascade delete, R-164 analog |
| No FK to current `ProductVariant` identity | **Met** — §4.6: optional lookup only, **no FK**; `variantGidAtSale` persisted forever and never cleared or re-pointed |

**Identity/clock verdict: PASS. Access-window/deletion verdict: PASS.**

---

## 12. Tenancy / RLS planning

Checked against current-main tenancy architecture (`app/tenant/tenant-db.server.ts`, `app/tenant/models.ts`, `scripts/tenant-enforcement/manifest.ts`, `app/tenant/__tests__/`).

| Requirement | Result |
|---|---|
| DIRECT vs CHILD models | **Met** — frozen assignments (F-23); real current-main constants `DIRECT_MERCHANT_MODELS` / `CHILD_MERCHANT_MODELS` confirmed in `app/tenant/models.ts` |
| Composite tenant FKs | **Met** — child FKs include `shopId` |
| Immutable / non-null `shopId` | **Met** — non-null, immutable, `@@unique([shopId, id])`; UPDATE cannot change `shopId` |
| FORCE RLS | **Met** |
| Missing tenant context default deny | **Met** |
| Runtime / control-plane separation | **Met** — `WebhookDelivery`, `DurableJob`, `SyncRun`, `SyncCursor`, **`DataIssue`** stay non-DML for runtime |
| No `BYPASSRLS` | **Met** — runtime role explicitly has none |
| No Shop-row generation counter | **Met** — §5.1 forbids adding a generation counter to `Shop` |
| Reuse `stocky_catalog_observation_gen_seq` | **Met** — sequence confirmed to exist on current main (`20260816193000_pr5_catalog_fact_foundation/migration.sql:778`); plan requires a one-line PR6-A note that the catalog-scoped name is platform infrastructure, and forbids minting a second sequence |
| Sequence privilege model | **Met** — migration confirms `REVOKE ALL … FROM PUBLIC`; cross-shop numeric gen comparison remains forbidden |
| Tenant manifest hard-coded counts recognized as implementation work | **Met** — current main really does hard-code these (`manifest.ts:1000` asserts `MERCHANT_TABLES.length !== 26`; `tenant-db.test.ts` asserts 26/20/6); the plan assigns the update to PR6-A and changes nothing now |
| Runtime cannot DML `DataIssue` | **Met** — §6.5, §12; applicator writes merchant-durable columns only, reconciler derives `DataIssue` |
| `OrderFactObservationInFlight` is merchant-domain, not a reuse of `CatalogObservationInFlight` | **Met** |

No implementation is performed in this PR, as required.

**Tenant/RLS verdict: PASS.**

---

## 13. Lock / idempotence planning

| Requirement | Result |
|---|---|
| Sibling order lock namespace/version, not a widened catalog kind | **Met** — current main pins `CANONICAL_LOCK_VERSION = "stocky-pr5-canonical-lock-v1"` (`app/lib/catalog-facts/constants.ts:6`); the plan introduces the sibling `stocky-pr6-canonical-lock-v1` with order-only resource-kind literals `Order`, `OrderLine`, `Refund`, `RefundLine`, and forbids widening `CatalogResourceKind` |
| Deterministic key derivation | **Met** — identical PR5 encoding `<byte length>:<UTF-8 bytes>`, SHA-256, signed int32 `key1`/`key2` from digest bytes 0..7, never a JS 64-bit Number; known-answer vectors required in PR6-A |
| Lock-before-first-insert | **Met** — universal exclusive lock before the row exists; declared mandatory |
| Deterministic ordered acquisition | **Met** — dedupe then ascending `(key1, key2)`; "may also lock" removed |
| Order + Refund rule | **Met and non-contradictory** — refund job = Order + Refund; order-only job = Order only unless the same apply includes refund snapshots; §13 explicitly echoes §5.1 and explicitly disclaims any "Order+Refund always both" summary |
| No every-line lock explosion | **Met** — locking 250 line GIDs in one transaction forbidden (R-161 capacity envelope) |
| Capacity fail-closed | **Met** — identities per transaction well under 32; R-161 evaluator honoured; `lock_timeout` 5000ms, fail closed and retry |
| No Shopify I/O under lock | **Met** — stated in §5.1, §13 twice, and §17 |
| Application receipt / idempotence | **Met** — `SyncApplicationReceipt` (model confirmed on current main, `schema.prisma:860`), receipt-before-mutation |
| Duplicate delivery | **Met** — receipt short-circuit (§15) |
| Equal-version repair | **Met** — T45 |
| No savepoint / unsafe conflict pattern contradicting merged PR5 | **Met** — `ON CONFLICT` must re-evaluate clocks rather than blind-overwrite (R-160); no savepoint pattern introduced |

**Lock/idempotence verdict: PASS.**

---

## 14. Legacy boundary

| Requirement | Result |
|---|---|
| Do not tighten the three existing legacy sanitizers prematurely | **Met** — PO-02 forbids tightening `orders/create`, `orders/cancelled`, `refunds/create`; v1 projections keep emitting `line_items` |
| No silent break to `SalesDailyAggregate` | **Met** — "no silent period where the legacy consumer gets empty line arrays"; retirement is a separate explicitly authorized cutover after canonical facts **and** the replacement consumer have reconciled |
| New topics may use identity-only payloads | **Met** — `orders/edited`, `orders/delete`, `order_transactions/create` only |
| No legacy `parseFloat`/`Number` handler becomes PR6 canonical authority | **Met** — confirmed such code really is present on current main (`app/jobs/workers/webhook-processor.ts`); §21 and §23 both forbid it becoming canonical; R-014 stays OPEN and planning approval does not close it |
| No BOM explosion | **Met** — PO-07, non-negotiable, aligned with `AGENTS.md` principle 7 |
| No "default" canonical location | **Met** — PO-09 |
| No forecasting / ABC runtime in PR6 | **Met** — §3 non-goals; §7.3 forbids labelling a merchant-visible parity velocity until Phase 2 consumers exist |
| No compatibility projection into `SalesDailyAggregate` without later authorization | **Met** — §24: "PR 6 must **not** … write `SalesDailyAggregate`" |

**Legacy-boundary verdict: PASS.**

---

## 15. `read_all_orders`

| Requirement | Result |
|---|---|
| PR6 correctness does not depend on approval | **Met** — PO-01 states it in bold and the existence model (§8) is built to be sound without the grant |
| Scope not added | **Met** — `stocky-plus/shopify.app.toml` on this head reads exactly `read_products,write_products,read_inventory,write_inventory,read_orders,read_locations`. No `read_all_orders` |
| `write_orders` not added | **Met** — absent from the same line |
| Default accessible-history limitation represented honestly | **Met** — `orderHistoryWindowDays = 60`; `ORDER_HISTORY_WINDOW_TRUNCATED` (import depth) kept distinct from `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` (existence); a truncated extract may never be presented as a complete lookback; ABC/U 56-day may fit while Last-X 90 / same-period-last-year will not from live Shopify |
| Retained facts remain usable beyond the Shopify window | **Met** — out-of-window orders retained permanently with frozen `attributeFreshnessState` |
| Out-of-window null is not deletion authority | **Met** — §8.4, §8.5, T41 |
| Q-016 is a Partner/production timing question, not a PR6-A correctness blocker | **Met and correctly classified** |

**`read_all_orders` verdict: PASS.**

---

## 16. Risk-ID synchronization

Current main owns through **R-165** (verified: `git show origin/main:stocky-plus/docs/RISK_REGISTER.md` highest id is R-165, the F2C null→zero risk, CLOSED FOR PR5 REPOSITORY IMPLEMENTATION).

- The entire mutable PR6 proposed block is remapped to **R-166 … R-185** — 20 IDs, **contiguous, unique, no duplicates, no skips, no collisions**. Verified by extracting every `R-###` token from §21/§21.1.
- A complete old→new traceability table (old proposed R-165…R-184 → R-166…R-185) is present.
- The only other `R-###` tokens in the mutable plan are **R-014, R-016, R-139, R-160, R-161, R-164, R-165** — every one a deliberate cross-reference to an existing current-main risk, not a new proposal. R-165 is explicitly distinguished: "Current-main **R-165** remains the PR5 F2C risk and is distinct from every PR6 proposed ID."
- `RISK_REGISTER.md` is **not** edited by this PR (confirmed by diff).
- The immutable reviews retain their historical proposed IDs and were not edited.
- `DECISIONS.md` item 22 and the PR body both record the same mapping.

No mutable current-state reference uses an old proposed ID in a way that creates ambiguity with the existing R-165.

**Risk-ID mapping verdict: PASS.**

---

## 17. `OPEN_QUESTIONS` synchronization

Current main owns **Q-001 … Q-011**. The synchronized canonical `OPEN_QUESTIONS.md` adds **Q-012, Q-013, Q-014, Q-015, Q-016** — each appearing exactly once as a definition, uniquely numbered, with no collision against the existing set.

Adjudication of the classifications:

| ID | Claimed class | Adjudication |
|---|---|---|
| **Q-012** multi-currency ABC | later metric/product | **Correct.** The engineering half is already frozen (§6.2 forbids summing mixed currencies and forbids app FX; per-order `currencyCode` persisted). Only the ABC *label* remains |
| **Q-013** later "net sales" presentation | later metric/product | **Correct.** PR6 persists Sale / Refund / transaction bags; PO-11 already forecloses the tempting second authority |
| **Q-014** location-grain demand | later metric/product | **Correct.** PO-09 freezes Monday behavior as shop-wide; no `"default"` invented; fact persistence is unaffected |
| **Q-015** cancelled/unpaid in later metrics | later metric/product | **Correct.** Storage-neutral — Shopify status and unit facts are persisted either way |
| **Q-016** `read_all_orders` Partner timing | Partner/production | **Correct.** PO-01 makes correctness independent of the grant |

**None blocks PR6-A fact correctness.** For each, I confirmed the plan persists the underlying raw Shopify facts and defers only a presentation/label decision — no unanswered value is consumed by the PR6-A fact contract.

**PO-10 and PO-11 are recorded as RESOLVED frozen decisions and do not appear as open questions.** Confirmed in the plan (§C0, §C1), the sync report, `DECISIONS.md` item 22, and the `OPEN_QUESTIONS.md` preamble ("PO-10 and PO-11 are **RESOLVED** and are **not** open questions").

**OPEN_QUESTIONS verdict: PASS.**

---

## 18. Current-main PR5 primitive reuse

Every path cited in §24 was verified to exist on current main `58bf62b4…` via `git cat-file -e`:

`app/tenant/tenant-db.server.ts`, `app/tenant/models.ts`, `app/lib/catalog-facts/advisory-lock.ts`, `app/lib/catalog-facts/lock-capacity.ts`, `app/lib/catalog-facts/apply/money.ts`, `app/lib/catalog-facts/apply/fencing.ts`, `app/lib/catalog-facts/apply/observation-evidence.ts`, `app/lib/catalog-facts/admin-read/**`, `app/lib/catalog-facts/apply/**`, `app/lib/catalog-facts/compatibility-projection/**`, `app/jobs/workers/catalog-facts/resource-refetch.ts`, `app/lib/catalog-facts/ingest/jsonl-stream.ts`, `checkpoint.ts`, `bulk-operation-recovery.ts`, `app/lib/catalog-facts/apply/projection-state.ts` — **all present**. `stocky_catalog_observation_gen_seq` and `model SyncApplicationReceipt` also confirmed.

The plan reuses TenantDb, exact decimal helpers, the generation sequence, observation interval/fencing, advisory locks, deterministic lock ordering/capacity, receipts/idempotence, physical-delete denial, F3 authoritative refetch, JSONL/checkpoint/resume, and projection/health patterns — while explicitly forbidding widening `CatalogResourceKind`, reusing catalog existence enums where order semantics differ, importing catalog apply writers, and sharing the catalog lock version. Order existence kinds are declared siblings; the design lives under `app/lib/order-facts/**`.

**No accidental domain coupling.** **PR5 primitive reuse verdict: PASS.**

---

## 19. Lane sequencing

Planning remains **PR6-A foundation → (PR6-B admin-read ∥ PR6-C applicator) → PR6-D webhooks/import**, gated behind later ChatGPT runtime authorization. PR6-C consumes A's frozen types rather than B's reader implementation, which correctly justifies the parallelism. "Do not open four writers at once. Do not start A from this planning PR."

Verified that **no runtime lane has started**: no `order-facts` path exists anywhere in the PR #34 tree outside `docs/`, and none exists in `stocky-plus/app`. No runtime authorization is claimed anywhere; the plan, sync report, PR body, `DECISIONS.md` item 22, `PROJECT_STATUS.md`, and phase-1 `README.md` all state PR6 runtime **NOT AUTHORIZED**.

**Lane sequencing verdict: PASS.**

---

## 20. Sync-report evidence verdict

`PR6_CURRENT_MAIN_SYNC_REPORT.md` was checked claim-by-claim rather than accepted as self-reported.

| Claim | Independent result |
|---|---|
| Old head `f5d429b7…` | **Confirmed** — merge parent 1 |
| Current main merged in `58bf62b4…` | **Confirmed** — merge parent 2 |
| Merge commit `ba47ecba…` | **Confirmed** |
| Conflict handling (only `phases/phase-1/README.md`; kept current-main identities) | **Confirmed** by reading the resolved file's diff — PR5/F3/PR36 identities preserved, PR6 layered on top, no old F3 state restored |
| Closure identity (PR #35, PR #36, PR5 FORMALLY CLOSED, Phase 1 IN PROGRESS, no D-055) | **Confirmed** |
| PR #30 F2C CLOSED/MERGED, PR #31 F2B historical | **Confirmed** |
| PO-10 / PO-11 | **Confirmed** — see §6 and §7 |
| Risk mapping R-165…R-184 → R-166…R-185 | **Confirmed** — see §16 |
| Questions Q-012…Q-016 | **Confirmed** — see §17 |
| Immutable blobs | **Confirmed byte-identical** — see §2 |
| Classifier evidence (`docs_only=true`, `full_ci=false`, 11 docs paths) | **Consistent** with the 11-path diff and with Heavy SKIPPED in exact-head CI |
| CI evidence (run `34050245829`, jobs `101532443368` / `101532457870` / `101532457607`) | **Confirmed** — see §3 |
| Scopes line (no `read_all_orders` / `write_orders`) | **Confirmed** against `shopify.app.toml` |
| Tenant hard-coded counts 26 / 20 / 6 | **Confirmed** against `manifest.ts:1000` and `tenant-db.test.ts:90-92` |
| Legacy `parseFloat`/`Number` in `webhook-processor.ts` | **Confirmed** present |
| Prisma validate / PR5 suites **not** re-run | **Honest** — correctly disclaimed rather than claimed |

One evidence row is weaker than the rest and is recorded as **F-P3-02** below: the "generated types" corroboration for PO-11 points at a gitignored codegen output. It is legitimate, but it is not independently reproducible from the repository alone. The material fact it supports was independently confirmed from official 2026-07 authority, so nothing in the contract depends on it.

**Sync-report evidence verdict: PASS** (one non-blocking P3).

---

## 21. Control-document consistency

All 11 changed documents were searched for contradictions.

| Assertion | Consistent across all documents |
|---|---|
| Current main `58bf62b4…` correct | Yes |
| PR5 formally closed | Yes |
| Phase 1 still IN PROGRESS | Yes |
| PR6 planning pending independent approval | Yes |
| PR6 runtime NOT AUTHORIZED | Yes |
| Production NOT AUTHORIZED | Yes |
| Merchant production data NOT AUTHORIZED | Yes |
| Inventory mutations NOT AUTHORIZED | Yes |
| Flags DEFAULT OFF (incl. `FEATURE_PR5_ABSENCE_TOMBSTONE`) | Yes |
| No D-055 | Yes — no decision heading; only prohibitions and "Not created" rows |
| No PR6-A started claim | Yes |
| No merge-authorized claim | Yes — merge and mark-ready explicitly UNAUTHORIZED in the plan header, sync report header, and PR body |
| No stale PR #30 / #31 / #35 / #36 state | Yes — all four correctly CLOSED / MERGED; F2B and F2A squashes explicitly labelled historical |
| No stale risk/question IDs | Yes |
| No old F3 state restored in README conflict resolution | Yes |

The packet also correctly declines to claim its own approval: the plan header, `C0`, the sync report, `PROJECT_STATUS.md`, phase-1 `README.md`, and the PR body all say **INDEPENDENT FINAL CORRECTION RE-REVIEW PENDING**.

**Control-document consistency verdict: PASS.**

---

## 22. Findings

### P0 — none
### P1 — none
### P2 — none

### P3 (non-blocking residuals)

#### F-P3-01 — Refund money-reconciliation identity may false-fire on unsettled or failed refund transactions

- **Severity:** P3 (non-blocking; diagnostic-only, no data corruption)
- **File / line:** `stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md` §6.6 (line 1323 ff.)
- **Evidence:** The frozen identity equates `Refund.totalRefundedSet.shopMoney` to the sum of refund-line subtotals + taxes + refund shipping + adjustments. Official 2026-07 documentation defines `Refund.totalRefundedSet` as "the total amount **across all transactions** for the refund", and the `Refund` object carries an explicit note that a `Refund`'s existence does not guarantee money was returned — settlement state lives on `OrderTransaction.status`. A transaction-derived total and a line-composition total are therefore not guaranteed identical in every settlement state (for example a failed or errored refund transaction).
- **Merchant impact:** Potential recurring `REFUND_MONEY_UNBALANCED` diagnostic noise on refunds whose transactions have not settled or have failed, reducing signal value of a genuine reconciliation alarm. No incorrect money is ever stored.
- **Reproduction:** Create a refund whose refund transaction ends in `failure`/`error` while refund line items remain present; evaluate the §6.6 identity on that snapshot.
- **Expected behavior:** Either scope the identity to refunds whose relevant transactions have reached `SUCCESS` (consistent with PO-06's settlement rule), or record explicitly that the identity is evaluated regardless of settlement state and that unsettled refunds are an expected diagnostic class.
- **Recommended correction:** Add one qualifying sentence to §6.6 tying identity evaluation to the PO-06 settlement state, so the reconciliation check and the money-settlement rule agree.
- **Missing test:** A T49 sibling asserting that an unsettled or failed refund transaction does **not** by itself produce a spurious `REFUND_MONEY_UNBALANCED`.
- **Why non-blocking:** The plan already stores Shopify's reported amounts as truth, forbids inventing a balancing entry, and treats a mismatch as a diagnostic rather than a rewrite. The failure mode is alarm noise, not corruption or unsafe behavior, and T49 already exists as the harness in which to settle it.

#### F-P3-02 — PO-11 corroboration cites a gitignored codegen artifact

- **Severity:** P3 (documentation hardening; the underlying fact is independently confirmed true)
- **File / line:** `stocky-plus/docs/phases/phase-1/PR6_CURRENT_MAIN_SYNC_REPORT.md` lines 113, 123, 228
- **Evidence:** These rows cite `app/types/admin.types.d.ts` as showing `priceAfterAllDiscountsBeforeTaxesSet: MoneyBag` on current main. That path is a **gitignored** codegen output (`stocky-plus/.gitignore:43`, produced by `npm run graphql-codegen` against `ApiVersion.July26`) and is therefore absent from any fresh clone, so a later reviewer cannot reproduce the citation without installing dependencies and running codegen.
- **Merchant impact:** None. Governance/verification-provenance only.
- **Reproduction:** `git ls-files | grep admin.types` returns nothing; `ls stocky-plus/app/types` does not exist in a fresh clone.
- **Expected behavior:** An evidence row should be reproducible from committed repository state or from a stable external authority.
- **Recommended correction:** Lead the evidence row with the official 2026-07 `LineItem` object page and the cited changelog (both verified real and correct in this review), and mark the codegen artifact as a locally reproducible secondary corroboration requiring `npm run graphql-codegen`.
- **Missing test:** None required.
- **Why non-blocking:** The substantive claim — that the field exists in 2026-07 as `MoneyBag!` — was independently verified in this review against official Shopify 2026-07 authority (object page twice, plus the changelog). The plan's own primary citation (§4.1 line 546) is that official changelog, so no contract term rests on the codegen artifact.

---

## 23. Verdict summary table

| Item | Verdict |
|---|---|
| Reviewed PR #34 head | `fc09413ac1f2caf9ff653c30f12937aef35c8d5d` |
| Current main | `58bf62b4d1c5f51dac70ee96fed4ece0a109b25f` |
| PR state | OPEN / DRAFT / UNMERGED / mergeable clean |
| Merge base / ahead / behind | `58bf62b4…` / 8 / 0 |
| Changed scope | 11 docs paths — documentation only |
| Synchronization merge identity | `ba47ecba…` (parents `f5d429b7…` + `58bf62b4…`) |
| Immutable original-review blob | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` — unchanged |
| Immutable correction-review blob | `fca2b260d03e3105782ed216f7773c53e6aef2a7` — unchanged |
| Exact-head CI | run `34050245829` SUCCESS; Classify `101532443368` SUCCESS; Heavy `101532457870` SKIPPED; CI Gate `101532457607` SUCCESS; no later push |
| Current-main state | PASS |
| Shopify 2026-07 verification | PASS |
| PO-10 | PASS |
| Mixed exchange / actionType | PASS (T58 present and correct) |
| Unit formulas | PASS (arithmetically sound) |
| PO-11 | PASS |
| `priceAfterAllDiscountsBeforeTaxesSet` official status | **EXISTS in 2026-07 as `MoneyBag!`** |
| Money model | PASS (1 × P3) |
| Pagination | PASS |
| Bulk A / B / C | PASS |
| Identity / clocks | PASS |
| Access window / deletion | PASS |
| Tenant / RLS | PASS |
| Lock / idempotence | PASS |
| Legacy boundary | PASS |
| `read_all_orders` | PASS |
| Risk-ID mapping | PASS |
| OPEN_QUESTIONS | PASS |
| PR5 primitive reuse | PASS |
| Lane sequencing | PASS |
| Sync-report evidence | PASS (1 × P3) |
| Control-document consistency | PASS |
| **Findings** | **P0 = 0 / P1 = 0 / P2 = 0 / P3 = 2** |

---

## 24. Authorization state (unchanged by this review)

- PR #34 — **unchanged**. Not modified, not merged, not marked ready.
- `main` — **unchanged**.
- PR6 runtime — **NOT AUTHORIZED**.
- Production — **NOT AUTHORIZED**.
- Merchant production data — **NOT AUTHORIZED**.
- Shopify inventory mutations / inventory writes — **NOT AUTHORIZED**.
- Inventory-write flags — **DEFAULT OFF**.
- `FEATURE_PR5_ABSENCE_TOMBSTONE` — **DEFAULT OFF**.
- No D-055 created.
- Phase 1 — **IN PROGRESS**.

This review authorizes no runtime lane and merges nothing. It is an input to ChatGPT's merge decision for PR #34 as the final PR6 planning contract.

---

## 25. Final verdict

Final planning approval requires P0 = 0, P1 = 0, P2 = 0. This review found **P0 = 0, P1 = 0, P2 = 0**, with two non-blocking P3 residuals recorded above.

**APPROVE PR6 CURRENT-MAIN PLANNING**
