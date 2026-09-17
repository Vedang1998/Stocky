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
| Now | `designed` (this packet) vs `executed-on-V` (ran against current code) |

`executed-on-V` rows describe **current** behavior only. They do not pass PR7 processors.

---

## 1. Complete-module exit criteria (PR7 repository)

All must be true on the exact implementation head before ChatGPT acceptance:

- [ ] HMAC-invalid compliance POST returns 401; valid HMAC acks 200 only after durable `PrivacyRequest` (or proven duplicate).
- [ ] `customers/data_request`, `customers/redact`, `shop/redact` processors exist, are idempotent, checkpointed, and covered by `npm run test:privacy` with **nonzero** tests.
- [ ] Shop/redact residual probe is empty except minimized audit + completion receipt + counsel holds (empty hold set unless Q-008 says otherwise).
- [ ] Deletion manifests never contain customer email/phone/tokens/raw payloads.
- [ ] `AuditEvent` is append-only for application roles; failed writes do not create `*_COMPLETED`.
- [ ] Platform permission checks run on the server; UI omission is insufficient; default deny; user-supplied role/shop/actor ignored.
- [ ] Uninstall still disables immediately; session delete is **asserted**; `REDACTED` reinstall is denied; afterAuth does not enqueue for `REDACTED`.
- [ ] Privacy-job isolation tests exist (replace the F-PR3-16 deferral sentence for the privacy path only; export/reconciliation may remain deferred until PR8).
- [ ] Exact-head **full** CI green on the runtime PR (docs-only is **not** sufficient for implementation).
- [ ] Independent Claude Tier-A review of the exact head with no open P0/P1.
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

- actor derivation cannot be forged from JSON/query/header;
- RLS + grants on new tables (exact catalog, not names);
- audit trigger forbids UPDATE/DELETE;
- privacy dual-role transaction boundary (no runtime DML on control-plane; no control-plane writing facts in the same txn as runtime);
- manifest minimization;
- REDACTED afterAuth;
- residual probe completeness vs §7.6 of the plan;
- D scratch/job types **only if** those files exist on the implementation base.

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
  "ownerA": { "shopifyUserId": 548380009, "accountOwner": true, "email": "owner-a@example.test", "emailVerified": true },
  "staffA": { "shopifyUserId": 548380010, "accountOwner": false, "email": "staff-a@example.test", "emailVerified": true },
  "staffAUnverified": { "shopifyUserId": 548380011, "email": "unverified@example.test", "emailVerified": false },
  "ownerB": { "shopifyUserId": 548380009, "note": "same external user id on a different shop" }
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
  "surfacesMatched": [],
  "orderGidProbed": "gid://shopify/Order/299938",
  "manifestLines": [{ "surface": "ShopifyOrderFact", "action": "skipped_absent", "rowCount": 0 }]
}
```

### FXT-AUDIT-SUCCESS-FORBIDDEN

A failed `replayDeadLetter` or denied permission **must not** insert `AuditEvent` with `action=REPLAY_REQUESTED` and `decision=completed`.

### FXT-MANIFEST-NO-PII

Manifest JSON must not match `/@|\\+1\\d|shpat_|shppa_|accessToken/`.

---

## 6. Test rows

### 6.1 Actor and authority

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-ACT-001 | brief actor; PR2 contract | Shop A exists; admin session shop=A | `requireAdminTenant` | `tenant.shopId=shop_a` | using query `shop=B` | existing assertion | `authority.test.ts` | PR2 (preserve) | **executed-on-V** (suite exists; Postgres **BLOCKED** this run) |
| PR7-ACT-002 | client shop cannot create authority | Shop A+B | query/header/JSON/form `shop=B` | `client_shop_conflict` | tenant B | existing | `authority.test.ts` | PR2 | designed + suite on V |
| PR7-ACT-003 | D-PR7-01 | online session user 548380009 | platform action | actor = that user id | body `actorId=548380010` | new | `app/rbac/actor.test.ts` | PR7 | designed |
| PR7-ACT-004 | D-PR7-01 | offline session, embedded `sessionToken.sub=548380009` | platform action | actor from `sub` **if** library provides it; else fail closed | inventing actor | new; **prove library fields** | `app/rbac/actor.test.ts` | PR7 | designed |
| PR7-ACT-005 | D-PR7-01 | neither online user nor `sub` | `platform.replay.execute` | deny + `AUTH_PLATFORM_DENIED` | silent owner fallback | new | `app/rbac/actor.test.ts` | PR7 | designed |
| PR7-ACT-006 | forged role | assignment `unassigned` | JSON `{role:"shop_owner"}` | deny | grant | new | `app/rbac/require-permission.test.ts` | PR7 | designed |
| PR7-ACT-007 | same external user id cross-shop | ownerA on A and ownerB same numeric id on B | A request | only A assignments | reading B assignment | new | `app/rbac/assignment.test.ts` | PR7 | designed |
| PR7-ACT-008 | unverified email | `emailVerified=false` | persist staff | email column null | storing unverified email | new | `app/rbac/assignment.test.ts` | PR7 | designed |
| PR7-ACT-009 | webhook actor | HMAC compliance | intake | `actorKind=shopify_webhook` | treating as shop_owner | new | `app/privacy/intake.test.ts` | PR7 | designed |
| PR7-ACT-010 | worker actor | privacy job envelope | apply | `actorKind=system`, causation=job id | copying staff from enqueue snapshot if revoked — see PR7-RBAC-010 | new | `app/privacy/worker.test.ts` | PR7 | designed |
| PR7-ACT-011 | scopes_update | session row | webhook | scope string updates | changing shopId | existing route unproven | `webhooks.app.scopes_update.tsx` | PR7 may add test | designed |
| PR7-ACT-012 | ID token ≠ access token | documented | comment/test name | tests do not send ID token to Admin API | — | review | plan §3 | PR7 | designed |

### 6.2 RBAC matrix

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-RBAC-001 | matrix | `shop_owner` | administer roles | allow + `ROLE_ASSIGNED` audit | unassigned doing it | new | `require-permission.test.ts` | PR7 | designed |
| PR7-RBAC-002 | matrix | `shop_admin` | administer roles | deny + `PERMISSION_DENIED` | assignment change | new | same | PR7 | designed |
| PR7-RBAC-003 | matrix | `shop_admin` | replay | allow wrapper call into `replayDeadLetter` with tenant shopId | body shopId of B | new | `app.platform.replay` test | PR7 | designed |
| PR7-RBAC-004 | matrix | `platform_auditor` | replay | deny | new durable job | new | same | PR7 | designed |
| PR7-RBAC-005 | matrix | `platform_auditor` | audit.read | allow minimized rows | seeing legal-hold payloads | new | audit reader test | PR7 | designed |
| PR7-RBAC-006 | matrix | `unassigned` | sync_health.read | deny | health JSON | new | same | PR7 | designed |
| PR7-RBAC-007 | matrix | any staff | `platform.privacy.process` via UI | deny | staff-triggered erase | new | same | PR7 | designed |
| PR7-RBAC-008 | D-PR7-07 | `unassigned` | `app.purchase-orders` loader | still `requireAdminTenant` only | accidental 403 from platform matrix | new regression | merchandising route test | PR7 | designed |
| PR7-RBAC-009 | export | `shop_admin` | `platform.export.operational` | allow | auditor export | new | export test | PR7 | designed |
| PR7-RBAC-010 | D-PR7-12 | replay job running; owner revokes admin | worker finish | system job may complete; **new** click denied | using stale allow cache | new | replay worker test | PR7 | designed |
| PR7-RBAC-011 | default deny | unknown permission key | check | throw fail-closed | allow | new | permissions.ts test | PR7 | designed |
| PR7-RBAC-012 | bootstrap owner | first `account_owner` | afterAuth | `shop_owner` assignment | every collaborator owner | new | assignment bootstrap test | PR7 | designed |
| PR7-RBAC-013 | revoke | assignment revoked | subsequent replay click | deny | allow | new | same | PR7 | designed |
| PR7-RBAC-014 | UI hide ≠ auth | hidden button; direct POST | deny | success | new | route test | PR7 | designed |

### 6.3 Audit

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-AUD-001 | immutable | insert event | `UPDATE AuditEvent SET decision='completed'` as runtime | error / 0 rows | rewrite | new | `audit/immutability.test.ts` | PR7 | designed |
| PR7-AUD-002 | immutable | insert | `DELETE` as runtime | 0 rows | delete | new | same | PR7 | designed |
| PR7-AUD-003 | failed write | replay denied disabled shop | existing `replay_denied_disabled_shop` | `REPLAY_DENIED` or none of completed | `decision=completed` | new + preserve integration | `replay` wrapper | PR7 | designed |
| PR7-AUD-004 | permission fail | unassigned replay | deny | `PERMISSION_DENIED`; no replay job | completed audit | new | rbac | PR7 | designed |
| PR7-AUD-005 | idempotency | duplicate emit key | second insert | same id | two rows | new | audit emit | PR7 | designed |
| PR7-AUD-006 | minimization | data_request intake | persist | hashed ids only | raw email/phone in `payloadMinimized` | new | privacy intake | PR7 | designed |
| PR7-AUD-007 | correlation | admin replay | event.correlationId = tenant.correlationId or new UUID linked via causation | missing shopId | new | same | PR7 | designed |
| PR7-AUD-008 | system actor | worker checkpoint | `actorKind=system` | human id forged | new | privacy worker | PR7 | designed |
| PR7-AUD-009 | shop/redact | events exist | redact | display fields null; action/time remain | dropping all evidence **and** storing email | new | shop redact | PR7 | designed |
| PR7-AUD-010 | not a second ledger | apply order fact | no extra “canonical fact audit” besides existing receipt | duplicating C receipts as AuditEvent content | review | plan D-PR7-03 | PR7 | designed |

### 6.4 Lifecycle (uninstall / reinstall)

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-LIFE-001 | D-021 uninstall | cancellable jobs | `processUninstall` | `processingEnabled=false`, jobs `CANCELLED` | leftover RUNNING without cancel | existing | `sync-uninstall.test.ts` | PR4 preserve | **executed-on-V** suite; **BLOCKED** this run |
| PR7-LIFE-002 | session wipe | Session rows for shop | uninstall | `sessionsDeleted>=1` and count 0 | tokens remain | **new assertion** | extend `sync-uninstall.test.ts` | PR7 | designed |
| PR7-LIFE-003 | session wipe fail | deleteSessions throws | uninstall | shop stays disabled | re-enable | new | same | PR7 | designed |
| PR7-LIFE-004 | duplicate uninstall | already UNINSTALLED | second webhook | idempotent disable | processing true | existing | `sync-uninstall.test.ts` | PR4 | designed (suite on V) |
| PR7-LIFE-005 | reinstall UNINSTALLED | disabled UNINSTALLED | afterAuth | `processingEnabled=true` | stuck disabled | **new** | reinstall test | PR7 | designed |
| PR7-LIFE-006 | D-PR7-06 | `REDACTED` | afterAuth | no enqueue; no ShopSettings repair; `reinstall_denied` | catalog job | **new** | `after-auth` test | PR7 | designed |
| PR7-LIFE-007 | MANUAL | MANUAL disable | afterAuth | no auto enable | enable | **new** | reinstall test | PR7 | designed |
| PR7-LIFE-008 | D-PR7-05 | reinstalled live shop | `shop/redact` | `SUPERSEDED`; data retained | erase live shop | new | privacy shop-redact | PR7 | designed |
| PR7-LIFE-009 | enqueue-before-uninstall | PENDING job then uninstall | cancel | job cancelled | worker applies after disable (existing PR4 race rules) | existing + preserve | uninstall/intake | PR4/PR7 | designed |
| PR7-LIFE-010 | stale reinstall job | REDACTED; old queued envelope | worker | fail closed | applying facts | new | privacy + envelope | PR7 | designed |

### 6.5 Privacy intake and states

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-PRIV-001 | HMAC | invalid HMAC | POST compliance | 401 | 200 + processor | new | `webhooks.compliance.test.ts` | PR7 | designed |
| PR7-PRIV-002 | ack | valid HMAC FXT-COMPLIANCE-DATA-REQUEST shop A | POST | 200; `PrivacyRequest` RECEIVED | claiming erased in body | new | same | PR7 | designed |
| PR7-PRIV-003 | duplicate | existing request id 9999 | second POST | same request id; duplicateCount++ | two APPLYING workers unbounded | new | same | PR7 | designed |
| PR7-PRIV-004 | wrong shop HMAC domain vs body | body shop B, HMAC A | deny / reject | processing B | new | intake | PR7 | designed |
| PR7-PRIV-005 | 30-day clock | RECEIVED | scheduler | does not auto-skip legal; work scheduled | silent drop | new | scheduler test | PR7 | designed |
| PR7-PRIV-006 | pause switch | `FEATURE_PR7_PRIVACY_PAUSE=1` | worker | stays SCHEDULED; ack already 200 | deletes | new | worker | PR7 | designed |
| PR7-PRIV-007 | process death | APPLYING mid-batch; SIGKILL after commit of checkpoint N | resume | continue N+1 | restart from 0 duplicating side effects unsafely **or** skipping | new | process-loss child | PR7 | designed |
| PR7-PRIV-008 | transaction fail | injected error in surface k | PARTIAL_FAILED | COMPLETED | new | worker | PR7 | designed |
| PR7-PRIV-009 | incomplete pagination | >page size rows | enumerator | visits all keys | silent cap | new | enumerate.test.ts | PR7 | designed |
| PR7-PRIV-010 | late arriving webhook | APPLYING shop/redact | new orders/create | intake denied (processing gate / REDACTED) | new fact row | new | intake+redact | PR7 | designed |
| PR7-PRIV-011 | compliance sanitizer | customers/data_request payload | persist projection | allowlisted hashes/ids only | durable raw email | new | `app/privacy/sanitize-compliance` | PR7 | designed |
| PR7-PRIV-012 | unsupported topic on PR4 sanitizer | `customers/create` | throw | persisting | existing | `sync-control-plane.test.ts` `"rejects unsupported topics"` | PR4 | **executed-on-V** this run (11 tests) |

### 6.6 Shop/redact enumerator

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-RED-001 | D-021 | Shop A facts+jobs+sessions | shop/redact | REDACTED; residual 0 except receipt/minimized audit | leftover Supplier/OrderFact/DurableJob/Session | new | shop-redact.test.ts | PR7 | designed |
| PR7-RED-002 | child-first | PO + lines | redact | lines then PO | FK violation abort without checkpoint | new | same | PR7 | designed |
| PR7-RED-003 | control-plane | deliveries/DL/replays | redact | those rows gone | retaining sanitizedPayload | new | same | PR7 | designed |
| PR7-RED-004 | receipts | SyncApplicationReceipt | redact | gone | leftover digest that reconstitutes payload | new | same | PR7 | designed |
| PR7-RED-005 | cross-shop | A+B populated | redact A | B intact | deleting B | new | same | PR7 | designed |
| PR7-RED-006 | Restrict Shop FK | children remain | delete Shop too early | fail; shop not removed until children gone | orphan | new | same | PR7 | designed |
| PR7-RED-007 | D-PR7-11 | children gone | completion | receipt with domain **hash**; domain not stored cleartext **or** documented tombstone | cleartext domain in receipt if hash option chosen | new | receipt test | PR7 | designed |
| PR7-RED-008 | R-164 vs privacy | tombstoned catalog row | shop/redact | physical delete allowed **in privacy module** | calling C apply delete | new | redact uses TenantDb/control-plane not apply | PR7 | designed |
| PR7-RED-009 | Redis | BullMQ job envelope shop A | redact | job removed or worker fail-closed | other shops’ jobs removed | new | redis cleanup | PR7 | designed |
| PR7-RED-010 | H scratch if base has D | leftover `att-*` for A | redact | dispose authentic handles; probe fails if leftover bytes remain | `unlink` of unowned symlink | new | scratch cleanup | PR7 | designed |
| PR7-RED-011 | H job types if present | `order-facts-sync` jobs | redact | included in cancel+delete | ignored stranded import | new | same | PR7 | designed |
| PR7-RED-012 | backups | restore after redact | **out of repo tests**; staging | documented cannot un-erase | claiming backup covered | skip reason §8 | staging | later | designed skip |
| PR7-RED-013 | manifest PII | after redact | read manifest | FXT-MANIFEST-NO-PII | email in JSON | new | manifest test | PR7 | designed |
| PR7-RED-014 | success audit | PARTIAL_FAILED | no `PRIVACY_COMPLETED` | completed event | new | audit | PR7 | designed |

### 6.7 Customer data_request / redact

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-CUST-001 | empty store | no customer fields on A | data_request FXT | COMPLETED empty export; manifest skipped_absent | inventing customer PII | new | customers-data-request.test.ts | PR7 | designed |
| PR7-CUST-002 | order GID map | optional `ShopifyOrderFact` gid `gid://shopify/Order/299938` **without** customer fields | data_request | may include **operational** order fact in owner export **only if** ChatGPT confirms (default **PROPOSED:** include gid+units, still no email) | adding email | new | same | PR7 | designed |
| PR7-CUST-003 | Session staff email | Session.email owner | customers/redact john@example.test | **do not** delete staff session because Shopify customer email ≠ staff | wiping shop sessions | new | customers-redact.test.ts | PR7 | designed |
| PR7-CUST-004 | supplier contact | Supplier.contactEmail=john@example.test | customers/redact | **PROPOSED default: do not treat supplier contacts as Shopify customer redact** (different data class) | silent supplier wipe | new | same; **D-PR7 extra if ChatGPT disagrees** | PR7 | designed |
| PR7-CUST-005 | customers/redact empty | no matches | COMPLETED skipped_absent | shop-wide delete | new | same | PR7 | designed |
| PR7-CUST-006 | D-PR7-14 | data_request complete | owner download | `shop_owner`/`shop_admin` with export perm; TTL | auditor or Shop B | new | export route | PR7 | designed |
| PR7-CUST-007 | sanitizer regression | orders/create with email | durable projection | no email property | persist email | existing | `"strips PII from orders/create and keeps money strings"` | PR4 | **executed-on-V** this run |
| PR7-CUST-008 | GraphQL denylist | document with `customer { id }` | reject | network | existing | `mutation-safety.test.ts` `"rejects Order.cancellation and customer PII fields"` | PR6-B | **executed-on-V** this run |

### 6.8 Side channels and isolation

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-SIDE-001 | dual-role | privacy worker | merchant delete + control-plane delete | separate txns; checkpoint not leading | one txn both roles | new | privacy worker | PR7 | designed |
| PR7-SIDE-002 | shared Redis | two shops | redact A | B jobs remain | FLUSHALL | new | redis | PR7 | designed |
| PR7-SIDE-003 | pooled PG | privacy job A then B | no leftover `stocky.current_shop_id` | B seeing A | new | privacy-surfaces.test.ts | PR7 | designed |
| PR7-SIDE-004 | missing envelope | worker | deny before merchant access | query | new | same | PR7 | designed |
| PR7-SIDE-005 | foreign envelope | A envelope on B rows | deny | cross-shop delete | new | same | PR7 | designed |
| PR7-ISO-001 | replace deferral | current worker-surfaces | add privacy path tests | still honest about export/reconciliation deferral | renaming only | new + edit worker-surfaces comment | db-isolation | PR7 | designed |
| PR7-ISO-002 | raw SQL | privacy connection | cannot `SET ROLE` to owner | bypass RLS | existing role-membership tests + new | enforcement | PR7 | designed |
| PR7-ISO-003 | bootstrap | privacy code | must not live in `bootstrap.server.ts` | merchant delete in bootstrap | architecture-audit | PR7 | designed |

### 6.9 Commands / CI

| ID | Req | Pre-state | Action | Expected | Forbidden | Evidence | Home | Owner | Now |
|---|---|---|---|---|---|---|---|---|---|
| PR7-CI-001 | brief command | package.json | `npm run test:privacy` | script exists; nonzero tests; fail on zero collect | missing script | this run **failed** as expected | package.json | PR7 runtime | **executed-on-V** absence (exit 1) |
| PR7-CI-002 | CI policy | docs-only this planning PR | classify | `docs_only=true` | full_ci for two docs files | classifier after land | classify script | this planning PR | designed → execute on push |
| PR7-CI-003 | runtime PR | implementation diff | classify | `full_ci=true`; heavy includes privacy | docs-only on schema change | CI | workflow | PR7 runtime | designed |

---

## 7. Mapping to current V tests (do not relabel as PR7 complete)

| Current test | What it actually proves | What it does **not** prove |
|---|---|---|
| `sync-control-plane.test.ts` sanitizer (11 tests, this run PASS) | PR4 projection allowlists; unsupported topics throw | compliance processors |
| `mutation-safety.test.ts` (6 tests, this run PASS) | B GraphQL cannot select customer PII fields | redaction of stored rows |
| `foundation-safety.test.ts` (4 tests, this run PASS) | inventory-write flags default OFF | RBAC |
| `shop-domain.test.ts` (10 tests, this run PASS) | domain normalization | actor identity |
| `sync-uninstall.test.ts` | disable+cancel | session count; REDACTED; shop/redact |
| `worker-surfaces.test.ts` | job envelope isolation; **defers** privacy | privacy jobs |
| `authority.test.ts` | shop tenant | staff roles |

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
| Enabling `useOnlineTokens` | D-PR7-02 | proving actor id somehow |

---

## 9. Cross-check against the execution plan

| Matrix group | Plan anchors |
|---|---|
| PR7-ACT-* | §7.1, D-PR7-01/02/04 |
| PR7-RBAC-* | §7.2, D-PR7-07/12 |
| PR7-AUD-* | §7.3, D-PR7-03/08 |
| PR7-LIFE-* | §4.5, D-PR7-05/06 |
| PR7-PRIV-* | §7.4 |
| PR7-RED-* | §7.5–7.6, D-PR7-10/11/13 |
| PR7-CUST-* | §3 OFFICIAL payloads, D-PR7-14 |
| PR7-SIDE-* / ISO-* | §7.7–7.9 |
| PR7-CI-* | §10, CI_POLICY |

Every plan decision that can fail a merchant-safety test has at least one matrix row. **D-PR7-09** pause switch → PR7-PRIV-006. **D-PR7-14** download → PR7-CUST-006.

---

## 10. Evidence recorded in this planning environment

| Command | Exit | Tests | SHA |
|---|---|---|---|
| `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-control-plane.test.ts` | 0 | 11 passed | V `a3ff480f1477237f8055f10c43298480a05728a1` |
| `npx vitest run app/lib/order-facts/admin-read/mutation-safety.test.ts app/lib/order-facts/foundation-safety.test.ts` | 0 | 10 passed | V |
| `npx vitest run app/lib/shop-domain.test.ts` | 0 | 10 passed | V |
| `npm run test:privacy` | 1 | n/a missing script | V |
| `npm run test:sync-uninstall` | **not executed** | — | Postgres/Redis TCP refused |
| `npm run test:tenant-access` | **not executed** | — | same |
| `npm run test:db-isolation` | **not executed** | — | same |

Those last three remain **BLOCKED**, not failed-as-product.
