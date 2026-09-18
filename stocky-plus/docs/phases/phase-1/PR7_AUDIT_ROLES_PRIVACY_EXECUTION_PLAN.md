# Phase 1 PR7 — Audit, roles, and privacy execution plan

**Status:** **PROPOSED — ONE-DEPENDENCY-AHEAD — NOT IMPLEMENTATION AUTHORITY**

**Document type:** execution-ready architecture / acceptance contract for the next approved Phase 1 module.

This packet does **not** authorize PR7 runtime, migrations, grants, Shopify configuration, production, inventory writes, flag enablement, or merge. ChatGPT’s 2026-09-18 topic-authority comment 5729229659 is current planning authority for Decisions A–E. It supersedes conflicting proposed wording from comment 5714629032 **only as stated**. Neither comment accepts the whole plan, closes PR6, or starts implementation.

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

Immutable independent reviews (byte-for-byte; do not edit):

- `stocky-plus/docs/phases/phase-1/PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md` (blob `c1fa5c2fed74bf80d1006267b43d767258895c17`)
- `stocky-plus/docs/phases/phase-1/PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md` (blob `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f`)

---

## 1. Identities

| Field | Value |
|---|---|
| Planning branch (platform) | `cursor/planning-pr7-audit-roles-privacy-20260916-63ef` |
| Authorized planning name | `planning/pr7-audit-roles-privacy-20260916` |
| Executable baseline **V** | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Pinned D candidate **H** | `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` (dated D snapshot; **not** current merged authority; do not chase or wait for PR43) |
| Authorization (planning) | [PR43 comment 5707545217](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5707545217) |
| Authorization (P7-C01…06) | [PR45 comment 5713121021](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5713121021) |
| Authorization (executable contract, superseded only as stated) | [PR45 comment 5714629032](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5714629032) |
| Authorization (topic authority / finalization — **current**) | [PR45 comment 5729229659](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5729229659) (`user=Vedang1998`). Supersedes conflicting parts of 5714629032 **only** as stated in Decisions A–E. D-PR7 identifiers retained; **no D-055** |
| Starting subject **S** | `253ab202dbee53dc842bb1389db4a19c6e3fb058` |
| Prior immutable review | commit `86c1c520e8e7b72742f1061bd261682cf011f758` parent `f1b0364…` blob `c1fa5c2fed74bf80d1006267b43d767258895c17` path `PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md` — **unchanged** |
| New immutable review **R** | branch `claude/pr45-pr7-executable-contract-review-20260918`; commit `64649470475912c3a697585772c0dd336d6daabc`; sole parent **S**; blob `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f`; path `PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md` — **fast-forwarded, byte-for-byte** |
| Review publication PR | [#46](https://github.com/Vedang1998/Stocky/pull/46) already used for the prior review; **do not reopen/reuse as an integration route** |
| Work order | `PR45_PR7_Topic_Authority_and_Finalization_Corrections.md` |
| Decision heading | D-054 **EFFECTIVE** — **no D-055** |
| R-176 | remains **OPEN / P0** |
| R-164 | unchanged (privacy physical DELETE is not C apply) |
| Q-008 | remains **OPEN** |
| Phase 1 / PR6 | **IN PROGRESS** |
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

### 1.3 F-CLAUDE-PR7XC-01…11 dispositions (this correction)

Original `F-CLAUDE-PR7CP-01…10` IDs and meanings are preserved. Independently: **eight** original findings remain substantively addressed; CP-02 row-versus-error is independently exercised (now also by this packet’s G2). That does **not** mean every helper grant or privacy topic worked before this correction.

| ID | Sev | Defect | This packet | Plan anchors | Matrix |
|---|---|---|---|---|---|
| **F-CLAUDE-PR7XC-01** | P0 | One whole-shop fence helper cannot serve customer topics without granting shop-erasure authority | Per-topic capability table; `stocky_privacy_reader` + `stocky_privacy_erasure`; row manifest | §7.7.1–7.7.3 | PR7-TOP-* |
| **F-CLAUDE-PR7XC-02** | P0 | Privacy DurableJob Restrict FK vs Shop delete | Coordinator on `PrivacyRequest`/`PrivacyAttempt` with **no** Shop/DurableJob FK; ordinary Restrict family cleaned child-first | §7.6.4–7.6.5 | PR7-COORD-*, PR7-RED-006 |
| **F-CLAUDE-PR7XC-03** | P1 | Privacy role missing context-helper EXECUTE | Complete catalogue; EXECUTE to every querying/helper role; PUBLIC revoked | §7.7.4 | PR7-GRANT-* |
| **F-CLAUDE-PR7XC-04** | P1 | Finalizer UPDATE generation vs SELECT/DELETE grants | Remove generation UPDATE; rely on `ON DELETE SET NULL` | §7.6.4 | PR7-RED-021, G3 |
| **F-CLAUDE-PR7XC-05** | P1 | `FOR UPDATE` helper needs UPDATE privilege; owner missing | Advisory `stocky_authz_lock` + SELECT-only verifier; READ COMMITTED fresh read | §7.10 | PR7-AUTHZ-* |
| **F-CLAUDE-PR7XC-06** | P1 | No real writer-quiescence primitive | Shared/exclusive lifecycle gate + durable fence; honest Redis/FS LIMIT | §7.6.2–7.6.3 | PR7-GATE-* |
| **F-CLAUDE-PR7XC-07** | P2 | Replay idempotency uses fresh UUID | `PlatformReplayCommand` stable command id | §7.10.1 | PR7-CMD-* |
| **F-CLAUDE-PR7XC-08** | P2 | Pruning delivery journal destroys retry evidence | Finite `PrivacyDeliveryTombstone`; Q-008 OPEN | §7.11 | PR7-TOMB-* |
| **F-CLAUDE-PR7XC-09** | P3 | Prune cross-reference cited step 7 (residual) not prune | Named phase anchors; prune is **P-PRUNE-PAYLOAD** after **P-COMPLETE** | §7.4, §7.6.3 | — |
| **F-CLAUDE-PR7XC-10** | P3 | Documented Shopify field names labelled synthetic | Documented names; fixture **values** synthetic | §3.1 | FXT-COMPLIANCE-* |
| **F-CLAUDE-PR7XC-11** | P3 | Evidence labelled executed-this-session and not rerun | Distinct class `executed-prior-planning-head-not-re-run` | §12 | matrix §10 |

Do **not** reopen first-login ownership, in-place audit minimization, guessed timestamp supersession, or two-connection atomicity as alternatives.


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
- [PostgreSQL 16 SELECT](https://www.postgresql.org/docs/16/sql-select.html) — **2026-09-18** (row-locking clauses, including `FOR NO KEY UPDATE`, require UPDATE privilege)
- [PostgreSQL 16 explicit locking](https://www.postgresql.org/docs/16/explicit-locking.html) — **2026-09-18** (transaction/session advisory locks; cooperative participation)
- [PostgreSQL 16 CREATE FUNCTION](https://www.postgresql.org/docs/16/sql-createfunction.html) — **2026-09-18** (SECURITY DEFINER ownership, search_path, EXECUTE)

Repo webhook pin remains Admin API **`2026-07`**. The privacy-law-compliance TOML **example** still uses `2024-07`; that example is not this repository’s pin.

### 3.1 Mandatory compliance webhooks — OFFICIAL

Public App Store apps must subscribe to `customers/data_request`, `customers/redact`, `shop/redact`. Handle `POST` + `application/json`. Invalid HMAC → **401**. Ack → **200-class**. Complete within **30 days** of receiving the request unless legally required to retain (then do not complete deletion). Shopify’s page is not legal advice.

Payloads (**documented field names** from the compliance page, accessed 2026-09-18; **fixture values** in this packet are synthetic):

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
| `test:privacy` | `package.json` | **missing script** (**executed-prior-planning-head-not-re-run**, exit 1). Implementation gate, not a planning proof of defect |
| `npm test` include | `vitest.config.ts` | `app/**/*.test.ts` except tenant + `app/sync/__tests__` |

Merchant models, PII-adjacent surfaces, H scratch, and sanitizer facts in the previous packet §4.3–4.6 remain accurate and are not repeated here. `Shop.myshopifyDomain` is unique. `ShopProcessingDisabledReason` includes `REDACTED`; nothing on V writes `REDACTED`.

### 4.3 Tests this correction session

| Command | Exit | Class |
|---|---|---|
| IEEE-754 Node probe | 0 | **executed-prior-planning-head-not-re-run** |
| `npm run test:privacy` | 1 missing script | **executed-prior-planning-head-not-re-run** (absence on V) |
| Disposable PG 16.15 G1–G6 | 0 (59/59) | **executed-this-planning-session** (synthetic cluster; not PR7) |
| `test:sync-uninstall` / `test:tenant-access` / `test:db-isolation` / live app RLS | not started | **present-on-V-not-executed** / **BLOCKED** (app Postgres/Redis not the disposable proof cluster) |

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

Labels: **CONSTRAINED** = ChatGPT 2026-09-18 topic-authority assignment (comment 5729229659) plus still-in-force 2026-09-17 constraints that were not replaced. **PROPOSED** = specification inside that constraint. Neither is runtime authority.

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
| `platform.privacy.process` | deny | deny | deny | deny | intake after HMAC | execute under verified `PrivacyRequest`/`PrivacyAttempt` | deny |

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

- `PrivacyDeliveryBinding`: `id`, `canonicalDomain`, `shopifyWebhookId` (unique when non-null), `shopifyEventId` (nullable), `topic`, `payloadDigest`, `privacyRequestId`, `receivedAt`. Operational replay window. **Not** D-021’s final receipt. Payload-pruned at **P-PRUNE-PAYLOAD**.
- `PrivacyDeliveryTombstone`: `shopifyWebhookId` PK, topic, `privacyRequestId`, `generationId`, `resultState`, `expiresAt`. Finite retained correlation after payload prune (§7.11).
- `PrivacyRequest`: app work id, topic, state, `targetShopId` (immutable text copy), `generationId`, lookup keys, `receivedAt`, `deadlineAt`, `duplicateCount`, `activeAttemptId`. **No mandatory Shop FK.**
- `PrivacyAttempt`: id, `privacyRequestId`, epoch unique per request, state, `leaseUntil`. **No Shop / DurableJob / JobAttempt FK.**
- `ShopInstallGeneration`: `id`, `canonicalDomain`, `targetShopId` (immutable copy), `shopRowId` nullable FK **ON DELETE SET NULL**, `installedAt`, `uninstalledAt`, `erasedAt`, `fence` (`LIVE` \| `UNINSTALLED` \| `ERASING` \| `FINALIZING` \| `ERASED` \| `SUPERSEDED_EVIDENCED`). Survives Shop delete.
- `PrivacyCoordinatorEvent`: append-only control-plane journal for disabled-shop progress.
- `PrivacyCompletionReceipt`: no Shop FK; columns `privacyRequestId`, `generationId`, `targetShopIdHmac`, `shopDomainHmac`, `manifestDigest`, `completedAt`, `topic`. Identifiable. Distinct from the delivery journal.

**Delivery duplicate rule:** same `shopifyWebhookId` already bound → continue **that** `PrivacyRequest`; increment `duplicateCount`; ack 200. Completion of that request does **not** certify a newer generation.

**Same-event correlation:** same `shopifyEventId` + same topic + compatible digest may attach as a correlated delivery of the existing request. Incompatible topic/body with a reused event id → quarantine/`ESCALATED`, not silent success.

**Missing required delivery id:** quarantine + `ESCALATED`.

**Ack 200** only after durable `PrivacyRequest` row exists (or proven delivery duplicate). Invalid HMAC remains 401. HTTP 200 is not completion.

**Kill switch D-PR7-09 CONSTRAINED:** `FEATURE_PR7_PRIVACY_PAUSE` in **`app/privacy/pause.server.ts`** (not inventory `feature-flags.server.ts`), default OFF via env. When ON: still authenticate, persist request, ack 200, track deadlines, allow diagnostics and operator escalation; **do not** perform destructive DELETE. Does **not** waive the 30-day clock. No production flag is enabled by this planning PR.

**Customer lookup keys (P7-C05):** persist customer id and order REST ids as decimal strings. Hash email/phone for minimization only. Empty result only after complete-scan of required surfaces. Absence of a customer column on `ShopifyOrderFact` is not emptiness.

**Journal retention (CONSTRAINED):** `PrivacyDeliveryBinding` (operational payload/digest) exists for the erasure/replay operation and is **linkable**. After verified **P-COMPLETE**, **P-PRUNE-PAYLOAD** removes raw lookup/payload/manifest data. `PrivacyDeliveryTombstone` is **retained** for a finite configured window so retries can still be recognized (§7.11). Tombstones are **not** D-021’s non-reversible receipt and are **not** anonymous. Any production retention period is Q-008 and **blocks production** until counsel/product confirmation. Test TTLs are explicitly synthetic, not a legal period. No legal-hold period is invented here.

### 7.5 Deletion manifest

Unchanged in purpose: checkpoint `(surface, afterId)`, counts, digests of remaining keys, no PII. Lookup keys live on `PrivacyRequest` until prune. Physical DELETE of facts is the privacy module, not C apply.

### 7.6 Shop/redact classifier, fence, sequence, Shop delete

#### 7.6.1 Classifier — D-PR7-05 **CONSTRAINED** (replaces HMAC table)

Evaluate in this order. Binding is an **app** decision from lifecycle evidence, not a Shopify generation field.

| # | Evidence | Result |
|---|---|---|
| 1 | `shopifyWebhookId` already in `PrivacyDeliveryBinding` **or** unexpired `PrivacyDeliveryTombstone` | Continue that request / return recorded tombstone outcome. Completion **does not** certify any newer generation. Expired/missing tombstone → uncorrelated (classifier continues); **not** a reconstructed old bind |
| 2 | Authenticated new delivery; **exactly one** generation with `fence IN (UNINSTALLED, ERASING, FINALIZING)` and `erasedAt IS NULL`; **no** live successor (`LIVE`/`processingEnabled=true` Shop for that domain) | Bind work to that generation; start/coalesce erasure. An old domain receipt **must not** suppress this |
| 3 | Live newer generation, **or** multiple unresolved historical candidates, **or** insufficient delivery/lifecycle correlation, **or** missing delivery id | `ESCALATED`. Never guessed live-shop DELETE. Never false terminal COMPLETED |
| 4 | Positively correlated retry of a **completed** request (same `shopifyWebhookId` or proven same event+digest **and** recorded `generationId`) while a newer generation exists | Return the **old** request outcome. Newer generation preserved. Merely similar domain/body/timestamps **cannot** establish this |
| 5 | No Shop row | Still run remnants check for the **identified** `targetShopId` (Redis, exports, scratch, coordinator, facts). Missing Shop ≠ absence proof |
| 6 | Reinstall after `fence=ERASED` and completion recorded | New `Shop` + new generation allowed. A `FINALIZING` generation **cannot** be revived by bootstrap |

Withdrawn timestamp rule remains withdrawn. `SUPERSEDED_EVIDENCED` only after operator/owner evidence (§7.12), never clocks.

#### 7.6.2 Generation write barrier and lifecycle gate — D-PR7-06 **CONSTRAINED** (F-CLAUDE-PR7XC-06)

A boolean `processingEnabled=false` plus RLS in a **stale** transaction is not quiescence proof (**FACT:** `processUninstall` comment already admits in-flight statements). Separate unconnected locks at two completion steps are also not quiescence.

**CONSTRAINED primitive:** one versioned lifecycle gate keyed by verified canonical shop domain, valid when `Shop` is absent.

| Piece | Specification |
|---|---|
| Key | `hashtext('pr7-life-v1:' \|\| canonical_domain)` with lock namespace `1347573553` (`PR71`) |
| Shared | `pg_advisory_xact_lock_shared` via `stocky_lifecycle_shared_lock(domain)` |
| Exclusive | `pg_advisory_xact_lock` via `stocky_lifecycle_exclusive_lock(domain)` |
| Hold | Transaction-scoped. **Never** commit, reacquire later, and call the gap atomic. **No** connection waits for a lock held by a sibling connection in the same orchestration |
| Durable fence | `ShopInstallGeneration.fence` (`LIVE` \| `UNINSTALLED` \| `ERASING` \| `FINALIZING` \| `ERASED` \| `SUPERSEDED_EVIDENCED`) survives the privacy-erasure and coordinator connections |
| Check | After shared lock: `stocky_generation_writable(domain)` reads the current generation for that domain. `ERASING`/`FINALIZING` → `generation_frozen` |
| Owner | nologin `stocky_lifecycle_gate_owner`; `SELECT` on `ShopInstallGeneration` only |

**Writer protocol (participating paths):**

1. Acquire **shared** gate for the verified domain.
2. Re-read generation fence under that gate.
3. Reject the old generation if `ERASING`/`FINALIZING`.
4. Hold the shared lock through commit of the participating write.

**Erasure admission:**

1. Acquire **exclusive** gate (drains earlier participating shared holders).
2. Set `fence=ERASING` (then later `FINALIZING`) on the bound generation.
3. Commit. Later shared acquirers re-check and reject.

**Topic scope:** this whole-shop barrier is **only** for `shop/redact`. Customer topics must not freeze the shop. Any customer-specific concurrency is request-scoped (manifest + capability), not the domain exclusive gate.

**Epoch:** exactly one `PrivacyRequest.activeAttemptId`. Attempts are unique on `(privacyRequestId, epoch)`. Lost lease → mark `LOST`, insert a new epoch, bind `activeAttemptId`. Capability and residual evidence are bound to the **active** epoch. A missing `Shop` is neither automatic success nor automatic fatal error: re-verify immutable `targetShopId`, residuals, and coordinator phase. Root deletion that already committed is recognized as `already_absent` without losing pending completion.

**Honest non-coverage (LIMIT):** PostgreSQL advisory locks and RLS do **not** fence Redis jobs, export publication, or D scratch bytes. Those require generation-fenced publication or positive per-target worker/I/O drain. A TTL, cancelled job label, stale PID, or sampled empty directory is **not** quiescence. Inability to prove reclamation keeps the request incomplete/visible (D’s ultimately accepted recovery boundary). No blanket deletion or cluster-wide kill. A toy database transcription is not an implemented Redis/filesystem fence.

**Uninstrumented writers:** control-plane tables have **no** RLS on V. A raw CP `INSERT` without the gate still succeeds (**executed** G5). Legacy processes running before the guard is deployed must be **stopped/drained** before privacy execution is enabled. A rollout with uninstrumented active writers is not safe admission. Named FUTURE wrappers (not this PR): `TenantDb` transaction-host participating-write guard; CP write helpers for DurableJob/intake/bootstrap; `assertNoErasureFence` in `bootstrap.server.ts` / `after-auth.server.ts`. Do not claim accepted B/C internals automatically honor this gate.

**OFFICIAL:** PostgreSQL 16 explicit locking — transaction advisory locks are cooperative; unmodified writers do not participate. https://www.postgresql.org/docs/16/explicit-locking.html (accessed 2026-09-18).

#### 7.6.3 Recoverable sequence — named phase anchors (F-CLAUDE-PR7XC-09)

Never one transaction across `stocky_control_plane` and `stocky_privacy_erasure`. Never one transaction-scoped lock held across those connections.

| Phase | Connection | State after commit | Residual if crash |
|---|---|---|---|
| **P-ADMIT** | coordinator/control-plane | `PrivacyRequest` RECEIVED/AUTHENTICATED; delivery binding; ack 200 only now | Replay delivery id → same request |
| **P-CLASSIFY** | coordinator | generation bound or `ESCALATED`; customer topics do **not** set whole-shop `ERASING` | Re-run classifier; do not guess; do not promote customer work to shop erasure |
| **P-FREEZE** (`shop/redact` only) | coordinator under **exclusive** gate | `fence=ERASING`; ordinary participating writes drain then reject | Re-acquire exclusive; do not claim freeze from a prior committed lock |
| **P-CLAIM** | coordinator (same worker process, **not** `DurableJob`) | `PrivacyAttempt` leased; heartbeat; checkpoints | Poll recovers a lost Redis hint; new epoch if lease lost |
| **P-ENUMERATE** | privacy definer `stocky_privacy_enumerate_targets` | `PrivacyTargetKey` published for this request only; `enumerationComplete` / `missingLinkages` | Incomplete stays incomplete; zero RLS-visible rows ≠ absence |
| **P-ERASE** | privacy-erasure then coordinator checkpoints | manifest cursor; coordinator events; **keep** request/attempt/generation | Resume cursor |
| **P-PRE-ROOT-RESIDUAL** | privacy-erasure SELECT + coordinator | `fence=FINALIZING` only if surfaces empty except named coordinator rows | Remnants → `PARTIAL_FAILED`/`FINALIZING` **not** COMPLETED |
| **P-ROOT-DELETE** (`shop/redact`) | privacy-erasure `SELECT stocky_privacy_finalize_shop_delete(...)` | Shop row gone **or** `already_absent`; generation `shopRowId` SET NULL by FK; `targetShopId` remains | Probe by `targetShopId`, not current Shop lookup |
| **P-POST-ROOT-RESIDUAL** | coordinator + privacy SELECT using `targetShopId` | empty except coordinator/generation/receipt-not-yet | Resume P-ROOT-DELETE / this phase |
| **P-COMPLETE** | coordinator **conditional** txn under still-valid frozen epoch: `UPDATE PrivacyRequest SET state=COMPLETED WHERE id=:id AND state=FINALIZING AND generationId=:g AND activeAttemptId=:epoch` + INSERT receipt **iff** residual predicate true | COMPLETED + receipt bound to request+generation+target | If remnants, **do not** INSERT receipt |
| **P-PRUNE-PAYLOAD** | coordinator | delete lookup keys, raw payload/manifest lines; **retain** `PrivacyDeliveryTombstone` until `expiresAt` | Receipt + generation `ERASED` + tombstone remain |

A receipt **cannot** override observed remnants. `COMPLETED` is illegal while remnants exist. **P-PRUNE-PAYLOAD** is **after** **P-COMPLETE**. Refer to these **phase names**, not only numbers. Nothing can repopulate the target between residual and completion because: exclusive freeze is still in force; participating writers re-check and reject; uninstrumented writers are a **rollout drain prerequisite**, not a claimed lock.

**Shop erasure superseding customer work (CONSTRAINED):** if a bound `shop/redact` freeze starts while `customers/*` work is in flight on that generation, customer DELETE is denied (`fence` no longer `LIVE`/`UNINSTALLED`); the customer request is coalesced to `SUPERSEDED_BY_SHOP_ERASURE` (not fabricated COMPLETED download, not early customer success). Shop erasure proceeds on the whole generation.

#### 7.6.4 Checked Shop deletion — D-PR7-11 **CONSTRAINED** (F-CLAUDE-PR7CP-03, F-CLAUDE-PR7XC-04)

**FACT (V):** runtime has no Shop DELETE; control-plane has no Shop DELETE.

**CONSTRAINED FUTURE capability** (not applied on V):

```text
Function: public.stocky_privacy_finalize_shop_delete(
  p_request_id text, p_target_shop_id text, p_generation_id text, p_attempt_id text
) RETURNS text
Language: plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
Owner: stocky_privacy_finalizer_owner  -- nologin, non-superuser, not migration, not runtime
EXECUTE: GRANT to stocky_privacy_erasure only; REVOKE FROM PUBLIC, stocky_runtime, stocky_control_plane
Returns: 'deleted' | 'already_absent'
```

Body (specification; disposable proof transcribed in Appendix A):

1. Reject if arguments are not `text` scalars (no dynamic SQL, no table-name parameters, no caller-selected raw SQL).
2. Read `PrivacyRequest` and `ShopInstallGeneration` by those ids; require `state=FINALIZING`, `fence=FINALIZING`, `targetShopId` equality on both.
3. Reject `finalizer_stale_attempt` if `activeAttemptId` ≠ `p_attempt_id`.
4. Reject `finalizer_live_successor` if a **different** Shop row exists for the generation’s `canonicalDomain` with `processingEnabled=true`.
5. `DELETE FROM public."Shop" WHERE id = p_target_shop_id AND "processingEnabled" = false AND "processingDisabledReason" = 'REDACTED'`.
6. If exactly one row deleted → `'deleted'`. If zero rows **and** the Shop id is absent → `'already_absent'` (committed root delete recognized). Else `finalizer_shop_not_eligible`.
7. **Do not** `UPDATE ShopInstallGeneration SET shopRowId=NULL`. Rely on the declared `ON DELETE SET NULL`. The owner has **SELECT, DELETE on Shop** and **SELECT** on request/generation/attempt — **no** table-wide UPDATE.

**FK / coordinator graph (PROPOSED; full Restrict family, not the first FK that failed):**

| Child | onDelete vs Shop | Erasure order |
|---|---|---|
| Merchant facts / operational ledgers (`ShopifyOrderFact`, lines, `AuditEvent`, …) | Restrict | Privacy DELETE first (topic policies) |
| `DurableJob`, `JobAttempt`, `DeadLetter`, `JobReplay` | Restrict | Child-first CP DELETE **after drain**; these are **not** the privacy coordinator |
| `WebhookDelivery`, `SyncApplicationReceipt`, dispatch tables | Restrict | CP DELETE after drain |
| `Session` | no `shopId`; domain string | Delete by domain **before** Shop delete |
| `ShopInstallGeneration.shopRowId` | **SET NULL**; `targetShopId` text remains | Survives |
| `PrivacyRequest.targetShopId` | **no FK** (immutable text) | Survives; optional `shopRowId` SET NULL |
| `PrivacyAttempt` | FK to `PrivacyRequest` only — **not** to Shop or `JobAttempt` | Survives Shop deletion |
| `PrivacyCoordinatorEvent`, `PrivacyCompletionReceipt`, `PrivacyDeliveryTombstone` | **no Shop FK** | Survive |
| `PlatformReplayCommand` | shopId text (CP); erased with shop jobs if present | Ordinary replay evidence, not coordinator |

Ordinary Shop-linked jobs may be erased in child-first order after drain **because they no longer contain the executing privacy coordinator**. Do **not** weaken `DurableJob.shopId` nullability, Restrict FKs, uniqueness, ordinary job authority, or PR4/PR6 receipt contracts.

**Executed:** Restrict `DurableJob` blocks root delete (`23503`); after child cleanup, finalizer returns `deleted`; generation `shopRowId` is null without a generation UPDATE grant; request/attempt survive; retry returns `already_absent`; stale attempt denied; capability retry after Shop gone still uses immutable target (**G3**).

### 7.6.5 Privacy coordinator independent of Shop / DurableJob — D-PR7-10 **CONSTRAINED** (F-CLAUDE-PR7XC-02)

**Withdrawn:** “every privacy operation must be represented by a tenant-linked `DurableJob`”; `createPrivacyDurableJob` / ordinary fair-claim / `JobExecutionStrategy.BOUNDED_CHECKPOINT_RETRY` / `processWebhookJob` as the required privacy execution path.

**CONSTRAINED replacement:** `PrivacyRequest` is the durable source of truth. PR7-owned `PrivacyAttempt` / checkpoints have **no mandatory FK** to `Shop` or ordinary `DurableJob`. Immutable `targetShopId` + `generationId` survive deletion. Optional `shopRowId` uses `ON DELETE SET NULL`.

**Runtime shape (FUTURE implementation; not this PR):**

- Reuse the existing worker deployment/process and PostgreSQL.
- Bounded privacy-coordinator poll/claim loop: atomic claim of `PrivacyAttempt`, fencing/attempt identity, heartbeat, bounded retry/backoff, checkpoints, visible escalation.
- **No** second queue service or framework.
- Redis wake-up hint is **optional**, not durable authority, not a Shop-linked job. Periodic polling recovers a lost hint.
- Ordinary disabled-shop gates and unknown-job fail-closed behavior remain intact.

**Named ownership / routing (replaces the DurableJob privacy table):**

| Work | Durable authority | Claim / execute | Disabled-shop ordinary path |
|---|---|---|---|
| Webhook topics, sync, catalog | `DurableJob` + V dispatcher | existing fair-claim `processingEnabled=true` | unchanged deny |
| Human replay / export | `DurableJob` + `PlatformReplayCommand` | CP txn + §7.10 lock | existing `replay_denied_disabled_shop` |
| `customers/data_request` | `PrivacyRequest` + `PrivacyAttempt` | coordinator poll/claim; `stocky_privacy_reader` for reads | must run **without** re-enabling |
| `customers/redact` | same | coordinator; `stocky_privacy_erasure` DELETE_CUSTOMER | no whole-shop fence |
| `shop/redact` | same | coordinator; erasure + exclusive gate + finalizer | ERASING/FINALIZING protocol |

**Narrow FUTURE shared integrations (named, not done here):** bootstrap fence; ordinary-job cancellation on uninstall (skip nothing privacy-coordinator-shaped because it is not a DurableJob); scoped queue cleanup of **ordinary** Redis jobs; worker startup to run the coordinator loop beside existing workers; `TenantDb` participating-write wrapper. No such runtime edits in this PR. Do not reopen/reuse PR46 as an integration route.

Unknown ordinary `jobType` remains `NO_AUTOMATIC_RETRY` / denied. A leftover `privacy:*` DurableJob string, if ever enqueued by mistake, is **not** authority and must fail closed.

### 7.7 Schema, grants, RLS — D-PR7-13 **CONSTRAINED** (F-CLAUDE-PR7CP-02, F-CLAUDE-PR7XC-01/03/05)

Additive future migration name illustrative: `20260918100000_pr7_audit_roles_privacy_foundation`.

#### 7.7.1 Per-topic authority — Decision A (F-CLAUDE-PR7XC-01)

Replace the one whole-shop fence predicate (`stocky_privacy_target_allows` requiring `ERASING|FINALIZING`) with explicit per-topic operation and row authority. **Chosen:** separate read-only privacy data principal plus topic-aware, row-scoped policies. **Rejected:** application-WHERE-only customer isolation.

| Topic | Read capability | Destructive capability | Lifecycle effect | Eligible generation fences |
|---|---|---|---|---|
| `customers/data_request` | Only the request-authorized customer’s applicable stored data | **None** on tenant data; read principal has no tenant DELETE/UPDATE/INSERT grant and no erase-helper EXECUTE | Live shop remains LIVE/enabled. Disabled-shop fulfillment must **not** require re-enabling | `LIVE`, `UNINSTALLED`, `ERASING`, `FINALIZING` (read-only even during shop erasure) |
| `customers/redact` | Only request-relevant rows and permitted verification data | Only matching customer/order/surface targets proven by the authenticated request and declared linkage | **No** whole-shop erasure fence; **no** disabling all merchant work | `LIVE`, `UNINSTALLED`. Concurrent shop `ERASING`/`FINALIZING` **denies** customer DELETE (supersession) |
| `shop/redact` | Target generation’s applicable surfaces | Whole target generation under a validated shop-erasure request and its erasure barrier | Requires whole-shop ERASING/FINALIZING protocol | `ERASING`, `FINALIZING` |
| unknown | none | none | fail closed | none |

Table grants alone are insufficient. Request topic, immutable target, permitted operation, valid attempt/capability, and row scope must agree.

**Principals:**

| Role | Login | Purpose |
|---|---|---|
| `stocky_privacy_reader` | worker credential | SELECT merchant facts/audit under **READ** policies only. **No** DELETE/UPDATE/INSERT on tenant facts. **No** EXECUTE on finalize |
| `stocky_privacy_erasure` | worker credential | SELECT + DELETE under topic policies; EXECUTE enumerate/capability/finalize. **No** `stocky_shop_processing_enabled` |
| `stocky_privacy_finalizer_owner` | **no** | Owns Shop-delete function |
| `stocky_privacy_target_owner` | **no** | Owns enumerator + `row_in_manifest` |
| `stocky_privacy_capability_owner` | **no** | Owns `stocky_privacy_capability_allows` |
| `stocky_assignment_verifier_owner` | **no** | Owns SELECT-only assignment verifier |
| `stocky_lifecycle_gate_owner` | **no** | Owns lifecycle lock/writable helpers |
| `stocky_privacy_operator` | CLI credential | operator resolve; **not** merchandising HTTP; **no** capability EXECUTE on facts |

All NOINHERIT, no BYPASSRLS, not members of each other or of `stocky_runtime` / `stocky_migration`. A nologin role still needs its required table/function privileges (**executed**).

**Tenant GUC additions (transaction-local, `is_local=true`):**

- Existing: `stocky.current_shop_id`, `stocky.tenant_context_version` (`phase1-db-tenant-context-v1`), `stocky.correlation_id`
- New: `stocky.privacy_request_id`, `stocky.privacy_attempt_id`

Application sets privacy GUCs only after the coordinator validated the request (**D-017**). An arbitrary GUC is not authority. Data-request credentials fail even when pointed at an otherwise valid erasure request (**executed** `42501` on reader DELETE). Missing/expired attempt → capability false. Malformed/unknown topic → fail closed.

#### 7.7.2 Target key manifest / enumerator (PROPOSED PR7 construct)

`PrivacyTargetKey (requestId, shopId, surface, rowId)` unique on `(requestId, surface, rowId)`.

**Publisher:** `stocky_privacy_enumerate_targets(p_request_id)` SECURITY DEFINER, owner `stocky_privacy_target_owner`, locked `search_path`. Caller cannot enlarge scope by submitting arbitrary row IDs. The enumerator reads **static** request lookup keys (`lookupCustomerRestId`, `lookupOrderLegacyIds`) already authenticated onto `PrivacyRequest` — not a caller-supplied row-id list.

**Static surface-specific reads (this packet’s representative set; implementation inventory refreshes against closed PR6):**

| Topic | Root selection | Children | Audit |
|---|---|---|---|
| customer topics | `ShopifyOrderFact` where `shopId=target` **and** `shopifyLegacyResourceId` ∈ request `lookupOrderLegacyIds` | `ShopifyOrderLineFact` via existing `shopifyOrderGid = shopifyGid` (no new customer FK on order facts) | `AuditEvent` where `customerRestId = lookupCustomerRestId` when present |
| `shop/redact` | all facts/lines/audit for `targetShopId` | same | tenant audit |

Where canonical order facts have no customer column, use validated order IDs and existing relationships. **Do not** add unnecessary customer PII or invent a customer FK in A.

Safe enumeration: definer deletes prior keys for **this** request, inserts proven keys, sets `enumerationComplete=(missing=0)` and `missingLinkages`. Missing linkage stays incomplete. Zero RLS-visible consumer rows **never** prove successful absence (**executed** G1 `invisible_is_not_absence`, `missing_linkage_is_incomplete_not_absence`).

**Privilege boundary:** FORCE RLS on `PrivacyTargetKey`. Only `stocky_privacy_target_owner` may INSERT/DELETE (policy: `requestId` = GUC). Control-plane **SELECT** only. Erasure/reader have **no** table INSERT (**executed** `42501`). Consumers see rows through `stocky_privacy_row_in_manifest`, not by selecting the key table.

#### 7.7.3 Capability helper and merchant policies

`stocky_privacy_capability_allows(p_op, p_shop_id) RETURNS boolean` SECURITY DEFINER, owner `stocky_privacy_capability_owner`, locked search_path. Reads `PrivacyRequest` + `PrivacyAttempt` + `ShopInstallGeneration` (GRANT SELECT to owner). True only when request GUC, attempt GUC, active attempt, lease, target, state, topic×op×fence all agree. `p_op ∈ {READ, DELETE_CUSTOMER, DELETE_SHOP}`.

**Merchant-table policies (FORCE RLS remains). Ordinary runtime policies unchanged:**

| Policy | TO | Command | USING | Notes |
|---|---|---|---|---|
| existing `*_select/insert/update/delete` | `stocky_runtime` | as today | tenant + version + `stocky_shop_processing_enabled` | **KEEP** |
| `*_privacy_read` | `stocky_privacy_reader`, `stocky_privacy_erasure` | SELECT | tenant + version + `capability_allows('READ')` + `row_in_manifest` | no processingEnabled |
| `*_privacy_delete_customer` | `stocky_privacy_erasure` | DELETE | tenant + version + `capability_allows('DELETE_CUSTOMER')` + `row_in_manifest` | **no WITH CHECK** |
| `*_privacy_delete_shop` | `stocky_privacy_erasure` | DELETE | tenant + version + `capability_allows('DELETE_SHOP')` | generation-scoped; still tenant GUC |

No privacy INSERT/UPDATE policies on fact tables. No privacy policy `TO PUBLIC` or `TO stocky_runtime`. Do **not** grant `stocky_shop_processing_enabled` to privacy policies or principals to repair a denied call. Combined evaluation: runtime never sees privacy policies; privacy never sees runtime policies; **no OR leakage**.

A deliberately broad `DELETE FROM "ShopifyOrderFact"` **without** an application `WHERE` cannot remove another customer’s row (**executed** G1: `of_a2` survived). Data-request topic cannot delete even as erasure role (**executed** remaining count 1).

**Expected row-versus-error (OFFICIAL Table 292 + this design; G1/G2 executed):**

| Actor | Shop disabled | SELECT facts | DELETE facts | INSERT AuditEvent |
|---|---|---|---|---|
| `stocky_runtime` | yes | 0 rows (filter) | 0 rows (filter) | **error** (WITH CHECK) |
| `stocky_privacy_reader` valid data_request | yes or no | target rows | **42501** (no DELETE grant) | **42501** |
| `stocky_privacy_erasure` data_request GUC | yes or no | target rows | 0 rows (capability false) | **42501** / no INSERT |
| `stocky_privacy_erasure` customers/redact | processing may stay on | target rows | target rows only | no INSERT grant |
| `stocky_privacy_erasure` shop/redact | REDACTED / ERASING | generation rows | generation rows | no INSERT grant |
| either | other shop / wrong GUC / expired attempt | 0 rows | 0 rows | n/a |

Audit remains immutable in normal use. Customer redaction may erase only audit rows in the request manifest; shop redaction covers tenant audit. Coordinator progress uses control records, not ordinary runtime audit INSERT while disabled.

#### 7.7.4 Complete dependency catalogue (F-CLAUDE-PR7XC-03…05)

PUBLIC EXECUTE revoked on every helper. FORCE RLS on. No BYPASSRLS. No membership path into privacy/migration roles.

| Function | Owner | search_path | Privileges the body uses | EXECUTE granted to | Allowed call sites |
|---|---|---|---|---|---|
| `stocky_current_tenant_id()` | table/bootstrap owner (V: current SQL owner) | `pg_catalog, pg_temp` | `current_setting` | runtime, CP, privacy_reader, privacy_erasure, all nologin helper owners listed | policies + app `set_config` sessions |
| `stocky_current_tenant_context_version()` | same | same | `current_setting` | same set | same |
| `stocky_shop_processing_enabled(text)` | same | same | `SELECT Shop.processingEnabled` | **`stocky_runtime` only** | runtime policies only |
| `stocky_privacy_capability_allows(text,text)` | `stocky_privacy_capability_owner` | locked | `SELECT PrivacyRequest, PrivacyAttempt, ShopInstallGeneration` | reader, erasure | policies; probes |
| `stocky_privacy_row_in_manifest(text,text)` | `stocky_privacy_target_owner` | locked | `SELECT PrivacyTargetKey`; calls `stocky_current_tenant_id` | reader, erasure | policies |
| `stocky_privacy_enumerate_targets(text)` | `stocky_privacy_target_owner` | locked | SELECT facts/lines/audit; INSERT/DELETE `PrivacyTargetKey`; UPDATE `PrivacyRequest` enumeration columns; sequence `PrivacyTargetKey_id_seq` | reader, erasure, CP | coordinator enumerate only |
| `stocky_privacy_finalize_shop_delete(...)` | `stocky_privacy_finalizer_owner` | locked | `SELECT` request/generation/attempt/Shop; `DELETE Shop` | erasure only | P-ROOT-DELETE |
| `stocky_lifecycle_*` / `stocky_generation_writable` | `stocky_lifecycle_gate_owner` | locked | `SELECT ShopInstallGeneration`; advisory locks | shared: runtime, CP, reader, erasure; exclusive: CP, erasure | participating writers; freeze |
| `stocky_participating_write_guard(text)` | invoker | locked | EXECUTE shared lock + writable | runtime, CP | FUTURE transaction-host wrappers |
| `stocky_authz_lock(text,text)` / `_pair` | invoker | locked | advisory lock ns `1347573554` | runtime, CP | grant/revoke/bootstrap/replay |
| `stocky_verify_platform_assignment(text,text,text)` | `stocky_assignment_verifier_owner` | locked | **SELECT only** `ShopRoleAssignment` (FORCE RLS policy TO owner) | runtime, CP | after lock, same txn |

Context-helper EXECUTE is granted to **each querying/helper role that calls those helpers**, including nologin owners. Removing load-bearing EXECUTE fails the probe (**executed** G2 `42501`). Dropping the read policy hides rows (**executed**). Operator has no capability EXECUTE (**executed**). Runtime is not a member of erasure (**executed**).

**OFFICIAL:** PostgreSQL 16 RLS — policies execute as the querying role; functions used in policies require that role’s EXECUTE. FORCE RLS applies to table owners unless BYPASSRLS. https://www.postgresql.org/docs/16/ddl-rowsecurity.html (accessed 2026-09-18). CREATE FUNCTION — SECURITY DEFINER ownership, search_path, EXECUTE protection. https://www.postgresql.org/docs/16/sql-createfunction.html (accessed 2026-09-18).

### 7.8 Frozen interfaces

Unchanged in spirit: wrap `requireAdminTenant`; do not change C apply or B documents; physical DELETE is privacy. Any need to change C apply remains a decision request with a failing use case. None identified.

### 7.9 Exclusive file ownership (FUTURE implementation PR)

**Owned:**

```
stocky-plus/app/audit/**
stocky-plus/app/rbac/**
stocky-plus/app/privacy/**          # pause, intake, coordinator, execute, db-context, operator-resolve
stocky-plus/app/routes/webhooks.compliance.tsx
stocky-plus/app/routes/app.platform.*.tsx
stocky-plus/scripts/privacy/**
stocky-plus/prisma/schema.prisma   # additive models; do NOT add privacy as DurableJob strategy
stocky-plus/prisma/migrations/20260918*_pr7_*
stocky-plus/app/tenant/models.ts
stocky-plus/scripts/tenant-enforcement/manifest.ts
stocky-plus/scripts/tenant-enforcement/roles.ts
stocky-plus/scripts/tenant-enforcement/sql.ts   # additive privacy policy SQL; do not change runtime predicate
stocky-plus/package.json          # test:privacy script only
stocky-plus/docs/phases/phase-1/PR7_*IMPLEMENTATION*  # later
```

**Narrow shared FUTURE edits (exact symbols) — named honestly; not this PR:**

| File | Symbol / delta |
|---|---|
| `app/tenant/after-auth.server.ts` | `runAfterAuthTenantBootstrap` — fence check + participating-write guard; no settings revival on ERASING/FINALIZING/this-generation REDACTED |
| `app/tenant/bootstrap.server.ts` | `upsertCanonicalShop` — `assertNoErasureFence` / shared gate before create |
| `app/tenant/db-context.server.ts` / `tenant-db.server.ts` | optional wrapper: participating-write guard on fact writers |
| `app/shopify.server.ts` | skip catalog enqueue on fence; `useOnlineTokens: true` **only after** D-PR7-02 implementation authority (not this PR) |
| `app/sync/uninstall.server.ts` | `processUninstall` / `cancelAllCancellable` — write generation `UNINSTALLED`; cancel ordinary jobs; **no** privacy DurableJob skip list required |
| `app/sync/reinstall.server.ts` | keep REDACTED deny; allow new Shop only when fence permits |
| `app/sync/intake.server.ts` | **unchanged** ordinary `createDurableJob`; privacy does **not** gain `allowWhenProcessingDisabled` |
| `app/sync/execution-strategy.server.ts` | unknown remains `NO_AUTOMATIC_RETRY`; **no** privacy mapping to `BOUNDED_CHECKPOINT_RETRY` |
| `app/sync/dispatcher.server.ts` / `fair-claim-query.server.ts` | **do not** add privacy claim SQL; keep `processingEnabled=true` |
| `app/sync/replay.server.ts` | `stocky_authz_lock` then `stocky_verify_platform_assignment` then `PlatformReplayCommand` upsert in the **existing** CP txn; preserve DL/receipt contracts |
| `app/jobs/queue.server.ts` | generation-fenced / shop-scoped remove of **ordinary** jobs; never FLUSHALL |
| `app/jobs/workers/webhook-processor.ts` | ordinary path **keeps** `assertShopProcessingEnabled`; privacy coordinator is a **separate** loop started from worker bootstrap |
| `app/sync/envelope-v3.server.ts` | do not treat `privacy:*` strings as authority |
| `.github/workflows/ci.yml` | add `test:privacy` distinct command that fails on zero tests |
| `scripts/sync-control-plane/roles.ts` | no Shop DELETE; EXECUTE verifier (SELECT-only) |

**Forbidden now and later without a decision:** D `app/lib/order-facts/sync/**`, B `admin-read/**`, C `apply/**`, PR43 branch, shared-control live docs in **this** planning PR.

`BOUNDED_CHECKPOINT_RETRY` remains available as an additive enum for **ordinary** jobs if a later decision needs it. It is **not** the privacy coordinator strategy. Historical matrix rows PR7-PRIV-015…018 that named the DurableJob privacy path retain their original meaning and are **withdrawn as the required path** by Decision B; replacement rows are PR7-COORD-*.

### 7.10 Human replay serialization — D-PR7-12 **CONSTRAINED** (F-CLAUDE-PR7CP-06, F-CLAUDE-PR7XC-05/07)

Do **not** call two role-specific connections one atomic transaction.

**Withdrawn:** `stocky_lock_platform_assignment` … `SELECT … FOR UPDATE`. **Withdrawn:** substituting `FOR NO KEY UPDATE` to evade UPDATE privilege.

**OFFICIAL:** PostgreSQL 16 `SELECT` — row-locking clauses, including `FOR NO KEY UPDATE`, require **UPDATE** privilege. https://www.postgresql.org/docs/16/sql-select.html (accessed 2026-09-18).

**CONSTRAINED replacement:** transaction-scoped advisory authorization lock keyed by versioned `(shopId, exactActorId)` encoding `hashtext('pr7-authz-v1:' \|\| shopId \|\| ':' \|\| actorId)`, namespace `1347573554`, then a **fresh** authorization read.

| Piece | Rule |
|---|---|
| Isolation | Declare **READ COMMITTED** for this path (PostgreSQL default). A cached pre-wait verdict is not sufficient |
| Verifier | `stocky_verify_platform_assignment` SECURITY DEFINER; owner has **SELECT + RLS policy**, **not** UPDATE on assignment data |
| Same txn | Lock + fresh verify + protected effect (`PlatformReplayCommand` + `DurableJob`/`JobReplay` + DL `REPLAYED`) on the **existing** CP `replayDeadLetter` transaction |
| Pair ordering | `stocky_authz_lock_pair` locks `min(actor), max(actor)` when an administrator and target actor both participate |
| Writers that must take the lock | grant, revoke, assignment bootstrap, assignment delete/recreate, human replay enqueue. **Named.** Locks never substitute for tenant or actor authentication |
| Cooperative | Unmodified writers do not participate. Protect bypasses through checked entrypoints/database guards. Tests: revoke winning and enqueue winning (**executed** G4) |
| Missing assignment | verifier returns false (**executed**) |
| Disabled shop | existing `replay_denied_disabled_shop` |

Historical matrix rows PR7-RBAC-015/019 that describe `FOR UPDATE` retain that original meaning and are **withdrawn as the required helper**. Replacement: PR7-AUTHZ-*.

#### 7.10.1 Stable human replay command (F-CLAUDE-PR7XC-07)

Add the missing stable command contract to the proposed shared replay delta.

| Field | Rule |
|---|---|
| `commandId` | Application-issued; bound to verified shop, exact actor, target dead-letter/original-job, canonical request digest. **Not** authority |
| Retry | Authenticated retry **reuses** the same command id. A new click has a new command |
| Record | `PlatformReplayCommand` PRIMARY KEY `(shopId, commandId)`; written **atomically** in the existing replay-enqueue CP transaction; maps to committed `JobReplay` / new-job ids |
| Tracing | Preserve existing random correlation IDs as tracing values; **do not** rely on them for idempotency (**FACT V:** `replayDeadLetter` currently mints a fresh UUID key) |
| Grants | CP INSERT/SELECT/UPDATE; deleted with shop-scoped CP cleanup |
| New-effect vs reconcile | Authorization of a **new** effect vs returning a **committed** result are different branches |

Same command / same authenticated actor / same digest returns the minimal recorded outcome even if permissions were later revoked; it creates **no** new work and does not grant new data access (**executed** G4). Same command with another actor/shop/target/digest is denied or unique-key conflicts (**executed**). A different command against an already replayed dead letter is not falsely described as this command’s success. Loss of the HTTP response after commit is the reconcile branch (**executed**).

### 7.11 Delivery tombstone and finite replay evidence — D-PR7-05/10 **CONSTRAINED** (F-CLAUDE-PR7XC-08)

Keep minimal purpose-limited delivery/event-to-request/generation/result correlation **separate** from raw lookup/payload/manifest data.

| Store | Contents | Lifetime |
|---|---|---|
| `PrivacyDeliveryBinding` (operational) | webhook id, optional event id, payload digest, request id, receivedAt | Payload prune at **P-PRUNE-PAYLOAD** |
| `PrivacyDeliveryTombstone` | `shopifyWebhookId` PK, topic, `privacyRequestId`, `generationId`, `resultState`, `expiresAt` | Finite retained window. **Test TTL is synthetic** (fixture: 7 days remaining / already expired). **Not** a legal period |
| `PrivacyCompletionReceipt` | D-021 identifiable receipt | Counsel/Q-008; not this packet’s invention |

Payload prune must **not** destroy the evidence needed to recognize retries within the declared replay-evidence window. Preserve **no** raw customer payload just for deduplication. The tombstone is linkable/pseudonymous, **not** anonymous or non-reversible merely because identifiers are hashed.

**Do not** claim permanent retention. **Do not** silently close Q-008. Production block pending counsel/product confirmation remains. Within the retained window, post-payload-prune duplicate delivery returns the recorded outcome without spurious escalation (**executed** G6). After the tombstone expires or is missing, classify the delivery as **uncorrelated** under the safe lifecycle policy; do not reconstruct a nonexistent old binding or promise infinite-horizon exact deduplication. A new generation’s legitimate request **cannot** inherit an older completion (**executed** G6).

Privacy-versus-replay tradeoff: longer tombstone retention improves exact dedup and reduces false `ESCALATED`; shorter retention reduces linkable operational residue. Diagnostics must distinguish normal duplicate, expired evidence, ambiguous target, and genuinely new work. Late uncertain cases must not erase a live successor or be certified by domain/body equality.

**Redis / export / D scratch:** still require generation-fenced publication or positive per-target drain before asserting zero residuals (D’s accepted recovery boundary). Coordinator poll recovers a lost Redis hint.

Pause switch D-PR7-09 unchanged: `FEATURE_PR7_PRIVACY_PAUSE` in `app/privacy/pause.server.ts`, default OFF. When ON: authenticate, persist request, ack 200, track deadlines; **do not** perform destructive DELETE. Does not waive the 30-day clock.

H scratch: consume accepted D diagnostics/reclamation; leftovers fail residual. If D is unmerged at implementation start, unit leftover probe only; do not edit D. Ultimate PR7 implementation must refresh its integration inventory against independently accepted and formally closed PR6 on main. Do not modify or wait for PR43.


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
5. Privacy coordinator poll/claim loop + pause switch (not DurableJob fair-claim).
6. Enumerator + topic policies + checked Shop delete + crash recovery.
7. afterAuth fence; Redis cleanup; residual probe.
8. Platform routes; owner download; operator CLI.
9. Exact-head full CI; independent Tier-A review with no unresolved P0/P1/P2.

No estimated calendar. No fake completion percentage.

---

## 9. Decision register

Status `constrained` = ChatGPT assignment. Comment 5729229659 is current for Decisions A–E; 5714629032 remains for unreplaced items. These are **not** runtime approvals.

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
| **D-PR7-10** | Redis / coordinator | Privacy coordinator is **not** a Shop-linked DurableJob. Redis hint optional; poll recovers. Ordinary Redis remove remains shop/generation scoped; no flush. Cross-system bytes need separate drain proof | Privacy-through-DurableJob withdrawn (Decision B) | Shared queue risk if FLUSHALL; unproven I/O ≠ COMPLETED | Yes |
| **D-PR7-11** | Delete Shop? | Checked finalizer function + FK map + recovery | Unspecified DELETE → **named function** | Irreversible | Yes |
| **D-PR7-12** | Revoke mid-job | Advisory `stocky_authz_lock` + SELECT-only verifier on CP txn; stable `commandId`; no cross-role atomicity | `FOR UPDATE` helper withdrawn (Decision C / XC-05/07) | Cooperative locks; named writers only | Yes |
| **D-PR7-13** | DB roles | Per-topic reader/erasure policies + complete grant catalogue; no processingEnabled on privacy; no runtime exception | Whole-shop-only helper withdrawn (Decision A / XC-01/03) | New roles/helpers/EXECUTE | Yes |
| **D-PR7-14** | data_request | Distinct owner-only download; operator fallback if uninstalled; not generic export | shop_admin export contradiction withdrawn | Uninstall fulfillment path | Align before runtime |
| **Q-008** | Retention language | OPEN | OPEN | Production blocker | Production |

**Remaining explicit residuals (not hidden as “implementation detail”):**

1. Installed-library proof that `sessionToken.sub` + online `associated_user` populate when `useOnlineTokens: true` (**UNVERIFIED** until implementation tests).
2. Whether every compliance delivery includes `X-Shopify-Event-Id` (**OFFICIAL** general header list vs **UNVERIFIED** on this topic). Missing event id is handled (nullable).
3. Accepted D scratch reclamation API after D merge; infeasible → named follow-up, not skip.
4. Q-008 counsel holds.
5. `BOUNDED_CHECKPOINT_RETRY` is **not** required for privacy (Decision B). If used later for ordinary jobs, it needs a Prisma enum migration in an implementation PR — not this packet.
6. Installed-library `sessionToken.sub` / online `associated_user` bind proof remains an **implementation acceptance gate**. Missing `node_modules` in a planning environment is neither a pass nor proof of a defect.
7. Redis/export/D-scratch fences are **not** proven by the disposable PostgreSQL model (G5 LIMIT).

---

## 10. Conditions under which a future PR7 implementation may begin

**P7-C06.** This assignment does **not** authorize a V-only alternate base.

1. ChatGPT accepts the **topic-authority / finalization correction** plan + matrix after independent Claude Code re-review of this head with no unresolved P0/P1/P2.
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
| Starting subject **S** | `253ab202dbee53dc842bb1389db4a19c6e3fb058` |
| New review **R** FF | already at `64649470475912c3a697585772c0dd336d6daabc`; sole parent S; one-file delta; blob `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` |
| Prior review blob | `c1fa5c2fed74bf80d1006267b43d767258895c17` unchanged |
| Base **V** | `a3ff480f1477237f8055f10c43298480a05728a1` |
| IEEE-754 probe | **executed-prior-planning-head-not-re-run**; `Number("9007199254740993")===9007199254740992` (Node `v22.14.0`) |
| `npm run test:privacy` | **executed-prior-planning-head-not-re-run** (exit 1, missing script on V). Missing script is an implementation gate, not a planning defect |
| Disposable PostgreSQL 16.15 proofs | **executed-this-planning-session** — 59/59 PASS after clean fixture (§14). Host `/tmp/pr45-pg16:5433`. Not PR7 runtime |
| Redis / filesystem / Shopify | **not executed** — G5 records CP uninstrumented-write LIMIT; I/O fences remain unexecuted |
| Official fetches | §3 URLs, **2026-09-18** |
| Store calls | not executed |
| Review artifacts edited | **No** |

Failed proof attempts (not hidden): first driver run 29 pass / 15 fail (parser treated `COMMIT`/`set_config` as data; reader `SELECT PrivacyTargetKey` without grant). Contract repair: enumerator publisher-only grants + FORCE RLS on `PrivacyTargetKey` (caller cannot insert arbitrary keys). Second driver run 57/59: `-q` hid `DELETE 0`; shop B still disabled from G2. Driver-only fixes; **clean rerun 59/59**. No hidden GRANT in the passing contract.

Environment: Node `v22.14.0`, Python `3.12.3`, PostgreSQL `16.15` (disposable `initdb` / `pg_ctl`, port 5433, roles as named principals). System cluster was not used. Teardown: `dropdb pr45_proof`; `pg_ctl stop` is **not** required to leave the disposable cluster for inspection.

---

## 13. Cross-check to the acceptance matrix

| Plan section | Matrix IDs |
|---|---|
| Actor / owner / wide id | PR7-ACT-001…023 |
| Permission / replay locks / export split | PR7-RBAC-001…021, PR7-CUST-006/011/012 |
| Audit / coordinator / privacy RLS | PR7-AUD-001…014, PR7-SIDE-009/010 |
| Classifier / fence / crash | PR7-LIFE-001…024, PR7-RED-001…021 |
| Intake / pause / 180-day | PR7-PRIV-001…014, PR7-CUST-013 |
| Coordinator (Decision B) | PR7-COORD-* (PR7-PRIV-015…018 original DurableJob path **withdrawn as required**, meaning preserved) |
| Topic authority / grants | PR7-TOP-*, PR7-GRANT-* |
| Authz lock / command | PR7-AUTHZ-*, PR7-CMD-* |
| Lifecycle gate / tombstone | PR7-GATE-*, PR7-TOMB-* |
| Escalation | PR7-ESCL-001…004 |
| Finding crosswalk | §1.2, §1.3 and matrix §11–§12 |

If a matrix row cites a path, that path is listed in §4 or §7.9.

---

## 14. Disposable feasibility proof (not repository runtime)

**CONSTRAINED** scripts below are extracted from this contract. They were executed in a disposable PostgreSQL 16 cluster. They are **not** PR7 migrations and must not be applied to the application database.

| File | SHA-256 | Role |
|---|---|---|
| `01_contract.sql` | `b29ef463c26a9a3ad745fc7a56bc40901ced1c55429a59c441d89634858db054` | Proposed DDL/roles/policies/helpers |
| `02_seed.sql` | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` | Synthetic two-shop / two-customer fixture (`pr45owner` BYPASSRLS **load only**) |
| `03_run_proofs.py` | `6900553779c3d2e8237fc189fcad42a1810262d3110ab60f30ab32208667ebb4` | Concurrency/permission driver; assertions run as named restricted principals |
| `results.json` | `ecc9acd1d59cda2d9d5910b46e9ffa1766c4e29c3671ceda270dea98d80303b8` | 59/59 PASS |

Commands (disposable):

```bash
initdb -D /tmp/pr45-pg16
pg_ctl -D /tmp/pr45-pg16 -o "-p 5433 -k /tmp/pr45-pg16" start
createuser -h /tmp/pr45-pg16 -p 5433 pr45owner
createdb  -h /tmp/pr45-pg16 -p 5433 -U pr45owner pr45_proof
psql -h /tmp/pr45-pg16 -p 5433 -U pr45owner -d pr45_proof -v ON_ERROR_STOP=1 -f 01_contract.sql
psql -h /tmp/pr45-pg16 -p 5433 -U pr45owner -d pr45_proof -v ON_ERROR_STOP=1 -f 02_seed.sql
python3 03_run_proofs.py   # dropdb/createdb + both files + six groups
dropdb -h /tmp/pr45-pg16 -p 5433 -U pr45owner --if-exists pr45_proof
```

Permission assertions used `stocky_runtime`, `stocky_control_plane`, `stocky_privacy_reader`, `stocky_privacy_erasure`, `stocky_privacy_operator`. Setup used isolated `pr45owner`. No hidden GRANT, policy drop, or role switch is omitted from Appendix A.

**Unexecuted limits:** Redis job drain, export publication, D scratch reclamation, live Shopify, installed `node_modules` `authenticate.admin` bind, PR7 processors.

### Appendix A — `01_contract.sql`

```sql
-- PR45 / PR7 disposable PostgreSQL 16 feasibility contract
-- Transcribed from the proposed final planning contract.
-- Isolated owner: pr45owner (setup only). Permission probes use named roles.
-- search_path locked on every SECURITY DEFINER function.
-- NO hidden GRANT. PUBLIC EXECUTE revoked. No BYPASSRLS. FORCE RLS on merchant tables.

BEGIN;

-- ---------------------------------------------------------------------------
-- Roles (NOINHERIT, no BYPASSRLS, not members of each other)
-- ---------------------------------------------------------------------------
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'stocky_runtime',
    'stocky_control_plane',
    'stocky_privacy_reader',
    'stocky_privacy_erasure',
    'stocky_privacy_operator',
    'stocky_privacy_finalizer_owner',
    'stocky_privacy_target_owner',
    'stocky_privacy_capability_owner',
    'stocky_assignment_verifier_owner',
    'stocky_lifecycle_gate_owner'
  ]
  LOOP
    EXECUTE format('DROP ROLE IF EXISTS %I', r);
    IF r IN (
      'stocky_runtime','stocky_control_plane','stocky_privacy_reader',
      'stocky_privacy_erasure','stocky_privacy_operator'
    ) THEN
      EXECUTE format('CREATE ROLE %I LOGIN NOINHERIT NOBYPASSRLS', r);
    ELSE
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOBYPASSRLS', r);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- V-faithful helpers (names from scripts/tenant-enforcement/manifest.ts + sql.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_current_tenant_id()
RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT NULLIF(current_setting('stocky.current_shop_id', true), ''); $$;

CREATE OR REPLACE FUNCTION public.stocky_current_tenant_context_version()
RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT NULLIF(current_setting('stocky.tenant_context_version', true), ''); $$;

REVOKE ALL ON FUNCTION public.stocky_current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_current_tenant_context_version() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_id() TO stocky_runtime;
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_context_version() TO stocky_runtime;

-- Privacy principals get tenant + version helpers, NOT processing_enabled.
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_id() TO stocky_privacy_reader, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_privacy_capability_owner, stocky_assignment_verifier_owner, stocky_lifecycle_gate_owner, stocky_privacy_finalizer_owner, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_context_version() TO stocky_privacy_reader, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_privacy_capability_owner, stocky_assignment_verifier_owner, stocky_lifecycle_gate_owner, stocky_privacy_finalizer_owner, stocky_control_plane;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public."Shop" (
  id text PRIMARY KEY,
  "myshopifyDomain" text UNIQUE NOT NULL,
  "processingEnabled" boolean NOT NULL DEFAULT true,
  "processingDisabledReason" text
);

CREATE OR REPLACE FUNCTION public.stocky_shop_processing_enabled(p_shop_id text)
RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT s."processingEnabled" FROM public."Shop" s WHERE s.id = p_shop_id),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.stocky_shop_processing_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_shop_processing_enabled(text) TO stocky_runtime;

CREATE TABLE public."ShopifyOrderFact" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT,
  "shopifyGid" text NOT NULL,
  "shopifyLegacyResourceId" text NOT NULL
);

CREATE TABLE public."ShopifyOrderLineFact" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT,
  "shopifyOrderGid" text NOT NULL
);

CREATE TABLE public."AuditEvent" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT,
  "customerRestId" text,
  decision text NOT NULL DEFAULT 'recorded'
);

CREATE TABLE public."DurableJob" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT,
  "jobType" text NOT NULL,
  state text NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE public."JobAttempt" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT,
  "durableJobId" text NOT NULL REFERENCES public."DurableJob"(id) ON DELETE RESTRICT
);

CREATE TABLE public."DeadLetter" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT,
  "durableJobId" text NOT NULL REFERENCES public."DurableJob"(id) ON DELETE RESTRICT,
  "resolutionState" text NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE public."JobReplay" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT,
  "originalJobId" text NOT NULL REFERENCES public."DurableJob"(id) ON DELETE RESTRICT,
  "newJobId" text NOT NULL REFERENCES public."DurableJob"(id) ON DELETE RESTRICT
);

CREATE TABLE public."WebhookDelivery" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT
);

CREATE TABLE public."SyncApplicationReceipt" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT
);

CREATE TABLE public."DispatchReadyShop" (
  "shopId" text PRIMARY KEY REFERENCES public."Shop"(id) ON DELETE RESTRICT
);

CREATE TABLE public."Session" (
  id text PRIMARY KEY,
  shop text NOT NULL,
  "accessToken" text NOT NULL
);

CREATE TABLE public."ShopRoleAssignment" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL,
  "shopifyUserId" text NOT NULL,
  role text NOT NULL,
  "revokedAt" timestamptz
);

CREATE TABLE public."ShopInstallGeneration" (
  id text PRIMARY KEY,
  "canonicalDomain" text NOT NULL,
  "targetShopId" text NOT NULL,
  "shopRowId" text REFERENCES public."Shop"(id) ON DELETE SET NULL,
  fence text NOT NULL,
  "erasedAt" timestamptz,
  "rowVersion" int NOT NULL DEFAULT 1
);

CREATE TABLE public."PrivacyRequest" (
  id text PRIMARY KEY,
  topic text NOT NULL,
  state text NOT NULL,
  "targetShopId" text NOT NULL,
  "generationId" text NOT NULL,
  "shopRowId" text REFERENCES public."Shop"(id) ON DELETE SET NULL,
  "lookupCustomerRestId" text,
  "lookupOrderLegacyIds" text[] NOT NULL DEFAULT '{}',
  "enumerationComplete" boolean NOT NULL DEFAULT false,
  "missingLinkages" int NOT NULL DEFAULT 0,
  "activeAttemptId" text,
  "rowVersion" int NOT NULL DEFAULT 1,
  "receivedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public."PrivacyAttempt" (
  id text PRIMARY KEY,
  "privacyRequestId" text NOT NULL REFERENCES public."PrivacyRequest"(id),
  epoch int NOT NULL,
  state text NOT NULL,
  "leaseUntil" timestamptz,
  worker text,
  UNIQUE ("privacyRequestId", epoch)
);

CREATE TABLE public."PrivacyTargetKey" (
  id bigserial PRIMARY KEY,
  "requestId" text NOT NULL REFERENCES public."PrivacyRequest"(id),
  "shopId" text NOT NULL,
  surface text NOT NULL,
  "rowId" text NOT NULL,
  UNIQUE ("requestId", surface, "rowId")
);

CREATE TABLE public."PrivacyCoordinatorEvent" (
  id bigserial PRIMARY KEY,
  "privacyRequestId" text NOT NULL,
  kind text NOT NULL,
  detail text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public."PrivacyCompletionReceipt" (
  id text PRIMARY KEY,
  "privacyRequestId" text NOT NULL UNIQUE,
  "generationId" text NOT NULL,
  "targetShopIdHmac" text NOT NULL,
  "completedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public."PrivacyDeliveryTombstone" (
  "shopifyWebhookId" text PRIMARY KEY,
  topic text NOT NULL,
  "privacyRequestId" text NOT NULL,
  "generationId" text NOT NULL,
  "resultState" text NOT NULL,
  "expiresAt" timestamptz NOT NULL
);

CREATE TABLE public."PlatformReplayCommand" (
  "commandId" text NOT NULL,
  "shopId" text NOT NULL,
  "actorId" text NOT NULL,
  "deadLetterId" text NOT NULL,
  "originalJobId" text NOT NULL,
  "requestDigest" text NOT NULL,
  "newJobId" text,
  "replayId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("shopId", "commandId")
);

-- ---------------------------------------------------------------------------
-- FORCE RLS on merchant tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ShopifyOrderFact','ShopifyOrderLineFact','AuditEvent']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END$$;

ALTER TABLE public."ShopRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ShopRoleAssignment" FORCE ROW LEVEL SECURITY;

-- Runtime KEEP processingEnabled predicate (V rlsPoliciesSql).
CREATE POLICY order_runtime_select ON public."ShopifyOrderFact" FOR SELECT TO stocky_runtime
  USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));
CREATE POLICY order_runtime_insert ON public."ShopifyOrderFact" FOR INSERT TO stocky_runtime
  WITH CHECK ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));
CREATE POLICY order_runtime_update ON public."ShopifyOrderFact" FOR UPDATE TO stocky_runtime
  USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"))
  WITH CHECK ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));
CREATE POLICY order_runtime_delete ON public."ShopifyOrderFact" FOR DELETE TO stocky_runtime
  USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));

CREATE POLICY line_runtime_select ON public."ShopifyOrderLineFact" FOR SELECT TO stocky_runtime
  USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));
CREATE POLICY line_runtime_insert ON public."ShopifyOrderLineFact" FOR INSERT TO stocky_runtime
  WITH CHECK ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));
CREATE POLICY line_runtime_delete ON public."ShopifyOrderLineFact" FOR DELETE TO stocky_runtime
  USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));

CREATE POLICY audit_runtime_select ON public."AuditEvent" FOR SELECT TO stocky_runtime
  USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));
CREATE POLICY audit_runtime_insert ON public."AuditEvent" FOR INSERT TO stocky_runtime
  WITH CHECK ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));
CREATE POLICY audit_runtime_delete ON public."AuditEvent" FOR DELETE TO stocky_runtime
  USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_shop_processing_enabled("shopId"));

-- ---------------------------------------------------------------------------
-- Capability + row-manifest helpers (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_privacy_capability_allows(p_op text, p_shop_id text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_req text := NULLIF(current_setting('stocky.privacy_request_id', true), '');
  v_att text := NULLIF(current_setting('stocky.privacy_attempt_id', true), '');
  r public."PrivacyRequest"%ROWTYPE;
  a public."PrivacyAttempt"%ROWTYPE;
  g public."ShopInstallGeneration"%ROWTYPE;
BEGIN
  IF v_req IS NULL OR v_att IS NULL OR p_shop_id IS NULL OR p_op IS NULL THEN
    RETURN false;
  END IF;
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = v_req;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO a FROM public."PrivacyAttempt" WHERE id = v_att;
  IF NOT FOUND THEN RETURN false; END IF;
  IF a."privacyRequestId" IS DISTINCT FROM r.id THEN RETURN false; END IF;
  IF r."activeAttemptId" IS DISTINCT FROM a.id THEN RETURN false; END IF;
  IF a.state NOT IN ('LEASED','RUNNING') THEN RETURN false; END IF;
  IF a."leaseUntil" IS NULL OR a."leaseUntil" <= clock_timestamp() THEN RETURN false; END IF;
  IF r."targetShopId" IS DISTINCT FROM p_shop_id THEN RETURN false; END IF;
  IF r.state NOT IN ('ENUMERATING','APPLYING','CHECKPOINTING','FINALIZING') THEN RETURN false; END IF;
  SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = r."generationId";
  IF NOT FOUND THEN RETURN false; END IF;
  IF g."targetShopId" IS DISTINCT FROM p_shop_id THEN RETURN false; END IF;

  IF r.topic = 'customers/data_request' THEN
    IF p_op <> 'READ' THEN RETURN false; END IF;
    RETURN g.fence IN ('LIVE','UNINSTALLED','ERASING','FINALIZING');
  ELSIF r.topic = 'customers/redact' THEN
    IF p_op NOT IN ('READ','DELETE_CUSTOMER') THEN RETURN false; END IF;
    -- Customer work is not whole-shop erasure. Concurrent shop erasure denies customer DELETE.
    RETURN g.fence IN ('LIVE','UNINSTALLED');
  ELSIF r.topic = 'shop/redact' THEN
    IF p_op NOT IN ('READ','DELETE_SHOP') THEN RETURN false; END IF;
    RETURN g.fence IN ('ERASING','FINALIZING');
  ELSE
    RETURN false;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_row_in_manifest(p_surface text, p_row_id text)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."PrivacyTargetKey" k
    WHERE k."requestId" = NULLIF(current_setting('stocky.privacy_request_id', true), '')
      AND k.surface = p_surface
      AND k."rowId" = p_row_id
      AND k."shopId" = public.stocky_current_tenant_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_enumerate_targets(p_request_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  oid text;
  n int;
  missing int := 0;
BEGIN
  IF p_request_id IS DISTINCT FROM NULLIF(current_setting('stocky.privacy_request_id', true), '') THEN
    RAISE EXCEPTION 'enumerator_request_guc_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'enumerator_request_missing' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public."PrivacyTargetKey" WHERE "requestId" = r.id;

  IF r.topic = 'shop/redact' THEN
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'ShopifyOrderFact', f.id
      FROM public."ShopifyOrderFact" f WHERE f."shopId" = r."targetShopId";
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'ShopifyOrderLineFact', l.id
      FROM public."ShopifyOrderLineFact" l WHERE l."shopId" = r."targetShopId";
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'AuditEvent', a.id
      FROM public."AuditEvent" a WHERE a."shopId" = r."targetShopId";
    UPDATE public."PrivacyRequest"
      SET "enumerationComplete" = true, "missingLinkages" = 0
      WHERE id = r.id;
    RETURN;
  END IF;

  -- Customer topics: only validated request order IDs + proven children + applicable audit.
  -- Caller cannot enlarge scope with arbitrary row IDs.
  FOREACH oid IN ARRAY COALESCE(r."lookupOrderLegacyIds", '{}')
  LOOP
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'ShopifyOrderFact', f.id
      FROM public."ShopifyOrderFact" f
      WHERE f."shopId" = r."targetShopId" AND f."shopifyLegacyResourceId" = oid;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
        SELECT r.id, r."targetShopId", 'ShopifyOrderLineFact', l.id
        FROM public."ShopifyOrderFact" f
        JOIN public."ShopifyOrderLineFact" l
          ON l."shopId" = f."shopId" AND l."shopifyOrderGid" = f."shopifyGid"
        WHERE f."shopId" = r."targetShopId" AND f."shopifyLegacyResourceId" = oid
        ON CONFLICT DO NOTHING;
    ELSE
      missing := missing + 1;
    END IF;
  END LOOP;

  IF r."lookupCustomerRestId" IS NOT NULL THEN
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'AuditEvent', a.id
      FROM public."AuditEvent" a
      WHERE a."shopId" = r."targetShopId" AND a."customerRestId" = r."lookupCustomerRestId";
  END IF;

  UPDATE public."PrivacyRequest"
    SET "enumerationComplete" = (missing = 0), "missingLinkages" = missing
    WHERE id = r.id;
END;
$$;

ALTER FUNCTION public.stocky_privacy_capability_allows(text, text) OWNER TO stocky_privacy_capability_owner;
ALTER FUNCTION public.stocky_privacy_row_in_manifest(text, text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_enumerate_targets(text) OWNER TO stocky_privacy_target_owner;

REVOKE ALL ON FUNCTION public.stocky_privacy_capability_allows(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_row_in_manifest(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_enumerate_targets(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stocky_privacy_capability_allows(text, text) TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_row_in_manifest(text, text) TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_enumerate_targets(text) TO stocky_privacy_reader, stocky_privacy_erasure, stocky_control_plane;

GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt", public."ShopInstallGeneration" TO stocky_privacy_capability_owner;
GRANT SELECT ON public."PrivacyRequest", public."PrivacyTargetKey" TO stocky_privacy_target_owner;
GRANT SELECT ON public."ShopifyOrderFact", public."ShopifyOrderLineFact", public."AuditEvent" TO stocky_privacy_target_owner;
GRANT INSERT, DELETE ON public."PrivacyTargetKey" TO stocky_privacy_target_owner;
GRANT UPDATE ON public."PrivacyRequest" TO stocky_privacy_target_owner;
GRANT USAGE, SELECT ON SEQUENCE public."PrivacyTargetKey_id_seq" TO stocky_privacy_target_owner;

-- Publisher privilege: only the enumerator definer may write keys.
-- Callers cannot enlarge scope by inserting arbitrary row IDs.
ALTER TABLE public."PrivacyTargetKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PrivacyTargetKey" FORCE ROW LEVEL SECURITY;
CREATE POLICY target_key_definer_all ON public."PrivacyTargetKey"
  FOR ALL TO stocky_privacy_target_owner
  USING ("requestId" = NULLIF(current_setting('stocky.privacy_request_id', true), ''))
  WITH CHECK ("requestId" = NULLIF(current_setting('stocky.privacy_request_id', true), ''));
CREATE POLICY target_key_cp_select ON public."PrivacyTargetKey"
  FOR SELECT TO stocky_control_plane
  USING (true);

-- Enumerator SELECT policies (FORCE RLS; owner is not table owner).
CREATE POLICY order_enumerate ON public."ShopifyOrderFact" FOR SELECT TO stocky_privacy_target_owner
  USING ("shopId" = (SELECT r."targetShopId" FROM public."PrivacyRequest" r WHERE r.id = NULLIF(current_setting('stocky.privacy_request_id', true), '')));
CREATE POLICY line_enumerate ON public."ShopifyOrderLineFact" FOR SELECT TO stocky_privacy_target_owner
  USING ("shopId" = (SELECT r."targetShopId" FROM public."PrivacyRequest" r WHERE r.id = NULLIF(current_setting('stocky.privacy_request_id', true), '')));
CREATE POLICY audit_enumerate ON public."AuditEvent" FOR SELECT TO stocky_privacy_target_owner
  USING ("shopId" = (SELECT r."targetShopId" FROM public."PrivacyRequest" r WHERE r.id = NULLIF(current_setting('stocky.privacy_request_id', true), '')));

-- Consumer privacy policies: topic + row manifest. No processingEnabled.
CREATE POLICY order_privacy_read ON public."ShopifyOrderFact" FOR SELECT TO stocky_privacy_reader, stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('READ', "shopId") AND stocky_privacy_row_in_manifest('ShopifyOrderFact', id));
CREATE POLICY order_privacy_delete_customer ON public."ShopifyOrderFact" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_CUSTOMER', "shopId") AND stocky_privacy_row_in_manifest('ShopifyOrderFact', id));
CREATE POLICY order_privacy_delete_shop ON public."ShopifyOrderFact" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_SHOP', "shopId"));

CREATE POLICY line_privacy_read ON public."ShopifyOrderLineFact" FOR SELECT TO stocky_privacy_reader, stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('READ', "shopId") AND stocky_privacy_row_in_manifest('ShopifyOrderLineFact', id));
CREATE POLICY line_privacy_delete_customer ON public."ShopifyOrderLineFact" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_CUSTOMER', "shopId") AND stocky_privacy_row_in_manifest('ShopifyOrderLineFact', id));
CREATE POLICY line_privacy_delete_shop ON public."ShopifyOrderLineFact" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_SHOP', "shopId"));

CREATE POLICY audit_privacy_read ON public."AuditEvent" FOR SELECT TO stocky_privacy_reader, stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('READ', "shopId") AND stocky_privacy_row_in_manifest('AuditEvent', id));
CREATE POLICY audit_privacy_delete_customer ON public."AuditEvent" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_CUSTOMER', "shopId") AND stocky_privacy_row_in_manifest('AuditEvent', id));
CREATE POLICY audit_privacy_delete_shop ON public."AuditEvent" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_SHOP', "shopId"));

GRANT SELECT ON public."ShopifyOrderFact", public."ShopifyOrderLineFact", public."AuditEvent" TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT DELETE ON public."ShopifyOrderFact", public."ShopifyOrderLineFact", public."AuditEvent" TO stocky_privacy_erasure;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."ShopifyOrderFact", public."ShopifyOrderLineFact" TO stocky_runtime;
GRANT SELECT, INSERT ON public."AuditEvent" TO stocky_runtime;

-- ---------------------------------------------------------------------------
-- Shop finalizer: SELECT/DELETE Shop only; rely on ON DELETE SET NULL
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_privacy_finalize_shop_delete(
  p_request_id text,
  p_target_shop_id text,
  p_generation_id text,
  p_attempt_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  g public."ShopInstallGeneration"%ROWTYPE;
  n int;
  live int;
BEGIN
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'finalizer_request_missing' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = p_generation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'finalizer_generation_missing' USING ERRCODE = 'P0001'; END IF;
  IF r.state <> 'FINALIZING' OR g.fence <> 'FINALIZING' THEN
    RAISE EXCEPTION 'finalizer_not_finalizing' USING ERRCODE = 'P0001';
  END IF;
  IF r."targetShopId" IS DISTINCT FROM p_target_shop_id OR g."targetShopId" IS DISTINCT FROM p_target_shop_id THEN
    RAISE EXCEPTION 'finalizer_target_mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF r."generationId" IS DISTINCT FROM p_generation_id THEN
    RAISE EXCEPTION 'finalizer_generation_mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF r."activeAttemptId" IS DISTINCT FROM p_attempt_id THEN
    RAISE EXCEPTION 'finalizer_stale_attempt' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO live FROM public."Shop" s
    WHERE s."myshopifyDomain" = g."canonicalDomain" AND s."processingEnabled" = true AND s.id IS DISTINCT FROM p_target_shop_id;
  IF live > 0 THEN
    RAISE EXCEPTION 'finalizer_live_successor' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public."Shop"
    WHERE id = p_target_shop_id
      AND "processingEnabled" = false
      AND "processingDisabledReason" = 'REDACTED';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 1 THEN
    RETURN 'deleted';
  END IF;
  IF n = 0 AND NOT EXISTS (SELECT 1 FROM public."Shop" WHERE id = p_target_shop_id) THEN
    RETURN 'already_absent';
  END IF;
  RAISE EXCEPTION 'finalizer_shop_not_eligible' USING ERRCODE = 'P0001';
END;
$$;

ALTER FUNCTION public.stocky_privacy_finalize_shop_delete(text,text,text,text) OWNER TO stocky_privacy_finalizer_owner;
REVOKE ALL ON FUNCTION public.stocky_privacy_finalize_shop_delete(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_finalize_shop_delete(text,text,text,text) TO stocky_privacy_erasure;
GRANT SELECT, DELETE ON public."Shop" TO stocky_privacy_finalizer_owner;
GRANT SELECT ON public."PrivacyRequest", public."ShopInstallGeneration", public."PrivacyAttempt" TO stocky_privacy_finalizer_owner;

-- Runtime/CP: Shop SELECT/INSERT/UPDATE, no DELETE
GRANT SELECT, INSERT, UPDATE ON public."Shop" TO stocky_runtime;
GRANT SELECT, UPDATE ON public."Shop" TO stocky_control_plane;

-- ---------------------------------------------------------------------------
-- Lifecycle gate (versioned, domain-keyed, valid when Shop is absent)
-- ns 0x50523731 = PR71
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_lifecycle_lock_key(p_canonical_domain text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT hashtext('pr7-life-v1:' || p_canonical_domain); $$;

CREATE OR REPLACE FUNCTION public.stocky_lifecycle_shared_lock(p_canonical_domain text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(1347573553, public.stocky_lifecycle_lock_key(p_canonical_domain));
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_lifecycle_exclusive_lock(p_canonical_domain text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1347573553, public.stocky_lifecycle_lock_key(p_canonical_domain));
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_generation_writable(p_canonical_domain text)
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE f text;
BEGIN
  SELECT fence INTO f
  FROM public."ShopInstallGeneration"
  WHERE "canonicalDomain" = p_canonical_domain
  ORDER BY id DESC
  LIMIT 1;
  IF f IS NULL THEN RETURN true; END IF;
  RETURN f NOT IN ('ERASING','FINALIZING');
END;
$$;

ALTER FUNCTION public.stocky_lifecycle_shared_lock(text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_lifecycle_exclusive_lock(text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_generation_writable(text) OWNER TO stocky_lifecycle_gate_owner;
REVOKE ALL ON FUNCTION public.stocky_lifecycle_shared_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_lifecycle_exclusive_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_generation_writable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_shared_lock(text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_reader;
GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_exclusive_lock(text) TO stocky_control_plane, stocky_privacy_erasure;
GRANT EXECUTE ON FUNCTION public.stocky_generation_writable(text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_reader;
GRANT SELECT ON public."ShopInstallGeneration" TO stocky_lifecycle_gate_owner;

-- Instrumented writer helper used by participating fact/CP/bootstrap paths.
CREATE OR REPLACE FUNCTION public.stocky_participating_write_guard(p_canonical_domain text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.stocky_lifecycle_shared_lock(p_canonical_domain);
  IF NOT public.stocky_generation_writable(p_canonical_domain) THEN
    RAISE EXCEPTION 'generation_frozen' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.stocky_participating_write_guard(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_participating_write_guard(text) TO stocky_runtime, stocky_control_plane;

-- ---------------------------------------------------------------------------
-- Authorization: advisory lock + SELECT-only verifier (no assignment UPDATE)
-- ns 0x50523732 = PR72
-- Permission map version: pr7-perm-v1
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_authz_lock(p_shop_id text, p_actor_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1347573554, hashtext('pr7-authz-v1:' || p_shop_id || ':' || p_actor_id));
END;
$$;
REVOKE ALL ON FUNCTION public.stocky_authz_lock(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_authz_lock(text, text) TO stocky_runtime, stocky_control_plane;

CREATE OR REPLACE FUNCTION public.stocky_authz_lock_pair(p_shop_id text, p_actor_a text, p_actor_b text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_actor_a <= p_actor_b THEN
    PERFORM public.stocky_authz_lock(p_shop_id, p_actor_a);
    IF p_actor_a <> p_actor_b THEN
      PERFORM public.stocky_authz_lock(p_shop_id, p_actor_b);
    END IF;
  ELSE
    PERFORM public.stocky_authz_lock(p_shop_id, p_actor_b);
    PERFORM public.stocky_authz_lock(p_shop_id, p_actor_a);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.stocky_authz_lock_pair(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_authz_lock_pair(text,text,text) TO stocky_runtime, stocky_control_plane;

CREATE OR REPLACE FUNCTION public.stocky_verify_platform_assignment(p_shop_id text, p_actor_id text, p_permission text)
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE allowed boolean;
BEGIN
  IF p_permission IS DISTINCT FROM 'platform.replay.execute' THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public."ShopRoleAssignment" a
    WHERE a."shopId" = p_shop_id
      AND a."shopifyUserId" = p_actor_id
      AND a."revokedAt" IS NULL
      AND a.role IN ('shop_owner','shop_admin')
  ) INTO allowed;
  RETURN allowed;
END;
$$;

ALTER FUNCTION public.stocky_verify_platform_assignment(text,text,text) OWNER TO stocky_assignment_verifier_owner;
REVOKE ALL ON FUNCTION public.stocky_verify_platform_assignment(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_verify_platform_assignment(text,text,text) TO stocky_control_plane, stocky_runtime;
GRANT SELECT ON public."ShopRoleAssignment" TO stocky_assignment_verifier_owner;

CREATE POLICY assignment_runtime_all ON public."ShopRoleAssignment" FOR ALL TO stocky_runtime
  USING (true) WITH CHECK (true);
CREATE POLICY assignment_verifier_select ON public."ShopRoleAssignment" FOR SELECT TO stocky_assignment_verifier_owner
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."ShopRoleAssignment" TO stocky_runtime;
GRANT SELECT ON public."ShopRoleAssignment" TO stocky_control_plane;

-- Control-plane ordinary job family
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public."DurableJob", public."JobAttempt", public."DeadLetter", public."JobReplay",
  public."WebhookDelivery", public."SyncApplicationReceipt", public."DispatchReadyShop",
  public."Session", public."PrivacyRequest", public."PrivacyAttempt",
  public."PrivacyCoordinatorEvent", public."PrivacyCompletionReceipt",
  public."PrivacyDeliveryTombstone", public."PlatformReplayCommand",
  public."ShopInstallGeneration"
TO stocky_control_plane;
GRANT SELECT ON public."PrivacyTargetKey" TO stocky_control_plane;
GRANT USAGE, SELECT ON SEQUENCE public."PrivacyCoordinatorEvent_id_seq" TO stocky_control_plane;

GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt", public."ShopInstallGeneration" TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT SELECT ON public."Shop" TO stocky_privacy_reader, stocky_privacy_erasure;

COMMIT;

```

### Appendix B — `02_seed.sql`

```sql
-- Fixture seed. Isolated owner pr45owner uses BYPASSRLS for load only.
-- Named restricted roles never receive BYPASSRLS.
ALTER ROLE pr45owner BYPASSRLS;

INSERT INTO public."Shop"(id,"myshopifyDomain","processingEnabled","processingDisabledReason") VALUES
  ('shop_a','pr7-a.myshopify.com', true, NULL),
  ('shop_b','pr7-b.myshopify.com', true, NULL),
  ('shop_red','pr7-red.myshopify.com', false, 'REDACTED');

INSERT INTO public."ShopInstallGeneration"(id,"canonicalDomain","targetShopId","shopRowId",fence) VALUES
  ('gen_a','pr7-a.myshopify.com','shop_a','shop_a','LIVE'),
  ('gen_b','pr7-b.myshopify.com','shop_b','shop_b','LIVE'),
  ('gen_red','pr7-red.myshopify.com','shop_red','shop_red','UNINSTALLED');

INSERT INTO public."ShopifyOrderFact"(id,"shopId","shopifyGid","shopifyLegacyResourceId") VALUES
  ('of_a1','shop_a','gid://shopify/Order/299938','299938'),
  ('of_a2','shop_a','gid://shopify/Order/299939','299939'),
  ('of_b1','shop_b','gid://shopify/Order/111','111'),
  ('of_red1','shop_red','gid://shopify/Order/1','1');

INSERT INTO public."ShopifyOrderLineFact"(id,"shopId","shopifyOrderGid") VALUES
  ('ol_a1','shop_a','gid://shopify/Order/299938'),
  ('ol_a2','shop_a','gid://shopify/Order/299939'),
  ('ol_b1','shop_b','gid://shopify/Order/111'),
  ('ol_red1','shop_red','gid://shopify/Order/1');

INSERT INTO public."AuditEvent"(id,"shopId","customerRestId") VALUES
  ('ae_a1','shop_a','191167'),
  ('ae_a2','shop_a','999999'),
  ('ae_b1','shop_b','191167'),
  ('ae_red1','shop_red','191167');

INSERT INTO public."DurableJob"(id,"shopId","jobType",state) VALUES
  ('job_a','shop_a','orders/create','PENDING'),
  ('job_red','shop_red','orders/create','CANCELLED');

INSERT INTO public."JobAttempt"(id,"shopId","durableJobId") VALUES
  ('ja_a','shop_a','job_a'),
  ('ja_red','shop_red','job_red');

INSERT INTO public."DeadLetter"(id,"shopId","durableJobId","resolutionState") VALUES
  ('dl_a','shop_a','job_a','OPEN');

INSERT INTO public."WebhookDelivery"(id,"shopId") VALUES ('wd_a','shop_a'),('wd_red','shop_red');
INSERT INTO public."SyncApplicationReceipt"(id,"shopId") VALUES ('sar_a','shop_a'),('sar_red','shop_red');
INSERT INTO public."DispatchReadyShop"("shopId") VALUES ('shop_a'),('shop_red');
INSERT INTO public."Session"(id,shop,"accessToken") VALUES
  ('sess_a','pr7-a.myshopify.com','tok_a'),
  ('sess_red','pr7-red.myshopify.com','tok_red');

INSERT INTO public."ShopRoleAssignment"(id,"shopId","shopifyUserId",role,"revokedAt") VALUES
  ('asg_owner_a','shop_a','548380009','shop_owner', NULL),
  ('asg_admin_a','shop_a','548380010','shop_admin', NULL),
  ('asg_aud_a','shop_a','548380011','platform_auditor', NULL);

-- Customer data_request on LIVE shop_a
INSERT INTO public."PrivacyRequest"(id,topic,state,"targetShopId","generationId","shopRowId","lookupCustomerRestId","lookupOrderLegacyIds","activeAttemptId") VALUES
  ('preq_dr','customers/data_request','ENUMERATING','shop_a','gen_a','shop_a','191167',ARRAY['299938'],'patt_dr');
INSERT INTO public."PrivacyAttempt"(id,"privacyRequestId",epoch,state,"leaseUntil",worker) VALUES
  ('patt_dr','preq_dr',1,'RUNNING', now() + interval '1 hour','w1');

-- Customer redact on LIVE shop_a
INSERT INTO public."PrivacyRequest"(id,topic,state,"targetShopId","generationId","shopRowId","lookupCustomerRestId","lookupOrderLegacyIds","activeAttemptId") VALUES
  ('preq_cr','customers/redact','APPLYING','shop_a','gen_a','shop_a','191167',ARRAY['299938'],'patt_cr');
INSERT INTO public."PrivacyAttempt"(id,"privacyRequestId",epoch,state,"leaseUntil",worker) VALUES
  ('patt_cr','preq_cr',1,'RUNNING', now() + interval '1 hour','w1');

-- Shop redact on UNINSTALLED shop_red
INSERT INTO public."PrivacyRequest"(id,topic,state,"targetShopId","generationId","shopRowId","lookupCustomerRestId","lookupOrderLegacyIds","activeAttemptId") VALUES
  ('preq_sr','shop/redact','APPLYING','shop_red','gen_red','shop_red',NULL,'{}','patt_sr');
INSERT INTO public."PrivacyAttempt"(id,"privacyRequestId",epoch,state,"leaseUntil",worker) VALUES
  ('patt_sr','preq_sr',1,'RUNNING', now() + interval '1 hour','w1');
UPDATE public."ShopInstallGeneration" SET fence='ERASING' WHERE id='gen_red';

```

### Appendix C — `03_run_proofs.py`

```python
#!/usr/bin/env python3
"""PR45 disposable PostgreSQL 16 feasibility driver. Not repository runtime."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from typing import Any

PSQL = [
    "psql",
    "-h",
    "/tmp/pr45-pg16",
    "-p",
    "5433",
    "-d",
    "pr45_proof",
    "-v",
    "ON_ERROR_STOP=1",
    "-X",
    "-A",
    "-t",
    "-q",
]

RESULTS: list[dict[str, Any]] = []
MARKER = "---PROOF---"


def psql(user: str, sql: str, timeout: int = 20) -> tuple[int, str, str]:
    p = subprocess.run(
        PSQL + ["-U", user, "-c", sql],
        capture_output=True,
        text=True,
        timeout=timeout,
        env={**os.environ, "PGCONNECT_TIMEOUT": "5"},
    )
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def record(group: str, name: str, ok: bool, detail: str, sqlstate: str = "") -> None:
    RESULTS.append(
        {
            "group": group,
            "name": name,
            "ok": ok,
            "sqlstate": sqlstate,
            "detail": detail[:4000],
        }
    )
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {group} {name}: {detail[:300]}")


def sqlstate_from_err(err: str) -> str:
    if "42501" in err or "permission denied" in err.lower():
        return "42501"
    if "P0001" in err:
        return "P0001"
    if "23503" in err or "foreign key" in err.lower():
        return "23503"
    if "23505" in err or "duplicate key" in err.lower():
        return "23505"
    if "55P03" in err or "lock timeout" in err.lower() or "canceling statement due to lock timeout" in err:
        return "55P03"
    return ""


def is_denied(rc: int, err: str) -> bool:
    return rc != 0 and sqlstate_from_err(err) == "42501"


def proof_lines(out: str) -> list[str]:
    if MARKER not in out:
        return [ln.strip() for ln in out.splitlines() if ln.strip() and ln.strip() not in ("BEGIN", "COMMIT", "ROLLBACK")]
    after = out.split(MARKER, 1)[1]
    lines = []
    for ln in after.splitlines():
        s = ln.strip()
        if not s or s in ("BEGIN", "COMMIT", "ROLLBACK"):
            continue
        lines.append(s)
    return lines


def last_line(out: str) -> str:
    lines = proof_lines(out)
    return lines[-1] if lines else ""


CTX = """
SELECT set_config('stocky.current_shop_id', '{shop}', true);
SELECT set_config('stocky.tenant_context_version', 'phase1-db-tenant-context-v1', true);
SELECT set_config('stocky.privacy_request_id', '{req}', true);
SELECT set_config('stocky.privacy_attempt_id', '{att}', true);
SELECT '{marker}';
"""


def tx(user: str, shop: str, req: str, att: str, body: str, timeout: int = 20) -> tuple[int, str, str]:
    sql = (
        "BEGIN;\n"
        + CTX.format(shop=shop, req=req, att=att, marker=MARKER)
        + body
        + "\nCOMMIT;"
    )
    return psql(user, sql, timeout=timeout)


def reset() -> None:
    subprocess.check_call(
        ["dropdb", "-h", "/tmp/pr45-pg16", "-p", "5433", "-U", "pr45owner", "--if-exists", "pr45_proof"]
    )
    subprocess.check_call(
        ["createdb", "-h", "/tmp/pr45-pg16", "-p", "5433", "-U", "pr45owner", "pr45_proof"]
    )
    subprocess.check_call(
        PSQL + ["-U", "pr45owner", "-f", "/tmp/pr45-proof/01_contract.sql"],
        stdout=subprocess.DEVNULL,
    )
    subprocess.check_call(PSQL + ["-U", "pr45owner", "-f", "/tmp/pr45-proof/02_seed.sql"])


def g1() -> None:
    group = "G1-topics"

    rc, out, err = tx(
        "stocky_privacy_reader",
        "shop_a",
        "preq_dr",
        "patt_dr",
        "SELECT public.stocky_privacy_enumerate_targets('preq_dr');",
    )
    rc2, out2, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"PrivacyTargetKey\" WHERE \"requestId\"='preq_dr';",
    )
    record(
        group,
        "enumerate_data_request",
        rc == 0 and out2.strip() == "3",
        f"enum_rc={rc} keys={out2} err={err}",
        sqlstate_from_err(err),
    )

    rc, out, err = tx(
        "stocky_privacy_reader",
        "shop_a",
        "preq_dr",
        "patt_dr",
        "SELECT id FROM public.\"ShopifyOrderFact\" ORDER BY id;",
    )
    ids = proof_lines(out)
    record(
        group,
        "data_request_reads_only_target_order",
        rc == 0 and ids == ["of_a1"],
        f"visible={ids} err={err}",
    )

    rc, out, err = tx(
        "stocky_privacy_reader",
        "shop_a",
        "preq_dr",
        "patt_dr",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\";",
    )
    rc_abs, out_abs, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\" WHERE \"shopId\"='shop_a';",
    )
    record(
        group,
        "invisible_is_not_absence",
        rc == 0 and last_line(out) == "1" and out_abs.strip() == "2",
        f"rls_visible={last_line(out)} owner_shop_a={out_abs}",
    )

    rc, out, err = tx(
        "stocky_privacy_reader",
        "shop_a",
        "preq_dr",
        "patt_dr",
        "DELETE FROM public.\"ShopifyOrderFact\";",
    )
    record(
        group,
        "data_request_reader_cannot_delete",
        is_denied(rc, err),
        err,
        sqlstate_from_err(err),
    )

    rc, out, err = tx(
        "stocky_privacy_reader",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "DELETE FROM public.\"ShopifyOrderFact\";",
    )
    record(
        group,
        "data_request_credentials_on_erasure_request_denied",
        is_denied(rc, err),
        err,
        sqlstate_from_err(err),
    )

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_dr",
        "patt_dr",
        "DELETE FROM public.\"ShopifyOrderFact\"; SELECT count(*) FROM public.\"ShopifyOrderFact\";",
    )
    rc2, out2, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\" WHERE id='of_a1';",
    )
    record(
        group,
        "data_request_erasure_role_cannot_remove_rows",
        rc == 0 and last_line(out) == "1" and out2.strip() == "1",
        f"delete_out={out} remaining_of_a1={out2} err={err}",
    )

    psql(
        "pr45owner",
        "UPDATE public.\"Shop\" SET \"processingEnabled\"=false, \"processingDisabledReason\"='UNINSTALLED' WHERE id='shop_a';",
    )
    rc, out, err = tx(
        "stocky_privacy_reader",
        "shop_a",
        "preq_dr",
        "patt_dr",
        "SELECT id FROM public.\"ShopifyOrderFact\" ORDER BY id;",
    )
    record(
        group,
        "data_request_reads_while_shop_disabled",
        rc == 0 and proof_lines(out) == ["of_a1"],
        f"visible={proof_lines(out)} err={err}",
    )
    psql(
        "pr45owner",
        "UPDATE public.\"Shop\" SET \"processingEnabled\"=true, \"processingDisabledReason\"=NULL WHERE id='shop_a';",
    )

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_enumerate_targets('preq_cr'); DELETE FROM public.\"ShopifyOrderFact\";",
    )
    rc3, out3, _ = psql(
        "pr45owner",
        "SELECT string_agg(id, ',' ORDER BY id) FROM public.\"ShopifyOrderFact\" WHERE \"shopId\"='shop_a';",
    )
    record(
        group,
        "customers_redact_broad_delete_only_target",
        rc == 0 and out3.strip() == "of_a2",
        f"shop_a_remaining={out3} err={err} out={out}",
    )

    rc4, out4, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"ShopifyOrderLineFact\" WHERE id IN ('ol_a1','ol_a2');",
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "DELETE FROM public.\"ShopifyOrderLineFact\"; SELECT count(*) FROM public.\"ShopifyOrderLineFact\";",
    )
    rc5, out5, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"ShopifyOrderLineFact\" WHERE id='ol_a2';",
    )
    record(
        group,
        "child_line_of_other_customer_survives",
        out5.strip() == "1",
        f"owner_ol_a2={out5} visible={out} before_pair={out4}",
    )

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_b",
        "preq_cr",
        "patt_cr",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\"; DELETE FROM public.\"ShopifyOrderFact\";",
    )
    rc6, out6, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\" WHERE \"shopId\"='shop_b';",
    )
    record(
        group,
        "wrong_shop_guc_cannot_see_or_delete_b",
        last_line(out) == "0" and out6.strip() == "1",
        f"probe={out} err={err} shop_b={out6}",
    )

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "expired",
        "SELECT public.stocky_privacy_capability_allows('DELETE_CUSTOMER','shop_a');",
    )
    record(
        group,
        "missing_attempt_capability_false",
        rc == 0 and last_line(out) == "f",
        f"out={out} err={err}",
    )

    psql(
        "pr45owner",
        """
        INSERT INTO public."PrivacyRequest"(id,topic,state,"targetShopId","generationId")
        VALUES ('preq_unk','customers/unknown','APPLYING','shop_a','gen_a');
        INSERT INTO public."PrivacyAttempt"(id,"privacyRequestId",epoch,state,"leaseUntil")
        VALUES ('patt_unk','preq_unk',1,'RUNNING', now()+interval '1 hour');
        UPDATE public."PrivacyRequest" SET "activeAttemptId"='patt_unk' WHERE id='preq_unk';
        """,
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_unk",
        "patt_unk",
        "SELECT public.stocky_privacy_capability_allows('READ','shop_a'); SELECT public.stocky_privacy_capability_allows('DELETE_CUSTOMER','shop_a'); SELECT public.stocky_privacy_capability_allows('DELETE_SHOP','shop_a');",
    )
    record(
        group,
        "unknown_topic_fail_closed",
        rc == 0 and proof_lines(out) == ["f", "f", "f"],
        f"out={out} err={err}",
    )

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "INSERT INTO public.\"PrivacyTargetKey\"(\"requestId\",\"shopId\",surface,\"rowId\") VALUES ('preq_cr','shop_a','ShopifyOrderFact','of_a2');",
    )
    record(
        group,
        "erasure_cannot_insert_arbitrary_target_keys",
        is_denied(rc, err),
        err,
        sqlstate_from_err(err),
    )

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_red",
        "preq_sr",
        "patt_sr",
        "SELECT public.stocky_privacy_enumerate_targets('preq_sr'); DELETE FROM public.\"ShopifyOrderFact\"; DELETE FROM public.\"ShopifyOrderLineFact\"; DELETE FROM public.\"AuditEvent\";",
    )
    rc7, out7, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\" WHERE \"shopId\"='shop_red';",
    )
    record(
        group,
        "shop_redact_deletes_generation_facts",
        rc == 0 and out7.strip() == "0",
        f"err={err} remaining={out7}",
    )

    psql(
        "pr45owner",
        """
        INSERT INTO public."PrivacyRequest"(id,topic,state,"targetShopId","generationId","lookupOrderLegacyIds","activeAttemptId")
        VALUES ('preq_miss','customers/redact','ENUMERATING','shop_a','gen_a',ARRAY['no-such'],'patt_miss');
        INSERT INTO public."PrivacyAttempt"(id,"privacyRequestId",epoch,state,"leaseUntil")
        VALUES ('patt_miss','preq_miss',1,'RUNNING', now()+interval '1 hour');
        UPDATE public."PrivacyRequest" SET "activeAttemptId"='patt_miss' WHERE id='preq_miss';
        """,
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_miss",
        "patt_miss",
        "SELECT public.stocky_privacy_enumerate_targets('preq_miss'); SELECT \"enumerationComplete\"::text||','||\"missingLinkages\"::text FROM public.\"PrivacyRequest\" WHERE id='preq_miss';",
    )
    record(
        group,
        "missing_linkage_is_incomplete_not_absence",
        rc == 0 and "false,1" in "".join(proof_lines(out)).replace(" ", ""),
        f"out={out} err={err}",
    )


def g2() -> None:
    group = "G2-grants"
    psql(
        "pr45owner",
        "REVOKE EXECUTE ON FUNCTION public.stocky_privacy_capability_allows(text,text) FROM stocky_privacy_erasure;",
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\";",
    )
    record(
        group,
        "revoke_capability_execute_fails_probe",
        is_denied(rc, err),
        err,
        sqlstate_from_err(err),
    )
    psql(
        "pr45owner",
        "GRANT EXECUTE ON FUNCTION public.stocky_privacy_capability_allows(text,text) TO stocky_privacy_erasure;",
    )

    psql(
        "pr45owner",
        "REVOKE EXECUTE ON FUNCTION public.stocky_current_tenant_id() FROM stocky_privacy_erasure;",
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\";",
    )
    record(
        group,
        "revoke_tenant_id_execute_fails_probe",
        is_denied(rc, err),
        err,
        sqlstate_from_err(err),
    )
    psql(
        "pr45owner",
        "GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_id() TO stocky_privacy_erasure;",
    )

    psql(
        "pr45owner",
        'DROP POLICY IF EXISTS order_privacy_read ON public."ShopifyOrderFact";',
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\";",
    )
    record(
        group,
        "drop_read_policy_hides_rows",
        rc == 0 and last_line(out) == "0",
        f"out={out} err={err}",
    )
    psql(
        "pr45owner",
        """
        CREATE POLICY order_privacy_read ON public."ShopifyOrderFact" FOR SELECT TO stocky_privacy_reader, stocky_privacy_erasure
          USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('READ', "shopId") AND stocky_privacy_row_in_manifest('ShopifyOrderFact', id));
        """,
    )

    psql(
        "pr45owner",
        "UPDATE public.\"Shop\" SET \"processingEnabled\"=false, \"processingDisabledReason\"='UNINSTALLED' WHERE id='shop_b';",
    )
    rc, out, err = tx(
        "stocky_runtime",
        "shop_b",
        "preq_cr",
        "patt_cr",
        "INSERT INTO public.\"AuditEvent\"(id,\"shopId\") VALUES ('ae_x','shop_b');",
    )
    record(
        group,
        "runtime_insert_audit_disabled_errors",
        rc != 0 and "row-level security" in err.lower(),
        err,
        sqlstate_from_err(err),
    )
    rc, out, err = tx(
        "stocky_runtime",
        "shop_b",
        "preq_cr",
        "patt_cr",
        "SELECT count(*) FROM public.\"ShopifyOrderFact\";",
    )
    record(
        group,
        "runtime_select_disabled_zero_rows",
        rc == 0 and last_line(out) == "0",
        f"out={out} err={err}",
    )

    rc, out, _ = psql(
        "pr45owner",
        "SELECT pg_has_role('stocky_runtime','stocky_privacy_erasure','MEMBER')::text;",
    )
    record(group, "runtime_not_member_of_erasure", last_line(out) == "false" or out.strip() == "f" or out.strip() == "false", out)

    rc, out, err = psql(
        "stocky_privacy_erasure",
        "SELECT public.stocky_shop_processing_enabled('shop_a');",
    )
    record(
        group,
        "privacy_erasure_no_processing_helper",
        is_denied(rc, err),
        err,
        sqlstate_from_err(err),
    )

    rc, out, err = psql(
        "stocky_privacy_operator",
        "SELECT public.stocky_privacy_capability_allows('READ','shop_a');",
    )
    record(
        group,
        "operator_no_capability_execute",
        is_denied(rc, err),
        err,
        sqlstate_from_err(err),
    )


def g3() -> None:
    group = "G3-shop-delete"
    psql(
        "pr45owner",
        """
        UPDATE public."PrivacyRequest" SET state='FINALIZING' WHERE id='preq_sr';
        UPDATE public."ShopInstallGeneration" SET fence='FINALIZING' WHERE id='gen_red';
        """,
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_red",
        "preq_sr",
        "patt_sr",
        "SELECT public.stocky_privacy_finalize_shop_delete('preq_sr','shop_red','gen_red','patt_sr');",
    )
    record(
        group,
        "restrict_job_family_blocks_root_delete",
        rc != 0 and ("foreign key" in err.lower() or "23503" in err),
        err,
        sqlstate_from_err(err),
    )

    psql(
        "pr45owner",
        """
        DELETE FROM public."JobAttempt" WHERE "shopId"='shop_red';
        DELETE FROM public."DurableJob" WHERE "shopId"='shop_red';
        DELETE FROM public."WebhookDelivery" WHERE "shopId"='shop_red';
        DELETE FROM public."SyncApplicationReceipt" WHERE "shopId"='shop_red';
        DELETE FROM public."DispatchReadyShop" WHERE "shopId"='shop_red';
        DELETE FROM public."Session" WHERE shop='pr7-red.myshopify.com';
        """,
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_red",
        "preq_sr",
        "patt_sr",
        "SELECT public.stocky_privacy_finalize_shop_delete('preq_sr','shop_red','gen_red','patt_sr');",
    )
    record(group, "finalizer_deletes_shop", rc == 0 and "deleted" in out, f"out={out} err={err}")

    rc, out, _ = psql("pr45owner", "SELECT count(*) FROM public.\"Shop\" WHERE id='shop_red';")
    record(group, "shop_row_gone", out.strip() == "0", out)

    rc, out, _ = psql(
        "pr45owner",
        "SELECT \"shopRowId\" IS NULL AND \"targetShopId\"='shop_red' FROM public.\"ShopInstallGeneration\" WHERE id='gen_red';",
    )
    record(group, "generation_set_null_keeps_target", out.strip() == "t", out)

    rc, out, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"PrivacyRequest\" WHERE id='preq_sr';",
    )
    record(group, "coordinator_request_survives", out.strip() == "1", out)

    rc, out, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"PrivacyAttempt\" WHERE id='patt_sr';",
    )
    record(group, "coordinator_attempt_survives", out.strip() == "1", out)

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_red",
        "preq_sr",
        "patt_sr",
        "SELECT public.stocky_privacy_finalize_shop_delete('preq_sr','shop_red','gen_red','patt_sr');",
    )
    record(group, "finalizer_already_absent_retry", rc == 0 and "already_absent" in out, f"out={out} err={err}")

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_red",
        "preq_sr",
        "patt_sr",
        "SELECT public.stocky_privacy_finalize_shop_delete('preq_sr','shop_red','gen_red','NOPE');",
    )
    record(group, "stale_attempt_denied", rc != 0 and "finalizer_stale_attempt" in err, err, sqlstate_from_err(err))

    rc, out, err = psql(
        "pr45owner",
        """
        SELECT coalesce(string_agg(privilege_type, ',' ORDER BY privilege_type), '') FROM information_schema.role_table_grants
        WHERE grantee='stocky_privacy_finalizer_owner' AND table_name='ShopInstallGeneration';
        """,
    )
    record(group, "finalizer_no_generation_update_grant", "UPDATE" not in out, out)

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_red",
        "preq_sr",
        "patt_sr",
        "SELECT public.stocky_privacy_capability_allows('DELETE_SHOP','shop_red');",
    )
    record(
        group,
        "retry_capability_after_shop_gone",
        rc == 0 and last_line(out) == "t",
        f"out={out} err={err}",
    )


def g4() -> None:
    group = "G4-authz"
    rc, out, _ = psql(
        "pr45owner",
        """
        SELECT coalesce(string_agg(privilege_type, ',' ORDER BY privilege_type), '') FROM information_schema.role_table_grants
        WHERE grantee='stocky_assignment_verifier_owner' AND table_name='ShopRoleAssignment';
        """,
    )
    record(group, "verifier_select_only", out.strip() == "SELECT", out)

    rc, out, err = psql(
        "stocky_control_plane",
        f"""
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
        SELECT public.stocky_authz_lock('shop_a','548380010');
        SELECT '{MARKER}';
        SELECT public.stocky_verify_platform_assignment('shop_a','548380010','platform.replay.execute');
        COMMIT;
        """,
    )
    record(group, "verifier_allows_admin", rc == 0 and last_line(out) == "t", f"out={out} err={err}")

    rc, out, err = psql(
        "stocky_control_plane",
        f"""
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
        SELECT public.stocky_authz_lock('shop_a','548380011');
        SELECT '{MARKER}';
        SELECT public.stocky_verify_platform_assignment('shop_a','548380011','platform.replay.execute');
        COMMIT;
        """,
    )
    record(group, "verifier_denies_auditor", rc == 0 and last_line(out) == "f", f"out={out} err={err}")

    rc, out, err = psql(
        "stocky_control_plane",
        f"""
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
        SELECT public.stocky_authz_lock('shop_a','missing');
        SELECT '{MARKER}';
        SELECT public.stocky_verify_platform_assignment('shop_a','missing','platform.replay.execute');
        COMMIT;
        """,
    )
    record(group, "missing_assignment_false", rc == 0 and last_line(out) == "f", f"out={out}")

    rc, out, err = psql(
        "stocky_runtime",
        """
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
        SELECT public.stocky_authz_lock('shop_a','548380010');
        UPDATE public."ShopRoleAssignment" SET "revokedAt"=now() WHERE id='asg_admin_a';
        COMMIT;
        """,
    )
    record(group, "revoke_commits", rc == 0, err)
    rc, out, err = psql(
        "stocky_control_plane",
        f"""
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
        SELECT public.stocky_authz_lock('shop_a','548380010');
        SELECT '{MARKER}';
        SELECT public.stocky_verify_platform_assignment('shop_a','548380010','platform.replay.execute');
        COMMIT;
        """,
    )
    record(group, "revoke_before_effect_denies", rc == 0 and last_line(out) == "f", f"out={out}")

    psql(
        "pr45owner",
        "UPDATE public.\"ShopRoleAssignment\" SET \"revokedAt\"=NULL WHERE id='asg_admin_a';",
    )

    held = threading.Event()
    release = threading.Event()
    waiter: dict[str, Any] = {}

    def holder() -> None:
        p = subprocess.Popen(
            PSQL + ["-U", "stocky_runtime"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        assert p.stdin and p.stdout
        p.stdin.write(
            "BEGIN;\nSET TRANSACTION ISOLATION LEVEL READ COMMITTED;\n"
            "SELECT public.stocky_authz_lock('shop_a','548380010');\nSELECT 'HOLDING';\n"
        )
        p.stdin.flush()
        buf = ""
        start = time.time()
        while time.time() - start < 8:
            line = p.stdout.readline()
            buf += line
            if "HOLDING" in buf:
                held.set()
                if not release.wait(12):
                    p.kill()
                    return
                p.stdin.write(
                    "UPDATE public.\"ShopRoleAssignment\" SET \"revokedAt\"=now() WHERE id='asg_admin_a';\nCOMMIT;\n"
                )
                p.communicate(timeout=10)
                return
        p.kill()

    def waiter_fn() -> None:
        if not held.wait(8):
            waiter["err"] = "holder timeout"
            return
        rcw, outw, errw = psql(
            "stocky_control_plane",
            f"""
            BEGIN;
            SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
            SELECT public.stocky_authz_lock('shop_a','548380010');
            SELECT '{MARKER}';
            SELECT public.stocky_verify_platform_assignment('shop_a','548380010','platform.replay.execute');
            COMMIT;
            """,
            timeout=15,
        )
        waiter["rc"] = rcw
        waiter["out"] = outw
        waiter["err"] = errw

    t_hold = threading.Thread(target=holder)
    t_wait = threading.Thread(target=waiter_fn)
    t_hold.start()
    if not held.wait(8):
        record(group, "fresh_read_after_wait_sees_revoke", False, "holder did not acquire lock")
        release.set()
        t_hold.join(3)
    else:
        t_wait.start()
        time.sleep(0.4)
        release.set()
        t_wait.join(15)
        t_hold.join(5)
        record(
            group,
            "fresh_read_after_wait_sees_revoke",
            waiter.get("rc") == 0 and last_line(waiter.get("out", "")) == "f",
            f"out={waiter.get('out')} err={waiter.get('err')}",
        )

    psql(
        "pr45owner",
        "UPDATE public.\"ShopRoleAssignment\" SET \"revokedAt\"=NULL WHERE id='asg_admin_a';",
    )

    rc, out, err = psql(
        "stocky_control_plane",
        f"""
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
        SELECT public.stocky_authz_lock('shop_a','548380010');
        SELECT public.stocky_verify_platform_assignment('shop_a','548380010','platform.replay.execute');
        SELECT '{MARKER}';
        INSERT INTO public."PlatformReplayCommand"("commandId","shopId","actorId","deadLetterId","originalJobId","requestDigest","newJobId","replayId")
        VALUES ('cmd1','shop_a','548380010','dl_a','job_a','digest-a','job_new1','jr1');
        INSERT INTO public."DurableJob"(id,"shopId","jobType",state) VALUES ('job_new1','shop_a','orders/create','PENDING');
        INSERT INTO public."JobReplay"(id,"shopId","originalJobId","newJobId") VALUES ('jr1','shop_a','job_a','job_new1');
        UPDATE public."DeadLetter" SET "resolutionState"='REPLAYED' WHERE id='dl_a';
        COMMIT;
        """,
    )
    record(group, "effect_commits", rc == 0, f"out={out} err={err}")

    psql(
        "stocky_runtime",
        """
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
        SELECT public.stocky_authz_lock('shop_a','548380010');
        UPDATE public."ShopRoleAssignment" SET "revokedAt"=now() WHERE id='asg_admin_a';
        COMMIT;
        """,
    )
    rc, out, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"PlatformReplayCommand\" WHERE \"commandId\"='cmd1';",
    )
    record(group, "effect_before_revoke_remains", out.strip() == "1", out)

    rc, out, err = psql(
        "stocky_control_plane",
        f"""
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
        SELECT public.stocky_authz_lock('shop_a','548380010');
        SELECT '{MARKER}';
        SELECT c."newJobId" FROM public."PlatformReplayCommand" c
         WHERE c."shopId"='shop_a' AND c."commandId"='cmd1'
           AND c."actorId"='548380010' AND c."requestDigest"='digest-a';
        COMMIT;
        """,
    )
    record(group, "same_command_reconciles_after_revoke", rc == 0 and "job_new1" in out, f"out={out} err={err}")

    rc, out, err = psql(
        "stocky_control_plane",
        f"""
        BEGIN;
        SELECT '{MARKER}';
        SELECT count(*) FROM public."PlatformReplayCommand"
         WHERE "shopId"='shop_a' AND "commandId"='cmd1' AND "actorId"='548380009';
        COMMIT;
        """,
    )
    record(group, "same_command_other_actor_no_row", rc == 0 and last_line(out) == "0", out)

    rc, out, err = psql(
        "stocky_control_plane",
        f"""
        BEGIN;
        SELECT '{MARKER}';
        SELECT count(*) FROM public."PlatformReplayCommand"
         WHERE "shopId"='shop_a' AND "commandId"='cmd1' AND "requestDigest"='digest-OTHER';
        COMMIT;
        """,
    )
    record(group, "changed_digest_no_false_success", rc == 0 and last_line(out) == "0", out)

    rc, out, err = psql(
        "stocky_control_plane",
        """
        BEGIN;
        INSERT INTO public."PlatformReplayCommand"("commandId","shopId","actorId","deadLetterId","originalJobId","requestDigest")
        VALUES ('cmd1','shop_a','548380010','dl_a','job_a','digest-OTHER');
        COMMIT;
        """,
    )
    record(
        group,
        "changed_digest_insert_conflicts",
        rc != 0 and sqlstate_from_err(err) == "23505",
        err,
        sqlstate_from_err(err),
    )

    rc, out, err = psql(
        "stocky_control_plane",
        f"""
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
        SELECT public.stocky_authz_lock('shop_b','548380010');
        SELECT '{MARKER}';
        SELECT public.stocky_verify_platform_assignment('shop_b','548380010','platform.replay.execute');
        COMMIT;
        """,
    )
    record(group, "cross_tenant_denied", rc == 0 and last_line(out) == "f", out)


def g5() -> None:
    group = "G5-barrier"
    barrier = threading.Event()
    held = threading.Event()
    finished: dict[str, str] = {}

    def shared_writer() -> None:
        p = subprocess.Popen(
            PSQL + ["-U", "stocky_runtime"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        assert p.stdin and p.stdout
        p.stdin.write(
            "BEGIN;\nSELECT public.stocky_participating_write_guard('pr7-a.myshopify.com');\nSELECT 'HOLDING';\n"
        )
        p.stdin.flush()
        buf = ""
        start = time.time()
        while time.time() - start < 8:
            line = p.stdout.readline()
            buf += line
            if "HOLDING" in buf:
                held.set()
                barrier.wait(15)
                p.stdin.write("COMMIT;\n")
                stdout, stderr = p.communicate(timeout=10)
                finished["shared"] = stdout
                finished["shared_err"] = stderr
                finished["shared_rc"] = str(p.returncode)
                return
        finished["shared_timeout"] = buf
        p.kill()

    t = threading.Thread(target=shared_writer)
    t.start()
    if not held.wait(8):
        record(group, "shared_writer_acquired", False, "timeout waiting for shared lock")
        barrier.set()
        t.join(3)
        return
    record(group, "shared_writer_acquired", True, "HOLDING")

    wait_ms: list[tuple[int, str, str, float]] = []

    def exclusive_waiter() -> None:
        start = time.time()
        rc, out, err = psql(
            "stocky_control_plane",
            """
            BEGIN;
            SET LOCAL lock_timeout = '2s';
            SELECT public.stocky_lifecycle_exclusive_lock('pr7-a.myshopify.com');
            COMMIT;
            """,
            timeout=8,
        )
        wait_ms.append((rc, out, err, time.time() - start))

    t2 = threading.Thread(target=exclusive_waiter)
    t2.start()
    t2.join(8)
    rc, out, err, elapsed = wait_ms[0] if wait_ms else (-1, "", "no result", 0)
    record(
        group,
        "exclusive_waits_on_shared",
        rc != 0 and elapsed >= 1.5 and "lock timeout" in err.lower(),
        f"rc={rc} elapsed={elapsed:.2f} err={err}",
        sqlstate_from_err(err),
    )
    barrier.set()
    t.join(5)
    record(
        group,
        "shared_writer_committed_before_freeze",
        finished.get("shared_rc") == "0",
        f"shared={finished}",
    )

    psql(
        "pr45owner",
        "UPDATE public.\"ShopInstallGeneration\" SET fence='ERASING' WHERE id='gen_a';",
    )
    rc, out, err = psql(
        "stocky_runtime",
        """
        BEGIN;
        SELECT public.stocky_participating_write_guard('pr7-a.myshopify.com');
        COMMIT;
        """,
    )
    record(group, "new_writer_after_freeze_rejects", rc != 0 and "generation_frozen" in err, err, sqlstate_from_err(err))

    rc, out, err = psql(
        "stocky_runtime",
        """
        BEGIN;
        SELECT public.stocky_participating_write_guard('pr7-a.myshopify.com');
        INSERT INTO public."Shop"(id,"myshopifyDomain") VALUES ('shop_a_boot','pr7-a.myshopify.com');
        COMMIT;
        """,
    )
    record(
        group,
        "bootstrap_same_domain_after_freeze_rejects",
        rc != 0 and "generation_frozen" in err,
        err,
        sqlstate_from_err(err),
    )

    psql(
        "pr45owner",
        "UPDATE public.\"Shop\" SET \"processingEnabled\"=true, \"processingDisabledReason\"=NULL WHERE id='shop_b';",
    )
    rc, out, err = psql(
        "stocky_runtime",
        f"""
        BEGIN;
        SELECT public.stocky_participating_write_guard('pr7-b.myshopify.com');
        SELECT set_config('stocky.current_shop_id','shop_b', true);
        SELECT set_config('stocky.tenant_context_version','phase1-db-tenant-context-v1', true);
        SELECT '{MARKER}';
        SELECT count(*) FROM public."ShopifyOrderFact";
        COMMIT;
        """,
    )
    record(group, "unrelated_shop_continues", rc == 0 and last_line(out) == "1", f"out={out} err={err}")

    rc, out, err = psql(
        "stocky_control_plane",
        "INSERT INTO public.\"DurableJob\"(id,\"shopId\",\"jobType\",state) VALUES ('job_uninstrumented','shop_a','orders/create','PENDING');",
    )
    record(
        group,
        "uninstrumented_cp_writer_still_inserts_limit",
        rc == 0,
        "LIMIT: control-plane tables have no RLS; uninstrumented writers must be drained before privacy enablement",
    )

    psql(
        "pr45owner",
        """
        UPDATE public."PrivacyAttempt" SET state='LOST', "leaseUntil"=now()-interval '1 minute' WHERE id='patt_sr';
        INSERT INTO public."PrivacyAttempt"(id,"privacyRequestId",epoch,state,"leaseUntil")
        VALUES ('patt_sr2','preq_sr',2,'RUNNING', now()+interval '1 hour');
        UPDATE public."PrivacyRequest" SET "activeAttemptId"='patt_sr2' WHERE id='preq_sr';
        """,
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_red",
        "preq_sr",
        "patt_sr",
        "SELECT public.stocky_privacy_capability_allows('DELETE_SHOP','shop_red');",
    )
    record(group, "lost_epoch_capability_false", rc == 0 and last_line(out) == "f", f"out={out} err={err}")
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_red",
        "preq_sr",
        "patt_sr2",
        "SELECT public.stocky_privacy_capability_allows('DELETE_SHOP','shop_red');",
    )
    record(group, "new_epoch_capability_true", rc == 0 and last_line(out) == "t", f"out={out} err={err}")


def g6() -> None:
    group = "G6-tombstone"
    psql(
        "pr45owner",
        """
        INSERT INTO public."PrivacyDeliveryTombstone"("shopifyWebhookId",topic,"privacyRequestId","generationId","resultState","expiresAt")
        VALUES ('wh-old','shop/redact','preq_sr','gen_red','COMPLETED', now()+interval '7 days');
        INSERT INTO public."PrivacyDeliveryTombstone"("shopifyWebhookId",topic,"privacyRequestId","generationId","resultState","expiresAt")
        VALUES ('wh-expired','shop/redact','preq_sr','gen_red','COMPLETED', now()-interval '1 day');
        """,
    )
    rc, out, _ = psql(
        "stocky_control_plane",
        f"""
        SELECT '{MARKER}';
        SELECT "resultState" FROM public."PrivacyDeliveryTombstone"
        WHERE "shopifyWebhookId"='wh-old' AND "expiresAt" > now();
        """,
    )
    record(group, "post_prune_duplicate_reconciles", rc == 0 and "COMPLETED" in out, out)

    rc, out, _ = psql(
        "stocky_control_plane",
        f"""
        SELECT '{MARKER}';
        SELECT count(*) FROM public."PrivacyDeliveryTombstone"
        WHERE "shopifyWebhookId"='wh-expired' AND "expiresAt" > now();
        """,
    )
    record(group, "expired_tombstone_uncorrelated", rc == 0 and last_line(out) == "0", out)

    rc, out, _ = psql(
        "pr45owner",
        f"""
        INSERT INTO public."PrivacyRequest"(id,topic,state,"targetShopId","generationId","activeAttemptId")
        VALUES ('preq_newgen','shop/redact','RECEIVED','shop_new','gen_new',NULL);
        SELECT '{MARKER}';
        SELECT "generationId" FROM public."PrivacyDeliveryTombstone" WHERE "shopifyWebhookId"='wh-old';
        """,
    )
    gens = proof_lines(out)
    record(
        group,
        "new_generation_not_inheriting_old_completion",
        gens == ["gen_red"],
        out,
    )


def main() -> int:
    reset()
    g1()
    g2()
    g3()
    g4()
    g5()
    g6()
    failed = [r for r in RESULTS if not r["ok"]]
    payload = {
        "postgres": "16.15",
        "host": "/tmp/pr45-pg16:5433",
        "total": len(RESULTS),
        "pass": len(RESULTS) - len(failed),
        "fail": len(failed),
        "results": RESULTS,
        "failed": failed,
    }
    path = "/tmp/pr45-proof/results.json"
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
    print(json.dumps({"total": payload["total"], "pass": payload["pass"], "fail": payload["fail"]}, indent=2))
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())

```
