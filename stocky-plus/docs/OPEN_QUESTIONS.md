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
| Q-011 | Phase 1 foundation must add database-enforced tenant isolation (canonical Shop, shopId, composite tenant constraints, forced RLS, restricted runtime role, separate migration role, transaction-local context, bootstrap exception, real PostgreSQL and pool isolation tests) — Claude F-016 / R-022 | **P1 gating requirement.** Application-layer shop filters alone are insufficient. Planning direction approved. PR 1 tooling is merged (D-026) and remains nullable ownership/diagnostics only — **not** enforcement. **PR 2 application-layer tenant contract merged in PR #13 (D-034 / D-035)** and does **not** close this gate; PR 3 remains the hard database-enforcement gate. | Product + Cursor (Phase 1) | Phase 1 foundation — **mandatory implementation gate until enforcement is merged and independently verified** | **Open — Implementation complete — pending independent verification (PR 3 branch `phase-1/tenant-enforcement`; production execution not authorized; do not close until ChatGPT acceptance after capable independent review)** |

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

Proposed layered isolation decision (approved brief / D-012–D-018), expanded by planning corrections:

* canonical `Shop`;
* `shopId` on every merchant-owned row;
* composite tenant constraints;
* forced PostgreSQL RLS with `USING` / `WITH CHECK` and database-enforced tenant-key immutability;
* restricted runtime role;
* separate migration role;
* transaction-local tenant context derived only from server-side Shopify authentication or a validated job envelope;
* bootstrap exception;
* real PostgreSQL and connection-pool isolation tests;
* lock-conscious constraint rollout;
* ownership-quarantine resolution before enforcement.

Keep Q-011 **open** as a mandatory Phase 1 implementation gate until the enforcement work is merged and independently verified. Composite tenant foreign keys without RLS do not satisfy F-016 / R-022. Do **not** close Q-011 as implemented. ChatGPT’s 2026-07-30 planning approval and PR #9 merge approve the layered direction and make Phase 1 implementation authority effective; they do not close the implementation gate.

**PR 1 status note:** PR 1 is **merged** (authorized head `6e5b024254615f3259aeb8d8252305d86bd63777`; squash `44a24f3387c1dae0351490367c06bef10f333425`; D-025/D-026). PR 1 added nullable ownership and backfill tooling (canonical `Shop`, nullable `shopId`, quarantine diagnostics, compatibility indexes). PR 1 did **not** implement non-null tenant enforcement, composite tenant foreign keys, runtime roles, tenant-context enforcement, or RLS. PR 2 is access conversion. PR 3 is the database-enforcement gate. Q-011 remains open.

**PR 2 acceptance note:** Phase 1 PR 2 technical implementation is **ACCEPTED** (D-034) at reviewed handoff head `70f4a80aab2366108a71fd80320b0f824bfe0cce` with authoritative fifth review report `ff3f9f6a6e9b57cde7df248553694a857b5bc6dd` (verdict `READY FOR CHATGPT PR 2 ACCEPTANCE`).

**PR 2 merge-closure historical note:** PR 2 application-layer tenant contract **merged** in PR [#13](https://github.com/Vedang1998/Stocky/pull/13) (authorized head `5fc98192d2ca350de358316d9383e39103b98c80`; squash `e9c4f87eb28ce0e957a8cbd159719586892f8b98`; `2026-08-03T01:38:59Z`; D-035). **Q-011 remains OPEN.**

**PR 3 correction note (D-037):** Independent review at `57016ed…` returned `NOT READY — CORRECTIONS REQUIRED`. Correction implemented on `phase-1/tenant-enforcement` (draft PR #15) — **pending independent verification**. Prior runtime/test head was `0ee3ae0…` (not `aeeecc2…`). Production execution remains unauthorized. Do **not** close Q-011.