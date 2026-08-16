# Stocky Migration — Shared Agent Governance

## Purpose

This repository is building a commercial public Shopify App Store inventory-management platform with documented Stocky functional parity, Shopify-native workflows, improved reliability, advanced reporting, and financially controlled AI capabilities.

The goal is not to generate the most code. The goal is to build a reliable, commercially viable inventory platform merchants can trust.

## Repository

- Repository: `Vedang1998/Stocky`
- Application: `stocky-plus/`
- Product source of truth: `stocky-plus/docs/product/`
- Start with: `stocky-plus/docs/product/00_READ_ME_FIRST.md`
- Operational prompts: `stocky-plus/docs/agents/`

The approved product documents take precedence over:

- unfinished code;
- old prompts;
- earlier replenishment-only assumptions;
- README marketing claims;
- undocumented developer assumptions;
- implementation shortcuts.

No agent may change an approved product rule merely because a different implementation is easier.

## Agent responsibilities

### ChatGPT

Owns product requirements, current Shopify and market research, business rules, formulas, workflow decisions, architecture direction, pricing, acceptance criteria, and coordination.

### Cursor

Implements approved work, creates migrations, runs commands and tests, updates technical documentation, and opens focused pull requests. Cursor must not redefine product logic independently.

### Claude Code

Independently inspects and executes the repository, verifies implementation claims, reviews security and correctness, and issues evidence-based readiness findings. Claude Code must not approve work based only on summaries or screenshots.

## Product principles

Always preserve these rules:

1. Build full Stocky functional parity, not merely replenishment.
2. Reproduce workflows and behavior without copying Stocky branding or impersonating Shopify.
3. Shopify is authoritative for products, variants, orders, refunds, locations, and sellable inventory.
4. The app owns advanced suppliers, purchasing, receiving, cost ledgers, operational analytics, and audit data where Shopify lacks sufficient stable functionality.
5. Every inventory write must be idempotent, auditable, permission-checked, reconcilable, and recoverable.
6. Every forecast must be explainable.
7. Variant-level identity must be preserved.
8. Mobile and Shopify POS workflows are first-class requirements.
9. Merchants must be able to export their operational data.
10. No hidden formula changes.
11. No globally forced MOQ, pack size, lead time, safety stock, or case rounding.
12. No production release without reconciliation against Shopify and representative Stocky exports.
13. Do not overbuild unrelated ERP functionality before core parity is reliable.

## Forecasting boundary

### Stocky Parity mode

Deterministic and familiar methods, including:

- Last X days;
- custom date range;
- same period last year;
- fill shelves;
- fill shelves if below minimum;
- target stock level;
- Stocky ABC/U rules.

### Smart Forecast mode

Optional enhancements, including:

- seasonality;
- trend;
- intermittent demand;
- stockout-adjusted demand;
- forecast confidence;
- backtesting;
- lead-time prediction;
- PO optimization;
- anomaly detection.

Smart mode must never silently replace parity calculations.

## Pricing and AI economics

Follow `stocky-plus/docs/product/11_PRICING_AND_PACKAGING_STRATEGY.md`.

Commercial rules:

- Every paid plan includes the essential Stocky workflow.
- Plans expand by scale and operational sophistication.
- Do not price primarily by merchant revenue.
- Do not advertise unlimited AI.
- Do not use LLMs for deterministic forecasting, ABC, inventory, or cost calculations.
- Every AI action requires entitlement, credit, provider-cost, and global-budget authorization.
- AI cost and quality must be measured before production release.
- Final dollar prices and numerical limits remain hypotheses until pilot validation.

## Engineering rules

- Derive the authenticated shop server-side from Shopify sessions.
- Tenant-scope every query, unique constraint, job, export, and mutation.
- Enforce permissions on the server; hiding UI is not authorization.
- Use decimal-safe money handling.
- Store timestamps in UTC and apply merchant timezone explicitly at boundaries.
- Use immutable operational events for receipts, adjustments, counts, transfers, costs, billing, and AI usage.
- Use bounded retries, idempotency keys, correlation IDs, and merchant-visible failures.
- Avoid hidden pagination caps and N+1 Shopify requests.
- Use additive migrations with a rollback or recovery strategy.
- Do not store unnecessary customer PII.
- Do not enable destructive workflows without feature flags and kill switches.

## Inventory-write safety

Receiving, adjustment, stocktake, cost-sync, and transfer writes require:

- a stable operation ID;
- authenticated shop and actor;
- location and permission checks;
- idempotency;
- line-level results;
- partial-failure handling;
- an audit event;
- reconciliation;
- a recovery or reversal policy;
- a kill switch;
- tests.

A workflow must not be marked complete when Shopify writes failed.

## Accelerated Safe Delivery v1

Canonical document: `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md`.

This is the permanent operating model for ChatGPT, Cursor, and Claude Code from Phase 1 PR 5 implementation onward. It changes calendar execution, not acceptance standards.

Mandatory rules:

- Safety gates do not change (tenancy/RLS, authorization, additive migrations, money, inventory-write safety, Shopify authority, reconciliation, exact-head CI, independent review, feature flags, kill switches, production authorization).
- Parallelize work, not uncertainty. Shared schema/interfaces/security/transaction primitives freeze before dependent runtime lanes start.
- Planning/research may proceed one dependency level ahead only when expressly authorized. Planning ahead is not implementation authorization. Future-phase runtime, migrations, Shopify configuration, and production actions remain forbidden.
- ChatGPT may authorize up to 2–4 parallel Cursor lanes after shared contracts are frozen. Each lane has one branch, one chat, one objective, exclusive file ownership, exact base SHA, own tests, and own PR. One writer per branch/PR.
- Foundation first: land schema, migration, interfaces, transaction/identity primitives, and security boundaries before widening downstream lanes.
- Use small focused PRs. Do not implement an entire phase in one huge PR.
- Risk tiers: Tier A (auth, tenancy, migrations, identity, deletion, concurrency, money, forecast, inventory writes, reconciliation, billing, AI spend, security) requires architecture contract, independent Claude review, exact-head full CI, and adversarial races where relevant. Risk tier does not override an explicit phase gate.
- Claude performs early exhaustive red-team review for new Tier-A architecture and tries to find the whole material finding set in one pass. Final exact-head review remains mandatory.
- ChatGPT issues one consolidated correction package where practical.
- GitHub is the durable handoff. Chat summaries are convenience only.
- Do not delete tests to go faster. CI sharding requires its own tooling review and must preserve the CI Gate.

Cursor must not invent parallel lanes or start adjacent runtime work on its own.

Claude independent review cannot be replaced by another Cursor lane.

## Delivery workflow

For substantial work:

1. Read the approved product documents and active agent prompt.
2. Inspect current repository and Git state.
3. State branch, scope, and assumptions.
4. Run baseline checks before broad changes.
5. Make focused, reviewable changes.
6. Add or update tests.
7. Run applicable validation.
8. Update technical documentation and decision records.
9. Commit intentionally.
10. Open a pull request.
11. Report exact evidence and remaining blockers.

Do not commit directly to `main` unless the user explicitly instructs it.
Do not merge without explicit user authorization.
Do not mix unrelated phases in one pull request.
Never include secrets, credentials, `.env` files, customer information, or production data.

## Evidence standard

Never claim that code, commands, tests, builds, migrations, Shopify configuration, or GraphQL operations were inspected or executed without direct evidence.

A completion report must distinguish:

- executed and passed;
- executed and failed;
- not executed;
- blocked;
- inferred only.

For material checks, record the command, exit status, environment, commit SHA, and relevant output.

## CI evidence policy

Durable detail: `stocky-plus/docs/CI_POLICY.md`.

1. For an open pull request, the exact-head `pull_request` CI/gate is the authoritative automatic evidence. A second push-triggered exact-head run is not required.
2. Feature/tooling branch pushes do not run the full CI workflow. Only `main` pushes receive post-merge push CI.
3. Docs-only exact-head evidence is the lightweight classification / docs-integrity gate. A change is docs-only only when there is at least one changed path and every changed path is `stocky-plus/docs/**` or `AGENTS.md`.
4. A full PostgreSQL / Redis / migration / tenant-security suite is not required for a provably docs-only diff.
5. Any unknown, mixed, empty, or non-doc path fails closed to full CI. `.github/**`, application, schema, scripts, lockfiles, Shopify/GraphQL/test config, and mixed docs+runtime diffs are full CI.
6. `workflow_dispatch` remains the explicit full-CI escape hatch.

This policy reduces redundant Actions consumption. It does not weaken runtime, security, or migration coverage for actual code changes.

## Product-rule changes

When an approved product rule needs to change, document:

1. Current rule
2. Proposed rule
3. Reason
4. Merchant impact
5. Technical impact
6. Migration impact
7. Risks
8. Final decision

No agent may silently substitute a different rule.