# Open Questions — Phase 0

| ID | Question | Why it blocks | Owner | Needed by |
|---|---|---|---|---|
| Q-001 | What is the public App Store name and brand system? | F-131; listing, billing handles, support | Product (ChatGPT) | Before any store listing / Phase 6 |
| Q-002 | Confirm Partner Dashboard distribution for the linked app (public vs custom) and whether separate prod/dev apps exist | F-002; Phase 0 exit | Product + Partner account holder | Before Phase 1 deploy strategy |
| Q-003 | Which Shopify Admin API version is the project pin after GraphQL ops are fixed? | Invalid inventoryLevel / transfer complete ops on 2025-10 | Product + Cursor | Before enabling transfer writes |
| Q-004 | Incoming inventory: app-PO only until native API, or dual-source with badges immediately? | Forecast accuracy; community pain S26 | Product | Phase 2 worksheet |
| Q-005 | Cost authority default for pilots (Shopify cost vs app average vs landed)? | Onboarding step 6; F-106 | Product + pilot merchant | Phase 4 |
| Q-006 | Trial length and development test-plan commercial terms | Entitlement design | Product | Phase 1 entitlement schema |
| Q-007 | Are Essentials $29 / Growth $79 / Pro $149 still the pilot hypotheses? | Billing adapter; must not hardcode forever | Product | Pilot validation |
| Q-008 | Uninstall + `shop/redact` retention window and what operational data is erased vs anonymized | Compliance + support | Product + legal | Phase 1 |
| Q-009 | Should Phase 0 freeze also hide Receiving/Stocktake/Transfer nav entries while flags are off? | UX clarity vs auditability | Product | Optional UX polish |
| Q-010 | Native Shopify transfer receive mutation replacement for removed `inventoryTransferComplete` | Transfer Phase 5 design | Engineering research | Phase 5 |
| Q-011 | Phase 1 foundation must add database-enforced tenant isolation (approved composite shop constraints, tenant ownership, or another approved mechanism) — Claude F-016 / R-022 | **P1 gating requirement.** Application-layer shop filters alone are insufficient. No Phase 1 implementation occurred in Phase 0. Remains open. | Product + Cursor (Phase 1 brief) | Phase 1 foundation — **mandatory brief gate; do not implement until Phase 1 brief is approved** |
