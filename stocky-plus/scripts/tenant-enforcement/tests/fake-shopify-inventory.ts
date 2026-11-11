import type {
  AdjustBatchOutcome,
  AdjustBatchRequest,
  SendAdjustBatch,
} from "../../../app/services/inventory-writes/shopify-adjust.server";

export const item = (n: number) => `gid://shopify/InventoryItem/${n}`;
export const location = (n: number) => `gid://shopify/Location/${n}`;

export type FakeShopifyStep = (
  request: AdjustBatchRequest,
) => AdjustBatchOutcome | null;

/**
 * Stand-in for Shopify's inventory levels and idempotency-key store. It
 * honours idempotency keys and compare-and-swap the way
 * inventoryAdjustQuantities does.
 */
export class FakeShopify {
  readonly requests: AdjustBatchRequest[] = [];
  private readonly levels = new Map<string, number>();
  private readonly settled = new Map<
    string,
    { fingerprint: string; outcome: AdjustBatchOutcome }
  >();
  private readonly steps: FakeShopifyStep[] = [];
  private groups = 0;

  setLevel(itemNumber: number, quantity: number, locationNumber = 11): void {
    this.levels.set(
      `${item(itemNumber)}|${location(locationNumber)}`,
      quantity,
    );
  }

  level(itemNumber: number, locationNumber = 11): number {
    return (
      this.levels.get(`${item(itemNumber)}|${location(locationNumber)}`) ?? 0
    );
  }

  /** Runs once for the next request; returning null falls through to apply. */
  next(step: FakeShopifyStep): void {
    this.steps.push(step);
  }

  /** The next request is applied but its response never reaches the app. */
  loseNextResponse(): void {
    this.next((request) => {
      this.apply(request);
      return {
        kind: "retry",
        code: "TRANSPORT_ERROR",
        message: "socket hang up",
      };
    });
  }

  keys(): string[] {
    return this.requests.map((r) => r.idempotencyKey);
  }

  readonly send: SendAdjustBatch = async (request) => {
    this.requests.push(structuredClone(request));
    const step = this.steps.shift();
    return step?.(request) ?? this.apply(request);
  };

  apply(request: AdjustBatchRequest): AdjustBatchOutcome {
    const fingerprint = JSON.stringify([
      request.reason,
      request.quantityName,
      request.referenceDocumentUri,
      request.ledgerDocumentUri,
      request.changes,
    ]);
    const previous = this.settled.get(request.idempotencyKey);
    if (previous) {
      return previous.fingerprint === fingerprint
        ? previous.outcome
        : {
            kind: "rejected",
            errors: [
              {
                code: "IDEMPOTENCY_KEY_PARAMETER_MISMATCH",
                message:
                  "The same idempotency key cannot be used with different operation parameters.",
                changeIndex: null,
              },
            ],
          };
    }

    const stale = request.changes.flatMap((change, index) => {
      const current =
        this.levels.get(`${change.inventoryItemId}|${change.locationId}`) ?? 0;
      return change.changeFromQuantity !== null &&
        change.changeFromQuantity !== current
        ? [
            {
              code: "CHANGE_FROM_QUANTITY_STALE",
              message:
                "The changeFromQuantity argument no longer matches the persisted quantity.",
              changeIndex: index,
            },
          ]
        : [];
    });
    if (stale.length > 0) return { kind: "rejected", errors: stale };

    const changes = request.changes.map((change) => {
      const key = `${change.inventoryItemId}|${change.locationId}`;
      const after = (this.levels.get(key) ?? 0) + change.delta;
      this.levels.set(key, after);
      return {
        inventoryItemId: change.inventoryItemId,
        locationId: change.locationId,
        delta: change.delta,
        quantityAfterChange: after,
      };
    });
    this.groups += 1;
    const outcome: AdjustBatchOutcome = {
      kind: "applied",
      adjustmentGroupId: `gid://shopify/InventoryAdjustmentGroup/${this.groups}`,
      changes,
    };
    this.settled.set(request.idempotencyKey, { fingerprint, outcome });
    return outcome;
  }
}
