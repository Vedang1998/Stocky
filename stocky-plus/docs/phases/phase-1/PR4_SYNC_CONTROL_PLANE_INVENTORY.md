# PR 4 — Synchronization Control Plane Inventory

**Phase:** 1
**Work unit:** PR 4 — Synchronization control plane
**Branch:** `phase-1/sync-control-plane`
**Generator:** `scripts/sync-control-plane/inventory.ts` (deterministic)
**Inventory version:** `phase1-pr4-sync-inventory-v2-correction`
**Content digest:** `87905b396b3a9ea359bc36b2fdf24e626a8353b00257091754bc097d857491b2`
**Surfaces:** 37

> This file is mechanically generated. Do not edit by hand.
> Regenerate with `npm run sync:inventory`.
> CI verifies freshness via `npm run sync:inventory:check`.

## Counts by kind

| Kind | Count |
|---|---|
| control_plane_table | 11 |
| dispatcher | 2 |
| merchant_table | 1 |
| producer | 5 |
| queue | 2 |
| replay_path | 1 |
| sanitizer | 5 |
| webhook_route | 7 |
| worker | 3 |

## Surface inventory

| Kind | ID | Path | Symbol | Notes |
|---|---|---|---|---|
| queue | `queue:stocky-webhooks` | `app/jobs/queue.server.ts` | `WEBHOOK_QUEUE` | BullMQ delivery for durable webhook jobs |
| queue | `queue:stocky-cron` | `app/jobs/queue.server.ts` | `CRON_QUEUE` | BullMQ delivery for catalog/ABC cron jobs |
| producer | `producer:webhook-intake` | `app/sync/intake.server.ts` | `ingestAuthenticatedWebhook` | Durable DB-first webhook intake |
| producer | `producer:catalog-sync` | `app/jobs/queue.server.ts` | `enqueueCatalogSync` | Creates durable job then relies on dispatcher |
| producer | `producer:after-auth-catalog-sync` | `app/jobs/queue.server.ts` | `enqueueAfterAuthCatalogSync` | AfterAuth durable catalog sync producer |
| producer | `producer:abc-analysis-shop` | `app/jobs/queue.server.ts` | `enqueueAbcAnalysisForShop` | Per-shop ABC durable producer |
| producer | `producer:weekly-abc-tick` | `app/jobs/queue.server.ts` | `scheduleAbcAnalysisCron` | Control-plane weekly tick (no tenant envelope) |
| dispatcher | `dispatcher:pending-jobs` | `app/sync/dispatcher.server.ts` | `dispatchPendingJobs` | FOR UPDATE SKIP LOCKED claim + BullMQ enqueue |
| dispatcher | `dispatcher:fair-claim-query` | `app/sync/fair-claim-query.server.ts` | `buildFairClaimLockedSelectSql` | D-047 production-owned bounded fair-claim SQL shared with EXPLAIN harness |
| worker | `worker:webhook` | `app/jobs/workers/webhook-processor.ts` | `processWebhookJob` | Durable lifecycle wrapper + legacy handlers |
| worker | `worker:cron` | `app/jobs/workers/webhook-processor.ts` | `processCronJob` | Durable lifecycle wrapper for cron jobs |
| worker | `worker:entrypoint` | `app/jobs/workers/index.ts` | `main` | Starts workers + optional dispatcher loop |
| webhook_route | `webhook:app/uninstalled` | `app/routes/webhooks.app.uninstalled.tsx` | `action` | Durable disable + cancel + session delete |
| webhook_route | `webhook:app/scopes_update` | `app/routes/webhooks.app.scopes_update.tsx` | `action` | Bootstrap session scope update (not durable job) |
| webhook_route | `webhook:orders/create` | `app/routes/webhooks.orders.create.tsx` | `action` | Durable intake for orders/create |
| webhook_route | `webhook:orders/cancelled` | `app/routes/webhooks.orders.cancelled.tsx` | `action` | Durable intake for orders/cancelled |
| webhook_route | `webhook:refunds/create` | `app/routes/webhooks.refunds.create.tsx` | `action` | Durable intake for refunds/create |
| webhook_route | `webhook:inventory_levels/update` | `app/routes/webhooks.inventory_levels.update.tsx` | `action` | Durable intake for inventory_levels/update |
| webhook_route | `webhook:compliance` | `app/routes/webhooks.compliance.tsx` | `action` | Authenticate only — PR 7 processors |
| replay_path | `replay:dead-letter` | `app/sync/replay.server.ts` | `replayDeadLetter` | Operator/system replay — no merchant UI |
| sanitizer | `sanitizer:orders/create` | `app/sync/sanitize.server.ts` | `sanitizeWebhookPayload` | Versioned order projection |
| sanitizer | `sanitizer:orders/cancelled` | `app/sync/sanitize.server.ts` | `sanitizeWebhookPayload` | Versioned cancelled-order projection |
| sanitizer | `sanitizer:refunds/create` | `app/sync/sanitize.server.ts` | `sanitizeWebhookPayload` | Versioned refund projection |
| sanitizer | `sanitizer:inventory_levels/update` | `app/sync/sanitize.server.ts` | `sanitizeWebhookPayload` | Versioned inventory projection |
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
| merchant_table | `table:SyncApplicationReceipt` | `prisma/schema.prisma` | `SyncApplicationReceipt` | merchant_domain — exactly-once application receipt (F-PR4-01) |

## Completeness rules

CI must fail when:

1. A listed surface path is missing on disk.
2. Generated inventory digest drifts from committed file.
3. A new producer, queue, worker, webhook route, or replay path is introduced without a manifest entry (scanner coverage in `inventory-check.ts`).

## Classification reminder

Control-plane tables listed above are `platform_control_plane` (tenant-owned via non-null `shopId`, not merchant-domain FORCE RLS). See `PR4_SYNC_CONTROL_PLANE_ARCHITECTURE.md`.
