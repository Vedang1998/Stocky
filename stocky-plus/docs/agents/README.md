# Agent Setup and Operating Model

This directory contains operational prompts and copy-ready project instructions. Product requirements remain under `stocky-plus/docs/product/` and take precedence.

## Shared repository governance

The repository root contains:

- `AGENTS.md` — shared operating constitution for all coding and review agents;
- `CLAUDE.md` — Claude Code-specific independent-review memory;
- `.cursor/rules/` — smaller Cursor rules split by responsibility so critical instructions load reliably.

## ChatGPT Project

Copy the complete contents of:

`stocky-plus/docs/agents/CHATGPT_PROJECT_INSTRUCTIONS.md`

into the Stocky Migration ChatGPT Project instructions.

ChatGPT remains the product owner, product researcher, architecture and commercial decision authority, and coordinator.

Use one main ChatGPT chat per phase. That chat owns the phase brief, decisions, review of Cursor/Claude output, and the final phase decision.

## Claude Project

Copy the complete contents of:

`stocky-plus/docs/agents/CLAUDE_PROJECT_INSTRUCTIONS.md`

into the Claude Project instructions.

Claude Code should also automatically read the root `CLAUDE.md`. For each formal review, provide the active review prompt, currently:

`stocky-plus/docs/agents/08_CLAUDE_CODE_MASTER_REVIEW_PROMPT.md`

Claude Code is the independent engineering and release reviewer, not the primary product owner. Use a fresh Claude chat for each important pull request review.

## Cursor

Cursor should load the project rules from:

`.cursor/rules/`

The rules are intentionally split:

- `00-project-governance.mdc` — permanent governance and authority boundaries;
- `10-phase-workflow.mdc` — required phase and pull-request workflow;
- `20-repository-evidence.mdc` — Git, CI, and handoff evidence requirements;
- `30-database-enforcement.mdc` — PostgreSQL tenant-enforcement requirements;
- `40-testing-and-ci.mdc` — testing, CI, and adversarial verification standards;
- `50-documentation-chain-of-custody.mdc` — documentation and independent-review preservation;
- `60-current-documentation.mdc` — current external documentation and source hierarchy;
- `90-security-boundaries.mdc` — secrets, production, deployment, and destructive-action restrictions.

For Phase 0, Cursor used:

`stocky-plus/docs/agents/07_CURSOR_MASTER_PROMPT.md`

For future phases, Cursor must read the approved phase brief under `stocky-plus/docs/phases/phase-N/` and receive a focused task prompt. Use a fresh Cursor chat for each focused task or pull request.

Cursor is the implementation engineer and must not redefine product logic independently.

## Phase workflow

Phase-specific work lives under:

`stocky-plus/docs/phases/`

Each phase contains:

- `PHASE_BRIEF.md` — ChatGPT-approved scope before work;
- `IMPLEMENTATION_REPORT.md` — Cursor evidence and handoff;
- `REVIEW_REPORT.md` — Claude findings and verdict.

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
