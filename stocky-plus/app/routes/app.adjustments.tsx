import { randomUUID } from "node:crypto";
import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ActionFeedback } from "../components/ActionFeedback";
import { isInventoryWriteEnabled } from "../lib/feature-flags.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import {
  ADJUSTMENT_MODES,
  ADJUSTMENT_REASONS,
  MAX_ADJUSTMENT_LINES,
  MAX_ADJUSTMENT_NOTE_LENGTH,
  MAX_ADJUSTMENT_TEXT_LENGTH,
  adjustmentReasonLabel,
  type AdjustmentMode,
} from "../services/adjustments/adjustment-input";
import {
  formatAdjustmentCursor,
  readAdjustmentHistoryQuery,
} from "../services/adjustments/adjustment-history-query";
import {
  ADJUSTMENT_HISTORY_PAGE_SIZE,
  listAdjustments,
  resumeAdjustment,
  reverseAdjustment,
  submitAdjustment,
  type AdjustmentHistoryEntry,
  type AdjustmentResult,
} from "../services/adjustments/adjustment.server";
import {
  requireAdminTenantWithActor,
  STAFF_REQUIRED_MESSAGE,
} from "../services/inventory-writes/actor.server";
import { readFormId } from "../services/inventory-writes/form-values";
import type {
  InventoryOperationLineStatus,
  InventoryOperationStatus,
} from "../services/inventory-writes/types";
import { fetchLocations } from "../services/shopify-gql.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request });
  const query = readAdjustmentHistoryQuery(new URL(request.url).searchParams);

  const [locations, entries] = await Promise.all([
    fetchLocations(admin),
    // One more than a page, to know whether an older page exists.
    listAdjustments(db, {
      from: query.from,
      to: query.to,
      after: query.after,
      take: ADJUSTMENT_HISTORY_PAGE_SIZE + 1,
    }),
  ]);
  const history = entries.slice(0, ADJUSTMENT_HISTORY_PAGE_SIZE);
  const last = history.at(-1);

  return {
    // Identifies the adjustment the form on this page will record, so that
    // submitting the form twice records it once.
    submissionId: randomUUID(),
    writesEnabled: isInventoryWriteEnabled("adjustmentWrites"),
    locations,
    history,
    olderCursor:
      entries.length > ADJUSTMENT_HISTORY_PAGE_SIZE && last
        ? formatAdjustmentCursor({
            createdAt: last.createdAt,
            operationId: last.operationId,
          })
        : null,
    filter: { from: query.fromDay, to: query.toDay },
  };
};

type FormValues = {
  locationId: string;
  mode: string;
  reason: string;
  note: string;
  lines: string;
};

function failure(result: Extract<AdjustmentResult, { ok: false }>) {
  return {
    error: result.error,
    details: result.details,
    problems: result.problems,
  };
}

const text = (value: FormDataEntryValue | null): string =>
  typeof value === "string" ? value : "";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, db, actor } = await requireAdminTenantWithActor({ request });
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent !== "submit" && intent !== "resume" && intent !== "reverse") {
    return { error: "That action is not available." };
  }
  if (!actor) return { error: STAFF_REQUIRED_MESSAGE };

  if (intent === "submit") {
    const values: FormValues = {
      locationId: text(form.get("locationId")),
      mode: text(form.get("mode")),
      reason: text(form.get("reason")),
      note: text(form.get("note")),
      lines: text(form.get("lines")),
    };
    const result = await submitAdjustment(db, admin, actor, {
      submissionId: readFormId(form.get("submissionId")),
      locationId: readFormId(values.locationId),
      reason: values.reason,
      mode: values.mode,
      note: values.note,
      linesText: values.lines,
    });
    if (!result.ok) {
      return {
        ...failure(result),
        // What was typed is handed back only while none of it is in the
        // ledger; a recorded adjustment must not be entered a second time.
        values:
          !result.recorded && values.lines.length <= MAX_ADJUSTMENT_TEXT_LENGTH
            ? values
            : undefined,
      };
    }
    if (result.alreadySubmitted) {
      return {
        ok: true,
        notice:
          "This adjustment was already recorded. Nothing more was sent to Shopify.",
      };
    }
    return {
      ok: true,
      notice:
        result.changedLineCount === 0
          ? "Every quantity already matched Shopify. Nothing was changed."
          : `Adjustment applied to ${result.changedLineCount} ${result.changedLineCount === 1 ? "item" : "items"} in Shopify.`,
    };
  }

  const operationId = readFormId(form.get("operationId"));
  if (!operationId) return { error: "Adjustment not found" };

  if (intent === "resume") {
    const result = await resumeAdjustment(db, admin, operationId);
    return result.ok
      ? { ok: true, notice: "Shopify has now confirmed every change." }
      : failure(result);
  }

  const result = await reverseAdjustment(db, admin, actor, {
    operationId,
    note: text(form.get("note")),
  });
  if (!result.ok) return failure(result);
  return {
    ok: true,
    notice: result.alreadySubmitted
      ? "This adjustment was already reversed. Nothing more was sent to Shopify."
      : "Adjustment reversed. Its changes are undone in Shopify.",
  };
};

const MODE_LABEL: Record<AdjustmentMode, string> = {
  ADJUST: "Add or remove units",
  SET: "Set the available quantity",
};

const STATUS_BADGE: Record<
  InventoryOperationStatus,
  { tone: "success" | "warning" | "critical"; label: string }
> = {
  APPLIED: { tone: "success", label: "Applied" },
  PARTIALLY_APPLIED: { tone: "warning", label: "Partly applied" },
  FAILED: { tone: "critical", label: "Not applied" },
  BLOCKED: { tone: "warning", label: "Switched off" },
  PENDING: { tone: "warning", label: "Not finished" },
  APPLYING: { tone: "warning", label: "Not finished" },
  RETRY_PENDING: { tone: "warning", label: "Not finished" },
};

const LINE_RESULT: Record<InventoryOperationLineStatus, string> = {
  APPLIED: "Applied",
  FAILED: "Refused by Shopify",
  CONFLICT: "Not applied: the quantity changed in Shopify first",
  PENDING: "Not sent yet",
  IN_FLIGHT: "Waiting for Shopify to confirm",
};

const signed = (delta: number) => (delta > 0 ? `+${delta}` : String(delta));

/** `2026-11-11 21:40 UTC`; the same text on the server and in the browser. */
function formatUtc(value: Date | string): string {
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function exportHref(filter: { from: string; to: string }): string {
  const params = new URLSearchParams();
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  const query = params.toString();
  return `/app/adjustments/export${query ? `?${query}` : ""}`;
}

function olderHref(filter: { from: string; to: string }, cursor: string) {
  const params = new URLSearchParams({ after: cursor });
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  return `/app/adjustments?${params.toString()}`;
}

function HistoryEntry({
  entry,
  locationName,
  busy,
}: {
  entry: AdjustmentHistoryEntry;
  locationName: (id: string | null) => string;
  busy: boolean;
}) {
  const [confirmingReversal, setConfirmingReversal] = useState(false);
  const badge = STATUS_BADGE[entry.status];
  const isReversal = entry.kind === "REVERSAL";

  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="base"
    >
      <s-stack direction="block" gap="small">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-text type="strong">
            {isReversal ? "Reversal" : adjustmentReasonLabel(entry.reason)}
          </s-text>
          <s-badge tone={badge.tone}>{badge.label}</s-badge>
          {entry.reversedByOperationId && <s-badge>Reversed</s-badge>}
        </s-stack>
        <s-text color="subdued">
          {formatUtc(entry.createdAt)} · {locationName(entry.locationId)} ·{" "}
          {entry.staffId ? `Staff ID ${entry.staffId}` : "Staff not recorded"}
        </s-text>
        {entry.note && <s-paragraph>{entry.note}</s-paragraph>}

        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Item</s-table-header>
            <s-table-header>SKU</s-table-header>
            <s-table-header format="numeric">Change</s-table-header>
            <s-table-header format="numeric">Available after</s-table-header>
            <s-table-header>Result</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {entry.lines.map((line, index) => (
              <s-table-row key={index}>
                <s-table-cell>{line.title}</s-table-cell>
                <s-table-cell>{line.sku ?? ""}</s-table-cell>
                <s-table-cell>{signed(line.delta)}</s-table-cell>
                <s-table-cell>{line.quantityAfterChange ?? ""}</s-table-cell>
                <s-table-cell>
                  {LINE_RESULT[line.status]}
                  {line.status === "FAILED" && line.errorMessage
                    ? `: ${line.errorMessage}`
                    : ""}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>

        {entry.canResume && (
          <Form method="post">
            <input type="hidden" name="intent" value="resume" />
            <input type="hidden" name="operationId" value={entry.operationId} />
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-button
                type="submit"
                variant="primary"
                {...(busy ? { disabled: true } : {})}
              >
                Finish applying
              </s-button>
              <s-text color="subdued">
                Sends only the changes Shopify has not confirmed.
              </s-text>
            </s-stack>
          </Form>
        )}

        {entry.canReverse && !confirmingReversal && (
          <s-stack direction="inline">
            <s-button
              variant="tertiary"
              tone="critical"
              onClick={() => setConfirmingReversal(true)}
            >
              Reverse this adjustment
            </s-button>
          </s-stack>
        )}
        {entry.canReverse && confirmingReversal && (
          <Form method="post" onSubmit={() => setConfirmingReversal(false)}>
            <input type="hidden" name="intent" value="reverse" />
            <input type="hidden" name="operationId" value={entry.operationId} />
            <s-stack direction="block" gap="small">
              <s-paragraph>
                Reversing applies the opposite of every applied line above. It
                can be done once and cannot itself be reversed.
              </s-paragraph>
              <s-text-field
                label="Why it is being reversed (optional)"
                name="note"
                maxLength={MAX_ADJUSTMENT_NOTE_LENGTH}
              />
              <s-stack direction="inline" gap="small">
                <s-button
                  type="submit"
                  variant="primary"
                  tone="critical"
                  {...(busy ? { disabled: true } : {})}
                >
                  Reverse in Shopify
                </s-button>
                <s-button
                  variant="secondary"
                  onClick={() => setConfirmingReversal(false)}
                >
                  Keep it
                </s-button>
              </s-stack>
            </s-stack>
          </Form>
        )}
      </s-stack>
    </s-box>
  );
}

export default function Adjustments() {
  const {
    submissionId,
    writesEnabled,
    locations,
    history,
    olderCursor,
    filter,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const values: Partial<FormValues> =
    (actionData && "values" in actionData ? actionData.values : undefined) ??
    {};
  const locationName = (id: string | null) =>
    id ? (locations.find((l) => l.id === id)?.name ?? id) : "Unknown location";
  const filtered = Boolean(filter.from || filter.to);

  return (
    <s-page heading="Adjustments">
      {!writesEnabled && (
        <s-banner tone="warning" heading="Adjustments are switched off">
          <s-paragraph>
            Inventory adjustments are switched off for this app, so a new
            adjustment is not sent to Shopify. Past adjustments can still be
            reviewed and downloaded.
          </s-paragraph>
        </s-banner>
      )}
      <ActionFeedback data={actionData} errorHeading="Adjustment issue" />

      <s-section heading="New adjustment">
        {locations.length === 0 ? (
          <s-paragraph>
            No Shopify locations were found for this shop. Add a location in
            Shopify admin, run a sync from the dashboard, then come back.
          </s-paragraph>
        ) : (
          // Remounted for each new submission ID so a recorded adjustment
          // leaves an empty form behind.
          <Form method="post" key={submissionId}>
            <input type="hidden" name="intent" value="submit" />
            <input type="hidden" name="submissionId" value={submissionId} />
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="base">
                <s-select
                  label="Location"
                  name="locationId"
                  value={values.locationId ?? locations[0].id}
                  required
                >
                  {locations.map((l) => (
                    <s-option key={l.id} value={l.id}>
                      {l.name}
                    </s-option>
                  ))}
                </s-select>
                <s-select
                  label="Reason"
                  name="reason"
                  value={values.reason ?? ADJUSTMENT_REASONS[0].code}
                  required
                >
                  {ADJUSTMENT_REASONS.map((reason) => (
                    <s-option key={reason.code} value={reason.code}>
                      {reason.label}
                    </s-option>
                  ))}
                </s-select>
                <s-select
                  label="Quantities below"
                  name="mode"
                  value={values.mode ?? ADJUSTMENT_MODES[0]}
                  required
                >
                  {ADJUSTMENT_MODES.map((mode) => (
                    <s-option key={mode} value={mode}>
                      {MODE_LABEL[mode]}
                    </s-option>
                  ))}
                </s-select>
              </s-stack>
              <s-text-area
                label="Items"
                name="lines"
                rows={8}
                defaultValue={values.lines ?? ""}
                placeholder={"ABC-123, 5\n0123456789012, -2"}
                details={`One item per line: its SKU or barcode, a comma, then the quantity. Use a minus sign to remove units. Two columns copied from a spreadsheet can be pasted as they are. Up to ${MAX_ADJUSTMENT_LINES} items.`}
                required
              />
              <s-text-field
                label="Note (optional)"
                name="note"
                defaultValue={values.note ?? ""}
                maxLength={MAX_ADJUSTMENT_NOTE_LENGTH}
              />
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-button
                  type="submit"
                  variant="primary"
                  {...(navigation.state === "submitting"
                    ? { loading: true }
                    : {})}
                >
                  Apply adjustment
                </s-button>
                <s-text color="subdued">
                  Setting a quantity is refused for an item whose stock changes
                  in Shopify while the adjustment is being applied.
                </s-text>
              </s-stack>
            </s-stack>
          </Form>
        )}
      </s-section>

      <s-section heading="Adjustment history">
        <s-stack direction="block" gap="base">
          <Form method="get">
            <s-stack direction="inline" gap="base" alignItems="end">
              <s-date-field
                label="From (UTC)"
                name="from"
                defaultValue={filter.from}
              />
              <s-date-field
                label="To (UTC)"
                name="to"
                defaultValue={filter.to}
              />
              <s-button type="submit" variant="secondary">
                Show
              </s-button>
              {filtered && (
                <s-button href="/app/adjustments" variant="tertiary">
                  Clear dates
                </s-button>
              )}
              <s-button
                href={exportHref(filter)}
                target="_blank"
                variant="secondary"
              >
                Download CSV
              </s-button>
            </s-stack>
          </Form>

          {history.length === 0 ? (
            <s-paragraph>
              {filtered
                ? "No adjustments were recorded between these dates."
                : "No adjustments have been recorded yet. The first one you apply appears here with the result Shopify gave for each item."}
            </s-paragraph>
          ) : (
            history.map((entry) => (
              <HistoryEntry
                key={entry.operationId}
                entry={entry}
                locationName={locationName}
                busy={busy}
              />
            ))
          )}

          {olderCursor && (
            <s-stack direction="inline">
              <s-button
                href={olderHref(filter, olderCursor)}
                variant="secondary"
              >
                Older adjustments
              </s-button>
            </s-stack>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
