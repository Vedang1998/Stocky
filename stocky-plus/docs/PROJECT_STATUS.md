# Project Status

**Updated:** 2026-07-30  
**Current stage:** Phase 0 correction gate closed  
**Current main SHA (includes PR #7 squash merge):** `6fbe4c1d8497c3be2cd3ef5a8619ee63ccd8fdfb`  
**Phase 0 status:** CLOSED (formal closure record is this documentation PR once merged)  
**Phase 1:** NOT STARTED  
**Production inventory writes:** UNAPPROVED  
**Inventory-write flags:** DEFAULT OFF

## Current truth

- Phase 0 implementation was merged through GitHub PR #4.
- Claude accepted Phase 0 with mandatory corrections (C-004–C-008).
- Correction gate PR #6 was merged into `main` **with failed CI** before independent review completed.
- Claude’s independent review of PR #6 returned **`BLOCKED`** — see `phases/phase-0/CORRECTION_REVIEW_REPORT.md`.
- Follow-up PR #7 repaired the correction gate and was **squash-merged** into `main` as `6fbe4c1d8497c3be2cd3ef5a8619ee63ccd8fdfb`.
- Claude’s final independent review of PR #7 returned **`READY FOR PHASE 1 FOUNDATION`** — see `phases/phase-0/CORRECTION_FINAL_REVIEW_REPORT.md`.
- ChatGPT accepted Claude’s final technical verdict.
- The user explicitly authorized the squash merge of PR #7.
- The Phase 0 correction gate is **CLOSED** when this documentation-only closure PR merges into `main`. This documentation PR is the permanent closure record once merged.
- Phase 1 has **not** started and must not start until a separate ChatGPT-approved `PHASE_BRIEF.md` exists.
- No production inventory writes are approved.
- All implemented inventory-write paths remain disabled (flags default OFF).

## PR #7 evidence (immutable)

| Field | Value |
|---|---|
| PR | [#7](https://github.com/Vedang1998/Stocky/pull/7) — **merged** |
| Reviewed head | `f9b12dac0c5e5b4844d6aaa8a79a638eb84f47cb` |
| CI run | `30489949665` |
| CI job | `90705038375` |
| CI conclusion | **success** |
| Full suite | 46 tests / 5 files |
| Standalone record-level denials | 9 |
| Other control tests | 2 (1 client-authority + 1 feature-flag) |
| Squash merge SHA | `6fbe4c1d8497c3be2cd3ef5a8619ee63ccd8fdfb` |
| Claude final verdict | **`READY FOR PHASE 1 FOUNDATION`** |
| ChatGPT decision | Accepted final verdict; authorized merge |
| User authorization | Explicit squash-merge authorization given |

## Correction gate timeline (historical)

| Event | Result |
|---|---|
| PR #6 (`phase-0/correction-gate`) | Merged to main; GitHub Actions `npm ci` **FAILED** (run `30470541851`) |
| Claude review of PR #6 | **`BLOCKED`** |
| Original local completion claim | **Superseded** — macOS `npm ci` did not reproduce on Linux CI |
| Follow-up PR #7 | Repaired lockfile, npm pin, transfer receive, tenant tests, CI |
| Claude second review of PR #7 | **`NOT READY`** at head `33aaac3…` (F-010, F-011) |
| Cursor F-010 / F-011 correction | Applied; head `f9b12da…`; CI green |
| Claude final review of PR #7 | **`READY FOR PHASE 1 FOUNDATION`** |
| ChatGPT + user | Verdict accepted; squash merge authorized |
| PR #7 squash-merged | `6fbe4c1d8497c3be2cd3ef5a8619ee63ccd8fdfb` |
| Documentation closure PR | Records formal Phase 0 gate closure (this PR) |

See:

- `phases/phase-0/CORRECTION_REVIEW_REPORT.md` (PR #6 **BLOCKED**)
- `phases/phase-0/CORRECTION_FOLLOWUP_REVIEW_REPORT.md` (PR #7 **NOT READY**)
- `phases/phase-0/CORRECTION_FINAL_REVIEW_REPORT.md` (PR #7 final **READY**)
- `phases/phase-0/CORRECTION_BACKLOG.md`
- `phases/phase-0/CORRECTION_IMPLEMENTATION_REPORT.md` (historical; superseded notice)
- `phases/phase-0/CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md`

## Phase 0 completed (historical)

- Approved product and agent source-of-truth files were preserved.
- Unsafe stocktake, receipt, and transfer writes remain behind default-off flags.
- Stocktake no longer reports `COMPLETED` after failed Shopify adjustments.
- Confirmed route-level tenant-scoping holes were corrected.
- MMFO scopes were removed.
- The development subscription activation bypass was restricted.
- Characterization tests and Phase 0 operating records were added.
- Lockfile / npm / CI / transfer-receive / tenant-denial correction gate was completed via PR #7.

## Branch protection

**OWNER-ATTESTED** (ruleset id `20012314`, name `Protect main`, enforcement `active`, targets main / default branch):

OWNER-ATTESTED; Cursor reported an authenticated API read, but the independent Claude and ChatGPT review environments could not retrieve the ruleset JSON. These settings are therefore not described as independently reviewed or independently API-verified.

Configured protection (owner-attested facts):

- Pull requests required
- Required status check: `Lint, typecheck, test, build, Prisma, GraphQL`
- Branch required to be up to date
- Allowed merge method: squash
- Force pushes blocked
- Branch deletion restricted
- No routine bypass
- Draft PRs cannot merge under normal GitHub draft-PR workflow (must be marked ready before merge)

Residual: future repository-settings changes could weaken protection; periodically re-verify the ruleset remains active.

## Important deferred work

- Compliance webhooks currently authenticate and acknowledge only; they do not yet perform data export or redaction.
- `subscriptionActive` is not a complete entitlement system.
- Adjustment and cost-sync flags are placeholders; no implemented write paths currently use them.
- Forecast and ABC parity remain future work.
- Inventory-write idempotency, audit, reconciliation, and reversal are not complete.
- Partner distribution remains unconfirmed because `shopify app info` failed.
- npm audit advisories remain for a separate remediation decision.
- F-012–F-015, F-017: future maintenance / risk (not Phase 0 blockers).
- **F-016 / R-022 (P1):** Phase 1 foundation must add database-enforced tenant isolation (brief requirement; not implemented).

## Next action

1. Obtain Claude’s narrow review of this documentation-only closure PR.
2. Obtain ChatGPT approval and explicit user merge authorization.
3. After this closure PR merges, Phase 0 is formally closed on main.
4. ChatGPT may then create the Phase 1 `PHASE_BRIEF.md`.
5. Phase 1 implementation may not start until that brief is approved.
6. Production inventory writes remain unapproved.

## Where to look

- Phase workflow: `phases/README.md`
- Phase 0 record: `phases/phase-0/`
- Permanent product rules: `product/`
- Permanent agent instructions: `agents/`
- Risks: `RISK_REGISTER.md`
- Decisions: `DECISIONS.md`
