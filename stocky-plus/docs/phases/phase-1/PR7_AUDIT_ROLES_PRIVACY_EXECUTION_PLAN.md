# Phase 1 PR7 — Audit, roles, and privacy execution plan

**Status:** **PROPOSED — ONE-DEPENDENCY-AHEAD — NOT IMPLEMENTATION AUTHORITY**

**Document type:** execution-ready architecture / acceptance contract for the next approved Phase 1 module.

This packet does **not** authorize PR7 runtime, migrations, grants, Shopify configuration, production, inventory writes, flag enablement, or merge. ChatGPT’s 2026-09-17 executable-contract constraints supersede conflicting proposed wording from earlier PR45 heads. They do **not** accept the whole plan, close PR6, or start implementation.

---

## 0. Label discipline

Every claim in this document is one of:

| Label | Meaning |
|---|---|
| **FACT (V)** | Observed on merged executable baseline `a3ff480f1477237f8055f10c43298480a05728a1` |
| **FACT (library)** | Observed in installed TypeScript types under `stocky-plus/node_modules` at V |
| **OFFICIAL** | Shopify or PostgreSQL documentation fetched on the stated access date; not legal advice |
| **CONSTRAINED** | ChatGPT product/security planning decision for this packet; not runtime authority |
| **PROVISIONAL (H)** | Observed on unmerged PR6-D candidate `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b`; not merged authority |
| **PROPOSED** | Remaining implementer specification inside a constrained decision; still not runtime |
| **UNVERIFIED** | Not executed or not confirmed from an official source |
| **BLOCKED** | Specified check could not be executed in this planning environment |

Companion file (must stay internally consistent with this plan):

- `stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md`

Immutable independent review (byte-for-byte; do not edit):

- `stocky-plus/docs/phases/phase-1/PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md`

---

## 1. Identities

| Field | Value |
|---|---|
| Planning branch (platform) | `cursor/planning-pr7-audit-roles-privacy-20260916-63ef` |
| Authorized planning name | `planning/pr7-audit-roles-privacy-20260916` |
| Executable baseline **V** | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Pinned D candidate **H** | `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` (dated unmerged snapshot; do not chase) |
| Authorization (planning) | [PR43 comment 5707545217](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5707545217) |
| Authorization (P7-C01…06) | [PR45 comment 5713121021](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5713121021) |
| Authorization (executable contract) | [PR45 comment 5714629032](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5714629032) (`user=Vedang1998`, `created_at=2026-09-17T12:50:00Z`) |
| Starting head for this correction | `f1b0364049e04baec1f1f68b61f0074677161d00` |
| Review commit (fast-forwarded, immutable) | `86c1c520e8e7b72742f1061bd261682cf011f758` parent `f1b0364…` blob `c1fa5c2fed74bf80d1006267b43d767258895c17` |
| Review publication PR | [#46](https://github.com/Vedang1998/Stocky/pull/46) targeting this planning branch; not a merge route onto `main` |
| Work order | `PR45_PR7_Executable_Contract_Corrections_Work_Order.md` |
| Decision heading | D-054 **EFFECTIVE** — **no D-055** |
| R-176 | remains **OPEN / P0** |
| R-164 | unchanged (privacy physical DELETE is not C apply) |
| Q-008 | remains **OPEN** |
| Phase 1 | **IN PROGRESS** |
| Production / inventory-write flags | **NOT AUTHORIZED** / **DEFAULT OFF** |

Live shared-control files on V remain stale relative to merged V. This planning PR **must not** edit them.

### 1.1 P7-C01…06 (still in force)

| Correction | Constrains | Still true after this packet |
|---|---|---|
| **P7-C01** | D-PR7-01/02/04 | No first-login / `sub` / installer / email owner grant |
| **P7-C02** | D-PR7-08/11/13 | Runtime audit append-only; restricted erasure DELETE; identifiable receipt |
| **P7-C03** | D-PR7-05/06 | No timestamp-only `SUPERSEDED`; no permanent domain blacklist |
| **P7-C04** | D-PR7-12 | Human jobs revalidate; no conversion to `actorKind=system` |
| **P7-C05** | D-PR7-13; lookup keys | Privacy work while disabled without re-enabling or RLS bypass |
| **P7-C06** | §10 | No V-only base; no unresolved P0/P1/P2 before runtime; blocked suites are not executed-on-V |

### 1.2 F-CLAUDE-PR7CP-01…10 dispositions (this correction)

| ID | Sev | Original defect | This packet | Plan anchors | Matrix anchors |
|---|---|---|---|---|---|
| **F-CLAUDE-PR7CP-01** | P0 | Domain/body HMAC / receipt HMAC certified later generations | Three identities: delivery, work/generation, completion. Old receipt cannot skip new work | §7.4, §7.6 | PR7-LIFE-016…024, PR7-RED-007 |
| **F-CLAUDE-PR7CP-02** | P0 | Same RLS as runtime includes `processingEnabled` | Distinct privacy policies omit processingEnabled; require request GUC + helper; coordinator journal while disabled | §7.3, §7.7 | PR7-PRIV-014, PR7-AUD-013/014, PR7-SIDE-009/010 |
| **F-CLAUDE-PR7CP-03** | P1 | No role may `DELETE Shop` | Checked `stocky_privacy_finalize_shop_delete` owned by nologin role; runtime/CP have no bare Shop DELETE | §7.6.4, §7.7 | PR7-RED-001, PR7-RED-006, PR7-RED-021 |
| **F-CLAUDE-PR7CP-04** | P1 | Receipt before residual; coordinator deleted early | Residual proof then conditional completion txn then prune; crash resume | §7.6.3 | PR7-RED-017…020, PR7-LIFE-022 |
| **F-CLAUDE-PR7CP-05** | P1 | `String(associated_user.id)` | Canonical actor = verified `sessionToken.sub` digit string; unsafe numeric owner correlation blocked | §7.1 | PR7-ACT-018, PR7-ACT-021…023 |
| **F-CLAUDE-PR7CP-06** | P1 | Two-role “same unit of work” | Control-plane serialization + assignment row lock helper; no cross-role atomicity claim | §7.10 | PR7-RBAC-015, PR7-RBAC-019…021 |
| **F-CLAUDE-PR7CP-07** | P1 | Privacy jobs omitted from V dispatch path | Named job types, additive strategy, listed shared files, while-disabled claim path | §7.9, §7.11 | PR7-PRIV-015…018 |
| **F-CLAUDE-PR7CP-08** | P2 | Owner-only vs `shop_admin` export | Distinct `platform.privacy.data_request.download`; live Shopify account owner | §7.2, §7.13 | PR7-CUST-006, PR7-CUST-011/012 |
| **F-CLAUDE-PR7CP-09** | P2 | `ESCALATED` unnamed | Owner view + operator CLI; evidence schema; deadlines | §7.12 | PR7-ESCL-001…004, PR7-PRIV-005 |
| **F-CLAUDE-PR7CP-10** | P3 | Six-month page vs changelog | Changelog is newer published behavior; handle on arrival; no local 180-day wait | §3 | PR7-CUST-013 |

Original finding IDs are not renamed. Designed fixtures are **not** passing processors.

---

## 2. Authority, scope, and non-goals

**In scope (proposal only):** immutable audit; Shopify-user/role scaffold; Phase 1 platform permission checks; compliance processors; deletion manifests; the constrained contracts above.

**Expressly out of scope:** PR7 runtime now; PR43 edits; competing D writer; PR8; later PRD role templates as production RBAC; gating merchandising routes; certifying GDPR/CPRA; inventing a legal hold period; closing R-176/R-164/R-005/Q-008; creating D-055; production; store calls; flag enablement.

**Why one module:** audit, RBAC, and privacy share identity, fail-closed default, and deletion/immutability coexistence. Parallel Cursor lanes are not recommended until F1 schema freeze is merged.

---

## 3. Official Shopify and PostgreSQL facts

Re-fetched **2026-09-18** unless noted. No store calls. Not legal advice.

Sources:

- [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance) — **2026-09-18**
- [Webhooks delivery structure](https://shopify.dev/docs/apps/build/webhooks/delivery-structure) — **2026-09-18**
- [Verify deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries) — **2026-09-18**
- [Changelog: customer data erasure, 2026-03-23](https://shopify.dev/changelog/updated-handling-of-customer-data-erasure-requests-with-recent-orders) — **2026-09-18**
- [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens) — **2026-09-18**
- [Authenticate admin](https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin) — **2026-09-18**
- [PostgreSQL 16 CREATE POLICY](https://www.postgresql.org/docs/16/sql-createpolicy.html) — **2026-09-18**
- [PostgreSQL 16 row security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html) — **2026-09-18**

Repo webhook pin remains Admin API **`2026-07`**. The privacy-law-compliance TOML **example** still uses `2024-07`; that example is not this repository’s pin.

### 3.1 Mandatory compliance webhooks — OFFICIAL

Public App Store apps must subscribe to `customers/data_request`, `customers/redact`, `shop/redact`. Handle `POST` + `application/json`. Invalid HMAC → **401**. Ack → **200-class**. Complete within **30 days** of receiving the request unless legally required to retain (then do not complete deletion). Shopify’s page is not legal advice.

Payloads (synthetic field names from the compliance page):

| Topic | Body keys | Delivery timing notes |
|---|---|---|
| `customers/data_request` | `shop_id`, `shop_domain`, `orders_requested[]`, `customer.{id,email,phone}`, `data_request.id` | Provide stored customer data **to the store owner directly** |
| `customers/redact` | `shop_id`, `shop_domain`, `customer.{id,email,phone}`, `orders_to_redact[]` | See §3.2 |
| `shop/redact` | `shop_id`, `shop_domain` only | **48 hours after uninstall**. **No** generation field |

**CONSTRAINED (F-CLAUDE-PR7CP-10):** regardless of Shopify’s scheduling, this app starts handling an **authenticated delivered** request on arrival. It must **not** add a local six-month wait or pause the 30-day clock while documentation conflicts are investigated.

### 3.2 `customers/redact` timing conflict — OFFICIAL vs dated update

| Source | Statement (2026-09-18 fetch) | Authority for this packet |
|---|---|---|
| Privacy-law-compliance page (still live) | If no order in past six months, payload ~10 days after request; otherwise withheld until six months | Older still-published page. Recorded for transparency. **Not** an implementation wait instruction |
| Changelog **2026-03-23** | Erasure requests are processed **10 days after submission**, regardless of most recent order. Gift cards scheduled to send remain pending until delivered | **Newer published behavior.** Use this when describing Shopify’s current send policy |

Do not describe both as equally authoritative implementation instructions. Do not certify legal compliance. Do not invent retention periods (Q-008).

### 3.3 Delivery vs event identifiers — OFFICIAL

[Delivery structure](https://shopify.dev/docs/apps/build/webhooks/delivery-structure) (every HTTPS delivery):

| Header | Meaning |
|---|---|
| `X-Shopify-Webhook-Id` | Unique composite key **per delivery**. Deduplicate individual deliveries |
| `X-Shopify-Event-Id` | Shared across deliveries from the **same merchant action** |
| `X-Shopify-Shop-Domain` | Shop domain |
| `X-Shopify-Topic` | Topic |
| `X-Shopify-Hmac-Sha256` | HMAC |
| `X-Shopify-API-Version` | Serialization version |
| `X-Shopify-Triggered-At` | Trigger timestamp |

[Verify deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries): use `X-Shopify-Webhook-Id` to skip duplicate **deliveries**; use `X-Shopify-Event-Id` to **correlate** same-action deliveries. Multiple subscriptions to the same topic produce different webhook ids and the same event id.

**FACT (library):** `authenticate.webhook` context includes `shop`, `topic`, `webhookId: string`, `payload`, `apiVersion`. It does **not** bind `eventId`. After successful authentication, read `X-Shopify-Event-Id` from the request headers (case-insensitive). **Do not** fabricate header presence. If the event header is missing, persist `eventId=null` and continue with delivery-id dedup; missing event id is not a 401.

**Do not** change the frozen PR4 `WebhookDelivery` unique `(shopId, shopifyWebhookId) WHERE NOT NULL`. Privacy intake uses a **separate** control-plane binding table keyed without depending on a still-living `Shop.id` as the lifetime work key.

Raw headers are not independent authority to select a different shop or erase generation. Shop identity comes from `authenticate.webhook`’s verified `shop` plus body `shop_domain` consistency. Mismatch → reject, no work bind.

**UNVERIFIED:** whether a given compliance delivery omits `X-Shopify-Webhook-Id` in production. Library types it as `string`. If HMAC succeeded and `webhookId` is empty/missing: durable quarantine + `ESCALATED`, ack 200, **do not** bind a generation, **do not** 401.

### 3.4 Staff identity vs shop token — OFFICIAL / FACT (library)

- Default tokens are **offline**. Online tokens optional; expire after 24 hours or admin logout; carry `associated_user` including `account_owner`, `collaborator`, `email_verified`, `id`.
- ID tokens authenticate the **user** and carry **no permissions**. `sessionToken.sub` is identity, not ownership.
- Authenticate/admin examples that read `sessionToken.sub` set `useOnlineTokens: true`.
- **FACT (library):** `OnlineAccessUser.id: number`. `JwtPayload.sub: string`.
- **FACT (V):** `app/shopify.server.ts` does **not** set `useOnlineTokens`. It sets `future.expiringOfflineAccessTokens: true`.
- **FACT (library):** Prisma session adapter writes `userId` from `associated_user.id as unknown as bigint` (compile-time assertion; runtime value is still the JSON number).

**Executed this correction session (Node `v22.14.0`):** `Number("9007199254740993") === 9007199254740992`. Stringifying that number cannot recover the original digits.

**UNVERIFIED at runtime (must be proven in implementation tests, not by examples):** that the installed `@shopify/shopify-app-react-router` actually returns `sessionToken.sub` and an online `associated_user` when `useOnlineTokens: true` is set. No dependency upgrade or custom token parser is authorized.

### 3.5 PostgreSQL RLS — OFFICIAL (v16)

- Policies default **PERMISSIVE** and combine with **OR**. Restrictive policies AND. At least one permissive policy is required for access.
- `DELETE` policies take **USING only**. There is **no** `WITH CHECK` for DELETE.
- Rows that fail USING are typically **silently filtered** (0 rows), not an exception, unless a `RETURNING`/`SELECT` policy check throws (PostgreSQL Table 292).
- A policy `TO role_a` does not apply to `role_b`. Do **not** create privacy policies `TO PUBLIC` or `TO stocky_runtime`.
- FORCE RLS remains on. No `BYPASSRLS`. Policy expressions run with the rights of the querying user; helpers they call must be EXECUTE-granted.

---

## 4. Repository evidence inventory — merged V

Classification: **implemented and demonstrated** / **implemented but unproven** / **missing** / **explicitly later** / **requires owner or legal decision**. Absence is from source and tests, not a filename. The review’s RLS conclusion is **source-derived** from `rlsPoliciesSql`; this session did **not** run live PostgreSQL DELETE-while-disabled (Postgres/Redis still not listening). That evidence class is **not** upgraded.

### 4.1 Auth / session / bootstrap (unchanged facts)

| Surface | Path / symbol | Status |
|---|---|---|
| `shopifyApp` | `app/shopify.server.ts` | **implemented**; no `useOnlineTokens`; afterAuth always enqueues catalog after bootstrap |
| `requireAdminTenant` | `app/tenant/require-admin-tenant.server.ts` | shop authority only; **never** reads `session.userId` / `onlineAccessInfo` / `sessionToken.sub` |
| `runAfterAuthTenantBootstrap` | `app/tenant/after-auth.server.ts` | **FACT:** swallows `reinstall_denied`, then upserts `ShopSettings` |
| `upsertCanonicalShop` | `app/tenant/bootstrap.server.ts` | `createIfMissing` upsert on `myshopifyDomain` unique; **no** FINALIZING fence today |
| `setTransactionLocalTenantContext` | `app/tenant/db-context.server.ts` | `set_config(..., is_local=true)` for `stocky.current_shop_id`, context version, correlation |
| `Session.userId` | `prisma/schema.prisma` | `BigInt?`; unused by app RBAC |
| Compliance stub | `app/routes/webhooks.compliance.tsx` | `authenticate.webhook` then empty `200`; **no** persist |
| Uninstall route | `app/routes/webhooks.app.uninstalled.tsx` | passes `webhookId` into `processUninstall` |

### 4.2 Replay / processing gates (symbols that PR7 must name)

| Symbol | Path | FACT (V) behavior |
|---|---|---|
| `replayDeadLetter` | `app/sync/replay.server.ts` | Control-plane txn; args `{deadLetterId,shopId,reason}`; **no actor**; denies disabled shop; creates PENDING `DurableJob` + `JobReplay` + marks DL `REPLAYED` |
| `ingestAuthenticatedWebhook` | `app/sync/intake.server.ts` | Denies durable job unless `processingEnabled` or topic `app/uninstalled` |
| `createDurableJob` | `app/sync/intake.server.ts` | Throws `shop_processing_disabled` when `processingEnabled=false` |
| `executionStrategyForJobType` | `app/sync/execution-strategy.server.ts` | Unknown types including any `privacy:*` → `NO_AUTOMATIC_RETRY` |
| `JobExecutionStrategy` enum | `prisma/schema.prisma` | `ATOMIC_APPLICATION_RECEIPT`, `REBUILDABLE_IDEMPOTENT`, `NO_AUTOMATIC_RETRY`, `CONTROL_ONLY` only |
| `dispatchPendingJobs` | `app/sync/dispatcher.server.ts` | After claim, `if (!shopLive?.processingEnabled)` takes shop-disabled path |
| `enqueueWithDispatch` | same | Disabled shops do not get a runnable queue add for ordinary jobs |
| Fair-claim SQL | `app/sync/fair-claim-query.server.ts` `buildFairClaimSchedulerLockSql` | `WHERE r."processingEnabled" = true` |
| `assertDispatcherUsesProductionFairClaimSql` | same | Frozen identity for ordinary claim SQL — **do not silently rewrite** |
| `processUninstall` | `app/sync/uninstall.server.ts` | Disables shop; cancels **all** `CANCELLABLE_DURABLE_JOB_STATES`; session delete after commit |
| `completeAttemptRetry` | `app/sync/lifecycle.server.ts` | `NO_AUTOMATIC_RETRY` → dead-letter uncertain |
| `processWebhookJob` | `app/jobs/workers/webhook-processor.ts` | Calls **`assertShopProcessingEnabled`** before v3 work |
| `assertShopProcessingEnabled` | same file, local | Throws `shop_processing_disabled` |
| Queue names | `app/jobs/queue.server.ts` | `WEBHOOK_QUEUE="stocky-webhooks"`, `CRON_QUEUE="stocky-cron"`; `enqueueWebhook`, `getWebhookQueue`, `createWebhookWorker` |
| Queue presence | `app/sync/queue-presence.server.ts` | `inspectQueueDispatchPresence`, `classifyExistingQueueJob`, `RUNNABLE_BULLMQ_STATES`, `TERMINAL_BULLMQ_STATES` |
| `reactivateShopAfterVerifiedReinstall` | `app/sync/reinstall.server.ts` | Throws `reinstall_denied` on `REDACTED`/`MANUAL` |
| RLS generator | `scripts/tenant-enforcement/sql.ts` `rlsPoliciesSql` | Predicate includes `stocky_shop_processing_enabled("shopId")` on SELECT/INSERT/UPDATE/**DELETE** for `stocky_runtime` |
| Shop runtime privs | `scripts/tenant-enforcement/manifest.ts` `BOOTSTRAP_TABLES` | `Shop`: `SELECT, INSERT, UPDATE` — **no DELETE** |
| Control-plane Shop | `scripts/sync-control-plane/roles.ts` | Column SELECT/UPDATE lifecycle; **no** Shop DELETE |
| Receipt probe pattern | `stocky_has_application_receipt` | SECURITY DEFINER, locked `search_path`, PUBLIC EXECUTE revoked; owner `stocky_receipt_probe_owner` |
| Feature flags | `app/lib/feature-flags.server.ts` | Inventory-write kill switches only |
| `test:privacy` | `package.json` | **missing script** (re-confirmed this session, exit 1) |
| `npm test` include | `vitest.config.ts` | `app/**/*.test.ts` except tenant + `app/sync/__tests__` |

Merchant models, PII-adjacent surfaces, H scratch, and sanitizer facts in the previous packet §4.3–4.6 remain accurate and are not repeated here. `Shop.myshopifyDomain` is unique. `ShopProcessingDisabledReason` includes `REDACTED`; nothing on V writes `REDACTED`.

### 4.3 Tests this correction session

| Command | Exit | Class |
|---|---|---|
| IEEE-754 Node probe | 0 | **executed-this-planning-session** |
| `npm run test:privacy` | 1 missing script | **executed-this-planning-session** (absence) |
| `test:sync-uninstall` / `test:tenant-access` / `test:db-isolation` / live RLS | not started | **present-on-V-not-executed** / **BLOCKED** (Postgres/Redis down) |

---

## 5. V-versus-H integration dependency

**PROVISIONAL (H)** only. Do not wait for PR43. Do not start a competing D writer.

Privacy sanitizer stays in `app/privacy/**`, not D’s `sanitize.server.ts`. After D **merges**, refresh named shared files on that main (§7.9). D scratch cleanup consumes the **accepted** D reclamation boundary; do not invent an in-process handle for a dead worker. If that interface is still infeasible on the implementation base, flag it as a remaining integration decision — do not silently skip leftover bytes.

R-176 stays OPEN/P0. Physical DELETE of facts is privacy, not C apply (R-164 unchanged).

---

## 6. Approved requirement comparison

Unchanged vs prior packet: audit/roles/privacy processors **missing** on V; uninstall disable **implemented**; D-021 direction **approved** pending Q-008; `shopDomainHmac` is **identifiable**, not anonymous; D-014…D-018 remain the RLS/runtime/migration/context/bootstrap constitution this packet must not weaken.

---

## 7. Constrained complete module

Labels: **CONSTRAINED** = ChatGPT 2026-09-17 executable-contract assignment. **PROPOSED** = specification inside that constraint. Neither is runtime authority.

### 7.1 Actor model — D-PR7-01/02/04 **CONSTRAINED** (F-CLAUDE-PR7CP-05)

| Concept | Rule |
|---|---|
| Shop authentication | Unchanged: `authenticate.admin` / `authenticate.webhook` / validated job envelope → canonical Shop → `TenantAuthority` |
| Staff authentication | Human **platform** actions require a verified digit-string actor from the same `authenticate.admin` result |
| Canonical actor ID | **`sessionToken.sub`** after library authentication, matching `^[0-9]+$`. Persist that **exact** string |
| Forbidden persistence sources | `Number(...)`, `parseInt`, `String(associated_user.id)`, `Session.userId`, TypeScript `as bigint` |
| Owner proof | Same freshly verified **online** context: `associated_user.account_owner === true`, `collaborator !== true`, shop/`dest` match, and a **safe-integer** check that `associated_user.id` equals the canonical sub **only as a corroboration**. Sub remains the key. Mismatch, unsafe number, or missing online user → `unassigned` + `owner_assignment_pending` + `OWNER_PROOF_UNSUPPORTED` (not a grant) |
| First-login | **Forbidden** (P7-C01) |
| Client-supplied actor/role/`account_owner` | Ignored |

**D-PR7-02 CONSTRAINED:** FUTURE implementation sets `useOnlineTokens: true` via the installed package’s supported `shopifyApp({ useOnlineTokens: true })` configuration for **human platform** sessions, and **keeps offline tokens** for autonomous jobs/webhooks. **No config edit in PR45.** Implementation must add a library/fixture test that `authenticate.admin` actually binds `sessionToken.sub` and online `associated_user` under that flag. If the installed package does not bind `sub`, platform ops and automated owner bootstrap stay fail-closed until a separately reviewed lossless path exists. No dependency upgrade is silently authorized.

Wide sub `9007199254740993`: **preserve the string** for identity tests. **Do not** declare owner grant supported for that user unless a lossless `associated_user` correlation exists (it does not, via IEEE-754). That is `OWNER_PROOF_UNSUPPORTED`, not `shop_owner`.

Recovery: merchandising routes stay `requireAdminTenant` (D-PR7-07). Platform ops denied while `owner_assignment_pending`. Support cannot click a user into ownership.

### 7.2 Phase 1 platform permission matrix — D-PR7-07/14 **CONSTRAINED**

Roles unchanged: `shop_owner`, `shop_admin`, `platform_auditor`, `unassigned`. Later PRD templates remain explicitly later. Merchandising routes stay `requireAdminTenant` only.

| Permission | shop_owner | shop_admin | platform_auditor | unassigned | webhook HMAC | privacy worker | human replay/export worker |
|---|---|---|---|---|---|---|---|
| `platform.sync_health.read` | allow | allow | allow | deny | deny | n/a | n/a |
| `platform.data_issues.read` | allow | allow | allow | deny | deny | n/a | n/a |
| `platform.audit.read` | allow | allow | allow | deny | deny | n/a | n/a |
| `platform.replay.execute` | allow | allow | deny | deny | deny | deny | serialized revalidation §7.10 |
| `platform.export.operational` | allow | allow | deny | deny | deny | deny | revalidate before **publication/download**, not merely temp write |
| `platform.roles.administer` | allow | deny | deny | deny | deny | deny | deny (admin route only) |
| `platform.privacy.manifest.read` | allow | deny | allow (minimized) | deny | deny | n/a | n/a |
| `platform.privacy.data_request.download` | **deny unless live Shopify `account_owner`** | **deny** | deny | deny | deny | deny | n/a |
| `platform.privacy.escalation.view` | allow minimized | deny | deny | deny | deny | n/a | n/a |
| `platform.privacy.process` | deny | deny | deny | deny | intake after HMAC | execute under verified privacy job | deny |

`platform.privacy.data_request.download` is **not** `platform.export.operational`. App-assigned `shop_owner` / `shop_admin` is insufficient. The downloader must present a current verified online `associated_user.account_owner === true` for the **same shop and generation**. If the app is uninstalled and no owner session can exist, fulfillment uses the **operator channel** (§7.13), not a public bearer URL.

### 7.3 Immutable audit and coordinator evidence — D-PR7-03/08 **CONSTRAINED**

`AuditEvent` remains merchant-domain, RLS, tenant `shopId`. Runtime: `GRANT INSERT, SELECT` only; triggers reject UPDATE/DELETE for every role except `stocky_privacy_erasure` DELETE.

**While `processingEnabled=false`:** ordinary runtime **cannot** INSERT `AuditEvent` (V RLS USING/WITH CHECK includes `stocky_shop_processing_enabled`; INSERT WITH CHECK fails with an **error**; SELECT/DELETE USING **filters to 0 rows** — OFFICIAL Table 292). Do **not** ask runtime to emit merchant audit during erasure.

**CONSTRAINED substitute:** privacy execution writes minimized progress to control-plane `PrivacyRequest` / `PrivacyDeletionManifest` / `PrivacyCoordinatorEvent` (no customer email/phone/tokens/raw headers). After tenant-linked `AuditEvent` rows are deleted through privacy-erasure, they are gone. Do not create a second canonical fact ledger. `JobReplay` / `SyncApplicationReceipt` remain operational ledgers and are erased with the shop (D-PR7-03 **No**).

If a future implementation proposes inserting into merchant `AuditEvent` while disabled, it must list an explicit special policy/grant. This packet does **not** grant that.

Receipt threat model unchanged: `shopDomainHmac` is identifiable/pseudonymous, not anonymous. Q-008 OPEN. Empty synthetic holds ≠ production retention.

### 7.4 Three identities, states, and intake — D-PR7-05 **CONSTRAINED** (F-CLAUDE-PR7CP-01)

Separate:

| Identity | What it is | What it is not |
|---|---|---|
| **Delivery/event evidence** | Authenticated webhook context: verified shop, topic, `webhookId`, optional `eventId`, content digest of raw body, `receivedAt`, `deadlineAt=receivedAt+30d` | Installation generation. Permission to skip later work |
| **Work identity** | App-issued `PrivacyRequest.id`. For shop erasure, an immutable app-owned `ShopInstallGeneration.id` selected by §7.6 classifier | Shopify payload field (there is none). Domain HMAC. Identical JSON body |
| **Completion evidence** | `PrivacyCompletionReceipt` bound to **that** `PrivacyRequest.id` + `generationId` + `targetShopId` digest | Domain-wide skip token |

**Withdrawn:** `privacy:shop_redact:{canonicalDomain}:{hmacOfRawBody}` as the lifetime work-dedup key. **Withdrawn:** “matching completion receipt HMAC ⇒ idempotent COMPLETED for any later shop/redact.”

**PROPOSED tables (control-plane unless noted):**

- `PrivacyDeliveryBinding`: `id`, `canonicalDomain`, `shopifyWebhookId` (unique when non-null), `shopifyEventId` (nullable), `topic`, `payloadDigest`, `privacyRequestId`, `receivedAt`. Purpose: operational replay window. **Not** D-021’s final receipt.
- `PrivacyRequest`: app work id, topic, state, `targetShopId` (immutable text copy), `generationId` (nullable until bound), lookup keys, `receivedAt`, `deadlineAt`, `duplicateCount`.
- `ShopInstallGeneration`: `id`, `canonicalDomain`, `targetShopId` (immutable copy), `shopRowId` nullable FK **ON DELETE SET NULL**, `installedAt`, `uninstalledAt`, `erasedAt`, `fence` (`LIVE` \| `UNINSTALLED` \| `ERASING` \| `FINALIZING` \| `ERASED` \| `SUPERSEDED_EVIDENCED`). Survives Shop delete.
- `PrivacyCoordinatorEvent`: append-only control-plane journal for disabled-shop progress.
- `PrivacyCompletionReceipt`: no Shop FK; columns `privacyRequestId`, `generationId`, `targetShopIdHmac`, `shopDomainHmac`, `manifestDigest`, `completedAt`, `topic`. Identifiable. Distinct from the delivery journal.

**Delivery duplicate rule:** same `shopifyWebhookId` already bound → continue **that** `PrivacyRequest`; increment `duplicateCount`; ack 200. Completion of that request does **not** certify a newer generation.

**Same-event correlation:** same `shopifyEventId` + same topic + compatible digest may attach as a correlated delivery of the existing request. Incompatible topic/body with a reused event id → quarantine/`ESCALATED`, not silent success.

**Missing required delivery id:** quarantine + `ESCALATED`.

**Ack 200** only after durable `PrivacyRequest` row exists (or proven delivery duplicate). Invalid HMAC remains 401. HTTP 200 is not completion.

**Kill switch D-PR7-09 CONSTRAINED:** `FEATURE_PR7_PRIVACY_PAUSE` in **`app/privacy/pause.server.ts`** (not inventory `feature-flags.server.ts`), default OFF via env. When ON: still authenticate, persist request, ack 200, track deadlines, allow diagnostics and operator escalation; **do not** perform destructive DELETE. Does **not** waive the 30-day clock. No production flag is enabled by this planning PR.

**Customer lookup keys (P7-C05):** persist customer id and order REST ids as decimal strings. Hash email/phone for minimization only. Empty result only after complete-scan of required surfaces. Absence of a customer column on `ShopifyOrderFact` is not emptiness.

**Journal retention (CONSTRAINED):** `PrivacyDeliveryBinding` + in-flight coordinator rows exist for the erasure/replay operation. They are **linkable**. After verified completion, prune them in §7.6.3 step 7. They do **not** satisfy D-021’s non-reversible receipt. Any retention beyond the operation is Q-008 and blocks production; tests may use a synthetic TTL (e.g. 30 days) labelled test-only. No legal-hold period is invented here.

### 7.5 Deletion manifest

Unchanged in purpose: checkpoint `(surface, afterId)`, counts, digests of remaining keys, no PII. Lookup keys live on `PrivacyRequest` until prune. Physical DELETE of facts is the privacy module, not C apply.

### 7.6 Shop/redact classifier, fence, sequence, Shop delete

#### 7.6.1 Classifier — D-PR7-05 **CONSTRAINED** (replaces HMAC table)

Evaluate in this order. Binding is an **app** decision from lifecycle evidence, not a Shopify generation field.

| # | Evidence | Result |
|---|---|---|
| 1 | `shopifyWebhookId` already in `PrivacyDeliveryBinding` | Continue that request. Its completion **does not** certify any newer generation |
| 2 | Authenticated new delivery; **exactly one** generation with `fence IN (UNINSTALLED, ERASING, FINALIZING)` and `erasedAt IS NULL`; **no** live successor (`LIVE`/`processingEnabled=true` Shop for that domain) | Bind work to that generation; start/coalesce erasure. An old domain receipt **must not** suppress this |
| 3 | Live newer generation, **or** multiple unresolved historical candidates, **or** insufficient delivery/lifecycle correlation, **or** missing delivery id | `ESCALATED`. Never guessed live-shop DELETE. Never false terminal COMPLETED |
| 4 | Positively correlated retry of a **completed** request (same `shopifyWebhookId` or proven same event+digest **and** recorded `generationId`) while a newer generation exists | Return the **old** request outcome. Newer generation preserved. Merely similar domain/body/timestamps **cannot** establish this |
| 5 | No Shop row | Still run remnants check for the **identified** `targetShopId` (Redis, exports, scratch, coordinator, facts). Missing Shop ≠ absence proof |
| 6 | Reinstall after `fence=ERASED` and completion recorded | New `Shop` + new generation allowed. A `FINALIZING` generation **cannot** be revived by bootstrap |

Withdrawn timestamp rule remains withdrawn. `SUPERSEDED_EVIDENCED` only after operator/owner evidence (§7.12), never clocks.

#### 7.6.2 Generation fence — D-PR7-06 **CONSTRAINED**

A boolean `processingEnabled=false` plus RLS in a **stale** transaction is not quiescence proof (**FACT:** `processUninstall` comment already admits in-flight statements).

**PROPOSED fence:**

1. On uninstall: write/update `ShopInstallGeneration` `fence=UNINSTALLED`, `uninstalledAt`, `targetShopId=Shop.id` (immutable copy).
2. On bound shop/redact: `fence=ERASING`, `processingEnabled=false`, `processingDisabledReason=REDACTED`. Cancel cancellable **non-privacy** jobs (`processUninstall` / `cancelAllCancellable` **FUTURE** skip `jobType` in `PRIVACY_JOB_TYPES`).
3. Before residual verification: `fence=FINALIZING`. Bootstrap/`upsertCanonicalShop` **must not** create or reactivate a Shop for that domain while `FINALIZING` or `ERASING` exists. **FUTURE** hook: `assertNoErasureFence(domain)` in `bootstrap.server.ts` called from `upsertCanonicalShop` and `runAfterAuthTenantBootstrap`. Catalog enqueue skipped.
4. Ordinary intake/dispatcher/fair-claim/`assertShopProcessingEnabled` remain denied.
5. After checked Shop delete + residual empty: `fence=ERASED`, then completion txn.
6. Fresh afterAuth allowed only when no `ERASING`/`FINALIZING` generation exists for the domain and the prior generation is `ERASED` (or none).

#### 7.6.3 Recoverable sequence (no two-connection atomicity)

Never one transaction across `stocky_control_plane` and `stocky_privacy_erasure`.

| Step | Connection | State after commit | Residual if crash |
|---|---|---|---|
| 1 Admit | control-plane | `PrivacyRequest` RECEIVED/AUTHENTICATED; delivery binding; ack 200 only now | Replay delivery id → same request |
| 2 Classify + fence | control-plane | generation bound or `ESCALATED`; `ERASING` if bound | Re-run classifier; do not guess |
| 3 Enqueue privacy job | control-plane | DurableJob `privacy:shop_redact` PENDING even if Shop disabled | `createPrivacyDurableJob` |
| 4 Erase surfaces | privacy-erasure then CP checkpoints | manifest cursor; coordinator events; **keep** request/manifest/generation | Resume cursor |
| 5 Residual verify (Shop still present) | privacy-erasure SELECT + CP | `FINALIZING` only if surfaces empty except named coordinator rows; tenant-linked AuditEvent deleted | If remnants, stay `PARTIAL_FAILED`/`FINALIZING` **not** COMPLETED |
| 6 Checked Shop DELETE | privacy-erasure `SELECT stocky_privacy_finalize_shop_delete(...)` | Shop row gone; generation `shopRowId` null; `targetShopId` remains | Probe by `targetShopId`, not current Shop lookup |
| 7 Residual verify (Shop gone) | CP + privacy SELECT using `targetShopId` | must be empty except coordinator/generation/receipt-not-yet | Resume 6–7 |
| 8 Completion | control-plane **conditional** txn: `UPDATE PrivacyRequest SET state=COMPLETED WHERE id=:id AND state=FINALIZING AND generationId=:g` + INSERT receipt **iff** residual predicate true | COMPLETED + receipt bound to request+generation+target | If remnants observed, **do not** INSERT receipt; stay FINALIZING |
| 9 Prune | control-plane | delete lookup keys, delivery bindings (after operational window), manifest lines | Receipt + generation `ERASED` remain |

A receipt **cannot** override observed remnants. `COMPLETED` is illegal while remnants exist.

#### 7.6.4 Checked Shop deletion — D-PR7-11 **CONSTRAINED** (F-CLAUDE-PR7CP-03)

**FACT (V):** runtime has no Shop DELETE; control-plane has no Shop DELETE.

**CONSTRAINED FUTURE capability** (not present on V):

```text
Function: public.stocky_privacy_finalize_shop_delete(p_request_id text, p_target_shop_id text, p_generation_id text) RETURNS void
Language: plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
Owner: stocky_privacy_finalizer_owner  -- nologin, non-superuser, not migration, not runtime
EXECUTE: GRANT to stocky_privacy_erasure only; REVOKE FROM PUBLIC, stocky_runtime, stocky_control_plane
```

Body (specification, not applied SQL):

1. Reject if `p_request_id` / `p_target_shop_id` / `p_generation_id` are not `text` scalars (no dynamic SQL, no table-name parameters).
2. Read `PrivacyRequest` and `ShopInstallGeneration` by those ids; require `state=FINALIZING`, `fence=FINALIZING`, `targetShopId` equality on both, `erasedAt IS NULL`.
3. Reject if a **different** Shop row exists for the generation’s `canonicalDomain` with `processingEnabled=true` (live successor).
4. Reject if `Shop.id` is distinct from `p_target_shop_id`.
5. Reject if `Shop.processingEnabled` is not false or reason is not `REDACTED`.
6. `DELETE FROM public."Shop" WHERE id = p_target_shop_id AND "processingEnabled" = false AND "processingDisabledReason" = 'REDACTED'`; require exactly one row deleted.
7. `UPDATE ShopInstallGeneration SET shopRowId=NULL WHERE id=p_generation_id`.

Grants to `stocky_privacy_finalizer_owner`: `SELECT, DELETE` on `Shop` **only** (not merchant facts). Function owner is **not** used as a login. Runtime and control-plane receive **no** bare `DELETE ON Shop`.

**FK map (PROPOSED):**

| Child | onDelete vs Shop |
|---|---|
| Merchant facts / operational ledgers | Restrict; ordered privacy DELETE first |
| Control-plane jobs/deliveries | Restrict; ordered CP DELETE except in-flight privacy job/request/generation |
| `ShopInstallGeneration.shopRowId` | **SET NULL**; `targetShopId` text remains |
| `PrivacyRequest.targetShopId` | **no FK** (text copy) so request survives Shop delete |
| `PrivacyCompletionReceipt` | **no Shop FK** |
| `Session` | no shopId; delete by domain string before Shop delete |

Alternative designs must provide the same narrow checked deletion property and be listed as a remaining decision — not silently substituted.

### 7.7 Schema, grants, RLS — D-PR7-13 **CONSTRAINED** (F-CLAUDE-PR7CP-02)

Additive future migration name illustrative: `20260918100000_pr7_audit_roles_privacy_foundation`.

**New roles (all NOINHERIT, no BYPASSRLS, not a member of each other or of `stocky_runtime` / `stocky_migration`):**

| Role | Login | Purpose |
|---|---|---|
| `stocky_privacy_erasure` | worker credential only | SELECT/DELETE merchant facts+audit under privacy policies; EXECUTE privacy helpers |
| `stocky_privacy_finalizer_owner` | **no** | Owns Shop-delete function |
| `stocky_privacy_target_owner` | **no** | Owns `stocky_privacy_target_allows(text)` |
| `stocky_assignment_lock_owner` | **no** | Owns `stocky_lock_platform_assignment(...)` |
| `stocky_privacy_operator` | CLI/control credential only | EXECUTE operator resolve function; **not** merchandising HTTP |

**Tenant GUC additions (transaction-local, `is_local=true`):**

- Existing: `stocky.current_shop_id`, `stocky.tenant_context_version` (`phase1-db-tenant-context-v1`), `stocky.correlation_id`
- New: `stocky.privacy_request_id`

Application sets privacy GUCs only after control-plane validated the request (**D-017**). An arbitrary GUC or `privacy:*` string is not authority.

**Helper `stocky_privacy_target_allows(p_shop_id text) RETURNS boolean`**

- SECURITY DEFINER, `SET search_path = pg_catalog, pg_temp`
- Owner `stocky_privacy_target_owner`
- Reads `PrivacyRequest` + `ShopInstallGeneration` (GRANT SELECT on those two tables to the owner only)
- True iff `current_setting('stocky.privacy_request_id', true)` equals an existing request in `ENUMERATING|APPLYING|CHECKPOINTING|FINALIZING` whose `targetShopId = p_shop_id` and generation fence is `ERASING|FINALIZING`
- EXECUTE: `stocky_privacy_erasure` only; REVOKE PUBLIC
- Missing/mismatched/expired setting → false

**Merchant-table policies (FORCE RLS remains):**

| Policy | TO | Command | USING / WITH CHECK | Notes |
|---|---|---|---|---|
| existing `*_select/insert/update/delete` | `stocky_runtime` | as today | tenant + version + `stocky_shop_processing_enabled` | **KEEP**. Do not add processing exception |
| `*_privacy_select` | `stocky_privacy_erasure` | SELECT | tenant + version + `stocky_privacy_target_allows("shopId")` | no processingEnabled |
| `*_privacy_delete` | `stocky_privacy_erasure` | DELETE | USING same as privacy SELECT | **no WITH CHECK** (DELETE cannot have one) |

No privacy INSERT/UPDATE policies on fact tables (privacy cannot mutate facts). No privacy policy `TO PUBLIC` or `TO stocky_runtime`. Combined evaluation: runtime never sees privacy policies; privacy never sees runtime policies; **no OR leakage**. Membership tests must prove `stocky_runtime` is not a member of `stocky_privacy_erasure` and vice versa.

**Expected row-versus-error (OFFICIAL + this design):**

| Actor | Shop disabled | SELECT facts | DELETE facts | INSERT AuditEvent |
|---|---|---|---|---|
| `stocky_runtime` | yes | 0 rows (filter) | 0 rows (filter) | **error** (WITH CHECK) |
| `stocky_privacy_erasure` valid request GUC | yes | target rows | target rows deleted | no INSERT grant → **error** / insufficient privilege |
| `stocky_privacy_erasure` missing/wrong GUC | yes | 0 rows | 0 rows | n/a |
| either | other shop | 0 rows | 0 rows | n/a |

**Privilege matrix (PROPOSED; scanners in `roles.ts` / new `scripts/privacy-enforcement/`):**

| Object | runtime | control-plane | privacy-erasure | finalizer owner | migration |
|---|---|---|---|---|---|
| Merchant facts | existing DML minus shopId mutation | none | SELECT, DELETE | none | DDL |
| `AuditEvent` | INSERT, SELECT; trigger blocks U/D | none | SELECT, DELETE | none | DDL |
| `Shop` | SELECT, INSERT, UPDATE (existing) | lifecycle columns only | **EXECUTE delete function only** | SELECT, DELETE on Shop | DDL |
| `PrivacyRequest` / manifest / generation / delivery binding / coordinator events / receipt | none | INSERT/SELECT/UPDATE allowlisted | SELECT (for allows helper via owner) | SELECT request/generation | DDL |
| `ShopRoleAssignment` | runtime DML minus shopId | **EXECUTE lock helper only** (no broad fact access) | none | none | DDL |
| RLS disable / SET ROLE migration | denied | denied | denied | denied | apply/verify |

Rollback: empty new tables may drop; after audit/privacy rows exist, disable processors / pause switch; do not drop populated tables. Erasure is irreversible.

### 7.8 Frozen interfaces

Unchanged in spirit: wrap `requireAdminTenant`; do not change C apply or B documents; physical DELETE is privacy. Any need to change C apply remains a decision request with a failing use case. None identified.

### 7.9 Exclusive file ownership (FUTURE implementation PR) — F-CLAUDE-PR7CP-07

**Owned:**

```
stocky-plus/app/audit/**
stocky-plus/app/rbac/**
stocky-plus/app/privacy/**          # including pause.server.ts, intake, execute, db-context, operator-resolve
stocky-plus/app/routes/webhooks.compliance.tsx
stocky-plus/app/routes/app.platform.*.tsx
stocky-plus/scripts/privacy/**
stocky-plus/prisma/schema.prisma   # additive models + JobExecutionStrategy.BOUNDED_CHECKPOINT_RETRY
stocky-plus/prisma/migrations/20260918*_pr7_*
stocky-plus/app/tenant/models.ts
stocky-plus/scripts/tenant-enforcement/manifest.ts
stocky-plus/scripts/tenant-enforcement/roles.ts
stocky-plus/scripts/tenant-enforcement/sql.ts   # additive privacy policy SQL generators; do not change runtime predicate
stocky-plus/package.json          # test:privacy script only
stocky-plus/docs/phases/phase-1/PR7_*IMPLEMENTATION*  # later
```

**Narrow shared FUTURE edits (exact symbols):**

| File | Symbol / delta |
|---|---|
| `app/tenant/after-auth.server.ts` | `runAfterAuthTenantBootstrap` — fence check; no settings revival on ERASING/FINALIZING/this-generation REDACTED |
| `app/tenant/bootstrap.server.ts` | `upsertCanonicalShop` — `assertNoErasureFence` before create |
| `app/shopify.server.ts` | skip catalog enqueue on fence; `useOnlineTokens: true` **only after** D-PR7-02 implementation authority (not this PR) |
| `app/sync/uninstall.server.ts` | `processUninstall` / `cancelAllCancellable` — skip `PRIVACY_JOB_TYPES`; write generation `UNINSTALLED` |
| `app/sync/reinstall.server.ts` | keep REDACTED deny; allow new Shop only when fence permits |
| `app/sync/intake.server.ts` | `createDurableJob` — optional `allowWhenProcessingDisabled` **only** when `jobType` ∈ `PRIVACY_JOB_TYPES` and caller is privacy intake; ordinary callers unchanged. Do **not** change `ingestAuthenticatedWebhook` general dedup |
| `app/sync/execution-strategy.server.ts` | `executionStrategyForJobType` — map the three privacy types to `BOUNDED_CHECKPOINT_RETRY`; unknown remains `NO_AUTOMATIC_RETRY` |
| `app/sync/dispatcher.server.ts` | `dispatchPendingJobs` / `enqueueWithDispatch` — privacy jobs skip shop-disabled cancel; do not rewrite ordinary fair-claim SQL |
| `app/sync/fair-claim-query.server.ts` | **add** `buildPrivacyClaimSql` / `claimPendingPrivacyJobs` (new functions). Do **not** change `buildFairClaimSchedulerLockSql` `processingEnabled=true` predicate |
| `app/sync/lifecycle.server.ts` | `completeAttemptRetry` — `BOUNDED_CHECKPOINT_RETRY` retries with backoff until `maxAttempts` then DL/ESCALATED; not `NO_AUTOMATIC_RETRY` |
| `app/sync/replay.server.ts` | hook: call `stocky_lock_platform_assignment` inside the existing txn **before** insert (or wrapper in `app/rbac` that uses CP prisma). Preserve DL/receipt contracts |
| `app/jobs/queue.server.ts` | `removeShopQueueJobsExceptPrivacy`; never FLUSHALL; use `inspectQueueDispatchPresence` |
| `app/jobs/workers/webhook-processor.ts` | `processWebhookJob` / `assertShopProcessingEnabled` — privacy job types call `app/privacy/execute.server.ts` **instead of** `assertShopProcessingEnabled`; still verify envelope + `PrivacyRequest` + generation |
| `app/sync/envelope-v3.server.ts` | allow new jobType strings in envelope validation if the allowlist is closed |
| `.github/workflows/ci.yml` | add `test:privacy` distinct command that fails on zero tests |
| `scripts/sync-control-plane/roles.ts` | no Shop DELETE; EXECUTE assignment-lock helper |

**Forbidden now and later without a decision:** D `app/lib/order-facts/sync/**`, B `admin-read/**`, C `apply/**`, PR43 branch, shared-control live docs in **this** planning PR.

`PRIVACY_JOB_TYPES` (closed):

- `privacy:customers_data_request`
- `privacy:customers_redact`
- `privacy:shop_redact`

Additive Prisma enum value **`BOUNDED_CHECKPOINT_RETRY`**. Silent default to `NO_AUTOMATIC_RETRY` for these names is forbidden. Unknown types remain `NO_AUTOMATIC_RETRY`.

A job type string is **not** sufficient authority. Dispatch and execute must re-read `PrivacyRequest` + generation fence + targetShopId match.

### 7.10 Human replay serialization — D-PR7-12 **CONSTRAINED** (F-CLAUDE-PR7CP-06)

Do **not** call two role-specific connections one atomic transaction. Do **not** treat a best-effort pre-check with an unbounded race as equivalent.

**Protected effect:** authorization + creation of the new `DurableJob`/`JobReplay` and marking the dead letter `REPLAYED` inside `replayDeadLetter`’s **existing control-plane transaction**. Subsequent fact application remains autonomous and does not use the staff grant.

**Assignment lock helper** `stocky_lock_platform_assignment(p_shop_id text, p_actor_id text, p_permission text) RETURNS boolean`

- SECURITY DEFINER, locked search_path, owner `stocky_assignment_lock_owner`
- `SELECT ... FROM "ShopRoleAssignment" WHERE shopId=p_shop_id AND shopifyUserId=p_actor_id AND revokedAt IS NULL FOR UPDATE`
- Returns true iff that row’s role still grants `p_permission`
- Replay is **denied** when Shop `processingEnabled=false` (existing `replay_denied_disabled_shop`) so helper may rely on ordinary processing being on; FORCE RLS + policy TO the owner: tenant match (processingEnabled not required if we only call it when CP already checked enabled — still include shopId match)
- EXECUTE: `stocky_control_plane` and `stocky_runtime` only

**Timeline (documented lock order: assignment row, then DurableJob row):**

| Case | Order | Outcome |
|---|---|---|
| Revoke-before-effect | Runtime txn: `FOR UPDATE` assignment → set `revokedAt` → commit. Later replay: CP txn: helper lock → sees revoked → throw `REPLAY_DENIED` → no job | Denied |
| Effect-before-revoke | CP txn: helper lock (allowed) → insert job/replay/DL → commit. Later revoke commits | Effect **remains**. Retry of **same** command: helper or idempotency key finds existing JobReplay; **reconcile** (return existing ids) without creating a second job and without re-authorizing new work |
| Retry after revoke of a **fresh** click | No existing command id | Denied; no new job |
| Disabled shop | Existing CP check | `replay_denied_disabled_shop` |

Revalidation occurs **after** lock acquisition, not from a cached pre-lock snapshot.

**Exports:** producing a temp blob is not the protected effect. Revalidate immediately before **publication/download**. Revocation prevents later release. Autonomous sync/compliance remain separately authorized. A caller cannot relabel a human command as `actorKind=system`; job types are server-derived from `PRIVACY_JOB_TYPES` vs `replay:*` vs webhook topics.

### 7.11 Privacy dispatch while disabled — D-PR7-10 **CONSTRAINED**

After PR6 merge/closure, privacy uses the existing durable job machinery — **not** a second queue product.

**Path:**

1. `app/routes/webhooks.compliance.tsx` → `authenticate.webhook` → `app/privacy/intake.server.ts` (HMAC already done by library; 401 if invalid).
2. Intake writes binding + request; ack 200.
3. `createPrivacyDurableJob` → `createDurableJob({ allowWhenProcessingDisabled: true, jobType })` on **control-plane**.
4. `claimPendingPrivacyJobs` (new, fair-claim-query + dispatcher) selects PENDING privacy jobs **without** `DispatchReadyShop.processingEnabled=true`, but **with** join to in-flight `PrivacyRequest`.
5. `enqueueWithDispatch` allows enqueue when jobType ∈ PRIVACY_JOB_TYPES even if Shop disabled.
6. BullMQ `stocky-webhooks` via `enqueueWebhook`.
7. `processWebhookJob` branches to `executePrivacyJob` **before** `assertShopProcessingEnabled`.
8. Execute: control-plane load request; set privacy GUCs on privacy-erasure connection; DELETE/checkpoint; never re-enable Shop.

**Redis cleanup (D-PR7-10):** `removeShopQueueJobsExceptPrivacy(shopId, keepJobIds)` using `getWebhookQueue()` + `inspectQueueDispatchPresence`. Remove runnable **and** retained completed/failed jobs whose envelope shopId matches, **except** in-flight privacy job ids. **Never** `FLUSHALL` / obliterate. A worker that can still commit a **non-privacy** job is fenced by processingEnabled RLS (0-row/error) plus cancel; do not claim instantaneous cancel of an already-completed statement (**FACT** uninstall comment).

Pause does not dequeue intake.

H scratch: consume accepted D diagnostics/reclamation; leftovers fail residual. If D is unmerged at implementation start, unit leftover probe only; do not edit D.

### 7.12 Escalation operations — F-CLAUDE-PR7CP-09 **CONSTRAINED**

Two responsibilities:

| Actor | Interface | FUTURE files | Can do | Cannot do |
|---|---|---|---|---|
| Verified Shopify account owner (installed generation) | Authenticated app route | `app/routes/app.platform.privacy.escalation.tsx` | View minimized request; supply lifecycle evidence | Waive a valid erasure; mark complete; guess generation |
| Trusted operational privacy capability | Restricted CLI / CP entry | `scripts/privacy/resolve-escalation.ts`, `app/privacy/operator-resolve.server.ts` | Resolve attribution when uninstalled/disabled; bind proven old target; schedule remnants erase; leave ESCALATED | `--actor` string, domain possession, or app_admin role creating the capability |

**Evidence schema (required, versioned `escalation_evidence_v1`):** `privacyRequestId`, expected `rowVersion`, `targetGenerationId` or explicit `unresolved`, source/delivery ids, residual digest, actor/causation, rationale, decision `bind_old_target` \| `schedule_remnants_erase` \| `leave_escalated`. **No** `retain_live` that waives a valid erasure obligation. **No** generic “mark complete.” Compare-and-set on `rowVersion`. Dry-run/preview mandatory on CLI (`--dry-run` default).

Terminal success still requires verified completion / no remaining applicable target (§7.6.3). Legal hold = Q-008/counsel evidence, not an operator-invented reason.

**Deadline tracking** from authenticated `receivedAt` (not observer-scheduled in this chat):

| Clock | Action | Must not |
|---|---|---|
| Immediate | `PrivacyCoordinatorEvent` `UNRESOLVED` on ESCALATED | extend 30d |
| Every 6 hours while ESCALATED or PARTIAL_FAILED | overdue diagnostic event | extend 30d |
| `receivedAt+20d` and `+27d` | pre-deadline operator alert event | extend 30d |
| `receivedAt+30d` still open | `OVERDUE` incident state; still not COMPLETED | silent drop |

Named operational responsibility: on-call privacy operator via the CLI credential. No ChatGPT/Cursor observer is scheduled by this document.

### 7.13 Customer data_request fulfillment — D-PR7-14 **CONSTRAINED**

Bounded, short-lived **in-app** fulfillment. No new email provider or object-storage service.

- Artifact stored as control-plane bytea/rows with TTL **24h**, keyed by `PrivacyRequest.id`, encrypted at rest with app secret (implementation), **not** a public URL.
- Download route checks live `account_owner`, same shop/generation/request, expiry, and not-revoked owner proof **at download time**.
- Streaming via authenticated loader; no bearer token in the artifact.
- If uninstalled: owner session cannot exist → operator CLI `scripts/privacy/fulfill-data-request.ts` delivers to the merchant through a recorded support procedure (hashed destination, audit). That channel is **not** `platform.export.operational`.
- TTL cleanup job is a privacy job type using the same while-disabled path, or a control-plane only delete of expired artifacts (no merchant DML).

---

## 8. Recommended implementation sequence

Once ChatGPT issues **runtime** authority **and** §10 gates pass (not this PR):

1. Additive migration + roles/helpers/policies + empty-table isolation tests (including 0-row vs error matrix).
2. Actor/`sub` + assignment + lock helper + denial tests.
3. Audit runtime immutability; coordinator events; privacy-erasure DELETE tests while disabled.
4. Compliance intake + three identities + classifier fixtures.
5. Privacy job types/strategy/dispatcher/processor hooks; pause switch.
6. Enumerator + checked Shop delete + crash recovery.
7. afterAuth fence; Redis cleanup; residual probe.
8. Platform routes; owner download; operator CLI.
9. Exact-head full CI; independent Tier-A review with no unresolved P0/P1/P2.

No estimated calendar. No fake completion percentage.

---

## 9. Decision register

Status `constrained` = ChatGPT 2026-09-17 executable-contract assignment (comment 5714629032). These are **not** runtime approvals.

| ID | Question | Constrained direction | Current → replacement (planning) | Merchant / technical / migration / risks | Blocks runtime start? |
|---|---|---|---|---|---|
| **D-PR7-01** | Actor source | Exact verified `sessionToken.sub` string; no recovery from rounded numbers | First online id then stringify number → **sub-only persistence** | Safer identity; requires online/embedded token proof; additive staff table VARCHAR | Yes |
| **D-PR7-02** | Online tokens | FUTURE `useOnlineTokens: true` for human platform; offline for jobs; prove library; no config now | Optional defer → **selected enablement in implementation PR** | Extra 24h token class; logout revoke; must not break webhooks | Yes until implementation proves bind |
| **D-PR7-03** | Receipts as audit? | **No** | unchanged No | — | Yes |
| **D-PR7-04** | First owner | Same-context verified `account_owner`; unsafe correlation → unassigned | First-login withdrawn (already) | Recovery pending until owner session | Yes |
| **D-PR7-05** | redact vs reinstall | Separate delivery/work/generation; old receipts never exempt new work | HMAC work key → **classifier §7.6.1** | Ambiguous cases ESCALATED; 30d clock remains | Yes |
| **D-PR7-06** | afterAuth REDACTED | No revival of ERASING/FINALIZING; fresh install after ERASE | Timestamp/blacklist withdrawn | Bootstrap fence hook required | Yes |
| **D-PR7-07** | Gate merchandising? | **No** in PR7 | unchanged | Avoid 403 during owner_pending | Frozen **No** |
| **D-PR7-08** | Audit vs redact | Runtime append-only; coordinator while disabled; restricted DELETE; Q-008 limits | In-place UPDATE withdrawn | Privacy policies additive | Yes |
| **D-PR7-09** | Pause | Privacy-local default OFF; intake/deadlines continue | Flag home specified | Clock not waived | Frozen home |
| **D-PR7-10** | Redis | Shop/generation scoped remove + writer fencing; no flush | Drain-only insufficient | Shared queue risk if FLUSHALL | Yes |
| **D-PR7-11** | Delete Shop? | Checked finalizer function + FK map + recovery | Unspecified DELETE → **named function** | Irreversible | Yes |
| **D-PR7-12** | Revoke mid-job | Serialized assignment lock on CP txn; no cross-role atomicity | “same UoW” slogan → **lock timeline** | TOCTOU closed by row lock, not 2PC | Yes |
| **D-PR7-13** | DB roles | Separate privacy RLS + coordinator; no runtime exception; assignment helper only | Same-RLS-as-runtime withdrawn | New roles/helpers | Yes |
| **D-PR7-14** | data_request | Distinct owner-only download; operator fallback if uninstalled; not generic export | shop_admin export contradiction withdrawn | Uninstall fulfillment path | Align before runtime |
| **Q-008** | Retention language | OPEN | OPEN | Production blocker | Production |

**Remaining explicit residuals (not hidden as “implementation detail”):**

1. Installed-library proof that `sessionToken.sub` + online `associated_user` populate when `useOnlineTokens: true` (**UNVERIFIED** until implementation tests).
2. Whether every compliance delivery includes `X-Shopify-Event-Id` (**OFFICIAL** general header list vs **UNVERIFIED** on this topic). Missing event id is handled (nullable).
3. Accepted D scratch reclamation API after D merge; infeasible → named follow-up, not skip.
4. Q-008 counsel holds.
5. Additive `JobExecutionStrategy.BOUNDED_CHECKPOINT_RETRY` requires a Prisma enum migration in the **implementation** PR.

---

## 10. Conditions under which a future PR7 implementation may begin

**P7-C06.** This assignment does **not** authorize a V-only alternate base.

1. ChatGPT accepts the **corrected executable-contract** plan + matrix after independent re-review with no unresolved P0/P1/P2.
2. Constrained D-PR7 items remain constrained; residuals in §9 are either accepted as implementation proofs or separately decided.
3. Phase 1 PR6 independently accepted and formally closed on merged `origin/main` (including D). Implementation branches from that main, not from this planning SHA.
4. Exact-head CI on that merged main per `CI_POLICY.md`.
5. Named single writer, exclusive files §7.9, one branch, one chat; **no competing D writer**.
6. Explicit subsequent ChatGPT **runtime** authority sentence.

PR7 implementation is **Tier A**. Docs-only CI is not sufficient for implementation.

---

## 11. PR8 dependency map

Unchanged: PR8 needs privacy-safe residual emptiness, audit diagnostics, enumerator cost, uninstall→redact rehearsal. This packet does not claim Phase 1 complete.

---

## 12. Evidence of this correction run

| Check | Result |
|---|---|
| Starting subject | `f1b0364049e04baec1f1f68b61f0074677161d00` |
| Review FF | `git merge --ff-only 86c1c520e8e7b72742f1061bd261682cf011f758`; parent `f1b0364…`; blob `c1fa5c2fed74bf80d1006267b43d767258895c17` unchanged |
| Base V | `a3ff480f1477237f8055f10c43298480a05728a1` |
| IEEE-754 probe | executed; `Number("9007199254740993")===9007199254740992` |
| `npm run test:privacy` | exit 1 missing script |
| Postgres/Redis RLS live | **BLOCKED** — source-derived policies only |
| Official fetches | §3, **2026-09-18** |
| Store calls | not executed |
| Review artifact edited | **No** |

Environment: Node `v22.14.0`. No disposable PostgreSQL/Redis listening.

---

## 13. Cross-check to the acceptance matrix

| Plan section | Matrix IDs |
|---|---|
| Actor / owner / wide id | PR7-ACT-001…023 |
| Permission / replay locks / export split | PR7-RBAC-001…021, PR7-CUST-006/011/012 |
| Audit / coordinator / privacy RLS | PR7-AUD-001…014, PR7-SIDE-009/010 |
| Classifier / fence / crash | PR7-LIFE-001…024, PR7-RED-001…021 |
| Intake / dispatch / pause / 180-day | PR7-PRIV-001…018, PR7-CUST-013 |
| Escalation | PR7-ESCL-001…004 |
| Finding crosswalk | §1.2 and matrix §11 |

If a matrix row cites a path, that path is listed in §4 or §7.9.
