# Phase 1 PR7 — Audit, roles, and privacy acceptance matrix

**Status:** **PROPOSED — ONE-DEPENDENCY-AHEAD — NOT IMPLEMENTATION AUTHORITY**

Companion plan: `stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md`

Immutable independent review (byte-for-byte; do not edit):
`stocky-plus/docs/phases/phase-1/PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md`

These rows are **test-executable in specificity**. They are documentation. They are **not** passing CI on a runtime implementation.

Fixture data is **synthetic**. No merchant or customer production data.

ChatGPT’s 2026-09-17 executable-contract constraints (PR #45 comment 5714629032) supersede conflicting expected outcomes from earlier PR45 heads. They do **not** accept the whole plan or authorize PR7 runtime.

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
| Now | `designed` (this packet; not a passing processor test) vs `present-on-V-not-executed` (suite exists on V; **this session did not run it**) vs `executed-this-planning-session` (command ran here; SHA recorded) |

Rows marked `executed-this-planning-session` describe **current V behavior only**. They do **not** pass PR7 processors. A filename or a blocked attempt is **not** an execution result.

---

## 1. Complete-module exit criteria (PR7 repository)

All must be true on the exact **implementation** head before ChatGPT acceptance. None of these is certified by this docs PR.

- [ ] HMAC-invalid compliance POST returns 401; valid HMAC acks 200 only after durable `PrivacyRequest` (or proven **delivery-id** duplicate in `PrivacyDeliveryBinding`). Invalid authentication remains rejected.
- [ ] `customers/data_request`, `customers/redact`, `shop/redact` processors exist, are idempotent, checkpointed, and covered by `npm run test:privacy` with **nonzero** tests.
- [ ] Shop/redact residual probe is empty except `PrivacyCompletionReceipt` + `ShopInstallGeneration` `fence=ERASED` + counsel holds (empty hold set unless Q-008 says otherwise). **No** leftover tenant-linked `AuditEvent` or `Shop` row. A receipt **cannot** override observed remnants.
- [ ] Deletion manifests and final receipts never contain customer email/phone/tokens/raw payloads/raw headers. Operational `PrivacyDeliveryBinding` is pruned after the erasure/replay window and is **not** the D-021 receipt.
- [ ] `AuditEvent` is append-only for `stocky_runtime`; while disabled, progress is `PrivacyCoordinatorEvent` on the control-plane path (runtime INSERT is denied). Privacy-erasure DELETE of tenant-linked audit is shop-scoped and tested; failed writes do not create `*_COMPLETED`.
- [ ] Platform permission checks run on the server; UI omission is insufficient; default deny; user-supplied role/shop/actor/`account_owner` ignored.
- [ ] First staff/collaborator/empty assignments/`sessionToken.sub` alone do **not** become `shop_owner`. Unsafe numeric owner correlation is `OWNER_PROOF_UNSUPPORTED`.
- [ ] Uninstall still disables immediately; session delete is **asserted**; **this generation** `ERASING`/`FINALIZING`/`REDACTED` cannot be revived; a **new** generation after `fence=ERASED` can install.
- [ ] Human replay/export: current actor authorization, idempotency, and enqueue serialize on the control-plane transaction via `stocky_lock_platform_assignment`. Callers cannot relabel a human command as autonomous. Export revalidates before **publication/download**.
- [ ] Verified privacy jobs (`PRIVACY_JOB_TYPES` + live `PrivacyRequest` + generation) run while processing is disabled **without** re-enabling the shop or using runtime policies that require `processingEnabled`. Unknown types remain `NO_AUTOMATIC_RETRY` / denied.
- [ ] Privacy-job isolation tests exist (replace the F-PR3-16 deferral sentence for the privacy path only; export/reconciliation may remain deferred until PR8).
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
- RLS + grants on new tables (exact catalog, not names), including `stocky_privacy_erasure` policies that **omit** `processingEnabled` and require `stocky_privacy_target_allows`;
- runtime policies **KEEP** processingEnabled; no PUBLIC/runtime privacy policy OR leakage; DELETE USING only (no invented WITH CHECK);
- audit trigger forbids UPDATE/DELETE for runtime; privacy-erasure DELETE is shop-scoped only; coordinator journal while disabled (no runtime `AuditEvent` INSERT);
- completion receipt has no Shop FK, is bound to request+generation+target, and is not claimed anonymous; old receipt cannot skip a newer generation;
- no one transaction across `stocky_control_plane` and `stocky_privacy_erasure`; no RLS disablement; assignment lock helper on the CP replay txn;
- verified privacy jobs use the named intake→`createPrivacyDurableJob`→`claimPendingPrivacyJobs`→`executePrivacyJob` path while disabled; unknown types denied;
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

(Shape from Shopify privacy-law-compliance, accessed 2026-09-18; values synthetic.)

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
| PR7-ACT-004 | D-PR7-01/02 | offline-only session; library may lack `sub` | platform action | actor from `sub` **if** installed library binds it under `useOnlineTokens: true`; else fail closed. **Not** owner. | inventing actor or `shop_owner` from examples | new; **prove library fields at implementation** | `app/rbac/actor.test.ts` | PR7 | designed |
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
| PR7-PRIV-012 | unsupported topic on PR4 sanitizer | `customers/create` | sanitize | throw | persisting | existing | `sync-control-plane.test.ts` `"rejects unsupported topics"` | PR4 | **executed-this-planning-session** (11 tests, SHA V) |
| PR7-PRIV-013 | P7-C05 lookup retry | persist customer id + order ids; crash | retry | scan uses stored ids | hash-only lookup that cannot match order GIDs | new | data-request | PR7 | designed |
| PR7-PRIV-014 | P7-C05 / F-CLAUDE-PR7CP-02 privacy while disabled | `processingEnabled=false` REDACTED; valid privacy GUC | privacy job SELECT/DELETE | target rows visible/deleted under **privacy** policies (no processingEnabled); coordinator checkpoints | re-enable shop; ordinary replay; runtime policies succeeding; runtime AuditEvent INSERT | new | privacy worker + sql.ts | PR7 | designed |
| PR7-PRIV-015 | F-CLAUDE-PR7CP-07 named path | disabled shop; admitted `privacy:shop_redact` | intake → `createPrivacyDurableJob` → `claimPendingPrivacyJobs` → `enqueueWebhook` → `executePrivacyJob` | job claimed **without** fair-claim `processingEnabled=true`; execute **before** `assertShopProcessingEnabled`; request+generation re-read | bypassing dispatcher; second queue product; rewriting `buildFairClaimSchedulerLockSql` | new | intake/dispatcher/fair-claim/webhook-processor | PR7 | designed |
| PR7-PRIV-016 | F-CLAUDE-PR7CP-07 unknown type | jobType `privacy:evil` or unknown | `executionStrategyForJobType` / dispatch | `NO_AUTOMATIC_RETRY`; no privacy GUC; no DELETE | silent retry; treating string prefix as authority | new | execution-strategy.server.ts | PR7 | designed |
| PR7-PRIV-017 | F-CLAUDE-PR7CP-07 type insufficient | DurableJob `privacy:shop_redact` but no matching in-flight `PrivacyRequest`/generation | execute | deny before merchant access | job type alone authorizing DELETE | new | execute.server.ts | PR7 | designed |
| PR7-PRIV-018 | F-CLAUDE-PR7CP-07 strategy | three `PRIVACY_JOB_TYPES` | register | each maps to `BOUNDED_CHECKPOINT_RETRY`; maxAttempts then DL/`ESCALATED` | defaulting them to `NO_AUTOMATIC_RETRY` | new | execution-strategy + prisma enum | PR7 | designed |

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
| PR7-CUST-007 | sanitizer regression | orders/create with email | durable projection | no email property | persist email | existing | `"strips PII from orders/create and keeps money strings"` | PR4 | **executed-this-planning-session** |
| PR7-CUST-008 | GraphQL denylist | document with `customer { id }` | validate | reject | network | existing | `mutation-safety.test.ts` `"rejects Order.cancellation and customer PII fields"` | PR6-B | **executed-this-planning-session** |
| PR7-CUST-009 | P7-C05 hash-only insufficient | request stored hashes only (negative fixture) | retry | **must fail this design**; lookup keys required | shipping hash-only persistence | new | data-request | PR7 | designed |
| PR7-CUST-010 | lookup key types | JSON customer.id number / wide order id | persist | exact decimal strings | JS number coercion | new | same | PR7 | designed |
| PR7-CUST-011 | F-CLAUDE-PR7CP-08 split | `shop_admin` with `platform.export.operational` | GET data_request artifact | deny | serving privacy export as operational export | new | export vs privacy routes | PR7 | designed |
| PR7-CUST-012 | F-CLAUDE-PR7CP-08 uninstalled | app uninstalled; no owner session possible | fulfill | operator `scripts/privacy/fulfill-data-request.ts` recorded support path | pretending in-app owner route is reachable; public URL | new | operator fulfill | PR7 | designed |
| PR7-CUST-013 | F-CLAUDE-PR7CP-10 | authenticated `customers/redact` delivered | intake clock | handle **on arrival**; `deadlineAt=receivedAt+30d`; changelog 2026-03-23 is newer published Shopify send policy | local six-month wait; treating the older six-month page as an implementation pause | new | intake + pause tests | PR7 | designed |

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
| PR7-CI-001 | brief command | package.json | `npm run test:privacy` | script exists; nonzero tests; fail on zero collect | missing script | this planning session **failed** as expected (exit 1, missing script) | package.json | PR7 runtime | **executed-this-planning-session** (absence) |
| PR7-CI-002 | CI policy | docs-only this planning PR (plan + matrix + preserved review) | classify vs V | `docs_only=true`; `full_ci=false`; three paths | full_ci for docs-only; zero tests collected treated as success | classifier after land | classify script | this planning PR | **executed-this-planning-session** on original HEAD; **re-run after this correction** |
| PR7-CI-003 | runtime PR | implementation diff | classify | `full_ci=true`; heavy includes privacy | docs-only on schema change | CI | workflow | PR7 runtime | designed |

---

## 7. Mapping to current V tests (do not relabel as PR7 complete)

| Current test | What it actually proves | What it does **not** prove |
|---|---|---|
| `sync-control-plane.test.ts` sanitizer (11 tests, **executed-this-planning-session** PASS) | PR4 projection allowlists; unsupported topics throw | compliance processors |
| `mutation-safety.test.ts` (6 tests, **executed-this-planning-session** PASS) | B GraphQL cannot select customer PII fields | redaction of stored rows |
| `foundation-safety.test.ts` (4 tests, **executed-this-planning-session** PASS) | inventory-write flags default OFF | RBAC |
| `shop-domain.test.ts` (10 tests, **executed-this-planning-session** PASS) | domain normalization | actor identity |
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
| Enabling `useOnlineTokens` in **this** planning PR | D-PR7-02 constrained for FUTURE implementation; not authorized here | proving actor id **and** owner proof (`associated_user.account_owner`) plus library bind tests |
| Live PostgreSQL DELETE-while-disabled in this planning environment | Postgres/Redis not listening (**BLOCKED**) | source-derived `rlsPoliciesSql` + OFFICIAL 0-row vs error; implementation must execute live catalog tests |

---

## 9. Cross-check against the execution plan

| Matrix group | Plan anchors |
|---|---|
| PR7-ACT-001…023 | §7.1, D-PR7-01/02/04, **P7-C01**, **F-CLAUDE-PR7CP-05** |
| PR7-RBAC-001…021 | §7.2, §7.10, D-PR7-07/12, **P7-C04**, **F-CLAUDE-PR7CP-06** |
| PR7-AUD-001…014 | §7.3, §7.7, D-PR7-03/08, **P7-C02**, **F-CLAUDE-PR7CP-02** |
| PR7-LIFE-001…024 | §7.4, §7.6, D-PR7-05/06, **P7-C03**, **F-CLAUDE-PR7CP-01/04** |
| PR7-PRIV-001…018 | §7.4, §7.9, §7.11, **P7-C05**, **F-CLAUDE-PR7CP-02/07** |
| PR7-RED-001…021 | §7.5–7.6.4, D-PR7-10/11/13, **F-CLAUDE-PR7CP-03/04** |
| PR7-CUST-001…013 | §3, §7.13, D-PR7-14, **F-CLAUDE-PR7CP-08/10** |
| PR7-ESCL-001…004 | §7.12, **F-CLAUDE-PR7CP-09** |
| PR7-SIDE-* / ISO-* | §7.7–7.9, **F-CLAUDE-PR7CP-02** |
| PR7-CI-* | §10, CI_POLICY, **P7-C06** |

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

| Command | Exit | Tests | SHA | Classification |
|---|---|---|---|---|
| `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-control-plane.test.ts` | 0 | 11 passed | V `a3ff480f1477237f8055f10c43298480a05728a1` | **executed-this-planning-session** (prior planning head; not re-run this correction) |
| `npx vitest run app/lib/order-facts/admin-read/mutation-safety.test.ts app/lib/order-facts/foundation-safety.test.ts` | 0 | 10 passed | V | **executed-this-planning-session** (prior) |
| `npx vitest run app/lib/shop-domain.test.ts` | 0 | 10 passed | V | **executed-this-planning-session** (prior) |
| Node IEEE-754 `Number("9007199254740993")===9007199254740992` | 0 | n/a | this correction session, Node `v22.14.0` | **executed-this-planning-session** |
| `npm run test:privacy` | 1 | n/a missing script | V | **executed-this-planning-session** (absence) |
| `npm run test:sync-uninstall` | **not executed** | — | Postgres/Redis TCP refused | **present-on-V-not-executed** / **BLOCKED** |
| `npm run test:tenant-access` | **not executed** | — | same | **present-on-V-not-executed** / **BLOCKED** |
| `npm run test:db-isolation` | **not executed** | — | same | **present-on-V-not-executed** / **BLOCKED** |
| Live PostgreSQL RLS DELETE-while-disabled | **not executed** | — | no listening Postgres | **source-derived only** (review + `rlsPoliciesSql`); class **not** upgraded |

Those blocked suites remain **BLOCKED**, not failed-as-product, and not passing evidence. Historical counts in older implementation reports are **not** this session. Designed fixtures did **not** run against nonexistent PR7 processors.

Official pages in plan §3 were re-fetched **2026-09-18**. Store calls were **not** executed.

---

## 11. F-CLAUDE-PR7CP-01…10 finding crosswalk

| ID | Sev | Original meaning | Plan section | Positive scenario | Negative / bypass scenario | Future home | Evidence class |
|---|---|---|---|---|---|---|---|
| **F-CLAUDE-PR7CP-01** | P0 | Domain/body HMAC / receipt certified later generations | §7.4, §7.6.1 | PR7-LIFE-011 exact old retry; PR7-LIFE-016 gen2 uninstalled new event | PR7-LIFE-017 live successor; PR7-LIFE-018 conflict; PR7-LIFE-019 missing id; PR7-LIFE-020 two unfinished; PR7-RED-007 receipt not skip token | `app/privacy/intake` + classifier | **designed** |
| **F-CLAUDE-PR7CP-02** | P0 | Same RLS includes processingEnabled | §7.3, §7.7 | PR7-PRIV-014 privacy DELETE while disabled; PR7-AUD-013 coordinator | PR7-AUD-014 runtime 0-row/error; PR7-SIDE-009/010 no mutation / no OR leakage | `scripts/tenant-enforcement/sql.ts` additive privacy policies | **designed**; RLS **source-derived**, not live PG |
| **F-CLAUDE-PR7CP-03** | P1 | No role may DELETE Shop | §7.6.4, §7.7 | PR7-RED-001 checked function; PR7-RED-021 grants | PR7-RED-006 children remain; runtime/CP bare DELETE denied | `stocky_privacy_finalize_shop_delete` | **designed** (function **absent on V**) |
| **F-CLAUDE-PR7CP-04** | P1 | Receipt before residual; coordinator deleted early | §7.6.3 | PR7-RED-015/017–019 crash boundaries | PR7-LIFE-021 receipt vs remnants; PR7-LIFE-022; PR7-RED-020 late writer | privacy worker + residual probe | **designed** |
| **F-CLAUDE-PR7CP-05** | P1 | `String(associated_user.id)` | §7.1 | PR7-ACT-018/020 exact sub + safe owner | PR7-ACT-021…023 wide/collision/mismatch | `app/rbac/actor.test.ts` | **designed**; IEEE-754 probe **executed** |
| **F-CLAUDE-PR7CP-06** | P1 | Two-role same UoW | §7.10 | PR7-RBAC-019/020 lock timelines; PR7-RBAC-016 reconcile | PR7-RBAC-015 no 2PC abort; PR7-RBAC-021 no relabel | `replay.server.ts` + lock helper | **designed** |
| **F-CLAUDE-PR7CP-07** | P1 | Privacy jobs omitted from V dispatch | §7.9, §7.11 | PR7-PRIV-015 named path; PR7-PRIV-018 strategy | PR7-PRIV-016 unknown; PR7-PRIV-017 type insufficient | intake/dispatcher/fair-claim/processor | **designed** |
| **F-CLAUDE-PR7CP-08** | P2 | Owner-only vs shop_admin export | §7.2, §7.13 | PR7-CUST-006 live account_owner | PR7-CUST-011 shop_admin denied; PR7-CUST-012 uninstalled operator path | privacy download route + CLI | **designed** |
| **F-CLAUDE-PR7CP-09** | P2 | ESCALATED unnamed | §7.12 | PR7-ESCL-001/003 owner view + operator CAS | PR7-ESCL-002 unauthorized; PR7-ESCL-004 no waive | escalation route + resolve-escalation.ts | **designed** |
| **F-CLAUDE-PR7CP-10** | P3 | Six-month page vs changelog | §3 | PR7-CUST-013 handle on arrival | local 180-day wait; equal-authority of older page | intake clock | **designed**; pages **re-fetched 2026-09-18** |

No row in this table is a passing privacy processor.

---

## 12. Consistency obligations for this packet

| Check | Rule |
|---|---|
| Three identities | Delivery binding ≠ work id ≠ completion receipt. HMAC/body is not a lifetime work key. |
| Shop DELETE | Only `stocky_privacy_finalize_shop_delete`. Runtime/CP have no bare DELETE. |
| Completion | Residual empty **then** conditional CP txn. Receipt cannot override remnants. |
| Actor | `sessionToken.sub` string. Wide id preserved. Unsafe numeric owner blocked. |
| Replay | One CP txn + assignment lock. No cross-role atomicity slogan. |
| Privacy jobs | Closed `PRIVACY_JOB_TYPES` + `BOUNDED_CHECKPOINT_RETRY` + while-disabled claim path. Unknown denied. |
| Download | `platform.privacy.data_request.download` ≠ `platform.export.operational`. |
| Escalation | Named owner route + operator CLI. No `retain_live` waiver. |
| Timing | Changelog newer; handle on arrival; no local 180-day wait. |
| Q-008 / R-176 / R-164 | OPEN / OPEN-P0 / unchanged. No D-055. |
