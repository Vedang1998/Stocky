# Phase 1 PR6-B / PR6-C — Execution Brief

**Status:** `PR6-B AND PR6-C COMPLETE-MODULE WORK AUTHORIZED AFTER ADMISSION`
**PR 6 overall:** `IN PROGRESS`
**Phase 1:** `IN PROGRESS`
**PR6-A:** `ACCEPTED / MERGED / CLOSED` (repository-foundation lane)
**PR6-D runtime:** `NOT AUTHORIZED`
**D-054:** EFFECTIVE — remains the implementation authority (**no D-055**)
**Monday 7 September 2026 target:** **missed** (not re-dated)

This is Cursor B's docs-only admission / shared-control record. It is **not** B runtime, **not** C runtime, **not** D runtime, and **not** an additional product-permission round. ChatGPT addendum [5639320213](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5639320213) and later dispositions [5639842776](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5639842776) / [5640040968](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5640040968) already resolve the listed clarifications.

C independently verifies **this exact control commit** and starts from **M**, never from B's runtime branch.

## Admission identities (independently verified)

| Field | Value |
|---|---|
| PR #37 | **CLOSED / MERGED** |
| Merged subject head | `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02` |
| Squash **M** | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` |
| **M** sole parent | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| `M^{tree}` | `9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc` |
| Current `origin/main` at this record | **M** |
| Correction review at **M** | `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` blob `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` — **`APPROVE PR6-A FOUNDATION CORRECTION`** |
| Original A review blob | `198e55548a2ca09942843798a9ebd3e03a30d0fa` |
| Exact-M push CI | run [`34642536795`](https://github.com/Vedang1998/Stocky/actions/runs/34642536795) **SUCCESS** |
| Classify | `103405479267` SUCCESS |
| Full Heavy | `103405514450` SUCCESS (not SKIPPED) |
| CI Gate | `103422700596` SUCCESS |

B branch: `phase-1/pr6-b-order-admin-read` created from **M**. This first push is docs-only. Feature-branch push does not run full CI (`CI_POLICY.md`).

## Ownership (exclusive)

| Lane | Owns | Does not own |
|---|---|---|
| **Cursor B** (this branch) | Shared control docs in this commit; later `app/lib/order-facts/admin-read/**` including tests/fixtures in that subtree; generated `app/types/**` only as required by codegen (do not force-add gitignored files); `PR6_B_ADMIN_READ_IMPLEMENTATION_REPORT.md` | A's `types.ts` / constants / locks / schema / Prisma migrations / tenant primitives; C `apply/**`; webhooks/workers/import; Shopify app config; package/CI/test-config; C's report |
| **Cursor C** | Order-domain apply module/tests/report only. Reads this control commit. Branches from **M**. | Shared control docs; B admin-read tree; D webhook/import files |
| **PR6-D** | Webhook/import/reconcile integration when separately authorized | Not started |

B is the **sole shared-control writer**. C must not edit the files in this control commit.

## Graph

PR6-A → (PR6-B ∥ PR6-C) → PR6-D.

D runtime, production, merchant data, Shopify writes, inventory writes, scope additions, and flag enablement remain **NOT AUTHORIZED**.

## ChatGPT addendum 5639320213 — required dispositions

### -01 / -09 (admission)

Resolved by this record: owner squash-merge, exact-M identities, and exact-M push Classify + full Heavy + CI Gate SUCCESS. Do not claim they were resolved before those events.

### -02 (D recovery; B pagination)

`sanitizeOrderProjection` >250-line quarantine remains a **D** acceptance obligation. B supplies **complete reader pagination** (T19 = 300 lines; no silent 250 cap). C supplies atomic apply. Do **not** raise sanitizer limits, infer Order ID from delivery ID, persist raw payload/PII, or truncate v1 arrays.

### -03 (test homes; no CI redesign)

- Default-discovered `app/lib/order-facts/**/*.test.ts` remain **pure unit / transport / mock**.
- C PostgreSQL suites: `scripts/tenant-enforcement/tests/pr6-c-*.test.ts` under existing serialized `vitest.migrations.config.ts`.
- D future DB suites: `pr6-d-*.test.ts` in the same directory.
- **B and C must not concurrently edit** global test configs or `.github` workflows.

### -04 (inaccessible-order / incomplete snapshot)

Never fabricate an Order, Agreement, or Sale from an inaccessible-order signal. Incomplete snapshot ≠ complete. Bounded fail-closed; no unbounded buffering. A complete independently fetched Refund snapshot may stand without a local Order under its own Clock A; an inaccessible refund signal is not such a snapshot.

### -05 (same-snapshot quantities)

`ordered_units` uses `LineItem.quantity` from the **same current complete post-edit snapshot** as the other quantities. B preserves Shopify's reported value. C does not synthesize a replacement by adding ledger events. Keep signed Sale `actionType` / context rules.

### -06 / -08 (D webhook files)

B/C **do not edit** webhook/worker/import files. No partial topic activation.

### -07 (samples)

An official sample is not blanket payload permission. Fail-closed identity parsing. No scope/config change.

### -10 (B-owned granted-scope QUERY)

B owns a minimal QUERY-only granted-scope read:

```graphql
currentAppInstallation { accessScopes { handle } }
```

Same trusted installed-app token/client as resource reads. Schema-validate the exact selection (including `AccessScope.handle`) against generated Admin 2026-07 schema. Synthetic transport tests and request-cost accounting. **No live merchant/store call.** Static TOML requested scopes, client-supplied arrays, and unknown/stale session data are **not** absence evidence. D orchestrates `app/scopes_update`. C consumes trusted scope evidence and denies absence if grant continuity is missing, stale, or downgraded. No A schema/types/privilege change.

## Bulk eligibility (C-05 — already B §17.2 / T53 work)

Schema validity ≠ Shopify bulk execution eligibility. Catalog `bulk-query-schema.ts` uses graphql-js `specifiedRules` only. **Do not modify frozen catalog runtime** merely to reuse that gate.

B must implement **two gates** on the order-facts admin-read tree:

1. graphql-js `specifiedRules` against the generated Admin 2026-07 schema artifact (local file; no shopify.dev fetch).
2. Shopify bulk-rule validator: must include a connection; ≤5 connections; ≤2 nested connection levels; connections must implement `Node`; no top-level `node`/`nodes`.

| Document | GraphQL schema | Bulk eligibility | Production path |
|---|---|---|---|
| Bulk A (orders + lines) | Valid | Two Node connections — treat **schema-legal** | Historical import shape; no `Order.cancellation`; must not depend on `priceAfterAllDiscountsBeforeTaxesSet` |
| Bulk B (refunds nested) | Valid under `specifiedRules` | **UNVERIFIED** (`refunds` is LIST; nested refund-line nodes do not implement Node) | **Disabled**. Costed fallback: per-order `order(id:)` / `RefundFactById` for refund-bearing orders |
| Bulk C (agreements/sales three-level / non-Node) | May be GraphQL-valid | **Illegal** | T53: reject via **bulk-rule validator**, not graphql-js `validate` alone |

No `bulkOperationRunQuery` / store submission / bulk mutation in B. Optional Bulk B execution is **not** permission to block B/C pending a store submission.

## Named QUERY documents (Admin API 2026-07)

All `#graphql` in `app/lib/order-facts/admin-read/documents.ts`. Codegen-validate. Identity: requested GID must equal returned `id` or fail closed.

- `OrderFactById` — paginate `lineItems` + `agreements` to completion; retain agreement edge cursors; first page only of sales and refund-child connections.
- `OrderAgreementSalesPage` — `$agreementAfter` = cursor immediately preceding the target agreement (`null` valid for first); walk `$saleAfter` to exhaustion. SalesAgreement is **not** a generic Node.
- `RefundFactById` — separate first/after pairs per connection; truncated embed ⇒ **no** partial refund snapshot.
- `ShopTimezoneCurrency` — `shop { id ianaTimezone currencyCode }`; **read only, do not persist**.
- `CurrentAppInstallationAccessScopes` — addendum -10.

Fragments: `OrderLineFactFields` as planned; `RefundLineFactFields` / `OrderAdjustmentFactFields` from A money bags + official 2026-07 fields (do not invent).

**Forbidden:** mutations; `currentBulkOperation`; `Order.cancellation` / PII listed in the plan; `Sale.lineItem` on the interface; `priceAfterAllDiscountsBeforeTaxesSet` as canonical money; pagination args on named LISTs; shared `$saleAfter` / refund-child `after` on `OrderFactById`; `Number`/`parseFloat`; FX; division-derived unit price; writing canonical facts or `SalesDailyAggregate`.

Tenant identity from trusted server context only (`denyConflictingClientShop` / `requireAdminTenant` — import, do not edit tenant).

B is **not** a canonical DB writer. Return complete snapshot **or** typed incomplete/failure. Never represent a truncated walk as complete. Preserve `SNAPSHOT_PAGINATION_INCOMPLETE`. Do not DML `OrderFactObservationInFlight` in production B modules.

`orderHistoryWindowDays = 60` is a plan named constant; A did not export it — define in B admin-read constants.

## D-readiness artifacts (preparation evidence, not product authority)

| Artifact | Commit | Blob |
|---|---|---|
| `PR6_D_INTEGRATION_READINESS_REVIEW.md` | `1820485df3bcb4df8c1245042e1ad6f757d7abeb` | `7e8bc701d94bd322b692629522063930ffa08f32` |
| `PR6_D_INTEGRATION_READINESS_CORRECTION.md` | `7a9cbec589b84008080ce1fa2e6bb6082686fa8d` | `81673034ab46ca6d40ebd26d16c0fe1248047e4a` |

Do **not** add either artifact to PR #37 or to this B branch. Original bytes must remain intact. C may consume the **corrected** preparation material (tombstone shapes, atomic receipts, same-snapshot quantities, absence evidence) subject to the owner dispositions. Where the original draft contradicted accepted A SQL, **A is correct**.

## B reader test matrix (minimum)

Map every B-owned plan §19 row. Positive + negative + bypass + drift/partial-failure. Include C-05 / T53 explicitly.

Minimum IDs: **T02, T19, T20, T30, T39, T48 reader boundary, T52, T53, T56, T57**, plus other applicable reader cases (T03 client shop header; T41 aged-out `order(id:)` null → typed inaccessible, not tombstone; T17/T18 raw evidence for C; all eight required-money groups).

T19 is **reader** pagination of 300 lines, not webhook projection. T20 must **not** flag legal `Refund.transactions` pagination. T52 = Sale without inline fragments fails codegen.

## Explicit non-authorization

- PR6-D runtime remains **NOT AUTHORIZED**.
- Production, merchant production data, deployment, Shopify writes, inventory writes, scope additions, and flag enablement remain **NOT AUTHORIZED**.
- No live store call is authorized by this brief.
- No D-055.
