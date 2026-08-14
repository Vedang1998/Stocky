/**
 * Mechanical source of truth for PR 4 sync control-plane inventory.
 * CI fails when producers/queues/workers/webhooks/replay paths drift.
 */

export const SYNC_INVENTORY_VERSION = "phase1-pr4-sync-inventory-v3-d048";

export type SyncSurfaceKind =
  | "producer"
  | "queue"
  | "worker"
  | "webhook_route"
  | "replay_path"
  | "dispatcher"
  | "sanitizer"
  | "control_plane_table"
  | "merchant_table";

export type SyncSurface = {
  kind: SyncSurfaceKind;
  id: string;
  path: string;
  symbol: string;
  notes: string;
};

/** Approved surfaces — extend only with architecture + tests. */
export const SYNC_SURFACES: readonly SyncSurface[] = [
  {
    kind: "queue",
    id: "queue:stocky-webhooks",
    path: "app/jobs/queue.server.ts",
    symbol: "WEBHOOK_QUEUE",
    notes: "BullMQ delivery for durable webhook jobs",
  },
  {
    kind: "queue",
    id: "queue:stocky-cron",
    path: "app/jobs/queue.server.ts",
    symbol: "CRON_QUEUE",
    notes: "BullMQ delivery for catalog/ABC cron jobs",
  },
  {
    kind: "producer",
    id: "producer:webhook-intake",
    path: "app/sync/intake.server.ts",
    symbol: "ingestAuthenticatedWebhook",
    notes: "Durable DB-first webhook intake",
  },
  {
    kind: "producer",
    id: "producer:catalog-sync",
    path: "app/jobs/queue.server.ts",
    symbol: "enqueueCatalogSync",
    notes: "Creates durable job then relies on dispatcher",
  },
  {
    kind: "producer",
    id: "producer:after-auth-catalog-sync",
    path: "app/jobs/queue.server.ts",
    symbol: "enqueueAfterAuthCatalogSync",
    notes: "AfterAuth durable catalog sync producer",
  },
  {
    kind: "producer",
    id: "producer:abc-analysis-shop",
    path: "app/jobs/queue.server.ts",
    symbol: "enqueueAbcAnalysisForShop",
    notes: "Per-shop ABC durable producer",
  },
  {
    kind: "producer",
    id: "producer:weekly-abc-tick",
    path: "app/jobs/queue.server.ts",
    symbol: "scheduleAbcAnalysisCron",
    notes: "Control-plane weekly tick (no tenant envelope)",
  },
  {
    kind: "dispatcher",
    id: "dispatcher:pending-jobs",
    path: "app/sync/dispatcher.server.ts",
    symbol: "dispatchPendingJobs",
    notes: "FOR UPDATE SKIP LOCKED claim + BullMQ enqueue",
  },
  {
    kind: "dispatcher",
    id: "dispatcher:fair-claim-query",
    path: "app/sync/fair-claim-query.server.ts",
    symbol: "buildFairClaimLockedSelectSql",
    notes:
      "D-050 split claim: buildFairClaimSchedulerLockSql + buildFairClaimJobCandidateSql + buildFairClaimReadinessReconcileSql (fresh-snapshot reconcile); buildFairClaimLockedSelectSql remains compatibility claim SELECT (no heal) shared with EXPLAIN harness",
  },
  {
    kind: "worker",
    id: "worker:webhook",
    path: "app/jobs/workers/webhook-processor.ts",
    symbol: "processWebhookJob",
    notes: "Durable lifecycle wrapper + legacy handlers",
  },
  {
    kind: "worker",
    id: "worker:cron",
    path: "app/jobs/workers/webhook-processor.ts",
    symbol: "processCronJob",
    notes: "Durable lifecycle wrapper for cron jobs",
  },
  {
    kind: "worker",
    id: "worker:entrypoint",
    path: "app/jobs/workers/index.ts",
    symbol: "main",
    notes: "Starts workers + optional dispatcher loop",
  },
  {
    kind: "webhook_route",
    id: "webhook:app/uninstalled",
    path: "app/routes/webhooks.app.uninstalled.tsx",
    symbol: "action",
    notes: "Durable disable + cancel + session delete",
  },
  {
    kind: "webhook_route",
    id: "webhook:app/scopes_update",
    path: "app/routes/webhooks.app.scopes_update.tsx",
    symbol: "action",
    notes: "Bootstrap session scope update (not durable job)",
  },
  {
    kind: "webhook_route",
    id: "webhook:orders/create",
    path: "app/routes/webhooks.orders.create.tsx",
    symbol: "action",
    notes: "Durable intake for orders/create",
  },
  {
    kind: "webhook_route",
    id: "webhook:orders/cancelled",
    path: "app/routes/webhooks.orders.cancelled.tsx",
    symbol: "action",
    notes: "Durable intake for orders/cancelled",
  },
  {
    kind: "webhook_route",
    id: "webhook:refunds/create",
    path: "app/routes/webhooks.refunds.create.tsx",
    symbol: "action",
    notes: "Durable intake for refunds/create",
  },
  {
    kind: "webhook_route",
    id: "webhook:inventory_levels/update",
    path: "app/routes/webhooks.inventory_levels.update.tsx",
    symbol: "action",
    notes: "Durable intake for inventory_levels/update",
  },
  {
    kind: "webhook_route",
    id: "webhook:compliance",
    path: "app/routes/webhooks.compliance.tsx",
    symbol: "action",
    notes: "Authenticate only — PR 7 processors",
  },
  {
    kind: "replay_path",
    id: "replay:dead-letter",
    path: "app/sync/replay.server.ts",
    symbol: "replayDeadLetter",
    notes: "Operator/system replay — no merchant UI",
  },
  {
    kind: "sanitizer",
    id: "sanitizer:orders/create",
    path: "app/sync/sanitize.server.ts",
    symbol: "sanitizeWebhookPayload",
    notes: "Versioned order projection",
  },
  {
    kind: "sanitizer",
    id: "sanitizer:orders/cancelled",
    path: "app/sync/sanitize.server.ts",
    symbol: "sanitizeWebhookPayload",
    notes: "Versioned cancelled-order projection",
  },
  {
    kind: "sanitizer",
    id: "sanitizer:refunds/create",
    path: "app/sync/sanitize.server.ts",
    symbol: "sanitizeWebhookPayload",
    notes: "Versioned refund projection",
  },
  {
    kind: "sanitizer",
    id: "sanitizer:inventory_levels/update",
    path: "app/sync/sanitize.server.ts",
    symbol: "sanitizeWebhookPayload",
    notes: "Versioned inventory projection",
  },
  {
    kind: "sanitizer",
    id: "sanitizer:app/uninstalled",
    path: "app/sync/sanitize.server.ts",
    symbol: "sanitizeWebhookPayload",
    notes: "Identity/control metadata only",
  },
  {
    kind: "control_plane_table",
    id: "table:WebhookDelivery",
    path: "prisma/schema.prisma",
    symbol: "WebhookDelivery",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:DurableJob",
    path: "prisma/schema.prisma",
    symbol: "DurableJob",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:JobAttempt",
    path: "prisma/schema.prisma",
    symbol: "JobAttempt",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:DeadLetter",
    path: "prisma/schema.prisma",
    symbol: "DeadLetter",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:JobReplay",
    path: "prisma/schema.prisma",
    symbol: "JobReplay",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:SyncRun",
    path: "prisma/schema.prisma",
    symbol: "SyncRun",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:SyncCursor",
    path: "prisma/schema.prisma",
    symbol: "SyncCursor",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:ReconciliationRun",
    path: "prisma/schema.prisma",
    symbol: "ReconciliationRun",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:DataIssue",
    path: "prisma/schema.prisma",
    symbol: "DataIssue",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:SyncHealth",
    path: "prisma/schema.prisma",
    symbol: "SyncHealth",
    notes: "platform_control_plane",
  },
  {
    kind: "control_plane_table",
    id: "table:JobDispatch",
    path: "prisma/schema.prisma",
    symbol: "JobDispatch",
    notes: "platform_control_plane — append-only dispatch identity (D-043)",
  },
  {
    kind: "control_plane_table",
    id: "table:DispatchReadyShop",
    path: "prisma/schema.prisma",
    symbol: "DispatchReadyShop",
    notes:
      "platform_control_plane — D-048 dispatch readiness / fairness cursor",
  },
  {
    kind: "merchant_table",
    id: "table:SyncApplicationReceipt",
    path: "prisma/schema.prisma",
    symbol: "SyncApplicationReceipt",
    notes: "merchant_domain — exactly-once application receipt (F-PR4-01)",
  },
] as const;

/** Files that must exist for each surface. */
export function assertSyncSurfacesResolvable(
  exists: (relPath: string) => boolean,
): string[] {
  const missing: string[] = [];
  for (const s of SYNC_SURFACES) {
    if (!exists(s.path)) missing.push(`${s.id}:${s.path}`);
  }
  return missing;
}
