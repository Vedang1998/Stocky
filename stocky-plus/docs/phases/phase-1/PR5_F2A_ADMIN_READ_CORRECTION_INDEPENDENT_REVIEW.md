# Phase 1 PR5-F2A — Admin Read Boundary — Correction Re-Review (Independent, Tier A)

**Verdict:** `CORRECTIONS REQUIRED`
**Reviewer:** Claude Code (independent, adversarial, Tier A)
**Review type:** Exact-head correction re-review of PR [#29](https://github.com/Vedang1998/Stocky/pull/29)
**Reviewed corrected head:** `4c437ce95309fdcc97e02c299af57c46c5fafe6a`
**Production:** `NOT AUTHORIZED`
**Shopify inventory mutations:** `NOT AUTHORIZED`
**Inventory-write flags:** `DEFAULT OFF` (re-verified, including `FEATURE_COST_SYNC`)
**New finding counts:** P0 `0` / P1 `0` / P2 `1` / P3 `5`

This artifact is immutable. It modifies no implementation, runtime, test, schema, migration, package, CI, or prior review file. It is not D-055, not PR5-F2A acceptance, and not authorization to start F3.

Cursor's `PR5_F2A_ADMIN_READ_IMPLEMENTATION_REPORT.md` §16–§18 was **not** accepted as evidence. Every disposition below was reproduced or falsified locally at `4c437ce…` against the live Shopify Admin GraphQL 2026-07 schema.

---

## 1. Identity verification

| Field | Declared | Independently verified |
|---|---|---|
| Repository | `Vedang1998/Stocky` | ✅ |
| Authorized base / `origin/main` | `5129707ee684e66cadcf96b976e16eb57385a7cb` | ✅ `git rev-parse origin/main` **and** `git merge-base origin/main origin/cursor/pr5-f2a-admin-read-3ff2` both return this SHA |
| Originally reviewed implementation head | `8329ae7936a489203faef12347bc1a4290df2d5b` | ✅ present on the branch, 4 commits behind the corrected head |
| Immutable first-review commit | `a831b5f78529fd1d9d7a12ed119efc97bb4dd04f` | ✅ present on the branch |
| Immutable first-review blob | `81bc0678ea9041b6567c02c8fe5655752fc53441` | ✅ **`git rev-parse a831b5f7…:…PR5_F2A_ADMIN_READ_INDEPENDENT_REVIEW.md` = `81bc0678…`; `git rev-parse 4c437ce5…:<same path>` = `81bc0678…`; `git diff a831b5f7 4c437ce5 -- <path>` is empty. The first review artifact was NOT edited.** |
| Corrected implementation head / live PR head | `4c437ce95309fdcc97e02c299af57c46c5fafe6a` | ✅ `origin/cursor/pr5-f2a-admin-read-3ff2` and PR #29 `head.sha` both resolve to this SHA |
| Head moved during review | — | **NO** |

### Branch commit chain (base → corrected head)

```
5129707  (origin/main, authorized base)
 56039fb  Phase 1 PR5-F2A — canonical Shopify Admin read boundary.
 0a6cb39  Record PR5-F2A admin-read implementation evidence.
 55fb51a  Refresh tenant-access inventory scanned-file count for PR5-F2A.
 8329ae7  Record PR5-F2A inventory refresh and superseded exact-head CI.   <- originally reviewed head
 a831b5f  Phase 1 PR5-F2A — independent adversarial review (CORRECTIONS REQUIRED).
 5d80f46  Phase 1 PR5-F2A — correct Claude Tier-A Admin read findings.
 07bf16c  Refresh tenant-access inventory scanned-file count after PR5-F2A correction.
 4c437ce  Record PR5-F2A correction package for Claude findings 01-08.     <- corrected head
```

Cumulative diff `5129707…4c437ce`: **32 files, +5123 / −19**. Correction diff `a831b5f…4c437ce`: **20 files, +1679 / −352**.

### Local reproduction environment

| Item | Value |
|---|---|
| Node | `v22.22.2` |
| npm | `11.5.2` (pinned to `packageManager`; the ambient `10.9.7` is rejected by `engines`) |
| Install | `npm ci` exit 0 |
| Working tree | clean at `4c437ce…` before, during, and after every probe; every planted fixture reverted and `git status --porcelain` verified empty |

---

## 2. PR state — **PRECONDITION DEVIATION (BLOCKING for the mandated CI step)**

The re-review mandate requires PR #29 to remain `OPEN` / `DRAFT` / `UNMERGED`. Directly queried at review time:

```json
{"number":29,"state":"closed","draft":true,"merged":false,
 "mergeable_state":"clean","closed_at":"2026-08-18T12:26:28Z",
 "head":{"ref":"cursor/pr5-f2a-admin-read-3ff2",
         "sha":"4c437ce95309fdcc97e02c299af57c46c5fafe6a"},
 "base":{"ref":"main","sha":"5129707ee684e66cadcf96b976e16eb57385a7cb"}}
```

| Required | Observed |
|---|---|
| `OPEN` | **`closed`** — closed at `2026-08-18T12:26:28Z`, *after* the corrected head's CI completed at `05:42:02Z` |
| `DRAFT` | ✅ `draft: true` |
| `UNMERGED` | ✅ `merged: false`, base still `5129707…` — **nothing from this PR reached `main`** |

**Consequence.** `.github/workflows/ci.yml` triggers on `push` to `main`, `pull_request` targeting `main`, and `workflow_dispatch`. A push onto `cursor/pr5-f2a-admin-read-3ff2` while PR #29 is `closed` produces **no `pull_request` event and therefore no CI run**. The mandate's post-review requirements — automatic `pull_request` CI on the new review-artifact head with `full_ci=true`, Heavy `SUCCESS`, and CI Gate `SUCCESS`, with `workflow_dispatch` explicitly forbidden — are **not obtainable while the PR is closed**. This is a repository-state deviation, not an implementation defect; it is recorded here rather than graded as a code finding. It must be resolved (PR reopened) before any post-review CI evidence for this artifact can exist.

`FROZEN` / `DO NOT MERGE` posture is unaffected: nothing merged, and this review does not authorize merging.

---

## 3. Scope re-verification — **PASS**

`git diff --name-only 5129707 4c437ce` filtered for `prisma|migration|app/routes|app/jobs|app/services|webhook|.env` → **no matches**.

`.github/**` diff `5129707…4c437ce` → **empty**. `vitest*.config.ts` diff → **empty**. The new schema gate therefore rides the existing Heavy job with **no workflow loophole** (see §5.3).

Package delta is exactly the previously reviewed one: `graphql@^16.14.2` promoted from transitive dev to direct runtime dependency; `package-lock.json` changes by two lines (new `dependencies` entry, removal of `"dev": true`); resolved version, tarball, and integrity unchanged.

`docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` shared-file exception re-verified:

- committed block: `"scannedFiles": 284`, `"findings": 1408`, `"violations": 0`, digest `4670755f…` (digest unchanged from base; only the file count moved 280 → 284, consistent with the four new production modules);
- `npm run tenant:access:inventory` → `{"event":"tenant_access_inventory_written","findings":1408,"violations":0}`, and `git diff --stat` on the regenerated file is **empty** — the committed file is byte-identical to freshly generated output, i.e. genuinely scanner-derived;
- `npm run tenant:access:inventory:check` → exit 0, `tenant_access_inventory_fresh`.

---

## 4. Local check reproduction at `4c437ce…`

| Command | Cursor claimed | Independently observed |
|---|---|---|
| `npm run lint` | exit 0 | **exit 0** — matches |
| `npm run typecheck` | exit 0 | **exit 0** — matches |
| `npm test` | 18 files / 134 tests | **18 files / 134 tests passed** — matches |
| `npx vitest run app/lib/catalog-facts` | 12 files / 78 tests | **12 files / 78 tests passed** — matches |
| `npm run graphql-codegen` | exit 0 | **exit 0** — matches (see §5.2 for what it does *not* cover) |
| `npm run tenant:access:inventory:check` | exit 0 | **exit 0** — matches |

Cursor's local-evidence claims reproduce faithfully, with one material exception documented as `NEW-CLAUDE-PR5F2A-C01`.

---

## 5. Bulk documents and the bulk schema gate

### 5.1 Independent validation of all three corrected bulk documents — **PASS**

Two independent authorities were used. Neither is Cursor's test.

**(a) graphql-js `validate` against the live Shopify Admin 2026-07 introspection schema.** I fetched the schema myself from `https://shopify.dev/admin-graphql-direct-proxy/2026-07` (HTTP 200, 6,597,489 bytes as fetched), built it with `buildClientSchema`, extracted the three constants directly from `bulk-query-documents.ts` by source regex, and validated each under **stock `specifiedRules`** *and* under the PR's relaxed rule set:

| Constant | strict `specifiedRules` | PR's relaxed rules |
|---|---|---|
| `CATALOG_BULK_QUERY_WITH_UNIT_COST` | **0 errors** | 0 errors |
| `CATALOG_BULK_QUERY_NO_UNIT_COST` | **0 errors** | 0 errors |
| `INVENTORY_LEVEL_BULK_QUERY` | **0 errors** | 0 errors |

All three are valid **without needing the relaxation at all** — none of the connections these documents traverse has a required `first`. The P1 traversal defect (`Cannot query field "id" on type "ProductConnection"` etc.) is fully resolved.

**(b) Shopify's own `validate_graphql_codeblocks` (Admin API).** Both catalog and inventory-level shapes returned **`✅ SUCCESS`**, with reported scopes `read_products, read_files, read_themes, read_orders, read_draft_orders, read_images, read_quick_sale, read_inventory` and `read_inventory, read_products, read_locations, read_markets_home` respectively.

### 5.2 Executability, identity sufficiency, quantities, unitCost shape, and official bulk limits — **PASS**

Measured programmatically with `TypeInfo` + `visitWithTypeInfo` over the parsed documents:

| Document | Connections | Top-level connections | Max nesting depth | Top-level `node`/`nodes` |
|---|---|---|---|---|
| `CATALOG_BULK_QUERY_WITH_UNIT_COST` | 3 — `products:ProductConnection`, `variants:ProductVariantConnection`, `collections:CollectionConnection` | 1 (`products`) | 2 | none |
| `CATALOG_BULK_QUERY_NO_UNIT_COST` | 3 — identical | 1 (`products`) | 2 | none |
| `INVENTORY_LEVEL_BULK_QUERY` | 2 — `inventoryItems:InventoryItemConnection`, `inventoryLevels:InventoryLevelConnection` | 1 (`inventoryItems`) | 2 | none |

Official 2026-07 limit, quoted verbatim from the `BulkOperationUserError` / `bulkOperationRunQuery` reference: *"The query must include at least one connection field and supports up to **five connections** with a maximum nesting depth of **two levels**."* All three documents are inside those limits. Every connection is traversed as `edges { node { … } }`; no top-level `node`/`nodes` field appears.

Schema-introspected shapes:

- `InventoryItem.unitCost: MoneyV2` with `amount: Decimal!` and `currencyCode: CurrencyCode!` — the with-unitCost document selects exactly these two. `CATALOG_BULK_QUERY_NO_UNIT_COST` contains no `unitCost` token. **Shape correct.**
- `InventoryLevel.item: InventoryItem!` and `InventoryLevel.location: Location!` — **both** are now selected as `{ id }`. Inventory-level identity `(inventoryItemGid, locationGid)` is fully carried in the JSONL row and no longer depends on `__parentId`. **Identity sufficient.**
- `InventoryLevel.quantities(names: [String!]!): [InventoryQuantity!]!` with `InventoryQuantity { id: ID!, name: String!, quantity: Int!, updatedAt: DateTime }` — `updatedAt` is genuinely nullable in 2026-07, so `InventoryQuantityRead.updatedAt: string | null` is the correct model.
- All **eight** quantity names are present in `INVENTORY_LEVEL_BULK_QUERY` and match Shopify's official `inventoryProperties.quantityNames` set exactly: `available`, `committed`, `damaged`, `incoming`, `on_hand`, `quality_control`, `reserved`, `safety_stock`. No ninth name, no omission.

### 5.3 The gate runs in Heavy CI with no workflow loophole — **PASS**

- `vitest.config.ts` `include: ["app/**/*.test.ts"]`, `exclude` limited to `app/tenant/**`, `app/sync/__tests__/**`, `node_modules`. `bulk-query-schema.test.ts` is therefore inside the plain `npm test` set — confirmed by observing it in the `npm test` run output.
- `ci.yml` step 129 `Unit tests → npm test` in the Heavy `validate` job. `.github/**` is byte-unchanged from base. There is no bespoke step, no `workflow_dispatch` dependency, and no conditional skip.

### 5.4 Negative bulk fixtures — planted by me, all four failed the gate as required

Each fixture was written into the real `bulk-query-documents.ts`, the **committed** `bulk-query-schema.test.ts` was run unmodified, and the file was restored with `git checkout --` (verified `git status --porcelain` empty after each):

| # | Planted defect | Gate outcome |
|---|---|---|
| a | non-existent field `idDoesNotExistXyz` on `Product` | **FAIL** — `document[0] schema errors: … Cannot query field "idDoesNotExistXyz" on type "Product".` |
| b | `quantities` with the required `names:` argument removed | **FAIL** — `document[2] schema errors: … Field "quantities" argument "names" of type "[String!]!" is required, but it was not provided.` |
| c | `INVENTORY_LEVEL_BULK_QUERY` with `edges { node }` traversal collapsed | **FAIL** — `Cannot query field "id" on type "InventoryItemConnection"`; `Cannot query field "inventoryLevels" on type "InventoryItemConnection"` — i.e. the exact original P1 defect is now caught |
| d | a real `inventoryAdjustQuantities` **mutation** planted as `CANONICAL_BULK_QUERY_DOCUMENTS[0]` | **FAIL** — `CanonicalReadMutationRejectedError: … rejects GraphQL mutation PlantedWrite (fields: inventoryAdjustQuantities).` |

Fixture (b) is the decisive one: it proves the pagination relaxation does **not** swallow the `quantities(names:)` required argument.

### 5.5 Review of the relaxed pagination-argument rule

Composition is correct: `bulkRelaxedProvidedRequiredArgumentsRule` spreads `ProvidedRequiredArgumentsRule(context)` (retaining its `Directive` handler) and overrides only `Field.leave`; `bulkQueryValidationRules` substitutes it for exactly one member of `specifiedRules`, leaving the other 20+ rules intact. Reading `false` from a `leave` visitor is a no-op in graphql-js 16, and `context.getFieldDef()` is still populated during `leave` because `visitWithTypeInfo` calls `typeInfo.leave(node)` *after* the visitor function — so the rule is mechanically sound.

I falsified it against seven independent negatives. In every case the relaxed rule set produced **exactly the same errors** as stock `specifiedRules` — nothing was hidden:

| Negative | strict | relaxed | hidden? |
|---|---|---|---|
| `quantities` without `names:` | 1 | 1 | no |
| `product.translations` without required `locale:` | 1 | 1 | no |
| non-existent field on `ProductVariant` | 1 | 1 | no |
| `products { id title }` (no `edges`) | 2 | 2 | no |
| `@include` without required `if:` (directive path) | 1 | 1 | no |
| `quantities(names: 5)` (wrong scalar type) | 1 | 1 | no |
| `nodes` without required `ids:` | 1 | 1 | no |

**However**, the relaxation is scoped by *argument name globally*, not by "this is a Relay pagination argument on a bulk-traversable connection". A full schema sweep (4,265 field arguments in Admin 2026-07) found **8 fields where `first` is genuinely required (`Int!`)**: `Shop.customerTags`, `Shop.draftOrderTags`, `Shop.orderTags`, `Shop.productTags`, `Shop.productTypes`, `Shop.productVendors`, `Shop.search`, and `QueryRoot.segmentFilterSuggestions`. Proof of over-relaxation:

```
document: { shop { productTags { edges { node } } } }
  strict : ['Field "productTags" argument "first" of type "Int!" is required, but it was not provided.']
  relaxed: []
```

No current canonical document touches those fields, so there is no live exposure — but a future bulk shape that did would pass the gate and be rejected by Shopify at submit time. Filed as `NEW-CLAUDE-PR5F2A-C02` (P3).

### 5.6 The gate's schema source is **not** the committed artifact the first review required — `NEW-CLAUDE-PR5F2A-C01`

Finding `NEW-CLAUDE-PR5F2A-02`'s required test was, verbatim: *"validates every member of `CANONICAL_BULK_QUERY_DOCUMENTS` against the **committed** Admin 2026-07 schema artifact (`app/types/admin-2026-07.schema.json`)."* That artifact does not exist in the commit, and it cannot exist in CI when the gate runs. Full evidence in §7, finding `C01`.

### 5.7 `documents.test.ts` title honesty — **PASS**

The connection-count/depth test was renamed so it no longer claims schema validation; the schema claim now lives with the test that actually performs it.

---

## 6. Finding-by-finding disposition (independently verified)

| ID | Severity (orig.) | Disposition | Independent basis |
|---|---|---|---|
| `NEW-CLAUDE-PR5F2A-01` | P1 | **CORRECTED** | §5.1–§5.2. 0 errors under strict *and* relaxed rules against the live 2026-07 schema; Shopify's own validator returns SUCCESS; `item { id }` + `location { id }` both selected; 8 quantity names exact; `unitCost` = `MoneyV2{amount,currencyCode}`; 1 top-level connection, ≤3 connections, depth 2, no top-level `node`/`nodes`. |
| `NEW-CLAUDE-PR5F2A-02` | P2 | **PARTIALLY CORRECTED** | The gate exists, covers all 3 members, runs under plain `npm test` in Heavy with an unchanged workflow, and is genuinely effective — four planted fixtures (§5.4) all fail it. **But** its schema authority is a live network fetch, not the committed artifact the finding required, and the implementation report's "committed … 6,978,270 bytes" claim is false for the commit. See `NEW-CLAUDE-PR5F2A-C01`. |
| `NEW-CLAUDE-PR5F2A-03` | P2 | **CORRECTED**, one new residue | §8. All nine required degenerate shapes reproduced fail-closed, including the page bound. New residue: `pageInfo` absent entirely still returns a silent partial page — `NEW-CLAUDE-PR5F2A-C03`. |
| `NEW-CLAUDE-PR5F2A-04` | P3 | **CORRECTED**, one new residue | §9. Name classification now precedes quantity validation; malformed approved quantities are distinguishable from absent. New residue: a non-string/empty `name` is still silently dropped with no diagnostic — `NEW-CLAUDE-PR5F2A-C04`. |
| `NEW-CLAUDE-PR5F2A-05` | P3 | **CORRECTED** | §10. Malformed weight throws instead of yielding `NaN`; `"false"` throws instead of becoming `true`; no `Number(`/`Boolean(`/`parseFloat`/`parseInt` remains in any canonical mapper (comment-stripped source scan). |
| `NEW-CLAUDE-PR5F2A-06` | P3 | **CORRECTED** | §11. Item and location mismatches each throw `InventoryLevelIdentityMismatchError`. The "absent response identity → approved fallback" behaviour matches the first review's stated expected behaviour ("when **both** are available, assert equal"), so it is a documented design decision, not an unfixed defect; it is nevertheless recorded as a contract note for F2B. |
| `NEW-CLAUDE-PR5F2A-07` | P3 | **CORRECTED**, one new residue | §12. All six mandated scanner falsifications pass. New residue: `export … from` re-exports and dynamic `import()` are outside the import scan, and parse-failing GraphQL-shaped literals are silently dropped — `NEW-CLAUDE-PR5F2A-C05`. |
| `NEW-CLAUDE-PR5F2A-08` | P3 | **CORRECTED** | §13. `DENIED` now requires structured `extensions.code === "ACCESS_DENIED"` **and** a unitCost-attributable path; all six falsifications behave correctly; `unitCostAccess` remains exactly the four approved persisted values and `failureKind` is non-persisted. |

**Zero of the eight findings regressed. One (02) is only partially corrected.**

---

## 7. New findings

### NEW-CLAUDE-PR5F2A-C01 — **P2** — The bulk schema gate validates against a live third-party network fetch, never against a committed schema; CI cannot use a file, and the recorded evidence is inaccurate

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/bulk-query-schema.test.ts:23-82` (`SCHEMA_PATH`, `ADMIN_SCHEMA_PROXY`, `loadAdmin202607Schema`); `bulk-query-schema.ts:1-14` (header comment); `stocky-plus/.gitignore:42`; `.github/workflows/ci.yml:666-667` vs `:685-686`; `stocky-plus/docs/phases/phase-1/PR5_F2A_ADMIN_READ_IMPLEMENTATION_REPORT.md` §16.

**Evidence (all reproduced locally at `4c437ce…`):**

1. `git ls-files | grep -i 'schema.*json\|2026-07'` → **no tracked file**. `git ls-tree -r 4c437ce --name-only | grep '^stocky-plus/app/types'` → **`app/types` is not in the commit at all**.
2. `stocky-plus/.gitignore:42` is `/app/types/admin-*.schema.json`, under the comment *"GraphQL codegen outputs (regenerated in CI via `npm run graphql-codegen`) — Do not commit the downloaded Admin schema cache."* The artifact is deliberately un-committable.
3. `loadAdmin202607Schema()` therefore always takes its `else` branch and POSTs `getIntrospectionQuery()` to `https://shopify.dev/admin-graphql-direct-proxy/2026-07`. Timing corroborates: on a tree without the file the gate takes **1364 ms**; after `npm run graphql-codegen` materialises the file it takes **331 ms**.
4. In CI the file can never be present when the gate runs: `ci.yml` runs `Unit tests → npm test` at **step 129** and `GraphQL codegen / schema validation → npm run graphql-codegen` at **step 135**, on a fresh `actions/checkout`. Heavy CI's bulk gate is therefore *always* validating against shopify.dev over the network.
5. `bulk-query-schema.ts:5-7` states the documents "must still be validated against the **committed** Shopify Admin 2026-07 introspection schema". `PR5_F2A_ADMIN_READ_IMPLEMENTATION_REPORT.md` §16 states the reproduction was run *"Against **committed** Admin 2026-07 introspection (`app/types/admin-2026-07.schema.json`, 6,978,270 bytes)"*. I reproduced that exact byte count locally — but only **after** running `npm run graphql-codegen`, which downloads it. Nothing of the kind is committed.
6. Fail-closed direction is correct: repointing `ADMIN_SCHEMA_PROXY` at an unresolvable host makes the gate **FAIL** (`TypeError: fetch failed … ENOTFOUND`), not skip. (Fixture reverted; tree verified clean.)

**Merchant impact:** Indirect and structural, exactly the class `NEW-CLAUDE-PR5F2A-02` was opened against. Three consequences: (i) the authoritative exact-head Heavy job now has a hard runtime dependency on a third-party endpoint during unit tests, so a shopify.dev outage or egress restriction turns green CI red for reasons unrelated to the diff; (ii) the schema authority is **unpinned** — a silent upstream change to the 2026-07 proxy response can flip the gate's verdict with no repository change and no reviewable diff, which is precisely the reproducibility property AGENTS.md's CI evidence policy depends on; (iii) the written evidence asserts a committed artifact that does not exist, so a reader auditing this gate cannot locate the schema it validated against.

**Violated approved requirement:** `NEW-CLAUDE-PR5F2A-02`'s stated required correction and missing test (a **committed** Admin 2026-07 schema artifact). AGENTS.md *Evidence standard* — "Never claim that … GraphQL operations were inspected or executed without direct evidence"; AGENTS.md *CI evidence policy* (exact-head CI is authoritative, which requires it to be reproducible and hermetic). CLAUDE.md verification behaviour: "verify … environment; reproducibility."

**Reproduction:**
```
git ls-tree -r 4c437ce --name-only | grep 'app/types'        # empty
grep -n 'admin-\*.schema.json' stocky-plus/.gitignore        # line 42
rm -rf stocky-plus/app/types
npx vitest run app/lib/catalog-facts/admin-read/bulk-query-schema.test.ts   # ~1.4 s, network path
npm run graphql-codegen && npx vitest run …bulk-query-schema.test.ts        # ~0.33 s, file path
grep -n 'name: Unit tests' -A1 .github/workflows/ci.yml      # step 129
grep -n 'name: GraphQL codegen' -A1 .github/workflows/ci.yml # step 135
```

**Expected behavior:** The gate validates against a schema artifact that is either committed to the repository (pinned, diffable, reviewable) or materialised deterministically **before** `npm test` in the Heavy job, with no unit test performing outbound network I/O. Written evidence describes the artifact that actually exists in the commit.

**Recommended correction (one of):** (a) commit a pinned `admin-2026-07.schema.json` (or a trimmed SDL sufficient for these documents) and remove the network fallback entirely, failing hard if the file is missing; or (b) move `npm run graphql-codegen` **before** `npm test` in `ci.yml` and make `loadAdmin202607Schema()` throw when the file is absent rather than fetching. Either way, correct the "committed" wording in `bulk-query-schema.ts` and in the implementation report, and state explicitly which schema source Heavy CI used.

**Missing test:** An assertion that the gate's schema source is `"file"` (not `"proxy"`), so a silent regression to network validation fails CI. The current test asserts only `source === "file" || source === "proxy"`, which can never fail.

---

### NEW-CLAUDE-PR5F2A-C02 — **P3** — Pagination relaxation is name-scoped globally and suppresses genuinely required `first: Int!` on eight Admin 2026-07 fields

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/bulk-query-schema.ts:27-65` (`BULK_OPTIONAL_PAGINATION_ARGS`, `bulkRelaxedProvidedRequiredArgumentsRule`).

**Evidence:** Full sweep of 4,265 field arguments in Admin 2026-07 for required (`NonNull`, no default) arguments named `first`/`after`/`last`/`before` returned 8 hits: `QueryRoot.segmentFilterSuggestions(first: Int!)`, `Shop.customerTags`, `Shop.draftOrderTags`, `Shop.orderTags`, `Shop.productTags`, `Shop.productTypes`, `Shop.productVendors`, `Shop.search`. Direct falsification:
```
{ shop { productTags { edges { node } } } }
  strict : ['Field "productTags" argument "first" of type "Int!" is required, but it was not provided.']
  relaxed: []
```
The seven unrelated required-argument negatives in §5.5 confirm nothing *else* is hidden.

**Merchant impact:** None today — no canonical document touches these fields. The exposure is future: a bulk shape added over any of the eight would pass the gate and be rejected by Shopify at `bulkOperationRunQuery` submit time, reproducing the original P1 failure mode with the gate reporting green.

**Violated approved requirement:** The re-review standard for `NEW-CLAUDE-PR5F2A-02`'s correction — the relaxation must relax only what Shopify bulk semantics require.

**Reproduction:** As above.

**Expected behavior:** Relaxation restricted to arguments that are actually bulk-ignored pagination arguments on the connections being traversed — for example, only when the parent field's named type is a Relay `*Connection` **and** the argument is one of the four names **and** the document is a bulk inner query; or, more simply, an explicit allowlist of the connections these three documents traverse.

**Missing test:** A negative fixture proving that a required `first: Int!` on a non-bulk-optional field is still reported by the relaxed rule set.

---

### NEW-CLAUDE-PR5F2A-C03 — **P3** — `paginateCursorConnection` fails open when `pageInfo` is absent, and coerces `hasNextPage` with `Boolean()`

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/cursor-pagination.ts:90-91`.

**Evidence:** Independently reproduced against the real `readProductCollectionMemberships`:

- a `collections` connection carrying `edges` but **no `pageInfo` at all** → resolves with the first page only, **1 Admin call, no error**. `pageInfo` defaults to `{}` at line 90, so `hasNextPage` becomes `false` and the loop exits. This is the same silent-partial-return class that `NEW-CLAUDE-PR5F2A-03` was opened against; the missing-connection case is now guarded, the missing-`pageInfo` case is not.
- `hasNextPage: "false"` (a string) → `Boolean("false") === true`, so the loop continues and then throws `endCursor is missing`. Direction is safe here, but it is a permissive coercion of untyped Shopify JSON at the canonical boundary, the same discipline `NEW-CLAUDE-PR5F2A-05` established for `weightValue`/`isActive`.

**Merchant impact:** Low — `PageInfo!` is non-null in the Admin schema, so a response omitting it is off-contract. But the whole point of this loop is that Shopify responses may be degenerate; every other degenerate shape here fails closed, and this one does not.

**Violated approved requirement:** AGENTS.md *Engineering rules* — "Avoid hidden pagination caps"; the PR5 brief's no-silent-truncation acceptance standard; the lane's own fail-closed discipline.

**Reproduction:** Mock the Admin client to return `{ data: { product: { collections: { edges: [ { node: {…} } ] } } } }` with no `pageInfo`; observe a resolved promise with one row.

**Expected behavior:** Absent `pageInfo` throws the typed pagination error; `hasNextPage` is validated as a boolean via `requireBoolean`/`optionalBoolean` rather than `Boolean()`-coerced.

**Missing test:** A `pageInfo`-absent degenerate-page fixture for both `readAllLocations` and `readProductCollectionMemberships`, plus a non-boolean `hasNextPage` fixture.

---

### NEW-CLAUDE-PR5F2A-C04 — **P3** — A quantity row with a non-string or empty `name` is still dropped with no diagnostic; `updatedAt` is `String()`-coerced

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/quantities.ts:31` and `:42`.

**Evidence:** Independently reproduced.

- `mapInventoryQuantities([{name: 12345, quantity: 7}, {name: "", quantity: 7}, {name: null, quantity: 7}])` → `{ byName: {}, unexpectedNames: [], malformedQuantityNames: [] }`. The `continue` at line 31 fires before every diagnostic channel, so a malformed *name* leaves no trace at all — the same disappearance class `NEW-CLAUDE-PR5F2A-04` was opened against, one field over. (The finding's own case — an *unexpected* name with a malformed quantity — is correctly fixed: it lands in both `unexpectedNames` and `malformedQuantityNames`.)
- `updatedAt` is mapped as `row.updatedAt == null ? null : String(row.updatedAt)`. Reproduced: `updatedAt: 20260101` → `"20260101"`; `updatedAt: {}` → `"[object Object]"`. Every neighbouring mapper uses `optionalIsoTimestamp`/`optionalString`, which throw on non-string input.

**Merchant impact:** Low. `InventoryQuantity.name` is `String!` and `updatedAt` is `DateTime`, so both require an off-contract Shopify response. The cost is diagnostic loss and a corrupted timestamp string reaching F2B rather than a hard failure at the boundary.

**Violated approved requirement:** PR5 brief inventory-quantity contract (malformed rows must be recorded, not dropped); `NEW-CLAUDE-PR5F2A-05`'s established no-permissive-coercion discipline.

**Reproduction:** The two calls above.

**Expected behavior:** A row whose `name` is not a non-empty string is recorded in a diagnostic channel (for example `malformedQuantityNames` under a synthetic label, or a dedicated `malformedRows` count) rather than silently skipped; `updatedAt` uses `optionalIsoTimestamp`.

**Missing test:** Non-string / empty `name` fixtures asserting a diagnostic is produced; a non-string `updatedAt` fixture asserting a throw.

---

### NEW-CLAUDE-PR5F2A-C05 — **P3** — Scanner import denial misses `export … from` and dynamic `import()`; parse-failing GraphQL literals are silently dropped

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/safety/scan.ts:193-206` (`forbiddenImportSpecifiers` visits only `ts.isImportDeclaration`) and `:120-128` (`considerStatic`'s silent `catch { return; }`).

**Evidence:** Independently reproduced.

- `export { authenticate } from "@shopify/shopify-app-react-router/server";` — I walked the TypeScript AST and confirmed **no `ImportDeclaration` node exists** (it is an `ExportDeclaration`), so `forbiddenImportSpecifiers` never sees the specifier. `isForbiddenCanonicalReadImport` would correctly return `true` for that string; it is simply never called with it.
- `const m = await import("@shopify/shopify-app-react-router/server");` — likewise produces no `ImportDeclaration`; the specifier is a `CallExpression` argument.
- `` const X = `mutation M { productUpdate(input: { } { id } }`; `` (GraphQL-shaped but syntactically invalid) → `documents: []`, `unreviewable: []` — no finding of any kind. The `syntax` finding kind declared at `scan.ts:35` is consequently unreachable from `scanCatalogFactsProductionModules`, because only successfully-parsed documents ever reach `assertCanonicalReadDocument`.

The three blind spots the first review named (interpolated template, comment-prefixed mutation, service/`@shopify` import via a plain `import` statement) are all genuinely fixed — see §12. These are different holes in the same deny-by-default surface.

**Merchant impact:** None today; no such construct exists in the tree, and every document reaching Shopify through `executeAdminReadQuery` is AST-checked at runtime regardless. The exposure is defence-in-depth: the scanner's stated purpose is catching a future module that reaches an Admin client without going through `executeAdminReadQuery`, and a re-export or a dynamic import is a natural way to do exactly that.

**Violated approved requirement:** R-138 mitigation (deny-by-default semantic scan) and the R-110 precedent (compiler-API semantic scanner plus negative fixtures).

**Reproduction:** The three sources above through `extractGraphQLDocumentsFromTypeScript` / a TypeScript AST walk.

**Expected behavior:** The import visitor also handles `ts.isExportDeclaration` with a module specifier and `ts.isCallExpression` whose expression is `ts.SyntaxKind.ImportKeyword` (and `require(...)`); a GraphQL-shaped literal that fails `parse` is reported as a `syntax` finding rather than dropped.

**Missing test:** Negative fixtures for a re-exported `@shopify/*` module, a dynamically imported `app/services/**` module, and a malformed GraphQL-shaped literal.

---

### NEW-CLAUDE-PR5F2A-C06 — **P3** — `requireIsoTimestamp` performs no timestamp validation; two by-id reads do not cross-check the returned id

**File / function:** `stocky-plus/app/lib/catalog-facts/admin-read/decimal.ts:77-83`; `resources.ts:365-377` (`readInventoryLevelById`); `bulk-operation.ts:76-111` (`readBulkOperationById`).

**Evidence:**

- `requireIsoTimestamp` is `return requireString(value, field)` and `optionalIsoTimestamp` is `return optionalString(value)`. Neither validates ISO-8601/`DateTime` shape, so `shopifyCreatedAt: "not-a-date"` is accepted by every mapper. The names assert a guarantee the functions do not provide.
- `readInventoryLevelById(admin, "gid://shopify/InventoryLevel/1")` against a mock returning a level whose `id` is `gid://shopify/InventoryLevel/999` resolves successfully with `shopifyLevelGid === "gid://shopify/InventoryLevel/999"` — no mismatch check. `readBulkOperationById` likewise re-parses `node.id` as a `BulkOperationGid` but never compares it to the requested GID.

**Merchant impact:** Low. These mirror the concern behind `NEW-CLAUDE-PR5F2A-06` (which was fixed for the pair read); the by-id paths retain the same shape of exposure for a caller that keys results by the requested id. An unvalidated timestamp string propagates to F2B, where a canonical fact write is the natural place for it to fail instead.

**Violated approved requirement:** AGENTS.md fail-closed boundary mapping; `NEW-CLAUDE-PR5F2A-06`'s "identity must be established, not assumed."

**Reproduction:** The two mocked reads above; `mapProductNode({ …, createdAt: "not-a-date" })` resolving without error.

**Expected behavior:** `requireIsoTimestamp` validates the `DateTime` shape (or is renamed to reflect that it only asserts stringness); `readInventoryLevelById` and `readBulkOperationById` assert the returned id equals the requested id and fail closed on mismatch.

**Missing test:** A mismatched-id fixture for each by-id read; a malformed-timestamp mapper fixture.

---

### New finding counts

| Severity | Count | IDs |
|---|---|---|
| **P0** | **0** | — |
| **P1** | **0** | — |
| **P2** | **1** | `NEW-CLAUDE-PR5F2A-C01` |
| **P3** | **5** | `NEW-CLAUDE-PR5F2A-C02` … `-C06` |
| **Total** | **6** | |

---

## 8. Collection pagination evidence — **PASS**

All nine mandated shapes reproduced independently against the real `readProductCollectionMemberships`:

| Required probe | Observed |
|---|---|
| >250 memberships | 251 memberships across **2** calls, 251 unique GIDs, first `gid://…/1`, last `gid://…/251`, page-2 `after` equals page-1 `endCursor`. No truncation. |
| missing connection on a later page | `CollectionPaginationError: collections connection missing from Admin response` — **no silent partial return** |
| empty page + `hasNextPage: true` | throws `… page was empty while pageInfo.hasNextPage is true (missing page)` |
| null node | throws `collections edge is missing node` |
| id-less node | throws `collections edge node is missing id` |
| repeated cursor | throws `duplicate collections endCursor cursor-a; refusing to loop or skip` |
| missing cursor with `hasNextPage: true` | throws `… hasNextPage is true but endCursor is missing` |
| duplicate GID across pages | throws `duplicate collection GID: gid://shopify/Collection/1` |
| **page bound** | throws `collection pagination exceeded the explicit safety bound; refusing to return a truncated set` after 10,000 pages — **reproduced by me end-to-end**, not merely read from source; the committed `collections.test.ts` does not exercise it |

Also verified: `pageSize: 251` is rejected (`collection pageSize must be 1..250`) **before any Admin call** (`admin.calls` empty).

`readAllLocations` and `readProductCollectionMemberships` now share one `paginateCursorConnection` primitive, so the two cannot diverge again — the structural fix the finding asked for. Residue: `NEW-CLAUDE-PR5F2A-C03`.

---

## 9. Quantity diagnostics evidence — **PASS**

| Required probe | Observed |
|---|---|
| unexpected malformed name still recorded as unexpected | `[{name:"not_a_real_name", quantity:"12"}]` → `unexpectedNames: ["not_a_real_name"]` **and** `malformedQuantityNames: ["not_a_real_name"]`. The original disappearance is fixed. |
| malformed approved quantity distinguishable from absent | `[{name:"available", quantity:1.5}]` → `malformedQuantityNames` contains `available`; `missingApprovedNames` does **not** contain `available` but does contain `on_hand`; `byName.available` undefined. Malformed ≠ absent. |
| all eight valid names map correctly | all 8 present in `byName` with distinct quantities, `missingApprovedNames: []`, `unexpectedNames: []`, `malformedQuantityNames: []`; no name aliases another |
| nullable `updatedAt` remains null | all 8 rows retain `updatedAt === null` while `quantity` is preserved |

`APPROVED_INVENTORY_QUANTITY_NAMES` matches Shopify's official `inventoryProperties.quantityNames` set exactly, and `INVENTORY_QUANTITY_NAMES_ARGUMENT` is derived from it so the argument cannot drift. Residue: `NEW-CLAUDE-PR5F2A-C04`.

---

## 10. Strict mapping evidence — **PASS**

| Required probe | Observed |
|---|---|
| malformed weight cannot become `NaN` | every one of `"abc"`, `""`, `"1.5"`, `true`, `{}`, `[]`, `NaN`, `Infinity` throws `inventoryItem.measurement.weight.value must be a finite number from Shopify JSON`; a real `1.5` maps to `1.5` |
| string `"false"` cannot become boolean `true` | `location.isActive: "false"` throws `location.isActive must be a boolean`; `inventoryLevel.isActive: "false"` throws `inventoryLevel.isActive must be a boolean or null` |
| no permissive coercion at the canonical boundary | comment-stripped scan of `decimal.ts`, `quantities.ts`, `locations.ts`, `resources.ts` finds **no** `Number(`, `Boolean(`, `parseFloat`, or `parseInt` call (the only textual matches are the header comments forbidding them) |

Regression re-confirmed in the same pass: `legacyResourceId: "9007199254740993"` survives byte-exact; a numeric `legacyResourceId` throws `must remain a string (UnsignedInt64 JSON token), not Number`; `unitCost.amount: "10.100"` is preserved with its trailing zero.

---

## 11. Inventory-level pair identity evidence — **PASS**

| Probe | Observed |
|---|---|
| matching pair | resolves; `identity` equals the requested pair |
| response `item.id` differs from requested | throws `InventoryLevelIdentityMismatchError` |
| response `location.id` differs from requested | throws `InventoryLevelIdentityMismatchError` |
| response identity empty string `""` | throws `inventoryLevel.item.id must be a non-empty string` (`requireNonEmptyString` sees `""`, not nullish, so the fallback does not apply) — **fails closed** |
| response identity absent (`item: null, location: null`) | resolves using the requested pair as fallback — **by design**, matching the first review's stated expected behaviour ("when *both* a requested identity and a node identity are available, they must be asserted equal") |

Both direct queries select `item { id }` and `location { id }`, and the inventory-level bulk document now does too, so the absent-identity fallback should be unreachable against a conforming Shopify response. **F2B contract note (carry forward):** callers must not key inventory-level results by the requested pair unless this cross-check has succeeded, and must not substitute response ids for the requested pair and continue. The by-id sibling reads lack an equivalent check — `NEW-CLAUDE-PR5F2A-C06`.

---

## 12. Safety scanner falsifications — **PASS**

| Required re-test | Observed |
|---|---|
| nested production directory recursion | `scanCatalogFactsProductionModules("app/lib/catalog-facts")` enumerates `admin-read/safety/scan.ts` and `admin-read/safety/graphql-ast.ts`, excludes every `*.test.ts`, and returns **0 findings** on the live tree |
| interpolated mutation | `` `mutation ${name} { productUpdate(…) … }` `` → `documents: []`, `unreviewable: 1` — fails closed as unreviewable |
| leading GraphQL comment + mutation | `# canonical read\n# really\nmutation M { inventoryAdjustQuantities(…) … }` → extracted (1 document) and rejected with `rejects GraphQL mutation` |
| unexpected service / write-module import | `~/services/inventory.server`, `../../services/write.server`, `../../shopify.server` → all `true`; `./decimal` → `false` (rule-derived, not a two-name list) |
| direct `@shopify/*` import | `@shopify/shopify-app-react-router/server`, `@shopify/shopify-api` → `true` |
| a normal QUERY | all 11 tagged documents **and** all 3 bulk documents pass `assertCanonicalReadDocument` unchanged |

Deny-by-default is **semantic, not substring-based**, confirmed three ways: `mutation Q { products { edges { node { id } } } }` (an innocuous field name under a mutation operation) is rejected; `subscription S { productUpdate { id } }` is rejected as `subscription`; and `query Q { inventoryProperties { quantityNames { name } } }` — a QUERY whose field name contains write-adjacent words — is **permitted**. `currentBulkOperation` is rejected by field-AST visit anywhere in a document.

The committed `mutation-safety.test.ts` additionally plants real fixtures on disk for the service-import, `@shopify/*`-import, and valid-nested-QUERY cases, and asserts `productVariantsBulkUpdate` is rejected pre-network. Residue: `NEW-CLAUDE-PR5F2A-C05`.

---

## 13. unitCost preflight evidence — **PASS**

| Required falsification | Observed |
|---|---|
| path-less `"Access denied for unitCost field"` | `UNAVAILABLE` / `QUERY_ERROR_ISOLATED` / `no-unitCost` / `failureKind: GRAPHQL` — **never `DENIED`** |
| unrelated `ACCESS_DENIED` (path `["shop","plan"]`) | `UNAVAILABLE` / `GRAPHQL` — **never `DENIED`** |
| structured `ACCESS_DENIED` with path `["inventoryItem","unitCost"]` | `DENIED` / `OMITTED_NO_PERMISSION` / `no-unitCost` / `GRAPHQL` |
| network failure (client throws) | `UNAVAILABLE` / `QUERY_ERROR_ISOLATED` / **`failureKind: TRANSPORT`** |
| malformed cost amount (numeric `12.34`) | `UNAVAILABLE` / `QUERY_ERROR_ISOLATED` / **`failureKind: MAPPING_INTEGRITY`**, `unitCostAmount: null` |
| allowed value | `ALLOWED` / `PRESENT` / `with-unitCost` / `unitCostAmount: "10.100"` (exact, trailing zero) / `failureKind: null` |
| allowed null | `ALLOWED` / `NULL` / `with-unitCost` / `failureKind: null` |

`DENIED` now requires **both** `extensions.code === "ACCESS_DENIED"` **and** a path whose last segment is `unitCost`; message text is no longer load-bearing. The three failure kinds are cleanly distinguishable while `unitCostAccess` remains exactly the four approved persisted values (`PRESENT`, `NULL`, `OMITTED_NO_PERMISSION`, `QUERY_ERROR_ISOLATED`) — **the approved persisted contract is unchanged**, and `failureKind` is a non-persisted diagnostic on the result type only. Permission denial still never aborts the pipeline; every failure lands on `no-unitCost`.

**Observation (not a finding):** an `ACCESS_DENIED` carrying the deeper path `["inventoryItem","unitCost","amount"]` is *not* attributed to unitCost and falls through to `UNAVAILABLE`. The direction is safe (`no-unitCost`, no fabricated cost) and Shopify's observed field-level denials terminate at `unitCost`, so this is conservative rather than defective. Worth a note in the F2B contract.

---

## 14. Regression re-confirmation — **PASS**

| Previously-PASS area | Re-verified |
|---|---|
| pre-network query-only AST gate | `executeAdminReadQuery` rejects a mutation, `currentBulkOperation`, and an unparseable document with `admin.calls` **empty** in all three cases |
| >50 location pagination | 55 locations / page size 50 → 55 unique GIDs in **2** calls, page-2 `after` equals page-1 `endCursor`; all five degenerate shapes fail closed |
| `bulkOperation(id:)`, never `currentBulkOperation` | `CATALOG_FACT_BULK_OPERATION_QUERY` uses `bulkOperation(id: $id)`; no canonical document contains `currentBulkOperation`; GID is branded, parsed on persist and re-parsed on consume |
| `partialDataUrl` is not success | `COMPLETED` + `url` + `partialDataUrl` → `canonicalSuccessEligible: false`; `COMPLETED` + `url`, no `partialDataUrl` → `true`; `FAILED` → `false` |
| exact decimal strings | `"10.100"` and `"19.990"` preserved byte-exact; numeric money throws |
| >JS-safe-integer IDs remain strings | `"9007199254740993"` preserved; numeric input throws; `objectCount`/`rootObjectCount` (`UnsignedInt64!`) kept as string tokens |
| no Shopify mutation | no canonical document contains `mutation`, `bulkOperationRunQuery`, `inventoryAdjustQuantities`, or `inventorySetQuantities`; scan of the live tree returns 0 findings |
| no canonical write | no `admin-read/**` production module imports Prisma, `db.server`, any `*.server` module, BullMQ, or ioredis (AST import sweep over all recursively-discovered modules) |
| `FEATURE_COST_SYNC` OFF | `featureFlags.costSync()` → `false`; all five inventory-write flags `false`; CI env sets each to `"false"`; no enablement anywhere in the diff |

---

## 15. What the correction got right

Recording this explicitly, because the P2 residue should not obscure the quality of the fix:

- The P1 was fixed properly, not minimally: all three bulk documents are valid under **stock** `specifiedRules`, confirmed by two independent authorities, and `item { id }` was added so inventory-level identity no longer depends on `__parentId`.
- The new schema gate is genuinely effective. Four planted fixtures — a bad field, a missing required argument, collapsed connection traversal, and a real mutation — all fail it. It is not name counting.
- The relaxed validation rule is composed correctly and, on every negative I could construct outside the eight-field edge case, hides nothing.
- The collections fail-open was fixed structurally, by extracting one shared primitive rather than by duplicating guards — the correction the finding actually asked for.
- The scanner corrections are real and are backed by on-disk planted fixtures, not by unit-testing the helper in isolation.
- The `unitCost` `DENIED` path is now evidence-based, and the diagnostic split was added **without** touching the approved persisted `unitCostAccess` contract — exactly the constraint the finding imposed.
- Scope discipline held under correction pressure: no schema, migration, route, service, job, webhook, workflow, or vitest-config change; the immutable first review is byte-identical.

---

## 16. Final verdict

**`CORRECTIONS REQUIRED`**

Seven of the eight findings are fully corrected and independently verified, including the P1. The lane is materially closer to acceptable than at `8329ae7…`.

It cannot be approved at `4c437ce…` for two reasons:

1. **`NEW-CLAUDE-PR5F2A-02` is only partially corrected** (`NEW-CLAUDE-PR5F2A-C01`, P2). The gate that was supposed to close the control gap validates against a live third-party network fetch rather than the committed schema artifact the finding required — and, because `npm test` runs before `npm run graphql-codegen` on a fresh CI checkout, it can never do otherwise in CI. The authoritative Heavy job's schema authority is therefore unpinned and externally hosted, and both the source comment and the implementation report describe a "committed" artifact that does not exist in the commit. Under AGENTS.md's evidence standard and CI evidence policy, that is not a closed control.
2. **The mandated post-review CI evidence cannot be produced.** PR #29 is `closed` (§2). No `pull_request` event — and therefore no `full_ci=true` / Heavy `SUCCESS` / CI Gate `SUCCESS` run — can be triggered for a new review-artifact head while it remains closed, and `workflow_dispatch` is explicitly excluded by the mandate.

The five P3s (`-C02` … `-C06`) are residues, not blockers, and can reasonably be dispositioned by ChatGPT as accepted-with-notes.

PR [#29](https://github.com/Vedang1998/Stocky/pull/29) is `DRAFT` and `UNMERGED`; base `main` is still `5129707…` and nothing from this lane has reached it. Do not merge. Do not mark ready. Do not start F3. R-132, R-134, R-136, R-138, and R-163 remain **OPEN** pending ChatGPT's disposition.
