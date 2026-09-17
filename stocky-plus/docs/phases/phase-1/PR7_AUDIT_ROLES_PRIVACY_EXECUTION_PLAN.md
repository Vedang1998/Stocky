# Phase 1 PR7 — Audit, roles, and privacy execution plan

**Status:** **PROPOSED — ONE-DEPENDENCY-AHEAD — NOT IMPLEMENTATION AUTHORITY**

**Document type:** execution-ready architecture / acceptance contract for the next approved Phase 1 module.

This packet does **not** authorize PR7 runtime, migrations, grants, Shopify configuration, production, inventory writes, flag enablement, or merge.

---

## 0. Label discipline

Every claim in this document is one of:

| Label | Meaning |
|---|---|
| **FACT (V)** | Observed on merged executable baseline `a3ff480f1477237f8055f10c43298480a05728a1` |
| **FACT (library)** | Observed in installed TypeScript types under `stocky-plus/node_modules` at V |
| **OFFICIAL** | Current Shopify documentation read on **2026-09-17**; not legal advice |
| **PROVISIONAL (H)** | Observed on unmerged PR6-D candidate `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b`; not merged authority |
| **PROPOSED** | Cursor recommendation for ChatGPT; not a product decision |
| **UNVERIFIED** | Not executed or not confirmed from an official source |
| **BLOCKED** | Specified check could not be executed in this planning environment |

Do not treat unmerged D records, stale `PROJECT_STATUS.md` text on V, or old gap audits as live authority.

Companion file (must stay internally consistent with this plan):

- `stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md`

---

## 1. Identities

| Field | Value |
|---|---|
| Planning branch (platform) | `cursor/planning-pr7-audit-roles-privacy-20260916-63ef` |
| Authorized planning name | `planning/pr7-audit-roles-privacy-20260916` |
| Executable baseline **V** | `a3ff480f1477237f8055f10c43298480a05728a1` — squash of PR [#40](https://github.com/Vedang1998/Stocky/pull/40) (PR6-C) on `main` |
| Pinned D candidate **H** | `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` — live PR [#43](https://github.com/Vedang1998/Stocky/pull/43) head at planning time |
| H branch | `phase-1/pr6-d-order-webhook-import` |
| V is ancestor of H | **FACT** — `git merge-base --is-ancestor` succeeded |
| Commits V..H | **21** |
| Authorization | [PR43 comment 5707545217](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5707545217) (`user=Vedang1998`, `created_at=2026-09-17T02:29:47Z`) |
| Work order | `PR7_Audit_Roles_Privacy_Execution_Prep_Overnight.md` SHA-256 `d7aee155dcc13e25cb00f6131b2b1544757122f6a8d95ffa7073b0b7ccbf4bf0` |
| Decision heading | D-054 **EFFECTIVE** — **no D-055** |
| R-176 | remains **OPEN / P0** — this packet does not close it |
| R-164 | unchanged |
| Q-008 | remains **OPEN** — legal review still required |
| Phase 1 | **IN PROGRESS** |
| Production / inventory-write flags | **NOT AUTHORIZED** / **DEFAULT OFF** |
| This PR | one new **DRAFT documentation-only** PR; never reuse PR43, PR41, or PR38 |

Live shared-control files on V (`PROJECT_STATUS.md`, phase-1 `README.md`) still describe an earlier PR6-B/C state (PR6-C “in correction”, `origin/main` as **T** `f5ec7abb…`). **FACT (V):** those files are stale relative to merged V `a3ff480…`. This planning PR **must not** edit them.

---

## 2. Authority, scope, and non-goals

### In scope (proposal only)

One coherent Phase 1 module matching `PHASE_BRIEF.md` PR 7:

- immutable audit events;
- Shopify-user and role-assignment **scaffold**;
- Phase 1 **platform** permission checks;
- `customers/data_request`, `customers/redact`, and `shop/redact` processors;
- privacy deletion manifests.

### Expressly out of scope

- PR7 runtime, schema, grants, CI workflow edits, or Shopify Admin API version change;
- PR8 reconciliation / performance / Phase 1 exit;
- Phase 2 forecasting, ABC/U, buying worksheet, purchase-order product work;
- full later-phase role templates as production RBAC (buyer / receiver / counter / …);
- gating existing merchandising routes (`app.purchase-orders`, stocktakes, transfers, warehouse) behind the new platform matrix;
- certifying GDPR/CPRA/legal compliance;
- inventing a binding retention period;
- closing R-176, R-164, R-005, Q-008, or creating D-055;
- competing D writer, PR43 subject edits, reviewer-branch edits;
- production, store calls, deployment, flag enablement, real privacy deletion.

### Why one module, not micro-PRs

Audit emission, permission checks, and privacy processing share one tenant-keyed identity, one fail-closed default, and one deletion/immutability coexistence rule. Splitting them into independent runtime PRs would ship processors that cannot prove audit, or audit that cannot survive redaction.

**PROPOSED** internal sequence on **one** implementation branch (foundation schema freeze, then actor/RBAC/audit emit, then privacy processors). Parallel Cursor lanes are **not** recommended: F3 privacy depends on F1/F2 tables and emit helpers. ChatGPT may later split only after that foundation is merged.

---

## 3. Official Shopify facts (2026-09-17)

Sources (no store calls):

- [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance) — accessed **2026-09-17**
- [Privacy requirements](https://shopify.dev/docs/apps/launch/privacy-requirements) — accessed **2026-09-17**
- [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens) — accessed **2026-09-17**
- [Authentication for apps built with Shopify CLI](https://shopify.dev/docs/apps/build/authentication-authorization/cli-app-authentication) — accessed **2026-09-17**

Repo webhook pin remains Admin API **`2026-07`** (`shopify.app.toml` `[webhooks] api_version`, `ApiVersion.July26`). The privacy-law-compliance page’s TOML **example** uses `2024-07`. That example version is **not** this repository’s pin. Payload field names below are the **currently documented** compliance contract; whether Shopify versioned those JSON bodies for `2026-07` is **UNVERIFIED**.

### OFFICIAL — mandatory compliance webhooks

Public App Store apps must subscribe to `customers/data_request`, `customers/redact`, and `shop/redact`. Apps must:

- handle `POST` + `Content-Type: application/json`;
- return **401** for invalid HMAC;
- return a **200-class** status to acknowledge;
- **complete the action within 30 days**, unless legally required to retain data (Shopify: then do not complete deletion).

Shopify’s page is **not legal advice**.

Documented payloads (synthetic field names only):

| Topic | Documented body keys | Timing notes |
|---|---|---|
| `customers/data_request` | `shop_id`, `shop_domain`, `orders_requested[]`, `customer.{id,email,phone}`, `data_request.id` | Provide stored customer data **to the store owner directly** |
| `customers/redact` | `shop_id`, `shop_domain`, `customer.{id,email,phone}`, `orders_to_redact[]` | If no order in past six months, payload ~10 days after request; otherwise withheld until six months |
| `shop/redact` | `shop_id`, `shop_domain` | **48 hours after uninstall** |

**UNVERIFIED:** whether `shop/redact` is still delivered if the merchant reinstalls during that 48-hour window. See **D-PR7-05**.

### OFFICIAL — staff identity vs shop token

- Default tokens are **offline** (shop-scoped; background/webhooks).
- **Online** tokens are optional, tied to the staff member, expire after **24 hours or admin logout**, and carry `associated_user` + `associated_user_scope`.
- Scaffolded apps enable online tokens with `useOnlineTokens: true` **alongside** offline tokens.
- ID tokens authenticate the **user**; access tokens authenticate the **app**. ID tokens carry no Shopify API scopes.

**FACT (V):** `stocky-plus/app/shopify.server.ts` does **not** set `useOnlineTokens`. It does set `future.expiringOfflineAccessTokens: true`.

**FACT (library):** `authenticate.admin` returns `session` and, for embedded apps, `sessionToken: JwtPayload`. Library docs show `sessionToken.sub` as the user key and `session.onlineAccessInfo` only for online sessions.

---

## 4. Repository evidence inventory — merged V

Classification key: **implemented and demonstrated** / **implemented but unproven** / **missing** / **explicitly later** / **requires owner or legal decision**.

Absence is from source **and** tests, not a single grep. Correctness is never inferred from a filename.

### 4.1 Authenticated Shopify actor and session / bootstrap

| Surface | Path / symbol | Status | Proving test |
|---|---|---|---|
| Shopify app config | `app/shopify.server.ts` `shopifyApp`, `authenticate`, `hooks.afterAuth` | **implemented and demonstrated** (shop tenant path) | `app/tenant/__tests__/authority.test.ts` `"verified Shop A resolves to Shop A authority"`; afterAuth chain used by `legacy-unique-selector-resolution.test.ts` |
| Admin tenant derivation | `app/tenant/require-admin-tenant.server.ts` `requireAdminTenant` | **implemented and demonstrated** | `authority.test.ts` verified-shop / conflict / missing-canonical cases |
| Client shop hints cannot create authority | `app/tenant/client-shop.server.ts` `denyConflictingClientShop` | **implemented and demonstrated** | `authority.test.ts`, `client-hints.test.ts`, `client-hint-byte-limits.test.ts`, `large-payload-hints.test.ts`, `app/services/cross-shop-denial.test.ts` |
| Branded tenant authority (shop only; no actor) | `app/tenant/authority.server.ts` `issueTenantAuthority` | **implemented and demonstrated** | `authority.test.ts` `"raw domain/shopId cannot construct branded authority"` |
| Session/Shop bootstrap boundary | `app/tenant/bootstrap.server.ts` `shopifySessionStorage`, `upsertCanonicalShop`, `deleteSessionsForShop`, `updateSessionScope`, `getMerchantDelegate` | **implemented and demonstrated** | `bootstrap.test.ts`; `scripts/tenant-access/architecture-audit.test.ts` `"fails when bootstrap accesses a merchant model"` |
| afterAuth | `app/tenant/after-auth.server.ts` `runAfterAuthTenantBootstrap` | **implemented**; REDACTED/MANUAL path **unproven** | ShopSettings upsert exercised indirectly; **no** test asserts `reactivateShopAfterVerifiedReinstall` + `REDACTED` |
| Webhook tenant | `app/tenant/webhook-tenant.server.ts` `resolveWebhookTenant` | **implemented and demonstrated** | sync intake/integration suites |
| Job envelope v1 helper | `app/tenant/job-envelope.server.ts` | **implemented and demonstrated** | `job-envelope.test.ts`, `queue-redis.test.ts` (schemaVersion v3 on new dispatches) |
| Durable envelope v3 | `app/sync/envelope-v3.server.ts` `TENANT_JOB_ENVELOPE_V3_VERSION` | **implemented and demonstrated** | `app/tenant/__tests__/queue-redis.test.ts`; intake uses `tenant-job-envelope-v3` |
| PostgreSQL runtime identity | `app/db/runtime-identity.server.ts` | **implemented and demonstrated** — **not** merchant RBAC | `scripts/tenant-enforcement/tests/runtime-connected-identity-app.test.ts`, `connected-identity.test.ts`, `role-membership.test.ts` |
| Scopes-update route | `app/routes/webhooks.app.scopes_update.tsx` | **implemented but unproven** | no dedicated test found |
| Staff / User GID on requests | — | **missing** | `requireAdminTenant` never reads `session.userId`, `onlineAccessInfo`, or `sessionToken.sub` |
| `useOnlineTokens` | `app/shopify.server.ts` | **missing** | none |

**FACT (V) `Session` model** (`prisma/schema.prisma`): `shop`, `accessToken`, `isOnline`, optional `userId` / `firstName` / `lastName` / `email` / `accountOwner` / `collaborator` / `emailVerified` / refresh fields. **No `shopId`.** App code does not read the staff columns.

**How identity works today:** shop domain from Shopify session or webhook HMAC, then canonical `Shop`. That is **authentication of the shop**, not **authorization of a staff member**.

### 4.2 Roles and permissions

| Surface | Status | Proving test |
|---|---|---|
| App `Role` / `Permission` / `StaffUser` models | **missing** | none |
| `requirePermission` / assignment APIs | **missing** | none |
| Phase 1 platform permission checks | **missing** (explicit PR7) | none |
| Inventory-write kill switches | **implemented and demonstrated** (orthogonal) | `app/lib/feature-flags.server.ts`; `order-facts/foundation-safety.test.ts`, `catalog-facts/foundation-safety.test.ts` |
| PostgreSQL roles `stocky_runtime` / `stocky_control_plane` / `stocky_migration` | **implemented and demonstrated** (orthogonal) | `test:enforcement-role-membership`, `test:sync-role-isolation` |
| Full PRD templates (buyer, receiver, …) | **explicitly later** | product `02_FULL_STOCKY_PARITY_PRD.md` §3.15; F-107/F-108 still “Missing” in the historical feature matrix |
| Whether Shopify `associated_user_scope` drives app ACL | **requires owner decision** | **D-PR7-01**, **D-PR7-02** |

**FACT (V):** every `app/routes/app*.tsx` loader/action that touches merchant data uses `requireAdminTenant` only. `app/routes/app.analytics_.export.tsx` exports CSV after tenant auth with **no** role check. `replayDeadLetter` (`app/sync/replay.server.ts`) is a control-plane function with **no** staff actor and **no** admin route.

### 4.3 Audit events

| Surface | Status | Proving test |
|---|---|---|
| `AuditEvent` table / append-only writer | **missing** | none |
| Human actor lineage on mutations | **missing** | none |
| `SyncApplicationReceipt` exactly-once application | **implemented and demonstrated** — **not** PR7 audit | `sync-exactly-once.test.ts`; `sync-final-correction.test.ts` `"NEW-PR4-SC01: production receipt module exports no mutable test setter"` |
| `JobReplay` lineage | **implemented and demonstrated** — **not** PR7 audit | integration `"replay creates new job and preserves lineage"`; `"replay of disabled shop is denied"`; `sync-intake-corrections.test.ts` `"replay requires DEAD_LETTERED original (F-PR4-15)"` |
| Dead-letter one-OPEN | **implemented and demonstrated** | `sync-dispatch-recovery.test.ts` NEW-PR4-C01; integration dead-letter cases |
| Whether receipts/replays count as “audit foundation” | **requires owner decision** | **D-PR7-03** — **PROPOSED: no** |

### 4.4 Privacy webhooks and processors

| Surface | Path | Status | Proving test |
|---|---|---|---|
| Compliance route stub | `app/routes/webhooks.compliance.tsx` `action` | **implemented** as authenticate+ack only | none that assert export/erase |
| TOML compliance topics | `shopify.app.toml` `compliance_topics` → `/webhooks/compliance` | **implemented** (declared) | config presence; comment cites privacy-law-compliance |
| `customers/data_request` processor | — | **missing** (explicit PR7) | `npm run test:privacy` **missing script**, exit **1** |
| `customers/redact` processor | — | **missing** | same |
| `shop/redact` processor | — | **missing** | same |
| Deletion manifest | — | **missing** | same |
| Compliance topic sanitizer | `sanitizeWebhookPayload` | **missing** (unsupported topics throw) | `sync-control-plane.test.ts` `"rejects unsupported topics"` uses `customers/create` |
| Projection PII stripping (PR4) | `app/sync/sanitize.server.ts` | **implemented and demonstrated** | `"strips PII from orders/create and keeps money strings"` (11 tests in that file, this planning run) |
| Order-fact GraphQL PII denylist | `ORDER_FACTS_FORBIDDEN_FIELD_NAMES` | **implemented and demonstrated** | `mutation-safety.test.ts` `"rejects Order.cancellation and customer PII fields"` |
| Privacy-job isolation | brief requires distinct path | **explicitly later** | `worker-surfaces.test.ts` `"verified_job and verified_scheduler envelopes isolate TenantDb; pool context clears (export/privacy/reconciliation/replay deferred)"` |

**FACT (V):** `ShopProcessingDisabledReason` includes `REDACTED`. Nothing writes `REDACTED`.

### 4.5 Uninstall / reinstall / tokens

| Surface | Status | Proving test |
|---|---|---|
| Uninstall route | `app/routes/webhooks.app.uninstalled.tsx` → `processUninstall` | **implemented and demonstrated** (wired) | via processor tests |
| Disable + cancel cancellable jobs | `app/sync/uninstall.server.ts` | **implemented and demonstrated** | `npm run test:sync-uninstall` target `app/sync/__tests__/sync-uninstall.test.ts` (per-state cancel, duplicate uninstall). **Not re-executed here** — PostgreSQL/Redis TCP refused |
| Deny intake / replay when disabled | intake + `replayDeadLetter` | **implemented and demonstrated** | integration uninstall/replay cases (**not re-executed here**) |
| Session delete after commit | `deleteSessionsForShop` from uninstall | **implemented but unproven** E2E | helper: `bootstrap.test.ts`; uninstall suite does **not** assert `sessionsDeleted` |
| Session-delete failure must not re-enable shop | uninstall post-commit try/catch | **implemented but unproven** | no failure-injection test |
| Reinstall if `UNINSTALLED` | `app/sync/reinstall.server.ts` `reactivateShopAfterVerifiedReinstall` | **implemented but unproven** | no test found |
| Deny reinstall if `REDACTED` / `MANUAL` | same | **implemented but unproven** | no test found |
| afterAuth swallows denial then upserts `ShopSettings` and caller enqueues catalog sync | `after-auth.server.ts` + `shopify.server.ts` | **implemented**; **likely defect for REDACTED** | **unproven**; see **D-PR7-06** |

R-031 (queued jobs after uninstall) is **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION**. PR7 processors remain separate (R-005 still open).

### 4.6 Tenant data surfaces (erase / export set)

#### Bootstrap / session

| Model | Tenant key | Notes |
|---|---|---|
| `Shop` | `myshopifyDomain` unique | processing flags; `onDelete: Restrict` children |
| `Session` | `shop` string | tokens; no `shopId` |

#### Platform control-plane (`PLATFORM_CONTROL_PLANE_TABLES` in `scripts/tenant-enforcement/manifest.ts`; runtime privileges `[]`)

`WebhookDelivery`, `DurableJob`, `JobAttempt`, `DeadLetter`, `JobReplay`, `SyncRun`, `SyncCursor`, `ReconciliationRun`, `DataIssue`, `SyncHealth`, `JobDispatch`, `DispatchReadyShop`.

#### Merchant-domain (**FACT (V)** `MERCHANT_OWNED_MODELS` in `app/tenant/models.ts` — 24 direct + 11 child)

Direct: `Supplier`, `PurchaseOrder`, `ShopifyVariantCache`, `InventorySnapshot`, `VariantAbcClass`, `ForecastOverride`, `SalesDailyAggregate`, `ShopSettings`, `TransferOrder`, `Stocktake`, `BomComponent`, `LowStockAlert`, `SyncApplicationReceipt`, `ShopifyProductFact`, `ShopifyProductCollectionMembership`, `ShopifyVariantFact`, `ShopifyInventoryItemFact`, `ShopifyLocationFact`, `ShopifyInventoryLevelFact`, `CatalogObservationInFlight`, `ShopifyOrderFact`, `ShopifyOrderLineFact`, `ShopifyOrderRefundFact`, `OrderFactObservationInFlight`.

Child: `SupplierSkuMapping`, `VolumePriceTier`, `LeadTimeSnapshot`, `POLineItem`, `TransferLineItem`, `StocktakeLineItem`, `ShopifyOrderRefundLineFact`, `ShopifyOrderAdjustmentFact`, `ShopifyOrderAgreementFact`, `ShopifyOrderAgreementSaleFact`, `ShopifyOrderRefundTransactionFact`.

**PII-adjacent on V (not Shopify customer GID):** `Session` staff email/name; `Supplier.contactEmail` / `contactPhone` / `contactName` (merchant-entered). Order facts are designed without customer GID columns.

#### Maintenance (not ordinary merchant runtime)

`TenantBackfillRun`, `TenantBackfillCheckpoint`, `TenantOwnershipIssue`, `TenantOwnershipIssueDetection`.

#### Redis / files / object storage

| Surface | Status | Cleanup today |
|---|---|---|
| BullMQ `stocky-webhooks` / `stocky-cron` | **implemented** (`app/jobs/queue.server.ts`) | Uninstall cancels **DB** jobs; **no** shop-scoped Redis purge API |
| Object storage | **missing** | N/A |
| Durable export files | **missing** (CSV/PDF are in-memory responses) | N/A |
| Runtime merchant scratch on V | **missing** | N/A |

### 4.7 Tests, scanners, CI homes, `test:privacy`

| Item | Status |
|---|---|
| `npm run test:privacy` | **missing** — this run: `npm error Missing script: "test:privacy"`, exit **1** |
| `npm run test:sync-uninstall` | **present**; **not executed here** (Postgres/Redis down) |
| `npm run test:db-isolation` | **present**; privacy path **deferred by name** |
| `npm run test:tenant-access` | **present**; **not executed here** (Postgres down) |
| `tenant:access:inventory:check` / `tenant:enforcement:*` / `sync:inventory:check` | **present** (scanners) |
| CI `.github/workflows/ci.yml` | runs classify + optional heavy suite; **no** `test:privacy` step |
| Classifier | `.github/scripts/classify-ci-change-set.sh` + `.github/scripts/classify-ci-change-set.test.sh` |

Migration convention: additive Prisma folders under `prisma/migrations/` plus `scripts/tenant-enforcement` for RLS/grants. Latest on V: `20260907020000_pr6_a_order_refund_existence_coherence`.

---

## 5. V-versus-H integration dependency table

**PROVISIONAL (H)** only. PR43 remains OPEN/DRAFT/UNMERGED. Do not treat H docs, reviews, or CI as merged law.

H also edits shared-control files (`PROJECT_STATUS.md`, `RISK_REGISTER.md`, `ACCELERATED_SAFE_DELIVERY.md`, phase README). Those edits are **not** V authority and this planning PR does not copy them.

| PR7 concern | Rely on **merged V** | Provisional on **H** if D merges as-shaped | Planning note |
|---|---|---|---|
| Order-fact erase set | A models + `OrderFactObservationInFlight` | Same tables **populated** by D apply | Physical DELETE is privacy, not ordinary C apply (R-164) |
| Delete-signal semantics | C existence kinds / `OrderDeletionSource.WEBHOOK` | Live `orders/delete` route + adjudication | Tombstone ≠ GDPR erase |
| Extra webhook projections | v1 order/refund/catalog/uninstall sanitizers | + `orders/edited`, `orders/delete`, `order_transactions/create` identity-only | Still no customer fields if sanitizers hold |
| Job types | existing durable jobs | + `order-facts-sync` / `order-facts-reconcile` | Include in shop/redact enumeration |
| Import receipts | `SyncApplicationReceipt` | keys `order-facts-d-import-src-v1:…` + content digests | Manifest must cover them |
| Scratch filesystem | none on V | `{os.tmpdir()}/stocky-pr6-d/` + `att-*` + marker `.stocky-pr6-d-owned` (`ORDER_FACTS_SCRATCH_PREFIX` in H `sync/constants.ts`) | SC-01 ownership; leftovers count toward quota |
| Shared files D already touches | — | `sanitize.server.ts`, `queue.server.ts`, `execution-strategy.server.ts`, `job-envelope.server.ts`, `intake.server.ts`, `shopify.app.toml` | **PR7 must not start a competing writer.** Compliance sanitizer **PROPOSED** as a new `app/privacy/` module rather than editing D’s sanitize file |
| Immutable audit / RBAC / GDPR processors | missing on V | **not** implemented by D | Do not confuse `DataIssue` with `AuditEvent` |
| R-176 window apply | C representability on V | D apply still unmerged | Stays OPEN/P0 |

---

## 6. Approved requirement comparison

| Requirement | Source | V status |
|---|---|---|
| Immutable audit events | `PHASE_BRIEF.md` PR 7; F-008 | **missing** |
| Shopify-user + role scaffold | brief PR 7; PRD §3.15; F-107 | **missing** (Session columns unused) |
| Phase 1 platform permission checks | brief PR 7 | **missing** (tenant ≠ RBAC) |
| Data request + redaction | brief PR 7; D-021; R-005 | stub ack only |
| Deletion manifests | brief; D-021 | **missing** |
| Immediate uninstall shutdown | D-021; brief privacy decision | **implemented and demonstrated** (disable+cancel) |
| Session/token deletion on uninstall | D-021 | **implemented but unproven** E2E |
| `shop/redact` erases operational data, caches, exports, queues, storage | D-021 | **missing** |
| Preserve only non-reversible receipt + counsel-confirmed holds | D-021; Q-008 | **requires legal decision** |
| Idempotent, auditable, retryable privacy | brief | **missing** |
| Distinct privacy-job isolation tests | brief database isolation list | **deferred** in `worker-surfaces.test.ts` |
| `npm run test:privacy` | brief required commands | **missing** |
| No unnecessary customer PII in order/line facts | D-021; PR6 plan | **implemented and demonstrated** at read/sanitize boundary; processors still missing |
| Server-side permission enforcement | PRD §3.15; AGENTS.md | **missing** for staff roles |

Historical `product/05_CURRENT_REPOSITORY_GAP_AUDIT.md` and F-matrix “Missing” cells are **not** current evidence; they match this inspection for audit/roles/privacy but are stale for PR3–PR6 facts.

---

## 7. Proposed complete module

**PROPOSED.** ChatGPT may replace any option in §9.

### 7.1 Actor model — authentication vs authorization

| Concept | Rule |
|---|---|
| Shop authentication | Unchanged: `authenticate.admin` / `authenticate.webhook` / validated job envelope → canonical `Shop` → branded `TenantAuthority` |
| Staff authentication | Human platform actions additionally require a **verified Shopify user id** from the same `authenticate.admin` result |
| Authorization | App-owned `ShopRoleAssignment` + permission matrix; default **deny** |
| Client-supplied shop/actor/role fields | Never establish authority (extend today’s client-shop conflict rule to `actorId` / `role`) |
| UI visibility | Not authorization |
| Workers / webhooks | `actorKind = system` with explicit `actorSystemId` (job type + durableJobId / webhook topic) and `causationId` |
| Revocation | Assignment row `revokedAt` set; subsequent checks fail closed; in-flight jobs re-read assignment at execution, not at enqueue |

**PROPOSED actor derivation for `verified_admin_request` (D-PR7-01):**

1. Call existing `requireAdminTenant` (shop authority).
2. Read, in order, **without** trusting body/query:
   - `session.isOnline && session.onlineAccessInfo.associated_user.id`
   - else embedded `sessionToken.sub` (library example: user key)
   - else fail closed for **platform-permissioned** actions.
3. Persist staff row keyed by `(shopId, shopifyUserId)` where `shopifyUserId` is the decimal Shopify user id (not a client string). Display email **only** if `email_verified === true` (OFFICIAL access-token doc).
4. Do **not** store access tokens in audit or RBAC tables.

Enabling `useOnlineTokens: true` is **optional** (D-PR7-02). It is the official way to get `associated_user_scope` and durable `Session.userId`. Phase 1 app-owned RBAC does **not** require Shopify scope intersection if actor id is available from the ID token. Implementation must **prove** with a library-level test which fields `authenticate.admin` actually returns when `useOnlineTokens` is false — do not guess.

**Bootstrap assignment (D-PR7-04):**

- If `associated_user.account_owner === true` **or** first successful admin session for a shop with zero assignments → assign `shop_owner`.
- Otherwise new staff → `unassigned` (default deny for platform ops).
- Collaborators are still Shopify-authenticated users; they do **not** auto-become `shop_owner`.

### 7.2 Phase 1 platform permission matrix

**PROPOSED** roles (scaffold only — not the later buyer/receiver catalog):

| Role key | Meaning |
|---|---|
| `shop_owner` | Account owner / delegated owner; permission administration |
| `shop_admin` | Operate platform diagnostics, replay, export |
| `platform_auditor` | Read-only health, audit, minimized manifests |
| `unassigned` | Authenticated to the shop; **no** platform ops |

Later PRD templates remain **explicitly later**. Existing PO/stocktake/transfer routes stay on `requireAdminTenant` only (**D-PR7-07**).

**PROPOSED** permission keys (server enums, not string-compared plan names):

| Permission | `shop_owner` | `shop_admin` | `platform_auditor` | `unassigned` | webhook HMAC | privacy/replay worker |
|---|---|---|---|---|---|---|
| `platform.sync_health.read` | allow | allow | allow | deny | deny | n/a |
| `platform.data_issues.read` | allow | allow | allow | deny | deny | n/a |
| `platform.audit.read` | allow | allow | allow | deny | deny | n/a |
| `platform.replay.execute` | allow | allow | deny | deny | deny | execute if job envelope valid **and** shop processing enabled |
| `platform.export.operational` | allow | allow | deny | deny | deny | n/a |
| `platform.roles.administer` | allow | deny | deny | deny | deny | deny |
| `platform.privacy.manifest.read` | allow | deny | allow (minimized) | deny | deny | n/a |
| `platform.privacy.process` | deny (not a staff click) | deny | deny | deny | **intake only** after HMAC | **execute** under `verified_job` |
| Shopify Admin API scopes | unchanged shop grant | unchanged | unchanged | unchanged | n/a | offline token |

`replayDeadLetter` today takes `{ deadLetterId, shopId, reason }` with **no actor**. **PROPOSED** wrapper: admin route → `requireAdminTenant` + `requirePermission('platform.replay.execute')` + pass `shopId` from tenant, never from body; then existing replay function. Workers continue to apply the new durable job under the envelope.

Denied permission checks **append** `PERMISSION_DENIED` audit events and **must not** emit a success event.

### 7.3 Immutable audit

**PROPOSED** table `AuditEvent` (merchant-domain, RLS, tenant `shopId`):

Required fields: `id`, `shopId`, `occurredAt` (UTC), `actorKind` (`human` \| `system` \| `shopify_webhook`), `actorShopifyUserId` (nullable), `actorSystemId` (nullable), `action`, `entityType`, `entityId` (nullable), `correlationId`, `causationId` (nullable), `decision` (`allowed` \| `denied` \| `failed` \| `completed` \| `partial`), `payloadMinimized` (JSONB allowlist), `idempotencyKey`.

**Event types (closed enum):**

`PERMISSION_DENIED`, `ROLE_ASSIGNED`, `ROLE_REVOKED`, `SYNC_HEALTH_READ`, `REPLAY_REQUESTED`, `REPLAY_DENIED`, `EXPORT_REQUESTED`, `EXPORT_COMPLETED`, `EXPORT_FAILED`, `PRIVACY_INTAKE_ACCEPTED`, `PRIVACY_INTAKE_REJECTED`, `PRIVACY_STARTED`, `PRIVACY_CHECKPOINT`, `PRIVACY_COMPLETED`, `PRIVACY_PARTIAL_FAILED`, `PRIVACY_SUPERSEDED`, `SHOP_UNINSTALLED`, `SHOP_REINSTALLED`, `SHOP_REINSTALL_DENIED`, `AUTH_PLATFORM_DENIED`.

Do **not** emit `*_COMPLETED` on failed writes, failed permission checks, failed replays, or partial privacy actions. Partial privacy uses `PRIVACY_PARTIAL_FAILED` + checkpoint.

**Immutability:** runtime `GRANT INSERT, SELECT` only; `UPDATE`/`DELETE` revoked; trigger rejects all `UPDATE`/`DELETE` for application roles. Corrections **append**. Unique `(shopId, idempotencyKey)` for exactly-once insert (duplicate intake returns the existing row).

**Minimization:** never persist access tokens, raw HMAC, customer email/phone, payload dumps, or unsanitized webhook bodies. Store Shopify user id, action, entity ids, counts, and content **digests**.

**Privacy coexistence (D-PR7-08):** on `shop/redact`, do **not** physically delete `AuditEvent` rows that are the processing record. **PROPOSED:** overwrite nullable display fields to null and replace any residual identifier hashes already stored; keep `action` / `occurredAt` / `decision` / `idempotencyKey` as the non-reversible receipt. A second table `PrivacyCompletionReceipt` holds `{shopDomainHash, completedAt, manifestDigest, requestId}` so the `Shop` row may be removed without retaining the cleartext domain. Counsel-confirmed holds go to `PrivacyLegalHold` (segregated, no runtime SELECT for `stocky_runtime`).

`JobReplay` / `SyncApplicationReceipt` remain **operational ledgers**. They are not the merchant audit trail. Privacy still **erases** their row contents per §7.6; lineage needed after redact lives only in the minimized receipt.

### 7.4 Privacy lifecycle state machine

**PROPOSED** `PrivacyRequest.state`:

`RECEIVED` → `AUTHENTICATED` → `SCHEDULED` → `ENUMERATING` → `APPLYING` → `CHECKPOINTING` → (`COMPLETED` \| `PARTIAL_FAILED` \| `SUPERSEDED` \| `LEGALLY_RETAINED`).

Terminal states are absorbing except `PARTIAL_FAILED` → `APPLYING` on retry.

| Topic | Intake | Work | Completion evidence |
|---|---|---|---|
| `customers/data_request` | HMAC + shop resolve + persist hashed customer identifiers + `data_request.id` | Bounded scan of surfaces for those identifiers / `gid://shopify/Order/{orders_requested[i]}`; build **ephemeral** owner-download export of **only** what is actually stored (often empty) | Manifest counts + export digest; **no** long-term copy of customer email |
| `customers/redact` | same | Delete/redact matching stored identifiers; if none, complete empty | Manifest `skipped_absent` counts |
| `shop/redact` | HMAC + shop resolve; set `processingDisabledReason=REDACTED` if not already disabled | Full tenant enumeration §7.6 | Completion receipt + empty residual probes |

Ack **200** only after durable `RECEIVED` row exists (or duplicate idempotent hit). Invalid HMAC remains **401** (Shopify library). Do not claim erasure in the HTTP body.

**Kill switch (D-PR7-09):** `FEATURE_PR7_PRIVACY_PAUSE` default **OFF**. When ON: still authenticate, persist `RECEIVED`, ack 200, do **not** delete; operators see `SCHEDULED` stuck. This is an emergency brake, not a waiver of the 30-day Shopify clock.

**Idempotency key:** `privacy:{topic}:{shopId}:{shopifyRequestId}` where request id is `data_request.id` or webhook id or `shop_redact:{shopifyWebhookId}`.

### 7.5 Deletion manifest design

**PROPOSED** `PrivacyDeletionManifest` + `PrivacyDeletionManifestLine`.

Manifest stores: topic, state, checkpoint cursor `(surface, afterId)`, per-surface counts, content digest of **sorted remaining primary keys** (not the payloads), error code, attempt count.

Lines store: `surface`, `action` (`deleted` \| `redacted` \| `skipped_absent` \| `skipped_legal` \| `skipped_tombstone_converted_to_delete`), `rowCount`, `digest`.

**A manifest must not retain the data meant to be erased.** No customer email/phone, no order notes, no token fragments, no JSONL copies.

Checkpoint/retry: process one surface per transaction batch with a documented cap; crash resumes from cursor; already-deleted rows are `skipped_absent`.

### 7.6 Surfaces, order, and failure modes

**Shop/redact enumeration order (PROPOSED):**

1. Set `Shop.processingEnabled=false`, `processingDisabledReason=REDACTED` (control-plane txn). Cancel remaining cancellable jobs (reuse uninstall helper).
2. Redis: remove or fail-closed shop-scoped BullMQ jobs (`stocky-webhooks`, `stocky-cron`) whose envelope `shopId` matches (**D-PR7-10**).
3. **PROVISIONAL (H)** scratch: dispose only authentic `stocky-pr6-d` handles for that shop; leftovers remain in the residual probe.
4. Merchant child tables → direct tables (respect FK order; physical DELETE is the privacy path; this is **not** ordinary catalog apply — R-164 stays about apply APIs).
5. `SyncApplicationReceipt` and other merchant-domain operational rows.
6. Control-plane rows for `shopId` (deliveries, jobs, attempts, DL, replays, runs, cursors, health, issues, dispatch readiness).
7. `Session` rows for the domain (uninstall should have done this; redact repeats).
8. Minimize `AuditEvent` display fields; write `PrivacyCompletionReceipt`; delete `Shop` **or** retain a tombstone shop row without tokens (**D-PR7-11**).
9. Residual probe: runtime SELECT counts for every surface must be 0 except receipt/hold/minimized audit.

**Customers/\* :** only step 4–5 filtered by hashed identifiers / order GIDs derived from REST ids. Do **not** erase the whole shop.

**Adversarial cases the design must survive** (fixtures in the matrix):

| Case | Behavior |
|---|---|
| Duplicate webhook | increment delivery duplicateCount; return same manifest |
| Partial storage failure | `PARTIAL_FAILED`; no success audit; retry from cursor |
| Process death mid-batch | transaction rollback; checkpoint unchanged; retry |
| Concurrent webhook/import during redact | processing gate + REDACTED deny new intake; H import jobs fail closed |
| Enqueue-before-uninstall | existing PR4 cancel; redact deletes cancelled job rows |
| Reinstall before `shop/redact` | **D-PR7-05** |
| Reinstall after `REDACTED` | `reinstall_denied`; afterAuth must **not** enqueue (**D-PR7-06**) |
| Late D scratch after redact | residual probe fails until scratch disposed |
| Incomplete pagination | enumerator uses keyset `id > cursor` until empty page |
| Shared Redis/DB | envelope shopId mismatch denied; RLS / control-plane shop predicate |
| Role change mid-replay | worker re-checks processingEnabled; admin permission re-checked at click time only — in-flight system job continues with system actor (**D-PR7-12**) |
| Cross-shop same external ids | tenant predicates; Shop A request cannot see Shop B GIDs |
| Forged actor/role in JSON | ignored; deny |
| Legal hold | `LEGALLY_RETAINED` + `PrivacyLegalHold`; Shopify says do not complete deletion if legally required — **requires counsel** (Q-008) |

### 7.7 Schema, grants, migration, recovery

**PROPOSED** additive Prisma migration `20260917100000_pr7_audit_roles_privacy_foundation` (name illustrative):

- enums: `ShopPlatformRole`, `AuditActorKind`, `AuditAction`, `AuditDecision`, `PrivacyTopic`, `PrivacyRequestState`, `PrivacyManifestAction`;
- tables: `ShopStaffUser`, `ShopRoleAssignment`, `AuditEvent`, `PrivacyRequest`, `PrivacyDeletionManifest`, `PrivacyDeletionManifestLine`, `PrivacyCompletionReceipt`, `PrivacyLegalHold`;
- FKs: composite `(shopId, id)` where merchant-domain; `Shop` Restrict until ordered delete;
- unique: assignment `(shopId, shopifyUserId)` where `revokedAt` is null (partial unique);
- `AuditEvent` unique `(shopId, idempotencyKey)`.

Then **enforcement tooling** (same implementation PR, after migrate deploy): register tables in `scripts/tenant-enforcement/manifest.ts` / `app/tenant/models.ts` / `roles.ts`. AuditEvent: runtime `INSERT, SELECT` only; assignment tables: runtime DML minus `shopId` mutation (existing immutability trigger). PrivacyRequest: runtime insert/update of **state machine columns only** via allowlisted updates **or** control-plane-only writes (**D-PR7-13**).

Lock strategy: new empty tables → ordinary indexes OK. If implementation lands on populated shops, still avoid `ACCESS EXCLUSIVE` validation of old tables; PR7 should not rewrite PR3/PR5/PR6 fact tables except optional **additive** columns (none required if receipts stay separate).

Rollback: drop new tables / disable processors; **cannot** un-erase. Forward recovery: pause switch + resume from manifest cursor. Pre-RLS application is not an acceptable rollback after privacy grants.

**Do not** add migrations in this planning PR. SQL in this section is specification only.

### 7.8 Frozen interfaces consumed (no silent widening)

| Lane | Interface | PR7 use | Change? |
|---|---|---|---|
| PR2 | `requireAdminTenant`, `TenantAuthority`, client-shop denial | wrap, do not replace | additive `requirePlatformPermission` |
| PR2/PR4 | job envelope v1/v3 | privacy jobs | new `jobType` strings only after D merge if `execution-strategy` is frozen to D |
| PR3 | RLS, runtime role, bootstrap boundary | new tables follow the same contract | additive manifest entries |
| PR4 | `processUninstall`, `replayDeadLetter`, sanitizers, processing gate | call; emit audit from **new** wrappers | avoid rewriting uninstall internals except a documented hook |
| PR4 | `reactivateShopAfterVerifiedReinstall` | already denies `REDACTED` | **must add tests**; afterAuth fail-closed |
| PR5 A/B/C catalog | facts + receipts | erase targets | no apply API change |
| PR6 A | order-fact schema / locks / types | erase targets | **no change** |
| PR6 B | `admin-read/**` forbidden fields | keep as PII prevention | **no change** |
| PR6 C | `apply/**` | not used for privacy delete | **no change**; physical DELETE is a **privacy module** using TenantDb/control-plane, not `applyOrderFacts*` |
| PR6 D | sync orchestration, scratch | erase/cleanup **if merged** | consume; do not reopen C3/SC |

Any need to change C apply or B documents is a **decision request with a failing use case**. None identified for privacy erase.

### 7.9 Exclusive file ownership (future implementation PR)

**Owned (PROPOSED):**

```
stocky-plus/app/audit/**
stocky-plus/app/rbac/**
stocky-plus/app/privacy/**
stocky-plus/app/routes/webhooks.compliance.tsx
stocky-plus/app/routes/app.platform.*.tsx          # minimal platform UI/actions
stocky-plus/prisma/schema.prisma                   # additive models only
stocky-plus/prisma/migrations/20260917*_pr7_*      # new folder only
stocky-plus/app/tenant/models.ts                   # additive list entries
stocky-plus/scripts/tenant-enforcement/manifest.ts # additive table specs
stocky-plus/scripts/tenant-enforcement/roles.ts    # additive grants
stocky-plus/app/tenant/__tests__/db-isolation/privacy-surfaces.test.ts
stocky-plus/app/privacy/**/*.test.ts
stocky-plus/app/rbac/**/*.test.ts
stocky-plus/app/audit/**/*.test.ts
stocky-plus/package.json                           # add test:privacy script only
stocky-plus/docs/phases/phase-1/PR7_*IMPLEMENTATION*  # later, not this PR
```

**Narrow shared edits (must be listed in the implementation brief):**

| File | Allowed PR7 delta |
|---|---|
| `app/tenant/after-auth.server.ts` | fail closed on `REDACTED`; do not enqueue |
| `app/shopify.server.ts` | stop catalog enqueue when bootstrap says redacted; optional `useOnlineTokens` **only if D-PR7-02 accepted** |
| `app/sync/uninstall.server.ts` | optional audit emit hook **or** emit from the route after `processUninstall` (prefer route/wrapper to keep PR4 behavior) |
| `app/sync/replay.server.ts` | none if wrapper lives in `app/rbac` / `app/routes/app.platform.replay.tsx` |
| `.github/workflows/ci.yml` | add `test:privacy` to heavy job — **implementation PR**, not this docs PR |

**Forbidden:** D `app/lib/order-facts/sync/**`, B `admin-read/**`, C `apply/**`, A lock/types, PR43 branch, shared-control live docs in **this** planning PR.

Privacy jobs **PROPOSED** as `DurableJob.jobType` values `privacy:customers_data_request` | `privacy:customers_redact` | `privacy:shop_redact` on the existing webhook queue after D merge, to avoid a competing `queue.server.ts` rewrite while H is open.

---

## 8. Recommended implementation sequence

**PROPOSED** single-module order once ChatGPT issues runtime authority **and** §10 gates pass:

1. Additive migration + scanner/manifest/role grants + immutability triggers + empty-table isolation tests.
2. Actor derivation + assignment + `requirePlatformPermission` + denial tests (including forged fields).
3. `AuditEvent` emit helper; couple permission denials and role changes; prove no UPDATE.
4. Rewrite `webhooks.compliance.tsx`; intake + state machine + manifest; `test:privacy` fast suite.
5. Shop/redact enumerator + dual-role deletes + residual probe; customer topics (often empty).
6. afterAuth REDACTED fail-closed; uninstall session E2E; reinstall matrix.
7. Redis (+ H scratch if D merged) cleanup; residual probe includes them.
8. Minimal platform routes (health/replay/export/roles) with server checks independent of UI.
9. Exact-head full CI; independent Tier-A Claude review.

No estimated calendar. No fake completion percentage.

---

## 9. Decision register

All items **PROPOSED**. ChatGPT decides.

| ID | Question | Recommended option | Tradeoffs | Blocks runtime? |
|---|---|---|---|---|
| **D-PR7-01** | Trusted human actor source | Verified `authenticate.admin` only: online `associated_user.id` else `sessionToken.sub`; fail closed if missing for platform ops | Without online tokens, `associated_user_scope` unavailable; must prove `sessionToken` exists for embedded admin | Yes |
| **D-PR7-02** | Enable `useOnlineTokens: true` | **Defer unless D-PR7-01 cannot obtain user id** | Official staff attribution + Shopify permission intersection vs extra token class and 24h expiry | Yes if 01 fails |
| **D-PR7-03** | Are `JobReplay` / receipts the audit log? | **No** — separate `AuditEvent` | Extra table vs overloading operational ledgers that redact must erase | Yes |
| **D-PR7-04** | Who is first `shop_owner`? | `account_owner` else first admin session if zero assignments | Collaborator-first install edge; document | Yes |
| **D-PR7-05** | `shop/redact` after reinstall-before-48h | If `reinstalledAt > uninstalledAt` and processing enabled → `SUPERSEDED`, do **not** erase | Shopify may still send redact (**UNVERIFIED**); opposite option (always erase) destroys a live reinstall | Yes |
| **D-PR7-06** | afterAuth on `REDACTED` | Fail closed: no ShopSettings write, no catalog enqueue | Merchant cannot self-serve restore after erase (correct) | Yes |
| **D-PR7-07** | Gate legacy merchandising routes? | **No** in PR7 | Leaves buyer/receiver to later phases; platform ops still protected | No |
| **D-PR7-08** | Audit vs shop/redact | Minimize in place; keep action/time/decision; domain only as hash on receipt | Counsel may require different hold set (Q-008) | Legal before production, not before repo tests |
| **D-PR7-09** | Privacy pause kill switch | `FEATURE_PR7_PRIVACY_PAUSE` default OFF | Pause can miss Shopify’s 30-day clock — operator runbook | Implementation detail |
| **D-PR7-10** | Redis purge vs drain | **Shop-scoped remove** of matching jobs + fail-closed workers | Obliterate-all-queues is cross-tenant unsafe | Yes |
| **D-PR7-11** | Delete `Shop` row? | Delete after children; keep `PrivacyCompletionReceipt` with **domain hash** | Tombstone shop is simpler for FKs but retains identifier | Yes |
| **D-PR7-12** | Role change mid-worker | System jobs continue; new admin clicks use new role | In-flight replay might complete after revoke | Record in tests |
| **D-PR7-13** | Which DB role writes privacy state? | Control-plane for control-plane tables + request/manifest; runtime TenantDb for merchant-row deletes | Dual connection like PR5 two-phase; never one txn across roles | Yes |
| **D-PR7-14** | How to fulfill `customers/data_request` “to the store owner” | Short-lived owner-only download (`platform.export.operational`) + audit; TTL delete blob | No email provider in Phase 1; Partner/App Store may expect a different channel (**UNVERIFIED**) | Staging/legal later |
| **Q-008** | Retention schedule / privacy-policy language | Keep OPEN; implement D-021 direction for **repository** tests using **empty** legal-hold set until counsel | Cannot certify production | Production, not this planning PR |

---

## 10. Conditions under which a future PR7 implementation may begin

All of the following — **PROPOSED** gate, ChatGPT owns the call:

1. ChatGPT **accepts this execution plan + acceptance matrix** (possibly after corrections).
2. Required **PR6 acceptance/closure** and **main synchronization**: PR6-D (PR43) technically accepted **or** ChatGPT explicitly bases PR7 on V without D surfaces; then implementation branch from the **then-current** `origin/main`, not from this planning SHA by default.
3. Applicable post-merge evidence on that main (exact-head CI per `CI_POLICY.md`).
4. Named writer, exclusive files (§7.9), one branch, one chat.
5. Explicit ChatGPT **runtime** authority sentence (this packet is not that sentence).
6. Decisions D-PR7-01, 03, 04, 05, 06, 10, 11, 13 answered (others may default to recommended).
7. No competing writer on listed shared files (especially if D is still open).

PR7 implementation is **Tier A**. Exact-head **full** CI (not docs-only) will be required for the runtime PR.

---

## 11. PR8 dependency map (high level only)

PR8 (`phase-1/reconciliation-performance-exit`) needs:

- tenant-safe facts (PR5/PR6) **and** privacy-safe residual emptiness after redact;
- audit + support diagnostics using `AuditEvent` / health — not a second ledger;
- load evidence at the engineering envelope, including privacy enumerator cost;
- recovery rehearsal including uninstall→redact→residual probe;
- status/decision/risk/question updates (shared-control writer at closeout).

This packet does **not** claim Phase 1 complete or Phase 2 authorized.

---

## 12. Evidence of this planning run

| Check | Command / method | Result |
|---|---|---|
| V HEAD | `git rev-parse HEAD` at start | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Working tree before edits | `git status --porcelain` | empty |
| H fetch | `git fetch origin phase-1/pr6-d-order-webhook-import` | H `4768033b…` |
| Sanitizer unit | `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-control-plane.test.ts` | **PASS** — 11 tests, exit 0, SHA V |
| PII/mutation + flags | `npx vitest run app/lib/order-facts/admin-read/mutation-safety.test.ts app/lib/order-facts/foundation-safety.test.ts` | **PASS** — 10 tests, exit 0 |
| Shop-domain unit | `npx vitest run app/lib/shop-domain.test.ts` | **PASS** — 10 tests, exit 0 |
| `test:privacy` | `npm run test:privacy` | **FAIL** missing script, exit 1 (expected) |
| `test:sync-uninstall` / `test:tenant-access` / `test:db-isolation` | not started | **BLOCKED** — `DATABASE_URL`/`REDIS_URL` localhost TCP **refused**; docker not installed |
| Shopify store calls | — | **not executed** |
| Classifier + `git diff --check` | after docs land | recorded in the PR / later section of the return |

Environment: Node `v22.14.0`, cwd `stocky-plus/` for npm/vitest, no disposable PostgreSQL/Redis listening.

---

## 13. Cross-check to the acceptance matrix

| Plan section | Matrix IDs |
|---|---|
| Actor / forged authority | PR7-ACT-001…012 |
| Permission matrix | PR7-RBAC-001…014 |
| Audit immutability / minimization | PR7-AUD-001…010 |
| Uninstall / reinstall / REDACTED afterAuth | PR7-LIFE-001…010 |
| Privacy intake / states | PR7-PRIV-001…012 |
| Shop/redact enumerator | PR7-RED-001…014 |
| Customer topics | PR7-CUST-001…008 |
| Redis / scratch / dual-role | PR7-SIDE-001…006 |
| Isolation / CI command | PR7-ISO-001…006, PR7-CI-001…003 |

If a matrix row cites a path, that path is listed in §4 or §7. If a plan surface has no matrix row, that is a packet defect — none intended.
