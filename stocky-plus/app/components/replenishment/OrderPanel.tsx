import { useState } from "react";
import { useFetcher } from "react-router";
import { formatMoney } from "../../lib/decimal-format";
import type { OrderGroup } from "../../lib/replenishment/worksheet/orders.server";
import type { WorksheetActionResult } from "./types";

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

function estimatedCost(group: OrderGroup): string {
  if (group.costByCurrency.length === 0) return "No supplier costs";
  const totals = group.costByCurrency
    .map((cost) => formatMoney(cost.amount, cost.currencyCode))
    .join(" + ");
  return group.linesWithoutCost > 0
    ? `${totals}, plus ${plural(group.linesWithoutCost, "row", "rows")} without a cost`
    : totals;
}

/**
 * The rows ready to order, grouped by supplier, and the buttons that turn a
 * group into a draft purchase order.
 */
export function OrderPanel({
  groups,
  linesWithoutSupplier,
  destination,
  locations,
}: {
  groups: OrderGroup[];
  linesWithoutSupplier: number;
  /** The worksheet's own location, or null when it plans all locations together. */
  destination: { gid: string; name: string } | null;
  locations: Array<{ gid: string; name: string }>;
}) {
  const fetcher = useFetcher<WorksheetActionResult>();
  const [locationGid, setLocationGid] = useState(destination?.gid ?? locations[0]?.gid ?? "");

  const result = fetcher.data?.intent === "createOrders" ? fetcher.data : null;
  const busy = fetcher.state !== "idle";
  const changedLines = result?.ok
    ? result.orders.reduce((count, order) => count + order.changedLines, 0)
    : 0;
  const submitted = fetcher.formData?.getAll("supplierId") ?? [];

  const create = (supplierIds: string[]) => {
    const form = new FormData();
    form.set("intent", "createOrders");
    form.set("locationGid", locationGid);
    for (const supplierId of supplierIds) form.append("supplierId", supplierId);
    fetcher.submit(form, { method: "post" });
  };

  return (
    <s-section heading="Purchase orders">
      <s-stack direction="block" gap="base">
        {result?.ok && result.orders.length > 0 && (
          <s-banner
            tone="success"
            heading={
              result.orders.length === 1
                ? `Draft purchase order ${result.orders[0].purchaseOrderNumber} created`
                : `${result.orders.length} draft purchase orders created`
            }
          >
            <s-stack direction="block" gap="small-200">
              <s-unordered-list>
                {result.orders.map((order) => (
                  <s-list-item key={order.purchaseOrderId}>
                    {order.purchaseOrderNumber} for {order.supplierName},{" "}
                    {plural(order.lines, "row", "rows")}
                  </s-list-item>
                ))}
              </s-unordered-list>
              <s-link href="/app/purchase-orders">Review and send them in Purchase orders</s-link>
            </s-stack>
          </s-banner>
        )}
        {changedLines > 0 && (
          <s-banner tone="warning" heading="Some rows changed while the order was being created">
            <s-paragraph>
              {plural(changedLines, "row is", "rows are")} on a new draft at the earlier quantity
              but still open here. Check the draft before ordering{" "}
              {changedLines === 1 ? "it" : "them"} again.
            </s-paragraph>
          </s-banner>
        )}
        {result?.ok && result.orders.length === 0 && (
          <s-banner tone="info">
            <s-paragraph>
              Those rows were already on a purchase order, so nothing new was created.
            </s-paragraph>
          </s-banner>
        )}
        {result && !result.ok && (
          <s-banner tone="critical" heading="No purchase order was created">
            <s-paragraph>{result.message}</s-paragraph>
          </s-banner>
        )}

        {groups.length === 0 ? (
          <s-paragraph>
            {linesWithoutSupplier > 0
              ? "The rows with a quantity to order have no supplier, so there is nothing to put on a purchase order yet."
              : "Nothing is waiting to be ordered. Rows appear here when their order quantity is above zero."}
          </s-paragraph>
        ) : (
          <>
            {destination ? (
              <s-text>Deliver to {destination.name}.</s-text>
            ) : locations.length === 0 ? (
              <s-banner tone="warning">
                <s-paragraph>
                  Your store has no active location to deliver to. Purchase orders can be created
                  once locations have synced from Shopify.
                </s-paragraph>
              </s-banner>
            ) : (
              <s-select
                label="Deliver to"
                value={locationGid}
                onChange={(event) => setLocationGid(event.currentTarget.value)}
              >
                {locations.map((location) => (
                  <s-option key={location.gid} value={location.gid}>
                    {location.name}
                  </s-option>
                ))}
              </s-select>
            )}

            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Supplier</s-table-header>
                <s-table-header format="numeric">Rows</s-table-header>
                <s-table-header format="numeric">Units</s-table-header>
                <s-table-header listSlot="secondary">Estimated cost</s-table-header>
                <s-table-header>Create</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {groups.map((group) => (
                  <s-table-row key={group.supplierId}>
                    <s-table-cell>{group.supplierName}</s-table-cell>
                    <s-table-cell>{group.lines.toLocaleString("en-US")}</s-table-cell>
                    <s-table-cell>{group.units.toLocaleString("en-US")}</s-table-cell>
                    <s-table-cell>{estimatedCost(group)}</s-table-cell>
                    <s-table-cell>
                      <s-button
                        accessibilityLabel={`Create a draft purchase order for ${group.supplierName}`}
                        {...(busy || !locationGid ? { disabled: true } : {})}
                        {...(busy && submitted.includes(group.supplierId) ? { loading: true } : {})}
                        onClick={() => create([group.supplierId])}
                      >
                        Create draft
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>

            {groups.length > 1 && (
              <s-button
                variant="primary"
                {...(busy || !locationGid ? { disabled: true } : {})}
                onClick={() => create(groups.map((group) => group.supplierId))}
              >
                Create all {groups.length} draft purchase orders
              </s-button>
            )}
            <s-text color="subdued">
              Drafts are not sent to suppliers. Each line is priced at the supplier's price for
              its quantity, and you can change anything on the draft before ordering.
            </s-text>
          </>
        )}

        {linesWithoutSupplier > 0 && (
          <s-text color="subdued">
            {plural(linesWithoutSupplier, "row has", "rows have")} a quantity to order but no
            supplier, or more than one supplier with none chosen. Add the variant to a supplier,
            or generate a worksheet for one supplier, to order{" "}
            {linesWithoutSupplier === 1 ? "it" : "them"} here.
          </s-text>
        )}
      </s-stack>
    </s-section>
  );
}
