/**
 * Stocky-parity ABC/U run for the current catalog, computed on demand from
 * canonical order and catalog facts. See `abc-parity.ts` for the rules.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import {
  abcWindowFor,
  classifyAbcParity,
  type AbcClassification,
} from "./abc-parity";
import { loadCatalogVariants, type CatalogVariant } from "./catalog.server";
import { requireShopCurrency } from "./errors";
import { ZERO, type Decimal } from "./money";
import { aggregateVariantWindow, type NetUnitsDiagnostics } from "./net-units";
import { loadSalesHistory, type SalesHistory, type SalesHistoryCoverage } from "./sales-history.server";
import {
  addLocalDays,
  localDateOf,
  requireShopTimeZone,
  type LocalDate,
} from "./shop-calendar";

export type AbcParityRun = AbcClassification & {
  asOfLocalDate: LocalDate;
  timeZone: string;
  currencyCode: string;
  computedAt: Date;
  policies: SalesHistory["policies"];
  catalog: Map<string, CatalogVariant>;
  /** Net revenue in the window from variants no longer in the catalog. */
  revenueOutsideCatalog: Decimal;
  salesDiagnostics: NetUnitsDiagnostics;
  coverage: SalesHistoryCoverage;
};

/** The most recent complete shop-local day: the default ABC as-of date. */
export function lastCompleteLocalDay(now: Date, timeZone: string): LocalDate {
  return addLocalDays(localDateOf(now, timeZone), -1);
}

export async function loadAbcParityRun(
  db: TenantDb,
  input: {
    timeZone: string | null;
    currencyCode: string | null;
    installedAt: Date | null;
    /** Defaults to the last complete shop-local day. */
    asOfLocalDate?: LocalDate;
    now?: Date;
  },
): Promise<AbcParityRun> {
  const timeZone = requireShopTimeZone(input.timeZone);
  const currencyCode = requireShopCurrency(input.currencyCode);
  const now = input.now ?? new Date();
  const asOfLocalDate = input.asOfLocalDate ?? lastCompleteLocalDay(now, timeZone);
  const { windowStartLocalDate, windowEndLocalDate } = abcWindowFor(asOfLocalDate);

  const [history, variants] = await Promise.all([
    loadSalesHistory(db, {
      startLocalDate: windowStartLocalDate,
      endLocalDate: windowEndLocalDate,
      timeZone,
      reportCurrency: currencyCode,
      installedAt: input.installedAt,
    }),
    loadCatalogVariants(db, { timeZone }),
  ]);

  const sales = new Map(
    aggregateVariantWindow(history.events).map((row) => [row.variantGid, row]),
  );
  const catalog = new Map(variants.map((variant) => [variant.variantGid, variant]));

  let revenueOutsideCatalog = ZERO;
  for (const row of sales.values()) {
    if (!catalog.has(row.variantGid)) {
      revenueOutsideCatalog = revenueOutsideCatalog.plus(row.revenue);
    }
  }

  const classification = classifyAbcParity({
    asOfLocalDate,
    historyStartLocalDate: history.coverage.historyStartLocalDate,
    candidates: variants.map((variant) => {
      const sold = sales.get(variant.variantGid);
      return {
        variantGid: variant.variantGid,
        createdLocalDate: variant.createdLocalDate,
        revenue: sold?.revenue ?? ZERO,
        netUnits: sold?.netUnits ?? 0,
      };
    }),
  });

  return {
    ...classification,
    asOfLocalDate,
    timeZone,
    currencyCode,
    computedAt: now,
    policies: history.policies,
    catalog,
    revenueOutsideCatalog,
    salesDiagnostics: history.diagnostics,
    coverage: history.coverage,
  };
}
