import { Form } from "react-router";
import { formatDay } from "../../lib/purchasing/display";
import type { FieldErrors } from "../../lib/purchasing/form-input";
import { submitOnEnter } from "../../lib/submit-on-enter";
import type { PurchaseOrderView } from "../../services/purchasing/purchase-order-view.server";

type HeaderKey = keyof PurchaseOrderView["header"];

const DATE_FIELDS: Array<{ name: HeaderKey; label: string }> = [
  { name: "issuedOn", label: "Order date" },
  { name: "expectedOn", label: "Expected date" },
  { name: "shipOn", label: "Ship date" },
  { name: "cancelOn", label: "Cancel if not shipped by" },
  { name: "invoiceOn", label: "Invoice date" },
  { name: "paymentDueOn", label: "Payment due" },
];

const TEXT_FIELDS: Array<{
  name: HeaderKey;
  label: string;
  maxLength: number;
}> = [
  {
    name: "supplierOrderNumber",
    label: "Supplier order number",
    maxLength: 128,
  },
  { name: "invoiceNumber", label: "Invoice number", maxLength: 128 },
  { name: "paymentTerms", label: "Payment terms", maxLength: 255 },
  { name: "shippingTerms", label: "Shipping terms", maxLength: 255 },
  { name: "buyerName", label: "Buyer", maxLength: 255 },
];

const LONG_TEXT_FIELDS: Array<{
  name: HeaderKey;
  label: string;
  maxLength: number;
  details?: string;
}> = [
  { name: "shipToAddress", label: "Ship-to address", maxLength: 2000 },
  { name: "billToAddress", label: "Bill-to address", maxLength: 2000 },
  {
    name: "supplierNotes",
    label: "Notes to supplier",
    maxLength: 4000,
    details: "Printed on the purchase order.",
  },
  {
    name: "notes",
    label: "Internal notes",
    maxLength: 4000,
    details: "Never shown to the supplier.",
  },
];

function destinationName(order: PurchaseOrderView): string {
  if (!order.location) return "A location that is no longer in Shopify";
  return order.location.isActive
    ? order.location.name
    : `${order.location.name} (inactive)`;
}

function ReadOnlyDetails({ order }: { order: PurchaseOrderView }) {
  const entries: Array<[string, string]> = [
    ["Deliver to", destinationName(order)],
    [
      "Currency",
      order.exchangeRateInput
        ? `${order.currency} at ${order.exchangeRateInput}`
        : order.currency,
    ],
  ];
  for (const field of DATE_FIELDS) {
    const value = order.header[field.name];
    if (value) entries.push([field.label, formatDay(value)]);
  }
  for (const field of [...TEXT_FIELDS, ...LONG_TEXT_FIELDS]) {
    const value = order.header[field.name];
    if (value) entries.push([field.label, value]);
  }
  return (
    <s-stack direction="block" gap="small-200">
      {entries.map(([label, value]) => (
        <s-stack key={label} direction="inline" gap="small-200">
          <s-text color="subdued">{label}</s-text>
          <s-text>{value}</s-text>
        </s-stack>
      ))}
    </s-stack>
  );
}

export function PurchaseOrderDetailsForm({
  order,
  shopCurrency,
  fieldErrors,
}: {
  order: PurchaseOrderView;
  shopCurrency: string | null;
  fieldErrors: FieldErrors;
}) {
  if (!order.permissions.editHeader) {
    return (
      <s-section heading="Details">
        <ReadOnlyDetails order={order} />
      </s-section>
    );
  }

  const { editTerms } = order.permissions;
  const destinationListed = order.locationOptions.some(
    (location) => location.gid === order.locationGid,
  );

  return (
    <s-section heading="Details">
      <Form method="post" onKeyDown={submitOnEnter}>
        <input type="hidden" name="intent" value="saveDetails" />
        <input type="hidden" name="version" value={order.version} />
        <s-stack direction="block" gap="base">
          {editTerms ? (
            <s-stack direction="inline" gap="base">
              <s-select
                label="Deliver to"
                name="locationGid"
                value={order.locationGid}
                error={fieldErrors.locationGid}
              >
                {!destinationListed && (
                  <s-option value={order.locationGid}>
                    {destinationName(order)}
                  </s-option>
                )}
                {order.locationOptions.map((location) => (
                  <s-option key={location.gid} value={location.gid}>
                    {location.name}
                  </s-option>
                ))}
              </s-select>
              <s-text-field
                label="Currency"
                name="currency"
                value={order.currency}
                maxLength={3}
                error={fieldErrors.currency}
                required
              />
              <s-number-field
                label="Exchange rate"
                name="exchangeRate"
                value={order.exchangeRateInput}
                min={0}
                step={0.000001}
                details={
                  shopCurrency && shopCurrency !== order.currency
                    ? `${shopCurrency} for one ${order.currency}.`
                    : "Only needed when the order is not in the shop's currency."
                }
                error={fieldErrors.exchangeRate}
              />
            </s-stack>
          ) : (
            <s-text color="subdued">
              Delivering to {destinationName(order)} in {order.currency}. The
              destination and currency are fixed once receiving has started.
            </s-text>
          )}

          <s-stack direction="inline" gap="base">
            {DATE_FIELDS.map((field) => (
              <s-date-field
                key={field.name}
                label={field.label}
                name={field.name}
                value={order.header[field.name] ?? ""}
                error={fieldErrors[field.name]}
              />
            ))}
          </s-stack>

          <s-stack direction="inline" gap="base">
            {TEXT_FIELDS.map((field) => (
              <s-text-field
                key={field.name}
                label={field.label}
                name={field.name}
                value={order.header[field.name] ?? ""}
                maxLength={field.maxLength}
                error={fieldErrors[field.name]}
              />
            ))}
          </s-stack>

          {LONG_TEXT_FIELDS.map((field) => (
            <s-text-area
              key={field.name}
              label={field.label}
              name={field.name}
              value={order.header[field.name] ?? ""}
              maxLength={field.maxLength}
              details={field.details}
              error={fieldErrors[field.name]}
            />
          ))}

          <s-stack direction="inline" gap="small-200">
            <s-button type="submit" variant="primary">
              Save details
            </s-button>
          </s-stack>
        </s-stack>
      </Form>
    </s-section>
  );
}
