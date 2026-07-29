# Risk Register — Phase 0

| ID | Severity | Risk | Evidence | Mitigation (Phase 0) | Residual | Follow-up |
|---|---|---|---|---|---|---|
| R-001 | P0 | Cross-shop IDOR on child mutations | PO/stocktake/transfer/supplier children historically by bare ID | Shop/parent scoping added on critical routes | Landed-cost service still shop-blind internally | Phase 1: shopId on children + tests |
| R-002 | P0 | Unsafe stocktake Shopify writes | Serial adjusts; available snapshot; incomplete contract | Kill switch OFF; no complete-on-failure | Logic still not production-ready | Phase 5 rebuild |
| R-003 | P0 | Receiving does not update Shopify inventory | `receivePartialPO` DB-only | Receipt writes gated OFF | Merchants may expect inventory change | Phase 4 ledger |
| R-004 | P0 | Wrong forecast / ABC vs Stocky parity | 30/14, OOS, LT, 90-day ABC, no U | Characterization tests lock behavior | Cannot claim parity | Phase 2 engine |
| R-005 | P0 | Missing privacy compliance processing | Stub webhook only | Topics declared in toml | No real redact/export | Phase 1 |
| R-006 | P0 | Branding / naming compliance | Stocky++ in README/SETUP/worker logs | Softened Admin billing/dashboard labels | Docs still dirty | Q-001 |
| R-007 | P0 | Invalid GraphQL operations vs 2025-10 | Codegen: inventoryLevel args; inventoryTransferComplete missing | Transfer writes OFF | Enablement would fail at runtime | Fix ops Phase 1/5 |
| R-008 | P1 | Premature Boolean billing | `subscriptionActive`; most routes ungated | Dev activate locked down | Not commercial-ready | Entitlement service Phase 1 plan / Phase 6 |
| R-009 | P1 | No AI cost controls while marketing historically claimed AI | Buying Table copy cleaned | No LLM calls exist | Must not reintroduce claims | Phase 7 + pricing doc |
| R-010 | P1 | Hard caps hide catalog | take 50/250 | Documented | Scale failure | Phase 1–2 pagination |
| R-011 | P1 | Uninstall does not stop jobs / clear data | webhook deletes sessions only | Documented | Orphan jobs | Phase 1 |
| R-012 | P1 | Shopify CLI `app info` crash | Stack overflow | Recorded as FAIL | Distribution unverified | Manual Partner check |
| R-013 | P2 | npm audit reports ~32 high advisories | `npm install` / `npm ci` audit summary | Deferred — **do not** run `npm audit fix` / `--force` in Phase 0 correction work | Supply-chain risk until separate remediation PR | Separate hardening PR with product/security approval |
| R-014 | P2 | Money via JS Number in handlers | PO create/receive forms | Documented | Rounding risk | Decimal-safe Phase 3 |
| R-015 | P1 | `main` may merge without required CI | PR #6 merged while Actions run `30470541851` was red | **OWNER ACTION REQUIRED:** require PR + status check `Lint, typecheck, test, build, Prisma, GraphQL` + block draft merges | Cursor cannot claim protection fixed without settings evidence | Repository owner configures GitHub branch protection |
| R-016 | P3 | GraphQL codegen depends on live Shopify network | `npm run graphql-codegen` fetches Admin schema from shopify.dev | Keep in CI for now; document dependency | Offline / Shopify outage fails CI | Future: vendored or cached schema with update policy (out of this gate) |
| R-017 | P1 | Incomplete lockfile broke clean Linux `npm ci` | Missing `@emnapi/core@2.0.0-alpha.3`, `@emnapi/runtime@2.0.0-alpha.3`, `@emnapi/wasi-threads@2.0.1` | Minimal lockfile repair + pin `npm@11.5.2` | Residual if npm/Node drift | Follow-up PR #7; keep packageManager pinned |
| R-018 | P3 | npm `engines` / packageManager usability friction (Claude F-012) | Exact pin may confuse local tooling | Document pinned versions; do not broaden upgrades in Phase 0 | Local mismatch risk | Future maintenance |
| R-019 | P3 | GitHub Action major-version drift (Claude F-013) | CI uses pinned major actions that will age | Defer action bumps outside correction gate | Supply-chain / breakage risk | Future maintenance |
| R-020 | P3 | npm `shamefully-hoist` project-config warning (Claude F-014) | CI / install noise | Defer hoist policy cleanup | Cosmetic / install-layout risk | Future maintenance |
| R-021 | P3 | Transfer receive sentinel TODO (Claude F-015) | Unsupported complete path uses sentinel id when Shopify id missing | Contained by unsupported-op error + write flag OFF | Clarity debt | Future maintenance when transfer architecture is approved |
| R-022 | P1 | Application-layer tenancy without DB-enforced isolation (Claude F-016) | Route `shop` filters are necessary but not sufficient | Phase 0 keeps app-layer scoping + denial tests | Cross-tenant risk if a query omits shop | **Mandatory Phase 1 brief:** composite shop constraints / tenant ownership / approved DB mechanism — do not implement Phase 1 model now |
