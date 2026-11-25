import { useFetcher } from "react-router";
import type { ReactNode } from "react";
import { formatDecimal, MISSING_VALUE } from "../../lib/decimal-format";
import { variantLabel } from "../../lib/replenishment/worksheet/labels";
import { MAX_QUANTITY, type WarningCode } from "../../lib/replenishment/types";
import {
  lineMargin,
  revenuePerDay,
  STOCK_STATUS_LABELS,
  WARNING_LABELS,
} from "../../lib/replenishment/worksheet/describe";
import type { WorksheetColumn } from "../../lib/replenishment/worksheet/columns";
import type { WorksheetLine } from "../../lib/replenishment/worksheet/store.server";
import {
  worksheetViewSearch,
  type WorksheetSortKey,
  type WorksheetView,
} from "../../lib/replenishment/worksheet/view";
import type { SmartForecastColumn, WorksheetActionResult } from "./types";
import { money, percent, quantity, units } from "./format";
import type { LineDetailContext } from "./LineDetailModal";

const STATUS_TONES = {
  OUT_OF_STOCK: "critical",
  LOW: "warning",
  OK: "success",
  UNKNOWN: "neutral",
} as const;

const WARNINGS_SHOWN = 2;

function SortableHeader({
  label,
  sortKey,
  view,
  path,
  numeric = false,
}: {
  label: string;
  sortKey: WorksheetSortKey;
  view: WorksheetView;
  path: string;
  numeric?: boolean;
}) {
  const active = view.sort.key === sortKey;
  const ascending = view.sort.direction === "asc";
  const search = worksheetViewSearch(view, { sortKey }).toString();
  return (
    <s-table-header {...(numeric ? { format: "numeric" as const } : {})}>
      <s-link
        href={search ? `${path}?${search}` : path}
        accessibilityLabel={
          active
            ? `${label}, sorted ${ascending ? "ascending" : "descending"}. Reverse the order.`
            : `Sort by ${label}`
        }
      >
        {active ? `${label} ${ascending ? "↑" : "↓"}` : label}
      </s-link>
    </s-table-header>
  );
}

function QuantityCell({ line }: { line: WorksheetLine }) {
  const fetcher = useFetcher<WorksheetActionResult>();
  const result = fetcher.data?.intent === "setQuantity" ? fetcher.data : null;

  if (line.purchaseOrderId) {
    return (
      <s-stack direction="block" gap="small-200">
        <s-text>{quantity(line.orderQuantity)}</s-text>
        <s-badge tone="success">On {line.purchaseOrderNumber ?? "a purchase order"}</s-badge>
      </s-stack>
    );
  }

  const save = (value: string) => {
    fetcher.submit({ intent: "setQuantity", lineId: line.id, quantity: value }, { method: "post" });
  };

  return (
    <s-stack direction="block" gap="small-200">
      <s-number-field
        label={`Order quantity for ${variantLabel(line)}`}
        labelAccessibilityVisibility="exclusive"
        min={0}
        max={MAX_QUANTITY}
        step={1}
        value={String(line.orderQuantity)}
        error={result && !result.ok ? result.message : undefined}
        onChange={(event) => {
          const value = event.currentTarget.value.trim();
          if (value !== String(line.orderQuantity)) save(value);
        }}
      />
      {line.finalQuantity != null && (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone="info">Edited</s-badge>
          <s-button
            variant="tertiary"
            accessibilityLabel={`Return ${variantLabel(line)} to the suggested quantity`}
            onClick={() => save("")}
          >
            Use suggestion
          </s-button>
        </s-stack>
      )}
    </s-stack>
  );
}

function Suggested({ line }: { line: WorksheetLine }) {
  if (line.suggestedQuantity == null) return <s-text color="subdued">None</s-text>;
  if (line.parityQuantity != null && line.parityQuantity !== line.suggestedQuantity) {
    return (
      <s-stack direction="block" gap="small-200" alignItems="end">
        <s-text>{quantity(line.suggestedQuantity)}</s-text>
        <s-text color="subdued">{quantity(line.parityQuantity)} before supplier rules</s-text>
      </s-stack>
    );
  }
  return <s-text>{quantity(line.suggestedQuantity)}</s-text>;
}

function Warnings({ codes }: { codes: WarningCode[] }) {
  const shown = codes.slice(0, WARNINGS_SHOWN);
  const hidden = codes.length - shown.length;
  return (
    <>
      {shown.map((code) => (
        <s-badge key={code} tone="caution">
          {WARNING_LABELS[code] ?? code}
        </s-badge>
      ))}
      {hidden > 0 && <s-badge tone="caution">+{hidden} more</s-badge>}
    </>
  );
}

/** What a cell needs to know about the worksheet beyond its own row. */
type CellContext = Pick<LineDetailContext, "currencyCode" | "salesDays"> & {
  smartForecast: SmartForecastColumn;
};

/**
 * A row's Smart Forecast: the units expected over the days to cover and the
 * method used. Advice beside the parity suggestion, which it never changes.
 */
function SmartForecastCellView({
  line,
  column,
}: {
  line: WorksheetLine;
  column: SmartForecastColumn;
}) {
  if (column.status === "OFF") return MISSING_VALUE;
  if (column.status !== "OK") {
    return <s-text color="subdued">{column.status === "PLAN" ? "Pro plan" : "Last X days only"}</s-text>;
  }
  const cell = column.byRow[line.id];
  if (!cell || cell.forecastUnits == null) return MISSING_VALUE;
  return (
    <s-stack direction="block" gap="none">
      <s-text>{units(cell.forecastUnits)}</s-text>
      <s-text color="subdued">
        {cell.outcome === "SELECTED" ? cell.label : "Recent average kept"}
      </s-text>
    </s-stack>
  );
}

type ColumnSpec = {
  label: string;
  /** Null for a column the database does not sort by. */
  sortKey: WorksheetSortKey | null;
  numeric: boolean;
  cell: (line: WorksheetLine, context: CellContext) => ReactNode;
};

const COLUMNS: Record<WorksheetColumn, ColumnSpec> = {
  sku: {
    label: "SKU",
    sortKey: "sku",
    numeric: false,
    cell: (line) => line.sku ?? MISSING_VALUE,
  },
  barcode: {
    label: "Barcode",
    sortKey: null,
    numeric: false,
    cell: (line) => line.barcode ?? MISSING_VALUE,
  },
  supplier: {
    label: "Supplier",
    sortKey: "supplier",
    numeric: false,
    cell: (line) =>
      line.supplierName ?? (
        <s-text color="subdued">
          {line.supplierCount > 1 ? `${line.supplierCount} suppliers, none preferred` : "None"}
        </s-text>
      ),
  },
  vendorSku: {
    label: "Supplier SKU",
    sortKey: null,
    numeric: false,
    cell: (line) => line.vendorSku ?? MISSING_VALUE,
  },
  abc: { label: "ABC", sortKey: "abc", numeric: false, cell: (line) => line.abcClass ?? MISSING_VALUE },
  price: {
    label: "Price",
    sortKey: null,
    numeric: true,
    cell: (line) => money(line.priceAmount, line.priceCurrencyCode),
  },
  shopifyCost: {
    label: "Shopify cost",
    sortKey: null,
    numeric: true,
    cell: (line) => money(line.unitCostAmount, line.unitCostCurrencyCode, 4),
  },
  supplierCost: {
    label: "Supplier cost",
    sortKey: null,
    numeric: true,
    cell: (line) => money(line.supplierCostAmount, line.supplierCostCurrencyCode, 4),
  },
  margin: {
    label: "Margin",
    sortKey: null,
    numeric: true,
    cell: (line) => percent(lineMargin(line).margin),
  },
  markup: {
    label: "Markup",
    sortKey: null,
    numeric: true,
    cell: (line) => percent(lineMargin(line).markup),
  },
  available: {
    label: "Available",
    sortKey: "available",
    numeric: true,
    cell: (line) => quantity(line.availableQuantity),
  },
  onHand: {
    label: "On hand",
    sortKey: null,
    numeric: true,
    cell: (line) => quantity(line.onHandQuantity),
  },
  committed: {
    label: "Committed",
    sortKey: null,
    numeric: true,
    cell: (line) => quantity(line.committedQuantity),
  },
  incoming: {
    label: "Incoming",
    sortKey: "incoming",
    numeric: true,
    cell: (line) => quantity(line.incomingQuantity),
  },
  netUnits: {
    label: "Net sold",
    sortKey: "netUnits",
    numeric: true,
    cell: (line) => quantity(line.netUnits),
  },
  orders: {
    label: "Orders",
    sortKey: null,
    numeric: true,
    cell: (line) => quantity(line.distinctOrders),
  },
  revenue: {
    label: "Net sales",
    sortKey: null,
    numeric: true,
    cell: (line, { currencyCode }) => money(line.revenueAmount, currencyCode),
  },
  unitsPerDay: {
    label: "Per day",
    sortKey: "unitsPerDay",
    numeric: true,
    cell: (line) => formatDecimal(line.unitsPerDay),
  },
  revenuePerDay: {
    label: "Sales per day",
    sortKey: null,
    numeric: true,
    cell: (line, { currencyCode, salesDays }) =>
      money(revenuePerDay(line.revenueAmount, salesDays), currencyCode),
  },
  daysOfStock: {
    label: "Days of stock",
    sortKey: "daysOfStock",
    numeric: true,
    cell: (line) => formatDecimal(line.daysOfStock),
  },
  leadTime: {
    label: "Lead time",
    sortKey: null,
    numeric: true,
    cell: (line) =>
      line.leadTimeDays == null
        ? MISSING_VALUE
        : line.leadTimeDays === 1
          ? "1 day"
          : `${line.leadTimeDays.toLocaleString("en-US")} days`,
  },
  reorderPoint: {
    label: "Reorder point",
    sortKey: null,
    numeric: true,
    cell: (line) => quantity(line.reorderPoint),
  },
  forecastDemand: {
    label: "Forecast demand",
    sortKey: null,
    numeric: true,
    cell: (line) => formatDecimal(line.forecastDemand),
  },
  smartForecast: {
    label: "Smart Forecast",
    sortKey: null,
    numeric: true,
    cell: (line, { smartForecast }) => <SmartForecastCellView line={line} column={smartForecast} />,
  },
  packSize: {
    label: "Pack size",
    sortKey: null,
    numeric: true,
    cell: (line) => quantity(line.packSize),
  },
};

export function WorksheetTable({
  lines,
  columns,
  currencyCode,
  salesDays,
  smartForecast,
  view,
  path,
  detailModalId,
  onOpenDetail,
}: {
  lines: WorksheetLine[];
  /** The optional columns to show, in table order. */
  columns: readonly WorksheetColumn[];
  currencyCode: string | null;
  /** Days in the sales period, for sales per day; null when not recorded. */
  salesDays: number | null;
  /** The Smart Forecast column's data; only read when that column is shown. */
  smartForecast: SmartForecastColumn;
  view: WorksheetView;
  path: string;
  detailModalId: string;
  onOpenDetail: (line: WorksheetLine) => void;
}) {
  const header = { view, path };
  const cellContext: CellContext = { currencyCode, salesDays, smartForecast };
  return (
    <s-table>
      <s-table-header-row>
        <SortableHeader label="Product" sortKey="product" {...header} />
        {columns.map((column) => {
          const spec = COLUMNS[column];
          return spec.sortKey ? (
            <SortableHeader
              key={column}
              label={spec.label}
              sortKey={spec.sortKey}
              numeric={spec.numeric}
              {...header}
            />
          ) : (
            <s-table-header key={column} {...(spec.numeric ? { format: "numeric" as const } : {})}>
              {spec.label}
            </s-table-header>
          );
        })}
        <SortableHeader label="Suggested" sortKey="suggested" numeric {...header} />
        <SortableHeader label="Order" sortKey="order" numeric {...header} />
        <s-table-header>Status</s-table-header>
        <s-table-header>Details</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {lines.map((line) => (
          <s-table-row key={line.id}>
            <s-table-cell>
              <s-grid gridTemplateColumns="auto 1fr" gap="small-200" alignItems="center">
                <s-thumbnail size="small" src={line.imageUrl ?? undefined} alt="" />
                <s-stack direction="block" gap="none">
                  <s-text type="strong">{line.productTitle}</s-text>
                  {variantLabel(line) !== line.productTitle && (
                    <s-text color="subdued">{line.variantTitle}</s-text>
                  )}
                </s-stack>
              </s-grid>
            </s-table-cell>
            {columns.map((column) => (
              <s-table-cell key={column}>{COLUMNS[column].cell(line, cellContext)}</s-table-cell>
            ))}
            <s-table-cell>
              <Suggested line={line} />
            </s-table-cell>
            <s-table-cell>
              <QuantityCell line={line} />
            </s-table-cell>
            <s-table-cell>
              <s-stack direction="inline" gap="small-200">
                <s-badge tone={STATUS_TONES[line.stockStatus]}>
                  {STOCK_STATUS_LABELS[line.stockStatus]}
                </s-badge>
                <Warnings codes={line.warningCodes} />
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              <s-button
                variant="tertiary"
                commandFor={detailModalId}
                command="--show"
                accessibilityLabel={`How the quantity for ${variantLabel(line)} was calculated`}
                onClick={() => onOpenDetail(line)}
              >
                View
              </s-button>
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}
