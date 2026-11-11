/**
 * Purchase-order commands.
 *
 * Every command runs in one tenant transaction that claims the order at the
 * version the caller saw, applies the lifecycle rules from
 * app/lib/purchasing/status.ts, re-derives the charge allocation and appends a
 * history event. Arithmetic is documented in docs/purchasing/PURCHASING_LEDGER.md.
 */
import { Prisma } from "@prisma/client";
import type { Supplier, SupplierSkuMapping, VolumePriceTier } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { roundTo, UNIT_COST_SCALE, ZERO } from "../../lib/purchasing/decimal";
import {
  parseCalendarDate,
  type FormReader,
} from "../../lib/purchasing/form-input";
import {
  assertCanPerform,
  canEditCommercialTerms,
  canEditHeader,
  canEditLines,
  nextStatusFor,
  PurchaseOrderStateError,
  type PurchaseOrderAction,
} from "../../lib/purchasing/status";
import {
  ALLOCATION_METHODS,
  CHARGE_KINDS,
  type AllocationMethod,
  type ChargeKind,
} from "../../lib/purchasing/totals";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import type { PurchasingActor } from "./actor.server";
import {
  invalidInput,
  isUniqueViolation,
  notFound,
  PurchasingError,
} from "./errors";
import { recordPurchasingEvent } from "./events.server";
import {
  listLocations,
  pickActiveLocation,
  requireActiveLocation,
} from "./locations.server";
import {
  assertNoReceiptInFlight,
  claimPurchaseOrder,
  effectiveCharges,
  lifecycleStateOf,
  loadPurchaseOrder,
  persistAllocation,
  remainingQuantity,
  type PurchaseOrderLineRecord,
  type PurchaseOrderRecord,
} from "./purchase-order-records.server";
import {
  assertVariantGids,
  resolveVariants,
  type VariantSnapshot,
} from "./variants.server";

export const PURCHASE_ORDER_SOURCES = ["manual", "replenishment", "duplicate"] as const;
export type PurchaseOrderSource = (typeof PURCHASE_ORDER_SOURCES)[number];

export const MAX_ORDER_QUANTITY = 1_000_000;
export const MAX_LINE_UNIT_COST = new Prisma.Decimal("999999.9999");
export const MAX_CHARGE_AMOUNT = new Prisma.Decimal("9999999999.99");
export const MAX_EXCHANGE_RATE = new Prisma.Decimal("9999.999999");
export const MAX_LINES_PER_ORDER = 1000;
export const MAX_CHARGES_PER_ORDER = 20;

const FIRST_PO_SEQUENCE = 1001;
const NUMBERING_ATTEMPTS = 10;
const CREATION_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** Header fields printed on supplier documents; changing one bumps the version. */
const DOCUMENT_HEADER_FIELDS = new Set<string>([
  "locationId",
  "currency",
  "issuedOn",
  "expectedOn",
  "shipOn",
  "cancelOn",
  "paymentTerms",
  "shippingTerms",
  "shipToAddress",
  "billToAddress",
  "buyerName",
  "supplierNotes",
]);

const COMMERCIAL_HEADER_FIELDS = new Set<string>(["locationId", "currency", "exchangeRate"]);

export type DraftLineInput = {
  variantGid: string;
  quantity: number;
  /** Omit or pass null to price the line from supplier terms. */
  unitCost?: Prisma.Decimal | null;
};

export type CreateDraftInput = {
  supplierId: string;
  locationGid: string;
  lines?: DraftLineInput[];
  /** Same key, same shop: the existing purchase order is returned instead of a second one. */
  creationKey?: string | null;
  source?: PurchaseOrderSource;
  currency?: string | null;
  exchangeRate?: Prisma.Decimal | null;
  expectedOn?: Date | null;
  notes?: string | null;
};

export type CreateDraftResult = {
  id: string;
  poNumber: string;
  created: boolean;
  lineCount: number;
  /** Lines that have no cost on file and were added at zero. */
  missingCostVariantGids: string[];
};

export type HeaderInput = {
  /** Commercial terms; leave undefined to keep the current value. */
  locationGid?: string;
  currency?: string;
  exchangeRate?: Prisma.Decimal | null;
  supplierOrderNumber: string | null;
  invoiceNumber: string | null;
  issuedOn: Date | null;
  expectedOn: Date | null;
  shipOn: Date | null;
  cancelOn: Date | null;
  invoiceOn: Date | null;
  paymentDueOn: Date | null;
  paymentTerms: string | null;
  shippingTerms: string | null;
  shipToAddress: string | null;
  billToAddress: string | null;
  buyerName: string | null;
  notes: string | null;
  supplierNotes: string | null;
};

export type LineUpdateInput = {
  quantity: number;
  /** Null prices the line from supplier terms again. */
  unitCost: Prisma.Decimal | null;
  discountPercent: Prisma.Decimal | null;
  taxRatePercent: Prisma.Decimal | null;
  note: string | null;
};

export type ChargeInput = {
  kind: ChargeKind;
  description: string | null;
  amount: Prisma.Decimal;
  allocate: boolean;
};

// ─── Form parsing ───────────────────────────────────────────────────────────

export function parsePurchaseOrderHeaderForm(form: FormReader): HeaderInput | null {
  const input: HeaderInput = {
    supplierOrderNumber: form.text("supplierOrderNumber", { maxLength: 128, label: "Supplier order number" }),
    invoiceNumber: form.text("invoiceNumber", { maxLength: 128, label: "Invoice number" }),
    issuedOn: form.date("issuedOn", { label: "Order date" }),
    expectedOn: form.date("expectedOn", { label: "Expected date" }),
    shipOn: form.date("shipOn", { label: "Ship date" }),
    cancelOn: form.date("cancelOn", { label: "Cancel date" }),
    invoiceOn: form.date("invoiceOn", { label: "Invoice date" }),
    paymentDueOn: form.date("paymentDueOn", { label: "Payment due date" }),
    paymentTerms: form.text("paymentTerms", { maxLength: 255, label: "Payment terms" }),
    shippingTerms: form.text("shippingTerms", { maxLength: 255, label: "Shipping terms" }),
    shipToAddress: form.text("shipToAddress", { maxLength: 2000, label: "Ship-to address" }),
    billToAddress: form.text("billToAddress", { maxLength: 2000, label: "Bill-to address" }),
    buyerName: form.text("buyerName", { maxLength: 255, label: "Buyer" }),
    notes: form.text("notes", { maxLength: 4000, label: "Internal notes" }),
    supplierNotes: form.text("supplierNotes", { maxLength: 4000, label: "Notes to supplier" }),
  };
  if (form.has("locationGid")) {
    const locationGid = form.text("locationGid", { required: true, maxLength: 256, label: "Destination" });
    if (locationGid !== null) input.locationGid = locationGid;
  }
  if (form.has("currency")) {
    const currency = form.currency("currency", { required: true });
    if (currency !== null) input.currency = currency;
  }
  if (form.has("exchangeRate")) {
    input.exchangeRate = form.decimal("exchangeRate", {
      scale: 6,
      min: 0,
      minExclusive: true,
      max: MAX_EXCHANGE_RATE,
      label: "Exchange rate",
    });
  }
  return form.ok ? input : null;
}

export function parseLineUpdateForm(form: FormReader): LineUpdateInput | null {
  const quantity = form.integer("quantity", {
    required: true,
    min: 1,
    max: MAX_ORDER_QUANTITY,
    label: "Quantity",
  });
  const input = {
    unitCost: form.decimal("unitCost", {
      scale: UNIT_COST_SCALE,
      min: 0,
      max: MAX_LINE_UNIT_COST,
      label: "Unit cost",
    }),
    discountPercent: form.percent("discountPercent", { label: "Discount" }),
    taxRatePercent: form.percent("taxRatePercent", { label: "Tax rate" }),
    note: form.text("note", { maxLength: 1000, label: "Line note" }),
  };
  if (!form.ok || quantity === null) return null;
  return { quantity, ...input };
}

/**
 * Charges are posted as parallel fields `charge-kind-N`, `charge-amount-N`,
 * `charge-description-N` and `charge-allocate-N` for N in 0..count-1.
 */
export function parseChargesForm(
  form: FormReader,
): { charges: ChargeInput[]; landedCostMethod: AllocationMethod } | null {
  const count = form.integer("chargeCount", {
    required: true,
    min: 0,
    max: MAX_CHARGES_PER_ORDER,
    label: "Number of charges",
  });
  const landedCostMethod = form.choice("landedCostMethod", ALLOCATION_METHODS, {
    required: true,
    label: "Allocation method",
  });
  const charges: ChargeInput[] = [];
  for (let index = 0; index < (count ?? 0); index++) {
    const kind = form.choice(`charge-kind-${index}`, CHARGE_KINDS, {
      required: true,
      label: "Charge type",
    });
    const amount = form.decimal(`charge-amount-${index}`, {
      required: true,
      scale: 2,
      min: 0,
      max: MAX_CHARGE_AMOUNT,
      label: "Amount",
    });
    const description = form.text(`charge-description-${index}`, {
      maxLength: 255,
      label: "Description",
    });
    if (kind !== null && amount !== null) {
      charges.push({
        kind,
        amount,
        description,
        allocate: form.checkbox(`charge-allocate-${index}`),
      });
    }
  }
  if (!form.ok || landedCostMethod === null) return null;
  return { charges, landedCostMethod };
}

/** `YYYY-MM-DD` plus a number of days, as a calendar date at UTC midnight. */
function addCalendarDays(day: string, days: number): Date | null {
  const start = parseCalendarDate(day);
  if (!start) return null;
  return new Date(start.getTime() + days * 86_400_000);
}

// ─── Input checks shared by forms and direct callers ────────────────────────

function assertQuantity(value: number, label = "Quantity"): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_ORDER_QUANTITY) {
    throw invalidInput(`${label} must be a whole number between 1 and ${MAX_ORDER_QUANTITY}.`);
  }
}

function assertDecimal(
  value: Prisma.Decimal,
  options: { max: Prisma.Decimal; scale: number; label: string; positive?: boolean },
): void {
  const valid =
    Prisma.Decimal.isDecimal(value) &&
    value.isFinite() &&
    (options.positive ? value.gt(0) : !value.isNegative()) &&
    value.lte(options.max) &&
    value.decimalPlaces() <= options.scale;
  if (!valid) {
    throw invalidInput(
      `${options.label} must be ${options.positive ? "greater than 0" : "0 or more"}, at most ${options.max.toFixed()}, with up to ${options.scale} decimal places.`,
    );
  }
}

function assertUnitCost(value: Prisma.Decimal): void {
  assertDecimal(value, { max: MAX_LINE_UNIT_COST, scale: UNIT_COST_SCALE, label: "Unit cost" });
}

function assertPercent(value: Prisma.Decimal | null, label: string): void {
  if (value === null) return;
  assertDecimal(value, { max: new Prisma.Decimal(100), scale: 4, label });
}

function assertCurrency(value: string): void {
  if (!CURRENCY_PATTERN.test(value)) {
    throw invalidInput("Currency must be a 3-letter code such as USD.");
  }
}

function assertExchangeRate(value: Prisma.Decimal | null): void {
  if (value === null) return;
  assertDecimal(value, { max: MAX_EXCHANGE_RATE, scale: 6, label: "Exchange rate", positive: true });
}

function assertEditable(allowed: boolean, message: string): void {
  if (!allowed) throw new PurchasingError("invalid_state", message);
}

function mergeDraftLines(lines: readonly DraftLineInput[]): DraftLineInput[] {
  const merged = new Map<string, DraftLineInput>();
  for (const line of lines) {
    assertQuantity(line.quantity);
    const unitCost = line.unitCost ?? null;
    if (unitCost !== null) assertUnitCost(unitCost);
    const existing = merged.get(line.variantGid);
    if (!existing) {
      merged.set(line.variantGid, { variantGid: line.variantGid, quantity: line.quantity, unitCost });
      continue;
    }
    const existingCost = existing.unitCost ?? null;
    if (existingCost !== null && unitCost !== null && !existingCost.equals(unitCost)) {
      throw invalidInput("The same product is listed twice with different costs.");
    }
    existing.quantity += line.quantity;
    existing.unitCost = existingCost ?? unitCost;
    assertQuantity(existing.quantity);
  }
  const result = [...merged.values()];
  assertVariantGids(result.map((line) => line.variantGid));
  if (result.length > MAX_LINES_PER_ORDER) {
    throw invalidInput(`A purchase order can have at most ${MAX_LINES_PER_ORDER} lines.`);
  }
  return result;
}

// ─── Cost resolution ────────────────────────────────────────────────────────

type SupplierTermsIndex = {
  mappings: Map<string, SupplierSkuMapping>;
  tiers: Map<string, VolumePriceTier[]>;
};

async function loadSupplierTerms(
  db: TenantDb,
  supplierId: string,
  variantGids: readonly string[],
): Promise<SupplierTermsIndex> {
  if (variantGids.length === 0) return { mappings: new Map(), tiers: new Map() };
  const [mappings, tiers]: [SupplierSkuMapping[], VolumePriceTier[]] = await Promise.all([
    db.supplierSkuMapping.findMany({
      where: { supplierId, shopifyVariantId: { in: [...variantGids] } },
    }),
    db.volumePriceTier.findMany({
      where: { supplierId, variantId: { in: [...variantGids] } },
      orderBy: [{ minQty: "desc" }, { id: "asc" }],
    }),
  ]);
  const tiersByVariant = new Map<string, VolumePriceTier[]>();
  for (const tier of tiers) {
    const list = tiersByVariant.get(tier.variantId) ?? [];
    list.push(tier);
    tiersByVariant.set(tier.variantId, list);
  }
  return {
    mappings: new Map(mappings.map((m) => [m.shopifyVariantId, m])),
    tiers: tiersByVariant,
  };
}

/**
 * Unit cost in the purchase order's currency when none is entered: the volume
 * tier covering the quantity, else the supplier's cost for the product, else
 * the cost recorded in Shopify. Null means no cost is on file.
 *
 * Supplier prices are in the supplier's currency, so they only apply while the
 * purchase order is in that currency.
 */
function resolveUnitCost(
  context: { currency: string; exchangeRate: Prisma.Decimal | null; supplierCurrency: string },
  terms: SupplierTermsIndex,
  variant: VariantSnapshot | undefined,
  variantGid: string,
  quantity: number,
): Prisma.Decimal | null {
  if (context.currency === context.supplierCurrency.toUpperCase()) {
    const tier = (terms.tiers.get(variantGid) ?? []).find(
      (t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty),
    );
    if (tier) return tier.unitCost;
    const supplierCost = terms.mappings.get(variantGid)?.supplierCost ?? null;
    if (supplierCost !== null) return supplierCost;
  }
  const shopifyCost = variant?.shopifyUnitCost ?? null;
  if (shopifyCost === null || !variant?.shopifyUnitCostCurrency) return null;
  if (variant.shopifyUnitCostCurrency === context.currency) {
    return roundTo(shopifyCost, UNIT_COST_SCALE);
  }
  // exchangeRate is shop-currency units per one unit of the PO currency.
  if (context.exchangeRate !== null) {
    return roundTo(shopifyCost.dividedBy(context.exchangeRate), UNIT_COST_SCALE);
  }
  return null;
}

function isMissingCost(line: Pick<PurchaseOrderLineRecord, "unitCost" | "manualCostOverride">): boolean {
  return !line.manualCostOverride && line.unitCost.isZero();
}

// ─── Create ─────────────────────────────────────────────────────────────────

async function nextSequence(tx: TenantDb): Promise<number> {
  const result: { _max: { poSequence: number | null } } = await tx.purchaseOrder.aggregate({
    _max: { poSequence: true },
  });
  return Math.max(FIRST_PO_SEQUENCE - 1, result._max.poSequence ?? 0) + 1;
}

async function findByCreationKey(
  db: TenantDb,
  creationKey: string,
): Promise<CreateDraftResult | null> {
  const po: PurchaseOrderRecord | null = await db.purchaseOrder.findFirst({
    where: { creationKey },
    include: { supplier: true, lineItems: true, charges: true },
  });
  if (!po) return null;
  return {
    id: po.id,
    poNumber: po.poNumber ?? po.id,
    created: false,
    lineCount: po.lineItems.length,
    missingCostVariantGids: po.lineItems.filter(isMissingCost).map((l) => l.shopifyVariantId),
  };
}

function newLineData(
  line: DraftLineInput,
  position: number,
  variant: VariantSnapshot,
  mapping: SupplierSkuMapping | undefined,
  resolvedCost: Prisma.Decimal | null,
  supplier: Supplier,
) {
  const explicit = line.unitCost ?? null;
  return {
    shopifyVariantId: line.variantGid,
    position,
    orderedQty: line.quantity,
    unitCost: explicit ?? resolvedCost ?? ZERO,
    manualCostOverride: explicit !== null,
    taxRatePercent: supplier.defaultTaxRatePercent,
    vendorSku: mapping?.vendorSku ?? null,
    packSize: mapping?.packSize ?? null,
    orderUnit: mapping?.orderUnit ?? null,
    productTitle: variant.productTitle,
    variantTitle: variant.variantTitle,
    sku: variant.sku,
    barcode: variant.barcode,
    inventoryItemGid: variant.inventoryItemGid,
    weight: variant.weightGrams,
    retailPrice: variant.retailPrice === null ? null : roundTo(variant.retailPrice, 2),
  };
}

async function requireOrderableSupplier(db: TenantDb, supplierId: string): Promise<Supplier> {
  const supplier: Supplier | null = await db.supplier.findFirst({ where: { id: supplierId } });
  if (!supplier) throw notFound("Supplier");
  if (supplier.status !== "ACTIVE") {
    throw new PurchasingError(
      "invalid_state",
      "This supplier is archived. Restore it before creating purchase orders.",
    );
  }
  return supplier;
}

async function requireLiveVariants(
  db: TenantDb,
  variantGids: string[],
  admin: AdminGraphQLClient | undefined,
): Promise<Map<string, VariantSnapshot>> {
  const variants = await resolveVariants(db, variantGids, { admin });
  const unavailable = variantGids.filter((gid) => !variants.has(gid)).length;
  if (unavailable > 0) {
    throw invalidInput(
      unavailable === 1
        ? "One of the selected products is no longer available in Shopify. Remove it and try again."
        : `${unavailable} of the selected products are no longer available in Shopify. Remove them and try again.`,
    );
  }
  return variants;
}

/**
 * Create a draft purchase order. This is the only creation path, so supplier
 * terms, cost resolution and charge allocation behave the same for an order
 * typed in by hand and one built from replenishment suggestions.
 */
export async function createPurchaseOrderDraft(
  db: TenantDb,
  actor: PurchasingActor,
  input: CreateDraftInput,
  options: { admin?: AdminGraphQLClient; today?: string | null } = {},
): Promise<CreateDraftResult> {
  const creationKey = input.creationKey ?? null;
  if (creationKey !== null && !CREATION_KEY_PATTERN.test(creationKey)) {
    throw invalidInput("The creation key may hold up to 128 letters, digits, dots, colons, dashes or underscores.");
  }
  const lines = mergeDraftLines(input.lines ?? []);
  if (creationKey !== null) {
    const existing = await findByCreationKey(db, creationKey);
    if (existing) return existing;
  }

  const supplier = await requireOrderableSupplier(db, input.supplierId);
  const currency = (input.currency ?? supplier.currency).toUpperCase();
  assertCurrency(currency);
  const exchangeRate = input.exchangeRate ?? null;
  assertExchangeRate(exchangeRate);
  const location = await requireActiveLocation(db, input.locationGid, options.admin);
  const variantGids = lines.map((line) => line.variantGid);
  const variants = await requireLiveVariants(db, variantGids, options.admin);

  const expectedOn =
    input.expectedOn !== undefined
      ? input.expectedOn
      : supplier.defaultLeadTimeDays !== null && options.today
        ? addCalendarDays(options.today, supplier.defaultLeadTimeDays)
        : null;

  for (let attempt = 1; attempt <= NUMBERING_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const terms = await loadSupplierTerms(tx, supplier.id, variantGids);
        const sequence = await nextSequence(tx);
        const poNumber = `PO-${sequence}`;
        const lineData = lines.map((line, index) =>
          newLineData(
            line,
            index,
            variants.get(line.variantGid)!,
            terms.mappings.get(line.variantGid),
            resolveUnitCost(
              { currency, exchangeRate, supplierCurrency: supplier.currency },
              terms,
              variants.get(line.variantGid),
              line.variantGid,
              line.quantity,
            ),
            supplier,
          ),
        );
        const po: { id: string } = await tx.purchaseOrder.create({
          data: {
            supplierId: supplier.id,
            locationId: location.gid,
            poSequence: sequence,
            poNumber,
            creationKey,
            status: "DRAFT",
            draftedAt: new Date(),
            currency,
            exchangeRate,
            expectedOn,
            paymentTerms: supplier.paymentTerms,
            shippingTerms: supplier.shippingTerms,
            shipToAddress: location.address
              ? `${location.name}\n${location.address}`
              : location.name,
            notes: input.notes ?? null,
            createdByUserId: actor.type === "STAFF" ? actor.id : null,
            lineItems: { create: lineData },
          },
        });
        await persistAllocation(tx, po.id);
        await recordPurchasingEvent(tx, {
          subjectType: "PURCHASE_ORDER",
          subjectId: po.id,
          action: "purchase_order.created",
          actor,
          details: {
            poNumber,
            source: input.source ?? "manual",
            lineCount: lineData.length,
          },
        });
        return {
          id: po.id,
          poNumber,
          created: true,
          lineCount: lineData.length,
          missingCostVariantGids: lineData
            .filter((line) => !line.manualCostOverride && line.unitCost.isZero())
            .map((line) => line.shopifyVariantId),
        };
      });
    } catch (error) {
      // Postgres does not tell Prisma which unique index was hit, so a
      // violation is either a repeated creation key or a number taken by a
      // purchase order created at the same moment.
      if (!isUniqueViolation(error)) throw error;
      if (creationKey !== null) {
        const existing = await findByCreationKey(db, creationKey);
        if (existing) return existing;
      }
    }
  }
  throw new PurchasingError(
    "conflict",
    "Several purchase orders were being created at once. Try again.",
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function sameValue(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null);
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Prisma.Decimal.isDecimal(a) && Prisma.Decimal.isDecimal(b)) return a.equals(b);
  return a === b;
}

export async function updatePurchaseOrderHeader(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
  expectedVersion: number,
  input: HeaderInput,
  options: { admin?: AdminGraphQLClient } = {},
): Promise<void> {
  if (input.currency !== undefined) assertCurrency(input.currency);
  if (input.exchangeRate !== undefined) assertExchangeRate(input.exchangeRate);

  const { locationGid, ...rest } = input;
  const proposed: Record<string, unknown> = { ...rest };
  if (locationGid !== undefined) proposed.locationId = locationGid;
  // Read before the transaction: a shop still on its first sync is answered by Shopify.
  const locations =
    locationGid !== undefined ? await listLocations(db, options.admin) : [];

  await db.$transaction(async (tx) => {
    const po = await claimPurchaseOrder(tx, purchaseOrderId, expectedVersion);
    const state = lifecycleStateOf(po);
    const current = po as unknown as Record<string, unknown>;
    const changes: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(proposed)) {
      if (value !== undefined && !sameValue(current[field], value)) changes[field] = value;
    }
    const fields = Object.keys(changes);
    if (fields.length === 0) return;

    assertEditable(
      canEditHeader(state),
      "This purchase order can no longer be edited.",
    );
    if (fields.some((field) => COMMERCIAL_HEADER_FIELDS.has(field))) {
      assertEditable(
        canEditCommercialTerms(state),
        "Destination, currency and exchange rate are fixed once stock has been received.",
      );
    }
    if (typeof changes.locationId === "string") {
      pickActiveLocation(locations, changes.locationId);
    }

    const bumpsVersion = fields.some((field) => DOCUMENT_HEADER_FIELDS.has(field));
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { ...changes, ...(bumpsVersion ? { version: { increment: 1 } } : {}) },
    });
    await recordPurchasingEvent(tx, {
      subjectType: "PURCHASE_ORDER",
      subjectId: po.id,
      action: "purchase_order.header_updated",
      actor,
      details: { fields },
    });
  });
}

// ─── Lines ──────────────────────────────────────────────────────────────────

function costContext(po: PurchaseOrderRecord) {
  return {
    currency: po.currency,
    exchangeRate: po.exchangeRate,
    supplierCurrency: po.supplier.currency,
  };
}

async function bumpVersion(tx: TenantDb, purchaseOrderId: string): Promise<void> {
  await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { version: { increment: 1 } },
  });
}

/**
 * Add products to a purchase order. A product already on the order has the
 * quantity added to its line instead of appearing twice.
 */
export async function addPurchaseOrderLines(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
  expectedVersion: number,
  lines: readonly DraftLineInput[],
  options: { admin?: AdminGraphQLClient } = {},
): Promise<{ added: number; merged: number; missingCostVariantGids: string[] }> {
  const requested = mergeDraftLines(lines);
  if (requested.length === 0) throw invalidInput("Choose at least one product.");
  const variantGids = requested.map((line) => line.variantGid);
  const variants = await requireLiveVariants(db, variantGids, options.admin);

  return db.$transaction(async (tx) => {
    const po = await claimPurchaseOrder(tx, purchaseOrderId, expectedVersion);
    assertEditable(
      canEditLines(lifecycleStateOf(po)),
      "Products can no longer be added to this purchase order.",
    );
    const terms = await loadSupplierTerms(tx, po.supplierId, variantGids);
    const existingByVariant = new Map(po.lineItems.map((l) => [l.shopifyVariantId, l]));
    const newCount = requested.filter((l) => !existingByVariant.has(l.variantGid)).length;
    if (po.lineItems.length + newCount > MAX_LINES_PER_ORDER) {
      throw invalidInput(`A purchase order can have at most ${MAX_LINES_PER_ORDER} lines.`);
    }

    let position = po.lineItems.reduce((max, l) => Math.max(max, l.position), -1) + 1;
    let added = 0;
    let merged = 0;
    const missingCost: string[] = [];
    for (const line of requested) {
      const variant = variants.get(line.variantGid)!;
      const existing = existingByVariant.get(line.variantGid);
      const quantity = (existing?.orderedQty ?? 0) + line.quantity;
      assertQuantity(quantity);
      const resolved = resolveUnitCost(costContext(po), terms, variant, line.variantGid, quantity);

      if (!existing) {
        const data = newLineData(line, position++, variant, terms.mappings.get(line.variantGid), resolved, po.supplier);
        await tx.pOLineItem.create({ data: { purchaseOrderId: po.id, ...data } });
        if (!data.manualCostOverride && data.unitCost.isZero()) missingCost.push(line.variantGid);
        added++;
        continue;
      }

      const explicit = line.unitCost ?? null;
      const costLocked = existing.receivedQty > 0;
      if (explicit !== null && costLocked && !explicit.equals(existing.unitCost)) {
        throw invalidInput("The cost of a line that has been received cannot change.");
      }
      const repriced = !costLocked && (explicit !== null || !existing.manualCostOverride);
      const unitCost = repriced ? (explicit ?? resolved ?? ZERO) : existing.unitCost;
      await tx.pOLineItem.update({
        where: { id: existing.id },
        data: {
          orderedQty: quantity,
          unitCost,
          manualCostOverride: explicit !== null ? true : existing.manualCostOverride,
        },
      });
      if (explicit === null && !existing.manualCostOverride && unitCost.isZero()) {
        missingCost.push(line.variantGid);
      }
      merged++;
    }

    await bumpVersion(tx, po.id);
    await persistAllocation(tx, po.id);
    await recordPurchasingEvent(tx, {
      subjectType: "PURCHASE_ORDER",
      subjectId: po.id,
      action: "purchase_order.lines_added",
      actor,
      details: { added, merged },
    });
    return { added, merged, missingCostVariantGids: missingCost };
  });
}

function requireLine(po: PurchaseOrderRecord, lineId: string): PurchaseOrderLineRecord {
  const line = po.lineItems.find((candidate) => candidate.id === lineId);
  if (!line) throw notFound("Purchase order line");
  return line;
}

export async function updatePurchaseOrderLine(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
  expectedVersion: number,
  lineId: string,
  input: LineUpdateInput,
): Promise<void> {
  assertQuantity(input.quantity);
  if (input.unitCost !== null) assertUnitCost(input.unitCost);
  assertPercent(input.discountPercent, "Discount");
  assertPercent(input.taxRatePercent, "Tax rate");

  await db.$transaction(async (tx) => {
    const po = await claimPurchaseOrder(tx, purchaseOrderId, expectedVersion);
    assertEditable(
      canEditLines(lifecycleStateOf(po)),
      "Lines on this purchase order can no longer be edited.",
    );
    const line = requireLine(po, lineId);
    const committed = line.receivedQty + line.cancelledQty;
    if (input.quantity < committed) {
      throw invalidInput("Fix the highlighted field.", {
        quantity: `Quantity cannot be less than the ${committed} already received or cancelled.`,
      });
    }
    if (input.quantity < line.orderedQty) await assertNoReceiptInFlight(tx, po.id);

    const data: Record<string, unknown> = {};
    if (input.quantity !== line.orderedQty) data.orderedQty = input.quantity;
    if (!sameValue(line.discountPercent, input.discountPercent)) data.discountPercent = input.discountPercent;
    if (!sameValue(line.taxRatePercent, input.taxRatePercent)) data.taxRatePercent = input.taxRatePercent;
    if ((line.note ?? null) !== input.note) data.note = input.note;

    // A posted cost equal to the current automatic cost is not an override, so
    // a line the merchant never priced keeps following supplier pricing.
    const followsSupplierPricing =
      !line.manualCostOverride &&
      (input.unitCost === null || input.unitCost.equals(line.unitCost));
    const manualCost = followsSupplierPricing ? null : input.unitCost;
    if (manualCost !== null) {
      if (!manualCost.equals(line.unitCost)) data.unitCost = manualCost;
      if (!line.manualCostOverride) data.manualCostOverride = true;
    } else if (line.manualCostOverride || "orderedQty" in data) {
      const [terms, variants] = await Promise.all([
        loadSupplierTerms(tx, po.supplierId, [line.shopifyVariantId]),
        resolveVariants(tx, [line.shopifyVariantId]),
      ]);
      const resolved =
        resolveUnitCost(
          costContext(po),
          terms,
          variants.get(line.shopifyVariantId),
          line.shopifyVariantId,
          input.quantity,
        ) ?? ZERO;
      if (!resolved.equals(line.unitCost)) data.unitCost = resolved;
      if (line.manualCostOverride) data.manualCostOverride = false;
    }

    const moneyFields = ["unitCost", "manualCostOverride", "discountPercent", "taxRatePercent"];
    if (line.receivedQty > 0 && moneyFields.some((field) => field in data)) {
      throw invalidInput(
        "Cost, discount and tax are fixed on a line once stock has been received against it.",
      );
    }

    const fields = Object.keys(data);
    if (fields.length === 0) return;
    await tx.pOLineItem.update({ where: { id: line.id }, data });
    if (fields.some((field) => field !== "note")) await bumpVersion(tx, po.id);
    await persistAllocation(tx, po.id);
    await recordPurchasingEvent(tx, {
      subjectType: "PURCHASE_ORDER",
      subjectId: po.id,
      action: "purchase_order.line_updated",
      actor,
      details: { lineId: line.id, variantGid: line.shopifyVariantId, fields },
    });
  });
}

/** Remove a line outright. Only for drafts; later, cancel the line's remainder instead. */
export async function removePurchaseOrderLine(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
  expectedVersion: number,
  lineId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const po = await claimPurchaseOrder(tx, purchaseOrderId, expectedVersion);
    assertEditable(
      po.status === "DRAFT" && po.archivedAt === null,
      "Lines can only be removed from a draft. Cancel the remaining quantity instead.",
    );
    const line = requireLine(po, lineId);
    await tx.pOLineItem.delete({ where: { id: line.id } });
    await bumpVersion(tx, po.id);
    await persistAllocation(tx, po.id);
    await recordPurchasingEvent(tx, {
      subjectType: "PURCHASE_ORDER",
      subjectId: po.id,
      action: "purchase_order.line_removed",
      actor,
      details: { variantGid: line.shopifyVariantId, quantity: line.orderedQty },
    });
  });
}

/**
 * Set how many ordered units of a line will not arrive. The line keeps its
 * history; cancelled units stop counting as incoming stock and as order value.
 */
export async function setLineCancelledQuantity(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
  expectedVersion: number,
  lineId: string,
  cancelledQty: number,
): Promise<void> {
  if (!Number.isSafeInteger(cancelledQty) || cancelledQty < 0) {
    throw invalidInput("Cancelled quantity must be a whole number of 0 or more.");
  }
  await db.$transaction(async (tx) => {
    const po = await claimPurchaseOrder(tx, purchaseOrderId, expectedVersion);
    assertEditable(
      canEditLines(lifecycleStateOf(po)) && po.status !== "DRAFT",
      po.status === "DRAFT"
        ? "Change the quantity or remove the line on a draft."
        : "Lines on this purchase order can no longer be changed.",
    );
    const line = requireLine(po, lineId);
    const open = line.orderedQty - line.receivedQty;
    if (cancelledQty > open) {
      throw invalidInput(`Only ${open} units of this line have not been received.`);
    }
    if (cancelledQty === line.cancelledQty) return;
    await assertNoReceiptInFlight(tx, po.id);
    await tx.pOLineItem.update({ where: { id: line.id }, data: { cancelledQty } });
    await bumpVersion(tx, po.id);
    await persistAllocation(tx, po.id);
    await recordPurchasingEvent(tx, {
      subjectType: "PURCHASE_ORDER",
      subjectId: po.id,
      action: "purchase_order.line_cancelled",
      actor,
      details: {
        lineId: line.id,
        variantGid: line.shopifyVariantId,
        cancelledQty,
        previousCancelledQty: line.cancelledQty,
      },
    });
  });
}

// ─── Charges ────────────────────────────────────────────────────────────────

/**
 * Replace the order's header charges and allocation method. Legacy freight and
 * customs amounts are converted to charge rows the first time this runs.
 */
export async function replacePurchaseOrderCharges(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
  expectedVersion: number,
  input: { charges: readonly ChargeInput[]; landedCostMethod: AllocationMethod },
): Promise<void> {
  if (input.charges.length > MAX_CHARGES_PER_ORDER) {
    throw invalidInput(`A purchase order can have at most ${MAX_CHARGES_PER_ORDER} charges.`);
  }
  if (!ALLOCATION_METHODS.includes(input.landedCostMethod)) {
    throw invalidInput("Choose how charges are allocated.");
  }
  for (const charge of input.charges) {
    if (!CHARGE_KINDS.includes(charge.kind)) throw invalidInput("Choose a charge type.");
    assertDecimal(charge.amount, { max: MAX_CHARGE_AMOUNT, scale: 2, label: "Charge amount" });
    if (charge.description !== null && charge.description.length > 255) {
      throw invalidInput("Charge descriptions can be up to 255 characters.");
    }
  }

  await db.$transaction(async (tx) => {
    const po = await claimPurchaseOrder(tx, purchaseOrderId, expectedVersion);
    assertEditable(
      canEditCommercialTerms(lifecycleStateOf(po)),
      "Charges are fixed once stock has been received on this purchase order.",
    );
    const before = effectiveCharges(po);
    const unchanged =
      po.landedCostMethod === input.landedCostMethod &&
      before.length === input.charges.length &&
      before.every((charge, index) => {
        const next = input.charges[index]!;
        return (
          charge.kind === next.kind &&
          charge.amount.equals(next.amount) &&
          charge.allocate === next.allocate &&
          (charge.description ?? null) === next.description
        );
      });
    // Legacy amounts still get converted to rows even when nothing else changed.
    if (unchanged && before.every((charge) => charge.id !== null)) return;

    await tx.purchaseOrderCharge.deleteMany({ where: { purchaseOrderId: po.id } });
    if (input.charges.length > 0) {
      await tx.purchaseOrderCharge.createMany({
        data: input.charges.map((charge, position) => ({
          purchaseOrderId: po.id,
          kind: charge.kind,
          description: charge.description,
          amount: charge.amount,
          allocate: charge.allocate,
          position,
        })),
      });
    }
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        landedCostMethod: input.landedCostMethod,
        freightCost: null,
        customsCost: null,
        ...(unchanged ? {} : { version: { increment: 1 } }),
      },
    });
    await persistAllocation(tx, po.id);
    if (!unchanged) {
      await recordPurchasingEvent(tx, {
        subjectType: "PURCHASE_ORDER",
        subjectId: po.id,
        action: "purchase_order.charges_updated",
        actor,
        details: {
          chargeCount: input.charges.length,
          landedCostMethod: input.landedCostMethod,
        },
      });
    }
  });
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

const TRANSITION_EVENTS: Record<Exclude<PurchaseOrderAction, "delete">, string> = {
  markSent: "purchase_order.sent",
  markOrdered: "purchase_order.ordered",
  cancel: "purchase_order.cancelled",
  close: "purchase_order.closed",
  archive: "purchase_order.archived",
  unarchive: "purchase_order.unarchived",
};

function toStateError(error: unknown): never {
  if (error instanceof PurchaseOrderStateError) {
    throw new PurchasingError("invalid_state", error.message);
  }
  throw error;
}

export async function transitionPurchaseOrder(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
  expectedVersion: number,
  action: Exclude<PurchaseOrderAction, "delete">,
  options: { admin?: AdminGraphQLClient; today?: string | null } = {},
): Promise<void> {
  const placesOrder = action === "markSent" || action === "markOrdered";
  const locations = placesOrder ? await listLocations(db, options.admin) : [];

  await db.$transaction(async (tx) => {
    const po = await claimPurchaseOrder(tx, purchaseOrderId, expectedVersion);
    try {
      assertCanPerform(lifecycleStateOf(po), action);
    } catch (error) {
      toStateError(error);
    }
    if (action === "cancel" || action === "close" || action === "archive") {
      await assertNoReceiptInFlight(tx, po.id);
    }
    const now = new Date();
    const data: Record<string, unknown> = { status: nextStatusFor(po.status, action) };

    if (placesOrder) {
      if (!po.lineItems.some((line) => line.orderedQty - line.cancelledQty > 0)) {
        throw new PurchasingError(
          "invalid_state",
          "Add at least one product before sending or ordering.",
        );
      }
      // A duplicate or an old draft can point at a location closed since.
      if (po.status === "DRAFT") pickActiveLocation(locations, po.locationId);
      if (po.issuedOn === null && options.today) {
        data.issuedOn = parseCalendarDate(options.today);
      }
    }
    if (action === "markSent") {
      data.sentAt = now;
      data.sentVersion = po.version;
    }
    if (action === "markOrdered") data.orderedAt = now;
    if (action === "cancel") data.cancelledAt = now;
    if (action === "close") data.closedAt = now;
    if (action === "archive") data.archivedAt = now;
    if (action === "unarchive") data.archivedAt = null;

    await tx.purchaseOrder.update({ where: { id: po.id }, data });
    await recordPurchasingEvent(tx, {
      subjectType: "PURCHASE_ORDER",
      subjectId: po.id,
      action: TRANSITION_EVENTS[action],
      actor,
      details: {
        fromStatus: po.status,
        toStatus: data.status as string,
        version: po.version,
        ...(action === "close"
          ? { unreceivedUnits: po.lineItems.reduce((sum, l) => sum + remainingQuantity(l), 0) }
          : {}),
      },
    });
  });
}

/** Delete a draft that was never sent. Its history events are kept. */
export async function deletePurchaseOrderDraft(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
  expectedVersion: number,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const po = await claimPurchaseOrder(tx, purchaseOrderId, expectedVersion);
    try {
      assertCanPerform(lifecycleStateOf(po), "delete");
    } catch (error) {
      toStateError(error);
    }
    await tx.purchaseOrder.delete({ where: { id: po.id } });
    await recordPurchasingEvent(tx, {
      subjectType: "PURCHASE_ORDER",
      subjectId: po.id,
      action: "purchase_order.deleted",
      actor,
      details: {
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        lineCount: po.lineItems.length,
      },
    });
  });
}

/**
 * Start a new draft with the same supplier, destination, lines, costs and
 * charges. Dates, references and receiving progress are not copied.
 */
export async function duplicatePurchaseOrder(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
): Promise<{ id: string; poNumber: string }> {
  const source = await loadPurchaseOrder(db, purchaseOrderId);
  await requireOrderableSupplier(db, source.supplierId);
  const lines = source.lineItems.filter((line) => line.orderedQty - line.cancelledQty > 0);
  const charges = effectiveCharges(source);

  for (let attempt = 1; attempt <= NUMBERING_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const sequence = await nextSequence(tx);
        const poNumber = `PO-${sequence}`;
        const po: { id: string } = await tx.purchaseOrder.create({
          data: {
            supplierId: source.supplierId,
            locationId: source.locationId,
            poSequence: sequence,
            poNumber,
            status: "DRAFT",
            draftedAt: new Date(),
            currency: source.currency,
            exchangeRate: source.exchangeRate,
            landedCostMethod: source.landedCostMethod,
            paymentTerms: source.paymentTerms,
            shippingTerms: source.shippingTerms,
            shipToAddress: source.shipToAddress,
            billToAddress: source.billToAddress,
            buyerName: source.buyerName,
            supplierNotes: source.supplierNotes,
            notes: source.notes,
            createdByUserId: actor.type === "STAFF" ? actor.id : null,
            lineItems: {
              create: lines.map((line, position) => ({
                shopifyVariantId: line.shopifyVariantId,
                position,
                orderedQty: line.orderedQty - line.cancelledQty,
                unitCost: line.unitCost,
                manualCostOverride: line.manualCostOverride,
                discountPercent: line.discountPercent,
                taxRatePercent: line.taxRatePercent,
                vendorSku: line.vendorSku,
                packSize: line.packSize,
                orderUnit: line.orderUnit,
                productTitle: line.productTitle,
                variantTitle: line.variantTitle,
                sku: line.sku,
                barcode: line.barcode,
                inventoryItemGid: line.inventoryItemGid,
                weight: line.weight,
                volume: line.volume,
                retailPrice: line.retailPrice,
                note: line.note,
              })),
            },
            charges: {
              create: charges.map((charge, position) => ({
                kind: charge.kind,
                description: charge.description,
                amount: charge.amount,
                allocate: charge.allocate,
                position,
              })),
            },
          },
        });
        await persistAllocation(tx, po.id);
        await recordPurchasingEvent(tx, {
          subjectType: "PURCHASE_ORDER",
          subjectId: po.id,
          action: "purchase_order.created",
          actor,
          details: {
            poNumber,
            source: "duplicate",
            lineCount: lines.length,
            copiedFrom: source.poNumber ?? source.id,
          },
        });
        return { id: po.id, poNumber };
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new PurchasingError(
    "conflict",
    "Several purchase orders were being created at once. Try again.",
  );
}
