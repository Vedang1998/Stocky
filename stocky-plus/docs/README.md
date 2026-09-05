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

## Live project control files

- `PROJECT_STATUS.md` — current phase, active work, blockers, and next action;
- `DECISIONS.md` — approved decisions and changes to product rules;
- `OPEN_QUESTIONS.md` — unresolved product or technical questions;
- `RISK_REGISTER.md` — active risks and owners;
- `CI_POLICY.md` — GitHub Actions evidence, docs-only classification, and CI Gate rules;
- `ACCELERATED_SAFE_DELIVERY.md` — permanent ChatGPT / Cursor / Claude operating model from PR 5 implementation onward;
- `EMERGENCY_DELIVERY_DIRECTIVE_2026-09-01.md` — Emergency Continuity Sprint control packet (internal/controlled rescue after Stocky sunset; does not change product rules, relax safety gates, or authorize F3 runtime).

Open `PROJECT_STATUS.md` first whenever the project feels confusing.

## Phase 0 legacy records

Phase 0 produced detailed operating records directly under `stocky-plus/docs/`. They remain in place to avoid breaking references. The `phases/phase-0/` folder indexes those records and stores the independent review outcome.

Future phases must place their phase-specific reports inside their own `phases/phase-N/` folder.

## Rule

Chats are temporary working rooms. GitHub documents are the permanent memory.
