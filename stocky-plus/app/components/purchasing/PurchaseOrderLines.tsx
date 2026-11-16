import { Form } from "react-router";
import { formatDecimal, formatMoney } from "../../lib/decimal-format";
import type { FieldErrors } from "../../lib/purchasing/form-input";
import { submitOnEnter } from "../../lib/submit-on-enter";
import type {
  PurchaseOrderLineView,
  PurchaseOrderView,
} from "../../services/purchasing/purchase-order-view.server";

const UNIT_COST_DIGITS = { maximumFractionDigits: 4 };

function lineCodes(line: PurchaseOrderLineView): string {
  return [
    line.sku ? `SKU ${line.sku}` : null,
    line.vendorSku ? `Supplier SKU ${line.vendorSku}` : null,
    line.packSize && line.packSize > 1
      ? `Pack of ${line.packSize}${line.orderUnit ? ` (${line.orderUnit})` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function PurchaseOrderLines({
  order,
  editLineId,
}: {
  order: PurchaseOrderView;
  editLineId: string | null;
}) {
  if (order.lines.length === 0) {
    return (
      <s-paragraph>
        {order.permissions.editLines
          ? "No products yet. Search below to add the first one."
          : "This purchase order has no products."}
      </s-paragraph>
    );
  }

  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Product</s-table-header>
        <s-table-header format="numeric">Ordered</s-table-header>
        <s-table-header format="numeric">Received</s-table-header>
        <s-table-header format="numeric">Remaining</s-table-header>
        <s-table-header format="currency">Unit cost</s-table-header>
        <s-table-header format="currency">Line total</s-table-header>
        <s-table-header format="currency">Landed unit cost</s-table-header>
        <s-table-header format="numeric">Margin</s-table-header>
        {order.permissions.editLines && <s-table-header>Edit</s-table-header>}
      </s-table-header-row>
      <s-table-body>
        {order.lines.map((line) => {
          const codes = lineCodes(line);
          return (
            <s-table-row key={line.id}>
              <s-table-cell>
                <s-stack direction="block" gap="small-400">
                  <s-text>{line.name}</s-text>
                  {codes && <s-text color="subdued">{codes}</s-text>}
                  {line.note && <s-text color="subdued">{line.note}</s-text>}
                  {(line.missingCost || line.cancelledQty > 0) && (
                    <s-stack direction="inline" gap="small-200">
                      {line.missingCost && (
                        <s-badge tone="warning">No cost on file</s-badge>
                      )}
                      {line.cancelledQty > 0 && (
                        <s-badge>{line.cancelledQty} cancelled</s-badge>
                      )}
                    </s-stack>
                  )}
                </s-stack>
              </s-table-cell>
              <s-table-cell>{line.orderedQty}</s-table-cell>
              <s-table-cell>{line.receivedQty}</s-table-cell>
              <s-table-cell>{line.remainingQty}</s-table-cell>
              <s-table-cell>
                {formatMoney(line.unitCost, order.currency, UNIT_COST_DIGITS)}
                {line.discountPercentInput
                  ? ` less ${formatDecimal(line.discountPercentInput)}%`
                  : ""}
              </s-table-cell>
              <s-table-cell>
                {formatMoney(line.netAmount, order.currency)}
              </s-table-cell>
              <s-table-cell>
                {formatMoney(
                  line.landedUnitCost,
                  order.currency,
                  UNIT_COST_DIGITS,
                )}
              </s-table-cell>
              <s-table-cell>
                {line.marginPercent === null
                  ? "—"
                  : `${formatDecimal(line.marginPercent)}%`}
              </s-table-cell>
              {order.permissions.editLines && (
                <s-table-cell>
                  {line.id === editLineId ? (
                    <s-text color="subdued">Editing below</s-text>
                  ) : (
                    <s-link
                      href={`/app/purchase-orders/${order.id}?edit=${encodeURIComponent(line.id)}`}
                    >
                      Edit
                    </s-link>
                  )}
                </s-table-cell>
              )}
            </s-table-row>
          );
        })}
      </s-table-body>
    </s-table>
  );
}

export function PurchaseOrderLineEditor({
  order,
  line,
  fieldErrors,
}: {
  order: PurchaseOrderView;
  line: PurchaseOrderLineView;
  fieldErrors: FieldErrors;
}) {
  const priceLocked = line.receivedQty > 0;
  const isDraft = order.status === "DRAFT";
  const openUnits = line.orderedQty - line.receivedQty;

  return (
    <s-section heading={`Edit ${line.name}`}>
      <s-stack direction="block" gap="base">
        <Form method="post" onKeyDown={submitOnEnter}>
          <input type="hidden" name="intent" value="saveLine" />
          <input type="hidden" name="version" value={order.version} />
          <input type="hidden" name="lineId" value={line.id} />
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-number-field
                label="Quantity"
                name="quantity"
                value={String(line.orderedQty)}
                min={Math.max(1, line.receivedQty + line.cancelledQty)}
                step={1}
                error={fieldErrors.quantity}
                required
              />
              <s-number-field
                label={`Unit cost (${order.currency})`}
                name="unitCost"
                value={line.manualCost || priceLocked ? line.unitCostInput : ""}
                placeholder={line.manualCost ? undefined : line.unitCostInput}
                min={0}
                step={0.0001}
                details={
                  priceLocked
                    ? "Fixed, because stock has been received on this line."
                    : "Leave empty to use the supplier's price for this quantity."
                }
                readOnly={priceLocked}
                error={fieldErrors.unitCost}
              />
              <s-number-field
                label="Discount %"
                name="discountPercent"
                value={line.discountPercentInput}
                min={0}
                max={100}
                step={0.0001}
                readOnly={priceLocked}
                error={fieldErrors.discountPercent}
              />
              <s-number-field
                label="Tax rate %"
                name="taxRatePercent"
                value={line.taxRatePercentInput}
                min={0}
                max={100}
                step={0.0001}
                readOnly={priceLocked}
                error={fieldErrors.taxRatePercent}
              />
            </s-stack>
            <s-text-field
              label="Line note"
              name="note"
              value={line.note ?? ""}
              maxLength={1000}
              error={fieldErrors.note}
            />
            <s-stack direction="inline" gap="small-200">
              <s-button type="submit" variant="primary">
                Save line
              </s-button>
              <s-button
                href={`/app/purchase-orders/${order.id}`}
                variant="tertiary"
              >
                Done
              </s-button>
            </s-stack>
          </s-stack>
        </Form>

        {isDraft ? (
          <Form method="post">
            <input type="hidden" name="intent" value="removeLine" />
            <input type="hidden" name="version" value={order.version} />
            <input type="hidden" name="lineId" value={line.id} />
            <s-button type="submit" tone="critical" variant="secondary">
              Remove line
            </s-button>
          </Form>
        ) : (
          openUnits > 0 && (
            <Form method="post" onKeyDown={submitOnEnter}>
              <input type="hidden" name="intent" value="cancelUnits" />
              <input type="hidden" name="version" value={order.version} />
              <input type="hidden" name="lineId" value={line.id} />
              <s-stack direction="inline" gap="small-200" alignItems="end">
                <s-number-field
                  label="Units the supplier will not deliver"
                  name="cancelledQty"
                  value={String(line.cancelledQty)}
                  min={0}
                  max={openUnits}
                  step={1}
                  details={`Up to ${openUnits}. Cancelled units stop counting as incoming stock.`}
                  error={fieldErrors.cancelledQty}
                />
                <s-button type="submit" variant="secondary">
                  Save cancelled units
                </s-button>
              </s-stack>
            </Form>
          )
        )}
      </s-stack>
    </s-section>
  );
}
