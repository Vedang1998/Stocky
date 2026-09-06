# PR5 Emergency Remaining Integration Plan — Early Tier-A Independent Architecture Review (Claude)

**Reviewer:** Claude Code, acting as independent principal engineer / architecture, security and
release-risk reviewer under `AGENTS.md`, `CLAUDE.md`, and `ACCELERATED_SAFE_DELIVERY.md`.

**Review class:** EARLY Tier-A adversarial architecture review, performed **before** F3 runtime
exists. This is not the mandatory final exact-head review, which remains required.

**Mandate constraints observed:** no runtime, schema, migration, test, or configuration file
modified; PR #32 not edited and not pushed to; PR #30 / #31 / #32 / #33 not merged, not marked
ready, not closed; `RISK_REGISTER.md` not edited; no risk closed; no D-055; no F3 implementation;
no PR 6 implementation; no feature flag enabled; no production or merchant production data
accessed; no Shopify mutation issued. Only this new artifact is committed.

**Emergency posture:** the 2026-09-07 operational rescue target is acknowledged. Per `AGENTS.md`
and `EMERGENCY_DELIVERY_DIRECTIVE_2026-09-01.md`, calendar pressure does not relax any safety
gate, and this review applies the ordinary Tier-A standard.

---

## 1. Verified repository identity and current state

All values below were obtained by direct inspection of the local Git object store and the GitHub
Actions API in this session. None is inherited from PR #32's narrative or from chat summary.

| Item | Observed value | How verified |
|---|---|---|
| Repository | `Vedang1998/Stocky` | `git remote -v` |
| Application | `stocky-plus/` | working tree |
| **Reviewed planning SHA** | `b886bb562a0f77cfb9a8964e24b9a348b310514a` | `git rev-parse pr/32`; `git cat-file -t` = commit |
| Planning-head subject | `Plan remaining PR5 integration after F2A/F2B/F2C cores.` | `git log --oneline b886bb5 -1` |
| **Current `origin/main` observed** | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` | `git rev-parse origin/main` |
| `main` tip subject | `Phase 1 PR5-F2A — canonical Shopify admin read boundary (#29)` | `git log --oneline main -1` |
| Planning-head parent | `f65ab4b…` (PR #32 is based directly on current `main`) | `git log --oneline b886bb5 -2` |
| PR #32 diff vs `main` | 3 files, +804 / −15; docs-only | `git diff --stat f65ab4b b886bb5` |
| PR #32 changed paths | `docs/PROJECT_STATUS.md`, `docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md` (new), `docs/phases/phase-1/README.md` | `git diff --name-status` |
| Working tree before edits | clean | `git status --short` |

### 1.1 Current-state corrections applied (PR #32's §0 snapshot is stale)

The reviewing prompt supplied current-state corrections. Each was independently verified against
repository objects rather than accepted on assertion.

| Claim | Independent verification | Verdict |
|---|---|---|
| F2A merged on `main` as `f65ab4b…` | `git rev-parse origin/main` = `f65ab4b…` | **CONFIRMED** |
| F2B accepted implementation head `1b72a4c…` | `git cat-file -t` = commit; ancestor of PR #31 head | **CONFIRMED** |
| F2B correction review verdict `APPROVE PR5-F2B CANONICAL APPLICATOR CORRECTION` | line 755 of `PR5_F2B_CANONICAL_APPLICATOR_CORRECTION_INDEPENDENT_REVIEW.md` on PR #31 | **CONFIRMED** |
| F2B review blob `b01569fd77455566438bcedbe869647beb24eda7` | `git rev-parse pr/31:…CORRECTION_INDEPENDENT_REVIEW.md` = `b01569f…` | **CONFIRMED — exact blob match** |
| PR #31 refreshed against F2A `main`; head `cd3b87e…` | `git rev-parse pr/31` = `cd3b87e…`; `git merge-base pr/31 main` = `f65ab4b…`; `git merge-base --is-ancestor f65ab4b pr/31` = true | **CONFIRMED** |
| PR #31 exact-head CI `33577381656` running | Actions API: `head_sha=cd3b87e…`, `event=pull_request`, `status=in_progress`, `run_started_at=2026-09-02T00:56:45Z` | **CONFIRMED — in progress, not yet a pass** |
| F2C accepted implementation head `2d2e880…` | `git rev-parse pr/30` = `2d2e880…` | **CONFIRMED** |
| F2C second-correction verdict `APPROVE PR5-F2C COMPATIBILITY PROJECTION SECOND CORRECTION` | line 507 of `PR5_F2C_COMPATIBILITY_PROJECTION_SECOND_CORRECTION_INDEPENDENT_REVIEW.md` at commit `7015c6e8…` | **CONFIRMED** |
| F2C review blob `d637a9ecf0f42c3ae62f87e0391abb0b80e2e2ad` | `git rev-parse 7015c6e8:…SECOND_CORRECTION_INDEPENDENT_REVIEW.md` = `d637a9e…` | **CONFIRMED — exact blob match** |
| PR #30 still requires current-main refresh | `git merge-base pr/30 main` = `5129707…` (pre-F2A); `git merge-base --is-ancestor f65ab4b pr/30` = false | **CONFIRMED** |
| PR 6 runtime not authorized; PR 6 planning/fixtures expressly authorized one level ahead | `ACCELERATED_SAFE_DELIVERY.md` L49 and L242 permit one-dependency-level-ahead planning when expressly authorized | **CONFIRMED** |

**Consequence for PR #32.** The packet's §0 evidence snapshot records "F2B independent review …
**no second independent re-review artifact is on the branch**" and "F2C … **no third independent
re-review artifact is on the branch**", and it also records the F2B head as `1b72a4c…` with a
pre-F2A merge-base. Those statements were true at drafting and are false now. PR #32 additionally
writes the stale F2B/F2C statements into `PROJECT_STATUS.md` and `phases/phase-1/README.md`, i.e.
into durable governance state. See **F-CLAUDE-PR5F3EA-17**.

For precision: for F2C the packet's literal wording ("not on the branch") remains true of PR #30's
head `2d2e880…`; the second-correction review exists at commit `7015c6e8…`, which is not an
ancestor of PR #30. For F2B the packet's wording is now simply wrong — the correction re-review is
on PR #31 at `dba3b24…`, and the branch has since merged F2A `main`.

### 1.2 Adjacent open PR observed

PR #33 (`33a381a…`, *Emergency Continuity Sprint control packet*) is open and edits
`docs/PROJECT_STATUS.md`, `docs/README.md`, and `docs/phases/phase-1/README.md` — two of which
PR #32 also edits. See **F-CLAUDE-PR5F3EA-24**.

---

## 2. What was independently inspected

Beyond the required documents (`AGENTS.md`, `docs/README.md`, `PROJECT_STATUS.md`,
`ACCELERATED_SAFE_DELIVERY.md`, `phases/README.md`, `PHASE_BRIEF.md`,
`PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`, `RISK_REGISTER.md`, `DECISIONS.md`, the F1 / F2A
reports and immutable reviews, the F2B and F2C implementation reports and reviews, and the complete
PR #32 diff), the following live runtime evidence was read directly:

- `app/lib/catalog-facts/**` on `main` (F1 + F2A), including
  `admin-read/safety/{scan.ts,graphql-ast.ts,production-modules.ts}`,
  `admin-read/{execute.ts,bulk-operation.ts,bulk-query-documents.ts,types.ts}`,
  `admin-read/mutation-safety.test.ts`, `lock-capacity.ts`, `lock-key.ts`, `constants.ts`.
- `app/lib/catalog-facts/apply/**` on PR #31 (`writers.ts`, `first-live.ts`, `index.ts`, `types.ts`).
- `app/lib/catalog-facts/compatibility-projection/**` on PR #30 (`project.ts`, `legacy-writer.ts`).
- PR 4 control plane: `app/sync/{execution-strategy,application-receipt,digest,dispatcher,
  fair-claim-query,sanitize}.server.ts`, `app/tenant/job-envelope.server.ts`,
  `scripts/sync-control-plane/manifest.ts`.
- `app/jobs/workers/webhook-processor.ts`, `app/jobs/queue.server.ts`,
  `app/services/{shopify-sync,shopify-gql}.server.ts`.
- `prisma/schema.prisma` (`SyncRun`, `SyncCursor`, the five `Shopify*Fact` models, the
  `CatalogCompatibilityProjectionState` / `CatalogAbsenceNominationState` enums),
  `prisma/migrations/20260816193000_pr5_catalog_fact_foundation/migration.sql`,
  `prisma/migrations/20260804210000_sync_control_plane_correction/migration.sql`,
  `scripts/tenant-enforcement/sql.ts`.
- `shopify.app.toml`.

No probe files were created; no temporary artifacts remain.

### 2.1 Current-`main` defect claims in PR #32 §1.3 — all verified true

| Plan claim | Verified location |
|---|---|
| `fetchLocations` still `locations(first: 50)` | `app/services/shopify-gql.server.ts:88` |
| `pollBulkOperation` still uses `currentBulkOperation` | `app/services/shopify-gql.server.ts:197,207,215` |
| Full JSONL in memory | `app/services/shopify-sync.server.ts:33` (`response.text()`), `:34` (`split`) |
| Per-row legacy upsert | `app/services/shopify-sync.server.ts:66` |
| Webhook `available` as truth | `app/jobs/workers/webhook-processor.ts:258,261` (`inv.available ?? 0`) |
| Forecast / ABC coupling | `app/jobs/workers/webhook-processor.ts:265` (`computeForecast`), `:275` (`lowStockAlert.create`) |
| Catalog job payload still `catalog-sync-v1` | `app/jobs/queue.server.ts:189,206` |
| Webhook toml only `inventory_levels/update` | `shopify.app.toml:34` |
| `SyncRun` checkpoint columns absent | `prisma/schema.prisma` `model SyncRun` — no `bulkOperationGid`, no `jsonlCommittedLineOrdinal` |

§1.3 is accurate. This part of the packet is good work and is not disputed.

---

## 3. Primary architecture question — one remaining runtime PR

### 3.1 Falsification attempt against the plan's overlap claim

The plan asserts that splitting JSONL runtime from webhook runtime would be **less safe**, because
the remaining P1 class is overlap. I attempted to falsify this and **could not**.

The decisive reason is not test convenience. It is that a JSONL-first intermediate `main` would
carry the full-sync **presence + absence-nomination + confirmation + tombstone** capability while
the webhook authoritative-refetch adapter — the mechanism that produces the overlapping LIVE
direct observations that Races B, C/I, H, U, AL and AB rely on to *prevent* tombstoning — does not
yet exist. Brief §6.F.10 and §6.F.7 make the confirmation path conditional on direct existence
evidence; without the refetch adapter, the surviving absence path is closer to "complete epoch
omission plus a bounded confirmation query", with no overlapping-LIVE arbitration and no
delete-signal worker. Tombstones for Product, ProductVariant, InventoryItem and deleted Locations
are **terminal** under R-155 / §6.F.7. An intermediate state that can create terminal, unrecoverable
tombstones without its overlap protections is materially less safe than one larger PR.

The converse split (webhooks first, JSONL later) does not create that hazard, but it delivers no
merchant value for the rescue — the reliable-inventory-facts priority in the Emergency Continuity
Sprint packet §6 requires the full-sync path — and it defers every overlap race anyway.

The rejected-split table in §2.1 is therefore substantively correct, not merely rhetorical.

### 3.2 Where the one-PR argument is nevertheless incomplete

The plan proves that the *merge boundary* must not fall between JSONL and webhooks. It does not
address the equivalent hazard **inside** the single PR. §2.3's internal commit sequence places
"absence nomination / confirmation / circuit breaker" at commit 3 and the "webhook sanitizers +
authoritative refetch workers" at commit 4. That ordering reproduces, within the branch, exactly
the unsafe intermediate state §2.1 rejects — and it becomes a real merge boundary the moment
anyone cherry-picks, bisects, or partially lands the sequence.

More seriously, and independent of ordering: `AGENTS.md` requires that destructive workflows are
not enabled without feature flags and kill switches. Tombstoning terminal Shopify identities is a
destructive workflow. The packet contains **no** feature flag and **no** kill switch for absence
confirmation or tombstone writing — the strings "kill switch" and "feature flag" do not appear in
the document, and the only control named is the blast-radius circuit breaker, which is an anomaly
detector, not an operator control. See **F-CLAUDE-PR5F3EA-02**.

### 3.3 Verdict on the lane question

**The one-F3-PR recommendation is UPHELD**, and no split is proposed in its place. A split would
not close any finding in this report; two of the findings (**-02**, **-03**) would become *harder*
to close under a split. The corrections below are scope and contract corrections inside the single
lane, not a lane redesign.

---

## 4. Findings

Severity per `CLAUDE.md`. Every finding names file and line where a repository fact is asserted.

### P0

**None.** No finding in this review meets the P0 bar on the evidence available at architecture
stage. **F-CLAUDE-PR5F3EA-01** has a P0 *consequence class* (unrecoverable loss of live merchant
catalog identities) but its trigger requires a specific unhandled failure mode rather than an
ordinary path, so it is recorded as P1. This is deliberate severity discipline, not reassurance:
-01 must still be closed before F3 runtime.

---

### P1

#### F-CLAUDE-PR5F3EA-01 — "JSONL fully streamed" has no mechanical proof; a boundary-aligned truncation can produce terminal tombstones

- **Severity:** P1 (unrecoverable consequence class)
- **Where:** plan §4.1, §4.2 step 5, §4.6, §8.1 (`FX-JSONL-005`/`006`), §8.2 (`FX-BULK-001`)
- **Evidence:** Brief §6.F.10 precondition 4 requires that "JSONL/pages were fully streamed and
  every in-scope identity's applicator batch committed" before any absence-candidate nomination.
  The plan never defines how "fully streamed" is *proven*. It specifies only that a **malformed**
  line fails the apply unit and degrades the domain. It does not reconcile the streamed line count
  against the BulkOperation snapshot's `objectCount` / `rootObjectCount`, does not check
  `Content-Length` or an explicit end-of-stream integrity signal, and does not distinguish a clean
  EOF from a truncated transfer. `classifyBulkOperationSnapshot`
  (`app/lib/catalog-facts/admin-read/bulk-operation.ts:63`) already exposes the completed snapshot,
  and the brief §8.4 already requires persisting `objectCount` / `rootObjectCount` for diagnostics,
  so the required signal is available and unused.
- **Merchant impact:** A download that terminates at an exact line boundary — a proxy or CDN cut,
  a chunked response whose terminating chunk is lost, a partially written cached object — yields a
  stream that parses cleanly to its last line. The worker concludes the epoch is complete. Every
  identity after the truncation point is absent from the epoch, is nominated, and is confirmed by
  `location(id:)` / `product(id:)` returning **live** — so confirmation correctly refuses those.
  The residual hazard is the subset that *is* genuinely stale in Shopify plus any identity whose
  confirmation query is answered from an inconsistent read: those tombstone. Because Product,
  ProductVariant and InventoryItem tombstones are terminal under R-155 / §6.F.7, and because the
  planning breaker thresholds (250 absolute / 2 % of LIVE, brief §6.F.10) are explicitly
  *configurable hypotheses*, a truncation losing less than the configured proportion passes the
  breaker silently. The merchant loses catalog identities that cannot be revived.
- **Reproduction:** Serve a fixture JSONL of N lines, terminate the HTTP body after line
  `floor(0.99·N)` at a newline boundary with no error. Observe the worker mark the domain epoch
  complete, run nomination over the missing 1 %, and pass the breaker.
- **Expected behavior:** Before any nomination for a bulk domain, F3 must prove stream
  completeness. The applied-node count must reconcile against the BulkOperation snapshot's
  `objectCount` (and root count against `rootObjectCount`) within an explicitly stated rule, and
  a mismatch must be treated exactly as §8.4 treats a partial bulk: no nomination, no tombstone,
  no watermark, `PARTIAL_FAILURE`, `DataIssue`.
- **Recommended correction:** Add to §4.1 / §4.2 a mandatory completeness gate: persist
  `objectCount` and `rootObjectCount` from the poll snapshot on the `SyncRun`; count applied nodes
  during the stream; require exact reconciliation before the domain may nominate or advance a
  watermark; state the disposition when Shopify omits the counts (fail closed — no nomination).
- **Missing test:** `FX-JSONL-010` — boundary-aligned truncated stream, complete `url`, no
  malformed line: domain must not nominate, must not advance the watermark, must record
  `PARTIAL_FAILURE`. `FX-JSONL-011` — `objectCount` mismatch by one: same assertion.

#### F-CLAUDE-PR5F3EA-02 — No feature flag or kill switch for absence confirmation / tombstoning

- **Severity:** P1
- **Where:** plan §2.3, §4.7, §5.2; `AGENTS.md` "Engineering rules" and "Inventory-write safety"
- **Evidence:** The strings "kill switch" and "feature flag" do not occur anywhere in
  `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md`. §4.7 describes nomination, breaker and
  confirmation with no operator control. §5.2's allowlist names no flag surface. `AGENTS.md`
  requires "Do not enable destructive workflows without feature flags and kill switches", and the
  Emergency Continuity Sprint packet §3 re-affirms kill switches as a non-relaxable gate.
- **Merchant impact:** Tombstoning terminal Shopify identities is irreversible by design
  (R-155: one later LIVE observation opens `TERMINAL_IDENTITY_REVIVAL_CONFLICT` and *keeps* the
  tombstone). With no kill switch, an operator who observes anomalous tombstoning in the rescue
  window has no bounded way to stop it short of disabling the whole shop or reverting a deploy.
  Under a 2026-09-07 rescue this is exactly the wrong ratchet.
- **Reproduction:** Inspect §4.7 and §5.2 for any enable/disable surface for confirmation and
  tombstone writing; none exists.
- **Expected behavior:** Absence confirmation and tombstone writing are behind a default-OFF
  capability that can be disabled at runtime without a deploy, checked server-side immediately
  before any tombstone write, and recorded in the F3 report as DEFAULT OFF alongside the
  inventory-write flags.
- **Recommended correction:** Add the flag to §5.2's allowlist and to §4.7; state that presence
  application, nomination and candidate persistence may run with the flag OFF (they are
  non-destructive), while confirmation-to-tombstone requires the flag ON. This *also* resolves
  §2.3's unsafe internal ordering: commit 3 may land nomination with tombstoning gated OFF, and
  the flag is enabled only after commit 4's webhook adapter and the overlap fixtures are green.
- **Missing test:** flag-OFF fixture — candidates nominate, zero tombstones written, domain
  reports a bounded not-yet-reconciled state rather than `HEALTHY`.

#### F-CLAUDE-PR5F3EA-03 — Single `lastSeenFullSyncRunId` slot versus three domain epochs; presence ownership undefined

- **Severity:** P1
- **Where:** plan §4.4 ("three domain `SyncRun`s"), §4.6, §4.7, §8.1 `FX-JSONL-001` / `FX-JSONL-002`
- **Evidence:** `prisma/schema.prisma` gives each fact model exactly one nullable
  `lastSeenFullSyncRunId` (`:1136`, `:1212`, `:1271`, `:1331`, `:1413`) with one index
  (`:1165` and siblings) and one `absenceNominationState` (`:1142`). There is no domain qualifier.
  The plan runs three independent full-sync epochs (`locations`, `catalog`, `inventory_levels`),
  and at least two of them observe `ShopifyInventoryItemFact`: `CATALOG_BULK_QUERY_WITH_UNIT_COST`
  embeds `inventoryItem { id … }` inside each variant node
  (`app/lib/catalog-facts/admin-read/bulk-query-documents.ts:74`), and
  `INVENTORY_LEVEL_BULK_QUERY` emits a bare top-level `inventoryItems … { id }` node
  (`:163`). §8.1 `FX-JSONL-001` explicitly requires the catalog mapper to emit "Product / Variant /
  Item `full_sync` observations". `FX-JSONL-002` says nothing about the InventoryItem parent line.
  The plan never states which domain owns the presence slot for `ShopifyInventoryItemFact`, nor
  which domain may nominate that fact type, nor the ordering of the three domain runs.
- **Merchant impact:** If both epochs write the shared slot, whichever run commits last wins.
  The other run's nomination sweep — SQL over `lastSeenFullSyncRunId != thisEpochId` per §4.7 —
  then nominates the *entire* InventoryItem population. Best case the blast-radius breaker trips,
  all tombstones abort, the domain is permanently `DEGRADED`, `SyncRun` never reaches `SUCCEEDED`
  (brief §8.5 item 7), and catalog-sync therefore never converges — the rescue's primary
  deliverable ("reliable inventory facts") silently never completes. Worst case, with the
  configurable thresholds set loosely on a small shop, mass terminal tombstoning of every
  InventoryItem.
- **Reproduction:** Two complete epochs A (catalog) and B (inventory_levels) over the same shop;
  let B commit last; run A's nomination sweep; observe candidate count equal to the LIVE
  InventoryItem population.
- **Expected behavior:** Presence and nomination are scoped so that exactly one domain epoch owns
  the presence marker and the nomination predicate for each fact type, and a fact type observed by
  two epochs cannot have its marker overwritten by the non-owning epoch.
- **Recommended correction:** State in §4.6 an explicit fact-type → owning-domain map (e.g.
  `ShopifyProductFact`, `ShopifyVariantFact`, `ShopifyInventoryItemFact` → `catalog`;
  `ShopifyLocationFact` → `locations`; `ShopifyInventoryLevelFact` → `inventory_levels`), state
  that the `inventory_levels` epoch does **not** write `lastSeenFullSyncRunId` for
  `ShopifyInventoryItemFact` and does **not** nominate that type, and state the ordering /
  independence of the three runs. If ChatGPT instead wants per-domain presence, that requires a
  merchant-side additive migration, which the plan currently forbids (§5.2) — decide explicitly.
- **Missing test:** `FX-ABS-003` — complete catalog epoch A then complete inventory-levels epoch B
  over the same InventoryItems; A's sweep nominates zero.

#### F-CLAUDE-PR5F3EA-04 — False-`HEALTHY` leak is structurally open, and the plan's own scope rules forbid both fixes (R-145)

- **Severity:** P1
- **Where:** plan §3.3 bullet 6, §4.10 steps 2–4, §4.11, §5.2, §5.3
- **Evidence:** Three repository facts combine.
  1. `enum CatalogCompatibilityProjectionState { HEALTHY DEGRADED }`
     (`prisma/schema.prisma:1061-1064`). There is **no** not-yet-projected value.
  2. The column default is `HEALTHY` on every fact model
     (`:1140`, `:1216`, `:1275`, `:1335`, `:1417`).
  3. F2B's canonical INSERT statements do **not** list `compatibilityProjectionState`
     (PR #31 `app/lib/catalog-facts/apply/writers.ts:269, 301, 336, 372, 409` — the column lists
     name `existenceDiagnosticState` and `attributeFreshnessState` but never
     `compatibilityProjectionState`), so every newly inserted canonical fact row commits with the
     database default `HEALTHY` **inside the canonical transaction**, before any projection has
     ever run.
  The plan's remedy (§4.10 step 2) writes `DEGRADED` in a *separate* merchant transaction *after*
  the canonical commit. That does not close the window it names; it only shortens it. And the two
  designs that would close it are both excluded by the plan itself: §5.2 restricts the additive
  migration to `SyncRun` only (so the enum cannot gain a `PROJECTION_PENDING` value and the column
  default cannot change), and §5.3 freezes
  `app/lib/catalog-facts/apply/{clocks,existence,fencing,first-live,writers,money}.ts` (so the
  not-yet-projected state cannot be written inside the canonical transaction).
- **Merchant impact:** Between canonical commit and the F3 diagnostic write — and permanently for
  any row whose diagnostic write is lost to a crash — merchant-durable state asserts the
  compatibility projection is `HEALTHY` for facts that have never been projected. Per §4.11 and
  brief §6.F.12 this column is one of the four merchant-durable honesty sources, so the Buying
  Table / barcode cache / today's `InventorySnapshot` can be reported current while stale. This is
  precisely R-145 and Race F / Race Z.
- **Reproduction:** Apply a canonical batch containing a brand-new identity; kill the worker
  immediately after the canonical `COMMIT` and before the diagnostic writer; read
  `compatibilityProjectionState` for the new row — `HEALTHY`.
- **Expected behavior:** A canonical fact row must never be readable as projection-`HEALTHY` before
  a successful projection write for that row's generation.
- **Recommended correction:** ChatGPT must choose one and record it, and must widen the
  corresponding scope rule to match:
  (a) authorize a narrow additive **merchant** migration in F3 adding a `PROJECTION_PENDING`
      (or equivalent) enum value and changing the column default, *and* still require the value to
      be written in the canonical transaction for **updated** rows (a default change alone does not
      cover rows F2B updates); or
  (b) authorize one narrow, reviewed extension point in F2B's writers so F3 supplies the
      not-yet-projected state inside the canonical transaction, lifting §5.3's freeze for that
      named change only.
  Option (a) alone is insufficient. Either way, §5.2's "additive migration on `SyncRun` only" and
  §5.3's blanket writer freeze must be amended, or R-145 cannot close in F3.
- **Missing test:** `FX-PROJ-009` — first-insert of a new canonical identity, read
  `compatibilityProjectionState` inside the same transaction and immediately after commit: must
  never be `HEALTHY`.

#### F-CLAUDE-PR5F3EA-05 — `bulkOperationRunQuery` is not admissible under the frozen F2A scanner as the plan scopes it

- **Severity:** P1
- **Where:** plan §3.1 ("F3 **may** add a submitter … must live **outside** `admin-read/`"),
  §5.1 (`app/lib/catalog-facts/ingest/**`), §5.3, §9.2 ("`bulkOperationRunQuery` is allowed **only**
  in the F3 submitter module")
- **Evidence:** `assertCanonicalReadDocument`
  (`app/lib/catalog-facts/admin-read/safety/graphql-ast.ts:96-116`) rejects **every** operation
  whose type is not `query`, with no allowlist parameter and no per-module exception hook. The only
  exception mechanism in the lane is `CANONICAL_READ_IMPORT_EXCEPTIONS`
  (`admin-read/safety/scan.ts:56`), which is imports-only and is currently empty. The scan root is
  the **parent** of `admin-read/`: `mutation-safety.test.ts:161` computes
  `catalogFactsDir = path.dirname(fileURLToPath(import.meta.url))` (= `…/catalog-facts/admin-read`)
  and then calls `scanCatalogFactsProductionModules(path.dirname(catalogFactsDir))`, i.e.
  `app/lib/catalog-facts`. `listProductionTypeScriptModulesRecursive`
  (`admin-read/safety/production-modules.ts:19`) walks that root recursively. Therefore the plan's
  proposed `app/lib/catalog-facts/ingest/**` **is** inside the scan root, and a
  `bulkOperationRunQuery` document there fails the scan as `mutation_rejected`. Moving outside
  `admin-read/` (§3.1) does not help; only moving outside `app/lib/catalog-facts/` would, and §5.1
  places it inside. §5.3 simultaneously forbids rewriting `admin-read/**` "except imports", which
  forbids adding the exception mechanism.
- **Merchant impact:** As specified, F3 cannot submit a bulk operation without either failing CI or
  silently violating its own freeze. The likely field resolution — quietly relocating the submitter
  outside the scanned tree — removes it from the deny-by-default write scanner entirely, which is
  the R-138 P0 control. That is the worse outcome and the one the plan's wording invites.
- **Reproduction:** Place a `bulkOperationRunQuery` document under
  `app/lib/catalog-facts/ingest/submit.ts` and run
  `npx vitest run app/lib/catalog-facts/admin-read/mutation-safety.test.ts` — the recursive-scan
  case asserts `result.findings` is empty and fails.
- **Expected behavior:** Exactly one narrowly scoped, mechanically enforced mutation exception,
  inside the scanner, that cannot be widened.
- **Recommended correction:** Amend §5.3 to authorize a named, reviewed change to
  `admin-read/safety/{graphql-ast.ts,scan.ts}` adding a `CANONICAL_SUBMIT_MUTATION_EXCEPTIONS`
  table keyed on **exact operation root-field name** (`bulkOperationRunQuery`) **and exact module
  path** (one file), with no glob and no prefix matching; every other mutation, in that module and
  elsewhere, still fails closed. Brief §12's "unless an explicit later product-owner write
  authorization exists" already contemplates such a hook; F2A did not build one.
- **Missing test:** plant `inventoryBulkToggleActivation` **in the submitter module itself** — must
  still fail; plant `bulkOperationRunQuery` in a *different* ingest module — must fail; the single
  authorized module — must pass.

#### F-CLAUDE-PR5F3EA-06 — R-163 cannot close before F3 as the plan claims; `app/jobs/workers/catalog-facts/**` is outside the scan root

- **Severity:** P1
- **Where:** plan §7 R-163 row ("F3 nested `ingest/` and `workers/catalog-facts/` **must** remain
  inside the recursive scan"), §5.1, §9.1, §10 item 13
- **Evidence:** The scan root is `app/lib/catalog-facts` (see -05 evidence:
  `mutation-safety.test.ts:161`). §5.1 places the F3 workers at
  `stocky-plus/app/jobs/workers/catalog-facts/**`, which is not under that root and is therefore
  **not** enumerated by `listProductionTypeScriptModulesRecursive`. The word "remain" is factually
  wrong: those modules were never inside the scan. §9.1's scanner CI step runs only
  `foundation-safety.test.ts` and `admin-read/mutation-safety.test.ts`, neither of which scans the
  worker tree. Compounding this: making the worker tree a scanned root would immediately fail on
  the scanner's deny-by-default **import** rule — `isForbiddenCanonicalReadImport`
  (`admin-read/safety/scan.ts:159-186`) rejects `@shopify/*` and any specifier matching
  `/(^|[./])shopify\.server$/` or containing `/services/`, and a Shopify worker necessarily imports
  `unauthenticated` from `app/shopify.server` exactly as `webhook-processor.ts:3` does.
- **Merchant impact:** The R-138 P0 write-scanner — the control that stops an accidental
  `inventoryBulkToggleActivation` / `inventoryDeactivate` / `inventorySetQuantities` from reaching
  Shopify — would not cover the F3 tree that actually holds a live Admin client. Race AC's planted
  mutation would pass CI in the workers.
- **Reproduction:** `scanCatalogFactsProductionModules('app/lib/catalog-facts')` on a tree
  containing `app/jobs/workers/catalog-facts/planted.ts` returns zero findings.
- **Expected behavior:** Every F3 production module that can construct a Shopify document is
  mutation-scanned, and the import policy applied to each root matches that root's legitimate needs.
- **Recommended correction:** Specify a **two-root** scanner design in §5.2 / §9.1: root 1
  (`app/lib/catalog-facts`) keeps today's policy (all mutations denied except the single
  §-05 submitter exception; `@shopify/*` and `/services/` imports denied); root 2
  (`app/jobs/workers/catalog-facts`) applies the mutation policy but a **worker** import policy
  that permits exactly `app/shopify.server`'s `unauthenticated` and denies every Shopify write
  service. Add a CI step that runs the scan over root 2 and a Race-AC plant inside root 2. Correct
  §7's R-163 row: R-163 is **not** eligible to close at F2B/F2C merge and requires the two-root
  proof.
- **Missing test:** `pr5-f3-scanner-roots` — planted `inventoryBulkToggleActivation` under
  `app/jobs/workers/catalog-facts/` fails CI; planted forbidden write-service import there fails;
  the legitimate `unauthenticated` import passes.

#### F-CLAUDE-PR5F3EA-07 — Legacy `catalog-sync` v1 remains able to write a competing authority, and the plan forbids the file changes needed to stop it

- **Severity:** P1
- **Where:** plan §1.3 ("Legacy helpers stay untouched except where the live webhook/catalog worker
  would otherwise keep writing a second authority"), §2.3 commit 1, §3.4, §5.2
- **Evidence:** The catalog-sync worker branch dispatches on job **name** only —
  `if (job.name === "abc-analysis-shop" || job.name === "catalog-sync")`
  (`app/jobs/workers/webhook-processor.ts:725`) — and never reads `payloadSchemaVersion`. Both
  execution paths (`:794` and `:832`) call `startCatalogSync(db, admin)`
  (`app/services/shopify-sync.server.ts:84`), which calls `runBulkProductSync(admin)` and then
  polls with `pollBulkOperation(admin)` — the **`currentBulkOperation`** poller
  (`app/services/shopify-gql.server.ts:197,207,215`) — and finally
  `ingestBulkVariantCache(db, op.url)` (`:96`), which `response.text()`-buffers the body (`:33`)
  and per-row upserts `shopifyVariantCache` (`:66`). That is the *same* table F2C's compatibility
  projection writes (PR #30 `compatibility-projection/legacy-writer.ts:37`), and
  `shopifyVariantCache` plus `inventorySnapshot` are the only two legacy compatibility writers in
  the application (verified by grep: `app/services/shopify-sync.server.ts:66` and
  `app/jobs/workers/webhook-processor.ts:244`). The plan fences the second (§4.5) and leaves the
  first entirely unaddressed; `app/services/shopify-sync.server.ts` and
  `app/services/shopify-gql.server.ts` do **not** appear in §5.2's allowlist.
- **Merchant impact:** Two compounding failures.
  (1) **Competing authority.** Any `catalog-sync` DurableJob created before the F3 deploy —
  queued, leased, retried under `REBUILDABLE_IDEMPOTENT`, or replayed from a dead letter — still
  executes the v1 applicator after F3 ships, writing `shopifyVariantCache` outside the canonical
  path and outside the advisory lock, while `compatibilityProjectionState` reports `HEALTHY`.
  (2) **Cross-binding to F3's own operation.** `pollBulkOperation` binds *the current* bulk
  operation. With five concurrent operations allowed per shop, a surviving v1 job can bind F3's
  canonical BulkOperation, download F3's JSONL, and map it with the v1 row shape — which expects
  `variant.image.url` and `variant.inventoryItem.measurement`, whereas the F2A document selects
  `featuredMedia { preview { image { url } } }` at the *product* level
  (`bulk-query-documents.ts:44`) — writing null `imageUrl` and null weights over merchant
  compatibility rows. This is exactly the R-134 hazard PR 5 exists to remove, re-entering through
  the back door.
- **Reproduction:** Enqueue a `catalog-sync` DurableJob with `payloadSchemaVersion: "catalog-sync-v1"`
  before the F3 cut-over; dispatch it after; observe `startCatalogSync` run and
  `shopifyVariantCache` written by the legacy path.
- **Expected behavior:** After F3, no code path can execute the v1 catalog applicator, and
  `currentBulkOperation` is unreachable from any live path for the canonical domains.
- **Recommended correction:** Add `app/services/shopify-sync.server.ts` and
  `app/services/shopify-gql.server.ts` to §5.2's allowlist and require in §2.3 commit 1 that:
  the worker branch on `payloadSchemaVersion` and **fail closed** on `catalog-sync-v1`
  (dead-letter with a stable outcome code, never silently run it); `startCatalogSync` /
  `runBulkProductSync` / `pollBulkOperation` / `ingestBulkVariantCache` be removed from every
  reachable path or hard-disabled; and the F3 report record the drain/disposition of pre-existing
  v1 `DurableJob`, `JobReplay` and `DeadLetter` rows. Also extend the §9.2 `currentBulkOperation`
  search gate beyond the F3 trees (see -13).
- **Missing test:** `FX-BULK-010` — a `catalog-sync-v1` durable job dispatched post-F3 must
  fail closed with zero `shopifyVariantCache` writes; `FX-BULK-011` — no live path reaches
  `pollBulkOperation`.

#### F-CLAUDE-PR5F3EA-08 — Checkpoint ordinal has no pairing/reset rule against the BulkOperation GID; `ingestBatchId` derivation is undefined

- **Severity:** P1
- **Where:** plan §4.4 (schema table and two-phase model), §4.2 step 8, §4.9, §8.2 `FX-BULK-005/006/008`
- **Evidence:** §4.4 introduces `bulkOperationGid` and `jsonlCommittedLineOrdinal` as two
  independent nullable columns on `SyncRun` with no stated relationship. §4.2 step 8 requires that
  an expired URL start a **new** BulkOperation with a **new** fence generation, but never says
  whether that reuses the same `SyncRun` row or creates a new one, and never says that
  `jsonlCommittedLineOrdinal` must be reset atomically with persisting the new GID. Separately,
  §4.4 asserts resume "idempotently recognizes the orphan batch", but `ingestBatchId`
  (`prisma/schema.prisma:1145` and siblings) is a plain nullable `String` with **no** stated
  derivation rule and **no** index — and §5.2 forbids any merchant-side migration that could add one.
- **Merchant impact:** Two distinct defects.
  (1) **Silent under-application.** If the same `SyncRun` row is reused for a replacement
  BulkOperation, a stale ordinal of N causes resume to skip the first N lines of a *different*
  JSONL body. Those identities never receive presence markers, the epoch is nonetheless treated as
  complete, and they are nominated for absence — the same terminal-tombstone path as -01, reached
  from a different direction.
  (2) **Unimplementable recovery.** With a non-deterministic `ingestBatchId`, a crashed batch's id
  is unrecoverable, so §4.4's "recognizes the orphan batch" cannot be built; the honest fallback is
  blind idempotent re-application, which is safe under the F2B clocks but means `ingestBatchId`
  performs no recovery function at all and the plan's stated mechanism is false precision.
- **Reproduction:** Persist ordinal 500 for GID-A; expire GID-A's URL; submit GID-B on the same
  `SyncRun`; resume — the streamer skips GID-B's lines 1..500.
- **Expected behavior:** The checkpoint ordinal is meaningful only relative to one BulkOperation
  result body, and the resume path must refuse to consume an ordinal whose GID does not match.
- **Recommended correction:** State in §4.4 that (i) `jsonlCommittedLineOrdinal` is scoped to the
  `SyncRun`'s current `bulkOperationGid`; (ii) persisting a new GID and resetting the ordinal to
  NULL occur in the **same** control-plane transaction; (iii) resume must compare the polled GID to
  the persisted GID and fail closed on mismatch. Additionally, either specify `ingestBatchId` as a
  deterministic derivation of `(syncRunId, bulkOperationGid, startLineOrdinal)` — and authorize the
  index that lookup needs, amending §5.2 — or delete the "recognizes the orphan batch" claim and
  state plainly that resume re-applies idempotently by clock, with `ingestBatchId` retained as
  lineage only.
- **Missing test:** `FX-BULK-012` — stale ordinal + new GID on the same `SyncRun`: resume must not
  skip; `FX-BULK-013` — polled GID ≠ persisted GID: fail closed.

---

### P2

#### F-CLAUDE-PR5F3EA-09 — No orphan-BulkOperation recovery for a crash between submit and GID persistence

- **Where:** plan §4.2 steps 2–3. §4.2 orders `bulkOperationRunQuery` (step 2) before persisting
  the returned GID (step 3). A crash in between leaves an operation running at Shopify that F3 can
  never identify, because the only "which operation is running" primitive is
  `currentBulkOperation`, which R-134 / brief §8.1 forbid.
- **Impact:** Repeated crashes leak operations against the official five-concurrent-per-shop
  ceiling; `bulkOperationRunQuery` then returns userErrors and catalog sync stops for that shop
  until the leaked operations complete. Merchant-visible as "inventory facts stop refreshing".
- **Correction:** Name `bulkOperations(status:)` — a QUERY field, permitted by the F2A scanner and
  explicitly acknowledged as "officially valid" in brief §8.1 — as the bounded read-only recovery
  for adopting or waiting out an unrecorded operation, and state the adoption rule (match by
  `createdAt`/`query` and re-persist the GID, or wait). Alternatively persist a submit-intent row
  before the mutation. Add a fixture.

#### F-CLAUDE-PR5F3EA-10 — A mid-stream parse failure is not equated to a partial bulk for nomination and watermark purposes

- **Where:** plan §4.1 (malformed line → "fail the apply unit / mark domain degraded"), §4.6
  ("Partial bulk never nominates (Race D/O)"). Race D/O is scoped to `partialDataUrl` and
  `FAILED`/`CANCELED`. A malformed line inside an otherwise `COMPLETED` + complete-`url` operation
  is a third case the plan does not route to the same prohibition.
- **Impact:** Batches before the malformed line have already committed presence markers. If the
  domain is merely marked `DEGRADED` without an explicit nomination prohibition, a later sweep over
  a partially-marked epoch nominates everything after the failure point.
- **Correction:** State explicitly in §4.1 and §4.6 that any stream that does not reach a proven
  complete end (malformed line, truncation per -01, or aborted transfer) is treated exactly as
  §8.4 treats a partial bulk: no nomination, no tombstone, no watermark, `PARTIAL_FAILURE`.
  `FX-JSONL-006` must assert zero nominations, not only "domain DEGRADED".

#### F-CLAUDE-PR5F3EA-11 — Anti-starvation is asserted rather than designed; bulk polling is unbounded

- **Where:** plan §4.2 ("must not starve webhook jobs (PR 4 fair claim preserved)"), §4.8, §7 R-147.
- **Evidence:** The PR 4 fair-claim SQL partitions by **shop**, not by job type or queue. Within a
  shop it is strictly FIFO — `ORDER BY shop_slot ASC, shop_ord ASC, "nextEligibleAt" ASC,
  "createdAt" ASC, id ASC` with `LIMIT ${maxPerShop}`
  (`app/sync/fair-claim-query.server.ts:256-276`) — and there is no `jobType` or `queueName`
  predicate in the claim; the queue is chosen only afterwards, at dispatch
  (`app/sync/dispatcher.server.ts:394`). So catalog-sync and `inventory-state-reconcile` rows
  enqueued earlier consume that shop's claim budget ahead of a webhook that arrives later.
  "Fair claim preserved" is therefore true and irrelevant: it prevents cross-shop starvation, not
  intra-shop starvation of the webhook class. Separately, no bound is given for bulk polling; the
  legacy path used 60 × 5 s (`app/services/shopify-sync.server.ts:88-90`) and a long poll holds a
  claim slot for the whole wait.
- **Impact:** Inventory webhook signals queue behind a long catalog sync for the same shop, which
  is the freshness property the rescue depends on.
- **Correction:** Name the concrete mechanism (the coalescing in §4.8 is a start but is not a
  fairness guarantee): e.g. an explicit per-shop reservation for the webhook class, or deferral of
  reconcile enqueue while a webhook backlog exists for that shop. State a bounded poll ceiling and
  whether polling holds or releases the claim. Add a fixture asserting webhook latency under a
  concurrent catalog-sync + reconcile load for one shop.

#### F-CLAUDE-PR5F3EA-12 — Disabled shop mid-ingest: merchant writes no-op silently while the control-plane checkpoint still advances

- **Where:** plan §4.9 ("Uninstall / `processingEnabled=false` → Fail-closed; no merchant writes"),
  §4.4, §8.4 `FX-WH-010`.
- **Evidence:** The merchant RLS predicate includes the processing gate —
  `"shopId" IS NOT NULL AND "shopId" = <tenant fn>() AND <version fn>() = '<v>' AND
  stocky_shop_processing_enabled("shopId")` (`scripts/tenant-enforcement/sql.ts:100`) — applied as
  `USING` on SELECT/UPDATE/DELETE and `WITH CHECK` on INSERT (`:111-126`). So the database does
  fail closed, which is good. But an `UPDATE` filtered by `USING` affects **zero rows** rather than
  raising, and `jsonlCommittedLineOrdinal` lives on `SyncRun`, a control-plane table with no
  processing predicate (`prisma/migrations/20260804210000_sync_control_plane_correction/
  migration.sql:288-314` grants `stocky_control_plane` unconditional DML). The plan requires a live
  `processingEnabled` read immediately before **projection** (§3.3) but names no equivalent check
  between ingest batches.
- **Impact:** A shop disabled mid-stream can have its checkpoint and domain watermark advance over
  batches that wrote nothing, and the domain can reach `SUCCEEDED` with no facts. On re-enable the
  watermark asserts a completed sync that never happened.
- **Correction:** Require F3 to verify affected-row counts per batch and to re-read live
  `processingEnabled` between batches; a batch that wrote nothing because of the processing gate
  must halt the run and must not advance the checkpoint or the watermark. Add a fixture that
  disables the shop mid-stream and asserts the checkpoint does not advance.

#### F-CLAUDE-PR5F3EA-13 — §9.2 search gates are scoped to the F3 trees, which excludes the only file containing the R-165 defect

- **Where:** plan §9.2 ("must fail CI if matched in **F3 production ingest/worker trees**"), §7 R-165.
- **Evidence:** `available ?? 0` exists at `app/jobs/workers/webhook-processor.ts:258,261`;
  `currentBulkOperation` at `app/services/shopify-gql.server.ts:197,207,215`;
  `response.text()` at `app/services/shopify-sync.server.ts:33`. None of these is in
  `app/lib/catalog-facts/ingest/**` or `app/jobs/workers/catalog-facts/**`. A gate scoped to the
  new trees can never match the defect it exists to prevent regressing.
- **Impact:** R-165, R-134 and R-135 gain no mechanical regression guard on the files that actually
  carry them; a future edit silently reintroduces `available ?? 0` on the canonical path.
- **Correction:** Scope the `available ?? 0`, `currentBulkOperation` and `response.text()` gates to
  the whole application tree with an explicit, enumerated, reviewed exception list for any legacy
  occurrence deliberately retained, rather than to the F3 trees.

#### F-CLAUDE-PR5F3EA-14 — Three-domain job completion and retry semantics are undefined

- **Where:** plan §2.3 commit 3, §4.4 ("Catalog-sync job success requires all three domain runs
  succeeded"), §4.2.
- **Gap:** The plan does not state whether the three domain runs execute inside one job execution
  or as separately dispatched units; whether a `REBUILDABLE_IDEMPOTENT` retry of a partially
  succeeded catalog-sync re-allocates three new fence generations and submits three new bulk
  operations (re-burning the five-per-shop ceiling on every retry); or how an already-`SUCCEEDED`
  domain is skipped on retry. `executionStrategyForJobType` returns `REBUILDABLE_IDEMPOTENT` for
  `catalog-sync` (`app/sync/execution-strategy.server.ts:41`), which means "repeated execution
  converges" — but re-running all three domains is expensive, not merely convergent.
- **Impact:** Retry amplification against the concurrency ceiling and the Shopify cost budget; a
  shop whose `inventory_levels` domain fails repeatedly re-runs the whole catalog bulk.
- **Correction:** State the domain-run topology, the per-domain resume rule on retry, and the
  fence-allocation rule for a retry that only needs one domain.

#### F-CLAUDE-PR5F3EA-15 — JSONL line-type discrimination is unspecified, and the bare `inventoryItems` parent line has no stated disposition

- **Where:** plan §4.1, §8.1 `FX-JSONL-001`/`002`, §3.1.
- **Evidence:** Neither frozen bulk document selects `__typename`
  (`app/lib/catalog-facts/admin-read/bulk-query-documents.ts:32-160`), and §5.3 forbids editing
  them. So the mapper must discriminate line types by GID prefix — a rule the plan never states.
  `CATALOG_BULK_QUERY_WITH_UNIT_COST` also emits Collection child lines
  (`collections { edges { node { id title } } }`, `:88`) which `FX-JSONL-001` correctly says must
  not become identity, and `INVENTORY_LEVEL_BULK_QUERY` emits a bare `{"id":"gid://…/InventoryItem/…"}`
  parent line (`:161-163`) whose disposition is not stated (and which interacts directly with
  -03).
- **Impact:** An unstated discrimination rule is invented at implementation time; a
  misclassification writes the wrong fact identity.
- **Correction:** State the GID-prefix discrimination table explicitly, state that Collection lines
  are ignored for identity, and state whether the bare InventoryItem parent line produces an
  observation (see -03).

#### F-CLAUDE-PR5F3EA-16 — Lock-capacity concurrency input is not reconciled with F3's actual canonical-writer fan-out

- **Where:** plan §4.3, §7 R-161, §8.7 `FX-RACE-AW`.
- **Evidence:** `evaluateCanonicalLockCapacity` accepts
  `configuredWorstCaseConcurrentCanonicalTransactions`, defaulting to
  `PR5_DEFAULT_WORST_CASE_CONCURRENT_CANONICAL_TRANSACTIONS = 4`
  (`app/lib/catalog-facts/constants.ts:28`), and condition B is
  `requestedBatch * concurrency <= floor(sharedLockObjectBudget * 0.25)`
  (`app/lib/catalog-facts/lock-capacity.ts:104,120`). F3 introduces several *new* concurrent
  canonical-writer classes simultaneously — JSONL batch applies, per-webhook refetch applies,
  reconcile applies, and the new diagnostic projection-state writer (§3.3) — and the plan never
  states how the configured concurrency is derived from, or bounded by, the dispatcher's actual
  per-shop and global claim budget (`maxPerShop`, `shopCapForFairClaim`,
  `app/sync/fair-claim-query.server.ts:38,59`).
- **Impact:** Race AW evidence would be gathered against a stale concurrency assumption, so R-161's
  "deployment/concurrency evidence" would not actually be evidence.
- **Correction:** Require §4.3 to state the derivation of the worst-case concurrency from the
  dispatcher's configured budget plus the projection writer, and require `FX-RACE-AW` to exercise
  that derived value rather than the default 4.

#### F-CLAUDE-PR5F3EA-17 — Stale current-state assertions are written into durable governance state

- **Where:** plan §0 evidence snapshot; PR #32's edits to `docs/PROJECT_STATUS.md` (new
  "Current truth" bullets for PR #31 / PR #30) and `docs/phases/phase-1/README.md`.
- **Evidence:** See §1.1 above. PR #31's head is `cd3b87e…` (not `1b72a4c…`), its merge-base with
  `main` is `f65ab4b…` (not pre-F2A `5129707…`), and the F2B correction re-review **is** on the
  branch at blob `b01569f…`. The F2C second-correction re-review exists at commit `7015c6e8…`,
  blob `d637a9e…` (not on PR #30's head). §2.2's hard preconditions (1) and (2) are therefore
  already partly satisfied.
- **Impact:** `AGENTS.md` names GitHub the durable handoff and requires evidence-standard accuracy.
  Merging PR #32 as written records a false blocker into `PROJECT_STATUS.md`, which would delay
  the F2B/F2C acceptance decisions that are on the rescue's critical path.
- **Correction:** Refresh §0, §2.2 and the PR #32 `PROJECT_STATUS.md` / `README.md` edits against
  the observed heads and blobs before ChatGPT accepts the packet, and state for F2C that the
  second-correction review exists on a separate review commit rather than on PR #30's head.

---

### P3

| ID | Finding | Correction |
|---|---|---|
| **F-CLAUDE-PR5F3EA-18** | §4.4 leaves `jsonlCommittedLineOrdinal` as "`Int?` **or** `BigInt?`" with no CHECK constraint, no monotonic-non-decreasing guard, and 1-based semantics stated in prose only. | Pin one representation (`Int?` is sufficient; a bulk result exceeding 2^31 lines is not a supported shape) plus `CHECK (>= 1)` and a documented monotonic rule. |
| **F-CLAUDE-PR5F3EA-19** | §4.5 leaves `bulk_operations/finish` as "`CONTROL_ONLY` **or** a continuation of the existing catalog-sync run" — an unresolved design choice. No index is named for the `bulkOperationGid` → `SyncRun` lookup the signal requires. Note `executionStrategyForJobType` fails closed to `NO_AUTOMATIC_RETRY` for any topic not in `WEBHOOK_ATOMIC_TOPICS` (`app/sync/execution-strategy.server.ts:14-36`), so every new topic must be added deliberately. | Choose one strategy; add `@@index([shopId, bulkOperationGid])`; enumerate every new topic's strategy explicitly. |
| **F-CLAUDE-PR5F3EA-20** | §4.5 assigns resource webhooks `ATOMIC_APPLICATION_RECEIPT` but never defines `payloadDigest` for a **refetch**-based application whose applied content is not the webhook body, nor whether a receipt is written when the clock-A decision is a no-op. `applyWithApplicationReceipt` requires the receipt insert to be the final write in the tenant transaction (`app/sync/application-receipt.server.ts:1-9,35`). | State the digest basis (webhook delivery identity + resolved identity set, not the body) and require the receipt on a no-op so replay does not loop. |
| **F-CLAUDE-PR5F3EA-21** | §9.2's `pg_advisory_lock(` search gate does not catch `pg_try_advisory_lock(` or `pg_advisory_lock_shared(`, both session-scoped. | Broaden to `pg_(try_)?advisory_lock(_shared)?\(` while excluding `pg_advisory_xact_lock`. |
| **F-CLAUDE-PR5F3EA-22** | §4.4 says domain watermarks "(`SyncCursor`) advance only when brief §8.5 holds", but `SyncCursor` stores an opaque `cursorValue String @db.VarChar(512)` with no status field (`prisma/schema.prisma`, `model SyncCursor`), and a bulk domain has no Shopify cursor. | State what value represents "full sync succeeded" for a bulk domain and how it is distinguished from "attempted". |
| **F-CLAUDE-PR5F3EA-23** | §4.10 step 5 leaves projection retry as "PR 4 attempt lifecycle **or** dedicated projection continuation"; §4.2 states no poll ceiling; §4.8's freshness target is configurable with no bound. Retry bounds are not frozen enough to prevent unbounded Shopify/queue spend. | Freeze the retry topology and state explicit ceilings. |
| **F-CLAUDE-PR5F3EA-24** | PR #33 (`33a381a…`) edits `docs/PROJECT_STATUS.md`, `docs/README.md` and `docs/phases/phase-1/README.md`; PR #32 edits two of the same files. Whichever merges second conflicts. | Serialize PR #32 and PR #33 explicitly, as §2.2 already does for PR #30 / PR #31. |
| **F-CLAUDE-PR5F3EA-25** | §11 step 5 ("Then PR 6 may be planned. **Not before**") and §13 item 5 ("Do not begin PR 6") forbid PR 6 **planning**, which is broader than the governing rule. `ACCELERATED_SAFE_DELIVERY.md:49` permits planning and research one dependency level ahead, and `:242` permits future-phase planning marked speculative. PR 6 planning / architecture / fixtures are expressly authorized one level ahead under Accelerated Safe Delivery v1. | Correct §11 and §13 to state precisely: **PR 6 runtime, migrations, Shopify configuration and production actions remain forbidden; expressly authorized PR 6 planning / architecture / fixtures one dependency level ahead are permitted and must be marked speculative until PR 6's own gate.** Authorized PR 6 planning is not a governance violation. |

---

## 5. Answers to the mandated red-team targets

### 5.1 JSONL streaming

Parent-before-child is correctly relied upon only as a flatten aid; §3.1's rule that
`__parentId` is not the InventoryLevel uniqueness key is right and is supported by the frozen
document, which selects `item { id }` **and** `location { id }` on the inventory-level node
(`bulk-query-documents.ts:171-176`), so pair identity is self-contained per line and the
skip-without-buffering resume does not break identity. Bounded memory, restart-from-byte-zero, the
no-Range prohibition, and the no-catalog-sized-in-memory-identity-set rule (presence as a column,
nomination as set-based SQL) are all correctly specified and consistent with brief §6.F.6.

Defects: **-01** (no completeness proof), **-10** (parse failure not routed to the partial-bulk
prohibition), **-15** (line-type discrimination unspecified). The 256 MB planning heap ceiling in
§4.1 is a reasonable engineering bound and is not disputed.

### 5.2 BulkOperation identity

Exact persisted GID, `bulkOperation(id:)` polling, the five-concurrent ceiling, `partialDataUrl`
discard, `FAILED`/`CANCELED` prohibition, and new-fence-on-expiry are all correctly specified and
match brief §8.1 / §8.4 and the frozen F2A helpers (`readBulkOperationById`,
`classifyBulkOperationSnapshot`, `parseBulkOperationGid`).

Defects: **-09** (no orphan-operation recovery), **-08** (ordinal not paired to the GID),
**-05** (the submit mutation is not admissible as scoped).

### 5.3 Two-phase checkpoint

The ordering (merchant fact commit first, control-plane acknowledgement second), the
"checkpoint may lag, never lead" invariant, the prohibition on a cross-role transaction, and the
runtime `SyncRun` DML denial are all correct and match brief §6.F.11 and the actual privilege model
(`stocky_control_plane` holds DML on `SyncRun`;
`prisma/migrations/20260804210000_sync_control_plane_correction/migration.sql:288-314`). Both crash
sides are named as mandatory fixtures.

Defects: **-08** (orphan `ingestBatchId` recovery undefined; ordinal/GID pairing undefined),
**-12** (checkpoint can advance over batches that wrote nothing), **-18** (representation).

### 5.4 Canonical batching / lock capacity

The 32-identity default, configurable-downward-only rule, the reader-batch vs apply-batch
separation, never splitting one identity, no unanchored fallback, deterministic ascending
`(key1, key2)` lock order, retry-the-full-algorithm on unique conflict, and no network lock are all
correct and match brief §8.3 / §6.F.2.2, `constants.ts:27`, `lock-capacity.ts`, and `lock-key.ts`.

Defect: **-16** (concurrency input not derived from F3's real fan-out).

### 5.5 Full sync / presence / absence

Omission ≠ delete, post-fence create exemption, partial bulk nominates nothing, READ COMMITTED
set-based sweeps, count **and** proportion breaker, query failure ≠ absence, terminal
non-revival with two non-overlapping confirmations — all correctly carried from brief §6.F.10 /
§6.F.7 / R-144 / R-154 / R-155.

Defects: **-03** (presence-slot ownership across three domains — the most consequential finding in
this section), **-02** (no kill switch on the destructive step), **-01** and **-10** (nomination
gated on an unproven "complete epoch").

### 5.6 Webhook adapter

Body-as-signal-only, the 100-variant product-payload limit, `requestGen` before HTTP and
`responseGen` only after a usable response, delete-as-signal with `ABSENT_CONFIRMED_QUERY`, the
delete-after-live prohibition (Race H), the `{inventory_item_id, location_id}` pair mapping and
reconnectability (Races X / J), refetching all eight quantity names, and removing forecast/ABC from
the canonical path are all correct and match brief §10.3 / §11 / R-158.

Defects: **-13** (the R-165 fence has no mechanical gate on the file that carries it), **-20**
(receipt/digest semantics for a refetch applicator), **-19** (strategy fail-closed default and the
`bulk_operations/finish` "or"). The plan's treatment of R-165 itself is otherwise correct: it
requires the fence, and correctly declines to duplicate the `RISK_REGISTER.md` edit that lands with
F2C.

### 5.7 Inventory reconcile

The non-webhook quantity-name rationale is correct and matches brief §10.4 and R-131 (official
2026-07: `committed`, `reserved`, `damaged`, `safety_stock`, `quality_control` do not trigger
webhooks). Bulk/complete mechanism, no N+1, per-name clock-A anti-rewind, debounce against recent
`inventory_levels/update` refetches, coalescing per shop, and treating 60 minutes as an engineering
test target rather than a merchant SLO are all correct.

Defects: **-11** (fairness asserted, not designed; no poll bound), **-14** (retry topology).
Disabled-shop behavior is covered by RLS (see -12) but the plan should still name the check.

### 5.8 Compatibility projection

Correct: projection called after the canonical transaction commits, on a **new** `TenantDb`;
projection failure cannot roll back canonical facts; live `processingEnabled` read from the control
plane immediately before projection rather than a cached caller boolean (F2C-12); a bounded
`hasMore=true` page must not authorize whole-shop `HEALTHY`; `resumeAfterQuarantineCursor` remains
unusable until durable quarantine exists; orphan legacy rows are not deleted in F3 (R-142).

Defect: **-04** — the false-`HEALTHY` leak is structural, not merely a crash window, and the plan's
own §5.2/§5.3 scope rules forbid both remedies. This is the finding that blocks R-145.
**-07** compounds it: a surviving legacy v1 catalog-sync writes `shopifyVariantCache` outside the
projection entirely while the column reports `HEALTHY`.

### 5.9 Tenancy / role split

Correct and verified against the repository: merchant facts are runtime/RLS with a processing-gated
policy predicate (`scripts/tenant-enforcement/sql.ts:100-126`); `SyncRun`, `SyncCursor`,
`DataIssue`, `SyncHealth` are control-plane with `stocky_control_plane` DML and no runtime grant;
no transaction spans the two roles; uninstall / `processingEnabled` fails closed at the database.
Envelope v3, dispatcher, attempt lifecycle, dead letters, receipts and the D-051 transaction-shape
invariant are correctly preserved with no redesign.

Defects: **-12** (silent zero-row no-op plus an ungated control-plane checkpoint), **-20**
(receipt semantics for refetch applications).

### 5.10 Mutation safety and scanner coverage (review target 10)

**Can R-163 close before F3? No.** The scanner root is `app/lib/catalog-facts`
(`mutation-safety.test.ts:161`). The proposed `app/jobs/workers/catalog-facts/**` is outside it and
was never inside it; scanner coverage **must** expand to a second root, and that expansion needs a
worker-appropriate import policy because the current deny-by-default import rule
(`scan.ts:159-186`) rejects `@shopify/*` and `app/shopify.server`, which any Shopify worker must
import (`webhook-processor.ts:3`). See **-06**.

**Can `bulkOperationRunQuery` be narrowly allowed while inventory/product/transfer writes still
fail closed? Yes in principle, but not as the plan scopes it.**
`assertCanonicalReadDocument` (`graphql-ast.ts:96-116`) rejects every non-query operation with no
exception hook, and `app/lib/catalog-facts/ingest/**` sits inside the scan root, so the submitter
fails CI where §5.1 puts it. Brief §12 already contemplates an explicit later write authorization;
F2A simply did not build the mechanism. The correction in **-05** — an exception keyed on exact
root-field name **and** exact single module path, with negative tests proving it cannot be widened
— preserves the R-138 deny-by-default guarantee for `inventoryBulkToggleActivation`,
`inventoryDeactivate`, `inventorySetQuantities`, `productVariantsBulkUpdate`, transfer and
cost-write surfaces.

### 5.11 R-157..R-165 disposition

Independent disposition. "F3 evidence" means the risk cannot close before F3 runtime exists and is
independently reviewed.

| Risk | Sev | May close at F2B/F2C merge? | Independent disposition |
|---|---|---|---|
| **R-157** | P1 | **No** | Requires F3 evidence. Every F3 allocation path (fence, direct start/end gens) must use `SELECT nextval(…)`; `setval` denial regressions AD/AE/AF/AG must re-run against F3 code. Plan §7 is correct. |
| **R-158** | P1 | **No** | Requires F3 evidence. Interval allocation across the *real* refetch adapters, plus AH/AJ/AL through adapters rather than synthetic observations. Plan §7 is correct. |
| **R-159** | P2 | **No** | Requires F3 evidence. Worker hard-crash after `ACTIVE` in-flight commit and before apply; F3 must not add a reaper that deletes in-flight rows as a correctness path. Plan §7 is correct. |
| **R-160** | P1 | **No** | Requires F3 evidence. The plan's list of F3 writers is incomplete: it must explicitly include the **new diagnostic projection-state writer** (§3.3) and the **absence nomination/confirmation writer** (§4.7) among the writers that must use the frozen derivation. Amend §7's R-160 row. |
| **R-161** | P2 | **No** | Requires F3 evidence **and** the corrected concurrency derivation in **-16**. Race AW against disposable PostgreSQL with live settings. |
| **R-162** | P3 | **Eligible after F2B merge + F3 consumption proof**, as the plan states. Accepted. |
| **R-163** | P3 | **No — and not by F2A merge alone.** Requires the two-root scanner in **-06** plus a Race-AC plant inside `app/jobs/workers/catalog-facts/`. The plan's own §7 wording ("must **remain** inside the recursive scan") is factually wrong and must be corrected. |
| **R-164** | P3 | **No** | Requires F3 evidence that no ingest/worker/diagnostic path calls `delete`/`deleteMany` on canonical facts. Plan §7 is correct. |
| **R-165** | P2 | **No** | Register text lands on `main` with the F2C merge (verified absent from `main`'s `RISK_REGISTER.md`). Closure requires the F3 webhook fence **and**, per **-13**, a mechanical gate scoped to `webhook-processor.ts` rather than to the F3 trees. Plan §7 is otherwise correct, including its instruction not to duplicate the register edit in this planning PR. |

Related risks the plan correctly advances without closing (R-132, R-134, R-136, R-138, R-142,
R-143, R-145, R-146, R-147, R-154, R-155, R-156) are accepted as stated, subject to **-04** for
R-145, **-07** for R-134/R-142, and **-01**/**-02** for R-144/R-154/R-155.

### 5.12 PR 6 governance

The correct statement is: **PR 6 runtime is blocked; expressly authorized PR 6 planning /
architecture / fixtures one dependency level ahead are permitted** under
`ACCELERATED_SAFE_DELIVERY.md:49` and `:242`. The packet's §11 step 5 and §13 item 5 are broader
than the governing document and would wrongly classify authorized PR 6 planning as a violation.
Recorded as **F-CLAUDE-PR5F3EA-25** (P3). No PR 6 runtime, migration, Shopify configuration or
production action is authorized by anything in this review.

### 5.13 Implementation ambiguities Cursor would otherwise invent

Consolidated list of decisions the packet leaves to implementation. Each is either a numbered
finding above or is listed here for completeness.

1. `jsonlCommittedLineOrdinal` representation, constraints and monotonicity — **-18**.
2. Ordinal ↔ `bulkOperationGid` pairing and reset on a replacement operation — **-08**.
3. `ingestBatchId` derivation and uniqueness; whether orphan-batch recognition is real — **-08**.
4. Which transaction writes `compatibilityProjectionState`, and how a not-yet-projected state is
   representable at all given the two-value enum — **-04**.
5. How whole-shop `HEALTHY` is proven from bounded projection pages — partly addressed by §3.3/§4.10
   step 4, but the identity-set/generation bookkeeping is unstated.
6. Absence breaker threshold sourcing and configuration surface — the plan inherits the brief's
   250 / 2 % hypothesis but names no configuration location, no per-domain override, and no
   operator control — see **-02**.
7. Retry bounds: bulk poll ceiling, projection retry topology, reconcile freshness bound — **-23**.
8. Worker deadlock/starvation: intra-shop webhook starvation and claim-slot occupancy during long
   polls — **-11**.
9. Three-`SyncRun` domain topology and completion/retry semantics — **-14**.
10. Whether `catalog-sync-v1` can still write a competing authority — **it can**; see **-07**.
11. Whether R-165 is fenced on every live canonical inventory path — the webhook path is named, but
    the gate that would keep it fenced does not cover the file — **-13**.
12. JSONL line-type discrimination without `__typename` — **-15**.
13. `bulk_operations/finish` execution strategy and GID→`SyncRun` lookup — **-19**.
14. `payloadDigest` for refetch-based webhook applications — **-20**.
15. `SyncCursor.cursorValue` semantics for bulk domains — **-22**.
16. Domain ownership of `lastSeenFullSyncRunId` and of nomination — **-03**.
17. Worst-case canonical concurrency derivation for the capacity evaluator — **-16**.

---

## 6. What the packet gets right

Recorded so ChatGPT can scope the correction package rather than reopen settled work.

- §1.3's current-`main` defect inventory is accurate line for line (verified in §2.1 above).
- §3.1–§3.4's statement of the frozen F1/F2A/F2B/F2C interfaces matches the actual code, including
  the `readBulkOperationById` / persisted-GID contract, the `applyCanonicalFacts` /
  `applyCanonicalFactsWithRetry` surface, the `direct` vs `full_sync` observation kinds, the
  `LIVE_FULL_SYNC_PRESENT` NULL/NULL existence-generation shape, and F2C's
  `projectCompatibilityFromCanonicalFacts` signature and separate-`TenantDb` requirement.
- The two-phase checkpoint, fence-before-I/O, no-lock-across-HTTP, presence-independent-of-attribute
  no-op, candidate-plus-confirmation absence model, and terminal non-revival rules are transcribed
  faithfully from the approved brief with no product-rule drift.
- The rejected-split table in §2.1 is substantively correct (see §3.1).
- The fixture map in §8 is unusually good: it is specific, mostly falsifiable, and maps to named
  races. The gaps are additions, not rewrites.
- §9's acceptance commands correctly require nonzero collected tests and treat a `0 passed` focused
  step as a failure.
- §12's explicit non-authorization list is complete and correct.
- The packet does not claim PR 5 complete, does not close any risk, does not create D-055, does not
  merge anything, and does not authorize F3 runtime. Governance discipline is intact apart from
  **-17** and **-25**.

---

## 7. Required corrections before F3 runtime authorization

Blocking (P1) — all eight must be resolved in the packet before ChatGPT authorizes F3 runtime:

1. **-01** Define and require a mechanical completeness proof for a streamed JSONL epoch
   (`objectCount` / `rootObjectCount` reconciliation) as a precondition of any nomination.
2. **-02** Add a default-OFF, runtime-disable-able capability gating absence confirmation and
   tombstone writing; use it to make §2.3's internal commit order safe.
3. **-03** Specify fact-type → owning-domain presence and nomination scope across the three
   full-sync domains; resolve the `ShopifyInventoryItemFact` double-observation.
4. **-04** Choose and authorize a remedy for the projection-state default so a canonical fact is
   never readable as projection-`HEALTHY` before a successful projection; amend §5.2/§5.3 to permit
   it.
5. **-05** Authorize a named, exact-name-and-exact-path mutation exception inside the F2A scanner
   for `bulkOperationRunQuery`, with negative tests proving it cannot be widened.
6. **-06** Specify the two-root scanner design covering `app/jobs/workers/catalog-facts/**` with a
   worker-appropriate import policy; correct §7's R-163 row.
7. **-07** Add `app/services/{shopify-sync,shopify-gql}.server.ts` to §5.2 and require v1
   catalog-sync to fail closed, with a stated drain/disposition for pre-existing v1 durable jobs,
   replays and dead letters.
8. **-08** Specify the ordinal ↔ GID pairing and reset rule, and either specify a deterministic
   `ingestBatchId` (authorizing the index it needs) or delete the orphan-recognition claim.

Also required before F3 acceptance (P2): **-09** through **-17**. **-17** should be corrected
before ChatGPT accepts PR #32 itself, since PR #32 writes the stale assertions into
`PROJECT_STATUS.md`.

P3 items **-18** through **-25** are recorded for the same correction package where practical;
**-25** should be corrected in PR #32 because it currently misstates governance.

---

## 8. Finding counts

| Severity | Count |
|---|---|
| **P0** | **0** |
| **P1** | **8** (-01 … -08) |
| **P2** | **9** (-09 … -17) |
| **P3** | **8** (-18 … -25) |
| **Total** | **25** |

Approval of an early Tier-A architecture contract requires P0 = 0, P1 = 0, P2 = 0. Eight P1 and
nine P2 architecture defects remain unresolved.

---

## 9. Verdict

**CORRECTIONS REQUIRED**

The lane recommendation itself is sound: **one** PR5-F3 integration PR after F2B then F2C merge is
upheld, and no split is proposed. The overlap argument survived falsification, and a JSONL-first
split would be materially less safe because it would place terminal-tombstone capability on `main`
without the webhook overlap protections that prevent it.

The contract as written is not yet safe to implement against. Eight P1 architecture defects stand,
of which four are self-contradictions inside the packet's own scope rules (**-04**, **-05**,
**-06**, **-07**): the plan requires outcomes that its §5.2 allowlist and §5.3 freeze forbid
Cursor from producing. Those would surface as either a CI-blocked lane or a silent boundary
violation during a rescue week, which is the worst time to discover them. The remaining four
(**-01**, **-02**, **-03**, **-08**) each admit a path to unrecoverable loss of live merchant
catalog identities, and all four are cheap to close in the document now and expensive to close
after runtime exists.

This is an early architecture verdict on planning head `b886bb56…`. It is not F3 acceptance, not
F2B or F2C acceptance, not PR 5 closure, and not authorization to begin F3 runtime. The mandatory
final exact-head independent review of F3 remains required.

---

## 10. Review artifact identity

| Item | Value |
|---|---|
| Artifact | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_INDEPENDENT_REVIEW.md` |
| Reviewed planning SHA | `b886bb562a0f77cfb9a8964e24b9a348b310514a` |
| Review branch base | `b886bb562a0f77cfb9a8964e24b9a348b310514a` (the exact reviewed planning head) |
| Review branch | `claude/stocky-pr5-tier-a-review-k2560t` (session-designated Claude review branch; see note) |
| Files changed by this review | this file only |

**Branch-base note.** The reviewing prompt asked for a **new** Claude review branch based on the
exact reviewed planning head. This session is bound to the designated Claude review branch
`claude/stocky-pr5-tier-a-review-k2560t` and is not permitted to push to a different branch name.
The branch was therefore reset from `f65ab4b…` (it carried no unique commits) to the exact reviewed
planning head `b886bb56…`, and this artifact is committed on top. The requested base is honored
exactly; only the branch **name** differs from "new". PR #32 was not pushed to and was not modified.

This artifact is **immutable**. Do not edit it. Corrections are recorded in a separate
re-review artifact.
