# Phase 1 PR 2 — Fifth Correction Cycle Implementation Report

**Decision:** D-032 / D-033  
**Branch:** `phase-1/tenant-access`  
**Pull request:** [#13](https://github.com/Vedang1998/Stocky/pull/13) (draft, unmerged)  
**Authorized base:** `main@04289d61f605414597ac85f47830a3c9d2f9e33d`

## Identity

| Field | Value |
|---|---|
| Fourth-cycle runtime/test implementation head | `21aba6660e71fa5af558d81499190ee8eb0e645e` |
| Fourth-cycle reviewed handoff head | `93e8044aea3958e8efe36f774e7d99ae6a0dd687` |
| Fourth independent review report-only commit | `6a73be7d23fd3bcbe19ebc30f65440e2c641093b` |
| Intermediate green documentation tip (not final fourth-cycle handoff) | `ba5eee16f4121ffb128133102e55fbd35397665c` (run `30762725271`, job `91536046005`) |
| Fifth-cycle starting head | `6a73be7d23fd3bcbe19ebc30f65440e2c641093b` |
| **Fifth-cycle runtime/test implementation head** | **`5a69783c18208e89ee70623058966c5e5a0ec6b1`** |
| Prior green documentation tip | `ab25f57c30568c8bcbf8b0b89661868ccd20bbfe` (run `30771419539`, job `91559144905`, success) |
| **Fifth-cycle final handoff head** | **`0fd3f13fd8c9d72813380681d9b3fee7229e7d91`** |
| Exact-head CI on final handoff | run `30771919140`, job `91560408324`, conclusion `success`, `head_sha` = `0fd3f13fd8c9d72813380681d9b3fee7229e7d91` |
| PR state | OPEN, draft, unmerged |

## Independent review context

Verdict at `93e8044…`: `NOT READY — FURTHER CORRECTIONS REQUIRED`  
Findings: P0:0 / P1:1 / P2:0 / P3:4 (F-PR2R4-01..05)  
**No cross-tenant read or write was reproduced.** Overflow remain fail-closed; foreign selectors remain rejected; nested writes remain atomic; exact-head CI was genuine; Redis-history residual remains accepted synthetic-only.

## Finding dispositions (Cursor implementation — PENDING INDEPENDENT VERIFICATION)

| Finding | Sev | Correction | Files | Focused tests | Count | Residual |
|---|---|---|---|---|---:|---| |
| F-PR2R4-01 | P1 | Set-valued null-compatibility unique-selector resolution; upsert update-or-create by `{ id }`; `ambiguous_legacy_unique_selector` fail-closed; after-auth ShopSettings singleton preserved | `selectors.ts`, `tenant-db.server.ts`, `after-auth.server.ts` (call path) | `legacy-unique-selector-resolution.test.ts` | **29** | Ambiguity can still exist under raw unique indexes; no schema/migration authorized |
| F-PR2R4-02 | P3 | Permanent records identify fourth runtime `21aba666…`, reviewed handoff `93e8044…`, report `6a73be7…`; demote `ba5eee1…` to intermediate tip | fourth impl report, PROJECT_STATUS, phase README, PR body | — | — | Documentary |
| F-PR2R4-03 | P3 | Document SQL discovery as locale-sensitive bounded **superset**; JS final authority; Kelvin denied; extras count toward overflow budget | `legacy-scope.ts`, `shop-domain.ts`, equivalence test wording | `legacy-normalization-candidate-superset.test.ts` | **6** | SQL `lower()` remains ctype-dependent by design |
| F-PR2R4-04 | P3 | Strict entire-string base-10 integer parse; range 1..4096; lazy validated singleton + test-only reset; reject partial junk | `legacy-scope.ts` | `legacy-evidence-config.test.ts` | **6** | Invalid config fails on first use (lazy), not process boot of unused paths |
| F-PR2R4-05 | P3 | Two-stage canonical ID; `shopId_id` without null-legacy collection; update/delete re-check prefers non-null `shopId`; overflow operation matrix documented | `selectors.ts`, `tenant-db.server.ts` | `legacy-overflow-operation-matrix.test.ts` | **3** | Broad compatibility reads still overflow by design |

All items: **IMPLEMENTATION PENDING INDEPENDENT VERIFICATION**.

## Affected unique-selector model inventory

| Model | Unique selector | Non-shop components | Ambiguity | Upsert |
|---|---|---|---|---|
| ShopSettings | scalar `shop` | none | `ambiguous_legacy_unique_selector` | update existing owned; create only if none |
| ShopifyVariantCache | `shop_shopifyVariantId` | `shopifyVariantId` | same | same |
| InventorySnapshot | `shop_shopifyVariantId_locationId_snapshotDate` | `shopifyVariantId`, `locationId`, `snapshotDate` | same | same |
| SalesDailyAggregate | `shop_shopifyVariantId_locationId_date` | `shopifyVariantId`, `locationId`, `date` | same | same |
| VariantAbcClass | `shop_shopifyVariantId_locationId_metric` | `shopifyVariantId`, `locationId`, `metric` | same | same |
| BomComponent | `shop_bundleVariantId_componentVariantId` | `bundleVariantId`, `componentVariantId` | same | same |
| ForecastOverride | `shop_variantId_locationId` | `variantId`, `locationId` | same | same |

Resolution never replaces the selector’s raw shop component with one canonical literal for raw equality. Ownership predicate is:

- `shopId = authenticated shopId` OR
- `shopId IS NULL AND shop IN accepted matching raw representations`

## Upsert / after-auth contract

- Existing owned row (canonical or null-compatible) → update branch by `{ id }`; no second row.
- No owned row → create branch with injected ownership.
- Ambiguous owned rows → `ambiguous_legacy_unique_selector`; no create/update/delete.
- Live `runAfterAuthTenantBootstrap` ShopSettings upsert preserves non-default settings on whitespace/case-variant null-owned rows (acceptance-critical regression in focused suite).

## Configuration parsing (F-PR2R4-04)

- Env: `TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS`
- Absent/empty → default **1024**
- Valid: entire base-10 integer in **1..4096** (no surrounding whitespace)
- Invalid (`10abc`, `1e9`, `2048.9`, `0x100`, `+10`, `-1`, whitespace) → `legacy_evidence_config_invalid`
- Lazy validated singleton; `resetLegacyEvidenceLimitForTests()` not exported from production barrel

## SQL-candidate superset contract (F-PR2R4-03)

- SQL `lower(btrim(shop, ECMAScript trim set))` is candidate discovery only.
- JavaScript `phase1-shop-domain-v1` is final authorization authority.
- SQL may return Kelvin-sign / locale-folded extras under UTF-8 ctype; JS denies them.
- Extra SQL candidates count toward the overflow budget (`LIMIT limit+1` on SQL rows).
- Do not claim `SQL decision == JS decision` for every Unicode value or database locale.

## Overflow operation matrix (F-PR2R4-05)

When another part of the same model contains excessive null legacy forms:

| Operation | Requires legacy discovery? | Outcome under overflow |
|---|---|---|
| create | No | succeeds |
| findUnique by canonical id (non-null shopId) | No | succeeds |
| findUnique by shopId_id (own) | No | succeeds |
| findUnique by foreign shopId_id | No (intent reject) | `foreign_selector_tenant` |
| findUnique by legacy shop selector | Yes | `legacy_evidence_overflow` |
| findUnique by id (null shopId) | Yes (proof) | `legacy_evidence_overflow` |
| findMany / count / aggregate / groupBy | Yes | `legacy_evidence_overflow` |
| update by canonical id (non-null) | No | succeeds |
| update by legacy selector | Yes | `legacy_evidence_overflow` |
| updateMany / deleteMany | Yes | `legacy_evidence_overflow` |
| delete by canonical id (non-null) | No | succeeds |
| relation include / `_count` on broad read | Yes | `legacy_evidence_overflow` |
| No partial result returned | — | confirmed |

## Local validation evidence

| Item | Value |
|---|---|
| Node | v22.14.0 |
| npm | 11.5.2 |
| PostgreSQL | 16.14 (Ubuntu), ctype `C.UTF-8` |
| Redis | 7.0.15 @ 127.0.0.1:6379 |
| Redis DBSIZE (after tenant-access suite) | 7 (synthetic test keys only; no merchant data) |
| Envelope secret | test-only |
| Production / merchant data | none |

### Commands (executed locally)

| Command | Exit |
|---|---:|
| `npx prisma generate` | 0 |
| `npx prisma validate` | 0 |
| `npx prisma migrate deploy` | 0 |
| `npm run tenant:indexes:apply -- --apply` | 0 |
| `npm run tenant:indexes:verify` | 0 |
| `npm run tenant:schema:drift` | 0 |
| `npm run tenant:indexes:plan` | 0 |
| `npm run tenant:access:audit` | 0 |
| `npm run tenant:access:inventory` | 0 |
| `npm run tenant:access:inventory:check` | 0 |
| `npm run test:tenant-access` | 0 (**268** tests) |
| Focused unique-selector resolution | 0 (**29**) |
| Focused evidence config | 0 (**6**) |
| Focused candidate-superset | 0 (**6**) |
| Focused overflow matrix | 0 (**3**) |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 0 (**56**) |
| `npm run test:migrations` | 0 (**106**) |
| `npm run test:subject-memory` | 0 (**2**) |
| `npm run build` | 0 |
| `npm run graphql-codegen` | 0 |
| `git diff --check` | 0 |

## Exact-head CI evidence (prior tip `ab25f57…`)

| Field | Value |
|---|---|
| Workflow | CI |
| Run ID | `30771419539` |
| Job ID | `91559144905` |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL |
| `head_sha` | `ab25f57c30568c8bcbf8b0b89661868ccd20bbfe` |
| Conclusion | `success` |
| URL | https://github.com/Vedang1998/Stocky/actions/runs/30771419539 |

## Exact-head CI evidence (final handoff tip `0fd3f13…`)

| Field | Value |
|---|---|
| Workflow | CI |
| Run ID | `30771919140` |
| Job ID | `91560408324` |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL |
| `head_sha` | `0fd3f13fd8c9d72813380681d9b3fee7229e7d91` |
| Conclusion | `success` |
| URL | https://github.com/Vedang1998/Stocky/actions/runs/30771919140 |

Runtime/test implementation head remains `5a69783…`. This documentation pin advances the tip; exact-head CI for the new tip is required before ChatGPT triage if the tip moves again.

### Focused CI steps (executed in workflow)

| Step | File | Local count |
|---|---|---:|
| Tenant legacy unique-selector resolution tests | `legacy-unique-selector-resolution.test.ts` | 29 |
| Tenant legacy evidence configuration tests | `legacy-evidence-config.test.ts` | 6 |
| Tenant legacy candidate-superset normalization tests | `legacy-normalization-candidate-superset.test.ts` | 6 |
| Tenant legacy overflow operation-matrix tests | `legacy-overflow-operation-matrix.test.ts` | 3 |

## Prohibited-scope confirmation

- No production or merchant data
- No deployment / production backfill / ownership repair
- No Prisma schema or migration change
- No RLS, DB roles, BYPASSRLS, non-null shopId, composite tenant FKs, triggers
- No PR 3 / PR 4 persistence
- No inventory mutation; all five inventory-write flags default OFF
- No real secrets / `.env` commits
- No broad dependency upgrade
- No history rewrite / amend / force-push / rebase
- All five independent review reports unchanged
- PR #13 remains draft and unmerged

## Next action

Return to ChatGPT for exact-head triage and the fifth independent PR 2 correction-review prompt.
