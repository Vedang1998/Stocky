# Phase 1 PR 2 — Fourth Independent Correction Review

**Reviewer:** Claude Code (independent)
**Implementation owner:** Cursor
**Final technical acceptance authority:** ChatGPT
**Review date:** 2026-08-02

---

## 1. Identity and chain of custody

| Role | SHA | Verified |
|---|---|---|
| Authorized base (`origin/main`) | `04289d61f605414597ac85f47830a3c9d2f9e33d` | ✅ exact |
| Third-cycle runtime/test implementation head | `d7058294af7eb3d8f287f48cd0657a74475892e7` | ✅ |
| Third-cycle reviewed handoff head | `fec8500095197798be183d08b3dd004632adba80` | ✅ |
| Third independent review report-only commit / fourth-cycle start | `000e53cdae6cd39b690fc8107d7d3f4f4791adf1` | ✅ exact merge base |
| Fourth-cycle runtime/test implementation head | `21aba6660e71fa5af558d81499190ee8eb0e645e` | ✅ |
| **Exact reviewed fourth-cycle final handoff head** | **`93e8044aea3958e8efe36f774e7d99ae6a0dd687`** | ✅ exact |

Checkout performed with `git checkout --detach 93e8044aea3958e8efe36f774e7d99ae6a0dd687`;
`git rev-parse HEAD` = `93e8044aea3958e8efe36f774e7d99ae6a0dd687`; `git status --porcelain` empty.

### Range and commit classification

`git rev-list --count 000e53c..93e8044` = **8** (expected 8).
`git merge-base 000e53c 93e8044` = `000e53cdae6cd39b690fc8107d7d3f4f4791adf1` (exact).

| SHA | Subject | Class |
|---|---|---|
| `32619da` | Record PR 2 fourth correction backlog | documentation |
| `696ed47` | Bound excessive legacy compatibility evidence | runtime |
| `3248525` | Expand legacy normalization and overflow operation tests | tests |
| `21aba66` | Align allowlist and regression expectations for fourth cycle | runtime/test (**final runtime head**) |
| `bd2fc24` | Record PR 2 fourth-cycle implementation evidence | documentation |
| `867460f` | Record exact-head CI evidence for fourth correction tip | documentation |
| `ba5eee1` | Pin fourth-cycle handoff tip SHA after CI evidence | documentation |
| `93e8044` | Refresh status for fourth-cycle handoff tip | documentation |

`git diff --stat 21aba66..93e8044` touches only `docs/PROJECT_STATUS.md`,
`docs/phases/phase-1/README.md`, `PR2_TENANT_ACCESS_FOURTH_CORRECTION_IMPLEMENTATION_REPORT.md`
and `PR2_TENANT_ACCESS_SECOND_FOLLOWUP_CORRECTION_IMPLEMENTATION_REPORT.md`.
**Confirmed: commits after `21aba666…` are documentation/evidence only.**

No history rewrite. No unrelated phase work. All four preserved independent review reports
(`PR2_TENANT_ACCESS_REVIEW_REPORT.md`, `…_CORRECTION_REVIEW_REPORT.md`,
`…_FOLLOWUP_CORRECTION_REVIEW_REPORT.md`, `…_THIRD_CORRECTION_REVIEW_REPORT.md`)
produce an **empty diff** across the range — byte-for-byte unchanged.

---

## 2. Executive verdict

> ## `NOT READY — FURTHER CORRECTIONS REQUIRED`

| Severity | Count |
|---|---:|
| **P0** | **0** |
| **P1** | **1** |
| **P2** | **0** |
| **P3** | **4** |

**No cross-tenant read or write was reproduced.** Tenant isolation is materially correct and
every prior security regression remains closed. The three P2 findings from the third cycle are
substantively addressed. Acceptance is withheld for one newly evidenced **P1 data-integrity
defect** on a live authenticated code path, plus a recurrence of the head-identity evidence
defect that `§6` designates as independently blocking.

---

## 3. Finding dispositions — F-PR2R3-01 … F-PR2R3-07

| Finding | Sev | Disposition | Basis |
|---|---|---|---|
| **F-PR2R3-01** Legacy evidence overflow | P2 | **Closed (with residuals)** | `phase1-legacy-evidence-v1`, default 1024 / abs max 4096; `LIMIT limit+1` discovery; fail-closed `legacy_evidence_overflow`; no `in` list built on overflow; no owned-ID materialization; no raw-value disclosure; verified at 0/1/1023/1024/1025/32 000/32 765/40 000. Residuals → F-PR2R4-04, F-PR2R4-05 |
| **F-PR2R3-02** Tenant-bearing selector intent | P2 | **Closed** | `assertSelectorTenantIntent` runs before flatten/coerce/legacy discovery on `findUnique`, `findUniqueOrThrow`, `update`, `delete`, `upsert`; identical-own-key attack denied with `foreign_selector_tenant`; both rows byte-identical; no upsert create branch |
| **F-PR2R3-03** SQL/JS normalization equivalence | P2 | **Partially closed** | Single `PHASE1_SHOP_DOMAIN_SPEC`; SQL `btrim` uses the exact ECMAScript trim code-point set; JS remains final authority (safe). But the asserted general SQL↔JS decision equivalence is **locale-conditional and false under a UTF-8 ctype database** → F-PR2R4-03 |
| **F-PR2R3-04** Honest operation-family coverage | P3 | **Closed** | Six distinct focused CI steps, each an explicit test file, no `-t` filters; bulk and relation suites are genuine mixed canonical/null/foreign matrices, not single broad assertions. Minor residual: no nested-`select` relation case |
| **F-PR2R3-05** Third-cycle commit count | P3 | **Closed** | `PROJECT_STATUS.md:28`, phase README and implementation report all state **11** |
| **F-PR2R3-06** Head identity accuracy | P3 | **OPEN — recurrence** | `93e8044…` appears in **no** repository document; `ba5eee1…` is affirmatively recorded as the "fourth-cycle final handoff head" → F-PR2R4-02 |
| **F-PR2R3-07** Redis history residual | P3 | **Closed — accepted residual** | Blob `cae7715f…` re-verified: 843 bytes, synthetic BullMQ fixture, no credentials/PII/merchant data; `*.rdb` and `dump.rdb` ignored (`.gitignore:1-2`); no new `.rdb` in the range |

---

## 4. New findings

### F-PR2R4-01 — Whitespace/case-variant null-owned rows are unreachable through their unique selector, and `upsert` silently creates a duplicate

* **Severity:** **P1** (data-integrity; incorrect operational settings on a live authenticated path)
* **File / line:** `stocky-plus/app/tenant/selectors.ts:397-405` (`canonicalizeOwnShopInPredicate`),
  `stocky-plus/app/tenant/tenant-db.server.ts:1262-1288` (`coerceDirectShopInWhere`);
  reachable live at `stocky-plus/app/tenant/after-auth.server.ts:33-42`
* **Requirement affected:** D-030 null-`shopId` compatibility branch; AGENTS.md product principle 5
  (every write auditable and reconcilable); F-PR2R3-03/-04 operation-family consistency
* **Pre-existing:** Yes — the same coercion exists at `000e53c` (`selectors.ts:348-352`).
  This is **not a regression introduced by the fourth cycle**; it is a latent defect that the
  cycle's own normalization-consistency scope should have surfaced and did not.

**Reproduction** (verified locally, PostgreSQL 16.13, exact reviewed head):

```
1. Seed the R-074 population:
   ShopSettings { shop: "\tphase1-pr2-shop-a.myshopify.com", shopId: NULL,
                  defaultSafetyStock: 42 }
2. Issue authority for shop A and run the exact after-auth.server.ts call shape:
   db.shopSettings.upsert({ where: { shop: tenant.myshopifyDomain },
                            create: { shop: ..., shopId: ... }, update: {} })
```

**Actual behavior** (probe output, verbatim):

```json
{"probe":"after_auth_shopsettings","rowCount":2,"duplicated":true,
 "rows":[{"shopRaw":"\"\\tphase1-pr2-shop-a.myshopify.com\"","shopId":null,
          "defaultSafetyStock":42,"isLegacy":true},
         {"shopRaw":"\"phase1-pr2-shop-a.myshopify.com\"","shopId":"SET",
          "defaultSafetyStock":0,"isLegacy":false}]}
{"probe":"after_auth_visibility","visibleToTenant":2,"leadTimes":[42,0]}
```

Generalised across the compound-selector models (`ShopifyVariantCache`):

```json
{"probe":"legacy_ws_reachability",
 "outcomes":{"findMany_scope":"OK","findUnique_by_id":"OK",
             "findUnique_by_compound":"null","update_by_compound":"not_found",
             "upsert_by_compound":"OK"},
 "countBefore":1,"countAfter":2,"duplicateCreated":true}
```

The row is correctly owned by the tenant scope (`findMany`, `count`, `findUnique` by `id` all
return it), but the tenant-bearing compound/scalar `shop` selector rewrites `shop` to the
canonical domain while the stored raw value is `"\tdomain"`. The equality predicate can never
match, so:

* `findUnique` returns **`null` with no error** (indistinguishable from "does not exist");
* `update` / `delete` throw **`not_found`** on a row the merchant owns;
* `upsert` takes the **create** branch. The database unique index is on the raw `shop` value,
  so `"\tdomain"` and `"domain"` do not collide and a **duplicate row is committed silently**.

**Expected behavior:** a null-owned row whose raw `shop` normalizes to the authenticated domain
must be reachable through its documented unique selector. The selector predicate must match the
set of accepted raw legacy representations (the same `in` set the tenant scope already computes),
not a single canonical literal. `upsert` must resolve to the existing owned row and take the
update branch; if it cannot prove uniqueness it must fail closed rather than create.

**Merchant impact:** On every verified authentication, a merchant carrying a whitespace- or
case-variant legacy `ShopSettings` row gets a second, empty settings row. Configured
`defaultLookbackDays`, `targetDaysOfStock`, `defaultSafetyStock`, `abcMetric` and
`subscriptionPlan` are silently superseded by defaults, and `ShopSettings` — treated as a
singleton — becomes ambiguous. The same mechanism duplicates `ShopifyVariantCache`,
`InventorySnapshot`, `SalesDailyAggregate`, `VariantAbcClass`, `BomComponent` and
`ForecastOverride` rows on their business keys, which feed forecast, ABC/U and cost arithmetic.
This is precisely the population D-030 and R-074 exist to serve.

**Required correction:** resolve tenant-bearing `shop` selectors against the accepted raw legacy
representation set (reuse `resolveMatchingRawLegacyShops`) instead of coercing to a single
canonical literal; make `upsert` fail closed rather than create when a legacy-variant owned row
exists for the same business key. Deleting the coercion alone is not sufficient — the predicate
must become set-valued.

**Required regression test:** for every model with a `shop`-bearing unique selector, seed a
null-`shopId` row with a tab/NBSP/uppercase raw `shop`, then assert `findUnique`, `update`,
`delete` and `upsert` by that unique key all resolve to the existing row, and that row counts are
unchanged after `upsert`. Add the `after-auth.server.ts` call shape explicitly.

**Blocks acceptance:** **Yes.**

---

### F-PR2R4-02 — Permanent in-repo evidence misrepresents the reviewed head (recurrence of F-PR2R3-06)

* **Severity:** P3 (documentary) — **blocking under §6** ("permanent evidence misrepresents the reviewed head")
* **File / line:** `docs/phases/phase-1/PR2_TENANT_ACCESS_FOURTH_CORRECTION_IMPLEMENTATION_REPORT.md:18`,
  `:20`, `:158`, `:166`; `docs/phases/phase-1/README.md:30`
* **Actual:** `grep -rl "93e8044" docs/` returns **nothing** — the reviewed head appears in no
  repository document. Both the permanent implementation report and the phase README record
  `ba5eee16f4121ffb128133102e55fbd35397665c` as the "**fourth-cycle final handoff head**", with
  exact-head CI `run 30762725271` / `job 91536046005`. That tip was superseded by two further
  commits; the true final head is `93e8044…` with CI `run 30763065246` / `job 91536946610`.
  Only the PR body — mutable and outside the repository — is correct.
* **Expected:** the permanent record must identify `93e8044…` as the fourth-cycle final handoff
  head with its own CI identity, and demote `ba5eee1…` to an intermediate green tip, exactly as
  `bab5fe90…` was demoted for the third cycle.
* **Merchant impact:** none directly; it defeats reviewer and auditor chain-of-custody, which is
  the same failure F-PR2R3-06 was raised to correct.
* **Required correction:** add a final documentation commit recording `93e8044…` and run
  `30763065246` / job `91536946610`, and relabel `ba5eee1…`. (Structural note: the head commit
  cannot name its own SHA; the established pattern is that the *reviewer's* report-only commit
  pins it — this report does so at §1 — but the implementation report must not simultaneously
  assert a different SHA as final.)
* **Required regression test:** none (documentary). A checklist item on head-identity refresh
  after any post-CI commit.
* **Blocks acceptance:** **Yes**, under §6.

---

### F-PR2R4-03 — SQL candidate discovery diverges from the JavaScript normalizer under any UTF-8 ctype database

* **Severity:** P3 (robustness / evidence accuracy; **not** an isolation defect)
* **File / line:** `stocky-plus/app/tenant/legacy-scope.ts:279-289` (SQL predicate),
  `stocky-plus/app/tenant/shop-domain.ts:296-301` (`non_ascii_confusable` corpus entry)
* **Actual:** the corpus asserts a general `JS decision == PostgreSQL candidate decision`
  equivalence. PostgreSQL `lower()` is ctype-dependent. Verified locally:

  | Database ctype | `lower(btrim('booKsite.myshopify.com', spec))='booksite.myshopify.com'` | JS `normalizeShopDomain` | Divergent |
  |---|---|---|---|
  | `C` | `false` | rejected (`non_ascii`) | no |
  | **`C.utf8`** | **`true`** | rejected (`non_ascii`) | **yes** |
  | `ICU en-US` | `true` | rejected (`non_ascii`) | yes |

  (`K` = U+212A KELVIN SIGN, which folds to ASCII `k`.) The corpus passes only because its chosen
  confusable is Cyrillic `е`, which never case-folds to ASCII in any locale. The equivalence
  claim is therefore locale-conditional, and CI's PostgreSQL container encodes the weaker case.
* **Security:** **holds.** The JavaScript normalizer is applied as final authority to every row
  returned by SQL (`legacy-scope.ts:299-304`), so a divergent candidate is excluded from the `in`
  list and cannot authorize a foreign row. No cross-tenant exposure.
* **Secondary consequence:** the overflow check `rows.length > limit` runs **before** the JS
  filter, so rows SQL discovers and JS rejects consume the `phase1-legacy-evidence-v1` budget.
  Enough non-ASCII confusable null-owned rows would deny a tenant that has no genuinely
  ambiguous evidence at all.
* **Expected:** either state the equivalence as "SQL is a deliberate superset; JS is final
  authority" (and test that superset property), or constrain the SQL predicate to ASCII
  (`shop ~ '^[\x09-\x0d\x20\xa0...]*[\x21-\x7e]+...$'`-style) so the claim holds in every locale.
  Apply the limit to the JS-accepted count, not the raw candidate count.
* **Required regression test:** run the corpus against a database created with
  `LOCALE 'C.utf8'` (and/or ICU) and include a case-folding confusable (U+212A) for a canonical
  domain containing `k`.
* **Blocks acceptance:** No (evidence accuracy; isolation unaffected).

---

### F-PR2R4-04 — Legacy-evidence limit configuration is non-strict, immutable after import, and untested

* **Severity:** P3
* **File / line:** `stocky-plus/app/tenant/legacy-scope.ts:64-78`
* **Actual:** `Number.parseInt(raw, 10)` is not strict integer parsing. Verified:

  | `TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS` | effective limit |
  |---|---:|
  | `"1024"` | 1024 |
  | `"0"`, `"-5"`, `"abc"`, `"0x10"`, `""` | 1024 (default) |
  | `"99999"` | 4096 (clamped) |
  | **`"10abc"`** | **10** |
  | **`"1e9"`** | **1** |
  | **`"2048.9"`** | **2048** |

  `MAX_DISTINCT_LEGACY_SHOP_FORMS_PER_MODEL_TENANT` is a module-level constant evaluated at
  import, with no reset/reload helper (`hasResetHelper: false`), so §12's "different values
  between process startup and operation" and "test cache/reset behavior" cases are untestable by
  construction. `legacy-evidence-overflow.test.ts` contains **no** configuration case.
* **Safety:** the parser is fail-safe in the dangerous direction — no input can exceed 4096 or go
  below 1, so the PostgreSQL bind ceiling is never approached. The hazard is availability only: a
  typo such as `1e9` silently yields a limit of **1**, denying nearly every merchant with any
  null-owned legacy rows.
* **Required correction:** strict integer validation (`/^\d+$/`); reject out-of-range values
  explicitly at startup rather than silently substituting; expose a test-only reset.
* **Required regression test:** the §12 configuration matrix — invalid, negative, zero,
  non-integer, above maximum, exactly maximum — asserting the resolved limit and startup outcome.
* **Blocks acceptance:** No.

---

### F-PR2R4-05 — Overflow blast radius is wider than the implementation report states

* **Severity:** P3
* **File / line:** `stocky-plus/app/tenant/selectors.ts:430-441` (single-`id` fast path);
  `stocky-plus/app/tenant/tenant-db.server.ts:1425` (`tenantScopeWhere` on the update path)
* **Actual:** measured survival with `LIMIT + 50` distinct null-owned forms present:

  | Operation | Outcome |
  |---|---|
  | `findUnique({ where: { id } })` | **OK** |
  | `create` | **OK** |
  | `findUnique({ where: { shopId_id: { shopId: <own>, id } } })` | `legacy_evidence_overflow` |
  | `update({ where: { id } })` | `legacy_evidence_overflow` |
  | `findMany`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany` | `legacy_evidence_overflow` |

  The fast path triggers only when the flattened predicate is exactly `{ id: <string> }`. A fully
  canonical, tenant-matching `shopId_id` compound selector — the most tenant-safe selector
  available — still forces full null-evidence collection and is denied. `update` resolves the row
  through the fast path and then calls `tenantScopeWhere` unconditionally, so a merchant in an
  overflow incident can read a row by id but cannot write it. The implementation report's
  "create / foreign selector / canonical-ID paths avoid unnecessary collection" overstates this.
* **Expected:** treat any predicate whose tenant-bearing components fully pin the current
  `shopId` (including `shopId_id`) as canonical, and skip null-evidence collection for both the
  resolution and the re-check on that path; or state the limitation precisely.
* **Required regression test:** assert, under overflow, the exact per-operation survival table
  above as the documented contract.
* **Blocks acceptance:** No.

---

## 5. Prior security regression matrix (re-run at the exact reviewed head)

All executed against disposable PostgreSQL 16.13 / Redis 7.0.15 at `93e8044…`.

| # | Attack | Result |
|---|---|---|
| 1 | Foreign SKU mapping cannot be moved | ✅ denied |
| 2 | Foreign supplier connected via `shopId_id` | ✅ denied (`foreign_selector_tenant`) |
| 3 | Foreign transfer line injected | ✅ denied |
| 4 | Foreign stocktake line injected | ✅ denied |
| 5 | Foreign child deleted/disconnected via alternate selectors | ✅ denied |
| 6 | Foreign `connectOrCreate` target | ✅ denied |
| 7 | Mixed nested arrays roll back fully | ✅ atomic |
| 8 | Signed envelope tampering | ✅ denied (25/25 `job-envelope`) |
| 9 | Client hints establish authority | ✅ never (11/11 + 7/7 byte-limit) |
| 10 | Dynamic / computed / aliased / re-exported raw Prisma paths | ✅ detected (24/24 architecture audit) |
| 11 | Authority-issuer aliases | ✅ detected (7/7 scanner) |
| 12 | Ownership-change race probes | ✅ zero foreign mutations (`write-atomicity`) |
| 13 | Top-level compound selector operations functional | ✅ 7/7 |
| 14 | Mixed relation isolation functional | ✅ 10/10 + 5/5 |
| 15 | `LeadTimeSnapshot` partial selections functional | ✅ 3/3 + 6/6 |
| 16 | Every inventory-write flag default OFF | ✅ `feature-flags.server.ts:9` `defaultEnabled = false` for all five |

**No security regression. No cross-tenant read or write reproduced.**

---

## 6. Overflow matrix (F-PR2R3-01)

Model `Supplier`, tenant A, distinct raw null-owned forms seeded via base-6 ECMAScript-whitespace
prefixes.

| Distinct forms | `findMany` / `count` / `aggregate` / `groupBy` | `updateMany` / `deleteMany` | Relation `include` / `_count` | Mutation occurred |
|---:|---|---|---|---|
| 0 | ✅ correct | ✅ | ✅ | no |
| 1 | ✅ correct | ✅ | ✅ | no |
| 1023 (`limit-1`) | ✅ correct | ✅ | ✅ | no |
| 1024 (`limit`) | ✅ correct | ✅ | ✅ | no |
| 1025 (`limit+1`) | `legacy_evidence_overflow` | `legacy_evidence_overflow` | `legacy_evidence_overflow` | **no** |
| 32 000 | `legacy_evidence_overflow` | `legacy_evidence_overflow` | `legacy_evidence_overflow` | **no** |
| 32 765 | `legacy_evidence_overflow` | `legacy_evidence_overflow` | `legacy_evidence_overflow` | **no** |
| 40 000 | `legacy_evidence_overflow` | `legacy_evidence_overflow` | `legacy_evidence_overflow` | **no** |

* No PostgreSQL bind-limit error at any size — discovery is `LIMIT limit+1`, and no Prisma `in`
  predicate is constructed once overflow is detected (`legacy-scope.ts:291-298`).
* **No canonical-only partial result is ever returned** — reads fail closed rather than silently
  omitting null-owned rows.
* Canonical rows verified byte-identical before and after every denied operation.
* Diagnostics contain only `version`, `model`, `shopId`, `limit`, `observedCount`,
  `correlationId`. No raw legacy value appears; asserted negatively in-test.
* `create` is unaffected by overflow (no legacy discovery) — confirmed.
* Foreign canonical selectors are rejected **before** legacy discovery — confirmed
  (`foreign_selector_tenant` raised while 1025 forms are present).
* **Canonical non-null rows in a database containing excessive null-row forms:** measured survival
  table in F-PR2R4-05. `findUnique({id})` and `create` proceed; everything else denies.
* **Concurrency:** 12 simultaneous operations under overflow → 12/12 `legacy_evidence_overflow`,
  zero fulfilled, zero rows mutated. Deterministic.
* **Configuration cases:** see F-PR2R4-04 — untested in-repo; verified by me out-of-band.
* **Operational boundary assessment:** 1024 distinct raw forms per model per tenant is a
  reasonable boundary. It is not reachable by trivial duplicate data — 1024 *distinct* whitespace/
  case permutations of one domain are required, which indicates genuine corruption. The residual
  is documented below.

---

## 7. Selector-intent matrix (F-PR2R3-02)

| Case | `findUnique` | `findUniqueOrThrow` | `update` | `delete` | `upsert` |
|---|---|---|---|---|---|
| Matching tenant selector | ✅ resolves own row | ✅ | ✅ | ✅ | ✅ update branch |
| Foreign tenant, no own equivalent | `foreign_selector_tenant` | `foreign_selector_tenant` | `foreign_selector_tenant` | `foreign_selector_tenant` | `foreign_selector_tenant` |
| **Foreign tenant, identically keyed own row exists** | **denied** | **denied** | **denied** | **denied** | **denied, no create branch** |
| Malformed tenant component (`"not-a-shop"`) | `unsupported_relation_selector` | ✅ | ✅ | ✅ | ✅ |
| Empty tenant component (`""`) | `unsupported_relation_selector` | ✅ | ✅ | ✅ | ✅ |
| Uppercase/whitespace matching legacy domain | ✅ resolves own row | ✅ | ✅ | ✅ | ✅ |
| Foreign normalized legacy domain (` SHOP-B ` upper) | `foreign_selector_tenant` | ✅ | ✅ | ✅ | ✅ |
| Extra selector field | `unsupported_relation_selector` | ✅ | ✅ | ✅ | ✅ |
| Missing compound field | `unsupported_relation_selector` | ✅ | ✅ | ✅ | ✅ |

Models covered by the shop-bearing compound matrix: `ShopifyVariantCache`, `ForecastOverride`,
`VariantAbcClass`, `SalesDailyAggregate`, `BomComponent`, `InventorySnapshot`, `ShopSettings`,
plus `shopId_id` on `Supplier`.

**Key adversarial case — verified.** Caller explicitly selects Shop B; Shop A holds the same
business key. Operation is denied; Shop A is **not** silently selected; Shop B is **not** touched;
no upsert create branch runs. Both rows byte-identical afterwards (independently re-snapshotted).

`assertSelectorTenantIntent` is invoked before flattening and before `tenantScopeWhere` in
`resolveOwnedUniqueRow` (`selectors.ts:424`) and again ahead of `coerceDirectShopInWhere` on the
upsert path (`tenant-db.server.ts:1497`, `:1271`). No supplied foreign tenant value is
overwritten — coercion now runs only after validation has proven own-tenancy.

**Independently verified:** upsert with a foreign `shop` while an identically keyed own row
exists → `TenantAccessError`, row count unchanged, own row `sku` unchanged.

**Residual:** own-tenancy *variants* are canonicalized to a single literal, which is the root of
F-PR2R4-01.

---

## 8. Normalization corpus — JavaScript vs PostgreSQL decisions

Executed at the reviewed head; JS via `normalizeShopDomain`, SQL via
`lower(btrim($1, shopDomainTrimCharacters()))= <canonical>`.

| Corpus id | JS accepts as canonical | SQL discovers | Agree |
|---|---|---|---|
| `space`, `tab`, `line_feed`, `carriage_return`, `vertical_tab`, `form_feed` | ✅ | ✅ | ✅ |
| `nbsp` (U+00A0), `bom` (U+FEFF) | ✅ | ✅ | ✅ |
| `mixed_leading_trailing` | ✅ | ✅ | ✅ |
| `uppercase_domain`, `canonical_domain` | ✅ | ✅ | ✅ |
| `url_shaped`, `path_shaped` | ❌ | ❌ | ✅ |
| `foreign_domain` | ❌ | ❌ | ✅ |
| `non_ascii_confusable` (Cyrillic `е`) | ❌ | ❌ | ✅ |
| `overlong_label` (64), `overlong_hostname` (240+) | ❌ | ❌ | ✅ |
| `embedded_whitespace`, `internal_newline` | ❌ | ❌ | ✅ |
| `empty_string`, `whitespace_only` | ❌ | ❌ | ✅ |
| **U+212A KELVIN SIGN confusable (added by reviewer)** | **❌ `non_ascii`** | **✅ under `C.utf8` / ICU** | **❌ divergent** |

All 26 `ECMA_SCRIPT_TRIM_CODE_POINTS` verified against Node 22.22.2 `String.prototype.trim()`
(each folds to the empty string). The set is complete for ES2024 WhiteSpace + LineTerminator.
Space-only `btrim` proven insufficient in-test.

Accepted values normalize exactly to the authenticated canonical domain.
Tab/newline-padded null-owned rows explicitly tested and visible across read, bulk-mutation and
relation families.

**SQL is a superset, not an equal**, under a UTF-8 ctype database. Every returned value is
subsequently subjected to JavaScript final validation before authorization
(`legacy-scope.ts:299-304`), so the superset is safe — but the documented claim is stated as
equality. See F-PR2R4-03.

---

## 9. CI verification (supporting evidence only)

Independently retrieved via the GitHub API at review time.

| Field | Value | Verified |
|---|---|---|
| Workflow | CI | ✅ |
| Run ID | `30763065246` | ✅ |
| Job ID | `91536946610` | ✅ |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL | ✅ |
| `head_branch` | `phase-1/tenant-access` | ✅ |
| `head_sha` | `93e8044aea3958e8efe36f774e7d99ae6a0dd687` | ✅ **exact** |
| Conclusion | `success` | ✅ |
| Attempt | 1 | ✅ |
| Steps | 54 material steps, **all `success`**, none skipped | ✅ |

Focused gates, each an explicit distinct test file with **no `-t` filter** (`ci.yml:150-172`):

| Step # | Step | File | Tests (locally re-run) |
|---:|---|---|---:|
| 26 | Tenant legacy normalization read consistency | `normalization-consistency` + `legacy-normalization` | 2 + 3 |
| 27 | Tenant legacy SQL/JS normalization equivalence | `legacy-normalization-equivalence.test.ts` | **4** |
| 28 | Tenant legacy bulk-mutation consistency | `legacy-normalization-bulk-mutations.test.ts` | **2** |
| 29 | Tenant legacy relation consistency | `legacy-normalization-relations.test.ts` | **2** |
| 30 | Tenant legacy-evidence overflow | `legacy-evidence-overflow.test.ts` | **12** |
| 31 | Tenant-bearing unique-selector | `tenant-bearing-unique-selectors.test.ts` | **6** |
| 46 | Tenant access tests (full) | `npm run test:tenant-access` | **224** |
| 48-53 | Lint / Typecheck / Unit / Migrations / Subject-memory / Build | — | 56 / 106 / 2 |
| 54 | GraphQL codegen | — | pass |

All five new focused files were also executed **individually** by me and each genuinely executed
tests — no file matched zero tests. Reported counts are accurate. The focused CI does **not**
materially overstate coverage; naming now matches content (F-PR2R3-04 closed).

Every file listed in the CI gates is registered in `scripts/tenant-access/allowlist.ts:105-109`.

---

## 10. Local execution evidence

| Item | Value |
|---|---|
| PostgreSQL | **16.13** (Ubuntu 16.13-0ubuntu0.24.04.1), disposable cluster `127.0.0.1:55432`, `datcollate=C` |
| Additional probe databases | `probe_utf8` (`LOCALE 'C.utf8'`), `icu_probe` (ICU `en-US`) — for locale sensitivity only |
| Redis | **7.0.15**, isolated `127.0.0.1:56379` |
| Redis `DBSIZE` before | **0** |
| Redis `DBSIZE` after cleanup | **0** (7 keys observed mid-run; `FLUSHALL` executed) |
| Node | **v22.22.2** |
| npm | **11.5.2** (pinned via `npm i -g npm@11.5.2`) |
| Envelope secret | test-only, ≥32 bytes |
| Production / merchant data | **none used** |
| Reviewed head during all runs | `93e8044aea3958e8efe36f774e7d99ae6a0dd687` |

| Command | Exit | Observed |
|---|---:|---|
| `node --version` / `npm --version` | 0 | v22.22.2 / 11.5.2 |
| `npm ci` | 0 | clean install |
| `npx prisma generate` | 0 | client generated |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma migrate deploy` | 0 | all migrations applied |
| `npm run tenant:indexes:apply -- --apply` | 0 | 28 created, 0 failed |
| `npm run tenant:indexes:verify` | 0 | `ok:true`, `mismatches:[]` |
| `npm run tenant:schema:drift` | 0 | `tenant_prisma_schema_drift_ok` |
| `npm run tenant:indexes:plan` | 0 | `valid_exact: 28` |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok`, 18 models covered |
| `npm run tenant:access:inventory` | 0 | 931 findings, **0 violations** |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| `npm run test:tenant-access` | 0 | **28 files / 224 tests passed** |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm test` | 0 | **6 files / 56 tests passed** |
| `npm run test:migrations` | 0 | **24 files / 106 tests passed** ¹ |
| `npm run test:subject-memory` | 0 | **2 tests passed** ¹ |
| `npm run build` | 0 | built |
| `npm run graphql-codegen` | **1** | **BLOCKED — environment** ² |
| `git diff --check` | 0 | clean |
| Focused: overflow / selectors / equivalence / bulk / relations | 0 | 12 / 6 / 4 / 2 / 2 |
| Inventory regenerated → `git status --porcelain` | — | **empty (clean tree)** |

¹ These suites initially failed with `ERROR: role "stocky" does not exist`.
`scripts/tenant-backfill/tests/helpers.ts:47`, `scripts/tenant-indexes/tests/indexes.migration.test.ts:51`
and `scripts/tenant-indexes/tests/schema-drift.migration.test.ts:43` hardcode
`GRANT ALL ON SCHEMA public TO stocky` (the CI role), whereas
`app/tenant/__tests__/helpers.ts:33` correctly uses `CURRENT_USER`. After creating a `stocky`
role both suites pass fully. This is a **test-harness portability issue, not an implementation
defect**, and is not raised as a finding; it is noted for future reviewers.

² `graphql-codegen` requires `shopify.dev` schema introspection, blocked by this environment's
network egress allowlist ("Host not in allowlist: shopify.dev"). This step is **unverified
locally**; CI step 54 executed it successfully at the exact reviewed head. This is the only
required command I could not run.

**Implementation code was not modified.** Three temporary probe files were created under
`app/tenant/__tests__/`, executed against isolated probe databases, and deleted;
`git status --porcelain` is empty and `git rev-parse HEAD` remains
`93e8044aea3958e8efe36f774e7d99ae6a0dd687`.

---

## 11. Live PR verification

| Field | Expected | Actual | ✔ |
|---|---|---|---|
| PR | #13 | #13 | ✅ |
| State | open | `open` | ✅ |
| Draft | yes | `true` | ✅ |
| Merged | no | `false` | ✅ |
| Mergeable | yes | `mergeable_state: clean` | ✅ |
| Base branch | `main` | `main` | ✅ |
| Base SHA | `04289d61…` | `04289d61f605414597ac85f47830a3c9d2f9e33d` | ✅ |
| Head branch | `phase-1/tenant-access` | `phase-1/tenant-access` | ✅ |
| Head SHA | `93e8044…` | `93e8044aea3958e8efe36f774e7d99ae6a0dd687` | ✅ |
| Commits | — | 49 | ✅ |
| Changed files | — | 129 (+20 272 / −651) | ✅ |

PR body is current and correctly states the reviewed head, the exact-head CI identity, the
third-cycle count of 11, and the `bab5fe90…` demotion. **The PR body is accurate; the in-repo
permanent record is not** (F-PR2R4-02).

---

## 12. Documentation review

| Requirement | Result |
|---|---|
| D-031 is an implementation authorization record, not acceptance | ✅ `DECISIONS.md` §9: "AUTHORIZED FOR PR 2 FOURTH CORRECTION IMPLEMENTATION — PENDING FOURTH INDEPENDENT CORRECTION REVIEW AND CHATGPT ACCEPTANCE"; "PR 2 remains **unaccepted**" |
| Third-cycle range stated as 11 commits | ✅ `PROJECT_STATUS.md:28`, README, implementation report |
| `d7058294…` = third-cycle runtime/test head | ✅ `PROJECT_STATUS.md:15` |
| `fec8500…` = third-cycle reviewed handoff head | ✅ `PROJECT_STATUS.md:16` |
| `000e53c…` = third review report-only commit | ✅ `PROJECT_STATUS.md:17` |
| `21aba666…` = fourth-cycle runtime/test head | ✅ `PROJECT_STATUS.md:18` |
| **`93e8044…` = fourth-cycle final handoff head** | ❌ **absent from every repository document** — F-PR2R4-02 |
| `bab5fe90…` described only as intermediate green tip | ✅ `PROJECT_STATUS.md:26` |
| PR body current | ✅ |
| Exact-head CI identity correct | ✅ in PR body; ❌ in repo (records superseded run `30762725271`) — F-PR2R4-02 |
| Q-011 remains open | ✅ `DECISIONS.md:128` |
| F-016 / R-022 remain open | ✅ `RISK_REGISTER.md:26` "Mandatory Phase 1 P1 gate — do not downgrade. Implementation not started." |
| PR 3 remains not started | ✅ phase README:36, :50 |
| R-072 / R-073 / R-074 pending independent verification | ✅ `RISK_REGISTER.md:75-77` "Correction implemented — pending independent verification" |
| No document claims this fourth review has passed | ✅ (all `READY FOR CHATGPT …` hits are PR 1 / planning artifacts) |

### Redis history disposition (§13)

Re-verified without repeating the full forensic exercise. Blob `cae7715f893091a413923b54488f74c59a71e058`
is **843 bytes**, `REDIS0010`, `redis-ver 7.0.15`, containing only BullMQ `stocky-cron` fixture
keys and a synthetic `phase1-job-envelope-v1` payload. No credentials, secrets, sessions, PII,
merchant data, or production identifiers; no HMAC secret derivable. `.gitignore:1-2` ignores
`*.rdb` and `dump.rdb`. **No `.rdb` file exists anywhere in the tree, and none was added in the
fourth-cycle range.** No rotation or history rewrite required. Records are accurate.

---

## 13. Scope and safety

Confirmed absent from `000e53c..93e8044`:

production/merchant data · real secrets · `.env` · deployment · production backfill · ownership
repair · Prisma schema change · migration · RLS or policy · runtime/migration DB role ·
`BYPASSRLS` · non-null `shopId` · composite tenant foreign key · trigger · PR 3 implementation ·
PR 4 persistence · inventory mutation · write-flag enablement · dependency change
(`package.json` / `package-lock.json` untouched) · unrelated feature.

The only `BYPASSRLS` / `RLS` string matches in the range are documentation lines asserting their
absence. All five inventory-write flags default OFF (`feature-flags.server.ts:9`,
`defaultEnabled = false`).

---

## 14. Residual risks

**Acceptable PR 2 residuals**

* Application-layer tenancy only; no database-enforced isolation until PR 3 (F-016 / R-022 / Q-011).
* `phase1-legacy-evidence-v1` is an application bound. A tenant with >1024 distinct raw legacy
  `shop` forms for one model is **blocked on that model** until ownership data is repaired through
  a separately authorized backfill. This is the correct fail-closed trade against a PostgreSQL
  bind-limit failure, but it is a real availability boundary and needs a documented merchant
  support path.
* Synthetic Redis `dump.rdb` blob remains reachable in history (F-PR2R3-07, accepted).
* SQL candidate discovery is a superset of the JS normalizer under UTF-8 ctype (F-PR2R4-03);
  safe because JS is final authority.

**PR 3 enforcement dependencies** — forced RLS, restricted non-owner runtime role, separate
migration role, default denial without tenant context, composite tenant foreign keys, non-null
`shopId`, and the operational backfill that retires the null-`shopId` compatibility branch
entirely. F-PR2R4-01 disappears only once that branch is retired or the selector predicate is
made set-valued.

**PR 4 persistence dependencies** — R-039.

**Unacceptable remaining defects (must be corrected before acceptance)**

1. **F-PR2R4-01 (P1)** — legacy-variant null-owned rows unreachable by unique selector; `upsert`
   silently duplicates, including on the live `after-auth.server.ts` path.
2. **F-PR2R4-02 (P3, blocking under §6)** — permanent in-repo evidence misrepresents the
   reviewed head.

---

## 15. Verdict

> ## `NOT READY — FURTHER CORRECTIONS REQUIRED`
>
> **Exact reviewed head:** `93e8044aea3958e8efe36f774e7d99ae6a0dd687`
> **P0: 0 · P1: 1 · P2: 0 · P3: 4**
>
> No cross-tenant read or write was reproduced. All sixteen prior security regressions remain
> closed. F-PR2R3-01, -02, -04, -05 and -07 are closed; F-PR2R3-03 is partially closed;
> F-PR2R3-06 recurs.

**Next action:** Return to ChatGPT for the exact Cursor fifth correction prompt.

PR #13 remains **open, draft and unmerged**. Implementation code was **not modified** by this
review. This report is added as a **report-only commit** on top of the reviewed head; the
reviewed implementation/handoff head remains
`93e8044aea3958e8efe36f774e7d99ae6a0dd687`.
