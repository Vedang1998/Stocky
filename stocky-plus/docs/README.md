# Stocky Migration Documentation Map

Use this file when you are unsure where something belongs.

## Permanent product source of truth

`stocky-plus/docs/product/`

Start with `product/00_READ_ME_FIRST.md` and follow its reading order. Product rules, formulas, pricing principles, architecture direction, and release gates live there.

## Permanent agent instructions

`stocky-plus/docs/agents/`

This contains the reusable ChatGPT, Cursor, and Claude prompts. Do not create a new permanent agent prompt for every phase.

## Phase work

`stocky-plus/docs/phases/`

Each phase gets its own folder containing:

- `PHASE_BRIEF.md` — what is approved before work begins;
- `IMPLEMENTATION_REPORT.md` — what Cursor built and verified;
- `REVIEW_REPORT.md` — what Claude independently found and the final verdict.

Reusable copies are under `phases/_templates/`.

Phase 1 PR 5 repository-implementation closeout records live under `phases/phase-1/`:

- `PR5_F3_IMPLEMENTATION_REPORT.md` — F3 runtime implementation evidence;
- `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` — immutable Claude exact-head review (never edit);
- `PR5_CLOSURE_REPORT.md` — overall PR5 repository-implementation closure;
- `PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md` — accepted P3 residuals, including pre-production requirements.
- `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md` — PR6 planning packet (**ACCEPTED / MERGED** via PR #34). PR6-A is **ACCEPTED / MERGED / CLOSED** (PR #37). PR6-B/C complete-module work is **AUTHORIZED** after admission; PR6-D runtime remains **NOT AUTHORIZED**;
- `PR6_CURRENT_MAIN_SYNC_REPORT.md` — PR #34 current-main synchronization evidence;
- `PR6_A_FOUNDATION_IMPLEMENTATION_REPORT.md` — PR6-A order/refund fact foundation implementation and correction evidence.
- `PR6_A_FOUNDATION_INDEPENDENT_REVIEW.md` — immutable Claude implementation review of `5f8b2e76…` (never edit). Verdict **CORRECTIONS REQUIRED**.
- `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` — immutable Claude correction re-review (never edit). Verdict **APPROVE PR6-A FOUNDATION CORRECTION**.
- `PR6_A_CLOSURE_REPORT.md` — PR6-A post-merge admission identity.
- `PR6_BC_EXECUTION_BRIEF.md` — PR6-B/C ownership and addendum dispositions after admission.

## Live project control files

- `PROJECT_STATUS.md` — current phase, active work, blockers, and next action;
- `DECISIONS.md` — approved decisions and changes to product rules;
- `OPEN_QUESTIONS.md` — unresolved product or technical questions;
- `RISK_REGISTER.md` — active risks and owners;
- `CI_POLICY.md` — GitHub Actions evidence, docs-only classification, and CI Gate rules;
- `ACCELERATED_SAFE_DELIVERY.md` — permanent ChatGPT / Cursor / Claude operating model from PR 5 implementation onward;
- `EMERGENCY_DELIVERY_DIRECTIVE_2026-09-01.md` — Emergency Continuity Sprint control packet (internal/controlled rescue after Stocky sunset; does not change product rules or relax safety gates; that packet itself did not authorize F3 runtime).

Open `PROJECT_STATUS.md` first whenever the project feels confusing.

## Phase 0 legacy records

Phase 0 produced detailed operating records directly under `stocky-plus/docs/`. They remain in place to avoid breaking references. The `phases/phase-0/` folder indexes those records and stores the independent review outcome.

Future phases must place their phase-specific reports inside their own `phases/phase-N/` folder.

## Rule

Chats are temporary working rooms. GitHub documents are the permanent memory.
