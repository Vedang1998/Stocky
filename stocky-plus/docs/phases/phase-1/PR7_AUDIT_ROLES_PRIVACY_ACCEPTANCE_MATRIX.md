# Phase 1 PR7 — Audit, roles, and privacy acceptance matrix

**Status:** **PROPOSED — ONE-DEPENDENCY-AHEAD — NOT IMPLEMENTATION AUTHORITY**

Companion plan: `stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md`

These rows are **test-executable in specificity**. They are documentation. They are **not** passing CI on a runtime implementation.

Fixture data is **synthetic**. No merchant or customer production data.

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

All must be true on the exact implementation head before ChatGPT acceptance:

- [ ] HMAC-invalid compliance POST returns 401; valid HMAC acks 200 only after durable `PrivacyRequest` (or proven duplicate).
- [ ] `customers/data_request`, `customers/redact`, `shop/redact` processors exist, are idempotent, checkpointed, and covered by `npm run test:privacy` with **nonzero** tests.
- [ ] Shop/redact residual probe is empty except `PrivacyCompletionReceipt` + counsel holds (empty hold set unless Q-008 says otherwise). **No** leftover tenant-linked `AuditEvent` or `Shop` row.
- [ ] Deletion manifests never contain customer email/phone/tokens/raw payloads.
- [ ] `AuditEvent` is append-only for `stocky_runtime`; privacy-erasure DELETE is shop-scoped and tested; failed writes do not create `*_COMPLETED`.
- [ ] Platform permission checks run on the server; UI omission is insufficient; default deny; user-supplied role/shop/actor/`account_owner` ignored.
- [ ] First staff/collaborator/empty assignments do **not** become `shop_owner`.
- [ ] Uninstall still disables immediately; session delete is **asserted**; **this generation** `REDACTED` cannot be revived; a **new** generation after completed erasure can install.
- [ ] Human replay/export jobs revalidate permission at execution; they cannot become generic system jobs.
- [ ] Verified privacy jobs run while processing is disabled without re-enabling the shop or bypassing RLS.
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

- actor derivation cannot be forged from JSON/query/header; owner bootstrap cannot use first-login;
- numeric/string Shopify user ids are preserved without lossy coercion;
- RLS + grants on new tables (exact catalog, not names), including `stocky_privacy_erasure`;
- audit trigger forbids UPDATE/DELETE for runtime; privacy-erasure DELETE is shop-scoped only;
- completion receipt has no Shop FK and is not claimed anonymous;
- privacy dual-role transaction boundary (no runtime DML on control-plane; no one txn across roles; no RLS disablement);
- verified privacy jobs work while processing is disabled without re-enabling the shop;
- human replay/export revalidation at execution;
- `shop/redact` vs reinstall uses generation binding / `ESCALATED`, not timestamps;
- customer lookup keys survive retries; empty export only after complete-scan;
- residual probe completeness vs §7.6 of the plan;
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
  "wideId": { "shopifyUserId": "9007199254740993", "note": "larger than Number.MAX_SAFE_INTEGER; must remain exact decimal string" }
}
```

Store and compare `shopifyUserId` as decimal digit strings. Do not coerce through IEEE-754 `Number`.

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

(Shape from Shopify privacy-law-compliance, accessed 2026-09-17; values synthetic.)

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

A failed `replayDeadLetter` or denied permission **must not** insert `AuditEvent` with `action=REPLAY_REQUESTED` and `decision=completed`.

### FXT-MANIFEST-NO-PII

Manifest JSON must not match `/@|\\+1\\d|shpat_|shppa_|accessToken/`.

### FXT-COMPLETION-RECEIPT

Receipt row may contain `topic`, `completedAt`, `manifestDigest`, `shopDomainHmac`. Forbidden: cleartext domain, `shopId` FK, customer id, order ids, `data_request.id`, webhook ids, unsalted SHA256 claimed as anonymous.

### FXT-GENERATIONS

```json
{
  "gen1": { "domain": "pr7-a.myshopify.com", "uninstalledAt": "2026-09-01T00:00:00.000Z", "erasedAt": null },
  "gen2Live": { "domain": "pr7-a.myshopify.com", "installedAt": "2026-09-02T00:00:00.000Z", "processingEnabled": true }
}
```

---

## 6. Test rows

### 6.1 Actor and authority

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-ACT-001 | brief actor; PR2 contract | Shop A exists; admin session shop=A | `requireAdminTenant` | `tenant.shopId=shop_a` | using query `shop=B` | existing assertion `"verified Shop A resolves to Shop A authority"` | `authority.test.ts` | PR2 (preserve) | **present-on-V-not-executed** (Postgres blocked this session) |
| PR7-ACT-002 | client shop cannot create authority | Shop A+B | query/header/JSON/form `shop=B` | `client_shop_conflict` | tenant B | existing | `authority.test.ts` | PR2 | **present-on-V-not-executed** |
| PR7-ACT-003 | D-PR7-01 | online session user `"548380009"` | platform action | actor = that exact decimal string | body `actorId=548380010` | new | `app/rbac/actor.test.ts` | PR7 | designed |
| PR7-ACT-004 | D-PR7-01 | offline session, embedded `sessionToken.sub="548380009"` | platform action | actor from `sub` **if** library provides it; else fail closed. **Not** owner. | inventing actor or `shop_owner` | new; **prove library fields** | `app/rbac/actor.test.ts` | PR7 | designed |
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
| PR7-ACT-018 | P7-C01 identity width | FXT-USERS `wideId` | persist/compare | stored string `9007199254740993` | `Number()` rounding | new | actor.test.ts | PR7 | designed |
| PR7-ACT-019 | P7-C01 forged account_owner | body/session row `accountOwner=true` but live `associated_user.account_owner=false` | bootstrap | `unassigned` | grant | new | same | PR7 | designed |
| PR7-ACT-020 | P7-C01 real owner proof | online `associated_user.account_owner=true` same shop+id | bootstrap | `shop_owner` | requiring a prior assignment | new | same | PR7 | designed |

### 6.2 RBAC matrix

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-RBAC-001 | matrix | `shop_owner` | administer roles | allow + `ROLE_ASSIGNED` audit | unassigned doing it | new | `require-permission.test.ts` | PR7 | designed |
| PR7-RBAC-002 | matrix | `shop_admin` | administer roles | deny + `PERMISSION_DENIED` | assignment change | new | same | PR7 | designed |
| PR7-RBAC-003 | matrix | `shop_admin` | replay | allow wrapper call into `replayDeadLetter` with tenant shopId **after** execution-time revalidation | body shopId of B | new | `app.platform.replay` test | PR7 | designed |
| PR7-RBAC-004 | matrix | `platform_auditor` | replay | deny | new durable job | new | same | PR7 | designed |
| PR7-RBAC-005 | matrix | `platform_auditor` | audit.read | allow rows (pre-redact) | seeing legal-hold payloads | new | audit reader test | PR7 | designed |
| PR7-RBAC-006 | matrix | `unassigned` | sync_health.read | deny | health JSON | new | same | PR7 | designed |
| PR7-RBAC-007 | matrix | any staff | `platform.privacy.process` via UI | deny | staff-triggered erase | new | same | PR7 | designed |
| PR7-RBAC-008 | D-PR7-07 | `unassigned` | `app.purchase-orders` loader | still `requireAdminTenant` only | accidental 403 from platform matrix | new regression | merchandising route test | PR7 | designed |
| PR7-RBAC-009 | export | `shop_admin` | `platform.export.operational` | allow | auditor export | new | export test | PR7 | designed |
| PR7-RBAC-010 | P7-C04 / D-PR7-12 | replay job queued; owner revokes admin **before execution** | worker run | `REPLAY_DENIED`; no `replayDeadLetter` effect | completing as `actorKind=system` | new | replay worker test | PR7 | designed |
| PR7-RBAC-011 | default deny | unknown permission key | check | throw fail-closed | allow | new | permissions.ts test | PR7 | designed |
| PR7-RBAC-012 | P7-C01 | first `account_owner` online | afterAuth | `shop_owner` assignment | first collaborator owner | new | assignment bootstrap test | PR7 | designed |
| PR7-RBAC-013 | revoke before enqueue | assignment revoked | replay click | deny; no job | allow | new | same | PR7 | designed |
| PR7-RBAC-014 | UI hide ≠ auth | hidden button | direct POST | deny | success | new | route test | PR7 | designed |
| PR7-RBAC-015 | P7-C04 before commit | job executing; revoke injected before commit | commit attempt | abort txn | committed replay | new | replay worker | PR7 | designed |
| PR7-RBAC-016 | P7-C04 after commit | committed replay; then revoke | retry | deny retry | using stale grant | new | same | PR7 | designed |
| PR7-RBAC-017 | P7-C04 export | export job queued; revoke before blob write | worker run | fail closed; no blob | worker system bypass | new | export worker | PR7 | designed |
| PR7-RBAC-018 | P7-C04 autonomous privacy | staff revoked; privacy job running | privacy worker tick | privacy continues | requiring the revoked user’s permission | new | privacy worker | PR7 | designed |

### 6.3 Audit

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-AUD-001 | immutable | insert event | `UPDATE AuditEvent SET decision='completed'` as runtime | error / 0 rows | rewrite | new | `audit/immutability.test.ts` | PR7 | designed |
| PR7-AUD-002 | immutable | insert | `DELETE` as runtime | 0 rows | delete | new | same | PR7 | designed |
| PR7-AUD-003 | failed write | replay denied disabled shop | existing `replay_denied_disabled_shop` | `REPLAY_DENIED` or none of completed | `decision=completed` | new + preserve integration | `replay` wrapper | PR7 | designed |
| PR7-AUD-004 | permission fail | unassigned replay | deny | `PERMISSION_DENIED`; no replay job | completed audit | new | rbac | PR7 | designed |
| PR7-AUD-005 | idempotency | duplicate emit key | second insert | same id | two rows | new | audit emit | PR7 | designed |
| PR7-AUD-006 | minimization | data_request intake | persist audit | no raw email/phone in `payloadMinimized` | durable email | new | privacy intake | PR7 | designed |
| PR7-AUD-007 | correlation | admin replay | emit | event.correlationId present and shop-scoped | missing shopId | new | audit emit | PR7 | designed |
| PR7-AUD-008 | privacy system actor | privacy checkpoint | emit | `actorKind=system` | human id forged | new | privacy worker | PR7 | designed |
| PR7-AUD-009 | P7-C02 shop/redact | events exist | redact | tenant-linked `AuditEvent` **deleted**; receipt FXT-COMPLETION-RECEIPT | in-place UPDATE; leftover tenant audit; email on receipt | new | shop redact | PR7 | designed |
| PR7-AUD-010 | not a second ledger | apply order fact | apply | no extra “canonical fact audit” besides existing receipt | duplicating C receipts as AuditEvent content | review | plan D-PR7-03 | PR7 | designed |
| PR7-AUD-011 | P7-C02 privilege | privacy-erasure role | `DELETE AuditEvent` shop A | A rows gone; B intact | RLS disable; DELETE B | new | audit/privacy-erasure.test.ts | PR7 | designed |
| PR7-AUD-012 | P7-C02 rollback | populated AuditEvent | “rollback” plan | processors disabled; tables remain | drop populated audit tables as general rollback | review + test name | plan §7.7 | PR7 | designed |

### 6.4 Lifecycle (uninstall / reinstall)

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-LIFE-001 | D-021 uninstall | cancellable jobs | `processUninstall` | `processingEnabled=false`, jobs `CANCELLED` | leftover RUNNING without cancel | existing `sync-uninstall.test.ts` | `sync-uninstall.test.ts` | PR4 preserve | **present-on-V-not-executed** (Postgres/Redis blocked this session) |
| PR7-LIFE-002 | session wipe | Session rows for shop | uninstall | `sessionsDeleted>=1` and count 0 | tokens remain | **new assertion** | extend `sync-uninstall.test.ts` | PR7 | designed |
| PR7-LIFE-003 | session wipe fail | deleteSessions throws | uninstall | shop stays disabled | re-enable | new | same | PR7 | designed |
| PR7-LIFE-004 | duplicate uninstall | already UNINSTALLED | second webhook | idempotent disable | processing true | existing | `sync-uninstall.test.ts` | PR4 | **present-on-V-not-executed** |
| PR7-LIFE-005 | reinstall UNINSTALLED | disabled UNINSTALLED | afterAuth | `processingEnabled=true` | stuck disabled | **new** | reinstall test | PR7 | designed |
| PR7-LIFE-006 | D-PR7-06 | **this generation** `REDACTED` incomplete | afterAuth | no enqueue; no ShopSettings repair; `reinstall_denied` | catalog job | **new** | `after-auth` test | PR7 | designed |
| PR7-LIFE-007 | MANUAL | MANUAL disable | afterAuth | no auto enable | enable | **new** | reinstall test | PR7 | designed |
| PR7-LIFE-008 | P7-C03 | FXT-GENERATIONS gen1 uninstalled + gen2 live | `shop/redact` | `ESCALATED`; live shop retained | timestamp `SUPERSEDED`; erase gen2 | new | privacy shop-redact | PR7 | designed |
| PR7-LIFE-009 | enqueue-before-uninstall | PENDING job then uninstall | cancel | job cancelled | worker applies after disable (existing PR4 race rules) | existing + preserve | uninstall/intake | PR4/PR7 | designed |
| PR7-LIFE-010 | stale reinstall job | REDACTED generation; old queued envelope | worker | fail closed | applying facts | new | privacy + envelope | PR7 | designed |
| PR7-LIFE-011 | P7-C03 delayed delivery | gen1 erased; gen2 live; late `shop/redact` | POST | old generation idempotent complete; gen2 intact | erase gen2 | new | shop-redact | PR7 | designed |
| PR7-LIFE-012 | P7-C03 duplicate request | existing shop/redact RECEIVED | second POST | same request; duplicateCount++ | second erase worker | new | intake | PR7 | designed |
| PR7-LIFE-013 | P7-C03 fresh reinstall after complete | receipt exists; no Shop | afterAuth | **new** Shop + generation; enqueue allowed | permanent domain blacklist | new | after-auth | PR7 | designed |
| PR7-LIFE-014 | P7-C03 missing old generation | no Shop; uninstalled generation remnants | `shop/redact` | resume remnants; not skip | silent COMPLETED with leftovers | new | shop-redact | PR7 | designed |
| PR7-LIFE-015 | P7-C03 concurrent afterAuth/redact | REDACTED applying | afterAuth + privacy worker | afterAuth denied; privacy continues | re-enable mid-erase | new | race test | PR7 | designed |

### 6.5 Privacy intake and states

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-PRIV-001 | HMAC | invalid HMAC | POST compliance | 401 | 200 + processor | new | `webhooks.compliance.test.ts` | PR7 | designed |
| PR7-PRIV-002 | ack | valid HMAC FXT-COMPLIANCE-DATA-REQUEST shop A | POST | 200; `PrivacyRequest` RECEIVED | claiming erased in body | new | same | PR7 | designed |
| PR7-PRIV-003 | duplicate | existing request id 9999 | second POST | same request id; duplicateCount++ | two APPLYING workers unbounded | new | same | PR7 | designed |
| PR7-PRIV-004 | wrong shop HMAC domain vs body | body shop B, HMAC A | POST | deny / reject | processing B | new | intake | PR7 | designed |
| PR7-PRIV-005 | 30-day clock | RECEIVED or ESCALATED | scheduler/operator | work or incident before `receivedAt+30d` | silent drop / indefinite escalation | new | scheduler test | PR7 | designed |
| PR7-PRIV-006 | pause switch | `FEATURE_PR7_PRIVACY_PAUSE=1` | worker | stays SCHEDULED; ack already 200 | deletes; claiming clock waived | new | worker | PR7 | designed |
| PR7-PRIV-007 | process death | APPLYING mid-batch; SIGKILL after commit of checkpoint N | resume | continue N+1 | restart from 0 duplicating side effects unsafely **or** skipping | new | process-loss child | PR7 | designed |
| PR7-PRIV-008 | transaction fail | injected error in surface k | worker | PARTIAL_FAILED | COMPLETED | new | worker | PR7 | designed |
| PR7-PRIV-009 | incomplete pagination | >page size rows | enumerator | visits all keys | silent cap | new | enumerate.test.ts | PR7 | designed |
| PR7-PRIV-010 | late arriving webhook | APPLYING shop/redact | new orders/create | ordinary intake denied | new fact row | new | intake+redact | PR7 | designed |
| PR7-PRIV-011 | compliance sanitizer | customers/data_request payload | persist projection | lookup keys (ids) + hashed email; no raw email | durable raw email | new | `app/privacy/sanitize-compliance` | PR7 | designed |
| PR7-PRIV-012 | unsupported topic on PR4 sanitizer | `customers/create` | sanitize | throw | persisting | existing | `sync-control-plane.test.ts` `"rejects unsupported topics"` | PR4 | **executed-this-planning-session** (11 tests, SHA V) |
| PR7-PRIV-013 | P7-C05 lookup retry | persist customer id + order ids; crash | retry | scan uses stored ids | hash-only lookup that cannot match order GIDs | new | data-request | PR7 | designed |
| PR7-PRIV-014 | P7-C05 privacy while disabled | `processingEnabled=false` REDACTED | privacy job | deletes/checkpoints | re-enable shop; ordinary replay allowed | new | privacy worker | PR7 | designed |

### 6.6 Shop/redact enumerator

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-RED-001 | D-021 | Shop A facts+jobs+sessions; UNINSTALLED generation | shop/redact | REDACTED then Shop gone; residual 0 except receipt/holds | leftover Supplier/OrderFact/DurableJob/Session/AuditEvent | new | shop-redact.test.ts | PR7 | designed |
| PR7-RED-002 | child-first | PO + lines | redact | lines then PO | FK violation abort without checkpoint | new | same | PR7 | designed |
| PR7-RED-003 | control-plane | deliveries/DL/replays | redact | those rows gone | retaining sanitizedPayload | new | same | PR7 | designed |
| PR7-RED-004 | receipts | SyncApplicationReceipt | redact | gone | leftover digest that reconstitutes payload | new | same | PR7 | designed |
| PR7-RED-005 | cross-shop | A+B populated | redact A | B intact | deleting B; generic bypass | new | same | PR7 | designed |
| PR7-RED-006 | Restrict Shop FK | children remain | delete Shop too early | fail; shop not removed until children gone | orphan | new | same | PR7 | designed |
| PR7-RED-007 | P7-C02 / D-PR7-11 | children gone | completion | FXT-COMPLETION-RECEIPT; no Shop FK | cleartext domain; unsalted hash claimed anonymous; leftover AuditEvent | new | receipt test | PR7 | designed |
| PR7-RED-008 | R-164 vs privacy | tombstoned catalog row | shop/redact | physical delete allowed **in privacy module** | calling C apply delete | new | redact uses privacy-erasure/control-plane not apply | PR7 | designed |
| PR7-RED-009 | Redis | BullMQ job envelope shop A | redact | job removed or worker fail-closed; privacy job kept | other shops’ jobs removed | new | redis cleanup | PR7 | designed |
| PR7-RED-010 | H scratch if base has D | leftover `att-*` for A | redact | dispose authentic handles; probe fails if leftover bytes remain | `unlink` of unowned symlink | new | scratch cleanup | PR7 | designed |
| PR7-RED-011 | H job types if present | `order-facts-sync` jobs | redact | included in cancel+delete | ignored stranded import | new | same | PR7 | designed |
| PR7-RED-012 | backups | restore after redact | **out of repo tests**; staging | documented cannot un-erase | claiming backup covered | skip reason §8 | staging | later | designed skip |
| PR7-RED-013 | manifest PII | after redact | read manifest (pre-delete) / receipt | FXT-MANIFEST-NO-PII; FXT-COMPLETION-RECEIPT | email in JSON | new | manifest test | PR7 | designed |
| PR7-RED-014 | success audit | PARTIAL_FAILED | emit | no `PRIVACY_COMPLETED` | completed event | new | audit | PR7 | designed |
| PR7-RED-015 | P7-C02 residual | after complete redact | probe | 0 tenant-linked AuditEvent; receipt exists | “minimized” leftover audit rows | new | residual probe | PR7 | designed |
| PR7-RED-016 | never-uninstalled live shop | processingEnabled true, no uninstall generation | shop/redact | ESCALATED; data retained | erase | new | shop-redact | PR7 | designed |

### 6.7 Customer data_request / redact

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-CUST-001 | P7-C05 empty after scan | FXT-EXPECTED-EMPTY-CUSTOMER-SCAN | data_request FXT | COMPLETED empty export **only after** required surfaces scanned | inventing customer PII; empty-by-construction without scan | new | customers-data-request.test.ts | PR7 | designed |
| PR7-CUST-002 | order GID map | `ShopifyOrderFact` gid `gid://shopify/Order/299938` **without** customer fields | data_request | include operational gid+units in owner export (still no email) **after scan** | adding email; skipping because no customer column | new | same | PR7 | designed |
| PR7-CUST-003 | Session staff email | Session.email owner | customers/redact john@example.test | **do not** delete staff session because Shopify customer email ≠ staff | wiping shop sessions | new | customers-redact.test.ts | PR7 | designed |
| PR7-CUST-004 | supplier contact | Supplier.contactEmail=john@example.test | customers/redact | **PROPOSED default: do not treat supplier contacts as Shopify customer redact** (different data class) | silent supplier wipe | new | same | PR7 | designed |
| PR7-CUST-005 | customers/redact empty | no matches **after complete scan** | redact | COMPLETED skipped_absent | shop-wide delete | new | same | PR7 | designed |
| PR7-CUST-006 | D-PR7-14 | data_request complete | owner download | `shop_owner`/`shop_admin` with export perm; TTL | auditor or Shop B | new | export route | PR7 | designed |
| PR7-CUST-007 | sanitizer regression | orders/create with email | durable projection | no email property | persist email | existing | `"strips PII from orders/create and keeps money strings"` | PR4 | **executed-this-planning-session** |
| PR7-CUST-008 | GraphQL denylist | document with `customer { id }` | validate | reject | network | existing | `mutation-safety.test.ts` `"rejects Order.cancellation and customer PII fields"` | PR6-B | **executed-this-planning-session** |
| PR7-CUST-009 | P7-C05 hash-only insufficient | request stored hashes only (negative fixture) | retry | **must fail this design**; lookup keys required | shipping hash-only persistence | new | data-request | PR7 | designed |
| PR7-CUST-010 | lookup key types | JSON customer.id number / wide order id | persist | exact decimal strings | JS number coercion | new | same | PR7 | designed |

### 6.8 Side channels and isolation

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-SIDE-001 | dual-role | privacy worker | merchant delete + control-plane delete | separate txns; checkpoint not leading | one txn both roles | new | privacy worker | PR7 | designed |
| PR7-SIDE-002 | shared Redis | two shops | redact A | B jobs remain | FLUSHALL | new | redis | PR7 | designed |
| PR7-SIDE-003 | pooled PG | privacy job A then B | run both | no leftover `stocky.current_shop_id` | B seeing A | new | privacy-surfaces.test.ts | PR7 | designed |
| PR7-SIDE-004 | missing envelope | worker | start | deny before merchant access | query | new | same | PR7 | designed |
| PR7-SIDE-005 | foreign envelope | A envelope on B rows | delete attempt | deny | cross-shop delete | new | same | PR7 | designed |
| PR7-SIDE-006 | P7-C05 ordinary replay while disabled | processingEnabled=false | human replay | deny | privacy capability used as replay bypass | new | replay | PR7 | designed |
| PR7-SIDE-007 | P7-C05 afterAuth while disabled | REDACTED generation | afterAuth | deny enable | catalog enqueue | new | after-auth | PR7 | designed |
| PR7-SIDE-008 | P7-C02 no generic bypass | privacy-erasure connection | SELECT shop B | 0 rows | reading B audit | new | privacy-erasure | PR7 | designed |
| PR7-ISO-001 | replace deferral | current worker-surfaces | add privacy path tests | still honest about export/reconciliation deferral | renaming only | new + edit worker-surfaces comment | db-isolation | PR7 | designed |
| PR7-ISO-002 | raw SQL | privacy connection | `SET ROLE` / `DISABLE RLS` | denied | bypass RLS | existing role-membership tests + new | enforcement | PR7 | designed |
| PR7-ISO-003 | bootstrap | privacy code | architecture audit | must not live in `bootstrap.server.ts` | merchant delete in bootstrap | architecture-audit | `architecture-audit.test.ts` | PR7 | designed |

### 6.9 Commands / CI

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-CI-001 | brief command | package.json | `npm run test:privacy` | script exists; nonzero tests; fail on zero collect | missing script | this planning session **failed** as expected (exit 1, missing script) | package.json | PR7 runtime | **executed-this-planning-session** (absence) |
| PR7-CI-002 | CI policy | docs-only this planning PR | classify | `docs_only=true` | full_ci for two docs files | classifier after land | classify script | this planning PR | **executed-this-planning-session** on original HEAD; re-run after correction |
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
| Enabling `useOnlineTokens` | D-PR7-02 still **proposed**; not authorized here | proving actor id **and** owner proof (`associated_user.account_owner`) |

---

## 9. Cross-check against the execution plan

| Matrix group | Plan anchors |
|---|---|
| PR7-ACT-001…020 | §7.1, D-PR7-01/02/04, **P7-C01** |
| PR7-RBAC-001…018 | §7.2, D-PR7-07/12, **P7-C04** |
| PR7-AUD-001…012 | §7.3, D-PR7-03/08, **P7-C02** |
| PR7-LIFE-001…015 | §4.5, §7.6, D-PR7-05/06, **P7-C03** |
| PR7-PRIV-001…014 | §7.4, **P7-C05** |
| PR7-RED-001…016 | §7.5–7.6, D-PR7-10/11/13, **P7-C02/C03/C05** |
| PR7-CUST-001…010 | §3 OFFICIAL payloads, D-PR7-14, **P7-C05** |
| PR7-SIDE-* / ISO-* | §7.7–7.9 |
| PR7-CI-* | §10, CI_POLICY, **P7-C06** |

Every constrained decision that can fail a merchant-safety test has at least one matrix row. **D-PR7-09** pause → PR7-PRIV-006. **D-PR7-14** download → PR7-CUST-006. **P7-C01** first-login → PR7-ACT-013…020. **P7-C03** escalation → PR7-LIFE-008/011…015, PR7-RED-016. **P7-C04** revocation → PR7-RBAC-010/013/015…018.

### 9.1 Correction / decision ID map

| P7-C | Constrained D-PR7 | Primary matrix IDs |
|---|---|---|
| P7-C01 | D-PR7-04 | PR7-ACT-013…020, PR7-RBAC-012 |
| P7-C02 | D-PR7-08, D-PR7-11 | PR7-AUD-001/002/009/011/012, PR7-RED-001/007/015 |
| P7-C03 | D-PR7-05, D-PR7-06 | PR7-LIFE-006/008/011…015, PR7-RED-016 |
| P7-C04 | D-PR7-12 | PR7-RBAC-010/013/015…018 |
| P7-C05 | D-PR7-13 shape; lookup keys | PR7-PRIV-013/014, PR7-CUST-001/002/009/010, PR7-SIDE-006…008 |
| P7-C06 | §10 gates | PR7-CI-*; Now-column labels; exit criteria P0/P1/P2 |

Original D-PR7 IDs are not renamed.

---

## 10. Evidence recorded in this planning environment

| Command | Exit | Tests | SHA | Classification |
|---|---|---|---|---|
| `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-control-plane.test.ts` | 0 | 11 passed | V `a3ff480f1477237f8055f10c43298480a05728a1` | **executed-this-planning-session** |
| `npx vitest run app/lib/order-facts/admin-read/mutation-safety.test.ts app/lib/order-facts/foundation-safety.test.ts` | 0 | 10 passed | V | **executed-this-planning-session** |
| `npx vitest run app/lib/shop-domain.test.ts` | 0 | 10 passed | V | **executed-this-planning-session** |
| `npm run test:privacy` | 1 | n/a missing script | V | **executed-this-planning-session** (absence) |
| `npm run test:sync-uninstall` | **not executed** | — | Postgres/Redis TCP refused | **present-on-V-not-executed** |
| `npm run test:tenant-access` | **not executed** | — | same | **present-on-V-not-executed** |
| `npm run test:db-isolation` | **not executed** | — | same | **present-on-V-not-executed** |

Those last three remain **BLOCKED**, not failed-as-product, and not passing evidence. Historical counts in older implementation reports are **not** this session. Designed fixtures did **not** run against nonexistent PR7 processors.
