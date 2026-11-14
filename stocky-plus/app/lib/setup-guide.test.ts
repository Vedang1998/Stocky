import { describe, expect, it } from "vitest";
import { buildSetupGuide, type SetupFacts } from "./setup-guide";

const fresh: SetupFacts = {
  catalogSynced: false,
  locationNames: [],
  supplierCount: 0,
  purchaseOrderCount: 0,
};

function step(facts: SetupFacts, id: string) {
  const found = buildSetupGuide(facts).steps.find((s) => s.id === id);
  if (!found) throw new Error(`missing step ${id}`);
  return found;
}

describe("buildSetupGuide", () => {
  it("starts a new shop with nothing done and a way to start the sync", () => {
    const guide = buildSetupGuide(fresh);
    expect(guide.doneCount).toBe(0);
    expect(guide.complete).toBe(false);
    expect(guide.steps.map((s) => s.id)).toEqual([
      "catalog",
      "locations",
      "suppliers",
      "purchase_order",
    ]);
    expect(step(fresh, "catalog").action).toEqual({
      kind: "sync_catalog",
      label: "Sync catalog",
    });
  });

  it("marks each step done only from its own data", () => {
    const facts = { ...fresh, catalogSynced: true, supplierCount: 2 };
    const guide = buildSetupGuide(facts);
    expect(guide.steps.filter((s) => s.done).map((s) => s.id)).toEqual([
      "catalog",
      "suppliers",
    ]);
    expect(guide.doneCount).toBe(2);
    expect(step(facts, "catalog").action).toBeNull();
    expect(step(facts, "suppliers").detail).toBe("2 suppliers added.");
    expect(step(facts, "purchase_order").action).toMatchObject({
      href: "/app/purchase-orders",
    });
  });

  it("names up to three locations and counts the rest", () => {
    expect(
      step({ ...fresh, locationNames: ["Warehouse"] }, "locations").detail,
    ).toBe("1 active location: Warehouse.");
    expect(
      step(
        { ...fresh, locationNames: ["A", "B", "C", "D", "E"] },
        "locations",
      ).detail,
    ).toBe("5 active locations: A, B, C and 2 more.");
  });

  it("keeps the Shopify locations link after locations have synced", () => {
    const done = step({ ...fresh, locationNames: ["Shop"] }, "locations");
    expect(done.done).toBe(true);
    expect(done.action).toMatchObject({
      href: "shopify://admin/settings/locations",
    });
  });

  it("is complete when every step is done", () => {
    const guide = buildSetupGuide({
      catalogSynced: true,
      locationNames: ["Shop"],
      supplierCount: 1,
      purchaseOrderCount: 1,
    });
    expect(guide.complete).toBe(true);
    expect(guide.doneCount).toBe(guide.steps.length);
    expect(step({ ...fresh, purchaseOrderCount: 1 }, "purchase_order").detail).toBe(
      "1 purchase order created.",
    );
  });
});
