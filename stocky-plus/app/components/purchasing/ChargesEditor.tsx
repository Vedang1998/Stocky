import { useState } from "react";
import { Form } from "react-router";
import { formatMoney } from "../../lib/decimal-format";
import type { FieldErrors } from "../../lib/purchasing/form-input";
import { submitOnEnter } from "../../lib/submit-on-enter";
import type { PurchaseOrderView } from "../../services/purchasing/purchase-order-view.server";

export type Choice = { value: string; label: string };

type ChargeRow = {
  /** Stable across re-renders so a row keeps what was typed when another is removed. */
  key: number;
  kind: string;
  description: string;
  amount: string;
  allocate: boolean;
};

const MAX_CHARGES = 20;

export function ChargesEditor({
  order,
  chargeKinds,
  allocationMethods,
  fieldErrors,
}: {
  order: PurchaseOrderView;
  chargeKinds: Choice[];
  allocationMethods: Choice[];
  fieldErrors: FieldErrors;
}) {
  const [rows, setRows] = useState<ChargeRow[]>(() =>
    order.charges.map((charge, index) => ({
      key: index,
      kind: charge.kind,
      description: charge.description ?? "",
      amount: charge.amount,
      allocate: charge.allocate,
    })),
  );
  const [nextKey, setNextKey] = useState(order.charges.length);

  if (!order.permissions.editTerms) {
    return (
      <s-section heading="Charges">
        {order.charges.length === 0 ? (
          <s-paragraph>No shipping, duty or other charges.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Charge</s-table-header>
              <s-table-header>Spread across lines</s-table-header>
              <s-table-header format="currency">Amount</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {order.charges.map((charge, index) => (
                <s-table-row key={index}>
                  <s-table-cell>
                    {chargeKinds.find((kind) => kind.value === charge.kind)
                      ?.label ?? charge.kind}
                    {charge.description ? `: ${charge.description}` : ""}
                  </s-table-cell>
                  <s-table-cell>{charge.allocate ? "Yes" : "No"}</s-table-cell>
                  <s-table-cell>
                    {formatMoney(charge.amount, order.currency)}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    );
  }

  const addRow = () => {
    setRows((current) => [
      ...current,
      {
        key: nextKey,
        kind: chargeKinds[0]?.value ?? "",
        description: "",
        amount: "",
        allocate: true,
      },
    ]);
    setNextKey((key) => key + 1);
  };

  return (
    <s-section heading="Charges">
      <Form method="post" onKeyDown={submitOnEnter}>
        <input type="hidden" name="intent" value="saveCharges" />
        <input type="hidden" name="version" value={order.version} />
        <input type="hidden" name="chargeCount" value={rows.length} />
        <s-stack direction="block" gap="base">
          {rows.length === 0 && (
            <s-paragraph>
              No charges. Add shipping, duty, fees or an order discount to
              include them in the total and the landed cost.
            </s-paragraph>
          )}
          {rows.map((row, index) => (
            <s-stack
              key={row.key}
              direction="inline"
              gap="small-200"
              alignItems="end"
            >
              <s-select
                label="Type"
                name={`charge-kind-${index}`}
                value={row.kind}
                error={fieldErrors[`charge-kind-${index}`]}
              >
                {chargeKinds.map((kind) => (
                  <s-option key={kind.value} value={kind.value}>
                    {kind.label}
                  </s-option>
                ))}
              </s-select>
              <s-text-field
                label="Description"
                name={`charge-description-${index}`}
                value={row.description}
                maxLength={255}
                error={fieldErrors[`charge-description-${index}`]}
              />
              <s-number-field
                label={`Amount (${order.currency})`}
                name={`charge-amount-${index}`}
                value={row.amount}
                min={0}
                step={0.01}
                error={fieldErrors[`charge-amount-${index}`]}
                required
              />
              <s-checkbox
                label="Spread across lines"
                name={`charge-allocate-${index}`}
                checked={row.allocate}
              />
              <s-button
                variant="tertiary"
                tone="critical"
                accessibilityLabel={`Remove charge ${index + 1}`}
                onClick={() =>
                  setRows((current) =>
                    current.filter((candidate) => candidate.key !== row.key),
                  )
                }
              >
                Remove
              </s-button>
            </s-stack>
          ))}
          <s-select
            label="Spread charges by"
            name="landedCostMethod"
            value={order.landedCostMethod}
            details="How charges marked “Spread across lines” are shared out to work out each line's landed cost."
            error={fieldErrors.landedCostMethod}
          >
            {allocationMethods.map((method) => (
              <s-option key={method.value} value={method.value}>
                {method.label}
              </s-option>
            ))}
          </s-select>
          <s-stack direction="inline" gap="small-200">
            <s-button
              variant="secondary"
              disabled={rows.length >= MAX_CHARGES}
              onClick={addRow}
            >
              Add charge
            </s-button>
            <s-button type="submit" variant="primary">
              Save charges
            </s-button>
          </s-stack>
        </s-stack>
      </Form>
    </s-section>
  );
}
