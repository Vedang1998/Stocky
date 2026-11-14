import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ActionFeedback } from "../components/ActionFeedback";
import { AddProducts } from "../components/purchasing/AddProducts";
import { ChargesEditor } from "../components/purchasing/ChargesEditor";
import { PurchaseOrderDetailsForm } from "../components/purchasing/PurchaseOrderDetailsForm";
import {
  PurchaseOrderLineEditor,
  PurchaseOrderLines,
} from "../components/purchasing/PurchaseOrderLines";
import { ReceiptsSection } from "../components/purchasing/ReceiptsSection";
import { formatMoney } from "../lib/decimal-format";
import { isInventoryWriteEnabled } from "../lib/feature-flags.server";
import { formatMoment } from "../lib/purchasing/display";
import { describePurchasingEvent } from "../lib/purchasing/history";
import {
  STATUS_LABELS,
  STATUS_TONES,
  type PurchaseOrderAction,
} from "../lib/purchasing/status";
import {
  ALLOCATION_METHOD_LABELS,
  ALLOCATION_METHODS,
  CHARGE_KIND_LABELS,
  CHARGE_KINDS,
} from "../lib/purchasing/totals";
import { actionFailure } from "../services/purchasing/action-result.server";
import { requirePurchasingContext } from "../services/purchasing/actor.server";
import { supplierEmailHref } from "../services/purchasing/documents.server";
import { PurchasingError } from "../services/purchasing/errors";
import { listPurchasingEvents } from "../services/purchasing/events.server";
import { runPurchaseOrderIntent } from "../services/purchasing/purchase-order-actions.server";
import { getPurchaseOrderView } from "../services/purchasing/purchase-order-view.server";
import { listPurchaseOrderReceipts } from "../services/purchasing/receiving.server";
import { readShopProfile } from "../services/purchasing/shop-profile.server";
import {
  searchVariants,
  variantDisplayName,
} from "../services/purchasing/variants.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

const HISTORY_LENGTH = 30;

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request, params });
  const purchaseOrderId = params.id ?? "";
  const url = new URL(request.url);
  const profile = await readShopProfile(admin);

  const order = await getPurchaseOrderView(db, purchaseOrderId, {
    admin,
    today: profile.today,
    shopCurrency: profile.currencyCode,
  }).catch((error: unknown) => {
    if (error instanceof PurchasingError && error.code === "not_found") {
      throw new Response("Purchase order not found", { status: 404 });
    }
    throw error;
  });

  const find = (url.searchParams.get("find") ?? "").trim().slice(0, 100);
  const [receipts, events, matches] = await Promise.all([
    listPurchaseOrderReceipts(db, order.id),
    listPurchasingEvents(
      db,
      { subjectType: "PURCHASE_ORDER", subjectId: order.id },
      HISTORY_LENGTH,
    ),
    order.permissions.editLines && find
      ? searchVariants(db, find)
      : { variants: [], hasMore: false },
  ]);
  const onOrder = new Set(order.lines.map((line) => line.variantGid));

  return {
    order,
    receipts,
    history: events.map((event) => ({
      id: event.id,
      text: describePurchasingEvent(event.action, event.details),
      at: event.createdAt,
    })),
    productSearch: {
      query: find,
      hasMore: matches.hasMore,
      results: matches.variants.map((variant) => ({
        variantGid: variant.variantGid,
        name: variantDisplayName(variant),
        sku: variant.sku,
        barcode: variant.barcode,
        onOrder: onOrder.has(variant.variantGid),
      })),
    },
    editLineId: url.searchParams.get("edit"),
    confirm: url.searchParams.get("confirm"),
    timeZone: profile.ianaTimezone,
    shopCurrency: profile.currencyCode,
    emailHref:
      order.status === "CANCELLED"
        ? null
        : supplierEmailHref(order, profile.name),
    receivingEnabled: isInventoryWriteEnabled("receiptWrites"),
    chargeKinds: CHARGE_KINDS.map((value) => ({
      value,
      label: CHARGE_KIND_LABELS[value],
    })),
    allocationMethods: ALLOCATION_METHODS.map((value) => ({
      value,
      label: ALLOCATION_METHOD_LABELS[value],
    })),
  };
};

// A lines file is at most 1 MB; the rest of the form is small.
const MAX_FORM_BYTES = 2_000_000;

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const context = await requirePurchasingContext({ request, params });
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_FORM_BYTES) {
    return actionFailure("importLines", "The file is larger than 1 MB.");
  }
  return runPurchaseOrderIntent(
    context,
    params.id ?? "",
    await request.formData(),
  );
};

const ACTION_BUTTONS: Record<
  PurchaseOrderAction,
  { label: string; primary?: boolean }
> = {
  markSent: { label: "Mark as sent", primary: true },
  markOrdered: { label: "Mark as ordered", primary: true },
  close: { label: "Close order" },
  archive: { label: "Archive" },
  unarchive: { label: "Unarchive" },
  cancel: { label: "Cancel order" },
  delete: { label: "Delete draft" },
};

/** Actions that cannot be undone are confirmed on the page before they run. */
const CONFIRMATIONS: Partial<
  Record<PurchaseOrderAction, { heading: string; body: string }>
> = {
  cancel: {
    heading: "Cancel this purchase order?",
    body: "Its units stop counting as incoming stock. A cancelled order cannot be reopened; duplicate it to order again.",
  },
  delete: {
    heading: "Delete this draft?",
    body: "The draft and its lines are removed. This cannot be undone.",
  },
};

export default function PurchaseOrderDetail() {
  const {
    order,
    receipts,
    history,
    productSearch,
    editLineId,
    confirm,
    timeZone,
    shopCurrency,
    emailHref,
    receivingEnabled,
    chargeKinds,
    allocationMethods,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const failure = actionData && !actionData.ok ? actionData : null;
  const errorsFor = (intent: string) =>
    failure?.intent === intent ? failure.fieldErrors : {};

  const editedLine = order.permissions.editLines
    ? order.lines.find((line) => line.id === editLineId)
    : undefined;
  const missingCostCount = order.lines.filter(
    (line) => line.missingCost,
  ).length;
  const changedSinceSent =
    order.sentVersion !== null &&
    order.sentVersion !== order.version &&
    ["SENT", "ORDERED", "PARTIAL"].includes(order.status);
  // After the first send, "Mark as sent" is offered only for an order changed since.
  const actions = order.permissions.actions.filter(
    (action) =>
      action !== "markSent" || order.status === "DRAFT" || changedSinceSent,
  );
  const pendingAction = actions.find(
    (action) => action === confirm && CONFIRMATIONS[action],
  );
  const confirmation = pendingAction ? CONFIRMATIONS[pendingAction] : undefined;
  const orderHref = `/app/purchase-orders/${order.id}`;
  const { totals } = order;

  return (
    <s-page heading={`Purchase order ${order.poNumber}`}>
      <s-link slot="breadcrumb-actions" href="/app/purchase-orders">
        Purchase orders
      </s-link>

      <ActionFeedback
        data={actionData}
        errorHeading="Purchase order not updated"
      />

      {confirmation && pendingAction && (
        <s-banner tone="critical" heading={confirmation.heading}>
          <s-stack direction="block" gap="small-200">
            <s-paragraph>{confirmation.body}</s-paragraph>
            <s-stack direction="inline" gap="small-200">
              <Form method="post">
                <input type="hidden" name="intent" value={pendingAction} />
                <input type="hidden" name="version" value={order.version} />
                <s-button type="submit" tone="critical" variant="primary">
                  {ACTION_BUTTONS[pendingAction].label}
                </s-button>
              </Form>
              <s-button href={orderHref} variant="tertiary">
                Keep it
              </s-button>
            </s-stack>
          </s-stack>
        </s-banner>
      )}

      {order.archived && (
        <s-banner tone="info" heading="This purchase order is archived">
          <s-paragraph>Unarchive it to make changes.</s-paragraph>
        </s-banner>
      )}
      {changedSinceSent && (
        <s-banner tone="warning" heading="Changed since it was sent">
          <s-paragraph>
            The supplier has version {order.sentVersion}; this is version{" "}
            {order.version}. Send the updated order, then mark it as sent again.
          </s-paragraph>
        </s-banner>
      )}
      {missingCostCount > 0 && order.permissions.editLines && (
        <s-banner tone="warning" heading="Some products have no cost">
          <s-paragraph>
            {missingCostCount === 1
              ? "One line is priced at zero because no cost is on file."
              : `${missingCostCount} lines are priced at zero because no cost is on file.`}{" "}
            Edit the line to enter its unit cost.
          </s-paragraph>
        </s-banner>
      )}
      {(!order.location || !order.location.isActive) &&
        order.permissions.editTerms && (
          <s-banner tone="warning" heading="Destination is not available">
            <s-paragraph>
              The location this order delivers to is inactive or no longer in
              Shopify. Choose another destination under Details.
            </s-paragraph>
          </s-banner>
        )}

      <s-section heading="Products">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="small-200">
            <s-badge tone={STATUS_TONES[order.status]}>
              {STATUS_LABELS[order.status]}
            </s-badge>
            {order.archived && <s-badge>Archived</s-badge>}
            {order.overdue && <s-badge tone="critical">Overdue</s-badge>}
            <s-text color="subdued">Version {order.version}</s-text>
          </s-stack>
          <PurchaseOrderLines
            order={order}
            editLineId={editedLine?.id ?? null}
          />
        </s-stack>
      </s-section>

      {editedLine && (
        <PurchaseOrderLineEditor
          key={`${editedLine.id}-${order.version}`}
          order={order}
          line={editedLine}
          fieldErrors={{
            ...errorsFor("saveLine"),
            ...errorsFor("cancelUnits"),
          }}
        />
      )}

      {order.permissions.editLines && (
        <AddProducts
          purchaseOrderId={order.id}
          version={order.version}
          currency={order.currency}
          search={productSearch}
        />
      )}

      <ChargesEditor
        key={order.version}
        order={order}
        chargeKinds={chargeKinds}
        allocationMethods={allocationMethods}
        fieldErrors={errorsFor("saveCharges")}
      />

      <ReceiptsSection
        order={order}
        receipts={receipts}
        confirmReverseId={
          confirm?.startsWith("reverse:")
            ? confirm.slice("reverse:".length)
            : null
        }
        timeZone={timeZone}
        receivingEnabled={receivingEnabled}
      />

      <PurchaseOrderDetailsForm
        key={`details-${order.version}`}
        order={order}
        shopCurrency={shopCurrency}
        fieldErrors={errorsFor("saveDetails")}
      />

      <s-section slot="aside" heading="Total">
        <s-stack direction="block" gap="small-200">
          <TotalRow
            label={`Products (${totals.units} ${totals.units === 1 ? "unit" : "units"})`}
            value={formatMoney(totals.merchandiseAmount, order.currency)}
          />
          {totals.lineDiscountAmount !== "0.00" && (
            <s-text color="subdued">
              Includes line discounts of{" "}
              {formatMoney(totals.lineDiscountAmount, order.currency)}.
            </s-text>
          )}
          <TotalRow
            label="Tax"
            value={formatMoney(totals.taxAmount, order.currency)}
          />
          <TotalRow
            label="Charges"
            value={formatMoney(totals.chargesAmount, order.currency)}
          />
          <s-divider />
          <TotalRow
            label="Total"
            value={formatMoney(totals.totalAmount, order.currency)}
            strong
          />
          {totals.totalInShopCurrency !== null && shopCurrency && (
            <s-text color="subdued">
              About {formatMoney(totals.totalInShopCurrency, shopCurrency)} at
              the exchange rate on this order.
            </s-text>
          )}
          {totals.allocationApplied !== null &&
            totals.allocationApplied !== order.landedCostMethod && (
              <s-text color="subdued">
                Charges were spread by quantity, because the lines have no{" "}
                {order.landedCostMethod === "WEIGHT" ? "weight" : "volume"} to
                spread them by.
              </s-text>
            )}
          {totals.unallocatedAmount !== "0.00" && (
            <s-text color="subdued">
              {formatMoney(totals.unallocatedAmount, order.currency)} of charges
              is not in any landed cost, because the order has no units.
            </s-text>
          )}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Supplier">
        <s-stack direction="block" gap="small-200">
          <s-link href={`/app/suppliers/${order.supplier.id}`}>
            {order.supplier.name}
          </s-link>
          {order.supplier.archived && <s-badge>Archived supplier</s-badge>}
          {order.supplier.contactEmail && (
            <s-text color="subdued">{order.supplier.contactEmail}</s-text>
          )}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Actions">
        <s-stack direction="block" gap="small-200">
          {actions.map((name) => {
            const button = ACTION_BUTTONS[name];
            if (CONFIRMATIONS[name]) {
              return (
                <s-button
                  key={name}
                  href={`${orderHref}?confirm=${name}`}
                  tone="critical"
                  variant="secondary"
                >
                  {button.label}
                </s-button>
              );
            }
            return (
              <Form key={name} method="post">
                <input type="hidden" name="intent" value={name} />
                <input type="hidden" name="version" value={order.version} />
                <s-button
                  type="submit"
                  variant={button.primary ? "primary" : "secondary"}
                >
                  {button.label}
                </s-button>
              </Form>
            );
          })}
          <Form method="post">
            <input type="hidden" name="intent" value="duplicate" />
            <s-button type="submit" variant="secondary">
              Duplicate as new draft
            </s-button>
          </Form>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Documents">
        <s-stack direction="block" gap="small-200">
          {emailHref ? (
            <s-stack direction="block" gap="small-400">
              <s-link href={emailHref} target="_blank">
                Email to {order.supplier.name}
              </s-link>
              <s-text color="subdued">
                Opens your mail app with the order filled in. Attach the PDF
                {actions.includes("markSent")
                  ? ", send it, then mark the order as sent."
                  : " and send it."}
              </s-text>
            </s-stack>
          ) : (
            order.status !== "CANCELLED" && (
              <s-text color="subdued">
                Add an email address to the supplier to email this order from
                here.
              </s-text>
            )
          )}
          <s-link href={`${orderHref}/pdf`} target="_blank">
            Purchase order (PDF)
          </s-link>
          <s-link href={`${orderHref}/receiver`} target="_blank">
            Receiving sheet (PDF, no costs)
          </s-link>
          <s-link href={`${orderHref}/csv`} target="_blank">
            Lines (CSV)
          </s-link>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="History">
        {history.length === 0 ? (
          <s-paragraph>No history yet.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="small-200">
            {history.map((event) => (
              <s-stack key={event.id} direction="block" gap="small-400">
                <s-text>{event.text}</s-text>
                <s-text color="subdued">
                  {formatMoment(event.at, timeZone)}
                </s-text>
              </s-stack>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <s-stack direction="inline" gap="base" justifyContent="space-between">
      <s-text {...(strong ? { type: "strong" as const } : {})}>{label}</s-text>
      <s-text {...(strong ? { type: "strong" as const } : {})}>{value}</s-text>
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
