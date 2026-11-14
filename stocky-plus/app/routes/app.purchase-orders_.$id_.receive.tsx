import { useRef, useState, type ComponentRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { isInventoryWriteEnabled } from "../lib/feature-flags.server";
import { RECEIVING_OFF_MESSAGE } from "../lib/po-display";
import { findScannedLine, readCount } from "../lib/purchasing/receiving-scan";
import { STATUS_LABELS, STATUS_TONES } from "../lib/purchasing/status";
import { submitOnEnter } from "../lib/submit-on-enter";
import { requirePurchasingContext } from "../services/purchasing/actor.server";
import { PurchasingError } from "../services/purchasing/errors";
import { listLocations } from "../services/purchasing/locations.server";
import { receiveDelivery } from "../services/purchasing/purchase-order-actions.server";
import { loadPurchaseOrder } from "../services/purchasing/purchase-order-records.server";
import {
  getReceivingWorksheet,
  type ReceivableLine,
} from "../services/purchasing/receiving.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request, params });
  const purchaseOrderId = params.id ?? "";

  const [po, worksheet, locations] = await Promise.all([
    loadPurchaseOrder(db, purchaseOrderId),
    getReceivingWorksheet(db, purchaseOrderId),
    listLocations(db, admin),
  ]).catch((error: unknown) => {
    if (error instanceof PurchasingError && error.code === "not_found") {
      throw new Response("Purchase order not found", { status: 404 });
    }
    throw error;
  });

  return {
    order: {
      id: po.id,
      poNumber: po.poNumber ?? po.id,
      supplierName: po.supplier.name,
      locationName:
        locations.find((location) => location.gid === po.locationId)?.name ??
        null,
    },
    worksheet,
    fillAll: new URL(request.url).searchParams.get("fill") === "all",
    receivingEnabled: isInventoryWriteEnabled("receiptWrites"),
    // One key per rendered form: submitting it twice records one receipt.
    idempotencyKey: crypto.randomUUID(),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const context = await requirePurchasingContext({ request, params });
  return receiveDelivery(context, params.id ?? "", await request.formData());
};

function labelsHref(
  received: Array<{ variantGid: string; units: number }>,
): string {
  const items = received
    .map((line) => `${encodeURIComponent(line.variantGid)}:${line.units}`)
    .join(",");
  return `/app/warehouse/labels?items=${items}`;
}

export default function ReceiveDelivery() {
  const { order, worksheet, fillAll, receivingEnabled, idempotencyKey } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const orderHref = `/app/purchase-orders/${order.id}`;
  const failure = actionData && !actionData.ok ? actionData : null;
  const success = actionData && actionData.ok ? actionData : null;
  // A refused submission keeps its key and what was typed; anything else
  // starts a fresh form.
  const formKey = failure?.idempotencyKey ?? idempotencyKey;

  return (
    <s-page heading={`Receive ${order.poNumber}`}>
      <s-link slot="breadcrumb-actions" href={orderHref}>
        Purchase order {order.poNumber}
      </s-link>

      {failure && (
        <s-banner tone="critical" heading="Nothing was received">
          <s-paragraph>{failure.error}</s-paragraph>
        </s-banner>
      )}
      {success && (
        <s-banner
          tone={success.warning ? "warning" : "success"}
          heading={success.notice}
        >
          <s-stack direction="block" gap="small-200">
            {success.warning && <s-paragraph>{success.warning}</s-paragraph>}
            <s-stack direction="inline" gap="small-200">
              <s-button href={orderHref}>Back to the purchase order</s-button>
              {success.received.length > 0 && (
                <s-button href={labelsHref(success.received)} target="_blank">
                  Print labels for these units (ZPL)
                </s-button>
              )}
            </s-stack>
          </s-stack>
        </s-banner>
      )}
      {!receivingEnabled && (
        <s-banner tone="info" heading="Receiving is turned off for this store">
          <s-paragraph>{RECEIVING_OFF_MESSAGE}</s-paragraph>
        </s-banner>
      )}

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="small-200">
            <s-badge tone={STATUS_TONES[worksheet.status]}>
              {STATUS_LABELS[worksheet.status]}
            </s-badge>
            <s-text>
              From {order.supplierName}
              {order.locationName ? `, into ${order.locationName}` : ""}
            </s-text>
          </s-stack>

          {worksheet.denial ? (
            <s-banner tone="warning" heading="This order cannot be received">
              <s-paragraph>{worksheet.denial}</s-paragraph>
            </s-banner>
          ) : (
            <ReceiveForm
              key={`${formKey}-${fillAll}`}
              lines={worksheet.lines}
              fillAll={fillAll}
              idempotencyKey={formKey}
              fieldErrors={failure?.fieldErrors ?? {}}
              orderHref={orderHref}
            />
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

function initialCounts(
  lines: ReceivableLine[],
  fillAll: boolean,
): Record<string, string> {
  return Object.fromEntries(
    lines.map((line) => [
      line.lineItemId,
      fillAll && line.openQty > 0 ? String(line.openQty) : "",
    ]),
  );
}

function ReceiveForm({
  lines,
  fillAll,
  idempotencyKey,
  fieldErrors,
  orderHref,
}: {
  lines: ReceivableLine[];
  fillAll: boolean;
  idempotencyKey: string;
  fieldErrors: Record<string, string>;
  orderHref: string;
}) {
  const navigation = useNavigation();
  const [counts, setCounts] = useState(() => initialCounts(lines, fillAll));
  const [scanMessage, setScanMessage] = useState<{
    tone: "success" | "warning" | "critical";
    text: string;
  } | null>(null);
  const scanRef = useRef<ComponentRef<"s-text-field">>(null);

  const countScan = () => {
    const field = scanRef.current;
    const code = field?.value ?? "";
    if (!code.trim()) return;
    const line = findScannedLine(lines, code);
    if (!line) {
      setScanMessage({
        tone: "critical",
        text: `“${code.trim()}” is not a barcode or SKU on this order.`,
      });
    } else {
      const count = readCount(counts[line.lineItemId]) + 1;
      setCounts((current) => ({
        ...current,
        [line.lineItemId]: String(count),
      }));
      setScanMessage(
        count > line.openQty
          ? {
              tone: "warning",
              text: `${line.name}: ${count} counted, ${count - line.openQty} more than expected.`,
            }
          : {
              tone: "success",
              text: `${line.name}: ${count} of ${line.openQty} counted.`,
            },
      );
    }
    if (field) {
      field.value = "";
      field.focus();
    }
  };

  const total = lines.reduce(
    (sum, line) => sum + readCount(counts[line.lineItemId]),
    0,
  );

  return (
    <s-stack direction="block" gap="base">
      {/* Counting happens in the browser; this form never reaches the server. */}
      <Form
        onKeyDown={submitOnEnter}
        onSubmit={(event) => {
          event.preventDefault();
          countScan();
        }}
      >
        <s-stack direction="inline" gap="small-200" alignItems="end">
          <s-text-field
            ref={scanRef}
            label="Scan a barcode or type a SKU"
            autocomplete="off"
            details="Each scan counts one unit on its line."
          />
          <s-button type="submit">Count 1</s-button>
          {!fillAll && (
            <s-button href={`${orderHref}/receive?fill=all`} variant="tertiary">
              Fill in everything still expected
            </s-button>
          )}
        </s-stack>
      </Form>
      {scanMessage && (
        <s-banner tone={scanMessage.tone} heading={scanMessage.text} />
      )}

      {/* No submit on Enter here: a scanner aimed at a quantity field must not post a receipt. */}
      <Form method="post">
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <s-stack direction="block" gap="base">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header format="numeric">Ordered</s-table-header>
              <s-table-header format="numeric">Received</s-table-header>
              <s-table-header format="numeric">Still expected</s-table-header>
              <s-table-header>Receive now</s-table-header>
              <s-table-header>Rejected</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {lines.map((line) => (
                <s-table-row key={line.lineItemId}>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-400">
                      <s-text>{line.name}</s-text>
                      <s-text color="subdued">
                        {[
                          line.sku ? `SKU ${line.sku}` : null,
                          line.barcode ? `Barcode ${line.barcode}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No SKU or barcode"}
                      </s-text>
                      {line.pendingQty > 0 && (
                        <s-badge tone="warning">
                          {line.pendingQty} waiting for Shopify
                        </s-badge>
                      )}
                      {line.rejectedQty > 0 && (
                        <s-badge>{line.rejectedQty} rejected so far</s-badge>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    {line.orderedQty - line.cancelledQty}
                  </s-table-cell>
                  <s-table-cell>{line.receivedQty}</s-table-cell>
                  <s-table-cell>{line.openQty}</s-table-cell>
                  <s-table-cell>
                    <s-number-field
                      label={`Units of ${line.name} to receive`}
                      labelAccessibilityVisibility="exclusive"
                      name={`accepted-${line.lineItemId}`}
                      value={counts[line.lineItemId] ?? ""}
                      min={0}
                      step={1}
                      error={fieldErrors[`accepted-${line.lineItemId}`]}
                      onInput={(event) => {
                        const { value } = event.currentTarget;
                        setCounts((current) => ({
                          ...current,
                          [line.lineItemId]: value,
                        }));
                      }}
                    />
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      <s-number-field
                        label={`Units of ${line.name} rejected`}
                        labelAccessibilityVisibility="exclusive"
                        name={`rejected-${line.lineItemId}`}
                        min={0}
                        step={1}
                        error={fieldErrors[`rejected-${line.lineItemId}`]}
                      />
                      <s-text-field
                        label={`Why ${line.name} was rejected`}
                        labelAccessibilityVisibility="exclusive"
                        name={`reason-${line.lineItemId}`}
                        placeholder="Reason"
                        maxLength={255}
                        error={fieldErrors[`reason-${line.lineItemId}`]}
                      />
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>

          <s-stack direction="inline" gap="base">
            <s-text-field
              label="Packing slip number"
              name="supplierReference"
              maxLength={128}
              error={fieldErrors.supplierReference}
            />
            <s-text-field
              label="Note"
              name="note"
              maxLength={2000}
              error={fieldErrors.note}
            />
          </s-stack>
          <s-checkbox
            label="Allow more units than the order still expects"
            name="allowOverReceipt"
            details="Without this, a line that exceeds what is still expected is refused."
          />
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-button
              type="submit"
              variant="primary"
              {...(navigation.state === "submitting" ? { loading: true } : {})}
            >
              Receive {total} {total === 1 ? "unit" : "units"}
            </s-button>
            <s-button href={orderHref} variant="tertiary">
              Cancel
            </s-button>
          </s-stack>
        </s-stack>
      </Form>
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
