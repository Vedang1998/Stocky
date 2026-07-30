# Phase 1 Record — Tenant-Safe Shopify Fact Foundation

This folder is the Phase 1 planning and permanent phase record.

**Phase 1 status:** PLANNING APPROVED — IMPLEMENTATION NOT STARTED
**Brief status:** `APPROVED BY CHATGPT — AWAITING PLANNING PR MERGE; IMPLEMENTATION NOT AUTHORIZED`
**Initial planning review:** `NOT READY`
**Planning correction-review:** `READY FOR CHATGPT PHASE 1 BRIEF APPROVAL`
**ChatGPT planning approval:** APPROVED 2026-07-30
**Active PR:** [#9](https://github.com/Vedang1998/Stocky/pull/9) — OPEN, DRAFT, UNMERGED
**Merge authorization:** NOT YET GRANTED
**Phase 1 implementation:** NOT STARTED
**Production inventory writes:** UNAPPROVED
**Inventory-write flags:** DEFAULT OFF

## Mandatory gate

**F-016 / R-022** is a mandatory Phase 1 **P1** database-isolation gate.

Application-layer shop filters alone are insufficient. Phase 1 must deliver database-enforced tenant isolation (canonical `Shop`, direct `shopId`, composite tenant foreign keys, forced PostgreSQL RLS, restricted runtime role, separate migration role, and real PostgreSQL isolation tests) as specified in `PHASE_BRIEF.md`.

No inventory-write flag is approved for enablement by Phase 1 planning.

## Reading order

1. `PHASE_BRIEF.md`
2. `PLANNING_REVIEW_REPORT.md`
3. `PLANNING_CORRECTION_IMPLEMENTATION_REPORT.md`
4. `PLANNING_CORRECTION_REVIEW_REPORT.md`
5. Future focused implementation and review records — reserved; one per approved implementation PR after implementation begins, in dependency order
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

ChatGPT approved the reviewed planning scope on 2026-07-30. Implementation authority becomes effective only after PR #9 is explicitly authorized by the user and merged into `main`.

Implementation may begin only after:

1. ChatGPT’s planning approval is recorded (done);
2. Claude’s correction review is preserved (done);
3. PR #9 receives exact-head CI for the final planning-record tip and ChatGPT verification;
4. the user explicitly authorizes merge;
5. PR #9 is merged into `main`;
6. Cursor starts the first separately approved implementation PR from the updated `main`.

Merging the planning PR does not enable inventory writes and does not authorize work outside the approved brief.
