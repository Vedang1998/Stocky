import type { OrderAdminReadClient, TrustedShopIdentity } from "../admin-read";
import type { OrderApplyDb } from "../apply/sql";
import type {
  DirectOrderObservation,
  OrderApplyBatchResult,
  OrderApplyReceiptInput,
} from "../apply/types";
import type { OrderExistenceKind, OrderSourceKind } from "../types";
import type { OrderFactsWebhookTopic } from "./constants";

export type OrderFactsApplyDb = OrderApplyDb;

export type OrderFactsAdminContext = {
  admin: OrderAdminReadClient;
  shop: TrustedShopIdentity;
  request?: Request;
};

export type OrderFactsReceiptProbe = "already_applied" | "proceed";

export type MapContext = {
  shopId: string;
  observationToken: string;
  observationRequestGen: bigint;
  observationResponseGen: bigint;
  existenceObservedAt: Date;
  accessScopeSnapshot: readonly string[];
  lastConfirmedAccessScopes?: readonly string[] | null;
  enclosingOrderGid?: string | null;
  sourceKind: OrderSourceKind;
  existenceKind?: OrderExistenceKind;
};

export type MapOutcome =
  | { status: "mapped"; observation: DirectOrderObservation }
  | { status: "null_observed"; observation: DirectOrderObservation }
  | {
      status: "incomplete";
      reason: string;
      phase: string;
      requestedGid: string | null;
      resourceKind: "Order" | "Refund";
    }
  | {
      status: "failure";
      reason: string;
      phase: string;
      requestedGid: string | null;
      resourceKind: "Order" | "Refund" | "Shop" | "AccessScopes" | null;
    }
  | {
      status: "blocked";
      code:
        | "unknown_parent_order_gid"
        | "contradictory_parent_order_gid"
        | "malformed_datetime"
        | "missing_with_code_discount_authority"
        | "scope_continuity_denies_absence"
        | "preserve_established_tombstone";
      reason: string;
    }
  | { status: "noop"; reason: string };

export type ExistenceAdjudicationInput = {
  nullObserved: boolean;
  queryCompleted: boolean;
  observedAt: Date;
  processedAt: Date | null;
  shopifyCreatedAt: Date | null;
  currentScopes: readonly string[];
  lastConfirmedScopes: readonly string[] | null;
  storedKind: string | null;
  storedState: "LIVE" | "ABSENT" | null;
  storedDeletedAt: Date | null;
  deleteWebhook: boolean;
  hasReadAllOrders: boolean;
  windowDays?: number;
};

export type ExistenceAdjudication =
  | {
      apply: true;
      existenceKind: OrderExistenceKind;
      diagnostic: string | null;
    }
  | {
      apply: false;
      reason: string;
      diagnostic: string | null;
    };

export type WebhookDeliveryWork = {
  shopId: string;
  topic: OrderFactsWebhookTopic;
  payloadSchemaVersion: string;
  projection: Record<string, unknown>;
  applicationKey: string;
  payloadDigest: string;
  sourceJobType: string;
  rootDurableJobId: string;
  applyingDurableJobId: string;
  durableJobId: string;
  jobAttemptId?: string | null;
  correlationId?: string | null;
  receivedAt: Date;
  leaseDurationMs?: number;
};

export type LegacyWebhookRunner = (
  topic: string,
  db: OrderApplyDb,
  payload: Record<string, unknown>,
) => Promise<void>;

export type OrderFactsWebhookResult = {
  status: "applied" | "already_applied" | "incomplete" | "blocked" | "noop";
  apply?: OrderApplyBatchResult;
  reason: string;
  orderGid: string | null;
  refundGid: string | null;
};

export type JsonlObject = {
  id?: unknown;
  __parentId?: unknown;
  [key: string]: unknown;
};

export type JsonlAssemblyStatus =
  | "COMPLETE"
  | "TRUNCATED"
  | "DUPLICATE"
  | "MIS_PARENTED"
  | "OPEN_PARENT_BOUND"
  | "MALFORMED";

export type JsonlAssemblyResult =
  | {
      status: "COMPLETE";
      rootGids: string[];
      objectCount: number;
      rootCount: number;
    }
  | {
      status: Exclude<JsonlAssemblyStatus, "COMPLETE">;
      reason: string;
      rootGids: string[];
      objectCount: number;
      rootCount: number;
    };

export type CoverageRecord = {
  mode: "incremental" | "window_sweep" | "sample";
  examinedGids: number;
  appliedGids: number;
  incompleteGids: number;
  outOfWindowGids: number;
  behindWatermarkExamined: number;
  watermarkPersisted: boolean;
  cursorValue: string | null;
};

export type OrderFactsHealthEvidence = {
  unresolvedCoverageCount: number;
  openDiagnosticIssueCount: number;
  incompletePaginationCount: number;
  quarantineOpenCount: number;
};

export type BulkSubmitIntent = {
  shopId: string;
  fenceGeneration: bigint;
  innerQuery: string;
  schemaGatePassed: boolean;
  bulkRuleGatePassed: boolean;
};

export type OrderFactsReceipt = OrderApplyReceiptInput;
