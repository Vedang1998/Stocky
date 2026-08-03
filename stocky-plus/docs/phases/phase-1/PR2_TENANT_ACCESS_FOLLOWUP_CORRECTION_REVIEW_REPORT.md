# Phase 1 PR 2 — Second Independent Correction Review Report

**Reviewer:** Claude Code (independent)
**Correction implementation owner:** Cursor
**Final technical acceptance authority:** ChatGPT

---

## 1. Review identity

| Field | Value |
|---|---|
| Pull request | [#13](https://github.com/Vedang1998/Stocky/pull/13) — Phase 1 PR 2, tenant-bound access conversion |
| Authorized base SHA | `04289d61f605414597ac85f47830a3c9d2f9e33d` (verified `= origin/main`) |
| Original rejected implementation head | `6f9ca22c069a46003b6944ff56c888ff91e95cdc` |
| First corrected head (independently rejected) | `e6a9a06a8a399bbfb17687399c59582f1712f442` |
| First correction-review report commit | `b5fbd2bd346dee1730500be46d47c4fb164fd788` |
| **Exact follow-up head reviewed** | **`99d7a2bb73e77f62bd4ed0029961b40ab04a08e0`** |
| Follow-up range | `b5fbd2bd..99d7a2bb` — **10 commits**, merge-base = `b5fbd2bd` (no rebase, no rewritten history) |
| Branch | `phase-1/tenant-access` |
| Checkout state | Detached at `99d7a2bb…`; `git status --porcelain` empty before, during (after each probe removal) and after review |
| OS | macOS (Darwin 25.4.0, arm64) |
| Node | v22.19.0 (satisfies `engines.node` `>=20.19 <22 \|\| >=22.12`) |
| npm | 11.5.2 (exact `engines.npm`) |
| PostgreSQL | 16.14 (Homebrew, aarch64-apple-darwin25.6.0) — disposable local cluster, test credentials |
| Redis | 8.10.0 (Homebrew) on an isolated port — **deviation from the requested Redis 7**, see §11 |
| Review date | 2026-08-01 |
| Implementation code modified | **No** |
| Merchant / production data used | **No** |

### Clean-checkout evidence

```text
$ git fetch origin --prune
   b5fbd2b..99d7a2b  phase-1/tenant-access -> origin/phase-1/tenant-access
$ git rev-parse origin/main
04289d61f605414597ac85f47830a3c9d2f9e33d
$ git rev-parse origin/phase-1/tenant-access
99d7a2bb73e77f62bd4ed0029961b40ab04a08e0
$ git status --porcelain
(empty)
$ git checkout --detach 99d7a2bb73e77f62bd4ed0029961b40ab04a08e0
HEAD is now at 99d7a2b Refresh tenant access inventory after follow-up scanner changes
$ test "$(git rev-parse HEAD)" = "99d7a2bb..."  → HEAD OK
$ test -z "$(git status --porcelain)"           → CLEAN OK
```

### Ancestry and scope

```text
$ git merge-base b5fbd2bd… 99d7a2bb…            → b5fbd2bd346dee1730500be46d47c4fb164fd788
$ git rev-list --count b5fbd2bd..99d7a2bb        → 10
$ git merge-base --is-ancestor b5fbd2bd 99d7a2bb → true
$ git merge-base --is-ancestor e6a9a06  99d7a2bb → true
$ git merge-base --is-ancestor 6f9ca22  99d7a2bb → true
$ git merge-base --is-ancestor 04289d6  99d7a2bb → true
$ git diff --name-only b5fbd2bd..99d7a2bb -- \
    stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_CORRECTION_REVIEW_REPORT.md
(no output — prior independent review report unmodified)
```

| # | SHA | Subject |
|---|---|---|
| 1 | `98c1bc6` | Record PR 2 follow-up correction backlog |
| 2 | `6309fbf` | Authorize all nested relation selector forms |
| 3 | `b95300f` | Normalize legacy tenant ownership checks |
| 4 | `06b5595` | Preserve partial selects and update projections |
| 5 | `cba853c` | Harden tenant scanner provenance analysis |
| 6 | `2f945b5` | Scale client hint inspection safely |
| 7 | `e37384b` | Correct mocked-client scope fallback for unit tests |
| 8 | `1e99db2` | Correct PR 2 follow-up evidence |
| 9 | `363c86d` | Record follow-up implementation head SHA in evidence report |
| 10 | `99d7a2b` | Refresh tenant access inventory after follow-up scanner changes |

Ten expected commits present and in order. The backlog commit precedes every implementation commit; no implementation commit precedes the prior review-report commit; no unrelated phase work; no rebase or rewritten review history. Follow-up diff: **32 files, +4,024 / −652**.

### Live PR verification

| Property | Observed |
|---|---|
| State | `OPEN` |
| Draft | `true` |
| Merged | `false` |
| Base branch / SHA | `main` / `04289d61f605414597ac85f47830a3c9d2f9e33d` |
| Head branch / SHA | `phase-1/tenant-access` / `99d7a2bb73e77f62bd4ed0029961b40ab04a08e0` |
| Mergeable | `MERGEABLE`, `mergeStateStatus: CLEAN` |
| Changed files / commits | 109 / 28 (`+13,866 / −627`) |

---

## 2. Executive verdict

# `NOT READY — FURTHER CORRECTIONS REQUIRED`

**The security posture is materially better than at `e6a9a06…` and, under adversarial probing, I could not reproduce any cross-tenant read or write.** All five originally-specified attacks fail closed; the full nested-selector matrix fails closed; `connectOrCreate` foreign matches fail closed; nested array bulk mutations cannot reach foreign children; TOCTOU races produced 0 foreign mutations in 8 adversarial interleavings; the architecture scanner caught 20 of 23 bypass shapes including every `db.server` provenance case in §13; allowlist matching is exact. **F-PR2C-03, F-PR2C-06, F-PR2C-09 and F-PR2C-11 are genuinely closed.**

Acceptance is nevertheless blocked by three P1 defects that the committed test suite does not exercise and green CI therefore does not evidence. All three are **functional/availability** defects in the tenant-bound contract itself, not isolation failures:

1. **Every compound-unique `findUnique`/`update`/`delete` fails.** The wrapper routes caller `WhereUniqueInput` through `findFirst`, which cannot accept compound-unique wrapper keys. All six compound shapes used by live routes, services and workers throw `PrismaClientValidationError` on rows the tenant owns.
2. **The `{ id: { in: [...] } }` tenant scope exceeds PostgreSQL's 32,767 bind-parameter limit.** At ≥32,766 owned rows in a single direct merchant model, `findMany` fails permanently; at ≥32,767, `count` fails too. Realistic stores cross this in weeks.
3. **A single unprovable to-one parent denies the entire query.** `purchaseOrder.findMany({ include: { supplier: true } })` — the purchase-order list shape — throws `foreign_relation_row` outright when any one supplier is an ordinary pre-backfill legacy row.

Under §6 of the review standard, any remaining P1 bars `READY`. F-PR2C-01, -02, -04, -05, -08 and -10 are additionally not fully closed.

**Finding counts (this review): P0: 0 · P1: 3 · P2: 3 · P3: 4**

---

## 3. Finding disposition — F-PR2C-01 … F-PR2C-11

| Finding | Sev | Disposition | Basis |
|---|---:|---|---|
| F-PR2C-01 | P1 | **Partially closed** | Nested selector authorization closed (all 5 attacks + 20-case matrix fail closed; metadata matches schema exactly). Top-level compound selectors broken → F-PR2R2-01 |
| F-PR2C-02 | P1 | **Partially closed** | Foreign matches fail closed and victims are untouched. Compound `connectOrCreate.where` always throws; sibling `create`/`connect` silently discarded → F-PR2R2-01, F-PR2R2-04 |
| F-PR2C-03 | P2 | **Closed** | Object and array forms normalized; no cross-tenant mutation reachable in any of the three deliberately inconsistent row shapes |
| F-PR2C-04 | P2 | **Open** | Four divergent normalizations; SQL and JS are not semantically equivalent; rows hidden at top level but reachable/erroring elsewhere; rows invisible to reads yet mutable via nested bulk → F-PR2R2-03, F-PR2R2-05 |
| F-PR2C-05 | P2 | **Partially closed** | Every projection shape exact with no proof-field leakage, except `LeadTimeSnapshot` selections omitting the secondary lineage key → F-PR2R2-06 |
| F-PR2C-06 | P2 | **Closed** | Real single-row `update` preserves nested writes and all projection forms; mixed valid/invalid nested ops roll back completely |
| F-PR2C-07 | P2 | **Closed with accepted residual** | 20/23 bypasses caught, including all §13 `db.server` shapes. Residual: issuer reached via local-const alias or namespace import → F-PR2R2-09 |
| F-PR2C-08 | P2 | **Partially closed** | The specific business-object regression is fixed. Byte ceiling not enforced in bytes; multipart cumulative size unchecked; `shop` string arrays false-reject → F-PR2R2-07, F-PR2R2-08 |
| F-PR2C-09 | P3 | **Closed** | Serializable internal transactions; 0/8 foreign mutations under adversarial interleaving; nested tx rejected; rollback correct |
| F-PR2C-10 | P3 | **Open** | Follow-up head recorded nowhere; PR body stale; commit `363c86d` did not do what its subject claims → F-PR2R2-10 |
| F-PR2C-11 | P3 | **Closed** | `exceptionForPath` is exact-match; no suffix inherits an exception; `*.rdb` present in repository-root `.gitignore` |

---

## 4. New findings

### F-PR2R2-01 — P1 — Compound-unique selectors are rejected on every owned row

**Files:** `app/tenant/tenant-db.server.ts:1280-1307` (`rewriteUniqueRead`), `:1309-1401` (`rewriteUniqueWrite`), `:467-471` (`connectOrCreate` scoped lookup)

`findUnique`/`findUniqueOrThrow`/`update`/`delete` merge the caller's `WhereUniqueInput` into a `findFirst` call. Prisma's `WhereInput` does not accept compound-unique wrapper keys (`shopId_id`, `shop_shopifyVariantId`, …), so the call fails validation before any tenant logic runs.

**Reproduction (real PostgreSQL, rows owned by the calling tenant):**

```text
shopifyVariantCache.findUnique{shop_shopifyVariantId}       -> THROW PrismaClientValidationError
forecastOverride.findUnique{shop_variantId_locationId}      -> THROW PrismaClientValidationError
supplierSkuMapping.findUnique{supplierId_shopifyVariantId}  -> THROW PrismaClientValidationError
variantAbcClass.findUnique{shop_..._metric}                 -> THROW PrismaClientValidationError
salesDailyAggregate.findUnique{shop_..._date}               -> THROW PrismaClientValidationError
bomComponent.findUnique{shop_bundle_component}              -> THROW PrismaClientValidationError
supplierSkuMapping.update{supplierId_shopifyVariantId}      -> THROW PrismaClientValidationError
transferOrder.findUnique/update/delete{shopId_id}           -> THROW PrismaClientValidationError
shopifyVariantCache.findUnique{id}      (baseline)          -> OK
shopifyVariantCache.upsert{shop_shopifyVariantId}           -> OK   (upsert passes `where` straight to Prisma)
```

**Merchant impact.** These are not hypothetical shapes — they are the live call sites:

* `app/routes/app.transfers.tsx:116` (ship transfer)
* `app/routes/app.stocktakes.tsx:135` (apply stocktake)
* `app/routes/app.purchase-orders.tsx:106,108` (add PO line)
* `app/routes/app.buying-table.tsx:71,79,89`
* `app/routes/app.bundles.tsx:41`, `app/routes/app.warehouse_.labels.tsx:39`
* `app/services/forecasting.server.ts:150,364,419`, `app/services/shopify-sync.server.ts:68`
* `app/jobs/workers/webhook-processor.ts` (multiple)

`shopId_id` is also the selector the schema adds specifically for tenant-safe lookup and that `hasTenantBearingUnique` (`:244-274`) treats as canonical for `upsert` — yet it is unusable on every other operation.

**Note on provenance.** This defect pre-dates the follow-up range (`rewriteUniqueRead` exists at `b5fbd2bd`). It is reported now because §7 of this review standard directs testing `shopId_id`, every compound business selector and every alternate scalar unique selector, and because no committed test covers any top-level compound selector.

**Expected behaviour.** Resolve the compound `WhereUniqueInput` through `findUnique` (or expand the wrapper into its component scalar equality predicates) before applying tenant scope, then rewrite to canonical `{ id }`.

**Missing test.** Top-level `findUnique`/`update`/`delete` for every selector in `MODEL_UNIQUE_SELECTORS`, on owned and foreign rows.

---

### F-PR2R2-02 — P1 — ID-list tenant scope exceeds the PostgreSQL bind-parameter limit

**Files:** `app/tenant/legacy-scope.ts:146-197` (`resolveDirectTenantScopeWhere`), `app/tenant/tenant-db.server.ts:1465`

`resolveDirectTenantScopeWhere` resolves **every owned row id** by raw SQL and returns `{ id: { in: [...] } }`. `runScopedOperation` recomputes it on every call. Once the tenant owns more rows than PostgreSQL's 32,767 bind-parameter ceiling, the generated statement is rejected.

**Reproduction (single direct model, `InventorySnapshot`, all rows owned by the tenant):**

```text
rows=30000   findMany(take:1) OK 80ms   count() OK 50ms   create() OK 23ms
rows=32766   findMany(take:1) FAIL      count() OK 56ms   create() OK 24ms
rows=32767   findMany(take:1) FAIL      count() FAIL      create() OK 23ms
rows=32768   findMany(take:1) FAIL      count() FAIL      create() OK 24ms
rows=40000   findMany(take:1) FAIL      count() FAIL      create() OK 30ms

FAIL = Assertion violation on the database:
       `too many bind variables in prepared statement, expected maximum of 32767, received 32768`
```

**Merchant impact.** `InventorySnapshot`, `SalesDailyAggregate` and `ShopifyVariantCache` grow with variants × locations × days. A 1,000-variant store crosses 32,767 `SalesDailyAggregate` rows in roughly a month, after which **every tenant-bound read of that model throws permanently** — unrecoverable without a code change. Pagination is correct below the limit (verified: `take`/`skip`/`cursor` all correct across 25 rows) but the scope itself is unbounded.

Below the limit the cost is measurable but tolerable (N=20,000: `findMany(take:5)` 51 ms, `count` 34 ms, `create` 15 ms) — the defect is the hard cliff, not the constant factor.

**Expected behaviour.** Express direct-model tenant scope as a set-returning predicate (`shopId = $1 OR (shopId IS NULL AND lower(btrim(shop)) = $2)`) or an `EXISTS`/`IN (SELECT …)` subquery, not a materialised id list. Additionally, do not compute the scope for operations that never use it (`create`, `upsert`).

**Missing test.** A scale test asserting correct behaviour above 32,767 owned rows per direct model.

---

### F-PR2R2-03 — P1 — One unprovable to-one parent denies the entire query

**File:** `app/tenant/tenant-db.server.ts:1150-1179` (`validateLoadedRelations`)

For a to-one relation the loader throws `foreign_relation_row` when the parent is not provably owned. Because the check runs per row over the whole result set, a single such row aborts the entire query rather than being filtered or nulled.

**Reproduction:** 10 purchase orders owned by tenant A; 9 reference a canonical supplier, 1 references a supplier with `shopId = NULL, shop = ''` (exactly the pre-backfill legacy state PR 1 is designed to tolerate):

```text
purchaseOrder.findMany()                            -> OK 10 rows
purchaseOrder.findMany({include:{supplier:true}})   -> THROW foreign_relation_row
```

The same hard failure occurs for a supplier whose only defect is a malformed legacy `shop` while `shopId` correctly equals the tenant:

```text
04 canonical shopId + FOREIGN normalizable shop      top=. relationInclude=E(foreign_relation_row)
07 canonical shopId + URL-shaped shop                top=. relationInclude=E(foreign_relation_row)
11 canonical shopId + subdomain myshopify host       top=. relationInclude=E(foreign_relation_row)
12 canonical shopId + hyphen-boundary myshopify host top=. relationInclude=E(foreign_relation_row)
16..20 NULL shopId variants                          top=. relationInclude=E(foreign_relation_row)
```

A to-many include fails the same way: `supplier.findFirst({ include: { purchaseOrders: true } })` threw `foreign_relation_row` even though all three top-level-visible purchase orders were legitimately owned — the sync include scope over-includes a conflicting row that post-load validation then rejects for the whole query.

**Merchant impact.** The purchase-order list, supplier detail and any other `include`-bearing screen becomes a hard error for a merchant with a single legacy or malformed-`shop` row. Fail-closed is correct for the row; failing the whole query is a denial of the tenant's own data, and it is triggered by exactly the data state R-022/R-024 describe as expected during Phase 1.

**Expected behaviour.** Decide and document one contract — omit/null the unprovable relation, or raise a typed error that names the offending row and is surfaced as a partial result — and make the include scope and the post-load validator use the same predicate so over-inclusion cannot occur.

**Missing test.** Mixed result sets containing one legacy/unprovable parent, for both to-one and to-many includes.

---

### F-PR2R2-04 — P2 — `connectOrCreate` silently discards sibling nested operations

**File:** `app/tenant/tenant-db.server.ts:521-565`

After rewriting `connectOrCreate`, the block assigns `next.connect = …` / `next.create = …` unconditionally, overwriting any `connect` or `create` the caller supplied on the same relation. Prisma permits both simultaneously on a to-many relation.

**Reproduction (scalar-unique selector so the F-PR2R2-01 path is not hit):**

```text
SC-4  create:[{leadTimeDays:10}] + connectOrCreate:[→create 20]
      outcome=ALLOWED  rows=1  days=[20]   (expected 2: 10,20)   ← caller's create lost, no error

SC-9  connect:[{id:o1}] + connectOrCreate:[→connect o2]
      outcome=ALLOWED  explicitConnect(o1)Applied=false  cocConnect(o2)Applied=true
                                                          ← caller's connect lost, no error
```

Order and element count are otherwise preserved when `connectOrCreate` is used alone (`SC-3`: 1 connect + 2 creates → 3 rows, existing row unchanged). Foreign elements roll the whole operation back correctly (`SC-8`: 0 rows after a foreign element).

**Merchant impact.** Silent data loss on a legitimate write with a success return — the worst failure mode for an inventory application. No cross-tenant exposure.

**Expected behaviour.** Merge rewritten operations into the existing `connect`/`create` arrays rather than replacing them.

**Missing test.** `connectOrCreate` combined with sibling `create` and sibling `connect`.

---

### F-PR2R2-05 — P2 — Four divergent legacy-`shop` normalizations

**Files:** `app/tenant/legacy-scope.ts:56-64, 75-115, 121-140, 146-197, 319-351`

| Path | Predicate | Conflict rule | Whitespace |
|---|---|---|---|
| `resolveDirectTenantScopeWhere` (raw SQL) | `lower(btrim(shop))` | `LIKE '%.myshopify.com' AND <> tenant` | trimmed |
| `rowOwnershipOk` (JS post-load) | `normalizeShopDomain` | `result.ok && normalized !== tenant` | trimmed |
| `directTenantScopeWhereSync` (include injection) | `equals … mode:"insensitive"` | **none** | **not trimmed** |
| `nestedBulkScalarScopeWhere` (nested updateMany/deleteMany) | `equals … mode:"insensitive"` | **none** | **not trimmed** |

The SQL and JS rules are **not semantically equivalent**, contrary to §10. SQL treats any value ending in `.myshopify.com` as a conflicting foreign domain; JS treats it as a conflict only if it normalizes successfully. The divergence is always fail-closed (SQL-conflict ⊇ JS-conflict, so no foreign row is exposed), but it hides rows the stated policy authorizes and it produces the whole-query errors in F-PR2R2-03:

```text
07 canonical shopId + "https://shop-a.myshopify.com"   SQL: conflict (hidden)   JS: authorized
08 canonical shopId + "shop-a.myshopify.com/admin"     SQL: no conflict (shown) JS: authorized
11 canonical shopId + "evil.shop-b.myshopify.com"      SQL: conflict (hidden)   JS: authorized
12 canonical shopId + "-evil.myshopify.com"            SQL: conflict (hidden)   JS: authorized
```

The sync variants also produce a **read/write asymmetry**:

```text
C3  PurchaseOrder{shopId=A, shop="shop-b.myshopify.com"}
    topLevelVisible=false
    supplier.update({purchaseOrders:{updateMany:{where:{},data:{notes:"BULK-TOUCHED"}}}}) -> ALLOWED
    notes=BULK-TOUCHED
```

A row the tenant may not read is mutable through a nested bulk operation. The row carries `shopId = A`, so this is not a demonstrated cross-tenant write; it is an authorization inconsistency on exactly the ambiguous rows the conflict rule exists to quarantine.

**Expected behaviour.** One normalization authority used by all four paths, with the raw-SQL predicate mechanically derived from — or proven equivalent to — `phase1-shop-domain-v1`.

**Missing test.** A shared matrix asserting identical visibility across top-level reads, relation includes, `_count`, and nested bulk mutations for every legacy `shop` shape.

---

### F-PR2R2-06 — P2 — `LeadTimeSnapshot` partial selects omitting the lineage key fail

**Files:** `app/tenant/tenant-db.server.ts:800-804` (`proofFieldsFor`), `:1181-1204` (`assertLeadTimeSecondaryOwnership`)

`proofFieldsFor` injects only `["id","shopId"]` for child models, but `assertLeadTimeSecondaryOwnership` requires `purchaseOrderId` on every returned `LeadTimeSnapshot` row.

```text
leadTimeSnapshot.findFirst({ select: { leadTimeDays: true } })  -> THROW missing_parent_lineage
```

Every other projection shape is exact and leak-free — top-level, nested to-one, nested to-many, 3-level recursive, `select` + `_count`, sibling relations with identical field names, and `create`/`update`/`upsert` results all returned exactly the requested keys with no injected field surviving.

**Expected behaviour.** Add `purchaseOrderId` to the injected proof fields for `LeadTimeSnapshot` and strip it with the others.

---

### F-PR2R2-07 — P3 — Documented byte ceiling is measured in JS string length; multipart cumulative size unchecked

**File:** `app/tenant/client-shop.server.ts:182, 205`

`raw.length` counts UTF-16 code units, not UTF-8 bytes, so `CLIENT_HINT_MAX_BODY_BYTES` (documented as "1 MiB") is not enforced in bytes:

```text
ASCII     jsLen=1048566  utf8=1048566  -> ALLOWED
ASCII     jsLen=1048606  utf8=1048606  -> DENIED  client_shop_hint_limit
MULTIBYTE jsLen=1048566  utf8=3145678  -> ALLOWED   (3.00x the documented ceiling)
```

The multipart branch checks `key.length + value.length` **per field only**; a body whose cumulative size is 4,000,000 bytes across 40 fields is accepted under a 1,048,576-byte limit.

---

### F-PR2R2-08 — P3 — String arrays under a business field named `shop` are treated as tenant hints

**File:** `app/tenant/client-shop.server.ts:122-126`

The specific regression named in §14 is fixed — `{"shop":{"name":"Downtown","address":"123 Main Street"}}` is **ALLOWED**, as is the same shape nested under 50 line items. But the array branch pushes every string element as a hint:

```text
{"shop": ["Downtown", "Uptown"]}   -> DENIED client_shop_conflict
```

Also observed, and consistent with the documented contract: malformed JSON, empty bodies, and bodies sent with `text/plain` or no content-type are not inspected at all. Because hints can only *deny* and never establish authority, these are detection gaps rather than tenant breaks — but they should be stated explicitly in the contract rather than left to a silent `catch`.

Verified correct: conflicting hints denied from query, headers, params, urlencoded, bracketed form keys and multipart (including as the final node of a 1,000-node body); matching hints allowed and never granting authority; node budget 20,000; depth denial from 12 levels.

---

### F-PR2R2-09 — P3 — Scanner misses two `issueTenantAuthority` re-binding shapes

**File:** `scripts/tenant-access/scan.ts`

```text
CAUGHT  issuer imported + called directly              [issue_authority_outside_tenant]
CAUGHT  issuer via IMPORT alias (committed fixture)    [issue_authority_outside_tenant]
MISSED  issuer via LOCAL const alias  (const mint = issueTenantAuthority)
MISSED  issuer via namespace import   (import * as auth; auth.issueTenantAuthority(...))
```

Issuer detection is import-binding-name based, while `db.server` provenance uses the far stronger constant-folding/taint analysis. Since `assertTenantAuthority` still brands at runtime, this is defense-in-depth only — but the asymmetry should be documented, and "intra-file tracking" should be stated precisely: it covers local aliasing, destructuring, object-literal wrapping, identity-helper passthrough, computed member keys and two-file re-export chains for the raw client, and does **not** cover local re-binding of the authority issuer.

---

### F-PR2R2-10 — P3 — The exact follow-up head is recorded nowhere in permanent evidence

* The **PR body is stale**: it still names `e6a9a06a8a399bbfb17687399c59582f1712f442` as "Exact corrected head" and CI run `30676471193`.
* `PR2_TENANT_ACCESS_FOLLOWUP_CORRECTION_IMPLEMENTATION_REPORT.md` leaves **`| Follow-up implementation head |  |` blank**.
* Commit `363c86d`, subject *"Record follow-up implementation head SHA in evidence report"*, records **no SHA**. Its entire diff reworded the adjacent "Handoff head" row to *"recorded in PR body / ChatGPT return"* — deferring to the very document that is stale. The commit subject overstates what it did.
* `grep -rn "99d7a2b" stocky-plus/docs/` returns nothing.

Consequently `99d7a2bb…` appears in no permanent artefact. This is a documentation defect that does not affect runtime safety, but §15 requires it corrected before merge authorization.

**Assessed accurately, and *not* defects:** `PROJECT_STATUS.md` is correct and conservative — it states "FOLLOW-UP CORRECTIONS IN PROGRESS", PR 2 "unaccepted", D-029 "pending second independent correction review", Q-011 "Open — enforcement not implemented". D-029 is plainly authorization, not acceptance. R-064…R-067 all read "pending independent verification". **No document claims this second review has passed.**

---

## 5. Security matrices

### 5.1 Selector forms (F-PR2C-01)

| Case | Result |
|---|---|
| own `id`, object / array | OK |
| own compound (`supplierId_shopifyVariantId`) nested, resolves + rewrites to `{ id }` | OK |
| foreign `id` | `foreign_relation_target` |
| mixed own/foreign array | `foreign_relation_target` |
| malformed (number) / unknown key / extra keys | `unsupported_relation_selector` |
| compound missing field / compound extra field | `unsupported_relation_selector` |
| empty object / `null` / boolean | `unsupported_relation_selector` |
| empty array (`connect: []`) | allowed no-op (correct) |
| bare string selector, own row | allowed (wrapper widens beyond Prisma — see below) |
| bare string selector, **foreign** row | `foreign_relation_target` |
| null-owned row, own lineage | allowed |
| null-owned row, **foreign lineage** | `foreign_relation_target` |
| foreign `shopId_id` compound | `foreign_relation_target` |

**Bare string selectors.** `parseOwnedRelationSelector` (`selectors.ts:207-210`) accepts a bare string as `{ id }`. Prisma does not accept bare strings for nested `connect`, so this widens the wrapper's contract beyond Prisma's. It is **safe** — the string is resolved through the tenant-scoped lookup and rewritten to canonical `{ id }`, so a foreign id is rejected — but it is an intentional widening that is not documented as such and has no committed test. Recommend either documenting it or removing it.

**Metadata completeness.** `MODEL_UNIQUE_SELECTORS` was diffed against every `@id`, `@unique` and `@@unique` in `prisma/schema.prisma` for all 18 merchant models. It matches exactly — no missing and no surplus selector.

### 5.2 Original attacks (all fail closed; no victim row mutated)

| # | Attack | Result | Victim state |
|---|---|---|---|
| 1 | Move Shop B SKU mapping via `supplierId_shopifyVariantId` | `foreign_relation_target` | `supplierId`, `shopId` unchanged |
| 2 | Attach Shop A PO to Shop B supplier via `shopId_id` | `foreign_relation_target` | `supplierId` unchanged |
| 3 | Inject line into Shop B transfer | denied | 0 lines created |
| 4 | Inject line into Shop B stocktake | `not_found` / `foreign_parent` | 0 lines created |
| 5 | Delete/disconnect foreign row via alternate unique | `foreign_relation_target` | row present, `supplierId` unchanged |

### 5.3 `connectOrCreate` (F-PR2C-02)

| Case | Result |
|---|---|
| own existing → connect | OK, existing data not overwritten |
| globally absent → create | OK, `shopId` injected |
| **foreign existing** (`LeadTimeSnapshot.purchaseOrderId` attack) | `foreign_relation_target`; victim still attached to Shop B supplier |
| null-owned same-tenant | OK, connects without overwriting |
| mixed array (1 connect + 2 create) | OK, 3 rows, order preserved, existing unchanged |
| array with one foreign element | `foreign_relation_target`, **0 rows written** (full rollback) |
| good create then foreign element | `foreign_parent`, **0 rows written** |
| sibling `create` + `connectOrCreate` | **caller's create silently lost** (F-PR2R2-04) |
| sibling `connect` + `connectOrCreate`→connect | **caller's connect silently lost** (F-PR2R2-04) |
| compound-unique `where` | **always `PrismaClientValidationError`** (F-PR2R2-01) |

### 5.4 Nested arrays (F-PR2C-03) — closed

| Case | Result |
|---|---|
| `update` array, 2 own elements | allowed |
| `update` array, own + foreign | `foreign_relation_target` (foreign row untouched) |
| `updateMany` attempting `shopId` mutation | `foreign_shop_id` |
| malformed array element | `unsafe_nested_update` |
| empty array / duplicate selector | allowed (Prisma-consistent) |
| `deleteMany` with foreign filter | allowed, scoped, 0 foreign rows affected |
| `disconnect` on required relation | `P2014` (Prisma) |
| **owned parent + foreign-`shopId` child** → nested `updateMany` | child **not** mutated (`INCONSISTENT` preserved) |
| **owned parent + foreign-`shopId` child** → nested `deleteMany` | child **survives** (not deleted) |
| owned parent + null-`shopId` child → nested `updateMany` | mutated (correct: inside the owned collection) |
| **foreign parent + tenant-`shopId` child** | `not_found`; child untouched |

### 5.5 Legacy normalization (F-PR2C-04) — 21-case matrix, tenant A

`findMany=11 count=11 aggregate=11 groupBy=[[null,3],[A,8]]` — reads, counts, aggregates and groupBy agree.

| # | `shopId` | legacy `shop` | findMany | findUnique | findFirst | update | delete | include |
|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 01 | A | canonical | Y | Y | Y | Y | Y | Y |
| 02 | A | UPPERCASE | Y | Y | Y | Y | Y | Y |
| 03 | A | whitespace-padded | Y | Y | Y | Y | Y | Y |
| 04 | A | **foreign normalizable** | . | . | . | . | . | **E** |
| 05 | A | malformed | Y | Y | Y | Y | Y | Y |
| 06 | A | empty | Y | Y | Y | Y | Y | Y |
| 07 | A | URL-shaped | . | . | . | . | . | **E** |
| 08 | A | path-shaped | Y | Y | Y | Y | Y | Y |
| 09 | A | non-Shopify hostname | Y | Y | Y | Y | Y | Y |
| 10 | A | tenant domain as substring | Y | Y | Y | Y | Y | Y |
| 11 | A | subdomain myshopify host | . | . | . | . | . | **E** |
| 12 | A | hyphen-boundary myshopify host | . | . | . | . | . | **E** |
| 13 | NULL | canonical | Y | Y | Y | Y | Y | Y |
| 14 | NULL | UPPERCASE | Y | Y | Y | Y | Y | Y |
| 15 | NULL | whitespace-padded | Y | Y | Y | Y | Y | Y |
| 16 | NULL | foreign | . | . | . | . | . | E |
| 17 | NULL | malformed | . | . | . | . | . | E |
| 18 | NULL | empty | . | . | . | . | . | E |
| 19 | NULL | URL-shaped | . | . | . | . | . | E |
| 20 | NULL | substring host | . | . | . | . | . | E |
| 21 | **B** | canonical A | . | . | . | . | . | n/a |

`Y` visible · `.` hidden · `E` hard error · **Security invariant holds: no foreign row is visible or mutable in any cell.**
Rows 04, 07, 11, 12 are hidden although the stated policy authorizes them (F-PR2R2-05). Column `include` shows the whole-query denial of F-PR2R2-03.

Pagination is correct: `take:10` → `page-00`, `skip:10` → `page-10`, `cursor+skip:1` → 5 remaining.
Raw table identifiers are static (`DIRECT_TABLE` constant map, `Prisma.raw` over a fixed literal); tenant values are bound parameters. **No user-controlled raw SQL.**

### 5.6 Partial projections (F-PR2C-05)

| Selection | Returned keys |
|---|---|
| `select {name}` | `[name]` |
| `select {id,name}` | `[id,name]` |
| `findMany select {name}` | `[name]` |
| child `select {vendorSku}` (omits id/shopId) | `[vendorSku]` |
| `POLineItem select {orderedQty}` (omits parent FK) | `[orderedQty]` |
| nested to-many select | `[name,skuMappings]` → child `[vendorSku]` |
| nested to-one select | `[locationId,supplier]` → `[name]` |
| `select` + `_count` | `[_count,name]` |
| 3-level recursive select | `[name,purchaseOrders]` → `[lineItems,locationId]` → `[orderedQty]` |
| two sibling relations, same field names | `[purchaseOrders,skuMappings]` — no interference |
| `create` / `update` / `upsert` with `select {name}` | `[name]` |
| `update` with `include` | full model + `lineItems` |
| `update` with partial relation projection | `[lineItems,notes]` |
| `LeadTimeSnapshot select {leadTimeDays}` | **`THROW missing_parent_lineage`** |

No injected proof field survived into any result. Array paths stripped correctly; repeated relation names at different depths did not collide.

### 5.7 Atomic writes (F-PR2C-06 / F-PR2C-09) — closed

| Case | Result |
|---|---|
| nested create through `update` | 2 line items (nested write preserved) |
| mixed valid nested create + invalid foreign nested update | `foreign_relation_target`; `notes` not written, 1 line item, victim `orderedQty` unchanged |
| **TOCTOU × 8**: protected update racing a raw-client ownership flip | 8/8 `rejected` · **0/8 foreign mutations** |
| nested `TenantDb.$transaction` | `nested_transaction_unsupported` |
| write inside `TenantDb.$transaction` | OK |
| rollback on error inside `$transaction` | rolled back |

The in-transaction re-check (`tenant-db.server.ts:1345-1354`) uses a scope computed **inside** the same serializable transaction, so the id list is snapshot-consistent and a concurrent ownership change raises a serialization conflict. Retry is bounded at 3 and only for `P2034`/`40001`; ordinary errors are rethrown immediately. **Residual:** writes performed inside a caller's `TenantDb.$transaction` inherit that transaction's default isolation rather than `Serializable`, so the TOCTOU protection is weaker there. This should be documented explicitly alongside the PR 3 residual.

### 5.8 Scanner bypasses (F-PR2C-07) — 20 / 23 caught

| Bypass | Result |
|---|---|
| concatenated dynamic import specifier | CAUGHT |
| array-`join` dynamic import specifier | CAUGHT |
| computed delegate key via `join` | CAUGHT |
| destructured delegate | CAUGHT |
| client wrapped in object literal | CAUGHT |
| identity-helper passthrough | CAUGHT |
| re-export default as named | CAUGHT |
| namespace re-export | CAUGHT |
| two-file re-export chain + use | CAUGHT |
| imported alias | CAUGHT |
| computed raw SQL member | CAUGHT |
| destructured raw SQL method | CAUGHT |
| raw client passed into a helper | CAUGHT |
| queue object through an alias | CAUGHT |
| `.add()` through a computed property | CAUGHT |
| unresolved dynamic import, runtime surface | CAUGHT |
| unresolved dynamic import, test fixture | CAUGHT |
| maintenance module imported into runtime path | CAUGHT |
| issuer imported + called directly | CAUGHT |
| issuer via import alias | CAUGHT |
| **issuer via local const alias** | **MISSED** |
| **issuer via namespace import** | **MISSED** |

### 5.9 Client-hint payloads (F-PR2C-08)

| Payload | Result |
|---|---|
| `{"shop":{"name":"Downtown","address":"123 Main Street"}}` | **ALLOWED** (regression fixed) |
| same nested under 50 line items | ALLOWED |
| `{"shop":["Downtown","Uptown"]}` | **DENIED** (false rejection) |
| conflicting top-level `shop` | DENIED |
| matching top-level `shop` | ALLOWED (never grants authority) |
| conflicting hint as final node of 1,000 | DENIED |
| matching hint as final node of 1,000 | ALLOWED |
| 201 / 1,000 / 5,000 / 9,999 unrelated nodes | ALLOWED |
| depth 11 / 12 / 13 / 20 | ALLOWED / DENIED / DENIED / DENIED |
| ASCII 1,048,566 B / 1,048,606 B | ALLOWED / DENIED |
| **multibyte, 3,145,678 UTF-8 bytes** | **ALLOWED** |
| malformed JSON / empty JSON | ALLOWED (not inspected) |
| `text/plain` or no content-type carrying a hint | ALLOWED (not inspected) |
| urlencoded conflicting / duplicate / bracketed / deep-bracketed | DENIED |
| multipart 2,000 fields + conflicting `shop` | DENIED |
| **multipart cumulative 4,000,000 B** | **ALLOWED** |
| multipart 2 MB file part | ALLOWED (file parts skipped) |

### 5.10 Allowlist paths (F-PR2C-11) — closed

```text
app/tenant/tenant-db.server.ts                 -> EX-TDB-001
other-workspace/app/tenant/tenant-db.server.ts -> (none)
nested/copy/app/tenant/tenant-db.server.ts     -> (none)
fixture-root/app/tenant/tenant-db.server.ts    -> (none)
foo/../app/tenant/tenant-db.server.ts          -> (none)
app/tenant/../tenant/tenant-db.server.ts       -> (none)
./app/tenant/tenant-db.server.ts               -> EX-TDB-001   (leading "./" normalized — intended)
app\tenant\tenant-db.server.ts                 -> EX-TDB-001   (separators normalized — intended)
```

`exceptionForPath` is exact string equality after separator/`./` normalization; no suffix inherits an exception. 68 allowlist entries, all wildcard-free. `*.rdb` and `dump.rdb` are present in the repository-root `.gitignore`, so future Redis dumps cannot be committed from any subdirectory.

---

## 6. Commands and evidence

All commands run from `stocky-plus/` at detached `99d7a2bb…`.

| Command | Result |
|---|---|
| `node --version` | `v22.19.0` |
| `npm --version` | `11.5.2` |
| `npm ci` | EXIT 0 |
| `npx prisma generate` | EXIT 0 |
| `npx prisma validate` | `The schema at prisma/schema.prisma is valid` |
| `npx prisma migrate deploy` | `All migrations have been successfully applied.` |
| `npm run tenant:indexes:apply -- --apply` | 28 created, 0 skipped, 0 failed — EXIT 0 |
| `npm run tenant:indexes:verify` | `{"ok":true,"mismatches":[]}` — EXIT 0 |
| `npm run tenant:schema:drift` | `tenant_prisma_schema_drift_ok` — EXIT 0 |
| `npm run tenant:indexes:plan` | `{"valid_exact":28}` — EXIT 0 |
| `npm run tenant:access:audit` | `tenant_access_audit_ok` — EXIT 0 |
| `npm run tenant:access:inventory` | `findings:662, violations:0` — EXIT 0 |
| `npm run tenant:access:inventory:check` | `tenant_access_inventory_fresh` — EXIT 0 |
| `git status --porcelain` after regeneration | **empty** |
| `npm run test:tenant-access` | **15 files, 157 tests passed** — EXIT 0 |
| `npm run lint` | EXIT 0 |
| `npm run typecheck` | EXIT 0 |
| `npm test` | **6 files, 56 tests passed** — EXIT 0 |
| `npm run test:migrations` | **24 files, 106 tests passed** — EXIT 0 |
| `npm run test:subject-memory` | **1 file, 2 tests passed** — EXIT 0 |
| `npm run build` | EXIT 0 |
| `npm run graphql-codegen` | EXIT 0 |
| `git diff --check` | clean — EXIT 0 |
| `git status --porcelain` (final) | **empty** |

Focused suites (all EXIT 0, inside the 157): `nested-selector-auth` 13 · `tenant-db` 15 · `job-envelope` 25 · `architecture-audit` 24 · `nullable-ownership` 12 · `relation-isolation` 10 · `nested-writes` 8 · `partial-select-update` 6 · `legacy-normalization` 3 · `authority` 11 · `large-payload-hints` 10 · `queue-redis` 4 · `client-hints` 11 · `write-atomicity` 1 · `bootstrap` 4.

### 6.1 Suite totals

**Every command in the required battery returned EXIT 0.** Aggregate locally-executed tests: 157 (tenant-access) + 56 (unit) + 106 (migrations) + 2 (subject-memory) = **321 tests, 46 files, 0 failures**. The verdict is therefore *not* driven by any failing committed check — it is driven by adversarial execution against real PostgreSQL that the committed suites do not perform.

### 6.2 Adversarial probes

Ten temporary probe files were added under `app/tenant/__tests__/` and `scripts/tenant-access/`, executed against real PostgreSQL 16, then **removed**. `git status --porcelain` was empty afterwards and `git rev-parse HEAD` remained `99d7a2bb…`. Probe sources are retained outside the repository. Every finding above is reproduced by execution, not by reading.

---

## 7. Exact-head CI verification

```text
Workflow: CI
Run ID:   30708356574
Job ID:   91391302540
Job:      Lint, typecheck, test, build, Prisma, GraphQL
Head SHA: 99d7a2bb73e77f62bd4ed0029961b40ab04a08e0   (matches the reviewed head)
Event:    pull_request     Attempt: 1
Conclusion: success
```

All 41 numbered steps report `success`, including every step named in §5 of the review standard — architecture audit, inventory freshness, PostgreSQL tests, relation isolation, job-envelope integrity, queue/Redis, client authority denial, nested write ownership, nested selector authorization, connectOrCreate foreign-match, array nested-mutation, legacy normalization, partial-selection, update projection, scanner provenance, large-payload client-hint, write atomicity, negative fixtures, tenant access tests, lint, typecheck, unit tests, migration/backfill, constrained-memory subject evidence, build, GraphQL codegen.

**Green CI is supporting evidence only, and here it is materially misleading.** Every P1 in this report reproduces on the exact head that CI reports green:

* the compound-selector break is not exercised by any committed test;
* no committed test seeds more than a few dozen rows, so the 32,767 limit is never approached;
* no committed test mixes a legacy/unprovable parent into an `include` result set.

Six of the nine new focused CI steps do not add independent coverage: three re-run `nested-selector-auth.test.ts` (twice filtered by `-t`), two re-run `partial-select-update.test.ts` filtered, and one re-runs `architecture-audit.test.ts`, all of which the `Tenant access tests` step already executes in full. `Tenant array nested-mutation tests` filters on `-t "array-form"` and `Tenant connectOrCreate foreign-match tests` on `-t "connectOrCreate"`; a vitest `-t` filter that matches nothing exits 0, so these steps can pass without running any test. This should be corrected so the step names reflect real, distinct coverage.

---

## 8. Documentation findings

| Item | Assessment |
|---|---|
| **Stale PR body** | **Confirmed defect.** Still names `e6a9a06…` as "Exact corrected head" and CI run `30676471193`. Must be updated to `99d7a2bb…` / run `30708356574` before merge authorization. |
| **Blank implementation-head field** | **Confirmed defect.** `\| Follow-up implementation head \|  \|` is empty. Commit `363c86d` — subject "Record follow-up implementation head SHA in evidence report" — recorded no SHA; its whole diff reworded the *Handoff head* row to defer to the stale PR body. The commit subject overstates the change. `99d7a2bb…` appears in no document. |
| **`PROJECT_STATUS` wording** | **Not a defect.** "FOLLOW-UP CORRECTIONS IN PROGRESS" is accurate: corrections are complete but unreviewed and unaccepted. It correctly records PR 2 unaccepted, PR #13 draft/unmerged, D-029 pending second independent review, Q-011 open, PR 3 not started, no deployment/backfill/RLS. It does not overstate closure. |
| **Exact inventory evidence** | **Verified.** Regeneration reproduced the committed file byte-for-byte (`git status` empty): 134 files scanned, 662 findings, 288 converted paths, 374 approved-exception findings, 0 violations, digest `6b30d9e8f16c2a6e07e951a90cf3c1563759a41cd9524181aa7c96f11a6676da`. |
| **D-029** | **Authorization, not acceptance** — confirmed verbatim: "AUTHORIZED FOR PR 2 FOLLOW-UP CORRECTION IMPLEMENTATION — PENDING SECOND INDEPENDENT CORRECTION REVIEW AND CHATGPT ACCEPTANCE". |
| **Risks** | R-064, R-065, R-067 read "Follow-up correction implemented — pending independent verification"; R-066 "pending independent verification (F-PR2-03 closed by independent review)". Correct. |
| **Q-011** | **Open**, correctly stating PR 2 does not close the database-enforcement gate. |
| **No premature pass claim** | **Confirmed.** No document asserts that this second review has passed. |
| Severity drift | Minor: the follow-up implementation report labels F-PR2C-03 as P1; the backlog and D-029 record it as P2. |

---

## 9. Scope and safety

The follow-up range contains **none** of: production or merchant data · secrets · `.env` files · deployment configuration · production backfill · RLS · policies · database runtime or migration roles · `BYPASSRLS` · non-null `shopId` · composite tenant foreign keys · tenant-key triggers · PR 3 implementation · PR 4 persistence tables · inventory mutation · write-flag enablement · unrelated features · broad dependency upgrades.

* `git diff --name-only b5fbd2bd..99d7a2bb -- stocky-plus/prisma/**` → **empty** (no schema or migration change).
* No `.env`, `*.rdb`, `*.pem` or `*.key` file appears in the range.
* Every inventory-write flag remains **default OFF** (`.env.example:29-33`; `app/lib/feature-flags.server.ts` reads them as opt-in env flags).
* The only non-`stocky-plus/` changes are `.github/workflows/ci.yml` (9 added test steps) and the repository-root `.gitignore` (`*.rdb`).

---

## 10. Residual risks

**Acceptable PR 2 residuals**
* Application-layer isolation only; PR 3 composite FKs and RLS remain the enforcement gate (Q-011, F-016, R-022).
* Concurrent unique-insert race in `connectOrCreate` between the scoped miss and the create.
* Scanner analysis is intra-file; cross-file interprocedural taint is not attempted (see §4 F-PR2R2-09 for the precise boundary).
* Client hints deny only and never establish authority; uninspected body encodings are a detection gap, not an authority gap.
* Bare string relation selectors are accepted beyond Prisma's contract but resolved safely.

**PR 3 enforcement dependencies**
* Database-enforced tenant-key immutability; composite tenant foreign keys; forced RLS with `USING`/`WITH CHECK`; restricted runtime role; transaction-local tenant context. Until then the TOCTOU window inside a caller-supplied `TenantDb.$transaction` (non-serializable isolation) remains open.

**PR 4 persistence dependencies**
* R-039 envelope/queue persistence remains PR 4.

**Unacceptable PR 2 defects (block acceptance)**
* F-PR2R2-01 (P1) — compound-unique selectors rejected on owned rows across live call sites.
* F-PR2R2-02 (P1) — hard failure of every read above 32,767 owned rows per direct model.
* F-PR2R2-03 (P1) — whole-query denial from one unprovable to-one parent.
* F-PR2R2-04 (P2) — silent element loss in `connectOrCreate` sibling operations.
* F-PR2R2-05 (P2) — four divergent legacy normalizations; read/write authorization asymmetry.
* F-PR2R2-06 (P2) — `LeadTimeSnapshot` partial selects fail.
* F-PR2R2-07 / -08 / -09 / -10 (P3) — byte accounting and multipart totals, `shop` array false-rejection, issuer alias scanner gaps, evidence identity.

---

## 11. Review environment notes

Two environment facts are recorded for the integrity of this review:

1. **Redis version deviation.** The standard requests Redis 7. Homebrew no longer publishes a Redis 7 formula and Docker was unavailable (see below), so Redis **8.10.0** was used. The queue/Redis suite exercises ordinary BullMQ/ioredis commands and passed (4/4); no finding depends on Redis version behaviour. CI itself runs `redis:7-alpine` and is green on the same suite.

2. **`127.0.0.1:6379` is not a local Redis on this machine.** `lsof` shows a **Cursor process port-forward** on `127.0.0.1:6379` proxying to a remote Redis 7.0.15 running on Linux x86_64 with pre-existing keys (`dbsize` 7) — i.e. the implementation owner's agent environment, not this reviewer's. The repository default `REDIS_URL=redis://localhost:6379` therefore resolves to that foreign instance. All review runs were pinned to an isolated local instance on port **6390** so that no result depended on it. **Recommendation:** anyone re-running this review locally must verify what is actually listening on 6379 before trusting Redis-dependent evidence.

Docker Desktop has been uninstalled from this machine since the previous review (`/usr/local/bin/docker` is a dangling symlink to a removed `/Applications/Docker.app`); PostgreSQL 16.14 and Redis were therefore installed natively via Homebrew and run as disposable local instances with test-only credentials.

---

## 12. Chain of custody

* Implementation code was **not modified**. `git status --porcelain` empty at review start, after every probe removal, and at report time; `git rev-parse HEAD` = `99d7a2bb73e77f62bd4ed0029961b40ab04a08e0` throughout.
* The prior independent correction-review report is unchanged in the follow-up range.
* PR #13 remains **open, draft and unmerged**. Nothing was rebased, amended or force-pushed.
* The only file added by this review is this report.

| Artefact | SHA |
|---|---|
| Reviewed implementation head | `99d7a2bb73e77f62bd4ed0029961b40ab04a08e0` |
| This review report | later report-only commit on `phase-1/tenant-access` |

---

## 13. Exact next action

```text
Return to ChatGPT for the exact Cursor follow-up correction prompt.
```
