/**
 * Replenishment planning inputs under full enforcement: shop defaults and
 * per-variant rules stay inside their shop, saves survive concurrent first
 * writes, and the database rejects values the forms never send.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../../authority.server";
import { TENANT_DB_CONTEXT_VERSION } from "../../db-context.server";
import { createTenantDb } from "../../tenant-db.server";
import {
  getReplenishmentDefaults,
  getWorksheetColumns,
  INITIAL_DEFAULTS,
  saveReplenishmentDefaults,
  saveWorksheetColumns,
  type ReplenishmentDefaults,
} from "../../../lib/replenishment/settings.server";
import { DEFAULT_WORKSHEET_COLUMNS } from "../../../lib/replenishment/worksheet/columns";
import {
  EMPTY_RULE,
  getVariantRule,
  loadEffectiveRules,
  ReplenishmentRuleError,
  saveVariantRule,
  SHOP_SCOPE,
} from "../../../lib/replenishment/rules.server";
import {
  requireRuntimeUrl,
  resetAndEnforce,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  withRuntimePg,
} from "./helpers";

const VARIANT = "gid://shopify/ProductVariant/7001";
const OTHER_VARIANT = "gid://shopify/ProductVariant/7002";
const PRODUCT = "gid://shopify/Product/6001";
const LOCATION = "gid://shopify/Location/8001";

const CUSTOM_DEFAULTS: ReplenishmentDefaults = {
  defaultMethod: "TARGET_STOCK_LEVEL",
  sampleDays: 14,
  suggestDays: 21,
  targetQuantity: 40,
  incomingSource: "APP_PURCHASE_ORDERS",
  defaultLeadTimeDays: 9,
  applyMinimumOrderQuantity: true,
  roundUpToPackSize: true,
};

describe("replenishment planning inputs", () => {
  let migrationPrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  function tenantDb(shopId: string, myshopifyDomain: string) {
    requireRuntimeUrl();
    return createTenantDb(
      issueTenantAuthority({
        shopId,
        myshopifyDomain,
        source: "verified_admin_request",
      }),
    );
  }
  const dbA = () => tenantDb(shopAId, SHOP_A_DOMAIN);
  const dbB = () => tenantDb(shopBId, SHOP_B_DOMAIN);

  async function seedCatalog(shopId: string) {
    const observed = {
      existenceState: "LIVE" as const,
      existenceKind: "LIVE_FULL_SYNC_PRESENT" as const,
      existenceObservedAt: new Date("2026-11-01T00:00:00Z"),
      sourceKind: "FULL_SYNC" as const,
    };
    await migrationPrisma.shopifyProductFact.create({
      data: {
        shopId,
        shopifyGid: PRODUCT,
        title: "Widget",
        handle: "widget",
        tags: [],
        status: "ACTIVE",
        ...observed,
      },
    });
    for (const shopifyGid of [VARIANT, OTHER_VARIANT]) {
      await migrationPrisma.shopifyVariantFact.create({
        data: {
          shopId,
          shopifyGid,
          shopifyProductGid: PRODUCT,
          title: "Default",
          selectedOptions: [],
          priceAmount: "10.00",
          currencyCode: "USD",
          ...observed,
        },
      });
    }
    await migrationPrisma.shopifyLocationFact.create({
      data: {
        shopId,
        shopifyGid: LOCATION,
        name: "Main store",
        isActive: true,
        fulfillsOnlineOrders: true,
        shipsInventory: true,
        isFulfillmentService: false,
        hasActiveInventory: true,
        ...observed,
      },
    });
  }

  function ruleRows(shopId: string) {
    return migrationPrisma.replenishmentVariantRule.findMany({
      where: { shopId },
      orderBy: [{ variantGid: "asc" }, { scopeKey: "asc" }],
    });
  }

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    await ctx.runtimePrisma.$disconnect();
    const shops = await seedTwoShops(migrationPrisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    // Both shops sync the same Shopify ids, as two real shops can.
    await seedCatalog(shopAId);
    await seedCatalog(shopBId);
  }, 180_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  describe("shop defaults", () => {
    it("reads the initial defaults without creating a row", async () => {
      const defaults = await getReplenishmentDefaults(dbA());
      expect(await getWorksheetColumns(dbA())).toEqual(DEFAULT_WORKSHEET_COLUMNS);
      expect(defaults).toEqual({ ...INITIAL_DEFAULTS, updatedAt: null });
      expect(await migrationPrisma.replenishmentSettings.count()).toBe(0);
    });

    it("saves one row per shop and leaves other shops on their own defaults", async () => {
      const first = await saveReplenishmentDefaults(dbA(), CUSTOM_DEFAULTS);
      expect(first).toMatchObject(CUSTOM_DEFAULTS);
      expect(first.updatedAt).toBeInstanceOf(Date);

      const second = await saveReplenishmentDefaults(dbA(), {
        ...CUSTOM_DEFAULTS,
        defaultMethod: "LAST_X_DAYS",
        targetQuantity: null,
      });
      expect(second.defaultMethod).toBe("LAST_X_DAYS");
      expect(second.targetQuantity).toBeNull();

      const rows = await migrationPrisma.replenishmentSettings.findMany({
        where: { shopId: shopAId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].defaultMethod).toBe("LAST_X_DAYS");

      expect(await getReplenishmentDefaults(dbB())).toEqual({
        ...INITIAL_DEFAULTS,
        updatedAt: null,
      });
    });

    it("keeps one row when two first saves race", async () => {
      const results = await Promise.all([
        saveReplenishmentDefaults(dbB(), CUSTOM_DEFAULTS),
        saveReplenishmentDefaults(dbB(), {
          ...CUSTOM_DEFAULTS,
          sampleDays: 60,
        }),
        saveReplenishmentDefaults(dbB(), {
          ...CUSTOM_DEFAULTS,
          sampleDays: 90,
        }),
      ]);
      expect(results.map((r) => r.suggestDays)).toEqual([21, 21, 21]);
      const rows = await migrationPrisma.replenishmentSettings.findMany({
        where: { shopId: shopBId },
      });
      expect(rows).toHaveLength(1);
      expect([14, 60, 90]).toContain(rows[0].sampleDays);
    });
  });

  describe("worksheet columns", () => {
    it("starts every shop on the default columns, with or without a settings row", async () => {
      // Both shops have a settings row by now, created without a column choice.
      expect(await getWorksheetColumns(dbA())).toEqual(DEFAULT_WORKSHEET_COLUMNS);
      expect(await getWorksheetColumns(dbB())).toEqual(DEFAULT_WORKSHEET_COLUMNS);
    });

    it("saves one shop's choice without touching its defaults or another shop", async () => {
      const before = await getReplenishmentDefaults(dbA());
      expect(await saveWorksheetColumns(dbA(), ["reorderPoint", "sku", "unknown"])).toEqual([
        "sku",
        "reorderPoint",
      ]);
      expect(await getWorksheetColumns(dbA())).toEqual(["sku", "reorderPoint"]);
      // Saving columns touches the row's update time and nothing else.
      expect(await getReplenishmentDefaults(dbA())).toEqual({
        ...before,
        updatedAt: expect.any(Date),
      });
      expect(await getWorksheetColumns(dbB())).toEqual(DEFAULT_WORKSHEET_COLUMNS);
    });

    it("keeps the column choice when the defaults are saved again", async () => {
      await saveReplenishmentDefaults(dbA(), CUSTOM_DEFAULTS);
      expect(await getWorksheetColumns(dbA())).toEqual(["sku", "reorderPoint"]);
    });

    it("stores an empty choice as no optional columns", async () => {
      expect(await saveWorksheetColumns(dbB(), [])).toEqual([]);
      expect(await getWorksheetColumns(dbB())).toEqual([]);
    });
  });

  describe("variant rules", () => {
    it("keeps each shop's rules apart for the same Shopify ids", async () => {
      const a = dbA();
      await saveVariantRule(a, {
        variantGid: VARIANT,
        scopeKey: SHOP_SCOPE,
        values: { ...EMPTY_RULE, minimumQuantity: 5, leadTimeDays: 7 },
      });
      await saveVariantRule(a, {
        variantGid: VARIANT,
        scopeKey: LOCATION,
        values: { ...EMPTY_RULE, shelfLimitQuantity: 10 },
      });
      await saveVariantRule(dbB(), {
        variantGid: VARIANT,
        scopeKey: SHOP_SCOPE,
        values: { ...EMPTY_RULE, minimumQuantity: 99 },
      });

      expect(await getVariantRule(a, VARIANT, SHOP_SCOPE)).toEqual({
        ...EMPTY_RULE,
        minimumQuantity: 5,
        leadTimeDays: 7,
      });
      expect(await getVariantRule(dbB(), VARIANT, SHOP_SCOPE)).toEqual({
        ...EMPTY_RULE,
        minimumQuantity: 99,
      });
      expect(await getVariantRule(dbB(), VARIANT, LOCATION)).toEqual(
        EMPTY_RULE,
      );

      const shopWide = await loadEffectiveRules(
        a,
        [VARIANT, OTHER_VARIANT],
        SHOP_SCOPE,
      );
      expect([...shopWide.keys()]).toEqual([VARIANT]);
      expect(shopWide.get(VARIANT)).toEqual({
        ...EMPTY_RULE,
        minimumQuantity: 5,
        leadTimeDays: 7,
        leadTimeFromShopScope: false,
      });

      // The location rule keeps its own quantities and borrows only the lead time.
      const atLocation = await loadEffectiveRules(a, [VARIANT], LOCATION);
      expect(atLocation.get(VARIANT)).toEqual({
        ...EMPTY_RULE,
        shelfLimitQuantity: 10,
        leadTimeDays: 7,
        leadTimeFromShopScope: true,
      });

      // Shop B's shop-wide rule has no lead time, so nothing applies at the location.
      expect((await loadEffectiveRules(dbB(), [VARIANT], LOCATION)).size).toBe(
        0,
      );
    });

    it("refuses to address another shop's rule through a unique selector", async () => {
      await expect(
        dbA().replenishmentVariantRule.update({
          where: {
            shopId_variantGid_scopeKey: {
              shopId: shopBId,
              variantGid: VARIANT,
              scopeKey: SHOP_SCOPE,
            },
          },
          data: { minimumQuantity: 1 },
        }),
      ).rejects.toThrow();
      const [bRule] = await ruleRows(shopBId);
      expect(bRule.minimumQuantity).toBe(99);
    });

    it("requires a live variant and location before saving values", async () => {
      const values = { ...EMPTY_RULE, minimumQuantity: 3 };
      await expect(
        saveVariantRule(dbA(), {
          variantGid: "gid://shopify/ProductVariant/404",
          scopeKey: SHOP_SCOPE,
          values,
        }),
      ).rejects.toMatchObject({ code: "variant_not_found" });
      await expect(
        saveVariantRule(dbA(), {
          variantGid: OTHER_VARIANT,
          scopeKey: "gid://shopify/Location/404",
          values,
        }),
      ).rejects.toMatchObject({ code: "location_not_found" });
      await expect(
        saveVariantRule(dbA(), {
          variantGid: OTHER_VARIANT,
          scopeKey: "default",
          values,
        }),
      ).rejects.toBeInstanceOf(ReplenishmentRuleError);

      const scopes = (await ruleRows(shopAId)).map(
        (r) => `${r.variantGid} ${r.scopeKey}`,
      );
      expect(scopes.sort()).toEqual(
        [`${VARIANT} ${LOCATION}`, `${VARIANT} ${SHOP_SCOPE}`].sort(),
      );
    });

    it("deletes the rule when every value is cleared", async () => {
      expect(
        await saveVariantRule(dbA(), {
          variantGid: VARIANT,
          scopeKey: LOCATION,
          values: EMPTY_RULE,
        }),
      ).toBe("cleared");
      expect((await ruleRows(shopAId)).map((r) => r.scopeKey)).toEqual([
        SHOP_SCOPE,
      ]);

      // Clearing a rule that isn't there, or for a variant no longer synced, is harmless.
      expect(
        await saveVariantRule(dbA(), {
          variantGid: "gid://shopify/ProductVariant/404",
          scopeKey: SHOP_SCOPE,
          values: EMPTY_RULE,
        }),
      ).toBe("cleared");
      expect(await ruleRows(shopBId)).toHaveLength(1);
    });

    it("keeps one rule when two first saves race", async () => {
      const save = (minimumQuantity: number) =>
        saveVariantRule(dbB(), {
          variantGid: OTHER_VARIANT,
          scopeKey: LOCATION,
          values: { ...EMPTY_RULE, minimumQuantity },
        });
      expect(await Promise.all([save(1), save(2), save(3)])).toEqual([
        "saved",
        "saved",
        "saved",
      ]);
      const rows = (await ruleRows(shopBId)).filter(
        (r) => r.variantGid === OTHER_VARIANT,
      );
      expect(rows).toHaveLength(1);
      expect([1, 2, 3]).toContain(rows[0].minimumQuantity);
    });
  });

  describe("database constraints", () => {
    async function insertAs(shopId: string, sql: string, params: unknown[]) {
      return withRuntimePg(async (client) => {
        await client.query("BEGIN");
        try {
          await client.query(
            `SELECT set_config('stocky.current_shop_id', $1, true)`,
            [shopId],
          );
          await client.query(
            `SELECT set_config('stocky.tenant_context_version', $1, true)`,
            [TENANT_DB_CONTEXT_VERSION],
          );
          return await client.query(sql, params);
        } finally {
          await client.query("ROLLBACK");
        }
      });
    }

    const insertRule = (
      shopId: string,
      fields: {
        variantGid?: string;
        scopeKey?: string;
        minimumQuantity?: number | null;
        leadTimeDays?: number | null;
      },
    ) =>
      insertAs(
        shopId,
        `INSERT INTO "ReplenishmentVariantRule"
           ("id", "shopId", "variantGid", "scopeKey", "minimumQuantity", "leadTimeDays", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [
          "rule-check",
          shopId,
          fields.variantGid ?? OTHER_VARIANT,
          fields.scopeKey ?? SHOP_SCOPE,
          fields.minimumQuantity === undefined ? 1 : fields.minimumQuantity,
          fields.leadTimeDays ?? null,
        ],
      );

    it("accepts a well-formed rule from its own shop", async () => {
      const result = await insertRule(shopAId, {});
      expect(result.rowCount).toBe(1);
    });

    it("rejects rules the forms would never produce", async () => {
      const cases: Array<[Parameters<typeof insertRule>[1], RegExp]> = [
        [{ minimumQuantity: null }, /not_empty_check/],
        [{ minimumQuantity: -1 }, /quantities_check/],
        [{ minimumQuantity: 10_000_001 }, /quantities_check/],
        [{ leadTimeDays: 366 }, /lead_time_check/],
        [{ scopeKey: "default" }, /scope_key_check/],
        [{ variantGid: "7001" }, /variant_gid_check/],
      ];
      for (const [fields, constraint] of cases) {
        await expect(insertRule(shopAId, fields)).rejects.toThrow(constraint);
      }
    });

    it("rejects a rule written into another shop", async () => {
      await expect(
        withRuntimePg(async (client) => {
          await client.query("BEGIN");
          try {
            await client.query(
              `SELECT set_config('stocky.current_shop_id', $1, true)`,
              [shopAId],
            );
            await client.query(
              `SELECT set_config('stocky.tenant_context_version', $1, true)`,
              [TENANT_DB_CONTEXT_VERSION],
            );
            return await client.query(
              `INSERT INTO "ReplenishmentVariantRule" ("id", "shopId", "variantGid", "scopeKey", "minimumQuantity", "updatedAt")
               VALUES ('rule-foreign', $1, $2, 'SHOP', 1, now())`,
              [shopBId, OTHER_VARIANT],
            );
          } finally {
            await client.query("ROLLBACK");
          }
        }),
      ).rejects.toThrow(/row-level security/);
    });

    it("rejects settings outside the supported ranges", async () => {
      const insertSettings = (column: string, value: unknown) =>
        insertAs(
          shopAId,
          `INSERT INTO "ReplenishmentSettings" ("id", "shopId", "${column}", "updatedAt")
           VALUES ('settings-check', $1, $2, now())`,
          [shopAId, value],
        );
      const cases: Array<[string, unknown, RegExp]> = [
        ["defaultMethod", "CUSTOM_RANGE", /default_method_check/],
        ["defaultMethod", "TARGET_STOCK_LEVEL", /target_required_check/],
        ["sampleDays", 0, /sample_days_check/],
        ["suggestDays", 366, /suggest_days_check/],
        ["targetQuantity", -5, /target_quantity_check/],
        ["defaultLeadTimeDays", 400, /default_lead_time_check/],
      ];
      for (const [column, value, constraint] of cases) {
        await expect(insertSettings(column, value)).rejects.toThrow(constraint);
      }
    });
  });
});
