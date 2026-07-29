# Phase 0 Correction Follow-Up Review Report (PR #7)

**Reviewer:** Claude (independent)  
**Pull request:** [#7 — Phase 0: Repair correction gate and restore green CI](https://github.com/Vedang1998/Stocky/pull/7)  
**Branch:** `phase-0/correction-gate-followup`  
**Verdict:** `NOT READY`  
**Date recorded:** 2026-07-29

## Reviewed head and CI (immutable historical evidence)

| Field | Value |
|---|---|
| Actual reviewed head | `33aaac32303b6757e1f9b4a3efd5a4f48874c95e` |
| Verified green workflow run | `30485002939` |
| Verified job | `90688346067` |
| Trigger | `pull_request` |
| Conclusion at review time | **success** |

These values are **historical review evidence** for the head Claude inspected. They are **not** a claim that they remain the live PR tip after later commits.

## Explicit confirmations from Claude

- No **P0** findings remain open.
- No **P1** findings remain open.
- **F-001** lockfile repair is resolved.
- **F-002 / C-007** CI is resolved.
- **F-004** transfer receive safety is resolved.
- **F-005** tenant-test coverage is substantively resolved.
- **F-006** npm pinning is resolved.
- Phase 1 was **not** started.
- All inventory-write flags remain default **OFF**.
- Production inventory writes remain **unapproved**.
- Branch-protection owner confirmation remains **required**.

## Blocking findings (prevent READY)

### F-010 — P2 — Stale / self-invalidating PR-head and CI references

`PROJECT_STATUS.md` (and related Phase 0 records) hardcoded an exact PR tip SHA and CI run IDs inside the same branch.

Every documentation commit that “records” the current tip creates a new tip, immediately making the recorded SHA stale (self-invalidating SHA chase).

**Required fix:** Use stable wording that distinguishes:

- immutable **last independently reviewed** head / run / job;
- live **current** head and CI, which must be verified on GitHub PR #7;
- gate still open until final Claude READY, ChatGPT approval, explicit merge authorization, merge, and post-merge status update.

Do **not** create another commit whose only purpose is to record the SHA or CI run of its own parent.

### F-011 — P2 — Standalone purchase-order parent denial test and accurate counts

Purchase-order parent denial behavior is bundled inside a client-authority / configuration test rather than standing as its own record-level cross-shop denial case.

**Required fix:**

- Add a clearly named standalone test (e.g. denies Shop B cancelling Shop A purchase order) that invokes the real production PO route action.
- Keep the client-authority test separate.
- Classify accurately:
  - **9** standalone record-level cross-shop denial tests
  - **1** separate client-authority / control test
  - **1** separate feature-flag assertion
- Recalculate total suite count; do not assume it remains 45.

## Non-blocking findings (do not implement in this correction)

| ID | Priority | Summary | Disposition |
|---|---|---|---|
| F-012 | P3 | Exact npm engine pin usability | Future maintenance / risk |
| F-013 | P3 | GitHub Action major-version maintenance | Future maintenance / risk |
| F-014 | P3 | `shamefully-hoist` cleanup | Future maintenance / risk |
| F-015 | P3 | Transfer sentinel TODO | Future maintenance / risk |
| F-016 | P2 | Database-enforced tenancy | **Mandatory Phase 1 brief requirement** — not Phase 0 implementation |

### F-016 — Phase 1 brief requirement (not implemented now)

Phase 1 foundation must add database-enforced tenant isolation through approved composite shop constraints, tenant ownership, or another approved mechanism.

Do **not** implement the Phase 1 data model in this correction.

## Gate status

| Item | Status |
|---|---|
| Claude verdict on reviewed head `33aaac3` | **`NOT READY`** |
| Phase 0 correction gate | **Open** (not closed) |
| Phase 1 | Must not begin |
| Production inventory writes | Not approved |
| Inventory-write flags | Default OFF |
| Branch protection on `main` | **OWNER ACTION REQUIRED** |
| Follow-up | Narrow Cursor fix for F-010 + F-011, then Claude final re-check |

## Related historical record

Do not overwrite `CORRECTION_REVIEW_REPORT.md` — that file remains the historical **`BLOCKED`** review of PR #6.

## Next required steps

1. Cursor resolves F-010 and F-011 only.
2. Green CI on the exact post-fix head (evidence recorded on PR #7 description / external verification — no SHA chase commits).
3. Claude performs a narrow final re-check of F-010 and F-011.
4. ChatGPT approves the final verdict.
5. User explicitly authorizes merge.
6. Owner confirms branch protection before treating merges as gated.
