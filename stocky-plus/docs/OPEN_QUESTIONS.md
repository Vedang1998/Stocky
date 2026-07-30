# Open Questions — Phase 0 / Phase 1 planning

| ID | Question | Why it blocks | Owner | Needed by | Status |
|---|---|---|---|---|---|
| Q-001 | What is the public App Store name and brand system? | F-131; listing, billing handles, support | Product (ChatGPT) | Before any store listing / Phase 6 | Open |
| Q-002 | Confirm Partner Dashboard distribution for the linked app (public vs custom) and whether separate prod/dev/staging apps exist | F-002; deploy strategy; D-019 | Product + Partner account holder | Before any Phase 1 deployment work | **Open — evidence still required** |
| Q-003 | Which Shopify Admin API version is the project pin after GraphQL ops are fixed? | Invalid inventoryLevel / transfer complete ops on 2025-10; D-023 requires validation before sync implementation | Product + Cursor | Before first Phase 1 sync implementation merge | Open |
| Q-004 | Incoming inventory: app-PO only until native API, or dual-source with badges immediately? | Forecast accuracy; community pain S26 | Product | Phase 2 worksheet | Open |
| Q-005 | Cost authority default for pilots (Shopify cost vs app average vs landed)? | Onboarding step 6; F-106 | Product + pilot merchant | Phase 4 | Open |
| Q-006 | Trial length and development test-plan commercial terms | Entitlement design; D-020 | Product | Future billing/entitlement work (not Phase 1 implementation) | **Open — recommended decision recorded; not implemented** |
| Q-007 | Are Essentials $29 / Growth $79 / Pro $149 still the pilot hypotheses? | Billing adapter; must not hardcode forever | Product | Pilot validation | Open |
| Q-008 | Uninstall + `shop/redact` retention window and what operational data is erased vs anonymized | Compliance + support; D-021 | Product + legal | Phase 1 privacy processors before production | **Open — recommended policy recorded; legal review still required** |
| Q-009 | Should Phase 0 freeze also hide Receiving/Stocktake/Transfer nav entries while flags are off? | UX clarity vs auditability | Product | Optional UX polish | Open |
| Q-010 | Native Shopify transfer receive mutation replacement for removed `inventoryTransferComplete` | Transfer Phase 5 design | Engineering research | Phase 5 | Open |
| Q-011 | Phase 1 foundation must add database-enforced tenant isolation (canonical Shop, shopId, composite tenant constraints, forced RLS, restricted runtime role, separate migration role, transaction-local context, bootstrap exception, real PostgreSQL and pool isolation tests) — Claude F-016 / R-022 | **P1 gating requirement.** Application-layer shop filters alone are insufficient. | Product + Cursor (Phase 1) | Phase 1 foundation — **mandatory implementation gate until merged and independently verified** | **Open — layered decision proposed in draft brief; not implemented** |

## Q-002 — evidence still required

Keep **open** until the Partner account holder provides evidence of:

* production Shopify app ID;
* development and staging app IDs;
* actual Partner Dashboard distribution methods;
* development, staging, and production configuration separation;
* linked Shopify CLI configuration.

Intended production distribution remains public App Store (D-019), pending that evidence. No deployment is authorized by Phase 1 planning alone.

## Q-006 — recommended decision (not implemented)

Recommended commercial hypothesis:

* 14-day Growth-equivalent trial;
* private $0 development plan;
* non-production only;
* unavailable to ordinary merchants;
* cannot bypass tenancy, permissions, or inventory-write controls;
* billing and entitlements remain deferred (out of Phase 1 implementation scope).

Do **not** close Q-006 as implemented. Phase 1 planning records the hypothesis only.

## Q-008 — recommended policy (legal review required)

Recommended privacy policy for Phase 1 design:

* uninstall disables shop processing immediately;
* queued jobs are cancelled or fail closed;
* sessions and tokens are deleted;
* operational data is erased on `shop/redact`;
* unnecessary customer PII is not stored;
* any legally retained records are minimized, segregated, and inaccessible to normal application workflows;
* legal review remains required before production.

Do **not** treat this as final production policy until legal counsel validates retention, deletion manifests, and privacy-policy language.

## Q-011 — mandatory Phase 1 implementation gate

Proposed layered isolation decision (draft brief / D-012–D-018):

* canonical `Shop`;
* `shopId` on every merchant-owned row;
* composite tenant constraints;
* forced PostgreSQL RLS;
* restricted runtime role;
* separate migration role;
* transaction-local tenant context;
* restricted Session/Shop bootstrap exception;
* real PostgreSQL and connection-pool isolation tests.

Keep Q-011 **open** as a mandatory Phase 1 implementation gate until the enforcement work is merged and independently verified. Composite tenant foreign keys without RLS do not satisfy F-016 / R-022.
