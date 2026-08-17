# Phase 1 PR5-F2A — Canonical Shopify Admin Read Boundary

**Status:** Implementation complete — pending independent verification
**Slice:** PR5-F2A Shopify Admin READ boundary
**Branch:** `cursor/pr5-f2a-admin-read-3ff2`
**Authority:** D-054 **EFFECTIVE**. PR5-F1 ACCEPTED / MERGED / FROZEN. No D-055.
**Production:** NOT AUTHORIZED
**Merchant production data:** NOT AUTHORIZED
**Shopify inventory mutations:** NOT AUTHORIZED
**Inventory-write flags:** DEFAULT OFF
**FEATURE_COST_SYNC:** DEFAULT OFF (not enabled)

This report records the PR5-F2A admin-read implementation. It does **not** claim PR 5 is complete. It does **not** start F3 / applicator / JSONL / webhook / projection work.

---

## 1. Identities

| Field | Value |
|---|---|
| Exact authorized base / `origin/main` | `5129707ee684e66cadcf96b976e16eb57385a7cb` |
| Runtime/test implementation head | `56039fb91a6586976c1a64b5c78d588195546fbf` |
| Working tree before start | clean on `main` at the authorized base |
| API target | Shopify Admin GraphQL **2026-07** (`ApiVersion.July26`); not bumped |

The documentation commit that adds this file is a later commit on the same branch. Live PR head is recorded after push / PR open. Do **not** treat this report as independent review.

---

## 2. Scope implemented

Isolated read-only canonical Shopify boundary under:

`stocky-plus/app/lib/catalog-facts/admin-read/**`

This lane owns Shopify **read/query** mechanics only.

It does **not**:

- apply canonical facts;
- write `CatalogObservationInFlight`;
- ingest JSONL;
- implement workers or SyncRun checkpoint writers;
- integrate webhooks;
- project compatibility caches;
- run forecasting/ABC;
- issue Shopify mutations;
- enable inventory-write flags;
- change Prisma schema or migrations;
- start PR 6.

Legacy `shopify-gql.server.ts` / `shopify-sync.server.ts` were **not** edited. The new boundary does not import write helpers (`adjustShopifyInventory`, transfer writers, billing mutations, `bulkOperationRunQuery`).

`graphql` `^16.14.2` was added as a direct dependency solely for graphql-js AST parse/visit (R-138). It is not a Shopify Admin client.

---

## 3. Read-boundary architecture

```text
admin-read/
  documents.ts              tagged Admin QUERY documents (#graphql, codegen)
  bulk-query-documents.ts   bulk inner QUERY shapes (not tagged; no first:)
  execute.ts                AST-inspect then Admin graphql()
  locations.ts              complete cursor pagination
  resources.ts              Product / Variant / InventoryItem / Location / InventoryLevel
  quantities.ts             eight approved quantity names + nullable updatedAt
  unit-cost-preflight.ts    cheap non-bulk unitCost probe + bulk shape choice
  bulk-operation.ts         BulkOperation GID contract + bulkOperation(id:)
  safety/graphql-ast.ts     deny-by-default operation-type inspection
  safety/production-modules.ts  recursive production .ts enumeration
  safety/scan.ts            TS compiler extraction + GraphQL AST scan
```

`catalog-facts/index.ts` does **not** re-export admin-read (foundation barrel stays lock/sequence primitives).

Execute path: `assertCanonicalReadDocument(document)` (graphql-js `parse` + `visit`) **before** `admin.graphql`. A mutation never reaches the Shopify client from this module.

InventoryLevel identity remains `(shopId, inventoryItemGid, locationGid)` in the typed pair; Shopify level GID is lineage/reference only.

---

## 4. Changed files

Runtime:

- `stocky-plus/app/lib/catalog-facts/admin-read/**` (new)
- `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` (recursive scan + AST gate)
- `stocky-plus/package.json` / `stocky-plus/package-lock.json` (`graphql` direct dependency)

Documentation:

- `stocky-plus/docs/phases/phase-1/PR5_F2A_ADMIN_READ_IMPLEMENTATION_REPORT.md` (this file)

No `prisma/schema.prisma` change. No migration. No `.env`. No production/merchant data.

---

## 5. Pagination evidence (R-136)

Command:

```text
npx vitest run app/lib/catalog-facts --reporter=verbose
```

Observed: **10 files, 48 tests passed**, including:

- `exhausts cursors for more than 50 locations with no duplicates or omissions` — 55 locations, page size 50, two pages, first/last GIDs `Location/1` and `Location/55`, second `after` cursor is page-1 end;
- duplicate `endCursor` fails closed (`LocationPaginationError`);
- `hasNextPage` without `endCursor` fails closed;
- empty page with `hasNextPage` fails closed (missing page);
- duplicate location GIDs across pages fail closed.

Current `fetchLocations` `first: 50` in `shopify-gql.server.ts` is **unchanged** (legacy). Canonical complete pagination lives only in admin-read.

---

## 6. Inventory quantity evidence

Positive: all eight approved names (`available`, `on_hand`, `incoming`, `committed`, `reserved`, `damaged`, `safety_stock`, `quality_control`) mapped from a pair read.

Nullable `InventoryQuantity.updatedAt`: `available` has a timestamp; the other seven remain `null`.

Negative: unknown future name recorded in `unexpectedNames` without dropping the eight.

Bypass/partial: missing `on_hand` is listed in `missingApprovedNames`; `available` is not substituted.

The pair helper sends `quantityNames` equal to the eight-name list.

---

## 7. unitCost evidence (R-132)

Cheap non-bulk query `CatalogFactUnitCostPreflight` (`inventoryItem { id unitCost { amount currencyCode } }`).

| Case | Decision | Access | Bulk shape |
|---|---|---|---|
| allowed + `"19.99"` | `ALLOWED` | `PRESENT` | `with-unitCost` |
| allowed + `null` | `ALLOWED` | `NULL` | `with-unitCost` |
| `ACCESS_DENIED` on `unitCost` | `DENIED` | `OMITTED_NO_PERMISSION` | `no-unitCost` |
| other GraphQL error | `UNAVAILABLE` | `QUERY_ERROR_ISOLATED` | `no-unitCost` |

Denied/unavailable does **not** throw out of `preflightUnitCostCapability` (catalog read pipeline continues). `FEATURE_COST_SYNC` observed `false`. No cost mutation.

Amounts remain decimal **strings** (`"19.99"`, `"0.1"`). No `Number` / `parseFloat` on Money / unitCost.

---

## 8. BulkOperation evidence (R-134)

- GID contract: `gid://shopify/BulkOperation/…` persist/consume; non-BulkOperation GIDs throw.
- Poll query is `query CatalogFactBulkOperation($id: ID!) { bulkOperation(id: $id) { … } }`.
- `currentBulkOperation` is rejected by GraphQL **field AST** (`CanonicalReadForbiddenFieldError`), not a substring allowlist.
- `canonicalSuccessEligible` is true only for `COMPLETED` + `url` + `partialDataUrl == null`.
- `COMPLETED` with only `partialDataUrl`, and `FAILED` + `partialDataUrl`, are **not** canonical success.
- No JSONL download. No worker. No checkpoint writer.

---

## 9. Mutation-safety evidence (R-138)

Correctness boundary: graphql-js `parse` + `OperationDefinition.operation !== "query"` → reject. No hand-maintained mutation-name list. No raw substring matching for the reject decision.

Falsification fixture (Race AC): plant official 2026-07 `inventoryBulkToggleActivation` mutation in a **nested** production module path `admin-read/safety/__planted_mutation__.ts` (temp tree). Scanner reports `mutation_rejected` including that field name. The live tree is not left planted.

`executeAdminReadQuery` rejects that mutation **before** `admin.graphql` (`calls === []`).

QUERY documents whose field names use `inventoryItem` / `product` prefixes are permitted.

---

## 10. Recursive-scan evidence (R-163)

`listProductionTypeScriptModulesRecursive` walks subdirectories. Observed production paths include:

- `admin-read/safety/scan.ts`
- `admin-read/safety/graphql-ast.ts`

A non-recursive `readdirSync` of `catalog-facts/` would miss these nested modules. Foundation safety now asserts nested `admin-read/safety` files are enumerated and runs `assertCatalogFactsReadBoundarySafe`.

---

## 11. GraphQL / codegen evidence

API version remains **2026-07**.

Valid documents:

```text
npm run graphql-codegen
```

Observed **exit 0** (schema load + document generate against Admin 2026-07). Generated files remain gitignored.

Deliberately invalid document (temporary `#graphql` query `shop { thisFieldDoesNotExistOnShop2026 }`):

```text
npm run graphql-codegen
```

Observed **exit 1**:

`Cannot query field "thisFieldDoesNotExistOnShop2026" on type "Shop".`

Probe file removed; valid codegen re-run **exit 0**.

Invalid syntax `query {` fails `assertCanonicalReadDocument` with `CanonicalReadGraphQLSyntaxError`.

---

## 12. Tests

Focused catalog-facts suite (runtime head `56039fb9…`):

```text
npx vitest run app/lib/catalog-facts
```

**10 files, 48 tests passed**, exit 0.

Lint of the new tree:

```text
npx eslint app/lib/catalog-facts/admin-read app/lib/catalog-facts/foundation-safety.test.ts
```

exit 0.

Typecheck:

```text
npx tsc --noEmit
```

exit 0 after `react-router typegen` (full `npm run typecheck` also used during development).

`git diff --check` on the working tree: clean.

Full `npm test` / `npm run lint` / `npm run build` / exact-head PR CI: recorded after push in the live PR / a follow-up note in this report if a later docs commit is required. This file does not claim CI green until the exact-head run is observed.

---

## 13. Risks

This lane **implements** the admin-read controls named in the authorization. ChatGPT / independent review close risks. Do **not** mark them CLOSED here.

| Risk | This lane |
|---|---|
| R-132 | unitCost non-bulk preflight + with/without bulk shapes. Still OPEN until independently reviewed and later catalog submit uses the chooser. |
| R-134 | `bulkOperation(id:)` + GID contract; `currentBulkOperation` AST-forbidden. Still OPEN until independently reviewed; worker submit is later. |
| R-136 | Complete location pagination with >50 proof. Legacy `fetchLocations` first:50 remains for non-canonical paths. Still OPEN until independently reviewed. |
| R-138 | Deny-by-default GraphQL AST mutation rejection + planted `inventoryBulkToggleActivation`. Still OPEN until independently reviewed. |
| R-163 | Recursive production-module enumeration + nested planted mutation. Still OPEN until independently reviewed. |

Other PR 5 risks (R-157..R-162, R-164, applicator, JSONL, webhooks) are **out of this lane**.

---

## 14. Confirmations

- **No Shopify mutation** is issued by this lane. Mutation documents are rejected before the Admin client is called. `bulkOperationRunQuery` is not present.
- **Production is unauthorized.** No production access, no merchant production data, no deployment, no inventory-write flag enablement, no `FEATURE_COST_SYNC` enablement.
- **No D-055.** D-054 remains the implementation authority.
- **No F3 / PR 6.**

---

## 15. Next action

Return to ChatGPT for PR5-F2A review after exact-head full PR CI is green.

Do **not** merge. Do **not** mark ready. Do **not** start F3.
