import { Form } from "react-router";
import { formatMoment } from "../../lib/purchasing/display";
import {
  canResumeReceipt,
  canReverseReceipt,
  RECEIPT_STATUS_LABELS,
  RECEIPT_STATUS_TONES,
} from "../../lib/purchasing/receipts";
import { submitOnEnter } from "../../lib/submit-on-enter";
import type { PurchaseOrderView } from "../../services/purchasing/purchase-order-view.server";
import type { ReceiptView } from "../../services/purchasing/receiving.server";

function receiptLines(
  receipt: ReceiptView,
  lineNames: Map<string, string>,
): string[] {
  return receipt.lines.map((line) => {
    const name =
      lineNames.get(line.lineItemId) ?? "A product no longer on the order";
    const parts = [`${line.postedQty} of ${line.acceptedQty} received`];
    if (line.reversedQty > 0) parts.push(`${line.reversedQty} reversed`);
    if (line.rejectedQty > 0) {
      parts.push(
        `${line.rejectedQty} rejected${line.rejectReason ? ` (${line.rejectReason})` : ""}`,
      );
    }
    if (line.errorMessage) parts.push(line.errorMessage);
    return `${name}: ${parts.join(", ")}`;
  });
}

export function ReceiptsSection({
  order,
  receipts,
  confirmReverseId,
  timeZone,
  receivingEnabled,
}: {
  order: PurchaseOrderView;
  receipts: ReceiptView[];
  /** The receipt whose reversal is being confirmed, if any. */
  confirmReverseId: string | null;
  timeZone: string | null;
  receivingEnabled: boolean;
}) {
  const { receivingDenial } = order.permissions;
  const lineNames = new Map(order.lines.map((line) => [line.id, line.name]));
  const receivable =
    receivingDenial === null && order.totals.remainingUnits > 0;

  return (
    <s-section heading="Receiving">
      <s-stack direction="block" gap="base">
        {!receivingEnabled && (
          <s-banner
            tone="info"
            heading="Receiving is turned off for this store"
          >
            <s-paragraph>
              Deliveries cannot be received yet, so no stock changes in Shopify
              from this page.
            </s-paragraph>
          </s-banner>
        )}

        <s-stack direction="inline" gap="base" alignItems="center">
          <s-text>
            {order.totals.receivedUnits} of {order.totals.units} units received
            {order.totals.remainingUnits > 0
              ? `, ${order.totals.remainingUnits} still to come.`
              : "."}
          </s-text>
          {receivable && (
            <s-button
              href={`/app/purchase-orders/${order.id}/receive`}
              variant="primary"
            >
              Receive delivery
            </s-button>
          )}
        </s-stack>
        {receivingDenial && order.totals.remainingUnits > 0 && (
          <s-text color="subdued">{receivingDenial}</s-text>
        )}

        {receipts.length > 0 && (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Receipt</s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
              <s-table-header>Products</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {receipts.map((receipt) => (
                <s-table-row key={receipt.id}>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-400">
                      <s-text>Receipt {receipt.receiptNumber}</s-text>
                      <s-text color="subdued">
                        {formatMoment(receipt.createdAt, timeZone)}
                      </s-text>
                      {receipt.supplierReference && (
                        <s-text color="subdued">
                          Packing slip {receipt.supplierReference}
                        </s-text>
                      )}
                      {receipt.note && (
                        <s-text color="subdued">{receipt.note}</s-text>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-400">
                      <s-badge tone={RECEIPT_STATUS_TONES[receipt.status]}>
                        {RECEIPT_STATUS_LABELS[receipt.status]}
                      </s-badge>
                      {receipt.failureMessage && (
                        <s-text color="subdued">
                          {receipt.failureMessage}
                        </s-text>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-unordered-list>
                      {receiptLines(receipt, lineNames).map((text, index) => (
                        <s-list-item key={index}>{text}</s-list-item>
                      ))}
                    </s-unordered-list>
                  </s-table-cell>
                  <s-table-cell>
                    {canResumeReceipt(receipt.status) && (
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="resumeReceipt"
                        />
                        <input
                          type="hidden"
                          name="receiptId"
                          value={receipt.id}
                        />
                        <s-button type="submit" variant="secondary">
                          Check with Shopify again
                        </s-button>
                      </Form>
                    )}
                    {canReverseReceipt(receipt.status) &&
                      (receipt.id === confirmReverseId ? (
                        <Form method="post" onKeyDown={submitOnEnter}>
                          <input
                            type="hidden"
                            name="intent"
                            value="reverseReceipt"
                          />
                          <input
                            type="hidden"
                            name="receiptId"
                            value={receipt.id}
                          />
                          <s-stack direction="block" gap="small-200">
                            <s-text>
                              Reversing takes the received units back out of
                              stock in Shopify. A receipt can be reversed once.
                            </s-text>
                            <s-text-field
                              label="Reason for reversing"
                              name="note"
                              maxLength={2000}
                            />
                            <s-stack direction="inline" gap="small-200">
                              <s-button
                                type="submit"
                                tone="critical"
                                variant="primary"
                              >
                                Reverse receipt
                              </s-button>
                              <s-button
                                href={`/app/purchase-orders/${order.id}`}
                                variant="tertiary"
                              >
                                Keep it
                              </s-button>
                            </s-stack>
                          </s-stack>
                        </Form>
                      ) : (
                        <s-button
                          href={`/app/purchase-orders/${order.id}?confirm=${encodeURIComponent(`reverse:${receipt.id}`)}`}
                          tone="critical"
                          variant="secondary"
                        >
                          Reverse receipt
                        </s-button>
                      ))}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-stack>
    </s-section>
  );
}
