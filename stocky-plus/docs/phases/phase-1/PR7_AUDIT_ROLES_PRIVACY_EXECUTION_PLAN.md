# Phase 1 PR7 — Audit, roles, and privacy execution plan

**Status:** **PROPOSED — ONE-DEPENDENCY-AHEAD — NOT IMPLEMENTATION AUTHORITY**

**Document type:** execution-ready architecture / acceptance contract for the next approved Phase 1 module.

This packet does **not** authorize PR7 runtime, migrations, grants, Shopify configuration, production, inventory writes, flag enablement, or merge. ChatGPT’s 2026-09-18 topic-authority comment 5729229659 remains planning authority for Decisions A–E. Comment 5737038796 remains the customer-completion/epoch/inventory supplement. Comment [5747828826](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5747828826) is current for **Decision CC-GEN**, **F-CLAUDE-PR7CC-01…04**, merged-**W** writer refresh, and PR48-informed authentication / Redis / D-scratch entry constraints. None of those comments accept the whole plan, close PR6, or start implementation.

---

## 0. Label discipline

Every claim in this document is one of:

| Label | Meaning |
|---|---|
| **FACT (V)** | Observed on merged executable baseline `a3ff480f1477237f8055f10c43298480a05728a1` |
| **FACT (library)** | Observed in installed TypeScript types under `stocky-plus/node_modules` at V |
| **OFFICIAL** | Shopify or PostgreSQL documentation fetched on the stated access date; not legal advice |
| **CONSTRAINED** | ChatGPT product/security planning decision for this packet; not runtime authority |
| **FACT (W)** | Observed on merged main `ee193f38491245a10fb2fa60d2cf9a29f3271605` (PR6-D #43) |
| **FACT (PR48)** | Cursor-reported feasibility on pinned PR48 head `275292d19b583c04c3afe01ef7d9feb48fee0f6c`; **not** independent security acceptance |
| **PROVISIONAL (H)** | Dated unmerged PR6-D snapshot `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b`; superseded as merged authority by **W**; keep as historical pin |
| **PROPOSED** | Remaining implementer specification inside a constrained decision; still not runtime |
| **UNVERIFIED** | Not executed or not confirmed from an official source |
| **BLOCKED** | Specified check could not be executed in this planning environment |

Companion file (must stay internally consistent with this plan):

- `stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_ACCEPTANCE_MATRIX.md`

Immutable independent reviews (byte-for-byte; do not edit):

- `stocky-plus/docs/phases/phase-1/PR7_CORRECTED_PLANNING_INDEPENDENT_REVIEW.md` (blob `c1fa5c2fed74bf80d1006267b43d767258895c17`)
- `stocky-plus/docs/phases/phase-1/PR7_EXECUTABLE_CONTRACT_CORRECTION_INDEPENDENT_REVIEW.md` (blob `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f`)
- `stocky-plus/docs/phases/phase-1/PR7_TOPIC_AUTHORITY_FINALIZATION_INDEPENDENT_REVIEW.md` (blob `e609e9526ed1ec043551ca68d6b977f5b5935d0c`)
- `stocky-plus/docs/phases/phase-1/PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md` (blob `e908770d9daea4f963b2fd09e38af79e07274d41`)

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
| Authorization (topic authority / finalization) | [PR45 comment 5729229659](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5729229659) (`user=Vedang1998`). Decisions A–E remain otherwise intact. **no D-055** |
| Authorization (customer-completion / epoch) | [PR45 comment 5737038796](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5737038796). Narrowly supplements 5729229659 for **F-CLAUDE-PR7TF-01…04** only |
| Authorization (CC-GEN / W / entry — **current**) | [PR45 comment 5747828826](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5747828826). Decision **CC-GEN** + CC-01…04 + merged-W inventory + PR48-informed auth/Redis/scratch. Does **not** accept the plan |
| Starting subject **S** (this correction) | `a292bc8a6ea26192bc295af7338dd6d653a3e65c` |
| Historical TF starting subject | `9d9919057992e9c7ba1f7bfcee73d671f2fadbab` |
| Prior starting subject (topic-authority packet) | `253ab202dbee53dc842bb1389db4a19c6e3fb058` |
| Merged main **W** (history-preserving merge parent) | `ee193f38491245a10fb2fa60d2cf9a29f3271605` — PR6-D (#43). Do not relabel historical V as current main |
| Merge commit (review FF + exact W, pre-docs) | `0b21604eabff392aa25866732045dfd4b1041bf0` parents `c7b4780…` + `ee193f3…` |
| Prior immutable review #1 | commit `86c1c520e8e7b72742f1061bd261682cf011f758` blob `c1fa5c2fed74bf80d1006267b43d767258895c17` — **unchanged** |
| Prior immutable review #2 **R** | commit `64649470475912c3a697585772c0dd336d6daabc`; blob `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f` — **unchanged** |
| Immutable review **TF** | commit `dee96cf310e7ee2a45947649ee998ef9fe5b51b3`; blob `e609e9526ed1ec043551ca68d6b977f5b5935d0c` — **unchanged** |
| Immutable review **CC** | branch `claude/pr45-customer-completion-correction-review`; commit `c7b47807083bfad8e7e3a7504e826027e56b7a32`; sole parent **S**; blob `e908770d9daea4f963b2fd09e38af79e07274d41`; path `PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md` — **fast-forwarded, byte-for-byte** |
| Entry-evidence input **PR48** | head `275292d19b583c04c3afe01ef7d9feb48fee0f6c` on `planning/pr7-entry-evidence-20260919-37c6` (latest on that branch at this correction; **no later source-preservation revision**). Blobs: `PR7_MERGED_MAIN_ENTRY_EVIDENCE.md` `59ac3da9a4fd1c559bd641c2953351bf09dfc745` sha256 `5794ba1ae31898933410c9bc7362905458cf976fac8a005a365f5ef1e8599737`; `PR7_IMPLEMENTATION_HANDOFF.md` `05a8a0351387d4d08b2fb05dd49f6428ac20d1fe` sha256 `8c1ae6938a2c9335d6af786ba07f5b5d5a69b18f1fec91569aa657df1d3d68c0`. Cursor-reported feasibility, **not** independent security acceptance |
| Review publication PR | [#46](https://github.com/Vedang1998/Stocky/pull/46) already used; **do not reopen/reuse as an integration route** |
| Work order | comment 5747828826 (this packet); prior TF work order remains historical |
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

### 1.4 F-CLAUDE-PR7TF-01…04 dispositions (this correction)

Independently reproduced **59/59** model at S is preserved as evidence for that head. This packet adds customer-completion, epoch-publication, writer-inventory, and evidence-metadata contracts. It does **not** rebuild Decision A–E.

| ID | Sev | Defect | This packet | Plan anchors | Matrix |
|---|---|---|---|---|---|
| **F-CLAUDE-PR7TF-01** | P1 | Customer-topic erasure has no completion-integrity; post-enumeration arrivals survive and are invisible to a manifest-filtered residual | Target-scoped customer barrier (shop/generation + `CUSTOMER_REST_ID` / `ORDER_LEGACY_ID`); bounded re-enumerate; source-derived residual independent of the old manifest; residual+completion share exclusive target locks; LIVE shop; unrelated customers/shops progress | §7.6.2–7.6.3, §7.7.2 | PR7-TOP-015…, PR7-CUST-014…, G7 |
| **F-CLAUDE-PR7TF-02** | P2 | Enumerator not epoch-fenced; stale publisher mutates the new epoch | Publication lock shared with claim/takeover; live attempt/lease/revision re-validated after wait; stale callers leave keys/flags/revision byte-identical | §7.6.2 Epoch, §7.7.2 | PR7-COORD-PUB-*, G8 |
| **F-CLAUDE-PR7TF-03** | P2 | Writer inventory omitted `completeAttemptRetry` and dispatcher disabled-shop writes; `db-context` guard marked optional | Exact V file/symbol inventory; tenant/CP participating-write guard **required**; `processingEnabled` ≠ drain; architecture gate fails when a required writer is omitted or an unguarded tenant-linked probe lands | §7.6.2, §7.9 | PR7-GATE-009…, G9 |
| **F-CLAUDE-PR7TF-04** | P3 | `results.json` hashed beside scripts but is timing-dependent; postgres field hardcoded | Driver queries `server_version` / `server_version_num`; `results.json` labelled a **run log**, not a verification artifact. Historical hashes retained as original-run identities | §12, §14 | matrix §14 |

Old-model counterexamples **CE-1** (late audit residual 0 while `ae_a3` survived) and **CE-6** (stale enumerator flipped `true,0` / 3 keys → `false,1` / 0 keys) were reproduced on the **unchanged** 59-case scripts before the TF contract was loaded.

### 1.5 F-CLAUDE-PR7CC-01…04 dispositions (this correction)

Independently reproduced TF model at S (`115` records = `89` unique + `26` declared G7–G9 reruns) is preserved as **historical** evidence for that head. This packet does **not** rebuild Decision A–E. Completeness is **not** “86 PR48 rows”.

| ID | Sev | Defect | This packet | Plan anchors | Matrix |
|---|---|---|---|---|---|
| **F-CLAUDE-PR7CC-01** / **CC-GEN** | P1 | Writer guard resolved generation via `ORDER BY id DESC LIMIT 1`; second generation (`gen_a_zz`) admitted matching writes while barrier ACTIVE on `gen_a` (CE-A) and admitted delayed pre-erasure payloads after complete (CE-B) | **Generation-independent** customer-target lock `pr7-ctgt-v2:` + canonical domain × kind:value. Lock **before** lookup. Examine **all** ACTIVE / completed barriers in the namespace. Writer origin = declared persisted generation **or** unique LIVE `shopRowId`/`targetShopId` binding; fail missing/ambiguous; **never** `ORDER BY id`. Restore-denied vs genuine successor with unique LIVE origin, `payloadAdmittedAt >= origin.installedAt`, completed gen not LIVE. Indistinguishable → `customer_target_attribution_ambiguous`. `stocky_generation_writable`: **ANY** `ERASING`/`FINALIZING` in the namespace freezes (LIVE+ERASING fail-closed) | §7.6.2, Decision CC-GEN | PR7-CUST-025…, PR7-TOP-018…, G11, NEG-4, old CE-A/CE-B |
| **F-CLAUDE-PR7CC-02** | P2 | Residual counted by parameter but was RLS-visible via GUC; missing/mismatched GUC returned `0` (true `3`). Shielded on the complete path by re-enumerate (not a live false-complete) | Residual owns request GUC / tenant / live attempt / capability **before** any RLS-filtered count. Absent or mismatched GUC → `residual_request_guc_mismatch` `42501`. Direct calls by every EXECUTE grantee | §7.6.2 Residual | PR7-RESID-*, G12, NEG-5, old CE-C |
| **F-CLAUDE-PR7CC-03** | P3 | §7.9 said 26 inventory rows; contract seeded 27. Headline 115/115 invited reading 115 unique | Historical inventory was **27** rows. Historical proofs: **89 unique / 26 reruns / 115 records**. This packet: **50** inventory rows (27 preserved + 23 W-derived); completeness is **required-symbol presence**, not row-count 86. Corrected model: **117 unique / 52 declared reruns / 169 records** | §7.9, §12, §14 | PR7-GATE-009…016; G9; matrix §14 |
| **F-CLAUDE-PR7CC-04** | P3 | Driver hardcoded `/tmp/pr45-tf`; §14 never staged scripts | Driver uses `PROOF_ROOT` (default script directory) + `PGHOST`/`PGPORT`. Reproduction stages `01_contract.sql` + `02_seed.sql` beside the driver | §14 | PR7-CI-005 |

Old-model CE-A / CE-B / CE-C were reproduced on the **unchanged** TF contract (`75ab1c02…349846de`) before this contract was loaded.



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

**FACT (W):** PR6-D is merged at `ee193f3…`. This planning branch history-preserving-merged exact W. Do not chase a later unreviewed main. Do not import unmerged PR47 closeout. Do not start a competing D writer.

Privacy sanitizer stays in `app/privacy/**`, not D’s `sanitize.server.ts`. Named shared files in §7.9 are refreshed against **W**. D scratch cleanup consumes the **accepted** W operator helper; **do not auto-call it from PR7** (PREP-B-19). If namespace-wide quiescence cannot be proven, keep the privacy request incomplete — do not silently skip leftover bytes.

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

**D-PR7-02 CONSTRAINED (refined by 5747828826 + PR48 FACT):** FUTURE implementation may set `useOnlineTokens: true` **only** after a separately reviewed safe adapter/version and a migration of old cached sessions. **No config edit in PR45.** Owner proof remains **separately gated** from actor identity.

**Authentication entry contract (FACT PR48 / Helper A vs coordinator IDs are distinct):**

| Rule | Evidence label | Must not |
|---|---|---|
| Canonical human identity is the verified JWT `sub` **string** with exact digits (`^[0-9]+$`). Persist that string | Helper A **PREP-A-01** (embedded `authenticate.admin` returns `sessionToken.sub` with `useOnlineTokens: false`); coordinator **PREP-A-01** (wide sub `"9007199254740993"` survives decode as that string) | `String(associated_user.id)`; persist a JSON **number** `sub` (Helper A **PREP-A-13** — runtime `sessionToken.sub` can be a number if the JWT JSON `sub` is a number; types say string) |
| Needing actor identity does **not** justify enabling online tokens | Helper A **PREP-A-01** | treating D-PR7-01 as blocked on `useOnlineTokens: true` |
| Numeric `associated_user.id` is not recoverable exact evidence. `createSession` online id uses `` `${associated_user.id}` `` | coordinator **PREP-A-02**; Helper A **PREP-A-09** `mixedToken: true` when wide-id B then A | using rounded `9007199254740992` as identity for `…993` |
| Prisma adapter `userId: (associated_user.id as unknown as bigint)` is a compile-time assertion; runtime remains a JSON number | coordinator **PREP-A-03** | treating `Session.userId` as lossless |
| Validate signature / audience / time, and **issuer/destination host agreement in app code**, before exchange/effects | coordinator **PREP-A-04** (`decodeSessionToken` does **not** reject `iss`/`dest` hostname mismatch; `destMismatchRejectedByLibrary: false`) | assuming the installed library already enforces dest/iss |
| W `shopify.server.ts` does not set `useOnlineTokens`; W `requireAdminTenant` uses `session.shop` only | coordinator **PREP-A-05**, **PREP-A-06** | claiming W already persists `sessionToken.sub` |
| Offline autonomous jobs: `isOnline=false`, id `offline_<shop>`, no `onlineAccessInfo` | coordinator **PREP-A-09** | granting Shopify/app permission from JWT identity alone |
| Per-user cache isolation **before** any online credential is used or any associated bootstrap/hook effect executes. An after-the-fact actor check cannot undo an already used wrong token | Helper A **PREP-A-09** / NC-07 `mixedToken`; Helper A **PREP-A-11** / NC-09 stale cache (`associated_user.id=111` returned with **zero** token exchanges) | enabling the current online-session path merely because it produces `associated_user` |
| Reject absent, mismatched, or unsafe evidence; unknown actors stay `unassigned` | Helper A **PREP-A-03** / NC-08 | first-login grant |

These are **synthetic signed-token / installed-library probes** (mocked `POST /admin/oauth/access_token`), **not** evidence of a deployed exploit or live Shopify token contents. Live token exchange remains **UNVERIFIED** (Helper A **PREP-A-16** / coordinator **PREP-A-07**). No token, config, or dependency change now. Unresolved positive owner binding stays an explicit implementation-entry gate. Do not initiate upstream disclosure or publish credentials.


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
| Check | After shared lock: `stocky_generation_writable(domain)` is true iff **no** generation in that canonical namespace has fence `ERASING` or `FINALIZING`. LIVE + ERASING coexistence is **fail-closed frozen**. **Never** `ORDER BY id` |
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

**Topic scope:** the whole-shop exclusive domain barrier is **only** for `shop/redact`. Customer topics must not freeze the shop and must not take that exclusive gate.

**Customer-scoped barrier (F-CLAUDE-PR7TF-01 + Decision CC-GEN, CONSTRAINED):** `customers/redact` installs a durable **target-scoped** barrier whose keys ordinary writers can compute: verified **canonical domain** (the physical tenant/data namespace) + `CUSTOMER_REST_ID` (`lookupCustomerRestId`) and `ORDER_LEGACY_ID` (each authenticated `lookupOrderLegacyIds` value). It is **not** keyed by a privacy request id and **not** keyed by a guessed generation. Generation remains **immutable evidence** on `PrivacyCustomerTargetBarrier`, `PrivacyCompletedTarget`, and `PrivacyRequest`. Namespace: two-int advisory locks `hashtext('pr7-ctgt-v2:'||canonicalDomain)` × `hashtext(kind||':'||value)`. PostgreSQL has **no** 3-arg `pg_advisory_xact_lock`.

**Global lock order:** lifecycle domain (`1347573553`) → publication (`1347573556`) → authz (`1347573554`) → customer-target (`1347573555`). **Lock before lookup.** An empty barrier SELECT before the exclusive lock is a publication race and is forbidden.

| Piece | Specification |
|---|---|
| Shared | participating target writers: domain **shared** gate, then customer-target **shared** locks in sorted `(kind, value)`, then revalidate **all** ACTIVE barriers in the canonical namespace |
| Exclusive | customer-erasure admission / residual+completion: domain **shared** (not exclusive), publication lock, then customer-target **exclusive** locks in the same sort order |
| Durable row | `PrivacyCustomerTargetBarrier` `ACTIVE` until completion; `generationId` is evidence (the request's bound generation), not the lock identity; survives worker death and epoch takeover (`attemptId` rebound by `stocky_privacy_claim_attempt`) |
| Writer deny | `customer_target_erasing` if **any** ACTIVE barrier in the namespace matches `(kind, value)`; a later LIVE generation row, including lexicographically greater `gen_a_zz`, cannot bypass it; never silently repopulate the target |
| Writer origin | `stocky_writer_origin_generation`: declared persisted `p_origin_generation_id` (must exist and share the namespace) **or** the **unique** LIVE generation bound by `shopRowId`/`targetShopId`. Missing → `customer_write_origin_missing`. Two LIVE bindings → `customer_write_origin_ambiguous`. **Never** `ORDER BY id`. Old work must not adopt a newer generation on retry |
| After COMPLETED | barrier `RELEASED`; `PrivacyCompletedTarget` records minimized `(shop, generation, kind, value, completedAt)`. Delayed payloads with `payloadAdmittedAt < completedAt` whose origin **is** the completed generation raise `customer_target_restore_denied`. Genuine successor writes require: unique LIVE origin ≠ completed generation, completed generation **not** LIVE, and `payloadAdmittedAt >= origin.installedAt`. Queued payload before successor `installedAt` remains restore-denied. Indistinguishable shared data → `customer_target_attribution_ambiguous` (visible block/escalate; not a silent admit and not a permanent unexplained ban). Legitimate later writes on a proven unique LIVE successor are allowed. **Not** lifetime suppression. Q-008 remains OPEN |
| Unrelated progress | other customers (different rest id / order ids) and other shops take different lock keys and continue; `processingEnabled` stays true |
| Shop supersession | if **this request's** generation fence is `ERASING`/`FINALIZING`, customer admission/completion returns `superseded_by_shop_erasure` / `superseded`; no fabricated customer COMPLETED download. Namespace freeze (`stocky_generation_writable`) is separately fail-closed whenever **any** generation in the domain is `ERASING`/`FINALIZING` |

**Residual (not the manifest):** `stocky_privacy_customer_residual_count` is SECURITY DEFINER and **owns its preconditions** (CC-02) **before** any RLS-filtered count: request GUC must equal `p_request_id` (`residual_request_guc_mismatch` `42501` on absence/mismatch); tenant GUC must equal `targetShopId`; live attempt + capability `READ` required. It does **not** depend on the adjacent enumerator call. Source-derived: open-ended `AuditEvent.customerRestId = lookupCustomerRestId`; orders by `shopifyLegacyResourceId = ANY(lookupOrderLegacyIds)`; child lines by reconstructed `gid://shopify/Order/`||legacyId so a deleted root is not confused with unknown input. Returns only a count. Zero RLS-visible **consumer** rows still **never** prove absence. Historical CE-C: unguarded residual returned `0` on missing/foreign GUC while three rows existed; complete was shielded by re-enumerate — that is a latent P2, not a demonstrated live false-complete.


**Completion serialization:** `stocky_privacy_complete_customer_redact` holds publication lock + exclusive target locks, re-enumerates under the live epoch, evaluates residual, then conditionally `COMPLETED` **in the same transaction**. Bounded retries (`completeRetryCount`, max 5) then `ESCALATED` / `budget_exhausted`. Remnants, stale epoch, missing barrier, or shop supersession: **no** receipt.

**Epoch / publication (F-CLAUDE-PR7TF-02):** exactly one `PrivacyRequest.activeAttemptId`. Lost lease → `stocky_privacy_claim_attempt` takes the **same** publication lock (`1347573556` / `pr7-pub-v1:`\|requestId) as the enumerator, marks the old attempt `LOST`, inserts the new epoch, rebinds `activeAttemptId` and ACTIVE barriers. Enumerator: lock, fresh read with `clock_timestamp()`, require GUC request+attempt = live leased attempt, **then** `publicationRevision = publicationRevision + 1` CAS, **then** replace keys. A stale, expired, foreign, or terminal caller raises `enumerator_stale_attempt` and leaves keys/flags/revision unchanged. Check-then-act without the lock is insufficient.

**Honest non-coverage (LIMIT, informed by PR48 — do not certify a missing fence):** PostgreSQL advisory locks and RLS do **not** fence Redis jobs, export publication, or D scratch bytes. Required future protocol:

1. Target/generation publication fence **and** positive worker/I/O drain acknowledgment, with takeover/death/restart handling and a final residual boundary. No sibling role or worker may evade the barrier via a stale cached observation.
2. `Job.remove`, CANCELLED, TTL, a decoy PID, process-local `live_writer`, occupancy alone, or `quiescenceConfirmed: true` do **not** prove no late write (**FACT PR48** coordinator PREP-B-01/02/03; Helper B PREP-B-06b — active locked jobs may continue writing after a removal attempt; Helper B **PREP_B_19** — second process with `quiescenceConfirmed: true` deleted a live child PID; W `live_writer` skip is process-local; the boolean is an **operator token**, not liveness).
3. Accepted W reclamation `reclaimOperatorSelectedDScratch` is **operator-only** with external namespace-wide quiescence as a precondition. Document the integration hazard; **do not** invent a successful execution of that precondition; **do not** silently revoke D acceptance. **Do not auto-call that helper from PR7** until real quiescence of every process able to write its namespace is established. When it cannot be established, keep the privacy request incomplete/escalated.
4. No blanket stop/delete, FLUSHALL (PREP-B-07 not called), `/tmp` sweep, or directory-current-size substitute for reserved capacity. Unknown export configuration is not proof that historical bytes never existed (PREP-B-06 / PREP-C-12: no S3/R2/GCS module on W).
5. Customer scope must not silently cancel unrelated customers or whole shops (PREP-B-04 jobId isolation ≠ privacy fence).

Cross-system prerequisites remain explicit future implementation proofs only where this plan specifies a concrete executable protocol and tests. This SQL model does **not** execute Redis, filesystem, or authentication implementation obligations. Temporary feasibility tests may exercise existing real APIs; they must not hide a complete untracked PR7 implementation outside the repo.


**Uninstrumented writers:** control-plane tables have **no** RLS on V. A raw CP `INSERT` without the gate still succeeds (**executed** G5). Legacy processes running before the guard is deployed must be **stopped/drained** before privacy execution is enabled. A rollout with uninstrumented active writers is not safe admission. Named FUTURE wrappers (not this PR): `TenantDb` / `withTenantBoundTransaction` participating-write guard is **required, not optional**; CP write helpers for every §7.9 inventoried symbol including `completeAttemptRetry` and the dispatcher disabled-shop path. Do not claim accepted B/C internals automatically honor this gate. `processingEnabled` checks are useful admission filters; they are **not** a transaction drain.

**OFFICIAL:** PostgreSQL 16 explicit locking — transaction advisory locks are cooperative; unmodified writers do not participate. https://www.postgresql.org/docs/16/explicit-locking.html (accessed 2026-09-18).

#### 7.6.3 Recoverable sequence — named phase anchors (F-CLAUDE-PR7XC-09)

Never one transaction across `stocky_control_plane` and `stocky_privacy_erasure`. Never one transaction-scoped lock held across those connections.

| Phase | Connection | State after commit | Residual if crash |
|---|---|---|---|
| **P-ADMIT** | coordinator/control-plane | `PrivacyRequest` RECEIVED/AUTHENTICATED; delivery binding; ack 200 only now | Replay delivery id → same request |
| **P-CLASSIFY** | coordinator | generation bound or `ESCALATED`; customer topics do **not** set whole-shop `ERASING` | Re-run classifier; do not guess; do not promote customer work to shop erasure |
| **P-FREEZE** (`shop/redact` only) | coordinator under **exclusive** gate | `fence=ERASING`; ordinary participating writes drain then reject | Re-acquire exclusive; do not claim freeze from a prior committed lock |
| **P-CLAIM** | coordinator (same worker process, **not** `DurableJob`) | `PrivacyAttempt` leased; heartbeat; checkpoints | Poll recovers a lost Redis hint; new epoch if lease lost — claim takes the publication lock |
| **P-CUSTOMER-BARRIER** (`customers/redact` only) | coordinator + `stocky_privacy_install_customer_barrier` | `PrivacyCustomerTargetBarrier` ACTIVE for shop/generation + customer/order keys; shop remains LIVE/enabled | Re-install under live epoch; do not take the domain exclusive gate |
| **P-ENUMERATE** | privacy definer `stocky_privacy_enumerate_targets` | `PrivacyTargetKey` published for this request only; `enumerationComplete` / `missingLinkages` / `publicationRevision` | Incomplete stays incomplete; stale epoch cannot publish; zero RLS-visible rows ≠ absence |
| **P-ERASE** | privacy-erasure then coordinator checkpoints | manifest cursor; coordinator events; **keep** request/attempt/generation/barrier | Resume cursor |
| **P-CUSTOMER-RESIDUAL-COMPLETE** (`customers/redact`) | same txn: exclusive target locks + re-enumerate + `stocky_privacy_customer_residual_count` + conditional COMPLETED | COMPLETED + receipt + `PrivacyCompletedTarget` + barrier RELEASED **iff** residual 0 | remnants / stale / budget / superseded → **no** receipt |
| **P-PRE-ROOT-RESIDUAL** | privacy-erasure SELECT + coordinator | `fence=FINALIZING` only if surfaces empty except named coordinator rows | Remnants → `PARTIAL_FAILED`/`FINALIZING` **not** COMPLETED |
| **P-ROOT-DELETE** (`shop/redact`) | privacy-erasure `SELECT stocky_privacy_finalize_shop_delete(...)` | Shop row gone **or** `already_absent`; generation `shopRowId` SET NULL by FK; `targetShopId` remains | Probe by `targetShopId`, not current Shop lookup |
| **P-POST-ROOT-RESIDUAL** | coordinator + privacy SELECT using `targetShopId` | empty except coordinator/generation/receipt-not-yet | Resume P-ROOT-DELETE / this phase |
| **P-COMPLETE** | coordinator **conditional** txn under still-valid frozen epoch: `UPDATE PrivacyRequest SET state=COMPLETED WHERE id=:id AND state=FINALIZING AND generationId=:g AND activeAttemptId=:epoch` + INSERT receipt **iff** residual predicate true | COMPLETED + receipt bound to request+generation+target | If remnants, **do not** INSERT receipt |
| **P-PRUNE-PAYLOAD** | coordinator | delete lookup keys, raw payload/manifest lines; **retain** `PrivacyDeliveryTombstone` until `expiresAt` | Receipt + generation `ERASED` + tombstone remain |

A receipt **cannot** override observed remnants. `COMPLETED` is illegal while remnants exist. **P-PRUNE-PAYLOAD** is **after** **P-COMPLETE** / **P-CUSTOMER-RESIDUAL-COMPLETE**. Refer to these **phase names**, not only numbers.

For `shop/redact`, nothing can repopulate the target between residual and completion because: exclusive freeze is still in force; participating writers re-check and reject; uninstrumented writers are a **rollout drain prerequisite**, not a claimed lock.

For `customers/redact`, that freeze rationale does **not** apply. Completion integrity is the target-scoped barrier + source-derived residual sharing exclusive locks with the conditional COMPLETED update (**executed** G7). A stale-manifest count or an unprotected rescan-then-complete is insufficient (**executed** old-model CE-1; NEG completion-guard removal).

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

Every manifest mutation is fenced by the current request/attempt/lease. The enumerator takes `stocky_privacy_publication_lock` (same lock as `stocky_privacy_claim_attempt`), re-reads the live attempt with `clock_timestamp()`, then CAS-increments `publicationRevision` **before** replacing keys. Stale/expired/foreign/terminal callers raise `enumerator_stale_attempt` and leave the new epoch’s keys and flags unchanged (**executed** G8, including a pause between client-side validation and the mutate call). Check-then-act without that lock is insufficient (old-model **CE-6**; NEG epoch-guard removal).

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
| `stocky_privacy_capability_allows(text,text)` | `stocky_privacy_capability_owner` | locked | `SELECT PrivacyRequest, PrivacyAttempt, ShopInstallGeneration` | reader, erasure, **and** `stocky_privacy_target_owner` (CC-02 residual definer) | policies; residual; probes |
| `stocky_privacy_row_in_manifest(text,text)` | `stocky_privacy_target_owner` | locked | `SELECT PrivacyTargetKey`; calls `stocky_current_tenant_id` | reader, erasure | policies |
| `stocky_privacy_enumerate_targets(text)` | `stocky_privacy_target_owner` | locked | publication lock; live attempt/lease; CAS `publicationRevision`; SELECT facts/lines/audit; INSERT/DELETE `PrivacyTargetKey`; UPDATE enumeration columns; sequence `PrivacyTargetKey_id_seq` | reader, erasure, CP | coordinator enumerate only |
| `stocky_privacy_publication_lock(text)` / `stocky_privacy_live_attempt_ok(text,text)` | invoker (used inside enumerator/claim) | locked | advisory ns `1347573556`; SELECT request/attempt | reader, erasure, CP, target_owner | enumerator; claim/takeover; complete |
| `stocky_privacy_claim_attempt(text,text,text)` | `stocky_privacy_target_owner` | locked | same publication lock; mark LOST; insert epoch; rebind `activeAttemptId` + ACTIVE barriers | CP | worker-loss takeover |
| `stocky_privacy_install_customer_barrier(text,text)` / `stocky_customer_targets_for_request(text)` | `stocky_privacy_target_owner` | locked | INSERT/rebind `PrivacyCustomerTargetBarrier`; generation is **evidence**; lock keys are canonical-domain × kind:value (`pr7-ctgt-v2:`) | erasure, CP | **P-CUSTOMER-BARRIER** |
| `stocky_shop_canonical_domain(text,text)` / `stocky_writer_origin_generation(text,text,text)` / `stocky_customer_target_lock_key1/2` | lifecycle / invoker | locked | unique LIVE/declared origin; two-int `hashtext` pair (not 3-arg). **Never** `ORDER BY id` | runtime, CP, erasure | CC-GEN writer origin |
| `stocky_customer_write_guard(...)` / `stocky_fact_write_guard(...)` | `stocky_lifecycle_gate_owner` / invoker | locked | lock **before** lookup; examine **all** namespace ACTIVE/completed barriers; deny `customer_target_erasing` / `customer_target_restore_denied` / `customer_target_attribution_ambiguous` / `customer_write_origin_missing` | runtime, CP | FUTURE TenantDb / apply writers |
| `stocky_privacy_customer_residual_count(text)` | `stocky_privacy_target_owner` | locked | **owns** request GUC / tenant / live attempt / READ capability **before** RLS count (`residual_request_guc_mismatch` `42501`); source-derived; **not** `PrivacyTargetKey` | erasure, CP | **P-CUSTOMER-RESIDUAL-COMPLETE** |
| `stocky_privacy_complete_customer_redact(text,text)` | `stocky_privacy_target_owner` | locked | publication + exclusive targets; re-enumerate; residual; conditional COMPLETED + `PrivacyCompletedTarget` | erasure, CP | same phase |
| `stocky_privacy_data_request_coverage(text)` | `stocky_privacy_target_owner` | locked | snapshot key count + `enumerationComplete` at `publicationRevision` | reader, CP | data_request fulfillment; **not** an empty residual |
| `stocky_cp_participating_write` / `stocky_lifecycle_complete_attempt_retry` / `stocky_dispatcher_disabled_shop_write` | invoker | locked | REQUIRED lifecycle shared then CP DML (`DurableJob` / `JobDispatch`) | CP (retry/dispatcher); CP+runtime (generic) | inventoried lifecycle/dispatcher paths |
| `stocky_inventory_is_complete()` / `stocky_detect_unguarded_cp_write(text)` | invoker | locked | inventory completeness; `probe_unguarded%` detection | CP, runtime | architecture gate |
| `stocky_privacy_finalize_shop_delete(...)` | `stocky_privacy_finalizer_owner` | locked | `SELECT` request/generation/attempt/Shop; `DELETE Shop` | erasure only | P-ROOT-DELETE |
| `stocky_lifecycle_*` / `stocky_generation_writable` | `stocky_lifecycle_gate_owner` | locked | `SELECT ShopInstallGeneration`; advisory locks | shared: runtime, CP, reader, erasure; exclusive: CP, erasure | participating writers; freeze |
| `stocky_participating_write_guard(text)` | invoker | locked | EXECUTE shared lock + writable | runtime, CP | FUTURE transaction-host wrappers **required, not optional** |
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
| `app/tenant/db-context.server.ts` / `tenant-db.server.ts` | **REQUIRED** wrapper: `stocky_participating_write_guard` then `stocky_customer_write_guard` on matching kinds. Not optional. Future architecture test fails when a tenant-linked writer bypasses the declared guard |
| `app/shopify.server.ts` | skip catalog enqueue on fence; `useOnlineTokens: true` **only after** a separately reviewed safe adapter/version and old-session migration (D-PR7-02; not this PR). Actor identity does **not** require online tokens |
| `app/sync/uninstall.server.ts` | `processUninstall` / `cancelAllCancellable` — write generation `UNINSTALLED`; cancel ordinary jobs; **no** privacy DurableJob skip list required |
| `app/sync/reinstall.server.ts` | keep REDACTED deny; allow new Shop only when fence permits |
| `app/sync/intake.server.ts` | **unchanged** ordinary `createDurableJob`; privacy does **not** gain `allowWhenProcessingDisabled` |
| `app/sync/execution-strategy.server.ts` | unknown remains `NO_AUTOMATIC_RETRY`; **no** privacy mapping to `BOUNDED_CHECKPOINT_RETRY` |
| `app/sync/dispatcher.server.ts` / `fair-claim-query.server.ts` | **do not** add privacy claim SQL; keep `processingEnabled=true` on fair-claim SELECT. **REQUIRED** lifecycle shared guard on `ensureDispatchRecord`, `enqueueWithDispatch`, and `dispatchPendingJobs`. The shop-disabled path **still writes** `JobDispatch` + `DurableJob` (`markDispatchFailed`, raw UPDATE PENDING/CANCELLED) after reading `processingEnabled=false` — that re-check is **not** a drain (**FACT V** ~1373–1390). Exact inventory symbol `dispatcher_disabled_shop_path` |
| `app/sync/lifecycle.server.ts` | `claimAttempt`, `renewAttemptHeartbeat`, `completeAttemptSuccess`, `completeAttemptRetry`, `completeAttemptFail`, `completeAttemptDeadLetter`, `recoverExpiredRunningAttempts` (V reaper lives **in this file**; no separate reaper module). Host: `getControlPlanePrisma().$transaction` / `lockDurableJob`; raw SQL `UPDATE "DurableJob"`. **No** `processingEnabled` reference on V. **REQUIRED** lifecycle shared guard on every symbol. Already-running attempts finish CP rows; the guard must be held in those transactions so freeze can wait. `completeAttemptRetry` is explicitly in the inventory |
| `app/sync/replay.server.ts` | `stocky_authz_lock` then `stocky_verify_platform_assignment` then `PlatformReplayCommand` upsert in the **existing** CP txn **and** lifecycle shared guard; preserve DL/receipt contracts |
| `app/lib/order-facts/apply/writers.ts` / `receipts.ts` | TenantDb + raw `stocky_shop_processing_enabled` pre-lock; **REQUIRED** both gates. processingEnabled re-check is not a drain of an already-open apply transaction |
| `app/lib/catalog-facts/ingest/checkpoint.ts` | `lockSyncRun` `SELECT … FOR UPDATE`; **REQUIRED** lifecycle shared; `shop_processing_disabled` is admission not drain |
| `app/jobs/queue.server.ts` | generation-fenced / shop-scoped remove of **ordinary** jobs; never FLUSHALL |
| `app/jobs/workers/webhook-processor.ts` | ordinary path **keeps** `assertShopProcessingEnabled`; privacy coordinator is a **separate** loop started from worker bootstrap |
| `app/sync/envelope-v3.server.ts` | do not treat `privacy:*` strings as authority |
| `.github/workflows/ci.yml` | add `test:privacy` distinct command that fails on zero tests |
| `scripts/sync-control-plane/roles.ts` | no Shop DELETE; EXECUTE verifier (SELECT-only) |

**Exact participating-writer inventory (re-derived on W `ee193f3…`):** the disposable contract table `ParticipatingWriterInventory` lists **50** rows: the historical **27** V/TF rows (including the misnamed `getShopHealth` label, which is **ABSENT** as an export on W) plus **23** W-derived writers. Completeness (`stocky_inventory_is_complete`) is **required-symbol presence**, not a row count and **not** PR48's 86-row classification table (that table includes nonwriters/read-only entries — **FACT PR48** Helper C). Required symbols: `completeAttemptRetry`, `dispatcher_disabled_shop_path`, `withTenantBoundTransaction` (**not optional**), `claimAttempt`, `enqueueWithDispatch`, `runOrderFactsSyncJob`, `computeSyncHealth` (SyncHealth **upsert**, PREP-C-04 / PREP-C-29). G9 fails when a required W writer is omitted; deleting historical `getShopHealth` still leaves completeness true; row count must not be 86 (**executed**).

W surfaces that **did not change** vs V (TF-03 focus symbols still exact): `lifecycle.server.ts`, `dispatcher.server.ts`. `recoverExpiredDispatchLeases` is **local** (not a module export) and has **no** `processingEnabled` filter (**FACT W** / PREP-C-20). `getShopHealth` does not exist on W.

**W-derived writers named in this packet (not optional family labels):** `computeSyncHealth`; `runOrderFactsSyncJob` / `runOrderFactsReconcileJob`; `enqueueOrderFactsSync` / `enqueueOrderFactsReconcile`; `recoverStrandedEnqueuedJobs`; `recoverExpiredDispatchLeases`; `applyCanonicalAndLegacy` / `persistIncompleteWithoutReceipt`; `applyNominatedOrderGid`; `persistShopTimezoneCurrencyValues`; `processOrderFactsWebhookJob`; `createOrderFactsSyncRun` / `persistOrderFactsCursor` / `recordOrderFactsDataIssue` / `persistOrderFactsCoverageHealth`; `applyCanonicalFacts` (no explicit PE pre-lock, PREP-C-15); `applyWithApplicationReceipt`; `deleteSessionsForShop`; `signalBulkOperationContinuation`; `insertOrderFact` / `insertReceiptFinal` (actual W exports; `applyOrderFactWriters` / `applyReceipts` remain family labels); `reclaimOperatorSelectedDScratch` (**operator-only**; MUST NOT be auto-called from PR7 — PREP-B-19).

Keep completed A/B/C/D internals unchanged **now**; name required future shared-host integrations honestly. Formal PR6 closeout packaging (PR47) is **unmerged** and is not this packet (PREP-C-23).

**Forbidden now (TF-03 + CC-03 + PR48):** treating `processingEnabled` / `assertShopProcessingEnabled` as a transaction drain; marking `withTenantBoundTransaction` optional; omitting `completeAttemptRetry`, `dispatcher_disabled_shop_path`, `runOrderFactsSyncJob`, or `computeSyncHealth`; copying PR48's 86-row count into the completeness assertion; claiming an unguarded tenant-linked `probe_unguarded%` write is complete; using Redis TTL, `Job.remove`, CANCELLED, a decoy PID, process-local `live_writer`, occupancy, or `quiescenceConfirmed: true` as quiescence.

Paths may sit outside the **customer** barrier only with a precise proof they cannot invalidate this request's completion (ordinary CP cleanup vs repopulating facts). They still take the **lifecycle** shared gate where inventoried. Fair-claim `WHERE processingEnabled=true` is admission-only and does not drain in-flight writers.


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
- **Coverage rule (F-CLAUDE-PR7TF-01):** `customers/data_request` remains read-only. Fulfillment coverage is the published snapshot at `publicationRevision` (`stocky_privacy_data_request_coverage`) — key count and `enumerationComplete` — **not** an erasure-empty residual predicate (**executed** G7). Whole-shop erasure supersession must not fabricate a customer download.

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
| **D-PR7-01** | Actor source | Exact verified JWT `sub` **string**; no recovery from rounded numbers; actor identity does **not** require online tokens (Helper A PREP-A-01) | First online id then stringify number → **sub-only persistence**; dest/iss hostname check in **app** (library omits it, coordinator PREP-A-04) | Safer identity; mixedToken/stale-cache must be fenced before any online credential; additive staff table VARCHAR | Yes |
| **D-PR7-02** | Online tokens | Owner proof separately gated. Do **not** enable current online-session path merely because it produces `associated_user`. Later proposal must prove per-user cache isolation, retained original actor binding, dest/iss, and migration of old cached sessions. No config now | Optional defer → **explicit later enabling proposal**; unresolved positive owner binding stays an entry gate | mixedToken / stale-cache hazards (Helper A PREP-A-09/11); extra 24h token class | Yes until a reviewed adapter proves bind |
| **D-PR7-03** | Receipts as audit? | **No** | unchanged No | — | Yes |
| **D-PR7-04** | First owner | Same-context verified `account_owner`; unsafe correlation → unassigned | First-login withdrawn (already) | Recovery pending until owner session | Yes |
| **D-PR7-05** | redact vs reinstall | Separate delivery/work/generation; old receipts never exempt new work | HMAC work key → **classifier §7.6.1** | Ambiguous cases ESCALATED; 30d clock remains | Yes |
| **D-PR7-06** | afterAuth REDACTED | No revival of ERASING/FINALIZING; fresh install after ERASE | Timestamp/blacklist withdrawn | Bootstrap fence hook required | Yes |
| **D-PR7-07** | Gate merchandising? | **No** in PR7 | unchanged | Avoid 403 during owner_pending | Frozen **No** |
| **D-PR7-08** | Audit vs redact | Runtime append-only; coordinator while disabled; restricted DELETE; Q-008 limits | In-place UPDATE withdrawn | Privacy policies additive | Yes |
| **D-PR7-09** | Pause | Privacy-local default OFF; intake/deadlines continue | Flag home specified | Clock not waived | Frozen home |
| **D-PR7-10** | Redis / coordinator | Privacy coordinator is **not** a Shop-linked DurableJob. Redis hint optional; poll recovers. `Job.remove`/TTL/PID/`quiescenceConfirmed` are **not** drain (PR48). Do not auto-call D reclaim from PR7. No FLUSHALL | Privacy-through-DurableJob withdrawn (Decision B) | Active locked jobs can write after remove; PREP_B_19 cross-process reclaim hazard | Yes |
| **D-PR7-11** | Delete Shop? | Checked finalizer function + FK map + recovery | Unspecified DELETE → **named function** | Irreversible | Yes |
| **D-PR7-12** | Revoke mid-job | Advisory `stocky_authz_lock` + SELECT-only verifier on CP txn; stable `commandId`; no cross-role atomicity | `FOR UPDATE` helper withdrawn (Decision C / XC-05/07) | Cooperative locks; named writers only | Yes |
| **D-PR7-13** | DB roles | Per-topic reader/erasure policies + complete grant catalogue; no processingEnabled on privacy; no runtime exception | Whole-shop-only helper withdrawn (Decision A / XC-01/03) | New roles/helpers/EXECUTE | Yes |
| **D-PR7-14** | data_request | Distinct owner-only download; operator fallback if uninstalled; not generic export | shop_admin export contradiction withdrawn | Uninstall fulfillment path | Align before runtime |
| **CC-GEN** | Customer-target identity | Generation-independent canonical-domain × kind:value lock; trusted origin; no `ORDER BY id` | shop/generation lock + lexicographic resolver → **namespace lock + unique LIVE/declared origin** | Multi-generation shops no longer bypass barriers; successor writes remain possible when uniquely proven | Yes |
| **Q-008** | Retention language | OPEN | OPEN | Production blocker | Production |

**Remaining explicit residuals (not hidden as “implementation detail”):**

1. Live Shopify / App Bridge ID-token bind and a **reviewed** online-token enabling proposal (per-user cache isolation, dest/iss, old-session migration). Helper A verified `sessionToken.sub` with online tokens **OFF** on mocked transport — that does **not** certify live Shopify or a safe online-token rollout (**UNVERIFIED** PREP-A-16 / PREP-A-07).
2. Whether every compliance delivery includes `X-Shopify-Event-Id` (**OFFICIAL** general header list vs **UNVERIFIED** on this topic). Missing event id is handled (nullable).
3. Accepted D scratch reclamation API after D merge; infeasible → named follow-up, not skip.
4. Q-008 counsel holds.
5. `BOUNDED_CHECKPOINT_RETRY` is **not** required for privacy (Decision B). If used later for ordinary jobs, it needs a Prisma enum migration in an implementation PR — not this packet.
6. Installed-library `sessionToken.sub` / online `associated_user` bind proof remains an **implementation acceptance gate**. Missing `node_modules` in a planning environment is neither a pass nor proof of a defect.
7. Redis/export/D-scratch fences are **not** proven by the disposable PostgreSQL model (G5 LIMIT).

---

## 10. Conditions under which a future PR7 implementation may begin

**P7-C06.** This assignment does **not** authorize a V-only alternate base.

1. ChatGPT accepts this **CC-GEN / W-integration / entry-evidence** plan + matrix after independent Claude Code re-review of this exact head with no unresolved P0/P1/P2.
2. Constrained D-PR7 items remain constrained; residuals in §9 are either accepted as implementation proofs or separately decided. Do not certify a missing online binding or cross-system fence.
3. Phase 1 PR6 independently accepted and formally closed on merged `origin/main`. W is merged D runtime; unmerged PR47 closeout packaging is **not** that formal close. Implementation branches from accepted closed main, not from this planning SHA.
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
| Starting subject **S** | `a292bc8a6ea26192bc295af7338dd6d653a3e65c` |
| CC review **FF** | `c7b47807083bfad8e7e3a7504e826027e56b7a32`; sole parent S; one-file add of `PR7_CUSTOMER_COMPLETION_CORRECTION_INDEPENDENT_REVIEW.md`; blob `e908770d9daea4f963b2fd09e38af79e07274d41` |
| W merge (history-preserving, `--no-ff`) | `0b21604eabff392aa25866732045dfd4b1041bf0` parents `c7b4780…` + `ee193f3…` |
| Prior review blobs | `c1fa5c2fed74bf80d1006267b43d767258895c17`, `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f`, `e609e9526ed1ec043551ca68d6b977f5b5935d0c` **unchanged** |
| Base **V** (historical) | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Merged main **W** | `ee193f38491245a10fb2fa60d2cf9a29f3271605` |
| Entry-evidence **PR48** | `275292d19b583c04c3afe01ef7d9feb48fee0f6c` (latest on `planning/pr7-entry-evidence-20260919-37c6` at this correction; **no later source-preservation revision**) |
| IEEE-754 probe | **executed-prior-planning-head-not-re-run**; `Number("9007199254740993")===9007199254740992` (Node `v22.14.0`) |
| `npm run test:privacy` | **executed-prior-planning-head-not-re-run** (exit 1, missing script on V). Missing script is an implementation gate, not a planning defect |
| Old-model CE-1 / CE-6 | **executed-prior-planning-head-not-re-run** on the **unchanged** 59-case scripts (hashes `b29ef463…` / `d0d84842…` / `69005537…`). Preserved identities; not re-run this packet |
| Old-model CE-A / CE-B / CE-C | **executed-this-planning-session** on the **unchanged** TF contract (`75ab1c02…349846de`) + TF driver (`566e0f28…`) **before** loading this contract. Host `/tmp/pr45-cc-pg16:5434`. Repro script sha256 `2f732e1c1b91aab76e3f715e4f15c1216a5476dd297110b91e6b41fd5ac7f990`. CE log sha256 `c1077d531a435b7536c8e9f07c83743c413fb054b749fa7f5f3fbac52df9991f`. CE-A: baseline deny; after `gen_a_zz` matching write **admitted** (defect). CE-B: baseline restore_denied; delayed pre-erasure payload **admitted** after `gen_a_zz` (defect). CE-C: no-GUC residual `0`, matching GUC `3`, foreign GUC `0`; complete shielded by enumerator (`enumerator_request_guc_mismatch`) — latent P2, **not** a live false-complete |
| Disposable PostgreSQL 16 proofs (corrected contract) | **executed-this-planning-session** — **169 records / 169 PASS / 0 FAIL** = **117 unique assertions** + **52 declared reruns** (G7×14 + G8×7 + G9×9 + G11×12 + G12×10). Unique G1–G6 = 59 preserved. Host `/tmp/pr45-cc-pg16:5434` (`PROOF_ROOT=/tmp/pr45-cc-new`). `server_version` / `server_version_num` **queried** (`16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)` / `160015`). Not PR7 runtime. Leftover TF cluster `/tmp/pr45-pg16:5433` was **not** stopped |
| Redis / filesystem / Shopify / live token exchange | **not executed** — G5 still records CP uninstrumented-write LIMIT; I/O fences remain unexecuted; Helper A / coordinator PREP rows are **FACT (PR48)** synthetic probes, not this session |
| Official fetches | §3 URLs, **2026-09-18** |
| Store calls | not executed |
| Review artifacts edited | **No** |

Failed proof attempts (this CC pass, not hidden): residual definer initially lacked `EXECUTE` on `stocky_privacy_capability_allows` (`42501`); GRANT to `stocky_privacy_target_owner` entered the declared contract. G12 genuine-empty first used an RLS-filtered erasure `DELETE` so the count stayed `3`; driver now deletes as `pr45owner` BYPASSRLS then residual-counts `0`. First assemble of the inventory `VALUES` missed `processing_enabled_on_v` (length mismatch) before the clean contract. No hidden GRANT, dropped FK, or repaired driver is credited to an **unchanged** contract. NEG replaces one function at a time, demonstrates the safety property failing, then `reset()` reloads the declared contract.

Historical TF 115-record packet remains original-run identity for S (**not** this contract): **115 records = 89 unique + 26 declared G7–G9 reruns** (do **not** read 115 unique). TF contract `75ab1c02fc01560d975a78737bccbc7c2fa6330a07100ad98d2b243d349846de`; TF driver `566e0f289f2ca4da526286b3ca831c906030973958318eb60b55a0237823251a`; TF run log `006e5799544c0ae2368a75e50fbbfdee77b43b816d9cd490c5c2f5d140e94344`.

Historical 59-case identities remain original-run identities: `01_contract.sql` `b29ef463c26a9a3ad745fc7a56bc40901ced1c55429a59c441d89634858db054`; `02_seed.sql` `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632`; `03_run_proofs.py` `6900553779c3d2e8237fc189fcad42a1810262d3110ab60f30ab32208667ebb4`; original `results.json` `ecc9acd1d59cda2d9d5910b46e9ffa1766c4e29c3671ceda270dea98d80303b8` (run log; reviewer independent log `185dd1b8…`).

Environment: Node `v22.14.0`, Python `3.12.3`, PostgreSQL **queried** `16.15` (disposable `initdb` / `pg_ctl`, **port 5434**, roles as named principals). System cluster was not used. Teardown: `dropdb pr45_proof`; `pg_ctl stop` of this CC cluster is **not** required to leave it for inspection. Do **not** stop another helper’s leftover TF postgres on 5433.

## 13. Cross-check to the acceptance matrix

| Plan section | Matrix IDs |
|---|---|
| Actor / owner / wide id / mixedToken / dest-iss | PR7-ACT-001…025 |
| Permission / replay locks / export split | PR7-RBAC-001…021, PR7-CUST-006/011/012 |
| Audit / coordinator / privacy RLS | PR7-AUD-001…014, PR7-SIDE-009/010 |
| Classifier / fence / crash | PR7-LIFE-001…024, PR7-RED-001…021 |
| Intake / pause / 180-day | PR7-PRIV-001…014, PR7-CUST-013 |
| Coordinator (Decision B) | PR7-COORD-* (PR7-PRIV-015…018 original DurableJob path **withdrawn as required**, meaning preserved) |
| Topic authority / grants | PR7-TOP-*, PR7-GRANT-* |
| Authz lock / command | PR7-AUTHZ-*, PR7-CMD-* |
| Lifecycle gate / tombstone | PR7-GATE-*, PR7-TOMB-* |
| Customer completion / epoch / inventory | PR7-TOP-015…, PR7-COORD-PUB-*, PR7-GATE-009…, **F-CLAUDE-PR7TF-01…04** |
| Generation-independent target / residual own GUC | PR7-CUST-025…, PR7-TOP-018…, PR7-RESID-*, G11, G12, NEG-4/5, **F-CLAUDE-PR7CC-01…04** / **CC-GEN** |
| Escalation | PR7-ESCL-001…004 |
| Finding crosswalk | §1.2, §1.3, §1.4, §1.5 and matrix §11–§12.2 |

If a matrix row cites a path, that path is listed in §4 or §7.9.

## 14. Disposable feasibility proof (not repository runtime)

**CONSTRAINED** scripts below are extracted from this contract. They were executed in a disposable PostgreSQL 16 cluster. They are **not** PR7 migrations and must not be applied to the application database.

| File | SHA-256 | Role |
|---|---|---|
| `01_contract.sql` | `7a1d461182ab4b3ab066747cbad73d8d586d19a566cc61dbdebb38452dc4544c` | Proposed DDL/roles/policies/helpers (this CC-GEN / W correction) |
| `02_seed.sql` | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` | Synthetic two-shop / two-customer fixture (`pr45owner` BYPASSRLS **load only**; **byte-identical** to the 59-case and TF packets) |
| `03_run_proofs.py` | `e9bd3c187451ea989fcf1b0a6c1385f3e4d93281744127d44b46621f97001f34` | Concurrency/permission driver; `PROOF_ROOT` / `PGHOST` / `PGPORT`; G1–G12 + NEG; clean G7–G9/G11/G12 rerun |
| `results.json` | **run log, not a verification artifact** (timings/environment). This-run digest `420ec6e0cb231a43bed36dc850c478b3587f097643b477daeb6695318bd094d8` is an original-run identity only |

Historical TF identities (S / independently reproduced head; **not** this contract): contract `75ab1c02…349846de`, seed `d0d84842…4084f632`, driver `566e0f28…7823251a`, Cursor run log `006e5799…`. Historical 59-case identities: contract `b29ef463…858db054`, driver `69005537…08667ebb4`, Cursor run log `ecc9acd1…`, reviewer run log `185dd1b8…`.

Clean-fixture result: **169 records / 169 PASS / 0 FAIL** = **117 unique** + **52 declared reruns**. Unique G1–G6 = 59. New unique this packet = 28 (G9 +4 W-required-symbol controls; G11 12; G12 10; NEG +2). Driver queries `current_setting('server_version')` and `server_version_num`. Do **not** label 169 or 115 as unique-assertion counts.

Reproduction is **self-contained**. Stage the three Appendix scripts into an owned `PROOF_ROOT` (the driver defaults to its own directory). Do **not** hardcode `/tmp/pr45-tf`. Do **not** stop a leftover helper cluster on 5433.

```bash
export PROOF_ROOT=/tmp/pr45-cc-new
export PGHOST=/tmp/pr45-cc-pg16
export PGPORT=5434
# Copy Appendix A/B/C bytes into $PROOF_ROOT/{01_contract.sql,02_seed.sql,03_run_proofs.py}
# sha256sum must match the table above.
initdb -D "$PGHOST"
pg_ctl -D "$PGHOST" -o "-p $PGPORT -k $PGHOST" start
createuser -h "$PGHOST" -p "$PGPORT" pr45owner
createdb  -h "$PGHOST" -p "$PGPORT" -U pr45owner pr45_proof
python3 "$PROOF_ROOT/03_run_proofs.py"   # dropdb/createdb + both SQL files + G1–G12 + NEG + clean rerun
# Old CE-A/B/C (optional; uses the *unchanged TF* contract, not this one):
# python3 /path/to/repro_old_ce.py
dropdb -h "$PGHOST" -p "$PGPORT" -U pr45owner --if-exists pr45_proof
```

Permission assertions used `stocky_runtime`, `stocky_control_plane`, `stocky_privacy_reader`, `stocky_privacy_erasure`, `stocky_privacy_operator`. Setup used isolated `pr45owner`. No hidden GRANT, policy drop, or role switch is omitted from Appendix A.

**Unexecuted limits:** Redis job drain, export publication, D scratch reclamation, live Shopify, installed `node_modules` `authenticate.admin` live bind, PR7 processors. This SQL model does **not** execute Redis, filesystem, or authentication implementation obligations. Do not certify a missing online binding or cross-system fence.

### Appendix A — `01_contract.sql`

```sql
-- PR45 / PR7 disposable PostgreSQL 16 feasibility contract (CC-GEN / W inventory)
-- Transcribed from the proposed final planning contract. Isolated owner: pr45owner.
-- search_path locked on every SECURITY DEFINER function. NO hidden GRANT.
-- PUBLIC EXECUTE revoked. No BYPASSRLS. FORCE RLS on merchant tables.

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

CREATE TABLE public."JobDispatch" (
  id text PRIMARY KEY,
  "shopId" text NOT NULL REFERENCES public."Shop"(id) ON DELETE RESTRICT,
  "durableJobId" text NOT NULL REFERENCES public."DurableJob"(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'PENDING_ENQUEUE'
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
  "installedAt" timestamptz NOT NULL DEFAULT now(),
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
  "publicationRevision" bigint NOT NULL DEFAULT 0,
  "completeRetryCount" int NOT NULL DEFAULT 0,
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

-- Target-scoped customer-erasure barrier. Keys are shop/generation + customer/order
-- identities ordinary writers can compute. Not keyed by privacy request id.
CREATE TABLE public."PrivacyCustomerTargetBarrier" (
  id bigserial PRIMARY KEY,
  "shopId" text NOT NULL,
  "generationId" text NOT NULL,
  "targetKind" text NOT NULL,
  "targetValue" text NOT NULL,
  "privacyRequestId" text NOT NULL REFERENCES public."PrivacyRequest"(id),
  "attemptId" text NOT NULL,
  "publicationRevision" bigint NOT NULL DEFAULT 0,
  state text NOT NULL CHECK (state IN ('ACTIVE','RELEASED')),
  "installedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "releasedAt" timestamptz
);
CREATE UNIQUE INDEX privacy_customer_barrier_active
  ON public."PrivacyCustomerTargetBarrier" ("shopId", "generationId", "targetKind", "targetValue")
  WHERE state = 'ACTIVE';

-- Minimized post-completion suppression for queued/replayed pre-erasure payloads.
-- Not lifetime suppression of legitimate later customer data (Q-008 OPEN).
CREATE TABLE public."PrivacyCompletedTarget" (
  "shopId" text NOT NULL,
  "generationId" text NOT NULL,
  "targetKind" text NOT NULL,
  "targetValue" text NOT NULL,
  "privacyRequestId" text NOT NULL,
  "completedAt" timestamptz NOT NULL,
  PRIMARY KEY ("shopId", "generationId", "targetKind", "targetValue", "privacyRequestId")
);

CREATE TABLE public."ParticipatingWriteStamp" (
  id bigserial PRIMARY KEY,
  "shopId" text NOT NULL,
  symbol text NOT NULL,
  guarded boolean NOT NULL,
  at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public."ParticipatingWriterInventory" (
  file_path text NOT NULL,
  symbol text NOT NULL,
  transaction_host text NOT NULL,
  role_name text NOT NULL,
  surfaces text NOT NULL,
  target_key_derivation text NOT NULL,
  guard_lock_order text NOT NULL,
  processing_enabled_on_v text NOT NULL,
  already_running_outcome text NOT NULL,
  disabled_frozen_behavior text NOT NULL,
  integration_test_home text NOT NULL,
  PRIMARY KEY (file_path, symbol)
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

CREATE OR REPLACE FUNCTION public.stocky_privacy_publication_lock(p_request_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_request_id IS NULL OR p_request_id = '' THEN
    RAISE EXCEPTION 'publication_lock_missing_request' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(1347573556, hashtext('pr7-pub-v1:' || p_request_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_live_attempt_ok(
  p_request_id text,
  p_attempt_id text
) RETURNS boolean
LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  a public."PrivacyAttempt"%ROWTYPE;
BEGIN
  IF p_request_id IS NULL OR p_attempt_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO a FROM public."PrivacyAttempt" WHERE id = p_attempt_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF a."privacyRequestId" IS DISTINCT FROM r.id THEN RETURN false; END IF;
  IF r."activeAttemptId" IS DISTINCT FROM a.id THEN RETURN false; END IF;
  IF a.state NOT IN ('LEASED','RUNNING') THEN RETURN false; END IF;
  IF a."leaseUntil" IS NULL OR a."leaseUntil" <= clock_timestamp() THEN RETURN false; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_enumerate_targets(p_request_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  v_req text := NULLIF(current_setting('stocky.privacy_request_id', true), '');
  v_att text := NULLIF(current_setting('stocky.privacy_attempt_id', true), '');
  oid text;
  n int;
  missing int := 0;
  new_rev bigint;
BEGIN
  IF p_request_id IS DISTINCT FROM v_req THEN
    RAISE EXCEPTION 'enumerator_request_guc_mismatch' USING ERRCODE = '42501';
  END IF;

  -- Serialize against claim/takeover. Re-validate after the wait using clock_timestamp().
  PERFORM public.stocky_privacy_publication_lock(p_request_id);

  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'enumerator_request_missing' USING ERRCODE = '42501';
  END IF;
  IF v_att IS NULL OR NOT public.stocky_privacy_live_attempt_ok(r.id, v_att) THEN
    RAISE EXCEPTION 'enumerator_stale_attempt' USING ERRCODE = '42501';
  END IF;

  -- Conditional revision bump first. If this UPDATE matches 0 rows, leave keys
  -- and flags byte-identical (no check-then-act DELETE).
  UPDATE public."PrivacyRequest"
    SET "publicationRevision" = "publicationRevision" + 1
    WHERE id = r.id
      AND "activeAttemptId" = v_att
      AND state IN ('RECEIVED','AUTHENTICATED','ENUMERATING','APPLYING','CHECKPOINTING','FINALIZING')
    RETURNING "publicationRevision" INTO new_rev;
  IF new_rev IS NULL THEN
    RAISE EXCEPTION 'enumerator_stale_attempt' USING ERRCODE = '42501';
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
      WHERE id = r.id AND "activeAttemptId" = v_att AND "publicationRevision" = new_rev;
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
    WHERE id = r.id AND "activeAttemptId" = v_att AND "publicationRevision" = new_rev;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'enumerator_stale_attempt' USING ERRCODE = '42501';
  END IF;
END;
$$;

ALTER FUNCTION public.stocky_privacy_capability_allows(text, text) OWNER TO stocky_privacy_capability_owner;
ALTER FUNCTION public.stocky_privacy_row_in_manifest(text, text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_enumerate_targets(text) OWNER TO stocky_privacy_target_owner;

REVOKE ALL ON FUNCTION public.stocky_privacy_capability_allows(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_row_in_manifest(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_enumerate_targets(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_publication_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_live_attempt_ok(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stocky_privacy_capability_allows(text, text) TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_row_in_manifest(text, text) TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_enumerate_targets(text) TO stocky_privacy_reader, stocky_privacy_erasure, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_publication_lock(text) TO stocky_privacy_reader, stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_live_attempt_ok(text, text) TO stocky_privacy_reader, stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;

GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt", public."ShopInstallGeneration" TO stocky_privacy_capability_owner;
GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt", public."PrivacyTargetKey", public."ShopInstallGeneration" TO stocky_privacy_target_owner;
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
BEGIN
  -- Namespace freeze: ANY ERASING/FINALIZING generation. Never ORDER BY id.
  -- LIVE + ERASING coexistence is fail-closed frozen (no guessed successor write).
  RETURN NOT EXISTS (
    SELECT 1 FROM public."ShopInstallGeneration"
    WHERE "canonicalDomain" = p_canonical_domain
      AND fence IN ('ERASING','FINALIZING')
  );
END;
$$;

ALTER FUNCTION public.stocky_lifecycle_shared_lock(text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_lifecycle_exclusive_lock(text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_generation_writable(text) OWNER TO stocky_lifecycle_gate_owner;
REVOKE ALL ON FUNCTION public.stocky_lifecycle_shared_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_lifecycle_exclusive_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_generation_writable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_shared_lock(text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_reader, stocky_privacy_target_owner;
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
  public."WebhookDelivery", public."JobDispatch", public."SyncApplicationReceipt", public."DispatchReadyShop",
  public."Session", public."PrivacyRequest", public."PrivacyAttempt",
  public."PrivacyCoordinatorEvent", public."PrivacyCompletionReceipt",
  public."PrivacyDeliveryTombstone", public."PlatformReplayCommand",
  public."ShopInstallGeneration", public."ParticipatingWriteStamp"
TO stocky_control_plane;
GRANT SELECT ON public."PrivacyTargetKey" TO stocky_control_plane;
GRANT SELECT ON public."PrivacyCustomerTargetBarrier", public."PrivacyCompletedTarget", public."ParticipatingWriterInventory" TO stocky_control_plane;
GRANT USAGE, SELECT ON SEQUENCE public."PrivacyCoordinatorEvent_id_seq" TO stocky_control_plane;
GRANT USAGE, SELECT ON SEQUENCE public."ParticipatingWriteStamp_id_seq" TO stocky_control_plane;

GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt", public."ShopInstallGeneration" TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT SELECT ON public."Shop" TO stocky_privacy_reader, stocky_privacy_erasure;

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- CC-GEN customer-target barrier, trusted origin, source-derived residual
-- ns 1347573555 = canonical tenant namespace × kind/value (NOT generation)
-- Generation remains immutable evidence on barrier / completed-target / request.
-- Global lock order: lifecycle domain (1347573553) → publication (1347573556)
--   → authz (1347573554) → customer-target (1347573555). Never lookup-then-lock.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_customer_target_lock_key1(p_canonical_domain text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT hashtext('pr7-ctgt-v2:' || p_canonical_domain); $$;

CREATE OR REPLACE FUNCTION public.stocky_customer_target_lock_key2(p_kind text, p_value text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT hashtext(p_kind || ':' || p_value); $$;

CREATE OR REPLACE FUNCTION public.stocky_customer_target_lock_shared(
  p_canonical_domain text, p_kind text, p_value text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(
    public.stocky_customer_target_lock_key1(p_canonical_domain),
    public.stocky_customer_target_lock_key2(p_kind, p_value)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_customer_target_lock_exclusive(
  p_canonical_domain text, p_kind text, p_value text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    public.stocky_customer_target_lock_key1(p_canonical_domain),
    public.stocky_customer_target_lock_key2(p_kind, p_value)
  );
END;
$$;

-- Unique canonical-namespace resolver. Never ORDER BY id. Fail missing/ambiguous.
CREATE OR REPLACE FUNCTION public.stocky_shop_canonical_domain(
  p_shop_id text,
  p_declared_domain text
) RETURNS text
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_domain text;
  n int;
BEGIN
  IF p_shop_id IS NULL OR p_shop_id = '' THEN
    RAISE EXCEPTION 'customer_write_namespace_missing' USING ERRCODE = 'P0001';
  END IF;
  SELECT COUNT(DISTINCT d.domain), MIN(d.domain) INTO n, v_domain
  FROM (
    SELECT g."canonicalDomain" AS domain
    FROM public."ShopInstallGeneration" g
    WHERE g."targetShopId" = p_shop_id OR g."shopRowId" = p_shop_id
    UNION
    SELECT s."myshopifyDomain"
    FROM public."Shop" s
    WHERE s.id = p_shop_id
  ) d;
  IF n = 0 OR v_domain IS NULL THEN
    RAISE EXCEPTION 'customer_write_namespace_missing' USING ERRCODE = 'P0001';
  END IF;
  IF n > 1 THEN
    RAISE EXCEPTION 'customer_write_namespace_ambiguous' USING ERRCODE = 'P0001';
  END IF;
  IF p_declared_domain IS NOT NULL AND p_declared_domain IS DISTINCT FROM v_domain THEN
    RAISE EXCEPTION 'customer_write_namespace_mismatch' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_domain;
END;
$$;

-- Trusted origin: declared persisted generation, or unique LIVE shop binding.
-- Never ORDER BY id. Old work must not adopt a newer generation.
CREATE OR REPLACE FUNCTION public.stocky_writer_origin_generation(
  p_shop_id text,
  p_declared_generation_id text,
  p_canonical_domain text
) RETURNS text
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  g public."ShopInstallGeneration"%ROWTYPE;
  v_id text;
  n int;
BEGIN
  IF p_declared_generation_id IS NOT NULL AND p_declared_generation_id <> '' THEN
    SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = p_declared_generation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'customer_write_origin_missing' USING ERRCODE = 'P0001';
    END IF;
    IF g."canonicalDomain" IS DISTINCT FROM p_canonical_domain THEN
      RAISE EXCEPTION 'customer_write_origin_namespace_mismatch' USING ERRCODE = 'P0001';
    END IF;
    RETURN g.id;
  END IF;
  SELECT COUNT(*), MIN(gg.id) INTO n, v_id
  FROM public."ShopInstallGeneration" gg
  WHERE gg."canonicalDomain" = p_canonical_domain
    AND gg.fence = 'LIVE'
    AND (gg."shopRowId" = p_shop_id OR gg."targetShopId" = p_shop_id);
  IF n = 0 THEN
    RAISE EXCEPTION 'customer_write_origin_missing' USING ERRCODE = 'P0001';
  END IF;
  IF n > 1 THEN
    RAISE EXCEPTION 'customer_write_origin_ambiguous' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_customer_targets_for_request(p_request_id text)
RETURNS TABLE(kind text, value text)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT 'CUSTOMER_REST_ID'::text, r."lookupCustomerRestId"
  FROM public."PrivacyRequest" r
  WHERE r.id = p_request_id AND r."lookupCustomerRestId" IS NOT NULL
  UNION ALL
  SELECT 'ORDER_LEGACY_ID'::text, oid
  FROM public."PrivacyRequest" r
  CROSS JOIN LATERAL unnest(COALESCE(r."lookupOrderLegacyIds", '{}')) AS oid
  WHERE r.id = p_request_id;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_install_customer_barrier(
  p_request_id text,
  p_attempt_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  g public."ShopInstallGeneration"%ROWTYPE;
  tgt record;
BEGIN
  PERFORM public.stocky_privacy_publication_lock(p_request_id);
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'barrier_request_missing' USING ERRCODE = 'P0001'; END IF;
  IF r.topic IS DISTINCT FROM 'customers/redact' THEN
    RAISE EXCEPTION 'barrier_not_customer_redact' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.stocky_privacy_live_attempt_ok(r.id, p_attempt_id) THEN
    RAISE EXCEPTION 'barrier_stale_attempt' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = r."generationId";
  IF NOT FOUND THEN RAISE EXCEPTION 'barrier_generation_missing' USING ERRCODE = 'P0001'; END IF;
  -- Domain shared, not exclusive: do not freeze the shop.
  PERFORM public.stocky_lifecycle_shared_lock(g."canonicalDomain");
  IF g.fence IN ('ERASING','FINALIZING') THEN
    RAISE EXCEPTION 'superseded_by_shop_erasure' USING ERRCODE = 'P0001';
  END IF;
  IF g.fence NOT IN ('LIVE','UNINSTALLED') THEN
    RAISE EXCEPTION 'barrier_generation_ineligible' USING ERRCODE = 'P0001';
  END IF;

  -- Lock BEFORE any barrier lookup/insert (no publication race).
  FOR tgt IN
    SELECT src.kind, src.value FROM public.stocky_customer_targets_for_request(r.id) AS src ORDER BY src.kind, src.value
  LOOP
    PERFORM public.stocky_customer_target_lock_exclusive(g."canonicalDomain", tgt.kind, tgt.value);
  END LOOP;

  INSERT INTO public."PrivacyCustomerTargetBarrier"(
    "shopId","generationId","targetKind","targetValue","privacyRequestId","attemptId","publicationRevision",state
  )
  SELECT r."targetShopId", r."generationId", src.kind, src.value, r.id, p_attempt_id, r."publicationRevision", 'ACTIVE'
  FROM public.stocky_customer_targets_for_request(r.id) AS src
  WHERE NOT EXISTS (
    SELECT 1 FROM public."PrivacyCustomerTargetBarrier" b
    WHERE b."shopId" = r."targetShopId"
      AND b."generationId" = r."generationId"
      AND b."targetKind" = src.kind
      AND b."targetValue" = src.value
      AND b.state = 'ACTIVE'
  );

  UPDATE public."PrivacyCustomerTargetBarrier" b
    SET state='ACTIVE', "attemptId"=p_attempt_id, "releasedAt"=NULL,
        "publicationRevision"=r."publicationRevision"
    WHERE b."privacyRequestId"=r.id AND b.state='RELEASED';
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_customer_write_guard(
  p_canonical_domain text,
  p_shop_id text,
  p_kind text,
  p_value text,
  p_payload_admitted_at timestamptz,
  p_origin_generation_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_domain text;
  n int;
  ct record;
  v_origin text;
  og public."ShopInstallGeneration"%ROWTYPE;
  cg public."ShopInstallGeneration"%ROWTYPE;
  live_n int;
BEGIN
  v_domain := public.stocky_shop_canonical_domain(p_shop_id, p_canonical_domain);
  -- Lock BEFORE examining barriers (Decision CC-GEN).
  PERFORM public.stocky_customer_target_lock_shared(v_domain, p_kind, p_value);

  SELECT count(*) INTO n
  FROM public."PrivacyCustomerTargetBarrier" b
  JOIN public."ShopInstallGeneration" bg ON bg.id = b."generationId"
  WHERE bg."canonicalDomain" = v_domain
    AND b."targetKind" = p_kind
    AND b."targetValue" = p_value
    AND b.state = 'ACTIVE';
  IF n > 0 THEN
    RAISE EXCEPTION 'customer_target_erasing' USING ERRCODE = 'P0001';
  END IF;

  FOR ct IN
    SELECT c."generationId" AS completed_generation_id, c."completedAt" AS completed_at
    FROM public."PrivacyCompletedTarget" c
    JOIN public."ShopInstallGeneration" cg0 ON cg0.id = c."generationId"
    WHERE cg0."canonicalDomain" = v_domain
      AND c."targetKind" = p_kind
      AND c."targetValue" = p_value
  LOOP
    IF p_payload_admitted_at >= ct.completed_at THEN
      CONTINUE;
    END IF;
    IF v_origin IS NULL THEN
      v_origin := public.stocky_writer_origin_generation(p_shop_id, p_origin_generation_id, v_domain);
    END IF;
    IF v_origin = ct.completed_generation_id THEN
      RAISE EXCEPTION 'customer_target_restore_denied' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO og FROM public."ShopInstallGeneration" WHERE id = v_origin;
    SELECT * INTO cg FROM public."ShopInstallGeneration" WHERE id = ct.completed_generation_id;
    SELECT count(*) INTO live_n
    FROM public."ShopInstallGeneration"
    WHERE "canonicalDomain" = v_domain AND fence = 'LIVE';
    IF live_n <> 1 OR og.fence IS DISTINCT FROM 'LIVE' OR cg.fence = 'LIVE' THEN
      RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
    END IF;
    IF p_payload_admitted_at < og."installedAt" THEN
      RAISE EXCEPTION 'customer_target_restore_denied' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_fact_write_guard(
  p_canonical_domain text,
  p_shop_id text,
  p_kind text,
  p_value text,
  p_payload_admitted_at timestamptz,
  p_origin_generation_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.stocky_participating_write_guard(p_canonical_domain);
  PERFORM public.stocky_customer_write_guard(
    p_canonical_domain, p_shop_id, p_kind, p_value, p_payload_admitted_at, p_origin_generation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_customer_residual_count(p_request_id text)
RETURNS bigint
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  v_req text := NULLIF(current_setting('stocky.privacy_request_id', true), '');
  v_shop text := NULLIF(current_setting('stocky.current_shop_id', true), '');
  v_att text := NULLIF(current_setting('stocky.privacy_attempt_id', true), '');
  audit_n bigint := 0;
  order_n bigint := 0;
  line_n bigint := 0;
BEGIN
  -- Own preconditions BEFORE any RLS-filtered count (CC-02). Do not depend on enumerate.
  IF v_req IS DISTINCT FROM p_request_id THEN
    RAISE EXCEPTION 'residual_request_guc_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'residual_request_missing' USING ERRCODE = 'P0001';
  END IF;
  IF v_shop IS DISTINCT FROM r."targetShopId" THEN
    RAISE EXCEPTION 'residual_tenant_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_att IS NULL OR NOT public.stocky_privacy_live_attempt_ok(r.id, v_att) THEN
    RAISE EXCEPTION 'residual_stale_attempt' USING ERRCODE = '42501';
  END IF;
  IF NOT public.stocky_privacy_capability_allows('READ', r."targetShopId") THEN
    RAISE EXCEPTION 'residual_capability_denied' USING ERRCODE = '42501';
  END IF;
  IF r."lookupCustomerRestId" IS NOT NULL THEN
    SELECT count(*) INTO audit_n
    FROM public."AuditEvent" a
    WHERE a."shopId" = r."targetShopId"
      AND a."customerRestId" = r."lookupCustomerRestId";
  END IF;
  SELECT count(*) INTO order_n
  FROM public."ShopifyOrderFact" f
  WHERE f."shopId" = r."targetShopId"
    AND f."shopifyLegacyResourceId" = ANY (COALESCE(r."lookupOrderLegacyIds", '{}'));
  SELECT count(*) INTO line_n
  FROM public."ShopifyOrderLineFact" l
  WHERE l."shopId" = r."targetShopId"
    AND l."shopifyOrderGid" IN (
      SELECT 'gid://shopify/Order/' || oid
      FROM unnest(COALESCE(r."lookupOrderLegacyIds", '{}')) AS oid
    );
  RETURN audit_n + order_n + line_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_complete_customer_redact(
  p_request_id text,
  p_attempt_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  g public."ShopInstallGeneration"%ROWTYPE;
  tgt record;
  residual bigint;
  max_retries int := 5;
BEGIN
  PERFORM public.stocky_privacy_publication_lock(p_request_id);
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN 'stale'; END IF;
  IF r.topic IS DISTINCT FROM 'customers/redact' THEN
    RAISE EXCEPTION 'complete_not_customer_redact' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.stocky_privacy_live_attempt_ok(r.id, p_attempt_id) THEN
    RETURN 'stale';
  END IF;
  SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = r."generationId";
  IF NOT FOUND THEN RETURN 'stale'; END IF;
  IF g.fence IN ('ERASING','FINALIZING') THEN
    RETURN 'superseded';
  END IF;

  FOR tgt IN
    SELECT src.kind, src.value FROM public.stocky_customer_targets_for_request(r.id) AS src ORDER BY src.kind, src.value
  LOOP
    PERFORM public.stocky_customer_target_lock_exclusive(g."canonicalDomain", tgt.kind, tgt.value);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.stocky_customer_targets_for_request(r.id) AS src
    WHERE NOT EXISTS (
      SELECT 1 FROM public."PrivacyCustomerTargetBarrier" b
      WHERE b."shopId" = r."targetShopId"
        AND b."generationId" = r."generationId"
        AND b."targetKind" = src.kind
        AND b."targetValue" = src.value
        AND b.state = 'ACTIVE'
        AND b."privacyRequestId" = r.id
        AND b."attemptId" = p_attempt_id
    )
  ) THEN
    RETURN 'stale';
  END IF;

  PERFORM public.stocky_privacy_enumerate_targets(p_request_id);

  residual := public.stocky_privacy_customer_residual_count(p_request_id);
  IF residual > 0 THEN
    UPDATE public."PrivacyRequest"
      SET "completeRetryCount" = "completeRetryCount" + 1,
          state = CASE WHEN "completeRetryCount" + 1 >= max_retries THEN 'ESCALATED' ELSE 'CHECKPOINTING' END
      WHERE id = r.id AND "activeAttemptId" = p_attempt_id;
    IF residual > 0 AND (SELECT "completeRetryCount" FROM public."PrivacyRequest" WHERE id = r.id) >= max_retries THEN
      RETURN 'budget_exhausted';
    END IF;
    RETURN 'remnants';
  END IF;

  INSERT INTO public."PrivacyCompletionReceipt"(id,"privacyRequestId","generationId","targetShopIdHmac")
    VALUES ('rcpt_'||p_request_id, p_request_id, r."generationId", 'hmac:'||r."targetShopId")
    ON CONFLICT ("privacyRequestId") DO NOTHING;

  INSERT INTO public."PrivacyCompletedTarget"(
    "shopId","generationId","targetKind","targetValue","privacyRequestId","completedAt"
  )
  SELECT r."targetShopId", r."generationId", src.kind, src.value, r.id, clock_timestamp()
  FROM public.stocky_customer_targets_for_request(r.id) AS src
  ON CONFLICT DO NOTHING;

  UPDATE public."PrivacyCustomerTargetBarrier"
    SET state='RELEASED', "releasedAt"=clock_timestamp()
    WHERE "privacyRequestId"=r.id AND state='ACTIVE';

  UPDATE public."PrivacyRequest"
    SET state='COMPLETED'
    WHERE id = r.id
      AND "activeAttemptId" = p_attempt_id
      AND state IN ('APPLYING','CHECKPOINTING','ENUMERATING','FINALIZING');
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  RETURN 'completed';
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_claim_attempt(
  p_request_id text,
  p_old_attempt_id text,
  p_new_attempt_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.stocky_privacy_publication_lock(p_request_id);
  UPDATE public."PrivacyAttempt"
    SET state='LOST', "leaseUntil"=clock_timestamp() - interval '1 second'
    WHERE id = p_old_attempt_id AND "privacyRequestId" = p_request_id;
  INSERT INTO public."PrivacyAttempt"(id,"privacyRequestId",epoch,state,"leaseUntil",worker)
    SELECT p_new_attempt_id, p_request_id, COALESCE(max(epoch),0)+1, 'RUNNING', clock_timestamp() + interval '1 hour', 'takeover'
    FROM public."PrivacyAttempt" WHERE "privacyRequestId" = p_request_id;
  UPDATE public."PrivacyRequest"
    SET "activeAttemptId" = p_new_attempt_id
    WHERE id = p_request_id;
  UPDATE public."PrivacyCustomerTargetBarrier"
    SET "attemptId" = p_new_attempt_id
    WHERE "privacyRequestId" = p_request_id AND state='ACTIVE';
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_data_request_coverage(p_request_id text)
RETURNS text
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  key_n int;
BEGIN
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF r.topic IS DISTINCT FROM 'customers/data_request' THEN
    RETURN 'wrong_topic';
  END IF;
  SELECT count(*) INTO key_n FROM public."PrivacyTargetKey" WHERE "requestId" = p_request_id;
  RETURN 'revision='||r."publicationRevision"||',keys='||key_n||',complete='||r."enumerationComplete";
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_cp_participating_write(
  p_canonical_domain text,
  p_shop_id text,
  p_symbol text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.stocky_participating_write_guard(p_canonical_domain);
  INSERT INTO public."ParticipatingWriteStamp"("shopId", symbol, guarded)
    VALUES (p_shop_id, p_symbol, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_lifecycle_complete_attempt_retry(
  p_job_id text,
  p_shop_id text,
  p_canonical_domain text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.stocky_cp_participating_write(p_canonical_domain, p_shop_id, 'completeAttemptRetry');
  UPDATE public."JobAttempt" SET "durableJobId" = "durableJobId" WHERE "durableJobId" = p_job_id;
  UPDATE public."DurableJob" SET state = 'RETRY_WAIT' WHERE id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_dispatcher_disabled_shop_write(
  p_job_id text,
  p_shop_id text,
  p_canonical_domain text,
  p_dispatch_id text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE enabled boolean;
BEGIN
  PERFORM public.stocky_cp_participating_write(p_canonical_domain, p_shop_id, 'dispatcher_disabled_shop_path');
  SELECT s."processingEnabled" INTO enabled FROM public."Shop" s WHERE s.id = p_shop_id;
  INSERT INTO public."JobDispatch"(id,"shopId","durableJobId",state)
    VALUES (p_dispatch_id, p_shop_id, p_job_id, 'PENDING_ENQUEUE');
  IF NOT COALESCE(enabled, false) THEN
    UPDATE public."DurableJob" SET state='PENDING' WHERE id = p_job_id;
  END IF;
END;
$$;

-- Completeness is required-symbol presence, NOT PR48's 86-row count.
CREATE OR REPLACE FUNCTION public.stocky_inventory_is_complete()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT
    COUNT(*) FILTER (WHERE symbol = 'completeAttemptRetry' AND guard_lock_order LIKE '%REQUIRED%') = 1
    AND COUNT(*) FILTER (WHERE symbol = 'dispatcher_disabled_shop_path' AND guard_lock_order LIKE '%REQUIRED%') = 1
    AND COUNT(*) FILTER (WHERE symbol = 'withTenantBoundTransaction' AND guard_lock_order LIKE '%REQUIRED%' AND guard_lock_order LIKE '%not optional%') = 1
    AND COUNT(*) FILTER (WHERE symbol = 'claimAttempt' AND guard_lock_order LIKE '%REQUIRED%') = 1
    AND COUNT(*) FILTER (WHERE symbol = 'enqueueWithDispatch' AND guard_lock_order LIKE '%REQUIRED%') = 1
    AND COUNT(*) FILTER (WHERE symbol = 'runOrderFactsSyncJob' AND guard_lock_order LIKE '%REQUIRED%') = 1
    AND COUNT(*) FILTER (WHERE symbol = 'computeSyncHealth' AND guard_lock_order LIKE '%REQUIRED%' AND surfaces ILIKE '%SyncHealth%') = 1
  FROM public."ParticipatingWriterInventory";
$$;

CREATE OR REPLACE FUNCTION public.stocky_detect_unguarded_cp_write(p_shop_id text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."DurableJob" j
    WHERE j."shopId" = p_shop_id AND j.id LIKE 'probe_unguarded%'
  );
$$;

-- Grants / ownership for CC-GEN helpers. PUBLIC EXECUTE revoked.
ALTER FUNCTION public.stocky_privacy_claim_attempt(text, text, text) OWNER TO stocky_privacy_target_owner;
GRANT INSERT, UPDATE ON public."PrivacyAttempt" TO stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_inventory_is_complete() TO stocky_control_plane, stocky_runtime;
GRANT EXECUTE ON FUNCTION public.stocky_detect_unguarded_cp_write(text) TO stocky_control_plane, stocky_runtime;
REVOKE ALL ON FUNCTION public.stocky_inventory_is_complete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_detect_unguarded_cp_write(text) FROM PUBLIC;
ALTER FUNCTION public.stocky_customer_targets_for_request(text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_install_customer_barrier(text, text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_customer_write_guard(text, text, text, text, timestamptz, text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_privacy_customer_residual_count(text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_complete_customer_redact(text, text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_data_request_coverage(text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_shop_canonical_domain(text, text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_writer_origin_generation(text, text, text) OWNER TO stocky_lifecycle_gate_owner;

REVOKE ALL ON FUNCTION public.stocky_shop_canonical_domain(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_writer_origin_generation(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_targets_for_request(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_install_customer_barrier(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_write_guard(text, text, text, text, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_fact_write_guard(text, text, text, text, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_customer_residual_count(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_complete_customer_redact(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_claim_attempt(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_data_request_coverage(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_cp_participating_write(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_lifecycle_complete_attempt_retry(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_dispatcher_disabled_shop_write(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_target_lock_key1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_target_lock_key2(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_target_lock_shared(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_target_lock_exclusive(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stocky_shop_canonical_domain(text, text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_reader, stocky_lifecycle_gate_owner, stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_writer_origin_generation(text, text, text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_lifecycle_gate_owner, stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_customer_targets_for_request(text) TO stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_install_customer_barrier(text, text) TO stocky_privacy_erasure, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_customer_write_guard(text, text, text, text, timestamptz, text) TO stocky_runtime, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_fact_write_guard(text, text, text, text, timestamptz, text) TO stocky_runtime, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_customer_residual_count(text) TO stocky_privacy_erasure, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_complete_customer_redact(text, text) TO stocky_privacy_erasure, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_claim_attempt(text, text, text) TO stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_data_request_coverage(text) TO stocky_privacy_reader, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_cp_participating_write(text, text, text) TO stocky_control_plane, stocky_runtime;
GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_complete_attempt_retry(text, text, text) TO stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_dispatcher_disabled_shop_write(text, text, text, text) TO stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_key1(text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_key2(text, text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_shared(text, text, text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_exclusive(text, text, text) TO stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner, stocky_lifecycle_gate_owner;

-- Residual helper is SECURITY DEFINER as target_owner and must evaluate capability itself (CC-02).
GRANT EXECUTE ON FUNCTION public.stocky_privacy_capability_allows(text, text) TO stocky_privacy_target_owner;

GRANT SELECT ON public."Shop" TO stocky_lifecycle_gate_owner;
GRANT SELECT ON public."ShopInstallGeneration" TO stocky_lifecycle_gate_owner;
GRANT SELECT ON public."PrivacyCustomerTargetBarrier", public."PrivacyCompletedTarget" TO stocky_lifecycle_gate_owner;
GRANT SELECT, INSERT, UPDATE ON public."PrivacyCustomerTargetBarrier" TO stocky_privacy_target_owner;
GRANT USAGE, SELECT ON SEQUENCE public."PrivacyCustomerTargetBarrier_id_seq" TO stocky_privacy_target_owner;
GRANT SELECT, INSERT ON public."PrivacyCompletedTarget" TO stocky_privacy_target_owner;
GRANT SELECT, INSERT ON public."PrivacyCompletionReceipt" TO stocky_privacy_target_owner;
GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt" TO stocky_privacy_target_owner;

ALTER TABLE public."PrivacyCustomerTargetBarrier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PrivacyCustomerTargetBarrier" FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_barrier_definer_all ON public."PrivacyCustomerTargetBarrier"
  FOR ALL TO stocky_privacy_target_owner
  USING (true) WITH CHECK (true);
CREATE POLICY customer_barrier_gate_select ON public."PrivacyCustomerTargetBarrier"
  FOR SELECT TO stocky_lifecycle_gate_owner
  USING (true);

ALTER TABLE public."PrivacyCompletedTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PrivacyCompletedTarget" FORCE ROW LEVEL SECURITY;
CREATE POLICY completed_target_definer_all ON public."PrivacyCompletedTarget"
  FOR ALL TO stocky_privacy_target_owner
  USING (true) WITH CHECK (true);
CREATE POLICY completed_target_gate_select ON public."PrivacyCompletedTarget"
  FOR SELECT TO stocky_lifecycle_gate_owner
  USING (true);

-- Exact V participating-writer inventory (required guards; processingEnabled ≠ drain).
INSERT INTO public."ParticipatingWriterInventory"(
  file_path, symbol, transaction_host, role_name, surfaces, target_key_derivation,
  guard_lock_order, processing_enabled_on_v, already_running_outcome, disabled_frozen_behavior, integration_test_home
) VALUES
('app/tenant/db-context.server.ts','withTenantBoundTransaction','Prisma $transaction + setTransactionLocalTenantContext','stocky_runtime','caller tenant facts','shopId from TenantAuthority; CUSTOMER_REST_ID/ORDER_LEGACY_ID from row','REQUIRED (not optional) domain shared then customer-target shared; revalidate','RLS processingEnabled on facts','holds txn; exclusive freeze waits','ordinary facts denied by RLS when disabled','scripts/privacy/inventory-guard.test.ts'),
('app/tenant/tenant-db.server.ts','withTenantBoundTransactionState','Prisma interactive txn','stocky_runtime','tenant facts','same','REQUIRED (not optional)','same','same','same','scripts/privacy/inventory-guard.test.ts'),
('app/lib/order-facts/apply/writers.ts','applyOrderFactWriters','TenantDb + raw SELECT stocky_shop_processing_enabled','stocky_runtime','ShopifyOrderFact / lines','ORDER_LEGACY_ID','REQUIRED both gates after processingEnabled pre-lock','pre-lock helper, not drain','in-flight commit then residual/re-enumerate','disabled denies new apply','app/lib/order-facts/apply/__tests__'),
('app/lib/order-facts/apply/receipts.ts','applyReceipts','TenantDb + processingEnabled re-check','stocky_runtime','SyncApplicationReceipt','shop-level; not customer restore','REQUIRED lifecycle shared','pre-lock + re-check','already-open receipt txn','disabled denies','app/lib/order-facts/apply/__tests__'),
('app/sync/lifecycle.server.ts','claimAttempt','getControlPlanePrisma $transaction; lockDurableJob; JobAttempt.create; raw UPDATE DurableJob; JobDispatch.updateMany','stocky_control_plane','JobAttempt,DurableJob,JobDispatch','shopId only; not customer restore','REQUIRED lifecycle shared. processingEnabled ABSENT on V','ABSENT — not a drain','already-running claim finishes CP rows','writes while disabled','app/sync/__tests__/sync-attempt-recovery.test.ts'),
('app/sync/lifecycle.server.ts','renewAttemptHeartbeat','CP JobAttempt.update','stocky_control_plane','JobAttempt','shopId','REQUIRED lifecycle shared','ABSENT','heartbeat of running attempt','writes while disabled','app/sync/__tests__/sync-attempt-recovery.test.ts'),
('app/sync/lifecycle.server.ts','completeAttemptSuccess','CP $transaction; JobAttempt.update; raw DurableJob; webhookDelivery.updateMany; jobDispatch.updateMany','stocky_control_plane','JobAttempt,DurableJob,WebhookDelivery,JobDispatch','shopId','REQUIRED lifecycle shared','ABSENT','already-running success finalizes CP','writes while disabled','app/sync/__tests__/sync-attempt-recovery.test.ts'),
('app/sync/lifecycle.server.ts','completeAttemptRetry','CP $transaction; JobAttempt.update; raw UPDATE DurableJob RETRY_WAIT','stocky_control_plane','JobAttempt,DurableJob','shopId; not customer restore','REQUIRED lifecycle shared','ABSENT on V — Decision TF-03 names this path','already-running retry writes while finishing attempt','writes while disabled','app/sync/__tests__/sync-attempt-recovery.test.ts'),
('app/sync/lifecycle.server.ts','completeAttemptFail','CP $transaction → completeAttemptDeadLetterInTx','stocky_control_plane','JobAttempt,DurableJob,DeadLetter','shopId','REQUIRED lifecycle shared','ABSENT','already-running fail','writes while disabled','app/sync/__tests__/sync-attempt-recovery.test.ts'),
('app/sync/lifecycle.server.ts','completeAttemptDeadLetter','CP $transaction → completeAttemptDeadLetterInTx','stocky_control_plane','JobAttempt,DurableJob,DeadLetter','shopId','REQUIRED lifecycle shared','ABSENT','already-running dead-letter','writes while disabled','app/sync/__tests__/sync-attempt-recovery.test.ts'),
('app/sync/lifecycle.server.ts','recoverExpiredRunningAttempts','CP; reaper lives in this file (no separate reaper module on V)','stocky_control_plane','JobAttempt,DurableJob,DeadLetter','shopId','REQUIRED lifecycle shared','ABSENT','already-running recovery','writes while disabled','app/sync/__tests__/sync-attempt-recovery.test.ts'),
('app/sync/dispatcher.server.ts','ensureDispatchRecord','CP JobDispatch.find/create','stocky_control_plane','JobDispatch','shopId','REQUIRED lifecycle shared','read, then may still write','may run after disable','creates dispatch when disabled','app/sync/__tests__/sync-dispatch-recovery.test.ts'),
('app/sync/dispatcher.server.ts','enqueueWithDispatch','CP markDispatchFailed; raw UPDATE DurableJob CANCELLED or PENDING','stocky_control_plane','JobDispatch,DurableJob','shopId','REQUIRED lifecycle shared','READ then STILL WRITES','already-claimed job after disable','explicit shop_disabled writes','app/sync/__tests__/sync-dispatch-recovery.test.ts'),
('app/sync/dispatcher.server.ts','dispatcher_disabled_shop_path','dispatchPendingJobs after claim: ensureDispatchRecord + enqueueWithDispatch when processingEnabled=false; markDispatchFailed; raw DurableJob PENDING or CANCELLED','stocky_control_plane','JobDispatch,DurableJob','shopId','REQUIRED lifecycle shared; processingEnabled re-check is not a transaction drain','READ then STILL WRITES','already-claimed job','writes while disabled','app/sync/__tests__/sync-dispatch-recovery.test.ts'),
('app/sync/dispatcher.server.ts','dispatchPendingJobs','after claim, re-check shop, still ensureDispatchRecord+enqueueWithDispatch','stocky_control_plane','JobDispatch,DurableJob','shopId','REQUIRED lifecycle shared','re-check is not drain','already-claimed','disabled path increments shopDisabled','app/sync/__tests__/sync-dispatch-recovery.test.ts'),
('app/sync/fair-claim-query.server.ts','claimRunnableJobsSql','raw SQL WHERE processingEnabled=true','stocky_control_plane','DurableJob read','n/a','admission only; does not drain in-flight','YES on SELECT','does not finish already-running writers','new claims skipped','app/sync/fair-claim-query.server.ts'),
('app/sync/intake.server.ts','createDurableJob','CP DurableJob.create','stocky_control_plane','DurableJob','shopId','REQUIRED lifecycle shared PLUS processingEnabled deny','YES deny shop_processing_disabled','new intake only','deny — not a drain of running work','app/sync/__tests__/sync-intake-corrections.test.ts'),
('app/sync/replay.server.ts','replayDeadLetter','CP $transaction','stocky_control_plane','DurableJob,JobReplay,DeadLetter,PlatformReplayCommand','shopId','REQUIRED authz lock then lifecycle shared','YES replay_denied_disabled_shop','committed effects stay','deny new enqueue','app/sync/__tests__/sync-control-plane.integration.test.ts'),
('app/sync/uninstall.server.ts','processUninstall','CP; cancelAllCancellable','stocky_control_plane','Shop,DurableJob','domain','REQUIRED exclusive lifecycle then UNINSTALLED','sets false','in-flight admitted before exclusive','disables shop','app/sync/__tests__'),
('app/sync/uninstall.server.ts','cancelAllCancellable','CP FOR UPDATE job rows','stocky_control_plane','DurableJob','shopId','REQUIRED exclusive lifecycle','n/a','cancels cancellable; not fact drain','cancel ordinary jobs','app/sync/uninstall.server.ts'),
('app/sync/reinstall.server.ts','reactivateShopAfterVerifiedReinstall','CP Shop update','stocky_control_plane','Shop','domain','REQUIRED lifecycle shared + fence','reads processingEnabled','n/a','REDACTED deny','app/sync/reinstall.server.ts'),
('app/tenant/bootstrap.server.ts','upsertCanonicalShop','rawPrisma.shop.upsert','stocky_runtime','Shop','canonical domain even if Shop absent','REQUIRED assertNoErasureFence + shared gate','none','bootstrap vs freeze','may create Shop','app/tenant/__tests__/bootstrap.test.ts'),
('app/tenant/after-auth.server.ts','runAfterAuthTenantBootstrap','bootstrap + tenant-db shopSettings.upsert','stocky_runtime','Shop,ShopSettings','domain','REQUIRED both gates; no settings revival on ERASING/FINALIZING','reactivate path','n/a','REDACTED fail-closed','app/tenant/after-auth.server.ts'),
('app/lib/catalog-facts/ingest/checkpoint.ts','lockSyncRun','CP $queryRaw SELECT SyncRun FOR UPDATE; processingEnabled check','stocky_control_plane','SyncRun,SyncCursor','shopId','REQUIRED lifecycle shared','YES shop_processing_disabled','already-running checkpoint','deny','app/lib/catalog-facts'),
('app/jobs/workers/webhook-processor.ts','assertShopProcessingEnabled','ordinary job execution','stocky_runtime','facts via apply','shopId','REQUIRED; privacy coordinator is a separate loop','YES','already-running job','deny new work','app/jobs/workers'),
('app/jobs/queue.server.ts','createDurableJob wrappers','CP via intake','stocky_control_plane','DurableJob','shopId','intake gate','via intake','n/a','deny','app/jobs/queue.server.ts'),
('app/sync/health.server.ts','getShopHealth','HISTORICAL label — symbol ABSENT on W','stocky_control_plane','not a writer on W','n/a','HISTORICAL misnamed; NOT required for completeness; W export is computeSyncHealth','n/a','n/a','n/a','app/sync/health.server.ts'),
('app/sync/health.server.ts','computeSyncHealth','CP SyncHealth.upsert','stocky_control_plane','SyncHealth','shopId + domain','REQUIRED lifecycle shared; reads processingEnabled then STILL upserts (PREP-C-04); not drain','READ then WRITE','n/a','upserts DISABLED health while shop disabled','app/sync/health.server.ts'),
('app/jobs/workers/order-facts/sync-jobs.ts','runOrderFactsSyncJob','worker + OrderFactsTxnHost + scratch','stocky_runtime','order facts + D scratch bytes','ORDER_LEGACY_ID via apply','REQUIRED both gates; PE via processor is admission not drain','admission via processor; not drain','in-flight import continues','process-loss ≠ privacy drain','app/lib/order-facts/sync + source-stage.test.ts'),
('app/jobs/workers/order-facts/sync-jobs.ts','runOrderFactsReconcileJob','worker + OrderFactsTxnHost','stocky_runtime','order facts','ORDER_LEGACY_ID via apply','REQUIRED both gates','admission via processor; not drain','in-flight reconcile','same','pr6-d-sc-recovery.test.ts'),
('app/jobs/queue.server.ts','enqueueOrderFactsSync','CP via createDurableJob','stocky_control_plane','DurableJob','shopId','REQUIRED lifecycle shared PLUS intake PE deny','YES deny new intake','new intake only','deny when disabled — not a drain','app/jobs/queue.server.ts'),
('app/jobs/queue.server.ts','enqueueOrderFactsReconcile','CP via createDurableJob','stocky_control_plane','DurableJob','shopId','REQUIRED lifecycle shared PLUS intake PE deny','YES deny new intake','new intake only','deny when disabled','app/jobs/queue.server.ts'),
('app/sync/dispatcher.server.ts','recoverStrandedEnqueuedJobs','CP + queue presence','stocky_control_plane','DurableJob, Redis presence','shopId','REQUIRED lifecycle shared','ABSENT on recovery query','stranded ENQUEUED recovery','may DL/retry while disabled','app/sync/__tests__/sync-dispatch-recovery.test.ts'),
('app/sync/dispatcher.server.ts','recoverExpiredDispatchLeases','local; CP $queryRaw UPDATE DurableJob PENDING','stocky_control_plane','DurableJob DISPATCH_LEASED','shopId','REQUIRED lifecycle shared; no processingEnabled filter (PREP-C-20)','ABSENT (PREP-C-20)','expired lease of any shop','not a drain','app/sync/__tests__/sync-dispatch-recovery.test.ts'),
('app/lib/order-facts/sync/apply-composition.ts','applyCanonicalAndLegacy','OrderFactsTxnHost / runtime','stocky_runtime','ShopifyOrderFact / lines / receipts','ORDER_LEGACY_ID','REQUIRED both gates after PE pre-lock','pre-lock helper, not drain','already-open apply txn','disabled denies new apply','app/lib/order-facts/sync'),
('app/lib/order-facts/sync/apply-composition.ts','persistIncompleteWithoutReceipt','tenant txn','stocky_runtime','observation incomplete row','shop-level','REQUIRED lifecycle shared','none here','in-flight observation','n/a','app/lib/order-facts/sync'),
('app/lib/order-facts/sync/apply-nominated.ts','applyNominatedOrderGid','tenant + Admin IO','stocky_runtime','order facts','ORDER_LEGACY_ID','REQUIRED both gates','via apply PE pre-lock','nominated GID apply','via apply PE','app/lib/order-facts/sync'),
('app/lib/order-facts/sync/shop-metadata.ts','persistShopTimezoneCurrencyValues','tenant OrderApplyDb','stocky_runtime','Shop timezone/currency','shop-level; not customer restore','REQUIRED lifecycle shared','tenant GUC match, not drain','metadata write','tenant GUC match','app/lib/order-facts/sync'),
('app/lib/order-facts/sync/webhook.ts','processOrderFactsWebhookJob','tenant host','stocky_runtime','facts + receipt','ORDER_LEGACY_ID','REQUIRED both gates','via apply','already-running webhook apply','via processor','app/lib/order-facts/sync'),
('app/lib/order-facts/sync/control-plane.ts','createOrderFactsSyncRun','CP SyncRun create','stocky_control_plane','SyncRun','shopId','REQUIRED lifecycle shared','ABSENT','open SyncRun reuse','writes while disabled','app/lib/order-facts/sync/control-plane.ts'),
('app/lib/order-facts/sync/control-plane.ts','persistOrderFactsCursor','CP SyncCursor upsert','stocky_control_plane','SyncCursor','shopId','REQUIRED lifecycle shared','ABSENT','cursor advance','writes while disabled','app/lib/order-facts/sync/control-plane.ts'),
('app/lib/order-facts/sync/control-plane.ts','recordOrderFactsDataIssue','CP DataIssue create','stocky_control_plane','DataIssue','shopId','REQUIRED lifecycle shared','ABSENT','evidence write','writes while disabled','app/lib/order-facts/sync/control-plane.ts'),
('app/lib/order-facts/sync/control-plane.ts','persistOrderFactsCoverageHealth','CP via computeSyncHealth upsert','stocky_control_plane','SyncHealth','shopId','REQUIRED lifecycle shared','via computeSyncHealth','health wrapper','writes while disabled','app/lib/order-facts/sync/control-plane.ts'),
('app/lib/catalog-facts/apply/index.ts','applyCanonicalFacts','CanonicalApplyDb tenant txn','stocky_runtime','catalog facts','shop-level; no explicit PE pre-lock (PREP-C-15)','REQUIRED lifecycle shared','NO explicit PE pre-lock (PREP-C-15)','in-flight catalog apply','L still required','catalog apply tests'),
('app/sync/application-receipt.server.ts','applyWithApplicationReceipt','TenantDb then SyncApplicationReceipt INSERT','stocky_runtime','SyncApplicationReceipt','shop-level','REQUIRED lifecycle shared','none in receipt helper','already-open receipt txn','V-omitted on prior inventory','app/sync/application-receipt.server.ts'),
('app/tenant/bootstrap.server.ts','deleteSessionsForShop','rawPrisma session.deleteMany','stocky_runtime','Session','domain','REQUIRED shared gate + fence; no FINALIZING revival','none','session wipe','bootstrap vs freeze','app/tenant/__tests__/bootstrap.test.ts'),
('app/jobs/workers/catalog-facts/bulk-finish.ts','signalBulkOperationContinuation','CP DurableJob.updateMany RETRY_WAIT','stocky_control_plane','DurableJob','shopId','REQUIRED lifecycle shared (PREP-C-28)','none','already RETRY_WAIT children','wakes order-facts jobs on W','bulk-finish tests'),
('app/lib/order-facts/sync/source-stage.ts','reclaimOperatorSelectedDScratch','filesystem + ledger','operator-only on W','D scratch att-*','shop via basename, not customer','MUST NOT be auto-called from PR7; quiescenceConfirmed is operator token not liveness (PREP-B-19)','n/a filesystem','cross-process live_writer skip is process-local','refuse COMPLETED while occupancy uncertain','source-stage.test.ts + PR6_D_SCRATCH_OPERATOR_RUNBOOK.md'),
('app/lib/order-facts/apply/writers.ts','insertOrderFact','TenantDb','stocky_runtime','ShopifyOrderFact','ORDER_LEGACY_ID via shopifyLegacyResourceId','REQUIRED both gates; actual W export (applyOrderFactWriters is a family label)','pre-lock helper, not drain','in-flight commit then residual','disabled denies new apply','app/lib/order-facts/apply/__tests__'),
('app/lib/order-facts/apply/receipts.ts','insertReceiptFinal','TenantDb','stocky_runtime','SyncApplicationReceipt','shop-level','REQUIRED lifecycle shared; actual W export (applyReceipts is a family label)','pre-lock + re-check','already-open receipt txn','disabled denies','app/lib/order-facts/apply/__tests__');


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

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROOF_ROOT = os.environ.get("PROOF_ROOT", SCRIPT_DIR)
PGHOST = os.environ.get("PGHOST", "/tmp/pr45-cc-pg16")
PGPORT = os.environ.get("PGPORT", "5434")
PGDATABASE = os.environ.get("PGDATABASE", "pr45_proof")
OWNER = os.environ.get("PR45_OWNER", "pr45owner")

PSQL = [
    "psql",
    "-h",
    PGHOST,
    "-p",
    PGPORT,
    "-d",
    PGDATABASE,
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
    contract = os.path.join(PROOF_ROOT, "01_contract.sql")
    seed = os.path.join(PROOF_ROOT, "02_seed.sql")
    if not os.path.isfile(contract) or not os.path.isfile(seed):
        raise FileNotFoundError(
            f"stage 01_contract.sql and 02_seed.sql into PROOF_ROOT={PROOF_ROOT}"
        )
    subprocess.check_call(
        ["dropdb", "-h", PGHOST, "-p", PGPORT, "-U", OWNER, "--if-exists", PGDATABASE]
    )
    subprocess.check_call(
        ["createdb", "-h", PGHOST, "-p", PGPORT, "-U", OWNER, PGDATABASE]
    )
    subprocess.check_call(
        PSQL + ["-U", OWNER, "-f", contract],
        stdout=subprocess.DEVNULL,
    )
    subprocess.check_call(PSQL + ["-U", OWNER, "-f", seed])


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


def query_pg_version() -> dict[str, str]:
    rc, out, err = psql(
        "pr45owner",
        "SELECT current_setting('server_version') || '|' || current_setting('server_version_num') || '|' || version();",
    )
    parts = (out.strip().split("|") + ["", "", ""])[:3]
    return {
        "server_version": parts[0],
        "server_version_num": parts[1],
        "version": parts[2],
        "query_rc": str(rc),
        "query_err": err[:300],
    }


def g7() -> None:
    """TF-01 customer-target barrier, residual independent of manifest, completion serialization."""
    group = "G7-customer-complete"
    reset()

    # Writer already active (shared target lock) before barrier admission.
    pre_held = threading.Event()
    pre_release = threading.Event()
    pre_fin: dict[str, str] = {}

    def pre_writer() -> None:
        p = subprocess.Popen(
            PSQL + ["-U", "stocky_runtime"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        assert p.stdin and p.stdout
        p.stdin.write(
            "BEGIN;\n"
            "SELECT set_config('stocky.current_shop_id','shop_a', true);\n"
            "SELECT set_config('stocky.tenant_context_version','phase1-db-tenant-context-v1', true);\n"
            "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp());\n"
            "SELECT 'HOLDING_PRE';\n"
        )
        p.stdin.flush()
        buf = ""
        start = time.time()
        while time.time() - start < 8:
            line = p.stdout.readline()
            buf += line
            if "HOLDING_PRE" in buf:
                pre_held.set()
                pre_release.wait(15)
                p.stdin.write(
                    "INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") "
                    "VALUES ('ae_inflight','shop_a','191167');\nCOMMIT;\n"
                )
                stdout, stderr = p.communicate(timeout=10)
                pre_fin["rc"] = str(p.returncode)
                pre_fin["err"] = stderr
                return
        pre_fin["timeout"] = buf
        p.kill()

    tw = threading.Thread(target=pre_writer)
    tw.start()
    if not pre_held.wait(8):
        record(group, "writer_active_before_barrier_admission", False, "pre-writer did not hold")
        pre_release.set()
        tw.join(3)
    else:
        admit = threading.Event()
        admit_res: list[tuple[int, str, str, float]] = []

        def admit_barrier() -> None:
            start = time.time()
            rc, out, err = tx(
                "stocky_privacy_erasure",
                "shop_a",
                "preq_cr",
                "patt_cr",
                "SET LOCAL lock_timeout = '2s'; SELECT public.stocky_privacy_install_customer_barrier('preq_cr','patt_cr');",
            )
            admit_res.append((rc, out, err, time.time() - start))
            admit.set()

        ta = threading.Thread(target=admit_barrier)
        ta.start()
        time.sleep(0.4)
        pre_release.set()
        tw.join(8)
        ta.join(8)
        rc_a, out_a, err_a, elapsed_a = admit_res[0] if admit_res else (-1, "", "no result", 0)
        record(
            group,
            "writer_active_before_barrier_admission",
            pre_fin.get("rc") == "0" and elapsed_a >= 0.3,
            f"writer={pre_fin} admit_rc={rc_a} elapsed={elapsed_a:.2f} err={err_a[:300]}",
        )

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_install_customer_barrier('preq_cr','patt_cr'); SELECT public.stocky_privacy_enumerate_targets('preq_cr');",
    )
    rc_b, barriers, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"PrivacyCustomerTargetBarrier\" WHERE state='ACTIVE' AND \"privacyRequestId\"='preq_cr';",
    )
    record(group, "customer_barrier_installs_target_keys", rc == 0 and barriers.strip() == "2", f"rc={rc} barriers={barriers} err={err}")

    rc, out, err = tx(
        "stocky_privacy_reader",
        "shop_a",
        "preq_dr",
        "patt_dr",
        "SELECT public.stocky_privacy_enumerate_targets('preq_dr'); SELECT public.stocky_privacy_data_request_coverage('preq_dr');",
    )
    cov = last_line(out).replace("true", "t")
    record(
        group,
        "data_request_coverage_is_snapshot_not_empty_predicate",
        rc == 0 and "revision=" in cov and "keys=" in cov and "complete=t" in cov,
        f"out={out} err={err}",
    )

    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp()); INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_blocked','shop_a','191167');",
    )
    record(group, "matching_writer_denied_while_barrier_active", rc != 0 and "customer_target_erasing" in err, err, sqlstate_from_err(err))

    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','999999', clock_timestamp()); INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_other','shop_a','999999'); SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_other';",
    )
    rc_pe, pe, _ = psql("pr45owner", "SELECT \"processingEnabled\"::text FROM public.\"Shop\" WHERE id='shop_a';")
    record(
        group,
        "unrelated_customer_same_shop_progresses",
        rc == 0 and last_line(out) == "1" and pe.strip() == "true",
        f"out={out} err={err} processingEnabled={pe}",
    )

    rc, out, err = tx(
        "stocky_runtime",
        "shop_b",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-b.myshopify.com','shop_b','CUSTOMER_REST_ID','191167', clock_timestamp()); INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_b_progress','shop_b','191167'); SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_b_progress';",
    )
    record(group, "unrelated_shop_progresses_during_customer_barrier", rc == 0 and last_line(out) == "1", f"out={out} err={err}")

    # Late matching audit AFTER first enumeration, not published into the old manifest.
    # pr45owner simulates an uninstrumented writer the customer gate cannot see in application
    # code; source-derived residual must still observe the row (TF-01).
    psql(
        "pr45owner",
        "INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_pre','shop_a','191167');",
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "DELETE FROM public.\"ShopifyOrderLineFact\"; DELETE FROM public.\"ShopifyOrderFact\"; DELETE FROM public.\"AuditEvent\"; SELECT public.stocky_privacy_customer_residual_count('preq_cr');",
    )
    # DELETE is manifest-filtered; ae_pre may survive; residual is source-derived.
    residual = last_line(out)
    rc_s, surv, _ = psql(
        "pr45owner",
        "SELECT string_agg(id, ',' ORDER BY id) FROM public.\"AuditEvent\" WHERE \"shopId\"='shop_a' AND \"customerRestId\"='191167';",
    )
    record(
        group,
        "late_matching_row_visible_to_source_residual",
        rc == 0 and residual != "0" and "ae_pre" in surv,
        f"residual={residual} survivors={surv} err={err}",
    )

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_complete_customer_redact('preq_cr','patt_cr');",
    )
    record(group, "complete_denied_while_remnants", rc == 0 and last_line(out) == "remnants", f"out={out} err={err}")

    # Erase remnant including ae_pre by re-enumerate then delete, then complete.
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_enumerate_targets('preq_cr'); DELETE FROM public.\"AuditEvent\"; SELECT public.stocky_privacy_customer_residual_count('preq_cr');",
    )
    record(group, "reenumerate_then_source_residual_zero", rc == 0 and last_line(out) == "0", f"out={out} err={err}")

    # Writer between residual and completion: hold complete txn, waiter times out, then delayed write denied.
    holding = threading.Event()
    waiter_err: dict[str, str] = {}

    def completer() -> None:
        p = subprocess.Popen(
            PSQL + ["-U", "stocky_privacy_erasure"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        assert p.stdin and p.stdout
        p.stdin.write(
            "BEGIN;\n"
            "SELECT set_config('stocky.current_shop_id','shop_a', true);\n"
            "SELECT set_config('stocky.tenant_context_version','phase1-db-tenant-context-v1', true);\n"
            "SELECT set_config('stocky.privacy_request_id','preq_cr', true);\n"
            "SELECT set_config('stocky.privacy_attempt_id','patt_cr', true);\n"
            "SELECT public.stocky_privacy_complete_customer_redact('preq_cr','patt_cr');\n"
            "SELECT 'HOLDING_COMPLETE';\n"
        )
        p.stdin.flush()
        buf = ""
        start = time.time()
        while time.time() - start < 10:
            line = p.stdout.readline()
            buf += line
            if "HOLDING_COMPLETE" in buf:
                holding.set()
                time.sleep(2.5)
                p.stdin.write("COMMIT;\n")
                stdout, stderr = p.communicate(timeout=10)
                waiter_err["complete_out"] = buf + stdout
                waiter_err["complete_err"] = stderr
                waiter_err["complete_rc"] = str(p.returncode)
                return
        waiter_err["complete_timeout"] = buf
        p.kill()

    t = threading.Thread(target=completer)
    t.start()
    if not holding.wait(10):
        record(group, "complete_holds_exclusive_during_residual", False, "completer did not hold")
        t.join(3)
    else:
        rc_w, out_w, err_w = psql(
            "stocky_runtime",
            """
            BEGIN;
            SET LOCAL lock_timeout = '2s';
            SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp() - interval '1 hour');
            COMMIT;
            """,
            timeout=8,
        )
        record(
            group,
            "writer_between_residual_and_complete_waits",
            rc_w != 0 and "lock timeout" in err_w.lower(),
            f"rc={rc_w} err={err_w}",
            sqlstate_from_err(err_w),
        )
        t.join(8)
        record(
            group,
            "complete_commits_after_drain",
            waiter_err.get("complete_rc") == "0" and "completed" in waiter_err.get("complete_out", "").lower(),
            str(waiter_err)[:800],
        )

    rc_st, st, _ = psql("pr45owner", "SELECT state FROM public.\"PrivacyRequest\" WHERE id='preq_cr';")
    record(group, "customer_request_completed_without_shop_freeze", st.strip() == "COMPLETED" and pe.strip() == "true", f"state={st} processingEnabled={pe}")

    admitted_before = "clock_timestamp() - interval '1 hour'"
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        f"SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', {admitted_before}); INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_restore','shop_a','191167');",
    )
    record(group, "delayed_old_write_cannot_restore", rc != 0 and "customer_target_restore_denied" in err, err, sqlstate_from_err(err))

    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp() + interval '1 second'); INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_new_legit','shop_a','191167'); SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_new_legit';",
    )
    record(group, "legitimate_later_customer_data_allowed", rc == 0 and last_line(out) == "1", f"out={out} err={err}")


def g8() -> None:
    """TF-02 epoch-fenced publication including pause between validation and mutation."""
    group = "G8-epoch-publish"
    reset()
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_install_customer_barrier('preq_cr','patt_cr'); SELECT public.stocky_privacy_enumerate_targets('preq_cr');",
    )
    rc_b, before, _ = psql(
        "pr45owner",
        "SELECT \"enumerationComplete\"::text||','||\"missingLinkages\"::text||','||\"publicationRevision\"::text||','||(SELECT count(*) FROM public.\"PrivacyTargetKey\" WHERE \"requestId\"='preq_cr') FROM public.\"PrivacyRequest\" WHERE id='preq_cr';",
    )

    # Pause: client validates, takeover publishes, then stale mutate.
    validated = threading.Event()
    takeover_done = threading.Event()
    stale: dict[str, str] = {}

    def stale_publisher() -> None:
        p = subprocess.Popen(
            PSQL + ["-U", "stocky_privacy_erasure"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        assert p.stdin and p.stdout
        p.stdin.write(
            "BEGIN;\n"
            "SELECT set_config('stocky.current_shop_id','shop_a', true);\n"
            "SELECT set_config('stocky.tenant_context_version','phase1-db-tenant-context-v1', true);\n"
            "SELECT set_config('stocky.privacy_request_id','preq_cr', true);\n"
            "SELECT set_config('stocky.privacy_attempt_id','patt_cr', true);\n"
            "SELECT id FROM public.\"PrivacyRequest\" WHERE id='preq_cr';\n"
            "SELECT 'VALIDATED';\n"
        )
        p.stdin.flush()
        buf = ""
        start = time.time()
        while time.time() - start < 10:
            line = p.stdout.readline()
            buf += line
            if "VALIDATED" in buf:
                validated.set()
                takeover_done.wait(10)
                p.stdin.write("SELECT public.stocky_privacy_enumerate_targets('preq_cr');\nCOMMIT;\n")
                stdout, stderr = p.communicate(timeout=10)
                stale["out"] = stdout
                stale["err"] = stderr
                stale["rc"] = str(p.returncode)
                return
        stale["timeout"] = buf
        p.kill()

    t = threading.Thread(target=stale_publisher)
    t.start()
    if not validated.wait(8):
        record(group, "stale_publisher_paused_after_validation", False, "no validation")
        takeover_done.set()
        t.join(3)
    else:
        rc_c, out_c, err_c = psql(
            "stocky_control_plane",
            "SELECT public.stocky_privacy_claim_attempt('preq_cr','patt_cr','patt_cr2');",
        )
        rc_e, out_e, err_e = tx(
            "stocky_privacy_erasure",
            "shop_a",
            "preq_cr",
            "patt_cr2",
            "SELECT public.stocky_privacy_enumerate_targets('preq_cr');",
        )
        takeover_done.set()
        t.join(8)
        rc_a, after, _ = psql(
            "pr45owner",
            "SELECT \"enumerationComplete\"::text||','||\"missingLinkages\"::text||','||\"publicationRevision\"::text||','||(SELECT count(*) FROM public.\"PrivacyTargetKey\" WHERE \"requestId\"='preq_cr')||','||\"activeAttemptId\" FROM public.\"PrivacyRequest\" WHERE id='preq_cr';",
        )
        record(
            group,
            "successor_enumerates_after_takeover",
            rc_c == 0 and rc_e == 0 and "patt_cr2" in after,
            f"claim={err_c} enum={err_e} after={after}",
        )
        record(
            group,
            "stale_publisher_after_pause_does_not_mutate",
            stale.get("rc") != "0" and "enumerator_stale_attempt" in stale.get("err", ""),
            str(stale)[:800],
        )
        # Byte-identical to successor publication (not reverted to empty).
        rc_k, keys, _ = psql(
            "pr45owner",
            "SELECT count(*) FROM public.\"PrivacyTargetKey\" WHERE \"requestId\"='preq_cr';",
        )
        record(group, "new_epoch_keys_unchanged_by_stale", keys.strip() == "3", f"before={before} after={after} keys={keys}")

    # Expired / terminal / wrong attempt
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_enumerate_targets('preq_cr');",
    )
    record(group, "wrong_attempt_cannot_publish", rc != 0 and "enumerator_stale_attempt" in err, err, sqlstate_from_err(err))

    psql(
        "pr45owner",
        "UPDATE public.\"PrivacyAttempt\" SET state='LOST', \"leaseUntil\"=now()-interval '1 minute' WHERE id='patt_cr2';",
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr2",
        "SELECT public.stocky_privacy_enumerate_targets('preq_cr');",
    )
    record(group, "expired_terminal_attempt_cannot_publish", rc != 0 and "enumerator_stale_attempt" in err, err, sqlstate_from_err(err))

    # Worker loss while barrier active: takeover rebinds barrier attempt, delayed old write still denied.
    reset()
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_install_customer_barrier('preq_cr','patt_cr'); SELECT public.stocky_privacy_enumerate_targets('preq_cr'); DELETE FROM public.\"ShopifyOrderLineFact\"; DELETE FROM public.\"ShopifyOrderFact\"; DELETE FROM public.\"AuditEvent\";",
    )
    psql("stocky_control_plane", "SELECT public.stocky_privacy_claim_attempt('preq_cr','patt_cr','patt_lost2');")
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_lost2",
        "SELECT public.stocky_privacy_enumerate_targets('preq_cr'); SELECT public.stocky_privacy_complete_customer_redact('preq_cr','patt_lost2');",
    )
    record(group, "epoch_takeover_completes_under_rebound_barrier", rc == 0 and "completed" in proof_lines(out)[-1], f"out={out} err={err}")
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp() - interval '2 hours'); INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_delayed_old','shop_a','191167');",
    )
    record(group, "delayed_old_write_after_takeover_complete_denied", rc != 0 and "customer_target_restore_denied" in err, err, sqlstate_from_err(err))


def g9() -> None:
    """TF-03 inventory + lifecycle/dispatcher writes + unguarded detection."""
    group = "G9-writer-inventory"
    reset()
    rc, out, _ = psql("pr45owner", "SELECT public.stocky_inventory_is_complete()::text;")
    record(group, "inventory_includes_retry_and_dispatcher_disabled", out.strip() in ("t", "true"), out)

    rc, out, err = psql(
        "stocky_control_plane",
        "SELECT public.stocky_lifecycle_complete_attempt_retry('job_a','shop_a','pr7-a.myshopify.com');",
    )
    rc_s, st, _ = psql("pr45owner", "SELECT state FROM public.\"DurableJob\" WHERE id='job_a';")
    record(group, "lifecycle_complete_attempt_retry_guarded_write", rc == 0 and st.strip() == "RETRY_WAIT", f"err={err} state={st}")

    psql("pr45owner", "UPDATE public.\"Shop\" SET \"processingEnabled\"=false, \"processingDisabledReason\"='UNINSTALLED' WHERE id='shop_a';")
    rc, out, err = psql(
        "stocky_control_plane",
        "SELECT public.stocky_dispatcher_disabled_shop_write('job_a','shop_a','pr7-a.myshopify.com','jd_disabled_1');",
    )
    # shop_a is LIVE generation so participating_write_guard should succeed (not frozen). Disabled still writes.
    rc_d, disp, _ = psql("pr45owner", "SELECT count(*) FROM public.\"JobDispatch\" WHERE id='jd_disabled_1';")
    record(
        group,
        "dispatcher_disabled_shop_path_still_writes",
        rc == 0 and disp.strip() == "1",
        f"rc={rc} err={err} dispatch={disp}",
    )

    psql(
        "stocky_control_plane",
        "INSERT INTO public.\"DurableJob\"(id,\"shopId\",\"jobType\",state) VALUES ('probe_unguarded_1','shop_a','orders/create','PENDING');",
    )
    rc, out, _ = psql("pr45owner", "SELECT public.stocky_detect_unguarded_cp_write('shop_a')::text;")
    record(group, "inventory_gate_detects_unguarded_tenant_linked_write", out.strip() in ("t", "true"), out)

    psql(
        "pr45owner",
        "DELETE FROM public.\"ParticipatingWriterInventory\" WHERE symbol='completeAttemptRetry';",
    )
    rc, out, _ = psql("pr45owner", "SELECT public.stocky_inventory_is_complete()::text;")
    record(group, "inventory_incomplete_when_required_writer_removed", out.strip() in ("f", "false"), out)

    reset()
    psql("pr45owner", "DELETE FROM public.\"ParticipatingWriterInventory\" WHERE symbol='runOrderFactsSyncJob';")
    rc, out, _ = psql("pr45owner", "SELECT public.stocky_inventory_is_complete()::text;")
    record(group, "inventory_incomplete_when_w_sync_job_removed", out.strip() in ("f", "false"), out)

    reset()
    psql("pr45owner", "DELETE FROM public.\"ParticipatingWriterInventory\" WHERE symbol='computeSyncHealth';")
    rc, out, _ = psql("pr45owner", "SELECT public.stocky_inventory_is_complete()::text;")
    record(group, "inventory_incomplete_when_health_upsert_removed", out.strip() in ("f", "false"), out)

    reset()
    psql("pr45owner", "DELETE FROM public.\"ParticipatingWriterInventory\" WHERE symbol='getShopHealth';")
    rc, out, _ = psql("pr45owner", "SELECT public.stocky_inventory_is_complete()::text;")
    record(
        group,
        "completeness_not_tied_to_historical_getShopHealth_row",
        out.strip() in ("t", "true"),
        out,
    )
    rc, n, _ = psql("pr45owner", "SELECT count(*) FROM public.\"ParticipatingWriterInventory\";")
    record(group, "inventory_row_count_is_not_pr48_86", n.strip() != "86" and int(n.strip()) >= 27, n)


def g10() -> None:
    group = "G10-evidence-meta"
    info = query_pg_version()
    record(
        group,
        "postgres_version_queried_not_hardcoded",
        info["server_version_num"].isdigit() and info["server_version"] != "" and "PostgreSQL" in info["version"],
        json.dumps(info)[:800],
    )


def _replace_function(sql: str) -> None:
    psql("pr45owner", sql)


def neg_controls() -> None:
    """Load-bearing negatives: removing each new safeguard makes the safety property fail."""
    group = "NEG-load-bearing"

    # NEG-1: unguarded complete (rescan then UPDATE without residual/barrier exclusive).
    reset()
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_enumerate_targets('preq_cr');",
    )
    tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_late_neg','shop_a','191167');",
    )
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "DELETE FROM public.\"ShopifyOrderLineFact\"; DELETE FROM public.\"ShopifyOrderFact\"; DELETE FROM public.\"AuditEvent\";",
    )
    _replace_function(
        """
        CREATE OR REPLACE FUNCTION public.stocky_privacy_complete_customer_redact(p_request_id text, p_attempt_id text)
        RETURNS text
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = pg_catalog, pg_temp
        AS $$
        BEGIN
          UPDATE public."PrivacyRequest" SET state='COMPLETED' WHERE id = p_request_id;
          INSERT INTO public."PrivacyCompletionReceipt"(id,"privacyRequestId","generationId","targetShopIdHmac")
            VALUES ('rcpt_neg', p_request_id, 'gen_a', 'hmac:shop_a')
            ON CONFLICT ("privacyRequestId") DO NOTHING;
          RETURN 'completed';
        END;
        $$;
        ALTER FUNCTION public.stocky_privacy_complete_customer_redact(text, text) OWNER TO stocky_privacy_target_owner;
        GRANT EXECUTE ON FUNCTION public.stocky_privacy_complete_customer_redact(text, text) TO stocky_privacy_erasure, stocky_control_plane;
        """
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_complete_customer_redact('preq_cr','patt_cr');",
    )
    rc_s, surv, _ = psql(
        "pr45owner",
        "SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_late_neg';",
    )
    rc_st, st, _ = psql("pr45owner", "SELECT state FROM public.\"PrivacyRequest\" WHERE id='preq_cr';")
    unguarded_false_complete = rc == 0 and "completed" in last_line(out) and surv.strip() == "1" and st.strip() == "COMPLETED"
    record(
        group,
        "completion_guard_removed_allows_false_complete",
        unguarded_false_complete,
        f"out={out} survivors={surv} state={st} err={err}",
    )

    # NEG-2: enumerator without epoch fence (old CE-6).
    reset()
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_enumerate_targets('preq_cr');",
    )
    _replace_function(
        """
        CREATE OR REPLACE FUNCTION public.stocky_privacy_enumerate_targets(p_request_id text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = pg_catalog, pg_temp
        AS $$
        DECLARE r public."PrivacyRequest"%ROWTYPE; oid text; n int; missing int := 0;
        BEGIN
          IF p_request_id IS DISTINCT FROM NULLIF(current_setting('stocky.privacy_request_id', true), '') THEN
            RAISE EXCEPTION 'enumerator_request_guc_mismatch' USING ERRCODE = '42501';
          END IF;
          SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
          DELETE FROM public."PrivacyTargetKey" WHERE "requestId" = r.id;
          FOREACH oid IN ARRAY COALESCE(r."lookupOrderLegacyIds", '{}') LOOP
            INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
              SELECT r.id, r."targetShopId", 'ShopifyOrderFact', f.id
              FROM public."ShopifyOrderFact" f
              WHERE f."shopId" = r."targetShopId" AND f."shopifyLegacyResourceId" = oid;
            GET DIAGNOSTICS n = ROW_COUNT;
            IF n = 0 THEN missing := missing + 1; END IF;
          END LOOP;
          UPDATE public."PrivacyRequest" SET "enumerationComplete" = (missing = 0), "missingLinkages" = missing WHERE id = r.id;
        END;
        $$;
        ALTER FUNCTION public.stocky_privacy_enumerate_targets(text) OWNER TO stocky_privacy_target_owner;
        GRANT EXECUTE ON FUNCTION public.stocky_privacy_enumerate_targets(text) TO stocky_privacy_erasure, stocky_privacy_reader, stocky_control_plane;
        """
    )
    psql(
        "pr45owner",
        """
        UPDATE public."PrivacyAttempt" SET state='LOST', "leaseUntil"=now()-interval '1 second' WHERE id='patt_cr';
        INSERT INTO public."PrivacyAttempt"(id,"privacyRequestId",epoch,state,"leaseUntil",worker)
          VALUES ('patt_neg2','preq_cr',2,'RUNNING', now()+interval '1 hour','w2');
        UPDATE public."PrivacyRequest" SET "activeAttemptId"='patt_neg2' WHERE id='preq_cr';
        """,
    )
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_neg2",
        "SELECT public.stocky_privacy_enumerate_targets('preq_cr'); DELETE FROM public.\"ShopifyOrderLineFact\"; DELETE FROM public.\"ShopifyOrderFact\"; DELETE FROM public.\"AuditEvent\";",
    )
    rc_e2, e2, _ = psql(
        "pr45owner",
        "SELECT \"enumerationComplete\"::text||','||\"missingLinkages\"::text FROM public.\"PrivacyRequest\" WHERE id='preq_cr';",
    )
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_enumerate_targets('preq_cr');",
    )
    rc_e3, e3, _ = psql(
        "pr45owner",
        "SELECT \"enumerationComplete\"::text||','||\"missingLinkages\"::text FROM public.\"PrivacyRequest\" WHERE id='preq_cr';",
    )
    rc_k, k3, _ = psql("pr45owner", "SELECT count(*) FROM public.\"PrivacyTargetKey\" WHERE \"requestId\"='preq_cr';")
    record(
        group,
        "epoch_guard_removed_allows_stale_publish",
        e2.strip() == "true,0" and e3.strip() == "false,1" and k3.strip() == "0",
        f"epoch2={e2} after_stale={e3} keys={k3}",
    )

    # NEG-3: writer gate removed (participating_write_guard no-op) plus unguarded CP insert.
    reset()
    _replace_function(
        """
        CREATE OR REPLACE FUNCTION public.stocky_participating_write_guard(p_canonical_domain text)
        RETURNS void
        LANGUAGE plpgsql
        SET search_path = pg_catalog, pg_temp
        AS $$
        BEGIN
          NULL;
        END;
        $$;
        REVOKE ALL ON FUNCTION public.stocky_participating_write_guard(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.stocky_participating_write_guard(text) TO stocky_runtime, stocky_control_plane;
        """
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
    record(
        group,
        "writer_gate_removed_skips_freeze",
        rc == 0,
        f"rc={rc} err={err} (unguarded guard succeeds on ERASING generation)",
    )

    # NEG-4: restore generation-guessing resolver (CC-01 / CE-A).
    reset()
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_install_customer_barrier('preq_cr','patt_cr');",
    )
    _replace_function(
        """
        CREATE OR REPLACE FUNCTION public.stocky_shop_generation_id(p_shop_id text)
        RETURNS text
        LANGUAGE sql STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, pg_temp
        AS $$
          SELECT g.id FROM public."ShopInstallGeneration" g
          WHERE g."targetShopId" = p_shop_id OR g."shopRowId" = p_shop_id
          ORDER BY g.id DESC LIMIT 1;
        $$;
        ALTER FUNCTION public.stocky_shop_generation_id(text) OWNER TO stocky_lifecycle_gate_owner;
        GRANT EXECUTE ON FUNCTION public.stocky_shop_generation_id(text) TO stocky_runtime, stocky_control_plane, stocky_lifecycle_gate_owner;
        CREATE OR REPLACE FUNCTION public.stocky_customer_write_guard(
          p_canonical_domain text, p_shop_id text, p_kind text, p_value text,
          p_payload_admitted_at timestamptz, p_origin_generation_id text DEFAULT NULL
        ) RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = pg_catalog, pg_temp
        AS $$
        DECLARE v_gen text; n int;
        BEGIN
          v_gen := public.stocky_shop_generation_id(p_shop_id);
          PERFORM public.stocky_customer_target_lock_shared(p_canonical_domain, p_kind, p_value);
          SELECT count(*) INTO n FROM public."PrivacyCustomerTargetBarrier" b
            WHERE b."shopId" = p_shop_id AND b."generationId" = v_gen
              AND b."targetKind" = p_kind AND b."targetValue" = p_value AND b.state = 'ACTIVE';
          IF n > 0 THEN RAISE EXCEPTION 'customer_target_erasing' USING ERRCODE = 'P0001'; END IF;
        END;
        $$;
        ALTER FUNCTION public.stocky_customer_write_guard(text, text, text, text, timestamptz, text) OWNER TO stocky_lifecycle_gate_owner;
        GRANT EXECUTE ON FUNCTION public.stocky_customer_write_guard(text, text, text, text, timestamptz, text) TO stocky_runtime, stocky_control_plane;
        """
    )
    psql(
        "pr45owner",
        "INSERT INTO public.\"ShopInstallGeneration\"(id,\"canonicalDomain\",\"targetShopId\",\"shopRowId\",fence) "
        "VALUES ('gen_a_zz','pr7-a.myshopify.com','shop_a','shop_a','LIVE');",
    )
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp());",
    )
    record(
        group,
        "generation_guess_restored_defeats_barrier",
        rc == 0,
        f"rc={rc} err={err} (ORDER BY id DESC admits while barrier ACTIVE on gen_a)",
    )

    # NEG-5: residual without its own GUC guard returns 0.
    reset()
    _replace_function(
        """
        CREATE OR REPLACE FUNCTION public.stocky_privacy_customer_residual_count(p_request_id text)
        RETURNS bigint
        LANGUAGE plpgsql STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, pg_temp
        AS $$
        DECLARE r public."PrivacyRequest"%ROWTYPE; audit_n bigint := 0; order_n bigint := 0; line_n bigint := 0;
        BEGIN
          SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
          IF r."lookupCustomerRestId" IS NOT NULL THEN
            SELECT count(*) INTO audit_n FROM public."AuditEvent" a
              WHERE a."shopId" = r."targetShopId" AND a."customerRestId" = r."lookupCustomerRestId";
          END IF;
          SELECT count(*) INTO order_n FROM public."ShopifyOrderFact" f
            WHERE f."shopId" = r."targetShopId"
              AND f."shopifyLegacyResourceId" = ANY (COALESCE(r."lookupOrderLegacyIds", '{}'));
          SELECT count(*) INTO line_n FROM public."ShopifyOrderLineFact" l
            WHERE l."shopId" = r."targetShopId"
              AND l."shopifyOrderGid" IN (
                SELECT 'gid://shopify/Order/' || oid FROM unnest(COALESCE(r."lookupOrderLegacyIds", '{}')) AS oid
              );
          RETURN audit_n + order_n + line_n;
        END;
        $$;
        ALTER FUNCTION public.stocky_privacy_customer_residual_count(text) OWNER TO stocky_privacy_target_owner;
        GRANT EXECUTE ON FUNCTION public.stocky_privacy_customer_residual_count(text) TO stocky_privacy_erasure, stocky_control_plane;
        """
    )
    rc, out, err = psql("stocky_privacy_erasure", "SELECT public.stocky_privacy_customer_residual_count('preq_cr');")
    record(
        group,
        "residual_guard_removed_returns_zero",
        rc == 0 and last_line(out) == "0",
        f"out={out} err={err} (unguarded residual returns 0; true value 3)",
    )


def g11() -> None:
    """CC-GEN: generation-independent target locks and trusted origin."""
    group = "G11-generation-namespace"
    reset()
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_install_customer_barrier('preq_cr','patt_cr');",
    )
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp());",
    )
    record(group, "cea_baseline_one_gen_still_denies", rc != 0 and "customer_target_erasing" in err, err, sqlstate_from_err(err))

    # Adversarial ID: lexicographically higher than gen_a, inserted later.
    psql(
        "pr45owner",
        "INSERT INTO public.\"ShopInstallGeneration\"(id,\"canonicalDomain\",\"targetShopId\",\"shopRowId\",fence,\"installedAt\") "
        "VALUES ('gen_a_zz','pr7-a.myshopify.com','shop_a','shop_a','LIVE', clock_timestamp());",
    )
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp());",
    )
    record(group, "cea_two_gen_matching_write_still_denied", rc != 0 and "customer_target_erasing" in err, err, sqlstate_from_err(err))
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp(), 'gen_a_zz');",
    )
    record(group, "cea_declared_successor_origin_cannot_bypass_active_barrier", rc != 0 and "customer_target_erasing" in err, err, sqlstate_from_err(err))
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','999999', clock_timestamp()); INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_g11_other','shop_a','999999'); SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_g11_other';",
    )
    record(group, "two_gen_unrelated_customer_still_progresses", rc == 0 and last_line(out) == "1", f"out={out} err={err}")

    # CE-B: complete, then second generation, delayed payload still restore-denied.
    reset()
    tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_install_customer_barrier('preq_cr','patt_cr');"
        " SELECT public.stocky_privacy_enumerate_targets('preq_cr');"
        " DELETE FROM public.\"ShopifyOrderLineFact\"; DELETE FROM public.\"ShopifyOrderFact\"; DELETE FROM public.\"AuditEvent\";"
        " SELECT public.stocky_privacy_complete_customer_redact('preq_cr','patt_cr');",
    )
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp() - interval '1 hour');",
    )
    record(group, "ceb_baseline_restore_denied", rc != 0 and "customer_target_restore_denied" in err, err, sqlstate_from_err(err))
    psql(
        "pr45owner",
        "INSERT INTO public.\"ShopInstallGeneration\"(id,\"canonicalDomain\",\"targetShopId\",\"shopRowId\",fence,\"installedAt\") "
        "VALUES ('gen_a_zz','pr7-a.myshopify.com','shop_a','shop_a','LIVE', clock_timestamp());",
    )
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp() - interval '1 hour', 'gen_a');",
    )
    record(group, "ceb_two_gen_old_origin_still_restore_denied", rc != 0 and "customer_target_restore_denied" in err, err, sqlstate_from_err(err))

    # Two LIVE + delayed payload without declared origin → ambiguous, not a silent admit.
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp() - interval '1 hour');",
    )
    record(
        group,
        "two_live_undeclared_origin_ambiguous_not_admitted",
        rc != 0 and ("customer_write_origin_ambiguous" in err or "customer_target_attribution_ambiguous" in err or "customer_target_restore_denied" in err),
        err,
        sqlstate_from_err(err),
    )

    # Genuine successor: unique LIVE gen_a_zz, gen_a not LIVE, payload after installedAt.
    psql("pr45owner", "UPDATE public.\"ShopInstallGeneration\" SET fence='UNINSTALLED', \"shopRowId\"=NULL WHERE id='gen_a';")
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp() - interval '1 hour', 'gen_a_zz');",
    )
    record(group, "queued_payload_before_successor_install_restore_denied", rc != 0 and "customer_target_restore_denied" in err, err, sqlstate_from_err(err))
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp() + interval '1 second', 'gen_a_zz');"
        " INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_g11_succ','shop_a','191167');"
        " SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_g11_succ';",
    )
    record(group, "genuine_successor_fresh_payload_allowed", rc == 0 and last_line(out) == "1", f"out={out} err={err}")

    # Missing origin: no LIVE binding.
    psql("pr45owner", "UPDATE public.\"ShopInstallGeneration\" SET fence='UNINSTALLED', \"shopRowId\"=NULL WHERE id='gen_a_zz';")
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp() - interval '1 hour');",
    )
    record(group, "missing_origin_fails_closed", rc != 0 and ("customer_write_origin_missing" in err or "customer_target_restore_denied" in err), err, sqlstate_from_err(err))

    # Three-generation adversarial order + concurrent reinstall vs barrier.
    reset()
    started = threading.Event()
    outcome: dict[str, str] = {}

    def reinstall() -> None:
        started.wait(5)
        psql(
            "pr45owner",
            "INSERT INTO public.\"ShopInstallGeneration\"(id,\"canonicalDomain\",\"targetShopId\",\"shopRowId\",fence,\"installedAt\") "
            "VALUES ('aaa_old','pr7-a.myshopify.com','shop_a','shop_a','UNINSTALLED', now() - interval '3 days'),"
            "       ('gen_a_zz','pr7-a.myshopify.com','shop_a','shop_a','LIVE', clock_timestamp()) "
            "ON CONFLICT (id) DO NOTHING;",
        )
        outcome["insert"] = "ok"

    def barrier() -> None:
        started.set()
        rc_b, out_b, err_b = tx(
            "stocky_privacy_erasure",
            "shop_a",
            "preq_cr",
            "patt_cr",
            "SELECT public.stocky_privacy_install_customer_barrier('preq_cr','patt_cr');",
        )
        outcome["barrier_rc"] = str(rc_b)
        outcome["barrier_err"] = err_b[:300]

    t1 = threading.Thread(target=reinstall)
    t2 = threading.Thread(target=barrier)
    t1.start()
    t2.start()
    t1.join(10)
    t2.join(10)
    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-a.myshopify.com','shop_a','CUSTOMER_REST_ID','191167', clock_timestamp());",
    )
    record(
        group,
        "concurrent_reinstall_cannot_bypass_namespace_barrier",
        outcome.get("barrier_rc") == "0" and rc != 0 and "customer_target_erasing" in err,
        f"barrier={outcome} write_err={err[:300]}",
        sqlstate_from_err(err),
    )
    rc, out, err = tx(
        "stocky_runtime",
        "shop_b",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_fact_write_guard('pr7-b.myshopify.com','shop_b','CUSTOMER_REST_ID','191167', clock_timestamp());"
        " INSERT INTO public.\"AuditEvent\"(id,\"shopId\",\"customerRestId\") VALUES ('ae_g11_b','shop_b','191167');"
        " SELECT count(*) FROM public.\"AuditEvent\" WHERE id='ae_g11_b';",
    )
    record(group, "other_shop_unrelated_to_namespace_progresses", rc == 0 and last_line(out) == "1", f"out={out} err={err}")


def g12() -> None:
    """CC-02: residual helper owns GUC/attempt/capability/tenant. Direct calls."""
    group = "G12-residual-guard"
    reset()
    rc, out, err = psql("stocky_privacy_erasure", "SELECT public.stocky_privacy_customer_residual_count('preq_cr');")
    record(group, "residual_no_guc_raises_42501", rc != 0 and "residual_request_guc_mismatch" in err, err, sqlstate_from_err(err))

    rc, out, err = psql(
        "stocky_privacy_erasure",
        "BEGIN; SELECT set_config('stocky.privacy_request_id','preq_sr', true);"
        " SELECT public.stocky_privacy_customer_residual_count('preq_cr'); COMMIT;",
    )
    record(group, "residual_foreign_request_guc_raises_42501", rc != 0 and "residual_request_guc_mismatch" in err, err, sqlstate_from_err(err))

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_b",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_customer_residual_count('preq_cr');",
    )
    record(group, "residual_wrong_tenant_raises_42501", rc != 0 and "residual_tenant_mismatch" in err, err, sqlstate_from_err(err))

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_lost",
        "SELECT public.stocky_privacy_customer_residual_count('preq_cr');",
    )
    record(group, "residual_stale_attempt_raises_42501", rc != 0 and "residual_stale_attempt" in err, err, sqlstate_from_err(err))

    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_customer_residual_count('preq_cr');",
    )
    record(group, "residual_direct_nonzero_with_full_context", rc == 0 and last_line(out) == "3", f"out={out} err={err}")

    # Genuine empty: source rows are gone (owner/BYPASSRLS), not merely RLS-hidden from the caller.
    psql(
        "pr45owner",
        "DELETE FROM public.\"ShopifyOrderLineFact\"; DELETE FROM public.\"ShopifyOrderFact\"; DELETE FROM public.\"AuditEvent\";",
    )
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_customer_residual_count('preq_cr');",
    )
    record(group, "residual_direct_genuine_empty", rc == 0 and last_line(out) == "0", f"out={out} err={err}")

    rc, out, err = tx(
        "stocky_control_plane",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_customer_residual_count('preq_cr');",
    )
    record(group, "residual_control_plane_execute_with_context", rc == 0 and last_line(out) in ("0", "3"), f"out={out} err={err}")

    rc, out, err = tx(
        "stocky_runtime",
        "shop_a",
        "preq_cr",
        "patt_cr",
        "SELECT public.stocky_privacy_customer_residual_count('preq_cr');",
    )
    record(group, "residual_runtime_execute_denied", rc != 0 and sqlstate_from_err(err) == "42501", err, sqlstate_from_err(err))

    rc, out, err = tx(
        "stocky_privacy_reader",
        "shop_a",
        "preq_dr",
        "patt_dr",
        "SELECT public.stocky_privacy_customer_residual_count('preq_dr');",
    )
    record(group, "residual_reader_execute_denied", rc != 0 and sqlstate_from_err(err) == "42501", err, sqlstate_from_err(err))

    # Same-shop different request GUC.
    rc, out, err = tx(
        "stocky_privacy_erasure",
        "shop_a",
        "preq_dr",
        "patt_cr",
        "SELECT public.stocky_privacy_customer_residual_count('preq_cr');",
    )
    record(group, "residual_same_shop_other_request_guc_raises", rc != 0 and "residual_request_guc_mismatch" in err, err, sqlstate_from_err(err))



def main() -> int:
    os.makedirs(PROOF_ROOT, exist_ok=True)
    reset()
    g1()
    g2()
    g3()
    g4()
    g5()
    g6()
    g7()
    g8()
    g9()
    g10()
    g11()
    g12()
    neg_controls()
    # Clean rerun after function replacements.
    g7()
    g8()
    g9()
    g11()
    g12()
    failed = [r for r in RESULTS if not r["ok"]]
    pg = query_pg_version()
    pairs = [(r["group"], r["name"]) for r in RESULTS]
    unique_n = len(set(pairs))
    rerun_n = len(pairs) - unique_n
    by_group: dict[str, dict[str, int]] = {}
    seen: set[tuple[str, str]] = set()
    for r in RESULTS:
        g = by_group.setdefault(r["group"], {"records": 0, "unique": 0})
        g["records"] += 1
        key = (r["group"], r["name"])
        if key not in seen:
            g["unique"] += 1
            seen.add(key)
    payload = {
        "results_json_class": "run_log_nondeterministic_timings_not_a_verification_artifact",
        "postgres_queried": pg,
        "host": f"{PGHOST}:{PGPORT}",
        "proof_root": PROOF_ROOT,
        "total": len(RESULTS),
        "pass": len(RESULTS) - len(failed),
        "fail": len(failed),
        "unique_assertions": unique_n,
        "declared_reruns": rerun_n,
        "by_group": by_group,
        "results": RESULTS,
        "failed": failed,
        "historical_tf_115_record_packet": {
            "records": 115,
            "unique": 89,
            "declared_reruns": 26,
            "note": "115 records ≠ 115 unique assertions",
        },
        "historical_original_59_case_script_hashes": {
            "01_contract.sql": "b29ef463c26a9a3ad745fc7a56bc40901ced1c55429a59c441d89634858db054",
            "02_seed.sql": "d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632",
            "03_run_proofs.py": "6900553779c3d2e8237fc189fcad42a1810262d3110ab60f30ab32208667ebb4",
            "results.json_original_run_log": "ecc9acd1d59cda2d9d5910b46e9ffa1766c4e29c3671ceda270dea98d80303b8",
            "note": "historical identities only; results.json must not be expected equal across executions",
        },
        "historical_tf_contract_hashes": {
            "01_contract.sql": "75ab1c02fc01560d975a78737bccbc7c2fa6330a07100ad98d2b243d349846de",
            "02_seed.sql": "d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632",
            "03_run_proofs.py": "566e0f289f2ca4da526286b3ca831c906030973958318eb60b55a0237823251a",
        },
    }
    path = os.path.join(PROOF_ROOT, "results.json")
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
    print(json.dumps({
        "total": payload["total"],
        "pass": payload["pass"],
        "fail": payload["fail"],
        "unique_assertions": unique_n,
        "declared_reruns": rerun_n,
        "postgres": pg["server_version"],
        "host": payload["host"],
    }, indent=2))
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
```
