import {
  BULK_B_PRODUCTION_ENABLED,
  ORDER_FACTS_BULK_A_ORDERS_LINES,
  ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL,
} from "../admin-read";
import {
  assertBulkOperationEligible,
  evaluateBulkOperationRules,
} from "../admin-read/bulk-operation-rules";
import {
  assertQuerySchemaValid,
  loadGeneratedAdmin202607Schema,
} from "../admin-read/bulk-query-schema";
import type { CatalogAdminReadClient } from "../../catalog-facts/admin-read";
import { submitCatalogFactBulkOperation } from "../../catalog-facts/ingest/bulk-operation-submitter";
import { OrderFactsBulkDisabledError, OrderFactsSyncError } from "./errors";
import type { BulkSubmitIntent } from "./types";

export type OrderFactsBulkGates = {
  schemaGatePassed: boolean;
  bulkRuleGatePassed: boolean;
  eligible: boolean;
  reasons: string[];
};

export function evaluateOrderFactsBulkAGates(
  innerQuery: string,
): OrderFactsBulkGates {
  const { schema } = loadGeneratedAdmin202607Schema();
  assertQuerySchemaValid(schema, innerQuery, "ORDER_FACTS_BULK_A");
  const rules = evaluateBulkOperationRules(schema, innerQuery);
  assertBulkOperationEligible(schema, innerQuery, "ORDER_FACTS_BULK_A");
  return {
    schemaGatePassed: true,
    bulkRuleGatePassed: rules.eligible,
    eligible: rules.eligible,
    reasons: rules.reasons,
  };
}

export function assertBulkCRejected(innerQuery: string): void {
  if (innerQuery.trim() === ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL.trim()) {
    throw new OrderFactsBulkDisabledError("Bulk C is rejected (T53)");
  }
  const { schema } = loadGeneratedAdmin202607Schema();
  const rules = evaluateBulkOperationRules(schema, innerQuery);
  const nestedAgreements =
    innerQuery.includes("agreements") && innerQuery.includes("sales");
  if (nestedAgreements && !rules.eligible) {
    throw new OrderFactsBulkDisabledError(
      `Bulk C rejected: ${rules.reasons.join("; ")}`,
    );
  }
}

/**
 * Run both B gates on the inner document, then call the existing audited
 * catalog bulk-query submitter as generic `query` transport. Do not duplicate
 * the mutation here. Actual store submission is not authorized in this work.
 */
export async function submitOrderFactsBulkA(
  admin: CatalogAdminReadClient,
  input: { shopId: string; fenceGeneration: bigint; innerQuery?: string },
): Promise<{ id: string; status: string; intent: BulkSubmitIntent }> {
  if (BULK_B_PRODUCTION_ENABLED) {
    throw new OrderFactsBulkDisabledError(
      "Bulk B production is disabled and must remain false",
    );
  }
  const innerQuery = input.innerQuery ?? ORDER_FACTS_BULK_A_ORDERS_LINES;
  assertBulkCRejected(innerQuery);
  const gates = evaluateOrderFactsBulkAGates(innerQuery);
  if (!gates.schemaGatePassed || !gates.bulkRuleGatePassed) {
    throw new OrderFactsSyncError(
      "order_facts_bulk_gate_failed",
      `Bulk A gates failed: ${gates.reasons.join("; ")}`,
    );
  }
  const submitted = await submitCatalogFactBulkOperation(admin, innerQuery);
  return {
    id: submitted.id,
    status: submitted.status,
    intent: {
      shopId: input.shopId,
      fenceGeneration: input.fenceGeneration,
      innerQuery,
      schemaGatePassed: true,
      bulkRuleGatePassed: true,
    },
  };
}
