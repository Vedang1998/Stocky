# Phase 1 PR 2 — Third Independent Correction Review Report

## 1. Review identity

| Field | Value |
|---|---|
| Review | Phase 1 PR 2 — Tenant-bound access conversion, third correction cycle |
| Repository | `Vedang1998/Stocky` |
| Application | `stocky-plus/` |
| Pull request | [#13](https://github.com/Vedang1998/Stocky/pull/13) |
| Branch | `phase-1/tenant-access` |
| Implementation owner | Cursor |
| Independent reviewer | Claude Code |
| Final technical acceptance authority | ChatGPT |
| Review date | 2026-08-02 |
| Findings under review | F-PR2R2-01 … F-PR2R2-10 |

## 2. Chain of custody (verified)

| Role | SHA | Verified |
|---|---|---|
| Authorized base / `origin/main` | `04289d61f605414597ac85f47830a3c9d2f9e33d` | ✅ exact |
| Cycle-start head (second correction-review report) | `fed21a48a5ae77a61f62b5bd899c698c48a68f49` | ✅ exact merge-base |
| Third-cycle runtime/test implementation head | `d7058294af7eb3d8f287f48cd0657a74475892e7` | ✅ last runtime/test commit |
| **Exact reviewed handoff head** | **`fec8500095197798be183d08b3dd004632adba80`** | ✅ `origin/phase-1/tenant-access` |
| Working tree at review | clean (`git status --porcelain` empty) | ✅ |

Review performed in detached HEAD at `fec8500095197798be183d08b3dd004632adba80`.

### Correction range

```
git merge-base fed21a48… fec8500…  ->  fed21a48a5ae77a61f62b5bd899c698c48a68f49   (exact)
git rev-list --count fed21a48…..fec8500…  ->  11
```

**Commit count is 11, not the expected 12** (see F-PR2R3-05). Merge base is exact, so no
history rewrite is implied by the discrepancy; the assignment's expected count is simply
one higher than the range contains.

| # | SHA | Subject | Class |
|---|---|---|---|
| 1 | `7c1bbca` | Record PR 2 third correction backlog | doc |
| 2 | `b130236` | Restore compound selectors and scalable tenant scopes | runtime |
| 3 | `e8dc76b` | Harden request-byte accounting and authority issuer scan | runtime |
| 4 | `3bcec70` | Add PR 2 scale and functional regression gates | test/CI |
| 5 | `d705829` | Align D-030 tests, allowlist, and mock tenant scopes | **runtime/test head** |
| 6 | `75b3bcc` | Record PR 2 third correction implementation evidence | doc |
| 7 | `c142e8f` | Record third-cycle handoff SHA in evidence report | doc |
| 8 | `476fa8c` | Record exact-head CI evidence for third correction tip | doc |
| 9 | `075b157` | Pin third-cycle handoff tip SHA after CI evidence | doc |
| 10 | `bab5fe9` | Refresh status for third-cycle handoff tip | doc |
| 11 | `fec8500` | Record exact-head CI evidence for third-cycle tip bab5fe9 | doc |

Commits 6–11 are documentation/evidence only — verified by per-commit file lists. ✅

### Preserved reports

`git diff --name-only fed21a48..fec8500` for the three preserved report paths returns **empty**:

- `PR2_TENANT_ACCESS_REVIEW_REPORT.md` — unchanged ✅
- `PR2_TENANT_ACCESS_CORRECTION_REVIEW_REPORT.md` — unchanged ✅
- `PR2_TENANT_ACCESS_FOLLOWUP_CORRECTION_REVIEW_REPORT.md` — unchanged ✅

No Prisma schema or migration file appears in the range. No unrelated phase work. ✅

## 3. Verdict

> ## NOT READY — FURTHER CORRECTIONS REQUIRED

**Counts: P0 = 0 · P1 = 0 · P2 = 3 · P3 = 4**

No cross-tenant read or write was reproduced at this head. Every prior attack remains
closed. The tenant-isolation posture is materially correct. The verdict is driven by
three P2 defects — a surviving bind-parameter cliff, a silent wrong-row mutation on
coerced selectors, and a false JS/SQL normalization-equivalence claim that permanently
hides owned merchant rows — plus a focused gate whose name overstates its coverage
(explicit READY blocker under the assignment's §6).

## 4. Environment

| Component | Value |
|---|---|
| Node | v22.22.2 |
| npm | 11.5.2 (pinned; `packageManager` / `engines` satisfied) |
| PostgreSQL | 16.13 (Ubuntu), disposable cluster `/var/lib/postgresql/pr2review` |
| PostgreSQL host/port | `127.0.0.1:55432`, user `stocky`, trust auth, databases `stocky_test` + `probe_db` |
| Redis | 7.0.15, **isolated**, `127.0.0.1:56379`, `run_id 96a1828eb2dbafa492e8176dff4c34e0d39b2155` |
| Redis DBSIZE before | `0` |
| Redis DBSIZE after cleanup | `7` observed, then `FLUSHALL` → `0` |
| Port 6379 | **Connection refused** — no unidentified Redis instance was used ✅ |
| RDB inspection instance | second isolated Redis on `127.0.0.1:56380`, shut down and directory removed |
| Prisma | engines available; `generate` / `validate` / `migrate deploy` all succeeded |
| Envelope secret | test-only, from env; never committed |
| Data | synthetic fixtures only; **no production or merchant data** |

## 5. Command results

| Command | Exit | Result |
|---|---|---|
| `node --version` | 0 | v22.22.2 |
| `npm --version` | 0 | 11.5.2 |
| `npm ci` | 0 | clean install |
| `npx prisma generate` | 0 | client generated |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma migrate deploy` | 0 | all migrations applied |
| `npm run tenant:indexes:apply -- --apply` | 0 | 28 created, 0 skipped, 0 failed¹ |
| `npm run tenant:indexes:verify` | 0 | `ok: true`, 0 mismatches |
| `npm run tenant:schema:drift` | 0 | `tenant_prisma_schema_drift_ok` |
| `npm run tenant:indexes:plan` | 0 | `{ valid_exact: 28 }` |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok`, `modelsCovered: 18` |
| `npm run tenant:access:inventory` | 0 | 813 findings, **0 violations** |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| **Inventory regeneration tree check** | — | `git status --porcelain` **empty — tree unchanged** ✅ |
| `npm run test:tenant-access` | 0 | **23 files, 198 tests passed** |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm test` | 0 | 6 files, 56 tests passed |
| `npm run test:migrations` | 0 | **24 files, 106 tests passed** (clean re-run²) |
| `npm run test:subject-memory` | 0 | 2 tests passed |
| `npm run build` | 0 | built |
| `npm run graphql-codegen` | 1 | **BLOCKED — environment**³ |
| `git diff --check` | 0 | clean |

¹ `tenant:indexes:apply` requires `TENANT_MAINTENANCE_DATABASE_URL`; `DATABASE_URL` alone is
correctly refused for mutating index apply. This is correct safety behavior, not a defect.

² An initial `test:migrations` run reported 1 failure. Root cause was **my own** reviewer probe
suite concurrently dropping the shared `public` schema, not the implementation. A clean
re-run with probes removed passes 106/106.

³ `graphql-codegen` fails locally with
`Host not in allowlist: shopify.dev` — the sandbox network egress policy blocks the Shopify
Admin schema fetch. This is a review-environment limitation, not a code defect. CI step 49
(`GraphQL codegen / schema validation`) succeeded at `fec8500…`. This does not fall within
the §6 blocked-verification categories (PostgreSQL, Redis, Prisma, GitHub were all available).

### Focused files run separately

| File | Reported | Observed | Match |
|---|---|---|---|
| `top-level-unique-selectors.test.ts` | 7 | **7** | ✅ |
| `tenant-scope-scale.test.ts` | 6 | **6** | ✅ |
| `mixed-relation-ownership.test.ts` | 5 | **5** | ✅ |
| `connect-or-create-merge.test.ts` | 4 | **4** | ✅ |
| `normalization-consistency.test.ts` | 2 | **2** | ✅ |
| `lead-time-partial-select.test.ts` | 3 | **3** | ✅ |
| `client-hint-byte-limits.test.ts` | 7 | **7** | ✅ |
| `authority-issuer-scanner.test.ts` | 7 | **7** | ✅ |
| Full tenant-access suite | 198 | **198** | ✅ |

Every reported count is accurate. All eight files execute real tests (non-zero, all passing).

## 6. Exact-head CI verification

| Field | Expected | Observed | Match |
|---|---|---|---|
| Workflow | CI | CI | ✅ |
| Run ID | 30736427413 | 30736427413 | ✅ |
| Job ID | 91465920750 | 91465920750 | ✅ |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL | identical | ✅ |
| `head_sha` | `fec8500…` | `fec8500095197798be183d08b3dd004632adba80` | ✅ |
| Run conclusion | success | success | ✅ |
| Job conclusion | — | success | ✅ |
| Run attempt | — | 1 | ✅ |

All 49 material steps completed with conclusion `success`, including steps 32–39 (the eight
focused tenant gates), 41 (full tenant access), 42 (git diff check), 43 (lint), 44 (typecheck),
45 (unit tests), 46 (migrations), 47 (constrained-memory subject evidence), 48 (build),
49 (GraphQL).

**Distinct-file verification:** `.github/workflows/ci.yml` invokes each focused step with a
distinct explicit test path via `npm run test:tenant-access -- <file>`. **No `-t` filters exist
anywhere in the workflow**, so no step can pass on zero matches. ✅

### Live PR state

| Field | Expected | Observed | Match |
|---|---|---|---|
| State | open | open | ✅ |
| Draft | true | true | ✅ |
| Merged | false | false | ✅ |
| Mergeable state | mergeable | `clean` | ✅ |
| Base branch / SHA | `main` / `04289d61…` | `main` / `04289d61…` | ✅ |
| Head branch / SHA | `phase-1/tenant-access` / `fec8500…` | identical | ✅ |
| Commits | — | 40 | recorded |
| Changed files | — | 120 (+17386 / −634) | recorded |

## 7. Dispositions — F-PR2R2-01 … F-PR2R2-10

| ID | Sev | Disposition | Evidence |
|---|---|---|---|
| F-PR2R2-01 | P1 | **CLOSED** (new P2 raised on adjacent behavior) | Compound wrappers flattened to scalar predicates before scoped lookup; `MODEL_UNIQUE_SELECTORS` matches `schema.prisma` exactly for all 18 models; 7/7 tests; my probes confirm foreign selectors denied. See F-PR2R3-02. |
| F-PR2R2-02 | P1 | **PARTIALLY CLOSED — P2 remains** | Owned-row-count dimension fully closed (30 000 / 32 766 / 32 767 / 32 768 / 40 000 all pass; no row-ID list in scope args). Distinct-legacy-form dimension **fails at ~32 765**. See F-PR2R3-01. |
| F-PR2R2-03 | P1 | **CLOSED** | Unprovable/foreign to-one → `null`; to-many filtered; parent rows preserved; `_count` excludes filtered children; 5/5 tests; independently reproduced via reviewer probe (to-one include honors D-030 exactly). |
| F-PR2R2-04 | P2 | **CLOSED** | `appendNestedOperation` concatenates existing + rewritten items, normalizes scalar↔array, never overwrites; 4/4 tests. |
| F-PR2R2-05 | P2 | **CLOSED WITH GAPS — P2 + P3 remain** | Single D-030 path confirmed; behavior independently verified correct across aggregate/groupBy/findFirst/updateMany/deleteMany/to-one include. But see F-PR2R3-03 (whitespace class) and F-PR2R3-04 (gate name/coverage). |
| F-PR2R2-06 | P2 | **CLOSED** | `leadTimeSnapshot.findFirst({select:{leadTimeDays:true}})` returns exactly `["leadTimeDays"]`; `purchaseOrderId` injected, secondary PO ownership asserted, proof fields stripped; foreign/missing lineage fails closed; 3/3 tests. |
| F-PR2R2-07 | P3 | **CLOSED** | Actual UTF-8 body bytes for JSON / URL-encoded / multipart / files; exact-limit, one-over, multibyte, cumulative, malformed and empty JSON covered; 7/7 tests. |
| F-PR2R2-08 | P3 | **CLOSED** | Key-specific hint semantics: `{"shop":["Downtown","Uptown"]}` allowed, `{"shop":["shop-b…"]}` denied, `{"shop":{"name":…}}` allowed, `{"shop":{"myshopifyDomain":"shop-b…"}}` denied. Matching hints never establish authority. |
| F-PR2R2-09 | P3 | **CLOSED** | All six alias forms detected: direct call, imported alias, local `const` alias, namespace import, destructured namespace, computed property, identity-helper passthrough; approved boundary usage still allowed; 7/7 tests. |
| F-PR2R2-10 | P3 | **CLOSED WITH P3** | Permanent evidence and eight distinct focused CI gates exist and execute. See F-PR2R3-05 / F-PR2R3-06. |

## 8. Prior security regression matrix

All twelve prior attacks re-run at `fec8500…`. **Zero regressions.**

| # | Attack | Result | Evidence |
|---|---|---|---|
| 1 | Shop B SKU mapping moved via alternate selector | **DENIED** | tenant-access suite + reviewer probe |
| 2 | Shop A PO → Shop B supplier via `shopId_id` | **DENIED** | reviewer PROBE-6: throws; `purchaseOrder.count() == 0` |
| 3 | Shop B transfer line injection | **DENIED** | nested-writes / relation-isolation suites |
| 4 | Shop B stocktake line injection | **DENIED** | nested-writes / relation-isolation suites |
| 5 | Foreign child delete/disconnect via alternate selectors | **DENIED** | reviewer PROBE-5: throws; foreign row count unchanged |
| 6 | Foreign `connectOrCreate` match | **FAILS CLOSED** | connect-or-create-merge + nested-selector-auth suites |
| 7 | Mixed nested arrays roll back completely | **CONFIRMED** | write-atomicity suite (serializable tx) |
| 8 | Worker-envelope tampering | **DENIED** | job-envelope suite; HMAC-SHA256, ≥32-byte secret |
| 9 | Client hints establishing authority | **DENIED** | client-hints + client-hint-byte-limits suites |
| 10 | Raw-Prisma scanner (dynamic/computed/re-export) | **CAUGHT** | `tenant:access:audit` exit 0, 18 models, 0 violations |
| 11 | Ownership-change race probes | **ZERO foreign mutations** | serializable tx + in-transaction re-check (`stillOwned`) |
| 12 | Inventory-write flags default OFF | **ALL OFF** | `app/lib/feature-flags.server.ts` unchanged in range; 5/5 default `false` |

Additional reviewer-authored cross-tenant probes, all **DENIED**:

- Foreign row invisible via `findMany`, `count`, and compound `findUnique` (PROBE-3).
- `shopId_id` with foreign `shopId` on `update` (PROBE-4) — throws, foreign row byte-identical.
- `upsert` with foreign `shop` in compound selector (PROBE-8) — rejected `unsafe_upsert`, foreign row untouched.

## 9. Selector matrix

`MODEL_UNIQUE_SELECTORS` was diffed against `prisma/schema.prisma` for all 18 merchant-owned
models. **Every schema unique constraint is enumerated, and no selector exists that the schema
does not define.**

| Model | Schema uniques | Selector metadata | Match |
|---|---|---|---|
| Supplier | `@@unique([shopId,id])` | `id`, `shopId_id` | ✅ |
| PurchaseOrder | `@@unique([shopId,id])` | `id`, `shopId_id` | ✅ |
| TransferOrder | `@@unique([shopId,id])` | `id`, `shopId_id` | ✅ |
| Stocktake | `@@unique([shopId,id])` | `id`, `shopId_id` | ✅ |
| ShopifyVariantCache | `@@unique([shop,shopifyVariantId])` | `id`, `shop_shopifyVariantId` | ✅ |
| InventorySnapshot | `@@unique([shop,shopifyVariantId,locationId,snapshotDate])` | `id`, compound | ✅ |
| VariantAbcClass | `@@unique([shop,shopifyVariantId,locationId,metric])` | `id`, `shop_shopifyVariantId_locationId_metric` | ✅ |
| ForecastOverride | `@@unique([shop,variantId,locationId])` | `id`, `shop_variantId_locationId` | ✅ |
| SalesDailyAggregate | `@@unique([shop,shopifyVariantId,locationId,date])` | `id`, `shop_shopifyVariantId_locationId_date` | ✅ |
| ShopSettings | `shop @unique` | `id`, `shop` | ✅ |
| BomComponent | `@@unique([shop,bundleVariantId,componentVariantId])` | `id`, `shop_bundleVariantId_componentVariantId` | ✅ |
| SupplierSkuMapping | `@@unique([supplierId,shopifyVariantId])` | `id`, `supplierId_shopifyVariantId` | ✅ |
| LeadTimeSnapshot | `purchaseOrderId @unique` | `id`, `purchaseOrderId` | ✅ |
| LowStockAlert | — | `id` | ✅ |
| VolumePriceTier | — | `id` | ✅ |
| POLineItem | — | `id` | ✅ |
| TransferLineItem | — | `id` | ✅ |
| StocktakeLineItem | — | `id` | ✅ |

All seven explicitly named selectors are present and exercised. Selector validation rejects:
missing compound components, extra fields, unknown keys, malformed values, empty/boolean
selectors, and multi-key WhereUniqueInput. Owned / foreign / missing / null-owned-matching
cases behave per D-030 across `findUnique`, `findUniqueOrThrow`, `update`, `delete`, and
`upsert` (where the tenant-bearing gate permits it).

**Live workflow regression:** no `PrismaClientValidationError` observed. The four runtime call
sites updated in the range (`app.purchase-orders.tsx`, `app.purchase-orders_.$id.receiver.tsx`,
`app.warehouse.tsx`, `forecasting.server.ts`) typecheck, lint, build, and pass the full suite.

## 10. Scale evidence (F-PR2R2-02)

### Owned-row-count dimension — CLOSED

Executed on live PostgreSQL 16.13 at 30 000 / 32 766 / 32 767 / 32 768 / 40 000 rows across
`findMany({take:1})`, filtered `findMany`, `count`, `aggregate`, `groupBy`, cursor pagination,
skip/take pagination, narrow `updateMany`, narrow `deleteMany`, and `create` — for canonical
non-null `shopId`, null `shopId` with one legacy representation, and mixed canonical + null +
multiple legacy forms.

- No bind-limit failure at any size ✅
- Generated scope arguments contain **no row-ID list** ✅
- Parameter count tracks distinct legacy forms, not owned-row count ✅
- Pagination correct ✅
- `create` performs no unnecessary scope discovery ✅

### Distinct-legacy-form dimension — **FAILS** (F-PR2R3-01)

The assignment explicitly required determining whether corrupt or adversarial historical values
could approach the bind limit. **They can, and the query fails.** Independent reviewer probe
seeding N distinct raw legacy `shop` strings (varying leading-space counts, all normalizing to
the tenant domain) against `Supplier.count()`:

| Distinct raw legacy forms | Result |
|---|---|
| 32 000 | **OK** — `count = 32000` |
| 32 765 | **THREW** `PrismaClientKnownRequestError` |
| 32 766 | **THREW** |
| 32 767 | **THREW** |
| 32 768 | **THREW** |
| 33 000 | **THREW** |

Also reproduced at 40 000 forms on `ShopifyVariantCache`. The cliff was **relocated**, not
removed.

## 11. D-030 ownership matrix

Rule verified as implemented in `rowOwnershipOk` and `buildDirectTenantScopeWhere`:

| Row state | Expected | Observed |
|---|---|---|
| non-null `shopId` = tenant | owned; legacy `shop` cannot hide it | ✅ owned |
| non-null `shopId` = foreign | denied | ✅ denied |
| null `shopId` | normalized legacy must match | ✅ per normalizer |

Legacy value classes tested (canonical, uppercase, leading/trailing/surrounding whitespace,
URL-shaped, path-shaped, malformed, empty, null, foreign domain, non-Shopify hostname,
substring, subdomain-like, hyphen-boundary) against canonical and null `shopId`.

Reviewer-authored matrix over the operations the shipped gate does **not** cover — 10 shapes
each — all agreed exactly with D-030:

| Operation | Owned rows expected | Observed | Match |
|---|---|---|---|
| `aggregate` | 6 | `_count._all = 6` | ✅ |
| `groupBy` | 6 | total 6 | ✅ |
| `findFirst` (per-row) | 6 | 6 hits, correct rows | ✅ |
| top-level `updateMany` | 6 | `count = 6`; exactly the owned rows mutated | ✅ |
| top-level `deleteMany` | 6 | `count = 6`; 4 unowned rows survive | ✅ |
| to-one `include` | 6 | foreign/unprovable suppliers → `null`, parents preserved | ✅ |

**No row was visible through one path but mutable through another.** Reviewer probe confirmed a
tab-padded null-owned row is consistently hidden from `findMany`, `findUnique`, **and** to-one
`include` — see F-PR2R3-03 for the separate consistency defect this exposes.

## 12. Mixed relation matrix (F-PR2R2-03)

| Scenario | Expected | Observed |
|---|---|---|
| Owned parent, provably owned to-one | relation returned | ✅ |
| Owned parent, unprovable/foreign to-one | relation `null`, no field leakage | ✅ (`scrubRelationPayload` deletes every key) |
| Remaining parents | continue | ✅ |
| To-many owned children | returned | ✅ |
| To-many valid null-owned children | returned | ✅ |
| To-many foreign/unprovable children | filtered | ✅ |
| `_count` | excludes filtered children | ✅ |
| 10 POs / 9 canonical + 1 null-owned matching supplier | all 10 parents, 10 suppliers | ✅ |
| 1 malformed null-owned supplier | supplier `null`, parent kept | ✅ |
| Canonical supplier w/ malformed or foreign legacy | returned (D-030) | ✅ |
| Nested relations, partial selection, parent pagination | correct | ✅ |

Consumer null-safety was inspected for the four updated runtime call sites: all handle a `null`
supplier. No crashes, no invented supplier data, no unsafe non-null assertions, no silent
parent-row removal.

## 13. Request-byte and shop-hint tests

| Case | Expected | Observed |
|---|---|---|
| JSON / URL-encoded / multipart / multipart-file byte accounting | actual UTF-8 bytes | ✅ |
| Exact limit | allowed | ✅ |
| One byte over | denied | ✅ |
| Multibyte below / above | correct | ✅ |
| Cumulative multipart + file sizes | correct | ✅ |
| Malformed JSON / empty JSON | safe | ✅ |
| `{"shop":["Downtown","Uptown"]}` | allowed | ✅ allowed |
| `{"shop":["shop-b.myshopify.com"]}` as Shop A | denied | ✅ denied |
| `{"shop":{"name":"Downtown","address":"123 Main Street"}}` | allowed | ✅ allowed |
| `{"shop":{"myshopifyDomain":"shop-b.myshopify.com"}}` | denied | ✅ denied |
| Matching hint establishes authority | never | ✅ never |

## 14. Authority-issuer scanner tests

| Probe | Result |
|---|---|
| `const mint = issueTenantAuthority; mint(...)` | ✅ caught, stable code |
| `import * as authority; authority.issueTenantAuthority(...)` | ✅ caught |
| `const {issueTenantAuthority: mint} = authority; mint(...)` | ✅ caught |
| `const method = "issue" + "TenantAuthority"; authority[method](...)` | ✅ caught |
| `const mint = identity(issueTenantAuthority); mint(...)` | ✅ caught |
| Direct import call | ✅ caught |
| Approved boundary usage | ✅ still allowed |

Prior raw-Prisma scanner probes re-run via `tenant:access:audit`: exit 0, 18 models covered,
**0 violations**, provenance and exact allowlist matching intact.

## 15. Redis history conclusion

The carried-forward requirement is now **complete**.

| Field | Value |
|---|---|
| Blob | `cae7715f893091a413923b54488f74c59a71e058` (`dump.rdb`) |
| Size | **843 bytes** |
| Introducing commit | `45d9d90` — "Record PR 2 correction implementation" (Cursor Agent, 2026-08-01) |
| Deleting commit | `20659dd` — "Remove accidental Redis dump.rdb from correction branch" |
| Reachable from reviewed head | **Yes** — still present in retained history |
| Keys | 6 |

Loaded into a dedicated isolated Redis (`127.0.0.1:56380`) and fully enumerated. All six keys
are BullMQ queue state for `bull:stocky-cron`: `:events` (stream), `:marker` (zset), `:meta`
(hash), `:wait` (list), `:1` (job hash), `:id` (string).

**Classification: synthetic test data only.**

- `myshopifyDomain` is `phase1-pr2-shop-a.myshopify.com` — the literal fixture constant
  `SHOP_A_DOMAIN` in `app/tenant/__tests__/helpers.ts`.
- `shopId` is a cuid from a disposable test database; `correlationId` is the literal `corr-redis-a`.
- Job is `catalog-sync` with default backoff options.

**Absent:** credentials, API keys, access tokens, sessions, webhook payloads, PII, merchant
data, and production identifiers. ✅

**Envelope secret derivation: not feasible.** The envelope carries one HMAC-SHA256 signature
(43-char base64url). `TENANT_JOB_ENVELOPE_SECRET` is read from the environment, never committed,
and `job-envelope.server.ts` enforces `ENVELOPE_SECRET_MIN_BYTES = 32`. Recovering a ≥32-byte
key from a single HMAC-SHA256 output over a known message is computationally infeasible.
Signature values are not reproduced in this report.

**Recurrence prevented:** repository-root `.gitignore` lines 1–2 are `*.rdb` and `dump.rdb`. ✅

**Retained Git history is acceptable.** No rotation and no history sanitization are required.
An optional cleanup is recorded as F-PR2R3-07 (P3, non-blocking).

## 16. New findings

### F-PR2R3-01 — Tenant scope still hits the PostgreSQL bind limit via distinct legacy forms

- **Severity:** **P2**
- **File/line:** `stocky-plus/app/tenant/legacy-scope.ts:144-164` (`buildDirectTenantScopeWhere`),
  `:172-214` (`resolveMatchingRawLegacyShops`)
- **Reproduction:** Seed N rows with `shopId = null` and pairwise-distinct raw `shop` values that
  all normalize to the tenant domain (e.g. `" ".repeat(i+1) + domain`). Call
  `tenantDb.supplier.count({})`.
- **Actual behavior:** `shop: { in: [...] }` receives one bind parameter per distinct raw form.
  32 000 forms → OK. **32 765 forms → `PrismaClientKnownRequestError`.** Fails identically at
  32 766 / 32 767 / 32 768 / 33 000, and at 40 000 on `ShopifyVariantCache`. Every read, write,
  and aggregate on that model becomes permanently unavailable for that tenant.
- **Expected behavior:** The tenant predicate must not fail at any number of distinct legacy
  representations — via SQL-side `lower(btrim("shop")) = $1` pushed into the scope predicate,
  chunked `OR` groups, or a bounded cap with explicit quarantine.
- **Impact:** F-PR2R2-02 relocated the bind cliff from owned-row count to distinct-legacy-form
  count rather than eliminating it. D-030 §4/§5 claim the cliff is removed; that claim is only
  true for the row-count dimension. Not reachable by an external attacker (application writes
  always set a non-null `shopId`, so no new null-`shopId` rows are created), but reachable
  through corrupt or adversarial historical data, which is precisely the population this
  compatibility path exists to serve.
- **Correction:** Replace the materialized `in` list with a scope predicate that evaluates the
  normalization in SQL, or chunk/cap with quarantine reporting.
- **Missing test:** A scale test parameterized on **distinct legacy representation count**
  (not row count) crossing 32 767.
- **Blocks acceptance:** **Yes.**

### F-PR2R3-02 — Foreign `shop` in a unique selector is silently coerced, mutating the wrong row

- **Severity:** **P2**
- **File/line:** `stocky-plus/app/tenant/selectors.ts:351-353`; `tenant-db.server.ts:1241-1256`
  (`coerceDirectShopInWhere`)
- **Reproduction:** As Shop A, with both shops holding a `ShopifyVariantCache` row for variant
  `SHARED`:
  ```ts
  dbA.shopifyVariantCache.update({
    where: { shop_shopifyVariantId: { shop: SHOP_B_DOMAIN, shopifyVariantId: "…/SHARED" } },
    data: { sku: "MUTATED" },
  })
  ```
- **Actual behavior:** **ACCEPTED.** `predicate.shop` is overwritten with the authenticated
  domain, so the call resolves to and mutates **Shop A's own, different row** (`sku` → `MUTATED`).
  Shop B's row is correctly untouched. The caller receives success for a row it never selected.
- **Expected behavior:** A `shop` value in a unique selector that does not normalize to the
  authenticated domain should be **rejected** with `foreign_shop_domain` — exactly as
  `rejectForeignShopId` (`tenant-db.server.ts:131-143`) already does for the same value in
  `data`. Coercion should be limited to case/whitespace variants of the caller's own domain.
- **Impact:** No cross-tenant exposure — the isolation boundary holds. But a silent wrong-row
  write on a merchant-owned model is a data-integrity defect and an internal inconsistency:
  the same foreign domain is a hard error in `data` and a silent rewrite in `where`. `upsert`
  already fails closed here (`unsafe_upsert`), so `update`/`delete` are the outliers.
- **Correction:** Normalize the selector `shop` via `normalizeShopDomain` and reject when the
  result is not the authenticated domain; keep coercion only for case/whitespace variants.
- **Missing test:** Foreign-domain `shop` in every compound selector across `findUnique`,
  `update`, `delete` asserting rejection rather than own-row retargeting.
- **Blocks acceptance:** **Yes.**

### F-PR2R3-03 — `lower(btrim())` is not equivalent to JS `trim()`; owned legacy rows are permanently invisible

- **Severity:** **P2**
- **File/line:** `stocky-plus/app/tenant/legacy-scope.ts:166-171` (equivalence claim),
  `:198-207` (SQL); `app/tenant/shop-domain.ts:43` (`raw.trim()`)
- **Reproduction:** Insert a row with `shopId = null` and `shop = "\t" + SHOP_A_DOMAIN`. Query
  as Shop A.
- **Actual behavior:** `normalizeShopDomain` returns `ok: true` and `rowOwnershipOk` returns
  `true` — D-030 deems the row **owned**. But PostgreSQL `btrim(text)` strips **spaces only**,
  so `lower(btrim(shop)) = $1` is false and the row is excluded from the scope. Verified
  directly:

  | Padding | JS `normalizeShopDomain` | `rowOwnershipOk` | SQL `lower(btrim())` match |
  |---|---|---|---|
  | space | ok | true | **true** |
  | tab `\t` | ok | true | **false** |
  | newline `\n` | ok | true | **false** |
  | CR `\r` | ok | true | **false** |
  | VT `\v`, FF `\f` | ok | true | **false** |

  Result: the row returns 0 from `findMany`, `count`, `findUnique`, and to-one `include` — it is
  invisible and unmutable through every tenant path.
- **Expected behavior:** The SQL scope predicate must implement the same whitespace class as
  `phase1-shop-domain-v1`, e.g. `lower(btrim(shop, E' \t\n\r\v\f'))`, or the normalizer must
  restrict trimming to spaces so the two agree.
- **Impact:** **Fail-closed — no cross-tenant exposure.** But merchant rows that D-030 defines as
  owned silently disappear with no error and no operator signal. The load-bearing code comment
  asserting the SQL form is "proven equivalent to the null-branch of `phase1-shop-domain-v1`"
  is false, which undermines the correctness argument for the entire null-`shopId` branch.
- **Correction:** Align the two implementations and correct the comment; add the divergent
  whitespace class to the diagnostics/quarantine reporting so hidden rows are discoverable.
- **Missing test:** Legacy-shape matrix including tab/newline/CR/VT/FF padding, asserting
  identical outcomes from `rowOwnershipOk` and every scoped query path.
- **Blocks acceptance:** **Yes.**

### F-PR2R3-04 — Normalization-consistency gate names coverage it does not contain

- **Severity:** **P3**
- **File/line:** `stocky-plus/app/tenant/__tests__/normalization-consistency.test.ts:192`
- **Reproduction:** The test is titled *"top-level findMany/findUnique/count/updateMany/deleteMany
  agree with ownership"*. Grep the file for top-level `updateMany` / `deleteMany` calls.
- **Actual behavior:** The file contains **zero** top-level `updateMany`, `deleteMany`,
  `aggregate`, `groupBy`, `upsert`, `findFirst`, or `delete` calls through the tenant DB. It
  exercises `findMany`, `findUnique`, `count`, and one **nested** `purchaseOrders.updateMany`.
  Against §10's required operation list, the D-030 matrix omits `findFirst`, `aggregate`,
  `groupBy`, top-level `update`/`updateMany`/`delete`/`deleteMany`, `upsert`, to-one and
  to-many includes, nested select, and `_count`.
- **Expected behavior:** Either the title reflects actual coverage, or the operations it names
  are exercised.
- **Impact:** **The underlying behavior is correct** — I independently verified `aggregate`,
  `groupBy`, `findFirst`, top-level `updateMany`, top-level `deleteMany`, and to-one `include`
  all honor D-030 exactly (§11). So this is a gate-integrity defect, not a latent bug: the
  named gate would not catch a future D-030 regression in those operations, while its name tells
  reviewers and the acceptance authority that it would. Under the assignment's §6 and §16 this
  is an explicit READY blocker.
- **Correction:** Extend the test to the full §10 operation list, or rename it to its true scope.
- **Missing test:** The operations enumerated above against the existing 23-shape legacy matrix.
- **Blocks acceptance:** **Yes** (per §6/§16 gate-integrity rule).

### F-PR2R3-05 — Correction range contains 11 commits, not the expected 12

- **Severity:** **P3**
- **Evidence:** `git rev-list --count fed21a48..fec8500` → **11**.
- **Actual vs expected:** 11 vs 12. Merge base is exactly `fed21a48…`, preserved reports are
  byte-identical, and no force-push or rewrite is evidenced.
- **Impact:** Chain-of-custody bookkeeping only; no material effect on the reviewed content.
- **Correction:** Reconcile the expected count in the handoff prompt/evidence.
- **Blocks acceptance:** No.

### F-PR2R3-06 — Permanent evidence names a non-final SHA as "final handoff tip"

- **Severity:** **P3**
- **File/line:** `stocky-plus/docs/PROJECT_STATUS.md:21`;
  `PR2_TENANT_ACCESS_SECOND_FOLLOWUP_CORRECTION_IMPLEMENTATION_REPORT.md:19,21,91-98`
- **Actual behavior:** Both record `bab5fe90…` (run `30736171401`) as the **final handoff tip**.
  The actual PR tip and reviewed head is `fec8500…` (run `30736427413`).
- **Assessment (§20):** The PR body **does** disambiguate — it records `fec8500…` explicitly with
  its own green run, marks `d7058294…` as the runtime/test head, and the implementation report
  carries a note at line 114 that later evidence-only commits advance the tip. `fec8500…`
  differs from `bab5fe90…` by documentation only, so permanent evidence does **not**
  misrepresent the reviewed *implementation*, and this is not a §6 READY blocker on its own.
  **A P3 documentation correction nonetheless remains**, because `PROJECT_STATUS.md` is the
  canonical status document and its "final handoff tip" field is factually not the final tip.
- **Correction:** Update `PROJECT_STATUS.md:21` to `fec8500…` / run `30736427413`, or rename the
  field to "green tip before final evidence".
- **Blocks acceptance:** No.

### F-PR2R3-07 — Synthetic `dump.rdb` blob remains reachable in retained history

- **Severity:** **P3**
- **Evidence:** Blob `cae7715f…` (843 bytes) reachable from `fec8500…`; introduced `45d9d90`,
  deleted `20659dd`.
- **Impact:** None material — contents are synthetic test fixtures only (§15). No secret is
  recoverable. Recurrence is prevented by `.gitignore`.
- **Correction:** Optional history purge at a future rewrite-safe moment. **No rotation required.**
- **Blocks acceptance:** No.

## 17. Documentation findings

| Item | Required | Observed |
|---|---|---|
| D-030 records canonical `shopId` authority | yes | ✅ accurate and complete (`DECISIONS.md` §3) |
| Runtime/test implementation head = `d7058294…` | yes | ✅ recorded in PR body, PROJECT_STATUS, implementation report |
| Final handoff head = `fec8500…` | yes | ⚠️ PR body ✅; PROJECT_STATUS / implementation report say `bab5fe90…` (F-PR2R3-06) |
| Final CI run/job tied to `fec8500…` | yes | ✅ PR body records run `30736427413` / job `91465920750`; verified against GitHub |
| PR body current | yes | ✅ accurate, including the focused-count table |
| PROJECT_STATUS conservative | yes | ✅ PR 2 unaccepted, third cycle in progress, no deployment/backfill/RLS |
| Q-011 open | yes | ✅ open — "enforcement not implemented"; PR 2 explicitly does not close it |
| F-016 / R-022 open | yes | ✅ "OPEN P1 IMPLEMENTATION GATE (not resolved by PR 1 or PR 2 application scoping)" |
| PR 3 not started | yes | ✅ |
| Risks pending independent verification | yes | ✅ R-064…R-067 "implemented — pending independent verification" |
| No document claims this review passed | yes | ✅ confirmed — all defer to the pending third independent review |

One substantive documentation inaccuracy beyond F-PR2R3-06: D-030 §4/§5 describe the
bind-parameter cliff as removed. Per F-PR2R3-01 it is removed only for the owned-row-count
dimension.

## 18. Prohibited-scope confirmation

Verified absent from `fed21a48…..fec8500…`:

| Prohibited item | Status |
|---|---|
| Production or merchant data | ✅ none |
| Real secret / `.env` / credential file | ✅ none |
| Deployment | ✅ none |
| Production backfill | ✅ none |
| Ownership repair | ✅ none |
| RLS or policies | ✅ none |
| Runtime or migration DB roles / `BYPASSRLS` | ✅ none |
| Non-null `shopId` | ✅ none |
| Composite tenant foreign keys | ✅ none |
| Tenant-key triggers | ✅ none |
| Prisma schema or migration changes | ✅ none — no file under `prisma/` in range |
| PR 3 work | ✅ none |
| PR 4 persistence | ✅ none |
| Inventory mutation | ✅ none |
| Write-flag enablement | ✅ none — all 5 flags default `false`, file unchanged in range |
| Broad dependency upgrade | ✅ none |
| Unrelated feature work | ✅ none |

Implementation code was **not modified** by this review. Temporary reviewer probe test files were
created on a disposable database, executed, and deleted; `git status --porcelain` is empty apart
from this report.

## 19. Residual PR 3 and PR 4 dependencies

- **Q-011 / F-016 / R-022** remain the open P1 database-enforcement gate. PR 2 is
  application-layer scoping and does **not** close it. PR 3 must deliver canonical `Shop`,
  non-null `shopId`, composite tenant constraints, forced RLS, a restricted runtime role, a
  separate migration role, transaction-local tenant context, a bootstrap exception, and real
  PostgreSQL + pool isolation tests.
- **R-039** persistence remains PR 4.
- **R-028 / R-029** remain open operational backfill / enforcement-transition risks. Nullable
  `shopId` persists until PR 3, which is what keeps the D-030 null-branch — and therefore
  F-PR2R3-01 and F-PR2R3-03 — live.
- **R-014**, **R-013 / R-062** remain open.
- Production inventory writes remain **unapproved**; all flags default **OFF**.

## 20. Summary

The third correction cycle closes eight of ten findings outright (F-PR2R2-01, -03, -04, -06,
-07, -08, -09, -10) and substantially advances the other two. Compound selector flattening is
correct and complete against the schema for all 18 models. Relation nulling, sibling-operation
merge, LeadTimeSnapshot lineage proof, byte accounting, hint semantics, and scanner alias
coverage are all genuinely delivered and independently reproduced. Every one of the twelve prior
cross-tenant attacks remains closed, and no new cross-tenant read or write was reproducible.

Acceptance is withheld for three P2 defects — a bind-parameter cliff that was relocated rather
than removed, a selector coercion that silently writes to the wrong row, and a false JS/SQL
normalization-equivalence claim that permanently hides rows D-030 defines as owned — together
with a focused gate whose name overstates its coverage.

**Verdict: NOT READY — FURTHER CORRECTIONS REQUIRED.**

**Next action:** Return to ChatGPT for the exact Cursor fourth correction prompt.
