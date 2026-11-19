/**
 * Generates a worksheet: reads the catalog, stock, sales, planning levels and
 * supplier terms for the chosen products, computes every row, and stores the
 * result as one snapshot.
 *
 * The worksheet and all of its rows are written in one transaction, so a
 * worksheet that can be opened is always complete. Nothing here writes to
 * Shopify or creates a purchase order.
 */
import { loadAbcParityRun } from "../../analytics/abc-parity.server";
import { loadCatalogVariants, type CatalogVariant } from "../../analytics/catalog.server";
import { requireShopCurrency } from "../../analytics/errors";
import { aggregateVariantWindow } from "../../analytics/net-units";
import { loadSalesHistory } from "../../analytics/sales-history.server";
import { localDateOf, requireShopTimeZone } from "../../analytics/shop-calendar";
import type { TenantDb } from "../../../tenant/tenant-db.server";
import { addDays, compareLocalDates, inclusiveDayCount, type LocalDate } from "../local-date";
import { loadEffectiveRules } from "../rules.server";
import { isVariantGid, SHOP_SCOPE } from "../scope";
import type { HistoryCoverage, SampleWindow } from "../types";
import { sampleWindowFor, validateMethodParameters } from "../windows";
import {
  buildWorksheetLine,
  type LineContext,
  type StockPosition,
  type WorksheetLineRecord,
} from "./line";
import { MAX_WORKSHEET_VARIANTS, WORKSHEETS_KEPT } from "./limits";
import type { WorksheetSettings } from "./settings";
import type { SupplierTerms, VariantSuppliers, WorksheetSources } from "./sources";

const LIVE = "LIVE";
const PRODUCT_PAGE = 1000;
const IN_LIST = 500;
const INSERT_BATCH = 500;
const WRITE_TIMEOUT_MS = 60_000;

export type WorksheetErrorCode =
  | "invalid_settings"
  | "location_not_found"
  | "supplier_not_found"
  | "too_many_variants"
  | "no_variants";

/** A problem the merchant can fix; `message` is written for them. */
export class WorksheetError extends Error {
  constructor(
    readonly code: WorksheetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorksheetError";
  }
}

export type WorksheetSummary = {
  currencyCode: string;
  salesWindow: SampleWindow;
  coverage: HistoryCoverage;
  /** First day the stored order history can speak for. */
  historyStartLocalDate: LocalDate | null;
  /**
   * The days the ABC/U classes were measured over: the shop's whole catalog,
   * not just this selection, ending on the last complete day.
   */
  abcWindow: { start: LocalDate; end: LocalDate } | null;
  /** Variants left out because the chosen location does not stock them. */
  notStockedAtLocation: number;
  excludedOrders: {
    test: number;
    cancelled: number;
    inconsistentUnits: number;
    missingSalesRecords: number;
  };
};

export type GenerateWorksheetInput = {
  settings: WorksheetSettings;
  shop: {
    timeZone: string | null;
    currencyCode: string | null;
    installedAt: Date | null;
  };
  /** Shop defaults that are not part of a run. */
  defaults: { sampleDays: number; defaultLeadTimeDays: number | null };
  now: Date;
};

export type GeneratedWorksheet = { id: string; lineCount: number };

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** How much of a sales window the stored order history covers. */
export function coverageForWindow(
  window: SampleWindow,
  historyStart: LocalDate | null,
): HistoryCoverage {
  if (historyStart == null || compareLocalDates(historyStart, window.end) > 0) {
    return { kind: "NONE" };
  }
  if (compareLocalDates(historyStart, window.start) <= 0) return { kind: "FULL" };
  return { kind: "PARTIAL", coveredDays: inclusiveDayCount(historyStart, window.end) };
}

function tooManyVariants(): WorksheetError {
  return new WorksheetError(
    "too_many_variants",
    `This selection has more than ${MAX_WORKSHEET_VARIANTS.toLocaleString("en-US")} variants. Choose a vendor, product type or supplier to plan a smaller group.`,
  );
}

async function resolveScopeName(db: TenantDb, scopeKey: string): Promise<string | null> {
  if (scopeKey === SHOP_SCOPE) return null;
  const location: { name: string; isActive: boolean } | null =
    await db.shopifyLocationFact.findFirst({
      where: { shopifyGid: scopeKey, existenceState: LIVE },
      select: { name: true, isActive: true },
    });
  if (!location) {
    throw new WorksheetError(
      "location_not_found",
      "That location is no longer in your store. Choose another location.",
    );
  }
  if (!location.isActive) {
    throw new WorksheetError(
      "location_not_found",
      `${location.name} is deactivated in Shopify. Choose an active location.`,
    );
  }
  return location.name;
}

/** Variants of the shop's unarchived products, optionally narrowed. */
async function selectVariantGidsByProduct(
  db: TenantDb,
  selection: WorksheetSettings["selection"],
): Promise<string[]> {
  const variantGids: string[] = [];
  let afterId: string | null = null;
  for (;;) {
    const products: Array<{ id: string; shopifyGid: string }> =
      await db.shopifyProductFact.findMany({
        where: {
          existenceState: LIVE,
          status: { not: "ARCHIVED" },
          ...(selection.vendor ? { vendor: selection.vendor } : {}),
          ...(selection.productType ? { productType: selection.productType } : {}),
          ...(afterId ? { id: { gt: afterId } } : {}),
        },
        select: { id: true, shopifyGid: true },
        orderBy: { id: "asc" },
        take: PRODUCT_PAGE,
      });
    for (const batch of chunk(products, IN_LIST)) {
      const variants: Array<{ shopifyGid: string }> = await db.shopifyVariantFact.findMany({
        where: {
          existenceState: LIVE,
          shopifyProductGid: { in: batch.map((product) => product.shopifyGid) },
        },
        select: { shopifyGid: true },
      });
      for (const variant of variants) variantGids.push(variant.shopifyGid);
      if (variantGids.length > MAX_WORKSHEET_VARIANTS) throw tooManyVariants();
    }
    if (products.length < PRODUCT_PAGE) break;
    afterId = products[products.length - 1].id;
  }
  return variantGids;
}

async function selectCatalog(
  db: TenantDb,
  sources: WorksheetSources,
  selection: WorksheetSettings["selection"],
  timeZone: string,
): Promise<CatalogVariant[]> {
  if (!selection.supplierId) {
    const variantGids = await selectVariantGidsByProduct(db, selection);
    return variantGids.length > 0
      ? loadCatalogVariants(db, { timeZone, variantGids })
      : [];
  }

  const suppliers = await sources.listSuppliers(db);
  if (!suppliers.some((supplier) => supplier.id === selection.supplierId)) {
    throw new WorksheetError(
      "supplier_not_found",
      "That supplier no longer exists. Choose another supplier.",
    );
  }
  const supplied = (await sources.getSupplierVariantGids(db, selection.supplierId)).filter(
    isVariantGid,
  );
  if (supplied.length === 0) return [];
  const catalog = await loadCatalogVariants(db, { timeZone, variantGids: supplied });
  const selected = catalog.filter(
    (variant) =>
      variant.productStatus !== "ARCHIVED" &&
      (!selection.vendor || variant.vendor === selection.vendor) &&
      (!selection.productType || variant.productType === selection.productType),
  );
  if (selected.length > MAX_WORKSHEET_VARIANTS) throw tooManyVariants();
  return selected;
}

async function loadProductImages(
  db: TenantDb,
  productGids: readonly string[],
): Promise<Map<string, string>> {
  const images = new Map<string, string>();
  for (const batch of chunk([...new Set(productGids)], IN_LIST)) {
    const rows: Array<{ shopifyGid: string; featuredMediaUrl: string | null }> =
      await db.shopifyProductFact.findMany({
        where: { existenceState: LIVE, shopifyGid: { in: batch } },
        select: { shopifyGid: true, featuredMediaUrl: true },
      });
    for (const row of rows) {
      if (row.featuredMediaUrl) images.set(row.shopifyGid, row.featuredMediaUrl);
    }
  }
  return images;
}

type LevelRow = {
  inventoryItemGid: string;
  availableQuantity: number | null;
  onHandQuantity: number | null;
  committedQuantity: number | null;
  incomingQuantity: number | null;
};

/**
 * Adds one location's quantity to a running total. One unsynced location
 * makes the total unknown: a partial sum would understate stock and inflate
 * the suggestion.
 */
function addQuantity(
  total: number | null | undefined,
  value: number | null,
): number | null {
  if (total === null || value == null) return null;
  return (total ?? 0) + value;
}

/**
 * Stock by inventory item at the planning scope, summed over the shop's
 * active locations or read from the one chosen location. Items with no
 * active inventory level in the scope are absent from the map.
 */
async function loadStockPositions(
  db: TenantDb,
  inventoryItemGids: readonly string[],
  scopeKey: string,
): Promise<Map<string, StockPosition>> {
  const totals = new Map<
    string,
    { [K in keyof StockPosition]: number | null | undefined }
  >();
  for (const batch of chunk(inventoryItemGids, IN_LIST)) {
    const rows: LevelRow[] = await db.shopifyInventoryLevelFact.findMany({
      where: {
        existenceState: LIVE,
        isActive: true,
        inventoryItemGid: { in: batch },
        ...(scopeKey === SHOP_SCOPE ? {} : { locationGid: scopeKey }),
      },
      select: {
        inventoryItemGid: true,
        availableQuantity: true,
        onHandQuantity: true,
        committedQuantity: true,
        incomingQuantity: true,
      },
    });
    for (const row of rows) {
      const total = totals.get(row.inventoryItemGid) ?? {
        available: undefined,
        onHand: undefined,
        committed: undefined,
        incoming: undefined,
      };
      total.available = addQuantity(total.available, row.availableQuantity);
      total.onHand = addQuantity(total.onHand, row.onHandQuantity);
      total.committed = addQuantity(total.committed, row.committedQuantity);
      total.incoming = addQuantity(total.incoming, row.incomingQuantity);
      totals.set(row.inventoryItemGid, total);
    }
  }
  const positions = new Map<string, StockPosition>();
  for (const [itemGid, total] of totals) {
    positions.set(itemGid, {
      available: total.available ?? null,
      onHand: total.onHand ?? null,
      committed: total.committed ?? null,
      incoming: total.incoming ?? null,
    });
  }
  return positions;
}

const UNKNOWN_STOCK: StockPosition = {
  available: null,
  onHand: null,
  committed: null,
  incoming: null,
};

function supplierFor(
  suppliers: VariantSuppliers | undefined,
  selectedSupplierId: string | null,
): SupplierTerms | null {
  if (!suppliers) return null;
  if (selectedSupplierId) {
    return suppliers.all.find((terms) => terms.supplierId === selectedSupplierId) ?? null;
  }
  // With one supplier there is nothing to choose between.
  return suppliers.preferred ?? (suppliers.all.length === 1 ? suppliers.all[0] : null);
}

export async function generateWorksheet(
  db: TenantDb,
  sources: WorksheetSources,
  input: GenerateWorksheetInput,
): Promise<GeneratedWorksheet> {
  const { settings, defaults, now } = input;
  const timeZone = requireShopTimeZone(input.shop.timeZone);
  const currencyCode = requireShopCurrency(input.shop.currencyCode);
  const asOf = localDateOf(now, timeZone);

  // Stored settings are generated again later, when a date range that was
  // valid may have stopped being so.
  const problems = validateMethodParameters(settings.params, asOf);
  if (problems.length > 0) {
    throw new WorksheetError("invalid_settings", problems[0].message);
  }

  const scopeName = await resolveScopeName(db, settings.scopeKey);
  const catalog = await selectCatalog(db, sources, settings.selection, timeZone);

  const itemGids = catalog.flatMap((variant) =>
    variant.inventoryItemGid ? [variant.inventoryItemGid] : [],
  );
  const stock = await loadStockPositions(db, itemGids, settings.scopeKey);

  // Planning one location covers only what that location stocks.
  const planned =
    settings.scopeKey === SHOP_SCOPE
      ? catalog
      : catalog.filter(
          (variant) => variant.inventoryItemGid && stock.has(variant.inventoryItemGid),
        );
  if (planned.length === 0) {
    throw new WorksheetError(
      "no_variants",
      catalog.length === 0
        ? "No products match this selection."
        : `None of the selected products are stocked at ${scopeName}.`,
    );
  }
  const variantGids = planned.map((variant) => variant.variantGid);

  const salesWindow: SampleWindow = sampleWindowFor(settings.params, asOf) ?? {
    start: addDays(asOf, -defaults.sampleDays),
    end: addDays(asOf, -1),
    days: defaults.sampleDays,
  };
  const history = await loadSalesHistory(db, {
    startLocalDate: salesWindow.start,
    endLocalDate: salesWindow.end,
    timeZone,
    reportCurrency: currencyCode,
    variantGids,
    installedAt: input.shop.installedAt,
  });
  const sales = new Map(
    aggregateVariantWindow(history.events).map((row) => [row.variantGid, row]),
  );
  const coverage = coverageForWindow(salesWindow, history.coverage.historyStartLocalDate);

  // ABC/U ranks a variant against the whole shop, so the run covers every
  // variant even when the worksheet is for one vendor or supplier.
  const abc = await loadAbcParityRun(db, {
    timeZone,
    currencyCode,
    installedAt: input.shop.installedAt,
    now,
  });
  const abcClasses = new Map(abc.rows.map((row) => [row.variantGid, row.abcClass]));

  const [rules, supplierTerms, appIncoming, images] = await Promise.all([
    loadEffectiveRules(db, variantGids, settings.scopeKey),
    sources.getSupplierTerms(db, { variantGids }),
    settings.incomingSource === "APP_PURCHASE_ORDERS"
      ? sources.getIncomingQuantities(db, {
          variantGids,
          ...(settings.scopeKey === SHOP_SCOPE ? {} : { locationGid: settings.scopeKey }),
        })
      : new Map<string, number>(),
    loadProductImages(
      db,
      planned.map((variant) => variant.productGid),
    ),
  ]);

  const context: LineContext = {
    params: settings.params,
    salesWindow,
    coverage,
    asOf,
    incomingSource: settings.incomingSource,
    rounding: settings.rounding,
    shopLeadTimeDays: defaults.defaultLeadTimeDays,
  };
  const lines: WorksheetLineRecord[] = planned.map((variant) => {
    const suppliers = supplierTerms.get(variant.variantGid);
    const variantSales = sales.get(variant.variantGid);
    return buildWorksheetLine(context, {
      variant,
      imageUrl: images.get(variant.productGid) ?? null,
      stock:
        (variant.inventoryItemGid && stock.get(variant.inventoryItemGid)) || UNKNOWN_STOCK,
      appIncoming: appIncoming.get(variant.variantGid) ?? null,
      sales: variantSales
        ? {
            netUnits: variantSales.netUnits,
            distinctOrders: variantSales.distinctOrders,
            revenue: variantSales.revenue,
          }
        : null,
      abcClass: abcClasses.get(variant.variantGid) ?? null,
      rule: rules.get(variant.variantGid) ?? null,
      supplier: supplierFor(suppliers, settings.selection.supplierId),
      suppliers: suppliers?.all ?? [],
    });
  });

  const summary: WorksheetSummary = {
    currencyCode,
    salesWindow,
    coverage,
    historyStartLocalDate: history.coverage.historyStartLocalDate,
    abcWindow: { start: abc.windowStartLocalDate, end: abc.windowEndLocalDate },
    notStockedAtLocation: catalog.length - planned.length,
    excludedOrders: {
      test: history.diagnostics.ordersExcludedTest,
      cancelled: history.diagnostics.ordersExcludedCancelled,
      inconsistentUnits: history.diagnostics.ordersExcludedSignInconsistent,
      missingSalesRecords: history.diagnostics.ordersWithoutLedger,
    },
  };

  return db.$transaction(
    async (tx) => {
      const worksheet: { id: string } = await tx.replenishmentWorksheet.create({
        data: {
          method: settings.params.method,
          scopeKey: settings.scopeKey,
          scopeName,
          settings,
          asOfLocalDate: asOf,
          timeZone,
          windowStart: salesWindow.start,
          windowEnd: salesWindow.end,
          summary,
          lineCount: lines.length,
          generatedAt: now,
        },
        select: { id: true },
      });
      for (const batch of chunk(lines, INSERT_BATCH)) {
        await tx.replenishmentWorksheetLine.createMany({
          data: batch.map((line) => ({ ...line, worksheetId: worksheet.id })),
        });
      }

      const expired: Array<{ id: string }> = await tx.replenishmentWorksheet.findMany({
        select: { id: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: WORKSHEETS_KEPT,
      });
      if (expired.length > 0) {
        await tx.replenishmentWorksheet.deleteMany({
          where: { id: { in: expired.map((row) => row.id) } },
        });
      }
      return { id: worksheet.id, lineCount: lines.length };
    },
    { timeout: WRITE_TIMEOUT_MS },
  );
}
