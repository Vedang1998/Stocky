/**
 * Tenant identity for PR6-B. Trusted server context only.
 * Import denyConflictingClientShop; do not edit tenant primitives.
 */

import { denyConflictingClientShop } from "../../../tenant/client-shop.server";
import { TenantAuthorityError } from "../../../tenant/errors";
import { OrderFactReadWalkError } from "./errors";
import type { OrderAdminReadContext } from "./types";

export async function assertTrustedOrderAdminReadContext(
  context: OrderAdminReadContext,
): Promise<void> {
  if (!context.request) return;
  try {
    await denyConflictingClientShop(context.request, {
      id: context.shop.id,
      myshopifyDomain: context.shop.myshopifyDomain,
    });
  } catch (error) {
    if (error instanceof TenantAuthorityError) {
      throw new OrderFactReadWalkError("TENANT_DENIED", error.message, {
        phase: "tenant",
      });
    }
    throw error;
  }
}
