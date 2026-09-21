# Phase 1 PR7 — Audit, roles, and privacy acceptance matrix

**Status:** **PROPOSED — ONE-DEPENDENCY-AHEAD — NOT IMPLEMENTATION AUTHORITY**

Companion plan: `stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md`

Immutable independent reviews (byte-for-byte; do not edit):

- `stocky-plus/docs/phases/phase-1/PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md` (blob `c1fa5c2fed74bf80d1006267b43d767258895c17`)
- `stocky-plus/docs/phases/phase-1/PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md` (blob `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f`)
- `stocky-plus/docs/phases/phase-1/PR7_TOPIC_AUTHORITY_FINALIZATION_INDEPENDENT_REVIEW.md` (blob `e609e9526ed1ec043551ca68d6b977f5b5935d0c`)
- `stocky-plus/docs/phases/phase-1/PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md` (blob `e908770d9daea4f963b2fd09e38af79e07274d41`)
- `stocky-plus/docs/phases/phase-1/PR7_GENERATION_W_INTEGRATION_INDEPENDENT_REVIEW.md` (blob `1d93b85aa8f61a6255fe2408148f1e5ea97c0b70`)
- `stocky-plus/docs/phases/phase-1/PR7_TEMPORAL_ATTRIBUTION_WRITER_COVERAGE_INDEPENDENT_REVIEW.md` (blob `b7e8ff338e715c79907aa633c75622958f60b4d4`)
- `stocky-plus/docs/phases/phase-1/PR7_DURABLE_ORIGIN_CORRECTION_INDEPENDENT_REVIEW.md` (blob `21b11b4af0adfce8e7044a40131190f001e9756e`)
- `stocky-plus/docs/phases/phase-1/PR7_ADMIN_ORIGIN_EFFECT_BINDING_INDEPENDENT_REVIEW.md` (blob `0c3182469f26b97beb4c23f86fcc2906d11adb5c`)

These rows are **test-executable in specificity**. They are documentation. They are **not** passing CI on a runtime implementation.

Fixture **values** are **synthetic**. Documented Shopify payload **field names** are not synthetic. No merchant or customer production data.

ChatGPT’s 2026-09-18 topic-authority comment 5729229659 remains current for Decisions A–E. Comment [5737038796](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5737038796) remains the customer-completion/epoch supplement. Comment [5747828826](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5747828826) remains current for **Decision CC-GEN** and closed **F-CLAUDE-PR7CC-01…04**. Comment [5750220159](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5750220159) remains current for independently closed **F-CLAUDE-PR7GW-02** and the GW-01 overlap defect. Comment [5751868329](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5751868329) remains current for independently closed **F-CLAUDE-PR7TA-01** core mechanism and **TA-02**. Comment [5752617452](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5752617452) remains the DO-01/02 work order. Comment [5753473534](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5753473534) is current for **F-CLAUDE-PR7AO-01…05**. None of those comments accept the whole plan or authorize PR7 runtime.

Original fixture and row IDs are preserved. New IDs continue existing prefixes. Designed fixtures are **not** passing processors.

---

## 0. How to read a row

| Column | Meaning |
|---|---|
| ID | Stable local test id |
| Req | Requirement source |
| Pre-state | Database / session / queue before the action |
| Action | Event under test |
| Expected | Required outcome |
| Forbidden | Must not happen |
| Evidence | How the future test proves it |
| Home | Eventual command / file |
| Owner | Future implementation owner (Cursor lane) |
| Now | `designed` (this packet; not a passing processor test) vs `present-on-V-not-executed` (suite exists on V; this session did not run it) vs `executed-this-planning-session` (command ran in **this** correction session) vs `executed-prior-planning-head-not-re-run` (ran on an earlier planning head; not claimed current-executed) vs `executed-synthetic-pg16` (disposable cluster; not PR7 processors) |

Do not label a command both `executed-this-planning-session` and not rerun. A filename or a blocked attempt is **not** an execution result. Disposable PG proofs are **not** PR7 processor passes.

---

## 1. Complete-module exit criteria (PR7 repository)

All must be true on the exact **implementation** head before ChatGPT acceptance. None of these is certified by this docs PR.

- [ ] HMAC-invalid compliance POST returns 401; valid HMAC acks 200 only after durable `PrivacyRequest` (or proven **delivery-id** duplicate in `PrivacyDeliveryBinding` **or** unexpired `PrivacyDeliveryTombstone`). Invalid authentication remains rejected. Expired tombstone is uncorrelated, not a reconstructed bind.
- [ ] `customers/data_request`, `customers/redact`, `shop/redact` processors exist, are idempotent, checkpointed, and covered by `npm run test:privacy` with **nonzero** tests.
- [ ] Shop/redact residual probe is empty except `PrivacyCompletionReceipt` + `ShopInstallGeneration` `fence=ERASED` + counsel holds (empty hold set unless Q-008 says otherwise). **No** leftover tenant-linked `AuditEvent` or `Shop` row. A receipt **cannot** override observed remnants.
- [ ] Deletion manifests and final receipts never contain customer email/phone/tokens/raw payloads/raw headers. Operational `PrivacyDeliveryBinding` is pruned after the erasure/replay window and is **not** the D-021 receipt.
- [ ] `AuditEvent` is append-only for `stocky_runtime`; while disabled, progress is `PrivacyCoordinatorEvent` on the control-plane path (runtime INSERT is denied). Privacy-erasure DELETE of tenant-linked audit is shop-scoped and tested; failed writes do not create `*_COMPLETED`.
- [ ] Platform permission checks run on the server; UI omission is insufficient; default deny; user-supplied role/shop/actor/`account_owner` ignored.
- [ ] First staff/collaborator/empty assignments/`sessionToken.sub` alone do **not** become `shop_owner`. Unsafe numeric owner correlation is `OWNER_PROOF_UNSUPPORTED`.
- [ ] Uninstall still disables immediately; session delete is **asserted**; **this generation** `ERASING`/`FINALIZING`/`REDACTED` cannot be revived; a **new** generation after `fence=ERASED` can install.
- [ ] Human replay/export: current actor authorization, stable `commandId`, and enqueue serialize on the control-plane transaction via `stocky_authz_lock` + SELECT-only `stocky_verify_platform_assignment`. Callers cannot relabel a human command as autonomous. Export revalidates before **publication/download**.
- [ ] Verified privacy work (`PrivacyRequest` + `PrivacyAttempt` + topic capability + generation) runs while processing is disabled **without** re-enabling the shop or using runtime policies that require `processingEnabled`. Privacy is **not** a Shop-linked `DurableJob`. Unknown ordinary job types remain `NO_AUTOMATIC_RETRY` / denied.
- [ ] Privacy-coordinator isolation tests exist (replace the F-PR3-16 deferral sentence for the privacy path only; export/reconciliation may remain deferred until PR8).
- [ ] Exact-head **full** CI green on the runtime PR (docs-only is **not** sufficient for implementation).
- [ ] Independent Claude Tier-A review of the exact head with **no unresolved P0/P1/P2**; each P3 has explicit disposition.
- [ ] Q-008 / Partner privacy-policy language remain **OPEN** until legal/staging evidence; not waived by green tests.

---

## 2. Small fast red/green suite (development)

**PROPOSED** `npm run test:privacy` (must fail if zero tests collected):

```text
app/privacy/**/*.test.ts
app/rbac/**/*.test.ts
app/audit/**/*.test.ts
app/routes/__tests__/webhooks.compliance.test.ts
app/tenant/__tests__/db-isolation/privacy-surfaces.test.ts
```

Plus keep, as a **required companion** during PR7 development (existing):

```text
npm run test:sync-uninstall
npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-control-plane.test.ts
npx vitest run app/lib/order-facts/admin-read/mutation-safety.test.ts
```

---

## 3. Relevant full CI (runtime PR, not this docs PR)

Per `CI_POLICY.md` and `.github/workflows/ci.yml`:

- Classify (docs-only vs full);
- Heavy job: lint, typecheck, `npm test`, `test:db-isolation`, `test:tenant-access`, `test:sync-integration` (includes uninstall), Prisma, GraphQL, **new** `test:privacy`;
- CI Gate.

**PROPOSED skip (not a waiver):** Partner Dashboard live HMAC against a real shop; legal-counsel sign-off; production backup/restore of a redacted shop; million-line D scratch at PR7 unless D is merged and ChatGPT asks for a focused probe.

---

## 4. Independent Tier-A review targets

Reviewer must inspect, not trust summaries:

- actor derivation cannot be forged from JSON/query/header; owner bootstrap cannot use first-login; canonical actor is verified `sessionToken.sub` digit string;
- numeric/string Shopify user ids are preserved without lossy coercion; unsafe `associated_user.id` correlation is `OWNER_PROOF_UNSUPPORTED`, not a grant;
- RLS + grants on new tables (exact catalog, not names), including `stocky_privacy_reader` / `stocky_privacy_erasure` policies that **omit** `processingEnabled` and require topic-capable `stocky_privacy_capability_allows` + row manifest;
- runtime policies **KEEP** processingEnabled; no PUBLIC/runtime privacy policy OR leakage; DELETE USING only (no invented WITH CHECK);
- audit trigger forbids UPDATE/DELETE for runtime; privacy-erasure DELETE is shop-scoped only; coordinator journal while disabled (no runtime `AuditEvent` INSERT);
- completion receipt has no Shop FK, is bound to request+generation+target, and is not claimed anonymous; old receipt cannot skip a newer generation;
- no one transaction across `stocky_control_plane` and `stocky_privacy_erasure`; no RLS disablement; advisory authz lock + SELECT-only verifier on the CP replay txn;
- verified privacy work uses the named intake→coordinator poll/claim→topic principal path while disabled; **not** `createDurableJob`/fair-claim; unknown ordinary types denied;
- human replay/export revalidation after lock acquisition; revoke-before-effect vs effect-before-revoke timelines;
- `shop/redact` vs reinstall uses §7.6.1 classifier / `ESCALATED`, not domain HMAC or timestamps;
- customer lookup keys survive retries; empty export only after complete-scan;
- owner-only `platform.privacy.data_request.download` distinct from `platform.export.operational`;
- named escalation interfaces (owner view + operator CLI); evidence-less resolve rejected;
- residual probe completeness vs plan §7.6.3; checked `stocky_privacy_finalize_shop_delete`; surviving coordinator FK;
- D scratch/job types **only if** those files exist on the implementation base;
- no unresolved P0/P1/P2; P3s explicitly dispositioned.

---

## 5. Designed fixtures (synthetic)

### FXT-SHOPS

```json
{
  "shopA": { "myshopifyDomain": "pr7-a.myshopify.com", "shopId": "shop_a_cuid" },
  "shopB": { "myshopifyDomain": "pr7-b.myshopify.com", "shopId": "shop_b_cuid" }
}
```

### FXT-USERS

```json
{
  "ownerA": { "shopifyUserId": "548380009", "accountOwner": true, "email": "owner-a@example.test", "emailVerified": true },
  "staffA": { "shopifyUserId": "548380010", "accountOwner": false, "collaborator": false, "email": "staff-a@example.test", "emailVerified": true },
  "collabA": { "shopifyUserId": "548380012", "accountOwner": false, "collaborator": true, "email": "collab-a@example.test", "emailVerified": true },
  "staffAUnverified": { "shopifyUserId": "548380011", "email": "unverified@example.test", "emailVerified": false },
  "ownerB": { "shopifyUserId": "548380009", "note": "same external user id on a different shop" },
  "wideId": { "shopifyUserId": "9007199254740993", "note": "larger than Number.MAX_SAFE_INTEGER; must remain exact decimal string; owner grant unsupported via Number(associated_user.id)" }
}
```

Store and compare `shopifyUserId` as decimal digit strings from verified `sessionToken.sub`. Do not coerce through IEEE-754 `Number`. Do not persist `String(associated_user.id)` or `Session.userId`.

### FXT-WIDE-OWNER-UNSUPPORTED

```json
{
  "sessionTokenSub": "9007199254740993",
  "associatedUserIdNumber": 9007199254740992,
  "note": "Number('9007199254740993') === 9007199254740992 (executed this session, Node v22.14.0). Corroboration fails. Persist sub. OWNER_PROOF_UNSUPPORTED. Not shop_owner."
}
```

### FXT-COMPLIANCE-DATA-REQUEST

```json
{
  "shop_id": 954889,
  "shop_domain": "pr7-a.myshopify.com",
  "orders_requested": [299938],
  "customer": { "id": 191167, "email": "john@example.test", "phone": "555-625-1199" },
  "data_request": { "id": 9999 }
}
```

(Documented field names from Shopify privacy-law-compliance, accessed 2026-09-18; **values** synthetic.)

### FXT-COMPLIANCE-CUSTOMER-REDACT

```json
{
  "shop_id": 954889,
  "shop_domain": "pr7-a.myshopify.com",
  "customer": { "id": 191167, "email": "john@example.test", "phone": "555-625-1199" },
  "orders_to_redact": [299938]
}
```

### FXT-COMPLIANCE-SHOP-REDACT

```json
{
  "shop_id": 954889,
  "shop_domain": "pr7-a.myshopify.com"
}
```

Identical JSON bodies across generations are **not** a work identity.

### FXT-DELIVERIES

```json
{
  "whIdGen1": "webhook-id-gen1-delivery-aaaa",
  "eventIdGen1": "event-id-gen1-merchant-action",
  "whIdGen1Retry": "webhook-id-gen1-delivery-aaaa",
  "whIdGen2New": "webhook-id-gen2-delivery-bbbb",
  "eventIdGen2": "event-id-gen2-merchant-action",
  "whIdConflict": "webhook-id-conflict-cccc",
  "eventIdReusedIncompatible": "event-id-gen1-merchant-action",
  "digestA": "sha256:synthetic-body-a",
  "digestB": "sha256:synthetic-body-b"
}
```

Do **not** fabricate header presence. If `X-Shopify-Event-Id` is missing, `eventId=null`; missing event id is not 401.

### FXT-EXPECTED-EMPTY-CUSTOMER-SCAN

On V-like data (no customer GID columns; sanitizers omit customer/email/phone):

```json
{
  "surfacesMatched": "not assumed zero",
  "orderGidProbed": "gid://shopify/Order/299938",
  "customerIdProbed": "191167",
  "surfacesRequired": [
    "ShopifyOrderFact",
    "ShopifyOrderLineFact",
    "ShopifyOrderRefundFact",
    "ShopifyOrderRefundLineFact",
    "ShopifyOrderAdjustmentFact",
    "ShopifyOrderAgreementFact",
    "ShopifyOrderAgreementSaleFact",
    "ShopifyOrderRefundTransactionFact",
    "SalesDailyAggregate",
    "SyncApplicationReceipt"
  ],
  "validEmptyOnlyIf": "every required surface was scanned with the lookup keys; then manifestLines may be skipped_absent with rowCount 0"
}
```

Do **not** treat “no customer column on ShopifyOrderFact” as proof of emptiness.

### FXT-AUDIT-SUCCESS-FORBIDDEN

A failed `replayDeadLetter` or denied permission **must not** insert `AuditEvent` with `action=REPLAY_REQUESTED` and `decision=completed`. While `processingEnabled=false`, privacy progress **must not** INSERT merchant `AuditEvent`; use `PrivacyCoordinatorEvent`.

### FXT-MANIFEST-NO-PII

Manifest JSON must not match `/@|\\+1\\d|shpat_|shppa_|accessToken/`.

### FXT-COMPLETION-RECEIPT

Receipt row may contain `privacyRequestId`, `generationId`, `topic`, `completedAt`, `manifestDigest`, `shopDomainHmac`, `targetShopIdHmac`. Forbidden: cleartext domain, `shopId` FK, customer id, order ids, `data_request.id`, webhook ids, unsalted SHA256 claimed as anonymous, using the receipt as a domain-wide skip token.

### FXT-GENERATIONS

```json
{
  "gen1Uninstalled": { "id": "gen_1", "domain": "pr7-a.myshopify.com", "targetShopId": "shop_a_cuid", "fence": "UNINSTALLED", "erasedAt": null },
  "gen1Erased": { "id": "gen_1", "domain": "pr7-a.myshopify.com", "targetShopId": "shop_a_cuid", "fence": "ERASED", "erasedAt": "2026-09-01T12:00:00.000Z", "receiptBound": true },
  "gen1Finalizing": { "id": "gen_1", "domain": "pr7-a.myshopify.com", "fence": "FINALIZING", "erasedAt": null },
  "gen2Live": { "id": "gen_2", "domain": "pr7-a.myshopify.com", "shopId": "shop_a2_cuid", "fence": "LIVE", "processingEnabled": true },
  "gen2Uninstalled": { "id": "gen_2", "domain": "pr7-a.myshopify.com", "targetShopId": "shop_a2_cuid", "fence": "UNINSTALLED", "erasedAt": null, "processingEnabled": false }
}
```

### FXT-ESCALATION-EVIDENCE

```json
{
  "schema": "escalation_evidence_v1",
  "privacyRequestId": "preq_synthetic",
  "rowVersion": 1,
  "targetGenerationId": "gen_1",
  "decisionAllowed": ["bind_old_target", "schedule_remnants_erase", "leave_escalated"],
  "decisionForbidden": ["retain_live", "mark_complete"]
}
```

---

## 6. Test rows

### 6.1 Actor and authority

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-ACT-001 | brief actor; PR2 contract | Shop A exists; admin session shop=A | `requireAdminTenant` | `tenant.shopId=shop_a` | using query `shop=B` | existing assertion `"verified Shop A resolves to Shop A authority"` | `authority.test.ts` | PR2 (preserve) | **present-on-V-not-executed** (Postgres blocked this session) |
| PR7-ACT-002 | client shop cannot create authority | Shop A+B | query/header/JSON/form `shop=B` | `client_shop_conflict` | tenant B | existing | `authority.test.ts` | PR2 | **present-on-V-not-executed** |
| PR7-ACT-003 | D-PR7-01 | verified `sessionToken.sub="548380009"` | platform action | actor = that **exact** digit string | body `actorId`; `Session.userId`; `String(associated_user.id)` | new | `app/rbac/actor.test.ts` | PR7 | designed |
| PR7-ACT-004 | D-PR7-01/02 | offline-only / online-tokens-OFF session | platform action | actor from verified JWT `sub` **string** when the installed library binds it (Helper A **PREP-A-01** with `useOnlineTokens: false`). **Not** owner. Online tokens are **not** required for actor identity | inventing actor or `shop_owner`; enabling online tokens merely to obtain `sub` | new; **prove library fields at implementation**; live bind remains **UNVERIFIED** | `app/rbac/actor.test.ts` | PR7 | designed |
| PR7-ACT-005 | D-PR7-01 | neither online user nor `sub` | `platform.replay.execute` | deny + `AUTH_PLATFORM_DENIED` | silent owner fallback | new | `app/rbac/actor.test.ts` | PR7 | designed |
| PR7-ACT-006 | forged role | assignment `unassigned` | JSON `{role:"shop_owner"}` | deny | grant | new | `app/rbac/require-permission.test.ts` | PR7 | designed |
| PR7-ACT-007 | same external user id cross-shop | ownerA on A and ownerB same id on B | A request | only A assignments | reading B assignment | new | `app/rbac/assignment.test.ts` | PR7 | designed |
| PR7-ACT-008 | unverified email | `emailVerified=false` | persist staff | email column null | storing unverified email | new | `app/rbac/assignment.test.ts` | PR7 | designed |
| PR7-ACT-009 | webhook actor | HMAC compliance | intake | `actorKind=shopify_webhook` | treating as shop_owner | new | `app/privacy/intake.test.ts` | PR7 | designed |
| PR7-ACT-010 | privacy worker actor | privacy job envelope | apply | `actorKind=system`, causation=job id; **does not** use staff permission | copying a revoked human grant | new | `app/privacy/worker.test.ts` | PR7 | designed |
| PR7-ACT-011 | scopes_update | session row | webhook | scope string updates | changing shopId | existing route unproven | `webhooks.app.scopes_update.tsx` | PR7 may add test | designed |
| PR7-ACT-012 | ID token ≠ access token | documented | comment/test name | tests do not send ID token to Admin API | — | review | plan §3 | PR7 | designed |
| PR7-ACT-013 | P7-C01 first staff | empty assignments; staffA online `account_owner=false` | afterAuth / platform check | `unassigned`; `owner_assignment_pending` | `shop_owner` | new | `assignment.bootstrap.test.ts` | PR7 | designed |
| PR7-ACT-014 | P7-C01 first collaborator | empty assignments; collabA | afterAuth | `unassigned` | `shop_owner` | new | same | PR7 | designed |
| PR7-ACT-015 | P7-C01 unknown owner | empty assignments; only `sessionToken.sub` | afterAuth | `unassigned`; no owner invented | grant from `sub` | new | same | PR7 | designed |
| PR7-ACT-016 | P7-C01 mismatched dest | `sessionToken.sub` user of A; `dest` shop B | platform action | deny | tenant A grant | new | `app/rbac/actor.test.ts` | PR7 | designed |
| PR7-ACT-017 | P7-C01 concurrent bootstrap | two first staff sessions, neither `account_owner` | parallel assignment insert | both `unassigned`; zero `shop_owner` | race to owner | new | assignment race test | PR7 | designed |
| PR7-ACT-018 | P7-C01 / F-CLAUDE-PR7CP-05 identity width | FXT-USERS `wideId` `sessionToken.sub` | persist/compare actor | stored string `9007199254740993` | `Number()` rounding of the actor key | new | actor.test.ts | PR7 | designed |
| PR7-ACT-019 | P7-C01 forged account_owner | body/session row `accountOwner=true` but live `associated_user.account_owner=false` | bootstrap | `unassigned` | grant | new | same | PR7 | designed |
| PR7-ACT-020 | P7-C01 real owner proof | online `associated_user.account_owner=true`, non-collaborator, **safe-integer** `id` corroborates sub `548380009`, same shop | bootstrap | `shop_owner` | requiring a prior assignment; using a different user’s owner bit | new | same | PR7 | designed |
| PR7-ACT-021 | F-CLAUDE-PR7CP-05 | FXT-WIDE-OWNER-UNSUPPORTED | bootstrap owner proof | persist sub `9007199254740993`; `OWNER_PROOF_UNSUPPORTED`; `unassigned` | `shop_owner`; `String(associated_user.id)` as key | new | assignment.bootstrap.test.ts | PR7 | designed |
| PR7-ACT-022 | F-CLAUDE-PR7CP-05 adjacent collision | two subs `9007199254740992` and `9007199254740993` | persist/compare | distinct actor rows | collapsing via Number | new | actor.test.ts | PR7 | designed |
| PR7-ACT-023 | F-CLAUDE-PR7CP-05 mismatch/expiry | sub A; associated_user.id B; or expired session; or shop mismatch | platform / bootstrap | deny / `unassigned` | copying owner boolean onto unrelated sub | new | actor.test.ts | PR7 | designed |
| PR7-ACT-024 | D-PR7-02 / PR48 mixedToken + stale-cache | Helper A **PREP-A-09** / NC-07 wide-id B then A (`mixedToken: true`); Helper A **PREP-A-11** / NC-09 stale cache (`associated_user.id=111`, **zero** token exchanges) | any online credential use or bootstrap/hook effect | per-user cache isolation and retained original actor binding **before** exchange/effects; reject mixed/stale; unknown stay `unassigned` | enabling current online-session path merely because it produces `associated_user`; after-the-fact actor check undoing an already used wrong token | FACT (PR48) synthetic probes — **not** this session; future implementation tests | `shopify.server.ts` adapter + session cache | PR7 | designed |
| PR7-ACT-025 | D-PR7-01 dest/iss | signed token with mismatched `iss`/`dest` host | authenticate / exchange | app-code hostname agreement **before** effects (coordinator **PREP-A-04** `destMismatchRejectedByLibrary: false`) | assuming the installed library already rejects dest/iss mismatch | FACT (PR48) coordinator PREP-A-04 | app dest/iss check | PR7 | designed |

### 6.2 RBAC matrix

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-RBAC-001 | matrix | `shop_owner` | administer roles | allow + `ROLE_ASSIGNED` audit | unassigned doing it | new | `require-permission.test.ts` | PR7 | designed |
| PR7-RBAC-002 | matrix | `shop_admin` | administer roles | deny + `PERMISSION_DENIED` | assignment change | new | same | PR7 | designed |
| PR7-RBAC-003 | matrix | `shop_admin` | replay | allow wrapper call into `replayDeadLetter` with tenant shopId **after** lock+revalidation on the CP txn | body shopId of B | new | `app.platform.replay` test | PR7 | designed |
| PR7-RBAC-004 | matrix | `platform_auditor` | replay | deny | new durable job | new | same | PR7 | designed |
| PR7-RBAC-005 | matrix | `platform_auditor` | audit.read | allow rows (pre-redact) | seeing legal-hold payloads | new | audit reader test | PR7 | designed |
| PR7-RBAC-006 | matrix | `unassigned` | sync_health.read | deny | health JSON | new | same | PR7 | designed |
| PR7-RBAC-007 | matrix | any staff | `platform.privacy.process` via UI | deny | staff-triggered erase | new | same | PR7 | designed |
| PR7-RBAC-008 | D-PR7-07 | `unassigned` | `app.purchase-orders` loader | still `requireAdminTenant` only | accidental 403 from platform matrix | new regression | merchandising route test | PR7 | designed |
| PR7-RBAC-009 | export | `shop_admin` | `platform.export.operational` | allow | auditor export; treating this as data_request download | new | export test | PR7 | designed |
| PR7-RBAC-010 | P7-C04 / D-PR7-12 | replay job **not yet** created; owner revokes admin **before** CP `replayDeadLetter` txn | click/worker that would enqueue | `REPLAY_DENIED`; no `DurableJob`/`JobReplay` | completing as `actorKind=system` | new | replay worker test | PR7 | designed |
| PR7-RBAC-011 | default deny | unknown permission key | check | throw fail-closed | allow | new | permissions.ts test | PR7 | designed |
| PR7-RBAC-012 | P7-C01 | first **safe-integer** `account_owner` online matching sub | afterAuth | `shop_owner` assignment | first collaborator owner | new | assignment bootstrap test | PR7 | designed |
| PR7-RBAC-013 | revoke before enqueue | assignment revoked | replay click | deny; no job | allow | new | same | PR7 | designed |
| PR7-RBAC-014 | UI hide ≠ auth | hidden button | direct POST | deny | success | new | route test | PR7 | designed |
| PR7-RBAC-015 | P7-C04 / F-CLAUDE-PR7CP-06 before commit | CP `replayDeadLetter` txn open; revoke committed first (runtime `FOR UPDATE` assignment → `revokedAt`) | helper lock then revalidate | `stocky_lock_platform_assignment` returns false → `REPLAY_DENIED`; rollback CP txn; no job | two-role atomic abort; merchant-fact txn as the protected effect | new | replay + lock helper | PR7 | designed |
| PR7-RBAC-016 | P7-C04 after commit | committed authorized `JobReplay`; then revoke | retry **same** command id | reconcile existing ids; **no** second job; do not report as never-happened | using stale grant to create new work | new | same | PR7 | designed |
| PR7-RBAC-017 | P7-C04 export | export job queued; revoke before **publication/download** | worker/download | fail closed; no release to caller | treating temp blob write as the protected effect | new | export worker | PR7 | designed |
| PR7-RBAC-018 | P7-C04 autonomous privacy | staff revoked; privacy job running | privacy worker tick | privacy continues | requiring the revoked user’s permission | new | privacy worker | PR7 | designed |
| PR7-RBAC-019 | F-CLAUDE-PR7CP-06 revoke-before-effect timeline | assignment row unlocked | runtime revoke txn then later replay CP txn | documented order: assignment `FOR UPDATE` → `revokedAt` commit → helper sees revoked | cached pre-lock snapshot allowing replay | new | assignment lock helper test | PR7 | designed |
| PR7-RBAC-020 | F-CLAUDE-PR7CP-06 effect-before-revoke | CP txn: helper true → insert job/replay/DL → commit; later revoke | observe | effect **remains**; DL `REPLAYED` | deleting the committed command because of later revoke | new | same | PR7 | designed |
| PR7-RBAC-021 | F-CLAUDE-PR7CP-06 no relabel | human replay request | envelope/jobType | server-derived `replay:*` (or existing DL replay type); `actorKind` stays human causation | client `jobType=privacy:*` or `actorKind=system` | new | replay route + envelope | PR7 | designed |

### 6.3 Audit

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-AUD-001 | immutable | insert event | `UPDATE AuditEvent SET decision='completed'` as runtime | error / 0 rows | rewrite | new | `audit/immutability.test.ts` | PR7 | designed |
| PR7-AUD-002 | immutable | insert | `DELETE` as runtime | 0 rows | delete | new | same | PR7 | designed |
| PR7-AUD-003 | failed write | replay denied disabled shop | existing `replay_denied_disabled_shop` | `REPLAY_DENIED` or none of completed | `decision=completed` | new + preserve integration | `replay` wrapper | PR7 | designed |
| PR7-AUD-004 | permission fail | unassigned replay | deny | `PERMISSION_DENIED`; no replay job | completed audit | new | rbac | PR7 | designed |
| PR7-AUD-005 | idempotency | duplicate emit key | second insert | same id | two rows | new | audit emit | PR7 | designed |
| PR7-AUD-006 | minimization | data_request intake | persist coordinator/audit | no raw email/phone in minimized payload | durable email | new | privacy intake | PR7 | designed |
| PR7-AUD-007 | correlation | admin replay | emit | event.correlationId present and shop-scoped | missing shopId | new | audit emit | PR7 | designed |
| PR7-AUD-008 | privacy system actor / F-CLAUDE-PR7CP-02 | privacy checkpoint while disabled | write progress | `PrivacyCoordinatorEvent` `actorKind=system` on CP | merchant `AuditEvent` INSERT by runtime | new | privacy worker | PR7 | designed |
| PR7-AUD-009 | P7-C02 shop/redact | events exist | redact | tenant-linked `AuditEvent` **deleted** via privacy-erasure; receipt FXT-COMPLETION-RECEIPT | in-place UPDATE; leftover tenant audit; email on receipt | new | shop redact | PR7 | designed |
| PR7-AUD-010 | not a second ledger | apply order fact | apply | no extra “canonical fact audit” besides existing receipt | duplicating C receipts as AuditEvent content | review | plan D-PR7-03 | PR7 | designed |
| PR7-AUD-011 | P7-C02 privilege | privacy-erasure role + valid request GUC | `DELETE AuditEvent` shop A | A rows gone; B intact | RLS disable; DELETE B; using runtime DELETE policy | new | audit/privacy-erasure.test.ts | PR7 | designed |
| PR7-AUD-012 | P7-C02 rollback | populated AuditEvent | “rollback” plan | processors disabled; tables remain | drop populated audit tables as general rollback | review + test name | plan §7.7 | PR7 | designed |
| PR7-AUD-013 | F-CLAUDE-PR7CP-02 coordinator | `processingEnabled=false` REDACTED | privacy step | coordinator row; no runtime audit INSERT | relying on `stocky_runtime` INSERT while disabled | new | privacy-erasure + CP | PR7 | designed |
| PR7-AUD-014 | F-CLAUDE-PR7CP-02 0-row vs error | disabled shop; runtime role | INSERT `AuditEvent`; SELECT/DELETE facts | INSERT **error** (WITH CHECK); SELECT/DELETE **0 rows** (USING filter) | assuming every denial throws | new | privacy-surfaces / sql policy tests | PR7 | designed |

### 6.4 Lifecycle (uninstall / reinstall / classifier)

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-LIFE-001 | D-021 uninstall | cancellable jobs | `processUninstall` | `processingEnabled=false`, jobs `CANCELLED` | leftover RUNNING without cancel | existing `sync-uninstall.test.ts` | `sync-uninstall.test.ts` | PR4 preserve | **present-on-V-not-executed** (Postgres/Redis blocked this session) |
| PR7-LIFE-002 | session wipe | Session rows for shop | uninstall | `sessionsDeleted>=1` and count 0 | tokens remain | **new assertion** | extend `sync-uninstall.test.ts` | PR7 | designed |
| PR7-LIFE-003 | session wipe fail | deleteSessions throws | uninstall | shop stays disabled | re-enable | new | same | PR7 | designed |
| PR7-LIFE-004 | duplicate uninstall | already UNINSTALLED | second webhook | idempotent disable | processing true | existing | `sync-uninstall.test.ts` | PR4 | **present-on-V-not-executed** |
| PR7-LIFE-005 | reinstall UNINSTALLED | disabled UNINSTALLED; **no** ERASING/FINALIZING fence | afterAuth | `processingEnabled=true` | stuck disabled | **new** | reinstall test | PR7 | designed |
| PR7-LIFE-006 | D-PR7-06 | **this generation** `REDACTED`/`ERASING`/`FINALIZING` incomplete | afterAuth | no enqueue; no ShopSettings repair; `reinstall_denied` / fence deny | catalog job | **new** | `after-auth` test | PR7 | designed |
| PR7-LIFE-007 | MANUAL | MANUAL disable | afterAuth | no auto enable | enable | **new** | reinstall test | PR7 | designed |
| PR7-LIFE-008 | P7-C03 | FXT-GENERATIONS gen1 uninstalled + gen2 live; **new** delivery | `shop/redact` | `ESCALATED`; live shop retained | timestamp `SUPERSEDED`; erase gen2; HMAC receipt skip | new | privacy shop-redact | PR7 | designed |
| PR7-LIFE-009 | enqueue-before-uninstall | PENDING job then uninstall | cancel | job cancelled | worker applies after disable (existing PR4 race rules) | existing + preserve | uninstall/intake | PR4/PR7 | designed |
| PR7-LIFE-010 | stale reinstall job | REDACTED generation; old queued envelope | worker | fail closed | applying facts | new | privacy + envelope | PR7 | designed |
| PR7-LIFE-011 | P7-C03 / F-CLAUDE-PR7CP-01 delayed **positively correlated** retry | gen1 erased + receipt bound to request R1 + `whIdGen1`; gen2 live; POST **same** `shopifyWebhookId` already in `PrivacyDeliveryBinding` | POST | return **old** request R1 outcome; gen2 intact | treating identical JSON/domain HMAC as correlation; erase gen2 | new | shop-redact classifier | PR7 | designed |
| PR7-LIFE-012 | P7-C03 duplicate delivery | existing shop/redact RECEIVED bound to `whIdGen1` | second POST same `shopifyWebhookId` | same `PrivacyRequest`; `duplicateCount++`; ack 200 | second erase worker; new generation bind | new | intake | PR7 | designed |
| PR7-LIFE-013 | P7-C03 fresh reinstall after complete | receipt exists; fence `ERASED`; no Shop | afterAuth | **new** Shop + **new** generation; enqueue allowed | permanent domain blacklist | new | after-auth | PR7 | designed |
| PR7-LIFE-014 | P7-C03 missing old Shop row | no Shop; identified `targetShopId` remnants | `shop/redact` | remnants check (Redis/exports/scratch/coordinator/facts); not skip | silent COMPLETED because Shop is gone | new | shop-redact | PR7 | designed |
| PR7-LIFE-015 | P7-C03 concurrent afterAuth/redact | REDACTED/`FINALIZING` applying | afterAuth + privacy worker | afterAuth denied; privacy continues | re-enable mid-erase | new | race test | PR7 | designed |
| PR7-LIFE-016 | F-CLAUDE-PR7CP-01 two gens identical bodies | gen1 `ERASED`+receipt; gen2 `UNINSTALLED` no live successor; new `whIdGen2New` / `eventIdGen2`; **identical** redact JSON | POST | bind/coalesce **gen2** erasure; old receipt does **not** suppress | HMAC/body work key completing as gen1 | new | classifier | PR7 | designed |
| PR7-LIFE-017 | F-CLAUDE-PR7CP-01 identical bodies distinct events live successor | gen1 erased; gen2 **LIVE**; distinct webhook+event ids; identical body | POST | `ESCALATED`; gen2 retained | guessed live-shop DELETE; false COMPLETED | new | classifier | PR7 | designed |
| PR7-LIFE-018 | F-CLAUDE-PR7CP-01 conflicting event/body | reused `eventId` with incompatible digest/topic | POST | quarantine/`ESCALATED`; persist minimally | silent success duplicate | new | intake | PR7 | designed |
| PR7-LIFE-019 | F-CLAUDE-PR7CP-01 missing delivery id | HMAC valid; `webhookId` empty/missing | POST | durable quarantine + `ESCALATED`; ack 200; **no** generation bind | 401 after auth; guessed target | new | intake | PR7 | designed |
| PR7-LIFE-020 | F-CLAUDE-PR7CP-01 two unfinished generations | two `UNINSTALLED`/`ERASING` gens `erasedAt IS NULL` | new authenticated shop/redact | `ESCALATED`; explicit ambiguity | inventing a target | new | classifier | PR7 | designed |
| PR7-LIFE-021 | F-CLAUDE-PR7CP-04 receipt vs remnants | receipt row present; remnants remain | residual / retry | stay `FINALIZING`/`PARTIAL_FAILED`; **no** `COMPLETED` | receipt overriding remnants | new | residual probe | PR7 | designed |
| PR7-LIFE-022 | F-CLAUDE-PR7CP-04 crash after Shop delete | Shop gone; generation `shopRowId` null; request not COMPLETED | resume | probe by `targetShopId`; complete only if residual empty | reconstructing solely from current Shop row | new | crash recovery | PR7 | designed |
| PR7-LIFE-023 | F-CLAUDE-PR7CP-01 concurrent admission | parallel afterAuth, uninstall, shop/redact | race | fence + classifier fail closed; at most one bound target or `ESCALATED` | live Shop deleted; two COMPLETED receipts for different gens from one HMAC | new | race | PR7 | designed |
| PR7-LIFE-024 | D-PR7-06 FINALIZING vs fresh | `gen1Finalizing` exists | `upsertCanonicalShop` / afterAuth | `assertNoErasureFence` denies create/reactivate | reviving FINALIZING via domain unique upsert | new | bootstrap.server.ts | PR7 | designed |

### 6.5 Privacy intake, dispatch, and states

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-PRIV-001 | HMAC | invalid HMAC | POST compliance | 401 | 200 + processor | new | `webhooks.compliance.test.ts` | PR7 | designed |
| PR7-PRIV-002 | ack | valid HMAC FXT-COMPLIANCE-DATA-REQUEST shop A | POST | 200; `PrivacyRequest` RECEIVED | claiming erased in body | new | same | PR7 | designed |
| PR7-PRIV-003 | duplicate delivery | existing request bound to delivery id | second POST same `shopifyWebhookId` | same request id; duplicateCount++ | two APPLYING workers unbounded | new | same | PR7 | designed |
| PR7-PRIV-004 | wrong shop HMAC domain vs body | body shop B, HMAC A | POST | deny / reject | processing B | new | intake | PR7 | designed |
| PR7-PRIV-005 | 30-day clock | RECEIVED or ESCALATED | scheduler/operator | work or incident before `receivedAt+30d` per plan §7.12 clocks | silent drop / local 180-day wait / indefinite escalation without alerts | new | scheduler test | PR7 | designed |
| PR7-PRIV-006 | pause switch | `FEATURE_PR7_PRIVACY_PAUSE=1` | worker | stays SCHEDULED; ack already 200; deadlines continue | deletes; claiming clock waived | new | `app/privacy/pause.server.ts` | PR7 | designed |
| PR7-PRIV-007 | process death | APPLYING mid-batch; SIGKILL after commit of checkpoint N | resume | continue N+1 | restart from 0 duplicating side effects unsafely **or** skipping | new | process-loss child | PR7 | designed |
| PR7-PRIV-008 | transaction fail | injected error in surface k | worker | PARTIAL_FAILED | COMPLETED | new | worker | PR7 | designed |
| PR7-PRIV-009 | incomplete pagination | >page size rows | enumerator | visits all keys | silent cap | new | enumerate.test.ts | PR7 | designed |
| PR7-PRIV-010 | late arriving webhook | APPLYING shop/redact | new orders/create | ordinary intake denied | new fact row | new | intake+redact | PR7 | designed |
| PR7-PRIV-011 | compliance sanitizer | customers/data_request payload | persist projection | lookup keys (ids) + hashed email; no raw email | durable raw email | new | `app/privacy/sanitize-compliance` | PR7 | designed |
| PR7-PRIV-012 | unsupported topic on PR4 sanitizer | `customers/create` | sanitize | throw | persisting | existing | `sync-control-plane.test.ts` `"rejects unsupported topics"` | PR4 | **executed-prior-planning-head-not-re-run** |
| PR7-PRIV-013 | P7-C05 lookup retry | persist customer id + order ids; crash | retry | scan uses stored ids | hash-only lookup that cannot match order GIDs | new | data-request | PR7 | designed |
| PR7-PRIV-014 | P7-C05 / F-CLAUDE-PR7CP-02 privacy while disabled | `processingEnabled=false` REDACTED; valid privacy GUC | privacy job SELECT/DELETE | target rows visible/deleted under **privacy** policies (no processingEnabled); coordinator checkpoints | re-enable shop; ordinary replay; runtime policies succeeding; runtime AuditEvent INSERT | new | privacy worker + sql.ts | PR7 | designed |
| PR7-PRIV-015 | F-CLAUDE-PR7CP-07 named path | disabled shop; admitted `privacy:shop_redact` | intake → `createPrivacyDurableJob` → `claimPendingPrivacyJobs` → `enqueueWebhook` → `executePrivacyJob` | job claimed **without** fair-claim `processingEnabled=true`; execute **before** `assertShopProcessingEnabled`; request+generation re-read | bypassing dispatcher; second queue product; rewriting `buildFairClaimSchedulerLockSql` | new | intake/dispatcher/fair-claim/webhook-processor | PR7 | designed |
| PR7-PRIV-016 | F-CLAUDE-PR7CP-07 unknown type | jobType `privacy:evil` or unknown | `executionStrategyForJobType` / dispatch | `NO_AUTOMATIC_RETRY`; no privacy GUC; no DELETE | silent retry; treating string prefix as authority | new | execution-strategy.server.ts | PR7 | designed |
| PR7-PRIV-017 | F-CLAUDE-PR7CP-07 type insufficient | DurableJob `privacy:shop_redact` but no matching in-flight `PrivacyRequest`/generation | execute | deny before merchant access | job type alone authorizing DELETE | new | execute.server.ts | PR7 | designed |
| PR7-PRIV-018 | F-CLAUDE-PR7CP-07 strategy | three `PRIVACY_JOB_TYPES` | register | each maps to `BOUNDED_CHECKPOINT_RETRY`; maxAttempts then DL/`ESCALATED` | defaulting them to `NO_AUTOMATIC_RETRY` | new | execution-strategy + prisma enum | PR7 | designed |

**Decision B note (does not change the original meaning of PR7-PRIV-015…018):** those four rows remain the historical DurableJob privacy-path tests. Comment 5729229659 **withdraws that path as required**. Replacement rows: PR7-COORD-*. Ordinary unknown-job fail-closed in PR7-PRIV-016 remains in force for leftover `privacy:*` job strings (not authority).

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-PRIV-019 | F-CLAUDE-PR7XC-08 post-prune duplicate | payload pruned; unexpired tombstone `COMPLETED` | redelivery same `shopifyWebhookId` | recorded outcome; no new work; **no** spurious `ESCALATED` | reconstructing payload; inheriting onto a new generation | synthetic G6 | coordinator intake | PR7 | executed-synthetic-pg16 |

### 6.6 Shop/redact enumerator

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-RED-001 | D-021 / F-CLAUDE-PR7CP-03 | Shop A facts+jobs+sessions; UNINSTALLED generation | shop/redact through §7.6.3 | REDACTED then Shop gone via `stocky_privacy_finalize_shop_delete`; residual 0 except receipt/holds/ERASED generation | leftover Supplier/OrderFact/DurableJob/Session/AuditEvent; bare `DELETE FROM Shop` by runtime/CP | new | shop-redact.test.ts | PR7 | designed |
| PR7-RED-002 | child-first | PO + lines | redact | lines then PO | FK violation abort without checkpoint | new | same | PR7 | designed |
| PR7-RED-003 | control-plane | deliveries/DL/replays | redact | those rows gone | retaining sanitizedPayload | new | same | PR7 | designed |
| PR7-RED-004 | receipts | SyncApplicationReceipt | redact | gone | leftover digest that reconstitutes payload | new | same | PR7 | designed |
| PR7-RED-005 | cross-shop | A+B populated | redact A | B intact | deleting B; generic bypass | new | same | PR7 | designed |
| PR7-RED-006 | Restrict Shop FK | children remain | finalize Shop delete too early | function rejects / Restrict; shop not removed until children gone | orphan | new | same | PR7 | designed |
| PR7-RED-007 | P7-C02 / D-PR7-11 / F-CLAUDE-PR7CP-01 | children gone; residual empty | completion txn | FXT-COMPLETION-RECEIPT bound to **this** request+generation+target; no Shop FK | cleartext domain; unsalted hash claimed anonymous; leftover AuditEvent; using receipt as domain skip | new | receipt test | PR7 | designed |
| PR7-RED-008 | R-164 vs privacy | tombstoned catalog row | shop/redact | physical delete allowed **in privacy module** | calling C apply delete | new | redact uses privacy-erasure/control-plane not apply | PR7 | designed |
| PR7-RED-009 | Redis | BullMQ job envelope shop A | redact | `removeShopQueueJobsExceptPrivacy`; worker fail-closed; privacy job kept | other shops’ jobs removed; FLUSHALL | new | redis cleanup | PR7 | designed |
| PR7-RED-010 | H scratch if base has D | leftover `att-*` for A | redact | dispose authentic handles; probe fails if leftover bytes remain | `unlink` of unowned symlink; inventing D API | new | scratch cleanup | PR7 | designed |
| PR7-RED-011 | H job types if present | `order-facts-sync` jobs | redact | included in cancel+delete | ignored stranded import | new | same | PR7 | designed |
| PR7-RED-012 | backups | restore after redact | **out of repo tests**; staging | documented cannot un-erase | claiming backup covered | skip reason §8 | staging | later | designed skip |
| PR7-RED-013 | manifest PII | after redact | read manifest (pre-delete) / receipt | FXT-MANIFEST-NO-PII; FXT-COMPLETION-RECEIPT | email in JSON | new | manifest test | PR7 | designed |
| PR7-RED-014 | success audit | PARTIAL_FAILED | emit | no `PRIVACY_COMPLETED` | completed event | new | coordinator | PR7 | designed |
| PR7-RED-015 | P7-C02 residual | after complete redact | probe | 0 tenant-linked AuditEvent; receipt exists | “minimized” leftover audit rows | new | residual probe | PR7 | designed |
| PR7-RED-016 | never-uninstalled live shop | processingEnabled true, no uninstall generation | shop/redact | ESCALATED; data retained | erase | new | shop-redact | PR7 | designed |
| PR7-RED-017 | F-CLAUDE-PR7CP-04 crash before Shop delete | merchant surfaces empty; Shop still present; request FINALIZING | kill then resume | call checked Shop delete; do not INSERT receipt yet | COMPLETED with Shop remaining | new | crash | PR7 | designed |
| PR7-RED-018 | F-CLAUDE-PR7CP-04 crash after Shop delete before CP completion | Shop gone; no receipt | resume | residual by `targetShopId`; conditional COMPLETED txn iff empty | skipping remnants because Shop lookup fails | new | crash | PR7 | designed |
| PR7-RED-019 | F-CLAUDE-PR7CP-04 crash during prune | receipt exists; delivery bindings still present | resume prune | bindings/lookup keys removed; receipt+ERASED generation remain | deleting receipt; reconstructing PII into receipt | new | crash | PR7 | designed |
| PR7-RED-020 | F-CLAUDE-PR7CP-04 late writer during residual | FINALIZING residual verify in progress | in-flight ordinary writer / afterAuth | 0-row/error + fence deny; residual fails if a row reappears → not COMPLETED | completing while a writer can still populate | new | race | PR7 | designed |
| PR7-RED-021 | F-CLAUDE-PR7CP-03 grants + FK | catalog after migration | inspect grants + FK | runtime/CP **no** `DELETE ON Shop`; privacy-erasure EXECUTE function only; `ShopInstallGeneration.shopRowId` SET NULL; `PrivacyRequest.targetShopId` no FK | PUBLIC EXECUTE; migration-owner login used by worker | new | scripts/privacy-enforcement + roles.ts | PR7 | designed |

### 6.7 Customer data_request / redact

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-CUST-001 | P7-C05 empty after scan | FXT-EXPECTED-EMPTY-CUSTOMER-SCAN | data_request FXT | COMPLETED empty export **only after** required surfaces scanned | inventing customer PII; empty-by-construction without scan | new | customers-data-request.test.ts | PR7 | designed |
| PR7-CUST-002 | order GID map | `ShopifyOrderFact` gid `gid://shopify/Order/299938` **without** customer fields | data_request | include operational gid+units in owner export (still no email) **after scan** | adding email; skipping because no customer column | new | same | PR7 | designed |
| PR7-CUST-003 | Session staff email | Session.email owner | customers/redact john@example.test | **do not** delete staff session because Shopify customer email ≠ staff | wiping shop sessions | new | customers-redact.test.ts | PR7 | designed |
| PR7-CUST-004 | supplier contact | Supplier.contactEmail=john@example.test | customers/redact | **PROPOSED default: do not treat supplier contacts as Shopify customer redact** (different data class) | silent supplier wipe | new | same | PR7 | designed |
| PR7-CUST-005 | customers/redact empty | no matches **after complete scan** | redact | COMPLETED skipped_absent | shop-wide delete | new | same | PR7 | designed |
| PR7-CUST-006 | D-PR7-14 / F-CLAUDE-PR7CP-08 | data_request complete; artifact TTL live | download | **only** current verified Shopify `account_owner` for same shop/generation/request via `platform.privacy.data_request.download` | `shop_admin` with operational export; auditor; Shop B; public bearer URL | new | `app.platform.privacy.data-request` | PR7 | designed |
| PR7-CUST-007 | sanitizer regression | orders/create with email | durable projection | no email property | persist email | existing | `"strips PII from orders/create and keeps money strings"` | PR4 | **executed-prior-planning-head-not-re-run** |
| PR7-CUST-008 | GraphQL denylist | document with `customer { id }` | validate | reject | network | existing | `mutation-safety.test.ts` `"rejects Order.cancellation and customer PII fields"` | PR6-B | **executed-prior-planning-head-not-re-run** |
| PR7-CUST-009 | P7-C05 hash-only insufficient | request stored hashes only (negative fixture) | retry | **must fail this design**; lookup keys required | shipping hash-only persistence | new | data-request | PR7 | designed |
| PR7-CUST-010 | lookup key types | JSON customer.id number / wide order id | persist | exact decimal strings | JS number coercion | new | same | PR7 | designed |
| PR7-CUST-011 | F-CLAUDE-PR7CP-08 split | `shop_admin` with `platform.export.operational` | GET data_request artifact | deny | serving privacy export as operational export | new | export vs privacy routes | PR7 | designed |
| PR7-CUST-012 | F-CLAUDE-PR7CP-08 uninstalled | app uninstalled; no owner session possible | fulfill | operator `scripts/privacy/fulfill-data-request.ts` recorded support path | pretending in-app owner route is reachable; public URL | new | operator fulfill | PR7 | designed |
| PR7-CUST-013 | F-CLAUDE-PR7CP-10 | authenticated `customers/redact` delivered | intake clock | handle **on arrival**; `deadlineAt=receivedAt+30d`; changelog 2026-03-23 is newer published Shopify send policy | local six-month wait; treating the older six-month page as an implementation pause | new | intake + pause tests | PR7 | designed |
| PR7-CUST-014 | F-CLAUDE-PR7TF-01 barrier keys | LIVE shop_a; authenticated customer `191167` + order `1001` | `stocky_privacy_install_customer_barrier` | ACTIVE rows on **canonical domain** × `CUSTOMER_REST_ID`/`ORDER_LEGACY_ID`; generation is evidence (not the lock identity); not request-id-only | request-id-only fence; generation-guessed lock; whole-shop exclusive gate | G7 `customer_barrier_installs_target_keys` | barrier helper | PR7 | executed-synthetic-pg16 |
| PR7-CUST-015 | F-CLAUDE-PR7TF-01 matching writer | barrier ACTIVE | matching `stocky_customer_write_guard` / audit insert | `customer_target_erasing` deny | silent repopulate of the target | G7 `matching_writer_denied_while_barrier_active` | write_guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-016 | F-CLAUDE-PR7TF-01 unrelated customer | barrier ACTIVE on customer A | write customer B / `of_a2` path | progress (row admitted) | whole-shop freeze | G7 `unrelated_customer_same_shop_progresses` | target lock keys | PR7 | executed-synthetic-pg16 |
| PR7-CUST-017 | F-CLAUDE-PR7TF-01 unrelated shop | barrier ACTIVE shop_a | write shop_b | progress | global lock / shop disable | G7 `unrelated_shop_progresses_during_customer_barrier` | domain+target keys | PR7 | executed-synthetic-pg16 |
| PR7-CUST-018 | F-CLAUDE-PR7TF-01 late row | enumerate then late `ae_a3` matching rest id | source residual **without** re-enumerate | residual > 0; remnant visible; COMPLETED denied | stale-manifest count 0 as absence | G7 `late_matching_row_visible_to_source_residual`; `complete_denied_while_remnants`; old-model CE-1 | residual helper | PR7 | executed-synthetic-pg16 |
| PR7-CUST-019 | F-CLAUDE-PR7TF-01 re-enumerate + residual | remnant deleted; bounded re-enumerate | `stocky_privacy_complete_customer_redact` | residual 0 then COMPLETED in **same** txn holding exclusive target locks | unprotected rescan-then-complete; receipt before residual | G7 `reenumerate_then_source_residual_zero`; `complete_commits_after_drain` | complete helper | PR7 | executed-synthetic-pg16 |
| PR7-CUST-020 | F-CLAUDE-PR7TF-01 writer vs complete | residual verified; exclusive locks held | concurrent matching writer | writer waits / `55P03`; no restore | completing while a writer can land | G7 `writer_between_residual_and_complete_waits` | exclusive target locks | PR7 | executed-synthetic-pg16 |
| PR7-CUST-021 | F-CLAUDE-PR7TF-01 delayed restore | COMPLETED; `PrivacyCompletedTarget` | queued payload `payloadAdmittedAt < completedAt` | `customer_target_restore_denied` | restoring erased customer via delayed write | G7 `delayed_old_write_cannot_restore` | completed-target | PR7 | executed-synthetic-pg16 |
| PR7-CUST-022 | F-CLAUDE-PR7TF-01 later legitimate write | COMPLETED | `payloadAdmittedAt ≥ completedAt` | allowed | lifetime suppression of that customer | G7 `legitimate_later_customer_data_allowed` | completed-target | PR7 | executed-synthetic-pg16 |
| PR7-CUST-023 | F-CLAUDE-PR7TF-01 coverage | enumerated `preq_dr` | `stocky_privacy_data_request_coverage` | snapshot key count + `enumerationComplete` at `publicationRevision` | using erasure-empty residual as download coverage | G7 `data_request_coverage_is_snapshot_not_empty_predicate` | coverage helper | PR7 | executed-synthetic-pg16 |
| PR7-CUST-024 | F-CLAUDE-PR7TF-01 no shop freeze | customer COMPLETED | inspect shop_a | fence `LIVE`; `processingEnabled=true` | exclusive domain freeze; disabling the shop | G7 `customer_request_completed_without_shop_freeze` | classifier | PR7 | executed-synthetic-pg16 |
| PR7-CUST-025 | CC-GEN / F-CLAUDE-PR7CC-01 lock identity | two LIVE generations `gen_a` then `gen_a_zz` (lexicographically greater); barrier ACTIVE on `gen_a` | matching `stocky_customer_write_guard` | `customer_target_erasing`; two-int lock `pr7-ctgt-v2:` + canonical domain × kind:value; lock **before** lookup | `ORDER BY id DESC`; latest-generation guess; empty SELECT before lock | G11 `cea_two_gen_matching_write_still_denied`; old CE-A | write_guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-026 | CC-GEN declared successor cannot bypass ACTIVE | barrier ACTIVE; declared origin `gen_a_zz` | matching write | deny `customer_target_erasing` | admitting because origin is the later LIVE row | G11 `cea_declared_successor_origin_cannot_bypass_active_barrier` | write_guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-027 | CC-GEN CE-B restore-denied | COMPLETED on `gen_a`; delayed payload with old origin after `gen_a_zz` exists | write | `customer_target_restore_denied` | admitting delayed pre-erasure payload because a newer generation row exists | G11 `ceb_two_gen_old_origin_still_restore_denied`; old CE-B | completed-target | PR7 | executed-synthetic-pg16 |
| PR7-CUST-028 | CC-GEN two LIVE undeclared origin | two LIVE bindings; no declared origin | write | `customer_write_origin_ambiguous` / `customer_target_attribution_ambiguous`; **not** admitted | guessing latest id | G11 `two_live_undeclared_origin_ambiguous_not_admitted` | origin helper | PR7 | executed-synthetic-pg16 |
| PR7-CUST-029 | CC-GEN queued before successor install | unique LIVE successor; `payloadAdmittedAt` < successor `installedAt` | write | `customer_target_restore_denied` | treating any new generation row as a fresh payload | G11 `queued_payload_before_successor_install_restore_denied` | completed-target | PR7 | executed-synthetic-pg16 |
| PR7-CUST-030 | CC-GEN genuine successor | unique LIVE origin ≠ completed gen; completed gen **not** LIVE; `payloadAdmittedAt >= origin.installedAt` | write | allowed | lifetime unexplained ban of the customer | G11 `genuine_successor_fresh_payload_allowed` | origin + completed-target | PR7 | executed-synthetic-pg16 |
| PR7-CUST-031 | CC-GEN missing origin | no declared origin and no unique LIVE binding | write | `customer_write_origin_missing` fail-closed | `ORDER BY id` fallback | G11 `missing_origin_fails_closed` | origin helper | PR7 | executed-synthetic-pg16 |
| PR7-CUST-032 | CC-GEN concurrent reinstall vs barrier | barrier install overlapping successor insert | both txns | matching write still denied; no generation-guess bypass | completing/admitting across the race | G11 `concurrent_reinstall_cannot_bypass_namespace_barrier` | exclusive target lock | PR7 | executed-synthetic-pg16 |
| PR7-CUST-033 | CC-GEN unrelated shop | namespace barrier on shop_a | write shop_b | progress | global freeze | G11 `other_shop_unrelated_to_namespace_progresses` | domain keys | PR7 | executed-synthetic-pg16 |
| PR7-CUST-034 | CC-GEN NEG resolver | restore `ORDER BY id DESC` / skip applicable-barrier check | CE-A fixture | **must fail this design** (matching write admitted) | crediting the unchanged contract | NEG `generation_guess_restored_defeats_barrier` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-CUST-035 | GW-01 CE-D unattributed overlap | unique LIVE successor; prior completion; payload in inclusive overlap; no persisted origin | `stocky_fact_write_guard` | `customer_target_attribution_ambiguous`; no restoring write | unique-LIVE fallback admits successor data | G13 `ced_unattributed_overlap_ambiguous`; old CE-D | write_guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-036 | GW-01 / TA-01 ADMIN old origin | overlap; ADMIN admission recorded while `gen_a` unique LIVE; consumer uses that `work_id` | write | `customer_target_restore_denied` | caller boolean or restamp as origin | G13 `ced_persisted_old_origin_restore_denied` | WriterAdmissionOrigin | PR7 | executed-synthetic-pg16 |
| PR7-CUST-037 | GW-01 / TA-01 proven successor | overlap; ADMIN admission **after** `gen_a2` LIVE with a **new** digest (DO capture-now; caller `-150 minutes` is **not** provenance — disclose, do not treat the name as overlap-timestamp laundering) | write | allowed (BOUND successor policy) | banning genuine proven successor work | G13 `ced_persisted_successor_origin_admitted_in_overlap` | original-admission helper + capture | PR7 | executed-synthetic-pg16 |
| PR7-CUST-038 | GW-01 / TA-01 remint old digest | overlap; ADMIN attempt to admit the **old** webhook digest as successor | admission | `admission_digest_conflict`; original row unchanged | retry-time restamp trusted as origin | G13 `newly_attached_successor_generation_not_trusted` | original-admission helper | PR7 | executed-synthetic-pg16 |
| PR7-CUST-039 | GW-01 inclusive boundaries | payload `=` successor `installedAt` or `=` `completedAt` | write | ambiguous | half-open interval admits boundary | G13 `equality_at_successor_installedAt_ambiguous`; `equality_at_completedAt_ambiguous` | write_guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-040 | GW-01 before / after overlap | unattributed payload before `installedAt` / after `completedAt` | write | restore_denied / allowed successor | lifetime ban or silent overlap admit | G13 `before_overlap_unattributed_restore_denied`; `after_overlap_unattributed_successor_allowed` | write_guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-041 | GW-01 missing time / history / multi-complete | NULL admitted_at; completion without generation row; two completions | write | ambiguous; not a permit | lexicographic latest row | G13 `missing_payload_time_ambiguous`; `missing_generation_history_not_a_permit`; `multiple_applicable_completions_still_ambiguous` | write_guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-042 | GW-01 delayed retry / concurrent reinstall | original admission retried after release; two LIVE during overlap | write | still ambiguous / not admitted | retry-now restamp or unique-LIVE guess | G13 `delayed_retry_preserves_original_admission_still_ambiguous`; `concurrent_reinstall_unattributed_overlap_not_admitted` | write_guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-043 | GW-01 unrelated progress | overlap block on shop_a / customer 191167 | write shop_b or other customer | progress | global freeze | G13 `unrelated_shop_progresses_during_overlap_block`; `unrelated_customer_progresses` | domain keys | PR7 | executed-synthetic-pg16 |
| PR7-CUST-044 | GW-01 NEG temporal check | remove only GW01_TEMPORAL_OVERLAP block | CE-D fixture | **must fail this design** (unattributed overlap admitted) | crediting the unchanged contract | NEG `temporal_overlap_check_removed_revives_ced_admit` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-CUST-045 | TA-01 producer DML deny | empty origin table | runtime/CP INSERT/UPDATE/DELETE `WriterAdmissionOrigin` | `42501` / 0 rows | consumer mint | G15 `runtime_denied_origin_insert`; `control_plane_denied_origin_insert`; `runtime_denied_origin_update`; `runtime_denied_origin_delete` | origin RLS | PR7 | executed-synthetic-pg16 |
| PR7-CUST-046 | TA-01 helper EXECUTE deny | named helper | runtime/CP `stocky_record_writer_admission` | `42501` | generic registerOrigin; definer escalation | G15 `runtime_denied_helper_execute`; `control_plane_denied_helper_execute` | grants | PR7 | executed-synthetic-pg16 |
| PR7-CUST-047 | TA-01 SET ROLE / GUC | runtime session | `SET ROLE stocky_original_admission`; `set_config('stocky.origin_generation_id',…)` | SET ROLE denied; GUC ignored by helpers | self-set GUC as authority | G15 `runtime_cannot_set_role_admission`; `guc_is_not_admission_authority` | session | PR7 | executed-synthetic-pg16 |
| PR7-CUST-048 | TA-01 legitimate admit + use | producer helper then runtime guard | `admit()` then 5-arg `work_id` write | binding created; write allowed | preseeded owner rows as the only proof | G15 `original_admission_helper_creates_binding`; `consumer_uses_persisted_binding` | producer + guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-049 | TA-01 retry / digest | existing source+digest | retry same digest later time; changed digest | original time/generation unchanged; `admission_binding_conflict` | restamp into current generation | G15 `retry_same_source_preserves_origin_time`; `changed_digest_conflicts_original_unchanged` | unique source digest | PR7 | executed-synthetic-pg16 |
| PR7-CUST-050 | TA-01 forged bindings | legit work_id | wrong target / other shop / missing work | `customer_target_binding_mismatch` / `customer_target_attribution_ambiguous` | lookup-by-id-only | G15 `target_substitution_rejected`; `tenant_substitution_rejected`; `missing_binding_fail_closed` | guard lookup | PR7 | executed-synthetic-pg16 |
| PR7-CUST-051 | TA-01 borrow successor | overlap; successor work vs old webhook work | consumer uses successor `work_id` for new digest; old digest work | successor own binding may proceed; old digest remains ambiguous | interchangeable work ids | G15 `successor_binding_is_not_interchangeable_with_old_digest`; `borrowed_successor_cannot_admit_ced_payload` | work identity | PR7 | executed-synthetic-pg16 |
| PR7-CUST-052 | TA-01 delayed first-seen webhook | after reinstall; new webhook digest in overlap | WEBHOOK_PROVIDER_AUTH admit then write | `customer_target_attribution_ambiguous` | HMAC-after-reinstall as successor proof | G15 `delayed_first_seen_webhook_not_promoted` | evidence class | PR7 | executed-synthetic-pg16 |
| PR7-CUST-053 | TA-01 child lineage | trusted parent; foreign vs matching digest | PARENT_LINEAGE admit | foreign digest denied; matching digest inherits | child launders old payload | G15 `child_cannot_launder_old_digest`; `child_inherits_parent_origin` | parentWorkId | PR7 | executed-synthetic-pg16 |
| PR7-CUST-054 | TA-01 pending / recover | BEGIN + DurableJob | consumer before ack; recover-with-job; consumer after | `customer_admission_not_acked` then allowed | pending treated as BOUND | G15 `begin_pending_link`; `pending_link_not_trusted_for_effects`; `recover_unacked_admission_with_job`; `recovered_admission_allows_consumer` | link protocol | PR7 | executed-synthetic-pg16 |
| PR7-CUST-055 | TA-01 duplicate concurrent | two sessions same source+digest | concurrent `admit()` | exactly one origin row | two remints | G15 `duplicate_concurrent_admission_reconciles` | unique index | PR7 | executed-synthetic-pg16 |
| PR7-CUST-056 | TA-01 pruned / missing | binding deleted after admit | consumer `work_id` | `customer_target_attribution_ambiguous` | legacy as successor | G15 `pruned_binding_fail_closed` | fail-closed | PR7 | executed-synthetic-pg16 |
| PR7-CUST-057 | TA-01 genuine successor after complete | ADMIN new digest `originalAdmittedAt` after `completedAt` | write | allowed | lifetime ban | G15 `genuine_successor_after_completion_progresses` | successor policy | PR7 | executed-synthetic-pg16 |
| PR7-CUST-058 | TA-01 admission vs barrier | admit then ACTIVE barrier | matching write | `customer_target_erasing` | admission outruns barrier | G15 `admission_cannot_outrun_active_barrier` | target lock | PR7 | executed-synthetic-pg16 |
| PR7-CUST-059 | TA-01 unrelated shop | shop_a overlap/barrier | shop_b own ADMIN binding | progress | global freeze | G15 `unrelated_shop_progresses_with_own_binding` | domain keys | PR7 | executed-synthetic-pg16 |
| PR7-CUST-060 | TA-01 NEG lookup bypass | replace guard to unique-LIVE fallback | CE-D webhook work | **must fail this design** (overlap admitted) | crediting the unchanged contract | NEG `lookup_bypass_revives_ta01_admit` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-CUST-061 | TA-01 NEG unauthorized mint | strip `session_user` + GRANT EXECUTE to runtime | runtime mints BOUND LIVE then writes CE-D | **must fail this design** (overlap admitted) | crediting the unchanged contract | NEG `unauthorized_mint_revives_ta01_admit` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-CUST-062 | DO-01 capture required | ADMIN class; no `OriginalAdminCapture` | `stocky_record_writer_admission` | `admission_admin_capture_required` | class+caller timestamp mints BOUND | G16 `admin_class_without_capture_rejected`; `overlap_caller_timestamp_without_capture_rejected` | capture-to-producer | PR7 | executed-synthetic-pg16 |
| PR7-CUST-063 | DO-01 capture principal deny | named capture helpers | runtime/CP/producer `stocky_capture_original_admin_command` / `stocky_establish_modeled_admin_session` | `42501` | second auth subsystem; producer self-capture | G16 `runtime_denied_establish_admin_session`; `runtime_denied_capture_execute`; `control_plane_denied_capture_execute`; `producer_denied_capture_execute` | grants | PR7 | executed-synthetic-pg16 |
| PR7-CUST-064 | DO-01 session/tenant | capture without established session; wrong-shop session | `stocky_capture_original_admin_command` | `admission_admin_session_required` / `admission_session_tenant_mismatch` | forged fresh context | G16 `capture_without_established_session_rejected`; `capture_wrong_shop_session_rejected` | modeled post-requireAdminTenant | PR7 | executed-synthetic-pg16 |
| PR7-CUST-065 | DO-01 caller timestamp ignored | ADMIN capture; caller overlap timestamp 18:19 | producer admit | `originalAdmittedAt` = server `capturedAt`, not 18:19 | `now()` substitution of queued payload | G16 `caller_overlap_timestamp_does_not_become_captured_at` | capturedAt | PR7 | executed-synthetic-pg16 |
| PR7-CUST-066 | DO-01 label-only queued webhook | WEBHOOK identity already sighted | capture as ADMIN | `queued_work_cannot_acquire_fresh_admin_origin` | current staff session launders queued work | G16 `label_only_queued_webhook_cannot_capture_admin`; `queued_inbox_cannot_acquire_fresh_admin_origin` | QueuedWorkSighting | PR7 | executed-synthetic-pg16 |
| PR7-CUST-067 | DO-01 note queued / runtime deny | CP notes queued work; runtime notes | `stocky_note_queued_work` | CP allowed; runtime `42501` | runtime fabricates sightings | G16 `control_plane_can_note_queued_work`; `runtime_denied_note_queued_work` | grants | PR7 | executed-synthetic-pg16 |
| PR7-CUST-068 | DO-01 retry / changed digest | existing ADMIN capture+origin | retry later time; changed digest | capture/origin time unchanged; `admission_binding_conflict` | time-only restamp | G16 `time_only_retry_does_not_restamp_capture`; `changed_digest_admin_conflicts`; `duplicate_admin_command_preserves_single_capture` | unique source digest | PR7 | executed-synthetic-pg16 |
| PR7-CUST-069 | DO-01 epoch / install consistency | capture under LIVE; reinstall; capture before install | capture / admit | `admission_capture_epoch_mismatch` / `admission_capture_before_install` | restamp across reinstall | G16 `capture_under_current_live`; `capture_epoch_mismatch_after_reinstall_rejected`; `capture_before_install_consistency_rejected` | supplementary checks | PR7 | executed-synthetic-pg16 |
| PR7-CUST-070 | DO-01 genuine successor / overlap capture | new ADMIN digest after complete; genuine capture inside overlap window | capture then admit then write | allowed | ban all overlap timestamps | G16 `genuine_admin_after_completion_progresses`; `genuine_admin_capture_inside_overlap_window_progresses` | capture-now | PR7 | executed-synthetic-pg16 |
| PR7-CUST-071 | DO-01 unrelated shop / child / pending | shop_a overlap; shop_b capture; child inherit; pending recover | admit / recover / host | shop_b progresses; child no fresh capture; origin time unchanged | global freeze; recovery restamp | G16 `unrelated_shop_admin_capture_and_host_progresses`; `child_inherits_without_fresh_admin_capture`; `pending_recovery_does_not_mutate_origin_time` | lineage | PR7 | executed-synthetic-pg16 |
| PR7-CUST-072 | DO-02 SQL-only substitution (honest) | two valid same-target work ids; SQL guard only | `stocky_fact_write_guard` old digest + new `work_id` | **ADMITTED** (guard cannot inspect later write) | falsifying the SQL-only observation | G16 `sql_honest_old_ambiguous_new_admitted`; `sql_only_old_effect_new_work_id_still_admitted` | 5-arg guard | PR7 | executed-synthetic-pg16 |
| PR7-CUST-073 | AO-02 / DO-02 actual-input bind | valid newer `work_id` with its stored digest + OLD effect identity | `stocky_apply_bound_customer_effect` computes `pr7-effect-v1` from frozen snapshot | `effect_digest_mismatch` **before** write; 0 rows | caller-supplied digest authority; F historical name `effect_host_rejects_old_digest_with_new_work_id` | G16 `effect_host_rejects_old_effect_with_new_work_id` | proposed-boundary host | PR7 | executed-synthetic-pg16 |
| PR7-CUST-074 | DO-02 matching digest write | bound context + matching digest/tenant/target | apply host | write allowed | host blocks genuine work | G16 `effect_host_accepts_matching_digest_and_writes` | proposed-boundary host | PR7 | executed-synthetic-pg16 |
| PR7-CUST-075 | DO-02 missing / wrong context | apply without bind; bind wrong tenant | bind / apply | `effect_execution_context_required` / `effect_execution_context_invalid` | interchangeable work ids | G16 `apply_without_execution_context_rejected`; `bind_context_wrong_tenant_rejected` | proposed-boundary host | PR7 | executed-synthetic-pg16 |
| PR7-CUST-076 | DO-01 NEG capture removed | replace ADMIN branch with Q live_n-only mint | overlap 18:19 ADMIN | **must fail this design** (BOUND+ADMITTED) | crediting the unchanged contract | NEG `capture_requirement_removed_revives_do01_admit` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-CUST-077 | AO-02 NEG computed commitment omitted | omit `stocky_effect_commitment`; write caller payload | old/altered effect + new work_id through host | **must fail this design** (write admitted) | crediting the unchanged contract | NEG `effect_digest_binding_removed_revives_do02_write` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-CUST-078 | RE-02 source commitment as provenance key | `pr7-source-v1` over domain/shop/operation/kind/value/source_body | ADMIN admit using computed source hex as `sourceContentDigest` | admitted | absorbing effectId into source | G16 `effect_host_admits_computed_source_commitment`; `source_and_effect_commitments_are_distinct` | source≠effect | PR7 | executed-synthetic-pg16 |
| PR7-CUST-079 | AO-02 python/sql canonicalization | same five fields | `hashlib` LF UTF-8 vs `stocky_effect_commitment` | equal hex `959bb904…` class | hidden canonicalization drift | G16 `python_and_sql_effect_commitment_match` | `pr7-effect-v1` | PR7 | executed-synthetic-pg16 |
| PR7-CUST-080 | AO-02 alternate payload | valid new work + stored digest + different effectId | apply | `effect_digest_mismatch` before write; 0 rows | matching-digest substitution | G16 `effect_host_rejects_alternate_payload_under_matching_work` | frozen snapshot | PR7 | executed-synthetic-pg16 |
| PR7-CUST-081 | AO-02 altered target | valid new work + matching effectId + different targetValue | apply | reject before write; 0 rows | target swap under matching work | G16 `effect_host_rejects_altered_target_under_matching_work` | frozen snapshot | PR7 | executed-synthetic-pg16 |
| PR7-CUST-082 | AO-02 after-check mutated callback | host given snapshot effectId then callback different id | apply mutated helper | `effect_digest_mismatch`; callback id not written | post-check payload swap | G16 `effect_host_rejects_after_check_mutated_callback_payload` | frozen locals | PR7 | executed-synthetic-pg16 |
| PR7-CUST-083 | AO-03 mandatory child recapture | WEBHOOK root → PARENT_LINEAGE child (overlap) → denied child → new-identity ADMIN of child digest | capture | `queued_work_cannot_acquire_fresh_admin_origin` | replayed bytes acquire successor ADMIN | G16 `replay_lineage_digest_cannot_acquire_fresh_admin_capture` | digest sighting | PR7 | executed-synthetic-pg16 |
| PR7-CUST-084 | AO-03 child sighted by digest | PARENT_LINEAGE child `dg_child2` | inspect `QueuedWorkSighting` | one row on `(domain, digest)` | identity-only sighting | G16 `parent_lineage_child_is_sighted_by_digest` | sighting PK | PR7 | executed-synthetic-pg16 |
| PR7-CUST-085 | AO-03 manual replay | MANUAL_REPLAY admit then ADMIN capture of same digest new identity | capture | denied `queued_work_cannot_acquire_fresh_admin_origin` | manual replay launders ADMIN | G16 `manual_replay_digest_cannot_acquire_fresh_admin_capture` | all non-fresh classes | PR7 | executed-synthetic-pg16 |
| PR7-CUST-086 | AO-03 renamed identity | same webhook digest, new sourceKind/sourceIdentity/command | capture | denied | rename defeats sighting | G16 `renamed_identity_same_digest_cannot_capture_admin` | lineage preservation | PR7 | executed-synthetic-pg16 |
| PR7-CUST-087 | AO-03 coalesced retry | same webhook source+digest retry | admit | single origin; still not ADMIN | remint or capture | G16 `coalesced_webhook_retry_does_not_remint_or_capture` | reconcile | PR7 | executed-synthetic-pg16 |
| PR7-CUST-088 | AO-03 legitimate successor | independently captured **new** digest | admit + host write | progresses | blanket lifetime blacklist | G16 `legitimate_successor_new_digest_still_progresses` | no lifetime digest ban | PR7 | executed-synthetic-pg16 |
| PR7-CUST-089 | AO-03 race sight then capture | webhook sighting then ADMIN capture same digest | capture | denied | TOCTOU mint | G16 `race_sighting_then_capture_denies_admin` | source-content lock | PR7 | executed-synthetic-pg16 |
| PR7-CUST-090 | AO-03/RE-01 race capture then sighting | ADMIN capture then webhook sighting; follow-up new-identity capture **and consume of the first capture** | follow-up capture; consume | denied; `capture_content_no_longer_fresh` on consume; no double-bind | treating refused second capture as enough | G16 `race_capture_then_sighting_does_not_double_bind` | source-content lock + consume re-read | PR7 | executed-synthetic-pg16 |
| PR7-CUST-091 | AO-04 self-set GUC old effect | consumer sets `stocky.trusted_work_id` to valid new work; writes foreign effect | apply via GUC locator | `effect_digest_mismatch`; 0 rows | GUC as capability | G16 `self_set_guc_locator_does_not_bypass_revalidation` | untrusted locator | PR7 | executed-synthetic-pg16 |
| PR7-CUST-092 | AO-04 self-set GUC matching snapshot | consumer sets GUC to valid work; frozen effect matches commitment | apply via GUC | write allowed | rejecting all self-set locators | G16 `self_set_guc_with_matching_frozen_effect_writes` | revalidation | PR7 | executed-synthetic-pg16 |
| PR7-CUST-093 | AO-04 foreign work GUC | shop_b sets GUC to shop_a work_id | apply | `effect_tenant_mismatch` | cross-tenant locator | G16 `self_set_guc_foreign_work_rejected` | revalidation | PR7 | executed-synthetic-pg16 |
| PR7-CUST-094 | AO-05 two shops same command | shops A and B both capture `order-sync-42` | capture | both succeed; distinct `oac_` sha256 ids | global caller-derived PK | G16 `two_shops_same_command_id_both_capture` | `(canonicalDomain, commandId)` | PR7 | executed-synthetic-pg16 |
| PR7-CUST-095 | AO-05 same tenant reconcile | shop_a recaptures same command + same input | capture | same capture id; count=1 | remint | G16 `same_tenant_same_command_same_input_reconciles` | tenant unique | PR7 | executed-synthetic-pg16 |
| PR7-CUST-096 | AO-05 same tenant changed input | shop_a same command + different digest | capture | `admission_command_input_conflict` | silent overwrite | G16 `same_tenant_same_command_changed_input_conflicts` | tenant unique | PR7 | executed-synthetic-pg16 |
| PR7-CUST-097 | AO-05 hyphen vs underscore | `order-sync-42` and `order_sync_42` | capture | both rows exist | lossy hyphen replacement collision | G16 `identifier_normalization_hyphen_underscore_do_not_collide` | bytea NUL separator | PR7 | executed-synthetic-pg16 |
| PR7-CUST-098 | AO-03 NEG webhook-only sighting | restore identity-keyed WEBHOOK-only sighting | child recapture as ADMIN | **must fail this design** (fresh ADMIN of child digest admitted) | crediting the unchanged contract | NEG `webhook_only_sighting_revives_child_recapture` | load-bearing | PR7 | executed-synthetic-pg16 |

| PR7-CUST-099 | RE-01 capture then sighting then consume | issue capture; `note_queued_work` same digest; consume that capture | admit | `capture_content_no_longer_fresh`; no BOUND origin | refused second capture as the test | G16 `capture_first_then_sighted_digest_cannot_be_consumed`; `re01_does_not_mint_bound_origin_after_contradiction` | eligibility flag | PR7 | executed-synthetic-pg16 |
| PR7-CUST-100 | RE-01 historical coexistence | capture row and sighting row of same digest | inspect | both exist | erasing capture | G16 `re01_capture_and_sighting_coexist_historically` | no origin rewrite | PR7 | executed-synthetic-pg16 |
| PR7-CUST-101 | RE-01 consumed then sighted then effect | admit/ACK; inbox sighting; host apply | apply | `effect_source_no_longer_fresh`; 0 rows; origin stays BOUND | one-time admission check; BOUND→UNATTRIBUTED | G16 `capture_consumed_then_sighted_cannot_effect`; `re01_does_not_rewrite_bound_to_unattributed` | effect re-read | PR7 | executed-synthetic-pg16 |
| PR7-CUST-102 | RE-01 effect-first historical | apply then sighting then retry | apply / retry | first write remains; same effectId returns; new effectId `effect_digest_mismatch` | retroactive unwrite | G16 `effect_first_then_sighting_is_historical_not_unwritten`; `historical_effect_retry_new_effect_id_denied` | SourceEffectLink | PR7 | executed-synthetic-pg16 |
| PR7-CUST-103 | RE-01 effect/sighting sequential races | each winner under source lock in separate txs | apply vs `note_queued_work` | effect-first writes; sighting-first blocks write | lock held across orchestration | G16 `race_effect_then_sighting_effect_wins`; `race_sighting_then_effect_sighting_wins` | linearization = source lock | PR7 | executed-synthetic-pg16 |
| PR7-CUST-104 | RE-01 correlated child | PARENT_LINEAGE of same BOUND+acked parent + same source | admit + parent apply | child BOUND; parent still writes; child **new** effectId denied; same effectId historical | treating authentic child as contradiction, or as a second source write | G16 `correlated_child_of_fresh_admin_still_progresses`; `correlated_child_does_not_contradict_parent_capture`; `correlated_child_new_effect_id_after_parent_write_denied`; `correlated_child_same_effect_id_is_historical`; `parent_new_effect_id_after_child_write_denied` | correlatedCaptureId + source bind | PR7 | executed-synthetic-pg16 |
| PR7-CUST-105 | RE-01 uncorrelated parent | webhook parent + stolen ADMIN source child | consume stolen capture | `capture_content_no_longer_fresh` | manufactured lineage | G16 `uncorrelated_parent_cannot_manufacture_freshness` | correlated only if parent capture | PR7 | executed-synthetic-pg16 |
| PR7-CUST-106 | RE-01 duplicate capture after contradiction | recapture same command after sighting | capture / consume | `capture_content_no_longer_fresh` | duplicate-return freshness grant | G16 `duplicate_capture_after_contradiction_is_not_freshness_grant`; `duplicate_return_cannot_consume_contradicted_capture` | duplicate-return re-read | PR7 | executed-synthetic-pg16 |
| PR7-CUST-107 | RE-01 pending recovery then sighting | BEGIN admit, recover, then sight, then apply | apply | `effect_source_no_longer_fresh` | pending as trusted | G16 `pending_recovery_then_sighting_cannot_effect` | recover then effect re-read | PR7 | executed-synthetic-pg16 |
| PR7-CUST-108 | RE-01 missing evidence | no sighting row | admit + apply | progresses (absence is not a freshness grant beyond capture, and not invented non-freshness) | inventing non-freshness | G16 `missing_sighting_does_not_invent_nonfreshness`; `fresh_admin_without_sighting_still_writes` | bounded retention / ambiguity | PR7 | executed-synthetic-pg16 |
| PR7-CUST-109 | RE-01 NEG consume re-read removed | SINGLE mutation: omit consume contradiction check | capture→sight→consume | **must fail this design** (admit BOUND); effect recheck still holds | calling a two-defense drop single | NEG `consume_recheck_removed_revives_capture_first_admit`; `consume_recheck_removed_effect_recheck_still_holds` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-CUST-110 | RE-02 source canonicalization | same body vs new body / operation / NULL | `stocky_source_commitment` | stable across generated ids; changes with body/operation; STRICT NULL | absorbing work/effect ids | G16 `source_commitment_stable_across_generated_ids`; `source_commitment_changes_with_body`; `source_commitment_changes_with_operation`; `source_commitment_null_input_is_strict_null`; `python_and_sql_source_commitment_match` | `pr7-source-v1` | PR7 | executed-synthetic-pg16 |
| PR7-CUST-111 | RE-02 same source new effect id (capture) | overlap child + renamed ADMIN of same source_body | capture | `queued_work_cannot_acquire_fresh_admin_origin`; child guard ambiguous | new effectId as new content | G16 `same_source_new_effect_id_cannot_acquire_fresh_admin_capture`; `re02_source_digest_stable_across_effect_ids`; `re02_effect_digest_changes_with_effect_id` | source key | PR7 | executed-synthetic-pg16 |
| PR7-CUST-112 | RE-02 same source new effect id (host) | first write then second effectId same work | apply | `effect_digest_mismatch`; 0 rows | SourceEffectLink missing | G16 `same_work_second_effect_id_denied_while_fresh`; `same_source_new_effect_id_denied_on_real_effect_lane` | protected linkage | PR7 | executed-synthetic-pg16 |
| PR7-CUST-113 | RE-02 same source new work id | second ADMIN of same source_body | capture/admit | denied | remint | G16 `same_source_new_work_id_cannot_remint_admin_origin` | source key | PR7 | executed-synthetic-pg16 |
| PR7-CUST-114 | RE-02 genuine new source | new source_body same customer | admit + apply | write allowed | lifetime blacklist | G16 `genuine_new_source_same_customer_still_progresses`; `legitimate_successor_new_digest_still_progresses` | no lifetime ban | PR7 | executed-synthetic-pg16 |
| PR7-CUST-115 | RE-02 tenant isolation | shop_b same source_body | admit + apply | progresses; digests differ by domain | global digest | G16 `tenant_isolation_same_source_body_progresses` | tenant in source key | PR7 | executed-synthetic-pg16 |
| PR7-CUST-116 | RE-02 multi-level lineage | webhook→child→grandchild same source then ADMIN | capture | `queued_work_cannot_acquire_fresh_admin_origin` | rename across levels | G16 `multi_level_lineage_same_source_cannot_capture_admin` | AO-03 preserved | PR7 | executed-synthetic-pg16 |
| PR7-CUST-117 | RE-02 NEG identity source key | SINGLE mutation: apply uses effect commitment as source key | sight source_body; admit with new effectId; apply | **must fail this design** (write admitted) | calling consume+source mutations composite | NEG `identity_source_key_revives_new_effect_id_after_same_body_sighting` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-CUST-118 | PR49 restrictions carried | pin `d63629077fcf29775c69161372c2cf903cfa62c6` | proposal only | JWT `sub` exact string; `useOnlineTokens` stays disabled; publication fence ≠ read-before-write | importing PR49 sources; claiming peer acceptance | plan §7.6.2 PR49 restrictions | FACT vs PROPOSED vs UNEXECUTED | PR7 | not-executed-app-integration |
| PR7-CUST-119 | AO-06 table/manifest/extracted | extractor `--selftest` + extract | one-sided table or manifest hash edit | fail closed; coordinated edit of every declaration not prevented | manifest self-hash cycle | extractor `extraction_table_manifest_mismatch`; `extraction_authenticity_limit:coordinated_in_repo_edit_not_prevented` | Git pin + review | PR7 | executed-extractor-selftest |
| PR7-CUST-120 | RE-02 correlated child new effect after parent | parent wrote; child new effectId same source | apply | `effect_digest_mismatch`; 0 rows | per-work-only SourceEffectLink | G16 `correlated_child_new_effect_id_after_parent_write_denied` | unique source digest | PR7 | executed-synthetic-pg16 |
| PR7-CUST-121 | RE-02 correlated child same effect historical | child retries parent effectId | apply | rc=0; 1 row remains | treating retry as a second write | G16 `correlated_child_same_effect_id_is_historical` | historical bind | PR7 | executed-synthetic-pg16 |
| PR7-CUST-122 | RE-02 parent new effect after child write | child wrote first; parent new effectId | apply | `effect_digest_mismatch`; 0 parent rows | first-writer-only on work | G16 `parent_new_effect_id_after_child_write_denied` | unique source digest | PR7 | executed-synthetic-pg16 |
| PR7-CUST-123 | RE-02 duplicate-return is not remint | second admit new workId same identity+digest | admit | existing origin returned; no `w_coal2` row | treating rc=0 as a new origin | G16 `duplicate_admission_return_does_not_remint_new_work` | coalesce | PR7 | executed-synthetic-pg16 |

### 6.7.1 Residual own-guard (F-CLAUDE-PR7CC-02)

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-RESID-001 | CC-02 no GUC | remnants exist (`3`) | `stocky_privacy_customer_residual_count` with unset request GUC | `residual_request_guc_mismatch` `42501` — **not** `0` | silent zero treated as empty | G12 `residual_no_guc_raises_42501`; old CE-C | residual helper | PR7 | executed-synthetic-pg16 |
| PR7-RESID-002 | CC-02 foreign request GUC | remnants exist | GUC = other shop's request | `42501` — **not** `0` | counting through mismatched GUC | G12 `residual_foreign_request_guc_raises_42501`; old CE-C | residual helper | PR7 | executed-synthetic-pg16 |
| PR7-RESID-003 | CC-02 wrong tenant | remnants exist; request GUC matches | tenant GUC = shop_b | `42501` | RLS-filtered zero as success | G12 `residual_wrong_tenant_raises_42501` | residual helper | PR7 | executed-synthetic-pg16 |
| PR7-RESID-004 | CC-02 stale attempt | remnants exist | expired/foreign attempt GUC | `42501` | depending on adjacent enumerator | G12 `residual_stale_attempt_raises_42501` | residual helper | PR7 | executed-synthetic-pg16 |
| PR7-RESID-005 | CC-02 direct nonzero | full matching GUC/attempt/capability | direct call as erasure | count `3` | requiring enumerate first | G12 `residual_direct_nonzero_with_full_context` | residual helper | PR7 | executed-synthetic-pg16 |
| PR7-RESID-006 | CC-02 genuine empty | owner BYPASSRLS deleted remnants | direct call with full context | count `0` | RLS-filtered DELETE credited as drain | G12 `residual_direct_genuine_empty` | residual helper | PR7 | executed-synthetic-pg16 |
| PR7-RESID-007 | CC-02 CP EXECUTE | full context | CP calls residual | count returned | PUBLIC EXECUTE | G12 `residual_control_plane_execute_with_context` | grants | PR7 | executed-synthetic-pg16 |
| PR7-RESID-008 | CC-02 runtime denied | full context | runtime EXECUTE residual | `42501` | runtime residual principal | G12 `residual_runtime_execute_denied` | grants | PR7 | executed-synthetic-pg16 |
| PR7-RESID-009 | CC-02 reader denied | full context | reader EXECUTE residual | `42501` | reader residual principal | G12 `residual_reader_execute_denied` | grants | PR7 | executed-synthetic-pg16 |
| PR7-RESID-010 | CC-02 same-shop other request | remnants on `preq_cr` | GUC = other same-shop request | `42501` | sibling-request zero | G12 `residual_same_shop_other_request_guc_raises` | residual helper | PR7 | executed-synthetic-pg16 |
| PR7-RESID-011 | CC-02 NEG | drop residual GUC/capability guard | missing GUC | **must fail this design** (returns `0`) | crediting the unchanged contract | NEG `residual_guard_removed_returns_zero` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-RESID-012 | CC-02 historical qualification | old TF residual + complete | missing GUC on complete | complete still denied via enumerator; **not** a demonstrated live false-complete | relabelling CE-C as P1 false-complete | old CE-C `CE-C-complete-shielded-by-enumerate` | complete helper | PR7 | executed-synthetic-pg16 |

### 6.8 Side channels and isolation

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-SIDE-001 | dual-role | privacy worker | merchant delete + control-plane delete | separate txns; checkpoint not leading | one txn both roles | new | privacy worker | PR7 | designed |
| PR7-SIDE-002 | shared Redis | two shops | redact A | B jobs remain | FLUSHALL | new | redis | PR7 | designed |
| PR7-SIDE-003 | pooled PG | privacy job A then B | run both | no leftover `stocky.current_shop_id` / `stocky.privacy_request_id` | B seeing A | new | privacy-surfaces.test.ts | PR7 | designed |
| PR7-SIDE-004 | missing envelope | worker | start | deny before merchant access | query | new | same | PR7 | designed |
| PR7-SIDE-005 | foreign envelope | A envelope on B rows | delete attempt | deny | cross-shop delete | new | same | PR7 | designed |
| PR7-SIDE-006 | P7-C05 ordinary replay while disabled | processingEnabled=false | human replay | deny | privacy capability used as replay bypass | new | replay | PR7 | designed |
| PR7-SIDE-007 | P7-C05 afterAuth while disabled | REDACTED generation | afterAuth | deny enable | catalog enqueue | new | after-auth | PR7 | designed |
| PR7-SIDE-008 | P7-C02 no generic bypass | privacy-erasure connection | SELECT shop B | 0 rows | reading B audit | new | privacy-erasure | PR7 | designed |
| PR7-SIDE-009 | F-CLAUDE-PR7CP-02 no fact mutation | privacy-erasure | INSERT/UPDATE merchant facts | insufficient privilege / no policy | privacy INSERT/UPDATE policies on facts | new | grant catalog | PR7 | designed |
| PR7-SIDE-010 | F-CLAUDE-PR7CP-02 no OR leakage | `stocky_runtime` membership | SELECT while disabled using privacy exception | 0 rows; not a member of `stocky_privacy_erasure`; no policy `TO PUBLIC`/`TO stocky_runtime` | permissive OR granting runtime the privacy USING | new | role-membership + pg_policies | PR7 | designed |
| PR7-ISO-001 | replace deferral | current worker-surfaces | add privacy path tests | still honest about export/reconciliation deferral | renaming only | new + edit worker-surfaces comment | db-isolation | PR7 | designed |
| PR7-ISO-002 | raw SQL | privacy connection | `SET ROLE` / `DISABLE RLS` | denied | bypass RLS | existing role-membership tests + new | enforcement | PR7 | designed |
| PR7-ISO-003 | bootstrap | privacy code | architecture audit | must not live in `bootstrap.server.ts` | merchant delete in bootstrap | architecture-audit | `architecture-audit.test.ts` | PR7 | designed |

### 6.9 Escalation operations

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-ESCL-001 | F-CLAUDE-PR7CP-09 owner view | installed generation; verified account_owner | GET `app.platform.privacy.escalation` | minimized request + ability to supply lifecycle evidence | mark complete; `retain_live`; seeing raw PII | new | `app.platform.privacy.escalation.tsx` | PR7 | designed |
| PR7-ESCL-002 | F-CLAUDE-PR7CP-09 unauthorized resolve | CLI `--actor=anyone` / domain possession / `shop_admin` | resolve | deny; no state change | capability from a claimed string | new | `scripts/privacy/resolve-escalation.ts` | PR7 | designed |
| PR7-ESCL-003 | F-CLAUDE-PR7CP-09 operator uninstalled | shop uninstalled/disabled; `stocky_privacy_operator` credential; FXT-ESCALATION-EVIDENCE | `--dry-run` then CAS `bind_old_target` / `schedule_remnants_erase` / `leave_escalated` | preview then compare-and-set on `rowVersion`; audit | generic mark-complete; skipping dry-run default | new | operator-resolve.server.ts | PR7 | designed |
| PR7-ESCL-004 | F-CLAUDE-PR7CP-09 clocks + no waive | ESCALATED; insufficient evidence; or `receivedAt+20d/+27d/+30d` | scheduler / resolve | alerts per §7.12; `leave_escalated` or `OVERDUE`; still not COMPLETED without residual proof | extending 30d; operator-invented legal hold; `retain_live` waiving erasure | new | scheduler + CLI | PR7 | designed |

### 6.10 Commands / CI

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-CI-001 | brief command | package.json | `npm run test:privacy` | script exists; nonzero tests; fail on zero collect | missing script | prior planning session **failed** as expected (exit 1, missing script) | package.json | PR7 runtime | **executed-prior-planning-head-not-re-run** (absence) |
| PR7-CI-002 | CI policy | docs-only this planning PR (plan + matrix + **four** preserved reviews) | classify vs **W** | `docs_only=true`; `full_ci=false`; **six** Markdown paths | full_ci for docs-only; classifying vs historical V as this planning delta; zero tests collected treated as success | classifier after land vs `ee193f3…` | classify script | this planning PR | designed until post-commit classify; then executed-this-planning-session |
| PR7-CI-003 | runtime PR | implementation diff | classify | `full_ci=true`; heavy includes privacy | docs-only on schema change | CI | workflow | PR7 runtime | designed |
| PR7-CI-004 | F-CLAUDE-PR7TF-04 | disposable driver | query `server_version` / `server_version_num` | actual cluster version recorded; `results.json` class = run log | hardcoded postgres field; treating run-log hash as a verification artifact | G10 `postgres_version_queried_not_hardcoded` | driver | this planning PR | executed-synthetic-pg16 |
| PR7-CI-005 | F-CLAUDE-PR7CC-04 | reproduction | `PROOF_ROOT` + `PGHOST`/`PGPORT`; stage `01_contract.sql` + `02_seed.sql` beside the driver | self-contained; sha256 of staged files match §14 | hardcoded `/tmp/pr45-tf`; hashing only a driver that cannot find SQL | G10 + §14 commands | driver | this planning PR | executed-synthetic-pg16 |

---

### 6.11 Topic authority (Decision A / F-CLAUDE-PR7XC-01)

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-TOP-001 | data_request READ | LIVE shop_a; two customers; enumerated `preq_dr` | `stocky_privacy_reader` SELECT orders | only `of_a1` | seeing `of_a2` | G1 | sql.ts privacy read | PR7 | executed-synthetic-pg16 |
| PR7-TOP-002 | invisible ≠ absent | same | reader count vs owner count | RLS 1; owner 2 | treating 0 RLS rows as successful absence | G1 | enumerator | PR7 | executed-synthetic-pg16 |
| PR7-TOP-003 | reader no DELETE | reader + data_request GUC | `DELETE FROM "ShopifyOrderFact"` | `42501` | row removal | G1 | grants | PR7 | executed-synthetic-pg16 |
| PR7-TOP-004 | data-request credentials on erasure request | reader + `preq_cr` GUC | DELETE facts | `42501` | using reader as erasure | G1 | grants | PR7 | executed-synthetic-pg16 |
| PR7-TOP-005 | data_request cannot erase | erasure role + `preq_dr` | broad DELETE | remaining `of_a1`=1 | capability READ implying DELETE | G1 | capability helper | PR7 | executed-synthetic-pg16 |
| PR7-TOP-006 | disabled-shop data_request | `processingEnabled=false`; still LIVE fence | reader SELECT | `of_a1` visible | requiring re-enable | G1 | policies | PR7 | executed-synthetic-pg16 |
| PR7-TOP-007 | customers/redact broad DELETE | enumerated `preq_cr` | `DELETE FROM "ShopifyOrderFact"` no WHERE | only target gone; `of_a2` remains | whole-shop erase; application WHERE as the only control | G1 | delete_customer policy | PR7 | executed-synthetic-pg16 |
| PR7-TOP-008 | child linkage | lines of both orders | customer DELETE lines | other customer’s `ol_a2` remains | deleting unlinked children | G1 | enumerator join | PR7 | executed-synthetic-pg16 |
| PR7-TOP-009 | wrong shop GUC | `preq_cr` + GUC shop_b | SELECT/DELETE | 0 visible; shop_b facts remain | cross-tenant | G1 | tenant GUC | PR7 | executed-synthetic-pg16 |
| PR7-TOP-010 | missing/expired attempt | GUC attempt `expired` | `capability_allows('DELETE_CUSTOMER')` | `false` | stale attempt delete | G1 | capability | PR7 | executed-synthetic-pg16 |
| PR7-TOP-011 | unknown topic | topic `customers/unknown` | READ/DELETE_CUSTOMER/DELETE_SHOP | all false | fail-open | G1 | capability | PR7 | executed-synthetic-pg16 |
| PR7-TOP-012 | no arbitrary keys | erasure INSERT `PrivacyTargetKey` for `of_a2` | INSERT | `42501` | enlarging scope via row ids | G1 | publisher boundary | PR7 | executed-synthetic-pg16 |
| PR7-TOP-013 | shop/redact generation | ERASING `shop_red` | enumerate + DELETE facts/lines/audit | remaining 0 for that shop | deleting shop_a/b | G1 | delete_shop policy | PR7 | executed-synthetic-pg16 |
| PR7-TOP-014 | incomplete enumeration | lookup order `no-such` | enumerate | `enumerationComplete=false`, `missingLinkages=1` | COMPLETED empty-by-zero-rows | G1 | enumerator | PR7 | executed-synthetic-pg16 |
| PR7-TOP-015 | F-CLAUDE-PR7TF-01 source residual | late matching audit after enumerate | `stocky_privacy_customer_residual_count` | independent of old `PrivacyTargetKey`; remnant counted | manifest-filtered residual 0 | G7; old-model CE-1 | residual helper | PR7 | executed-synthetic-pg16 |
| PR7-TOP-016 | F-CLAUDE-PR7TF-01 in-flight writer | writer holding shared target lock before barrier | install barrier then complete | in-flight write drains; later matching writes deny; no shop freeze | completing while a matching writer can still commit | G7 `writer_active_before_barrier_admission` | target locks | PR7 | executed-synthetic-pg16 |
| PR7-TOP-017 | F-CLAUDE-PR7TF-01 NEG complete | drop residual/complete serialization | complete with remnant | **must fail this design** (false COMPLETED) | crediting the unchanged contract | NEG `completion_guard_removed_allows_false_complete` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-TOP-018 | CC-GEN namespace ACTIVE | ACTIVE barrier on `gen_a`; later LIVE `gen_a_zz` | matching write any origin | deny; examine **all** ACTIVE barriers in the canonical namespace | locking only the request's generation | G11 `cea_two_gen_matching_write_still_denied` | `pr7-ctgt-v2` | PR7 | executed-synthetic-pg16 |
| PR7-TOP-019 | CC-GEN generation_writable | LIVE + ERASING coexistence in one canonical domain | `stocky_generation_writable` | frozen (fail-closed) | writable because a LIVE row still exists / `ORDER BY id` | G5 + G11 fixtures | lifecycle helper | PR7 | executed-synthetic-pg16 |
| PR7-TOP-020 | CC-GEN no lexicographic resolver | adversarial id `gen_a_zz` > `gen_a` inserted later | origin resolver | unique LIVE/declared only; never `ORDER BY id` / latest timestamp | latest-created timestamp guess | G11 + NEG-4 | origin helper | PR7 | executed-synthetic-pg16 |

### 6.12 Privilege closure (F-CLAUDE-PR7XC-03)

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-GRANT-001 | load-bearing EXECUTE | revoke capability EXECUTE from erasure | SELECT facts as erasure | `42501` | silent 0-row treated as success of the helper | G2 | roles.ts | PR7 | executed-synthetic-pg16 |
| PR7-GRANT-002 | tenant helper EXECUTE | revoke `stocky_current_tenant_id` from erasure | SELECT facts | `42501` | policy calling undeclared EXECUTE | G2 | sql.ts | PR7 | executed-synthetic-pg16 |
| PR7-GRANT-003 | load-bearing policy | DROP `order_privacy_read` | SELECT as erasure | 0 rows | PUBLIC policy | G2 | pg_policies | PR7 | executed-synthetic-pg16 |
| PR7-GRANT-004 | runtime 0-row vs error | shop_b disabled | runtime INSERT audit; SELECT facts | INSERT error; SELECT 0 | assuming every denial throws | G2 | rlsPoliciesSql | PR7 | executed-synthetic-pg16 |
| PR7-GRANT-005 | no membership bypass | catalog | `pg_has_role(runtime, erasure)` | false | runtime member of privacy | G2 | roles | PR7 | executed-synthetic-pg16 |
| PR7-GRANT-006 | no processing helper | erasure | `stocky_shop_processing_enabled` | `42501` | granting processing helper to privacy to repair deny | G2 | catalogue | PR7 | executed-synthetic-pg16 |
| PR7-GRANT-007 | operator not a fact principal | operator | `capability_allows` | `42501` | CLI role reading facts via helper | G2 | operator grants | PR7 | executed-synthetic-pg16 |

### 6.13 Coordinator / Shop delete (F-CLAUDE-PR7XC-02/04)

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-COORD-001 | Decision B authority | disabled shop; admitted `PrivacyRequest` | coordinator poll/claim | work claimed **without** DurableJob/fair-claim; no Shop FK on attempt | requiring `createPrivacyDurableJob`; weakening DurableJob.shopId | designed + G3 survival | `app/privacy/coordinator` | PR7 | designed (runtime) / executed-synthetic-pg16 (FK) |
| PR7-COORD-002 | Restrict family | DurableJob remains | finalize Shop | `23503` / shop not removed | ignoring Restrict | G3 | finalizer | PR7 | executed-synthetic-pg16 |
| PR7-COORD-003 | SET NULL | children cleaned; FINALIZING | finalize | `deleted`; generation `shopRowId` null; `targetShopId` kept | generation UPDATE grant; losing target | G3 | FK | PR7 | executed-synthetic-pg16 |
| PR7-COORD-004 | survival | Shop gone | SELECT request/attempt | both remain | coordinator deleted with Shop | G3 | schema | PR7 | executed-synthetic-pg16 |
| PR7-COORD-005 | already-deleted | Shop absent | finalize retry | `already_absent` | fatal error or false COMPLETED | G3 | finalizer | PR7 | executed-synthetic-pg16 |
| PR7-COORD-006 | stale epoch | wrong attempt id | finalize | `finalizer_stale_attempt` | deleting under lost epoch | G3 | finalizer | PR7 | executed-synthetic-pg16 |
| PR7-COORD-007 | retry after delete | Shop gone; valid epoch | `capability_allows('DELETE_SHOP')` | true | requiring Shop lookup | G3 | capability | PR7 | executed-synthetic-pg16 |
| PR7-COORD-PUB-001 | F-CLAUDE-PR7TF-02 takeover | epoch-1 leased; worker loss | `stocky_privacy_claim_attempt` | old LOST; new epoch; ACTIVE barriers rebound; successor enumerates | completing under lost epoch | G8 `successor_enumerates_after_takeover`; `epoch_takeover_completes_under_rebound_barrier` | claim helper | PR7 | executed-synthetic-pg16 |
| PR7-COORD-PUB-002 | F-CLAUDE-PR7TF-02 pause-then-mutate | stale caller validated then paused; successor published | stale `stocky_privacy_enumerate_targets` | `enumerator_stale_attempt`; new epoch keys/flags/`publicationRevision` byte-identical | check-then-act mutate of the new epoch | G8 `stale_publisher_after_pause_does_not_mutate`; `new_epoch_keys_unchanged_by_stale`; old-model CE-6 | publication lock | PR7 | executed-synthetic-pg16 |
| PR7-COORD-PUB-003 | F-CLAUDE-PR7TF-02 wrong/expired | GUC attempt ≠ live leased | enumerate | denied; live keys unchanged | foreign/expired/terminal publisher | G8 `wrong_attempt_cannot_publish`; `expired_terminal_attempt_cannot_publish` | live_attempt_ok | PR7 | executed-synthetic-pg16 |
| PR7-COORD-PUB-004 | F-CLAUDE-PR7TF-02 delayed write after takeover complete | successor COMPLETED | old-epoch delayed write | `customer_target_restore_denied` | restoring under lost epoch | G8 `delayed_old_write_after_takeover_complete_denied` | completed-target | PR7 | executed-synthetic-pg16 |
| PR7-COORD-PUB-005 | F-CLAUDE-PR7TF-02 NEG epoch | drop publication/live-attempt fence | stale enumerate after takeover | **must fail this design** (CE-6 mutation) | crediting the unchanged contract | NEG `epoch_guard_removed_allows_stale_publish` | load-bearing | PR7 | executed-synthetic-pg16 |

### 6.14 Authorization lock and command (F-CLAUDE-PR7XC-05/07)

**Decision C note:** PR7-RBAC-015/019 original `FOR UPDATE` meaning is preserved and **withdrawn as the required helper**. Replacement:

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-AUTHZ-001 | verifier SELECT-only | catalog | grants on `ShopRoleAssignment` for verifier owner | `SELECT` only | UPDATE grant used to take row lock | G4 | roles | PR7 | executed-synthetic-pg16 |
| PR7-AUTHZ-002 | admin allow / auditor deny / missing | READ COMMITTED; lock then verify | `platform.replay.execute` | t / f / f | FOR UPDATE; cached pre-lock verdict | G4 | verifier | PR7 | executed-synthetic-pg16 |
| PR7-AUTHZ-003 | revoke-before-effect | revoke commits; then CP lock+verify | enqueue | false; no new job | enqueue winning after revoke | G4 | replay.server.ts | PR7 | executed-synthetic-pg16 |
| PR7-AUTHZ-004 | fresh-read-after-wait | holder lock; waiter blocked; holder revokes+commits | waiter verify | false | using pre-wait true | G4 | advisory lock | PR7 | executed-synthetic-pg16 |
| PR7-AUTHZ-005 | effect-before-revoke | CP inserts command+job+replay; then revoke | observe | command remains | deleting committed effect | G4 | same | PR7 | executed-synthetic-pg16 |
| PR7-CMD-001 | lost HTTP after commit | same command/actor/digest after revoke | SELECT command | `job_new1`; no new insert | treating as never-happened | G4 | PlatformReplayCommand | PR7 | executed-synthetic-pg16 |
| PR7-CMD-002 | other actor / changed digest | same commandId | SELECT / INSERT | 0 rows / `23505` | false success | G4 | unique (shopId, commandId) | PR7 | executed-synthetic-pg16 |
| PR7-CMD-003 | cross-tenant | admin of A on shop_b | verify | false | shop A grant on B | G4 | verifier | PR7 | executed-synthetic-pg16 |

### 6.15 Lifecycle gate and tombstone (F-CLAUDE-PR7XC-06/08)

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-GATE-001 | shared holder | runtime shared gate held | exclusive freeze | **wait** then lock_timeout (`55P03`/cancel) | exclusive proceeding while shared held | G5 | lifecycle lock | PR7 | executed-synthetic-pg16 |
| PR7-GATE-002 | committed-before-freeze | shared holder then COMMIT | after exclusive timeout | shared rc=0 | calling that gap atomic with freeze | G5 | same | PR7 | executed-synthetic-pg16 |
| PR7-GATE-003 | new writer after freeze | fence=ERASING | participating guard | `generation_frozen` **rejection** | write to frozen generation | G5 | write_guard | PR7 | executed-synthetic-pg16 |
| PR7-GATE-004 | bootstrap same domain | fence=ERASING | INSERT Shop same domain under guard | `generation_frozen` | reviving target during finalization | G5 | bootstrap hook | PR7 | executed-synthetic-pg16 |
| PR7-GATE-005 | unrelated shop | shop_b LIVE | guard + SELECT | continues (count 1) | global lock | G5 | domain key | PR7 | executed-synthetic-pg16 |
| PR7-GATE-006 | uninstrumented CP | no guard | CP INSERT DurableJob shop_a while ERASING | **succeeds** — LIMIT | claiming RLS/advisory locks cover raw CP | G5 | rollout drain | PR7 | executed-synthetic-pg16 |
| PR7-GATE-007 | lost epoch | attempt LOST; new epoch 2 | capability old vs new | f / t | completing under lost epoch | G5 | attempt unique epoch | PR7 | executed-synthetic-pg16 |
| PR7-TOMB-001 | post-prune duplicate | unexpired tombstone COMPLETED | lookup webhook id | COMPLETED | spurious ESCALATED | G6 | tombstone | PR7 | executed-synthetic-pg16 |
| PR7-TOMB-002 | expired evidence | expiresAt past | lookup | 0 rows → uncorrelated | reconstructing bind | G6 | same | PR7 | executed-synthetic-pg16 |
| PR7-TOMB-003 | new generation | new request `gen_new` | old tombstone generation | still `gen_red` only | inheriting old completion | G6 | classifier | PR7 | executed-synthetic-pg16 |
| PR7-GATE-008 | Redis/FS | n/a | n/a | **unexecuted LIMIT** — toy PG is not a Redis/FS fence | asserting zero residuals from PG locks | — | D recovery boundary | PR7 | not executed |
| PR7-GATE-009 | F-CLAUDE-PR7TF-03 inventory | catalog after contract load | `stocky_inventory_is_complete` | true only with `completeAttemptRetry`, `dispatcher_disabled_shop_path`, and `withTenantBoundTransaction` **REQUIRED / not optional** | omitting those symbols; optional db-context | G9 `inventory_includes_retry_and_dispatcher_disabled`; `inventory_incomplete_when_required_writer_removed` | ParticipatingWriterInventory | PR7 | executed-synthetic-pg16 |
| PR7-GATE-010 | F-CLAUDE-PR7TF-03 retry write | inventoried `completeAttemptRetry` | `stocky_lifecycle_complete_attempt_retry` | guarded CP `DurableJob` stamp; freeze can wait on already-running txn | raw lifecycle UPDATE without the gate | G9 `lifecycle_complete_attempt_retry_guarded_write` | lifecycle.server.ts | PR7 | executed-synthetic-pg16 |
| PR7-GATE-011 | F-CLAUDE-PR7TF-03 dispatcher disabled | `processingEnabled=false` | `stocky_dispatcher_disabled_shop_write` | still writes `JobDispatch` + `DurableJob`; processingEnabled ≠ drain | treating the disabled-shop re-check as quiescence | G9 `dispatcher_disabled_shop_path_still_writes` | dispatcher.server.ts | PR7 | executed-synthetic-pg16 |
| PR7-GATE-012 | F-CLAUDE-PR7TF-03 unguarded probe | tenant-linked `probe_unguarded%` without guard | `stocky_detect_unguarded_cp_write` | architecture gate fails | optional wrapper; claiming inventory complete | G9 `inventory_gate_detects_unguarded_tenant_linked_write` | architecture test | PR7 | executed-synthetic-pg16 |
| PR7-GATE-013 | F-CLAUDE-PR7TF-03 NEG writer gate | drop participating-write guard | freeze vs uninstrumented writer | **must fail this design** (writer skips freeze) | crediting the unchanged contract | NEG `writer_gate_removed_skips_freeze` | load-bearing | PR7 | executed-synthetic-pg16 |
| PR7-GATE-014 | F-CLAUDE-PR7CC-03 W required symbols | W inventory loaded | omit `runOrderFactsSyncJob` or `computeSyncHealth` | `stocky_inventory_is_complete` false | treating family labels as completeness; copying PR48's 86-row count | G9 `inventory_incomplete_when_w_sync_job_removed`; `inventory_incomplete_when_health_upsert_removed` | ParticipatingWriterInventory | PR7 | executed-synthetic-pg16 |
| PR7-GATE-015 | F-CLAUDE-PR7CC-03 not-86 / historical label | catalog after contract load | `COUNT(*)` and delete historical `getShopHealth` | row count **≠ 86**; completeness remains true without that ABSENT export | completeness = 86; requiring the misnamed V label | G9 `inventory_row_count_is_not_pr48_86`; `completeness_not_tied_to_historical_getShopHealth_row` | inventory helper | PR7 | executed-synthetic-pg16 |
| PR7-GATE-016 | PR48 Redis/scratch LIMIT | n/a | n/a | **unexecuted LIMIT** — `Job.remove` / TTL / PID / `quiescenceConfirmed` are **not** drain; do not auto-call W `reclaimOperatorSelectedDScratch` from PR7 (Helper B **PREP_B_19**) | certifying a missing cross-system fence from PG proofs | FACT (PR48) PREP-B-*; G5 LIMIT | D recovery boundary | PR7 | not executed |
| PR7-GATE-017 | GW-02 source-derived complete | independent required set loaded | `stocky_inventory_is_complete` | true only when every required `source_identity` is inventoried, no UNKNOWN, no stale SOURCE_SITE, WRITE not misclassified; required count **≠** inventory count | deriving the expected set from inventory rows; seven-name floor labelled complete | G14 `source_derived_complete_true`; `required_set_not_empty_and_not_from_inventory_count`; `no_unknown_candidates`; `seven_symbol_floor_true` | SourceDerivedRequired | PR7 | executed-synthetic-pg16 |
| PR7-GATE-018 | GW-02 remove each required writer | catalog after contract load | DELETE each required symbol including six CE-E misses | complete=false | seven-symbol floor still true for CE-E misses | G14 `inventory_incomplete_when_*_removed` | ParticipatingWriterInventory | PR7 | executed-synthetic-pg16 |
| PR7-GATE-019 | GW-02 inject unlisted writers | independent required set | insert raw-SQL / aliased-wrapped / route-TSX writer | complete=false | ignoring routes/TSX/raw SQL | G14 `unlisted_rawInsert_blocks_completeness`; `unlisted_wrappedUpsert_blocks_completeness`; `unlisted_action_blocks_completeness` | scanner | PR7 | executed-synthetic-pg16 |
| PR7-GATE-020 | GW-02 misclassify / stale / unknown / empty | WRITE→READ_ONLY; stale SOURCE_SITE; UNKNOWN candidate; empty required | `stocky_inventory_is_complete` | false | unknown ignored as nonwriter; empty required derived from inventory | G14 `misclassify_write_as_readonly_incomplete`; `stale_source_mapping_incomplete`; `unknown_candidate_blocks_completeness`; `empty_required_set_is_not_complete` | completeness helper | PR7 | executed-synthetic-pg16 |
| PR7-GATE-021 | GW-02 nonwriter / historical label | NONWRITER candidate; delete `getShopHealth` | complete | remains true; no phantom required writer | treating reads as writers; requiring ABSENT export | G14 `nonwriter_does_not_phantom_required`; `historical_getShopHealth_still_not_required` | scanner | PR7 | executed-synthetic-pg16 |
| PR7-GATE-022 | GW-02 NEG floor-only | replace `is_complete` with `floor_complete` only | omit `runOrderFactsReconcileJob` | **must fail this design** (complete remains true) | crediting the unchanged contract | NEG `floor_only_completeness_revives_cee_six_misses_undetected` | load-bearing | PR7 | executed-synthetic-pg16 |

## 7. Mapping to current V tests (do not relabel as PR7 complete)

| Current test | What it actually proves | What it does **not** prove |
|---|---|---|
| `sync-control-plane.test.ts` sanitizer (11 tests, **executed-prior-planning-head-not-re-run** PASS) | PR4 projection allowlists; unsupported topics throw | compliance processors |
| `mutation-safety.test.ts` (6 tests, **executed-prior-planning-head-not-re-run** PASS) | B GraphQL cannot select customer PII fields | redaction of stored rows |
| `foundation-safety.test.ts` (4 tests, **executed-prior-planning-head-not-re-run** PASS) | inventory-write flags default OFF | RBAC |
| `shop-domain.test.ts` (10 tests, **executed-prior-planning-head-not-re-run** PASS) | domain normalization | actor identity |
| `sync-uninstall.test.ts` | disable+cancel **when executed**; **not executed this session** | session count; REDACTED; shop/redact |
| `worker-surfaces.test.ts` | job envelope isolation; **defers** privacy | privacy jobs |
| `authority.test.ts` | shop tenant **when executed**; **not executed this session** | staff roles |

---

## 8. Proposed skips / deferred (with reasons)

| Item | Reason | Not a waiver of |
|---|---|---|
| Live Partner HMAC against a merchant shop | production/store unauthorized | local HMAC tests using Shopify library fixtures |
| Legal hold contents | Q-008 OPEN | empty-hold implementation + fail-closed unknown hold |
| Backup/restore after redact | staging/ops | residual probe on live DB |
| Full PRD buyer/receiver matrix | D-PR7-07 | platform matrix |
| PR8 reconciliation engine | later PR | privacy residual emptiness |
| Million-line D scratch in PR7 | belongs to D scale; include **unit** leftover probe if D merged | ignoring scratch if files exist on base |
| Enabling `useOnlineTokens` in **this** planning PR | D-PR7-02: owner proof separately gated; mixedToken/stale-cache must be fenced first; not authorized here | proving actor id from JWT `sub` **without** requiring online tokens; later reviewed adapter + old-session migration |
| Live Shopify / App Bridge ID-token bind | Helper A PREP-A-16 / coordinator PREP-A-07 **UNVERIFIED**; synthetic library probes are not live tokens | D-PR7-01 actor-string contract; dest/iss in **app** |
| Redis / export / D-scratch drain | G5 LIMIT; PR48 PREP-B-* are not this session and are not a certified fence | keeping privacy incomplete when quiescence cannot be proven; not auto-calling W reclaim |
| Live **application** PostgreSQL/Redis suites (`test:db-isolation`, uninstall) in this planning environment | App services not the disposable proof cluster (**BLOCKED** as V suites) | Disposable PG 16 proofs **did** run (G1–G12 + NEG). Implementation must still execute live catalog tests on the app database |

---

## 9. Cross-check against the execution plan

| Matrix group | Plan anchors |
|---|---|
| PR7-ACT-001…025 | §7.1, D-PR7-01/02/04, **P7-C01**, **F-CLAUDE-PR7CP-05**, PR48 PREP-A-* |
| PR7-RBAC-001…021 | §7.2, §7.10, D-PR7-07/12, **P7-C04**, **F-CLAUDE-PR7CP-06** |
| PR7-AUD-001…014 | §7.3, §7.7, D-PR7-03/08, **P7-C02**, **F-CLAUDE-PR7CP-02** |
| PR7-LIFE-001…024 | §7.4, §7.6, D-PR7-05/06, **P7-C03**, **F-CLAUDE-PR7CP-01/04** |
| PR7-PRIV-001…019 | §7.4, §7.9, §7.11, **P7-C05**, **F-CLAUDE-PR7CP-02/07**, **F-CLAUDE-PR7XC-08** |
| PR7-TOP-* / GRANT-* / COORD-* / AUTHZ-* / CMD-* / GATE-* / TOMB-* / RESID-* | §7.6.2–7.11, §7.7, Decisions A–E / **CC-GEN**, **F-CLAUDE-PR7XC-01…08**, **F-CLAUDE-PR7TF-01…03**, **F-CLAUDE-PR7CC-01…04**, **F-CLAUDE-PR7GW-01/02**, **F-CLAUDE-PR7TA-01/02** |
| PR7-RED-001…021 | §7.5–7.6.4, D-PR7-10/11/13, **F-CLAUDE-PR7CP-03/04** |
| PR7-CUST-001…061 | §3, §7.6.2–7.6.3, §7.13, D-PR7-14, **F-CLAUDE-PR7CP-08/10**, **F-CLAUDE-PR7TF-01**, **F-CLAUDE-PR7CC-01** / **CC-GEN**, **F-CLAUDE-PR7GW-01**, **F-CLAUDE-PR7TA-01** |
| PR7-COORD-PUB-* | §7.6.2 Epoch, §7.7.2, **F-CLAUDE-PR7TF-02** |
| PR7-ESCL-001…004 | §7.12, **F-CLAUDE-PR7CP-09** |
| PR7-SIDE-* / ISO-* | §7.7–7.9, **F-CLAUDE-PR7CP-02** |
| PR7-CI-* | §10, CI_POLICY, **P7-C06**, **F-CLAUDE-PR7TF-04**, **F-CLAUDE-PR7CC-04** |

Every constrained decision that can fail a merchant-safety test has at least one matrix row. **D-PR7-09** pause → PR7-PRIV-006. **D-PR7-14** download → PR7-CUST-006/011/012. **P7-C01** first-login → PR7-ACT-013…023. **P7-C03** escalation → PR7-LIFE-008/011…024, PR7-RED-016, PR7-ESCL-*. **P7-C04** revocation → PR7-RBAC-010/013/015…021.

### 9.1 Correction / decision ID map

| P7-C | Constrained D-PR7 | Primary matrix IDs |
|---|---|---|
| P7-C01 | D-PR7-04 | PR7-ACT-013…023, PR7-RBAC-012 |
| P7-C02 | D-PR7-08, D-PR7-11 | PR7-AUD-001/002/009/011…014, PR7-RED-001/007/015/021 |
| P7-C03 | D-PR7-05, D-PR7-06 | PR7-LIFE-006/008/011…024, PR7-RED-016 |
| P7-C04 | D-PR7-12 | PR7-RBAC-010/013/015…021 |
| P7-C05 | D-PR7-13 shape; lookup keys | PR7-PRIV-013…018, PR7-CUST-001/002/009/010, PR7-SIDE-006…010 |
| P7-C06 | §10 gates | PR7-CI-*; Now-column labels; exit criteria P0/P1/P2 |

Original D-PR7 IDs are not renamed.

---

## 10. Evidence recorded in this planning environment

| Command | Exit | Tests | SHA / env | Classification |
|---|---|---|---|---|
| `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-control-plane.test.ts` | 0 | 11 passed | V `a3ff480f1477237f8055f10c43298480a05728a1` | **executed-prior-planning-head-not-re-run** |
| `npx vitest run app/lib/order-facts/admin-read/mutation-safety.test.ts app/lib/order-facts/foundation-safety.test.ts` | 0 | 10 passed | V | **executed-prior-planning-head-not-re-run** |
| `npx vitest run app/lib/shop-domain.test.ts` | 0 | 10 passed | V | **executed-prior-planning-head-not-re-run** |
| Node IEEE-754 `Number("9007199254740993")===9007199254740992` | 0 | n/a | Node `v22.14.0` | **executed-prior-planning-head-not-re-run** |
| `npm run test:privacy` | 1 | n/a missing script | V | **executed-prior-planning-head-not-re-run** (absence; implementation gate) |
| Disposable historical 59-case driver | 0 | **59 passed / 0 failed** | PG 16.15; contract sha256 `b29ef463…` (original-run identity) | **executed-prior-planning-head-not-re-run** / `executed-synthetic-pg16` (S head; preserved) |
| Old-model CE-1 / CE-6 on unchanged 59-case scripts | 0 | 2 counterexamples | CE-1 residual `0` while `ae_a3` survived; CE-6 `true,0`/3 keys → `false,1`/0 keys | **executed-prior-planning-head-not-re-run** (defect reproduction identity preserved) |
| Disposable TF corrected contract at S | 0 | **115 records / 89 unique / 26 reruns** | queried `16.15` / `160015`; contract `75ab1c02…`; driver `566e0f28…`; run log `006e5799…` (**not** a verification artifact) | **executed-prior-planning-head-not-re-run** / `executed-synthetic-pg16` (do **not** read 115 unique) |
| Old-model CE-A / CE-B / CE-C on unchanged TF contract | 0 | 8 counterexample steps all reproduced | host `/tmp/pr45-cc-pg16:5434`; CE log sha256 `c1077d531a435b7536c8e9f07c83743c413fb054b749fa7f5f3fbac52df9991f`; repro `2f732e1c…` | **executed-this-planning-session** (defect reproduction, not a passing contract) |
| Disposable `python3 /tmp/pr45-cc-new/03_run_proofs.py` (CC-GEN contract; historical) | 0 | **169 records / 117 unique / 52 declared reruns / 0 failed** | queried `16.15`; host `/tmp/pr45-cc-pg16:5434`; contract `7a1d4611…`; driver `e9bd3c18…`; run log `420ec6e0…` | **executed-prior-planning-head-not-re-run** / `executed-synthetic-pg16` |
| Old-model CE-D / CE-E on unchanged d6/CC-GEN contract | 0 | CE-D unattributed overlap ADMITTED; six CE-E misses undetected | host `/tmp/pr45-gw-pg16:5435`; contract `7a1d461182ab4b3ab066747cbad73d8d586d19a566cc61dbdebb38452dc4544c`; repro `2e6aaa98bf5a98ca3b6594a33e9f65324217ac2e197d203ac1224217e8ce4b00`; log `c33327bf8b8d64bfc648df4170ef1a5b01d5693683267a33aee244bea0571a82` | **executed-this-planning-session** (defect reproduction, not a passing contract) |
| Independent `04_discover_writers.py` vs X (GW/P historical JSON) | 0 | 506 / 1307 / 219 / 0 | scanner `666feaa8…`; historical JSON `0ce7a398…` | **executed-prior-planning-head-not-re-run** / read-only source scan |
| Disposable `python3 /tmp/pr45-gw/new/03_run_proofs.py` (GW/P contract; historical) | 0 | **253 records / 160 unique / 93 declared reruns / 0 failed** | host `/tmp/pr45-gw-pg16:5435`; contract `ec92ac13…`; driver `2b5d92e1…`; run log `0ff616f2…` | **executed-prior-planning-head-not-re-run** / `executed-synthetic-pg16` |
| TA-01 on unchanged P contract | 0 | persisted=true + gen_a2 **ADMITTED** (defect) | host `/tmp/pr45-ta-pg16:5436`; contract `ec92ac13…`; repro `95955d83…`; log `243eb0bf…` | **executed-this-planning-session** (defect reproduction, not a passing contract) |
| Independent X archive scan (this session) | 0 | 506 / 1307 / 219 / 0; SQL `9f7aaa26…` equal; JSON `e93b23bf…` envelope-only diff vs `0ce7a398…` | scanner `666feaa8…` unchanged | **executed-this-planning-session** / read-only source scan |
| Disposable `python3 /tmp/pr45-ta/new/03_run_proofs.py` (this contract) | 0 | **313 records / 191 unique / 122 declared reruns / 0 failed** | queried `16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)` / `160015`; host `/tmp/pr45-ta-pg16:5436`; `PROOF_ROOT=/tmp/pr45-ta/new`; contract `d9bd880f7eb8e584b5e2139ce0d5fbc052a3b6ef61c1e9e59716fb3b285ec9c9`; driver `59bf35f541320301c7011ae94566ea28575def299f1d8d5cadb6c8cab18c6a5b`; run log `4e88e653e8ac30d577c7d85c737297fcedb44313cf9068e86b3cd49ae9819e63` (**not** a verification artifact) | **executed-this-planning-session** / `executed-synthetic-pg16` |
| First residual G12 without capability EXECUTE on target_owner | 1 | G7/G8/G12 `42501` | GRANT added to declared contract; not credited to an unchanged contract | **executed-this-planning-session** (failed; not hidden) |
| First G12 genuine-empty via RLS-filtered erasure DELETE | 1 | count stayed `3` | driver now deletes as `pr45owner` BYPASSRLS | **executed-this-planning-session** (failed; not hidden) |
| `npm run test:sync-uninstall` | **not executed** | — | app Postgres/Redis | **present-on-V-not-executed** / **BLOCKED** |
| `npm run test:tenant-access` | **not executed** | — | same | **present-on-V-not-executed** / **BLOCKED** |
| `npm run test:db-isolation` | **not executed** | — | same | **present-on-V-not-executed** / **BLOCKED** |
| Redis/export/D-scratch fences | **not executed** | — | G5 LIMIT; PR48 PREP-B-* are Cursor-reported feasibility, **not** this session | **not executed**; not claimed complete |
| Live Shopify / online-token bind | **not executed** | — | Helper A PREP-A-16 / coordinator PREP-A-07 **UNVERIFIED** | **not executed**; not claimed complete |

Blocked V suites remain **BLOCKED**, not failed-as-product, and not passing PR7 evidence. Designed fixtures did **not** run against nonexistent PR7 processors. Disposable proofs are **not** application RLS on V/W/X. `authenticate.admin` remains **reused / not independently reproduced**.

Official pages in plan §3 were fetched **2026-09-18**. Store calls were **not** executed. Leftover TF postgres `/tmp/pr45-pg16:5433`, CC postgres `/tmp/pr45-cc-pg16:5434`, and GW postgres `/tmp/pr45-gw-pg16:5435` were **not** stopped.

## 11. F-CLAUDE-PR7CP-01…10 finding crosswalk

| ID | Sev | Original meaning | Plan section | Positive scenario | Negative / bypass scenario | Future home | Evidence class |
|---|---|---|---|---|---|---|---|
| **F-CLAUDE-PR7CP-01** | P0 | Domain/body HMAC / receipt certified later generations | §7.4, §7.6.1 | PR7-LIFE-011 exact old retry; PR7-LIFE-016 gen2 uninstalled new event | PR7-LIFE-017 live successor; PR7-LIFE-018 conflict; PR7-LIFE-019 missing id; PR7-LIFE-020 two unfinished; PR7-RED-007 receipt not skip token | `app/privacy/intake` + classifier | **designed** |
| **F-CLAUDE-PR7CP-02** | P0 | Same RLS includes processingEnabled | §7.3, §7.7 | PR7-PRIV-014; PR7-AUD-013; PR7-TOP/GRANT | PR7-AUD-014; PR7-SIDE-009/010; G2 runtime 0-row vs error | additive privacy policies | **designed** processors; **executed-synthetic-pg16** for row-versus-error and EXECUTE |
| **F-CLAUDE-PR7CP-03** | P1 | No role may DELETE Shop | §7.6.4, §7.7 | PR7-RED-001 checked function; PR7-RED-021 grants | PR7-RED-006 children remain; runtime/CP bare DELETE denied | `stocky_privacy_finalize_shop_delete` | **designed** (function **absent on V**) |
| **F-CLAUDE-PR7CP-04** | P1 | Receipt before residual; coordinator deleted early | §7.6.3 | PR7-RED-015/017–019 crash boundaries | PR7-LIFE-021 receipt vs remnants; PR7-LIFE-022; PR7-RED-020 late writer | privacy worker + residual probe | **designed** |
| **F-CLAUDE-PR7CP-05** | P1 | `String(associated_user.id)` | §7.1 | PR7-ACT-018/020 exact sub + safe owner | PR7-ACT-021…023 wide/collision/mismatch | `app/rbac/actor.test.ts` | **designed**; IEEE-754 probe **executed** |
| **F-CLAUDE-PR7CP-06** | P1 | Two-role same UoW | §7.10 | PR7-RBAC-020 effect remains; PR7-AUTHZ/CMD replacements | PR7-RBAC-015/019 original FOR UPDATE meaning preserved/withdrawn as required helper | `replay.server.ts` + advisory lock | **designed** processors; **executed-synthetic-pg16** G4 |
| **F-CLAUDE-PR7CP-07** | P1 | Privacy jobs omitted from V dispatch | §7.9, §7.6.5 | Historical PR7-PRIV-015…018 meaning **preserved** and withdrawn as required path; replacement PR7-COORD-001 | leftover `privacy:*` DurableJob must fail closed (PR7-PRIV-016 still applies as unknown type) | coordinator + worker startup | **designed** |
| **F-CLAUDE-PR7CP-08** | P2 | Owner-only vs shop_admin export | §7.2, §7.13 | PR7-CUST-006 live account_owner | PR7-CUST-011 shop_admin denied; PR7-CUST-012 uninstalled operator path | privacy download route + CLI | **designed** |
| **F-CLAUDE-PR7CP-09** | P2 | ESCALATED unnamed | §7.12 | PR7-ESCL-001/003 owner view + operator CAS | PR7-ESCL-002 unauthorized; PR7-ESCL-004 no waive | escalation route + resolve-escalation.ts | **designed** |
| **F-CLAUDE-PR7CP-10** | P3 | Six-month page vs changelog | §3 | PR7-CUST-013 handle on arrival | local 180-day wait; equal-authority of older page | intake clock | **designed**; pages **re-fetched 2026-09-18** |

No row in this table is a passing privacy processor.

---

## 12. F-CLAUDE-PR7XC-01…11 finding crosswalk

| ID | Sev | Original meaning | Disposition | Matrix / proof |
|---|---|---|---|---|
| **F-CLAUDE-PR7XC-01** | P0 | Whole-shop helper unfit for customer topics | **CORRECTED** (Decision A); TF-01 completion-integrity; **CC-GEN** namespace lock | PR7-TOP-001…020; PR7-CUST-014…034; G1 + G7 + G11 |
| **F-CLAUDE-PR7XC-02** | P0 | Privacy DurableJob Restrict vs Shop delete | **CORRECTED** (Decision B) | PR7-COORD-001…007; G3 |
| **F-CLAUDE-PR7XC-03** | P1 | Missing context-helper EXECUTE | **CORRECTED** | PR7-GRANT-001…007; G2 |
| **F-CLAUDE-PR7XC-04** | P1 | Finalizer generation UPDATE | **CORRECTED** | PR7-COORD-003; G3 no UPDATE grant |
| **F-CLAUDE-PR7XC-05** | P1 | FOR UPDATE needs UPDATE privilege | **CORRECTED** (Decision C) | PR7-AUTHZ-001…005; G4 |
| **F-CLAUDE-PR7XC-06** | P1 | No quiescence primitive | **CORRECTED** as plan + PG gate; Redis/FS **LIMIT** (PR48 not a certified fence); W inventory required-symbol presence | PR7-GATE-001…016; G5 + G9 |
| **F-CLAUDE-PR7XC-07** | P2 | Fresh UUID idempotency | **CORRECTED** | PR7-CMD-001…003; G4 |
| **F-CLAUDE-PR7XC-08** | P2 | Prune destroys retry evidence | **CORRECTED**; Q-008 OPEN | PR7-PRIV-019; PR7-TOMB-*; G6 |
| **F-CLAUDE-PR7XC-09** | P3 | Prune cited as step 7 | **CORRECTED** (named phases; P-PRUNE-PAYLOAD) | plan §7.4 / §7.6.3 |
| **F-CLAUDE-PR7XC-10** | P3 | Documented field names called synthetic | **CORRECTED** | §3.1; FXT-COMPLIANCE-* |
| **F-CLAUDE-PR7XC-11** | P3 | Contradictory evidence label | **CORRECTED** | matrix §10 `executed-prior-planning-head-not-re-run` |

Independent review of **this** correction by actual Claude Code remains required. No whole-plan acceptance.

---

## 12.1 F-CLAUDE-PR7TF-01…04 finding crosswalk

| ID | Sev | Original meaning | Disposition | Matrix / proof |
|---|---|---|---|---|
| **F-CLAUDE-PR7TF-01** | P1 | Customer erasure lacks completion-integrity; post-enumeration arrivals survive a manifest-filtered residual | **CORRECTED** at TF for single-generation target keys + source residual; **CC-GEN** further makes the lock generation-independent | PR7-TOP-015…020; PR7-CUST-014…034; G7 + G11; old CE-1 / CE-A / CE-B; NEG complete + NEG-4 |
| **F-CLAUDE-PR7TF-02** | P2 | Enumerator not epoch-fenced; stale publisher mutates the new epoch | **CORRECTED** (publication lock shared with claim; pause-then-mutate leaves new epoch unchanged) | PR7-COORD-PUB-001…005; G8; old-model CE-6; NEG epoch |
| **F-CLAUDE-PR7TF-03** | P2 | Writer inventory omitted retry + dispatcher disabled-shop; db-context optional | **CORRECTED** at TF for those V symbols; this packet re-derives **50** W rows; completeness is **required-symbol presence**, not 26/27/86 | PR7-GATE-009…016; G9; NEG writer gate |
| **F-CLAUDE-PR7TF-04** | P3 | `results.json` hashed as if reproducible; postgres hardcoded | **CORRECTED** (queried version; run log labelled; historical hashes retained as original-run identities) | PR7-CI-004; G10; matrix §14 |

Original CP/XC finding IDs and the independently reproduced 59-case model are preserved. This table does **not** rebuild Decision A–E.

Independent review of **this** customer-completion correction by actual Claude Code remains required. No whole-plan acceptance. PR7 runtime is **not** authorized.

## 12.2 F-CLAUDE-PR7CC-01…04 finding crosswalk

| ID | Sev | Original meaning | Disposition | Matrix / proof |
|---|---|---|---|---|
| **F-CLAUDE-PR7CC-01** / **CC-GEN** | P1 | `ORDER BY id DESC` generation guess defeats ACTIVE barrier (CE-A) and restore-denied (CE-B) on multi-gen shops | **CORRECTED** (generation-independent `pr7-ctgt-v2` lock; trusted origin; no latest-generation guess) | PR7-CUST-025…034; PR7-TOP-018…020; G11; NEG-4; old CE-A/CE-B |
| **F-CLAUDE-PR7CC-02** | P2 | Residual returned `0` on missing/mismatched GUC (true `3`); complete was shielded by re-enumerate | **CORRECTED** (residual owns GUC/tenant/attempt/capability before RLS count). **Not** a demonstrated live false-complete | PR7-RESID-001…012; G12; NEG-5; old CE-C |
| **F-CLAUDE-PR7CC-03** | P3 | “26” inventory vs 27 seeded; 115 records invited as 115 unique | **CORRECTED** (historical 27 / 89 unique + 26 reruns / 115 records; this packet 50 W rows / 117 unique + 52 reruns / 169 records; completeness ≠ 86) | PR7-GATE-009…015; G9; matrix §14 |
| **F-CLAUDE-PR7CC-04** | P3 | Driver hardcoded `/tmp/pr45-tf`; §14 never staged scripts | **CORRECTED** (`PROOF_ROOT` + `PGHOST`/`PGPORT`; staged SQL/seed) | PR7-CI-005; §14 |

Original CP/XC/TF finding IDs, the independently reproduced 59-case model, and the TF 89-unique/26-rerun packet are preserved. This table does **not** rebuild Decision A–E.

Independent review of **this** generation / W-integration correction by actual Claude Code remains required. No whole-plan acceptance. PR7 runtime is **not** authorized.

## 12.3 F-CLAUDE-PR7GW-01…02 finding crosswalk

| ID | Sev | Original meaning | Disposition | Matrix / proof |
|---|---|---|---|---|
| **F-CLAUDE-PR7GW-01** | P2 | Unique-LIVE fallback admitted unattributed overlap payloads as successor data (CE-D) | **CORRECTED** independently (option a: inclusive overlap → `customer_target_attribution_ambiguous`; locking unchanged). Caller-boolean trust is **withdrawn** (TA-01) | PR7-CUST-035…044; G13; NEG-6; old CE-D |
| **F-CLAUDE-PR7GW-02** | P2 | Seven-symbol completeness missed six inventoried writers (CE-E) | **CORRECTED** independently (independent source-derived required set; unknown blocks complete; seven names are a floor only). Scanner unchanged | PR7-GATE-017…022; G14; NEG-7; old CE-E |

CC-01…04 remain closed. GW-02 remains closed. The GW-01 overlap defect remains independently closed.

## 12.4 F-CLAUDE-PR7TA-01…02 finding crosswalk

| ID | Sev | Original meaning | Disposition | Matrix / proof |
|---|---|---|---|---|
| **F-CLAUDE-PR7TA-01** | P2 | `p_origin_persisted` caller boolean admitted CE-D overlap as successor | **CORRECTED** (option a: protected `WriterAdmissionOrigin`; 5-arg work_id guard; producer-only helper; no GUC / registerOrigin) | PR7-CUST-045…061; G15; NEG-8/9; G13 name-preserving crosswalk; old TA-01 on P |
| **F-CLAUDE-PR7TA-02** | P3 | Candidates JSON digest embeds absolute roots | **CORRECTED** (labeling: JSON is original-run / environment artifact; portable SQL `9f7aaa26…` equal across roots) | PR7-GATE-017…; G14; Appendix E |

Independent targeted correction re-review of **this** durable-origin packet by actual Claude Code remains required. No whole-plan acceptance. PR7 runtime is **not** authorized.

## 12.5 F-CLAUDE-PR7DO-01…02 finding crosswalk

| ID | Sev | Original meaning | Disposition | Matrix / proof |
|---|---|---|---|---|
| **F-CLAUDE-PR7DO-01** | P2 | ADMIN class bound caller-chosen overlap timestamp 18:19 to successor LIVE | **PARTIALLY CORRECTED at F** (eighth review): named 18:19 caller-timestamp counterexample closed; replay/child recapture class remained open as AO-03 | PR7-CUST-062…071, 076; G16; NEG-10; old DO-01 on Q |
| **F-CLAUDE-PR7DO-02** | P3 | SQL guard cannot bind `work_id` to the effect actually written | **Specified / not demonstrated at F** (eighth review): host still accepted caller `p_actual_digest`. SQL-only substitution **still admitted** (honest) | PR7-CUST-072…075, 077; G16; NEG-11; old DO-02 on Q |

TA-01 core, TA-02, GW-02, and the GW-01 overlap rule remain independently closed. §12.6 records the AO packet that closes the remaining class.

## 12.6 F-CLAUDE-PR7AO-01…05 finding crosswalk

| ID | Sev | Original meaning | Disposition | Matrix / proof |
|---|---|---|---|---|
| **F-CLAUDE-PR7AO-01** | P2 | Runnable contract/driver unpublished; Appendix F fragments only | **CORRECTED** (complete current appendices + extraction manifest + regenerator; F 375 unpublished-at-F historically attributed; new hashes) | §14; Appendices F–L; extractor `--selftest` |
| **F-CLAUDE-PR7AO-02** | P2 | Caller-supplied digest authority | **CORRECTED** (host computes `pr7-effect-v1` from frozen snapshot and writes that snapshot; SQL-only still ADMITTED) | PR7-CUST-073, 078–082, 077; G16; NEG-11 |
| **F-CLAUDE-PR7AO-03** | P2 | Replayed/child bytes could acquire fresh ADMIN origin | **CORRECTED** (digest-keyed sighting of every non-fresh class; source-content lock; both races; successor new digest progresses) | PR7-CUST-083–090, 098; G16; NEG-12 |
| **F-CLAUDE-PR7AO-04** | P3 | GUC documented as unmintable; consumers could set it | **CORRECTED** (clarification: untrusted locator; host revalidates; no nonce service) | PR7-CUST-091–093; G16 |
| **F-CLAUDE-PR7AO-05** | P3 | Global caller-derived capture PK | **CORRECTED** (tenant/domain-qualified unique command id; sha256 surrogate with bytea NUL) | PR7-CUST-094–097; G16 |

Independent targeted correction re-review of **this** reproducible-effect / replay-provenance packet by actual Claude Code remains required. No whole-plan acceptance. PR7 runtime is **not** authorized.


---

## 12.7 F-CLAUDE-PR7RE-01 / RE-02 / AO-06 finding crosswalk

| ID | Sev | Original meaning | Disposition | Matrix / proof |
|---|---|---|---|---|
| **F-CLAUDE-PR7RE-01** | P2 | Issued capture never reconciled at consume/effect | **CORRECTED** (eligibility flag; consume + effect re-read; correlated child preserved; no BOUND→UNATTRIBUTED rewrite) | PR7-CUST-099–109; G16; NEG-13 |
| **F-CLAUDE-PR7RE-02** | P2 | EffectId absorbed into source digest | **CORRECTED** (`pr7-source-v1` separate from `pr7-effect-v1`; SourceEffectLink unique per work and per source; no lifetime blacklist) | PR7-CUST-078, 110–117, 120–123; G16; NEG-14 |
| **F-CLAUDE-PR7AO-06** | P3 | §14 table vs manifest vs extracted bytes unchecked | **CORRECTED** (row-for-row; one-sided negatives; honest coordinated-edit limit) | PR7-CUST-119; extractor `--selftest` |

AO-01/02/04/05 remain independently closed at S. Independent targeted re-review of **this** head remains required. PR49 pin `d636290…` is not independently accepted here. PR7 runtime is **not** authorized.


## 13. Consistency obligations for this packet

| Check | Rule |
|---|---|
| Three identities | Delivery binding ≠ work id ≠ completion receipt. HMAC/body is not a lifetime work key. |
| Shop DELETE | Only `stocky_privacy_finalize_shop_delete`. Runtime/CP have no bare DELETE. |
| Completion | Residual empty **then** conditional CP txn. Receipt cannot override remnants. Customer topics: source-derived residual + exclusive target locks in the same complete txn. Stale-manifest count is insufficient. |
| Customer barrier | Canonical domain × `CUSTOMER_REST_ID` / `ORDER_LEGACY_ID` (`pr7-ctgt-v2`). Generation is evidence, not the lock. Lock before lookup. Not request-id-only. LIVE shop. Unrelated customers/shops progress. Delayed writes whose **BOUND** origin **is** the completed generation remain restore-denied; genuine unique LIVE successor with `originalAdmittedAt >= origin.installedAt` and a **new** digest allowed. Install lower bound is **supplementary**, not provenance. ADMIN requires original-admin capture. Unattributed inclusive overlap → visible `customer_target_attribution_ambiguous`. Unique LIVE is not historical origin. Guard derives origin from `WriterAdmissionOrigin`; `p_origin_persisted` removed. Effect host **computes** `pr7-effect-v1` from the frozen effect input (including effectId) and separately validates `pr7-source-v1`. `SourceEffectLink` binds first effect per work. Eligibility of an issued capture is re-read at consume and at the last protected effect boundary. GUC `stocky.trusted_work_id` is an untrusted locator. Capture unique `(canonicalDomain, commandId)`. Non-fresh classes sight by content digest. JWT `sub` remains an exact string; global `useOnlineTokens` stays disabled; publication fence is not a read-before-write. |
| Epoch / publication | Enumerator and claim share publication lock. Stale callers leave the new epoch’s keys/flags/revision unchanged. Check-then-act is insufficient. |
| Actor | Verified JWT `sub` **string**. Online tokens **not** required for actor identity. Wide id preserved. Unsafe numeric owner blocked. mixedToken/stale-cache fenced **before** any online credential. dest/iss in **app**. Live bind **UNVERIFIED**. |
| Replay | One CP txn + advisory authz lock + SELECT-only verifier + stable commandId. No `FOR UPDATE` helper. No cross-role atomicity slogan. |
| Privacy execution | `PrivacyRequest`/`PrivacyAttempt` coordinator; per-topic capabilities; no Shop/DurableJob FK. Unknown ordinary jobs denied. Historical PRIV-015…018 path withdrawn as required. |
| Participating writers | Independent source-derived required set (**219** on this X scan) reconciled against inventory SOURCE_SITE identities. Seven original symbols are a **regression floor only**, not completeness. Unknown / stale / misclassified / empty-required cannot report complete. `processingEnabled` ≠ drain. Residual owns its own GUC. |
| Download | `platform.privacy.data_request.download` ≠ `platform.export.operational`. Coverage is the published snapshot, not an empty residual. |
| Escalation | Named owner route + operator CLI. No `retain_live` waiver. |
| Timing | Changelog newer; handle on arrival; no local 180-day wait. |
| Evidence | Script hashes are verification artifacts. `results.json` is a run log. Query `server_version`. |
| Q-008 / R-176 / R-164 | OPEN / OPEN-P0 / unchanged. No D-055. |

---

## 14. Synthetic PostgreSQL proof index (not PR7 processors)

Scripts and full SQL live in the execution plan §14 appendices (do not duplicate here).

| | |
|---|---|
| Postgres (queried) | `server_version` `16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)`; `server_version_num` `160015`; disposable `/tmp/pr45-do-pg16:5439` |
| Contract SHA-256 (this correction) | `bc0d674afdfe1ed984e7258326e3421a62c24b25ce988281f43885e9fe859ff4` |
| Seed SHA-256 | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` (byte-identical from 59-case / TF / CC-GEN / GW / Q) |
| Driver SHA-256 (this correction) | `336b2795914eedccbc677a5da8aefb7d93c950a3b7e1f4aa89387ce917a0bdbc` |
| Discover SHA-256 | `666feaa8f77359d75f70ffca5bb84bc91fc9d0e0891656f17d195ef92990220d` (**unchanged**) |
| Source SQL SHA-256 | `9f7aaa26ecdbdf953b284b0813fb81f2693962c64870d7c2e61ea084c0bf6baa` (portable; equals P/Q and this-session X regeneration) |
| Candidates JSON SHA-256 | **environment artifact.** Historical `0ce7a39853eae7cb4808c822b3af66157cd2f59e8f236ec0fdf76205f1546ecd`; this-env X archive `e93b23bf0d4bf8e1a417f3e248045ff2123306ec77292759730a228ad7a30f62` (envelope roots only) |
| Results SHA-256 | **run log, not a verification artifact.** This-run digest `bb1e3541186a5e82fc6a54b9eaa07bae32d459ecdd277623eb347ad5f69e9317` is an original-run identity only |
| Q historical packet (**not** this contract) | **313 records / 191 unique / 122 reruns**. Contract `d9bd880f…`; driver `59bf35f5…`; run log `4e88e653…` |
| Q/DO repro + lower-bound | repro `9872848c…`; log `96aa5649…`; lower-bound SQL `75a16828…`. ADMIN 18:19 **still BOUND+ADMITTED** on option (a) |
| Totals (this correction) | S **416/244/172** remains independently established. Clean-export of candidate `e7dd4f42…` **505/290/215** (G16 unique 93, NEG unique 15) on `/tmp/pr45-re-gate-pg16:5447`. Authoring `/tmp/pr45-re-pg16:5444` independently 505/290/215 |
| Contract SHA-256 (this correction) | `d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318` |
| Driver SHA-256 (this correction) | `d24afa331bde236e6ed59243ada670d14b658bd308541b9263df616040c75d85` |
| Historical TF 115-record packet (S; **not** this contract) | **115 records ≠ 115 unique**: 89 unique + 26 G7–G9 reruns. Contract `75ab1c02…349846de`; driver `566e0f28…`; run log `006e5799…` |
| Historical 59-case identities (S; **not** this contract) | contract `b29ef463c26a9a3ad745fc7a56bc40901ced1c55429a59c441d89634858db054`; driver `6900553779c3d2e8237fc189fcad42a1810262d3110ab60f30ab32208667ebb4`; Cursor run log `ecc9acd1d59cda2d9d5910b46e9ffa1766c4e29c3671ceda270dea98d80303b8`; reviewer log `185dd1b8…` |
| Old-model CE-A / CE-B / CE-C | reproduced on unchanged TF contract at `/tmp/pr45-cc-pg16:5434`; sha256 `c1077d531a435b7536c8e9f07c83743c413fb054b749fa7f5f3fbac52df9991f` |
| Old-model CE-1 / CE-6 | preserved identities on unchanged 59-case scripts; not re-run this packet |

**Unique assertions only** (first occurrence; reruns are **not** listed here):

| Group | Assertion | Result | SQLSTATE |
|---|---|---|---|
| `G1-topics` | `enumerate_data_request` | PASS | `—` |
| `G1-topics` | `data_request_reads_only_target_order` | PASS | `—` |
| `G1-topics` | `invisible_is_not_absence` | PASS | `—` |
| `G1-topics` | `data_request_reader_cannot_delete` | PASS | `42501` |
| `G1-topics` | `data_request_credentials_on_erasure_request_denied` | PASS | `42501` |
| `G1-topics` | `data_request_erasure_role_cannot_remove_rows` | PASS | `—` |
| `G1-topics` | `data_request_reads_while_shop_disabled` | PASS | `—` |
| `G1-topics` | `customers_redact_broad_delete_only_target` | PASS | `—` |
| `G1-topics` | `child_line_of_other_customer_survives` | PASS | `—` |
| `G1-topics` | `wrong_shop_guc_cannot_see_or_delete_b` | PASS | `—` |
| `G1-topics` | `missing_attempt_capability_false` | PASS | `—` |
| `G1-topics` | `unknown_topic_fail_closed` | PASS | `—` |
| `G1-topics` | `erasure_cannot_insert_arbitrary_target_keys` | PASS | `42501` |
| `G1-topics` | `shop_redact_deletes_generation_facts` | PASS | `—` |
| `G1-topics` | `missing_linkage_is_incomplete_not_absence` | PASS | `—` |
| `G2-grants` | `revoke_capability_execute_fails_probe` | PASS | `42501` |
| `G2-grants` | `revoke_tenant_id_execute_fails_probe` | PASS | `42501` |
| `G2-grants` | `drop_read_policy_hides_rows` | PASS | `—` |
| `G2-grants` | `runtime_insert_audit_disabled_errors` | PASS | `—` |
| `G2-grants` | `runtime_select_disabled_zero_rows` | PASS | `—` |
| `G2-grants` | `runtime_not_member_of_erasure` | PASS | `—` |
| `G2-grants` | `privacy_erasure_no_processing_helper` | PASS | `42501` |
| `G2-grants` | `operator_no_capability_execute` | PASS | `42501` |
| `G3-shop-delete` | `restrict_job_family_blocks_root_delete` | PASS | `23503` |
| `G3-shop-delete` | `finalizer_deletes_shop` | PASS | `—` |
| `G3-shop-delete` | `shop_row_gone` | PASS | `—` |
| `G3-shop-delete` | `generation_set_null_keeps_target` | PASS | `—` |
| `G3-shop-delete` | `coordinator_request_survives` | PASS | `—` |
| `G3-shop-delete` | `coordinator_attempt_survives` | PASS | `—` |
| `G3-shop-delete` | `finalizer_already_absent_retry` | PASS | `—` |
| `G3-shop-delete` | `stale_attempt_denied` | PASS | `—` |
| `G3-shop-delete` | `finalizer_no_generation_update_grant` | PASS | `—` |
| `G3-shop-delete` | `retry_capability_after_shop_gone` | PASS | `—` |
| `G4-authz` | `verifier_select_only` | PASS | `—` |
| `G4-authz` | `verifier_allows_admin` | PASS | `—` |
| `G4-authz` | `verifier_denies_auditor` | PASS | `—` |
| `G4-authz` | `missing_assignment_false` | PASS | `—` |
| `G4-authz` | `revoke_commits` | PASS | `—` |
| `G4-authz` | `revoke_before_effect_denies` | PASS | `—` |
| `G4-authz` | `fresh_read_after_wait_sees_revoke` | PASS | `—` |
| `G4-authz` | `effect_commits` | PASS | `—` |
| `G4-authz` | `effect_before_revoke_remains` | PASS | `—` |
| `G4-authz` | `same_command_reconciles_after_revoke` | PASS | `—` |
| `G4-authz` | `same_command_other_actor_no_row` | PASS | `—` |
| `G4-authz` | `changed_digest_no_false_success` | PASS | `—` |
| `G4-authz` | `changed_digest_insert_conflicts` | PASS | `23505` |
| `G4-authz` | `cross_tenant_denied` | PASS | `—` |
| `G5-barrier` | `shared_writer_acquired` | PASS | `—` |
| `G5-barrier` | `exclusive_waits_on_shared` | PASS | `55P03` |
| `G5-barrier` | `shared_writer_committed_before_freeze` | PASS | `—` |
| `G5-barrier` | `new_writer_after_freeze_rejects` | PASS | `—` |
| `G5-barrier` | `bootstrap_same_domain_after_freeze_rejects` | PASS | `—` |
| `G5-barrier` | `unrelated_shop_continues` | PASS | `—` |
| `G5-barrier` | `uninstrumented_cp_writer_still_inserts_limit` | PASS | `—` |
| `G5-barrier` | `lost_epoch_capability_false` | PASS | `—` |
| `G5-barrier` | `new_epoch_capability_true` | PASS | `—` |
| `G6-tombstone` | `post_prune_duplicate_reconciles` | PASS | `—` |
| `G6-tombstone` | `expired_tombstone_uncorrelated` | PASS | `—` |
| `G6-tombstone` | `new_generation_not_inheriting_old_completion` | PASS | `—` |
| `G7-customer-complete` | `writer_active_before_barrier_admission` | PASS | `—` |
| `G7-customer-complete` | `customer_barrier_installs_target_keys` | PASS | `—` |
| `G7-customer-complete` | `data_request_coverage_is_snapshot_not_empty_predicate` | PASS | `—` |
| `G7-customer-complete` | `matching_writer_denied_while_barrier_active` | PASS | `—` |
| `G7-customer-complete` | `unrelated_customer_same_shop_progresses` | PASS | `—` |
| `G7-customer-complete` | `unrelated_shop_progresses_during_customer_barrier` | PASS | `—` |
| `G7-customer-complete` | `late_matching_row_visible_to_source_residual` | PASS | `—` |
| `G7-customer-complete` | `complete_denied_while_remnants` | PASS | `—` |
| `G7-customer-complete` | `reenumerate_then_source_residual_zero` | PASS | `—` |
| `G7-customer-complete` | `writer_between_residual_and_complete_waits` | PASS | `55P03` |
| `G7-customer-complete` | `complete_commits_after_drain` | PASS | `—` |
| `G7-customer-complete` | `customer_request_completed_without_shop_freeze` | PASS | `—` |
| `G7-customer-complete` | `delayed_old_write_cannot_restore` | PASS | `—` |
| `G7-customer-complete` | `legitimate_later_customer_data_allowed` | PASS | `—` |
| `G8-epoch-publish` | `successor_enumerates_after_takeover` | PASS | `—` |
| `G8-epoch-publish` | `stale_publisher_after_pause_does_not_mutate` | PASS | `—` |
| `G8-epoch-publish` | `new_epoch_keys_unchanged_by_stale` | PASS | `—` |
| `G8-epoch-publish` | `wrong_attempt_cannot_publish` | PASS | `—` |
| `G8-epoch-publish` | `expired_terminal_attempt_cannot_publish` | PASS | `—` |
| `G8-epoch-publish` | `epoch_takeover_completes_under_rebound_barrier` | PASS | `—` |
| `G8-epoch-publish` | `delayed_old_write_after_takeover_complete_denied` | PASS | `—` |
| `G9-writer-inventory` | `inventory_includes_retry_and_dispatcher_disabled` | PASS | `—` |
| `G9-writer-inventory` | `lifecycle_complete_attempt_retry_guarded_write` | PASS | `—` |
| `G9-writer-inventory` | `dispatcher_disabled_shop_path_still_writes` | PASS | `—` |
| `G9-writer-inventory` | `inventory_gate_detects_unguarded_tenant_linked_write` | PASS | `—` |
| `G9-writer-inventory` | `inventory_incomplete_when_required_writer_removed` | PASS | `—` |
| `G9-writer-inventory` | `inventory_incomplete_when_w_sync_job_removed` | PASS | `—` |
| `G9-writer-inventory` | `inventory_incomplete_when_health_upsert_removed` | PASS | `—` |
| `G9-writer-inventory` | `completeness_not_tied_to_historical_getShopHealth_row` | PASS | `—` |
| `G9-writer-inventory` | `inventory_row_count_is_not_pr48_86` | PASS | `—` |
| `G10-evidence-meta` | `postgres_version_queried_not_hardcoded` | PASS | `—` |
| `G11-generation-namespace` | `cea_baseline_one_gen_still_denies` | PASS | `—` |
| `G11-generation-namespace` | `cea_two_gen_matching_write_still_denied` | PASS | `—` |
| `G11-generation-namespace` | `cea_declared_successor_origin_cannot_bypass_active_barrier` | PASS | `—` |
| `G11-generation-namespace` | `two_gen_unrelated_customer_still_progresses` | PASS | `—` |
| `G11-generation-namespace` | `ceb_baseline_restore_denied` | PASS | `—` |
| `G11-generation-namespace` | `ceb_two_gen_old_origin_still_restore_denied` | PASS | `—` |
| `G11-generation-namespace` | `two_live_undeclared_origin_ambiguous_not_admitted` | PASS | `—` |
| `G11-generation-namespace` | `queued_payload_before_successor_install_restore_denied` | PASS | `—` |
| `G11-generation-namespace` | `genuine_successor_fresh_payload_allowed` | PASS | `—` |
| `G11-generation-namespace` | `missing_origin_fails_closed` | PASS | `—` |
| `G11-generation-namespace` | `concurrent_reinstall_cannot_bypass_namespace_barrier` | PASS | `—` |
| `G11-generation-namespace` | `other_shop_unrelated_to_namespace_progresses` | PASS | `—` |
| `G12-residual-guard` | `residual_no_guc_raises_42501` | PASS | `—` |
| `G12-residual-guard` | `residual_foreign_request_guc_raises_42501` | PASS | `—` |
| `G12-residual-guard` | `residual_wrong_tenant_raises_42501` | PASS | `—` |
| `G12-residual-guard` | `residual_stale_attempt_raises_42501` | PASS | `—` |
| `G12-residual-guard` | `residual_direct_nonzero_with_full_context` | PASS | `—` |
| `G12-residual-guard` | `residual_direct_genuine_empty` | PASS | `—` |
| `G12-residual-guard` | `residual_control_plane_execute_with_context` | PASS | `—` |
| `G12-residual-guard` | `residual_runtime_execute_denied` | PASS | `42501` |
| `G12-residual-guard` | `residual_reader_execute_denied` | PASS | `42501` |
| `G12-residual-guard` | `residual_same_shop_other_request_guc_raises` | PASS | `—` |
| `NEG-load-bearing` | `completion_guard_removed_allows_false_complete` | PASS | `—` |
| `NEG-load-bearing` | `epoch_guard_removed_allows_stale_publish` | PASS | `—` |
| `NEG-load-bearing` | `writer_gate_removed_skips_freeze` | PASS | `—` |
| `NEG-load-bearing` | `generation_guess_restored_defeats_barrier` | PASS | `—` |
| `NEG-load-bearing` | `residual_guard_removed_returns_zero` | PASS | `—` |
| `G13-temporal-attribution` | `ced_unattributed_overlap_ambiguous` | PASS | `—` |
| `G13-temporal-attribution` | `ced_persisted_old_origin_restore_denied` | PASS | `—` |
| `G13-temporal-attribution` | `ced_persisted_successor_origin_admitted_in_overlap` | PASS | `—` |
| `G13-temporal-attribution` | `newly_attached_successor_generation_not_trusted` | PASS | `—` |
| `G13-temporal-attribution` | `equality_at_successor_installedAt_ambiguous` | PASS | `—` |
| `G13-temporal-attribution` | `equality_at_completedAt_ambiguous` | PASS | `—` |
| `G13-temporal-attribution` | `before_overlap_unattributed_restore_denied` | PASS | `—` |
| `G13-temporal-attribution` | `after_overlap_unattributed_successor_allowed` | PASS | `—` |
| `G13-temporal-attribution` | `missing_payload_time_ambiguous` | PASS | `—` |
| `G13-temporal-attribution` | `multiple_applicable_completions_still_ambiguous` | PASS | `—` |
| `G13-temporal-attribution` | `delayed_retry_preserves_original_admission_still_ambiguous` | PASS | `—` |
| `G13-temporal-attribution` | `concurrent_reinstall_unattributed_overlap_not_admitted` | PASS | `—` |
| `G13-temporal-attribution` | `unrelated_shop_progresses_during_overlap_block` | PASS | `—` |
| `G13-temporal-attribution` | `unrelated_customer_progresses` | PASS | `—` |
| `G13-temporal-attribution` | `missing_generation_history_not_a_permit` | PASS | `—` |
| `G14-source-coverage` | `source_derived_complete_true` | PASS | `—` |
| `G14-source-coverage` | `required_set_not_empty_and_not_from_inventory_count` | PASS | `—` |
| `G14-source-coverage` | `no_unknown_candidates` | PASS | `—` |
| `G14-source-coverage` | `seven_symbol_floor_true` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_completeAttemptRetry_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_dispatcher_disabled_shop_path_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_withTenantBoundTransaction_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_claimAttempt_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_enqueueWithDispatch_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_runOrderFactsSyncJob_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_computeSyncHealth_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_runOrderFactsReconcileJob_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_applyNominatedOrderGid_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_applyWithApplicationReceipt_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_lockSyncRun_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_upsertCanonicalShop_removed` | PASS | `—` |
| `G14-source-coverage` | `inventory_incomplete_when_processUninstall_removed` | PASS | `—` |
| `G14-source-coverage` | `unlisted_rawInsert_blocks_completeness` | PASS | `—` |
| `G14-source-coverage` | `unlisted_wrappedUpsert_blocks_completeness` | PASS | `—` |
| `G14-source-coverage` | `unlisted_action_blocks_completeness` | PASS | `—` |
| `G14-source-coverage` | `misclassify_write_as_readonly_incomplete` | PASS | `—` |
| `G14-source-coverage` | `stale_source_mapping_incomplete` | PASS | `—` |
| `G14-source-coverage` | `unknown_candidate_blocks_completeness` | PASS | `—` |
| `G14-source-coverage` | `empty_required_set_is_not_complete` | PASS | `—` |
| `G14-source-coverage` | `nonwriter_does_not_phantom_required` | PASS | `—` |
| `G14-source-coverage` | `historical_getShopHealth_still_not_required` | PASS | `—` |
| `NEG-load-bearing` | `temporal_overlap_check_removed_revives_ced_admit` | PASS | `—` |
| `NEG-load-bearing` | `floor_only_completeness_revives_cee_six_misses_undetected` | PASS | `—` |
| `G15-durable-origin` | `runtime_denied_origin_insert` | PASS | `42501` |
| `G15-durable-origin` | `control_plane_denied_origin_insert` | PASS | `42501` |
| `G15-durable-origin` | `runtime_denied_origin_update` | PASS | `42501` |
| `G15-durable-origin` | `runtime_denied_origin_delete` | PASS | `42501` |
| `G15-durable-origin` | `runtime_denied_helper_execute` | PASS | `42501` |
| `G15-durable-origin` | `control_plane_denied_helper_execute` | PASS | `42501` |
| `G15-durable-origin` | `runtime_cannot_set_role_admission` | PASS | `42501` |
| `G15-durable-origin` | `guc_is_not_admission_authority` | PASS | `—` |
| `G15-durable-origin` | `original_admission_helper_creates_binding` | PASS | `—` |
| `G15-durable-origin` | `consumer_uses_persisted_binding` | PASS | `—` |
| `G15-durable-origin` | `retry_same_source_preserves_origin_time` | PASS | `—` |
| `G15-durable-origin` | `changed_digest_conflicts_original_unchanged` | PASS | `—` |
| `G15-durable-origin` | `target_substitution_rejected` | PASS | `—` |
| `G15-durable-origin` | `tenant_substitution_rejected` | PASS | `—` |
| `G15-durable-origin` | `missing_binding_fail_closed` | PASS | `—` |
| `G15-durable-origin` | `successor_binding_is_not_interchangeable_with_old_digest` | PASS | `—` |
| `G15-durable-origin` | `borrowed_successor_cannot_admit_ced_payload` | PASS | `—` |
| `G15-durable-origin` | `delayed_first_seen_webhook_not_promoted` | PASS | `—` |
| `G15-durable-origin` | `child_cannot_launder_old_digest` | PASS | `—` |
| `G15-durable-origin` | `child_inherits_parent_origin` | PASS | `—` |
| `G15-durable-origin` | `begin_pending_link` | PASS | `—` |
| `G15-durable-origin` | `pending_link_not_trusted_for_effects` | PASS | `—` |
| `G15-durable-origin` | `recover_unacked_admission_with_job` | PASS | `—` |
| `G15-durable-origin` | `recovered_admission_allows_consumer` | PASS | `—` |
| `G15-durable-origin` | `duplicate_concurrent_admission_reconciles` | PASS | `—` |
| `G15-durable-origin` | `pruned_binding_fail_closed` | PASS | `—` |
| `G15-durable-origin` | `genuine_successor_after_completion_progresses` | PASS | `—` |
| `G15-durable-origin` | `admission_cannot_outrun_active_barrier` | PASS | `—` |
| `G15-durable-origin` | `unrelated_shop_progresses_with_own_binding` | PASS | `—` |
| `NEG-load-bearing` | `lookup_bypass_revives_ta01_admit` | PASS | `—` |
| `NEG-load-bearing` | `unauthorized_mint_revives_ta01_admit` | PASS | `—` |
| `G16-admin-origin-effect-host` | `admin_class_without_capture_rejected` | PASS | `—` |
| `G16-admin-origin-effect-host` | `runtime_denied_establish_admin_session` | PASS | `42501` |
| `G16-admin-origin-effect-host` | `runtime_denied_capture_execute` | PASS | `42501` |
| `G16-admin-origin-effect-host` | `control_plane_denied_capture_execute` | PASS | `42501` |
| `G16-admin-origin-effect-host` | `producer_denied_capture_execute` | PASS | `42501` |
| `G16-admin-origin-effect-host` | `capture_without_established_session_rejected` | PASS | `—` |
| `G16-admin-origin-effect-host` | `capture_wrong_shop_session_rejected` | PASS | `—` |
| `G16-admin-origin-effect-host` | `caller_overlap_timestamp_does_not_become_captured_at` | PASS | `—` |
| `G16-admin-origin-effect-host` | `label_only_queued_webhook_cannot_capture_admin` | PASS | `—` |
| `G16-admin-origin-effect-host` | `control_plane_can_note_queued_work` | PASS | `—` |
| `G16-admin-origin-effect-host` | `queued_inbox_cannot_acquire_fresh_admin_origin` | PASS | `—` |
| `G16-admin-origin-effect-host` | `runtime_denied_note_queued_work` | PASS | `42501` |
| `G16-admin-origin-effect-host` | `time_only_retry_does_not_restamp_capture` | PASS | `—` |
| `G16-admin-origin-effect-host` | `changed_digest_admin_conflicts` | PASS | `—` |
| `G16-admin-origin-effect-host` | `capture_under_current_live` | PASS | `—` |
| `G16-admin-origin-effect-host` | `capture_epoch_mismatch_after_reinstall_rejected` | PASS | `—` |
| `G16-admin-origin-effect-host` | `capture_before_install_consistency_rejected` | PASS | `—` |
| `G16-admin-origin-effect-host` | `overlap_caller_timestamp_without_capture_rejected` | PASS | `—` |
| `G16-admin-origin-effect-host` | `genuine_admin_after_completion_progresses` | PASS | `—` |
| `G16-admin-origin-effect-host` | `sql_honest_old_ambiguous_new_admitted` | PASS | `—` |
| `G16-admin-origin-effect-host` | `sql_only_old_effect_new_work_id_still_admitted` | PASS | `—` |
| `G16-admin-origin-effect-host` | `effect_host_rejects_old_digest_with_new_work_id` | PASS | `—` |
| `G16-admin-origin-effect-host` | `effect_host_accepts_matching_digest_and_writes` | PASS | `—` |
| `G16-admin-origin-effect-host` | `apply_without_execution_context_rejected` | PASS | `—` |
| `G16-admin-origin-effect-host` | `bind_context_wrong_tenant_rejected` | PASS | `—` |
| `G16-admin-origin-effect-host` | `genuine_admin_capture_inside_overlap_window_progresses` | PASS | `—` |
| `G16-admin-origin-effect-host` | `unrelated_shop_admin_capture_and_host_progresses` | PASS | `—` |
| `G16-admin-origin-effect-host` | `pending_recovery_does_not_mutate_origin_time` | PASS | `—` |
| `G16-admin-origin-effect-host` | `child_inherits_without_fresh_admin_capture` | PASS | `—` |
| `G16-admin-origin-effect-host` | `duplicate_admin_command_preserves_single_capture` | PASS | `—` |
| `NEG-load-bearing` | `capture_requirement_removed_revives_do01_admit` | PASS | `—` |
| `NEG-load-bearing` | `effect_digest_binding_removed_revives_do02_write` | PASS | `—` |

Unique = **223**. Declared reruns = **152**. Driver total records = **375**. Historical Q unique 191 / 122 reruns / 313 records preserved as original-run identity. Historical GW unique 160 / 93 reruns / 253 records preserved as original-run identity. Historical CC-GEN unique 117 / 52 reruns / 169 records preserved as original-run identity. No hidden GRANT, dropped constraint, or repaired driver is credited to an unchanged contract. NEG replaces one function at a time, then `reset()` reloads the declared contract.

Unexecuted: Redis/export/D-scratch fences; live Shopify; `node_modules` `authenticate.admin` live bind; application `test:privacy`; proposed `original-admin-capture.server.ts` / `bound-effect.server.ts` runtime. This SQL model does **not** execute Redis, filesystem, or authentication implementation obligations. Do not certify a missing online binding or cross-system fence.
