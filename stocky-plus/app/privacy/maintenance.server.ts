/**
 * Worker-side privacy loop: opens retention erasures, carries out due
 * shop/redact requests and reports requests that are past Shopify's deadline.
 */
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { deleteSessionsForShop } from "../tenant/bootstrap.server";
import {
  resolvePrivacyIntervalMs,
  resolveUninstalledRetentionDays,
} from "./config.server";
import {
  claimDueShopRedactRequests,
  processShopRedactRequest,
  type ErasureDeps,
} from "./erasure.server";
import { purgeQueuedJobsForShop } from "./queue-purge.server";
import { openRetentionErasureRequests } from "./retention.server";

const REQUESTS_PER_RUN = 5;
const OVERDUE_REPORT_INTERVAL_MS = 60 * 60_000;

export type PrivacyMaintenanceSummary = {
  retentionRequestsOpened: number;
  resolved: number;
  continuing: number;
  /** Requests held open because the shop is not uninstalled. */
  waiting: number;
  failed: number;
  overdue: number;
};

const productionDeps: ErasureDeps = {
  deleteSessions: deleteSessionsForShop,
  purgeQueuedJobs: purgeQueuedJobsForShop,
};

export async function runPrivacyMaintenance(input: {
  retentionDays: number;
  now?: Date;
  deps?: ErasureDeps;
}): Promise<PrivacyMaintenanceSummary> {
  const now = input.now ?? new Date();
  const deps = input.deps ?? productionDeps;
  const summary: PrivacyMaintenanceSummary = {
    retentionRequestsOpened: await openRetentionErasureRequests(
      input.retentionDays,
      now,
    ),
    resolved: 0,
    continuing: 0,
    waiting: 0,
    failed: 0,
    overdue: 0,
  };

  for (const request of await claimDueShopRedactRequests(
    now,
    REQUESTS_PER_RUN,
  )) {
    const outcome = await processShopRedactRequest(request, deps, now);
    if (outcome.status === "resolved") {
      summary.resolved += 1;
      console.log(
        `Privacy request ${request.id} (${request.origin}) for ${request.shopDomain} resolved: ${outcome.resolution}`,
      );
    } else if (outcome.status === "continuing") {
      summary.continuing += 1;
    } else if (outcome.status === "waiting") {
      summary.waiting += 1;
    } else {
      summary.failed += 1;
      console.error(
        `Privacy request ${request.id} for ${request.shopDomain} failed (attempt ${request.attempts}): ${outcome.errorCode}`,
      );
    }
  }

  summary.overdue = await getControlPlanePrisma().privacyRequest.count({
    where: { resolution: null, dueAt: { lt: now } },
  });
  return summary;
}

/**
 * Starts the loop in the worker process. Configuration errors throw here, at
 * startup. Runs never overlap within one process; across processes the
 * request lease and the conditional shop updates keep them apart.
 */
export function startPrivacyMaintenanceLoop(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.Timeout | null {
  const retentionDays = resolveUninstalledRetentionDays(env);
  const intervalMs = resolvePrivacyIntervalMs(env);
  if (intervalMs === 0) {
    console.warn(
      "Privacy maintenance loop is off (STOCKY_PRIVACY_INTERVAL_MS=0): shop/redact requests will not be carried out by this process",
    );
    return null;
  }

  let running = false;
  let overdueReportedAt = 0;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void runPrivacyMaintenance({ retentionDays })
      .then((summary) => {
        const reportDue =
          Date.now() - overdueReportedAt >= OVERDUE_REPORT_INTERVAL_MS;
        if (summary.overdue > 0 && reportDue) {
          overdueReportedAt = Date.now();
          console.error(
            `${summary.overdue} privacy request(s) are past the 30-day deadline and still open`,
          );
        }
      })
      .catch((error) => {
        console.error("Privacy maintenance run failed:", error);
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  console.log(
    `Privacy maintenance every ${intervalMs}ms; uninstalled shops are erased after ${retentionDays} day(s)`,
  );
  return timer;
}
