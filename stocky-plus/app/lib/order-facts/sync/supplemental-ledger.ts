/**
 * D-owned supplemental agreement/sale/refund ledger for every imported order.
 * Reuses B execution, clocks, and pagination. Does not re-read bulk lines.
 */
import {
  ORDER_ADMIN_READ_MAX_REQUESTS,
  ORDER_ADMIN_READ_PAGE_SIZE,
  readRefundFact,
  type OrderAdminReadContext,
  type OrderAgreementRead,
  type RefundRead,
} from "../admin-read";
import { completeAgreementSales, mapAgreementFromFirstPage } from "../admin-read/agreements";
import { executeBudgetedQuery } from "../admin-read/budgeted-execute";
import {
  assertAdvancingCursor,
  mapConnectionPage,
  type CursorConnection,
} from "../admin-read/cursor-pagination";
import { extractSelectedRoot } from "../admin-read/envelope";
import { OrderPaginationError } from "../admin-read/errors";
import { createRequestCostAccumulator } from "../admin-read/execute";
import type { AgreementNode } from "../admin-read/map-nodes";
import { resolveReadOptions } from "../admin-read/read-options";
import { assertUniqueNonEmptyGids, requireObjectList } from "../admin-read/required-list";
import { walkErrorToResult } from "../admin-read/result";
import { assertOrderClockPin, pinOrderClock } from "../admin-read/snapshot-pin";
import type { AgreementSnapshot, RefundSnapshot } from "../apply/types";
import { mapAgreementRead, mapRefundRead } from "./mapper";
import type { LedgerQueryCounts } from "./types";
import {
  createDTransportBudget,
  snapshotDTransportBudget,
  wrapAdminWithDTransportBudget,
  type DTransportAccounting,
  type DTransportBudget,
} from "./transport-budget";

export const ORDER_FACTS_IMPORT_LEDGER_QUERY = `#graphql
  query OrderFactsImportLedger(
    $orderId: ID!
    $agrFirst: Int!
    $agrAfter: String
    $saleFirst: Int!
  ) {
    order(id: $orderId) {
      id
      updatedAt
      currencyCode
      confirmed
      refunds {
        id
      }
      agreements(first: $agrFirst, after: $agrAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            __typename
            id
            happenedAt
            reason
            ... on OrderAgreement {
              id
              happenedAt
              reason
            }
            ... on OrderEditAgreement {
              id
              happenedAt
              reason
            }
            ... on RefundAgreement {
              id
              happenedAt
              reason
              refund {
                id
              }
            }
            ... on ReturnAgreement {
              id
              happenedAt
              reason
            }
            sales(first: $saleFirst) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                cursor
                node {
                  __typename
                  id
                  quantity
                  lineType
                  actionType
                  totalAmount {
                    shopMoney {
                      amount
                      currencyCode
                    }
                    presentmentMoney {
                      amount
                      currencyCode
                    }
                  }
                  ... on ProductSale {
                    lineItem {
                      id
                    }
                  }
                  ... on GiftCardSale {
                    lineItem {
                      id
                    }
                  }
                  ... on TipSale {
                    lineItem {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

type LedgerOrderNode = {
  id?: unknown;
  updatedAt?: unknown;
  currencyCode?: unknown;
  confirmed?: unknown;
  refunds?: unknown;
  agreements?: CursorConnection<AgreementNode>;
};

type LedgerQueryData = {
  order?: LedgerOrderNode | null;
};

export type ImportLedgerResult =
  | {
      status: "complete";
      agreements: AgreementSnapshot[];
      refunds: RefundSnapshot[];
      counts: LedgerQueryCounts;
      transport: DTransportAccounting;
    }
  | {
      status: "drift";
      reason: string;
      counts: LedgerQueryCounts;
      transport: DTransportAccounting;
    }
  | {
      status: "incomplete";
      reason: string;
      counts: LedgerQueryCounts;
      transport: DTransportAccounting;
    }
  | {
      status: "failure";
      reason: string;
      counts: LedgerQueryCounts;
      transport: DTransportAccounting;
    };

function emptyCounts(): LedgerQueryCounts {
  return {
    initial: 0,
    recheck: 0,
    agreement: 0,
    sale: 0,
    refund: 0,
    fallback: 0,
    fallbackOrders: 0,
    fallbackTransportAttempts: 0,
    throttle: 0,
  };
}

function addCounts(target: LedgerQueryCounts, source: LedgerQueryCounts): void {
  target.initial += source.initial;
  target.recheck += source.recheck;
  target.agreement += source.agreement;
  target.sale += source.sale;
  target.refund += source.refund;
  target.fallback += source.fallback;
  target.fallbackOrders += source.fallbackOrders;
  target.fallbackTransportAttempts += source.fallbackTransportAttempts;
  target.throttle += source.throttle;
}

function refundGidMembership(nodes: Array<{ id?: unknown }>): string[] {
  return nodes
    .map((node) => (typeof node.id === "string" ? node.id : ""))
    .filter((id) => id !== "")
    .slice()
    .sort();
}

function sameRefundMembership(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

export function mergeLedgerCounts(
  target: LedgerQueryCounts,
  source: LedgerQueryCounts,
): LedgerQueryCounts {
  addCounts(target, source);
  return target;
}

async function loadLedgerPage(
  context: OrderAdminReadContext,
  orderGid: string,
  variables: {
    agrFirst: number;
    agrAfter: string | null;
    saleFirst: number;
  },
  cost: ReturnType<typeof createRequestCostAccumulator>,
  maxRequests: number,
  extras: { resourceKind: "Order"; requestedGid: string; phase: "initial" | "agreements" | "version_recheck" },
): Promise<LedgerOrderNode> {
  const json = await executeBudgetedQuery<LedgerQueryData>(
    context.admin,
    ORDER_FACTS_IMPORT_LEDGER_QUERY,
    {
      orderId: orderGid,
      agrFirst: variables.agrFirst,
      agrAfter: variables.agrAfter,
      saleFirst: variables.saleFirst,
    },
    cost,
    maxRequests,
    extras,
  );
  const extracted = extractSelectedRoot<LedgerOrderNode>(json, "order", extras);
  if (extracted.status === "explicit_null") {
    throw Object.assign(new Error("order_facts_ledger_null"), {
      code: "order_facts_ledger_null",
    });
  }
  return extracted.value;
}

export async function readOrderFactsImportLedger(input: {
  context: OrderAdminReadContext;
  orderGid: string;
  bulkUpdatedAt: string;
  bulkCurrencyCode: string;
  pageSize?: number;
  maxRequests?: number;
  transportBudget?: DTransportBudget;
}): Promise<ImportLedgerResult> {
  const counts = emptyCounts();
  const cost = createRequestCostAccumulator();
  const extras = {
    resourceKind: "Order" as const,
    requestedGid: input.orderGid,
    phase: "initial" as const,
  };
  const budget =
    input.transportBudget ?? createDTransportBudget(ORDER_ADMIN_READ_MAX_REQUESTS);
  const withTransport = <
    T extends {
      status: ImportLedgerResult["status"];
      counts: LedgerQueryCounts;
    },
  >(
    result: T,
  ): T & { transport: DTransportAccounting } => ({
    ...result,
    transport: snapshotDTransportBudget(budget),
  });
  try {
    const { pageSize, maxRequests } = resolveReadOptions(
      {
        pageSize: input.pageSize ?? ORDER_ADMIN_READ_PAGE_SIZE,
        maxRequests: input.maxRequests ?? ORDER_ADMIN_READ_MAX_REQUESTS,
      },
      { ...extras, phase: "options" },
    );
    if (!input.transportBudget) {
      budget.maxRequests = maxRequests;
    }
    const wrappedContext: OrderAdminReadContext = {
      ...input.context,
      admin: input.transportBudget
        ? input.context.admin
        : wrapAdminWithDTransportBudget(input.context.admin, budget, extras),
    };
    budget.phase = "initial";
    counts.initial += 1;
    const first = await loadLedgerPage(
      wrappedContext,
      input.orderGid,
      { agrFirst: pageSize, agrAfter: null, saleFirst: pageSize },
      cost,
      maxRequests,
      extras,
    );
    const pin = pinOrderClock(first);
    if (pin.gid !== input.orderGid) {
      return withTransport({
        status: "drift",
        reason: "ledger_identity_mismatch",
        counts,
      });
    }
    if (pin.updatedAt !== input.bulkUpdatedAt) {
      return withTransport({
        status: "drift",
        reason: "ledger_updated_at_drift",
        counts,
      });
    }
    if (pin.currencyCode !== input.bulkCurrencyCode) {
      return withTransport({
        status: "drift",
        reason: "ledger_currency_drift",
        counts,
      });
    }

    const agrExtrasFirst = { ...extras, phase: "agreements" as const };
    const pending: Array<
      ReturnType<typeof mapAgreementFromFirstPage> & {
        precedingCursor: string | null;
      }
    > = [];
    const seenAgreementIds = new Set<string>();
    const seenAgreementCursors = new Set<string>();
    let precedingCursor: string | null = null;
    let agrPage = mapConnectionPage({
      connection: first.agreements,
      connectionName: "agreements",
      mapNode: (node, cursor) =>
        mapAgreementFromFirstPage(node, cursor, pin.currencyCode, agrExtrasFirst),
      nodeIdentity: (node) => node.id,
      extras: agrExtrasFirst,
    });
    const pushPage = (
      page: typeof agrPage,
      extrasForPage: typeof agrExtrasFirst,
    ) => {
      for (let index = 0; index < page.items.length; index += 1) {
        const mapped = page.items[index]!;
        const edgeCursor = page.edgeCursors[index]!;
        if (seenAgreementIds.has(mapped.agreement.id)) {
          throw new OrderPaginationError(
            `duplicate agreement GID across pages: ${mapped.agreement.id}`,
            extrasForPage,
          );
        }
        seenAgreementIds.add(mapped.agreement.id);
        pending.push({ ...mapped, precedingCursor });
        precedingCursor = edgeCursor;
      }
    };
    pushPage(agrPage, agrExtrasFirst);
    while (agrPage.hasNextPage) {
      budget.phase = "agreement";
      const agrExtras = { ...extras, phase: "agreements" as const };
      assertAdvancingCursor(
        "agreements",
        agrPage.endCursor!,
        seenAgreementCursors,
        agrExtras,
      );
      counts.agreement += 1;
      const extra = await loadLedgerPage(
        wrappedContext,
        input.orderGid,
        {
          agrFirst: pageSize,
          agrAfter: agrPage.endCursor,
          saleFirst: pageSize,
        },
        cost,
        maxRequests,
        agrExtras,
      );
      assertOrderClockPin(pin, extra, agrExtras);
      agrPage = mapConnectionPage({
        connection: extra.agreements,
        connectionName: "agreements",
        mapNode: (node, cursor) =>
          mapAgreementFromFirstPage(node, cursor, pin.currencyCode, agrExtras),
        nodeIdentity: (node) => node.id,
        requireNonEmpty: true,
        extras: agrExtras,
      });
      pushPage(agrPage, agrExtras);
    }

    const agreements: OrderAgreementRead[] = [];
    for (const row of pending) {
      if (!row.salesHasNextPage) {
        agreements.push({ ...row.agreement, salesComplete: true });
        continue;
      }
      budget.phase = "sale";
      const before = budget.used;
      agreements.push(
        await completeAgreementSales(
          wrappedContext,
          input.orderGid,
          row.agreement,
          row.precedingCursor,
          {
            items: row.agreement.sales,
            hasNextPage: row.salesHasNextPage,
            endCursor: row.salesEndCursor,
          },
          pin,
          cost,
          pageSize,
          ORDER_ADMIN_READ_MAX_REQUESTS,
        ),
      );
      counts.sale += Math.max(0, budget.used - before);
    }

    const refundExtras = { ...extras, phase: "refunds" as const };
    const refundNodes = requireObjectList<{ id?: unknown }>(
      first.refunds,
      "order.refunds",
      refundExtras,
    );
    assertUniqueNonEmptyGids(refundNodes, "order.refunds", refundExtras);
    const initialRefundMembership = refundGidMembership(refundNodes);
    const refunds: RefundRead[] = [];
    for (const node of refundNodes) {
      const refundGid = typeof node.id === "string" ? node.id : "";
      if (budget.used >= maxRequests) {
        return withTransport({
          status: "incomplete",
          reason: "ledger_budget_exhausted",
          counts,
        });
      }
      budget.phase = "refund";
      const before = budget.used;
      const refundRead = await readRefundFact(wrappedContext, refundGid, {
        pageSize,
        maxRequests: ORDER_ADMIN_READ_MAX_REQUESTS,
        orderCurrencyCode: pin.currencyCode,
      });
      counts.refund += Math.max(0, budget.used - before);
      if (refundRead.status === "incomplete") {
        return withTransport({
          status: "incomplete",
          reason: refundRead.reason,
          counts,
        });
      }
      if (refundRead.status === "null_observed") {
        return withTransport({
          status: "drift",
          reason: "refund_null_observed",
          counts,
        });
      }
      if (refundRead.status !== "complete") {
        return withTransport({
          status: "failure",
          reason:
            refundRead.status === "failure"
              ? refundRead.reason
              : "refund_read_unusable",
          counts,
        });
      }
      refunds.push(refundRead.value);
    }

    if (budget.used >= maxRequests) {
      return withTransport({
        status: "incomplete",
        reason: "ledger_budget_exhausted",
        counts,
      });
    }
    budget.phase = "recheck";
    counts.recheck += 1;
    const recheck = await loadLedgerPage(
      wrappedContext,
      input.orderGid,
      { agrFirst: 1, agrAfter: null, saleFirst: 1 },
      cost,
      maxRequests,
      { ...extras, phase: "version_recheck" },
    );
    assertOrderClockPin(pin, recheck, {
      ...extras,
      phase: "version_recheck",
    });
    if (recheck.id !== first.id || pin.gid !== input.orderGid) {
      return withTransport({
        status: "drift",
        reason: "ledger_identity_mismatch",
        counts,
      });
    }
    const finalRefundExtras = { ...extras, phase: "refunds" as const };
    const finalRefundNodes = requireObjectList<{ id?: unknown }>(
      recheck.refunds,
      "order.refunds",
      finalRefundExtras,
    );
    assertUniqueNonEmptyGids(finalRefundNodes, "order.refunds", finalRefundExtras);
    const finalRefundMembership = refundGidMembership(finalRefundNodes);
    if (!sameRefundMembership(initialRefundMembership, finalRefundMembership)) {
      return withTransport({
        status: "drift",
        reason: "ledger_refund_membership_drift",
        counts,
      });
    }

    return withTransport({
      status: "complete",
      agreements: agreements.map(mapAgreementRead),
      refunds: refunds.map((refund) => mapRefundRead(refund, input.orderGid)),
      counts,
    });
  } catch (error) {
    const transport = snapshotDTransportBudget(budget);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "order_facts_ledger_null") {
      return { status: "drift", reason: "ledger_order_null", counts, transport };
    }
    const walked = walkErrorToResult(error, cost, extras);
    if (walked.status === "incomplete") {
      return {
        status: "incomplete",
        reason: walked.reason,
        counts,
        transport,
      };
    }
    const detail = error instanceof Error ? error.message : String(error);
    if (/throttl/i.test(detail)) counts.throttle += 1;
    if (/updatedAt drifted|currencyCode drifted|IDENTITY_MISMATCH/.test(detail)) {
      return { status: "drift", reason: detail, counts, transport };
    }
    return {
      status: "failure",
      reason: walked.status === "failure" ? walked.detail : detail,
      counts,
      transport,
    };
  }
}
