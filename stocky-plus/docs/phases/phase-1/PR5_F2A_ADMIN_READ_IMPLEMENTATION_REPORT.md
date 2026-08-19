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
| Draft PR | https://github.com/Vedang1998/Stocky/pull/29 (draft, targeting `main`) |
| Working tree before start | clean on `main` at the authorized base |
| API target | Shopify Admin GraphQL **2026-07** (`ApiVersion.July26`); not bumped |

Live PR head is the latest commit on `cursor/pr5-f2a-admin-read-3ff2`. Do **not** treat this report as independent review.

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

Required shared-file refresh (CI gate, not product behavior):

- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`

Exact-head run `32079298106` failed at `tenant:enforcement:preflight` with `tenant:access:inventory:check_failed_exit_1`. Cause: 22 new `app/lib/catalog-facts/admin-read/**` TypeScript files raised the scanner's `scannedFiles` count from 258 to 280. Findings remained 1408, violations remained 0, content digest remained `4670755fc5d481b42efd04705d4e26fc60b2cf20a06197ebb5cb2e24979e2ba5`. Regenerated with `npm run tenant:access:inventory`. No Prisma/schema change. No new tenant-access exceptions. No merchant-access findings in admin-read.

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

Full local suite on runtime head `0a6cb39a9712d159e74a363624399aa474951ea0` (also the previous live PR head):

| Command | Exit | Observed |
|---|---|---|
| `npm run lint` | 0 | eslint cache run of the app |
| `npm run typecheck` | 0 | `react-router typegen && tsc --noEmit` |
| `npx vitest run app/lib/catalog-facts --reporter=verbose` | 0 | **10 files, 48 tests passed** |
| `npm test` | 0 | **16 files, 104 tests passed** |
| `npm run build` | 0 | client + SSR production build |
| `npm run graphql-codegen` | 0 | Admin **2026-07** schema load + document generate |
| `git diff --check` | 0 | clean |

Exact-head automatic PR CI:

| Run | Head | Event | Result |
|---|---|---|---|
| `32079298106` | `0a6cb39a9712d159e74a363624399aa474951ea0` | `pull_request` | **FAILURE (superseded)** — classify SUCCESS, `full_ci=true`, `docs_only=false`; validate failed at Tenant enforcement preflight (`tenant:access:inventory:check_failed_exit_1`); CI Gate FAIL |
| successor run | live PR head after inventory refresh | `pull_request` | pending observation; this file does not claim CI green until that exact-head run is observed |

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

---

## 16. Independent review and correction package

**Correction status:** Correction implemented — pending independent verification

This section is appended after the immutable Claude review. It does **not** rewrite the history above. It does **not** close R-132, R-134, R-136, R-138, or R-163. It does **not** claim ChatGPT acceptance.

| Field | Value |
|---|---|
| Independent review artifact | `stocky-plus/docs/phases/phase-1/PR5_F2A_ADMIN_READ_INDEPENDENT_REVIEW.md` (**not edited**) |
| Review commit | `a831b5f78529fd1d9d7a12ed119efc97bb4dd04f` |
| Review blob | `81bc0678ea9041b6567c02c8fe5655752fc53441` (re-hashed after correction; unchanged) |
| Reviewed implementation head | `8329ae7936a489203faef12347bc1a4290df2d5b` |
| Review-artifact / live PR head at correction start | `a831b5f78529fd1d9d7a12ed119efc97bb4dd04f` |
| Authorized base | `5129707ee684e66cadcf96b976e16eb57385a7cb` |
| Independent verdict | `CORRECTIONS REQUIRED` — P0 0 / P1 1 / P2 2 / P3 5 |
| Post-review exact-head CI | run `32093188541`, event `pull_request`, head `a831b5f7…`, SUCCESS (historical; superseded by this correction head) |
| PR #29 | remains OPEN / DRAFT / UNMERGED |

### Reproduction of NEW-CLAUDE-PR5F2A-01 before correction

Against committed Admin 2026-07 introspection (`app/types/admin-2026-07.schema.json`, 6,978,270 bytes) using graphql-js `validate` on the pre-correction constants:

| Constant | Observed |
|---|---|
| `CATALOG_BULK_QUERY_WITH_UNIT_COST` | **13 errors**, all `Cannot query field "<x>" on type "ProductConnection"` |
| `CATALOG_BULK_QUERY_NO_UNIT_COST` | **13 errors**, same class |
| `INVENTORY_LEVEL_BULK_QUERY` | **2 errors**: `Cannot query field "id" on type "InventoryItemConnection"`; `Cannot query field "inventoryLevels" on type "InventoryItemConnection"` |

This matches the independent review.

### Schema-gate distinction (required by NEW-CLAUDE-PR5F2A-02)

1. **`#graphql` / graphql-codegen.** Tagged Admin QUERY documents in `documents.ts` remain the codegen path. `npm run graphql-codegen` exit 0 is evidence for those tagged documents only. Bulk inner query strings stay untagged.
2. **Untagged bulk inner queries.** `CANONICAL_BULK_QUERY_DOCUMENTS` are validated by graphql-js `validate` against Admin 2026-07 in `bulk-query-schema.ts` / `bulk-query-schema.test.ts`, with Shopify bulk pagination arguments (`first` / `after` / `last` / `before`) treated as optional. This is real schema validation, not field-name counting. Heavy `npm test` executes this gate. `.github/workflows/ci.yml` was not changed.

---

## 17. Finding-by-finding correction

### NEW-CLAUDE-PR5F2A-01 — P1 — invalid bulk documents

**Correction:** All three inner bulk queries now traverse connections with `edges { node { … } }`. Approved catalog fields, with-unitCost vs no-unitCost, and all eight quantity names are preserved. `INVENTORY_LEVEL_BULK_QUERY` now selects authoritative `item { id }` (plus existing `location { id }`) so inventory-level identity does not depend on JSONL `__parentId`. Official bulk limits remain 3 catalog connections / depth 2 and 2 inventory-level connections / depth 2. The comment that claimed `first` had to be omitted for schema validation was corrected: official bulk guidance treats `first` as optional and ignored; these documents omit it because bulk operations ignore pagination arguments, not because schema validation forbids it.

**Tests:** `bulk-query-schema.test.ts` (schema-valid + invalid fixture); `documents.test.ts` connection-count/depth (renamed so it does not claim schema validation).

**Disposition:** Corrected in this pass. Pending independent re-review.

**Residue / ChatGPT disposition:** Approved brief §8.2 still uses shorthand `products { variants { … } collections { id title } }` without `edges { node }`. That shorthand is **not executable Admin 2026-07**. This implementation did **not** edit the approved brief. Request an erratum if ChatGPT wants §8.2 to show the executable traversal. F2B should consume `item { id }` / `location { id }` from the inventory-level bulk JSONL and must not treat `__parentId` as the sole identity.

### NEW-CLAUDE-PR5F2A-02 — P2 — bulk schema gate missing

**Correction:** Dedicated graphql-js schema gate over `CANONICAL_BULK_QUERY_DOCUMENTS` plus a deliberately invalid missing-traversal fixture that must fail. Connection-count/depth tests retained under a title that claims only what they prove.

**Tests:** `bulk-query-schema.test.ts`; renamed `documents.test.ts` depth/count test.

**Disposition:** Corrected in this pass. Pending independent re-review.

**Residue:** None for this lane. Codegen still does not cover untagged bulk strings; the new test does.

### NEW-CLAUDE-PR5F2A-03 — P2 — collection pagination fail-open

**Correction:** Shared `paginateCursorConnection` primitive used by `readAllLocations` and `readProductCollectionMemberships`. Missing connection, empty page + `hasNextPage`, null edge, id-less node, repeated `endCursor`, `hasNextPage` without `endCursor`, duplicate GID, and explicit page bound all fail closed. 251 memberships / page size 250 exhaust two pages.

**Tests:** `collections.test.ts` ( >250 + every malformed-page shape); existing `locations.test.ts` >50 regression.

**Disposition:** Corrected in this pass. Pending independent re-review.

**Residue:** None.

### NEW-CLAUDE-PR5F2A-04 — P3 — malformed quantity disappears

**Correction:** Name classification precedes quantity validation. Unexpected names always enter `unexpectedNames`. Malformed quantities enter non-persisted `malformedQuantityNames`. A malformed approved name is not listed as genuinely absent.

**Tests:** unexpected+malformed; approved+malformed vs absent; eight valid names unchanged.

**Disposition:** Corrected in this pass. Pending independent re-review.

**Residue:** `malformedQuantityNames` is a read-boundary diagnostic, not a persisted canonical enum.

### NEW-CLAUDE-PR5F2A-05 — P3 — silent type coercion

**Correction:** `optionalFiniteNumber` for `Weight.value` (`Float!`); `optionalBoolean` for `isActive`. String `"false"` no longer becomes `true`. Invalid weight no longer becomes `NaN`. Exact money / unsigned ID protections unchanged.

**Tests:** non-finite weight; `isActive: "false"`; unsigned `legacyResourceId` `"9007199254740993"`; variant money strings.

**Disposition:** Corrected in this pass. Pending independent re-review.

**Residue:** None.

### NEW-CLAUDE-PR5F2A-06 — P3 — inventory-level pair cross-check

**Correction:** `readInventoryLevelByPair` fails closed with `InventoryLevelIdentityMismatchError` when Shopify returns an item and/or location GID that differs from the requested pair. Missing response identity still uses the approved fallback.

**Tests:** exact match; item mismatch; location mismatch; both mismatch; omitted response identity fallback.

**Disposition:** Corrected in this pass. Pending independent re-review.

**Residue / F2B invariant:** Downstream F2B/bulk callers must not key results by the requested pair unless this cross-check has succeeded. Do not replace the requested pair with response IDs and continue. This PR does not modify F2B.

### NEW-CLAUDE-PR5F2A-07 — P3 — scanner extraction blind spots

**Correction:** Compiler-API visitor now inspects `TemplateExpression`. GraphQL-shaped interpolations fail closed as `unreviewable_graphql`. Leading GraphQL `#` comment lines are stripped before document detection. Import denial is rule-derived deny-by-default: `@shopify/*`, `app/services/**` / `/services/` paths, and Shopify write helper modules (`shopify-sync.server`, `shopify-gql.server`, `shopify.server`). Exact reviewed exception list is empty. Recursive nested-file coverage preserved.

**Tests:** interpolated mutation; comment-prefixed mutation; `inventory-write.server` import not on the old two-name list; `@shopify/shopify-api` import; valid nested QUERY still passes; planted `inventoryBulkToggleActivation`; `productVariantsBulkUpdate` pre-network rejection.

**Disposition:** Corrected in this pass. Pending independent re-review.

**Residue:** None approved `@shopify/*` exceptions exist in this lane.

### NEW-CLAUDE-PR5F2A-08 — P3 — unitCost preflight classification

**Correction:** `DENIED` requires `extensions.code === "ACCESS_DENIED"` **and** a GraphQL path whose last segment is `unitCost`. Path-less messages mentioning `unitCost` are not `DENIED`. Non-persisted `failureKind` is `GRAPHQL` / `TRANSPORT` / `MAPPING_INTEGRITY`. Approved `unitCostAccess` contract is unchanged. Permission denial still does not abort the catalog pipeline.

**Tests:** structured ACCESS_DENIED on unitCost → DENIED; path-less access-denied message → not DENIED; unrelated ACCESS_DENIED path → not unitCost DENIED; unrelated GraphQL error; network TRANSPORT; numeric amount MAPPING_INTEGRITY; allowed+value; allowed+null.

**Disposition:** Corrected in this pass. Pending independent re-review.

**Residue:** `failureKind` is not a persisted canonical enum.

---

## 18. Correction evidence (local)

Focused catalog-facts suite after correction:

```text
npx vitest run app/lib/catalog-facts --reporter=verbose
```

**12 files, 78 tests passed**, including bulk schema gate, >250 collection traversal, collection malformed pages, quantity diagnostics, mapper strict types, pair identity, scanner falsifications, structured unitCost denial, location >50, eight quantities, nullable `updatedAt`, money/unsigned ID, `bulkOperation(id:)`, and `partialDataUrl`.

Required local commands on the correction working tree (pre-commit):

| Command | Exit | Observed |
|---|---|---|
| `npm run lint` | 0 | eslint of the app |
| `npm run typecheck` | 0 | `react-router typegen && tsc --noEmit` |
| `npm test` | 0 | **18 files, 134 tests passed** (was 16 / 104 on the reviewed head) |
| `npm run build` | 0 | client + SSR production build |
| `npm run graphql-codegen` | 0 | tagged Admin **2026-07** documents; does **not** cover untagged bulk strings |
| focused graphql-js `validate` of the three bulk constants | 0 errors | against `app/types/admin-2026-07.schema.json` |
| invalid bulk fixture | rejected | `Cannot query field "id" on type "ProductConnection"` |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 284`, `findings: 1408`, `violations: 0` |
| `npm run tenant:access:inventory` | 0 | regenerated; content digest still `4670755f…` |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| `git diff --check` | 0 | clean |

Exact-head automatic PR CI for this correction head is recorded after push. This file does not claim that CI green until that run is observed.

`.github/workflows/ci.yml` was **not** modified. The bulk schema test runs inside Heavy `npm test`.

---

## 19. Preserved review-proven behavior

Not regressed in this correction:

- R-132 non-abort unitCost preflight (DENIED/UNAVAILABLE still choose `no-unitCost` and do not throw)
- R-134 `bulkOperation(id:)` + `currentBulkOperation` AST forbid
- R-136 location pagination >50 fail-closed
- R-138 pre-network AST query-only enforcement (including unexpected `productVariantsBulkUpdate`)
- R-163 recursive directory traversal
- `partialDataUrl` is not canonical success
- no `currentBulkOperation`
- no `bulkOperationRunQuery` submission
- all eight approved inventory quantity names
- nullable `InventoryQuantity.updatedAt`
- exact decimal money strings
- unsigned ID strings beyond JS safe integer
- per-item unitCost currency provenance
- API target 2026-07
- `FEATURE_COST_SYNC` DEFAULT OFF
- inventory-write flags DEFAULT OFF
- no Shopify mutations
- no canonical/database writes

---

## 20. Risks after correction

Do **not** mark any risk CLOSED. They remain pending independent correction re-review / ChatGPT disposition.

| Risk | After this correction |
|---|---|
| R-132 | Preflight still non-aborting; DENIED now requires structured GraphQL evidence. Still OPEN. |
| R-134 | Unchanged `bulkOperation(id:)` contract. Still OPEN. |
| R-136 | Location pagination preserved; collections now share the same fail-closed primitive. Still OPEN. |
| R-138 | AST deny-by-default preserved; scanner extraction/import denial strengthened. Still OPEN. |
| R-163 | Recursive enumeration preserved. Still OPEN. |

---

## 21. Next action after this correction

Return to ChatGPT / Claude independent **correction re-review** after exact-head full PR CI is green on the correction head.

Do **not** merge. Do **not** mark ready. Do **not** start F3. Do **not** create D-055.

---

## 22. Second correction package (NEW-CLAUDE-PR5F2A-C01 through C06)

**Correction status:** Correction implemented — pending independent verification

This section is appended after the immutable Claude correction re-review. It does **not** rewrite the history above. It does **not** edit either Claude review artifact. It does **not** close R-016, R-132, R-134, R-136, R-138, or R-163. It does **not** claim ChatGPT acceptance.

| Field | Value |
|---|---|
| Authorized base / `origin/main` | `5129707ee684e66cadcf96b976e16eb57385a7cb` |
| Previously reviewed corrected implementation head | `4c437ce95309fdcc97e02c299af57c46c5fafe6a` |
| Immutable first review | `PR5_F2A_ADMIN_READ_INDEPENDENT_REVIEW.md` blob `81bc0678ea9041b6567c02c8fe5655752fc53441` (**not edited**) |
| Immutable correction re-review | `PR5_F2A_ADMIN_READ_CORRECTION_INDEPENDENT_REVIEW.md` |
| Review commit cherry-picked | `f00315f31efe7ffe7dd0ae1a4672cdbf51df85e6` → branch commit `0e6972ce4062652317f20de6d6f6bb72e2beaaef` |
| Review artifact blob | `d06fc9f603b8ec86efc1493babaa3973a73d3806` (re-hashed after cherry-pick; unchanged) |
| Independent verdict | `CORRECTIONS REQUIRED` — P0 0 / P1 0 / P2 1 / P3 5 |
| Runtime/test commits | `7f12de4165df380d4ebd97f7f32be544625e428e`, `6bdcd364e490b2605af6069eb43f83d5b3bd3e88` |
| Inventory refresh | `67f891274503f251054a1242f9e77ea080943b41` |
| PR #29 | kept CLOSED / DRAFT / UNMERGED while these commits were pushed; reopened once after this report |

Language correction: the earlier reproduction in §16 described Admin 2026-07 introspection as a **committed** `app/types/admin-2026-07.schema.json`. That file is gitignored and is **materialized by `npm run graphql-codegen`**, not committed. This second package uses that generated local artifact and does not claim Shopify-network independence. **R-016 remains OPEN.**

### NEW-CLAUDE-PR5F2A-C01 — P2 — schema source and CI order

**Correction:** Heavy CI now runs the existing `npm run graphql-codegen` step **before** `npm test`. The step was moved, not duplicated. `loadGeneratedAdmin202607Schema()` reads only `app/types/admin-2026-07.schema.json`. Direct `fetch()` / shopify.dev proxy fallback is removed. Absence fails closed with an error that says the gate does not fetch shopify.dev. The schema-source assertion requires `source === "file"`.

**Tests:** `bulk-query-schema.test.ts` absent-artifact fail-closed; `source === "file"`; loader source contains no `fetch(`. Independent `tsx` probe: parking the generated file throws, `fetch` call count 0, then restore loads `source: "file"`.

**Disposition:** Corrected in this pass. Pending independent verification.

**Residue:** R-016 remains OPEN. Codegen still depends on shopify.dev. This package only removed the extra unit-test network path.

### NEW-CLAUDE-PR5F2A-C02 — P3 — specifiedRules

**Correction:** Removed `bulkRelaxedProvidedRequiredArgumentsRule` and the `first`/`after`/`last`/`before` name-scoped relaxation. `validateBulkQueryAgainstAdminSchema` uses stock graphql-js `specifiedRules`. Future bulk documents that select a field whose `first` is schema-required (`Int!`) must supply `first`.

**Tests:** `bulkQueryValidationRules === specifiedRules`; all three canonical documents have 0 errors under both the gate and direct `validate(..., specifiedRules)`; `{ shop { productTags { edges { node } } } }` still reports `first: Int!` required. Negative fixtures retained: collapsed traversal, missing `quantities(names:)`, bad field, mutation rejection.

**Disposition:** Corrected in this pass. Pending independent verification.

### NEW-CLAUDE-PR5F2A-C03 — P3 — pagination fail-closed

**Correction:** `paginateCursorConnection` rejects missing `pageInfo`, non-object `pageInfo`, non-boolean `hasNextPage` (no `Boolean()` coercion), invalid `endCursor` type, `hasNextPage=true` without a usable `endCursor`, empty page + `hasNextPage`, repeated cursor, duplicate GID, and the existing page bound.

**Tests:** missing `pageInfo` and malformed `hasNextPage` on both `readAllLocations` and `readProductCollectionMemberships`; locations also cover non-object `pageInfo` and non-string `endCursor`.

**Disposition:** Corrected in this pass. Pending independent verification.

### NEW-CLAUDE-PR5F2A-C04 — P3 — malformed quantity rows

**Correction:** A quantity row whose `name` is non-string, empty, null, or otherwise not a non-empty string is recorded in non-persisted `malformedRows` (`reason: "malformed_name"`, `observedNameKind`) and is **not** coerced into a fake name string. `unexpectedNames` / `malformedQuantityNames` / `missingApprovedNames` remain for valid string names. `updatedAt` uses `optionalIsoTimestamp`.

**Tests:** number / empty / null / object names produce `malformedRows` and empty name channels; numeric / object / `"not-a-date"` `updatedAt` throw.

**Disposition:** Corrected in this pass. Pending independent verification.

**Residue:** `malformedRows` is a read-boundary diagnostic, not a persisted canonical enum.

### NEW-CLAUDE-PR5F2A-C05 — P3 — scanner import and syntax

**Correction:** Forbidden-module inspection now covers `ImportDeclaration`, `ExportDeclaration` with a module specifier, dynamic `import(...)`, and statically resolvable `require(...)`. The import policy itself is unchanged. GraphQL-shaped static literals that fail `parse` become `syntax` findings. Bare tokens such as `"query"`, `"{"`, and `"#graphql"` are not treated as documents, so production scanner source does not false-positive. Interpolated templates remain `unreviewable_graphql`. Recursive directory scanning is preserved.

**Tests:** `export … from "@shopify/..."`, `import("@shopify/...")`, `app/services/...` import, `require("~/services/...")`, malformed mutation-shaped GraphQL → `syntax`, valid nested QUERY still allowed.

**Disposition:** Corrected in this pass. Pending independent verification.

### NEW-CLAUDE-PR5F2A-C06 — P3 — DateTime and returned IDs

**Correction:** `requireIsoTimestamp` / `optionalIsoTimestamp` validate Shopify DateTime / RFC3339 (calendar parts included) and return the original string unchanged. `readInventoryLevelById` and `readBulkOperationById` fail closed when the returned GID does not match the requested GID. The existing inventory-level pair identity check is unchanged.

**Tests:** valid Z / offset / fractional timestamps unchanged; `"not-a-date"`, date-only, invalid calendar day, non-strings throw; inventory-level by-id mismatch; bulkOperation by-id mismatch; malformed bulk `createdAt`.

**Disposition:** Corrected in this pass. Pending independent verification.

---

## 23. Second-correction local evidence

Focused catalog-facts suite after the second package:

```text
npx vitest run app/lib/catalog-facts --reporter=verbose
```

**13 files, 104 tests passed**, exit 0.

Required local commands (runtime/test state, generated schema present):

| Command | Exit | Observed |
|---|---|---|
| `npm run graphql-codegen` | 0 | tagged Admin **2026-07** documents + generated `app/types/admin-2026-07.schema.json` (gitignored) |
| `npm run lint` | 0 | eslint of the app |
| `npm run typecheck` | 0 | `react-router typegen && tsc --noEmit` |
| `npm test` | 0 | **19 files, 160 tests passed** |
| `npx vitest run app/lib/catalog-facts` | 0 | **13 files, 104 tests passed** |
| `npm run build` | 0 | client + SSR production build |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 285`, `findings: 1408`, `violations: 0` |
| `npm run tenant:access:inventory` | 0 | regenerated; `scannedFiles` 284 → 285; findings 1408; digest still `4670755f…` |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| `git diff --check` | 0 | clean |

Independent schema-gate proof (`tsx`, `fetch` wrapped): missing override path and parked generated file both throw `absent` / `does not fetch shopify.dev`; `fetch` call count **0**; restore loads `source: "file"`.

Independent specifiedRules proof (`tsx`): all three `CANONICAL_BULK_QUERY_DOCUMENTS` members have **0** errors under stock `specifiedRules` and under the gate; `productTags` without `first` reports `first: Int!` required on both.

Exact-head automatic `pull_request` CI is produced by reopening PR #29 after the final second-correction commit. This file is not rewritten after that run. CI identity is recorded on the PR body.

---

## 24. Shared-file scope for this second package

Changed relative to the previously reviewed head `4c437ce…`, besides `admin-read/**` and this report:

- `.github/workflows/ci.yml` — existing GraphQL codegen step moved before Unit tests; no second invocation; triggers / classifier / jobs / CI Gate / docs-only logic unchanged
- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` — scanner refresh only (`scannedFiles` 284 → 285)
- `stocky-plus/docs/phases/phase-1/PR5_F2A_ADMIN_READ_CORRECTION_INDEPENDENT_REVIEW.md` — cherry-picked immutable Claude artifact only

No Prisma schema, migration, F2B/F2C, JSONL, workers, webhooks, compatibility projection, Shopify mutation, or inventory-write flag change.

---

## 25. Preserved review-proven behavior (re-checked locally)

Not regressed in this second package:

- three executable bulk documents under stock `specifiedRules`
- all eight quantity names
- unitCost with/no-cost separation
- structured ACCESS_DENIED + unitCost path classification
- >50 location pagination
- >250 collection pagination
- `bulkOperation(id:)`, never `currentBulkOperation`
- `partialDataUrl` is not canonical success
- exact Decimal strings
- large `legacyResourceId` strings
- query/mutation AST check before Admin network call
- recursive production scanner
- `FEATURE_COST_SYNC` DEFAULT OFF
- no canonical writes
- no Shopify mutations

---

## 26. Risks after the second correction

Do **not** mark any risk CLOSED.

| Risk | After this second correction |
|---|---|
| R-016 | Still OPEN. Codegen still fetches Admin schema from shopify.dev. This package only removed the extra unit-test network fallback. |
| R-132 | Unchanged non-abort unitCost preflight. Still OPEN. |
| R-134 | Unchanged `bulkOperation(id:)` contract plus returned-GID mismatch. Still OPEN. |
| R-136 | Location pagination preserved; `pageInfo` now fail-closed. Still OPEN. |
| R-138 | AST deny-by-default preserved; export/dynamic-import/require/syntax scan strengthened. Still OPEN. |
| R-163 | Recursive enumeration preserved. Still OPEN. |

---

## 27. Next action after this second correction

Return to ChatGPT for **PR5-F2A second correction review** after exact-head automatic full PR CI is green.

Do **not** merge. Do **not** mark ready. Do **not** invoke Claude. Do **not** start F3. Do **not** create D-055.
