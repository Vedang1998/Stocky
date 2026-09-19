import { ORDER_HISTORY_WINDOW_DAYS } from "../apply/constants";
import type { OrderAdminReadClient, TrustedShopIdentity } from "../admin-read";
import {
  applyNominatedOrderGid,
  nominatedReceipt,
} from "./apply-nominated";
import type { OrderFactsTxnHost } from "./apply-composition";
import {
  ORDER_FACTS_CURSOR_INCREMENTAL,
  ORDER_FACTS_CURSOR_SWEEP,
  ORDER_FACTS_MAX_WINDOW_PAGES,
  ORDER_FACTS_RECONCILE_JOB_TYPE,
  ORDER_FACTS_WINDOW_PAGE_SIZE,
} from "./constants";
import {
  assertShopProcessingEnabled,
  persistOrderFactsCoverageHealth,
  persistOrderFactsCursor,
  readOrderFactsCursor,
  recordOrderFactsDataIssue,
  resolveOrderFactsDataIssue,
} from "./control-plane";
import { historyWindowQuery } from "./window-listing";
import { readOrderFactsWindowPage } from "./window-read";
import type { CoverageRecord } from "./types";

export type OrderFactsReconcileMode =
  | "incremental"
  | "window_sweep"
  | "sample"
  | "quarantine_recovery";

export type OrderFactsReconcileStepResult =
  | { status: "SUCCEEDED"; coverage: CoverageRecord }
  | { status: "PARTIAL_FAILURE"; reason: string; coverage: CoverageRecord };

function windowStartIso(now: Date): string {
  return new Date(
    now.getTime() - ORDER_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export async function runOrderFactsReconcileStep(input: {
  db: OrderFactsTxnHost;
  admin: OrderAdminReadClient;
  shop: TrustedShopIdentity;
  shopId: string;
  durableJobId: string;
  correlationId: string;
  mode: OrderFactsReconcileMode;
  resolvingIssueId?: string | null;
  /** GraphQL connection cursor for resuming an in-progress window page loop. */
  pageAfter?: string | null;
  /** ISO watermark override for incremental `updated_at:>=` filtering. */
  updatedAtGte?: string | null;
  now?: Date;
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
}): Promise<OrderFactsReconcileStepResult> {
  await assertShopProcessingEnabled(input.shopId);
  const now = input.now ?? new Date();
  const storedIncrementalCursor = await readOrderFactsCursor({
    shopId: input.shopId,
    domain: ORDER_FACTS_CURSOR_INCREMENTAL,
  });
  const ignoreIncrementalWatermark =
    input.mode === "quarantine_recovery" || input.mode === "window_sweep";
  const query = historyWindowQuery({
    windowStartIso: windowStartIso(now),
    updatedAtGte: ignoreIncrementalWatermark
      ? null
      : (input.updatedAtGte ?? storedIncrementalCursor),
  });

  let after = input.pageAfter ?? null;
  let scanned = 0;
  let applied = 0;
  let incomplete = 0;
  let behindWatermarkExamined = 0;
  let pages = 0;
  let lastGraphQlCursor: string | null = null;
  let maxExaminedUpdatedAt: string | null = null;
  let hasNextPage = true;

  while (hasNextPage && pages < ORDER_FACTS_MAX_WINDOW_PAGES) {
    if (input.mode === "sample" && scanned >= ORDER_FACTS_WINDOW_PAGE_SIZE) {
      break;
    }
    const page = await readOrderFactsWindowPage(input.admin, {
      query,
      first: ORDER_FACTS_WINDOW_PAGE_SIZE,
      after,
    });
    pages += 1;
    hasNextPage = page.hasNextPage && input.mode !== "sample";
    after = page.endCursor;
    lastGraphQlCursor = page.endCursor;
    for (const listed of page.orders) {
      scanned += 1;
      if (
        maxExaminedUpdatedAt == null ||
        listed.updatedAt > maxExaminedUpdatedAt
      ) {
        maxExaminedUpdatedAt = listed.updatedAt;
      }
      if (
        storedIncrementalCursor &&
        listed.updatedAt < storedIncrementalCursor
      ) {
        behindWatermarkExamined += 1;
      }
      const result = await applyNominatedOrderGid({
        db: input.db,
        admin: input.admin,
        shop: input.shop,
        shopId: input.shopId,
        shopifyGid: listed.id,
        sourceKind: "RECONCILE",
        observedAt: now,
        receipt: nominatedReceipt({
          durableJobId: input.durableJobId,
          shopifyGid: listed.id,
          sourceJobType: ORDER_FACTS_RECONCILE_JOB_TYPE,
        }),
        durableJobId: input.durableJobId,
        correlationId: input.correlationId,
        requestedCanonicalIdentitiesPerTransaction:
          input.requestedCanonicalIdentitiesPerTransaction,
        configuredWorstCaseConcurrentCanonicalTransactions:
          input.configuredWorstCaseConcurrentCanonicalTransactions,
      });
      if (result.status === "applied" || result.status === "already_applied") {
        applied += 1;
      } else if (result.status === "noop") {
        applied += 1;
      } else {
        incomplete += 1;
      }
    }
    if (!page.hasNextPage) break;
  }

  const completeSweep =
    input.mode !== "sample" && incomplete === 0 && !hasNextPage;
  const coverage: CoverageRecord = {
    mode: input.mode === "sample" ? "sample" : input.mode === "incremental" ? "incremental" : "window_sweep",
    examinedGids: scanned,
    appliedGids: applied,
    incompleteGids: incomplete,
    outOfWindowGids: 0,
    behindWatermarkExamined,
    watermarkPersisted: completeSweep && input.mode !== "sample",
    cursorValue: completeSweep
      ? (maxExaminedUpdatedAt ?? lastGraphQlCursor)
      : lastGraphQlCursor,
  };

  if (input.mode === "sample") {
    await recordOrderFactsDataIssue({
      shopId: input.shopId,
      reasonCode: "order_facts_sample_not_coverage",
      severity: "INFO",
      redactedEvidence: { scanned, applied, incomplete },
    });
    await persistOrderFactsCoverageHealth({
      shopId: input.shopId,
      coverage,
      evidence: {
        unresolvedCoverageCount: 1,
        openDiagnosticIssueCount: 1,
        incompletePaginationCount: 0,
        quarantineOpenCount: 0,
      },
    });
    return { status: "SUCCEEDED", coverage };
  }

  if (!completeSweep) {
    await persistOrderFactsCoverageHealth({
      shopId: input.shopId,
      coverage,
      evidence: {
        unresolvedCoverageCount: incomplete + (hasNextPage ? 1 : 0),
        openDiagnosticIssueCount: incomplete > 0 ? 1 : 0,
        incompletePaginationCount: hasNextPage ? 1 : 0,
        quarantineOpenCount: input.mode === "quarantine_recovery" ? 1 : 0,
      },
    });
    return {
      status: "PARTIAL_FAILURE",
      reason: hasNextPage ? "window_pages_remaining" : "reconcile_incomplete",
      coverage,
    };
  }

  await persistOrderFactsCursor({
    shopId: input.shopId,
    domain:
      input.mode === "incremental"
        ? ORDER_FACTS_CURSOR_INCREMENTAL
        : ORDER_FACTS_CURSOR_SWEEP,
    cursorValue: maxExaminedUpdatedAt ?? now.toISOString(),
  });
  if (input.resolvingIssueId) {
    await resolveOrderFactsDataIssue({
      shopId: input.shopId,
      issueId: input.resolvingIssueId,
    });
  }
  await persistOrderFactsCoverageHealth({
    shopId: input.shopId,
    coverage,
    evidence: {
      unresolvedCoverageCount: 0,
      openDiagnosticIssueCount: 0,
      incompletePaginationCount: 0,
      quarantineOpenCount: 0,
    },
  });
  return { status: "SUCCEEDED", coverage };
}
