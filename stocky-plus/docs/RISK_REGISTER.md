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
| R-013 | P2 | npm audit 32 high | `npm install` output | Deferred | Supply-chain | Separate hardening PR |
| R-014 | P2 | Money via JS Number in handlers | PO create/receive forms | Documented | Rounding risk | Decimal-safe Phase 3 |
