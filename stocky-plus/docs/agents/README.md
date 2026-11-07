# Agent Setup and Operating Model

This directory contains operational prompts and copy-ready project instructions. Product requirements remain under `stocky-plus/docs/product/` and take precedence.

## Shared repository governance

The repository root contains:

- `AGENTS.md` — shared operating constitution for all coding and review agents;
- `CLAUDE.md` — Claude Code-specific memory: role selection per task, independent-review mission, and builder rules after activation;
- `.cursor/rules/` — smaller Cursor rules split by responsibility so critical instructions load reliably.

Permanent multi-agent delivery model:

- `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md`

That document is canonical from Phase 1 PR 5 implementation onward. Agent files here carry concise mandatory summaries only. Do not copy the entire document into every prompt.

## Roles: current effective and selected future

**Activation status:** The Claude-first operating model is not active until the explicit activation record required by [`CLAUDE_FIRST_AUTONOMY_MIGRATION.md` §6](CLAUDE_FIRST_AUTONOMY_MIGRATION.md#6-instruction-consistency-and-activation-gate) is published in GitHub. Merge alone is not activation. `AGENTS.md` is the canonical role statement; this section summarizes it.

| Role | Current effective model (until recorded activation) | Selected future model (after recorded activation) |
|---|---|---|
| ChatGPT | Product owner, coordination and acceptance authority | Unchanged |
| Builder | Cursor under its admitted task; Claude only by explicit one-off assignment | Claude Code |
| Independent reviewer | Actual Claude, never on a candidate it authored | A specifically admitted non-author; not automatically Cursor, never builder self-review |
| Cursor | Current implementation default under its admitted task | Optional inspection or explicitly authorized fallback |
| Owner | Merge, production, security, spending, ownership-transfer and activation decisions | Unchanged |

One-off assignments require explicit owner authorization, or ChatGPT acting within owner-delegated scope, recorded in GitHub. No agent may self-grant owner-reserved powers. PR68 remains frozen under its existing record.

The copy-ready ChatGPT and Claude Project texts below are repository text only. Installing them in an external account is an owner action and is not evidenced by any repository change.

Builder (currently Cursor): parallel lanes exist only when ChatGPT defines them; one branch / chat / objective per lane; exclusive file ownership; do not start adjacent runtime work on your own; one-level-ahead planning only when expressly authorized; shared foundations freeze before dependent lanes.

Independent reviewer (currently Claude): early exhaustive red-team review for new Tier-A architecture; try to discover the whole material finding set in one pass; final exact-head review remains mandatory; independent review cannot be replaced by another builder lane or by builder self-review.

## ChatGPT Project

Copy the complete contents of:

`stocky-plus/docs/agents/CHATGPT_PROJECT_INSTRUCTIONS.md`

into the Stocky Migration ChatGPT Project instructions.

ChatGPT remains the product owner, product researcher, architecture and commercial decision authority, and coordinator.

Use one main ChatGPT chat per phase. That chat owns the phase brief, decisions, review of builder and reviewer output, and the final phase decision.

## Claude Project

Copy the complete contents of:

`stocky-plus/docs/agents/CLAUDE_PROJECT_INSTRUCTIONS.md`

into the Claude Project instructions.

Claude Code should also automatically read the root `CLAUDE.md`. For each formal review, provide the active review prompt, currently:

`stocky-plus/docs/agents/08_CLAUDE_CODE_MASTER_REVIEW_PROMPT.md`

Under the current effective model Claude Code is the independent engineering and release reviewer, not the primary product owner; it authors only under an explicitly authorized one-off assignment. After recorded activation it is the primary builder, and its work is reviewed by a separate admitted non-author. Use a fresh Claude thread for each role change and for each important pull request review; a fresh thread alone does not prove independence.

## Cursor

Cursor should load the project rules from:

`.cursor/rules/`

The rules are intentionally split:

- `00-project-governance.mdc` — permanent governance and authority boundaries;
- `10-phase-workflow.mdc` — required phase and pull-request workflow;
- `15-native-review-transport.mdc` — review transport and current/future role summary;
- `20-repository-evidence.mdc` — Git, CI, and handoff evidence requirements;
- `30-database-enforcement.mdc` — PostgreSQL tenant-enforcement requirements;
- `40-testing-and-ci.mdc` — testing, CI, and adversarial verification standards;
- `50-documentation-chain-of-custody.mdc` — documentation and independent-review preservation;
- `60-current-documentation.mdc` — current external documentation and source hierarchy;
- `90-security-boundaries.mdc` — secrets, production, deployment, and destructive-action restrictions.

For Phase 0, Cursor used:

`stocky-plus/docs/agents/07_CURSOR_MASTER_PROMPT.md`

For future phases, the admitted builder must read the approved phase brief under `stocky-plus/docs/phases/phase-N/` and receive a focused task prompt. Use a fresh chat for each focused task or pull request.

Under the current effective model Cursor is the implementation engineer under its admitted task and must not redefine product logic independently. After recorded activation Cursor is optional inspection or an explicitly authorized fallback, never a parallel writer on the builder's branch. `07_CURSOR_MASTER_PROMPT.md` is a historical Phase 0 prompt.

## Phase workflow

Phase-specific work lives under:

`stocky-plus/docs/phases/`

Each phase contains:

- `PHASE_BRIEF.md` — ChatGPT-approved scope before work;
- `IMPLEMENTATION_REPORT.md` — builder evidence and handoff (historically Cursor);
- `REVIEW_REPORT.md` — independent reviewer findings and verdict (historically Claude).

Reusable templates and the exact lifecycle are documented in `stocky-plus/docs/phases/README.md`.

## Reading order for all agents

1. Root `AGENTS.md`
2. Agent-specific repository memory or rules
3. `stocky-plus/docs/product/00_READ_ME_FIRST.md`
4. Product documents in the listed order
5. `stocky-plus/docs/PROJECT_STATUS.md`
6. Approved brief for the active phase
7. Active task or review prompt
8. Relevant repository code, configuration, migrations, tests, and Git history

## Rule priority

When instructions conflict, use this priority:

1. Explicit current user authorization
2. Approved product documents
3. Root `AGENTS.md`
4. Agent-specific persistent instructions
5. Approved phase brief
6. Active task prompt
7. Existing unfinished code and documentation

No agent may silently change an approved product rule. Use a decision record containing current rule, proposed rule, reason, merchant impact, technical impact, migration impact, risks, and final decision.

## Git policy

Unless explicitly directed otherwise:

- use a named branch;
- keep changes focused;
- open a pull request;
- do not commit directly to `main`;
- do not merge without explicit authorization;
- do not include secrets, customer data, `.env` files, or production data;
- do not change runtime code for documentation-only assignments.
