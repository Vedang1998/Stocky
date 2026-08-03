# Phase 1 Record — Tenant-Safe Shopify Fact Foundation

**Phase 1 planning:** APPROVED AND MERGED
**Implementation authority:** EFFECTIVE
**Phase 1 status:** IN PROGRESS (PR 1 and PR 2 merged and closed; PR 3 correction implemented on draft PR #15 — pending independent verification; D-037)
**Phase 1 PR 1:** MERGED AND CLOSED
**Phase 1 PR 2:** MERGED AND CLOSED
**Phase 1 PR 3:** IN PROGRESS — draft PR [#15](https://github.com/Vedang1998/Stocky/pull/15); independently reviewed head `57016ed…` `NOT READY`; correction start `ebcd026…`; prior runtime/test head `0ee3ae0…`; exact head `a132719…`; exact-head CI run `30826604464` / job `91729808946` success; status: Correction implemented — pending independent verification
**Next authorized implementation unit:** independent correction review + ChatGPT acceptance of PR 3 (no PR 4 until PR 3 is accepted and merged)
**Active implementation branch:** `phase-1/tenant-enforcement`
**Active implementation PR:** [#15](https://github.com/Vedang1998/Stocky/pull/15) (draft, open, unmerged)
**PR #13:** CLOSED AND SQUASH-MERGED
**Authorized PR #13 head:** `5fc98192d2ca350de358316d9383e39103b98c80`
**Accepted implementation head:** `70f4a80aab2366108a71fd80320b0f824bfe0cce`
**Authoritative independent review:** `ff3f9f6a6e9b57cde7df248553694a857b5bc6dd`
**Squash merge SHA:** `e9c4f87eb28ce0e957a8cbd159719586892f8b98`
**Merge timestamp:** `2026-08-03T01:38:59Z`
**Final pre-merge exact-head CI:** run `30776644228`, job `91573286240`, conclusion `success`, `head_sha` = authorized head
**Current main SHA:** `e9c4f87eb28ce0e957a8cbd159719586892f8b98`
**PR #11:** CLOSED AND SQUASH-MERGED
**Authorized PR #11 head:** `6e5b024254615f3259aeb8d8252305d86bd63777`
**Capable-local review verdict:** `READY FOR CHATGPT PR 1 ACCEPTANCE` at `28e77178602ca486e5138ca2f80e8947d8e113c0`
**Documentation finalization / authorized merge head (PR 1):** `6e5b024254615f3259aeb8d8252305d86bd63777`
**Squash merge SHA (PR #11):** `44a24f3387c1dae0351490367c06bef10f333425`
**Merge timestamp (PR #11):** `2026-07-31T22:19:49Z`
**Pre-merge exact-head CI (PR #11):** run `30643441951`, job `91198830409`, conclusion `success`
**Claude PR 1 original review:** `NOT READY` at `7aabb095806716697bfea2783379351b15e1cda2`
**Claude PR 1 correction review:** `NOT READY` at `fb04345f129b8664566c5947f2ad75f57102269b`
**Claude PR 1 follow-up review:** `NOT READY` at `aa5f425f446d79ff1bc24ac17a5944cdb8072159`
**Claude PR 1 capable-local review:** `READY FOR CHATGPT PR 1 ACCEPTANCE` at `28e77178602ca486e5138ca2f80e8947d8e113c0`
**ChatGPT decisions:** `PR 1 ACCEPTED` (D-025); `PR 1 merge closure` (D-026); `PR 2 tenant-bound access` (D-027); `PR 2 corrections required` (D-028); `PR 2 follow-up corrections required` (D-029); `PR 2 third correction cycle required` (D-030); `PR 2 fourth correction cycle required` (D-031); `PR 2 fifth correction cycle required` (D-032 / D-033); `PR 2 technically accepted` (D-034); **`PR 2 merge closure` (D-035)**
**Claude PR 2 original review:** `NOT READY — CORRECTIONS REQUIRED` at `6f9ca22c069a46003b6944ff56c888ff91e95cdc` (preserved verbatim)
**Claude PR 2 first correction review:** `NOT READY — FURTHER CORRECTIONS REQUIRED` at `e6a9a06a8a399bbfb17687399c59582f1712f442` (report commit `b5fbd2bd…`; preserved verbatim)
**Claude PR 2 second correction review:** `NOT READY — FURTHER CORRECTIONS REQUIRED` at `99d7a2bb73e77f62bd4ed0029961b40ab04a08e0` (report commit `fed21a48…`; preserved verbatim)
**Claude PR 2 third correction review:** `NOT READY — FURTHER CORRECTIONS REQUIRED` at `fec8500095197798be183d08b3dd004632adba80` (report commit `000e53c…`; preserved verbatim)
**Claude PR 2 fourth correction review:** `NOT READY — FURTHER CORRECTIONS REQUIRED` at `93e8044aea3958e8efe36f774e7d99ae6a0dd687` (report commit `6a73be7…`; preserved verbatim)
**Claude PR 2 fifth correction review:** `READY FOR CHATGPT PR 2 ACCEPTANCE` at `70f4a80aab2366108a71fd80320b0f824bfe0cce` (first report `7fcff5e…`; authoritative corrected report `ff3f9f6…`; preserved verbatim) — P0:0 P1:0 P2:0 P3:3 accepted/nonblocking
**PR 2 third-cycle runtime/test implementation head:** `d7058294af7eb3d8f287f48cd0657a74475892e7`
**PR 2 third-cycle reviewed handoff head:** `fec8500095197798be183d08b3dd004632adba80`
**PR 2 third independent review report-only commit:** `000e53cdae6cd39b690fc8107d7d3f4f4791adf1`
**PR 2 fourth-cycle runtime/test implementation head:** `21aba6660e71fa5af558d81499190ee8eb0e645e`
**PR 2 fourth-cycle reviewed handoff head:** `93e8044aea3958e8efe36f774e7d99ae6a0dd687`
**PR 2 fourth independent review report-only commit:** `6a73be7d23fd3bcbe19ebc30f65440e2c641093b`
**PR 2 fourth-cycle intermediate green tip (not final handoff):** `ba5eee16f4121ffb128133102e55fbd35397665c` (run `30762725271`, job `91536046005`)
**PR 2 fifth-cycle runtime/test tip label:** `5a69783c18208e89ee70623058966c5e5a0ec6b1`
**PR 2 fifth-cycle actual final runtime/test commit:** `0366658255ecbbd5e09168cbf43fbf135e2a2b33`
**PR 2 fifth-cycle reviewed implementation/handoff head:** `70f4a80aab2366108a71fd80320b0f824bfe0cce`
**PR 2 fifth-cycle intermediate documented green tip (not final handoff):** `96c1029f143ba5e4a52094eef58ec29bf7b339ea`
**PR 2 first fifth-review report-only commit:** `7fcff5e14ae99aebae46496c7fadf138bca7166a`
**PR 2 authoritative corrected fifth-review report commit:** `ff3f9f6a6e9b57cde7df248553694a857b5bc6dd`
**Accepted PR 2 implementation head (D-034):** `70f4a80aab2366108a71fd80320b0f824bfe0cce`
**Third-cycle correction range commit count:** `fed21a48…`..`fec8500…` = **11** (not 12)
**Prior R9 evidence at `fb04345f…`:** REJECTED AND SUPERSEDED
**Production inventory writes:** UNAPPROVED
**Inventory-write flags:** DEFAULT OFF
**PR 3:** IN PROGRESS — Correction implemented — pending independent verification (D-037)
**Residual gates:** F-016 / R-022 / Q-011; R-024 through R-027; R-014; R-028/R-029; R-080..R-085; operational backfill / zero-unresolved evidence; R-079; R-013 / R-062; inventory-write release gates
**Accepted P3 residuals:** P3-A focused-test omissions; P3-B concurrent upsert retry exhaustion (R-079); P3-C head identity (`70f4a80…`, not `96c1029…`)

## Mandatory gate

**F-016 / R-022** remains an open P1 database-isolation gate. PR 1 merge and PR 2 application scoping do **not** resolve it.
**Q-011** remains open until enforcement is merged and independently verified.
**R-024 through R-027**, **R-014**, operational backfill / zero-unresolved evidence, **R-079**, **R-013 / R-062** dependency hardening, and inventory-write release gates remain open.

PR 2 application-layer tenant access is accepted and merged.
It does **not** resolve database-enforced tenant isolation.

## Phase progress

- Phase 1 itself is still **in progress**.
- PR 1 is **MERGED AND CLOSED**.
- PR 2 (tenant-bound access conversion) is **MERGED AND CLOSED** (PR #13 squash-merged; D-034 / D-035).
- PR 3 (database-enforcement gate) is **IN PROGRESS** on draft PR #15; original review `NOT READY`; corrections pending independent verification.
- Next authorized implementation unit: **independent PR 3 correction review + ChatGPT acceptance**.
- No later Phase 1 PR may begin before PR 3 is accepted and merged.

## Immutable PR 2 (#13) merge evidence

| Field | Value |
|---|---|
| PR number | [#13](https://github.com/Vedang1998/Stocky/pull/13) |
| Authorized head | `5fc98192d2ca350de358316d9383e39103b98c80` |
| Merge method | SQUASH |
| Squash merge SHA | `e9c4f87eb28ce0e957a8cbd159719586892f8b98` |
| Merge timestamp | `2026-08-03T01:38:59Z` |
| Accepted implementation head | `70f4a80aab2366108a71fd80320b0f824bfe0cce` |
| Authoritative independent review | `ff3f9f6a6e9b57cde7df248553694a857b5bc6dd` |
| Final pre-merge CI | workflow `CI`; run `30776644228`; job `91573286240`; conclusion `success`; `head_sha` = authorized head |
| Decision | D-034 / D-035 |
| Production / merchant data | **No production or merchant data was accessed** |
| Deployment | **No deployment occurred** |
| Production backfill | **No production backfill occurred** |
| RLS / database roles / non-null shopId / composite FKs | **Implemented on disposable/CI fixtures; production not authorized; pending independent verification** |
| PR 3 | **NOT STARTED** |
| Inventory writes | **UNAPPROVED**; every inventory-write flag remains **DEFAULT OFF** |

## Reading order

1. `PHASE_BRIEF.md`
2. `PLANNING_REVIEW_REPORT.md`
3. `PLANNING_CORRECTION_IMPLEMENTATION_REPORT.md`
4. `PLANNING_CORRECTION_REVIEW_REPORT.md`
5. `PR1_TENANT_OWNERSHIP_INVENTORY.md`
6. `PR1_TENANT_EXPANSION_MIGRATION_RUNBOOK.md`
7. `PR1_TENANT_EXPANSION_IMPLEMENTATION_REPORT.md`
8. `PR1_TENANT_EXPANSION_REVIEW_REPORT.md` — Claude original `NOT READY` (verbatim)
9. `PR1_TENANT_EXPANSION_CORRECTION_BACKLOG.md`
10. `PR1_TENANT_EXPANSION_CORRECTION_IMPLEMENTATION_REPORT.md`
11. `PR1_TENANT_EXPANSION_CORRECTION_REVIEW_REPORT.md` — Claude correction-review `NOT READY` (verbatim; chain-of-custody commit before F-N corrections)
12. `PR1_TENANT_EXPANSION_CORRECTION_FOLLOWUP_REVIEW_REPORT.md` — Claude follow-up `NOT READY` at `aa5f425…` (verbatim; chain-of-custody commit before F-F corrections)
13. `PR1_TENANT_EXPANSION_CAPABLE_LOCAL_REVIEW_REPORT.md` — capable local independent review; reviewed head `28e77178602ca486e5138ca2f80e8947d8e113c0`; verdict `READY FOR CHATGPT PR 1 ACCEPTANCE`; preserved verbatim
14. `PR2_TENANT_ACCESS_ARCHITECTURE.md`
15. `PR2_TENANT_ACCESS_INVENTORY.md` — mechanically generated; do not edit by hand
16. `PR2_TENANT_ACCESS_IMPLEMENTATION_REPORT.md`
17. `PR2_TENANT_ACCESS_REVIEW_REPORT.md` — Claude original `NOT READY — CORRECTIONS REQUIRED` at `6f9ca22…` (verbatim; chain-of-custody preface only)
18. `PR2_TENANT_ACCESS_CORRECTION_BACKLOG.md`
19. `PR2_TENANT_ACCESS_CORRECTION_IMPLEMENTATION_REPORT.md`
20. `PR2_TENANT_ACCESS_CORRECTION_REVIEW_REPORT.md` — first correction review `NOT READY` at `e6a9a06…` (verbatim)
21. `PR2_TENANT_ACCESS_FOLLOWUP_CORRECTION_BACKLOG.md` / `…_IMPLEMENTATION_REPORT.md` — superseded for acceptance by D-030
22. `PR2_TENANT_ACCESS_FOLLOWUP_CORRECTION_REVIEW_REPORT.md` — second correction review `NOT READY` at `99d7a2bb…` (verbatim; report `fed21a48…`)
23. `PR2_TENANT_ACCESS_SECOND_FOLLOWUP_CORRECTION_BACKLOG.md` / `…_IMPLEMENTATION_REPORT.md` — D-030 third cycle

## Related documents

- Live status: `../../PROJECT_STATUS.md`
- Decisions: `../../DECISIONS.md` (includes D-024..D-035)
- Local tooling: Node compatible with `package.json` engines; **npm exactly 11.5.2**
- Open questions: `../../OPEN_QUESTIONS.md`
- Risks: `../../RISK_REGISTER.md`
