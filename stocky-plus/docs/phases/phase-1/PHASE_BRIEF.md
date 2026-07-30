# Phase 1 Brief — Tenant-Safe Shopify Fact Foundation

**Status:** DRAFT — IMPLEMENTATION NOT AUTHORIZED
**Product owner:** ChatGPT
**Implementation owner:** Cursor
**Independent reviewer:** Claude Code
**Planning base:** `main` at Phase 0 closure merge `8e4f757c4717baba0ece74135b062324ff429ee6`

> This brief does not authorize implementation while its status is `DRAFT`.
>
> Phase 1 implementation may begin only after:
>
> 1. ChatGPT explicitly approves the final brief;
> 2. the documentation-only Phase 1 planning pull request is independently reviewed;
> 3. that planning pull request is merged into `main`;
> 4. Cursor starts the first approved implementation PR from the updated `main`.
>
> No inventory-write flag is approved for enablement by this brief.

## Goal

Establish a database-enforced, Shopify-authoritative, observable, privacy-compliant multi-tenant fact foundation that later Stocky-parity workflows can safely depend on, without enabling inventory writes or implementing operational inventory features.

## Why this phase exists

The current application has useful Shopify and inventory-management scaffolding, but its data model and synchronization architecture are not safe enough to support commercial multi-merchant inventory operations.

Merchant ownership is currently represented primarily through application-level string shop filters. Important child records do not directly carry tenant ownership, and the database does not independently prevent an omitted filter from exposing or modifying another shop’s valid row.

The application also lacks complete Shopify-authoritative catalog, location, order, line, refund, and inventory facts; durable synchronization health; dead-letter and replay behavior; complete privacy processing; and production-scale reconciliation.

Forecasting, purchasing, receiving, stocktake, transfer, cost, reporting, billing, and AI work must not be built on the current incomplete foundation.

## Approved source documents

Read and follow, in order:

1. `AGENTS.md`
2. `stocky-plus/docs/README.md`
3. `stocky-plus/docs/PROJECT_STATUS.md`
4. `stocky-plus/docs/product/00_READ_ME_FIRST.md`
5. Complete approved product-document sequence
6. `stocky-plus/docs/product/11_PRICING_AND_PACKAGING_STRATEGY.md`
7. `stocky-plus/docs/phases/README.md`
8. `stocky-plus/docs/phases/phase-0/`
9. `stocky-plus/docs/PHASE_1_TECHNICAL_PLAN.md`
10. `stocky-plus/docs/DECISIONS.md`
11. `stocky-plus/docs/OPEN_QUESTIONS.md`
12. `stocky-plus/docs/RISK_REGISTER.md`
13. This brief and all Phase 1 planning-review records

Approved product documents take precedence over legacy runtime behavior and the older Phase 1 technical plan.

## Phase 1 boundaries

### In scope

#### Tenant identity and database enforcement

* Add a canonical `Shop` entity with a stable internal ID and normalized unique Shopify shop domain.
* Add direct `shopId` ownership to every existing and new merchant-owned table.
* Add tenant-composite unique keys and foreign keys to all merchant-owned relationships.
* Add a tenant-bound database access contract for web requests, workers, jobs, exports, privacy actions, and reconciliation.
* Separate database migration and runtime roles.
* Enable and force PostgreSQL Row-Level Security on approved merchant-domain tables.
* Default-deny database access when tenant context is absent.
* Create a restricted bootstrap path for Shopify session access and resolving `Shop` before tenant context exists.
* Add real PostgreSQL cross-shop and pooled-connection isolation tests.

#### Shopify-authoritative fact models

* Shopify locations.
* Products and variants.
* Inventory items and location inventory states.
* Order facts.
* Order-line facts.
* Refund, cancellation, and order-adjustment facts.
* Historical identity snapshots and deletion/tombstone state.
* Shopify source timestamps, watermarks, lineage, and freshness.

#### Decimal-safe Phase 1 money facts

* Every Shopify monetary amount entering a Phase 1 order, order-line, adjustment, cancellation, or refund fact must be consumed from its exact source representation.
* Monetary values must be stored and computed using an exact decimal representation suitable for Shopify money values.
* Currency code must be recorded with every monetary value or monetary fact where currency is not unambiguously inherited.
* JavaScript `Number`, floating-point arithmetic, `parseFloat`, and equivalent lossy conversions must not be used for money.
* Database persistence must use an exact decimal/numeric type or an explicitly approved exact representation.
* Values must not be silently rounded to two decimal places because currencies and Shopify source values may require different precision.
* Normalization and rounding rules must be explicit, deterministic, tested, and traceable to the source currency and Shopify value.
* Duplicate, edit, cancellation, partial-refund, and full-refund processing must remain exactly reconcilable to Shopify-reported amounts.
* Phase 1 must preserve enough source lineage to reverify the original Shopify amount.

#### Synchronization control plane

* Persistent webhook inbox or delivery record.
* Persistent idempotency and correlation IDs.
* Sync runs and cursors.
* Job attempts and dead letters.
* Replay and repair workflows.
* Reconciliation runs and data issues.
* Initial and incremental synchronization.
* Shopify API throttling, pagination, retry, and partial-failure handling.
* Data-health status and operational diagnostics.
* Queue shutdown and job denial after uninstall.

#### Platform governance

* Immutable audit-event foundation for Phase 1 platform and synchronization actions.
* Shopify-user identity and role-assignment scaffold.
* Server-side Phase 1 platform permission checks.
* Real `customers/data_request`, `customers/redact`, and `shop/redact` processing.
* Structured logs, metrics, timing, queue depth, failure counts, and reconciliation measurements.
* Commercial-scale load and query-plan baselines.

### Out of scope

* Forecasting formulas or Smart Forecasting.
* ABC/U.
* Buying Table or replenishment redesign.
* Supplier workflow expansion beyond tenant ownership.
* Purchase-order lifecycle redesign.
* Receiving or receipt ledgers.
* Inventory adjustments.
* Stocktake implementation.
* Transfer implementation.
* Cost ledgers or Shopify cost sync.
* Billing implementation.
* Entitlement enforcement or usage metering.
* AI data models or AI functionality.
* POS extensions.
* Scanning or labels.
* Shopify Flow.
* Report-suite implementation.
* Accounting integrations.
* Production inventory writes.
* Enabling any inventory-write flag.
* Destructive removal of existing tables, records, or legacy `shop` columns.
* Broad merchant-facing UI redesign.

Existing operational routes may be migrated to the tenant access contract, but their product behavior must not be expanded.

## Approved tenant-isolation architecture

Phase 1 must implement both relational tenant integrity and row-level access enforcement.

### Canonical ownership

* `Shop.id` is the internal tenant authority.
* The normalized Shopify `myshopify.com` domain is a unique external identity.
* Every merchant-owned row has non-null `shopId`.
* Every parent table exposes a composite unique key containing `shopId` and its record ID.
* Every child foreign key includes `shopId`.
* Cross-domain relations also include tenant ownership.
* Tenant-specific indexes and business unique constraints begin with `shopId`.

### Database enforcement

* PostgreSQL Row-Level Security is enabled and forced on every approved merchant-domain table.
* The runtime role does not own the tables and has no `BYPASSRLS`.
* The runtime role cannot change policies or execute migrations.
* The migration role is separate and unavailable to web and worker processes.
* Missing tenant context is default-deny.
* Tenant context is transaction-local and established before any merchant-domain query.
* Direct unrestricted Prisma or raw SQL access to merchant-domain tables is prohibited.
* RLS policies must include appropriate `USING` and `WITH CHECK` behavior.
* An INSERT may set `shopId` only to the current transaction tenant.
* An UPDATE may not change `shopId`.
* Database-level enforcement must reject an attempted tenant-key mutation even if application validation is missing or bypassed.
* Application code must not expose `shopId` as an ordinary mutable update field.
* The final implementation design must use a database-enforced immutability mechanism in addition to ordinary application validation. The implementation report must identify the exact mechanism used.
* RLS `WITH CHECK` alone is not a substitute for proving tenant-key immutability under every relevant operation.

### Tenant immutability

* `shopId` is assigned when a merchant-owned row is created and is immutable afterward.
* No application route, worker, job, export, privacy process, reconciliation process, raw SQL path, or database role may reassign an existing row to another tenant.

### Tenant authority derivation

* Tenant authority for an authenticated web request derives only from server-side verified Shopify authentication and the canonical Shop resolved from that authenticated identity.
* Query parameters, form values, route parameters, request JSON, browser storage, client headers, and other client-supplied shop identifiers must never establish tenant authority.
* Client-supplied identifiers may be treated only as untrusted lookup input after authorization and must still be constrained by database tenant enforcement.
* Tenant authority for background work derives only from a server-created, persisted, validated, versioned job or event envelope.
* A job envelope must include canonical `shopId`, source, correlation or causation identity, schema version, and sufficient integrity validation.
* Workers must resolve and validate the Shop before establishing transaction-local tenant context.
* A raw queue payload, Shopify domain string, external ID, or client-created job message is insufficient authority by itself.
* Invalid, missing, disabled, uninstalled, redacted, or mismatched tenant envelopes fail closed.
* Queue replay must preserve validated tenant authority and audit lineage.

### Bootstrap exception

* Shopify session storage and minimal Shop lookup require access before tenant context exists.
* That access is isolated in a small bootstrap module.
* Bootstrap access cannot query merchant-domain tables.
* Session records may not become a general tenancy bypass.

Composite tenant foreign keys without Row-Level Security do not satisfy F-016 / R-022.

## Shopify authority rules

Shopify is authoritative for:

* shops;
* locations;
* products;
* variants;
* inventory items;
* sellable inventory states;
* orders;
* order edits and cancellations;
* refunds.

The application stores synchronized facts, snapshots, lineage, reconciliation results, and platform audit information.

Phase 1 does not mutate Shopify inventory.

Webhooks are notifications and may be duplicated, delayed, delivered out of order, or missed. Initial synchronization and periodic reconciliation remain required.

No sync run is successful until extraction, database application, watermarks, and reconciliation status are recorded.

Every discrepancy must be repaired or surfaced. It may not be silently ignored.

## Migration and backfill requirements

* Additive migrations only.
* Do not modify the original migration.
* Preserve existing `shop` columns throughout Phase 1.
* Add nullable ownership first.
* Create `Shop` rows from normalized, verified existing shop domains.
* Backfill parent ownership from existing shop values.
* Backfill children from their verified parents.
* Validate PO-to-supplier and all other cross-domain ownership.
* Quarantine inconsistent rows; never guess ownership.
* Backfills must be resumable, idempotent, batched, and checkpointed.
* Record before counts, updated counts, unresolved counts, and checksums.
* Enforce non-null ownership only after unresolved count is zero.
* Convert all runtime data access before activating RLS.
* Test on an empty database, a current-schema fixture, and a production-like restored database.
* No migration may delete operational history.

### Lock-conscious constraint rollout

* Large-table constraints must use low-lock expansion and validation patterns.
* Supporting indexes must be created using `CREATE INDEX CONCURRENTLY` where PostgreSQL permits it.
* Concurrent index creation must not be placed inside a transaction that PostgreSQL does not permit.
* Foreign keys and applicable check constraints must initially be added as `NOT VALID`, then validated separately after data verification.
* Non-null enforcement on populated tables must use a validated check-constraint approach or an equivalently proven low-lock method before final `SET NOT NULL`.
* Every migration affecting populated tables must set explicit `lock_timeout` and `statement_timeout` values appropriate to the operation.
* Lock timeout must cause a safe abort and retry; it must not be bypassed by raising the timeout indefinitely.
* The migration runbook must state the expected lock level and maximum expected lock-hold duration for every table-altering step.
* Constraint validation and index construction must be separated into reviewable and recoverable steps where needed.
* Production rollout must include monitoring for blocked queries, waiting locks, deadlocks, replication lag, transaction age, and error rates.
* A failed low-lock rollout must leave existing data and application behavior intact and fail closed.
* No constraint-enforcement step may proceed while unresolved ownership quarantine is non-zero.

### Ownership quarantine resolution

* Every quarantined row must include table, row identity, current ownership evidence, conflicting ownership evidence, parent lineage, source shop values, reason code, detection run, and status.
* A non-empty quarantine blocks non-null enforcement, composite tenant constraints, and RLS activation for the affected domain.
* Cursor and implementation agents must not guess ownership to meet a schedule.
* Automated repair is permitted only where a deterministic rule is approved in the Phase 1 brief or a later explicit ChatGPT decision and is supported by auditable evidence.
* Ambiguous rows require a written repair proposal and product-owner escalation.
* Manual repair requires documented evidence, reviewer identity, before-and-after values, and an audit record.
* Irrecoverable or intentionally excluded rows require an explicit product-owner disposition; silent deletion is prohibited.
* After repair, all ownership checks, counts, checksums, and cross-domain validations must be rerun.
* PR 3 cannot begin enforcement for an affected domain until unresolved count is zero and the resolution report is reviewed.
* Schedule pressure is not authority to infer, share, delete, or fabricate tenant ownership.

## Rollback and recovery requirements

* Expansion migrations remain compatible with legacy shop columns.
* RLS enforcement may roll back only to a tenant-aware application release.
* The pre-Phase-1 application is not an acceptable rollback target after RLS activation.
* Any emergency policy disablement requires explicit incident authorization and a documented recovery path.
* Backups must be restored and verified before production migration approval.
* Interrupted backfills must resume safely.
* Failed validation must leave data intact and the system fail-closed.
* Migration, rollback, and forward-recovery runbooks are mandatory deliverables.

## Privacy decision

* Do not store unnecessary customer PII in order or line facts.
* On uninstall, disable the shop and its jobs immediately and delete sessions and access tokens.
* On `shop/redact`, erase tenant operational data, caches, exports, queue payloads, and storage objects.
* Preserve only a non-reversible deletion receipt and records that legal counsel confirms must be retained.
* Legally retained records must be minimized, segregated, inaccessible to normal application workflows, and covered by an explicit retention rule.
* Every privacy process is idempotent, auditable, retryable, and backed by a deletion manifest.
* Final policy requires legal review before production release.

## Distribution and environment decision

The intended production application uses public Shopify App Store distribution.

Development, staging/pilot, and production must use separate Shopify app registrations or explicitly isolated linked configurations, credentials, databases, Redis, storage, callback URLs, and webhook destinations.

Partner Dashboard app IDs and actual distribution selections must be verified before any deployment work.

## Trial and development-plan decision

The working commercial hypothesis remains:

* 14-day Growth-equivalent trial;
* private $0 development test plan.

Phase 1 does not implement billing, plans, entitlements, or commercial usage limits.

A future development test plan must be non-production-only, limited to approved development/test stores, unavailable to ordinary merchants, and incapable of bypassing tenancy, permissions, or inventory-write gates.

## API-version requirement

The planning PR does not change the Shopify API version.

Before the first Phase 1 sync implementation merges:

* validate Phase 1 GraphQL documents and webhook fixtures against the current stable Shopify Admin API;
* approve and record the selected version;
* avoid building the new sync foundation on an API version close to retirement;
* keep every inventory mutation excluded.

## Dependency-ordered implementation PRs

### PR 1 — Tenant expansion and backfill

Proposed branch:

`phase-1/tenant-expand`

* Add Shop.
* Add nullable `shopId` ownership.
* Add migration and backfill journal.
* Add compatibility indexes.
* Add consistency diagnostics.
* Produce an ownership-quarantine report for every inconsistent row and domain.
* Preserve legacy `shop` fields.
* No RLS activation.

### PR 2 — Tenant-bound access conversion

Proposed branch:

`phase-1/tenant-access`

* Add tenant-bound database transaction and access contract.
* Derive authenticated web-request tenant authority only from server-side verified Shopify authentication and the canonical Shop.
* Explicitly deny client-supplied shop identifiers as tenant authority.
* Convert all current routes, services, workers, jobs, exports, and reconciliation code that accesses merchant-owned data.
* Add restricted bootstrap access.
* Do not change product behavior.
* The implementation report must contain a mechanically generated or otherwise complete inventory of all direct Prisma-client access; every route, service, worker, job, export, privacy processor, reconciliation path, script, and raw SQL path that accesses merchant-owned data; old access method; new tenant-bound access method; conversion status; test evidence; and any approved exception with justification.
* An automated check or equivalent enforceable verification must prove: no unapproved direct global Prisma access to merchant-domain tables remains; no raw SQL merchant-domain access occurs outside approved tenant-bound modules; bootstrap modules access only explicitly approved bootstrap tables; and new violations fail CI.
* PR 2 must not be accepted based only on a narrative claim that access was converted.

### PR 3 — Database enforcement

Proposed branch:

`phase-1/tenant-enforcement`

Entry gate: an accepted zero-unresolved ownership-quarantine report for each domain being enforced.

* Enforce non-null tenant ownership after verified backfill.
* Add composite tenant foreign keys.
* Add runtime and migration roles.
* Enable and force RLS, including `USING` and `WITH CHECK` behavior and database-enforced tenant-key immutability.
* Perform low-lock constraint and index rollout.
* Set explicit `lock_timeout` and `statement_timeout` values with safe abort-and-retry behavior.
* Add production-like lock testing and evidence of maximum observed lock duration.
* Validate that concurrent representative reads and writes are not blocked beyond the approved threshold.
* Add real PostgreSQL isolation tests.
* Verify pooled connections do not leak tenant context.

No later Phase 1 implementation PR may begin until this PR is independently reviewed, accepted by ChatGPT, and merged.

### PR 4 — Synchronization control plane

Proposed branch:

`phase-1/sync-control-plane`

* Persistent webhook inbox.
* Sync runs and cursors.
* Job attempts, dead letters, replay, and correlation.
* Validated job-envelope creation, persistence, replay, and rejection.
* Data issues and reconciliation records.
* Uninstall job shutdown.
* Sync-health states.

### PR 5 — Catalog, location, and inventory facts

Proposed branch:

`phase-1/catalog-location-inventory-facts`

* Canonical Shopify read models.
* Complete pagination.
* Streaming and batched bulk ingest.
* Deletion and historical identity handling.
* Shopify inventory-state ingestion only.
* No Shopify inventory mutation.

### PR 6 — Order and refund facts

Proposed branch:

`phase-1/order-refund-facts`

* Order facts.
* Order-line facts.
* Edits, cancellations, and refunds.
* Decimal-safe order and refund facts.
* Exact net amount handling.
* Currency preservation.
* No floating-point monetary arithmetic.
* Exact reconciliation to Shopify-reported values.
* No unnecessary customer PII.
* Backfill and reconciliation.

### PR 7 — Audit, roles, and privacy

Proposed branch:

`phase-1/audit-roles-privacy`

* Immutable audit events.
* Shopify-user and role-assignment scaffold.
* Phase 1 platform permission checks.
* Data request and redaction processing.
* Privacy deletion manifests.

### PR 8 — Reconciliation, performance, and exit

Proposed branch:

`phase-1/reconciliation-performance-exit`

* Cross-domain reconciliation.
* Load and query-plan evidence.
* Recovery rehearsal.
* Support diagnostics.
* Final implementation and review reports.
* Project status, decision, risk, and open-question updates.

Each PR:

* starts from updated `main`;
* contains only its approved scope;
* requires passing CI;
* requires independent Claude review;
* requires ChatGPT acceptance;
* must not be merged without explicit user authorization.

## Required tests

### Database isolation

* Real PostgreSQL runtime-role tests.
* Cross-shop select, insert, update, and delete denial.
* Composite tenant foreign-key denial.
* Missing-context default denial.
* Raw SQL denial.
* Runtime-role privilege verification.
* Concurrent-shop and pooled-connection leakage tests.
* Bootstrap-module boundary tests.
* Shop A attempting to change its own row’s `shopId` to Shop B.
* Shop A attempting to change its own row’s `shopId` to any other value.
* Insertion with a foreign `shopId`.
* Raw SQL tenant reassignment.
* Reassignment through a worker or job.
* Reassignment through a generic update helper.
* Valid non-tenant field updates remaining allowed.
* Distinct isolation coverage for web requests.
* Distinct isolation coverage for asynchronous workers.
* Distinct isolation coverage for queued jobs.
* Distinct isolation coverage for exports.
* Distinct isolation coverage for privacy jobs.
* Distinct isolation coverage for reconciliation jobs.
* Distinct isolation coverage for replay and repair jobs.
* Distinct isolation coverage for scheduled synchronization.
* Concurrent jobs for different shops.
* For each non-request path: validated tenant context established before merchant-domain access; missing context denied; foreign context denied; pooled connections do not retain a previous tenant; raw SQL cannot bypass the same policy.
* Client-supplied shop query parameter cannot establish tenant authority.
* Client-supplied shop header cannot establish tenant authority.
* Client-supplied JSON shop field cannot establish tenant authority.
* Mismatch between authenticated shop and supplied shop is denied.
* Missing job tenant is denied.
* Disabled or uninstalled shop is denied.
* Tampered or mismatched job envelope is denied.
* Replay preserves validated tenant authority.
* Worker denial before tenant validation.

### Migration

* Empty database.
* Current-schema database.
* Multiple shops with overlapping external IDs.
* Inconsistent parent-child ownership.
* Interrupted and resumed backfill.
* Repeated idempotent backfill.
* Failed constraint validation.
* Backup restoration.
* Compatible rollback and forward recovery.
* A dataset at the approved engineering envelope.
* Concurrent representative reads and writes during index and constraint rollout.
* Measurement of lock acquisition and lock-hold duration.
* Failure on exceeding the documented lock-duration threshold.
* Safe timeout, retry, and resume.
* No prolonged `ACCESS EXCLUSIVE` blocking caused by naive full-table validation.

### Synchronization

* Duplicate and delayed webhooks.
* A duplicate webhook arriving after the temporary queue deduplication or retention window has expired, proving persistent database-backed idempotency prevents duplicate application.
* Durable idempotency-record retention is long enough for the approved replay and reconciliation policy.
* A legitimate distinct event is not incorrectly rejected.
* Replay remains auditable.
* Out-of-order webhooks.
* Missed-webhook reconciliation.
* Initial sync overlap with webhook processing.
* Partial bulk failure.
* Shopify throttling.
* Dead-letter replay.
* Product and variant deletion or recreation.
* More than 50 locations and 250 variants.
* Order edit, cancellation, partial refund, and duplicate refund.
* Uninstall while work is queued.

### Money precision

* Decimal values that cannot be represented exactly as binary floating point.
* Order totals.
* Multiple line amounts.
* Order edits.
* Partial refunds.
* Multiple partial refunds.
* Duplicate refunds.
* Cancellations.
* Currencies with differing decimal conventions.
* Exact equality with Shopify-reported source amounts.
* No conversion through JavaScript `Number`.

### Privacy

* Immediate uninstall shutdown.
* Session and token deletion.
* Customer data request.
* Customer redaction.
* Shop redaction.
* Partial deletion retry.
* Reinstall before and after redaction.
* No customer PII in operational facts or logs.
* Legal-retention exception isolation.

### Performance

Engineering test envelope:

* 50,000 active variants;
* 15 locations;
* 750,000 variant-location states;
* 1,000,000 order-line facts;
* concurrent processing for multiple shops.

Required outcomes:

* no silent hard caps;
* no N+1 Shopify or database processing;
* bounded-memory bulk ingestion;
* query-count assertions;
* indexed tenant query plans;
* documented p50 and p95 measurements on a named environment;
* data-health and indexed list queries target p95 below 500 milliseconds;
* durable webhook enqueue targets p95 below one second.

## Required commands

Existing required commands:

```text
npm ci
npx prisma generate
npx prisma validate
npx prisma migrate deploy
npm run lint
npm run typecheck
npm test
npm run build
npm run graphql-codegen
```

Phase 1 must add dedicated commands equivalent to:

```text
npm run test:db-isolation
npm run test:migrations
npm run test:sync-integration
npm run test:privacy
npm run test:performance
```

CI must test with:

* PostgreSQL migration-owner role;
* restricted PostgreSQL runtime role;
* Redis;
* all inventory-write flags false.

## Deliverables

* Additive Prisma and SQL migrations.
* Backfill and migration-verification tooling.
* Tenant-bound data-access layer.
* Database roles and RLS policies.
* Canonical Shopify fact models.
* Synchronization control-plane records.
* Reconciliation and data-health services.
* Audit-event foundation.
* Role-assignment scaffold.
* Privacy processors.
* Tests and performance evidence.
* Migration, rollback, recovery, privacy, and reconciliation runbooks.
* One `IMPLEMENTATION_REPORT.md` or focused report per implementation PR.
* Independent review report for every implementation PR.
* Updated:

  * `PROJECT_STATUS.md`;
  * `DECISIONS.md`;
  * `OPEN_QUESTIONS.md`;
  * `RISK_REGISTER.md`;
  * Phase 1 README and phase records.

## Phase 1 exit criteria

* [ ] Every merchant-owned existing and new row has verified non-null `shopId`.
* [ ] No unresolved or guessed tenant ownership remains.
* [ ] Composite tenant foreign keys protect every merchant-owned relationship.
* [ ] RLS is enabled and forced on every approved merchant-domain table.
* [ ] Runtime role is non-owner and has no `BYPASSRLS`.
* [ ] Real PostgreSQL and pooled-connection isolation tests pass.
* [ ] No current domain access bypasses the tenant contract.
* [ ] Catalog, location, inventory-state, order, line, cancellation, and refund facts reconcile to Shopify.
* [ ] Discrepancies are repaired or visible.
* [ ] Webhook intake, replay, dead letters, and reconciliation are durable.
* [ ] Uninstall disables tenant processing immediately.
* [ ] Compliance webhooks perform real tested actions.
* [ ] No unnecessary customer PII is stored.
* [ ] Load tests pass without hidden truncation or N+1 behavior.
* [ ] All required CI commands pass on exact reviewed heads.
* [ ] Inventory-write flags remain default OFF.
* [ ] Production inventory writes remain unapproved.
* [ ] No forecasting, ABC, PO, receiving, stocktake, transfer, cost, billing, or AI implementation has started.
* [ ] Project status, decisions, risks, questions, implementation evidence, and reviews are current.
* [ ] Claude returns `READY FOR PHASE 2 PLANNING` with no open P0 or P1 finding.
* [ ] ChatGPT accepts the Phase 1 review.
* [ ] User explicitly authorizes final merge and Phase 1 closure.

Phase 1 completion authorizes Phase 2 planning only.

### Exit verdict definition — `READY FOR PHASE 2 PLANNING`

`READY FOR PHASE 2 PLANNING` may be used only by the final independent Phase 1 exit review when:

* every Phase 1 exit criterion is satisfied;
* all required implementation PRs and corrections are merged;
* exact reviewed heads and CI are verified;
* no P0 or P1 finding remains open;
* Shopify reconciliation and tenant isolation have passed;
* production inventory writes remain separately unapproved unless a later explicit decision changes that status;
* the verdict authorizes Phase 2 planning only;
* it does not authorize Phase 2 implementation.

Reusable permanent-agent wording may be evaluated before the Phase 1 exit-review prompt is approved, but it is not required to approve the present Phase 1 planning brief. This planning correction does not modify `stocky-plus/docs/agents/`.

## Open evidence and dependencies

### Q-002

The Partner account holder must verify:

* production Shopify app ID;
* development and staging app IDs;
* selected distribution methods;
* linked Shopify CLI configurations;
* environment separation.

### Legal review

Legal counsel must validate:

* final privacy retention schedule;
* legally required record retention;
* deletion-manifest contents;
* privacy-policy language.

### Deployment

No production migration or deployment is authorized by approving this brief.

Production rollout requires a separate reviewed deployment plan and explicit authorization.

## Branch and pull-request rules

* Base branch: current `main`.
* One focused branch per approved implementation PR.
* No direct commits to `main`.
* No mixed future phases.
* No secrets, credentials, `.env` files, merchant data, or production data.
* Every merge requires passing required CI, Claude review, ChatGPT acceptance, and explicit user authorization.
* Inventory-write flags must remain default OFF in every environment and CI configuration.

## Approval

**Approved by:**
**Approved date:**
**Approved scope version:**

Implementation authorization becomes effective only after the approved planning pull request containing this brief is merged into `main`.
