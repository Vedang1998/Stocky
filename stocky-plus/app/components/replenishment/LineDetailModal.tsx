import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { formatDecimal, formatMoney, MISSING_VALUE } from "../../lib/decimal-format";
import { MAX_LEAD_TIME_DAYS } from "../../lib/replenishment/form";
import type { VariantRuleValues } from "../../lib/replenishment/rules.server";
import { SHOP_SCOPE } from "../../lib/replenishment/scope";
import {
  LEAD_TIME_SOURCE_LABELS,
  MAX_QUANTITY,
  PARITY_METHODS,
  PARITY_METHOD_LABELS,
  type ParityMethod,
  type TraceStep,
  type Warning,
} from "../../lib/replenishment/types";
import {
  ABC_CLASS_DESCRIPTIONS,
  formatLocalDate,
  marginAndMarkup,
  revenuePerDay,
  STOCK_STATUS_LABELS,
} from "../../lib/replenishment/worksheet/describe";
import { variantLabel } from "../../lib/replenishment/worksheet/labels";
import type { WorksheetLine } from "../../lib/replenishment/worksheet/store.server";
import { MethodPeriodFields } from "./MethodPeriodFields";
import { SmartForecastPanel } from "./SmartForecastPanel";
import type {
  LevelsActionResult,
  LevelsLoaderResult,
  PreviewFormValues,
  WorksheetActionResult,
} from "./types";

/** What the detail needs to know about the worksheet the row belongs to. */
export type LineDetailContext = {
  worksheetId: string;
  currencyCode: string | null;
  /** The days whose sales the row reports, for example "Oct 12, 2026 to Nov 10, 2026". */
  salesPeriod: string;
  /** Length of the sales period in days; null when the worksheet does not record it. */
  salesDays: number | null;
  /** The days the shop's ABC/U classes were measured over. */
  abcPeriod: string | null;
  /** The stock the worksheet plans: all locations together, or one location. */
  scope: { key: string; name: string };
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

const LEVELS_PATH = "/app/replenishment/levels";

const QUANTITY_LEVELS = [
  { name: "minimumQuantity", label: "Minimum" },
  { name: "shelfLimitQuantity", label: "Shelf limit" },
  { name: "reorderPointQuantity", label: "Reorder point" },
  { name: "safetyStockQuantity", label: "Safety stock" },
] as const;

function LevelsForm({
  variantGid,
  scopeKey,
  values,
}: {
  variantGid: string;
  scopeKey: string;
  values: VariantRuleValues;
}) {
  const save = useFetcher<LevelsActionResult>();
  const saved = save.data;
  const errors = saved && !saved.ok ? saved.errors : {};

  return (
    <save.Form method="post" action={LEVELS_PATH}>
      <input type="hidden" name="variantGid" value={variantGid} />
      <input type="hidden" name="scopeKey" value={scopeKey} />
      <s-stack direction="block" gap="base">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap="base">
          {QUANTITY_LEVELS.map((level) => (
            <s-number-field
              key={level.name}
              label={level.label}
              name={level.name}
              min={0}
              max={MAX_QUANTITY}
              step={1}
              value={String(values[level.name] ?? "")}
              error={errors[level.name]}
            />
          ))}
          <s-number-field
            label="Lead time"
            name="leadTimeDays"
            suffix="days"
            min={0}
            max={MAX_LEAD_TIME_DAYS}
            step={1}
            value={String(values.leadTimeDays ?? "")}
            error={errors.leadTimeDays}
          />
        </s-grid>
        <s-text color="subdued">
          Minimum and shelf limit are used by the fill shelves methods. A reorder point entered
          here replaces the calculated one; safety stock is added to the calculated one. Leave a
          field empty to not use it.
        </s-text>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button type="submit" {...(save.state !== "idle" ? { loading: true } : {})}>
            Save levels
          </s-button>
          {saved?.ok && save.state === "idle" && (
            <s-text color="subdued">
              {saved.outcome === "cleared" ? "Levels cleared." : "Levels saved."} This worksheet
              keeps the levels it was generated with; generate a new one to use them.
            </s-text>
          )}
        </s-stack>
        {saved && !saved.ok && saved.message && (
          <s-banner tone="critical">
            <s-paragraph>{saved.message}</s-paragraph>
          </s-banner>
        )}
      </s-stack>
    </save.Form>
  );
}

/**
 * The variant's stored levels for the stock this worksheet plans. They are
 * read when the detail opens because the worksheet only has the levels it was
 * generated with, which may have been changed since.
 */
function PlanningLevels({
  variantGid,
  scope,
}: {
  variantGid: string;
  scope: LineDetailContext["scope"];
}) {
  const stored = useFetcher<LevelsLoaderResult>();
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    stored.load(`${LEVELS_PATH}?${new URLSearchParams({ variantGid, scopeKey: scope.key })}`);
  }, [stored, variantGid, scope.key]);

  return (
    <s-stack direction="block" gap="base">
      <s-heading>Planning levels</s-heading>
      <s-text color="subdued">
        {scope.key === SHOP_SCOPE
          ? "These levels are used when you plan all locations together. Each location has its own."
          : `These levels are used when you plan ${scope.name}. Other locations, and all locations together, have their own.`}
      </s-text>
      {!stored.data ? (
        <s-spinner accessibilityLabel="Loading the planning levels" />
      ) : stored.data.ok ? (
        <LevelsForm variantGid={variantGid} scopeKey={scope.key} values={stored.data.values} />
      ) : (
        <s-banner tone="warning">
          <s-paragraph>{stored.data.message}</s-paragraph>
        </s-banner>
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
          <Fact label="Incoming">{quantity(line.incomingQuantity)}</Fact>
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

      <PlanningLevels variantGid={line.variantGid} scope={context.scope} />

      <s-stack direction="block" gap="base">
        <s-heading>Sales, {context.salesPeriod}</s-heading>
        <Facts>
          <Fact label="Net units sold">{quantity(line.netUnits)}</Fact>
          <Fact label="Orders">{quantity(line.distinctOrders)}</Fact>
          <Fact label="Net sales">{money(line.revenueAmount, context.currencyCode)}</Fact>
          <Fact label="Net sales per day">
            {money(revenuePerDay(line.revenueAmount, context.salesDays), context.currencyCode)}
          </Fact>
          <Fact label="Units per day">{formatDecimal(line.unitsPerDay)}</Fact>
        </Facts>
      </s-stack>

      <s-stack direction="block" gap="small-200">
        <s-heading>ABC class</s-heading>
        {line.abcClass ? (
          <s-paragraph>
            <s-text type="strong">{line.abcClass}</s-text>.{" "}
            {ABC_CLASS_DESCRIPTIONS[line.abcClass]}
            {context.abcPeriod ? ` (${context.abcPeriod}).` : "."}
          </s-paragraph>
        ) : (
          <s-text color="subdued">
            {context.abcPeriod
              ? "No class: the variant was not in the shop's catalog when the classes were measured."
              : "This worksheet was made before ABC classes were recorded."}
          </s-text>
        )}
        <s-text color="subdued">
          The class ranks the variant against the whole shop, not only this worksheet.
        </s-text>
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
            No supplier is set for this variant, so it can&apos;t be added to a purchase order from
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

      <SmartForecastPanel line={line} worksheetId={context.worksheetId} />
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
