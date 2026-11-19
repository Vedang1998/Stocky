import { useState } from "react";
import { useFetcher } from "react-router";
import {
  DEFAULT_WORKSHEET_COLUMNS,
  WORKSHEET_COLUMNS,
  WORKSHEET_COLUMN_LABELS,
  type WorksheetColumn,
} from "../../lib/replenishment/worksheet/columns";
import type { WorksheetActionResult } from "./types";

/**
 * Chooses which optional columns the worksheet shows. The choice is saved
 * for the shop, so every worksheet opens with it. Give it a key made from
 * `columns` so a saved choice starts it afresh.
 */
export function ColumnsModal({
  id,
  columns,
}: {
  id: string;
  columns: readonly WorksheetColumn[];
}) {
  const fetcher = useFetcher<WorksheetActionResult>();
  const [chosen, setChosen] = useState<ReadonlySet<WorksheetColumn>>(() => new Set(columns));
  // A checkbox keeps its own checked state once clicked, so the boxes are
  // drawn again whenever the choice is reset rather than toggled.
  const [drawn, setDrawn] = useState(0);
  const reset = (next: Iterable<WorksheetColumn>) => {
    setChosen(new Set(next));
    setDrawn((count) => count + 1);
  };
  const result = fetcher.data?.intent === "saveColumns" ? fetcher.data : null;

  const toggle = (column: WorksheetColumn, checked: boolean) => {
    setChosen((current) => {
      const next = new Set(current);
      if (checked) next.add(column);
      else next.delete(column);
      return next;
    });
  };

  const save = () => {
    const form = new FormData();
    form.set("intent", "saveColumns");
    for (const column of WORKSHEET_COLUMNS) {
      if (chosen.has(column)) form.append("column", column);
    }
    fetcher.submit(form, { method: "post" });
  };

  return (
    <s-modal id={id} heading="Columns">
      <s-stack direction="block" gap="base">
        <s-text color="subdued">
          Product, the suggested and order quantities, and status are always shown. Your choice is
          saved for every worksheet.
        </s-text>
        {result && !result.ok && (
          <s-banner tone="critical" heading="Columns were not saved">
            <s-paragraph>{result.message}</s-paragraph>
          </s-banner>
        )}
        <s-stack direction="block" gap="small-200">
          {WORKSHEET_COLUMNS.map((column) => (
            <s-checkbox
              key={`${column}-${drawn}`}
              label={WORKSHEET_COLUMN_LABELS[column]}
              {...(chosen.has(column) ? { checked: true } : {})}
              onChange={(event) => toggle(column, event.currentTarget.checked)}
            />
          ))}
        </s-stack>
        <s-button
          variant="tertiary"
          onClick={() => reset(DEFAULT_WORKSHEET_COLUMNS)}
        >
          Restore the usual columns
        </s-button>
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        commandFor={id}
        command="--hide"
        onClick={save}
      >
        Save columns
      </s-button>
      <s-button
        slot="secondary-actions"
        commandFor={id}
        command="--hide"
        onClick={() => reset(columns)}
      >
        Cancel
      </s-button>
    </s-modal>
  );
}
