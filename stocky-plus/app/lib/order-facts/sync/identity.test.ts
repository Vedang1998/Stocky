import { describe, expect, it } from "vitest";
import {
  assertNotWebhookDeliveryId,
  extractEditedOrderIdentity,
  extractOrderGidFromDeleteProjection,
  extractOrderGidFromLegacyProjection,
  extractRefundIdentity,
  extractTransactionIdentity,
} from "./identity";
import { OrderFactsIdentityError } from "./errors";

describe("PR6-D identity extraction", () => {
  it("extracts orders/create GID from admin_graphql_api_id", () => {
    expect(
      extractOrderGidFromLegacyProjection({
        id: 11,
        admin_graphql_api_id: "gid://shopify/Order/11",
      }),
    ).toBe("gid://shopify/Order/11");
  });

  it("extracts orders/delete from numeric REST id only", () => {
    expect(extractOrderGidFromDeleteProjection({ id: 99 })).toBe(
      "gid://shopify/Order/99",
    );
  });

  it("extracts orders/edited order_id from order_edit", () => {
    const identity = extractEditedOrderIdentity({
      order_edit: { id: 4, order_id: 88, committed_at: "2026-09-01T00:00:00Z" },
    });
    expect(identity.orderGid).toBe("gid://shopify/Order/88");
    expect(identity.orderEditGid).toBe("gid://shopify/OrderEdit/4");
  });

  it("extracts refund identity and enclosing order", () => {
    const identity = extractRefundIdentity({
      id: 7,
      admin_graphql_api_id: "gid://shopify/Refund/7",
      order_id: 11,
    });
    expect(identity.refundGid).toBe("gid://shopify/Refund/7");
    expect(identity.enclosingOrderGid).toBe("gid://shopify/Order/11");
  });

  it("rejects pending-like transaction status only when missing terminal status", () => {
    expect(() =>
      extractTransactionIdentity({ id: 1, order_id: 2 }),
    ).toThrow(OrderFactsIdentityError);
  });

  it("extracts terminal transaction identity", () => {
    const identity = extractTransactionIdentity({
      id: 5,
      order_id: 11,
      status: "success",
    });
    expect(identity.orderGid).toBe("gid://shopify/Order/11");
    expect(identity.status).toBe("success");
  });

  it("refuses webhook delivery ids as order identity", () => {
    expect(() =>
      assertNotWebhookDeliveryId("whsec-delivery-1", "whsec-delivery-1"),
    ).toThrow(/webhook delivery id/);
  });

  it("rejects empty delete identity", () => {
    expect(() => extractOrderGidFromDeleteProjection({})).toThrow(
      OrderFactsIdentityError,
    );
  });
});
