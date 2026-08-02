# Phase 1 PR 2 — Third Correction Cycle Backlog

**Authority:** ChatGPT (product / architecture)  
**Implementation owner:** Cursor  
**Independent reviewer:** Claude Code  
**Source review:** `PR2_TENANT_ACCESS_FOLLOWUP_CORRECTION_REVIEW_REPORT.md` at `fed21a48a5ae77a61f62b5bd899c698c48a68f49`  
**Reviewed implementation head:** `99d7a2bb73e77f62bd4ed0029961b40ab04a08e0`  
**Starting branch head:** `fed21a48a5ae77a61f62b5bd899c698c48a68f49`  
**Decision:** D-030

**Status legend:** every item below is `IMPLEMENTATION PENDING INDEPENDENT REVIEW`.  
Do not mark verified from Cursor tests alone.

| Finding | Severity | Requirement | Status |
| --- | ---: | --- | --- |
| F-PR2R2-01 | P1 | Restore every supported top-level compound-unique operation via flattened selector predicates and canonical `{ id }` rewrite | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2R2-02 | P1 | Remove tenant scopes whose bind count grows with owned row count; use direct `shopId` predicates plus distinct raw legacy representations for null compatibility | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2R2-03 | P1 | Prevent one unprovable to-one relation from failing an entire merchant query; null unprovable to-one; filter unprovable to-many | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2R2-04 | P2 | Preserve sibling nested `connect`/`create` during `connectOrCreate` rewrite via merge helpers | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2R2-05 | P2 | Use one legacy-domain ownership rule (D-030) across every operation family | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2R2-06 | P2 | Inject secondary lineage proof (`purchaseOrderId`) for `LeadTimeSnapshot` selections | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2R2-07 | P3 | Enforce request limits using actual UTF-8/body bytes | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2R2-08 | P3 | Stop treating ordinary business arrays under `shop` as tenant identities; key-specific hint semantics | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2R2-09 | P3 | Detect remaining authority-issuer aliases (local const, namespace import, helpers) | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2R2-10 | P3 | Correct permanent evidence, PR identity and focused CI claims | IMPLEMENTATION PENDING INDEPENDENT REVIEW |

## Closed originals to preserve

| Finding | Disposition |
| --- | --- |
| F-PR2-03 | Closed — signed envelope integrity. Preserve. |
| F-PR2C-03 | Closed — array nested-operation isolation. Preserve. |
| F-PR2C-06 | Closed — update projections and nested writes. Preserve. |
| F-PR2C-09 | Closed — serializable internal write atomicity. Preserve. |
| F-PR2C-07 (partial) | Closed for db.server provenance; residual issuer aliases → F-PR2R2-09 |
| F-PR2C-11 | Closed — exact allowlist matching. Preserve. |
| Inventory-write gates | Remain default OFF. Preserve. |

## Safety boundaries (unchanged)

- No merge / ready / deploy / production access or backfill
- No ownership repair of production data
- No RLS, DB roles, BYPASSRLS, non-null `shopId`, composite tenant FKs, tenant-key triggers
- No Prisma schema or migration change
- No PR 3 / PR 4 persistence work
- No Shopify inventory mutation; inventory-write flags remain default OFF
- No force-push, rebase, or amend of prior commits
- Independent review report files remain unchanged
