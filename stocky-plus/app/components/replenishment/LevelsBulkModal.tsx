import { useState } from "react";
import { useFetcher } from "react-router";
import { MAX_LEAD_TIME_DAYS } from "../../lib/replenishment/form";
import type { RuleChangeOutcome } from "../../lib/replenishment/rules.server";
import { MAX_QUANTITY } from "../../lib/replenishment/types";
import type { WorksheetActionResult } from "./types";

type Mode = "keep" | "set" | "clear";

const LEVELS = [
  {
    name: "minimumQuantity",
    label: "Minimum",
    max: MAX_QUANTITY,
    suffix: undefined,
  },
  {
    name: "shelfLimitQuantity",
    label: "Shelf limit",
    max: MAX_QUANTITY,
    suffix: undefined,
  },
  {
    name: "reorderPointQuantity",
    label: "Reorder point",
    max: MAX_QUANTITY,
    suffix: undefined,
  },
  {
    name: "safetyStockQuantity",
    label: "Safety stock",
    max: MAX_QUANTITY,
    suffix: undefined,
  },
  {
    name: "leadTimeDays",
    label: "Lead time",
    max: MAX_LEAD_TIME_DAYS,
    suffix: "days",
  },
] as const;

type LevelName = (typeof LEVELS)[number]["name"];

const MODE_LABELS: Record<Mode, string> = {
  keep: "Keep as it is",
  set: "Set to",
  clear: "Clear",
};

function count(value: number, one: string, many: string): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;
}

/** What was changed, in one sentence. */
export function describeLevelsOutcome(
  variants: number,
  outcome: RuleChangeOutcome,
): string {
  const parts = [
    outcome.updated > 0
      ? `${count(outcome.updated, "variant", "variants")} changed`
      : "",
    outcome.created > 0
      ? `${count(outcome.created, "variant", "variants")} given levels`
      : "",
    outcome.cleared > 0
      ? `${count(outcome.cleared, "variant", "variants")} cleared`
      : "",
    outcome.skipped > 0
      ? `${count(outcome.skipped, "variant", "variants")} no longer in your catalog left out`
      : "",
  ].filter(Boolean);
  const done = parts.length > 0 ? parts.join(", ") : "nothing needed changing";
  const missed =
    outcome.missed > 0
      ? ` ${count(outcome.missed, "variant was", "variants were")} not changed because someone else saved levels at the same moment. Try again.`
      : "";
  return `Levels applied to ${count(variants, "variant", "variants")}: ${done}.${missed}`;
}

/**
 * Sets or clears planning levels for every variant the worksheet's current
 * filter and search show, in the stock scope the worksheet plans. Each
 * level can be kept, set or cleared; kept levels stay as each variant has
 * them. The open worksheet does not change.
 */
export function LevelsBulkModal({
  id,
  matching,
  scopeName,
  show,
  query,
}: {
  id: string;
  matching: number;
  scopeName: string;
  show: string;
  query: string;
}) {
  const fetcher = useFetcher<WorksheetActionResult>();
  const [modes, setModes] = useState<Record<LevelName, Mode>>({
    minimumQuantity: "keep",
    shelfLimitQuantity: "keep",
    reorderPointQuantity: "keep",
    safetyStockQuantity: "keep",
    leadTimeDays: "keep",
  });
  const result = fetcher.data?.intent === "setLevels" ? fetcher.data : null;
  const errors = result && !result.ok ? result.errors : {};
  const busy = fetcher.state !== "idle";

  return (
    <s-modal id={id} heading="Set planning levels">
      <fetcher.Form method="post" id={`${id}-form`}>
        <input type="hidden" name="intent" value="setLevels" />
        <input type="hidden" name="show" value={show} />
        <input type="hidden" name="q" value={query} />
        <input type="hidden" name="expectedCount" value={matching} />
        <s-stack direction="block" gap="base">
          <s-paragraph>
            For the {count(matching, "variant", "variants")} the current filter
            and search show, in this worksheet&apos;s stock ({scopeName}).
            Levels you keep stay as each variant has them. This worksheet keeps
            the levels it was generated with; the next one uses the new levels.
          </s-paragraph>
          {LEVELS.map((level) => (
            <s-query-container key={level.name}>
              <s-grid
                gridTemplateColumns="@container (inline-size > 440px) 1fr 1fr 1fr, 1fr 1fr"
                gap="base"
                alignItems="end"
              >
                <s-text type="strong">{level.label}</s-text>
                <s-select
                  label={`${level.label}: change`}
                  labelAccessibilityVisibility="exclusive"
                  name={`${level.name}Mode`}
                  value={modes[level.name]}
                  onChange={(event) => {
                    const mode = event.currentTarget.value as Mode;
                    setModes((current) => ({ ...current, [level.name]: mode }));
                  }}
                >
                  {(Object.keys(MODE_LABELS) as Mode[]).map((mode) => (
                    <s-option key={mode} value={mode}>
                      {MODE_LABELS[mode]}
                    </s-option>
                  ))}
                </s-select>
                {modes[level.name] === "set" ? (
                  <s-number-field
                    label={level.label}
                    labelAccessibilityVisibility="exclusive"
                    name={level.name}
                    min={0}
                    max={level.max}
                    step={1}
                    {...(level.suffix ? { suffix: level.suffix } : {})}
                    error={errors[level.name]}
                  />
                ) : (
                  <s-text color="subdued">{errors[level.name] ?? ""}</s-text>
                )}
              </s-grid>
            </s-query-container>
          ))}
          {errors.form && (
            <s-banner tone="warning">
              <s-paragraph>{errors.form}</s-paragraph>
            </s-banner>
          )}
          {result && !result.ok && result.message && (
            <s-banner tone="critical" heading="Levels were not saved">
              <s-paragraph>{result.message}</s-paragraph>
            </s-banner>
          )}
          {result?.ok && !busy && (
            <s-banner tone="success">
              <s-paragraph>
                {describeLevelsOutcome(result.variants, result.outcome)}
              </s-paragraph>
            </s-banner>
          )}
        </s-stack>
      </fetcher.Form>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => {
          const form = document.getElementById(`${id}-form`);
          if (form instanceof HTMLFormElement) form.requestSubmit();
        }}
        {...(busy ? { loading: true } : {})}
        {...(matching === 0 ? { disabled: true } : {})}
      >
        Apply to {count(matching, "variant", "variants")}
      </s-button>
      <s-button slot="secondary-actions" commandFor={id} command="--hide">
        Close
      </s-button>
    </s-modal>
  );
}
