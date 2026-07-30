# Phase 1 Record — Tenant-Safe Shopify Fact Foundation

This folder is the Phase 1 planning and permanent phase record.

**Phase 1 status:** PLANNING ONLY — IMPLEMENTATION NOT STARTED
**Brief status:** `DRAFT — IMPLEMENTATION NOT AUTHORIZED`
**Initial planning review:** `NOT READY`
**Planning corrections:** documentation-only; applied; awaiting independent re-review
**Active PR:** [#9](https://github.com/Vedang1998/Stocky/pull/9) — must remain open and draft until successful re-review and ChatGPT approval
**Production inventory writes:** UNAPPROVED
**Inventory-write flags:** DEFAULT OFF

## Mandatory gate

**F-016 / R-022** is a mandatory Phase 1 **P1** database-isolation gate.

Application-layer shop filters alone are insufficient. Phase 1 must deliver database-enforced tenant isolation (canonical `Shop`, direct `shopId`, composite tenant foreign keys, forced PostgreSQL RLS, restricted runtime role, separate migration role, and real PostgreSQL isolation tests) as specified in `PHASE_BRIEF.md`.

No inventory-write flag is approved for enablement by Phase 1 planning.

## Reading order

1. `PHASE_BRIEF.md` — draft planning brief (implementation not authorized while `DRAFT`)
2. `PLANNING_REVIEW_REPORT.md` — Claude initial planning review (`NOT READY` at head `eae8cfdf215e78226f35ba9a2046bddd93590c2c`)
3. `PLANNING_CORRECTION_IMPLEMENTATION_REPORT.md` — documentation-only corrections C-1 through C-11
4. Future `PLANNING_CORRECTION_REVIEW_REPORT.md` — reserved for Claude’s re-review of the corrected head
5. Future focused implementation reports and independent review reports — reserved; one per approved implementation PR after implementation begins, in dependency order
6. Future Phase 1 exit review — reserved for Phase 1 closure

Do not treat future reserved report locations as existing files until those reports are written.

## Related documents

- Historical Phase 0 planning proposal: `../../PHASE_1_TECHNICAL_PLAN.md` (not implementation authority; superseded by the approved Phase 1 brief after planning merges)
- Live project status: `../../PROJECT_STATUS.md`
- Decisions: `../../DECISIONS.md`
- Open questions: `../../OPEN_QUESTIONS.md`
- Risks: `../../RISK_REGISTER.md`
- Approved product rules: `../../product/`

## Implementation authorization

Phase 1 runtime implementation has **not** started.

The brief remains draft. Corrections improve planning documents only and do not authorize implementation.

Implementation may begin only after:

1. ChatGPT explicitly approves the final brief;
2. Claude independently re-reviews and accepts the corrected planning PR;
3. that planning PR is merged into `main`;
4. Cursor starts the first separately approved implementation PR from the updated `main`.

Merging the planning PR does not enable inventory writes and does not authorize work outside the approved brief.
