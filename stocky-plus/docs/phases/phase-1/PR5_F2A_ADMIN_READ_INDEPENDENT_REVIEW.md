# Phase 1 PR5-F2A — Canonical Shopify Admin Read Boundary — Independent Review

**Verdict:** `CORRECTIONS REQUIRED`
**Reviewer:** Claude Code (independent, adversarial, Tier A)
**Review type:** Exact-head independent review of PR [#29](https://github.com/Vedang1998/Stocky/pull/29)
**PR state at review:** `OPEN` / `DRAFT` / `UNMERGED` — unchanged by this review
**Production:** `NOT AUTHORIZED`
**Shopify inventory mutations:** `NOT AUTHORIZED`
**Inventory-write flags:** `DEFAULT OFF` (verified)
**Finding counts:** P0 `0` / P1 `1` / P2 `2` / P3 `5`

This artifact is immutable. It does not modify implementation, runtime, test, schema, migration, or package files. It is not D-055, not PR5-F2A acceptance, and not authorization to start F3.

---

## 1. Identities

| Field | Value |
|---|---|
| Repository | `Vedang1998/Stocky` |
| PR | [#29](https://github.com/Vedang1998/Stocky/pull/29) — `OPEN` / `DRAFT` / `UNMERGED` / `mergeable_state: clean` |
| Branch | `cursor/pr5-f2a-admin-read-3ff2` |
| Declared base | `5129707ee684e66cadcf96b976e16eb57385a7cb` |
| **Verified base** | `5129707ee684e66cadcf96b976e16eb57385a7cb` — confirmed as `origin/main` **and** as `git merge-base origin/main pr29` |
| Declared implementation head | `8329ae7936a489203faef12347bc1a4290df2d5b` |
| **Verified reviewed head** | `8329ae7936a489203faef12347bc1a4290df2d5b` — `refs/pull/29/head` and `origin/cursor/pr5-f2a-admin-read-3ff2` both resolve to this SHA |
| Head moved during review | **NO** |
| Runtime/test sub-head | `56039fb91a6586976c1a64b5c78d588195546fbf` |
| Diff size | 27 files, +3179 / −19 |
| Authoritative exact-head CI | run [`32080341125`](https://github.com/Vedang1998/Stocky/actions/runs/32080341125), event `pull_request`, head `8329ae7936a489203faef12347bc1a4290df2d5b`, conclusion `success` |

The implementation head did **not** move. No moved-head report is required.

### Local reproduction environment

| Item | Value |
|---|---|
| Node | `v22.22.2` |
| npm | `11.5.2` (pinned per `packageManager`) |
| Install | `npm ci` exit 0 |
| Working tree at review | clean at `8329ae7…`; every probe artifact created during review was deleted and `git status --short` verified empty |

---

## 2. Changed-file / scope verdict — **PASS**

All 27 changed paths:

- 22 new files under `stocky-plus/app/lib/catalog-facts/admin-read/**`;
- `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` (modified);
- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` (regenerated);
- `stocky-plus/docs/phases/phase-1/PR5_F2A_ADMIN_READ_IMPLEMENTATION_REPORT.md` (new);
- `stocky-plus/package.json`, `stocky-plus/package-lock.json`.

Verified absent from the diff: `prisma/`, `migrations/`, `app/routes/`, `app/jobs/`, `app/services/`, webhook handlers, `.env`.

Verified absent from `admin-read/**` production source: `prisma`, database access, BullMQ/queue, `process.env`, webhook registration, compatibility projection, JSONL download, canonical fact writes, feature-flag enablement. `JSONL` appears only in comments asserting the lane does not download it, and in test fixture URLs.

`FEATURE_COST_SYNC` verified `DEFAULT OFF` at `app/lib/feature-flags.server.ts:24` (`envFlag("FEATURE_COST_SYNC")`, `defaultEnabled = false`). All five inventory-write flags remain OFF and are asserted by `foundation-safety.test.ts`.

No legacy Shopify write helper is imported. `grep -rn "@shopify" app/lib/catalog-facts/` returns nothing — the boundary uses the structural `CatalogAdminReadClient` interface (`types.ts:28`) rather than a Shopify SDK type. `shopify-sync.server.ts` and `shopify-gql.server.ts` are unmodified and unimported.

---

## 3. Risk verdicts

| Risk | Verdict | Basis |
|---|---|---|
| **R-132** unitCost permission aborts catalog sync | **PASS with P3 residue** | Cheap non-bulk preflight exists; denial yields `no-unitCost` and never throws; pipeline is not aborted. Residue: `NEW-CLAUDE-PR5F2A-08`. |
| **R-134** deprecated `currentBulkOperation` polling | **PASS** | Polling is `bulkOperation(id:)` bound to a persisted, parsed, branded GID. `currentBulkOperation` is rejected by graphql-js field AST, not substring policy. |
| **R-136** silent `first: 50` location cap | **PASS** | Complete cursor pagination, fail-closed on every enumerated degenerate page shape. Independently reproduced at 137 locations / 3 pages. |
| **R-138** accidental Shopify writes | **PASS with P3 residue** | Deny-by-default AST rejection precedes every network call; independently falsified against mutations absent from the existing tests. Residue: `NEW-CLAUDE-PR5F2A-07`. |
| **R-163** non-recursive module discovery | **PASS** | Recursion independently falsified three directories deep against the live tree. |

None of these risks may be closed by this review alone; each remains subject to ChatGPT's disposition. R-132 and R-134 additionally remain materially unproven end-to-end because the bulk documents they select between are not executable (`NEW-CLAUDE-PR5F2A-01`).

---

## 4. Read-only boundary (Question A) — **PASS**

`assertCanonicalReadDocument` (`safety/graphql-ast.ts:89`) parses with graphql-js and rejects any `OperationDefinition` whose `operation !== "query"`. `executeAdminReadQuery` (`execute.ts:47`) calls it as its **first statement**, before the `admin.graphql(...)` loop at `execute.ts:50`.

### Independently executed falsification

I wrote and ran a 58-assertion adversarial probe suite (created under `admin-read/__review_probe__/`, executed, then deleted; not committed). Result: **58 passed**.

Mutations rejected, each also proven never to reach the Admin client (`admin.calls` empty):

| Adversarial document | In existing tests? | Result |
|---|---|---|
| `inventoryBulkToggleActivation` | yes | `CanonicalReadMutationRejectedError` |
| `inventorySetQuantities` | no | `CanonicalReadMutationRejectedError` |
| `inventoryDeactivate` | no | `CanonicalReadMutationRejectedError` |
| **`productVariantsBulkUpdate`** | **no — unexpected Shopify mutation** | `CanonicalReadMutationRejectedError` |
| **`locationEdit`** | **no — unexpected Shopify mutation** | `CanonicalReadMutationRejectedError` |
| `bulkOperationRunQuery` | no | `CanonicalReadMutationRejectedError` |
| anonymous `mutation { … }` | no | `CanonicalReadMutationRejectedError` |
| **`subscription S { productUpdate { id } }`** | no | `CanonicalReadMutationRejectedError` (operation `subscription`) |
| mixed `query` + `mutation` in one document | no | `CanonicalReadMutationRejectedError` |

Query fields sharing inventory/product names remain allowed: `inventoryItem`, `inventoryItems`, `inventoryProperties`, `product`, `productVariants`, `locations` all pass in a single QUERY. Anonymous shorthand `{ shop { id } }` passes.

Rejection is semantic (operation kind), not a mutation-name allowlist. This satisfies the R-110 precedent.

---

## 5. Pagination (Question B)

### 5.1 Location pagination evidence — **PASS**

`readAllLocations` (`locations.ts:82`). Independently reproduced:

| Probe | Result |
|---|---|
| 137 locations, page size 50 | 137 unique GIDs returned, **3** Admin calls, page-1 `after: null`, page-2 `after` equals page-1 `endCursor`. No first-page ceiling. |
| duplicate GID across pages | `LocationPaginationError` |
| repeated `endCursor` | `LocationPaginationError: duplicate locations endCursor …` |
| `hasNextPage: true` with missing `endCursor` | `LocationPaginationError: … endCursor is missing` |
| empty page with `hasNextPage: true` | `LocationPaginationError: … empty while pageInfo.hasNextPage is true` |
| `locations` connection absent entirely | `LocationPaginationError: locations connection missing` |
| connection disappears on page 2 | `LocationPaginationError` — **no silent truncation** |
| malformed `pageSize` (500) | `LocationPaginationError: location pageSize must be 1..250` |

Every degenerate shape fails closed. An explicit 10 000-page safety bound refuses to return a truncated set rather than returning one.

### 5.2 Collection pagination evidence — **FAIL** (`NEW-CLAUDE-PR5F2A-03`)

`readProductCollectionMemberships` (`resources.ts:220`) is **not** equivalent to the location loop. Independently reproduced:

| Probe | Result |
|---|---|
| 3 pages, `first: 250` | correct; cursor advance correct |
| duplicate collection GID | throws |
| repeated `endCursor` | throws |
| `hasNextPage: true` without `endCursor` | throws |
| **empty page with `hasNextPage: true`** | **accepted silently** — locations rejects the identical shape |
| **`collections` connection missing on page 2** | **returns page 1 only, no error** — silent truncation |
| **edges containing `null` / id-less nodes** | **skipped silently**, not rejected |

`resources.ts:247` is the defect: `if (!connection) return memberships;` returns whatever was accumulated instead of failing closed.

---

## 6. Direct resource reads (Question C) — **PASS with P3 residue**

All eleven `#graphql`-tagged documents in `documents.ts` were independently validated against the **official Shopify Admin 2026-07 schema**. All eleven are **VALID**:

| Document | Schema result | Required scopes reported |
|---|---|---|
| `CATALOG_FACT_LOCATIONS_QUERY` | VALID | `read_locations`, `read_inventory`, `read_markets_home` |
| `CATALOG_FACT_LOCATION_QUERY` | VALID | same |
| `CATALOG_FACT_PRODUCT_QUERY` | VALID | `read_products`, … |
| `CATALOG_FACT_PRODUCT_COLLECTIONS_QUERY` | VALID | `read_products` |
| `CATALOG_FACT_PRODUCT_VARIANT_QUERY` | VALID | `read_products`, `read_inventory` |
| `CATALOG_FACT_INVENTORY_ITEM_QUERY` | VALID | `read_inventory`, `read_products` |
| `CATALOG_FACT_UNIT_COST_PREFLIGHT_QUERY` | VALID | `read_inventory`, `read_products` |
| `CATALOG_FACT_INVENTORY_LEVEL_BY_PAIR_QUERY` | VALID | `read_inventory`, `read_products`, `read_locations` |
| `CATALOG_FACT_INVENTORY_LEVEL_BY_ID_QUERY` | VALID | `read_inventory`, `read_locations`, `read_products` |
| `CATALOG_FACT_BULK_OPERATION_QUERY` | VALID | — |
| `CATALOG_FACT_SHOP_CURRENCY_QUERY` | VALID | — |

`InventoryItem.variants(first: 1) { nodes { id } }`, `InventoryItem.measurement.weight`, `Product.featuredMedia.preview.image.url`, `Location.address.*`, `Location.fulfillmentService`, and `unitCost @include(if:)` all exist in 2026-07.

**InventoryLevel canonical identity** is preserved as `(inventoryItemGid, locationGid)` — both queries select `location { id }` and `item { id }`, and `mapInventoryLevelNode` (`resources.ts:185`) requires both via `requireNonEmptyString`, throwing when neither the node nor the fallback supplies them. Verified by probe: identity resolves from the node; unresolvable identity throws. `shopId` is correctly out of scope for this lane (no persistence here).

Nullability handling is mostly fail-closed: `require*` helpers throw on type violation; `optional*` helpers preserve `null`. Two mapper fields break that discipline — see `NEW-CLAUDE-PR5F2A-05`. One identity cross-check is missing — see `NEW-CLAUDE-PR5F2A-06`.

---

## 7. Inventory quantity evidence (Question D) — **PASS with P3 residue**

`APPROVED_INVENTORY_QUANTITY_NAMES` (`types.ts:8`) contains exactly the eight approved names and nothing else:

`available`, `on_hand`, `incoming`, `committed`, `reserved`, `damaged`, `safety_stock`, `quality_control`.

`INVENTORY_QUANTITY_NAMES_ARGUMENT` is derived from that constant, so the `quantities(names:)` argument cannot drift from the approved list. `INVENTORY_LEVEL_BULK_QUERY` repeats all eight literally and they match.

Independently verified:

- all eight map into distinct `byName` slots with distinct quantities; each mapped row's `name` equals its source name — **no quantity aliases another**;
- `InventoryQuantity.updatedAt: null` is **preserved as `null`** (`types.ts:68`, probe confirmed) while `quantity` is retained;
- an unknown future name is recorded in `unexpectedNames` and does not displace any approved name;
- a missing approved name appears in `missingApprovedNames` with no substitution.

Residue: `NEW-CLAUDE-PR5F2A-04`.

---

## 8. Exact money / ID evidence (Question E) — **PASS with P3 residue**

`decimal.ts` never calls `Number`, `parseFloat`, or `parseInt` on money. Independently verified:

| Probe | Result |
|---|---|
| `price: "19.990"` | preserved exactly as `"19.990"` (trailing zero retained) |
| `compareAtPrice: "0.10000000000000000001"` | preserved exactly (20 significant digits) |
| `unitCost.amount: "12.345600"` | preserved exactly |
| `price` arriving as JS number `19.99` | **throws** `… must remain an exact decimal string from Shopify JSON` |
| `legacyResourceId: "9007199254740993"` | preserved exactly; `Number()` round-trip proven lossy in the same assertion |
| `legacyResourceId` arriving as JS number | **throws** `… must remain a string (UnsignedInt64 JSON token), not Number` |
| `BulkOperation.objectCount` / `rootObjectCount` | `stringifyUnsignedCount` throws on Number, preserving unsigned counts as string tokens |

Shopify legacy unsigned IDs therefore cannot silently lose precision; the failure mode is a hard throw, not a rounded value.

**Currency provenance:** `unitCostCurrencyCode` is carried from the resource's own `MoneyV2.currencyCode` (`resources.ts:170`), not inferred from shop currency. `readShopCurrencyCode` exists as a separate, explicitly-named helper and is never used to backfill a missing per-item currency. This is the correct provenance and I found no place where shop currency is substituted for item currency. Probe confirmed a `JPY` unit cost survives intact.

Residue (non-money): `NEW-CLAUDE-PR5F2A-05`.

---

## 9. unitCost preflight evidence (Question F) — **PASS on the specific question, P3 residue**

`preflightUnitCostCapability` (`unit-cost-preflight.ts:52`). All seven required cases independently executed:

| Case | Decision | Access | Bulk shape | Pipeline aborted? |
|---|---|---|---|---|
| permission allowed + value | `ALLOWED` | `PRESENT` | `with-unitCost` | no |
| permission allowed + null | `ALLOWED` | `NULL` | `with-unitCost` | no |
| `ACCESS_DENIED` on `unitCost` | `DENIED` | `OMITTED_NO_PERMISSION` | `no-unitCost` | **no** |
| unrelated GraphQL field error | `UNAVAILABLE` | `QUERY_ERROR_ISOLATED` | `no-unitCost` | no |
| missing probe item | `UNAVAILABLE` | `QUERY_ERROR_ISOLATED` | `no-unitCost` | no |
| malformed response | `UNAVAILABLE` | `QUERY_ERROR_ISOLATED` | `no-unitCost` | no |
| query/network failure | `UNAVAILABLE` | `QUERY_ERROR_ISOLATED` | `no-unitCost` | no |

### Direct answer to the `allowFieldErrors` question

**`allowFieldErrors` does not accidentally hide an unrelated fatal GraphQL error and reclassify it as a cost-permission issue.** I attempted the falsification directly: a response carrying valid `unitCost` data plus an unrelated `undefinedField` error yields `decision: UNAVAILABLE` / `unitCostAccess: QUERY_ERROR_ISOLATED` — a classification distinct from `OMITTED_NO_PERMISSION`. The `denied` filter at `unit-cost-preflight.ts:70` requires **both** `isAccessDenied` **and** `errorTouchesUnitCost`, and the catch-all at line 83 (`errors.length > 0 || !response.data?.inventoryItem`) routes every other error to `UNAVAILABLE`. Permission denial does not abort the pipeline; unrelated errors are not laundered into a permission verdict.

The residual weakness is narrower and is filed as `NEW-CLAUDE-PR5F2A-08`.

`FEATURE_COST_SYNC` is never read by this module and remains OFF.

---

## 10. Bulk operation contract (Question G) — **FAIL** (`NEW-CLAUDE-PR5F2A-01`, `NEW-CLAUDE-PR5F2A-02`)

I did **not** accept `graphql-codegen` exit 0 as proof. I validated the three inner bulk-query strings by an official schema-aware method, against the Shopify Admin GraphQL API **2026-07** schema.

### 10.1 Independent validation result — all three **INVALID**

| Constant | Schema validation |
|---|---|
| `CATALOG_BULK_QUERY_WITH_UNIT_COST` | **INVALID** — 13 errors: `Cannot query field "id" on type "ProductConnection"`, and likewise `legacyResourceId`, `title`, `handle`, `vendor`, `productType`, `tags`, `status`, `featuredMedia`, `createdAt`, `updatedAt`, `variants`, `collections` |
| `CATALOG_BULK_QUERY_NO_UNIT_COST` | **INVALID** — same class of errors on `ProductConnection` |
| `INVENTORY_LEVEL_BULK_QUERY` | **INVALID** — `Cannot query field "id" on type "InventoryItemConnection"`, `Cannot query field "inventoryLevels" on type "InventoryItemConnection"` |

Root cause: `products`, `variants`, `collections`, `inventoryItems`, and `inventoryLevels` resolve to Connection types. `ProductConnection` exposes exactly `edges`, `nodes`, `pageInfo` — confirmed by direct schema introspection. The documents select node fields **directly on the connection**, omitting the `edges { node { … } }` traversal.

### 10.2 The stated rationale for untagging is factually incorrect

`bulk-query-documents.ts:9-10` states: *"Do not tag them with `#graphql` — standalone Admin schema validation requires `first` on connections, which bulk queries omit by design."*

Both halves are wrong:

1. Official bulk-operation documentation states **"The `first` argument is optional and ignored if present, so it can be removed."** Pagination arguments are permitted in bulk queries; keeping them would not have violated anything.
2. The actual validation failure has nothing to do with `first`. It is the missing connection traversal, which bulk operations do **not** relax — official guidance is the `edges { node { … } }` pattern (only *top-level* `node`/`nodes` fields are prohibited).

### 10.3 Isolating the defect

To confirm the failures are traversal-only and not field-existence problems, I validated corrected variants restoring `edges { node }` (with `first` present):

- corrected catalog document → **VALID**, scopes `read_products`, `read_inventory`, …
- corrected inventory-level document (including `item { id }`) → **VALID**, scopes `read_inventory`, `read_products`, `read_locations`

So every selected field, argument, and nesting shape is correct for 2026-07. **Only the connection traversal is wrong** — which is precisely why the defect is mechanical to correct and precisely why it should never have escaped a schema gate.

### 10.4 Bulk restrictions on the corrected shapes

Against the official restrictions (max five connections; max two nested connection levels; query must contain a connection):

| Document | Connections | Max nesting depth | Within limits |
|---|---|---|---|
| catalog (either variant) | 3 — `products`, `variants`, `collections` | 2 | yes |
| inventory level | 2 — `inventoryItems`, `inventoryLevels` | 2 | yes |

Field selection matches the approved brief §8.2 shapes. `InventoryLevel.item { id }` is absent from `INVENTORY_LEVEL_BULK_QUERY`; that is acceptable because JSONL supplies `__parentId` (which cannot be queried) and `mapInventoryLevelNode` accepts a `fallbackIdentity`. It is worth an explicit note in the F2B ingest contract, but it is not a defect here.

### 10.5 Why CI did not catch this — proven both ways

The `#graphql` tag is what admits a document to `graphql-codegen`, the repository's only automated Admin-schema gate. I proved the gap experimentally:

| Experiment | Result |
|---|---|
| `npm run graphql-codegen` as committed (bulk documents untagged) | **exit 0** — matching the green CI job |
| `npm run graphql-codegen` with `INVENTORY_LEVEL_BULK_QUERY` tagged `#graphql` | **exit 1** — `Cannot query field "id" on type "InventoryItemConnection"`; `Cannot query field "inventoryLevels" on type "InventoryItemConnection"` |

The repository's own gate would have caught this defect immediately. Untagging removed it from coverage while the PR body reports *"graphql-codegen all exit 0 against Admin 2026-07"* — which a reader will reasonably read as covering the bulk shapes. It does not. (The tagged experiment was reverted; the file is byte-identical to `8329ae7…`.)

`documents.test.ts:60` — *"accepts bulk query documents as QUERY operations within official connection limits"* — cannot close this gap either: `bulkConnectionMetrics` counts field **names** from a hardcoded set and checks depth/count only. It has no schema knowledge and passes on all three invalid documents.

### 10.6 `bulkOperationRunQuery` verdict — **PASS**

This lane does **not** submit `bulkOperationRunQuery`. The token appears only in two explanatory comments and two negative test assertions. Even if a future edit introduced it, `assertCanonicalReadDocument` rejects it as a mutation before the Admin client is called — independently falsified in §4.

### 10.7 `bulkOperation(id:)` verdict — **PASS**

`CATALOG_FACT_BULK_OPERATION_QUERY` uses `bulkOperation(id: $id)`. The id is a branded `BulkOperationGid`, parsed and re-parsed on persist and on consume; a non-`gid://shopify/BulkOperation/` value throws `BulkOperationGidError`. `currentBulkOperation` is rejected by graphql-js field-AST visit (`safety/graphql-ast.ts:112`), not substring policy — independently falsified. No `currentBulkOperation` appears in any document.

### 10.8 `partialDataUrl` verdict — **PASS**

`classifyBulkOperationSnapshot` (`bulk-operation.ts:61`) requires `status === "COMPLETED"` **and** a non-empty `url` **and** `partialDataUrl == null` for `canonicalSuccessEligible`. `COMPLETED` with only `partialDataUrl` → `false`. `FAILED` with `partialDataUrl` → `false`. The classification also carries the literal type-level marker `partialDataUrlIsNotCanonicalSuccess: true`. `partialDataUrl` is never represented as canonical successful completion, and this lane never downloads JSONL.

---

## 11. Recursive scan falsification (Question H) — **PASS**

`listProductionTypeScriptModulesRecursive` (`safety/production-modules.ts:18`) walks with `readdirSync(dir, { withFileTypes: true })` and recurses into every non-skipped directory. It is not a filename check: `scanCatalogFactsProductionModules` reads each discovered file, extracts GraphQL documents via the TypeScript compiler API, and runs each through the same graphql-js AST assertion used at runtime.

**Live-tree falsification executed.** I planted a real production module **three directories deep** — `app/lib/catalog-facts/admin-read/safety/nested/deeper/planted.ts` — containing an official 2026-07 `inventoryDeactivate` mutation (a mutation deliberately different from the one in the committed fixture), and ran the actual committed test:

```
npx vitest run app/lib/catalog-facts/foundation-safety.test.ts
```

Result — **FAIL**, as required:

```
FAIL  app/lib/catalog-facts/foundation-safety.test.ts > PR5-F1 foundation safety >
      rejects Shopify mutations in catalog-facts by GraphQL AST (deny-by-default)
Error: Canonical catalog-facts read boundary safety scan failed:
admin-read/safety/nested/deeper/planted.ts: mutation_rejected:
  Canonical Admin read boundary rejects GraphQL mutation ReviewPlantedInventoryDeactivate
  (fields: inventoryDeactivate).
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

The planted module was deleted; the tree is clean. R-163's mitigation is genuinely implemented, at a depth the committed fixture does not itself exercise.

The scanner nonetheless retains extraction blind spots — `NEW-CLAUDE-PR5F2A-07`.

---

## 12. Dependency verdict (Question I) — **PASS**

`graphql@^16.14.2` moves from a transitive dev dependency to a direct runtime dependency. This is correct and necessary: `safety/graphql-ast.ts` imports `parse`, `visit`, `Kind` at runtime, so shipping it as `devDependencies`-only would break production builds.

`package-lock.json` changes by exactly two lines: the new `dependencies` entry and removal of `"dev": true` from the existing `node_modules/graphql` entry. The resolved version, tarball URL, and integrity hash are unchanged.

`npm ls graphql` after `npm ci` shows a **single** installed copy at `node_modules/graphql@16.14.2`, with every `@graphql-codegen` / `@graphql-tools` consumer resolving to `graphql@16.14.2 deduped`. No duplicate or incompatible graphql runtime is introduced — important because graphql-js throws on cross-realm instances.

### Regenerated tenant-access inventory — **PASS, scanner-derived, zero violations**

I re-ran the generator on the reviewed head and diffed:

- `npm run tenant:access:inventory` → `{"event":"tenant_access_inventory_written","findings":1408,"violations":0}`
- `git diff --stat` on `PR2_TENANT_ACCESS_INVENTORY.md` → **empty**: the committed file is **byte-identical** to freshly generated output. It is genuinely scanner-derived, not hand-edited.
- `npm run tenant:access:inventory:check` → exit 0, `tenant_access_inventory_fresh`.
- Committed JSON block: `"scannedFiles": 280`, `"findings": 1408`, `"violations": 0`. Content digest `4670755f…` unchanged from base — the delta is the file count only, consistent with 22 new TypeScript files (258 → 280).

**Zero violations confirmed.**

---

## 13. CI (Question J) — **PASS for the reviewed head**

Directly inspected run [`32080341125`](https://github.com/Vedang1998/Stocky/actions/runs/32080341125) and all of its jobs via the Actions API.

| Field | Value |
|---|---|
| `head_sha` | `8329ae7936a489203faef12347bc1a4290df2d5b` (exact reviewed head) |
| `event` | `pull_request` |
| `run_attempt` | 1 |
| `conclusion` | **success** |

| Job | ID | Conclusion |
|---|---|---|
| Classify change set | `95541960831` | success |
| Lint, typecheck, test, build, Prisma, GraphQL (heavy validate) | `95541982179` | success |
| CI Gate | `95552644822` | success |

Classify job log, read directly, confirms the classification was computed from `5129707e… → 8329ae79…` and emitted:

```
classification_reason=non_docs_or_unknown_path
docs_only=false
full_ci=true
```

The heavy job ran all 135 steps green, including `Tenant enforcement preflight`, `Tenant access inventory freshness`, `Lint`, `Typecheck`, `Unit tests`, `Migration and tenant-backfill tests`, `Build`, and `GraphQL codegen / schema validation`. The superseded failed run `32079298106` on `0a6cb39a…` was **not** treated as authoritative.

**Caveat of record:** the green `GraphQL codegen / schema validation` step is *not* evidence for the three bulk documents. See §10.5, where I proved the gate passes only because those documents are untagged and fails the moment one is admitted.

### Local reproduction of the claimed evidence

| Command | Claimed | Independently observed |
|---|---|---|
| `npx vitest run app/lib/catalog-facts` | 10 files / 48 tests | **10 files / 48 tests passed** — matches |
| `npm test` | 16 files / 104 tests | **16 files / 104 tests passed** — matches |
| `npm run typecheck` | exit 0 | **exit 0** — matches |
| `npm run graphql-codegen` | exit 0 | **exit 0** — matches, with the §10.5 caveat |

Cursor's local-evidence claims reproduce faithfully. They are accurate about what was run; they are incomplete about what that run covers.

---

## 14. Findings

### NEW-CLAUDE-PR5F2A-01 — **P1** — All three inner bulk-query documents are invalid against Admin 2026-07

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/bulk-query-documents.ts:16` (`CATALOG_BULK_QUERY_WITH_UNIT_COST`), `:77` (`CATALOG_BULK_QUERY_NO_UNIT_COST`), `:134` (`INVENTORY_LEVEL_BULK_QUERY`).

**Evidence:** Independent validation against the official Shopify Admin GraphQL 2026-07 schema:

- `CATALOG_BULK_QUERY_WITH_UNIT_COST` → 13 errors, all `Cannot query field "<x>" on type "ProductConnection"`.
- `CATALOG_BULK_QUERY_NO_UNIT_COST` → same class of errors.
- `INVENTORY_LEVEL_BULK_QUERY` → `Cannot query field "id" on type "InventoryItemConnection"`; `Cannot query field "inventoryLevels" on type "InventoryItemConnection"`.

Direct schema introspection confirms `ProductConnection` exposes only `edges`, `nodes`, `pageInfo`. Corrected variants restoring `edges { node { … } }` validate **VALID** with every existing field and argument intact, isolating the defect to the connection traversal alone. The repository's own codegen reproduces the failure the moment a bulk document is tagged `#graphql` (§10.5).

**Merchant impact:** When the F2B/F3 worker submits these constants to `bulkOperationRunQuery`, Shopify rejects them at query-validation time. Catalog ingest and inventory-level ingest never start, so no product, variant, inventory-item, collection-membership, or inventory-level fact is ever produced. Every downstream surface that depends on canonical facts — replenishment, forecasting, ABC/U, PO suggestions, reporting — is empty or stale for every merchant. This is a total failure of the lane's primary purpose, not a degradation. The failure is deterministic, so it will surface immediately when the lane is enabled; the cost is a burned delivery cycle rather than silent corruption, which is why this is P1 and not P0.

**Violated approved requirement:** PR5 brief §8.2 (approved catalog and inventory-level bulk shapes, submitted under the official bulk restrictions referenced at brief line 3187) and AGENTS.md *Evidence standard* — "Never claim that … GraphQL operations were inspected or executed without direct evidence." The bulk documents were reported as validated shapes while being excluded from every schema check.

**Reproduction:** Validate any of the three exported constants against the Admin 2026-07 schema; or tag one `#graphql` and run `npm run graphql-codegen` (exit 1).

**Expected behavior:** Each bulk document traverses connections with `edges { node { … } }` (or `nodes { … }`) and validates clean against Admin 2026-07 while remaining within five connections and two nested connection levels. `first` may be included — official guidance is that it is optional and ignored in bulk queries.

**Required correction:** Rewrite all three constants with correct connection traversal; re-validate each against the 2026-07 schema; add `item { id }` to the inventory-level shape or document the `__parentId` dependency explicitly in the F2B ingest contract; correct the misleading comment at `bulk-query-documents.ts:9-10`. Consider whether the shorthand in brief §8.2, which the implementation transcribed literally, should also be corrected to executable form.

**Missing test:** A test that validates every member of `CANONICAL_BULK_QUERY_DOCUMENTS` against the committed Admin 2026-07 schema artifact (`app/types/admin-2026-07.schema.json`) using `graphql`'s `validate` with the bulk pagination-argument rule relaxed — i.e. real schema validation, not name counting.

---

### NEW-CLAUDE-PR5F2A-02 — **P2** — Bulk documents are excluded from the only automated schema gate, and the substitute test cannot detect schema invalidity

**File / function:** `bulk-query-documents.ts:9-10` (untagging rationale); `documents.test.ts:17` (`bulkConnectionMetrics`) and `:60` (test titled "within official connection limits"); `.graphqlrc.ts` (`documents: ["./app/**/*.{js,ts,jsx,tsx}"]`, Shopify preset extracting `#graphql`-tagged literals).

**Evidence:** Proven experimentally in both directions — untagged codegen exits 0, tagged codegen exits 1 with the exact `ProductConnection`/`InventoryItemConnection` errors. `bulkConnectionMetrics` matches a hardcoded `BULK_CONNECTION_FIELDS` name set and asserts only `connections <= 5` and `maxDepth <= 2`; it passes on all three invalid documents. The stated rationale for untagging is factually incorrect on both points (§10.2).

**Merchant impact:** Indirect but structural. This is the control failure that let `NEW-CLAUDE-PR5F2A-01` reach a green exact-head CI and an "implementation complete" report. Any future change to a bulk shape is equally unguarded, so the same class of merchant-facing ingest outage can recur silently.

**Violated approved requirement:** AGENTS.md *CI evidence policy* (exact-head CI is the authoritative automatic evidence — it cannot be authoritative for artifacts deliberately removed from its coverage) and *Evidence standard*. Also CLAUDE.md: "A route, table, screenshot, or happy-path demonstration is not proof of completion."

**Reproduction:** `npm run graphql-codegen` on the committed tree (exit 0); tag any bulk constant `#graphql` and re-run (exit 1).

**Expected behavior:** Every executable GraphQL document in the repository — bulk inner queries included — is covered by an automated, schema-aware gate that runs in exact-head CI. Test titles claim only what the test proves.

**Required correction:** Add schema validation coverage for `CANONICAL_BULK_QUERY_DOCUMENTS` (per `NEW-CLAUDE-PR5F2A-01`'s missing test) and wire it into the heavy CI job; rename or strengthen `documents.test.ts:60` so its title matches its assertions; correct the untagging comment; state explicitly in the implementation report which documents `graphql-codegen` does and does not cover.

**Missing test:** As above, plus a negative fixture — a deliberately invalid bulk document that must fail the new gate.

---

### NEW-CLAUDE-PR5F2A-03 — **P2** — `readProductCollectionMemberships` fails open and can silently truncate merchant data

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/resources.ts:220` `readProductCollectionMemberships`; specifically `:247` `if (!connection) return memberships;` and the absence of the empty-page and null-node guards present in `locations.ts`.

**Evidence:** Independently reproduced (§5.2):

- `collections` connection missing on page 2 after a successful page 1 → returns 1 membership, **no error**;
- empty `edges` with `hasNextPage: true` → accepted, loop continues, no error (`locations.ts:133` throws on the identical shape);
- edges containing `null` nodes or nodes without `id` → skipped silently (`locations.ts:141` throws).

**Merchant impact:** A merchant whose product belongs to more collections than one page, hitting a transient Shopify error or a permission-shaped null on a later page, gets a **partial** collection-membership set presented as complete. Downstream canonical facts and any collection-scoped replenishment rule, filter, report, or ABC/U grouping silently operate on missing memberships. Silent partial data is materially worse than a hard failure because it is not detectable by the merchant.

**Violated approved requirement:** AGENTS.md *Engineering rules* — "Avoid hidden pagination caps"; the PR5 brief's no-silent-truncation acceptance standard for complete-pagination reads (brief line 318 / §R-136 intent); and the reviewer requirement "No fixed first-page ceiling may silently truncate merchant data." The lane's own `readAllLocations` already implements the correct fail-closed contract, so this is an internal inconsistency, not an unresolved design question.

**Reproduction:** Mock the Admin client to return a valid first page with `hasNextPage: true` and `{ data: { product: { collections: null } } }` on the second call; observe a resolved promise with page-1 data instead of a thrown error.

**Expected behavior:** Identical fail-closed semantics to `readAllLocations` — throw on missing connection, on empty page with `hasNextPage: true`, and on a null or id-less edge node; and enforce an explicit page bound.

**Required correction:** Introduce a shared cursor-pagination primitive used by both `readAllLocations` and `readProductCollectionMemberships` so the two cannot diverge again, or replicate all four guards plus a typed `CollectionPaginationError` in the collections loop.

**Missing test:** Collection-pagination equivalents of the five location degenerate-page tests — missing connection mid-pagination, empty page with `hasNextPage`, null edge node, id-less node, and a >250-membership multi-page traversal.

---

### NEW-CLAUDE-PR5F2A-04 — **P3** — A malformed quantity row can disappear from both `byName` and `unexpectedNames`

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/quantities.ts:27-31` and `:40`.

**Evidence:** Independently reproduced. Input `[{name:"available", quantity:5.5}, {name:"rogue_name", quantity:"12"}]` yields `byName.available === undefined`, `missingApprovedNames` contains `"available"`, and `unexpectedNames === []`. The `continue` at line 31 fires before the approved/unexpected branch at line 38, so an unapproved name with a malformed quantity is recorded nowhere at all.

**Merchant impact:** For approved names the outcome is acceptable — the name surfaces in `missingApprovedNames`, which is observable and fail-closed. The gap is the unexpected-name path: if Shopify introduces a new quantity name and it arrives with an unexpected quantity encoding, the boundary loses the only signal that an unmodelled quantity name exists. That defeats the purpose of `unexpectedNames` as a forward-compatibility tripwire. No quantity is aliased or corrupted.

**Violated approved requirement:** PR5 brief inventory-quantity contract — unexpected names must be recorded, not dropped. AGENTS.md "merchant-visible failures."

**Reproduction:** `mapInventoryQuantities([{ name: "rogue_name", quantity: "12", updatedAt: null }])` → `{ byName: {}, unexpectedNames: [], missingApprovedNames: [all eight] }`.

**Expected behavior:** Name classification precedes quantity validation; an unapproved name is always recorded in `unexpectedNames`, and a malformed quantity is surfaced through a distinct channel (for example `malformedQuantityNames`) rather than by omission.

**Required correction:** Reorder the classification so name recording happens before the quantity guard, and add an explicit malformed-quantity channel to `InventoryQuantitiesRead`.

**Missing test:** Unexpected name with a non-integer quantity must appear in `unexpectedNames`; approved name with a non-integer quantity must be distinguishable from a genuinely absent name.

---

### NEW-CLAUDE-PR5F2A-05 — **P3** — Two mapper fields use silent coercion instead of the fail-closed helpers

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/resources.ts:164` (`weightValue: … Number(weight.value)`) and `:200` (`isActive: node.isActive == null ? null : Boolean(node.isActive)`).

**Evidence:** Independently reproduced. `measurement.weight.value = "not-a-number"` yields `weightValue === NaN` with no error. `inventoryLevel.isActive = "false"` yields `isActive === true`.

**Merchant impact:** `weightValue` feeds shipping/packing calculations downstream; a `NaN` propagating into arithmetic produces `NaN` rather than a visible failure. `isActive` mis-typed as truthy would mark an inactive inventory level active, affecting which locations are treated as stocking locations. Both require Shopify to return an off-contract type (`Weight.value` is `Float!`, `InventoryLevel.isActive` is `Boolean!`), so exposure today is low — but every other field in these mappers fails closed via `require*`/`optional*`, and these two are the exceptions.

**Violated approved requirement:** AGENTS.md *Engineering rules* (decimal-safe, fail-closed boundary mapping) and CLAUDE.md verification standard on "failure behavior." Also the lane's own stated discipline in `decimal.ts:1-4`.

**Reproduction:** `mapInventoryItemNode({ …, measurement: { weight: { value: "not-a-number", unit: "KILOGRAMS" } } }, false).weightValue` → `NaN`; `mapInventoryLevelNode({ …, isActive: "false" }).isActive` → `true`.

**Expected behavior:** `weightValue` validated as a finite number or rejected; `isActive` validated via `optionalBoolean` (already present in `decimal.ts:60`, and already throwing on non-boolean) rather than `Boolean()`.

**Required correction:** Add `optionalFiniteNumber` to `decimal.ts` for `weightValue`; replace the `Boolean()` coercion with the existing `optionalBoolean` helper.

**Missing test:** Mapper negative fixtures for off-contract `weight.value` and `isActive` types.

---

### NEW-CLAUDE-PR5F2A-06 — **P3** — `readInventoryLevelByPair` does not verify the returned level matches the requested pair

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/resources.ts:325` `readInventoryLevelByPair`, with `mapInventoryLevelNode` (`:185`) preferring `node.item?.id` / `node.location?.id` over the requested `fallbackIdentity`.

**Evidence:** Independently reproduced. Requesting `(InventoryItem/1, Location/2)` while the mock returns a level carrying `item.id = InventoryItem/888` and `location.id = Location/999` resolves successfully with `identity === { inventoryItemGid: "gid://shopify/InventoryItem/888", locationGid: "gid://shopify/Location/999" }`. No mismatch is detected or reported.

**Merchant impact:** Low today — the returned object does carry the true identity, so a caller reading `identity` is not misled, and Shopify is not expected to return a mismatched level. The risk is for F2B/F3 callers that key results by the *requested* pair (a natural pattern when batching pair reads): such a caller would attribute one pair's quantities to another. Given that `(shopId, inventoryItemGid, locationGid)` is the canonical inventory-level identity, an undetected mismatch is a plausible route to cross-pair quantity attribution.

**Violated approved requirement:** PR5 brief canonical InventoryLevel identity `(shopId, inventoryItemGid, locationGid)`; AGENTS.md inventory-write safety precondition that identity be established, not assumed.

**Reproduction:** As in the probe above.

**Expected behavior:** When both a requested identity and a node identity are available, they must be asserted equal; a mismatch fails closed with a typed error.

**Required correction:** Add an explicit identity cross-check in `readInventoryLevelByPair` before returning, and record the invariant in the F2B ingest contract so batch callers cannot key by requested pair without it.

**Missing test:** A mismatched-pair response must throw.

---

### NEW-CLAUDE-PR5F2A-07 — **P3** — Mutation-safety scanner retains extraction blind spots, and prior textual bans were removed without replacement

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/safety/scan.ts:40` (`looksLikeGraphQLDocument`), `:75` (visitor handling only `isNoSubstitutionTemplateLiteral` / `isStringLiteral`), `:102-107` (hand-maintained import-specifier list); `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` (removed assertions).

**Evidence:** Independently reproduced against `extractGraphQLDocumentsFromTypeScript`:

- a mutation in a plain template literal → extracted (1 document) — the guard works for the normal case;
- **a mutation in a template literal containing a `${…}` substitution → 0 documents extracted.** `TemplateExpression` heads/middles/tails are neither `NoSubstitutionTemplateLiteral` nor `StringLiteral`, so the visitor never sees them;
- **a document whose first non-whitespace character is `#` (a GraphQL comment) followed by `mutation` → 0 documents extracted.** `looksLikeGraphQLDocument` requires `#graphql`, a leading `query|mutation|subscription|fragment` token, or a leading `{`.

Separately, the diff removes four per-file textual assertions from `foundation-safety.test.ts` (`/@shopify/`, `/graphql-request|admin\.shopify/`, `/inventoryAdjustQuantities/`, `/bulkOperationRunQuery/`) and replaces them with the AST scan. The AST scan is stronger for parseable documents but does not reinstate the `@shopify` import ban. I verified no `@shopify` import currently exists in `catalog-facts/`, so the ban would still hold and its removal was unnecessary. The import check that remains is a hand-maintained two-name list (`shopify-sync.server`, `shopify-gql.server`) — the exact anti-pattern R-110 and R-138 were opened against; a future `app/services/inventory-write.server.ts` would not be flagged.

**Merchant impact:** None today. No interpolated or comment-prefixed GraphQL document exists in the tree, and every document that reaches Shopify through `executeAdminReadQuery` is AST-checked at runtime regardless of what the scanner sees. The exposure is defence-in-depth erosion: the scanner's purpose is to catch a future module that calls an Admin client directly, bypassing `executeAdminReadQuery` — and against that case these three gaps are real.

**Violated approved requirement:** R-138 mitigation (deny-by-default semantic scan; "hand-maintained mutation lists miss things") and R-110 precedent (compiler-API semantic scanner plus negative fixtures). R-163's stated remediation covers recursion, which is satisfied; extraction completeness is the residue.

**Reproduction:** The three `extractGraphQLDocumentsFromTypeScript` probes above.

**Expected behavior:** The extractor visits `TemplateExpression` nodes (reconstructing the static skeleton, or flagging any interpolated literal that looks GraphQL-shaped as unreviewable); `looksLikeGraphQLDocument` tolerates leading GraphQL comments; the import ban is derived from a rule rather than a two-name list; and the `@shopify` import ban is reinstated.

**Required correction:** Extend the visitor to `ts.isTemplateExpression`; strip leading `#` comment lines before the shape heuristic; replace the specifier list with a broader rule (for example, any import from `app/services/**` or any `@shopify/*` package) plus explicit exact-file exceptions in the R-110 style; restore the `@shopify` assertion.

**Missing test:** Negative fixtures for an interpolated mutation template, a comment-prefixed mutation, and an import of a Shopify write module not named in the current list.

---

### NEW-CLAUDE-PR5F2A-08 — **P3** — Preflight classification relies on message regexes and swallows integrity errors

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/unit-cost-preflight.ts:23` (`errorTouchesUnitCost`, `/unitCost/i` on `error.message`), `:29` (`isAccessDenied`, `/access denied/i` on `error.message`), `:114-131` (blanket `catch`).

**Evidence:** Independently reproduced:

- an error with **no `path`** and no `extensions.code`, message `"Access denied. Required access: \`read_inventory\` (needed for unitCost among others)."` → classified `DENIED` / `OMITTED_NO_PERMISSION`, i.e. a whole-query authorization failure is recorded as a *cost-field* permission denial;
- a probe response whose `unitCost.amount` arrives as the JS number `3.5` — a decimal-integrity violation that `optionalDecimalString` correctly throws on — is caught by the blanket `catch` at `:114` and returned as `UNAVAILABLE` / `QUERY_ERROR_ISOLATED`, indistinguishable from a network timeout.

To be explicit about the question asked: the *specific* falsification — an unrelated fatal GraphQL error being downgraded to a cost-permission verdict — **does not reproduce**; that path correctly yields `UNAVAILABLE` (§9). This finding covers the narrower residue.

**Merchant impact:** Low and safe in direction — every misclassification lands on `no-unitCost`, so no cost data is fabricated and the pipeline is never aborted. The cost is diagnostic: a merchant whose app is missing `read_inventory` entirely, or whose Shopify responses are structurally corrupt, is told "no cost permission," which routes support toward a granular-permission fix that will not help. Persisted `unitCostAccess` state will carry the wrong reason into F2B.

**Violated approved requirement:** PR5 brief §6.C — `OMITTED_NO_PERMISSION` versus `QUERY_ERROR_ISOLATED` are meant to be distinct persisted states; AGENTS.md "merchant-visible failures" and CLAUDE.md supportability.

**Reproduction:** The two probes above.

**Expected behavior:** A `DENIED` verdict requires structured evidence — `extensions.code === "ACCESS_DENIED"` **and** a `path` ending in `unitCost` — with message regex used only as a logged secondary signal. Mapping/integrity failures are classified distinctly from transport failures.

**Required correction:** Require path-based attribution for `DENIED`; narrow the blanket `catch` so decimal-integrity and programming errors surface under their own classification (or at minimum a distinct `unitCostAccess` value) rather than sharing `QUERY_ERROR_ISOLATED` with network faults.

**Missing test:** Path-less `Access denied` mentioning `unitCost` must not yield `DENIED`; a probe returning a numeric `unitCost.amount` must be distinguishable from a network failure.

---

## 15. Finding counts

| Severity | Count | IDs |
|---|---|---|
| **P0** | **0** | — |
| **P1** | **1** | `NEW-CLAUDE-PR5F2A-01` |
| **P2** | **2** | `NEW-CLAUDE-PR5F2A-02`, `NEW-CLAUDE-PR5F2A-03` |
| **P3** | **5** | `NEW-CLAUDE-PR5F2A-04` … `-08` |
| **Total** | **8** | |

No finding was downgraded because production is currently disabled. `NEW-CLAUDE-PR5F2A-01` is rated on the ingest outage it will deterministically cause when the lane is enabled, not on today's exposure.

---

## 16. What this lane got right

Recording this explicitly, because the P1 should not obscure it:

- Mutation rejection is genuinely semantic and genuinely pre-network — it withstood adversarial mutations absent from the committed tests, plus subscriptions and mixed documents.
- Location pagination is the strongest part of the lane: every degenerate page shape fails closed, and the >50 acceptance criterion reproduces at 137 locations.
- Money and unsigned-ID handling is exemplary: exact decimal text preserved, JS `Number` arrival rejected with a hard throw rather than silently rounded.
- `bulkOperation(id:)` binding, GID branding, and the `partialDataUrl` non-success classification are correct and well-tested.
- R-163 recursion is real, not cosmetic — proven three directories deep against the live tree.
- All eleven direct query documents validate clean against Admin 2026-07.
- The tenant-access inventory refresh is genuinely scanner-derived and byte-reproducible with zero violations.
- Scope discipline is exact: no schema, migration, write, JSONL, webhook, projection, or flag enablement.

---

## 17. Final verdict

**`CORRECTIONS REQUIRED`**

PR5-F2A cannot be approved at head `8329ae7936a489203faef12347bc1a4290df2d5b`. The lane's stated purpose is to own the canonical Shopify Admin read boundary, including the with-unitCost / no-unitCost catalog bulk shapes and the inventory-level bulk shape. All three of those documents are invalid against Admin 2026-07 and would be rejected by Shopify on submission, and the one automated gate that would have caught this was removed from their path on an incorrect rationale.

The remaining findings are secondary but include one genuine fail-open path that can silently truncate merchant collection data (`NEW-CLAUDE-PR5F2A-03`).

PR [#29](https://github.com/Vedang1998/Stocky/pull/29) remains `OPEN`, `DRAFT`, `UNMERGED`. Do not merge. Do not mark ready. Do not start F3. R-132, R-134, R-136, R-138, and R-163 remain OPEN pending ChatGPT's disposition of this review.
