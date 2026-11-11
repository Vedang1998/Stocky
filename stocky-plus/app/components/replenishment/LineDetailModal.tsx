import { useState, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { formatDecimal, formatMoney, MISSING_VALUE } from "../../lib/decimal-format";
import {
  LEAD_TIME_SOURCE_LABELS,
  PARITY_METHODS,
  PARITY_METHOD_LABELS,
  type ParityMethod,
  type TraceStep,
  type Warning,
} from "../../lib/replenishment/types";
import {
  formatLocalDate,
  marginAndMarkup,
  STOCK_STATUS_LABELS,
} from "../../lib/replenishment/worksheet/describe";
import { variantLabel } from "../../lib/replenishment/worksheet/labels";
import type { WorksheetLine } from "../../lib/replenishment/worksheet/store.server";
import { MethodPeriodFields } from "./MethodPeriodFields";
import type { PreviewFormValues, WorksheetActionResult } from "./types";

/** What the detail needs to know about the worksheet the row belongs to. */
export type LineDetailContext = {
  currencyCode: string | null;
  /** The days whose sales the row reports, for example "Oct 12, 2026 to Nov 10, 2026". */
  salesPeriod: string;
  incomingLabel: string;
};

function quantity(value: number | null): string {
  return value == null ? MISSING_VALUE : value.toLocaleString("en-US");
}

function money(amount: string | null, currencyCode: string | null, digits?: number): string {
  if (amount == null) return MISSING_VALUE;
  if (!currencyCode) return formatDecimal(amount);
  return formatMoney(amount, currencyCode, { maximumFractionDigits: digits });
}

function percent(value: string | null): string {
  return value == null ? MISSING_VALUE : `${formatDecimal(value)}%`;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <s-stack direction="block" gap="none">
      <s-text color="subdued">{label}</s-text>
      <s-text>{children}</s-text>
    </s-stack>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return (
    <s-grid gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap="base">
      {children}
    </s-grid>
  );
}

function Steps({ steps }: { steps: TraceStep[] }) {
  return (
    <s-ordered-list>
      {steps.map((step, index) => (
        <s-list-item key={`${step.key}-${index}`}>{step.text}</s-list-item>
      ))}
    </s-ordered-list>
  );
}

function WarningList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  return (
    <s-banner tone="warning" heading="Check before ordering">
      <s-unordered-list>
        {warnings.map((warning, index) => (
          <s-list-item key={`${warning.code}-${index}`}>{warning.message}</s-list-item>
        ))}
      </s-unordered-list>
    </s-banner>
  );
}

function Preview({ line, defaults }: { line: WorksheetLine; defaults: PreviewFormValues }) {
  const preview = useFetcher<WorksheetActionResult>();
  const apply = useFetcher<WorksheetActionResult>();
  const [method, setMethod] = useState<ParityMethod>(defaults.method);

  const result = preview.data?.intent === "preview" ? preview.data : null;
  const applied = apply.data?.intent === "setQuantity" ? apply.data : null;
  const errors = result && !result.ok ? result.errors : {};
  const suggestion = result?.ok ? result.suggestion : null;
  const locked = line.purchaseOrderId != null;

  return (
    <s-stack direction="block" gap="base">
      <s-heading>Try another method or period</s-heading>
      <s-text color="subdued">
        This recalculates this variant only, using the stock and supplier terms saved on the
        worksheet. Nothing changes unless you choose to use the result.
      </s-text>
      <preview.Form method="post">
        <input type="hidden" name="intent" value="preview" />
        <input type="hidden" name="lineId" value={line.id} />
        <s-stack direction="block" gap="base">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap="base">
            <s-select
              label="Forecast method"
              name="method"
              value={method}
              error={errors.method}
              onChange={(event) => setMethod(event.currentTarget.value as ParityMethod)}
            >
              {PARITY_METHODS.map((value) => (
                <s-option key={value} value={value}>
                  {PARITY_METHOD_LABELS[value]}
                </s-option>
              ))}
            </s-select>
            <MethodPeriodFields method={method} values={defaults} errors={errors} />
          </s-grid>
          <s-button type="submit" {...(preview.state !== "idle" ? { loading: true } : {})}>
            Calculate
          </s-button>
        </s-stack>
      </preview.Form>

      {result && !result.ok && result.message && (
        <s-banner tone="critical">
          <s-paragraph>{result.message}</s-paragraph>
        </s-banner>
      )}
      {suggestion && (
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-text type="strong">
              {suggestion.suggestedQuantity == null
                ? "No quantity can be suggested this way"
                : `Suggested: ${quantity(suggestion.suggestedQuantity)}`}
            </s-text>
            <Steps steps={suggestion.trace} />
            <WarningList warnings={suggestion.warnings} />
            {suggestion.suggestedQuantity != null && !locked && (
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-button
                  variant="primary"
                  {...(apply.state !== "idle" ? { loading: true } : {})}
                  onClick={() =>
                    apply.submit(
                      {
                        intent: "setQuantity",
                        lineId: line.id,
                        quantity: String(suggestion.suggestedQuantity),
                      },
                      { method: "post" },
                    )
                  }
                >
                  Order {quantity(suggestion.suggestedQuantity)}
                </s-button>
                {applied?.ok && (
                  <s-text color="subdued">
                    Order quantity set to {quantity(applied.orderQuantity)}.
                  </s-text>
                )}
              </s-stack>
            )}
            {applied && !applied.ok && (
              <s-banner tone="critical">
                <s-paragraph>{applied.message}</s-paragraph>
              </s-banner>
            )}
          </s-stack>
        </s-box>
      )}
    </s-stack>
  );
}

function LineDetail({
  line,
  context,
  previewDefaults,
}: {
  line: WorksheetLine;
  context: LineDetailContext;
  previewDefaults: PreviewFormValues | null;
}) {
  const { detail } = line;
  const cost = line.supplierCostAmount ?? line.unitCostAmount;
  const costCurrency = line.supplierCostAmount
    ? line.supplierCostCurrencyCode
    : line.unitCostCurrencyCode;
  // Margin only means something when price and cost are in the same currency.
  const comparable = cost != null && costCurrency === line.priceCurrencyCode;
  const { margin, markup } = comparable
    ? marginAndMarkup(line.priceAmount, cost)
    : { margin: null, markup: null };

  return (
    <s-stack direction="block" gap="large">
      <s-stack direction="block" gap="base">
        <s-heading>How the suggestion was calculated</s-heading>
        <Steps steps={detail.trace} />
        {line.finalQuantity != null && (
          <s-text>
            You changed the order quantity to {quantity(line.finalQuantity)}. The suggestion was{" "}
            {line.suggestedQuantity == null ? "none" : quantity(line.suggestedQuantity)}.
          </s-text>
        )}
        {line.purchaseOrderId && (
          <s-text>
            This row is on purchase order {line.purchaseOrderNumber ?? ""}. Change the quantity
            on the purchase order.
          </s-text>
        )}
        <WarningList warnings={detail.warnings} />
      </s-stack>

      <s-stack direction="block" gap="base">
        <s-heading>Stock</s-heading>
        <Facts>
          <Fact label="Status">{STOCK_STATUS_LABELS[line.stockStatus]}</Fact>
          <Fact label="Available">{quantity(line.availableQuantity)}</Fact>
          <Fact label="On hand">{quantity(line.onHandQuantity)}</Fact>
          <Fact label="Committed">{quantity(line.committedQuantity)}</Fact>
          <Fact label={`Incoming (${context.incomingLabel.toLowerCase()})`}>
            {quantity(line.incomingQuantity)}
          </Fact>
          <Fact label="Days of stock">{formatDecimal(line.daysOfStock)}</Fact>
          <Fact label="Runs out around">
            {line.depletionDate ? formatLocalDate(line.depletionDate) : MISSING_VALUE}
          </Fact>
          <Fact label="Reorder point">
            {line.reorderPoint == null
              ? MISSING_VALUE
              : `${quantity(line.reorderPoint)} (${line.reorderPointSource === "MANUAL" ? "set manually" : "calculated"})`}
          </Fact>
          <Fact label="Lead time">
            {line.leadTimeDays == null
              ? "Not set"
              : `${line.leadTimeDays} ${line.leadTimeDays === 1 ? "day" : "days"}${
                  line.leadTimeSource
                    ? ` (${LEAD_TIME_SOURCE_LABELS[line.leadTimeSource].toLowerCase()})`
                    : ""
                }`}
          </Fact>
          <Fact label="Minimum">{quantity(detail.levels.minimumQuantity)}</Fact>
          <Fact label="Shelf limit">{quantity(detail.levels.shelfLimitQuantity)}</Fact>
          <Fact label="Safety stock">{quantity(detail.levels.safetyStockQuantity)}</Fact>
        </Facts>
        {detail.healthTrace.length > 0 && <Steps steps={detail.healthTrace} />}
        {detail.lowStockReasons.length > 0 && (
          <s-unordered-list>
            {detail.lowStockReasons.map((reason) => (
              <s-list-item key={reason}>{reason}</s-list-item>
            ))}
          </s-unordered-list>
        )}
      </s-stack>

      <s-stack direction="block" gap="base">
        <s-heading>Sales, {context.salesPeriod}</s-heading>
        <Facts>
          <Fact label="Net units sold">{quantity(line.netUnits)}</Fact>
          <Fact label="Orders">{quantity(line.distinctOrders)}</Fact>
          <Fact label="Net sales">{money(line.revenueAmount, context.currencyCode)}</Fact>
          <Fact label="Units per day">{formatDecimal(line.unitsPerDay)}</Fact>
        </Facts>
      </s-stack>

      <s-stack direction="block" gap="base">
        <s-heading>Price and cost</s-heading>
        <Facts>
          <Fact label="Price">{money(line.priceAmount, line.priceCurrencyCode)}</Fact>
          <Fact label="Shopify unit cost">
            {money(line.unitCostAmount, line.unitCostCurrencyCode, 4)}
          </Fact>
          <Fact label="Supplier cost">
            {money(line.supplierCostAmount, line.supplierCostCurrencyCode, 4)}
          </Fact>
          <Fact label="Margin">{percent(margin)}</Fact>
          <Fact label="Markup">{percent(markup)}</Fact>
        </Facts>
        {cost != null && !comparable && (
          <s-text color="subdued">
            Margin and markup are not shown because the price and the cost are in different
            currencies.
          </s-text>
        )}
      </s-stack>

      <s-stack direction="block" gap="base">
        <s-heading>Suppliers</s-heading>
        {detail.suppliers.length === 0 ? (
          <s-text color="subdued">
            No supplier is set for this variant, so it can't be added to a purchase order from
            this worksheet.
          </s-text>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Supplier</s-table-header>
              <s-table-header>Supplier SKU</s-table-header>
              <s-table-header format="numeric">Cost</s-table-header>
              <s-table-header format="numeric">Minimum order</s-table-header>
              <s-table-header format="numeric">Pack size</s-table-header>
              <s-table-header format="numeric">Lead time (days)</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {detail.suppliers.map((supplier) => (
                <s-table-row key={supplier.supplierId}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-text>{supplier.supplierName}</s-text>
                      {supplier.supplierId === line.supplierId && (
                        <s-badge tone="info">Used for this row</s-badge>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{supplier.vendorSku ?? MISSING_VALUE}</s-table-cell>
                  <s-table-cell>{money(supplier.supplierCost, supplier.currency, 4)}</s-table-cell>
                  <s-table-cell>{quantity(supplier.moq)}</s-table-cell>
                  <s-table-cell>{quantity(supplier.packSize)}</s-table-cell>
                  <s-table-cell>{quantity(supplier.leadTimeDays)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-stack>

      {previewDefaults && <Preview line={line} defaults={previewDefaults} />}
    </s-stack>
  );
}

export function LineDetailModal({
  id,
  line,
  context,
  previewDefaults,
}: {
  id: string;
  line: WorksheetLine | null;
  context: LineDetailContext;
  /** Null when the worksheet's settings can't be read, so nothing can be recalculated. */
  previewDefaults: PreviewFormValues | null;
}) {
  return (
    <s-modal id={id} heading={line ? variantLabel(line) : "Row detail"} size="large">
      {line && (
        <LineDetail key={line.id} line={line} context={context} previewDefaults={previewDefaults} />
      )}
      <s-button slot="secondary-actions" commandFor={id} command="--hide">
        Close
      </s-button>
    </s-modal>
  );
}
