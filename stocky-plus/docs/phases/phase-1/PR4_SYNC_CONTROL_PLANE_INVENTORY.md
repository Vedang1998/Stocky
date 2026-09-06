# PR 4 — Synchronization Control Plane Inventory

**Phase:** 1
**Work unit:** PR 4 — Synchronization control plane
**Branch:** `phase-1/sync-control-plane`
**Generator:** `scripts/sync-control-plane/inventory.ts` (deterministic)
**Inventory version:** `phase1-pr4-sync-inventory-v3-d048`
**Content digest:** `7363d6d85e84f782136c471088e36bbf5a86584c68f9f4558fc5eb6887e260a8`
**Surfaces:** 48

> This file is mechanically generated. Do not edit by hand.
> Regenerate with `npm run sync:inventory`.
> CI verifies freshness via `npm run sync:inventory:check`.

## Counts by kind

| Kind | Count |
|---|---|
| control_plane_table | 12 |
| dispatcher | 2 |
| merchant_table | 1 |
| producer | 6 |
| queue | 2 |
| replay_path | 1 |
| sanitizer | 6 |
| webhook_route | 8 |
| worker | 10 |

## Surface inventory

| Kind | ID | Path | Symbol | Notes |
|---|---|---|---|---|
| queue | `queue:stocky-webhooks` | `app/jobs/queue.server.ts` | `WEBHOOK_QUEUE` | BullMQ delivery for durable webhook jobs |
| queue | `queue:stocky-cron` | `app/jobs/queue.server.ts` | `CRON_QUEUE` | BullMQ delivery for catalog/ABC cron jobs |
| producer | `producer:webhook-intake` | `app/sync/intake.server.ts` | `ingestAuthenticatedWebhook` | Durable DB-first webhook intake |
| producer | `producer:catalog-sync` | `app/jobs/queue.server.ts` | `enqueueCatalogSync` | Creates durable job then relies on dispatcher |
| producer | `producer:after-auth-catalog-sync` | `app/jobs/queue.server.ts` | `enqueueAfterAuthCatalogSync` | AfterAuth durable catalog sync producer |
| producer | `producer:inventory-state-reconcile` | `app/jobs/queue.server.ts` | `enqueueInventoryStateReconcile` | Coalesced, webhook-deferred canonical inventory-state reconcile |
| producer | `producer:abc-analysis-shop` | `app/jobs/queue.server.ts` | `enqueueAbcAnalysisForShop` | Per-shop ABC durable producer |
| producer | `producer:weekly-abc-tick` | `app/jobs/queue.server.ts` | `scheduleAbcAnalysisCron` | Control-plane weekly tick (no tenant envelope) |
| dispatcher | `dispatcher:pending-jobs` | `app/sync/dispatcher.server.ts` | `dispatchPendingJobs` | FOR UPDATE SKIP LOCKED claim + BullMQ enqueue |
| dispatcher | `dispatcher:fair-claim-query` | `app/sync/fair-claim-query.server.ts` | `buildFairClaimLockedSelectSql` | D-050 split claim: buildFairClaimSchedulerLockSql + buildFairClaimJobCandidateSql + buildFairClaimReadinessReconcileSql (fresh-snapshot reconcile); buildFairClaimLockedSelectSql remains compatibility claim SELECT (no heal) shared with EXPLAIN harness |
| worker | `worker:webhook` | `app/jobs/workers/webhook-processor.ts` | `processWebhookJob` | Durable lifecycle wrapper + legacy handlers |
| worker | `worker:cron` | `app/jobs/workers/webhook-processor.ts` | `processCronJob` | Durable lifecycle wrapper for cron jobs |
| worker | `worker:catalog-facts-sync` | `app/jobs/workers/catalog-facts/catalog-sync.ts` | `runCatalogFactsSyncStep` | One parent job with locations/catalog/inventory_levels child SyncRuns |
| worker | `worker:catalog-facts-refetch` | `app/jobs/workers/catalog-facts/resource-refetch.ts` | `applyCatalogFactWebhookRefetch` | Authoritative Admin refetch before canonical webhook application |
| worker | `worker:catalog-facts-bulk-finish` | `app/jobs/workers/catalog-facts/bulk-finish.ts` | `signalBulkOperationContinuation` | CONTROL_ONLY bulk_operations/finish continuation of the persisted GID |
| worker | `worker:catalog-facts-capacity` | `app/jobs/workers/catalog-facts/capacity.ts` | `assertCanonicalWriterCapacityAtStartup` | F-CLAUDE-PR5F3EC-01 D*max(B, Σ worker concurrency) fail-closed envelope |
| worker | `worker:catalog-facts-projection` | `app/jobs/workers/catalog-facts/projection.ts` | `projectAppliedCanonicalFacts` | Post-commit compatibility projection; live processingEnabled read |
| worker | `worker:catalog-facts-diagnostic-reconciler` | `app/jobs/workers/catalog-facts/diagnostic-reconciler.ts` | `reconcileCatalogDiagnostics` | Catalog health evidence and diagnostic DataIssue reconcile |
| worker | `worker:catalog-facts-jsonl-checkpoint` | `app/lib/catalog-facts/ingest/checkpoint.ts` | `acknowledgeJsonlBatch` | Race Y two-phase checkpoint uses the control-plane role only |
| worker | `worker:entrypoint` | `app/jobs/workers/index.ts` | `main` | Starts workers + optional dispatcher loop |
| webhook_route | `webhook:app/uninstalled` | `app/routes/webhooks.app.uninstalled.tsx` | `action` | Durable disable + cancel + session delete |
| webhook_route | `webhook:app/scopes_update` | `app/routes/webhooks.app.scopes_update.tsx` | `action` | Bootstrap session scope update (not durable job) |
| webhook_route | `webhook:orders/create` | `app/routes/webhooks.orders.create.tsx` | `action` | Durable intake for orders/create |
| webhook_route | `webhook:orders/cancelled` | `app/routes/webhooks.orders.cancelled.tsx` | `action` | Durable intake for orders/cancelled |
| webhook_route | `webhook:refunds/create` | `app/routes/webhooks.refunds.create.tsx` | `action` | Durable intake for refunds/create |
| webhook_route | `webhook:inventory_levels/update` | `app/routes/webhooks.inventory_levels.update.tsx` | `action` | Durable intake for inventory_levels/update |
| webhook_route | `webhook:catalog-facts` | `app/routes/webhooks.catalog-facts.tsx` | `action` | Shared durable intake route for PR5 catalog/inventory signal topics |
| webhook_route | `webhook:compliance` | `app/routes/webhooks.compliance.tsx` | `action` | Authenticate only — PR 7 processors |
| replay_path | `replay:dead-letter` | `app/sync/replay.server.ts` | `replayDeadLetter` | Operator/system replay — no merchant UI |
| sanitizer | `sanitizer:orders/create` | `app/sync/sanitize.server.ts` | `sanitizeWebhookPayload` | Versioned order projection |
| sanitizer | `sanitizer:orders/cancelled` | `app/sync/sanitize.server.ts` | `sanitizeWebhookPayload` | Versioned cancelled-order projection |
| sanitizer | `sanitizer:refunds/create` | `app/sync/sanitize.server.ts` | `sanitizeWebhookPayload` | Versioned refund projection |
| sanitizer | `sanitizer:inventory_levels/update` | `app/sync/sanitize.server.ts` | `sanitizeWebhookPayload` | Versioned inventory projection |
| sanitizer | `sanitizer:catalog-facts` | `app/sync/sanitize.server.ts` | `sanitizeCatalogIdentityProjection` | Identity and signal metadata only for PR5 resource topics |
| sanitizer | `sanitizer:app/uninstalled` | `app/sync/sanitize.server.ts` | `sanitizeWebhookPayload` | Identity/control metadata only |
| control_plane_table | `table:WebhookDelivery` | `prisma/schema.prisma` | `WebhookDelivery` | platform_control_plane |
| control_plane_table | `table:DurableJob` | `prisma/schema.prisma` | `DurableJob` | platform_control_plane |
| control_plane_table | `table:JobAttempt` | `prisma/schema.prisma` | `JobAttempt` | platform_control_plane |
| control_plane_table | `table:DeadLetter` | `prisma/schema.prisma` | `DeadLetter` | platform_control_plane |
| control_plane_table | `table:JobReplay` | `prisma/schema.prisma` | `JobReplay` | platform_control_plane |
| control_plane_table | `table:SyncRun` | `prisma/schema.prisma` | `SyncRun` | platform_control_plane |
| control_plane_table | `table:SyncCursor` | `prisma/schema.prisma` | `SyncCursor` | platform_control_plane |
| control_plane_table | `table:ReconciliationRun` | `prisma/schema.prisma` | `ReconciliationRun` | platform_control_plane |
| control_plane_table | `table:DataIssue` | `prisma/schema.prisma` | `DataIssue` | platform_control_plane |
| control_plane_table | `table:SyncHealth` | `prisma/schema.prisma` | `SyncHealth` | platform_control_plane |
| control_plane_table | `table:JobDispatch` | `prisma/schema.prisma` | `JobDispatch` | platform_control_plane — append-only dispatch identity (D-043) |
| control_plane_table | `table:DispatchReadyShop` | `prisma/schema.prisma` | `DispatchReadyShop` | platform_control_plane — D-048 dispatch readiness / fairness cursor |
| merchant_table | `table:SyncApplicationReceipt` | `prisma/schema.prisma` | `SyncApplicationReceipt` | merchant_domain — exactly-once application receipt (F-PR4-01) |

## Completeness rules

CI must fail when:

1. A listed surface path is missing on disk.
2. Generated inventory digest drifts from committed file.
3. A new producer, queue, worker, webhook route, or replay path is introduced without a manifest entry (scanner coverage in `inventory-check.ts`).

## Classification reminder

Control-plane tables listed above are `platform_control_plane` (tenant-owned via non-null `shopId`, not merchant-domain FORCE RLS). See `PR4_SYNC_CONTROL_PLANE_ARCHITECTURE.md`.
