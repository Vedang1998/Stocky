import { describe, expect, it } from "vitest";
import { dispatchOrderFactsSchema } from "./schema-dispatch";
import { OrderFactsSchemaDispatchError } from "./errors";

describe("PR6-D persisted schema dispatch", () => {
  it("keeps frozen v1 orders/create executable (T51)", () => {
    expect(
      dispatchOrderFactsSchema({
        topic: "orders/create",
        payloadSchemaVersion: "webhook-projection-orders-create-v1",
      }),
    ).toBe("legacy_v1");
  });

  it("keeps frozen v1 refunds/create executable", () => {
    expect(
      dispatchOrderFactsSchema({
        topic: "refunds/create",
        payloadSchemaVersion: "webhook-projection-refunds-create-v1",
      }),
    ).toBe("legacy_v1");
  });

  it("dispatches new identity-only topics by persisted version", () => {
    expect(
      dispatchOrderFactsSchema({
        topic: "orders/edited",
        payloadSchemaVersion: "webhook-projection-orders-edited-v1",
      }),
    ).toBe("edited_v1");
    expect(
      dispatchOrderFactsSchema({
        topic: "orders/delete",
        payloadSchemaVersion: "webhook-projection-orders-delete-v1",
      }),
    ).toBe("delete_v1");
    expect(
      dispatchOrderFactsSchema({
        topic: "order_transactions/create",
        payloadSchemaVersion:
          "webhook-projection-order-transactions-create-v1",
      }),
    ).toBe("transaction_v1");
  });

  it("routes quarantine schema without applying a global fence", () => {
    expect(
      dispatchOrderFactsSchema({
        topic: "orders/create",
        payloadSchemaVersion: "quarantine-projection-bounds-v1",
      }),
    ).toBe("quarantine");
  });

  it("fails closed on unknown persisted versions", () => {
    expect(() =>
      dispatchOrderFactsSchema({
        topic: "orders/create",
        payloadSchemaVersion: "webhook-projection-orders-create-v2",
      }),
    ).toThrow(OrderFactsSchemaDispatchError);
  });
});
