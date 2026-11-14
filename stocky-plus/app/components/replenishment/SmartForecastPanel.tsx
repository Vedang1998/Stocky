/**
 * Smart Forecast for one worksheet row, shown in the row detail below the
 * Stocky Parity suggestion. It runs only when the merchant asks, never
 * changes the parity suggestion, and only changes the order quantity when
 * the merchant presses the button that says so.
 */
import { useFetcher } from "react-router";
import { formatDecimal, MISSING_VALUE } from "../../lib/decimal-format";
import type { WorksheetLine } from "../../lib/replenishment/worksheet/store.server";
import type { SmartForecast } from "../../lib/smart-forecast";
import type { SmartForecastLoaderResult, WorksheetActionResult } from "./types";

export const SMART_FORECAST_PATH = "/app/replenishment/smart-forecast";

function quantity(value: number | null): string {
  return value == null ? MISSING_VALUE : value.toLocaleString("en-US");
}

function units(value: string | null): string {
  return value == null ? MISSING_VALUE : formatDecimal(value);
}

function Scores({ forecast }: { forecast: SmartForecast }) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Method</s-table-header>
        <s-table-header format="numeric">Past periods tested</s-table-header>
        <s-table-header format="numeric">Typical error</s-table-header>
        <s-table-header format="numeric">Lean</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {forecast.scores.map((score) => (
          <s-table-row key={score.model}>
            <s-table-cell>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text>{score.label}</s-text>
                {score.model === forecast.model && <s-badge tone="info">Used</s-badge>}
              </s-stack>
            </s-table-cell>
            <s-table-cell>{quantity(score.origins)}</s-table-cell>
            <s-table-cell>
              {score.errorPercent == null ? MISSING_VALUE : `${score.errorPercent}%`}
            </s-table-cell>
            <s-table-cell>
              {score.biasPercent == null
                ? MISSING_VALUE
                : Number(score.biasPercent) > 0
                  ? `${score.biasPercent}% high`
                  : Number(score.biasPercent) < 0
                    ? `${score.biasPercent.slice(1)}% low`
                    : "None"}
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

function Result({
  line,
  forecast,
  historyDays,
}: {
  line: WorksheetLine;
  forecast: SmartForecast;
  historyDays: number;
}) {
  const apply = useFetcher<WorksheetActionResult>();
  const applied = apply.data?.intent === "setQuantity" ? apply.data : null;
  const locked = line.purchaseOrderId != null;
  const suggested = forecast.suggestedQuantity;

  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-text type="strong">
          {forecast.forecastUnits == null
            ? "Not enough sales history to forecast"
            : `${units(forecast.forecastUnits)} units expected over the next ${forecast.horizonDays} days (${forecast.label})`}
        </s-text>
        {forecast.outcome === "SELECTED" && (
          <s-text>
            The recent average expects {units(forecast.parityForecastUnits)} units over the same
            days.
          </s-text>
        )}
        {forecast.backtestRange && (
          <s-text>
            In the test, actual demand ran between {forecast.backtestRange.lowPercent}% and{" "}
            {forecast.backtestRange.highPercent}% of this method&apos;s forecast.
          </s-text>
        )}
        <s-unordered-list>
          {forecast.explanation.map((sentence) => (
            <s-list-item key={sentence}>{sentence}</s-list-item>
          ))}
        </s-unordered-list>
        <Scores forecast={forecast} />
        <s-text color="subdued">
          Tested on {historyDays} days of sales. Stock-out days are not known yet, so days with no
          stock count as days with no sales.
        </s-text>
        {forecast.outcome === "SELECTED" && suggested != null && (
          <s-text type="strong">Order on this forecast: {quantity(suggested)}</s-text>
        )}
        {forecast.outcome !== "SELECTED" && (
          <s-text type="strong">Keep the Stocky Parity suggestion for this row.</s-text>
        )}
        {suggested != null && !locked && forecast.outcome === "SELECTED" && (
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button
              {...(apply.state !== "idle" ? { loading: true } : {})}
              onClick={() =>
                apply.submit(
                  { intent: "setQuantity", lineId: line.id, quantity: String(suggested) },
                  { method: "post" },
                )
              }
            >
              Order {quantity(suggested)}
            </s-button>
            {applied?.ok && (
              <s-text color="subdued">
                Order quantity set to {quantity(applied.orderQuantity)}. The Stocky Parity
                suggestion is unchanged.
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
  );
}

export function SmartForecastPanel({
  line,
  worksheetId,
}: {
  line: WorksheetLine;
  worksheetId: string;
}) {
  const run = useFetcher<SmartForecastLoaderResult>();
  const data = run.data;

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-heading>Smart Forecast</s-heading>
        <s-badge>Advice</s-badge>
      </s-stack>
      <s-text color="subdued">
        Smart Forecast tests a few forecasting methods on this variant&apos;s own sales and uses
        one only when it beat the recent average in the past. It is advice beside the Stocky
        Parity suggestion above, which it never changes.
      </s-text>
      <s-button
        {...(run.state !== "idle" ? { loading: true } : {})}
        onClick={() =>
          run.load(
            `${SMART_FORECAST_PATH}?${new URLSearchParams({ worksheetId, lineId: line.id })}`,
          )
        }
      >
        {data ? "Run again" : "Run Smart Forecast"}
      </s-button>
      {data && !data.ok && (
        <s-banner tone={data.reason === "PLAN" ? "info" : "warning"}>
          <s-paragraph>{data.message}</s-paragraph>
        </s-banner>
      )}
      {data?.ok && (
        <Result line={line} forecast={data.forecast} historyDays={data.historyDays} />
      )}
    </s-stack>
  );
}
