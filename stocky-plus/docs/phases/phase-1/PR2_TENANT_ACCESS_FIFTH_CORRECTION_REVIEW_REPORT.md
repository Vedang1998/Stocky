# Phase 1 PR 2 — Fifth Independent Correction Review

**Reviewer:** Claude Code (independent)
**Implementation owner:** Cursor
**Final technical acceptance authority:** ChatGPT
**Review date:** 2026-08-03
**Scope:** Fifth correction cycle for PR #13 — Tenant-bound access conversion

This report is review-only. No implementation file was modified. PR #13 remains
open, draft and unmerged.

---

## 1. Identity and chain of custody

| Role | SHA | Independently verified |
|---|---|---|
| Authorized base (`origin/main`) | `04289d61f605414597ac85f47830a3c9d2f9e33d` | yes |
| Fourth-cycle runtime/test head | `21aba6660e71fa5af558d81499190ee8eb0e645e` | yes (ancestor) |
| Fourth-cycle reviewed handoff head | `93e8044aea3958e8efe36f774e7d99ae6a0dd687` | yes (ancestor) |
| Fourth review report-only commit / fifth-cycle start | `6a73be7d23fd3bcbe19ebc30f65440e2c641093b` | yes (merge base) |
| Fifth-cycle runtime/test head | `5a69783c18208e89ee70623058966c5e5a0ec6b1` | yes (ancestor) |
| Intermediate documented green tip | `96c1029f143ba5e4a52094eef58ec29bf7b339ea` | yes (ancestor) |
| **Exact reviewed fifth-cycle handoff head** | **`70f4a80aab2366108a71fd80320b0f824bfe0cce`** | yes (`origin/phase-1/tenant-access`) |

### Exact-head stop gate

```
git rev-parse origin/main                     → 04289d61f605414597ac85f47830a3c9d2f9e33d   ✅
git rev-parse origin/phase-1/tenant-access    → 70f4a80aab2366108a71fd80320b0f824bfe0cce   ✅
git status --porcelain                        → (empty)                                     ✅
git checkout --detach 70f4a80…                → HEAD = 70f4a80…, tree clean                 ✅
```

### Ancestry and commit classification

```
git merge-base 6a73be7… 70f4a80…              → 6a73be7d23fd3bcbe19ebc30f65440e2c641093b   ✅ exact
git rev-list --count 6a73be7…..70f4a80…       → 16                                          ✅ matches Cursor's claim
```

No rebase or rewritten history: `04289d61…`, `93e8044…`, `6a73be7…`, `5a69783…`
and `96c1029…` are all ancestors of the reviewed head.

| # | Commit | Subject | Class |
|---:|---|---|---|
| 1 | `82f1420` | Record PR 2 fifth correction backlog | documentation |
| 2 | `5cdc250` | Resolve normalized legacy unique selectors safely | **runtime** |
| 3 | `daf22ae` | Harden legacy evidence configuration and SQL-superset contract | **runtime** |
| 4 | `feab649` | Correct normalization and overflow contract wording | **runtime + test** |
| 5 | `05e44bf` | Add PR 2 fifth-cycle regression gates | **test + CI** |
| 6 | `dc32acf` | Align allowlist for fifth-cycle focused tenant tests | tooling + inventory |
| 7 | `4e83fdb` | Select shop only on direct models during id proof | **runtime** |
| 8 | `0366658` | Fix fifth-cycle test lint and typecheck issues | **test** |
| 9 | `5a69783` | Refresh tenant-access inventory for fifth-cycle tip | inventory-only |
| 10 | `ab25f57` | Record PR 2 fifth-cycle evidence | documentation |
| 11 | `0fd3f13` | Record exact-head CI evidence for fifth correction tip | documentation |
| 12 | `520021c` | Pin fifth-cycle handoff tip SHA after CI evidence | documentation |
| 13 | `71d5b0d` | Refresh status for fifth-cycle handoff tip | documentation |
| 14 | `96c1029` | Complete fifth-cycle handoff tip identity in phase docs | documentation |
| 15 | `7973e60` | Refresh status for fifth-cycle exact tip 96c1029 | documentation |
| 16 | `70f4a80` | Align fifth-cycle report and README to tip 96c1029 | documentation |

**Verified:** the last runtime/test change is `0366658`; `5a69783` is
inventory-regeneration only; commits 10–16 are documentation/evidence only.
Cursor labels `5a69783…` the "fifth-cycle runtime/test implementation head" —
accurate as a *tip* label, though the last commit that actually touched runtime
or test code is `0366658`. No functional discrepancy.

**No unrelated phase work entered the range.** Changed files (19 total):

```
.github/workflows/ci.yml
app/tenant/__tests__/legacy-evidence-config.test.ts
app/tenant/__tests__/legacy-evidence-overflow.test.ts
app/tenant/__tests__/legacy-normalization-candidate-superset.test.ts
app/tenant/__tests__/legacy-normalization-equivalence.test.ts
app/tenant/__tests__/legacy-overflow-operation-matrix.test.ts
app/tenant/__tests__/legacy-unique-selector-resolution.test.ts
app/tenant/legacy-scope.ts
app/tenant/selectors.ts
app/tenant/shop-domain.ts
app/tenant/tenant-db.server.ts
docs/DECISIONS.md, docs/PROJECT_STATUS.md, docs/RISK_REGISTER.md
docs/phases/phase-1/PR2_TENANT_ACCESS_FIFTH_CORRECTION_BACKLOG.md
docs/phases/phase-1/PR2_TENANT_ACCESS_FIFTH_CORRECTION_IMPLEMENTATION_REPORT.md
docs/phases/phase-1/PR2_TENANT_ACCESS_FOURTH_CORRECTION_IMPLEMENTATION_REPORT.md
docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md
docs/phases/phase-1/README.md
scripts/tenant-access/allowlist.ts
```

**All five prior independent review reports are unchanged in the range**
(`git diff --name-only 6a73be7…..70f4a80… -- '*REVIEW_REPORT*'` → empty).

---

## 2. Executive verdict

> ## READY FOR CHATGPT PR 2 ACCEPTANCE

| Severity | Count |
|---|---:|
| P0 | 0 |
| P1 | 0 |
| P2 | 0 |
| P3 | 3 |

The acceptance-critical P1 (F-PR2R4-01, legacy unique-selector resolution) is
**closed**. I could not reproduce duplicate-row creation, silent first-row
selection, foreign-row mutation, partial overflow results, or SQL-only
authorization on any affected model, raw representation, operation family, or
database locale I tested. The three new findings are P3 evidence/hygiene items
that do not block technical acceptance.

---

## 3. Finding dispositions — F-PR2R4-01 … F-PR2R4-05

| ID | Sev | Disposition | Basis |
|---|---|---|---|
| F-PR2R4-01 | P1 | **CLOSED** | 7/7 affected models × 12 raw forms × 5 operation families reproduced locally; ambiguity fails closed at 2 and 3 rows on every model; real after-auth path idempotent; upsert branch selection correct; concurrency produces no duplicates |
| F-PR2R4-02 | P3 | **CLOSED** | Fourth-cycle identity records now accurate: `21aba666…` runtime/test, `93e8044…` reviewed handoff, `6a73be7…` review report, `ba5eee1…` demoted to intermediate |
| F-PR2R4-03 | P3 | **CLOSED** | Superset contract stated in code and docs; verified empirically under both `C.UTF-8` and `C` ctype |
| F-PR2R4-04 | P3 | **CLOSED — accepted residual** | Strict parse verified for all 13 required inputs; lazy-validation residual honestly documented |
| F-PR2R4-05 | P3 | **CLOSED** | Canonical `{id}` and `shopId_id` paths provably skip legacy discovery; overflow blast radius matches the documented matrix |

---

## 4. Legacy unique-selector matrix (F-PR2R4-01)

### 4.1 Affected-model inventory — independently derived from the schema

I enumerated every shop-bearing unique constraint directly from
`prisma/schema.prisma` rather than trusting the seven-model list:

| Model | Selector | Non-shop business-key components | Schema line |
|---|---|---|---|
| ShopSettings | `shop` (`@unique`) | *(none)* | 418 |
| ShopifyVariantCache | `shop_shopifyVariantId` | `shopifyVariantId` | 340 |
| InventorySnapshot | `shop_shopifyVariantId_locationId_snapshotDate` | `shopifyVariantId`, `locationId`, `snapshotDate` | 354 |
| VariantAbcClass | `shop_shopifyVariantId_locationId_metric` | `shopifyVariantId`, `locationId`, `metric` | 384 |
| ForecastOverride | `shop_variantId_locationId` | `variantId`, `locationId` | 397 |
| SalesDailyAggregate | `shop_shopifyVariantId_locationId_date` | `shopifyVariantId`, `locationId`, `date` | 411 |
| BomComponent | `shop_bundleVariantId_componentVariantId` | `bundleVariantId`, `componentVariantId` | 525 |

The only other tenant-bearing composite uniques are `@@unique([shopId, id])` on
Supplier / PurchaseOrder / TransferOrder / Stocktake, which carry canonical
`shopId` (not raw `shop`) and are handled by the canonical branch in
`app/tenant/selectors.ts:516-529`. **No eighth shop-bearing model exists.** The
seven-model list is complete for the current schema.

### 4.2 Raw representation matrix — reproduced locally

Seeded one `shopId = null` owned row per raw form, then exercised `findUnique`,
`findUniqueOrThrow`, `update`, `delete`, `upsert`:

| Raw form | ShopSettings | InventorySnapshot (compound) |
|---|---|---|
| canonical | ✅ | ✅ |
| uppercase | ✅ | ✅ |
| leading ordinary space | ✅ | ✅ |
| trailing ordinary space | ✅ | ✅ |
| tab `\t` | ✅ | ✅ |
| line feed `\n` | ✅ | ✅ |
| carriage return `\r` | ✅ | ✅ |
| **vertical tab `\v`** | ✅ | ✅ |
| **form feed `\f`** | ✅ | ✅ |
| NBSP `U+00A0` | ✅ | ✅ |
| BOM `U+FEFF` | ✅ | ✅ |
| mixed accepted whitespace | ✅ | ✅ |

For every cell: the existing row was found; `update` mutated that row; `delete`
removed that row; `upsert` took the **update** branch; row count did not
increase; no canonical duplicate was created; returned projections were correct.

Vertical tab and form feed are **not** in Cursor's focused test file
(`RAW_VARIANTS`, `legacy-unique-selector-resolution.test.ts:19-30`). Behaviour is
nevertheless correct — both code points are in `ECMA_SCRIPT_TRIM_CODE_POINTS`
(`app/tenant/shop-domain.ts:23-49`) and therefore in the PostgreSQL `btrim`
character set. This is a test-coverage gap, not a defect (see F-PR2R5-02).

Cursor's own file additionally covers all 12 raw forms on
`ShopifyVariantCache`, plus a tab-padded form on `InventorySnapshot`,
`SalesDailyAggregate`, `VariantAbcClass`, `BomComponent` and `ForecastOverride`.

### 4.3 Ambiguity behaviour — every affected model, 2 and 3 rows

Seeded owned `shopId = null` rows whose different raw `shop` values normalize to
the same authenticated domain with identical remaining business-key fields:

| Model | 2 rows | 3 rows | findUnique | findUniqueOrThrow | update | delete | upsert |
|---|---|---|---|---|---|---|---|
| ShopSettings | ✅ | ✅ | `ambiguous_legacy_unique_selector` | same | same | same | same |
| ShopifyVariantCache | ✅ | ✅ | same | same | same | same | same |
| InventorySnapshot | ✅ | ✅ | same | same | same | same | same |
| SalesDailyAggregate | ✅ | ✅ | same | same | same | same | same |
| VariantAbcClass | ✅ | ✅ | same | same | same | same | same |
| BomComponent | ✅ | ✅ | same | same | same | same | same |
| ForecastOverride | ✅ | ✅ | same | same | same | same | same |

For every case I asserted the full row set before and after was byte-identical:
**no row changed, no row was deleted, no row was created.** No ordering or
"first row" behaviour was observed on any model.

**Error safety:** the thrown message contains only the model name and a generic
sentence (`app/tenant/selectors.ts:577-581`). I asserted it contains neither a
tab character nor the shop domain. Confirmed — no raw legacy value is disclosed.

### 4.4 after-auth ShopSettings regression — real production path

Executed `runAfterAuthTenantBootstrap` from `app/tenant/after-auth.server.ts`
(the real helper, not an approximation), seeded with one legacy row:

```
shopId              = null
shop                = "\v" + SHOP_A_DOMAIN.toUpperCase() + "\f"   (non-canonical raw)
defaultSafetyStock  = 42        (non-default)
defaultLookbackDays = 60        (non-default)
targetDaysOfStock   = 18        (non-default)
abcMetric           = VOLUME    (non-default)
subscriptionPlan    = "pilot"   (non-default)
```

| Assertion | 1st authentication | 2nd authentication |
|---|---|---|
| ShopSettings row count | 1 | 1 |
| canonical duplicate created | no | no |
| `defaultSafetyStock` | 42 | 42 |
| `defaultLookbackDays` | 60 | 60 |
| `targetDaysOfStock` | 18 | 18 |
| `abcMetric` | VOLUME | VOLUME |
| `subscriptionPlan` | pilot | pilot |
| `shopId` (ownership backfill) | still `null` | still `null` |
| row returned by later read | the existing row | the existing row |
| full row set identical to previous run | — | ✅ byte-identical |

Behaviour is idempotent and no field silently reset to a default. No ownership
backfill occurred — `update: {}` at `after-auth.server.ts:40` correctly refrains
from repairing nullable ownership (C-01), which remains PR 3 work.

### 4.5 Upsert correctness

| Scenario | Expected | Observed |
|---|---|---|
| Existing canonical row | update branch, no create | ✅ |
| Existing null-owned raw legacy row (12 forms) | update branch, no canonical duplicate | ✅ |
| No matching row | create branch once, ownership injected | ✅ (`shopId` = authenticated shop) |
| Ambiguous normalized rows | fail before mutation, no create | ✅ `ambiguous_legacy_unique_selector`, count unchanged |
| Foreign row with same business key | do not update foreign row; create own row | ✅ new row created, foreign row's `title` unchanged |

The foreign-presence case is the important one: with shop B owning
`(SHOP_B_DOMAIN, SHARED_EXTERNAL_ID)`, shop A's upsert on
`(SHOP_A_DOMAIN, SHARED_EXTERNAL_ID)` created a distinct row and left the
foreign row untouched. Foreign presence is not confused with own presence.

Structurally this holds because `rewriteUpsert`
(`tenant-db.server.ts:1478-1562`) resolves ownership *first* via
`resolveOwnedUniqueRow`, then updates by canonical `{ id }` or creates — it never
passes the caller's `where` to Prisma's own `upsert`.

### 4.6 Concurrency

Eight simultaneous upserts through `createTenantDb`, three scenarios:

| Scenario | Rows after | Duplicates | Fulfilled | Rejected |
|---|---:|---|---:|---|
| One legacy null-owned row exists | 1 (the seeded row) | none | 3 | 5 × Prisma `P2034` |
| No existing row | 1 | none | 3 | 5 × Prisma `P2034` |
| Ambiguous rows already exist | 2 (unchanged) | none | 0 | 6 × `ambiguous_legacy_unique_selector` |

**No race produced a duplicate normalized business key.** Two mechanisms
combine: the serializable transaction in `withWriteTransaction`
(`tenant-db.server.ts:1306-1346`) and the raw-string unique index, which blocks a
second create of the identical canonical `create.shop` value. A duplicate would
require two *different* raw strings, and the create branch always writes the
canonical form.

The residual is a reliability one, not an integrity one — see F-PR2R5-03.

---

## 5. Prior security and integrity regression matrix

All re-run at the exact reviewed head. Full suite green: **268/268**.

| # | Attack / invariant | Result | Evidence |
|---:|---|---|---|
| 1 | Foreign SKU mapping cannot be moved | ✅ denied | `nested-selector-auth.test.ts` (13) |
| 2 | Foreign supplier via `shopId_id` | ✅ denied | `tenant-bearing-unique-selectors.test.ts` (6); reproduced in overflow matrix |
| 3 | Foreign transfer line injection | ✅ denied | `nested-writes.test.ts` (8) |
| 4 | Foreign stocktake line injection | ✅ denied | `nested-writes.test.ts` (8) |
| 5 | Foreign child delete/disconnect via alternate selectors | ✅ denied | `nested-selector-auth.test.ts`, `relation-isolation.test.ts` (10) |
| 6 | Foreign `connectOrCreate` target | ✅ denied | `connect-or-create-merge.test.ts` (4) |
| 7 | Mixed nested arrays roll back completely | ✅ atomic | `write-atomicity.test.ts` (1), `nested-writes.test.ts` |
| 8 | Worker-envelope tampering | ✅ denied | `job-envelope.test.ts` (25) |
| 9 | Client hints never establish authority | ✅ denied | `client-hints.test.ts` (11), `client-hint-byte-limits.test.ts` (7), `large-payload-hints.test.ts` (10) |
| 10 | Dynamic/computed/aliased/re-exported raw Prisma paths detected | ✅ detected | `architecture-audit.test.ts` (24), `npm run tenant:access:audit` → `tenant_access_audit_ok`, 18 models covered |
| 11 | Authority-issuer aliases detected | ✅ detected | `authority-issuer-scanner.test.ts` (7) |
| 12 | Ownership-change race probes → zero foreign mutations | ✅ zero | `write-atomicity.test.ts`, `nullable-ownership.test.ts` (12) |
| 13 | Compound unique selectors functional | ✅ functional | `top-level-unique-selectors.test.ts` (7), reproduced across all 7 models |
| 14 | Mixed relation isolation functional | ✅ functional | `mixed-relation-ownership.test.ts` (5) |
| 15 | LeadTimeSnapshot partial projections functional | ✅ functional | `lead-time-partial-select.test.ts` (3), `partial-select-update.test.ts` (6) |
| 16 | Legacy overflow fail-closed | ✅ fail-closed | `legacy-evidence-overflow.test.ts` (12), `legacy-overflow-operation-matrix.test.ts` (3) |
| 17 | Foreign tenant-bearing selectors denied | ✅ denied | reproduced independently, incl. `\t` + uppercase-padded foreign domain → `foreign_selector_tenant` |
| 18 | Every inventory-write flag default OFF | ✅ OFF | `app/lib/feature-flags.server.ts:9-27`, unchanged in the correction range |

**Additional probes I ran independently:**

- Foreign null-owned legacy row (`shopId = null`, `shop = "\t" + SHOP_B_DOMAIN`)
  is invisible to shop A: `findUnique` → `null`, `findMany` → `[]`. ✅
- Foreign `shop` selector with accepted-whitespace padding
  (`"\t" + SHOP_B_DOMAIN.toUpperCase() + " "`) on `update` →
  `foreign_selector_tenant`, foreign row unchanged. ✅ Normalization does not
  create a bypass — `assertSelectorTenantIntent` normalizes *then* compares
  (`selectors.ts:375-402`).

**No cross-tenant regression was reproduced. Zero foreign reads. Zero foreign
mutations.**

---

## 6. Candidate-superset evidence (F-PR2R4-03)

### 6.1 Contract as stated

`app/tenant/legacy-scope.ts:291-309` and
`app/tenant/shop-domain.ts:210-216` now state that SQL candidate discovery is a
**bounded, locale/ctype-sensitive superset** and that JavaScript
`phase1-shop-domain-v1` is the **final authorization authority**. The prior
universal-equality claim is gone. Accepted.

### 6.2 Structural soundness of the superset property

`normalizeShopDomain` rejects non-ASCII *before* lowercasing
(`shop-domain.ts:136-138`), so every JS-accepted raw value is ASCII-only after
trimming. For ASCII input, PostgreSQL `lower()` is locale-invariant, and the
`btrim` character set is generated from the same
`ECMA_SCRIPT_TRIM_CODE_POINTS` array used by `String.prototype.trim`
(`shop-domain.ts:99-101`). SQL therefore cannot omit a JS-accepted candidate in
any locale. The asymmetry is one-directional and safe.

### 6.3 Locale evidence — measured, not asserted

The Kelvin sign below is `U+212A`; the probe domain is
`boo` + `U+212A` + `site.myshopify.com`, whose ASCII counterpart is
`booksite.myshopify.com`.

| Probe | `C.UTF-8` database | `C` database |
|---|---|---|
| `lower(U+212A) = 'k'` | `true` | `false` |
| Kelvin domain matches canonical via `lower(btrim(...))` | `true` (SQL discovers) | `false` (SQL does not discover) |
| JS-accepted form (NBSP + uppercase + trailing BOM) discovered by SQL | `true` | `true` |
| `normalizeShopDomain` on the Kelvin-sign domain | `{ ok: false, reason: "non_ascii" }` | same |
| Kelvin value present in final authorization set | **no** | **no** |

This is the exact predicted behaviour: SQL is a strict superset under UTF-8
ctype, an exact subset-free match under `C`, and JavaScript denies the Kelvin
sign in both. `resolveMatchingRawLegacyShops` re-validates every returned row
through `legacyShopMatchesTenant` before building the `in` list
(`legacy-scope.ts:384-389`).

**Locale-independence proof:** I created a second database with
`LC_COLLATE='C' LC_CTYPE='C'`, applied migrations, and re-ran the
candidate-superset, unique-selector-resolution and my own adversarial probe
files against it. **81/81 tests passed** under `C`, matching the `C.UTF-8`
result. The implementation is secure across locale differences without a schema
or collation migration.

### 6.4 Remaining checks

| Requirement | Result |
|---|---|
| Every JS-accepted representation returned by SQL discovery | ✅ verified for the full corpus, both locales |
| Every SQL candidate revalidated in JavaScript | ✅ `legacy-scope.ts:384-389` |
| JS-rejected values never enter the authorization set | ✅ |
| Kelvin sign denied | ✅ both locales |
| Non-ASCII confusables denied | ✅ Cyrillic-ye prefix (`U+0435`) → `non_ascii` |
| Extra SQL candidates count toward the evidence limit | ✅ in code (`rows.length > limit`, `legacy-scope.ts:368-379`) — **not exercised by the focused test** (F-PR2R5-02) |
| No raw rejected value exposed | ✅ `safeLegacyOverflowMessage` emits only model/shopId/limit/count/correlationId |

---

## 7. Configuration matrix (F-PR2R4-04)

Parser: `parseLegacyEvidenceLimitConfig`, `app/tenant/legacy-scope.ts:76-101`.
Full-string base-10 regex `^[0-9]+$` plus `Number.isSafeInteger` and range 1..4096.

| Input | Expected | Observed |
|---|---|---|
| `10abc` | reject | ✅ `legacy_evidence_config_invalid` |
| `1e9` | reject | ✅ |
| `2048.9` | reject | ✅ |
| `0x100` | reject | ✅ |
| `+10` | reject | ✅ |
| `-1` | reject | ✅ |
| `0` | reject | ✅ |
| `4097` | reject | ✅ |
| empty `""` | default 1024 | ✅ |
| whitespace-only `" "` | reject | ✅ |
| leading whitespace `" 10"`, `"\t1024"` | reject | ✅ |
| trailing whitespace `"10 "` | reject | ✅ |
| `1` | accept → 1 | ✅ |
| `1024` | accept → 1024 | ✅ |
| `4096` | accept → 4096 | ✅ |
| absent (`undefined` / `null`) | default 1024 | ✅ |

| Property | Result |
|---|---|
| Cache occurs only after successful validation | ✅ `legacy-scope.ts:107-116` — assignment follows the throwing parse |
| Repeated reads identical | ✅ |
| Failed validation does not freeze a truncated value | ✅ tested |
| Concurrent first reads resolve one consistent value | ✅ 20 concurrent reads → single value |
| Explicit test reset unavailable from production entry points | ✅ `resetLegacyEvidenceLimitForTests` is not re-exported by `app/tenant/index.ts` and has no non-test call site in `app/` or `scripts/` |
| Invalid configuration produces a stable non-tenant-data-bearing error | ✅ message names the variable and the rule only |

**Residual (accepted, honestly documented):** validation is **lazy**. A process
started with `TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS=10abc` will boot and pass a
health check, then fail on the first merchant request that touches legacy
evidence. Cursor records this at
`PR2_TENANT_ACCESS_FIFTH_CORRECTION_IMPLEMENTATION_REPORT.md:37` ("Invalid
config fails on first use (lazy), not process boot of unused paths"). The
disclosure is accurate and not overstated. Eager boot-time validation is the
right long-term fix but is outside the fifth-cycle correction scope; the failure
mode is fail-closed and this variable is unset by default.

---

## 8. Overflow operation matrix (F-PR2R4-05)

Seeded `limit + N` distinct null-shopId legacy whitespace forms per model.

### Must still work (canonical proof sufficient)

| Operation | Result |
|---|---|
| `create` | ✅ succeeds, `shopId` injected |
| `findUnique` by canonical non-null row `id` | ✅ |
| `findUnique` via valid `shopId_id` | ✅ |
| `update` canonical non-null row by `id` | ✅ |
| `delete` canonical non-null row by `id` | ✅ |
| Foreign `shopId` selector rejection | ✅ `foreign_selector_tenant` (rejected *before* evidence collection) |

Structural confirmation: `resolveOwnedUniqueRow` short-circuits on
`row.shopId === authority.shopId` before calling
`resolveMatchingRawLegacyShops` (`selectors.ts:468-484`); the `shopId_id`
branch never collects legacy evidence at all (`selectors.ts:516-529`); and
`assertStillOwnedById` tries the canonical predicate first
(`tenant-db.server.ts:1269-1273`). **Canonical operations perform no unnecessary
legacy scan.**

### May fail with controlled overflow

| Operation | Result |
|---|---|
| broad `findMany` incl. null-compatibility | ✅ `legacy_evidence_overflow` |
| `count` | ✅ |
| `aggregate` | ✅ |
| `groupBy` | ✅ |
| `updateMany` | ✅ |
| `deleteMany` | ✅ |
| null-owned row lookup by `id` | ✅ |
| **legacy `shop` selector (`ShopSettings.findUnique({ shop })`)** | ✅ (verified independently — not in Cursor's focused file) |
| **legacy `shop` selector `upsert`** | ✅ fails closed, **no row created** |
| relation `include` requiring null compatibility | ✅ |
| relation `_count` | ✅ |

| Safety property | Result |
|---|---|
| No PostgreSQL bind error | ✅ fetch capped at `limit + 1` |
| No partial canonical-only result | ✅ every denied read threw; none returned a truncated list |
| No mutation | ✅ row counts and field values unchanged after every denial |
| No raw evidence disclosure | ✅ structured message only |

---

## 9. Focused-test integrity

Reported counts reproduced exactly, each file executed standalone against a real
PostgreSQL 16:

| File | Reported | Observed | Exit |
|---|---:|---:|---|
| `legacy-unique-selector-resolution.test.ts` | 29 | **29** | 0 |
| `legacy-evidence-config.test.ts` | 6 | **6** | 0 |
| `legacy-normalization-candidate-superset.test.ts` | 6 | **6** | 0 |
| `legacy-overflow-operation-matrix.test.ts` | 3 | **3** | 0 |
| `npm run test:tenant-access` | 268 | **268** (32 files) | 0 |

**No count is overstated.** Every focused CI step names a distinct explicit test
file path; no step uses a `-t` filter, so no step can pass with zero matches;
every focused file executes real tests against PostgreSQL (the config test is
pure-function and correctly so).

**Coverage assessment against the named requirements** (F-PR2R5-02):

| Requirement | Covered by the 29 tests? |
|---|---|
| All 7 affected models | partial — full 12-form matrix only on ShopSettings and ShopifyVariantCache; a single tab form on the other 5 |
| All operation families per model | ShopSettings/ShopifyVariantCache miss `findUniqueOrThrow`; the 5 compound models cover all 5 |
| Ambiguity for every applicable model | **no** — ShopSettings only |
| Three-or-more ambiguous rows | **no** |
| Vertical tab / form feed raw forms | **no** |
| Actual after-auth path invoked | **yes** — `runAfterAuthTenantBootstrap` is imported and called |
| after-auth run twice (idempotency) | **no** — single run only |
| Concurrent upsert | **no** |
| Foreign row with same business key on upsert | **no** |
| Candidate-superset tests use actual PostgreSQL | **yes** — `$queryRaw` against the live database, and the DB ctype is recorded |
| Configuration tests cover all malformed strings | **yes** — all 13 required inputs |
| Overflow covers update/delete by canonical id | **yes** — plus create and `shopId_id` |
| Overflow covers a legacy `shop` selector | **no** |

I verified every uncovered behaviour myself and **all of them are correct**. The
gap is in future regression protection, not in current correctness — hence P3
rather than a blocking finding.

---

## 10. Live PR and exact-head CI verification

| Property | Expected | Observed |
|---|---|---|
| PR #13 state | open | ✅ open |
| Draft | yes | ✅ `draft: true` |
| Merged | no | ✅ `merged: false` |
| Mergeable | yes | ✅ `mergeable_state: clean` |
| Base branch | `main` | ✅ |
| Base SHA | `04289d61…` | ✅ |
| Head branch | `phase-1/tenant-access` | ✅ |
| Head SHA | `70f4a80…` | ✅ |
| Commits | — | 66 |
| Changed files | — | 136 (+22 674 / −657) |

### Exact-head CI run

| Field | Value |
|---|---|
| Workflow | CI |
| Run ID | `30773194142` (run #67, attempt 1) |
| Job ID | `91563836345` |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL |
| `head_branch` | `phase-1/tenant-access` |
| `head_sha` | **`70f4a80aab2366108a71fd80320b0f824bfe0cce`** ✅ |
| Event | `pull_request` |
| Conclusion | **`success`** ✅ |
| Duration | 2026-08-02T23:53:31Z → 2026-08-03T00:02:19Z |

All **58** steps completed with conclusion `success`. **No step was skipped,
cancelled, or `continue-on-error`.** Material steps confirmed present and green:

| Step # | Name |
|---:|---|
| 31 | Tenant legacy unique-selector resolution tests |
| 32 | Tenant legacy evidence configuration tests |
| 33 | Tenant legacy candidate-superset normalization tests |
| 34 | Tenant legacy overflow operation-matrix tests |
| 50 | Tenant access tests (full `test:tenant-access`) |
| 55 | Migration and tenant-backfill tests |
| 56 | Constrained-memory subject evidence |
| 52 / 53 / 54 | Lint / Typecheck / Unit tests |
| 57 / 58 | Build / GraphQL codegen |
| 5 / 6 | Pin npm 11.5.2 / Verify Node and npm versions |
| 11–14 | Index apply / verify / drift / plan |
| 15 / 16 | Architecture audit / inventory freshness |
| 51 | Git diff check |

I read the workflow file at `05e44bf` and confirmed each focused step invokes a
distinct explicit `.test.ts` path (`ci.yml` lines 168–178). CI is treated as
supporting evidence only; every material result above was independently
reproduced locally.

---

## 11. Local execution environment and commands

### Environment

| Item | Value |
|---|---|
| PostgreSQL | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1), disposable cluster, `127.0.0.1:55432` |
| Primary test DB | `stocky_test`, `datcollate/datctype = C.UTF-8`, encoding UTF8 |
| Secondary locale DB | `stocky_c`, `datcollate/datctype = C`, `TEMPLATE template0` |
| Redis | 7.0.15, isolated instance, `127.0.0.1:56379`, `--save ''` |
| Redis DBSIZE before | 0 |
| Redis DBSIZE after cleanup | 0 |
| Node | v22.22.2 |
| npm | **11.5.2** (installed to match `engines.npm`) |
| Envelope secret | test-only, 48 chars, never a production value |
| Production / merchant data | **none accessed** |

### Commands

| Command | Exit | Result |
|---|---:|---|
| `git fetch` / `git status --porcelain` | 0 | clean |
| `node --version` | 0 | v22.22.2 |
| `npm --version` | 0 | 11.5.2 |
| `npm ci` | 0 | 618 packages |
| `npx prisma generate` | 0 | client generated |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma migrate deploy` | 0 | all migrations applied |
| `npm run tenant:indexes:apply -- --apply` | 0 | 28 created, 0 skipped, 0 failed |
| `npm run tenant:indexes:verify` | 0 | `ok: true`, no mismatches |
| `npm run tenant:schema:drift` | 0 | `tenant_prisma_schema_drift_ok` |
| `npm run tenant:indexes:plan` | 0 | `{ valid_exact: 28 }` |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok`, 18 models covered |
| `npm run tenant:access:inventory` | 0 | 1017 findings, **0 violations** |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| `npm run test:tenant-access` | 0 | **268 passed / 32 files** |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm test` | 0 | **56 passed / 6 files** |
| `npm run test:migrations` | 0 | **106 passed / 24 files** |
| `npm run test:subject-memory` | 0 | **2 passed / 1 file** |
| `npm run build` | 0 | server + client build succeeded |
| `npm run graphql-codegen` | **1** | **BLOCKED** — see below |
| `git diff --check` | 0 | clean |
| focused: `legacy-unique-selector-resolution.test.ts` | 0 | 29 |
| focused: `legacy-evidence-config.test.ts` | 0 | 6 |
| focused: `legacy-normalization-candidate-superset.test.ts` | 0 | 6 |
| focused: `legacy-overflow-operation-matrix.test.ts` | 0 | 3 |
| `C`-locale run of superset + selector + probe files | 0 | 81 passed |
| adversarial probe file (review-only, deleted) | 0 | 46 passed |

**`npm run graphql-codegen` — blocked, not failed.** The review sandbox's egress
policy denies `shopify.dev`:
`Load GraphQL schemas [FAILED: Unexpected response: "Host not in allowlist:
shopify.dev."]`. This is an environment restriction, not a repository defect.
The same step ran green at the exact reviewed head in CI (step 58, run
`30773194142`), where network egress is unrestricted. No tenant-isolation,
inventory, cost, or billing behaviour depends on it. Recorded as the single
blocked command; it does not affect the verdict.

### Inventory regeneration

`npm run tenant:access:inventory` was re-run at the reviewed head. It rewrote
`docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` and
`git status --porcelain` remained **empty** — the committed inventory is exactly
reproducible from the reviewed tree. `inventory:check` independently reports
`tenant_access_inventory_fresh`.

### Review-only probe

I wrote a 46-test adversarial probe file to cover the behaviours Cursor's tests
do not, ran it under both `C.UTF-8` and `C`, and **deleted it before committing**.
The working tree was verified clean afterward. No implementation file was
touched at any point.

---

## 12. New findings

### F-PR2R5-01 — Permanent records mislabel `96c1029…` as the fifth-cycle final handoff tip

1. **Severity:** P3
2. **File and line:**
   - `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_FIFTH_CORRECTION_IMPLEMENTATION_REPORT.md:20` and `:178`
   - `stocky-plus/docs/phases/phase-1/README.md:35`
   - `stocky-plus/docs/PROJECT_STATUS.md:25`
3. **Requirement affected:** §17 head-identity discipline — the permanent
   implementation record must not affirmatively mislabel an earlier tip as the
   final reviewed handoff.
4. **Reproduction:** `grep -n "final handoff" stocky-plus/docs/phases/phase-1/README.md`
   at `70f4a80…`.
5. **Actual behaviour:** all three permanent records state
   *"PR 2 fifth-cycle final handoff tip: `96c1029f143ba5e4a52094eef58ec29bf7b339ea`"*
   and record only run `30772826351` / job `91562852894` as the exact-head CI.
   The actual reviewed handoff head is `70f4a80…`, two documentation-only
   commits later, with its own exact-head CI run `30773194142` / job
   `91563836345` (success) that appears nowhere in the permanent record.
6. **Expected behaviour:** the permanent record should either name `70f4a80…` as
   the fifth-cycle handoff head (with run `30773194142`), or demote `96c1029…`
   to "intermediate documented green tip" in the same wording already used for
   `ba5eee1…` — which is exactly the correction F-PR2R4-02 required one cycle
   earlier. The report's own guard sentence
   (`…IMPLEMENTATION_REPORT.md:190`, "Any further documentation-only tip advance
   requires a new exact-head CI before ChatGPT triage") was satisfied
   operationally but never written back.
7. **Merchant impact:** none. Documentation and audit-trail hygiene only.
8. **Required correction:** a post-review documentation-only commit demoting
   `96c1029…` to an intermediate tip and recording `70f4a80…` with run
   `30773194142` / job `91563836345`.
9. **Required regression test:** none automatable; add head-identity wording to
   the cycle-closeout checklist so a documentation tip advance always
   re-pins the record.
10. **Blocks acceptance:** **No.** The `96c1029…` → `70f4a80…` delta is
    documentation-only (verified by diff: two commits touching only the
    fifth-cycle report and the phase README — zero runtime, test, schema,
    migration or configuration change), the reviewed head carries its own green
    exact-head CI, the live PR body explicitly pins `70f4a80…` as the current
    head with that CI run, and §1 of this report pins it permanently. The
    misstatement is therefore not a *material* misrepresentation of what was
    reviewed. §17 expressly contemplates resolving this as an additional P3
    documentation correction after review.

### F-PR2R5-02 — Fifth-cycle focused tests under-cover the named F-PR2R4-01/03/05 requirements

1. **Severity:** P3
2. **File and line:**
   - `stocky-plus/app/tenant/__tests__/legacy-unique-selector-resolution.test.ts:19-30` (raw-form list), `:372-416` (ambiguity), `:418-453` (after-auth), `:342-370` (compound models)
   - `stocky-plus/app/tenant/__tests__/legacy-normalization-candidate-superset.test.ts:184-224`
   - `stocky-plus/app/tenant/__tests__/legacy-overflow-operation-matrix.test.ts:84-216`
3. **Requirement affected:** regression protection for the fifth-cycle
   corrections (review prompt §9, §10, §11, §12, §13, §15).
4. **Reproduction:** enumerate the test bodies; compare against §9's raw-form
   list, §10's per-model ambiguity requirement, §11's twice-run after-auth
   requirement and §12's concurrency requirement.
5. **Actual behaviour:** the suite omits: vertical tab and form feed raw forms;
   ambiguity on the six non-ShopSettings models; three-or-more-row ambiguity;
   the full 12-form matrix on the five compound models (tab only); a second
   after-auth invocation; concurrent upsert; upsert against a foreign row
   holding the same business key; overflow on a legacy `shop` selector; and an
   assertion that SQL-superset candidates actually consume the overflow budget
   (the test named "extra SQL candidates count toward overflow budget
   (documented)" asserts only JS filtering, never the budget).
6. **Expected behaviour:** each named requirement should have an executing
   assertion so a future refactor cannot silently regress it.
7. **Merchant impact:** none today. Every omitted behaviour was independently
   verified correct at this head (§4.2, §4.3, §4.4, §4.5, §4.6, §6.4, §8). The
   exposure is that a later change could regress one of these paths — for
   example per-model ambiguity or the shop-selector overflow guard — with the
   focused gate still green.
8. **Required correction:** extend the focused files with the nine cases above.
9. **Required regression test:** the cases themselves; the probe matrices in §4
   and §8 of this report can be lifted directly.
10. **Blocks acceptance:** **No.** Reported counts are accurate and the gate
    does not overstate what it runs; the gap is coverage breadth, and current
    behaviour is verified correct by this review.

### F-PR2R5-03 — Concurrent tenant writes surface raw Prisma `P2034` after three no-backoff retries

1. **Severity:** P3
2. **File and line:** `stocky-plus/app/tenant/tenant-db.server.ts:1289`
   (`SERIALIZATION_RETRY_LIMIT = 3`) and `:1322-1345` (retry loop).
3. **Requirement affected:** review prompt §12 concurrency contract;
   supportability and error-taxonomy consistency.
4. **Reproduction:** issue 8 simultaneous
   `db.shopSettings.upsert({ where: { shop }, … })` calls for one tenant.
5. **Actual behaviour:** 3 of 8 succeed; 5 reject with the raw Prisma error code
   `P2034` ("Transaction failed due to a write conflict or a deadlock"). The
   retry loop retries immediately with no backoff or jitter, so all three
   attempts commonly land inside the same contention window, and the final error
   escapes as a Prisma error rather than a `TenantAccessError` with a stable
   tenant-access code.
6. **Expected behaviour:** exhausted serialization retries should surface a
   stable tenant-access code (e.g. `write_conflict_retry_exhausted`) that
   callers and support tooling can match, and the retry should apply bounded
   exponential backoff with jitter so modest contention resolves rather than
   failing the request.
7. **Merchant impact:** low but real. Under concurrent authenticated requests or
   parallel workers touching the same tenant row, a merchant sees an opaque
   database error instead of a retryable, classified failure. **No data-integrity
   impact:** row counts stayed correct in all three concurrency scenarios, no
   duplicate normalized business key was created, and no partial write was
   observed.
8. **Required correction:** map exhausted serialization retries to a
   `TenantAccessError` code and add bounded backoff with jitter. Reasonably
   deferred to PR 3 alongside the ownership-repair write paths, where write
   contention rises materially.
9. **Required regression test:** N concurrent upserts on one tenant row
   asserting (a) exactly one surviving row, (b) any rejection carries the
   classified tenant-access code, (c) no raw `P2034` escapes.
10. **Blocks acceptance:** **No.** Fail-closed, no corruption, no cross-tenant
    effect; PR 2 does not enable the high-contention write paths.

---

## 13. Documentation and scope

### Head-identity evidence

| Record | States | Accurate? |
|---|---|---|
| Fourth-cycle runtime/test `21aba666…` | impl report `:12` | ✅ |
| Fourth-cycle reviewed handoff `93e8044…` | impl report `:13`, README `:31`, STATUS `:19` | ✅ |
| Fourth review report commit `6a73be7…` | impl report `:14` | ✅ |
| `ba5eee1…` demoted to intermediate-only | impl report `:15`, README `:33`, STATUS `:21` | ✅ — F-PR2R4-02 correction holds |
| Fifth-cycle runtime/test `5a69783…` | impl report `:17`, README `:34`, STATUS `:22` | ✅ |
| Fifth-cycle "final handoff tip" `96c1029…` | impl report `:20`, README `:35`, STATUS `:25` | ❌ — see F-PR2R5-01 |
| PR body pins `70f4a80…` as exact current head + CI `30773194142` | live PR body | ✅ |

### Prohibited-item absence — verified across `6a73be7…..70f4a80…`

| Item | Present? |
|---|---|
| Production or merchant data | no |
| Real secret / `.env` file | no (only `.env.example`, unchanged) |
| Deployment | no |
| Production backfill | no |
| Ownership repair | no |
| Prisma schema change | no (`prisma/schema.prisma` untouched) |
| Migration | no (`prisma/migrations/**` untouched) |
| RLS or policies | no |
| Runtime or migration DB roles / `BYPASSRLS` | no |
| Non-null `shopId` | no |
| Composite tenant foreign keys | no |
| Triggers | no |
| PR 3 implementation | no |
| PR 4 persistence | no |
| Shopify inventory mutation | no |
| Write-flag enablement | no — all five flags default OFF, `feature-flags.server.ts` unchanged |
| Broad dependency upgrade | no (`package.json` / `package-lock.json` unchanged) |
| Unrelated feature | no |

---

## 14. Residual risks

### Acceptable PR 2 residuals

1. **Ambiguity can still be *created* out-of-band.** The database unique indexes
   are raw-string-based, so two rows whose raw `shop` values differ but normalize
   identically remain insertable by any writer outside the tenant client. The
   tenant client detects this and fails closed rather than guessing. Removing the
   possibility requires a normalized unique index — a schema change not
   authorized in PR 2. Correctly documented by Cursor.
2. **Lazy evidence-limit validation** (F-PR2R4-04 residual). A malformed
   `TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS` fails on first use, not at boot.
   Fail-closed; variable unset by default.
3. **SQL `lower()` remains ctype-dependent by design.** Accepted, because
   JavaScript is the sole authorization authority and the superset direction is
   provably safe (§6.2, §6.3).
4. **Broad compatibility reads overflow by design** when a tenant accumulates
   more than 1024 distinct null-owned raw forms. Fail-closed, and canonical
   operations remain available (§8).
5. **Concurrency error taxonomy** (F-PR2R5-03). No integrity impact.
6. **Focused-test coverage breadth** (F-PR2R5-02). No behavioural impact at this
   head.
7. **Head-identity wording** (F-PR2R5-01). Documentation only.

### PR 3 enforcement dependencies

- Nullable `shopId` remains legal; ownership repair / backfill of null-owned
  legacy rows is PR 3 work. Until then the null-compatibility branch — and with
  it the whole legacy-evidence apparatus — stays on the hot path.
- `after-auth` deliberately does not repair ownership (`update: {}`), so legacy
  rows persist with `shopId = null` until PR 3.
- Serialization backoff and a classified write-conflict error are best landed
  with PR 3's write paths.

### PR 4 persistence dependencies

- Non-null `shopId`, composite tenant foreign keys, tenant-key triggers, RLS and
  policies all remain out of scope and unimplemented, as required.
- A normalized-domain unique index (the structural fix for residual 1) belongs
  to the PR 4 persistence work.

### Unacceptable remaining defects

**None.** No P0, P1 or mandatory P2 remains open.

---

## 15. Verdict

> ## READY FOR CHATGPT PR 2 ACCEPTANCE

**Exact reviewed head:** `70f4a80aab2366108a71fd80320b0f824bfe0cce`

| Severity | Count | IDs |
|---|---:|---|
| P0 | 0 | — |
| P1 | 0 | — |
| P2 | 0 | — |
| P3 | 3 | F-PR2R5-01, F-PR2R5-02, F-PR2R5-03 |

Checked against every READY prohibition in §6 of the review assignment:

| Prohibition | Status |
|---|---|
| Any P0 or P1 remains | none |
| Any mandatory P2 remains | none |
| PostgreSQL / Redis / Prisma / GitHub verification materially blocked | no — all completed locally; only `graphql-codegen` was egress-blocked and is green in exact-head CI |
| Duplicate legacy rows can still be created | no — 12 raw forms × 7 models × 5 operations, plus concurrency, produced zero duplicates |
| Ambiguity resolution chooses a row instead of failing closed | no — `ambiguous_legacy_unique_selector` on every model at 2 and 3 rows, zero mutation |
| Selector projections or mutation semantics regress | no — 268 + 106 + 56 + 2 tests green |
| SQL candidates can become authorized without JavaScript validation | no — verified under `C.UTF-8` and `C` |
| Overflow allows partial results | no |
| Focused CI materially overstates coverage | no — all five counts reproduced exactly; coverage gaps reported as P3 |
| Permanent evidence materially misrepresents the reviewed head | no — the mislabel is real but immaterial (doc-only delta, green exact-head CI, PR body and this report pin `70f4a80…`); recorded as P3 |

**Next action:** Return to ChatGPT for PR 2 technical acceptance decision.

PR #13 remains **open, draft and unmerged**. No implementation file was
modified by this review.
