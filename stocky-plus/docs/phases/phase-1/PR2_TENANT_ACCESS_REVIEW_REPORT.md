<!--
Chain of custody (preservation preface — not part of the independent review body):
- Report author: Claude Code
- Reviewed implementation head: 6f9ca22c069a46003b6944ff56c888ff91e95cdc
- The report was returned through the user because Claude lacked push credentials
- Cursor is preserving this artifact verbatim below
- The preservation commit is not part of the reviewed implementation
-->

# Phase 1 PR 2 — Independent Review Report

**Artifact destination:** `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_REVIEW_REPORT.md`

---

## 1. Review identity

| Field | Value |
|---|---|
| Pull request | #13 — Phase 1 PR 2, tenant-bound access conversion |
| Authorized base SHA | `04289d61f605414597ac85f47830a3c9d2f9e33d` (verified = `origin/main` tip at clone) |
| Reviewed implementation head | `6f9ca22c069a46003b6944ff56c888ff91e95cdc` (verified via `git rev-parse HEAD` after detached checkout) |
| Branch | `phase-1/tenant-access` |
| Checkout state | Clean (`git status --porcelain` empty before and after review; all probe files removed) |
| Commits in range | 6 (`2a14f19`, `219a5e3`, `80e928b`, `dd6ca39`, `8a5a8e4`, `6f9ca22`) — matches the implementation report's stated six |
| Diff scope | 73 files changed, 5,453 insertions, 621 deletions |
| OS | Ubuntu 24.04 (x86_64, Linux container) |
| Node | v22.22.2 |
| npm | 11.5.2 (installed to satisfy `engines.npm`; container default 10.9.7 could not run `npm ci`) |
| PostgreSQL | **Not available** — see §7 blockers |
| Redis | **Not available** — see §7 blockers |
| Review date | 2026-08-01 (UTC) |
| Implementation code modified | **No** |
| Report committed to branch | **No** — see §10 |

---

## 2. Executive verdict

# `NOT READY — CORRECTIONS REQUIRED`

Three P1 findings block acceptance. Each is independently reproduced from source at the exact reviewed head, and none is a documentation or hygiene issue:

1. **Every merchant row with a null PR 1 `shopId` becomes invisible.** The tenant scope is a conjunction (`shopId AND shop`), not the approved compatibility disjunction. This is a material product-behavior regression on a branch whose stated boundary is no behavior change, and it lands while production backfill remains separately unauthorized.
2. **Nested relation loads are not tenant-scoped.** `include` / `select` / `_count` are passed through to Prisma untouched, so a tenant-scoped parent read can return child rows belonging to another tenant. The architecture document acknowledges this and defers it to PR 3 RLS; the review standard for this PR explicitly forbids that deferral.
3. **The job envelope carries no integrity mechanism.** `parseTenantJobEnvelope` performs structural validation only — there is no signature, no HMAC, no timing-safe comparison, no secret, no timestamp age policy. Knowledge of a valid canonical `shopId` + domain pair is sufficient to forge worker tenant authority for anyone able to write to the queue. `DECISIONS.md:200` and `PHASE_BRIEF.md:184` both require "sufficient integrity validation."

Separately, the review environment could not execute the database- and Redis-backed portions of the validation suite (Prisma engine downloads are blocked by network policy). This did **not** determine the verdict — the P1s are established from source and from executed static tooling — but it does mean **no `READY` verdict could have been issued from this environment regardless of findings**, and the DB fixture matrices in §6 are marked as reasoned-from-source rather than executed.

---

## 3. Findings

### F-PR2-01 — P1 — Nullable PR 1 ownership rows are silently excluded from all tenant reads and writes

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:38-53` (`tenantScopeWhere`)

**Requirement violated:** PR 2 nullable-row compatibility contract; PR 1 additive-migration compatibility; the approved no-product-behavior-change boundary; the operational sequence in which production backfill is not yet authorized.

**Actual behavior:** For direct models the scope is

```ts
return { shopId: authority.shopId, shop: authority.myshopifyDomain };
```

Prisma treats sibling `where` keys as `AND`. A row with `shopId = NULL` therefore never matches, regardless of its legacy `shop` value. For child models the scope is `{ shopId: authority.shopId }` — a null-`shopId` child is likewise unreachable, and there is no parent-lineage path that could recover it. `grep` for an `OR` clause, a null-tolerant branch, or any legacy-only fallback across the whole module returns nothing (verified: `grep -n "OR\b\|legacy\|null" app/tenant/tenant-db.server.ts` — the only `legacy` hits are comments and immutability guards at lines 192 and 207).

**Expected behavior (approved contract):**

```
shopId = authenticated shop ID
OR (shopId IS NULL AND normalized legacy shop = authenticated domain)
```

with a non-null foreign `shopId` never recoverable through legacy `shop`, and conflicting non-null `shopId` + legacy `shop` failing closed. For child models, a nullable child must be constrained through verified same-tenant parent lineage; ambiguous or conflicting ownership must fail closed and must never be guessed or repaired.

**Merchant impact:** On any environment where the PR 1 backfill has not run to completion — which by the PR's own operational sequence includes production — merchants lose visibility of suppliers, purchase orders, stocktakes, transfers, settings, forecasts, and cached variants. The rows are not deleted, but every list, detail page, export, report, and background job behaves as though they were. Recovery requires the backfill that this PR is not authorized to run.

**Reproduction:** Insert a `Supplier` with `shopId = NULL` and `shop = 'tenant-a.myshopify.com'`; issue authority for tenant A; call `db.supplier.findMany({})`. The row is absent. Same for `findUnique`, `update` (throws `not_found`), and `delete` (throws `not_found`).

**Required correction:** Implement the disjunctive direct-model scope with the foreign-`shopId` and conflict exclusions, and a verified-parent-lineage path for nullable children. The compatibility branch must be explicitly time-boxed and removable after the authorized backfill.

**Required regression test:** PostgreSQL fixture matrix covering the ten ownership cases enumerated in the review prompt, asserting read, update, and delete behavior for each — in particular case 3 (foreign non-null `shopId` with matching legacy `shop` → denied) and case 4 (canonical `shopId` with conflicting legacy `shop` → fail closed).

**Blocks acceptance:** Yes.

---

### F-PR2-02 — P1 — Nested relation reads are not tenant-scoped; a tenant query can return another tenant's child rows

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:494-505` (`runScopedOperation`, the `findFirst` / `findMany` / `count` / `aggregate` / `groupBy` branch), and by omission throughout `rewriteUniqueRead` at lines 331-357.

**Requirement violated:** PR 2 tenant-bound application access contract; R-022; the explicit review instruction not to defer an application-contract bypass to PR 3 RLS.

**Actual behavior:** The only argument rewritten is `where`:

```ts
return query({ ...args, where: mergeWhere(args.where, scope) });
```

`args.include`, `args.select`, nested `include.<rel>.where`, and `_count` are forwarded to Prisma verbatim. Prisma resolves relations by foreign key alone. Where a child row's `shopId` is inconsistent with its parent's — which is exactly the state PR 1's nullable, un-backfilled, non-composite-FK schema permits, and which no database constraint currently prevents — the child is returned to the wrong tenant. `rewriteUniqueRead` spreads `...args` into the scoped `findFirst`, carrying the unscoped `include` through as well.

The architecture document concedes this at `docs/phases/phase-1/PR2_TENANT_ACCESS_ARCHITECTURE.md:124`, listing it under "Known residual gaps" and assigning it to composite FK / RLS in PR 3. That is a defense-in-depth deferral of a defect in the layer this PR is defining, and PR 3 is not yet authorized.

**Merchant impact:** Cross-tenant disclosure of supplier SKU mappings, volume price tiers, lead-time snapshots, PO line items, transfer lines, and stocktake lines through the supplier-detail, purchase-order, transfer, stocktake, and Buying Table routes — all of which use relation includes.

**Reproduction:** Create tenant A `Supplier` with a `SupplierSkuMapping` whose `shopId` is tenant B's. As tenant A call `db.supplier.findUnique({ where: { id }, include: { skuMappings: true } })`. The tenant B mapping is returned.

**Expected behavior:** Every nested `include` / `select` on a merchant-owned relation must have the tenant scope injected into its own `where`, recursively; unknown or unmappable relation shapes must fail closed rather than pass through.

**Required correction:** Recursive scoping of relation arguments against the same model map already present in `nestedChildModelFor` and `MERCHANT_MODEL_SET`, with a deny-by-default branch for relations not in the map.

**Required regression test:** Parent-with-foreign-child, parent-with-null-ownership-child, nested `include`, nested `select`, and `_count` cases, executed against real PostgreSQL, plus a test enumerating every relation shape used by current routes and services.

**Blocks acceptance:** Yes.

---

### F-PR2-03 — P1 — Job envelope has no integrity validation; worker tenant authority is forgeable from a well-formed payload

**File / line:** `stocky-plus/app/tenant/job-envelope.server.ts:24-32` (`TenantJobEnvelopeV1` type) and `:57-131` (`parseTenantJobEnvelope`).

**Requirement violated:** `DECISIONS.md:200` — background authority derives only from "a server-created, persisted, validated, versioned job or event envelope that includes canonical `shopId`, source, correlation or causation identity, schema version, and **sufficient integrity validation**." `PHASE_BRIEF.md:184` repeats the same requirement. R-039.

**Actual behavior — hypothesis in the review prompt confirmed:** The envelope type contains `schemaVersion`, `shopId`, `myshopifyDomain`, `source`, `correlationId`, optional `causationId`, `issuedAt`. There is **no signature field**. `parseTenantJobEnvelope` checks only: exact schema-version string match, non-empty string `shopId`, non-empty string `myshopifyDomain` that normalizes, non-empty string `source`, non-empty string `correlationId`, non-empty string `issuedAt`. `grep -in "hmac\|createHmac\|timingSafeEqual\|signature\|secret" app/tenant/job-envelope.server.ts` returns nothing.

`resolveTenantJobContext` then calls `requireCanonicalShopMatch({ shopId, myshopifyDomain })` and, on success, `issueTenantAuthority({ source: "verified_job" })`. The canonical Shop check is a *consistency* check against the database, not an *authenticity* check: it proves the shop exists, not that the server issued the envelope. Any actor able to enqueue a job — direct Redis/BullMQ write, a compromised producer, a replayed or hand-crafted message — obtains full tenant authority for any shop whose ID and domain they know. Both values are low-entropy and are visible in envelopes for other shops.

Ordering is correct in one respect and should be credited: no merchant query occurs before the canonical check. But the check being passed does not establish that the envelope is authentic.

Additional integrity gaps in the same function, each individually reproducible:

- `source` accepts any non-empty string. There is no allowlist, no `webhook:`/`scheduler:` constraint, no topic constraint. A forged `source` is accepted verbatim.
- `issuedAt` is accepted as any non-empty string. It is never parsed as a date. There is no future-timestamp rejection and no maximum-age or replay policy.
- `causationId` is accepted verbatim with no lineage validation.
- Unknown schema versions are correctly denied (`unknown_envelope_version`) — this part is sound.

**Merchant impact:** Cross-tenant read and write through the worker path — the path that performs catalog sync persistence, forecasting, landed-cost calculation, and order/refund/inventory webhook processing.

**Reproduction:** Construct `{ schemaVersion: "tenant-job-envelope-v1", shopId: <any real Shop.id>, myshopifyDomain: <matching domain>, source: "anything", correlationId: "x", issuedAt: "not-a-date" }` and pass it to `resolveTenantJobContext`. It returns a valid `TenantAuthority` and a `TenantDb` for that shop. No secret, no prior envelope, and no producer access are required.

**Expected behavior:** HMAC-SHA256 (or equivalent) over a deterministic serialization of the envelope fields, using a dedicated job-envelope secret with a minimum-strength check, verified with `crypto.timingSafeEqual`; a source allowlist; parsed `issuedAt` with future-skew and maximum-age rejection; secret redaction in logs; a test-only secret in CI.

**Note on scope:** This is transport integrity, required for PR 2 authority. It is not the database-backed persistence, durable replay ledger, dead-letter, or durable idempotency that R-039 correctly defers to PR 4. The R-039 register entry conflates the two by claiming PR 2 mitigation on the basis of "version/shape/Shop match" — shape validation is not integrity validation.

**Required correction:** Add signature generation in `createTenantJobEnvelope` / `issueJobEnvelopeForVerifiedDomain` and verification in `parseTenantJobEnvelope`, before the canonical Shop lookup.

**Required regression test:** The twelve tampering cases from the review prompt — mutated `shopId`, domain, source, correlation, causation, `issuedAt`; added and removed fields; missing signature; invalid signature; raw shop-only payload; arbitrary pre-built envelope handed to a producer — each asserting `TenantAuthorityError` before any merchant query.

**Blocks acceptance:** Yes.

---

### F-PR2-04 — P2 — Architecture audit is bypassable by dynamic import plus computed delegate key

**File / line:** `stocky-plus/scripts/tenant-access/scan.ts` (whole-file pattern model); `stocky-plus/scripts/tenant-access/architecture-audit.test.ts`; fixture directory `stocky-plus/scripts/tenant-access/fixtures/`.

**Requirement violated:** The scanner is the stated enforcement mechanism for the raw-Prisma boundary. Its allowlist and detection model must not be defeatable by semantically equivalent code.

**Actual behavior (independently reproduced at the reviewed head):**

- A temporary file `app/services/zz-tmp-probe.server.ts` using a *static* import of `../db.server` was correctly flagged: `db_server_import — MUST use tenant-bound / bootstrap boundary`. Good.
- A temporary file using a *dynamic* import plus a computed delegate key:

  ```ts
  export async function leak(shop: string) {
    const client: any = (await import("../db.server")).default;
    const table = client["sup" + "plier"];
    return table.findMany({ where: { shop } });
  }
  ```

  produced **`"violations": 0`**. The scanner reported the repository as clean while a runtime service held the unrestricted Prisma client and performed an unscoped merchant read.
- An intermediate probe (dynamic import with a literal `.supplier.findMany` call and a `$queryRawUnsafe` call) was caught — but only by the delegate-call and raw-SQL pattern matchers, not by any import rule. The dynamic import itself is invisible to the `db_server_import` check.

All probe files were deleted and the working tree returned to a clean state (`git status --porcelain` empty; `git rev-parse HEAD` unchanged).

**Missing negative fixtures:** The suite ships five (`route-db-import`, `service-db-import`, `worker-prisma-import`, `unauthorized-raw-query`, `bootstrap-merchant-access`). The review contract requires fixtures for, at minimum: **dynamic-import bypass**, **re-export bypass**, **alias/path bypass**, **raw shop-only queue payload**, **wildcard allowlist rejection**, and **stale inventory detection**. Six of eleven required negative cases are absent.

**Bearing on the reported totals:** 411 findings / 0 violations / 121 files / 205 converted paths were independently reproduced (`npm run tenant:access:audit`, `npm run tenant:access:inventory` — regenerating the committed inventory produced a one-line diff consisting solely of the `Generated at` timestamp, confirming the committed inventory is current and the counts are honest). The counts are accurate. What they are not is *sufficient*: a zero-violation result is compatible with the demonstrated bypass above.

**Required correction:** Detect dynamic `import()` of the construction module and of any re-export chain reaching it; detect computed/aliased delegate access on values derived from it; add the six missing fixtures.

**Blocks acceptance:** Should be resolved before acceptance.

---

### F-PR2-05 — P2 — Nested relation `connect` of a foreign child row is not ownership-validated

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:66-113` (`rejectForeignShopId`), `:250-277` (`assertParentOwnership`).

**Actual behavior:** `rejectForeignShopId` recurses into `create`, `createMany`, and `connectOrCreate.create` payloads, and rejects explicit foreign `shopId` / `shop` literals. It does **not** validate `connect: { id }` targets. `assertParentOwnership` validates only the single declared parent relation named in `PARENT_OWNERSHIP_RULES[model].foreignKey`, and only for the child→parent direction. A parent-side write that connects an arbitrary child ID — for example a `PurchaseOrder` update connecting a `POLineItem` owned by another tenant — performs no ownership check on that ID.

**Merchant impact:** Cross-tenant re-parenting of child rows, which in the purchase-order and stocktake domains means financial and inventory line data crossing tenants.

**Expected behavior:** Every `connect` / `connectOrCreate.where` / `set` / `disconnect` target on a merchant-owned relation must be resolved through a tenant-scoped lookup before the write, failing closed on miss.

**Required regression test:** Parent update connecting a foreign child; parent create connecting a foreign child; `set` with a mixed-ownership ID array.

**Blocks acceptance:** Should be resolved before acceptance.

---

### F-PR2-06 — P2 — Client shop-hint extraction is incomplete; conflicting identifiers can go undetected

**File / line:** `stocky-plus/app/tenant/client-shop.server.ts:10` (`SHOP_HINT_KEYS`), `:26-70` (`extractClientShopHints`).

**Actual behavior:** Hints are read from top-level query parameters via `searchParams.get` (first occurrence only — a duplicated `?shop=A&shop=B` never surfaces B), four named headers, **top-level** JSON body keys only, and **top-level** form fields only. Nested JSON objects and nested form structures are not walked. Route parameters are not inspected at all. Alternate spellings beyond the four in `SHOP_HINT_KEYS` and array-valued fields are not handled.

**Assessment:** Authority itself is not derivable from these values — the branded `WeakSet` in `authority.server.ts:9,53-63` is sound and a plain object cannot become authority, which I confirmed by inspection. So the failure mode is not "request becomes Shop B"; it is that an undetected conflicting hint is silently ignored rather than denied. That is weaker than the stated contract in R-038 and leaves no signal if a route later reads a raw parameter directly.

**Required correction:** Recursive walk of JSON and form bodies, `searchParams.getAll`, route parameters, and a broadened key set.

**Required regression test:** Conflicting Shop B identifier in each of query (including duplicate), header, top-level JSON, nested JSON, top-level form, nested form, and route parameter, during an authenticated Shop A request — asserting denial in every position.

**Blocks acceptance:** Should be resolved before acceptance.

---

### F-PR2-07 — P3 — Webhook path can create a canonical Shop outside the install flow

**File / line:** `stocky-plus/app/tenant/webhook-tenant.server.ts:29-36` — `createIfMissing: true`.

The comment justifies this as covering first-delivery races before `afterAuth` completes. The webhook is HMAC-verified, so this is a Shopify-verified path and not an authentication defect. But it does mean canonical `Shop` rows can originate outside the OAuth install flow, which weakens "canonical Shop creation occurs only after a verified Shopify authentication path" as a reviewable invariant. Recommend narrowing to the specific topics where the race is real, and recording the origin on the Shop row so provenance is auditable.

**Blocks acceptance:** No.

---

### F-PR2-08 — P3 — R-039 register wording does not distinguish transport integrity from PR 4 persistence

**File / line:** `stocky-plus/docs/RISK_REGISTER.md:66`.

The entry claims PR 2 mitigation on the basis that "workers validate version/shape/Shop match before merchant access," and scopes the "not closed" remainder to PR 4 persistence, replay, dead-letter, and idempotency. Per F-PR2-03, transport integrity is neither implemented nor listed as outstanding. The entry should state explicitly that cryptographic envelope integrity is a PR 2 requirement that is not yet met.

Related documentation observations, none individually blocking: `docs/phases/phase-1/PR2_TENANT_ACCESS_ARCHITECTURE.md:124` records the nested-`include` gap as an acceptable residual deferred to PR 3, which under this PR's review standard it is not. R-022, R-024, R-027, and R-038 are correctly left open and marked "pending Claude review" — none is prematurely closed. D-027 reads as implementation authorization rather than acceptance, correctly. Q-011 remains open; `OPEN_QUESTIONS.md` was not touched by this PR, and its existing content is adequate — I do not find that a PR 2 evidence update was contractually required there. The implementation report names all six commits and distinguishes the reviewed head correctly.

**Blocks acceptance:** No.

---

### F-PR2-09 — P3 — Lockfile install is npm-version-fragile

`package.json:42-45` pins `"npm": "11.5.2"`. Under npm 10.9.7, `npm ci` fails with `EUSAGE — Missing: @emnapi/core@2.0.0-alpha.3 ... from lock file`. Under npm 11.5.2 it succeeds cleanly (970 packages). This is a reproducibility papercut for reviewers and new contributors rather than a defect; worth an explicit note in the contributor docs.

**Blocks acceptance:** No.

---

## 4. Independent execution evidence

All commands run from `stocky-plus/` at detached `6f9ca22c069a46003b6944ff56c888ff91e95cdc`.

| Command | Exit | Result |
|---|---|---|
| `git fetch origin phase-1/tenant-access` | 0 | `FETCH_HEAD = 6f9ca22c069a46003b6944ff56c888ff91e95cdc` — matches authorized head |
| `git rev-parse origin/main` (clone tip) | 0 | `04289d6…` — matches authorized base |
| `git status --porcelain` (pre and post) | 0 | Empty — clean tree |
| `npm ci` (npm 10.9.7) | 1 | `EBADENGINE`, then `EUSAGE` lockfile-sync error |
| `npm ci` (npm 11.5.2) | 0 | 970 packages, 34s |
| `npx prisma generate` | 1 | **BLOCKED** — `Failed to fetch the engine file at https://binaries.prisma.sh/... 403 Forbidden` (domain outside allowed egress list) |
| `npx prisma generate` with `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` | 1 | **BLOCKED** — same 403 |
| `npx prisma validate` | 1 | **BLOCKED** — engine dependency |
| `npx prisma migrate deploy` | — | **BLOCKED** — no PostgreSQL 16, no engine |
| `npm run tenant:indexes:apply / :verify / tenant:schema:drift / tenant:indexes:plan` | — | **BLOCKED** — no database |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 121, findings: 411, violations: 0, modelsCovered: 18, exceptionsUsed: [EX-BF-001, EX-BOOT-001, EX-IDX-001, EX-RAW-001, EX-SEED-001, EX-TDB-001, EX-TEST-001]` — reproduces the reported totals exactly |
| `npm run tenant:access:inventory` | 0 | Regenerated file differs from committed only in the `Generated at` timestamp — inventory is current, not stale |
| `npm run tenant:access:inventory:check` | 0 | Pass |
| `npm run test:tenant-access` | 1 | **PARTIAL** — 4 files failed to collect with `@prisma/client did not initialize yet`; 1 file passed with 7 tests (`scripts/tenant-access/architecture-audit.test.ts`). The four failing files are the DB-backed tenant integration suites; failure is environmental, not a defect |
| `npm run lint` | 0 | Pass |
| `npm run typecheck` | — | **BLOCKED** — requires generated Prisma client |
| `npm test`, `npm run test:migrations`, `npm run test:subject-memory`, `npm run build`, `npm run graphql-codegen` | — | **BLOCKED** — same dependency chain |
| Scanner probe A (static import, aliased delegate) | — | Correctly flagged: `db_server_import` |
| Scanner probe B (dynamic import, literal delegate + raw SQL) | — | Partially flagged: `merchant_delegate_call`, `raw_sql`; the dynamic import itself not flagged |
| Scanner probe C (dynamic import + computed delegate key) | — | **`violations: 0`** — bypass confirmed (F-PR2-04) |
| Probe cleanup | — | All three probe files deleted; `git status --porcelain` empty; `HEAD` unchanged |

**Live PR / CI verification:** **Not performed.** No authenticated GitHub access and no `gh` CLI in this environment. PR #13 state (open, draft, unmerged, mergeable), the changed-file and commit counts as GitHub reports them, and workflow run `30674521145` / job `91298898234` were **not** independently confirmed. The commit range and diff scope were verified from the Git objects directly. This must be closed out by a reviewer with GitHub access before acceptance.

---

## 5. Access-inventory verification

| Metric | Cursor-reported | Independently verified |
|---|---|---|
| Scanned files | 121 | 121 ✔ |
| Findings | 411 | 411 ✔ |
| Converted paths | 205 | 205 ✔ |
| Violations | 0 | 0 ✔ (but see F-PR2-04 — the zero is not conclusive) |
| Merchant-owned models covered | 18 | 18 ✔ (delegate list in `tenant-db.server.ts:630-648` matches `models.ts`) |
| Exceptions used | 7 | 7 ✔ |

**Exception evaluation:**

| ID | Path | Assessment |
|---|---|---|
| EX-RAW-001 | `app/db.server.ts` | File-exact. Sole construction point. Confirmed no runtime route/service/worker imports it statically. Acceptable. |
| EX-BOOT-001 | `app/tenant/bootstrap.server.ts` | File-exact. `getMerchantDelegate()` at `bootstrap.server.ts:191` is a hard `throw` stub, not an accessor — this is a genuinely fail-closed boundary and is well done. Acceptable. |
| EX-TDB-001 | `app/tenant/tenant-db.server.ts` | File-exact. The `UNSAFE_CLIENT_KEYS` Proxy at `:23-32,690-702` blocks `$queryRaw*`, `$executeRaw*`, `$parent`, `_engine`, `_runtimeDataModel`. Acceptable as a mechanism; the contract it implements is defective per F-PR2-01/02/05. |
| EX-BF-001 | `scripts/tenant-backfill/` | **Directory-wide.** Narrower per-file exceptions were possible. Maintenance-only and not importable from runtime paths, so low risk, but it should be enumerated per file and given an expiration tied to backfill completion. |
| EX-IDX-001 | index tooling | Maintenance-only. Acceptable. |
| EX-SEED-001 | `prisma/seed.ts` | Dev-only. Acceptable. |
| EX-TEST-001 | test paths | Broad by necessity. Confirm the production build excludes these paths; not verifiable here because `npm run build` was blocked. |

No exception carries an explicit expiration phase. Recommend adding one to EX-BF-001 and EX-IDX-001.

**Coverage gap:** The scanner's model is file-pattern-based. Per F-PR2-04 it does not model dynamic imports or computed member access, so "no missing paths" cannot be asserted from a clean run alone.

---

## 6. Security matrices

Rows marked **(source)** are reasoned from code inspection at the reviewed head and were **not** executed, because PostgreSQL and the Prisma engine were unavailable. They require execution before acceptance.

**Web authority**

| Case | Result |
|---|---|
| Plain object passed as authority | Denied — `assertTenantAuthority` `WeakSet` check, `authority.server.ts:73-83` ✔ |
| `Object.freeze`d look-alike | Denied — brand is identity-based, not structural ✔ |
| Admin authority source | Only `authenticate.admin` via `require-admin-tenant.server.ts` ✔ |
| Webhook authority source | Only after `authenticate.webhook` via `webhook-tenant.server.ts` ✔ |
| Scheduler authority source | Only canonical Shop enumeration, `scheduler.server.ts:26-40` ✔ |
| `issueTenantAuthority` callable outside `app/tenant/` | Statically prevented by audit only; re-exported through `app/tenant/index.ts:8` — enforcement is the scanner, which F-PR2-04 shows is bypassable ⚠ |

**Client hint denial**

| Position | Detected |
|---|---|
| Top-level query param | ✔ (first occurrence only) |
| Duplicate query param | ✘ |
| Named headers (4) | ✔ |
| Top-level JSON | ✔ |
| Nested JSON | ✘ |
| Top-level form | ✔ |
| Nested / multipart form | ✘ |
| Route parameter | ✘ |
| Request ever becomes Shop B | No — authority is never client-derived ✔ |

**Direct rows (source)**

| Case | Behavior |
|---|---|
| Matching canonical `shopId` | Visible ✔ |
| Null `shopId`, matching legacy `shop` | **Invisible — F-PR2-01** ✘ |
| Foreign non-null `shopId`, matching legacy `shop` | Denied ✔ (by conjunction, incidentally correct) |
| Canonical `shopId`, conflicting legacy `shop` | Denied ✔ |
| Foreign global row ID supplied | Denied — `rewriteUniqueRead` never does unscoped-unique-then-check ✔ (good design) |

**Child / parent ownership (source)**

| Case | Behavior |
|---|---|
| Canonical `shopId`, same-tenant parent | Visible ✔ |
| Null `shopId`, same-tenant verified parent | **Invisible — F-PR2-01** ✘ |
| Foreign `shopId` on same-tenant parent | Denied on direct query ✔ / **returned via parent `include` — F-PR2-02** ✘ |
| Canonical `shopId` on foreign parent | Denied on create/upsert via `assertParentIdOwned` ✔ |
| Ambiguous ownership | Denied ✔ |
| Foreign child connected into owned parent | **Not validated — F-PR2-05** ✘ |

**Nested relation reads:** all cases fail — see F-PR2-02.

**Job-envelope tampering (source)**

| Tamper | Detected |
|---|---|
| Unknown schema version | ✔ |
| Missing `shopId` / domain / source / correlation / `issuedAt` | ✔ (structural) |
| Malformed domain | ✔ (normalization) |
| Domain not matching canonical Shop | ✔ (`requireCanonicalShopMatch`) |
| Changed `shopId` to another real shop | **✘ accepted** |
| Changed source to arbitrary string | **✘ accepted** |
| Changed correlation / causation | **✘ accepted** |
| Changed / invalid / non-date `issuedAt` | **✘ accepted** |
| Added or removed fields | **✘ accepted** |
| Removed or invalid signature | **N/A — no signature exists** |
| Raw shop-only payload | ✔ denied (`missing_envelope` / version check) |
| Arbitrary pre-built envelope to a producer | **✘ accepted** |
| Merchant query before validation | None ✔ (correct ordering) |

**Bootstrap restrictions**

| Check | Result |
|---|---|
| Single runtime Prisma construction point | ✔ `app/db.server.ts` |
| Bootstrap exposes root client | ✘ it does not — correct |
| Bootstrap merchant-model access | Hard-denied at `bootstrap.server.ts:191` ✔ |
| Raw Prisma reachable from routes/services/workers by static import | Denied ✔ |
| …by dynamic import | **Reachable — F-PR2-04** ✘ |
| `TenantDb` leaks raw client | ✘ it does not — Proxy blocks `$queryRaw*` etc. ✔ |

---

## 7. Scope and safety

Verified absent from the diff at the reviewed head:

| Prohibited item | Absent |
|---|---|
| RLS / RLS policy | ✔ |
| Runtime or migration database role | ✔ |
| `BYPASSRLS` | ✔ |
| Non-null `shopId` migration | ✔ |
| Composite tenant foreign keys | ✔ |
| Tenant-key trigger | ✔ |
| Other PR 3 work | ✔ |
| PR 4 persistent control-plane tables | ✔ |
| API-version change | ✔ |
| Production configuration or deployment | ✔ |
| Production backfill execution | ✔ |
| Inventory mutation | ✔ |
| Inventory-write flags changed from default OFF | ✔ (unchanged) |
| Secrets, `.env`, merchant or production data committed | ✔ none found |
| Unrelated dependency upgrade | ✔ (`package.json` diff is 6 lines, scripts only) |

No real Shopify inventory mutation was exercised during this review. No production or merchant data was accessed. The database that would have been required was never provisioned.

**Review-environment blockers:** Prisma engine binaries (`binaries.prisma.sh`) are outside the permitted egress list, which cascades into `prisma generate`, `prisma validate`, `migrate deploy`, `typecheck`, `build`, `graphql-codegen`, all index tooling, and the four DB-backed tenant test files. PostgreSQL 16 and Redis were not installed. A correction review must run in an environment with all three.

---

## 8. Required corrections (backlog for the Cursor correction prompt)

**Blocking (P1):**

1. **C-01 — Nullable ownership compatibility.** Replace the conjunctive direct-model scope in `tenant-db.server.ts:38-53` with the approved disjunction, excluding foreign non-null `shopId` and failing closed on `shopId`/`shop` conflict. Add verified-parent-lineage resolution for nullable children. Never guess or repair ownership. Ship the ten-case PostgreSQL fixture matrix covering read, update, and delete.
2. **C-02 — Nested relation scoping.** Recursively inject tenant scope into `include`, `select`, nested relation `where`, and `_count` in `runScopedOperation` and `rewriteUniqueRead`. Fail closed on relation shapes not present in the merchant model map. Test parent-with-foreign-child, parent-with-null-child, nested include, nested select, `_count`, and every relation shape used by current routes and services. Remove the "residual gap" entry at `PR2_TENANT_ACCESS_ARCHITECTURE.md:124`.
3. **C-03 — Envelope integrity.** Add HMAC-SHA256 over a deterministic serialization, a dedicated secret with a minimum-strength check, `crypto.timingSafeEqual` verification before the canonical Shop lookup, a source allowlist, parsed `issuedAt` with future-skew and max-age rejection, secret redaction, and a test-only CI secret. Ship the twelve tampering tests.

**Should be resolved before acceptance (P2):**

4. **C-04 — Scanner completeness.** Detect dynamic `import()` of the construction module and its re-export chain; detect computed and aliased delegate access on values derived from it. Add the six missing negative fixtures (dynamic import, re-export, alias/path, raw shop-only queue payload, wildcard allowlist, stale inventory).
5. **C-05 — Relation connect validation.** Resolve every `connect` / `connectOrCreate.where` / `set` / `disconnect` target through a tenant-scoped lookup before the write.
6. **C-06 — Client hint completeness.** Recursive JSON and form walk, `searchParams.getAll`, route parameters, broadened key set, and the full denial matrix as tests.

**Non-blocking (P3):** C-07 narrow `resolveWebhookTenant` `createIfMissing` and record Shop provenance. C-08 correct the R-039 register wording to separate transport integrity from PR 4 persistence. C-09 note the npm 11.5.2 requirement in contributor docs. C-10 add expiration phases to EX-BF-001 and EX-IDX-001 and enumerate EX-BF-001 per file.

**Also required before acceptance, independent of Cursor:** verify PR #13 live state and exact-head CI run `30674521145` / job `91298898234` from an authenticated GitHub session, and re-run the full §13 command list in an environment with PostgreSQL 16, Redis, and Prisma engine access.

---

## 9. Residual risks

**Acceptable PR 2 residuals:** No database-level enforcement — application-layer scoping is the whole point of this PR and R-022 correctly remains open. Envelope persistence, durable replay ledger, dead-letter handling, and durable idempotency deferred to PR 4. Uninstall and redaction state handling deferred. The `TenantModelDelegate = any` typing at `tenant-db.server.ts:626-628` trades compile-time safety for call-site ergonomics; defensible given runtime enforcement, but it means TypeScript will not catch a malformed relation argument.

**PR 3 enforcement dependencies:** Composite tenant foreign keys, forced RLS, restricted runtime role, transaction-local tenant context, pooled-connection isolation under RLS (R-024's database half).

**PR 4 persistence dependencies:** Envelope persistence and replay ledger, dead-letter, durable idempotency, control-plane tables.

**Unacceptable PR 2 gaps:** F-PR2-01, F-PR2-02, F-PR2-03. Each is a defect in the layer this PR exists to establish. F-PR2-02 in particular must not be carried into PR 3 as an RLS dependency — RLS is defense in depth for an application contract that is supposed to be correct on its own, and if the application contract is allowed to be wrong here it will not be revisited.

**Genuine strengths worth preserving through the corrections:** the `WeakSet` authority brand is a well-chosen non-forgeable mechanism; the refusal to do unscoped-unique-then-check in `rewriteUniqueRead` closes the most common Prisma tenancy hole; the `updateMany`/`deleteMany` rewrite for single-row writes eliminates the id-only write race; the `getMerchantDelegate` throw-stub is a good fail-closed boundary; and the generated inventory is honest and reproducible. The architecture is sound. The three P1s are gaps in it, not evidence against it.

---

## 10. Chain of custody

- **Implementation code modified:** No.
- **Reviewed implementation head:** `6f9ca22c069a46003b6944ff56c888ff91e95cdc`.
- **Review-report commit SHA:** None. **The report was not committed.** This environment has no authenticated GitHub credentials and no push access to `Vedang1998/Stocky`; the repository was obtained by anonymous HTTPS clone. Per §18 of the review prompt, the full report content is returned to the user instead.
- To commit it, place this file at `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_REVIEW_REPORT.md` on `phase-1/tenant-access` at head `6f9ca22c…`, confirm `git diff --name-only` shows only that path, and commit as `Add independent Phase 1 PR 2 review`. The resulting commit is a review artifact and is **not** part of the reviewed implementation.
- Cursor's commits were not amended, rebased, or force-pushed. All temporary probe files created during scanner testing were deleted; the working tree was verified clean at `6f9ca22c…` at the end of the review.
