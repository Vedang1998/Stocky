# Phase 1 PR 2 — Fourth Correction Cycle Backlog

**Authority:** ChatGPT (product / architecture)  
**Implementation owner:** Cursor  
**Independent reviewer:** Claude Code  
**Source review:** `PR2_TENANT_ACCESS_THIRD_CORRECTION_REVIEW_REPORT.md` at `000e53cdae6cd39b690fc8107d7d3f4f4791adf1`  
**Reviewed implementation handoff head:** `fec8500095197798be183d08b3dd004632adba80`  
**Third-cycle runtime/test implementation head:** `d7058294af7eb3d8f287f48cd0657a74475892e7`  
**Starting branch head:** `000e53cdae6cd39b690fc8107d7d3f4f4791adf1`  
**Decision:** D-031

**Status legend:** every item below is `IMPLEMENTATION PENDING INDEPENDENT VERIFICATION`.  
Do not mark verified from Cursor tests alone.

| Finding | Severity | Requirement | Status |
| --- | ---: | --- | --- |
| F-PR2R3-01 | P2 | Bound distinct null-ownership legacy representations far below PostgreSQL’s bind limit; fail closed with `legacy_evidence_overflow` instead of an uncontrolled bind failure | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R3-02 | P2 | Reject foreign tenant-bearing unique selectors (`foreign_selector_tenant`) instead of coercing them onto the authenticated shop’s identically keyed row | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R3-03 | P2 | Make SQL candidate discovery and JavaScript `phase1-shop-domain-v1` normalization semantically identical via one shared specification | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R3-04 | P3 | Make focused test-gate naming match actual operation coverage; add dedicated bulk-mutation and relation consistency suites | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R3-05 | P3 | Correct third-cycle commit-count evidence (`fed21a48…`..`fec8500…` = **11**, not 12) | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R3-06 | P3 | Correct permanent handoff-head wording: distinguish runtime/test head `d7058294…`, reviewed handoff `fec8500…`, report-only `000e53c…` | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR2R3-07 | P3 | Record accepted synthetic Redis-history disposition (`dump.rdb` blob reachable; no rotation/rewrite required) | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

## Third-cycle security posture to preserve

| Item | Disposition |
| --- | --- |
| Cross-tenant disclosure / mutation | None reproduced at `fec8500…`. Preserve. |
| Twelve prior security regressions | Remain closed. Preserve. |
| Foreign rows byte-identical after adversarial attempts | Preserve. |
| Top-level compound selector support | Generally restored. Preserve. |
| Mixed relation isolation | Preserve. |
| Signed job envelopes | Preserve. |
| Nested write atomicity | Preserve. |
| Request-byte accounting / shop-hint handling | Substantially corrected. Preserve. |
| Authority-scanner coverage | Substantially corrected. Preserve. |
| Exact-head CI genuineness | Preserve. |
| Inventory-write flags | Remain default OFF. Preserve. |

## Overflow policy (F-PR2R3-01 / D-031)

Versioned limit: `phase1-legacy-evidence-v1`.

Default: `MAX_DISTINCT_LEGACY_SHOP_FORMS_PER_MODEL_TENANT = 1024` (far below PostgreSQL’s ~32,765 bind ceiling). Configuration is a strict bounded integer with a safe absolute maximum that cannot approach the parameter ceiling.

When distinct matching null-`shopId` legacy representations would exceed the limit:

1. Stop collecting immediately.
2. Do not build the Prisma `in` predicate.
3. Do not send a near-limit query to PostgreSQL.
4. Throw stable `TenantAccessError` `legacy_evidence_overflow` with safe structured diagnostics only (model, tenant Shop ID, configured limit, observed count at stop, correlation ID).
5. Do not include raw legacy values.
6. Do not silently exclude null-owned rows or return only canonical rows.
7. Do not automatically repair data or write production backfill/quarantine records.

Operational resolution remains: inspect PR 1 ownership diagnostics; resolve/backfill ownership through a separately authorized procedure; retry after evidence is within the supported compatibility boundary.

## Safety boundaries (unchanged)

- No merge / ready / deploy / production access or backfill
- No ownership repair of production data
- No RLS, DB roles, BYPASSRLS, non-null `shopId`, composite tenant FKs, tenant-key triggers
- No Prisma schema or migration change
- No PR 3 / PR 4 persistence work
- No Shopify inventory mutation; inventory-write flags remain default OFF
- No force-push, rebase, or amend of prior commits
- Independent review report files remain unchanged (including the third correction review report)
- PR #13 remains draft, unmerged, and unaccepted
