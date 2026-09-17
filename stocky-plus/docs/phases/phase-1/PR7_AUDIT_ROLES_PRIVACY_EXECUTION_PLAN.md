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
| Authorization (planning) | [PR43 comment 5707545217](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5707545217) |
| Authorization (corrections) | [PR45 comment 5713121021](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5713121021) (`user=Vedang1998`, `created_at=2026-09-17T10:49:56Z`) |
| Starting planning HEAD | `4158254cba4800ceec112579ca842ee69f47c882` |
| Original work order | `PR7_Audit_Roles_Privacy_Execution_Prep_Overnight.md` SHA-256 `d7aee155dcc13e25cb00f6131b2b1544757122f6a8d95ffa7073b0b7ccbf4bf0` |
| Correction work order | `PR45_PR7_Planning_Corrections_Work_Order.md` SHA-256 `82d3e74611c8185f9bd5255a7b7d48493d85d3c0d9b44aa3df40c3f4e2d1b502` |
| Decision heading | D-054 **EFFECTIVE** — **no D-055** |
| R-176 | remains **OPEN / P0** — this packet does not close it |
| R-164 | unchanged |
| Q-008 | remains **OPEN** — legal review still required |
| Phase 1 | **IN PROGRESS** |
| Production / inventory-write flags | **NOT AUTHORIZED** / **DEFAULT OFF** |
| This PR | one new **DRAFT documentation-only** PR; never reuse PR43, PR41, or PR38 |

Live shared-control files on V (`PROJECT_STATUS.md`, phase-1 `README.md`) still describe an earlier PR6-B/C state (PR6-C “in correction”, `origin/main` as **T** `f5ec7abb…`). **FACT (V):** those files are stale relative to merged V `a3ff480…`. This planning PR **must not** edit them.

These ChatGPT constraints are **not** acceptance of the whole plan, not PR7 runtime authorization, not legal-compliance certification, and not permission to change live controls.

### 1.1 Correction crosswalk (P7-C01…06)

Original decision IDs **D-PR7-01…14** are preserved. Constraints below change recommended options; they do **not** silently default unanswered items into runtime authority.

| Correction | Constrains | Disposition in this packet |
|---|---|---|
| **P7-C01** | **D-PR7-04** (bootstrap); owner-proof half of **D-PR7-02** | First login / empty assignment table / `sessionToken.sub` / installer / email **cannot** grant `shop_owner`. Owner only from same-shop verified Shopify `associated_user.account_owner === true` for the same user id, or a separately approved owner-verification flow. |
| **P7-C02** | **D-PR7-08**, **D-PR7-11**; privilege shape of **D-PR7-13** | Ordinary audit remains append-only. Tenant-linked audit is **deleted** by a restricted privacy-erasure capability (not in-place UPDATE). Completion receipt is a separate table with no Shop FK. Domain HMAC is **identifiable**, not anonymous. |
| **P7-C03** | **D-PR7-05**, generation half of **D-PR7-06** | No timestamp-only `SUPERSEDED`. Ambiguous `shop/redact` vs reinstall → `ESCALATED` with 30-day deadline. Completed erasure must not permanently blacklist a fresh install. |
| **P7-C04** | **D-PR7-12**; §7.1 vs §7.2 contradiction | Human replay/export/role work revalidates authorization at execution (or last safe pre-effect boundary). A generic worker actor cannot convert a denied human operation into allowed work. |
| **P7-C05** | privacy worker vs processing-disabled; customer lookup keys | Verified privacy jobs use an explicit limited capability while the shop stays disabled. Customer-request lookup keys remain sufficient across retries. Empty scan only after a complete relevant-surface pass. |
| **P7-C06** | §10 gates; matrix “Now” labels; Tier-A bar | No V-only runtime base. Formal PR6 closure on merged main required. No unresolved P0/P1/**P2**. Blocked suites are not “executed-on-V”. |

**Still PROPOSED / pending (not silently defaulted):** D-PR7-01, D-PR7-02 (whether to enable `useOnlineTokens`; owner proof **needs** the online `associated_user` object if automated owner grant is wanted), D-PR7-03, D-PR7-07, D-PR7-09, D-PR7-10, D-PR7-13 (exact role split), D-PR7-14.

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

Sources (no store calls). Re-fetched **2026-09-17** for this correction packet:

- [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance) — accessed **2026-09-17**
- [Authenticate admin](https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin) — accessed **2026-09-17**
- [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens) — accessed **2026-09-17**
- [Privacy requirements](https://shopify.dev/docs/apps/launch/privacy-requirements) — accessed **2026-09-17** (context only)
- [Authentication for apps built with Shopify CLI](https://shopify.dev/docs/apps/build/authentication-authorization/cli-app-authentication) — accessed **2026-09-17** (context only)

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

**UNVERIFIED:** whether Shopify still delivers `shop/redact` if the merchant reinstalls during that 48-hour window. The official page does **not** document a timestamp-only reinstall exception, an installation-generation field, or permission to skip a delivered request. See **P7-C03** / **D-PR7-05**.

**INTERPRETATION (not official text):** “Complete the action within 30 days of receiving the request” is treated as a hard operational deadline for every authenticated delivered compliance webhook, including `ESCALATED` cases. Escalation is not indefinite noncompliance. Shopify: if legally required to retain data, do not complete deletion — that exception remains **Q-008** / counsel, not a product invention.

### OFFICIAL — staff identity vs shop token

- **FACT vs INTERPRETATION split.** The following bullets quote documented behavior; product rules built on them are labeled **PROPOSED**.
- Default tokens are **offline** (shop-scoped; background/webhooks). **OFFICIAL** access-tokens page.
- **Online** tokens are optional, tied to the staff member, expire after **24 hours or admin logout**, and carry `associated_user` + `associated_user_scope`. **OFFICIAL.**
- `associated_user` fields documented on the online token response include `id`, `account_owner` (`true` when the user owns the Shopify account), `collaborator`, `email`, `email_verified`. **OFFICIAL** access-tokens page; **FACT (library)** `OnlineAccessUser` in `@shopify/shopify-api` (`account_owner: boolean`, `id: number`).
- ID tokens authenticate the **user**; they carry **no permissions** and cannot be used to call a Shopify API. Access tokens authenticate the **app**. **OFFICIAL** access-tokens page. Therefore `sessionToken.sub` is **identity**, not ownership and not an app permission grant.
- Scaffolded apps enable online tokens with `useOnlineTokens: true`. **OFFICIAL** authenticate/admin examples for both `session.onlineAccessInfo` **and** the `sessionToken.sub` snippet still set `useOnlineTokens: true` in the companion `shopify.server.ts`.
- **FACT (library):** `authenticate.admin` typed context includes `session` and, for embedded apps, `sessionToken: JwtPayload` with `sub: string` (user id as string), `dest` (shop domain), `iss`, `aud`.
- **UNVERIFIED at runtime (must be proven in implementation tests, D-PR7-01):** which of `sessionToken` / `onlineAccessInfo` are actually populated when `useOnlineTokens` is **false**, as on V. Do not assume `sub` exists, and do not treat `sub` as `account_owner`.

**FACT (V):** `stocky-plus/app/shopify.server.ts` does **not** set `useOnlineTokens`. It does set `future.expiringOfflineAccessTokens: true`.

**P7-C01 implication:** automated `shop_owner` bootstrap needs the documented `associated_user.account_owner` bit on a **verified online** session for the **same** shop and user. Offline `sub` alone cannot grant ownership. No token/configuration change is authorized in this planning PR (**D-PR7-02** remains proposed).

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
| First-login owner bootstrap | **rejected by P7-C01** | **D-PR7-04** constrained |

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
| Preserve only a minimized completion receipt + counsel-confirmed holds | D-021; Q-008 | **requires legal decision**. This packet does **not** treat `shopDomainHmac` as anonymous/unlinkable (**P7-C02**). |
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
| Workers / webhooks | Split: **autonomous** jobs (`actorKind=system` or `shopify_webhook`) vs **human-authorized** jobs (`actorKind=human`, required `actorShopifyUserId` + `causationId`). See **P7-C04**. |
| Revocation | Assignment row `revokedAt` set. Subsequent human checks fail closed. Human-requested jobs revalidate at execution or the last safe pre-effect boundary. Already-committed effects are not claimed undone. Autonomous sync/compliance does **not** use a staff grant. |

**PROPOSED actor derivation for `verified_admin_request` (D-PR7-01):**

1. Call existing `requireAdminTenant` (shop authority). Shop authentication ≠ staff authorization.
2. Read, in order, **without** trusting body/query/header:
   - if `session.isOnline` and `session.onlineAccessInfo.associated_user.id` is present: take that id;
   - else if embedded `sessionToken.sub` is a present non-empty string: take that as identity **only**;
   - else fail closed for **platform-permissioned** actions.
3. Canonicalize the Shopify user id as an **exact decimal string** (no IEEE-754 `Number()` coercion, no parseInt truncation). **FACT (library):** `OnlineAccessUser.id` is typed `number`; `JwtPayload.sub` is typed `string`. Compare by normalizing both to the same decimal-digit string. Reject values that are not `^[0-9]+$`.
4. Bind identity to the **same** verified shop: `sessionToken.dest` (when present) must match the tenant domain; mismatched dest/shop fails closed.
5. Persist staff row keyed by `(shopId, shopifyUserId)` using that canonical string. Display email **only** if `email_verified === true` (OFFICIAL). Do **not** store access tokens in audit or RBAC tables.
6. A client-supplied `account_owner`, `actorId`, `role`, or `shopifyUserId` field is ignored. A forged `Session.accountOwner` / body property that is not the live `associated_user.account_owner` from `authenticate.admin` **must not** grant ownership (P7-C01).

**Identity vs owner proof (P7-C01):** `sessionToken.sub` proving a user id does **not** settle ownership. **OFFICIAL:** the ID token carries no permissions. The documented Shopify ownership bit is `associated_user.account_owner` on the **online** token response.

**D-PR7-02 remains PROPOSED.** Narrowest library-supported paths:

| Need | Narrowest documented path | Tests implementation must add |
|---|---|---|
| Human actor id | Prove whether `authenticate.admin` returns `sessionToken.sub` when `useOnlineTokens` is false (V’s config). If yes, use it for identity only. If no, fail closed for platform ops until online tokens or another approved path. | Library/fixture test of actual `authenticate.admin` fields under V config **and** under `useOnlineTokens: true`. |
| Owner proof | `session.isOnline && associated_user.account_owner === true && canonical(associated_user.id) === actorId && shop matches`. No other signal. | See bootstrap tests below. Enabling `useOnlineTokens` is a **separate** proposed config change, not authorized here. |

App-owned RBAC still does not require intersecting `associated_user_scope` unless ChatGPT later says otherwise.

**Bootstrap assignment (D-PR7-04, constrained by P7-C01):**

- Assign `shop_owner` **only** when the owner-proof row in the table above is true on that request.
- If assignments are empty and owner proof is absent → persist staff as `unassigned`. Do **not** promote first staff, first collaborator, first installer, first `sub`, first email, or “app access”.
- Collaborators (`associated_user.collaborator === true`) never auto-become `shop_owner`.
- Concurrent first logins: unique partial index on `(shopId, shopifyUserId)` where `revokedAt` is null; owner grant is a conditional insert that requires owner proof. Two non-owner sessions cannot race into `shop_owner`. Two owner-proof sessions for the **same** user are idempotent; two different users both claiming owner is **UNVERIFIED** at Shopify (normally one account owner) — fail closed to `unassigned` + `OWNER_PROOF_CONFLICT` audit and the recovery path.
- **Recovery / onboarding path (no invented owner):** merchandising routes that today use only `requireAdminTenant` continue (D-PR7-07). Platform ops stay denied. UI/state: `owner_assignment_pending`. The next verified online `account_owner` session for that shop creates the first `shop_owner` assignment. If Shopify never presents `account_owner` (offline-only), do **not** invent a grant; require a **separately approved** owner-verification flow (not designed in this packet, not email/sub/installer). Operator runbook: support cannot click a user into ownership without that flow.

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

| Permission | `shop_owner` | `shop_admin` | `platform_auditor` | `unassigned` | webhook HMAC | autonomous privacy worker | human-authorized worker (replay/export/roles) |
|---|---|---|---|---|---|---|---|
| `platform.sync_health.read` | allow | allow | allow | deny | deny | n/a | n/a |
| `platform.data_issues.read` | allow | allow | allow | deny | deny | n/a | n/a |
| `platform.audit.read` | allow | allow | allow | deny | deny | n/a | n/a |
| `platform.replay.execute` | allow | allow | deny | deny | deny | deny | execute **only** if the originating actor still holds the permission at the pre-effect check **and** processing is enabled |
| `platform.export.operational` | allow | allow | deny | deny | deny | deny | same pre-effect revalidation |
| `platform.roles.administer` | allow | deny | deny | deny | deny | deny | deny (admin route only; no worker conversion) |
| `platform.privacy.manifest.read` | allow | deny | allow (minimized) | deny | deny | n/a | n/a |
| `platform.privacy.process` | deny (not a staff click) | deny | deny | deny | **intake only** after HMAC | **execute** under `verified_privacy_job` (P7-C05) | deny |
| Shopify Admin API scopes | unchanged shop grant | unchanged | unchanged | unchanged | n/a | offline token | n/a |

`replayDeadLetter` today takes `{ deadLetterId, shopId, reason }` with **no actor**. **PROPOSED** wrapper: admin route → `requireAdminTenant` + `requirePermission('platform.replay.execute')` + pass `shopId` from tenant, never from body. The durable replay job stores `actorShopifyUserId` + `causationId` of that human. The worker is **not** a generic system actor: it revalidates that the same user’s current assignment still allows `platform.replay.execute` immediately before calling `replayDeadLetter` (P7-C04). If revoked, fail closed (`REPLAY_DENIED`); do not apply.

Denied permission checks **append** `PERMISSION_DENIED` audit events and **must not** emit a success event.

**Human vs autonomous (P7-C04) — revocation timeline:**

| Moment | Human replay/export/role | Autonomous sync / privacy |
|---|---|---|
| Before enqueue | Deny at the admin route; no job | n/a (HMAC/scheduler) |
| After enqueue, before execution | Worker loads current assignment; revoked → fail closed; no protected effect | Envelope + processing/privacy capability; no staff grant |
| Before commit (last safe boundary) | Re-check permission inside the same unit of work; abort if revoked | Privacy capability still required; shop stays disabled |
| After commit | Committed effects remain; do **not** describe them as undone; a retry of the same human job must re-check and deny if revoked | Retry uses the privacy/sync envelope, never a removed staff member’s permission |

A worker `actorKind=system` label **must not** be applied to human-requested replay/export/role jobs.

### 7.3 Immutable audit

**PROPOSED** table `AuditEvent` (merchant-domain, RLS, tenant `shopId`):

Required fields: `id`, `shopId`, `occurredAt` (UTC), `actorKind` (`human` \| `system` \| `shopify_webhook`), `actorShopifyUserId` (nullable), `actorSystemId` (nullable), `action`, `entityType`, `entityId` (nullable), `correlationId`, `causationId` (nullable), `decision` (`allowed` \| `denied` \| `failed` \| `completed` \| `partial`), `payloadMinimized` (JSONB allowlist), `idempotencyKey`.

**Event types (closed enum):**

`PERMISSION_DENIED`, `ROLE_ASSIGNED`, `ROLE_REVOKED`, `OWNER_PROOF_CONFLICT`, `SYNC_HEALTH_READ`, `REPLAY_REQUESTED`, `REPLAY_DENIED`, `EXPORT_REQUESTED`, `EXPORT_COMPLETED`, `EXPORT_FAILED`, `PRIVACY_INTAKE_ACCEPTED`, `PRIVACY_INTAKE_REJECTED`, `PRIVACY_STARTED`, `PRIVACY_CHECKPOINT`, `PRIVACY_COMPLETED`, `PRIVACY_PARTIAL_FAILED`, `PRIVACY_SUPERSEDED`, `PRIVACY_ESCALATED`, `SHOP_UNINSTALLED`, `SHOP_REINSTALLED`, `SHOP_REINSTALL_DENIED`, `AUTH_PLATFORM_DENIED`.

Do **not** emit `*_COMPLETED` on failed writes, failed permission checks, failed replays, or partial privacy actions. Partial privacy uses `PRIVACY_PARTIAL_FAILED` + checkpoint. Escalation uses `PRIVACY_ESCALATED`, never success.

**Ordinary immutability (application path):** `stocky_runtime` `GRANT INSERT, SELECT` only. Triggers reject `UPDATE`/`DELETE` for `stocky_runtime` and for any role that is not the privacy-erasure role. Corrections **append**. Unique `(shopId, idempotencyKey)` for exactly-once insert.

**Minimization at insert time:** never persist access tokens, raw HMAC, customer email/phone, payload dumps, or unsanitized webhook bodies. Store canonical Shopify user id string, action, entity ids, counts, and content **digests**.

**Privacy coexistence (D-PR7-08, constrained by P7-C02) — one model, no in-place rewrite:**

1. Normal application audit writes stay append-only.
2. A separately authorized **privacy-erasure** DB role (`stocky_privacy_erasure`, **PROPOSED** name) may `SELECT, DELETE` `AuditEvent` **only** under the same shop RLS/`SET` tenant context as runtime. It must **not** `DISABLE` RLS, `SET ROLE` to migration/owner, or read another shop.
3. `shop/redact` **deletes** tenant-linked `AuditEvent` rows via that role after merchant/control-plane erasure and before `Shop` delete. Do **not** UPDATE audit rows to “minimize in place.”
4. Retained proof is **not** those rows. `PrivacyCompletionReceipt` has **no** `shopId` FK, **no** customer/order/request join keys, **no** cleartext domain.
5. **PROPOSED** receipt columns: `id`, `completedAt` (UTC), `topic`, `manifestDigest`, `shopDomainHmac` (HMAC-SHA256 of the canonical `*.myshopify.com` domain with an environment pepper **not stored in the table**).
6. Threat model — `shopDomainHmac` is **identifiable**, not anonymous:
   - anyone with the pepper and a candidate domain can test membership (domain enumeration / known-shop confirmation);
   - unsalted SHA256 of the domain would be even more joinable — **do not use unsalted hashes**;
   - do not store `PrivacyRequest.id`, Shopify `shop_id`, webhook ids, customer ids, or entity ids on the receipt (those are join keys);
   - operators investigating a **known** shop can recompute the HMAC; that is correlation for support, not unlinkability;
   - Q-008 remains OPEN for whether any additional legal hold records exist and for how long. Empty holds in synthetic tests **do not** certify a production retention policy.
7. Counsel-confirmed holds (`PrivacyLegalHold`) are segregated, not selectable by `stocky_runtime`, and are empty unless Q-008 says otherwise.

`JobReplay` / `SyncApplicationReceipt` remain **operational ledgers**. They are not the merchant audit trail. Privacy **deletes** those rows per §7.6. After `shop/redact`, residual emptiness means **no** tenant-linked audit rows for that shop — only the separate receipt (and any counsel hold).

### 7.4 Privacy lifecycle state machine

**PROPOSED** `PrivacyRequest.state`:

`RECEIVED` → `AUTHENTICATED` → `SCHEDULED` → `ENUMERATING` → `APPLYING` → `CHECKPOINTING` → (`COMPLETED` \| `PARTIAL_FAILED` \| `SUPERSEDED` \| `ESCALATED` \| `LEGALLY_RETAINED`).

Terminal states are absorbing except `PARTIAL_FAILED` → `APPLYING` on retry and `ESCALATED` → (`APPLYING` \| `SUPERSEDED` \| `LEGALLY_RETAINED`) only after a **controlled** operator resolution that records evidence (not a timestamp heuristic). `ESCALATED` still counts against Shopify’s **30-day** clock from `receivedAt`.

| Topic | Intake | Work | Completion evidence |
|---|---|---|---|
| `customers/data_request` | HMAC + shop resolve + persist **lookup keys** (canonical customer id string + `orders_requested[]` as decimal strings) + `data_request.id`; hash email/phone for audit minimization but **do not** use hashes as the only lookup key | Bounded scan of **every relevant surface** using those ids / `gid://shopify/Order/{id}`; ephemeral owner-download of what is actually stored | Manifest counts + export digest; **no** long-term copy of customer email |
| `customers/redact` | same lookup keys | Delete/redact matching stored identifiers; if none **after a complete scan**, complete empty | Manifest `skipped_absent` counts |
| `shop/redact` | HMAC + shop resolve by `shop_domain` (payload has **only** `shop_id` + `shop_domain` — OFFICIAL). Bind to an app-owned **install generation** per §7.6. Do not invent a Shopify generation field. | If bound to an uninstalled generation with no live successor: full enumeration. If ambiguous: `ESCALATED`. | Completion receipt + residual probe **or** escalation record with deadline |

Ack **200** only after durable `RECEIVED` row exists (or duplicate idempotent hit). Invalid HMAC remains **401**. Do not claim erasure in the HTTP body. A 200 ack is not completion.

**Kill switch (D-PR7-09):** `FEATURE_PR7_PRIVACY_PAUSE` default **OFF**. When ON: still authenticate, persist `RECEIVED`, ack 200, do **not** delete; operators see `SCHEDULED` stuck. This is an emergency brake, **not** a waiver of the 30-day Shopify clock and not legal permission to miss it.

**Idempotency key:** `privacy:{topic}:{shopDomain}:{shopifyRequestId}` where request id is `data_request.id` or Shopify webhook delivery id. For `shop/redact`, Shopify documents no request id in the payload — **PROPOSED** key `privacy:shop_redact:{canonicalDomain}:{hmacOfRawBody}` plus the webhook delivery unique constraint already used by PR4, so duplicates collapse. Do not key solely on “current Shop.id” (that id changes across generations).

### 7.5 Deletion manifest design

**PROPOSED** `PrivacyDeletionManifest` + `PrivacyDeletionManifestLine`.

Manifest stores: topic, state, checkpoint cursor `(surface, afterId)`, per-surface counts, content digest of **sorted remaining primary keys** (not the payloads), error code, attempt count.

Lines store: `surface`, `action` (`deleted` \| `redacted` \| `skipped_absent` \| `skipped_legal` \| `skipped_tombstone_converted_to_delete`), `rowCount`, `digest`.

**A manifest must not retain the data meant to be erased.** No customer email/phone, no order notes, no token fragments, no JSONL copies. Lookup keys on `PrivacyRequest` (customer id / order REST ids as decimal strings) are **request identifiers**, not extra harvested PII; they are deleted with the request row at shop/redact completion. They exist so retries can still find stored order facts.

**P7-C05 identifier sufficiency:** hash-only persistence is **not** sufficient for lookup. Absence of a customer-id **column** on `ShopifyOrderFact` does **not** prove the requested order data is absent — order GIDs from `orders_requested` / `orders_to_redact` may still match. An empty-result fixture is valid **only** after a complete relevant-surface scan (every merchant table that can hold an order GID, customer GID if present, plus sessions/exports/queues for customer topics as applicable).

Checkpoint/retry: process one surface per transaction batch with a documented cap; crash resumes from cursor; already-deleted rows are `skipped_absent`.

### 7.6 Surfaces, order, and failure modes

**App-owned install generation (not a Shopify payload field):**

**PROPOSED** control-plane table `ShopInstallGeneration`: `{id, myshopifyDomain, shopifyShopIdNullable, shopRowIdNullable, installedAt, uninstalledAt, erasedAt, processingDisabledReason}`. Written on bootstrap/uninstall/erase. Survives `Shop` delete so a late `shop/redact` can be associated. Shopify’s `shop/redact` body still contains only `shop_id` and `shop_domain` (**OFFICIAL**). Do not invent a generation claim in that JSON.

**Shop/redact binding (P7-C03) — replace the withdrawn timestamp rule:**

Withdrawn: `reinstalledAt > uninstalledAt AND processingEnabled => SUPERSEDED`.

| Current evidence | Incoming authenticated `shop/redact` | Result |
|---|---|---|
| Shop disabled `UNINSTALLED`, no later enabled generation | bind to that generation; `APPLYING` erase | Normal D-021 path |
| Shop enabled and **never** uninstalled | `ESCALATED`; do **not** erase a live never-uninstalled shop | Unexpected delivery |
| Shop enabled after reinstall; prior generation `UNINSTALLED` and not erased | `ESCALATED`; do **not** delete the live shop; do **not** terminal-success; do **not** guessed-delete | Ambiguous payload vs generation |
| Duplicate delivery (same idempotency key) | same request; increment duplicateCount | No second worker storm |
| Delayed delivery; old generation already `erasedAt` set; new Shop exists | treat as duplicate completion of the **old** generation; **do not** erase the new shop | Fresh reinstall after completed erasure |
| No Shop row; matching completion receipt HMAC | idempotent `COMPLETED` | Late replay |
| No Shop row; generation uninstalled but not erased (crash mid-erase) | resume erase of remnants for that generation id | Missing shop row ≠ skip work |
| `ESCALATED` past `receivedAt+30d` without resolution | remain failed-open to Shopify only in the sense that 200 was already acked; internally `PARTIAL_FAILED`/`ESCALATED` with operator incident — **not** a waiver | Must not sit forever |

Controlled resolution of `ESCALATED` (operator, with audit): (a) confirm retain live generation → `SUPERSEDED` **only after** recorded evidence that the live shop is a new generation and old remnants (if any) are erased or absent; or (b) confirm old remnants only should be erased without touching the live `processingEnabled=true` shop. Default is (a)-safe: never DELETE the live enabled shop on an ambiguous payload.

**Fresh reinstall after completed erasure (D-PR7-06 refined):** if this `Shop` row is still `REDACTED` (erase incomplete), afterAuth must **not** re-enable or enqueue (keep fail-closed for **that generation**). After `Shop` is deleted and a receipt exists, a later afterAuth **creates a new Shop + new generation** and may enqueue. Do **not** permanently blacklist the merchant domain.

**Privacy worker while processing is disabled (P7-C05):**

Ordinary import, catalog afterAuth, replay, and non-privacy webhooks stay denied when `processingEnabled=false` (PR4). The shop is **not** re-enabled for redact.

**PROPOSED** limited capability `verified_privacy_job`:

- Envelope `jobType` ∈ `privacy:customers_data_request` \| `privacy:customers_redact` \| `privacy:shop_redact`;
- `shopId` from the envelope matches `PrivacyRequest` and tenant context;
- request state ∈ `ENUMERATING` \| `APPLYING` \| `CHECKPOINTING`;
- application helper `assertPrivacyErasureJob` **instead of** `assertProcessingEnabled`;
- DB: `stocky_privacy_erasure` + control-plane connections as §7.7 — **no** global RLS bypass;
- workers that are not privacy job types still fail closed on disabled shops.

**Shop/redact enumeration order (PROPOSED):**

1. Control-plane: bind generation; if ambiguous → `ESCALATED` and **stop** (no live-shop delete). If bound: set `processingEnabled=false`, `processingDisabledReason=REDACTED`. Cancel remaining cancellable **non-privacy** jobs (reuse uninstall helper; do not cancel the privacy job itself).
2. Redis: shop-scoped remove of matching BullMQ jobs except the in-flight privacy job (**D-PR7-10**).
3. **PROVISIONAL (H)** scratch: dispose only authentic `stocky-pr6-d` handles for that shop; leftovers remain in the residual probe.
4. Merchant child tables → direct tables (FK order; physical DELETE in the privacy module; **not** C apply — R-164 unchanged).
5. `SyncApplicationReceipt` and other merchant-domain operational rows.
6. Control-plane rows for `shopId` except the in-flight `PrivacyRequest` / manifest / generation row.
7. `Session` rows for the domain.
8. Privacy-erasure **DELETE** of tenant-linked `AuditEvent` (P7-C02). Copy `manifestDigest`; INSERT `PrivacyCompletionReceipt`; DELETE manifest/request rows; set generation `erasedAt`; DELETE `Shop`.
9. Residual probe: no `Shop` row; no tenant-linked audit; no merchant/control-plane remnants for that `shopId`; receipt exists; legal holds empty unless Q-008.

**Customers/\* :** steps 4–5 filtered by durable lookup keys (customer id + order REST ids), then complete-scan. Do **not** erase the whole shop.

**Adversarial cases the design must survive** (fixtures in the matrix):

| Case | Behavior |
|---|---|
| Duplicate webhook | increment delivery duplicateCount; return same request |
| Partial storage failure | `PARTIAL_FAILED`; no success audit; retry from cursor |
| Process death mid-batch | transaction rollback; checkpoint unchanged; retry |
| Concurrent webhook/import during redact | processing gate + REDACTED deny new **ordinary** intake; privacy job continues |
| Enqueue-before-uninstall | existing PR4 cancel; redact deletes cancelled job rows |
| Reinstall before delivery | **ESCALATED**, not timestamp `SUPERSEDED` |
| Delayed `shop/redact` after completed erasure + fresh reinstall | old generation idempotent complete; new shop retained |
| Missing old generation / crash remnants | resume by generation id |
| Concurrent afterAuth and redaction | afterAuth cannot re-enable a `REDACTED` generation; privacy job does not require afterAuth |
| Late D scratch after redact | residual probe fails until scratch disposed |
| Incomplete pagination | enumerator uses keyset `id > cursor` until empty page |
| Shared Redis/DB | envelope shopId mismatch denied; RLS / control-plane shop predicate; **no** generic bypass |
| Human replay revoked mid-flight | fail closed before effect (**P7-C04**); not converted to system |
| Cross-shop same external ids | tenant predicates; Shop A request cannot see Shop B GIDs |
| Forged actor/role / `account_owner` in JSON | ignored; deny |
| Legal hold | `LEGALLY_RETAINED` + `PrivacyLegalHold`; Shopify: do not complete deletion if legally required — **Q-008** |

### 7.7 Schema, grants, migration, recovery

**PROPOSED** additive Prisma migration `20260917100000_pr7_audit_roles_privacy_foundation` (name illustrative):

- enums: `ShopPlatformRole`, `AuditActorKind`, `AuditAction`, `AuditDecision`, `PrivacyTopic`, `PrivacyRequestState`, `PrivacyManifestAction`;
- tables: `ShopStaffUser`, `ShopRoleAssignment`, `AuditEvent`, `PrivacyRequest`, `PrivacyDeletionManifest`, `PrivacyDeletionManifestLine`, `PrivacyCompletionReceipt` (no Shop FK), `PrivacyLegalHold`, `ShopInstallGeneration` (control-plane);
- FKs: composite `(shopId, id)` where merchant-domain; `Shop` Restrict until ordered delete;
- unique: assignment `(shopId, shopifyUserId)` where `revokedAt` is null (partial unique);
- `AuditEvent` unique `(shopId, idempotencyKey)`;
- `shopifyUserId` stored as `VARCHAR` decimal digits (not lossy integer).

**Normal vs privacy privilege matrix (PROPOSED; D-PR7-13 still pending as a decision):**

| Table / object | `stocky_runtime` | `stocky_control_plane` | `stocky_privacy_erasure` | `stocky_migration` |
|---|---|---|---|---|
| `AuditEvent` | `INSERT, SELECT` only; trigger rejects UPDATE/DELETE | none | `SELECT, DELETE` with shop RLS **on** | DDL / repair |
| Merchant facts | existing DML minus `shopId` mutation | none | `SELECT, DELETE` with shop RLS | DDL |
| Control-plane job/sync tables | none | existing | none | DDL |
| `PrivacyRequest` / manifest | none | `INSERT, SELECT, UPDATE` allowlisted state columns | none | DDL |
| `PrivacyCompletionReceipt` | none | `INSERT, SELECT` | none | DDL |
| `Shop` processing flags | existing limited | existing | none | DDL |
| RLS | cannot disable | cannot disable | cannot disable | apply/verify only |
| Other shops | denied by RLS / predicates | shop predicate | denied by RLS | n/a |

Never one transaction across roles. Never a generic superuser bypass. Privacy worker: control-plane connection for request/flags/receipt **then** privacy-erasure connection for tenant-scoped deletes (P7-C05).

Then **enforcement tooling** (same future implementation PR, after migrate deploy): register tables in `scripts/tenant-enforcement/manifest.ts` / `app/tenant/models.ts` / `roles.ts`, including the new privacy-erasure role. Assignment tables: runtime DML minus `shopId` mutation (existing immutability trigger).

Lock strategy: new empty tables → ordinary indexes OK. Do not rewrite PR3/PR5/PR6 fact tables.

**Rollback / forward recovery (P7-C02):**

- Empty new tables (no privacy requests, no audit rows): migration down may drop objects.
- After audit or privacy requests exist: dropping tables is **not** a safe general rollback (destroys evidence and in-flight legal clocks). Rollback = disable processors / pause switch; leave tables.
- After erasure: **irreversible**. There is no undo. Recovery is **restart remaining work from the manifest cursor**, not restore deleted rows from the app.
- Pre-RLS application is not an acceptable rollback after privacy grants.

**Do not** add migrations in this planning PR. SQL in this section is specification only.

### 7.8 Frozen interfaces consumed (no silent widening)

| Lane | Interface | PR7 use | Change? |
|---|---|---|---|
| PR2 | `requireAdminTenant`, `TenantAuthority`, client-shop denial | wrap, do not replace | additive `requirePlatformPermission` |
| PR2/PR4 | job envelope v1/v3 | privacy jobs | new `jobType` strings only after D merge if `execution-strategy` is frozen to D |
| PR3 | RLS, runtime role, bootstrap boundary | new tables follow the same contract | additive manifest entries |
| PR4 | `processUninstall`, `replayDeadLetter`, sanitizers, processing gate | call; emit audit from **new** wrappers | avoid rewriting uninstall internals except a documented hook |
| PR4 | `reactivateShopAfterVerifiedReinstall` | already denies `REDACTED` | **must add tests**; deny re-enable of **that generation**; allow **new** Shop after completed erasure (P7-C03) |
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
| `app/tenant/after-auth.server.ts` | fail closed on **this generation** `REDACTED`; do not enqueue; do not upsert settings as a revival path; allow new Shop after completed erasure |
| `app/shopify.server.ts` | stop catalog enqueue when bootstrap says this generation is redacted; `useOnlineTokens` **only if D-PR7-02 accepted** (not authorized here) |
| `app/sync/uninstall.server.ts` | optional audit emit hook **or** emit from the route after `processUninstall` (prefer route/wrapper to keep PR4 behavior); write `ShopInstallGeneration.uninstalledAt` |
| `app/sync/replay.server.ts` | none if wrapper lives in `app/rbac` / `app/routes/app.platform.replay.tsx`; worker must revalidate human permission (P7-C04) |
| `.github/workflows/ci.yml` | add `test:privacy` to heavy job — **implementation PR**, not this docs PR |

**Forbidden:** D `app/lib/order-facts/sync/**`, B `admin-read/**`, C `apply/**`, A lock/types, PR43 branch, shared-control live docs in **this** planning PR.

Privacy jobs **PROPOSED** as `DurableJob.jobType` values `privacy:customers_data_request` | `privacy:customers_redact` | `privacy:shop_redact` on the existing webhook queue after D merge, to avoid a competing `queue.server.ts` rewrite while H is open.

---

## 8. Recommended implementation sequence

**PROPOSED** single-module order once ChatGPT issues runtime authority **and** §10 gates pass:

1. Additive migration + scanner/manifest/role grants + immutability triggers + empty-table isolation tests.
2. Actor derivation + assignment + `requirePlatformPermission` + denial tests (including forged fields).
3. `AuditEvent` emit helper; couple permission denials and role changes; prove runtime cannot UPDATE/DELETE; prove privacy-erasure role can DELETE only its shop.
4. Rewrite `webhooks.compliance.tsx`; intake + state machine + manifest + lookup keys; `test:privacy` fast suite.
5. Shop/redact enumerator + dual-role deletes + residual probe; customer topics after complete-scan (may be empty).
6. afterAuth: deny **this** REDACTED generation; allow new Shop after completed erasure; uninstall session E2E; reinstall/escalation matrix.
7. Redis (+ H scratch if D merged) cleanup; residual probe includes them.
8. Minimal platform routes (health/replay/export/roles) with server checks independent of UI; human-job revalidation.
9. Exact-head full CI; independent Tier-A Claude review with no unresolved P0/P1/P2.

No estimated calendar. No fake completion percentage.

---

## 9. Decision register

Original IDs preserved. ChatGPT constraints **P7-C01…06** change some recommended options; they are **not** silent runtime defaults. Status column: `constrained` = ChatGPT required this shape; `proposed` = still pending.

| ID | Question | Recommended option | Status | Blocks runtime start? |
|---|---|---|---|---|
| **D-PR7-01** | Trusted human actor source | Verified `authenticate.admin` only: online `associated_user.id` else `sessionToken.sub` if proven present; fail closed if missing for platform ops; canonicalize as decimal string | **proposed** | Yes |
| **D-PR7-02** | Enable `useOnlineTokens: true` | **PROPOSED:** enable it **if** automated owner grant is wanted, because `account_owner` is documented only on the online `associated_user` object. Actor id may still come from `sub`. No config change in this PR. | **proposed** (owner-proof need is constrained; enablement is not) | Yes until answered |
| **D-PR7-03** | Are `JobReplay` / receipts the audit log? | **No** — separate `AuditEvent` | **proposed** | Yes |
| **D-PR7-04** | Who is first `shop_owner`? | **Only** same-shop verified `associated_user.account_owner === true` for the same user id, or a separately approved owner-verification flow. Empty assignments / first staff / collaborator / installer / email / `sub` are **not** grants. Unassigned + `owner_assignment_pending`. | **constrained by P7-C01** | Yes |
| **D-PR7-05** | `shop/redact` vs reinstall | Bind via app-owned `ShopInstallGeneration`. Ambiguous payload → `ESCALATED` + 30-day deadline. **No** timestamp-only `SUPERSEDED`. Do not guessed-delete a live shop. | **constrained by P7-C03** | Yes |
| **D-PR7-06** | afterAuth on `REDACTED` | Fail closed for **that generation** (no settings revival, no catalog enqueue). After completed erasure + Shop delete, a **new** generation may install. No permanent domain blacklist. | **constrained by P7-C03** | Yes |
| **D-PR7-07** | Gate legacy merchandising routes? | **No** in PR7 | **proposed** | No |
| **D-PR7-08** | Audit vs shop/redact | Runtime append-only. Privacy-erasure role **DELETE**s tenant-linked `AuditEvent`. Separate receipt with identifiable `shopDomainHmac` (not claimed anonymous). No in-place audit UPDATE. | **constrained by P7-C02** | Yes |
| **D-PR7-09** | Privacy pause kill switch | `FEATURE_PR7_PRIVACY_PAUSE` default OFF; does not waive 30-day clock | **proposed** | Implementation detail |
| **D-PR7-10** | Redis purge vs drain | **Shop-scoped remove** of matching jobs except in-flight privacy job; fail-closed workers | **proposed** | Yes |
| **D-PR7-11** | Delete `Shop` row? | Delete after children **and** after privacy-erasure of tenant-linked audit/privacy-request rows. Receipt has **no** Shop FK. | **constrained by P7-C02** | Yes |
| **D-PR7-12** | Role change / revoke mid-human-job | Revalidate human permission at execution / last safe pre-effect boundary. Do not convert to a system job. Autonomous privacy/sync do not use staff grants. | **constrained by P7-C04** | Yes |
| **D-PR7-13** | Which DB roles write privacy? | Control-plane for request/manifest/receipt/flags; `stocky_privacy_erasure` for tenant-scoped fact+audit DELETE; never one txn across roles; never disable RLS | **proposed** (capability required by P7-C05; exact split pending) | Yes |
| **D-PR7-14** | How to fulfill `customers/data_request` “to the store owner” | Short-lived owner-only download (`platform.export.operational`) + audit; TTL delete blob | **proposed** | Staging/legal later |
| **Q-008** | Retention / privacy-policy language | Keep OPEN; empty legal-hold set in synthetic tests is **not** production policy | **OPEN** | Production, not this planning PR |

Do **not** treat recommended options as runtime authority. Unanswered **proposed** security/privacy items stay pending.

---

## 10. Conditions under which a future PR7 implementation may begin

**P7-C06.** This assignment does **not** authorize a V-only alternate base. All of the following are required — ChatGPT owns the call:

1. ChatGPT **accepts the corrected execution plan + acceptance matrix** and the constrained D-PR7 items.
2. Remaining **proposed** D-PR7 decisions that block runtime (01, 02, 03, 07-as-needed, 09-as-needed, 10, 13, 14-as-needed) are explicitly answered — **not** silently defaulted.
3. Phase 1 PR6 is **independently accepted and formally closed** on the then-current merged `origin/main` (including D). Implementation branches from that main, not from this planning SHA.
4. Exact-head CI evidence on that merged main per `CI_POLICY.md`.
5. Named single writer, exclusive files (§7.9), one branch, one chat; **no competing D writer**.
6. Explicit subsequent ChatGPT **runtime** authority sentence (this packet is not that sentence).

PR7 implementation is **Tier A**. Exact-head **full** CI (not docs-only) is required. Independent review must have **no unresolved P0/P1/P2**; every P3 needs explicit disposition.

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
| Original planning HEAD | `git rev-parse HEAD` at correction start | `4158254cba4800ceec112579ca842ee69f47c882` |
| Required base V | `git rev-parse origin/main` | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Working tree before correction edits | `git status --porcelain` | empty |
| Pinned H (dated, unmerged) | PR43 head at planning time | `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` — **not re-fetched as merge authority this correction** |
| Sanitizer unit (planning session) | `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-control-plane.test.ts` | **PASS** — 11 tests, exit 0, SHA V — **this planning session** |
| PII/mutation + flags (planning session) | `npx vitest run app/lib/order-facts/admin-read/mutation-safety.test.ts app/lib/order-facts/foundation-safety.test.ts` | **PASS** — 10 tests, exit 0 — **this planning session** |
| Shop-domain unit (planning session) | `npx vitest run app/lib/shop-domain.test.ts` | **PASS** — 10 tests, exit 0 — **this planning session** |
| `test:privacy` | `npm run test:privacy` | **FAIL** missing script, exit 1 (expected absence) |
| `test:sync-uninstall` / `test:tenant-access` / `test:db-isolation` | not started in the planning or correction sessions | **BLOCKED** — localhost Postgres/Redis TCP refused; docker not installed. Suites **exist on V**; they were **not executed here**. Historical counts in older implementation reports are **not** this session’s evidence. |
| Shopify store calls | — | **not executed** |
| Classifier + `git diff --check` | after correction docs land | recorded in the PR / return |

Environment: Node `v22.14.0`, cwd `stocky-plus/` for npm/vitest, no disposable PostgreSQL/Redis listening.

---

## 13. Cross-check to the acceptance matrix

| Plan section | Matrix IDs |
|---|---|
| Actor / forged authority / owner bootstrap | PR7-ACT-001…020 |
| Permission matrix / human-job revocation | PR7-RBAC-001…018 |
| Audit immutability / privacy-erasure | PR7-AUD-001…012 |
| Uninstall / reinstall / generations | PR7-LIFE-001…015 |
| Privacy intake / states / escalation | PR7-PRIV-001…014 |
| Shop/redact enumerator / residual | PR7-RED-001…016 |
| Customer topics / lookup keys | PR7-CUST-001…010 |
| Redis / scratch / dual-role / privacy capability | PR7-SIDE-001…008 |
| Isolation / CI command | PR7-ISO-001…003, PR7-CI-001…003 |

If a matrix row cites a path, that path is listed in §4 or §7. If a plan surface has no matrix row, that is a packet defect — none intended.
