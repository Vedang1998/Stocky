/**
 * Manual inventory adjustments against the inventory ledger — disposable
 * PostgreSQL 16 with RLS applied, and the in-memory Shopify double from the
 * ledger suite.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  ADJUSTMENT_SOURCE_TYPE,
  listAdjustments,
  listAdjustmentsForExport,
  resumeAdjustment,
  reverseAdjustment,
  submitAdjustment,
  type AdjustmentOptions,
  type AdjustmentResult,
  type SubmitAdjustmentInput,
} from "../../../app/services/adjustments/adjustment.server";
import type { ReadAvailableQuantities } from "../../../app/services/inventory-writes/shopify-levels.server";
import type { InventoryActor } from "../../../app/services/inventory-writes/types";
import { resolveAuthorityAfterVerifiedAuth } from "../../../app/tenant/bootstrap.server";
import {
  createTenantDb,
  type TenantDb,
} from "../../../app/tenant/tenant-db.server";
import { FakeShopify, item, location } from "./fake-shopify-inventory";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  completeInventoryItemData,
  completeLocationData,
} from "./pr5-f3-test-helpers";

const SHOP_A = "adjustments-a.myshopify.com";
const SHOP_B = "adjustments-b.myshopify.com";

const variant = (n: number) => `gid://shopify/ProductVariant/${n}`;
const RED = variant(1);
const WHITE = variant(2);
const OTHER_SHOPS = variant(9);

const SHELF = location(11);
const INACTIVE = location(13);
const OTHER_SHOPS_LOCATION = location(21);

const STAFF: InventoryActor = {
  shopifyUserId: "42",
  displayName: null,
  channel: "ADMIN",
};
const MANAGER: InventoryActor = { ...STAFF, shopifyUserId: "77" };

type Failure = Extract<AdjustmentResult, { ok: false }>;

describe("inventory adjustments on the inventory ledger", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let dbB: TenantDb;
  let shopify: FakeShopify;
  /** Inventory items Shopify does not stock at the location being read. */
  let notStocked: Set<string>;
  let liveReads: number;

  const readAvailable: ReadAvailableQuantities = async (
    locationId,
    inventoryItemIds,
  ) => {
    liveReads += 1;
    const locationNumber = Number(locationId.split("/").pop());
    return new Map(
      inventoryItemIds.map((id) => [
        id,
        notStocked.has(id)
          ? null
          : shopify.level(Number(id.split("/").pop()), locationNumber),
      ]),
    );
  };

  const enabled = (extra: Partial<AdjustmentOptions> = {}): AdjustmentOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => true,
    readAvailable,
    ...extra,
  });
  const switchedOff = (): AdjustmentOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => false,
    readAvailable,
  });

  const input = (
    linesText: string,
    extra: Partial<SubmitAdjustmentInput> = {},
  ): SubmitAdjustmentInput => ({
    submissionId: randomUUID(),
    locationId: SHELF,
    reason: "damaged",
    mode: "ADJUST",
    note: null,
    linesText,
    ...extra,
  });

  const submit = (
    linesText: string,
    extra: Partial<SubmitAdjustmentInput> = {},
    options: AdjustmentOptions = enabled(),
  ) => submitAdjustment(dbA, null, STAFF, input(linesText, extra), options);

  function failed(result: AdjustmentResult): Failure {
    if (result.ok) throw new Error("expected the adjustment to be refused");
    return result;
  }

  function applied(result: AdjustmentResult): string {
    if (!result.ok) throw new Error(`expected success, got: ${result.error}`);
    if (!result.operationId) throw new Error("expected a recorded adjustment");
    return result.operationId;
  }

  /** Shopify refuses the change at `index` of the next request and applies nothing. */
  function rejectNextChangeAt(index: number) {
    shopify.next(() => ({
      kind: "rejected",
      errors: [
        {
          code: "ITEM_NOT_STOCKED_AT_LOCATION",
          message: "The item is not stocked at the location.",
          changeIndex: index,
        },
      ],
    }));
  }

  const operations = () =>
    prisma.inventoryOperation.findMany({
      orderBy: { createdAt: "asc" },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });

  const levels = () => ({
    red: shopify.level(101),
    white: shopify.level(102),
  });

  /** Distinct `createdAt` values, so "newest first" is unambiguous. */
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const [shopA, shopB] = await Promise.all([
      prisma.shop.create({
        data: { myshopifyDomain: SHOP_A, processingEnabled: true },
      }),
      prisma.shop.create({
        data: { myshopifyDomain: SHOP_B, processingEnabled: true },
      }),
    ]);

    await prisma.shopifyLocationFact.createMany({
      data: [
        completeLocationData({ id: "11", shopId: shopA.id }),
        {
          ...completeLocationData({ id: "13", shopId: shopA.id }),
          isActive: false,
        },
        completeLocationData({ id: "21", shopId: shopB.id }),
      ],
    });
    await prisma.shopifyInventoryItemFact.createMany({
      data: [
        ...[101, 102, 103, 104].map((n) => ({
          ...completeInventoryItemData({ id: String(n), shopId: shopA.id }),
          shopifyVariantGid: null,
        })),
        {
          ...completeInventoryItemData({ id: "201", shopId: shopB.id }),
          shopifyVariantGid: null,
        },
      ],
    });
    await prisma.shopifyVariantCache.createMany({
      data: [
        {
          id: RED,
          title: "Red wine",
          sku: "RED-75",
          barcode: "0000000000017",
          inventoryItemId: item(101),
        },
        {
          id: WHITE,
          title: "White wine",
          sku: "WHT-75",
          barcode: "0000000000024",
          inventoryItemId: item(102),
        },
        {
          id: variant(3),
          title: "Rosé 75cl",
          sku: "ROSE",
          barcode: null,
          inventoryItemId: item(103),
        },
        {
          id: variant(4),
          title: "Rosé magnum",
          sku: "ROSE",
          barcode: null,
          inventoryItemId: item(104),
        },
        {
          id: variant(5),
          title: "Unlinked gin",
          sku: "GIN-70",
          barcode: null,
          inventoryItemId: null,
        },
      ].map((v) => ({
        shop: SHOP_A,
        shopId: shopA.id,
        shopifyVariantId: v.id,
        title: v.title,
        sku: v.sku,
        barcode: v.barcode,
        inventoryItemId: v.inventoryItemId,
      })),
    });
    // The other shop sells something under a SKU this shop also uses.
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_B,
        shopId: shopB.id,
        shopifyVariantId: OTHER_SHOPS,
        title: "Other shop's whisky",
        sku: "RED-75",
        barcode: "0000000000093",
        inventoryItemId: item(201),
      },
    });

    const authority = async (domain: string) =>
      (
        await resolveAuthorityAfterVerifiedAuth({
          verifiedDomain: domain,
          source: "verified_admin_request",
          correlationId: "adjustments-test",
          createIfMissing: false,
        })
      ).tenant;
    dbA = createTenantDb(await authority(SHOP_A));
    dbB = createTenantDb(await authority(SHOP_B));
  }, 180_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "InventoryOperationLine", "InventoryOperation" CASCADE`,
    );
    shopify = new FakeShopify();
    shopify.setLevel(101, 10, 11);
    shopify.setLevel(102, 20, 11);
    notStocked = new Set();
    liveReads = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("changing quantities by an amount", () => {
    it("applies each signed change once and records the reason, the staff member and the note", async () => {
      const submissionId = randomUUID();

      const result = await submit(
        "RED-75, -3\n0000000000024, 4",
        { submissionId, note: "  Dropped a case  " },
      );

      expect(result).toMatchObject({
        ok: true,
        changedLineCount: 2,
        alreadySubmitted: false,
      });
      expect(levels()).toEqual({ red: 7, white: 24 });
      expect(liveReads).toBe(0);

      const [operation, ...rest] = await operations();
      expect(rest).toEqual([]);
      expect(operation).toMatchObject({
        id: applied(result),
        kind: "ADJUSTMENT",
        status: "APPLIED",
        reason: "damaged",
        quantityName: "available",
        sourceType: ADJUSTMENT_SOURCE_TYPE,
        sourceId: submissionId,
        idempotencyKey: `adjustment:${submissionId}`,
        referenceDocumentUri: `gid://propo/InventoryAdjustment/${submissionId}`,
        actorShopifyUserId: "42",
        actorChannel: "ADMIN",
        note: "Dropped a case",
      });
      expect(
        operation.lines.map((l) => [
          l.inventoryItemGid,
          l.variantGid,
          l.locationGid,
          l.delta,
          l.changeFromQuantity,
          l.status,
          l.quantityAfterChange,
        ]),
      ).toEqual([
        [item(101), RED, SHELF, -3, null, "APPLIED", 7],
        [item(102), WHITE, SHELF, 4, null, "APPLIED", 24],
      ]);
      expect(shopify.requests[0]).toMatchObject({ reason: "damaged" });
    });

    it("finds an item by SKU, by barcode or by its Shopify variant ID", async () => {
      for (const code of ["RED-75", "0000000000017", RED]) {
        expect((await submit(`${code}, 1`)).ok).toBe(true);
      }
      expect(shopify.level(101)).toBe(13);
    });

    it("sends nothing more when the same form is submitted again", async () => {
      const again = input("RED-75, -3");
      await submitAdjustment(dbA, null, STAFF, again, enabled());

      const second = await submitAdjustment(dbA, null, STAFF, again, enabled());

      expect(second).toMatchObject({ ok: true, alreadySubmitted: true });
      expect(shopify.level(101)).toBe(7);
      expect(shopify.requests).toHaveLength(1);
      expect(await operations()).toHaveLength(1);
    });

    it("keeps the first adjustment when the same form comes back with other lines", async () => {
      const submissionId = randomUUID();
      await submit("RED-75, -3", { submissionId });

      const edited = await submit("RED-75, -9\nWHT-75, -9", { submissionId });

      expect(edited).toMatchObject({ ok: true, alreadySubmitted: true });
      expect(levels()).toEqual({ red: 7, white: 20 });
      expect(await operations()).toHaveLength(1);
    });

    it("sends one request when the form is submitted twice at once", async () => {
      const twice = input("RED-75, -3\nWHT-75, 2");

      const results = await Promise.all([
        submitAdjustment(dbA, null, STAFF, twice, enabled()),
        submitAdjustment(dbA, null, STAFF, twice, enabled()),
      ]);

      expect(levels()).toEqual({ red: 7, white: 22 });
      expect(new Set(shopify.keys()).size).toBe(1);
      expect(await operations()).toHaveLength(1);
      // The slower request may find the other still talking to Shopify; it
      // must then say so instead of claiming success or failure of its own.
      for (const result of results) {
        if (!result.ok) expect(result.unfinishedOperationId).not.toBeNull();
      }
      expect(results.some((r) => r.ok)).toBe(true);
    });

    it("treats a new form as a new adjustment", async () => {
      await submit("RED-75, -3");
      await submit("RED-75, -3");

      expect(shopify.level(101)).toBe(4);
      expect(await operations()).toHaveLength(2);
    });
  });

  describe("input that is refused before anything is recorded", () => {
    async function expectNothingRecorded(result: AdjustmentResult) {
      const failure = failed(result);
      expect(failure.recorded).toBe(false);
      expect(failure.unfinishedOperationId).toBeNull();
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(shopify.requests).toEqual([]);
      expect(levels()).toEqual({ red: 10, white: 20 });
      return failure;
    }

    it.each([
      ["no submission ID", { submissionId: null }],
      ["a submission ID that is not one the page issues", { submissionId: "1" }],
      ["no location", { locationId: null }],
      ["a deactivated location", { locationId: INACTIVE }],
      ["another shop's location", { locationId: OTHER_SHOPS_LOCATION }],
      ["a reason the app does not offer", { reason: "movement_created" }],
      ["no reason", { reason: "" }],
      ["an unknown mode", { mode: "MULTIPLY" }],
      ["a note that is too long", { note: "x".repeat(501) }],
    ])("refuses %s", async (_label, extra) => {
      await expectNothingRecorded(
        await submit("RED-75, -3", extra as Partial<SubmitAdjustmentInput>),
      );
    });

    it("lists every line it could not read", async () => {
      const failure = await expectNothingRecorded(
        await submit("RED-75, -3\nWHT-75\nRED-75, 2\nWHT-75, 1.5"),
      );
      expect(failure.error).toBe(
        "Some lines could not be read. Nothing was changed.",
      );
      expect(failure.details).toEqual([
        "Line 2: enter a SKU or barcode, a comma, then a quantity.",
        "Line 3: RED-75 is already on line 1.",
        'Line 4: "1.5" is not a whole number of at most 1,000,000.',
      ]);
    });

    it("refuses the whole adjustment when one code matches nothing", async () => {
      const failure = await expectNothingRecorded(
        await submit("RED-75, -3\nNOPE-1, 2"),
      );
      expect(failure.details).toEqual([
        "Line 2: no variant has the SKU or barcode NOPE-1.",
      ]);
    });

    it("refuses a SKU that two variants share and names them", async () => {
      const failure = await expectNothingRecorded(await submit("ROSE, 1"));
      expect(failure.details).toHaveLength(1);
      expect(failure.details[0]).toContain("ROSE matches 2 variants");
      expect(failure.details[0]).toContain("Rosé 75cl");
      expect(failure.details[0]).toContain("Rosé magnum");
    });

    it("refuses the same item entered once by SKU and once by barcode", async () => {
      const failure = await expectNothingRecorded(
        await submit("RED-75, -3\n0000000000017, -1"),
      );
      expect(failure.details).toEqual([
        "Line 2: Red wine is already on line 1.",
      ]);
    });

    it("refuses an item whose Shopify inventory is not linked yet", async () => {
      const failure = await expectNothingRecorded(await submit("GIN-70, 1"));
      expect(failure.details[0]).toContain("Unlinked gin");
    });

    it("does not find another shop's variant, by ID or by barcode", async () => {
      for (const code of [OTHER_SHOPS, "0000000000093"]) {
        const failure = await expectNothingRecorded(await submit(`${code}, 1`));
        expect(failure.details).toEqual([
          `Line 1: no variant has the SKU or barcode ${code}.`,
        ]);
      }
    });

    it("is not confused by another shop using the same SKU", async () => {
      expect((await submit("RED-75, 1")).ok).toBe(true);
      expect(shopify.level(101)).toBe(11);
      expect(shopify.level(201)).toBe(0);
    });

    it("records and sends nothing while adjustments are switched off", async () => {
      const failure = await expectNothingRecorded(
        await submit("RED-75, -3", {}, switchedOff()),
      );
      expect(failure.error).toBe(
        "Inventory adjustments are switched off for this app. Nothing was sent to Shopify.",
      );
    });
  });

  describe("setting quantities", () => {
    const set = (
      linesText: string,
      options: AdjustmentOptions = enabled(),
      extra: Partial<SubmitAdjustmentInput> = {},
    ) =>
      submit(linesText, { mode: "SET", reason: "cycle_count_available", ...extra }, options);

    it("moves each quantity to its target from what Shopify holds now", async () => {
      const result = await set("RED-75, 12\nWHT-75, 0");

      expect(result).toMatchObject({ ok: true, changedLineCount: 2 });
      expect(levels()).toEqual({ red: 12, white: 0 });
      expect(liveReads).toBe(1);
      const [operation] = await operations();
      expect(
        operation.lines.map((l) => [l.delta, l.changeFromQuantity]),
      ).toEqual([
        [2, 10],
        [-20, 20],
      ]);
    });

    it("leaves out an item that already holds the target quantity", async () => {
      const result = await set("RED-75, 10\nWHT-75, 18");

      expect(result).toMatchObject({ ok: true, changedLineCount: 1 });
      const [operation] = await operations();
      expect(operation.lines.map((l) => l.inventoryItemGid)).toEqual([
        item(102),
      ]);
    });

    it("records nothing when every item already holds its target", async () => {
      const result = await set("RED-75, 10\nWHT-75, 20");

      expect(result).toEqual({
        ok: true,
        operationId: null,
        changedLineCount: 0,
        alreadySubmitted: false,
      });
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(shopify.requests).toEqual([]);
    });

    it("refuses an item that is not stocked at the location instead of treating it as 0", async () => {
      notStocked.add(item(102));

      const failure = failed(await set("RED-75, 12\nWHT-75, 5"));

      expect(failure.recorded).toBe(false);
      expect(failure.details).toEqual([
        "White wine is not stocked at this location in Shopify. Stock it there first, or adjust it at another location.",
      ]);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(levels()).toEqual({ red: 10, white: 20 });
    });

    it("changes nothing when Shopify's quantities cannot be read", async () => {
      const failure = failed(
        await set(
          "RED-75, 12",
          enabled({
            readAvailable: async () => {
              throw new Error("socket hang up");
            },
          }),
        ),
      );

      expect(failure.recorded).toBe(false);
      expect(failure.error).toContain("could not be read");
      expect(failure.error).not.toContain("socket");
      expect(await prisma.inventoryOperation.count()).toBe(0);
    });

    it("does not overwrite a sale made after the quantity was read", async () => {
      // A unit of red sells between the live read and the write.
      shopify.next((request) => {
        shopify.setLevel(101, 9, 11);
        return shopify.apply(request);
      });

      const failure = failed(await set("RED-75, 12\nWHT-75, 25"));

      expect(levels()).toEqual({ red: 9, white: 25 });
      expect(failure.recorded).toBe(true);
      expect(failure.unfinishedOperationId).toBeNull();
      expect(failure.error).toContain("did not accept 1 of 2 changes");
      expect(failure.problems).toEqual([
        {
          shopifyVariantId: RED,
          title: "Red wine",
          message: "Shopify's quantity changed after this was prepared.",
        },
      ]);
      const [operation] = await operations();
      expect(operation.status).toBe("PARTIALLY_APPLIED");
      expect(operation.lines.map((l) => l.status)).toEqual([
        "CONFLICT",
        "APPLIED",
      ]);
    });

    it("keeps the first targets when the same form is submitted twice at once", async () => {
      const twice = input("RED-75, 12", {
        mode: "SET",
        reason: "cycle_count_available",
      });

      await Promise.all([
        submitAdjustment(dbA, null, STAFF, twice, enabled()),
        submitAdjustment(dbA, null, STAFF, twice, enabled()),
      ]);

      expect(shopify.level(101)).toBe(12);
      expect(await operations()).toHaveLength(1);
    });
  });

  describe("partial failure and recovery", () => {
    it("reports the refused line, keeps the applied ones and never resends them", async () => {
      rejectNextChangeAt(1);
      const partly = input("RED-75, -3\nWHT-75, 4");

      const failure = failed(
        await submitAdjustment(dbA, null, STAFF, partly, enabled()),
      );

      expect(levels()).toEqual({ red: 7, white: 20 });
      expect(failure.recorded).toBe(true);
      expect(failure.error).toBe(
        "Shopify did not accept 1 of 2 changes. The others are applied. Enter the lines below again as a new adjustment.",
      );
      expect(failure.problems).toEqual([
        {
          shopifyVariantId: WHITE,
          title: "White wine",
          message: "The item is not stocked at the location.",
        },
      ]);

      const requestsSoFar = shopify.requests.length;
      const again = failed(
        await submitAdjustment(dbA, null, STAFF, partly, enabled()),
      );
      expect(again.error).toBe(failure.error);
      expect(shopify.requests).toHaveLength(requestsSoFar);
      expect(levels()).toEqual({ red: 7, white: 20 });
    });

    it("says nothing was changed when Shopify refuses every line", async () => {
      rejectNextChangeAt(0);

      const failure = failed(await submit("RED-75, -3"));

      expect(failure.error).toContain("Nothing was changed.");
      expect(levels()).toEqual({ red: 10, white: 20 });
    });

    it("finishes an adjustment whose response was lost without adjusting twice", async () => {
      shopify.loseNextResponse();

      const unknown = failed(await submit("RED-75, -3"));

      expect(unknown.recorded).toBe(true);
      expect(unknown.unfinishedOperationId).not.toBeNull();
      expect(shopify.level(101)).toBe(7);

      const finished = await resumeAdjustment(
        dbA,
        null,
        unknown.unfinishedOperationId!,
        enabled(),
      );

      expect(finished).toMatchObject({ ok: true, changedLineCount: 1 });
      expect(shopify.level(101)).toBe(7);
      expect(new Set(shopify.keys()).size).toBe(1);
    });

    it("does not finish an adjustment while adjustments are switched off", async () => {
      shopify.loseNextResponse();
      const unknown = failed(await submit("RED-75, -3"));
      const requestsSoFar = shopify.requests.length;

      const blocked = failed(
        await resumeAdjustment(
          dbA,
          null,
          unknown.unfinishedOperationId!,
          switchedOff(),
        ),
      );

      expect(blocked.unfinishedOperationId).toBe(unknown.unfinishedOperationId);
      expect(shopify.requests).toHaveLength(requestsSoFar);
    });
  });

  describe("reversal", () => {
    it("undoes the applied lines once and records who reversed it", async () => {
      const operationId = applied(await submit("RED-75, -3\nWHT-75, 4"));

      const result = await reverseAdjustment(
        dbA,
        null,
        MANAGER,
        { operationId, note: " Wrong shelf " },
        enabled(),
      );

      expect(result).toMatchObject({
        ok: true,
        changedLineCount: 2,
        alreadySubmitted: false,
      });
      expect(levels()).toEqual({ red: 10, white: 20 });
      const [, reversal] = await operations();
      expect(reversal).toMatchObject({
        kind: "REVERSAL",
        status: "APPLIED",
        reversesOperationId: operationId,
        sourceType: ADJUSTMENT_SOURCE_TYPE,
        actorShopifyUserId: "77",
        note: "Wrong shelf",
      });
      expect(reversal.lines.map((l) => l.delta)).toEqual([3, -4]);
    });

    it("sends nothing more when an adjustment is reversed again", async () => {
      const operationId = applied(await submit("RED-75, -3"));
      await reverseAdjustment(dbA, null, STAFF, { operationId, note: null }, enabled());

      const again = await reverseAdjustment(
        dbA,
        null,
        STAFF,
        { operationId, note: "second try" },
        enabled(),
      );

      expect(again).toMatchObject({ ok: true, alreadySubmitted: true });
      expect(shopify.level(101)).toBe(10);
      expect(await operations()).toHaveLength(2);
    });

    it("reverses only what was applied after a partial failure", async () => {
      rejectNextChangeAt(1);
      await submit("RED-75, -3\nWHT-75, 4");
      const [operation] = await operations();

      const result = await reverseAdjustment(
        dbA,
        null,
        STAFF,
        { operationId: operation.id, note: null },
        enabled(),
      );

      expect(result).toMatchObject({ ok: true, changedLineCount: 1 });
      expect(levels()).toEqual({ red: 10, white: 20 });
    });

    it("refuses to reverse a reversal", async () => {
      const operationId = applied(await submit("RED-75, -3"));
      await reverseAdjustment(dbA, null, STAFF, { operationId, note: null }, enabled());
      const [, reversal] = await operations();

      const result = failed(
        await reverseAdjustment(
          dbA,
          null,
          STAFF,
          { operationId: reversal.id, note: null },
          enabled(),
        ),
      );

      expect(result.error).toBe("Adjustment not found");
      expect(shopify.level(101)).toBe(10);
      expect(await operations()).toHaveLength(2);
    });

    it("refuses to reverse an adjustment Shopify has not finished confirming", async () => {
      shopify.loseNextResponse();
      const unknown = failed(await submit("RED-75, -3"));

      const result = failed(
        await reverseAdjustment(
          dbA,
          null,
          STAFF,
          { operationId: unknown.unfinishedOperationId!, note: null },
          enabled(),
        ),
      );

      expect(result.error).toBe(
        "Only applied inventory changes can be reversed.",
      );
      expect(await operations()).toHaveLength(1);
    });

    it("records no reversal while adjustments are switched off", async () => {
      const operationId = applied(await submit("RED-75, -3"));

      const result = failed(
        await reverseAdjustment(
          dbA,
          null,
          STAFF,
          { operationId, note: null },
          switchedOff(),
        ),
      );

      expect(result.error).toContain("switched off");
      expect(shopify.level(101)).toBe(7);
      expect(await operations()).toHaveLength(1);
    });

    it("refuses a reversal note that is too long", async () => {
      const operationId = applied(await submit("RED-75, -3"));

      const result = failed(
        await reverseAdjustment(
          dbA,
          null,
          STAFF,
          { operationId, note: "x".repeat(501) },
          enabled(),
        ),
      );

      expect(result.error).toContain("at most 500 characters");
      expect(await operations()).toHaveLength(1);
    });
  });

  describe("history and report", () => {
    it("lists adjustments newest first with their lines, staff and what can still be done", async () => {
      const first = applied(await submit("RED-75, -3", { note: "Breakage" }));
      await tick();
      shopify.loseNextResponse();
      const unfinished = failed(await submit("WHT-75, 2", { reason: "received" }));
      await tick();
      await reverseAdjustment(
        dbA,
        null,
        MANAGER,
        { operationId: first, note: null },
        enabled(),
      );

      const history = await listAdjustments(dbA);

      expect(
        history.map((e) => [e.kind, e.status, e.canReverse, e.canResume]),
      ).toEqual([
        ["REVERSAL", "APPLIED", false, false],
        ["ADJUSTMENT", "RETRY_PENDING", false, true],
        ["ADJUSTMENT", "APPLIED", false, false],
      ]);
      const [reversal, pending, original] = history;
      expect(reversal.reversesOperationId).toBe(first);
      expect(reversal.staffId).toBe("77");
      expect(pending.operationId).toBe(unfinished.unfinishedOperationId);
      expect(pending.reason).toBe("received");
      expect(original).toMatchObject({
        operationId: first,
        reason: "damaged",
        note: "Breakage",
        staffId: "42",
        locationId: SHELF,
        reversedByOperationId: reversal.operationId,
      });
      expect(original.lines).toEqual([
        {
          title: "Red wine",
          sku: "RED-75",
          delta: -3,
          status: "APPLIED",
          quantityAfterChange: 7,
          errorMessage: null,
        },
      ]);
    });

    it("offers reversal for an applied adjustment, and not when no line was applied", async () => {
      await submit("RED-75, -3");
      await tick();
      rejectNextChangeAt(0);
      await submit("WHT-75, 4");

      const history = await listAdjustments(dbA);

      expect(history.map((e) => [e.status, e.canReverse])).toEqual([
        ["FAILED", false],
        ["APPLIED", true],
      ]);
      expect(history[0].lines[0]).toMatchObject({
        status: "FAILED",
        errorMessage: "The item is not stocked at the location.",
      });
    });

    it("pages through the history without repeating or skipping an entry", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        ids.unshift(applied(await submit("RED-75, 1")));
        await tick();
      }

      const seen: string[] = [];
      let after = null;
      for (let page = 0; page < 4; page += 1) {
        const entries = await listAdjustments(dbA, { after, take: 2 });
        if (entries.length === 0) break;
        seen.push(...entries.map((e) => e.operationId));
        const last = entries.at(-1)!;
        after = { createdAt: last.createdAt, operationId: last.operationId };
      }

      expect(seen).toEqual(ids);
    });

    it("filters by the period the adjustment was recorded in", async () => {
      const operationId = applied(await submit("RED-75, 1"));
      const { createdAt } = await prisma.inventoryOperation.findUniqueOrThrow({
        where: { id: operationId },
      });
      const before = new Date(createdAt.getTime() - 1);
      const later = new Date(createdAt.getTime() + 1);

      expect(await listAdjustments(dbA, { from: createdAt, to: createdAt })).toHaveLength(1);
      expect(await listAdjustments(dbA, { to: before })).toEqual([]);
      expect(await listAdjustments(dbA, { from: later })).toEqual([]);
    });

    it("leaves stocktake and transfer operations out of the adjustment history", async () => {
      await submit("RED-75, 1");
      const shopA = await prisma.shop.findUniqueOrThrow({
        where: { myshopifyDomain: SHOP_A },
      });
      await prisma.inventoryOperation.create({
        data: {
          shopId: shopA.id,
          kind: "STOCKTAKE",
          status: "PENDING",
          capability: "stocktakeInventoryWrites",
          idempotencyKey: "Stocktake:x:1",
          sourceType: "Stocktake",
          sourceId: "x",
          reason: "cycle_count_available",
          quantityName: "available",
          actorChannel: "ADMIN",
          payloadDigest: "0".repeat(64),
          lineCount: 0,
        },
      });

      expect(await listAdjustments(dbA)).toHaveLength(1);
    });

    it("collects a whole period for the report and says when it holds more than the limit", async () => {
      for (let i = 0; i < 5; i += 1) {
        await submit("RED-75, 1");
        await tick();
      }

      const whole = await listAdjustmentsForExport(dbA, {}, { limit: 5, pageSize: 2 });
      const cut = await listAdjustmentsForExport(dbA, {}, { limit: 4, pageSize: 2 });

      expect(whole.truncated).toBe(false);
      expect(whole.entries).toHaveLength(5);
      expect(new Set(whole.entries.map((e) => e.operationId)).size).toBe(5);
      expect(cut.truncated).toBe(true);
      expect(cut.entries).toHaveLength(4);
    });
  });

  describe("another shop", () => {
    it("cannot see, finish or reverse this shop's adjustments", async () => {
      const operationId = applied(await submit("RED-75, -3"));
      shopify.loseNextResponse();
      const unknown = failed(await submit("WHT-75, 2"));
      const requestsSoFar = shopify.requests.length;

      expect(await listAdjustments(dbB)).toEqual([]);
      expect(
        failed(
          await resumeAdjustment(
            dbB,
            null,
            unknown.unfinishedOperationId!,
            enabled(),
          ),
        ).error,
      ).toBe("Adjustment not found");
      expect(
        failed(
          await reverseAdjustment(
            dbB,
            null,
            STAFF,
            { operationId, note: null },
            enabled(),
          ),
        ).error,
      ).toBe("Adjustment not found");

      expect(shopify.requests).toHaveLength(requestsSoFar);
      expect(shopify.level(101)).toBe(7);
      expect(await operations()).toHaveLength(2);
    });

    it("records its own adjustment under the same submission ID without touching this shop's", async () => {
      const submissionId = randomUUID();
      await submit("RED-75, -3", { submissionId });

      const theirs = await submitAdjustment(
        dbB,
        null,
        STAFF,
        input("RED-75, 5", {
          submissionId,
          locationId: OTHER_SHOPS_LOCATION,
        }),
        enabled(),
      );

      expect(theirs).toMatchObject({ ok: true, alreadySubmitted: false });
      expect(shopify.level(101)).toBe(7);
      expect(shopify.level(201, 21)).toBe(5);
    });
  });
});
