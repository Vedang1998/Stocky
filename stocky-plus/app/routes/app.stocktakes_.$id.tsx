import { useEffect, useRef, useState } from "react";
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
import { requireActivePlanSnapshot } from "../billing/entitlements.server";
import { ActionFeedback } from "../components/ActionFeedback";
import { PlanRequiredBanner } from "../components/PlanRequiredBanner";
import { isInventoryWriteEnabled } from "../lib/feature-flags.server";
import {
  PDF_LINES_PER_PART,
  partLabel,
  partQuery,
  pdfPartCount,
} from "../lib/pdf/parts";
import { submitOnEnter } from "../lib/submit-on-enter";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import {
  requireAdminTenantWithActor,
  STAFF_REQUIRED_MESSAGE,
} from "../services/inventory-writes/actor.server";
import {
  parseWholeNumber,
  readFormId,
} from "../services/inventory-writes/form-values";
import { listSyncedLocations } from "../services/inventory-writes/locations.server";
import { planAllowsChanges } from "../services/inventory-writes/plan-access.server";
import { readShopTimeZone } from "../services/inventory-writes/shop-clock.server";
import { formatShopTime } from "../services/inventory-writes/shop-time";
import {
  getStocktake,
  getStocktakeLedgerSummary,
  getStocktakeLines,
  getStocktakeProgress,
  readLineFilter,
  readLineSearch,
  readPageNumber,
  type StocktakeLineFilter,
  type StocktakeLineView,
} from "../services/stocktakes/stocktake-read.server";
import {
  addStocktakeItems,
  cancelStocktake,
  clearZeroFill,
  completeStocktake,
  recordStocktakeScan,
  requestStocktakeRecount,
  resolveStocktakeMovement,
  saveStocktakeCount,
  withdrawStocktakeRecount,
  zeroFillUncounted,
} from "../services/stocktakes/stocktake.server";
import {
  MAX_ADDED_ITEMS,
  MAX_COUNTED_QUANTITY,
  MAX_ITEM_LIST_LENGTH,
} from "../services/stocktakes/stocktake-limits";
import { differenceValueLine } from "../services/stocktakes/stocktake-value";
import { getStocktakeDifferenceValue } from "../services/stocktakes/stocktake-value.server";
import {
  COUNT_SOURCE_LABEL,
  itemCount,
  signed,
  staffText,
  STOCKTAKE_SCOPE_LABEL,
  STOCKTAKE_STATUS_BADGE,
} from "../services/stocktakes/stocktake-display";

const NOT_FOUND = "Stocktake not found";
const COUNT_RANGE_MESSAGE = `Enter the counted quantity as a whole number from 0 to ${MAX_COUNTED_QUANTITY.toLocaleString("en-US")}.`;

/** The views in which a blind count shows its expected quantities: they are the review step. */
const REVIEW_FILTERS: ReadonlySet<StocktakeLineFilter> = new Set([
  "differences",
  "movement",
]);

/** A line as the page receives it; expected figures are withheld while a blind count is being counted. */
type PageLine = Omit<
  StocktakeLineView,
  "expectedQty" | "movementDetectedQty" | "movementBaselineQty"
> & {
  expectedQty: number | null;
  movementDetectedQty: number | null;
  movementBaselineQty: number | null;
};

function withheld(line: StocktakeLineView): PageLine {
  return {
    ...line,
    expectedQty: null,
    delta: null,
    movementDetectedQty: null,
    movementBaselineQty: null,
  };
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { db, tenant } = await requireAdminTenant({ request, params });
  const stocktakeId = readFormId(params.id);
  const stocktake = stocktakeId ? await getStocktake(db, stocktakeId) : null;
  if (!stocktake) throw new Response(NOT_FOUND, { status: 404 });

  const query = new URL(request.url).searchParams;
  const filter = readLineFilter(query.get("filter"));
  const search = readLineSearch(query.get("q"));

  const open = stocktake.status === "IN_PROGRESS";
  const expectedHidden = stocktake.blind && open && !REVIEW_FILTERS.has(filter);
  const [progress, lines, ledger, locations, planActive, timeZone, value] =
    await Promise.all([
      getStocktakeProgress(db, stocktake.id),
      getStocktakeLines(db, {
        stocktakeId: stocktake.id,
        filter,
        search,
        page: readPageNumber(query.get("page")),
      }),
      getStocktakeLedgerSummary(db, stocktake.id),
      listSyncedLocations(db),
      planAllowsChanges(db),
      readShopTimeZone(tenant),
      // What the differences are worth says what the differences are, so it
      // is withheld with them while a blind count is being counted.
      expectedHidden ? null : getStocktakeDifferenceValue(db, stocktake),
    ]);

  return {
    stocktake,
    locationName:
      locations.find((location) => location.id === stocktake.locationId)
        ?.name ?? "Location no longer in Shopify",
    progress: {
      ...progress,
      ...(expectedHidden
        ? { differenceCount: null, unitsOver: null, unitsShort: null }
        : {}),
    },
    lines: {
      ...lines,
      lines: expectedHidden
        ? lines.lines.map(withheld)
        : (lines.lines as PageLine[]),
    },
    ledger,
    filter,
    search,
    expectedHidden,
    value,
    planActive,
    timeZone,
    writesEnabled: isInventoryWriteEnabled("stocktakeInventoryWrites"),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, db, actor } = await requireAdminTenantWithActor({
    request,
    params,
  });
  await requireActivePlanSnapshot(db);
  const stocktakeId = readFormId(params.id);
  if (!stocktakeId) return { error: NOT_FOUND };
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "scan") {
    const quantityField = form.get("quantity");
    const quantity =
      quantityField === null || quantityField === ""
        ? 1
        : parseWholeNumber(quantityField, {
            min: 1,
            max: MAX_COUNTED_QUANTITY,
          });
    if (quantity === null) {
      return {
        error: `Enter the scanned quantity as a whole number from 1 to ${MAX_COUNTED_QUANTITY.toLocaleString("en-US")}.`,
      };
    }
    const result = await recordStocktakeScan(db, admin, {
      stocktakeId,
      code: form.get("code"),
      quantity,
      actor,
    });
    if (!result.ok) return { error: result.error, scannedAt: Date.now() };
    return {
      ok: true,
      scannedAt: Date.now(),
      notice: `${result.title}: ${result.countedQty.toLocaleString("en-US")} counted${result.added ? " (added to this count)" : ""}${result.recounted ? " (recount started from zero)" : ""}`,
    };
  }

  if (intent === "count") {
    const lineId = readFormId(form.get("lineId"));
    if (!lineId) return { error: "Stocktake line not found" };
    const field = form.get("countedQty");
    const cleared = typeof field === "string" && field.trim() === "";
    const countedQty = cleared
      ? null
      : parseWholeNumber(field, { min: 0, max: MAX_COUNTED_QUANTITY });
    if (!cleared && countedQty === null) return { error: COUNT_RANGE_MESSAGE };
    const result = await saveStocktakeCount(db, admin, {
      stocktakeId,
      lineId,
      countedQty,
      actor,
    });
    if (!result.ok) return { error: result.error };
    return { ok: true, notice: cleared ? "Count cleared." : "Count saved." };
  }

  if (intent === "recount" || intent === "keepCount") {
    const lineId = readFormId(form.get("lineId"));
    if (!lineId) return { error: "Stocktake line not found" };
    const result =
      intent === "recount"
        ? await requestStocktakeRecount(db, { stocktakeId, lineId, actor })
        : await withdrawStocktakeRecount(db, { stocktakeId, lineId });
    if (!result.ok) return { error: result.error };
    return {
      ok: true,
      notice:
        intent === "recount"
          ? "Recount asked for. The count cannot be completed until the item is counted again."
          : "Count kept. The item no longer waits for a recount.",
    };
  }

  if (intent === "addItems") {
    const codes = form.get("codes");
    const result = await addStocktakeItems(db, admin, {
      stocktakeId,
      codesText: codes,
    });
    if (!result.ok) {
      return {
        error: result.error,
        details: result.details,
        // What was pasted is handed back so the lines named can be fixed.
        codes:
          typeof codes === "string" && codes.length <= MAX_ITEM_LIST_LENGTH
            ? codes
            : undefined,
      };
    }
    const already =
      result.alreadyOnCount > 0
        ? ` ${itemCount(result.alreadyOnCount)} already on the count.`
        : "";
    return {
      ok: true,
      notice: `${itemCount(result.added)} added to the count.${already}`,
    };
  }

  if (intent === "zeroFill") {
    const result = await zeroFillUncounted(db, { stocktakeId, actor });
    if (!result.ok) return { error: result.error };
    return {
      ok: true,
      notice:
        result.lines === 0
          ? "Every item already has a count."
          : `${itemCount(result.lines)} marked as zero.`,
    };
  }

  if (intent === "clearZeroFill") {
    const result = await clearZeroFill(db, { stocktakeId });
    if (!result.ok) return { error: result.error };
    return {
      ok: true,
      notice: `${itemCount(result.lines)} set back to not counted.`,
    };
  }

  if (intent === "resolveMovement") {
    const lineId = readFormId(form.get("lineId"));
    const result = await resolveStocktakeMovement(db, {
      stocktakeId,
      lineIds: lineId ? [lineId] : null,
      resolution: form.get("resolution"),
    });
    if (!result.ok) return { error: result.error };
    if (result.resolved === 0) {
      return {
        error: "That item no longer waits for review. Reload the page.",
      };
    }
    return {
      ok: true,
      notice:
        result.remaining > 0
          ? `${itemCount(result.resolved)} reviewed. ${itemCount(result.remaining)} still to review.`
          : `${itemCount(result.resolved)} reviewed. The count can be completed.`,
    };
  }

  if (intent === "complete") {
    if (!actor) return { error: STAFF_REQUIRED_MESSAGE };
    const result = await completeStocktake(db, admin, actor, stocktakeId, {
      acceptUncounted: form.get("acceptUncounted") === "1",
    });
    if (!result.ok) {
      return {
        error: result.error,
        problems: result.problems,
        blocker: result.blocker,
      };
    }
    return {
      ok: true,
      notice: result.alreadyCompleted
        ? "This count was already completed. Nothing more was sent to Shopify."
        : "Count completed. Its differences are applied in Shopify.",
    };
  }

  if (intent === "cancel") {
    const result = await cancelStocktake(db, { stocktakeId, actor });
    if (!result.ok) return { error: result.error };
    return {
      ok: true,
      notice: result.alreadyCancelled
        ? "This count was already cancelled."
        : "Count cancelled. Nothing was changed in Shopify.",
    };
  }

  return { error: "That action is not available." };
};

const FILTER_LABEL: Record<StocktakeLineFilter, string> = {
  all: "All",
  uncounted: "Not counted",
  counted: "Counted",
  differences: "Differences",
  recount: "To recount",
  movement: "Stock moved",
};

function pageHref(
  stocktakeId: string,
  view: { filter: StocktakeLineFilter; search: string; page: number },
): string {
  const params = new URLSearchParams();
  if (view.filter !== "all") params.set("filter", view.filter);
  if (view.search) params.set("q", view.search);
  if (view.page > 1) params.set("page", String(view.page));
  const query = params.toString();
  return `/app/stocktakes/${stocktakeId}${query ? `?${query}` : ""}`;
}

const disabledWhen = (condition: boolean) =>
  condition ? { disabled: true } : {};

/** The two ways a line whose stock moved can be settled, with the change each one makes. */
function MovementReview({ line, locked }: { line: PageLine; locked: boolean }) {
  if (
    line.countedQty === null ||
    line.expectedQty === null ||
    line.movementDetectedQty === null
  ) {
    return null;
  }
  const choices = [
    {
      resolution: "COUNTED_BEFORE",
      label: "Counted before the stock moved",
      change: line.countedQty - line.expectedQty,
    },
    {
      resolution: "COUNTED_AFTER",
      label: "Counted after the stock moved",
      change: line.countedQty - line.movementDetectedQty,
    },
  ];
  return (
    <s-stack direction="block" gap="small-200">
      <s-text>
        Shopify had {line.expectedQty} when the count started and has{" "}
        {line.movementDetectedQty} now.
      </s-text>
      <s-stack direction="inline" gap="small-200">
        {choices.map((choice) => (
          <Form method="post" key={choice.resolution}>
            <input type="hidden" name="intent" value="resolveMovement" />
            <input type="hidden" name="lineId" value={line.id} />
            <input type="hidden" name="resolution" value={choice.resolution} />
            <s-button
              type="submit"
              variant="secondary"
              {...disabledWhen(locked)}
            >
              {choice.label} (change {signed(choice.change)})
            </s-button>
          </Form>
        ))}
      </s-stack>
    </s-stack>
  );
}

function lineNote(line: PageLine): string {
  const notes: string[] = [];
  if (line.countSource) notes.push(COUNT_SOURCE_LABEL[line.countSource]);
  if (line.recountRequestedAt === null && line.recountFromQty !== null) {
    notes.push(
      `recounted, first counted as ${line.recountFromQty.toLocaleString("en-US")}`,
    );
  }
  if (line.movementReviewedAt) {
    notes.push(
      line.movementBaselineQty === null
        ? "stock moved after it was counted"
        : `counted after stock moved to ${line.movementBaselineQty}`,
    );
  }
  return notes.join(", ");
}

/**
 * Under a line's count field: ask for the line to be counted again, or, while
 * it waits for that, say so and offer to keep the count it has.
 */
function RecountControl({ line, locked }: { line: PageLine; locked: boolean }) {
  if (line.recountRequestedAt) {
    return (
      <Form method="post">
        <input type="hidden" name="intent" value="keepCount" />
        <input type="hidden" name="lineId" value={line.id} />
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone="warning">Recount asked</s-badge>
          {line.countedQty !== null && (
            <s-button
              type="submit"
              variant="tertiary"
              {...disabledWhen(locked)}
            >
              Keep the count of {line.countedQty.toLocaleString("en-US")}
            </s-button>
          )}
        </s-stack>
      </Form>
    );
  }
  if (line.countedQty === null) return null;
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="recount" />
      <input type="hidden" name="lineId" value={line.id} />
      <s-button type="submit" variant="tertiary" {...disabledWhen(locked)}>
        Ask for a recount
      </s-button>
    </Form>
  );
}

/** Up to this many parts are offered as buttons; a longer count lists its parts under one heading. */
const MAX_SHEET_PART_BUTTONS = 4;

export default function StocktakeCount() {
  const {
    stocktake,
    locationName,
    progress,
    lines,
    ledger,
    filter,
    search,
    expectedHidden,
    value,
    planActive,
    timeZone,
    writesEnabled,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  // Nothing is submitted twice, and nothing at all without an active plan.
  const locked = useNavigation().state !== "idle" || !planActive;
  // Enter in a field submits too, so it is taken away with the buttons.
  const onEnter = planActive ? submitOnEnter : undefined;
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const open = stocktake.status === "IN_PROGRESS";
  const badge = STOCKTAKE_STATUS_BADGE[stocktake.status];
  const valueLine = value && differenceValueLine(value);
  // The paper is a sheet to count from until the count is closed, then a
  // record of it. A count with no items has nothing to print.
  const sheetName =
    stocktake.status === "COMPLETED" || stocktake.status === "CANCELLED"
      ? "count record"
      : "count sheet";
  const sheetParts =
    progress.lineCount === 0
      ? []
      : Array.from(
          { length: pdfPartCount(progress.lineCount) },
          (_, index) => index + 1,
        );
  const sheetHref = (part: number) =>
    `/app/stocktakes/${stocktake.id}/count-sheet${partQuery(part, sheetParts.length)}`;
  const scannedAt =
    actionData && "scannedAt" in actionData ? actionData.scannedAt : undefined;
  const pastedCodes =
    actionData && "codes" in actionData ? (actionData.codes ?? "") : "";

  // A scanner sends one code after another: the field is emptied and focused
  // again after every scan so the next code lands in it.
  const scanField = useRef<HTMLElementTagNameMap["s-text-field"]>(null);
  useEffect(() => {
    if (scannedAt !== undefined) scanField.current?.focus();
  }, [scannedAt]);

  const view = (
    change: Partial<{
      filter: StocktakeLineFilter;
      search: string;
      page: number;
    }>,
  ) => pageHref(stocktake.id, { filter, search, page: 1, ...change });
  const filterCount: Record<StocktakeLineFilter, number | null> = {
    all: progress.lineCount,
    uncounted: progress.uncountedCount,
    counted: progress.countedCount,
    differences: progress.differenceCount,
    recount: progress.recountCount,
    movement: progress.movementReviewCount,
  };
  const showExpected = !expectedHidden;
  const reviewingMovement = filter === "movement";

  return (
    <s-page heading={stocktake.name}>
      <s-link slot="breadcrumb-actions" href="/app/stocktakes">
        Stocktakes
      </s-link>

      {!planActive && <PlanRequiredBanner records="This count" />}
      {open && !writesEnabled && (
        <s-banner
          tone="warning"
          heading="Stock changes from counts are switched off"
        >
          <s-paragraph>
            This count can be counted and reviewed. Completing it, which changes
            stock in Shopify, stays unavailable until it is switched on for this
            app.
          </s-paragraph>
        </s-banner>
      )}
      {open && ledger.attemptCount > 0 && (
        <s-banner tone="warning" heading="This count is partly applied">
          <s-paragraph>
            {ledger.unfinished
              ? "Shopify has not finished answering the last attempt to complete this count."
              : `Shopify confirmed ${ledger.appliedChangeCount.toLocaleString("en-US")} of this count's changes and refused ${ledger.refusedChangeCount.toLocaleString("en-US")} in the last attempt.`}{" "}
            Complete the count again to send what is left. Changes Shopify has
            confirmed are not sent twice.
          </s-paragraph>
        </s-banner>
      )}
      {open && progress.recountCount > 0 && filter !== "recount" && (
        <s-banner tone="info" heading="A recount was asked for">
          <s-paragraph>
            {itemCount(progress.recountCount)}{" "}
            {progress.recountCount === 1 ? "waits" : "wait"} to be counted
            again. The count cannot be completed until then.{" "}
            <s-link href={view({ filter: "recount", search: "" })}>
              Show {progress.recountCount === 1 ? "it" : "them"}
            </s-link>
          </s-paragraph>
        </s-banner>
      )}
      {open && progress.movementReviewCount > 0 && !reviewingMovement && (
        <s-banner tone="warning" heading="Stock moved during this count">
          <s-paragraph>
            Shopify&apos;s quantity changed for{" "}
            {itemCount(progress.movementReviewCount)} after the count started.{" "}
            <s-link href={view({ filter: "movement", search: "" })}>
              Review {progress.movementReviewCount === 1 ? "it" : "them"}
            </s-link>{" "}
            before completing the count.
          </s-paragraph>
        </s-banner>
      )}
      {open && stocktake.expectedSource === "SYNC" && (
        <s-banner
          tone="info"
          heading="Expected quantities are from the last sync"
        >
          <s-paragraph>
            This count started from the last synced quantities, not from a read
            of Shopify. Each item&apos;s quantity is read from Shopify when it
            is first counted, and any item still unread is read before the count
            is completed.
          </s-paragraph>
        </s-banner>
      )}
      <ActionFeedback data={actionData} errorHeading="Stocktake issue" />

      <s-section heading="Count">
        <s-stack direction="block" gap="small">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-badge tone={badge.tone}>{badge.label}</s-badge>
            <s-badge>{STOCKTAKE_SCOPE_LABEL[stocktake.scope]}</s-badge>
            {stocktake.blind && <s-badge>Blind count</s-badge>}
          </s-stack>
          <s-text>
            {locationName} · started{" "}
            {formatShopTime(
              stocktake.startedAt ?? stocktake.createdAt,
              timeZone,
            )}{" "}
            by {staffText(stocktake.startedByUserId)}
          </s-text>
          {stocktake.status === "COMPLETED" && (
            <s-text>
              Completed {formatShopTime(stocktake.completedAt, timeZone)} by{" "}
              {staffText(stocktake.completedByUserId)}. Its differences are
              applied in Shopify.
            </s-text>
          )}
          {stocktake.status === "CANCELLED" && (
            <s-text>
              Cancelled {formatShopTime(stocktake.cancelledAt, timeZone)} by{" "}
              {staffText(stocktake.cancelledByUserId)}. Nothing was changed in
              Shopify.
            </s-text>
          )}
          <s-text>
            {progress.countedCount.toLocaleString("en-US")} of{" "}
            {itemCount(progress.lineCount)} counted
            {progress.differenceCount !== null &&
              ` · ${itemCount(progress.differenceCount)} with a difference (${(progress.unitsOver ?? 0).toLocaleString("en-US")} units over, ${(progress.unitsShort ?? 0).toLocaleString("en-US")} units short)`}
          </s-text>
          {valueLine && <s-text>{valueLine}</s-text>}
          <s-stack direction="inline" gap="small">
            <s-button
              href={`/app/stocktakes/${stocktake.id}/export`}
              target="_blank"
              variant="secondary"
            >
              Download count sheet (CSV)
            </s-button>
            {sheetParts.length <= MAX_SHEET_PART_BUTTONS &&
              sheetParts.map((part) => (
                <s-button
                  key={part}
                  href={sheetHref(part)}
                  target="_blank"
                  variant="secondary"
                >
                  Print {sheetName}
                  {partLabel(part, sheetParts.length)} (PDF)
                </s-button>
              ))}
          </s-stack>
          {sheetParts.length > MAX_SHEET_PART_BUTTONS && (
            <details>
              <summary>
                Print {sheetName} (PDF), in {sheetParts.length} parts of up to{" "}
                {PDF_LINES_PER_PART} items
              </summary>
              <s-stack direction="inline" gap="small">
                {sheetParts.map((part) => (
                  <s-link key={part} href={sheetHref(part)} target="_blank">
                    Part {part}: items{" "}
                    {((part - 1) * PDF_LINES_PER_PART + 1).toLocaleString(
                      "en-US",
                    )}{" "}
                    to{" "}
                    {Math.min(
                      part * PDF_LINES_PER_PART,
                      progress.lineCount,
                    ).toLocaleString("en-US")}
                  </s-link>
                ))}
              </s-stack>
            </details>
          )}
        </s-stack>
      </s-section>

      {open && (
        <s-section heading="Scan or enter items">
          <s-stack direction="block" gap="base">
            <Form method="post" onKeyDown={onEnter} key={scannedAt ?? 0}>
              <input type="hidden" name="intent" value="scan" />
              <s-stack direction="inline" gap="base" alignItems="end">
                <s-text-field
                  ref={scanField}
                  label="Barcode or SKU"
                  name="code"
                  autocomplete="off"
                />
                <s-number-field
                  label="Units"
                  name="quantity"
                  value="1"
                  min={1}
                  max={MAX_COUNTED_QUANTITY}
                />
                <s-button
                  type="submit"
                  variant="primary"
                  {...disabledWhen(locked)}
                >
                  Count
                </s-button>
              </s-stack>
            </Form>
            <s-text color="subdued">
              Each scan adds its units to the item&apos;s count. An item that is
              not on the count yet is added to it.
            </s-text>

            <s-divider />

            <Form method="post">
              <input type="hidden" name="intent" value="addItems" />
              <s-stack direction="block" gap="small">
                <s-text-area
                  label="Add items without counting them"
                  name="codes"
                  rows={3}
                  maxLength={MAX_ITEM_LIST_LENGTH}
                  placeholder={"One barcode or SKU per line"}
                  details={`Up to ${MAX_ADDED_ITEMS} items at a time.`}
                  value={pastedCodes}
                />
                <s-stack direction="inline">
                  <s-button
                    type="submit"
                    variant="secondary"
                    {...disabledWhen(locked)}
                  >
                    Add to count
                  </s-button>
                </s-stack>
              </s-stack>
            </Form>
          </s-stack>
        </s-section>
      )}

      <s-section heading="Items">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            {(Object.keys(FILTER_LABEL) as StocktakeLineFilter[]).map((key) => {
              const count = filterCount[key];
              const label = `${FILTER_LABEL[key]}${count === null ? "" : ` (${count.toLocaleString("en-US")})`}`;
              return key === filter ? (
                <s-text key={key} type="strong">
                  {label}
                </s-text>
              ) : (
                <s-link key={key} href={view({ filter: key })}>
                  {label}
                </s-link>
              );
            })}
          </s-stack>
          {expectedHidden && (
            <s-text color="subdued">
              This is a blind count: expected quantities stay hidden while
              counting. The Differences and Stock moved views show them for
              review.
            </s-text>
          )}

          <Form method="get" onKeyDown={submitOnEnter}>
            {filter !== "all" && (
              <input type="hidden" name="filter" value={filter} />
            )}
            <s-stack direction="inline" gap="small" alignItems="end">
              <s-text-field
                label="Find an item by name, SKU or barcode"
                name="q"
                value={search}
              />
              <s-button type="submit" variant="secondary">
                Find
              </s-button>
              {search && <s-link href={view({ search: "" })}>Clear</s-link>}
            </s-stack>
          </Form>
          {lines.searchTooBroad && (
            <s-text color="subdued">
              Many items match that search and only some of them were looked at.
              Use a longer name, or a SKU or barcode.
            </s-text>
          )}

          {open && reviewingMovement && lines.total > 1 && (
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-text>Settle all {lines.total.toLocaleString("en-US")}:</s-text>
              {(
                [
                  ["COUNTED_BEFORE", "All were counted before the stock moved"],
                  ["COUNTED_AFTER", "All were counted after the stock moved"],
                ] as const
              ).map(([resolution, label]) => (
                <Form method="post" key={resolution}>
                  <input type="hidden" name="intent" value="resolveMovement" />
                  <input type="hidden" name="resolution" value={resolution} />
                  <s-button
                    type="submit"
                    variant="secondary"
                    {...disabledWhen(locked)}
                  >
                    {label}
                  </s-button>
                </Form>
              ))}
            </s-stack>
          )}

          {lines.lines.length === 0 ? (
            <s-paragraph>
              {search
                ? "No item on this count matches that search."
                : filter === "all"
                  ? "No items are on this count yet. Scan an item or add a list of items to begin."
                  : filter === "movement"
                    ? "No item waits for review."
                    : "No items in this view."}
            </s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Item</s-table-header>
                <s-table-header>SKU</s-table-header>
                {showExpected && (
                  <s-table-header format="numeric">Expected</s-table-header>
                )}
                <s-table-header format="numeric" listSlot="secondary">
                  Counted
                </s-table-header>
                {showExpected && (
                  <s-table-header format="numeric">Difference</s-table-header>
                )}
                <s-table-header>
                  {open ? "Count" : "How counted"}
                </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {lines.lines.map((line) => (
                  <s-table-row key={line.id}>
                    <s-table-cell>
                      <s-stack direction="block" gap="small-200">
                        <s-text>{line.title}</s-text>
                        {line.barcode && (
                          <s-text color="subdued">{line.barcode}</s-text>
                        )}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>{line.sku ?? ""}</s-table-cell>
                    {showExpected && (
                      <s-table-cell>{line.expectedQty ?? ""}</s-table-cell>
                    )}
                    <s-table-cell>{line.countedQty ?? "—"}</s-table-cell>
                    {showExpected && (
                      <s-table-cell>
                        {line.delta === null ? "—" : signed(line.delta)}
                      </s-table-cell>
                    )}
                    <s-table-cell>
                      <s-stack direction="block" gap="small-200">
                        {open && reviewingMovement ? (
                          <MovementReview line={line} locked={locked} />
                        ) : open ? (
                          <Form
                            method="post"
                            onKeyDown={onEnter}
                            key={`${line.id}:${line.countedQty}:${line.recountRequestedAt ? "recount" : ""}`}
                          >
                            <input type="hidden" name="intent" value="count" />
                            <input
                              type="hidden"
                              name="lineId"
                              value={line.id}
                            />
                            <s-stack direction="inline" gap="small-200">
                              <s-number-field
                                label={`Counted quantity of ${line.title}`}
                                labelAccessibilityVisibility="exclusive"
                                name="countedQty"
                                // A recount starts from an empty field, so the
                                // first count is not simply saved again.
                                value={
                                  line.countedQty !== null &&
                                  !line.recountRequestedAt
                                    ? String(line.countedQty)
                                    : ""
                                }
                                min={0}
                                max={MAX_COUNTED_QUANTITY}
                              />
                              <s-button
                                type="submit"
                                variant="secondary"
                                {...disabledWhen(locked)}
                              >
                                Save
                              </s-button>
                            </s-stack>
                          </Form>
                        ) : null}
                        {open && !reviewingMovement && (
                          <RecountControl line={line} locked={locked} />
                        )}
                        {lineNote(line) && (
                          <s-text color="subdued">{lineNote(line)}</s-text>
                        )}
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}

          {lines.pageCount > 1 && (
            <s-stack direction="inline" gap="base" alignItems="center">
              {lines.page > 1 && (
                <s-link href={view({ page: lines.page - 1 })}>Previous</s-link>
              )}
              <s-text color="subdued">
                Page {lines.page} of {lines.pageCount}
              </s-text>
              {lines.page < lines.pageCount && (
                <s-link href={view({ page: lines.page + 1 })}>Next</s-link>
              )}
            </s-stack>
          )}
        </s-stack>
      </s-section>

      {open && (
        <s-section heading="Finish the count">
          <s-stack direction="block" gap="base">
            {progress.zeroFilledCount > 0 && (
              <Form method="post">
                <input type="hidden" name="intent" value="clearZeroFill" />
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-text>
                    {itemCount(progress.zeroFilledCount)} marked as zero because
                    nobody counted{" "}
                    {progress.zeroFilledCount === 1 ? "it" : "them"}.
                  </s-text>
                  <s-button
                    type="submit"
                    variant="tertiary"
                    {...disabledWhen(locked)}
                  >
                    Undo
                  </s-button>
                </s-stack>
              </Form>
            )}

            {progress.uncountedCount > 0 ? (
              <s-stack direction="block" gap="small">
                <s-text>
                  {itemCount(progress.uncountedCount)}{" "}
                  {progress.uncountedCount === 1 ? "has" : "have"} no count.
                  Count {progress.uncountedCount === 1 ? "it" : "them"}, or
                  choose what happens to{" "}
                  {progress.uncountedCount === 1 ? "it" : "them"}:
                </s-text>
                <s-stack direction="inline" gap="small">
                  <Form method="post">
                    <input type="hidden" name="intent" value="zeroFill" />
                    <s-button
                      type="submit"
                      variant="secondary"
                      {...disabledWhen(locked)}
                    >
                      Mark {progress.uncountedCount === 1 ? "it" : "them"} as
                      zero
                    </s-button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="complete" />
                    <input type="hidden" name="acceptUncounted" value="1" />
                    <s-button
                      type="submit"
                      variant="primary"
                      {...disabledWhen(
                        locked || !writesEnabled || progress.countedCount === 0,
                      )}
                    >
                      Complete and leave{" "}
                      {progress.uncountedCount === 1 ? "it" : "them"} unchanged
                    </s-button>
                  </Form>
                </s-stack>
              </s-stack>
            ) : (
              <Form method="post">
                <input type="hidden" name="intent" value="complete" />
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-button
                    type="submit"
                    variant="primary"
                    {...disabledWhen(
                      locked || !writesEnabled || progress.countedCount === 0,
                    )}
                  >
                    Complete count
                  </s-button>
                  <s-text color="subdued">
                    Applies every difference to Shopify&apos;s stock and closes
                    the count.
                  </s-text>
                </s-stack>
              </Form>
            )}

            <s-divider />

            {confirmingCancel ? (
              <Form method="post" onSubmit={() => setConfirmingCancel(false)}>
                <input type="hidden" name="intent" value="cancel" />
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-text>
                    Cancel this count? Its counts are kept for the record and
                    nothing changes in Shopify.
                  </s-text>
                  <s-button
                    type="submit"
                    variant="primary"
                    tone="critical"
                    {...disabledWhen(locked)}
                  >
                    Cancel count
                  </s-button>
                  <s-button
                    variant="tertiary"
                    onClick={() => setConfirmingCancel(false)}
                  >
                    Keep counting
                  </s-button>
                </s-stack>
              </Form>
            ) : (
              <s-stack direction="inline">
                <s-button
                  variant="tertiary"
                  tone="critical"
                  onClick={() => setConfirmingCancel(true)}
                >
                  Cancel this count
                </s-button>
              </s-stack>
            )}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
