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

## Claude Project

Copy the complete contents of:

`stocky-plus/docs/agents/CLAUDE_PROJECT_INSTRUCTIONS.md`

into the Claude Project instructions.

Claude Code should also automatically read the root `CLAUDE.md`. For each formal review, provide the active review prompt, currently:

`stocky-plus/docs/agents/08_CLAUDE_CODE_MASTER_REVIEW_PROMPT.md`

Claude Code is the independent engineering and release reviewer, not the primary product owner.

## Cursor

Cursor should load the project rules from:

`.cursor/rules/`

The rules are intentionally split:

- `00-project-governance.mdc` — source of truth, agent roles, product boundaries;
- `10-delivery-and-evidence.mdc` — Git, tests, evidence, and pull-request reporting;
- `20-inventory-data-safety.mdc` — tenancy, inventory writes, ledgers, sync, and recovery;
- `30-forecasting-cost-reporting.mdc` — deterministic formulas, ABC/U, costs, and reports;
- `40-pricing-ai-entitlements.mdc` — plans, billing, entitlements, AI authorization, and cost controls.

For Phase 0, give Cursor:

`stocky-plus/docs/agents/07_CURSOR_MASTER_PROMPT.md`

Cursor is the implementation engineer and must not redefine product logic independently.

## Reading order for all agents

1. Root `AGENTS.md`
2. Agent-specific repository memory or rules
3. `stocky-plus/docs/product/00_READ_ME_FIRST.md`
4. Product documents in the listed order
5. Active task or review prompt
6. Relevant repository code, configuration, migrations, tests, and Git history

## Rule priority

When instructions conflict, use this priority:

1. Explicit current user authorization
2. Approved product documents
3. Root `AGENTS.md`
4. Agent-specific persistent instructions
5. Active task prompt
6. Existing unfinished code and documentation

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