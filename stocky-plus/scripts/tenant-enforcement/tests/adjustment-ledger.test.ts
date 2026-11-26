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
import { readAdjustmentHistoryQuery } from "../../../app/services/adjustments/adjustment-history-query";
import {
  MAX_OWN_ADJUSTMENT_REASONS,
  ownReasonValue,
} from "../../../app/services/adjustments/adjustment-input";
import {
  addOwnAdjustmentReason,
  listOwnAdjustmentReasons,
  removeOwnAdjustmentReason,
  updateOwnAdjustmentReason,
  type OwnAdjustmentReason,
  type OwnAdjustmentReasonResult,
} from "../../../app/services/adjustments/adjustment-reasons.server";
import { recordInventoryOperation } from "../../../app/services/inventory-writes/ledger.server";
import { readShopTimeZone } from "../../../app/services/inventory-writes/shop-clock.server";
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

  const enabled = (
    extra: Partial<AdjustmentOptions> = {},
  ): AdjustmentOptions => ({
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
      `TRUNCATE TABLE "InventoryOperationLine", "InventoryOperation", "AdjustmentReason" CASCADE`,
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

      const result = await submit("RED-75, -3\n0000000000024, 4", {
        submissionId,
        note: "  Dropped a case  ",
      });

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

    it("tells the second of two simultaneous requests that the first is still sending", async () => {
      const twice = input("RED-75, -3");
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      let reached!: () => void;
      const sending = new Promise<void>((resolve) => (reached = resolve));

      const first = submitAdjustment(dbA, null, STAFF, twice, {
        ...enabled(),
        sendBatch: async (request) => {
          reached();
          await held;
          return shopify.send(request);
        },
      });
      await sending;
      const second = failed(
        await submitAdjustment(dbA, null, STAFF, twice, enabled()),
      );
      release();

      expect(second.error).toBe(
        "This adjustment is being sent to Shopify right now, possibly by another request. Changes Shopify has confirmed are not sent twice. Reload the page in a moment to see the result.",
      );
      expect(second.recorded).toBe(true);
      expect(await first).toMatchObject({ ok: true });
      expect(shopify.requests).toHaveLength(1);
      expect(shopify.level(101)).toBe(7);
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
      [
        "a submission ID that is not one the page issues",
        { submissionId: "1" },
      ],
      ["no location", { locationId: null }],
      ["a reason the app does not offer", { reason: "movement_created" }],
      ["no reason", { reason: "" }],
      ["an unknown mode", { mode: "MULTIPLY" }],
      ["a note that is too long", { note: "x".repeat(501) }],
    ])("refuses %s", async (_label, extra) => {
      await expectNothingRecorded(
        await submit("RED-75, -3", extra as Partial<SubmitAdjustmentInput>),
      );
    });

    it.each([
      ["a deactivated location", INACTIVE],
      ["another shop's location", OTHER_SHOPS_LOCATION],
    ])("refuses %s and says how to fix it", async (_label, locationId) => {
      const failure = await expectNothingRecorded(
        await submit("RED-75, -3", { locationId }),
      );
      expect(failure.error).toBe(
        "That location is not an active, synced location of this shop. Choose Sync catalog on the Home page, then try again.",
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
      submit(
        linesText,
        { mode: "SET", reason: "cycle_count_available", ...extra },
        options,
      );

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

    it("answers a resubmitted form from the ledger without reading Shopify again", async () => {
      const again = input("RED-75, 12", {
        mode: "SET",
        reason: "cycle_count_available",
      });
      await submitAdjustment(dbA, null, STAFF, again, enabled());

      const second = await submitAdjustment(dbA, null, STAFF, again, enabled());

      expect(second).toMatchObject({
        ok: true,
        changedLineCount: 1,
        alreadySubmitted: true,
      });
      expect(liveReads).toBe(1);
      expect(shopify.requests).toHaveLength(1);
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
      await reverseAdjustment(
        dbA,
        null,
        STAFF,
        { operationId, note: null },
        enabled(),
      );

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
      await reverseAdjustment(
        dbA,
        null,
        STAFF,
        { operationId, note: null },
        enabled(),
      );
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
      const unfinished = failed(
        await submit("WHT-75, 2", { reason: "received" }),
      );
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

    it("pages correctly through adjustments recorded in the same millisecond", async () => {
      for (let i = 0; i < 3; i += 1) await submit("RED-75, 1");
      // The ledger freezes createdAt, so the tie is forced with its guard
      // trigger out of the way for this one statement.
      await prisma.$transaction([
        prisma.$executeRawUnsafe(
          `SET LOCAL session_replication_role = replica`,
        ),
        prisma.$executeRawUnsafe(
          `UPDATE "InventoryOperation" SET "createdAt" = '2026-11-11 12:00:00.000'`,
        ),
      ]);

      const seen: string[] = [];
      let after = null;
      for (let page = 0; page < 4; page += 1) {
        const entries = await listAdjustments(dbA, { after, take: 1 });
        if (entries.length === 0) break;
        seen.push(entries[0].operationId);
        after = {
          createdAt: entries[0].createdAt,
          operationId: entries[0].operationId,
        };
      }

      expect(seen).toHaveLength(3);
      expect(new Set(seen).size).toBe(3);
    });

    it("filters by the period the adjustment was recorded in", async () => {
      const operationId = applied(await submit("RED-75, 1"));
      const { createdAt } = await prisma.inventoryOperation.findUniqueOrThrow({
        where: { id: operationId },
      });
      const before = new Date(createdAt.getTime() - 1);
      const later = new Date(createdAt.getTime() + 1);

      expect(
        await listAdjustments(dbA, { from: createdAt, to: createdAt }),
      ).toHaveLength(1);
      expect(await listAdjustments(dbA, { to: before })).toEqual([]);
      expect(await listAdjustments(dbA, { from: later })).toEqual([]);
    });

    it("files an adjustment under the day it was recorded on the shop's clock", async () => {
      applied(await submit("RED-75, 1"));
      // 9:30 in the evening of 10 November in Toronto, already the 11th in UTC.
      await prisma.$transaction([
        prisma.$executeRawUnsafe(
          `SET LOCAL session_replication_role = replica`,
        ),
        prisma.$executeRawUnsafe(
          `UPDATE "InventoryOperation" SET "createdAt" = '2026-11-11 02:30:00.000'`,
        ),
      ]);
      const onDay = async (day: string, timeZone: string | null) => {
        const { from, to } = readAdjustmentHistoryQuery(
          new URLSearchParams({ from: day, to: day }),
          timeZone,
        );
        return (await listAdjustments(dbA, { from, to })).length;
      };
      const setZone = (domain: string, ianaTimezone: string | null) =>
        prisma.shop.update({
          where: { myshopifyDomain: domain },
          data: { ianaTimezone },
        });

      expect(await readShopTimeZone(dbA.authority)).toBeNull();
      expect(await onDay("2026-11-11", null)).toBe(1);
      expect(await onDay("2026-11-10", null)).toBe(0);

      await setZone(SHOP_A, "America/Toronto");
      await setZone(SHOP_B, "Asia/Tokyo");
      try {
        const zone = await readShopTimeZone(dbA.authority);

        expect(zone).toBe("America/Toronto");
        expect(await readShopTimeZone(dbB.authority)).toBe("Asia/Tokyo");
        expect(await onDay("2026-11-10", zone)).toBe(1);
        expect(await onDay("2026-11-11", zone)).toBe(0);
      } finally {
        await setZone(SHOP_A, null);
        await setZone(SHOP_B, null);
      }
    });

    it("leaves stocktake and transfer operations out of the history and out of reach of its controls", async () => {
      await submit("RED-75, 1");
      await recordInventoryOperation(dbA, {
        kind: "STOCKTAKE",
        idempotencyKey: "Stocktake:count-1:1",
        source: { type: "Stocktake", id: "count-1" },
        reason: "cycle_count_available",
        quantityName: "available",
        referenceDocumentUri: null,
        actor: STAFF,
        note: null,
        lines: [
          {
            inventoryItemId: item(102),
            variantId: WHITE,
            locationId: SHELF,
            delta: 1,
            changeFromQuantity: null,
          },
        ],
      });

      const { id: stocktakeOperationId } =
        await prisma.inventoryOperation.findFirstOrThrow({
          where: { kind: "STOCKTAKE" },
        });

      expect(await listAdjustments(dbA)).toHaveLength(1);
      expect(
        failed(
          await resumeAdjustment(dbA, null, stocktakeOperationId, enabled()),
        ).error,
      ).toBe("Adjustment not found");
      expect(
        failed(
          await reverseAdjustment(
            dbA,
            null,
            STAFF,
            { operationId: stocktakeOperationId, note: null },
            enabled(),
          ),
        ).error,
      ).toBe("Adjustment not found");
      expect(shopify.level(102)).toBe(20);
    });

    it("collects a whole period for the report and says when it holds more than the limit", async () => {
      for (let i = 0; i < 5; i += 1) {
        await submit("RED-75, 1");
        await tick();
      }

      const whole = await listAdjustmentsForExport(
        dbA,
        {},
        { limit: 5, pageSize: 2 },
      );
      const cut = await listAdjustmentsForExport(
        dbA,
        {},
        { limit: 4, pageSize: 2 },
      );

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

  describe("the shop's own reasons", () => {
    function added(result: OwnAdjustmentReasonResult): OwnAdjustmentReason {
      if (!result.ok)
        throw new Error(`expected a reason, got: ${result.error}`);
      return result.reason;
    }
    function refusal(result: OwnAdjustmentReasonResult): string {
      if (result.ok) throw new Error("expected the reason to be refused");
      return result.error;
    }
    const add = (name: string, shopifyReason: unknown = "other", db = dbA) =>
      addOwnAdjustmentReason(db, STAFF, { name, shopifyReason });
    const names = async (db = dbA) =>
      (await listOwnAdjustmentReasons(db)).map((reason) => reason.name);

    it("adds a reason with the Shopify reason it counts as and who added it, and lists reasons by name", async () => {
      added(await add("  Staff   purchase ", "promotion"));
      const studio = added(await add("Sent to photo studio"));

      expect(studio).toEqual({
        id: expect.any(String),
        name: "Sent to photo studio",
        shopifyReason: "other",
      });
      expect(await listOwnAdjustmentReasons(dbA)).toEqual([
        studio,
        {
          id: expect.any(String),
          name: "Staff purchase",
          shopifyReason: "promotion",
        },
      ]);
      expect(await prisma.adjustmentReason.findMany()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Staff purchase",
            nameKey: "staff purchase",
            createdByUserId: "42",
            updatedByUserId: "42",
          }),
        ]),
      );
    });

    it("starts with no reasons", async () => {
      expect(await listOwnAdjustmentReasons(dbA)).toEqual([]);
    });

    it.each([
      ["", "Enter a name for the reason."],
      ["   ", "Enter a name for the reason."],
      ["x".repeat(61), "A reason name can be at most 60 characters."],
      [
        "theft OR loss",
        '"theft OR loss" is already one of the built-in reasons. Choose another name.',
      ],
      [
        " reversal ",
        '"reversal" is what the history calls an adjustment that was undone. Choose another name.',
      ],
    ])("refuses the name %j and saves nothing", async (name, message) => {
      expect(refusal(await add(name))).toBe(message);
      expect(await prisma.adjustmentReason.count()).toBe(0);
    });

    it.each(["", "reservation_created", "movement_created", 7, null])(
      "refuses %j as the Shopify reason and saves nothing",
      async (shopifyReason) => {
        expect(refusal(await add("Staff purchase", shopifyReason))).toBe(
          "Choose the Shopify reason this reason counts as.",
        );
        expect(await prisma.adjustmentReason.count()).toBe(0);
      },
    );

    it("refuses a name the shop already uses, whatever its capitals or spacing", async () => {
      added(await add("Staff purchase"));

      expect(refusal(await add("STAFF  Purchase", "damaged"))).toBe(
        'You already have a reason called "STAFF Purchase".',
      );
      expect(await names()).toEqual(["Staff purchase"]);
    });

    it("saves one reason when the same name is added twice at once", async () => {
      const results = await Promise.all([
        add("Staff purchase"),
        add("Staff purchase"),
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(refusal(results.find((result) => !result.ok)!)).toBe(
        'You already have a reason called "Staff purchase".',
      );
      expect(await names()).toEqual(["Staff purchase"]);
    });

    it(`refuses one more reason than ${MAX_OWN_ADJUSTMENT_REASONS}`, async () => {
      for (let n = 0; n < MAX_OWN_ADJUSTMENT_REASONS; n += 1) {
        added(await add(`Reason ${n}`));
      }

      expect(refusal(await add("One too many"))).toBe(
        "A shop can have at most 50 reasons of its own. Remove one you no longer use first.",
      );
      expect(await prisma.adjustmentReason.count()).toBe(
        MAX_OWN_ADJUSTMENT_REASONS,
      );
    });

    it("renames a reason and changes the Shopify reason it counts as", async () => {
      const reason = added(await add("Staff purchase"));

      const renamed = await updateOwnAdjustmentReason(dbA, MANAGER, reason.id, {
        name: "Staff sale",
        shopifyReason: "promotion",
      });

      expect(renamed).toEqual({
        ok: true,
        reason: {
          id: reason.id,
          name: "Staff sale",
          shopifyReason: "promotion",
        },
      });
      expect(await listOwnAdjustmentReasons(dbA)).toEqual([added(renamed)]);
      // The row keeps who added the reason and who changed it last.
      expect(await prisma.adjustmentReason.findMany()).toMatchObject([
        { name: "Staff sale", createdByUserId: "42", updatedByUserId: "77" },
      ]);
    });

    it("lets a reason keep its own name with other capitals, and refuses another reason's name", async () => {
      const purchase = added(await add("Staff purchase"));
      added(await add("Samples"));

      expect(
        await updateOwnAdjustmentReason(dbA, STAFF, purchase.id, {
          name: "Staff Purchase",
          shopifyReason: "other",
        }),
      ).toMatchObject({ ok: true, reason: { name: "Staff Purchase" } });
      expect(
        refusal(
          await updateOwnAdjustmentReason(dbA, STAFF, purchase.id, {
            name: "samples",
            shopifyReason: "other",
          }),
        ),
      ).toBe('You already have a reason called "samples".');
      expect(await names()).toEqual(["Samples", "Staff Purchase"]);
    });

    it("refuses an edit that names no reason, a blank name or an unknown Shopify reason", async () => {
      const reason = added(await add("Staff purchase"));
      const edit = (id: string, name: string, shopifyReason: unknown) =>
        updateOwnAdjustmentReason(dbA, STAFF, id, { name, shopifyReason });

      expect(refusal(await edit("missing", "Samples", "other"))).toBe(
        "That reason is no longer in your list. Reload the page to see the current list.",
      );
      expect(refusal(await edit(reason.id, " ", "other"))).toBe(
        "Enter a name for the reason.",
      );
      expect(refusal(await edit(reason.id, "Reversal", "other"))).toBe(
        '"Reversal" is what the history calls an adjustment that was undone. Choose another name.',
      );
      expect(refusal(await edit(reason.id, "Samples", "nope"))).toBe(
        "Choose the Shopify reason this reason counts as.",
      );
      expect(await listOwnAdjustmentReasons(dbA)).toEqual([reason]);
    });

    it("removes a reason once, and says so when it is already gone", async () => {
      const reason = added(await add("Staff purchase"));

      expect(await removeOwnAdjustmentReason(dbA, reason.id)).toEqual({
        ok: true,
        reason,
      });
      expect(refusal(await removeOwnAdjustmentReason(dbA, reason.id))).toBe(
        "That reason is no longer in your list. Reload the page to see the current list.",
      );
      expect(await names()).toEqual([]);
    });

    it("records an adjustment under the reason's name and sends Shopify the reason it counts as", async () => {
      const reason = added(await add("Sent to photo studio", "promotion"));

      const result = await submit("RED-75, -2", {
        reason: ownReasonValue(reason.id),
      });

      expect(result).toMatchObject({ ok: true, changedLineCount: 1 });
      expect(shopify.requests.map((request) => request.reason)).toEqual([
        "promotion",
      ]);
      expect(await operations()).toMatchObject([
        { reason: "promotion", reasonLabel: "Sent to photo studio" },
      ]);
      expect(await listAdjustments(dbA)).toMatchObject([
        { reason: "promotion", reasonLabel: "Sent to photo studio" },
      ]);
    });

    it("leaves the name empty for a built-in reason and for a reversal", async () => {
      const reason = added(await add("Sent to photo studio"));
      await submit("RED-75, -1");
      const own = applied(
        await submit("RED-75, -2", { reason: ownReasonValue(reason.id) }),
      );
      await reverseAdjustment(
        dbA,
        null,
        MANAGER,
        { operationId: own, note: null },
        enabled(),
      );

      expect(
        (await operations()).map((operation) => [
          operation.kind,
          operation.reason,
          operation.reasonLabel,
        ]),
      ).toEqual([
        ["ADJUSTMENT", "damaged", null],
        ["ADJUSTMENT", "other", "Sent to photo studio"],
        ["REVERSAL", "correction", null],
      ]);
    });

    it("keeps the name and the Shopify reason on a recorded adjustment after the reason is renamed and removed", async () => {
      const reason = added(await add("Sent to photo studio", "promotion"));
      await submit("RED-75, -2", { reason: ownReasonValue(reason.id) });

      await updateOwnAdjustmentReason(dbA, STAFF, reason.id, {
        name: "Photo shoot",
        shopifyReason: "other",
      });
      expect(await listAdjustments(dbA)).toMatchObject([
        { reason: "promotion", reasonLabel: "Sent to photo studio" },
      ]);

      await removeOwnAdjustmentReason(dbA, reason.id);
      expect(await listAdjustments(dbA)).toMatchObject([
        { reason: "promotion", reasonLabel: "Sent to photo studio" },
      ]);
      expect((await listAdjustmentsForExport(dbA, {})).entries).toMatchObject([
        { reasonLabel: "Sent to photo studio" },
      ]);
    });

    it("uses the reason as it reads when the adjustment is recorded", async () => {
      const reason = added(await add("Sent to photo studio", "promotion"));
      await updateOwnAdjustmentReason(dbA, STAFF, reason.id, {
        name: "Photo shoot",
        shopifyReason: "other",
      });

      await submit("RED-75, -2", { reason: ownReasonValue(reason.id) });

      expect(await operations()).toMatchObject([
        { reason: "other", reasonLabel: "Photo shoot" },
      ]);
    });

    it("refuses an adjustment whose reason was removed while the form was open, and records and sends nothing", async () => {
      const reason = added(await add("Sent to photo studio"));
      await removeOwnAdjustmentReason(dbA, reason.id);

      const result = failed(
        await submit("RED-75, -2", { reason: ownReasonValue(reason.id) }),
      );

      expect(result.error).toBe(
        "That reason is no longer in your list. Choose another reason. Nothing was changed.",
      );
      expect(result.recorded).toBe(false);
      expect(shopify.requests).toEqual([]);
      expect(await operations()).toEqual([]);
      expect(levels()).toEqual({ red: 10, white: 20 });
    });

    it.each([
      "own:",
      "own:../x",
      "own:does-not-exist",
      "own:" + "a".repeat(65),
      "studio",
    ])("refuses %j as a reason and records nothing", async (reason) => {
      failed(await submit("RED-75, -2", { reason }));

      expect(shopify.requests).toEqual([]);
      expect(await operations()).toEqual([]);
    });

    it("answers a resubmitted form from the ledger even after its reason was removed", async () => {
      const reason = added(await add("Sent to photo studio"));
      const submissionId = randomUUID();
      const form = { submissionId, reason: ownReasonValue(reason.id) };
      await submit("RED-75, -2", form);
      await removeOwnAdjustmentReason(dbA, reason.id);

      const again = await submit("RED-75, -2", form);

      expect(again).toMatchObject({ ok: true, alreadySubmitted: true });
      expect(shopify.requests).toHaveLength(1);
      expect(await operations()).toMatchObject([
        { reasonLabel: "Sent to photo studio" },
      ]);
    });

    it("records nothing with one of the shop's own reasons while adjustments are switched off", async () => {
      const reason = added(await add("Sent to photo studio"));

      failed(
        await submit(
          "RED-75, -2",
          { reason: ownReasonValue(reason.id) },
          switchedOff(),
        ),
      );

      expect(shopify.requests).toEqual([]);
      expect(await operations()).toEqual([]);
    });

    it("does not let the name on a recorded adjustment be changed or cleared", async () => {
      const reason = added(await add("Sent to photo studio"));
      const id = applied(
        await submit("RED-75, -2", { reason: ownReasonValue(reason.id) }),
      );

      for (const reasonLabel of ["Something else", null]) {
        await expect(
          prisma.inventoryOperation.update({
            where: { id },
            data: { reasonLabel },
          }),
        ).rejects.toThrow(/inventory_operation_request_immutable/);
        await expect(
          dbA.inventoryOperation.updateMany({
            where: { id },
            data: { reasonLabel },
          }),
        ).rejects.toThrow(/inventory_operation_request_immutable/);
      }
      expect(await operations()).toMatchObject([
        { reasonLabel: "Sent to photo studio" },
      ]);
    });

    it("holds the rules in the database as well: a name, a Shopify reason and one reason per name", async () => {
      const shop = await prisma.shop.findFirstOrThrow({
        where: { myshopifyDomain: SHOP_A },
      });
      const row = {
        shopId: shop.id,
        name: "Samples",
        nameKey: "samples",
        shopifyReason: "other",
      };
      await prisma.adjustmentReason.create({ data: row });

      await expect(
        prisma.adjustmentReason.create({ data: { ...row, name: "SAMPLES" } }),
      ).rejects.toThrow(/Unique constraint/);
      await expect(
        prisma.adjustmentReason.create({
          data: { ...row, name: " ", nameKey: "blank" },
        }),
      ).rejects.toThrow(/AdjustmentReason_name_not_blank/);
      await expect(
        prisma.adjustmentReason.create({
          data: { ...row, nameKey: "no reason", shopifyReason: "" },
        }),
      ).rejects.toThrow(/AdjustmentReason_shopifyReason_not_blank/);
      await expect(
        prisma.inventoryOperation.create({
          data: {
            shopId: shop.id,
            idempotencyKey: "adjustment:blank-label",
            payloadDigest: "0".repeat(64),
            kind: "ADJUSTMENT",
            writeCapability: "adjustmentWrites",
            sourceType: ADJUSTMENT_SOURCE_TYPE,
            sourceId: randomUUID(),
            reason: "other",
            reasonLabel: " ",
            quantityName: "available",
            actorChannel: "ADMIN",
            lineCount: 1,
          },
        }),
      ).rejects.toThrow(/InventoryOperation_reasonLabel_not_blank/);
    });

    describe("another shop", () => {
      it("does not see this shop's reasons and may use the same name for its own", async () => {
        added(await add("Staff purchase"));

        expect(await names(dbB)).toEqual([]);
        added(await add("Staff purchase", "damaged", dbB));
        expect(await listOwnAdjustmentReasons(dbB)).toMatchObject([
          { name: "Staff purchase", shopifyReason: "damaged" },
        ]);
        expect(await listOwnAdjustmentReasons(dbA)).toMatchObject([
          { name: "Staff purchase", shopifyReason: "other" },
        ]);
      });

      it("cannot rename or remove this shop's reason", async () => {
        const reason = added(await add("Staff purchase"));

        expect(
          refusal(
            await updateOwnAdjustmentReason(dbB, STAFF, reason.id, {
              name: "Taken over",
              shopifyReason: "other",
            }),
          ),
        ).toMatch(/no longer in your list/);
        expect(
          refusal(await removeOwnAdjustmentReason(dbB, reason.id)),
        ).toMatch(/no longer in your list/);
        expect(await listOwnAdjustmentReasons(dbA)).toEqual([reason]);
      });

      it("cannot record an adjustment under this shop's reason", async () => {
        const reason = added(await add("Staff purchase"));

        const theirs = await submitAdjustment(
          dbB,
          null,
          STAFF,
          input("RED-75, 5", {
            locationId: OTHER_SHOPS_LOCATION,
            reason: ownReasonValue(reason.id),
          }),
          enabled(),
        );

        expect(failed(theirs).error).toMatch(/no longer in your list/);
        expect(shopify.requests).toEqual([]);
        expect(await operations()).toEqual([]);
      });

      it("cannot write a reason into this shop, or move one of its own there", async () => {
        const shopA = await prisma.shop.findFirstOrThrow({
          where: { myshopifyDomain: SHOP_A },
        });
        const theirs = added(await add("Staff purchase", "other", dbB));

        await expect(
          dbB.adjustmentReason.create({
            data: {
              shopId: shopA.id,
              name: "Planted",
              nameKey: "planted",
              shopifyReason: "other",
            },
          }),
        ).rejects.toThrow();
        await expect(
          dbB.adjustmentReason.updateMany({
            where: { id: theirs.id },
            data: { shopId: shopA.id },
          }),
        ).rejects.toThrow();
        expect(await names()).toEqual([]);
      });
    });
  });
});
