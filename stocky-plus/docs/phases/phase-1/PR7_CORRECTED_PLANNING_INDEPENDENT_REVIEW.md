# Phase 1 PR7 — Independent planning review of the corrected PR45 packet

**Document type:** Independent Tier-A planning review (review authority only)
**Reviewer:** Claude Code (independent)
**Review date:** 2026-09-17
**Authority:** [PR45 comment 5713531939](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5713531939)
**Correction authority (read, not re-issued):** [PR45 comment 5713121021](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5713121021)
**Reviewed artifacts:** both full PR45 documents at the exact subject, plus the original-to-corrected diff, not Cursor’s correction summary alone
**Review posture:** one pass; planning review only; no implementation, no PR43 writer, no mark-ready, no merge

This review does **not** accept the execution plan. It does **not** authorize PR7 runtime, migrations, grants, Shopify configuration, production, inventory writes, flag enablement, or D-055. It does **not** close R-176, R-164, R-005, or Q-008. D-054 remains the implementation-authority heading.

**VERDICT: CORRECTIONS REQUIRED**

P7-C01…06 are directionally applied, but the corrected packet still contains **two P0** and **five P1** planning defects. Remaining D-PR7 items are still owner decisions. No runtime, merge, or production authorization follows.

---

## 0. Executive summary

The correction packet is a real architecture pass, not a label restatement. First-login owner bootstrap is withdrawn. Ordinary audit stays append-only. `shopDomainHmac` is no longer claimed anonymous. Timestamp-only `SUPERSEDED` is withdrawn. Human jobs are split from autonomous privacy/sync. Customer lookup keys are required. Evidence labels no longer treat blocked Postgres suites as executed-on-V. D-PR7-01…14 IDs are preserved. Those are the right constraints.

They are not yet an executable contract.

Against merged V `a3ff480f1477237f8055f10c43298480a05728a1`, the designed `shop/redact` path cannot both disable the shop and physically delete tenant-linked rows, and it cannot tell a new erasure apart from an old completion using domain HMAC. Until those contracts are rewritten, ChatGPT should not accept the packet as PR7 execution authority.

Independent review of the seven mandated source targets:

| Target | Result |
|---|---|
| 1. Owner / actor precision | P7-C01 rejects first-login. Residual **P1**: owner-proof still stringifies library `associated_user.id: number`. |
| 2. Distinct privacy requests vs redelivery | **P0**: domain + body HMAC / receipt HMAC cannot identify a generation. |
| 3. Erasure sequencing, FK, permissions | **P0** RLS vs disable-then-delete; **P1** no `DELETE` on `Shop`; **P1** receipt-before-residual. |
| 4. Privacy authority while disabled | **P0** (same RLS root); **P1** DurableJob intake/dispatch/fair-claim/strategy omitted from ownership. |
| 5. Human-job revocation | Intent of P7-C04 is present. Residual **P1**: “same unit of work” vs two-role prohibition. |
| 6. Owner-only fulfillment vs admin export | **P2** plan/matrix contradiction. Lookup-key half of P7-C05 is sound. |
| 7. Executable feasibility | Exclusive-file list cannot land the while-disabled path. Operator `ESCALATED` path is unnamed (**P2**). |

---

## 1. Reviewed identity and provenance

| Field | Value | Verification |
|---|---|---|
| Repository | `Vedang1998/Stocky` | `gh pr view 45` |
| Application | `stocky-plus/` | — |
| Reviewed PR | [#45](https://github.com/Vedang1998/Stocky/pull/45) | OPEN, **DRAFT**, **not merged**, `mergeable: MERGEABLE` |
| Subject branch | `cursor/planning-pr7-audit-roles-privacy-20260916-63ef` | PR `headRefName` |
| Exact subject | `f1b0364049e04baec1f1f68b61f0074677161d00` | `git rev-parse HEAD` at review start; PR `headRefOid` |
| Exact base **V** | `a3ff480f1477237f8055f10c43298480a05728a1` | `git rev-parse origin/main`; PR `baseRefOid`; `git merge-base --is-ancestor` succeeded |
| Original planning commit | `4158254cba4800ceec112579ca842ee69f47c882` | `git log V..subject` |
| Correction commit | `f1b0364049e04baec1f1f68b61f0074677161d00` | sole child of `4158254…` |
| Commits on PR | 2; zero behind V | `gh pr view 45 --json commits` |
| Diff vs V | **exactly two added docs** | PR `files` |
| Pinned D candidate **H** (dated, unmerged) | `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` | live PR [#43](https://github.com/Vedang1998/Stocky/pull/43) head still equal at this review; **not** merged authority |
| Review branch | `claude/pr45-pr7-corrected-planning-review` | rooted at subject; sole parent of this commit must be `f1b0364…` |
| PR45 modified by this review | **No** | planning files not edited |
| Runtime / schema / grants / CI / package / PR43 | **not modified** | — |
| D-054 | **EFFECTIVE**; **no D-055** | `PROJECT_STATUS.md`, `DECISIONS.md` |
| R-176 | remains **OPEN / P0** | `RISK_REGISTER.md` |
| R-164 | unchanged (physical DELETE remains a privacy exception, not C apply) | same |
| Q-008 | remains **OPEN** | `OPEN_QUESTIONS.md` |
| Shopify Admin API pin | `2026-07` (`ApiVersion.July26`) | `shopify.app.toml`, `app/shopify.server.ts` |

Changed paths on PR45 (complete):

```text
stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md
stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md
```

This review adds **one** file on the review branch:

```text
stocky-plus/docs/phases/phase-1/PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md
```

Live shared-control files on V (`PROJECT_STATUS.md`, phase-1 `README.md`) still describe an earlier PR6-B/C / **T** state. That staleness is **FACT (V)** and is not a PR45 defect (the packet correctly refuses to edit those files).

### 1.1 Exact-head docs CI (PR45 subject)

Independent retrieval of run [`35213946582`](https://github.com/Vedang1998/Stocky/actions/runs/35213946582):

| Field | Observed | Expected | Result |
|---|---|---|---|
| `event` | `pull_request` | `pull_request` | **PASS** |
| `head_sha` | `f1b0364049e04baec1f1f68b61f0074677161d00` | exact subject | **PASS** |
| Run conclusion | `success` | — | **PASS** |
| Classify `105177830314` | **SUCCESS** | SUCCESS | **PASS** |
| Heavy `105177868457` | **SKIPPED** | SKIPPED for docs-only | **PASS** |
| CI Gate `105177867762` | **SUCCESS** | SUCCESS | **PASS** |

This is documentation-integrity evidence under `CI_POLICY.md`. It is **not** implementation, security, or privacy-processor acceptance.

Local classifier self-test in this review environment: `.github/scripts/classify-ci-change-set.test.sh` → **40 assertions, 40 pass, 0 fail**. That proves the classifier script still behaves; it is **not** a substitute for run `35213946582`.

### 1.2 Original-to-corrected diff (adjudication basis)

```text
git diff --stat 4158254cba4800ceec112579ca842ee69f47c882 f1b0364049e04baec1f1f68b61f0074677161d00
  PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md | 273 +++++++++------
  PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md    | 384 ++++++++++++++-------
  2 files changed, 433 insertions(+), 224 deletions(-)
```

Material correction moves that **did** land: P7-C01…06 crosswalk; owner-proof table; generation/`ESCALATED` matrix; privacy-erasure DELETE vs in-place UPDATE; identifiable HMAC; human vs autonomous revocation timeline; `verified_privacy_job`; lookup-key sufficiency; Now-column relabel; §10 no V-only base and no unresolved P0/P1/**P2**.

Material gaps that **did not** land are the findings below.

---

## 2. Evidence classification for this review

| Class | Meaning | This review |
|---|---|---|
| **FACT (V)** | Read or executed against `a3ff480…` | Source reads, library types, unit tests listed in §2.1 |
| **FACT (library)** | Installed types / adapter under `stocky-plus/node_modules` at V | `OnlineAccessUser.id: number`; Prisma session adapter |
| **OFFICIAL** | Shopify documentation fetched **2026-09-17** | §3 |
| **Executed this review** | Command ran here | §2.1 |
| **Present-on-V-not-executed** | Suite exists; Postgres/Redis down | uninstall / tenant-access / db-isolation / RLS live probe |
| **Designed fixture** | Matrix row / synthetic JSON | **not** a passing processor |
| **PROVISIONAL (H)** | Unmerged PR43 `4768033b…` | dated snapshot only |
| **Inference** | Reviewer conclusion from facts | labelled in findings |

Designed fixtures and Cursor’s planning-session unit runs are **not** treated as PR7 processor evidence.

### 2.1 Executed this review

| Command | Exit | Notes | SHA |
|---|---|---|---|
| `git rev-parse HEAD` / `origin/main` | 0 | subject = `f1b0364…`; V = `a3ff480…` | subject |
| `git merge-base --is-ancestor V subject` | 0 | ancestor_ok | — |
| `gh pr view 45` / `gh pr view 43` | 0 | PR45 draft; PR43 still exactly H | — |
| `gh api …/actions/runs/35213946582` | 0 | exact-head docs CI SUCCESS | `f1b0364…` |
| `node -e` IEEE-754 probe | 0 | `Number(9007199254740993) === 9007199254740992` | V Node `v22.14.0` |
| `npm run test:privacy` (cwd `stocky-plus/`) | **1** | `Missing script: "test:privacy"` | V |
| `npx vitest run app/lib/shop-domain.test.ts app/lib/order-facts/admin-read/mutation-safety.test.ts app/lib/order-facts/foundation-safety.test.ts` | 0 | **20 passed** / 3 files | V |
| `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-exactly-once.test.ts -t 'unknown job type fails closed'` | **1** | Postgres `localhost:5432` unreachable; ci-guard refused vacuous success | V |
| `.github/scripts/classify-ci-change-set.test.sh` | 0 | 40/40 | V |
| Official page fetches | 0 | §3 | access date **2026-09-17** |

### 2.2 Not executed (blocked or out of scope)

| Check | Reason |
|---|---|
| `npm run test:sync-uninstall` | Postgres/Redis TCP not listening; docker not installed |
| `npm run test:tenant-access` | same |
| `npm run test:db-isolation` | same |
| Live RLS DELETE-while-disabled probe | same — **source** of `rlsPoliciesSql` was read instead |
| `authenticate.admin` field population with `useOnlineTokens` false | would require app token/config change; **forbidden** |
| Partner/store HMAC, production data, million-line D scratch | forbidden |
| PR43 implementation review | forbidden; H treated as dated unmerged snapshot |

Historical counts in older implementation reports are **not** this review’s evidence.

---

## 3. Official Shopify re-verification (2026-09-17)

No store calls. Primary pages fetched this review:

- [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens)
- [Authenticate admin](https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin)
- [Changelog: customer data erasure, 2026-03-23](https://shopify.dev/changelog/updated-handling-of-customer-data-erasure-requests-with-recent-orders)

### 3.1 Packet claims that remain TRUE

| Packet claim | Independent result |
|---|---|
| Public apps must handle `customers/data_request`, `customers/redact`, `shop/redact` | **TRUE** |
| Invalid HMAC → 401; ack is 200-class | **TRUE** |
| Complete action within 30 days unless legally required to retain | **TRUE**; page is not legal advice |
| `shop/redact` body is `shop_id` + `shop_domain`; 48 hours after uninstall | **TRUE**; **no** installation-generation field |
| `customers/data_request` is fulfilled **to the store owner directly** | **TRUE** |
| Offline tokens are default; online tokens optional, 24h or admin logout, carry `associated_user` including `account_owner` | **TRUE** |
| ID token authenticates the user and carries **no** permissions | **TRUE** |
| Authenticate/admin `sessionToken.sub` examples set `useOnlineTokens: true` in companion `shopify.server.ts` | **TRUE** |
| `OnlineAccessUser.id` is typed `number` in `@shopify/shopify-api` and in authenticate/admin docs | **TRUE** |
| Privacy TOML **example** uses `api_version = "2024-07"`; repo pin is `2026-07` | **TRUE**; example version is not this repository’s pin |
| Official page does **not** document a timestamp-only reinstall exception | **TRUE** |

### 3.2 Official-source conflict (not a processor P0)

The still-published privacy-law-compliance page says `customers/redact` is sent ~10 days after request if no order in six months, otherwise withheld until six months. The **2026-03-23** changelog says erasure requests are processed 10 days after submission regardless of recent orders (gift-card delivery exception).

The packet quotes the compliance page, which is still live on **2026-09-17**. Processors must act when a webhook **arrives**, so this conflict does not by itself block planning — but the packet’s “OFFICIAL” six-month timing note is **not uniquely current**. See **F-CLAUDE-PR7CP-10** (P3).

**UNVERIFIED** (packet already says so; this review agrees): whether Shopify still delivers `shop/redact` after reinstall inside 48 hours; whether `X-Shopify-Webhook-Id` is present on compliance deliveries; whether `sessionToken.sub` is populated when `useOnlineTokens` is false (V’s config).

---

## 4. P7-C01…06 dispositions

Dispositions are against the **corrected packet + V source**, not against Cursor’s summary.

| ID | ChatGPT constraint | Packet response | Disposition | Residual |
|---|---|---|---|---|
| **P7-C01** | Reject first-login / `sub` / installer owner bootstrap; require same-shop `associated_user.account_owner` or a separately approved flow | First staff/collaborator/`sub` → `unassigned` + `owner_assignment_pending`; owner only from verified online `account_owner` | **PARTIALLY SATISFIED** | **F-CLAUDE-PR7CP-05** (P1) numeric id |
| **P7-C02** | Append-only runtime audit; restricted erasure DELETE; separate identifiable receipt; no in-place UPDATE; Q-008 open | `stocky_privacy_erasure` DELETE; receipt has no Shop FK; HMAC labelled identifiable | **PARTIALLY SATISFIED** | **F-CLAUDE-PR7CP-02** (P0), **03** (P1), **04** (P1) |
| **P7-C03** | No timestamp-only `SUPERSEDED`; generation binding; `ESCALATED`; no permanent domain blacklist | `ShopInstallGeneration` + state table; withdrawn timestamp rule; new Shop after completed erasure | **PARTIALLY SATISFIED** | **F-CLAUDE-PR7CP-01** (P0), **F-CLAUDE-PR7CP-09** (P2) |
| **P7-C04** | Human replay/export/role revalidate at execution; no system conversion | Split matrix + revocation timeline + `actorKind=human` | **PARTIALLY SATISFIED** | **F-CLAUDE-PR7CP-06** (P1) |
| **P7-C05** | Privacy work while disabled without re-enabling or bypassing isolation; durable lookup keys; empty only after complete scan | Lookup keys + complete-scan fixtures are sound. `verified_privacy_job` + “same shop RLS” is **not executable** on V | **NOT SATISFIED as an executable contract** | **F-CLAUDE-PR7CP-02** (P0), **F-CLAUDE-PR7CP-07** (P1) |
| **P7-C06** | No V-only base; blocked suites not executed-on-V; no unresolved P0/P1/**P2** | §10 and Now-column labels corrected | **SATISFIED as a documentation correction** | Remaining owner decisions still pending (intended) |

P7-C06’s own acceptance bar (“no unresolved P0/P1/P2”) is **not** met by this packet. That is why the verdict is **CORRECTIONS REQUIRED**, not owner-decisions-only.

---

## 5. Findings

### F-CLAUDE-PR7CP-01 — P0 — `shop/redact` generation identity collapses onto domain HMAC

**File / locus:** plan §7.4 idempotency key; §7.6 binding table rows “Duplicate delivery”, “Delayed delivery; old generation already `erasedAt`; new Shop exists”, “No Shop row; matching completion receipt HMAC”; matrix `PR7-LIFE-011`, `PR7-LIFE-012`.

**Evidence:**

- **OFFICIAL:** `shop/redact` JSON is only `shop_id` + `shop_domain`. There is no generation field. Same merchant therefore yields the **same body** on every later `shop/redact`.
- **PROPOSED** key `privacy:shop_redact:{canonicalDomain}:{hmacOfRawBody}` is a function of that body. It is stable across install generations.
- `PrivacyCompletionReceipt.shopDomainHmac` is HMAC of the canonical domain (plan §7.3). It is also generation-free.
- PR4 `WebhookDelivery` uniqueness is `(shopId, shopifyWebhookId) WHERE shopifyWebhookId IS NOT NULL` (`prisma/migrations/20260804210000_sync_control_plane_correction/migration.sql`). That collapses **the same delivery** for **one Shop.id**. It does **not** distinguish two deliveries of an identical body after `Shop` is deleted and a new `Shop.id` is created.
- Mandate target 2: “neither domain nor old receipt alone proves which generation a delivery targets.”

**Reproduction (planning walk-through, not a runtime test):**

1. Gen1 uninstall → `shop/redact` → complete → receipt HMAC(domain) → `Shop` deleted → `erasedAt` set.
2. Gen2 installs (new `Shop`, unique `myshopifyDomain` free because the old row is gone — **FACT (V)** `Shop.myshopifyDomain @unique`).
3. Gen2 uninstalls (`processingEnabled=false`, `UNINSTALLED`).
4. New authenticated `shop/redact` arrives with the **same body**.
5. Evaluate §7.6: “old generation already `erasedAt`; new Shop exists” → **treat as duplicate completion of the old generation; do not erase the new shop**.

That row does **not** require `processingEnabled=true`. An uninstalled gen2 `Shop` still “exists.” `PR7-LIFE-011` encodes the live-shop delayed-delivery case as expected success of that classifier. The gen2-uninstalled case has **no distinguishing evidence** in the table.

**Merchant impact:** a later installation’s mandatory `shop/redact` can be ack’d as already complete. Gen2 operational data remains. That is incomplete erasure (R-005 / R-030 / D-021), not a docs nit.

**Expected behavior:** duplicate detection uses Shopify **delivery identity** (header webhook id, if present) or an app-owned **generation id** recorded at uninstall. A previous completion / domain HMAC **must not** certify a new erasure. If attribution is ambiguous **and** an uninstalled, not-erased generation exists, bind to **that** generation and erase it; if a live enabled shop exists, `ESCALATED`; never “HMAC match ⇒ skip.”

**Recommended correction:**

1. Drop body-HMAC as the `shop/redact` **work** key. Use `privacy:shop_redact:{canonicalDomain}:{generationId}` plus a separate duplicate key `privacy:shop_redact:delivery:{shopifyWebhookId}` (fail closed if webhook id missing: durable `RECEIVED` + `ESCALATED` / quarantine, do not invent a generation).
2. Rewrite the state table so “matching receipt HMAC” is **never** a terminal-complete oracle while any generation for that domain is uninstalled and not erased.
3. Add matrix rows: gen1 complete + gen2 uninstalled + new `shop/redact` **must erase gen2**; same-delivery retry **must not**; delayed gen1 delivery while gen2 is **enabled** stays `ESCALATED` or old-complete **only** with recorded generation evidence, not HMAC alone.

**Missing test:** `PR7-LIFE-011` as written can pass the unsafe classifier. Replace it with the three-row set above, including a bypass that presents an old receipt HMAC and a new webhook id.

---

### F-CLAUDE-PR7CP-02 — P0 — disable-then-delete is physically denied by V merchant RLS

**File / locus:** plan §7.6 step 1 then steps 4–5 and 8; §7.3 / §7.7 “same shop RLS **on**”; P7-C05 `verified_privacy_job`; `scripts/tenant-enforcement/sql.ts` `rlsPoliciesSql`; `app/sync/intake.server.ts`; `app/sync/dispatcher.server.ts`; `app/sync/fair-claim-query.server.ts`.

**Evidence (FACT V):**

Merchant RLS predicate (every SELECT/INSERT/UPDATE/DELETE policy generated for `stocky_runtime`):

```100:126:stocky-plus/scripts/tenant-enforcement/sql.ts
  const pred = `${quoteIdent("shopId")} IS NOT NULL AND ${quoteIdent("shopId")} = ${TENANT_CONTEXT_HELPER_FN}() AND ${TENANT_CONTEXT_VERSION_FN}() = '${ENFORCEMENT_CONTEXT_VERSION}' AND stocky_shop_processing_enabled(${quoteIdent("shopId")})`;
  // ...
CREATE POLICY ... FOR DELETE TO ${role}
  USING (${pred});
```

`stocky_shop_processing_enabled` is `COALESCE(Shop.processingEnabled, false)` — **not** role-sensitive.

§7.6 step 1 sets `processingEnabled=false`, `REDACTED`, **then** steps 4–5 physically DELETE merchant rows and step 8 DELETE `AuditEvent`. §7.3 requires the privacy-erasure role to use **the same shop RLS**. Under the V template that DELETE returns **0 rows**, and INSERT of `PRIVACY_CHECKPOINT` `AuditEvent` (merchant-domain, RLS) also fails.

P7-C05 forbids re-enabling the shop and forbids disabling RLS. Application helper `assertPrivacyErasureJob` **instead of** `assertProcessingEnabled` does not change PostgreSQL policies.

Live DELETE-while-disabled was **not** executed (Postgres down). The finding is from the **policy SQL generator**, which is the enforcement source of truth, plus the packet’s own step order.

Related V gates (same `processingEnabled=false` world, 48h after uninstall — **OFFICIAL** `shop/redact` timing):

- `ingestAuthenticatedWebhook` denies durable job creation unless topic is `app/uninstalled`.
- Dispatcher `if (!shop || !shop.processingEnabled)` fails the dispatch.
- Fair-claim `WHERE r."processingEnabled" = true`.

**Merchant impact:** following the packet as written, `shop/redact` can persist `RECEIVED`, ack 200, set `REDACTED`, and then be unable to erase tenant data. 30-day Shopify clock still runs.

**Expected behavior:** freeze an explicit dual-policy contract:

- `stocky_runtime`: keep today’s predicate including `stocky_shop_processing_enabled`.
- `stocky_privacy_erasure`: `USING` / `WITH CHECK` = tenant shopId + context version **only** (no processingEnabled gate); FORCE RLS still on; no `BYPASSRLS`; no `SET ROLE` to migration.
- Ordinary intake/dispatcher/fair-claim remain denied when disabled.
- Privacy execution does **not** go through those gates as they exist today unless those files are listed and given a **narrow** `privacy:*` exception (see F-CLAUDE-PR7CP-07).

**Recommended correction:** make the policy split a constrained D-PR7-13 requirement, with red/green tests: runtime DELETE while disabled = 0 rows; privacy-erasure DELETE while disabled = shop A only; privacy-erasure SELECT shop B = 0 rows; `DISABLE RLS` denied.

**Missing test:** `PR7-PRIV-014` / `PR7-AUD-011` currently assume the capability exists; they do not assert the **policy** difference vs runtime.

---

### F-CLAUDE-PR7CP-03 — P1 — no role specified (or existing) may `DELETE` `Shop`

**File / locus:** plan §7.6 step 8 “DELETE `Shop`”; §7.7 privilege matrix “Shop processing flags”; `scripts/tenant-enforcement/manifest.ts` `BOOTSTRAP_TABLES` for `Shop`; `scripts/sync-control-plane/roles.ts`.

**Evidence (FACT V):**

- Runtime expected privileges on `Shop`: `SELECT, INSERT, UPDATE` — **not** `DELETE` (`manifest.ts` bootstrap spec).
- Control-plane: `REVOKE ALL` then column-level `SELECT`/`UPDATE` on lifecycle columns; comment “No broad Shop.* grant.” No `DELETE`.
- Packet: `stocky_privacy_erasure` → Shop processing flags **none**; `stocky_migration` → DDL/repair only; “never SET ROLE to migration.”

§7.6 step 8 nevertheless requires `DELETE Shop`. Matrix exit criteria and `PR7-RED-001` require “Shop gone.”

`ShopInstallGeneration.shopRowIdNullable` is proposed to survive `Shop` delete, but `onDelete` is **unspecified**. If the FK is `Restrict` (V default for `Shop` children), step 8 cannot both keep the generation row and delete `Shop`.

**Merchant impact:** residual probe “no `Shop` row” is unimplementable; unique `myshopifyDomain` then either blocks a fresh install (REDACTED row remains) or the packet’s LIFE-013 path is a fiction.

**Expected behavior:** name the role that may `DELETE FROM "Shop"`; grant only that statement, shop-keyed, after children are gone; set `ShopInstallGeneration.shopRowId` `ON DELETE SET NULL`; forbid migration-role use.

**Missing test:** grant catalog assertion that runtime and control-plane still cannot `DELETE Shop`; privacy-erasure (or the named role) can delete **only** after residual children/audit are gone; Restrict failure when a child remains (`PR7-RED-006` exists for children, not for the Shop grant itself).

---

### F-CLAUDE-PR7CP-04 — P1 — success receipt is written, and the coordinator is deleted, before residual verification

**File / locus:** plan §7.6 step 8–9; mandate target 3; matrix `PR7-RED-007`, `PR7-RED-015`.

**Evidence:** step 8 order is: DELETE tenant-linked `AuditEvent` → copy digest → **INSERT `PrivacyCompletionReceipt`** → **DELETE manifest/request** → set `erasedAt` → DELETE `Shop`. Step 9 residual probe is **after** that. Combined with F-CLAUDE-PR7CP-01, a crash after INSERT receipt and before Shop/child cleanup matches “matching completion receipt HMAC → idempotent COMPLETED.”

Control-plane and privacy-erasure are **separate** connections (“Never one transaction across roles”). There is no atomic commit covering receipt + Shop delete.

**Merchant impact:** operators and delayed webhooks can treat a receipt as proof of emptiness while `Shop`, facts, or jobs remain. Forward recovery loses the `PrivacyRequest` cursor.

**Expected behavior:**

1. Keep `PrivacyRequest` + manifest until residual probe is empty.
2. INSERT receipt only after that probe, in the control-plane connection, then delete coordinator rows.
3. Define crash windows: receipt exists + remnants → **resume**, never terminal complete; receipt exists + probe empty → idempotent complete.

**Missing test:** kill after receipt insert / before Shop delete; retry must **not** skip remnants (`PR7-LIFE-014` is close but does not mention a receipt already present).

---

### F-CLAUDE-PR7CP-05 — P1 — owner-proof / actor canonicalization still uses a lossy `number` user id

**File / locus:** plan §7.1 steps 2–3 and owner-proof table; matrix `PR7-ACT-018` / FXT-USERS `wideId`; **FACT (library)** `OnlineAccessUser.id: number`; Prisma session adapter.

**Evidence:**

This review’s Node probe (`v22.14.0`):

```text
Number(9007199254740993) === 9007199254740992  // true
String(Number("9007199254740993")) === "9007199254740992"
```

Plan: take `session.onlineAccessInfo.associated_user.id` first, then “canonicalize as an exact decimal string (no IEEE-754 `Number()` coercion).” Mandate: “A decimal stringification cannot recover precision already lost before conversion.”

**FACT (library):** `@shopify/shopify-app-session-storage-prisma` writes

```178:180:stocky-plus/node_modules/@shopify/shopify-app-session-storage-prisma/src/prisma.ts
      userId:
        (sessionParams.onlineAccessInfo?.associated_user
          .id as unknown as bigint) || null,
```

The `as bigint` is a TypeScript assertion. At runtime the value is still the JSON `number`. `Session.userId` being Prisma `BigInt` does **not** restore digits the library already rounded. App code on V never reads `session.userId` / `onlineAccessInfo` / `sessionToken.sub` (**FACT V** `requireAdminTenant`).

**UNVERIFIED at runtime (cannot be proven without token-config change):** whether `sessionToken.sub` exists when `useOnlineTokens` is false. Official authenticate/admin examples that read `sessionToken.sub` set `useOnlineTokens: true`.

**Merchant impact:** a wide Shopify user id stored from `associated_user.id` can collide or fail owner-proof equality. `PR7-ACT-018` cannot pass on the recommended owner-proof path.

**Expected behavior:** persist `shopifyUserId` only from a **digit string** (`sessionToken.sub` if present and `^[0-9]+$`, else fail closed for owner grant). Use `associated_user.account_owner` **only** as a boolean on the same online session. Never `String(associated_user.id)` and never `Session.userId` sourced from that number as the canonical key. Prove with a fixture that a rounded number is **rejected**, not stored.

**Missing test:** ACT-018 must fail the implementation if it stringifies `associated_user.id`; add a negative test `Number(wideId)` compared equal to `wideId` string → deny.

---

### F-CLAUDE-PR7CP-06 — P1 — human-job “same unit of work” revalidation asserts impossible two-role atomicity

**File / locus:** plan §7.1 / §7.2 revocation table “Before commit (last safe boundary) … Re-check permission inside the same unit of work”; §7.7 “Never one transaction across roles”; `app/sync/replay.server.ts` `replayDeadLetter`.

**Evidence (FACT V):** `replayDeadLetter({ deadLetterId, shopId, reason })` has **no actor**. The protected effect is a **control-plane** transaction: create `PENDING` `DurableJob`, `JobReplay`, mark `DeadLetter` `REPLAYED`. It already denies disabled shops. Staff assignments are proposed as **merchant-domain** rows (`stocky_runtime`).

The packet forbids one transaction across roles **and** requires a permission re-check inside the same unit of work as the replay commit. Those cannot both be true.

**Merchant impact:** a revoked admin can still win the TOCTOU window (false success), or a retry after a committed replay is labelled failure while the new job exists (false failure). Matrix `PR7-RBAC-015` (“abort txn”) names an atomicity that V cannot provide as specified.

**Expected behavior:** freeze the protected effect as **enqueue of the new DurableJob inside `replayDeadLetter`**. Revalidate on the runtime connection **immediately before** opening the control-plane transaction (best-effort; document TOCTOU). Do **not** claim intra-transaction abort across roles. After commit, revocation does not undo; retry re-checks and denies. The eventual webhook apply is a **separate** autonomous job and must not be described as the human-permissioned effect (otherwise every later apply would need a staff grant — contradicting P7-C04 autonomous split).

**Missing test:** split RBAC-015 into (a) revoke before control-plane txn begins → no new job; (b) revoke after commit → job remains, retry denied; (c) no test may assert a two-role serializable abort.

---

### F-CLAUDE-PR7CP-07 — P1 — exclusive-file list cannot implement privacy jobs while the shop is disabled

**File / locus:** plan §7.9 owned/shared lists; §7.6 “privacy jobs on the existing webhook queue after D merge”; `app/sync/execution-strategy.server.ts`; intake/dispatcher/fair-claim as in F-CLAUDE-PR7CP-02.

**Evidence (FACT V):**

```41:70:stocky-plus/app/sync/execution-strategy.server.ts
export function executionStrategyForJobType(jobType: string): ExecutionStrategy {
  if (jobType.startsWith("webhook:")) { /* atomic topics, uninstall, bulk finish */ }
  switch (jobType) {
    case "catalog-sync": /* ... */
    default:
      return "NO_AUTOMATIC_RETRY";
  }
}
```

Unknown types, including proposed `privacy:*`, fail closed as `NO_AUTOMATIC_RETRY` (dead-letter / no checkpoint retry). `WEBHOOK_ATOMIC_TOPICS` does not include compliance topics. Compliance today is a **separate** stub route, not intake:

```11:18:stocky-plus/app/routes/webhooks.compliance.tsx
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received compliance webhook ${topic} for ${shop}`);
  return new Response();
};
```

§7.9 shared edits list `after-auth.server.ts`, `shopify.server.ts`, `uninstall.server.ts`, `replay.server.ts` (none), `ci.yml`. They do **not** list `intake.server.ts`, `dispatcher.server.ts`, `fair-claim-query.server.ts`, `execution-strategy.server.ts`, `queue.server.ts`, or `feature-flags.server.ts`. D currently owns several of those on H (`sanitize.server.ts`, `queue.server.ts`, `execution-strategy.server.ts`, `intake.server.ts`).

`FEATURE_PR7_PRIVACY_PAUSE` (D-PR7-09) has no home: `app/lib/feature-flags.server.ts` is inventory-write kill switches only.

**Merchant impact:** a writer who follows §7.9 cannot enqueue or retry privacy work 48 hours after uninstall without either a competing D edit or a silent strategy default that dead-letters privacy jobs.

**Expected behavior:** either (A) privacy workers **poll `PrivacyRequest`** on the control-plane connection and never use DurableJob/fair-claim — then remove “webhook queue after D merge”; or (B) list the exact shared files and the exact `privacy:*` exceptions, after D merge, with `CONTROL_ONLY` or an explicit bounded retry strategy — not `NO_AUTOMATIC_RETRY`. Do not start a competing D writer.

**Missing test:** `executionStrategyForJobType('privacy:shop_redact')` must be an explicit strategy in the implementation PR; unknown-type fail-closed remains for other strings.

---

### F-CLAUDE-PR7CP-08 — P2 — D-PR7-14 “owner-only” contradicts the matrix and the permission table

**File / locus:** plan §9 D-PR7-14; §7.2 `platform.export.operational`; matrix `PR7-CUST-006`.

**Evidence:**

- D-PR7-14 recommended option: “Short-lived **owner-only** download (`platform.export.operational`)”.
- §7.2 grants `platform.export.operational` to **`shop_owner` and `shop_admin`**.
- `PR7-CUST-006` expected: “`shop_owner`/`shop_admin` with export perm”.

**OFFICIAL:** `customers/data_request` is provided **to the store owner directly**.

**Merchant impact:** customer-request payloads (order GIDs plus whatever is actually stored) would be downloadable by `shop_admin` under the matrix while the decision register still says owner-only. That is a product/compliance choice ChatGPT must freeze — the packet must not ship both answers.

**Expected behavior:** split capabilities:

- `platform.export.operational` — operational CSV (today’s `app.analytics_.export.tsx` class); `shop_owner` + `shop_admin` if D-PR7-07/14 say so.
- `platform.privacy.data_request.download` — **shop_owner only**, or stronger: only a **live** `associated_user.account_owner === true` session (staff impersonation of “owner role” is not Shopify account owner).

Align D-PR7-14, §7.2, and `PR7-CUST-006`. Keep Q-008 open; empty holds are not retention policy.

**Missing test:** `shop_admin` with operational export **denied** for the data_request blob; `platform_auditor` denied; shop B denied.

---

### F-CLAUDE-PR7CP-09 — P2 — `ESCALATED` has a 30-day clock and no operator interface

**File / locus:** plan §7.4 terminal states; §7.6 “Controlled resolution of `ESCALATED` (operator, with audit)”; matrix `PR7-PRIV-005`, `PR7-LIFE-008`, `PR7-RED-016`.

**Evidence:** resolution options (a)/(b) are prose. There is no named route, permission (`platform.roles.administer` is not this), evidence schema, actor, or fail-closed default beyond “never DELETE the live enabled shop.” HMAC intake is webhook-only. Support “cannot click a user into ownership” is specified; support **can** (or cannot) click `ESCALATED` → `SUPERSEDED` is not.

**Merchant impact:** ambiguous `shop/redact` after reinstall sits until day 30 with no runnable control, then becomes an incident without a defined tool. That is how timestamp `SUPERSEDED` gets reintroduced informally.

**Expected behavior:** name `platform.privacy.escalation.resolve` (owner-only), required evidence fields (generation ids, residual probe digest, decision `retain_live` | `erase_remnants_only`), audit `PRIVACY_ESCALATED` / resulting state, and a scheduler that pages before `receivedAt+30d`. Default remains fail-closed on the live shop.

**Missing test:** unauthenticated / `shop_admin` cannot resolve; missing evidence cannot `SUPERSEDED`; live shop rows unchanged.

---

### F-CLAUDE-PR7CP-10 — P3 — `customers/redact` six-month timing is not uniquely current

**File / locus:** plan §3 timing table.

**Evidence:** §3 vs changelog 2026-03-23 (§3.2). Processors that key off **arrival** are fine. Do not build a six-month wait. Relabel the timing note as “compliance page still states X; changelog states Y; **UNVERIFIED** which is operative.”

**Missing test:** none required for processors; a comment/test name is enough.

---

## 6. Cross-document contradictions (plan vs matrix)

| Topic | Plan | Matrix | Finding |
|---|---|---|---|
| Data-request download | D-PR7-14 owner-only | `PR7-CUST-006` shop_owner **and** shop_admin | F-CLAUDE-PR7CP-08 |
| Delayed `shop/redact` after completed erasure | §7.6 HMAC/old-complete | `PR7-LIFE-011` gen2 intact (live case only) | F-CLAUDE-PR7CP-01 |
| Privacy while disabled | P7-C05 + same RLS | `PR7-PRIV-014` deletes/checkpoints | F-CLAUDE-PR7CP-02 |
| Human revoke before commit | same UoW abort | `PR7-RBAC-015` abort txn | F-CLAUDE-PR7CP-06 |
| Shop gone after redact | §7.6 step 8 DELETE Shop | `PR7-RED-001` Shop gone | F-CLAUDE-PR7CP-03 |
| Wide user id | string canonicalize from `associated_user.id` number | `PR7-ACT-018` exact `9007199254740993` | F-CLAUDE-PR7CP-05 |

No silent rename of D-PR7 IDs or fixture IDs was found. P7-C06 Now-column labels (`designed` / `present-on-V-not-executed` / `executed-this-planning-session`) are consistent with this review’s Postgres outage for uninstall/tenant suites.

---

## 7. What is sound (not findings)

These are **not** approval of the packet.

- P7-C01 rejection of first staff / collaborator / installer / email / `sub` as `shop_owner`.
- Honesty that V has no staff RBAC and `TenantAuthority` is shop-only.
- Honesty that `useOnlineTokens` is unset on V and that `sub` ≠ ownership (**OFFICIAL**).
- Append-only runtime audit; no in-place “minimize” UPDATE; HMAC labelled **identifiable** (P7-C02 honesty vs D-021 “non-reversible” language — D-021 is not rewritten here, correctly).
- Physical DELETE of facts in a **privacy module**, not C apply (R-164 unchanged).
- Lookup keys as decimal strings; empty customer scan only after a complete surface pass; hash-only persistence rejected.
- `FEATURE_PR7_PRIVACY_PAUSE` does not waive the 30-day clock.
- afterAuth swallow-then-`ShopSettings` upsert / catalog enqueue on REDACTED is correctly identified as a required later fix (V `after-auth.server.ts` + `shopify.server.ts`).
- Compliance stub acks 200 without durable `RECEIVED` — correctly identified as current V, not a processor.
- No competing D writer in this planning PR; H still `4768033b…` at this review.
- Q-008 left OPEN; empty synthetic holds are not production policy.
- P7-C06: no V-only runtime base; formal PR6 closure on merged main required.

D-021 remains the approved privacy **direction**; this packet does not close it.

---

## 8. Decision-ready recommendations (D-PR7-01…14)

These are **recommendations to ChatGPT**, not silent defaults and not runtime authority. Constrained items should stay constrained after the P0/P1 holes are closed.

| ID | Status in packet | Recommendation | Alternative / tradeoff | Blocks runtime start? |
|---|---|---|---|---|
| **D-PR7-01** | proposed | Freeze actor id as digit string from `sessionToken.sub` when present; else fail closed for **platform** ops. Do not persist `String(associated_user.id)`. | If `sub` is proven absent with `useOnlineTokens: false`, platform ops stay denied until D-PR7-02. Merchandising remains `requireAdminTenant` (D-PR7-07). | **Yes** |
| **D-PR7-02** | proposed | **Enable `useOnlineTokens: true` if automated `shop_owner` grant is wanted.** Owner proof needs `associated_user.account_owner` on a verified online session (**OFFICIAL**). | Leave offline-only: `owner_assignment_pending` until a **separately approved** owner-verification flow (not designed here). Extra token class, 24h expiry, logout revoke. | **Yes** until answered |
| **D-PR7-03** | proposed | **No.** `JobReplay` / `SyncApplicationReceipt` are operational ledgers, not `AuditEvent`. | Using them as audit would fail shop/redact emptiness and immutability. | **Yes** |
| **D-PR7-04** | constrained P7-C01 | Keep: only same-shop verified `account_owner === true` for the same string user id, or a later approved flow. | Do not revive first-login. | **Yes** (already constrained) |
| **D-PR7-05** | constrained P7-C03 | Keep generation binding + `ESCALATED`. **Rewrite the classifier per F-CLAUDE-PR7CP-01** before acceptance. | Timestamp `SUPERSEDED` stays forbidden. | **Yes** |
| **D-PR7-06** | constrained P7-C03 | Keep: this generation `REDACTED` cannot revive; new Shop after completed erasure + Shop delete. Requires F-CLAUDE-PR7CP-03/04 so “Shop deleted” is real. | Permanent domain blacklist remains forbidden. | **Yes** |
| **D-PR7-07** | proposed | **No** — do not gate PO/stocktake/transfer behind the platform matrix in PR7. | Gating now would 403 merchandising for `unassigned` shops with no owner yet (P7-C01 recovery). | **No** (recommend freeze anyway so implementers do not “helpfully” gate) |
| **D-PR7-08** | constrained P7-C02 | Keep append-only + erasure DELETE + identifiable receipt. **Add the RLS policy split (F-CLAUDE-PR7CP-02).** | In-place audit UPDATE stays forbidden. | **Yes** |
| **D-PR7-09** | proposed | Accept pause switch default OFF, clock not waived. Implement the flag in `app/privacy/**`, not inventory `feature-flags.server.ts`, unless that file is listed. | Pause without F-CLAUDE-PR7CP-09 leaves ESCALATED unworkable. | Implementation detail; freeze home |
| **D-PR7-10** | proposed | Shop-scoped BullMQ remove **except** the in-flight privacy job; workers fail-closed is **complementary**, not sufficient. List `queue.server.ts` if a purge API is added; do not `FLUSHALL`. | Drain-only leaves Redis payloads until TTL. | **Yes** |
| **D-PR7-11** | constrained P7-C02 | Keep “delete `Shop` after children + tenant-linked audit.” **Name the DELETE grant (F-CLAUDE-PR7CP-03)** and receipt-after-residual (F-CLAUDE-PR7CP-04). | Leaving a REDACTED `Shop` forever contradicts LIFE-013. | **Yes** |
| **D-PR7-12** | constrained P7-C04 | Keep human vs autonomous split. **Redefine last-safe boundary per F-CLAUDE-PR7CP-06** (before control-plane txn, not two-role UoW). | Converting human jobs to `actorKind=system` stays forbidden. | **Yes** |
| **D-PR7-13** | proposed | Freeze: control-plane for request/manifest/receipt/flags; `stocky_privacy_erasure` for tenant DELETE **with RLS policies that omit processingEnabled**; never one txn; never disable RLS; never DELETE Shop from runtime. | Putting erasure on `stocky_runtime` would require weakening runtime RLS — reject. | **Yes** |
| **D-PR7-14** | proposed | Freeze **owner-only** data-request download as a **separate** permission from operational export (F-CLAUDE-PR7CP-08). Channel: short-lived in-app download + audit; no email provider in PR7. | Partner may later require a different channel (**UNVERIFIED**). | Staging/legal later, but **align the matrix before runtime** |
| **Q-008** | OPEN | Keep OPEN. Empty legal-hold fixtures ≠ production retention. | Do not invent a binding hold period. | Production, not this planning PR |

Do **not** treat the “Recommended option” column in plan §9 as accepted while this review’s P0/P1 remain.

---

## 9. Implementation-entry blockers (no PR7 runtime)

All of the following remain. This review does **not** remove any of them.

1. ChatGPT has **not** accepted the corrected plan; this verdict is **CORRECTIONS REQUIRED**.
2. Unresolved planning **P0/P1/P2** (F-CLAUDE-PR7CP-01…09). P7-C06 forbids starting with those open.
3. Unanswered proposed D-PR7 items that block start: **01, 02, 03, 10, 13**, and **14-as-needed** (plus 07 freeze recommended). Constrained 04/05/06/08/11/12 still need the hole-closing corrections above.
4. Phase 1 PR6 is **not** independently accepted and formally closed on merged main. PR43 remains OPEN/DRAFT at dated H `4768033b…`. Implementation must branch from a later merged main, not from `f1b0364…`.
5. Exact-head **full** CI on that merged main (`CI_POLICY.md`) — docs-only PR45 CI is not that evidence.
6. Named single writer, exclusive files **after** F-CLAUDE-PR7CP-07 is rewritten; **no competing D writer**.
7. Explicit subsequent ChatGPT **runtime** authority sentence. This packet is not that sentence. D-054 remains the heading; **no D-055**.
8. R-176 remains **OPEN / P0**. R-164 unchanged. Q-008 OPEN. R-005 / R-030 remain until processors exist.

Interfaces that will need a **merged-main refresh** after D lands (do not change D’s scope): `execution-strategy.server.ts`, `intake.server.ts`, `sanitize.server.ts`, `queue.server.ts`, `job-envelope.server.ts`, `shopify.app.toml` if D adds topics. Compliance sanitizer should stay in `app/privacy/**` as the packet already proposes.

---

## 10. Adversarial self-check of this review

- Did not approve unresolved options on ChatGPT’s behalf.
- Did not start PR7 runtime, edit planning files, edit PR43, or mark PR45 ready.
- Did not wait for D; H was only identity-checked (`4768033b…` still live).
- Postgres-backed RLS/uninstall tests are **BLOCKED**, not claimed passed. F-CLAUDE-PR7CP-02 is therefore **source-derived**, labelled as such.
- `authenticate.admin` population under V token config remains **UNVERIFIED** (forbidden to change config to find out).
- Changelog vs compliance-page timing is labelled official-source conflict, not a legal certification.

---

## 11. Outcome

**CORRECTIONS REQUIRED**

Return to Cursor on the **existing** PR45 planning session (or a ChatGPT-authorized successor planning correction) to close F-CLAUDE-PR7CP-01…09 in **both** documents, preserve D-PR7 IDs, obtain new exact-head docs-only CI, then a **new** independent re-review of the exact new head.

No runtime, merge, or production authorization follows.

R-176 **OPEN / P0**. R-164 unchanged. Q-008 **OPEN**. D-054 remains authority. **No D-055.**
