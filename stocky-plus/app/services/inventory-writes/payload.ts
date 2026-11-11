import { createHash } from "node:crypto";
import { InventoryOperationValidationError } from "./errors";
import {
  ADJUSTABLE_QUANTITY_NAMES,
  CAPABILITY_BY_KIND,
  SHOPIFY_INVENTORY_REASONS,
  type InventoryActor,
  type InventoryOperationDraft,
  type NormalizedInventoryOperationDraft,
} from "./types";

/** Lines per operation; matches InventoryOperation_line_count_check. */
export const MAX_OPERATION_LINES = 5000;
/** Shopify rejects quantities beyond ±1,000,000,000. */
export const MAX_ABS_QUANTITY = 1_000_000_000;

const INVENTORY_ITEM_GID = /^gid:\/\/shopify\/InventoryItem\/\d{1,20}$/;
const LOCATION_GID = /^gid:\/\/shopify\/Location\/\d{1,20}$/;
const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d{1,20}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:._\-/]{0,199}$/;
const SOURCE_TYPE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const SHOPIFY_USER_ID = /^\d{1,20}$/;

const REASONS = new Set<string>(SHOPIFY_INVENTORY_REASONS);
const QUANTITY_NAMES = new Set<string>(ADJUSTABLE_QUANTITY_NAMES);

function isQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Math.abs(value) <= MAX_ABS_QUANTITY
  );
}

function normalizeOptionalText(
  value: string | null | undefined,
  max: number,
  field: string,
  issues: string[],
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > max) {
    issues.push(`${field} must be at most ${max} characters`);
  }
  return trimmed;
}

function normalizeActor(
  actor: InventoryActor,
  issues: string[],
): InventoryActor {
  if (!actor || !["ADMIN", "POS", "SYSTEM"].includes(actor.channel)) {
    issues.push("actor.channel must be ADMIN, POS or SYSTEM");
    return { shopifyUserId: null, displayName: null, channel: "SYSTEM" };
  }
  if (
    actor.shopifyUserId !== null &&
    !SHOPIFY_USER_ID.test(actor.shopifyUserId)
  ) {
    issues.push("actor.shopifyUserId must be a numeric Shopify user ID");
  }
  if (actor.channel !== "SYSTEM" && actor.shopifyUserId === null) {
    issues.push("Staff writes require a verified Shopify user");
  }
  return {
    shopifyUserId: actor.shopifyUserId,
    displayName: normalizeOptionalText(
      actor.displayName,
      255,
      "actor.displayName",
      issues,
    ),
    channel: actor.channel,
  };
}

/**
 * Validate and normalize a caller draft. Throws with every issue found so a
 * form can show them together. Rejects duplicate item/location pairs because
 * one Shopify request cannot carry two changes for the same level.
 */
export function normalizeInventoryOperationDraft(
  draft: InventoryOperationDraft,
  reversesOperationId: string | null = null,
): NormalizedInventoryOperationDraft {
  const issues: string[] = [];

  const isReversal = reversesOperationId !== null;
  if (!isReversal && !(draft.kind in CAPABILITY_BY_KIND)) {
    issues.push(`Unsupported operation kind: ${String(draft.kind)}`);
  }
  if (!IDEMPOTENCY_KEY.test(draft.idempotencyKey ?? "")) {
    issues.push(
      "idempotencyKey must be 1-200 characters of letters, digits and : . _ - /",
    );
  }
  if (!SOURCE_TYPE.test(draft.source?.type ?? "")) {
    issues.push("source.type must be an identifier of at most 64 characters");
  }
  const sourceId = draft.source?.id ?? "";
  if (sourceId.length < 1 || sourceId.length > 191) {
    issues.push("source.id must be 1-191 characters");
  }
  if (!REASONS.has(draft.reason)) {
    issues.push(
      `Unsupported Shopify inventory reason: ${String(draft.reason)}`,
    );
  }
  if (!QUANTITY_NAMES.has(draft.quantityName)) {
    issues.push(`Unsupported quantity name: ${String(draft.quantityName)}`);
  }
  const referenceDocumentUri = normalizeOptionalText(
    draft.referenceDocumentUri,
    512,
    "referenceDocumentUri",
    issues,
  );
  if (
    referenceDocumentUri !== null &&
    !/^[a-z][a-z0-9+.-]*:\S+$/i.test(referenceDocumentUri)
  ) {
    issues.push("referenceDocumentUri must be a URI");
  }
  const note = normalizeOptionalText(draft.note, 2000, "note", issues);
  const actor = normalizeActor(draft.actor, issues);

  const lines = Array.isArray(draft.lines) ? draft.lines : [];
  if (lines.length === 0) {
    issues.push("At least one line is required");
  } else if (lines.length > MAX_OPERATION_LINES) {
    issues.push(
      `At most ${MAX_OPERATION_LINES} lines are allowed per operation`,
    );
  }

  const seenLevels = new Set<string>();
  lines.forEach((line, index) => {
    const label = `Line ${index + 1}`;
    if (!INVENTORY_ITEM_GID.test(line.inventoryItemId ?? "")) {
      issues.push(
        `${label}: inventoryItemId must be a Shopify InventoryItem GID`,
      );
    }
    if (!LOCATION_GID.test(line.locationId ?? "")) {
      issues.push(`${label}: locationId must be a Shopify Location GID`);
    }
    if (line.variantId !== null && !VARIANT_GID.test(line.variantId ?? "")) {
      issues.push(
        `${label}: variantId must be a Shopify ProductVariant GID or null`,
      );
    }
    if (!isQuantity(line.delta) || line.delta === 0) {
      issues.push(`${label}: delta must be a non-zero whole number`);
    }
    if (
      line.changeFromQuantity !== null &&
      !isQuantity(line.changeFromQuantity)
    ) {
      issues.push(
        `${label}: changeFromQuantity must be a whole number or null`,
      );
    }
    const level = `${line.inventoryItemId}|${line.locationId}`;
    if (seenLevels.has(level)) {
      issues.push(
        `${label}: duplicates another line for the same item and location`,
      );
    }
    seenLevels.add(level);
  });

  if (issues.length > 0) {
    throw new InventoryOperationValidationError(issues[0], issues);
  }

  return {
    kind: isReversal ? "REVERSAL" : draft.kind,
    capability: CAPABILITY_BY_KIND[draft.kind],
    idempotencyKey: draft.idempotencyKey,
    source: { type: draft.source.type, id: sourceId },
    reason: draft.reason,
    quantityName: draft.quantityName,
    referenceDocumentUri,
    actor,
    note,
    reversesOperationId,
    lines: lines.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      variantId: line.variantId,
      locationId: line.locationId,
      delta: line.delta,
      changeFromQuantity: line.changeFromQuantity,
    })),
  };
}

/**
 * Digest of everything that determines the Shopify effect. Actor and note are
 * metadata: a resubmission by another staff member is still the same change.
 */
export function inventoryOperationPayloadDigest(
  draft: NormalizedInventoryOperationDraft,
): string {
  const canonical = JSON.stringify([
    "inventory-operation-v1",
    draft.kind,
    draft.capability,
    draft.source.type,
    draft.source.id,
    draft.reason,
    draft.quantityName,
    draft.referenceDocumentUri,
    draft.reversesOperationId,
    draft.lines.map((line) => [
      line.inventoryItemId,
      line.variantId,
      line.locationId,
      line.delta,
      line.changeFromQuantity,
    ]),
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
