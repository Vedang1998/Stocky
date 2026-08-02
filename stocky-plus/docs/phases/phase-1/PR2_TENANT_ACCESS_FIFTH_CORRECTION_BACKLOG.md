# Phase 1 PR 2 — Fifth Correction Cycle Backlog

**Authority:** ChatGPT (product / architecture)  
**Implementation owner:** Cursor  
**Independent reviewer:** Claude Code  
**Source review:** `PR2_TENANT_ACCESS_FOURTH_CORRECTION_REVIEW_REPORT.md` at `6a73be7d23fd3bcbe19ebc30f65440e2c641093b`  
**Reviewed implementation handoff head:** `93e8044aea3958e8efe36f774e7d99ae6a0dd687`  
**Fourth-cycle runtime/test implementation head:** `21aba6660e71fa5af558d81499190ee8eb0e645e`  
**Starting branch head:** `6a73be7d23fd3bcbe19ebc30f65440e2c641093b`  
**Decision:** D-032 / D-033

**Status legend:** every item below is `IMPLEMENTATION PENDING INDEPENDENT VERIFICATION`.  
Do not mark verified from Cursor tests alone.

| Finding | Severity | Requirement | Status |
| --- | ---: | --- | --- |
| F-PR2R4-01 | P1 | Legacy-normalized owned rows must resolve through unique selectors without duplicate creation; upsert must take update branch for null-owned compatible rows; ambiguity fails closed with `ambiguous_legacy_unique_selector` | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R4-02 | P3 | Correct permanent head and CI chain-of-custody: fourth runtime/test `21aba666…`, reviewed handoff `93e8044…`, report-only `6a73be7…`; demote `ba5eee1…` to intermediate green tip | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R4-03 | P3 | Document SQL candidate discovery as a bounded superset; JavaScript `phase1-shop-domain-v1` remains final authority; locale-sensitive extras (e.g. Kelvin sign) never authorize | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R4-04 | P3 | Strictly parse `TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS` (entire base-10 integer; range 1..4096); lazy validated singleton with test-only reset; reject partial/junk values | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R4-05 | P3 | Document and narrow overflow blast radius: create / canonical `shopId` ownership / foreign selector rejection must not require legacy discovery; null-owned paths may; two-stage ID operations | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

## Fourth-cycle security posture to preserve

| Item | Disposition |
| --- | --- |
| Cross-tenant disclosure / mutation | None reproduced at `93e8044…`. Preserve. |
| Prior security regressions | Remain closed. Preserve. |
| Overflow fail-closed | Preserve. |
| Foreign tenant-bearing selector rejection | Preserve. |
| Nested write atomicity | Preserve. |
| Exact-head CI genuineness | Preserve. |
| Redis-history residual | Accepted synthetic-only. Preserve. |
| Inventory-write flags | Remain default OFF. Preserve. |

## Affected shop-bearing unique selectors (F-PR2R4-01 inventory)

| Model | Unique selector | Non-shop business components | Ambiguity | Upsert |
| --- | --- | --- | --- | --- |
| ShopSettings | scalar `shop` | *(none)* | `ambiguous_legacy_unique_selector` | update existing owned; create only when none |
| ShopifyVariantCache | `shop_shopifyVariantId` | `shopifyVariantId` | same | same |
| InventorySnapshot | `shop_shopifyVariantId_locationId_snapshotDate` | `shopifyVariantId`, `locationId`, `snapshotDate` | same | same |
| SalesDailyAggregate | `shop_shopifyVariantId_locationId_date` | `shopifyVariantId`, `locationId`, `date` | same | same |
| VariantAbcClass | `shop_shopifyVariantId_locationId_metric` | `shopifyVariantId`, `locationId`, `metric` | same | same |
| BomComponent | `shop_bundleVariantId_componentVariantId` | `bundleVariantId`, `componentVariantId` | same | same |
| ForecastOverride | `shop_variantId_locationId` | `variantId`, `locationId` | same | same |

Resolution must use set-valued null-compatibility ownership (`shopId` current OR null + raw shop in accepted representations), never coerce the selector’s raw shop component to one canonical literal for raw equality.

## Safety boundaries (unchanged)

- No merge / ready / deploy / production access or backfill
- No ownership repair of production data
- No RLS, DB roles, BYPASSRLS, non-null `shopId`, composite tenant FKs, tenant-key triggers
- No Prisma schema or migration change
- No PR 3 / PR 4 persistence work
- No Shopify inventory mutation; inventory-write flags remain default OFF
- No force-push, rebase, or amend of prior commits
- All five independent review report files remain unchanged
- PR #13 remains draft, unmerged, and unaccepted
