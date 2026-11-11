import { useState, type KeyboardEvent } from "react";
import { Form } from "react-router";

import { CUSTOM_RANGE_PRESET, RANGE_PRESETS } from "../../lib/reports/range-presets";
import type { ReportPage } from "../../lib/reports/registry.server";

type Props = Pick<
  ReportPage,
  "report" | "request" | "view" | "facets" | "table" | "searchLabels"
>;

// Polaris text fields do not submit their form on Enter.
function submitOnEnter(event: KeyboardEvent<HTMLFormElement>) {
  const target = event.target as HTMLElement;
  if (event.key === "Enter" && target.tagName.toLowerCase() === "s-search-field") {
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
}

/**
 * The report's settings as a GET form: applying it puts the whole view in the
 * URL, so a report can be bookmarked, shared and exported exactly as shown.
 */
export function ReportFilters({
  report,
  request,
  view,
  facets,
  table,
  searchLabels,
}: Props) {
  const searchable = searchLabels.length > 0;
  const [preset, setPreset] = useState(request.range.preset);
  const hasControls =
    report.usesDateRange || report.options.length > 0 || facets.length > 0 || searchable;
  if (!hasControls) return null;

  return (
    <s-section heading="Filters">
      <Form method="get" onKeyDown={submitOnEnter}>
        <input type="hidden" name="sort" value={table.sort.key} />
        <input type="hidden" name="dir" value={table.sort.direction} />
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignItems="end">
            {report.usesDateRange && (
              <s-select
                label="Date range"
                name="range"
                value={preset}
                onChange={(event) => setPreset(event.currentTarget.value)}
              >
                {RANGE_PRESETS.map((choice) => (
                  <s-option key={choice.value} value={choice.value}>
                    {choice.label}
                  </s-option>
                ))}
              </s-select>
            )}
            {report.usesDateRange && preset === CUSTOM_RANGE_PRESET && (
              <>
                <s-date-field
                  label="From"
                  name="start"
                  defaultValue={request.range.startLocalDate}
                  required
                />
                <s-date-field
                  label="To"
                  name="end"
                  defaultValue={request.range.endLocalDate}
                  required
                />
              </>
            )}
            {report.options.map((option) => (
              <s-select
                key={option.key}
                label={option.label}
                name={option.key}
                value={request.options[option.key]}
              >
                {option.choices.map((choice) => (
                  <s-option key={choice.value} value={choice.value}>
                    {choice.label}
                  </s-option>
                ))}
              </s-select>
            ))}
            {facets.map((facet) => (
              <s-select key={facet.key} label={facet.label} name={facet.key} value={facet.selected}>
                <s-option value="">All</s-option>
                {facet.choices.map((choice) => (
                  <s-option key={choice.value} value={choice.value}>
                    {choice.label}
                  </s-option>
                ))}
              </s-select>
            ))}
          </s-stack>
          <s-stack direction="inline" gap="base" alignItems="end">
            {searchable && (
              <s-search-field
                label="Search"
                name="q"
                defaultValue={view.search}
                placeholder={searchLabels.join(", ")}
              />
            )}
            <s-button type="submit" variant="primary">
              Apply
            </s-button>
          </s-stack>
        </s-stack>
      </Form>
    </s-section>
  );
}
