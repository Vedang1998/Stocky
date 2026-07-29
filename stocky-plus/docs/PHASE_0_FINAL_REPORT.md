# Phase 0 Final Report

## Identity

| Field | Value |
|---|---|
| Branch | `phase-0-product-alignment-v2` |
| Base main SHA | `f1923acef0c44b1e80d0b5aae44a517aedf56aef` |
| Final commit SHA | _(filled after commit)_ |
| Repository | `Vedang1998/Stocky` |
| Application | `stocky-plus/` |
| Node / npm | `v22.19.0` / `11.5.2` |

## 1. Repository and app configuration state

- Distribution code path: `AppDistribution.AppStore` with `expiringOfflineAccessTokens: true`.
- API version: Admin GraphQL **2025-10** (`shopify.app.toml` + `ApiVersion.October25`) — intentionally not bumped to old branch’s 2026-10.
- Scopes after Phase 0: `read_products,write_products,read_inventory,write_inventory,read_orders,read_locations` (MMFO removed).
- Compliance topics declared: `customers/data_request`, `customers/redact`, `shop/redact` → `/webhooks/compliance` stub.
- Partner linkage via `shopify app info`: **FAILED** (CLI stack overflow) — distribution not confirmed in Partner Dashboard this pass.
- Approved product documents under `docs/product/` and agent prompts under `docs/agents/` **were not overwritten**.

## 2. Distribution status / risk

Code targets App Store distribution. Physical Partner app record, public listing readiness, and separate prod/dev apps are **unverified** (CLI failure). Treat as open P0 process risk (Q-002).

## 3. Commands run and exact status

See `CURRENT_COMMAND_BASELINE.md`.

| Check | Status |
|---|---|
| `npm install` | PASS (exit 0); 32 high audit advisories noted |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS (29 tests) |
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS (local DB up to date) |
| `npm run build` | PASS (future-flag warnings only) |
| `npx shopify version` | PASS (`3.84.1`) |
| `npx shopify app info` | FAIL (max call stack) |
| `npm run graphql-codegen` | FAIL (document validation: inventoryLevel args + inventoryTransferComplete) |
| Integration / E2E | NOT EXECUTED (no script) |

## 4. Scope / API / webhook findings

- Removed unjustified merchant-managed fulfillment scopes.
- Compliance webhook subscription added; handler authenticates and acknowledges only.
- GraphQL validation proves current inventory level query and transfer-complete mutation are **schema-invalid** on 2025-10 — transfer writes remain kill-switched.

## 5. Old branch classification (`origin/phase-0-product-alignment`)

Commits ahead of main: `9d2f1c1`, `36368cb`.

| Change class | Items |
|---|---|
| **Retain** (ported) | `feature-flags.server.ts`; stocktake/transfer/receipt gating pattern; characterization tests; scope cleanup; Phase 0 operating doc *structure* |
| **Rewrite** | All operating docs — rewritten against current main + live audit |
| **Documentation only** | N/A from old product folder (already on main) |
| **Unsafe** | afterAuth forcing `subscriptionActive: true`; unprotected commercial bypass patterns |
| **Obsolete** | Product docs + Cursor/Claude prompts under `docs/product/`; `feature_matrix.json`; Stocky++ toml name/client_id hardcoding; API bump to 2026-10 without validation |
| **Duplicate of current main** | Product matrix/PRD content already merged |
| **Outside Phase 0** | Broad Buying Table / PO detail / warehouse refactors; new `purchase-order.server.ts` service extraction as feature work |

**Not cherry-picked wholesale.**

## 6. Files changed (this PR)

Runtime / config:

- `stocky-plus/app/lib/feature-flags.server.ts` (new)
- `stocky-plus/app/lib/po-display.ts` (new)
- `stocky-plus/app/services/characterization.test.ts` (new)
- `stocky-plus/app/routes/webhooks.compliance.tsx` (new)
- `stocky-plus/app/routes/app.stocktakes.tsx`
- `stocky-plus/app/routes/app.transfers.tsx`
- `stocky-plus/app/routes/app.purchase-orders.tsx`
- `stocky-plus/app/routes/app.warehouse.tsx`
- `stocky-plus/app/routes/app.buying-table.tsx`
- `stocky-plus/app/routes/app.suppliers_.$id.tsx`
- `stocky-plus/app/routes/app._index.tsx`
- `stocky-plus/app/routes/app.billing.tsx`
- `stocky-plus/shopify.app.toml`
- `stocky-plus/.env.example`

Docs (operating records only):

- `stocky-plus/docs/CURRENT_COMMAND_BASELINE.md`
- `stocky-plus/docs/CURRENT_ROUTE_AND_FEATURE_INVENTORY.md`
- `stocky-plus/docs/DATA_AUTHORITY_MAP.md`
- `stocky-plus/docs/CODE_TO_REQUIREMENT_GAP_MAP.md`
- `stocky-plus/docs/DECISIONS.md`
- `stocky-plus/docs/OPEN_QUESTIONS.md`
- `stocky-plus/docs/RISK_REGISTER.md`
- `stocky-plus/docs/PROJECT_STATUS.md`
- `stocky-plus/docs/PHASE_0_FINAL_REPORT.md`
- `stocky-plus/docs/PHASE_1_TECHNICAL_PLAN.md`

**Not changed:** `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/**`, `stocky-plus/docs/product/**`, `stocky-plus/docs/agents/**`.

## 7. Tests added

`app/services/characterization.test.ts` — forecast OOS/30/14, ABC boundary vs parity, flags default OFF, PO display helpers, stocktake safety control flow, MOQ/pack forced rounding. Marked KNOWN-WRONG where applicable.

## 8. Unsafe workflows disabled or protected

| Capability | Flag | Default |
|---|---|---|
| Stocktake Shopify adjusts | `FEATURE_STOCKTAKE_INVENTORY_WRITES` | OFF |
| Adjustments | `FEATURE_ADJUSTMENT_WRITES` | OFF |
| Receipt path (PO receive + warehouse scan) | `FEATURE_RECEIPT_WRITES` | OFF |
| Cost sync | `FEATURE_COST_SYNC` | OFF |
| Transfer Shopify mutations | `FEATURE_TRANSFER_WRITES` | OFF |

Additional: stocktake no longer marks `COMPLETED` when writes fail; `devActivate` requires env allowlist + non-production.

## 9. P0 / P1 / P2 / P3 findings

See `RISK_REGISTER.md` and `CODE_TO_REQUIREMENT_GAP_MAP.md`. Highest:

- P0 tenant residual risk in shop-blind services (landed-cost internals).
- P0 forecast/ABC non-parity.
- P0 missing sales/receipt/audit facts.
- P0 GraphQL invalid ops.
- P0 branding leftovers in README/SETUP.
- P0 compliance processing incomplete.
- P1 Boolean entitlements / no AI cost controls.
- P1 hard caps / N+1.
- P1 uninstall job hygiene.

## 10. Unresolved blockers

- Partner distribution confirmation.
- Public product name.
- GraphQL operation repairs before any write enablement.
- Full entitlement + AI ledger (design only).

## 11. Decisions requiring product-owner approval

D-005 public name; Q-002 distribution; Q-003 API pin after fixes; Q-004 incoming strategy; Q-006/Q-007 trial and prices; Q-008 redact retention.

## 12. Exact Phase-1 next step

After review acceptance: branch from updated main → additive Shop/facts/sync/audit migrations + fix `inventoryLevel` GraphQL → keep all inventory write flags **OFF** (`PHASE_1_TECHNICAL_PLAN.md`).

## 13. Explicit statements

- **Phase 1 was not started.**
- **No secrets, `.env`, customer data, or production data were committed.**
- **Approved product documents were not overwritten.**
- **Old branch `phase-0-product-alignment` was not deleted and was not merged.**
