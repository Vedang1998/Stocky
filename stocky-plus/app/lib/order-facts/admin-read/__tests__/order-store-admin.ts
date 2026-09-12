import { createMockAdmin, operationNameOf } from "./mock-admin";
import {
  agreementNode,
  connectionOfRefundChildren,
  emptyConnection,
  lineNode,
  paginate,
  refundNode,
} from "./fixtures";

type Line = ReturnType<typeof lineNode>;
type Agreement = ReturnType<typeof agreementNode>;
type Refund = ReturnType<typeof refundNode>;

export type OrderStore = {
  header: Record<string, unknown>;
  lines: Line[];
  agreements: Agreement[];
  refunds: Refund[];
  nullOrder?: boolean;
  /** When true, Order.refunds is omitted from the JSON object. */
  omitRefunds?: boolean;
  /** When set, Order.refunds is this value instead of the mapped refund array. */
  rawRefunds?: unknown;
  /** Mutate store.header before each OrderFactById / sales-page response. */
  onOrderQuery?: (callIndex: number) => void;
};

function intVar(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export function createOrderStoreAdmin(store: OrderStore) {
  let orderQueryIndex = 0;
  return createMockAdmin((query, variables) => {
    const name = operationNameOf(query);
    if (name === "OrderFactById") {
      orderQueryIndex += 1;
      store.onOrderQuery?.(orderQueryIndex);
      if (store.nullOrder) {
        return { data: { order: null } };
      }
      const lineFirst = intVar(variables?.lineFirst, 100);
      const agrFirst = intVar(variables?.agrFirst, 100);
      const refundLineFirst = intVar(variables?.refundLineFirst, 100);
      const adjFirst = intVar(variables?.adjFirst, 100);
      const shipFirst = intVar(variables?.shipRefundFirst, 100);
      const txnFirst = intVar(variables?.txnFirst, 100);
      const lineAfter = variables?.lineAfter ?? null;
      const agrAfter = variables?.agrAfter ?? null;
      const saleFirst = intVar(variables?.saleFirst, 100);
      return {
        data: {
          order: {
            ...store.header,
            lineItems: paginate(store.lines, lineFirst, lineAfter),
            agreements: paginate(
              store.agreements.map((agreement) => ({
                ...agreement,
                sales: paginate(agreement.sales, saleFirst, null),
              })),
              agrFirst,
              agrAfter,
            ),
            ...(store.omitRefunds
              ? {}
              : {
                  refunds:
                    "rawRefunds" in store
                      ? store.rawRefunds
                      : store.refunds.map((refund) => ({
                          ...refund,
                          refundLineItems: paginate(
                            refund.refundLineItems,
                            refundLineFirst,
                            null,
                          ),
                          orderAdjustments: paginate(
                            refund.orderAdjustments,
                            adjFirst,
                            null,
                          ),
                          refundShippingLines: paginate(
                            refund.refundShippingLines,
                            shipFirst,
                            null,
                          ),
                          transactions: paginate(
                            refund.transactions,
                            txnFirst,
                            null,
                          ),
                        })),
                }),
          },
        },
        extensions: { cost: { requestedQueryCost: 10 } },
      };
    }

    if (name === "OrderAgreementSalesPage") {
      orderQueryIndex += 1;
      store.onOrderQuery?.(orderQueryIndex);
      if (store.nullOrder) return { data: { order: null } };
      const after = variables?.agreementAfter ?? null;
      const saleFirst = intVar(variables?.saleFirst, 100);
      const saleAfter = variables?.saleAfter ?? null;
      const page = paginate(store.agreements, 1, after);
      const agreement = page.edges[0]?.node;
      if (!agreement) {
        return {
          data: {
            order: {
              id: store.header.id,
              updatedAt: store.header.updatedAt,
              currencyCode: store.header.currencyCode,
              agreements: emptyConnection(),
            },
          },
        };
      }
      return {
          data: {
            order: {
              id: store.header.id,
              updatedAt: store.header.updatedAt,
              currencyCode: store.header.currencyCode,
              agreements: {
              pageInfo: page.pageInfo,
              edges: [
                {
                  cursor: page.edges[0]!.cursor,
                  node: {
                    ...agreement,
                    sales: paginate(agreement.sales, saleFirst, saleAfter),
                  },
                },
              ],
            },
          },
        },
        extensions: { cost: { requestedQueryCost: 5 } },
      };
    }

    if (name === "RefundFactById") {
      const id = variables?.id;
      const refund = store.refunds.find((item) => item.id === id);
      if (!refund) return { data: { refund: null } };
      return {
        data: {
          refund: {
            ...refund,
            refundLineItems: connectionOfRefundChildren(
              refund,
              variables?.refundLineFirst,
              variables?.refundLineAfter,
              "refundLineItems",
            ),
            orderAdjustments: connectionOfRefundChildren(
              refund,
              variables?.adjFirst,
              variables?.adjAfter,
              "orderAdjustments",
            ),
            refundShippingLines: connectionOfRefundChildren(
              refund,
              variables?.shipRefundFirst,
              variables?.shipRefundAfter,
              "refundShippingLines",
            ),
            transactions: connectionOfRefundChildren(
              refund,
              variables?.txnFirst,
              variables?.txnAfter,
              "transactions",
            ),
          },
        },
        extensions: { cost: { requestedQueryCost: 8 } },
      };
    }

    if (name === "ShopTimezoneCurrency") {
      return {
        data: {
          shop: {
            id: "gid://shopify/Shop/1",
            ianaTimezone: "America/New_York",
            currencyCode: "USD",
          },
        },
        extensions: { cost: { requestedQueryCost: 1 } },
      };
    }

    if (name === "CurrentAppInstallationAccessScopes") {
      return {
        data: {
          currentAppInstallation: {
            accessScopes: [
              { handle: "read_orders" },
              { handle: "read_products" },
            ],
          },
        },
        extensions: { cost: { requestedQueryCost: 1 } },
      };
    }

    throw new Error(`unexpected query ${name ?? query.slice(0, 80)}`);
  });
}
