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
import {
  formatUtc,
  itemCount,
  staffText,
} from "../services/stocktakes/stocktake-display";
import { readPageNumber } from "../services/stocktakes/stocktake-read.server";
import {
  addTransferItems,
  cancelTransfer,
  removeTransferLine,
  setTransferLineQuantity,
  setTransferPickedQuantity,
  shipTransfer,
} from "../services/transfers/transfer.server";
import {
  closeTransfer,
  countInOutstandingUnits,
  postTransferReceipt,
  receiveTransfer,
  recordTransferReceiptScan,
  setTransferReceiveQuantity,
  setTransferRejectedQuantity,
} from "../services/transfers/transfer-receiving.server";
import {
  getTransfer,
  getTransferHistory,
  getTransferLines,
  readTransferLineFilter,
  transferLedgerStanding,
  type TransferEvent,
  type TransferLineFilter,
  type TransferLineView,
} from "../services/transfers/transfer-read.server";
import {
  SHORT_RESOLUTION_LABEL,
  transferEventLabel,
  transferPaperParts,
  transferReference,
  transferStatusBadge,
  unitCount,
} from "../services/transfers/transfer-display";
import {
  MAX_ADDED_TRANSFER_ITEMS,
  MAX_REJECT_NOTE_LENGTH,
  MAX_TRANSFER_ITEM_TEXT_LENGTH,
  MAX_TRANSFER_LINE_QUANTITY,
  transferAttention,
  transferShipQuantity,
  type TransferAttention,
} from "../services/transfers/transfer-quantities";

const NOT_FOUND = "Transfer not found";
const LINE_NOT_FOUND = "Transfer line not found";
const QUANTITY_LIMIT = MAX_TRANSFER_LINE_QUANTITY.toLocaleString("en-US");

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request, params });
  const transferId = readFormId(params.id);
  const transfer = transferId ? await getTransfer(db, transferId) : null;
  if (!transfer) throw new Response(NOT_FOUND, { status: 404 });

  const query = new URL(request.url).searchParams;
  const filter = readTransferLineFilter(query.get("filter"));
  const [lines, history, locations, planActive] = await Promise.all([
    getTransferLines(db, {
      transfer,
      filter,
      page: readPageNumber(query.get("page")),
    }),
    getTransferHistory(db, transfer.id),
    listSyncedLocations(db),
    planAllowsChanges(db),
  ]);
  const locationName = (id: string) =>
    locations.find((location) => location.id === id)?.name ??
    "Location no longer in Shopify";

  return {
    transfer,
    sourceName: locationName(transfer.sourceLocationId),
    destinationName: locationName(transfer.destinationLocationId),
    lines,
    filter,
    history,
    // ProPo keeps no ledger for a transfer Shopify moves itself.
    attention: transfer.shopifyTransferId
      ? null
      : transferAttention(
          transfer.status,
          lines.totals,
          transferLedgerStanding(history),
        ),
    planActive,
    writesEnabled: isInventoryWriteEnabled("transferWrites"),
  };
};

/** The units typed next to a scan; an empty field is one unit. */
function readScanQuantity(field: FormDataEntryValue | null): number | null {
  return field === null || field === ""
    ? 1
    : parseWholeNumber(field, { min: 1, max: MAX_TRANSFER_LINE_QUANTITY });
}

const SCAN_QUANTITY_MESSAGE = `Enter the units as a whole number from 1 to ${QUANTITY_LIMIT}.`;

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, db, actor } = await requireAdminTenantWithActor({
    request,
    params,
  });
  await requireActivePlanSnapshot(db);
  const transferId = readFormId(params.id);
  if (!transferId) return { error: NOT_FOUND };
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "addItem") {
    const scannedAt = Date.now();
    const code = form.get("code");
    if (typeof code !== "string" || code.trim() === "") {
      return { error: "Scan or type a barcode or SKU.", scannedAt };
    }
    if (/[\r\n]/.test(code)) {
      return { error: "Scan or type one barcode or SKU at a time.", scannedAt };
    }
    const quantity = readScanQuantity(form.get("quantity"));
    if (quantity === null) return { error: SCAN_QUANTITY_MESSAGE, scannedAt };
    // The units follow the code after a tab, which keeps a code that itself
    // ends in a number from being read as "code, quantity".
    const result = await addTransferItems(db, {
      transferId,
      itemsText: `${code.trim()}\t${quantity}`,
    });
    if (!result.ok) {
      const [only] = result.details;
      return {
        error:
          result.details.length === 1
            ? sentence(only.replace(/^Line 1: /, ""))
            : result.error,
        scannedAt,
      };
    }
    const [item] = result.items;
    return {
      ok: true,
      scannedAt,
      notice: `${item.title}: ${unitCount(item.quantity)} on the transfer`,
    };
  }

  if (intent === "addItems") {
    const itemsText = form.get("items");
    const result = await addTransferItems(db, { transferId, itemsText });
    if (!result.ok) {
      return {
        error: result.error,
        details: result.details,
        // What was pasted is handed back so the lines named can be fixed.
        items:
          typeof itemsText === "string" &&
          itemsText.length <= MAX_TRANSFER_ITEM_TEXT_LENGTH
            ? itemsText
            : undefined,
      };
    }
    const raised =
      result.updated > 0
        ? ` ${itemCount(result.updated)} already on it had units added.`
        : "";
    return {
      ok: true,
      notice: `${itemCount(result.added)} added to the transfer.${raised}`,
    };
  }

  if (intent === "setQuantity" || intent === "pick" || intent === "remove") {
    const lineId = readFormId(form.get("lineId"));
    if (!lineId) return { error: LINE_NOT_FOUND };
    if (intent === "remove") {
      const result = await removeTransferLine(db, { lineId, transferId });
      return result.ok
        ? { ok: true, notice: "Item removed from the transfer." }
        : { error: result.error };
    }
    if (intent === "setQuantity") {
      const quantity = parseWholeNumber(form.get("quantity"), {
        min: 1,
        max: MAX_TRANSFER_LINE_QUANTITY,
      });
      if (quantity === null) {
        return {
          error: `Enter the quantity as a whole number from 1 to ${QUANTITY_LIMIT}. To take the item off the transfer, remove it.`,
        };
      }
      const result = await setTransferLineQuantity(db, {
        lineId,
        quantity,
        transferId,
      });
      return result.ok
        ? { ok: true, notice: "Quantity saved." }
        : { error: result.error };
    }
    const pickedQty = parseWholeNumber(form.get("pickedQty"), {
      min: 0,
      max: MAX_TRANSFER_LINE_QUANTITY,
    });
    if (pickedQty === null) {
      return {
        error: "Enter the picked quantity as a whole number of 0 or more.",
      };
    }
    const result = await setTransferPickedQuantity(db, {
      lineId,
      pickedQty,
      transferId,
    });
    return result.ok
      ? { ok: true, notice: "Picked quantity saved." }
      : { error: result.error };
  }

  if (intent === "ship") {
    if (!actor) return { error: STAFF_REQUIRED_MESSAGE };
    const result = await shipTransfer(db, admin, actor, transferId, {
      allowShortSource: form.get("allowShortSource") === "1",
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
      notice: result.alreadyDone
        ? "This transfer was already shipped. Nothing more was sent to Shopify."
        : "Transfer shipped. Its stock has left the source location in Shopify.",
    };
  }

  if (intent === "cancel") {
    const result = await cancelTransfer(db, admin, actor, transferId);
    if (!result.ok) return { error: result.error, problems: result.problems };
    return {
      ok: true,
      notice: result.alreadyDone
        ? "This transfer is cancelled and all of its stock is at the source location."
        : "Transfer cancelled.",
    };
  }

  if (intent === "scan") {
    const scannedAt = Date.now();
    const quantity = readScanQuantity(form.get("quantity"));
    if (quantity === null) return { error: SCAN_QUANTITY_MESSAGE, scannedAt };
    const result = await recordTransferReceiptScan(db, {
      transferId,
      code: form.get("code"),
      quantity,
    });
    if (!result.ok) return { error: result.error, scannedAt };
    return {
      ok: true,
      scannedAt,
      notice: `${result.title}: ${result.countedIn.toLocaleString("en-US")} counted in, ${result.outstanding.toLocaleString("en-US")} still to come`,
    };
  }

  if (intent === "countIn" || intent === "reject") {
    const lineId = readFormId(form.get("lineId"));
    if (!lineId) return { error: LINE_NOT_FOUND };
    if (intent === "countIn") {
      const quantity = parseWholeNumber(form.get("quantity"), {
        min: 0,
        max: MAX_TRANSFER_LINE_QUANTITY,
      });
      if (quantity === null) {
        return {
          error: "Enter the units that arrived as a whole number of 0 or more.",
        };
      }
      const result = await setTransferReceiveQuantity(db, {
        lineId,
        quantity,
        transferId,
      });
      return result.ok
        ? { ok: true, notice: "Counted-in units saved." }
        : { error: result.error };
    }
    const rejectedQty = parseWholeNumber(form.get("rejectedQty"), {
      min: 0,
      max: MAX_TRANSFER_LINE_QUANTITY,
    });
    if (rejectedQty === null) {
      return {
        error: "Enter the rejected units as a whole number of 0 or more.",
      };
    }
    const note = form.get("note");
    const result = await setTransferRejectedQuantity(db, {
      lineId,
      rejectedQty,
      note: typeof note === "string" ? note : null,
      transferId,
    });
    return result.ok
      ? { ok: true, notice: "Rejected units saved." }
      : { error: result.error };
  }

  if (intent === "countInAll") {
    const result = await countInOutstandingUnits(db, { transferId });
    if (!result.ok) return { error: result.error };
    return {
      ok: true,
      notice:
        result.units === 0
          ? "Every shipped unit is already accounted for."
          : `${unitCount(result.units)} counted in. Check them, then post the receipt.`,
    };
  }

  if (intent === "postReceipt" || intent === "receiveAll") {
    if (!actor) return { error: STAFF_REQUIRED_MESSAGE };
    const result = await (intent === "receiveAll"
      ? receiveTransfer(db, admin, actor, transferId)
      : postTransferReceipt(db, admin, actor, transferId));
    if (!result.ok) return { error: result.error, problems: result.problems };
    if (result.alreadyDone) {
      return {
        ok: true,
        notice:
          "This transfer was already received. Nothing more was sent to Shopify.",
      };
    }
    const posted =
      result.receivedUnits === 0
        ? "Receipt posted. Stock at the destination matches the units received."
        : `Receipt posted: ${unitCount(result.receivedUnits)} added to stock at the destination.`;
    return {
      ok: true,
      notice: result.completed
        ? `${posted} The transfer is finished.`
        : `${posted} The transfer stays in transit for the rest.`,
    };
  }

  if (intent === "close") {
    if (!actor) return { error: STAFF_REQUIRED_MESSAGE };
    const result = await closeTransfer(db, admin, actor, transferId, {
      resolution: form.get("resolution"),
    });
    if (!result.ok) return { error: result.error, problems: result.problems };
    return {
      ok: true,
      notice: result.alreadyDone
        ? "This transfer was already finished."
        : result.resolution
          ? `Transfer closed. ${unitCount(result.missingUnits)} ${SHORT_RESOLUTION_LABEL[result.resolution]}.`
          : "Transfer finished. Every shipped unit is received or rejected.",
    };
  }

  return { error: "That action is not available." };
};

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const disabledWhen = (condition: boolean) =>
  condition ? { disabled: true } : {};

const FILTER_LABEL: Record<TransferLineFilter, string> = {
  all: "All items",
  open: "Still to account for",
};

function pageHref(
  transferId: string,
  view: { filter: TransferLineFilter; page: number },
): string {
  const params = new URLSearchParams();
  if (view.filter !== "all") params.set("filter", view.filter);
  if (view.page > 1) params.set("page", String(view.page));
  const query = params.toString();
  return `/app/transfers/${transferId}${query ? `?${query}` : ""}`;
}

const ATTENTION: Record<TransferAttention, { heading: string; text: string }> =
  {
    SHIPMENT_UNFINISHED: {
      heading: "Shipping this transfer did not finish",
      text: "Part of its stock may already have left the source location. Ship the transfer again to send what is left, or cancel it to put back what left. Changes Shopify has confirmed are not sent twice.",
    },
    PUT_BACK_UNFINISHED: {
      heading: "Stock is still out of the source location",
      text: "This transfer was cancelled after part of its stock had left the source, and not all of it is back yet. Finish putting it back below.",
    },
    NO_SHIPMENT_RECORD: {
      heading: "ProPo has no record of this transfer leaving the source",
      text: "Because nothing shows its stock leaving the source location, ProPo will not add stock at the destination or put any back. Check the stock of these items at both locations in Shopify.",
    },
    RETURN_UNFINISHED: {
      heading: "Closing this transfer did not finish",
      text: "Part of its missing stock is already back at the source location, so nothing more can be received. Close the transfer again to finish. Changes Shopify has confirmed are not sent twice.",
    },
    RECEIPT_UNFINISHED: {
      heading: "The last receipt is not fully posted",
      text: "Stock at the destination does not match the units this transfer shows as received yet. Post the receipt again to send what is left. Changes Shopify has confirmed are not sent twice.",
    },
  };

function eventOutcome(event: TransferEvent): string {
  if (event.unfinished) return "Shopify has not finished answering";
  if (event.refusedChangeCount > 0) {
    const refused = `${event.refusedChangeCount.toLocaleString("en-US")} ${event.refusedChangeCount === 1 ? "change" : "changes"} refused by Shopify`;
    return event.status === "FAILED"
      ? `Nothing applied, ${refused}`
      : `Partly applied, ${refused}`;
  }
  return event.status === "FAILED" ? "Nothing applied" : "Confirmed by Shopify";
}

/** One whole-number field with its own Save button, for a single line. */
function LineQuantityForm({
  intent,
  lineId,
  name,
  label,
  value,
  min = 0,
  max,
  locked,
  onEnter,
}: {
  intent: string;
  lineId: string;
  name: string;
  label: string;
  value: number;
  min?: number;
  max: number;
  locked: boolean;
  onEnter: typeof submitOnEnter | undefined;
}) {
  return (
    <Form method="post" onKeyDown={onEnter}>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="lineId" value={lineId} />
      <s-stack direction="inline" gap="small-200">
        <s-number-field
          label={label}
          labelAccessibilityVisibility="exclusive"
          name={name}
          value={String(value)}
          min={min}
          max={max}
        />
        <s-button type="submit" variant="secondary" {...disabledWhen(locked)}>
          Save
        </s-button>
      </s-stack>
    </Form>
  );
}

function ItemCell({ line }: { line: TransferLineView }) {
  return (
    <s-stack direction="block" gap="small-200">
      <s-text>{line.title}</s-text>
      {line.barcode && <s-text color="subdued">{line.barcode}</s-text>}
    </s-stack>
  );
}

export default function TransferDetail() {
  const {
    transfer,
    sourceName,
    destinationName,
    lines,
    filter,
    history,
    attention,
    planActive,
    writesEnabled,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  // Nothing is submitted twice, and nothing at all without an active plan.
  const locked = useNavigation().state !== "idle" || !planActive;
  // Enter in a field submits too, so it is taken away with the buttons.
  const onEnter = planActive ? submitOnEnter : undefined;
  const [confirming, setConfirming] = useState<
    "cancel" | "RETURNED" | "WRITTEN_OFF" | null
  >(null);

  const { totals } = lines;
  const draft = transfer.status === "DRAFT";
  const inTransit = transfer.status === "IN_TRANSIT";
  const managedByShopify = transfer.shopifyTransferId !== null;
  const badge = transferStatusBadge(transfer.status, totals);
  const receivable =
    inTransit &&
    !managedByShopify &&
    (attention === null || attention === "RECEIPT_UNFINISHED");
  const closable =
    inTransit &&
    !managedByShopify &&
    (attention === null || attention === "RETURN_UNFINISHED");
  const sourceShort =
    actionData && "blocker" in actionData
      ? actionData.blocker === "SOURCE_SHORT"
      : false;
  const scannedAt =
    actionData && "scannedAt" in actionData ? actionData.scannedAt : undefined;
  const pastedItems =
    actionData && "items" in actionData ? (actionData.items ?? "") : "";

  // A scanner sends one code after another: the field is emptied and focused
  // again after every scan so the next code lands in it.
  const scanField = useRef<HTMLElementTagNameMap["s-text-field"]>(null);
  useEffect(() => {
    if (scannedAt !== undefined) scanField.current?.focus();
  }, [scannedAt]);

  const view = (
    change: Partial<{ filter: TransferLineFilter; page: number }>,
  ) => pageHref(transfer.id, { filter, page: 1, ...change });
  const closedShortUnits = totals.returnedUnits + totals.writtenOffUnits;
  // A long transfer prints as several documents; one button for each.
  const partCount = transferPaperParts(totals.lineCount);
  const paperParts = Array.from({ length: partCount }, (_, index) => index + 1);
  const partQuery = (part: number) => (partCount > 1 ? `?part=${part}` : "");
  const partLabel = (part: number) =>
    partCount > 1 ? `, part ${part} of ${partCount}` : "";

  return (
    <s-page heading={`Transfer ${transferReference(transfer.id)}`}>
      <s-link slot="breadcrumb-actions" href="/app/transfers">
        Transfers
      </s-link>

      {!planActive && <PlanRequiredBanner records="This transfer" />}
      {managedByShopify ? (
        <s-banner
          tone="info"
          heading="Shopify moves the stock of this transfer"
        >
          <s-paragraph>
            This transfer was shipped as a Shopify transfer. Receive it in
            Shopify admin; ProPo does not change stock for it.
          </s-paragraph>
        </s-banner>
      ) : (
        (draft || inTransit) &&
        !writesEnabled && (
          <s-banner
            tone="warning"
            heading="Stock changes from transfers are switched off"
          >
            <s-paragraph>
              {draft
                ? "This draft can be edited. Shipping it, which changes stock in Shopify, stays unavailable until it is switched on for this app."
                : "Units can be counted in and rejects recorded. Posting a receipt or returning stock to the source, which change stock in Shopify, stay unavailable until they are switched on for this app."}
            </s-paragraph>
          </s-banner>
        )
      )}
      {attention && (
        <s-banner tone="warning" heading={ATTENTION[attention].heading}>
          <s-paragraph>{ATTENTION[attention].text}</s-paragraph>
        </s-banner>
      )}
      <ActionFeedback data={actionData} errorHeading="Transfer issue" />

      <s-section heading="Transfer">
        <s-stack direction="block" gap="small">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-badge tone={badge.tone}>{badge.label}</s-badge>
            <s-text type="strong">
              {sourceName} to {destinationName}
            </s-text>
          </s-stack>
          <s-text>
            Created {formatUtc(transfer.createdAt)} by{" "}
            {staffText(transfer.createdByUserId)}
          </s-text>
          {transfer.shippedAt && (
            <s-text>
              Shipped {formatUtc(transfer.shippedAt)} by{" "}
              {staffText(transfer.shippedByUserId)}
            </s-text>
          )}
          {transfer.status === "RECEIVED" && (
            <s-text>
              {closedShortUnits > 0 ? "Closed" : "Received"}{" "}
              {formatUtc(transfer.receivedAt)} by{" "}
              {staffText(transfer.receivedByUserId)}
              {closedShortUnits > 0 &&
                `. ${unitCount(closedShortUnits)} that did not arrive ${closedShortUnits === 1 ? "was" : "were"} ${
                  SHORT_RESOLUTION_LABEL[
                    transfer.shortResolution ?? "WRITTEN_OFF"
                  ]
                }.`}
            </s-text>
          )}
          {transfer.status === "CANCELLED" && (
            <s-text>
              Cancelled
              {transfer.cancelledAt
                ? ` ${formatUtc(transfer.cancelledAt)} by ${staffText(transfer.cancelledByUserId)}`
                : ""}
              . Its stock stays at the source location.
            </s-text>
          )}
          {transfer.notes && <s-text>Notes: {transfer.notes}</s-text>}
          <s-text>
            {totals.lineCount === 0
              ? "No items yet"
              : draft || transfer.status === "CANCELLED"
                ? `${itemCount(totals.lineCount)}, ${unitCount(draft ? totals.shipUnits : totals.requestedUnits)} ${draft ? "to ship" : "requested"}`
                : [
                    `${itemCount(totals.lineCount)}, ${unitCount(totals.shipUnits)} shipped`,
                    `${totals.receivedUnits.toLocaleString("en-US")} received`,
                    ...(totals.countedInUnits > 0
                      ? [
                          `${totals.countedInUnits.toLocaleString("en-US")} counted in and not posted`,
                        ]
                      : []),
                    ...(totals.rejectedUnits > 0
                      ? [
                          `${totals.rejectedUnits.toLocaleString("en-US")} rejected`,
                        ]
                      : []),
                    ...(totals.returnedUnits > 0
                      ? [
                          `${totals.returnedUnits.toLocaleString("en-US")} returned to the source`,
                        ]
                      : []),
                    ...(totals.writtenOffUnits > 0
                      ? [
                          `${totals.writtenOffUnits.toLocaleString("en-US")} written off`,
                        ]
                      : []),
                    ...(inTransit
                      ? [
                          `${totals.outstandingUnits.toLocaleString("en-US")} still to account for`,
                        ]
                      : []),
                  ].join(" · ")}
          </s-text>
          {totals.lineCount > 0 && (
            <s-stack direction="inline" gap="small">
              {draft &&
                paperParts.map((part) => (
                  <s-button
                    key={`pick-list-${part}`}
                    href={`/app/transfers/${transfer.id}/pick-list${partQuery(part)}`}
                    target="_blank"
                    variant="secondary"
                  >
                    Print pick list{partLabel(part)} (PDF)
                  </s-button>
                ))}
              {paperParts.map((part) => (
                <s-button
                  key={`document-${part}`}
                  href={`/app/transfers/${transfer.id}/document${partQuery(part)}`}
                  target="_blank"
                  variant="secondary"
                >
                  Print transfer document{partLabel(part)} (PDF)
                </s-button>
              ))}
              <s-button
                href={`/app/transfers/${transfer.id}/export`}
                target="_blank"
                variant="secondary"
              >
                Download transfer report (CSV)
              </s-button>
            </s-stack>
          )}
        </s-stack>
      </s-section>

      {draft && (
        <s-section heading="Add items">
          <s-stack direction="block" gap="base">
            <Form method="post" onKeyDown={onEnter} key={scannedAt ?? 0}>
              <input type="hidden" name="intent" value="addItem" />
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
                  max={MAX_TRANSFER_LINE_QUANTITY}
                />
                <s-button
                  type="submit"
                  variant="primary"
                  {...disabledWhen(locked)}
                >
                  Add
                </s-button>
              </s-stack>
            </Form>
            <s-text color="subdued">
              Each scan adds its units to the item&apos;s line on the transfer.
            </s-text>

            <s-divider />

            <Form method="post">
              <input type="hidden" name="intent" value="addItems" />
              <s-stack direction="block" gap="small">
                <s-text-area
                  label="Add a list of items"
                  name="items"
                  rows={3}
                  maxLength={MAX_TRANSFER_ITEM_TEXT_LENGTH}
                  placeholder={"One barcode or SKU per line"}
                  details={`Up to ${MAX_ADDED_TRANSFER_ITEMS} items at a time. To give a quantity, put it after the code, separated by a comma or a tab: two spreadsheet columns can be pasted as they are.`}
                  value={pastedItems}
                />
                <s-stack direction="inline">
                  <s-button
                    type="submit"
                    variant="secondary"
                    {...disabledWhen(locked)}
                  >
                    Add to transfer
                  </s-button>
                </s-stack>
              </s-stack>
            </Form>
          </s-stack>
        </s-section>
      )}

      {receivable && (
        <s-section heading="Receive items">
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
                  max={MAX_TRANSFER_LINE_QUANTITY}
                />
                <s-button
                  type="submit"
                  variant="primary"
                  {...disabledWhen(locked)}
                >
                  Count in
                </s-button>
              </s-stack>
            </Form>
            <s-text color="subdued">
              Scanning counts units in at {destinationName}. Nothing changes in
              Shopify until the receipt is posted.
            </s-text>
            {totals.outstandingUnits > 0 && (
              <Form method="post">
                <input type="hidden" name="intent" value="countInAll" />
                <s-button
                  type="submit"
                  variant="secondary"
                  {...disabledWhen(locked)}
                >
                  Count in all {unitCount(totals.outstandingUnits)} still to
                  come
                </s-button>
              </Form>
            )}
          </s-stack>
        </s-section>
      )}

      <s-section heading="Items">
        <s-stack direction="block" gap="base">
          {inTransit && (
            <s-stack direction="inline" gap="base">
              {(Object.keys(FILTER_LABEL) as TransferLineFilter[]).map((key) =>
                key === filter ? (
                  <s-text key={key} type="strong">
                    {FILTER_LABEL[key]}
                  </s-text>
                ) : (
                  <s-link key={key} href={view({ filter: key })}>
                    {FILTER_LABEL[key]}
                  </s-link>
                ),
              )}
            </s-stack>
          )}

          {lines.lines.length === 0 ? (
            <s-paragraph>
              {totals.lineCount === 0
                ? draft
                  ? "No items are on this transfer yet. Scan an item or add a list of items to begin."
                  : "This transfer has no items."
                : "Every item on this transfer is accounted for."}
            </s-paragraph>
          ) : draft ? (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Item</s-table-header>
                <s-table-header>SKU</s-table-header>
                <s-table-header listSlot="secondary">Quantity</s-table-header>
                <s-table-header>Picked to ship</s-table-header>
                <s-table-header>Remove</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {lines.lines.map((line) => (
                  <s-table-row key={line.id}>
                    <s-table-cell>
                      <ItemCell line={line} />
                    </s-table-cell>
                    <s-table-cell>{line.sku ?? ""}</s-table-cell>
                    <s-table-cell>
                      <LineQuantityForm
                        key={`quantity:${line.quantity}`}
                        intent="setQuantity"
                        lineId={line.id}
                        name="quantity"
                        label={`Quantity of ${line.title}`}
                        value={line.quantity}
                        min={1}
                        max={MAX_TRANSFER_LINE_QUANTITY}
                        locked={locked}
                        onEnter={onEnter}
                      />
                    </s-table-cell>
                    <s-table-cell>
                      <LineQuantityForm
                        key={`picked:${line.quantity}:${line.pickedQty}`}
                        intent="pick"
                        lineId={line.id}
                        name="pickedQty"
                        label={`Picked quantity of ${line.title}`}
                        value={transferShipQuantity(line)}
                        max={line.quantity}
                        locked={locked}
                        onEnter={onEnter}
                      />
                    </s-table-cell>
                    <s-table-cell>
                      <Form method="post">
                        <input type="hidden" name="intent" value="remove" />
                        <input type="hidden" name="lineId" value={line.id} />
                        <s-button
                          type="submit"
                          variant="tertiary"
                          tone="critical"
                          accessibilityLabel={`Remove ${line.title}`}
                          {...disabledWhen(locked)}
                        >
                          Remove
                        </s-button>
                      </Form>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : inTransit ? (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Item</s-table-header>
                <s-table-header>SKU</s-table-header>
                <s-table-header format="numeric">Shipped</s-table-header>
                <s-table-header format="numeric">Received</s-table-header>
                <s-table-header>Counted in</s-table-header>
                <s-table-header>Rejected</s-table-header>
                <s-table-header format="numeric" listSlot="secondary">
                  Still to come
                </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {lines.lines.map((line) => (
                  <s-table-row key={line.id}>
                    <s-table-cell>
                      <ItemCell line={line} />
                    </s-table-cell>
                    <s-table-cell>{line.sku ?? ""}</s-table-cell>
                    <s-table-cell>{line.shipQty}</s-table-cell>
                    <s-table-cell>{line.receivedQty}</s-table-cell>
                    <s-table-cell>
                      {/* Units counted in stay editable, so they can always be set back to 0. */}
                      {receivable || line.pendingReceiveQty > 0 ? (
                        <LineQuantityForm
                          key={`countIn:${line.pendingReceiveQty}`}
                          intent="countIn"
                          lineId={line.id}
                          name="quantity"
                          label={`Units of ${line.title} counted in`}
                          value={line.pendingReceiveQty}
                          max={line.shipQty}
                          locked={locked}
                          onEnter={onEnter}
                        />
                      ) : (
                        line.pendingReceiveQty
                      )}
                    </s-table-cell>
                    <s-table-cell>
                      {receivable ? (
                        <Form
                          method="post"
                          onKeyDown={onEnter}
                          key={`reject:${line.rejectedQty}:${line.rejectNote ?? ""}`}
                        >
                          <input type="hidden" name="intent" value="reject" />
                          <input type="hidden" name="lineId" value={line.id} />
                          <s-stack direction="inline" gap="small-200">
                            <s-number-field
                              label={`Rejected units of ${line.title}`}
                              labelAccessibilityVisibility="exclusive"
                              name="rejectedQty"
                              value={String(line.rejectedQty)}
                              min={0}
                              max={line.shipQty}
                            />
                            <s-text-field
                              label={`Why units of ${line.title} were rejected`}
                              labelAccessibilityVisibility="exclusive"
                              name="note"
                              placeholder="Reason"
                              maxLength={MAX_REJECT_NOTE_LENGTH}
                              value={line.rejectNote ?? ""}
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
                      ) : (
                        <RejectedText line={line} />
                      )}
                    </s-table-cell>
                    <s-table-cell>{line.outstandingQty}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : transfer.status === "CANCELLED" ? (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Item</s-table-header>
                <s-table-header>SKU</s-table-header>
                <s-table-header format="numeric" listSlot="secondary">
                  Requested
                </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {lines.lines.map((line) => (
                  <s-table-row key={line.id}>
                    <s-table-cell>
                      <ItemCell line={line} />
                    </s-table-cell>
                    <s-table-cell>{line.sku ?? ""}</s-table-cell>
                    <s-table-cell>{line.quantity}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Item</s-table-header>
                <s-table-header>SKU</s-table-header>
                <s-table-header format="numeric">Shipped</s-table-header>
                <s-table-header format="numeric" listSlot="secondary">
                  Received
                </s-table-header>
                <s-table-header>Rejected</s-table-header>
                <s-table-header format="numeric">
                  Returned to source
                </s-table-header>
                <s-table-header format="numeric">Written off</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {lines.lines.map((line) => (
                  <s-table-row key={line.id}>
                    <s-table-cell>
                      <ItemCell line={line} />
                    </s-table-cell>
                    <s-table-cell>{line.sku ?? ""}</s-table-cell>
                    <s-table-cell>{line.shipQty}</s-table-cell>
                    <s-table-cell>{line.receivedQty}</s-table-cell>
                    <s-table-cell>
                      <RejectedText line={line} />
                    </s-table-cell>
                    <s-table-cell>{line.returnedQty}</s-table-cell>
                    <s-table-cell>{line.writtenOffQty}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}

          {draft && totals.lineCount > 0 && (
            <s-text color="subdued">
              An item ships its full quantity unless a smaller picked quantity
              is saved for it.
            </s-text>
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

      {draft && (
        <s-section heading="Ship or cancel">
          <s-stack direction="block" gap="base">
            <Form method="post">
              <input type="hidden" name="intent" value="ship" />
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-button
                  type="submit"
                  variant="primary"
                  {...disabledWhen(
                    locked || !writesEnabled || totals.lineCount === 0,
                  )}
                >
                  Ship transfer
                </s-button>
                <s-text color="subdued">
                  Takes {unitCount(totals.shipUnits)} out of stock at{" "}
                  {sourceName} in Shopify. They enter stock at {destinationName}{" "}
                  when they are received.
                </s-text>
              </s-stack>
            </Form>
            {sourceShort && (
              <Form method="post">
                <input type="hidden" name="intent" value="ship" />
                <input type="hidden" name="allowShortSource" value="1" />
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-button
                    type="submit"
                    variant="secondary"
                    tone="critical"
                    {...disabledWhen(locked || !writesEnabled)}
                  >
                    Ship anyway
                  </s-button>
                  <s-text>
                    Stock of the items listed above will go below zero at{" "}
                    {sourceName}.
                  </s-text>
                </s-stack>
              </Form>
            )}

            <s-divider />

            {confirming === "cancel" ? (
              <Form method="post" onSubmit={() => setConfirming(null)}>
                <input type="hidden" name="intent" value="cancel" />
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-text>
                    Cancel this transfer? Its items are kept for the record.
                    {attention === "SHIPMENT_UNFINISHED" &&
                      " Stock that already left the source is put back."}
                  </s-text>
                  <s-button
                    type="submit"
                    variant="primary"
                    tone="critical"
                    {...disabledWhen(locked)}
                  >
                    Cancel transfer
                  </s-button>
                  <s-button
                    variant="tertiary"
                    onClick={() => setConfirming(null)}
                  >
                    Keep the draft
                  </s-button>
                </s-stack>
              </Form>
            ) : (
              <s-stack direction="inline">
                <s-button
                  variant="tertiary"
                  tone="critical"
                  onClick={() => setConfirming("cancel")}
                >
                  Cancel this transfer
                </s-button>
              </s-stack>
            )}
          </s-stack>
        </s-section>
      )}

      {attention === "PUT_BACK_UNFINISHED" && (
        <s-section heading="Put stock back">
          <Form method="post">
            <input type="hidden" name="intent" value="cancel" />
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-button
                type="submit"
                variant="primary"
                {...disabledWhen(locked || !writesEnabled)}
              >
                Finish putting stock back
              </s-button>
              <s-text color="subdued">
                Adds back at {sourceName} what this transfer took out before it
                was cancelled.
              </s-text>
            </s-stack>
          </Form>
        </s-section>
      )}

      {receivable && (
        <s-section heading="Post the receipt">
          <s-stack direction="block" gap="small">
            {totals.countedInUnits > 0 || attention === "RECEIPT_UNFINISHED" ? (
              <Form method="post">
                <input type="hidden" name="intent" value="postReceipt" />
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-button
                    type="submit"
                    variant="primary"
                    {...disabledWhen(locked || !writesEnabled)}
                  >
                    Post receipt
                  </s-button>
                  <s-text color="subdued">
                    {totals.countedInUnits > 0
                      ? `Adds the ${unitCount(totals.countedInUnits)} counted in to stock at ${destinationName} in Shopify.`
                      : `Brings stock at ${destinationName} in Shopify in line with the units received.`}
                  </s-text>
                </s-stack>
              </Form>
            ) : totals.outstandingUnits > 0 ? (
              <Form method="post">
                <input type="hidden" name="intent" value="receiveAll" />
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-button
                    type="submit"
                    variant="primary"
                    {...disabledWhen(locked || !writesEnabled)}
                  >
                    Receive all {unitCount(totals.outstandingUnits)}
                  </s-button>
                  <s-text color="subdued">
                    Everything still to come arrived: adds it to stock at{" "}
                    {destinationName} in Shopify and finishes the transfer.
                  </s-text>
                </s-stack>
              </Form>
            ) : (
              <s-text>
                No units are counted in and none are still to come.
              </s-text>
            )}
          </s-stack>
        </s-section>
      )}

      {closable && (
        <s-section heading="Close the transfer">
          {totals.countedInUnits > 0 ? (
            <s-text>
              {unitCount(totals.countedInUnits)}{" "}
              {totals.countedInUnits === 1 ? "is" : "are"} counted in and not
              posted. Post the receipt, or set those units back to 0, before
              closing the transfer.
            </s-text>
          ) : totals.outstandingUnits === 0 ? (
            <Form method="post">
              <input type="hidden" name="intent" value="close" />
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-button
                  type="submit"
                  variant="primary"
                  {...disabledWhen(locked)}
                >
                  Finish transfer
                </s-button>
                <s-text color="subdued">
                  Every shipped unit is received or rejected.
                </s-text>
              </s-stack>
            </Form>
          ) : confirming === "RETURNED" || confirming === "WRITTEN_OFF" ? (
            <Form method="post" onSubmit={() => setConfirming(null)}>
              <input type="hidden" name="intent" value="close" />
              <input type="hidden" name="resolution" value={confirming} />
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-text>
                  {confirming === "RETURNED"
                    ? `Close this transfer and add ${unitCount(totals.outstandingUnits)} back to stock at ${sourceName} in Shopify?`
                    : `Close this transfer and write off ${unitCount(totals.outstandingUnits)}? They stay out of stock at both locations.`}{" "}
                  Nothing more can be received afterwards.
                </s-text>
                <s-button
                  type="submit"
                  variant="primary"
                  tone="critical"
                  {...disabledWhen(
                    locked || (confirming === "RETURNED" && !writesEnabled),
                  )}
                >
                  Close transfer
                </s-button>
                <s-button
                  variant="tertiary"
                  onClick={() => setConfirming(null)}
                >
                  Keep it in transit
                </s-button>
              </s-stack>
            </Form>
          ) : (
            <s-stack direction="block" gap="small">
              <s-text>
                {unitCount(totals.outstandingUnits)} shipped on this transfer{" "}
                {totals.outstandingUnits === 1 ? "has" : "have"} not arrived. If{" "}
                {totals.outstandingUnits === 1 ? "it is" : "they are"} not
                coming, close the transfer and choose what happens to{" "}
                {totals.outstandingUnits === 1 ? "it" : "them"}:
              </s-text>
              <s-stack direction="inline" gap="small">
                <s-button
                  variant="secondary"
                  onClick={() => setConfirming("RETURNED")}
                >
                  Put back into stock at {sourceName}
                </s-button>
                <s-button
                  variant="secondary"
                  onClick={() => setConfirming("WRITTEN_OFF")}
                >
                  Write off
                </s-button>
              </s-stack>
            </s-stack>
          )}
        </s-section>
      )}

      {history.length > 0 && (
        <s-section heading="Stock changes in Shopify">
          <s-table>
            <s-table-header-row>
              <s-table-header>When</s-table-header>
              <s-table-header listSlot="primary">Change</s-table-header>
              <s-table-header>Staff</s-table-header>
              <s-table-header listSlot="secondary">Result</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {history.map((event) => (
                <s-table-row key={event.operationId}>
                  <s-table-cell>{formatUtc(event.at)}</s-table-cell>
                  <s-table-cell>
                    {transferEventLabel(event.leg, event.netUnits)}
                  </s-table-cell>
                  <s-table-cell>
                    {event.staffName ?? staffText(event.staffUserId)}
                  </s-table-cell>
                  <s-table-cell>{eventOutcome(event)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}

function RejectedText({ line }: { line: TransferLineView }) {
  return line.rejectedQty > 0 && line.rejectNote ? (
    <s-stack direction="block" gap="small-200">
      <s-text>{line.rejectedQty}</s-text>
      <s-text color="subdued">{line.rejectNote}</s-text>
    </s-stack>
  ) : (
    <>{line.rejectedQty}</>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
