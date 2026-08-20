/**
 * Cheap non-bulk unitCost capability preflight (R-132).
 *
 * Performed before choosing a catalog bulk document. Permission denial or
 * unavailability must not abort the catalog read pipeline. FEATURE_COST_SYNC
 * is not consulted and is not enabled here.
 *
 * DENIED requires structured GraphQL evidence: extensions.code ACCESS_DENIED
 * and a GraphQL path attributable to unitCost. Message text is secondary
 * diagnostic only and must not produce DENIED.
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
  UnitCostPreflightFailureKind,
  UnitCostPreflightResult,
} from "./types";

function errorPathTouchesUnitCost(error: AdminGraphQLError): boolean {
  const path = error.path;
  if (!Array.isArray(path) || path.length === 0) return false;
  return path[path.length - 1] === "unitCost";
}

function isStructuredAccessDenied(error: AdminGraphQLError): boolean {
  return error.extensions?.code === "ACCESS_DENIED";
}

function unavailable(
  failureKind: UnitCostPreflightFailureKind,
): UnitCostPreflightResult {
  return {
    decision: "UNAVAILABLE",
    unitCostAccess: "QUERY_ERROR_ISOLATED",
    catalogBulkQueryShape: "no-unitCost",
    unitCostAmount: null,
    unitCostCurrencyCode: null,
    failureKind,
  };
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
  let response: Awaited<
    ReturnType<
      typeof executeAdminReadQuery<{
        inventoryItem?: {
          id?: unknown;
          unitCost?: { amount?: unknown; currencyCode?: unknown } | null;
        } | null;
      }>
    >
  >;
  try {
    response = await executeAdminReadQuery<{
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
  } catch (error) {
    if (error instanceof CanonicalAdminReadError && error.graphqlErrors.length > 0) {
      return unavailable("GRAPHQL");
    }
    return unavailable("TRANSPORT");
  }

  const errors = response.errors ?? [];
  const denied = errors.filter(
    (error) => isStructuredAccessDenied(error) && errorPathTouchesUnitCost(error),
  );
  if (denied.length > 0) {
    return {
      decision: "DENIED",
      unitCostAccess: "OMITTED_NO_PERMISSION",
      catalogBulkQueryShape: "no-unitCost",
      unitCostAmount: null,
      unitCostCurrencyCode: null,
      failureKind: "GRAPHQL",
    };
  }

  if (errors.length > 0 || !response.data?.inventoryItem) {
    return unavailable("GRAPHQL");
  }

  try {
    const unitCost = response.data.inventoryItem.unitCost ?? null;
    if (unitCost == null) {
      return {
        decision: "ALLOWED",
        unitCostAccess: "NULL",
        catalogBulkQueryShape: "with-unitCost",
        unitCostAmount: null,
        unitCostCurrencyCode: null,
        failureKind: null,
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
      failureKind: null,
    };
  } catch {
    return unavailable("MAPPING_INTEGRITY");
  }
}
