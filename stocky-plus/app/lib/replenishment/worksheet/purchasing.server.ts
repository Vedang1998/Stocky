/**
 * The worksheet's link to the purchasing module. Replenishment reads supplier
 * terms and open orders, and creates draft purchase orders, only through the
 * purchasing services named here.
 */
import type { AdminGraphQLClient } from "../../../services/shopify-gql.server";
import type { PurchasingActor } from "../../../services/purchasing/actor.server";
import {
  getIncomingQuantities,
  getSupplierTerms,
  listSupplierVariantGids,
} from "../../../services/purchasing/planning.server";
import {
  createPurchaseOrderDraft,
  MAX_LINES_PER_ORDER,
} from "../../../services/purchasing/purchase-orders.server";
import { listSupplierOptions } from "../../../services/purchasing/suppliers.server";
import type { TenantDb } from "../../../tenant/tenant-db.server";
import type { LocalDate } from "../local-date";
import type { DraftOrderPort } from "./orders.server";
import type { WorksheetSources } from "./sources";

export const purchasingSources: WorksheetSources = {
  getIncomingQuantities,
  getSupplierTerms,
  listSuppliers: listSupplierOptions,
  getSupplierVariantGids: listSupplierVariantGids,
};

/**
 * Draft creation on behalf of the signed-in staff member. `today` is the
 * shop's calendar date; purchasing uses it to set the expected delivery date
 * from the supplier's lead time.
 */
export function draftOrderPort(
  db: TenantDb,
  context: { actor: PurchasingActor; admin: AdminGraphQLClient; today: LocalDate },
): DraftOrderPort {
  return {
    maxLinesPerOrder: MAX_LINES_PER_ORDER,
    async create(request) {
      const order = await createPurchaseOrderDraft(db, context.actor, request, {
        admin: context.admin,
        today: context.today,
      });
      return { id: order.id, poNumber: order.poNumber, created: order.created };
    },
  };
}
