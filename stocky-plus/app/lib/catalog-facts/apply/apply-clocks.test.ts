import { describe, expect, it } from "vitest";
import {
  decideAttributeClock,
  intervalsOverlap,
  isNonOverlappingLater,
} from "./clocks";
import { decideExistence, encodeRevivalConfirmation, parseRevivalConfirmation } from "./existence";
import { exactMoneyText, exactMoneyTextOrNull, exactNumericEqual, assertFrozenNumericColumn, canonicalizeExactDecimalText, isExactlyRepresentableAsDecimal20_6 } from "./money";
import { CanonicalApplyMoneyError, CanonicalApplyNumericScaleError } from "./errors";
import { DIAGNOSTIC, type CanonicalFactIdentity } from "./types";
import {
  inventoryItemAttributesEqual,
  inventoryLevelAttributesEqual,
  productAttributesEqual,
  selectedOptionsSemanticallyEqual,
  variantAttributesEqual,
  type FactSnapshot,
} from "./writers";

describe("PR5-F2B clock A / nullable-version rules", () => {
  const later = { requestGen: 10n, responseGen: 12n };
  const earlier = { requestGen: 1n, responseGen: 3n };
  const overlapA = { requestGen: 4n, responseGen: 20n };
  const overlapB = { requestGen: 8n, responseGen: 15n };

  it("treats overlapping closed intervals as overlap", () => {
    expect(intervalsOverlap(overlapA, overlapB)).toBe(true);
    expect(intervalsOverlap(earlier, later)).toBe(false);
    expect(isNonOverlappingLater(later, earlier)).toBe(true);
  });

  it("applies newer Shopify updatedAt and no-ops stale / equal matching attributes", () => {
    const newer = decideAttributeClock({
      incomingUpdatedAt: new Date("2026-08-02T00:00:00.000Z"),
      storedUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      incomingInterval: later,
      storedInterval: earlier,
      attributesEqual: false,
    });
    expect(newer.apply).toBe(true);
    expect(newer.reason).toBe("newer_shopify");

    const stale = decideAttributeClock({
      incomingUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      storedUpdatedAt: new Date("2026-08-02T00:00:00.000Z"),
      incomingInterval: later,
      storedInterval: earlier,
      attributesEqual: false,
    });
    expect(stale.apply).toBe(false);
    expect(stale.reason).toBe("stale_shopify");

    const equal = decideAttributeClock({
      incomingUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      storedUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      incomingInterval: later,
      storedInterval: earlier,
      attributesEqual: true,
    });
    expect(equal.apply).toBe(false);
    expect(equal.reason).toBe("equal_match");
  });

  it("records EQUAL_VERSION_CONFLICT when equal updatedAt payloads differ", () => {
    const decision = decideAttributeClock({
      incomingUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      storedUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      incomingInterval: later,
      storedInterval: earlier,
      attributesEqual: false,
    });
    expect(decision.apply).toBe(false);
    expect(decision.diagnostic).toBe("EQUAL_VERSION_CONFLICT");
  });

  it("lets Shopify updatedAt outrank a stored null-version fact", () => {
    const decision = decideAttributeClock({
      incomingUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      storedUpdatedAt: null,
      incomingInterval: later,
      storedInterval: earlier,
      attributesEqual: false,
    });
    expect(decision.apply).toBe(true);
    expect(decision.reason).toBe("incoming_shopify_outranks_null");
  });

  it("does not let a null-version observation overwrite a versioned fact", () => {
    const decision = decideAttributeClock({
      incomingUpdatedAt: null,
      storedUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      incomingInterval: later,
      storedInterval: earlier,
      attributesEqual: false,
    });
    expect(decision.apply).toBe(false);
    expect(decision.diagnostic).toBe("CATALOG_NULL_VERSION_OBSERVATION");
    expect(decision.freshness).toBe("DEGRADED");
    expect(decision.reason).toBe("incoming_null_stored_versioned");
  });

  it("applies a later non-overlapping null-version observation and forbids LWW on overlap conflict", () => {
    const laterNull = decideAttributeClock({
      incomingUpdatedAt: null,
      storedUpdatedAt: null,
      incomingInterval: later,
      storedInterval: earlier,
      attributesEqual: false,
    });
    expect(laterNull.apply).toBe(true);
    expect(laterNull.freshness).toBe("DEGRADED");

    const conflict = decideAttributeClock({
      incomingUpdatedAt: null,
      storedUpdatedAt: null,
      incomingInterval: overlapA,
      storedInterval: overlapB,
      attributesEqual: false,
    });
    expect(conflict.apply).toBe(false);
    expect(conflict.diagnostic).toBe("CONCURRENT_ATTRIBUTE_OBSERVATION_CONFLICT");
    expect(conflict.freshness).toBe("DEGRADED");
  });

  it("treats overlapping identical null-version payloads as idempotent convergence", () => {
    const decision = decideAttributeClock({
      incomingUpdatedAt: null,
      storedUpdatedAt: null,
      incomingInterval: overlapA,
      storedInterval: overlapB,
      attributesEqual: true,
    });
    expect(decision.apply).toBe(false);
    expect(decision.diagnostic).toBeNull();
    expect(decision.reason).toBe("null_overlap_identical");
  });
});

describe("PR5-F2B existence / revival", () => {
  const identity = {
    shopId: "shop",
    resourceKind: "Product" as const,
    shopifyGid: "gid://shopify/Product/1",
  };
  const level = {
    shopId: "shop",
    resourceKind: "InventoryLevel" as const,
    inventoryItemGid: "gid://shopify/InventoryItem/1",
    locationGid: "gid://shopify/Location/1",
  };

  it("first-inserts LIVE and preserves no row for unseen ABSENT", () => {
    const live = decideExistence({
      identity,
      stored: null,
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 1n, responseGen: 2n },
      existenceBlocked: false,
      overlappingCompleted: [],
    });
    expect(live.mutate).toBe(true);
    if (live.mutate) expect(live.nextState).toBe("LIVE");

    const absent = decideExistence({
      identity,
      stored: null,
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: { requestGen: 1n, responseGen: 2n },
      existenceBlocked: false,
      overlappingCompleted: [],
    });
    expect(absent.mutate).toBe(false);
    expect(absent.reason).toBe("first_insert_absent_preserve_no_row");
  });

  it("preserves no canonical row for unseen ABSENT on every resource kind", () => {
    const kinds: CanonicalFactIdentity[] = [
      identity,
      {
        shopId: "shop",
        resourceKind: "ProductVariant",
        shopifyGid: "gid://shopify/ProductVariant/1",
      },
      {
        shopId: "shop",
        resourceKind: "InventoryItem",
        shopifyGid: "gid://shopify/InventoryItem/1",
      },
      {
        shopId: "shop",
        resourceKind: "Location",
        shopifyGid: "gid://shopify/Location/1",
      },
      level,
    ];
    for (const resource of kinds) {
      const absent = decideExistence({
        identity: resource,
        stored: null,
        incomingKind: "ABSENT_CONFIRMED_QUERY",
        incomingInterval: { requestGen: 1n, responseGen: 2n },
        existenceBlocked: false,
        overlappingCompleted: [],
      });
      expect(absent.mutate, resource.resourceKind).toBe(false);
      expect(absent.reason).toBe("first_insert_absent_preserve_no_row");
    }
  });

  it("fails closed on first insert when a completed overlapping observation left no row", () => {
    const live = decideExistence({
      identity,
      stored: null,
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 1n, responseGen: 2n },
      existenceBlocked: false,
      overlappingCompleted: [{ requestGen: 1n, responseGen: 3n }],
    });
    expect(live.mutate).toBe(false);
    expect(live.reason).toBe("first_insert_overlapping_completed");
    expect(live.diagnostic).toBe(DIAGNOSTIC.CONCURRENT_EXISTENCE);

    const absentOverlap = decideExistence({
      identity,
      stored: null,
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: { requestGen: 1n, responseGen: 2n },
      existenceBlocked: false,
      overlappingCompleted: [{ requestGen: 1n, responseGen: 3n }],
    });
    expect(absentOverlap.mutate).toBe(false);
    expect(absentOverlap.reason).toBe("first_insert_overlapping_completed");
    expect(absentOverlap.diagnostic).toBe(DIAGNOSTIC.CONCURRENT_EXISTENCE);
  });

  it("allows first LIVE insert only when the incoming interval does not overlap completed evidence", () => {
    const later = decideExistence({
      identity,
      stored: null,
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 10n, responseGen: 11n },
      existenceBlocked: false,
      overlappingCompleted: [{ requestGen: 1n, responseGen: 3n }],
    });
    expect(later.mutate).toBe(true);
    if (later.mutate) {
      expect(later.nextState).toBe("LIVE");
      expect(later.reason).toBe("first_insert_live");
    }
  });

  it("blocks existence mutation while an ACTIVE unexpired blocker remains", () => {
    const decision = decideExistence({
      identity,
      stored: null,
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 5n, responseGen: 6n },
      existenceBlocked: true,
      overlappingCompleted: [],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.reason).toBe("active_blocker");
  });

  it("preserves last unambiguous existence on overlapping LIVE vs ABSENT", () => {
    const decision = decideExistence({
      identity,
      stored: {
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceRequestGen: 3n,
        existenceResponseGen: 10n,
        shopifyCreatedAt: null,
        existenceDiagnosticState: null,
      },
      incomingKind: "ABSENT_CONFIRMED_QUERY",
      incomingInterval: { requestGen: 4n, responseGen: 12n },
      existenceBlocked: false,
      overlappingCompleted: [],
    });
    expect(decision.mutate).toBe(false);
    expect(decision.diagnostic).toBe(DIAGNOSTIC.CONCURRENT_EXISTENCE);
  });

  it("opens terminal revival on the first LIVE confirmation and rejects overlapping seconds", () => {
    const tombstone = {
      existenceState: "ABSENT" as const,
      existenceKind: "ABSENT_CONFIRMED_QUERY",
      existenceRequestGen: 1n,
      existenceResponseGen: 2n,
      shopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      existenceDiagnosticState: null,
    };
    const first = decideExistence({
      identity,
      stored: tombstone,
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 3n, responseGen: 4n },
      incomingShopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      existenceBlocked: false,
      overlappingCompleted: [],
    });
    expect(first.mutate).toBe(false);
    expect(first.reason).toBe("terminal_first_confirmation");
    const encoded = first.diagnostic ?? "";
    expect(parseRevivalConfirmation(encoded)?.requestGen).toBe(3n);

    const overlapSecond = decideExistence({
      identity,
      stored: { ...tombstone, existenceDiagnosticState: encoded },
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 4n, responseGen: 6n },
      incomingShopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      existenceBlocked: false,
      overlappingCompleted: [{ requestGen: 3n, responseGen: 4n }],
    });
    expect(overlapSecond.mutate).toBe(false);
    expect(overlapSecond.reason).toBe("terminal_overlapping_confirmations");

    const validSecond = decideExistence({
      identity,
      stored: { ...tombstone, existenceDiagnosticState: encoded },
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 5n, responseGen: 6n },
      incomingShopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      existenceBlocked: false,
      overlappingCompleted: [],
    });
    expect(validSecond.mutate).toBe(true);
    if (validSecond.mutate) expect(validSecond.reason).toBe("terminal_revival");
  });

  it("reconnects InventoryLevel without terminal revival", () => {
    const decision = decideExistence({
      identity: level,
      stored: {
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        existenceRequestGen: 1n,
        existenceResponseGen: 2n,
        shopifyCreatedAt: null,
        existenceDiagnosticState: null,
      },
      incomingKind: "LIVE_REFETCH",
      incomingInterval: { requestGen: 3n, responseGen: 4n },
      existenceBlocked: false,
      overlappingCompleted: [],
    });
    expect(decision.mutate).toBe(true);
    if (decision.mutate) expect(decision.reason).toBe("level_reconnect");
  });

  it("encodes revival confirmation without Number conversion", () => {
    const encoded = encodeRevivalConfirmation({ requestGen: 10n, responseGen: 11n });
    expect(encoded.startsWith(DIAGNOSTIC.TERMINAL_REVIVAL)).toBe(true);
    expect(parseRevivalConfirmation(encoded)).toEqual({
      requestGen: 10n,
      responseGen: 11n,
    });
  });

  it("does not treat a full-sync fence as a direct [F,F] existence interval", () => {
    const laterDirect = [{ requestGen: 20n, responseGen: 21n }];
    const spanningDirect = [{ requestGen: 5n, responseGen: 15n }];
    const earlierDirect = [{ requestGen: 1n, responseGen: 3n }];

    const laterConflict = decideExistence({
      identity,
      stored: null,
      incomingKind: "LIVE_FULL_SYNC_PRESENT",
      incomingInterval: { requestGen: 10n, responseGen: 10n },
      existenceBlocked: false,
      overlappingCompleted: [],
      fenceGeneration: 10n,
      completedDirectNotSafelyEarlierThanFence: laterDirect,
    });
    expect(laterConflict.mutate).toBe(false);
    expect(laterConflict.reason).toBe("full_sync_first_insert_direct_conflict");
    expect(laterConflict.diagnostic).toBe(DIAGNOSTIC.CONCURRENT_EXISTENCE);

    const spanningConflict = decideExistence({
      identity,
      stored: null,
      incomingKind: "LIVE_FULL_SYNC_PRESENT",
      incomingInterval: { requestGen: 10n, responseGen: 10n },
      existenceBlocked: false,
      overlappingCompleted: [],
      fenceGeneration: 10n,
      completedDirectNotSafelyEarlierThanFence: spanningDirect,
    });
    expect(spanningConflict.mutate).toBe(false);
    expect(spanningConflict.reason).toBe("full_sync_first_insert_direct_conflict");

    const earlierOk = decideExistence({
      identity,
      stored: null,
      incomingKind: "LIVE_FULL_SYNC_PRESENT",
      incomingInterval: null,
      existenceBlocked: false,
      overlappingCompleted: earlierDirect,
      fenceGeneration: 10n,
      completedDirectNotSafelyEarlierThanFence: [],
    });
    expect(earlierOk.mutate).toBe(true);
    if (earlierOk.mutate) {
      expect(earlierOk.nextKind).toBe("LIVE_FULL_SYNC_PRESENT");
      expect(earlierOk.reason).toBe("first_insert_live");
    }
  });

  it("keeps existing LIVE presence-only and still blocks reconnect on newer direct evidence", () => {
    const keepLive = decideExistence({
      identity,
      stored: {
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceRequestGen: 20n,
        existenceResponseGen: 21n,
        shopifyCreatedAt: null,
        existenceDiagnosticState: null,
      },
      incomingKind: "LIVE_FULL_SYNC_PRESENT",
      incomingInterval: null,
      existenceBlocked: false,
      overlappingCompleted: [],
      fenceGeneration: 10n,
      completedDirectNotSafelyEarlierThanFence: [{ requestGen: 20n, responseGen: 21n }],
    });
    expect(keepLive.mutate).toBe(false);
    expect(keepLive.reason).toBe("presence_keep_live");

    const reconnectBlocked = decideExistence({
      identity: level,
      stored: {
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        existenceRequestGen: 1n,
        existenceResponseGen: 2n,
        shopifyCreatedAt: null,
        existenceDiagnosticState: null,
      },
      incomingKind: "LIVE_FULL_SYNC_PRESENT",
      incomingInterval: null,
      existenceBlocked: false,
      overlappingCompleted: [],
      fenceGeneration: 10n,
      completedDirectNotSafelyEarlierThanFence: [{ requestGen: 20n, responseGen: 21n }],
    });
    expect(reconnectBlocked.mutate).toBe(false);
    expect(reconnectBlocked.reason).toBe("full_sync_reconnect_direct_conflict");

    const reconnectOk = decideExistence({
      identity: level,
      stored: {
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        existenceRequestGen: 1n,
        existenceResponseGen: 2n,
        shopifyCreatedAt: null,
        existenceDiagnosticState: null,
      },
      incomingKind: "LIVE_FULL_SYNC_PRESENT",
      incomingInterval: null,
      existenceBlocked: false,
      overlappingCompleted: [],
      fenceGeneration: 10n,
      completedDirectNotSafelyEarlierThanFence: [],
    });
    expect(reconnectOk.mutate).toBe(true);
    if (reconnectOk.mutate) expect(reconnectOk.reason).toBe("level_reconnect_full_sync");

    const terminalBulk = decideExistence({
      identity,
      stored: {
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        existenceRequestGen: 1n,
        existenceResponseGen: 2n,
        shopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
        existenceDiagnosticState: null,
      },
      incomingKind: "LIVE_FULL_SYNC_PRESENT",
      incomingInterval: null,
      existenceBlocked: false,
      overlappingCompleted: [],
      fenceGeneration: 10n,
      completedDirectNotSafelyEarlierThanFence: [],
    });
    expect(terminalBulk.mutate).toBe(false);
    expect(terminalBulk.reason).toBe("terminal_bulk_revival_conflict");
    expect(terminalBulk.diagnostic).toBe(DIAGNOSTIC.TERMINAL_REVIVAL);
  });
});

describe("PR5-F2B exact money", () => {
  it("accepts decimal text and Decimal-like toFixed values", () => {
    expect(exactMoneyText("19.990000", "priceAmount")).toBe("19.990000");
    expect(exactMoneyText({ toFixed: () => "1.50" }, "priceAmount")).toBe("1.50");
    expect(exactMoneyTextOrNull(null, "unitCostAmount")).toBeNull();
  });

  it("rejects Number / parseFloat / non-decimal inputs", () => {
    expect(() => exactMoneyText(19.99, "priceAmount")).toThrow(CanonicalApplyMoneyError);
    expect(() => exactMoneyText("1e2", "priceAmount")).toThrow(CanonicalApplyMoneyError);
    expect(() => exactMoneyText("not-a-decimal", "priceAmount")).toThrow(
      CanonicalApplyMoneyError,
    );
  });

  it("treats scale-equivalent NUMERIC text as equal and null as distinct", () => {
    expect(exactNumericEqual("19.99", "19.990000", "priceAmount")).toBe(true);
    expect(exactNumericEqual("0.1", "0.100000", "priceAmount")).toBe(true);
    expect(exactNumericEqual("12.5", "12.50", "compareAtPriceAmount")).toBe(true);
    expect(exactNumericEqual("12.5", "12.500000", "unitCostAmount")).toBe(true);
    expect(exactNumericEqual("1.250000", "1.25", "weightValue")).toBe(true);
    expect(exactNumericEqual(null, null, "priceAmount")).toBe(true);
    expect(exactNumericEqual(null, "19.99", "priceAmount")).toBe(false);
    expect(exactNumericEqual("19.99", null, "priceAmount")).toBe(false);
    expect(exactNumericEqual("19.99", "19.98", "priceAmount")).toBe(false);
    expect(exactNumericEqual("0", "-0", "priceAmount")).toBe(true);
    expect(exactNumericEqual("0.0", "-0.000000", "priceAmount")).toBe(true);
    expect(exactNumericEqual("-1.50", "-1.500000", "priceAmount")).toBe(true);
    expect(exactNumericEqual("-1.50", "1.50", "priceAmount")).toBe(false);
    expect(canonicalizeExactDecimalText("19.990000")).toBe("19.99");
  });

  it("fail-closes significant precision beyond DECIMAL(20,6) and accepts exact scale", () => {
    expect(isExactlyRepresentableAsDecimal20_6("19.123456")).toBe(true);
    expect(isExactlyRepresentableAsDecimal20_6("0.000001")).toBe(true);
    expect(isExactlyRepresentableAsDecimal20_6("19.123456000")).toBe(true);
    expect(isExactlyRepresentableAsDecimal20_6("19.1234567")).toBe(false);
    expect(isExactlyRepresentableAsDecimal20_6("0.0000001")).toBe(false);
    expect(assertFrozenNumericColumn("19.9900000", "priceAmount")).toBe("19.9900000");
    expect(() => assertFrozenNumericColumn("19.9900001", "priceAmount")).toThrow(
      CanonicalApplyNumericScaleError,
    );
    expect(() => exactMoneyText(0.1, "priceAmount")).toThrow(CanonicalApplyMoneyError);
  });
});

describe("PR5-F2B relationship identity is part of attribute equality", () => {
  function snapshot(overrides: Partial<FactSnapshot>): FactSnapshot {
    return {
      id: "cfa_test",
      existenceState: "LIVE",
      existenceKind: "LIVE_REFETCH",
      existenceRequestGen: 1n,
      existenceResponseGen: 2n,
      existenceDiagnosticState: null,
      shopifyCreatedAt: null,
      shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      attributeRequestGen: 1n,
      attributeResponseGen: 2n,
      attributeFreshnessState: "ORDERED",
      lastSeenFullSyncRunId: null,
      title: "V",
      selectedOptions: [{ name: "Title", value: "Default Title" }],
      priceAmount: "10.000000",
      compareAtPriceAmount: null,
      currencyCode: "USD",
      displayName: null,
      sku: null,
      barcode: null,
      position: null,
      shopifyProductGid: "gid://shopify/Product/parent-a",
      shopifyVariantGid: "gid://shopify/ProductVariant/v-a",
      tracked: true,
      requiresShipping: true,
      unitCostAccess: "NULL",
      quantities: {},
      ...overrides,
    };
  }

  it("treats ProductVariant rows with a different shopifyProductGid as not equal", () => {
    const stored = snapshot({});
    const sameParent = variantAttributesEqual(stored, {
      shopifyProductGid: "gid://shopify/Product/parent-a",
      title: "V",
      displayName: null,
      selectedOptions: [{ name: "Title", value: "Default Title" }],
      sku: null,
      barcode: null,
      priceAmount: "10.000000",
      compareAtPriceAmount: null,
      currencyCode: "USD",
      position: null,
    });
    const otherParent = variantAttributesEqual(stored, {
      shopifyProductGid: "gid://shopify/Product/parent-b",
      title: "V",
      displayName: null,
      selectedOptions: [{ name: "Title", value: "Default Title" }],
      sku: null,
      barcode: null,
      priceAmount: "10.000000",
      compareAtPriceAmount: null,
      currencyCode: "USD",
      position: null,
    });
    expect(sameParent).toBe(true);
    expect(otherParent).toBe(false);

    const scaleEquivalent = variantAttributesEqual(stored, {
      shopifyProductGid: "gid://shopify/Product/parent-a",
      title: "V",
      displayName: null,
      selectedOptions: [{ name: "Title", value: "Default Title" }],
      sku: null,
      barcode: null,
      priceAmount: "10",
      compareAtPriceAmount: null,
      currencyCode: "USD",
      position: null,
    });
    expect(scaleEquivalent).toBe(true);
  });

  it("treats InventoryItem rows with a different shopifyVariantGid as not equal", () => {
    const stored = snapshot({});
    const sameVariant = inventoryItemAttributesEqual(stored, {
      shopifyVariantGid: "gid://shopify/ProductVariant/v-a",
      sku: null,
      tracked: true,
      requiresShipping: true,
      weightValue: null,
      weightUnit: null,
      unitCostAmount: null,
      unitCostCurrencyCode: null,
      unitCostAccess: "NULL",
    });
    const otherVariant = inventoryItemAttributesEqual(stored, {
      shopifyVariantGid: "gid://shopify/ProductVariant/v-b",
      sku: null,
      tracked: true,
      requiresShipping: true,
      weightValue: null,
      weightUnit: null,
      unitCostAmount: null,
      unitCostCurrencyCode: null,
      unitCostAccess: "NULL",
    });
    expect(sameVariant).toBe(true);
    expect(otherVariant).toBe(false);

    const scaleEquivalent = inventoryItemAttributesEqual(
      snapshot({ weightValue: "1.250000", unitCostAmount: "3.100000" }),
      {
        shopifyVariantGid: "gid://shopify/ProductVariant/v-a",
        sku: null,
        tracked: true,
        requiresShipping: true,
        weightValue: "1.25",
        weightUnit: null,
        unitCostAmount: "3.10",
        unitCostCurrencyCode: null,
        unitCostAccess: "NULL",
      },
    );
    expect(scaleEquivalent).toBe(true);
  });
});

describe("PR5-F2B semantic attribute equality", () => {
  it("treats reordered Product tags as equal without silently deduplicating", () => {
    const stored: FactSnapshot = {
      id: "cfa_tags",
      existenceState: "LIVE",
      existenceKind: "LIVE_REFETCH",
      existenceRequestGen: 1n,
      existenceResponseGen: 2n,
      existenceDiagnosticState: null,
      shopifyCreatedAt: null,
      shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      attributeRequestGen: 1n,
      attributeResponseGen: 2n,
      attributeFreshnessState: "ORDERED",
      lastSeenFullSyncRunId: null,
      title: "T",
      handle: "h",
      vendor: null,
      productType: null,
      tags: ["beta", "alpha", "alpha"],
      status: "ACTIVE",
      featuredMediaUrl: null,
      quantities: {},
    };
    const reordered = productAttributesEqual(stored, {
      title: "T",
      handle: "h",
      vendor: null,
      productType: null,
      tags: ["alpha", "beta", "alpha"],
      status: "ACTIVE",
      featuredMediaUrl: null,
    });
    const droppedDuplicate = productAttributesEqual(stored, {
      title: "T",
      handle: "h",
      vendor: null,
      productType: null,
      tags: ["alpha", "beta"],
      status: "ACTIVE",
      featuredMediaUrl: null,
    });
    expect(reordered).toBe(true);
    expect(droppedDuplicate).toBe(false);
    const equalVersion = decideAttributeClock({
      incomingUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      storedUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      incomingInterval: { requestGen: 10n, responseGen: 12n },
      storedInterval: { requestGen: 1n, responseGen: 2n },
      attributesEqual: reordered,
    });
    expect(equalVersion.apply).toBe(false);
    expect(equalVersion.reason).toBe("equal_match");
    expect(equalVersion.diagnostic).toBeNull();
  });

  it("treats selectedOptions object key order as irrelevant while preserving array order", () => {
    const stored = [{ value: "M", name: "Size" }, { value: "Blue", name: "Color" }];
    const reorderedKeys = [{ name: "Size", value: "M" }, { name: "Color", value: "Blue" }];
    const reorderedArray = [{ name: "Color", value: "Blue" }, { name: "Size", value: "M" }];
    expect(selectedOptionsSemanticallyEqual(stored, reorderedKeys)).toBe(true);
    expect(selectedOptionsSemanticallyEqual(stored, reorderedArray)).toBe(false);

    const snapshot: FactSnapshot = {
      id: "cfa_opts",
      existenceState: "LIVE",
      existenceKind: "LIVE_REFETCH",
      existenceRequestGen: 1n,
      existenceResponseGen: 2n,
      existenceDiagnosticState: null,
      shopifyCreatedAt: null,
      shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      attributeRequestGen: 1n,
      attributeResponseGen: 2n,
      attributeFreshnessState: "ORDERED",
      lastSeenFullSyncRunId: null,
      title: "V",
      selectedOptions: stored,
      priceAmount: "10.000000",
      compareAtPriceAmount: null,
      currencyCode: "USD",
      displayName: null,
      sku: null,
      barcode: null,
      position: null,
      shopifyProductGid: "gid://shopify/Product/parent-a",
      quantities: {},
    };
    expect(
      variantAttributesEqual(snapshot, {
        shopifyProductGid: "gid://shopify/Product/parent-a",
        title: "V",
        displayName: null,
        selectedOptions: reorderedKeys,
        sku: null,
        barcode: null,
        priceAmount: "10.000000",
        compareAtPriceAmount: null,
        currencyCode: "USD",
        position: null,
      }),
    ).toBe(true);
  });

  it("compares InventoryLevel resource attributes independently of quantities", () => {
    const stored: FactSnapshot = {
      id: "cfa_lvl",
      existenceState: "LIVE",
      existenceKind: "LIVE_REFETCH",
      existenceRequestGen: 1n,
      existenceResponseGen: 2n,
      existenceDiagnosticState: null,
      shopifyCreatedAt: null,
      shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
      attributeRequestGen: 1n,
      attributeResponseGen: 2n,
      attributeFreshnessState: "ORDERED",
      lastSeenFullSyncRunId: null,
      isActive: true,
      shopifyInventoryLevelGid: "gid://shopify/InventoryLevel/1",
      quantities: {},
    };
    expect(
      inventoryLevelAttributesEqual(stored, {
        isActive: true,
        shopifyInventoryLevelGid: "gid://shopify/InventoryLevel/1",
        quantities: [{ name: "available", quantity: 9, shopifyUpdatedAt: null }],
      }),
    ).toBe(true);
    expect(
      inventoryLevelAttributesEqual(stored, {
        isActive: false,
        shopifyInventoryLevelGid: "gid://shopify/InventoryLevel/1",
      }),
    ).toBe(false);
  });
});
