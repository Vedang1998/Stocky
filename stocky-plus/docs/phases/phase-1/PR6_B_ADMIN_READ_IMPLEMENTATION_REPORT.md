# Phase 1 PR6-B — Admin READ order and refund extraction

**Status:** Consolidated correction implemented — pending independent Claude re-review of PR #39 and ChatGPT acceptance
**Slice:** PR6-B Admin READ / extraction only
**Branch:** `phase-1/pr6-b-order-admin-read`
**Authority:** D-054 **EFFECTIVE**. PR6-A **ACCEPTED / MERGED / CLOSED**. No D-055.
**PR 6 overall:** `IN PROGRESS`
**Phase 1:** `IN PROGRESS`
**Monday 7 September 2026 target:** **missed** (not re-dated)
**Production:** NOT AUTHORIZED
**Merchant production data:** NOT AUTHORIZED
**Shopify writes / inventory writes / scope additions / flag enablement:** NOT AUTHORIZED
**PR6-C apply:** not implemented on this branch; C's separately authorized lane is in correction, not globally unauthorized
**PR6-D runtime:** NOT AUTHORIZED

This report records the PR6-B Admin READ implementation **and** the ChatGPT-authorized consolidated correction of F-CLAUDE-PR6B-01…11. It does **not** claim independent re-review approval, ChatGPT acceptance, merge authorization, or PR 6 completion. It does **not** start C apply, D webhooks/import, or production.

This file does **not** invent its own commit SHA or the live PR-head SHA that contains this file. Exact-head `pull_request` Classify + full Heavy + CI Gate IDs are recorded in the PR body after that head exists; they are not guessed here. Baseline exact-head run on pre-correction head `d9717f68ea981aa68f108428a31d7726d0ba2a8f` is [`34651155935`](https://github.com/Vedang1998/Stocky/actions/runs/34651155935) **SUCCESS** and is **not** evidence for the correction head.

---

## 1. Identities

| Field | Value |
|---|---|
| Role | Cursor B — exclusive Admin READ lane |
| Authorized squash **M** / `origin/main` at admission and at this record | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` |
| **M** sole parent | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| `M^{tree}` | `9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc` |
| PR #37 | **CLOSED / MERGED** `2026-09-11T20:07:27Z` |
| Correction review at **M** | `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` blob `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` — **`APPROVE PR6-A FOUNDATION CORRECTION`** |
| Exact-M push CI | run [`34642536795`](https://github.com/Vedang1998/Stocky/actions/runs/34642536795) **SUCCESS** (Classify `103405479267`; Full Heavy `103405514450` not SKIPPED; CI Gate `103422700596`) |
| Control commit (docs-only admission) | `4a5478dd0daa658ffd2d50cce4a33571cb0ab6f6` |
| PR #37 admission comment | `PR6_BC_ADMISSION_READY` |
| First runtime commit | `3031119dbb791ae7aed86600f4edf11c76e8bc94` |
| Test/codegen/static-safety fix | `e82e0f2d66322ab685e1da78d6621426aee87644` |
| Runtime/test implementation head | `748b84f981757f31241c23a6c968c98840e993c1` |
| Implementation report commit / pre-correction live PR head | `d9717f68ea981aa68f108428a31d7726d0ba2a8f` |
| Immutable B independent review | commit `59f469a1951a4a4d86c6273f9ff10cc6635cf0e3`; blob `b4533610b5af305816aef5434b884c3065b06f94`; sole parent `d9717f68…`; one-file delta `PR6_B_ADMIN_READ_INDEPENDENT_REVIEW.md` (never edit) |
| ChatGPT correction decision | PR #39 comment [`5642819080`](https://github.com/Vedang1998/Stocky/pull/39#issuecomment-5642819080) |
| Draft PR | https://github.com/Vedang1998/Stocky/pull/39 (draft, targeting `main`) |
| Admin API | **2026-07** QUERY-only (`ApiVersion.July26`); not bumped |
| Working tree at runtime/test head | clean |

Owner authority already resolved (not re-opened):

- ACCEPT PR6-A / squash-merge: [5638553192](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5638553192)
- B/C addendum: [5639320213](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5639320213)
- Corrected D-readiness disposition: [5639842776](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5639842776)
- Merge-identity / pending-CI note: [5640040968](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5640040968)

If `origin/main` later moves to a **different tree**, stop. This report does not guess a later **M**.

---

## 2. Scope implemented

Isolated read-only order/refund Admin boundary under:

`stocky-plus/app/lib/order-facts/admin-read/**`

Public API (`index.ts`): trusted `{ admin, shop, request? }` → complete snapshot **or** typed incomplete **or** failure. Never a truncated “complete” snapshot.

This lane owns Shopify **read/query** mechanics only.

It does **not**:

- apply canonical facts (C);
- DML `OrderFactObservationInFlight` or `SalesDailyAggregate`;
- ingest JSONL / run bulk operations;
- implement workers, webhooks, or import (D);
- change Prisma schema, migrations, A `types.ts` / constants / locks, or tenant primitives;
- edit C `apply/**`;
- change Shopify app config, requested scopes, package/CI/test-config;
- issue Shopify mutations (`bulkOperationRunQuery` included);
- enable inventory-write flags;
- call a live store.

Tenant identity: import `denyConflictingClientShop` only. Do **not** import `requireAdminTenant` (that pulls `shopify.server`, which the F3 production scanner forbids). Client shop headers are never tenant authority.

`orderHistoryWindowDays = 60` lives in B `constants.ts` (`ORDER_HISTORY_WINDOW_DAYS`). A did not export it.

---

## 3. Read-boundary architecture

```text
admin-read/
  documents.ts              tagged Admin QUERY documents (#graphql, codegen)
  bulk-query-documents.ts   Bulk A/B/C inner QUERY shapes (not tagged; not submitted)
  bulk-query-schema.ts      graphql-js specifiedRules vs generated Admin 2026-07 schema
  bulk-operation-rules.ts   Shopify bulk connection/Node/depth gate (T53)
  bulk-b-fallback.ts        production-disabled Bulk B + synthetic cost helper
  execute.ts                AST-inspect then Admin graphql()
  budgeted-execute.ts       ORDER_ADMIN_READ_MAX_REQUESTS = 250
  orders.ts                 OrderFactById walk; extra line/agreement pages; aged-out null
  agreements.ts             OrderAgreementSalesPage ($agreementAfter preceding cursor)
  refunds.ts                RefundFactById; truncated embeds are not partial snapshots
  shop.ts                   ShopTimezoneCurrency (read only, do not persist)
  access-scopes.ts          CurrentAppInstallationAccessScopes (addendum -10)
  money.ts                  exact decimal strings; Number → MALFORMED_MONEY
  tenant.ts                 denyConflictingClientShop only
  safety/graphql-ast.ts     deny-by-default QUERY-only; field AST forbids currentBulkOperation
  safety/production-modules.ts  recursive production .ts enumeration
  safety/scan.ts            TS compiler extraction + GraphQL AST scan
```

Execute path: `assertCanonicalReadDocument(document)` (graphql-js `parse` + `visit`) **before** `admin.graphql`. A mutation never reaches the Shopify client from this module. There is no bulk-operation submit exception.

---

## 4. Named QUERY documents (Admin API 2026-07)

All `#graphql` in `documents.ts`. Static templates; no `${}` interpolation. Identity: requested GID must equal returned `id` or fail closed (`IDENTITY_MISMATCH`).

| Document | Contract |
|---|---|
| `OrderFactById` | Paginate `lineItems` + `agreements` to completion. First page only of sales and refund-child connections. No shared `$saleAfter` / refund-child `after`. |
| `OrderAgreementSalesPage` | `$agreementAfter` = cursor immediately preceding the target (`null` valid for first). Walk `$saleAfter` to exhaustion. SalesAgreement is not a generic Node. |
| `RefundFactById` | Separate first/after pairs per connection. Truncated embed ⇒ continue; never keep a partial refund snapshot. |
| `ShopTimezoneCurrency` | `shop { id ianaTimezone currencyCode }` — read only, do not persist. |
| `CurrentAppInstallationAccessScopes` | `currentAppInstallation { accessScopes { handle } }`. `AccessScope.handle` is `String!`. Schema-validated. Static TOML requested scopes are **not** absence evidence. |

Fragments: `OrderLineFactFields` aliases `discountedTotalSet(withCodeDiscounts: true/false)`. Refund / adjustment / shipping / transaction / sale fragments use A money bags + official 2026-07 fields. Agreement nodes select `__typename`. Sale `lineItem` only on `ProductSale` / `GiftCardSale` / `TipSale` inline fragments.

**Forbidden (AST + tests):** mutations; `currentBulkOperation`; `Order.cancellation` / customer PII; `Sale.lineItem` on the interface; `priceAfterAllDiscountsBeforeTaxesSet` as canonical money; pagination args on named non-connection LISTs; `Number`/`parseFloat`; FX; division-derived unit price.

---

## 5. Pagination and incompleteness

- Page size default `ORDER_ADMIN_READ_PAGE_SIZE = 100`.
- Request budget `ORDER_ADMIN_READ_MAX_REQUESTS = 250`. Exhaustion → typed `SNAPSHOT_PAGINATION_INCOMPLETE`, never a truncated complete snapshot (T57). B does **not** persist that outcome onto `OrderFactObservationInFlight` (C owns apply).
- Extra line pages re-query `OrderFactById` and consume only `lineItems`. Extra agreement pages consume only `agreements`.
- T19: 300 lines, page size 100, **four** `OrderFactById` calls (three pages + one bounded version recheck counted in the request budget), no silent 250-line cap. T19 is **reader** pagination, not webhook projection. The pre-correction three-call expectation is replaced by this stronger regression, not deleted.
- T39: 101 lines (exactly one extra page) all present.
- Truncated refund embeds continue via `RefundFactById` (T56: two refunds × 150 lines, `childrenComplete === true`). A first standalone `RefundFactById` made to continue an already-truncated embed is continuation evidence, not `null_observed`.
- Cursor fail-closed: missing `pageInfo`, empty page with `hasNextPage`, `hasNextPage` without `endCursor`, empty continuation after `hasNextPage`.
- Aged-out `order(id:)` explicit null → **`null_observed`** (T41 kept as a stronger regression). Detail does **not** say “tombstone”. Nested paging that later returns null is `SNAPSHOT_PAGINATION_INCOMPLETE` and does not fabricate an Order/Agreement/Sale.
- Complete results pin Order `updatedAt` + `currencyCode` from the first page and Refund `updatedAt` from the first Refund page. Comparisons are exact timestamp strings. Independent Order/Refund clocks are allowed.

---

## 6. Money

Required vs optional bags are **imported** from A `ORDER_REQUIRED_MONEY_BAGS` / `ORDER_OPTIONAL_MONEY_BAGS`. B does not redefine those tables.

- Amounts remain exact decimal **strings** (`"19.99"`, `"0.1"`, `"0.123456"`).
- Number amounts → `MALFORMED_MONEY` (T30).
- One invalid required bag rejects the **whole** snapshot (T48 reader).
- Required bag shop currency ≠ order `currencyCode` → `MONEY_CURRENCY_MISMATCH`.
- Optional bags may be absent; present-but-invalid still fails.
- No `parseFloat` / `Number(amount)` on production modules (static scan).

---

## 7. Bulk eligibility (C-05 / T53)

Two gates on this tree. Frozen catalog `app/lib/catalog-facts/admin-read/bulk-query-schema.ts` was **not** modified.

1. graphql-js `specifiedRules` against generated `app/types/admin-2026-07.schema.json` (path `../../../types/admin-2026-07.schema.json`). No `fetch`, no shopify.dev.
2. Shopify bulk-rule validator: inspects the **single executed operation** and reachable named/inline fragments while retaining parent type, root position, and connection depth. Must include a connection; ≤5 connections; ≤2 nested connection levels; connection node types must implement **Node**; no top-level `node`/`nodes`. Multiple executable operations are rejected rather than chosen implicitly. Unused fragment definitions are not counted. Fragment cycles, undefined/invalid spreads, and unknown fields fail closed (`eligible: false`). Bound: `BULK_MAX_SELECTION_VISITS = 10_000`.

| Document | GraphQL schema | Bulk eligibility | Production path |
|---|---|---|---|
| Bulk A (orders + `lineItems`) | Valid | Two Node connections — **eligible** | Historical import **shape** only. No `Order.cancellation`. No `priceAfterAllDiscountsBeforeTaxesSet`. **Not submitted.** |
| Bulk B (refunds nested) | Valid under `specifiedRules` | **Ineligible** here: `RefundLineItem` does not implement Node (`refunds` is LIST) | **Disabled** (`BULK_B_PRODUCTION_ENABLED = false`). Costed fallback: per-order `order(id:)` / `RefundFactById` |
| Bulk C (agreements/sales) | GraphQL-valid under `specifiedRules` | **Illegal** (depth 3 + non-Node) | T53 rejects via **bulk-rule validator**, not `validate` alone. Not a production path |

No `bulkOperationRunQuery` / store submission / bulk mutation in B. F3 whole-app scan forbids `currentBulkOperation` across `app/` except `types/`.

### 7.1 Bulk B fallback cost (synthetic; not a live-store measurement)

Helper: `costBulkBFallback`. Envelope: `ORDER_LINE_IMPORT_ENVELOPE = 1_000_000` lines. One additional Admin request per refund-bearing order (non-zero `totalRefundedSet` or non-empty `refunds` LIST), plus explicit truncated-refund continuations.

Recorded synthetic vector (unit test):

| Input | Value |
|---|---|
| `refundBearingOrderCount` | 20_000 |
| `truncatedRefundContinuationCount` | 2_000 |
| `additionalAdminRequests` | 22_000 |
| `requestsPerEnvelopeLine` | 0.022 |

**Live refund-bearing-order ratio: UNVERIFIED.** No store call was authorized or executed. Do not treat the synthetic 20k/2k vector as merchant traffic.

Single-snapshot bound remains 250 Admin requests. Historical-import fallback cost is counted against the million-line envelope, not silently truncated.

---

## 8. Changed files

Runtime / tests (exclusive B tree):

- `stocky-plus/app/lib/order-facts/admin-read/**` (new in first runtime commit; test-import / codegen / static-safety / fixture typing follow-up)

Documentation:

- `stocky-plus/docs/phases/phase-1/PR6_B_ADMIN_READ_IMPLEMENTATION_REPORT.md` (this file)

Required shared-file refresh (CI gate, not product behavior):

- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`

Exact-head run [`34650235398`](https://github.com/Vedang1998/Stocky/actions/runs/34650235398) on first runtime commit `3031119dbb791ae7aed86600f4edf11c76e8bc94` failed at `tenant:enforcement:preflight` with `tenant:access:inventory:check_failed_exit_1`. Cause: new `app/lib/order-facts/admin-read/**` TypeScript files raised `scannedFiles` from **372** to **411**. Findings remained **1741**, violations remained **0**, content digest remained `d4fc40275641ec9a16904e210bf37b7c0d3cfb89cf89227b592842c9788ee771`. Regenerated with `npm run tenant:access:inventory`. No Prisma/schema change. No new tenant-access exceptions.

No `prisma/schema.prisma` change. No migration. No `.env`. No production/merchant data. Generated `admin-*.schema.json` / `admin.types.d.ts` / `admin.generated.d.ts` remain gitignored and were **not** force-added.

Control-commit docs already on the branch (not this runtime): `PR6_A_CLOSURE_REPORT.md`, `PR6_BC_EXECUTION_BRIEF.md`, live-status under existing D-054. No D-readiness artifacts added.

---

## 9. Requirement-to-test matrix (plan §19)

Default-discovered `app/lib/order-facts/admin-read/**/*.test.ts` are **pure unit / transport / mock**. No PostgreSQL. No live Admin.

Minimum B IDs from the execution brief, plus other reader-applicable rows.

| ID | Class | B coverage | Test file / assertion |
|---|---|---|---|
| T02 | − | Mutation document rejected before network; `currentBulkOperation` / cancellation / PII / `priceAfterAllDiscountsBeforeTaxesSet` via field AST | `mutation-safety.test.ts` — planted mutation **untagged** so codegen stays valid |
| T03 | bypass | Conflicting `x-shopify-shop-domain` → `TENANT_DENIED`, `admin.calls === []`. Matching header allowed, not treated as authority | `tenant.test.ts` |
| T17 / T18 | + | `test=true` and gift-card / tip lines preserved on the **same** complete snapshot (raw evidence for C; B does not persist or compute operational-metric exclusion) | `orders.test.ts` |
| T19 | + | 300 lines, page size 100, four `OrderFactById` calls (3 pages + version recheck), unique GIDs 1…300, no silent 250 cap | `orders.test.ts` |
| T20 | − | `first` forbidden on named non-connection LISTs (`Order.refunds`, `Order.transactions`, …). **Does not** flag `Refund.transactions` (Connection) | `documents.test.ts` |
| T30 | + | Number money amounts → `MALFORMED_MONEY` | `money.test.ts` |
| T39 | + | 101 lines / page size 100 → all present | `orders.test.ts` |
| T41 | − | `order(id:)` explicit null → `null_observed`; JSON must not match `/tombstone/i` or `INACCESSIBLE_HISTORY_WINDOW` | `orders.test.ts` |
| T46 (reader) | + | Complete refund snapshot accepts nullable refund-line ids (apply/idempotency remains C) | `orders.test.ts` refund reader |
| T48 | − | One invalid required MoneyBag rejects the whole snapshot. Production modules do not DML facts / observations / `SalesDailyAggregate` / Prisma | `orders.test.ts`, `static-safety.test.ts` |
| T52 | − | `Sale.lineItem` without inline fragments fails schema validation. Invalid document is **untagged** in `bulk-query-schema.test.ts` (must not live in `documents.ts`) | `bulk-query-schema.test.ts` |
| T53 | − | Bulk C may be GraphQL-valid; bulk-rule validator rejects (depth / Node) | `bulk-query-schema.test.ts` |
| T56 | + | Two refunds each > one child page; `childrenComplete`; `RefundFactById` continuations; no truncated embeds kept | `orders.test.ts` |
| T57 | − | `maxRequests: 1` on a 300-line walk → `incomplete` / `SNAPSHOT_PAGINATION_INCOMPLETE` | `orders.test.ts` |
| Addendum -10 | + | `currentAppInstallation.accessScopes.handle` mapped; schema-valid QUERY | `orders.test.ts`, `documents.test.ts`, codegen |
| GID identity | − | Returned order id ≠ requested → `IDENTITY_MISMATCH` | `orders.test.ts` |
| Nested paging null | − | Null during nested paging does not fabricate an order | `orders.test.ts` |
| Agreement sales | + | `OrderAgreementSalesPage` uses preceding cursor | `orders.test.ts` |
| Shop read | + | Timezone/currency read; B does not persist | `orders.test.ts`, `shop.ts` |
| Cursor fail-closed | − | Missing pageInfo / empty+hasNext / hasNext without endCursor | `cursor-pagination.test.ts` |
| DateTime | +/− | RFC3339 accepted; malformed rejected | `decimal.test.ts` |
| Bulk A/B | +/− | A eligible; B schema-valid + ineligible + production-disabled + synthetic cost | `bulk-query-schema.test.ts` |

**Not B-owned** (C apply, D webhooks/import/reconcile, or later): T01, T04–T16, T21–T29, T31–T38, T40, T42–T45, T47, T49–T51, T54, T55, T58. B supplies complete snapshots / typed failures as inputs. Do not treat reader tests as apply or webhook proof.

---

## 10. Commands executed

Environment: Cursor Cloud Agent workspace `/workspace/stocky-plus`. Disposable local Node. No production database. No merchant/store Admin token.

### 10.1 Pre-correction baseline (do not inherit as this correction)

Runtime/test implementation head: `748b84f981757f31241c23a6c968c98840e993c1`. Report commit / pre-correction PR head: `d9717f68ea981aa68f108428a31d7726d0ba2a8f`.

| Command | Exit | Status | Notes |
|---|---:|---|---|
| `npx vitest run app/lib/order-facts/admin-read --reporter=verbose` | 0 | executed and passed | **9 files, 47 tests passed** |
| `npx vitest run app/lib/order-facts --reporter=verbose` | 0 | executed and passed | **12 files, 66 tests passed** (A + B) |
| `npm test` / `npx vitest run` | 0 | executed and passed | **51 files, 439 tests passed** |
| GitHub `pull_request` [`34651155935`](https://github.com/Vedang1998/Stocky/actions/runs/34651155935) on `d9717f68…` | 0 | executed and passed | Baseline only after the correction push |

### 10.2 Consolidated-correction local gates

Observed on the correction working tree **before** the correction commits. Counts are **not** inherited from §10.1.

| Command | Exit | Status | Notes |
|---|---:|---|---|
| `npm run graphql-codegen` | 0 | executed and passed | Prerequisite; restocked / `location { id }` / sales-page clock fields validated against Admin 2026-07 |
| `npx vitest run app/lib/order-facts/admin-read --reporter=verbose` | 0 | executed and passed | **10 files, 119 tests passed** |
| `npx vitest run app/lib/order-facts --reporter=verbose` | 0 | executed and passed | **13 files, 138 tests passed** (A + B) |
| `npx vitest run` (`npm test`) | 0 | executed and passed | **52 files, 511 tests passed** |
| `npx eslint app/lib/order-facts/admin-read` | 0 | executed and passed | clean after unused-var fixes |
| `npm run lint` | 0 | executed and passed | clean |
| `npm run typecheck` | 0 | executed and passed | after `doTypesOverlap` composite-type guard |
| `npm run build` | 0 | executed and passed | `react-router build` |
| `npx tsx scripts/pr5-f3-safety-scan.ts` | 0 | executed and passed | `filesScanned: 186`, `findings: []` (was 182; +4 production modules) |
| `npm run tenant:access:inventory` then `:check` | 0 | executed and passed | `scannedFiles` 411 → **416**; findings 1741; violations 0; digest unchanged `d4fc40275641ec9a16904e210bf37b7c0d3cfb89cf89227b592842c9788ee771` |
| `git diff --check` | 0 | executed and passed | clean |
| Live Admin / store GraphQL | — | **not executed** | Not authorized |
| `bulkOperationRunQuery` / bulk submit | — | **not executed** | Forbidden in B |
| PostgreSQL / Redis / Docker migration suites (local) | — | **not executed** | B tests are unit/mock; exact-head GitHub full CI remains required |
| `workflow_dispatch` | — | **not executed** | Not used |

Focused commands ran nonzero tests. Empty collection would have been a failure.

---

## 11. Safety and tenancy evidence

- Tenant-scope: trusted server `shop` only; conflicting client header denied before Admin calls.
- Authorization: QUERY-only AST gate; no mutation allowlist.
- Idempotency / apply / receipts: **not this lane** (C).
- Audit / observation rows: B does not write them.
- Kill switch / inventory-write flags: untouched; remain default off.
- Reconciliation: not this lane (D).
- PII: customer fields rejected by field AST; not selected on production documents.
- Rolling window: explicit null `order(id:)` is **neutral `null_observed` evidence**, not confirmed absence, not a tombstone, and not `INACCESSIBLE_HISTORY_WINDOW` from B. C/D retain existence-kind adjudication.

---

## 12. Database and migration work

None. No Prisma schema change. No migration. No Shop column writes. `ShopTimezoneCurrency` is a read model only.

---

## 13. Deviations from the phase brief

| Item | Disposition |
|---|---|
| Import `requireAdminTenant` | **Not imported.** `denyConflictingClientShop` only, because `requireAdminTenant` pulls `shopify.server` and fails the F3 production scanner. Matches exclusive B ownership and F3 gate. |
| Persist `SNAPSHOT_PAGINATION_INCOMPLETE` on `OrderFactObservationInFlight` | **Not in B.** Brief forbids DML of that table in production B modules. B returns typed incomplete; C persists. |
| Live Bulk B store submission | **Not executed.** Brief: optional Bulk B execution is not permission to block B pending a store submission. Local Node gate already ineligible. |
| `orderHistoryWindowDays` in A constants | A did not export it. Defined in B `ORDER_HISTORY_WINDOW_DAYS = 60`. |
| T52 invalid document in `documents.ts` | Lives untagged in `bulk-query-schema.test.ts` so `#graphql` codegen does not fail. |
| Planted T02 mutation `#graphql` tag | Removed so `npm run graphql-codegen` does not fail on unknown `orderCancel(refund:)`. AST still parses and rejects the untagged mutation. |

No unapproved product-rule change. No FX. No BOM explosion. No sanitizer-limit raise.

---

## 14. Known failures and unresolved findings

| Item | Severity | Owner |
|---|---|---|
| Independent Claude review of the pre-correction implementation | Completed as CORRECTIONS REQUIRED (P0=0 / P1=2 / P2=4 / P3=5); immutable blob `b4533610b5af305816aef5434b884c3065b06f94` | Claude Code |
| Independent Claude re-review of this correction head | Required; not started in this report | Claude Code after exact-head CI |
| Exact-head `pull_request` Classify + full Heavy + CI Gate on the **live correction PR head that contains this report** | Required evidence; IDs not invented here | Cursor B / GitHub Actions |
| Live refund-bearing-order ratio | UNVERIFIED (no store call) | Later authorized measurement; not a B/C start blocker per brief |
| Bulk B LIST/Node ineligibility | Confirmed locally against generated 2026-07 schema; not a live Shopify bulk submit | Recorded; production disabled |
| PR6-C apply | Not implemented on this branch; C's separately authorized lane is in correction | Cursor C |
| PR6-D runtime | Not started | Separate later authorization |
| R-176 | OPEN / P0 (A representability satisfied; C/D window apply remaining) | PR6-C / PR6-D |
| R-164 | OPEN / P3 unchanged | Canonical applicator / later maintenance |
| C F-11 at-sale first-insert source limitation | Residual; not a codegen license | C / D |
| Per-row `withCodeDiscounts` argument provenance | Not a separate stored column in B | D residual |

Superseded failed exact-head run on `3031119…`: [`34650235398`](https://github.com/Vedang1998/Stocky/actions/runs/34650235398). Pre-correction SUCCESS run [`34651155935`](https://github.com/Vedang1998/Stocky/actions/runs/34651155935) on `d9717f68…` is **baseline only**. Do not treat either as this correction head.

---

## 15. Decisions needed

None that block recording this module. Remaining product questions Q-012…Q-016 stay later-metric / Partner timing and do not change B’s read contract.

ChatGPT still owns acceptance. The user alone authorizes merge. This PR stays **DRAFT / UNMERGED**.

---

## 16. Claude review handoff

Verify the **live PR #39 head** that contains this file (review artifact `59f469a…` plus correction commits), not only `748b84f…`, not `d9717f68…`, and not the superseded `3031119…` CI failure.

Please verify:

1. Exclusive tree is `app/lib/order-facts/admin-read/**` plus this report, the execution-brief addendum, and mechanical `PR2_TENANT_ACCESS_INVENTORY.md`. A types/schema/locks, C apply, D webhooks, Shopify config, and package/CI configs were not edited. The immutable review file was not edited.
2. QUERY-only AST gate; no bulk submit; no `currentBulkOperation` exception.
3. Two bulk gates; fragment/operation-scoped bulk-rule validator; Bulk A/B/C disposition table; T53 uses the bulk-rule validator.
4. Complete pagination (T19 300 lines + version recheck; T56 refund continuations; T57 never truncated-complete).
5. T20 does **not** flag `Refund.transactions`.
6. T41 explicit null is `null_observed`, not `INACCESSIBLE_HISTORY_WINDOW`, and not a tombstone.
7. Money: exact strings; Number rejected; A bag tables imported not copied. No B decimal-money parsing/normalization.
8. Tenant: `denyConflictingClientShop` only; conflicting header never reaches Admin.
9. F-01…F-11 tests mapped in §18 actually assert (not name-only). Exact-head CI IDs in the PR body match the live head.
10. No production/store call claimed.

---

## 17. Explicit stop statement

PR6-D runtime was **not** started. Production, merchant data, deployment, Shopify writes, inventory writes, scope additions, and flag enablement remain **NOT AUTHORIZED**. No D-055. B cannot implement C on this branch; C's separately authorized lane is in correction and must continue from **M**, not from this runtime branch. This PR remains **OPEN / DRAFT / UNMERGED** until ChatGPT acceptance and explicit user merge authorization.

---

## 18. F-CLAUDE-PR6B-01…11 disposition (original severities unchanged)

ChatGPT accepted **CORRECTIONS REQUIRED** (P0=0 / P1=2 / P2=4 / P3=5) and authorized this package. Neither B nor C is accepted for merge.

| ID | Sev | Disposition | Tests (exported production behavior) |
|---|---|---|---|
| F-01 | P1 | Required `Order.refunds` no longer fabricates `[]`. Genuine `[]` complete. Absent/null/object/scalar/null-entry/duplicate/empty GID fail closed. Refund-line qty is not a unit ledger. | `correction.test.ts` F-01; empty-array complete; identity cases |
| F-02 | P1 | Per-resource Clock A pin; Order first-page header; sales page `updatedAt`+`currencyCode`; bounded version recheck counted in budget. No `lineItems.length` vs unit-sum comparison. One line quantity 10 is a positive control. | `correction.test.ts` F-02/F-03; `orders.test.ts` T19 (4 calls) |
| F-03 | P2 | Empty promised continuation, duplicate cursor, disappearance after presence, and shrinking/last-header hybrid fail as `SNAPSHOT_PAGINATION_INCOMPLETE`. Refund pin from first page. Independent newer Refund clock allowed. | `correction.test.ts` empty continuation, refund first-vs-last pin, truncated-embed null |
| F-04 | P2 | Envelope variants: missing data / `data:null` / missing root / malformed root / malformed errors → `MALFORMED_ENVELOPE`. GraphQL errors remain `ADMIN_READ_ERROR`. | `correction.test.ts` F-04/F-05 |
| F-05 | P2 | `null_observed` only for initial explicit null. Continuation null / truncated-embed first `RefundFactById` null → incomplete. Structured `resourceKind` / `requestedGid` / `phase` / `reason`. T41 kept. Production modules must not contain `INACCESSIBLE_HISTORY_WINDOW`. | `orders.test.ts` T41; `static-safety.test.ts`; nested paging null |
| F-06 | P2 | Operation-scoped fragment-aware bulk gate. Hidden `nodes`, inline-root `node`, hidden depth-3, dead fragments, multi-op, alias Bulk A, reused spreads, invalid fragment parent, undefined spread, cycle, unknown field. | `bulk-query-schema.test.ts` F-06 |
| F-07 | P3 | `restocked` + `location { id }` → `restocked` / `restockLocationId` on tagged queries, bulk B candidate, embed and standalone. Not sale-location authority. | `documents.test.ts`; `correction.test.ts` F-07/F-08; `orders.test.ts` refund reader |
| F-08 | P3 | `refundLineOrdinal` zero-based across the complete paginated connection; null IDs kept distinct; no per-page reset. No A schema change. | `correction.test.ts` F-07/F-08 |
| F-09 | P3 | `pageSize` / `maxRequests` validated before transport; invalid options → zero Admin calls. pageSize ≤ 250; maxRequests ≤ 250. | `correction.test.ts` F-09/F-10; refund reader options |
| F-10 | P3 | LineItem counts nonnegative GraphQL Int. Sale.quantity signed+nullable. No `abs()`. No B money-decimal parsing. | `correction.test.ts`; `decimal.test.ts` |
| F-11 | P3 | PR #39 metadata: B cannot implement C here; C is in correction, not globally unauthorized. D/production/write restrictions preserved. No standalone metadata commit. | PR body (this correction push) |

**Typed null/envelope contract:** `complete` \| `incomplete` (`SNAPSHOT_PAGINATION_INCOMPLETE`) \| `failure` (typed kind) \| `null_observed` (initial explicit null only). D must use `status` / `kind` / `reason` / `phase` / `resourceKind` / `requestedGid`, not English `detail`.

**Version/completeness:** first-page Order pin (`gid`+`updatedAt`+`currencyCode`); first-page Refund pin (`gid`+`updatedAt`); sales pages re-check Order pin; continuation empty/null/drift → incomplete; version recheck after multi-request walks.

**Bulk adversarial matrix:** fragment-hidden root `nodes` FAIL; inline-root `node` FAIL; fragment depth-3 FAIL; dead fragments ignored; reused fragment counted per spread (2× `lineItems`); invalid Order fragment on DraftOrder unresolved; undefined spread FAIL; cycle FAIL; unknown field FAIL; multi-op FAIL; aliased Bulk A PASS.

**Field/ordinal compatibility:** `restocked` / `restockLocationId` / `refundLineOrdinal` now flow from B; C consumes. Embedded omitted `order.id` uses enclosing Order GID; contradictory parent GID fails; standalone unknown parent stays `null`.
