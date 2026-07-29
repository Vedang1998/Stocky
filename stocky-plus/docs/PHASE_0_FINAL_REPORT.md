# Phase 0 Final Report

## Identity

| Field | Value |
|---|---|
| Branch | `phase-0-product-alignment-v2` |
| Base main SHA | `f1923acef0c44b1e80d0b5aae44a517aedf56aef` |
| Final branch SHA | `b1ed539eec8787d18f9a6de113e49be18a28abee` |
| Merge commit SHA | `36b34c20d6a82fcc226948abd5ff709d9e2fcca6` |
| Repository | `Vedang1998/Stocky` |
| Application | `stocky-plus/` |
| Node / npm | `v22.19.0` / `11.5.2` |

## 1. Repository and app configuration state

- Distribution code path: `AppDistribution.AppStore` with `expiringOfflineAccessTokens: true`.
- API version: Admin GraphQL **2025-10** (`shopify.app.toml` + `ApiVersion.October25`) — intentionally not bumped to old branch’s 2026-10.
- Scopes after Phase 0: `read_products,write_products,read_inventory,write_inventory,read_orders,read_locations` (MMFO removed).
- Compliance topics declared: `customers/data_request`, `customers/redact`, `shop/redact` → `/webhooks/compliance` acknowledge-only stub.
- Partner linkage via `shopify app info`: **FAILED** (CLI stack overflow) — distribution not confirmed in Partner Dashboard this pass.
- Approved product documents under `docs/product/` and agent prompts under `docs/agents/` **were not overwritten**.

## 2. Distribution status / risk

Code targets App Store distribution. Physical Partner app record, public listing readiness, and separate prod/dev apps are **unverified** (CLI failure). Treat as an open release-process risk (Q-002).

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

The passing command results above are Cursor's recorded local evidence. Claude independently reproduced lint and build but could not reproduce every check because its sandbox blocked Prisma engine and Shopify schema downloads. CI is required to make the baseline reproducible.

## 4. Scope / API / webhook findings

- Removed unjustified merchant-managed fulfillment scopes.
- Compliance webhook subscription added; handler authenticates and acknowledges only. It does not yet export or redact data.
- GraphQL validation shows current inventory-level and transfer-complete documents are invalid or unsupported on 2025-10 — transfer writes remain kill-switched.

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

Implemented Shopify-write paths currently guarded and default OFF:

| Capability | Flag | Default |
|---|---|---|
| Stocktake Shopify adjustments | `FEATURE_STOCKTAKE_INVENTORY_WRITES` | OFF |
| Receipt path (PO receive + warehouse scan) | `FEATURE_RECEIPT_WRITES` | OFF |
| Transfer Shopify mutations | `FEATURE_TRANSFER_WRITES` | OFF |

Reserved placeholder flags with no implemented write path in the current repository:

| Placeholder capability | Flag | Current reality |
|---|---|---|
| Manual adjustments | `FEATURE_ADJUSTMENT_WRITES` | Module/write path not implemented |
| Shopify cost sync | `FEATURE_COST_SYNC` | Cost-write path not implemented |

Additional: stocktake no longer marks `COMPLETED` when writes fail; `devActivate` requires an explicit environment allowlist and a non-production environment.

The kill switches are the current protection. Idempotency, per-line results, immutable audit, reconciliation, and reversal are not yet complete; no flag may be enabled for real merchant inventory.

## 9. P0 / P1 / P2 / P3 findings

See `RISK_REGISTER.md`, `CODE_TO_REQUIREMENT_GAP_MAP.md`, and `phases/phase-0/REVIEW_REPORT.md`.

Claude found no confirmed active P0 security issue or cross-shop access in the merged tree. Major release blockers remain:

- tenant isolation is route-safe in reviewed paths but not structurally enforced in every service;
- forecast/ABC non-parity;
- missing sales, receipt, inventory-event, and audit facts;
- invalid GraphQL operations;
- incomplete compliance processing;
- Boolean subscription state without complete entitlements;
- N+1 and hard-cap performance risks;
- incomplete uninstall and queue hygiene.

## 10. Unresolved blockers

- Reproducible lockfile and CI.
- Partner distribution confirmation.
- Public product name.
- GraphQL operation repairs before any write enablement.
- Complete entitlement and AI usage-ledger foundation.
- Actual compliance export/redaction processing.

## 11. Decisions requiring product-owner approval

D-005 public name; Q-002 distribution; Q-003 API pin after fixes; Q-004 incoming strategy; Q-006/Q-007 trial and prices; Q-008 redact retention.

## 12. Exact next step

Close `phases/phase-0/CORRECTION_BACKLOG.md` through a focused Cursor correction PR and Claude verification. After that gate is accepted, create and approve the Phase 1 brief before beginning additive Shop/facts/sync/audit migrations.

All inventory-write flags remain **OFF**.

## 13. Explicit statements

- **Phase 1 was not started.**
- **No secrets, `.env`, customer data, or production data were committed.**
- **Approved product documents were not overwritten.**
- **Old branch `phase-0-product-alignment` was not merged.**

## 14. Independent review outcome

Claude's verdict was **READY FOR PHASE 1 FOUNDATION — with mandatory corrections**. Phase 0 is accepted, but Phase 1 must not begin until the correction gate is resolved. Production inventory writes remain unapproved.
