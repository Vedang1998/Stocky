# Phase 1 PR 2 — Follow-up Correction Backlog

**Authority:** ChatGPT (product / architecture)  
**Implementation owner:** Cursor  
**Independent reviewer:** Claude Code  
**Source review:** `PR2_TENANT_ACCESS_CORRECTION_REVIEW_REPORT.md` at `b5fbd2bd346dee1730500be46d47c4fb164fd788`  
**Reviewed implementation head:** `e6a9a06a8a399bbfb17687399c59582f1712f442`  
**Starting branch head:** `b5fbd2bd346dee1730500be46d47c4fb164fd788`

**Status legend:** every item below is `IMPLEMENTATION PENDING INDEPENDENT REVIEW`.  
Do not mark verified from Cursor tests alone.

| Finding | Severity | Requirement | Status |
| --- | ---: | --- | --- |
| F-PR2C-01 | P1 | All nested relation selector forms must be tenant-authorized via model-aware selector metadata and canonical `{ id }` rewrite | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-02 | P1 | Foreign `connectOrCreate.where` matches must fail closed after unscoped existence check; prefer explicit connect/create rewrite | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-03 | P2 | Array-form nested bulk mutations must be normalized to arrays, scoped, and immutable (`shopId` / `shop`) | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-04 | P2 | Legacy `shop` comparison must use `phase1-shop-domain-v1` normalization semantics across reads, counts, aggregates, writes, relations, and post-load validation | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-05 | P2 | Legitimate partial relation selections must remain functional via proof-field injection and stripping | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-06 | P2 | `update()` must preserve nested writes and projections via real single-row `update` inside an internal transaction | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-07 | P2 | Scanner must follow derived values and import provenance (constant-folding, aliases, destructuring, computed keys) | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-08 | P2 | Hint inspection must not reject ordinary business payloads; body-byte and traversal limits must be product-justified | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-09 | P3 | Reduce ownership precheck/mutation TOCTOU via same-transaction writes; document PR 3 residual | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-10 | P3 | Correct overstated evidence and tautological allowlist test; record follow-up identity chain | IMPLEMENTATION PENDING INDEPENDENT REVIEW |
| F-PR2C-11 | P3 | Require exact allowlist paths (no suffix match); broaden `*.rdb` gitignore | IMPLEMENTATION PENDING INDEPENDENT REVIEW |

## Closed originals to preserve

| Finding | Disposition |
| --- | --- |
| F-PR2-03 | Closed — signed envelope integrity. Preserve implementation and tests. |
| F-PR2-07 | Closed (documented residual) — webhook `createIfMissing: false` |
| F-PR2-08 | Closed — R-039 wording |
| F-PR2-09 | Closed — tool versions |

## Safety boundaries (unchanged)

- No merge / ready / deploy / production access or backfill
- No RLS, DB roles, non-null `shopId`, composite tenant FKs, tenant-key triggers
- No PR 3 / PR 4 persistence work
- No Shopify inventory mutation; inventory-write flags remain default OFF
- No force-push, rebase, or amend of prior commits
- Independent correction-review report file remains unchanged
