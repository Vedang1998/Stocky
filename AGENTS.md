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

## Cursor Cloud specific instructions

The application lives in `stocky-plus/`. Run all `npm`/`npx prisma` commands from
that directory. Node 22 and npm 11.5.2 are preinstalled; the environment update
script refreshes JS deps (`npm install`) and the Prisma client (`npx prisma generate`).

PostgreSQL 16 and Redis 7 are installed in the environment snapshot but are **not**
auto-started (this container has no systemd). Start both once per session before
running the app or DB-backed tests:

```bash
sudo pg_ctlcluster 16 main start   # PostgreSQL on :5432
sudo redis-server --daemonize yes  # Redis on :6379
```

The Postgres role, password, and database name match the values in
`stocky-plus/docker-compose.yml` (role/db `stocky` / `stocky_plus`). If a fresh
snapshot is missing them, create a login role with that password plus a
`stocky`-owned `stocky_plus` database via `sudo -u postgres psql` /
`sudo -u postgres createdb -O`.

`stocky-plus/.env` is git-ignored and required at runtime. If it is missing,
recreate it from `.env.example`: point `DATABASE_URL` at the local `stocky_plus`
database (host `localhost:5432`, the docker-compose credentials), point
`REDIS_URL` at local Redis on its default port `6379`, and set
`TENANT_JOB_ENVELOPE_SECRET` to at least 32 bytes (`openssl rand -base64 48`).
The `DATABASE_URL`/`REDIS_URL` values match `stocky-plus/docker-compose.yml`.
`SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET`
can be placeholder values for local dev and tests. After Postgres is up on a fresh
DB, apply schema with `npx prisma migrate deploy` (optional demo data: `npm run db:seed`).

Running the app: `npm run dev` maps to `shopify app dev`, which needs interactive
Shopify Partner auth plus a public tunnel and does **not** work headlessly here.
For local dev/testing run the React Router dev server directly with
`npx react-router dev` (serves on :3000); the background worker is `npm run worker`
(requires Redis). Standard lint/test/build commands are in `stocky-plus/package.json`
and its `README.md`. Note the DB-backed suites `npm run test:migrations` and
`npm run test:tenant-access` create and drop scratch databases, so Postgres must be
running for them.