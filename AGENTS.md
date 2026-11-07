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

**Activation status:** The Claude-first operating model is not active until the explicit activation record required by [`CLAUDE_FIRST_AUTONOMY_MIGRATION.md` §6](stocky-plus/docs/agents/CLAUDE_FIRST_AUTONOMY_MIGRATION.md#6-instruction-consistency-and-activation-gate) is published in GitHub. Merging the proposal (PR69, 2026-11-07) or this instruction alignment is not activation. Until that record exists, the current effective model below governs.

### Current effective model — until recorded activation

- **ChatGPT — product owner, coordination and acceptance authority.** Owns product requirements, current Shopify and market research, business rules, formulas, workflow decisions, architecture direction, pricing, acceptance criteria, and coordination. Authorizes exact tasks within scope the owner has delegated.
- **Cursor — current implementation assignment/default under its admitted task.** Implements approved work under the exact task admitted to it, creates migrations, runs commands and tests, updates technical documentation, and opens focused pull requests. Cursor must not redefine product logic independently. Keeping this transitional description is not a recommendation to retain Cursor as the builder and does not permit resuming frozen PR68 work; all current stopped-task decisions (including the issue52 / PR68 record) still apply.
- **Actual Claude — independent review.** Independently inspects and executes the repository, verifies implementation claims, reviews security and correctness, and issues evidence-based readiness findings. Claude must not approve work based only on summaries or screenshots, and never reviews a candidate it authored.
- **One-off task-specific assignments.** A bounded assignment outside the defaults above (for example a documentation-correction or instruction-alignment author task given to Claude) requires explicit authorization by the owner, or by ChatGPT acting within scope the owner has already delegated, and must be recorded in GitHub with its own work order. A recorded work order without that authority is not permission. Neither ChatGPT nor any builder or reviewer session may self-grant owner-reserved powers (merge, production, credentials/permissions, spending, ownership transfer, or activation). Such an assignment is governed by its own work order and is not general activation.

**Review transport (current).** Durable operating record: `stocky-plus/docs/agents/PROPO_NATIVE_REVIEW_WORKFLOW.md`. Its transport descriptions, and those in issue52, are dated and are subject to later task-specific dispositions recorded in GitHub. Labels are notifications, not authority; obsolete label delivery is not revived, and no scheduled route is assumed healthy without current evidence. Do not rebuild a custom Actions review runner.

**Mandatory safety summary.** Canonical: `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md`. Safety gates do not change (tenancy/RLS, authorization, additive migrations, money, inventory-write safety, Shopify authority, reconciliation, exact-head CI, independent review, feature flags, kill switches, production authorization). Respect dependency order: shared schema/interfaces/security primitives freeze before dependent lanes. One writer per branch/PR with exclusive file ownership; parallel lanes only when explicitly authorized. Exact-head CI on the actual candidate is required; earlier-head CI never certifies a new head. Do not delete tests to go faster.

### Selected future model — Claude-first, pending activation

The owner selected this model and PR69 merged it as **inactive** documentation on 2026-11-07. It takes effect only after the recorded activation above: **Claude Code is the primary builder; ChatGPT owns product and acceptance; Cursor is optional; review is by a specifically admitted non-author.** It does not authorize PR7 runtime, a PR68 takeover, production access, or any new feature.

#### ChatGPT — product owner and acceptance authority

Owns product requirements, priority, approved briefs, research, architecture decisions, acceptance criteria, risks, and release recommendations. Uses GitHub as durable evidence. ChatGPT access does not imply unattended PR monitoring or automated task dispatch; those require separately proven triggers.

#### Claude Code — primary implementation agent (after activation)

Owns authorized implementation tasks: inspect the exact GitHub issue and approved brief, use one task/branch/PR, implement code and tests, run applicable validations, record exact evidence, push a focused branch, and open a PR. Use cloud execution only after GitHub app access, environment isolation, permissions, and spending limits are verified. Never start unapproved phase/runtime work. No automatic merge, production connection, or secret exposure.

#### Independent reviewer — a specifically admitted non-author

Each review is assigned to a named reviewer that did not author the candidate. The reviewer is not automatically Cursor, and the builder's self-check is never the independent review. A second Claude session is not independent merely because it is a new session; record its identity and note same-provider limits. The reviewer inspects actual code, exact-head CI, security, tenancy, Shopify authority, migrations, inventory-write safety, and acceptance criteria, must not edit the builder's branch, and must not approve from the builder's summary alone. ChatGPT coordinates acceptance.

#### Cursor — optional inspection or explicitly authorized fallback

Cursor is not the default implementation owner after activation. It may inspect changes, or act as a backup builder or reviewer only when explicitly assigned for that task, never as a parallel writer on the same branch. Leaving Cursor open does not automatically validate code or current Shopify documentation.

### Proposed hands-off orchestration — not yet configured

- GitHub issues and approved phase briefs define tasks. A verified cloud agent trigger dispatches one approved task to Claude Code; no trigger is assumed operational until an end-to-end test proves it.
- Claude Code creates a branch and PR; existing GitHub CI checks the exact PR head; a separately verified reviewer records findings; Claude handles bounded corrections; ChatGPT provides evidence-based acceptance; owner approves merge and any production release.
- GitHub labels are notifications, not authority. Deduplicate jobs by task, head SHA, and role. Never auto-start unauthorized adjacent work.
- Stop and escalate on ambiguous product requirements, security/tenancy/financial/inventory concerns, exhausted retries, unavailable reviews, cost thresholds, or failed CI. Fail closed on missing evidence.
- Do not grant broad production credentials to coding agents. Production deployments, migrations, Shopify mutations, and inventory-write flags require separately documented authorization.
- Existing CI and product rules remain authoritative. No custom workflow runner, subscription, webhook, credential, or GitHub ruleset is enabled by documentation alone.
- Detailed migration contract, surface map and prerequisite checklist: `stocky-plus/docs/agents/CLAUDE_FIRST_AUTONOMY_MIGRATION.md`. Historical native Claude review records remain immutable; review transport must be revalidated because Claude becomes the builder.

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

## Accelerated Safe Delivery — preserved gates

Canonical document: `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md`. Its safety, dependency-order, exact-head CI, review, phase authorization, and production restrictions remain effective. The Claude-first role change above is **selected but inactive** and must not silently reinterpret the older Cursor-specific provisions before the activation record required by [`CLAUDE_FIRST_AUTONOMY_MIGRATION.md` §6](stocky-plus/docs/agents/CLAUDE_FIRST_AUTONOMY_MIGRATION.md#6-instruction-consistency-and-activation-gate) is published; merge alone is not activation. Any parallel Claude lanes need explicit authorization, frozen shared contracts, exclusive file ownership, and one writer per branch.

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