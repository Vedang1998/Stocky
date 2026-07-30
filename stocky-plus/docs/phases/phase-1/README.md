# Phase 1 Record — Tenant-Safe Shopify Fact Foundation

This folder is the Phase 1 planning and permanent phase record.

**Phase 1 status:** PLANNING ONLY — IMPLEMENTATION NOT STARTED
**Brief status:** `DRAFT — IMPLEMENTATION NOT AUTHORIZED`
**Production inventory writes:** UNAPPROVED
**Inventory-write flags:** DEFAULT OFF

## Mandatory gate

**F-016 / R-022** is a mandatory Phase 1 **P1** database-isolation gate.

Application-layer shop filters alone are insufficient. Phase 1 must deliver database-enforced tenant isolation (canonical `Shop`, direct `shopId`, composite tenant foreign keys, forced PostgreSQL RLS, restricted runtime role, separate migration role, and real PostgreSQL isolation tests) as specified in `PHASE_BRIEF.md`.

No inventory-write flag is approved for enablement by Phase 1 planning.

## Reading order

1. `PHASE_BRIEF.md` — draft planning brief (implementation not authorized while `DRAFT`)
2. Planning review report — reserved; created when Claude reviews the documentation-only planning PR
3. Focused implementation reports — reserved; one per approved implementation PR after implementation begins
4. Implementation review reports — reserved; one independent Claude review per implementation PR
5. Correction records — reserved if mandatory corrections are required
6. Exit review — reserved for Phase 1 closure

Do not treat reserved report locations as existing files until those reports are written.

## Related documents

- Historical Phase 0 planning proposal: `../../PHASE_1_TECHNICAL_PLAN.md` (not implementation authority; superseded by the approved Phase 1 brief after planning merges)
- Live project status: `../../PROJECT_STATUS.md`
- Decisions: `../../DECISIONS.md`
- Open questions: `../../OPEN_QUESTIONS.md`
- Risks: `../../RISK_REGISTER.md`
- Approved product rules: `../../product/`

## Implementation authorization

Phase 1 runtime implementation has **not** started.

Implementation may begin only after:

1. ChatGPT explicitly approves the final brief;
2. Claude independently reviews the documentation-only planning PR;
3. that planning PR is merged into `main`;
4. Cursor starts the first separately approved implementation PR from the updated `main`.

Merging the planning PR does not enable inventory writes and does not authorize work outside the approved brief.
