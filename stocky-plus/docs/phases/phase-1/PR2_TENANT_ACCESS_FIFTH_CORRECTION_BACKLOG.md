# Phase 1 PR 2 — Fifth Correction Cycle Backlog

**Authority:** ChatGPT (product / architecture)
**Implementation owner:** Cursor
**Independent reviewer:** Claude Code
**Source review:** `PR2_TENANT_ACCESS_FOURTH_CORRECTION_REVIEW_REPORT.md` at `6a73be7d23fd3bcbe19ebc30f65440e2c641093b`
**Reviewed implementation handoff head (fourth cycle):** `93e8044aea3958e8efe36f774e7d99ae6a0dd687`
**Fourth-cycle runtime/test implementation head:** `21aba6660e71fa5af558d81499190ee8eb0e645e`
**Starting branch head:** `6a73be7d23fd3bcbe19ebc30f65440e2c641093b`
**Accepted fifth-cycle implementation/handoff head:** `70f4a80aab2366108a71fd80320b0f824bfe0cce`
**Authoritative fifth review report:** `ff3f9f6a6e9b57cde7df248553694a857b5bc6dd`
**Decision:** D-032 / D-033 / **D-034 (technically accepted)**

**Status legend:** fifth-cycle mandatory findings are independently verified closed at `70f4a80…`. Accepted P3 residuals remain documented below.

| Finding | Severity | Requirement | Status |
| --- | ---: | --- | --- |
| F-PR2R4-01 | P1 | Legacy-normalized owned rows must resolve through unique selectors without duplicate creation; upsert must take update branch for null-owned compatible rows; ambiguity fails closed with `ambiguous_legacy_unique_selector` | **CLOSED — independently verified at `70f4a80…`** |
| F-PR2R4-02 | P3 | Correct permanent head and CI chain-of-custody: fourth runtime/test `21aba666…`, reviewed handoff `93e8044…`, report-only `6a73be7…`; demote `ba5eee1…` | **CLOSED — independently verified** |
| F-PR2R4-03 | P3 | Document SQL candidate discovery as a bounded superset; JavaScript `phase1-shop-domain-v1` remains final authority; locale-sensitive extras never authorize | **CLOSED — independently verified** |
| F-PR2R4-04 | P3 | Strictly parse `TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS` (entire base-10 integer; range 1..4096); lazy validated singleton with test-only reset; reject partial/junk values | **CLOSED — independently verified (lazy-validation residual accepted)** |
| F-PR2R4-05 | P3 | Document and narrow overflow blast radius; two-stage ID operations | **CLOSED — independently verified** |

## Accepted P3 residuals (fifth independent review)

| Residual | ID | Disposition |
| --- | --- | --- |
| Focused-test omissions independently covered (VT/FF forms, multi-model ambiguity, three-row ambiguity, twice-run after-auth, concurrent upsert, foreign-row upsert, legacy-shop-selector overflow, SQL-budget assertion) | P3-A / F-PR2R5-02 | **Accepted for PR 2.** No runtime correction required. Committed focused suites do **not** contain these cases; Claude independently executed them successfully. Broader regression consolidation may occur in a later test-hardening PR. |
| Concurrent upsert retry exhaustion (Prisma P2034 after three no-backoff retries; no duplicate/corruption) | P3-B / F-PR2R5-03 / R-079 | **Accepted PR 2 reliability residual.** Not a tenant-isolation or data-integrity blocker. Must be addressed before production readiness. |
| Head identity (`70f4a80…` is the exact reviewed handoff; do not call `96c1029…` final) | P3-C / F-PR2R5-01 | **Accepted / corrected in acceptance finalization docs.** |

## Review report chain of custody

| Commit | Role |
| --- | --- |
| `7fcff5e14ae99aebae46496c7fadf138bca7166a` | First fifth-review report-only commit (Kelvin-sign cell incorrect; do not erase) |
| `ff3f9f6a6e9b57cde7df248553694a857b5bc6dd` | Authoritative corrected fifth-review report (ASCII-safe Kelvin notation) |

Neither report commit changed implementation code. No history rewrite.

## Safety boundaries (unchanged)

- PR #13 remains draft, unmerged; merge not yet authorized
- No deployment / production access or backfill
- No ownership repair of production data
- No RLS, DB roles, BYPASSRLS, non-null `shopId`, composite tenant FKs, tenant-key triggers
- No Prisma schema or migration change
- No PR 3 / PR 4 persistence work
- No Shopify inventory mutation; inventory-write flags remain default OFF
- Independent review report files remain unchanged
