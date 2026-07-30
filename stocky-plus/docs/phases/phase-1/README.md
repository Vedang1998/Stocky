# Phase 1 Record — Tenant-Safe Shopify Fact Foundation

This folder is the Phase 1 planning and permanent phase record.

**Phase 1 planning:** APPROVED AND MERGED
**Brief status:** `APPROVED AND MERGED — PHASE 1 IMPLEMENTATION AUTHORITY EFFECTIVE`
**Initial planning review:** `NOT READY`
**Planning correction-review:** `READY FOR CHATGPT PHASE 1 BRIEF APPROVAL`
**ChatGPT planning approval:** APPROVED 2026-07-30
**Planning PR:** [#9](https://github.com/Vedang1998/Stocky/pull/9) — **MERGED** (squash `9fc1025b73be9bbe774a948b4a2302f5664670f3`)
**Implementation authority:** EFFECTIVE
**Phase 1 implementation:** NOT STARTED
**Phase 1 implementation branches:** NONE
**Next phase record / work unit:** PR 1 — tenant expansion and backfill (`phase-1/tenant-expand`)
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

Phase 1 planning is complete and merged. Implementation authority is **EFFECTIVE**.

Phase 1 runtime implementation has **not** started. No implementation branch exists yet.

Next authorized work is **PR 1 — tenant expansion and backfill** on `phase-1/tenant-expand` from updated `main`, after the post-merge status sync is complete.

Merging the planning PR does not enable inventory writes and does not authorize work outside the approved brief.
