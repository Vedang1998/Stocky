/**
 * Cheap non-bulk unitCost capability preflight (R-132).
 *
 * Performed before choosing a catalog bulk document. Permission denial or
 * unavailability must not abort the catalog read pipeline. FEATURE_COST_SYNC
 * is not consulted and is not enabled here.
 */

import {
  CATALOG_BULK_QUERY_NO_UNIT_COST,
  CATALOG_BULK_QUERY_WITH_UNIT_COST,
} from "./bulk-query-documents";
import { CATALOG_FACT_UNIT_COST_PREFLIGHT_QUERY } from "./documents";
import { optionalDecimalString, optionalString } from "./decimal";
import { CanonicalAdminReadError, executeAdminReadQuery } from "./execute";
import type {
  AdminGraphQLError,
  CatalogAdminReadClient,
  CatalogBulkQueryShape,
  UnitCostPreflightResult,
} from "./types";

function errorTouchesUnitCost(error: AdminGraphQLError): boolean {
  const path = error.path ?? [];
  if (path.some((segment) => segment === "unitCost")) return true;
  return /unitCost/i.test(error.message);
}

function isAccessDenied(error: AdminGraphQLError): boolean {
  const code = error.extensions?.code;
  if (typeof code === "string" && code.toUpperCase() === "ACCESS_DENIED") {
    return true;
  }
  return /access denied/i.test(error.message);
}

export function chooseCatalogBulkQuery(
  result: Pick<UnitCostPreflightResult, "catalogBulkQueryShape">,
): { shape: CatalogBulkQueryShape; document: string } {
  if (result.catalogBulkQueryShape === "with-unitCost") {
    return {
      shape: "with-unitCost",
      document: CATALOG_BULK_QUERY_WITH_UNIT_COST,
    };
  }
  return {
    shape: "no-unitCost",
    document: CATALOG_BULK_QUERY_NO_UNIT_COST,
  };
}

export async function preflightUnitCostCapability(
  admin: CatalogAdminReadClient,
  probeInventoryItemGid: string,
): Promise<UnitCostPreflightResult> {
  try {
    const response = await executeAdminReadQuery<{
      inventoryItem?: {
        id?: unknown;
        unitCost?: { amount?: unknown; currencyCode?: unknown } | null;
      } | null;
    }>(
      admin,
      CATALOG_FACT_UNIT_COST_PREFLIGHT_QUERY,
      { id: probeInventoryItemGid },
      { allowFieldErrors: true },
    );

    const errors = response.errors ?? [];
    const denied = errors.filter(
      (error) => isAccessDenied(error) && errorTouchesUnitCost(error),
    );
    if (denied.length > 0) {
      return {
        decision: "DENIED",
        unitCostAccess: "OMITTED_NO_PERMISSION",
        catalogBulkQueryShape: "no-unitCost",
        unitCostAmount: null,
        unitCostCurrencyCode: null,
      };
    }

    if (errors.length > 0 || !response.data?.inventoryItem) {
      return {
        decision: "UNAVAILABLE",
        unitCostAccess: "QUERY_ERROR_ISOLATED",
        catalogBulkQueryShape: "no-unitCost",
        unitCostAmount: null,
        unitCostCurrencyCode: null,
      };
    }

    const unitCost = response.data.inventoryItem.unitCost ?? null;
    if (unitCost == null) {
      return {
        decision: "ALLOWED",
        unitCostAccess: "NULL",
        catalogBulkQueryShape: "with-unitCost",
        unitCostAmount: null,
        unitCostCurrencyCode: null,
      };
    }

    return {
      decision: "ALLOWED",
      unitCostAccess: "PRESENT",
      catalogBulkQueryShape: "with-unitCost",
      unitCostAmount: optionalDecimalString(
        unitCost.amount,
        "inventoryItem.unitCost.amount",
      ),
      unitCostCurrencyCode: optionalString(unitCost.currencyCode),
    };
  } catch (error) {
    if (error instanceof CanonicalAdminReadError) {
      return {
        decision: "UNAVAILABLE",
        unitCostAccess: "QUERY_ERROR_ISOLATED",
        catalogBulkQueryShape: "no-unitCost",
        unitCostAmount: null,
        unitCostCurrencyCode: null,
      };
    }
    return {
      decision: "UNAVAILABLE",
      unitCostAccess: "QUERY_ERROR_ISOLATED",
      catalogBulkQueryShape: "no-unitCost",
      unitCostAmount: null,
      unitCostCurrencyCode: null,
    };
  }
}
