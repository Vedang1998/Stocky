/**
 * The enforcement preflight's parent-reference check on a database that
 * already holds data.
 *
 * Catalog and order facts point at their parent by Shopify GID inside the
 * shop, not by row id. The preflight used to look every parent up by row id,
 * so it counted each fact row as an orphan and refused to let enforcement be
 * applied again once a shop had synced its catalog. A table added by a later
 * migration then never received its row-level policies or runtime grants
 * (SEC-19).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Client } from "pg";
import { applyEnforcement } from "../apply";
import { getMigrationClient, getRuntimeClient } from "../connection";
import { ENFORCEMENT_CONTEXT_VERSION } from "../manifest";
import { runPreflight } from "../preflight";
import { resetSchemaAndApplyEnforcement } from "./helpers";

const FACT_COLUMNS = `"existenceState", "existenceKind", "existenceObservedAt",
  "sourceKind", "createdAt", "updatedAt"`;
const FACT_VALUES = `'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
  'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()`;

const gid = (kind: string, key: string) => `gid://shopify/${kind}/${key}`;

/** Runs `work` as the runtime role inside one shop's tenant context. */
async function asShop(
  shopId: string,
  work: (client: Client) => Promise<void>,
): Promise<void> {
  const client = await getRuntimeClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT set_config('stocky.current_shop_id', $1, true)`,
      [shopId],
    );
    await client.query(
      `SELECT set_config('stocky.tenant_context_version', $1, true)`,
      [ENFORCEMENT_CONTEXT_VERSION],
    );
    await work(client);
    await client.query("COMMIT");
  } finally {
    await client.end();
  }
}

function insertProduct(client: Client, shopId: string, key: string) {
  return client.query(
    `INSERT INTO "ShopifyProductFact" (
       id, "shopId", "shopifyGid", title, handle, tags, status, ${FACT_COLUMNS}
     ) VALUES ($1, $2, $3, 'title', 'handle', ARRAY[]::text[], 'ACTIVE', ${FACT_VALUES})`,
    [`product-${key}`, shopId, gid("Product", key)],
  );
}

function insertVariant(
  client: Client,
  shopId: string,
  key: string,
  productKey: string,
) {
  return client.query(
    `INSERT INTO "ShopifyVariantFact" (
       id, "shopId", "shopifyGid", "shopifyProductGid", title,
       "selectedOptions", "priceAmount", "currencyCode", ${FACT_COLUMNS}
     ) VALUES ($1, $2, $3, $4, 'variant', '{}'::jsonb, 1.00, 'USD', ${FACT_VALUES})`,
    [
      `variant-${key}`,
      shopId,
      gid("ProductVariant", key),
      gid("Product", productKey),
    ],
  );
}

function insertInventoryItem(
  client: Client,
  shopId: string,
  key: string,
  variantKey: string | null,
) {
  return client.query(
    `INSERT INTO "ShopifyInventoryItemFact" (
       id, "shopId", "shopifyGid", "shopifyVariantGid", tracked,
       "requiresShipping", "unitCostAccess", ${FACT_COLUMNS}
     ) VALUES ($1, $2, $3, $4, true, true, 'NULL', ${FACT_VALUES})`,
    [
      `item-${key}`,
      shopId,
      gid("InventoryItem", key),
      variantKey === null ? null : gid("ProductVariant", variantKey),
    ],
  );
}

function insertLocation(client: Client, shopId: string, key: string) {
  return client.query(
    `INSERT INTO "ShopifyLocationFact" (
       id, "shopId", "shopifyGid", name, "isActive", "fulfillsOnlineOrders",
       "shipsInventory", "isFulfillmentService", "hasActiveInventory", ${FACT_COLUMNS}
     ) VALUES ($1, $2, $3, 'loc', true, true, true, false, true, ${FACT_VALUES})`,
    [`location-${key}`, shopId, gid("Location", key)],
  );
}

function insertInventoryLevel(
  client: Client,
  shopId: string,
  key: string,
  itemKey: string,
  locationKey: string,
) {
  return client.query(
    `INSERT INTO "ShopifyInventoryLevelFact" (
       id, "shopId", "inventoryItemGid", "locationGid", ${FACT_COLUMNS}
     ) VALUES ($1, $2, $3, $4, ${FACT_VALUES})`,
    [
      `level-${key}`,
      shopId,
      gid("InventoryItem", itemKey),
      gid("Location", locationKey),
    ],
  );
}

function insertSupplier(
  client: Client,
  shopId: string,
  domain: string,
  id: string,
) {
  return client.query(
    `INSERT INTO "Supplier" (id, shop, "shopId", name, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'supplier', NOW(), NOW())`,
    [id, domain, shopId],
  );
}

function insertSupplierProduct(
  client: Client,
  shopId: string,
  id: string,
  supplierId: string,
) {
  return client.query(
    `INSERT INTO "SupplierSkuMapping" (id, "shopId", "supplierId", "shopifyVariantId")
     VALUES ($1, $2, $3, $4)`,
    [id, shopId, supplierId, gid("ProductVariant", id)],
  );
}

const DOMAIN_A = "preflight-refs-a.myshopify.com";
const DOMAIN_B = "preflight-refs-b.myshopify.com";

describe.sequential(
  "enforcement preflight: parent references on a populated database",
  () => {
    let prisma: PrismaClient;
    let shopA: string;
    let shopB: string;

    async function preflightTables(tables: string[]) {
      const client = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        const result = await runPreflight(client, { mode: "resume" });
        return Object.fromEntries(
          result.tables
            .filter((entry) => tables.includes(entry.table))
            .map((entry) => [
              entry.table,
              {
                mismatch:
                  entry.parentMismatchCount + entry.crossDomainMismatchCount,
                orphan: entry.orphanParentRefCount,
              },
            ]),
        );
      } finally {
        await client.end();
      }
    }

    beforeAll(async () => {
      ({ prisma } = await resetSchemaAndApplyEnforcement());
      shopA = (
        await prisma.shop.create({ data: { myshopifyDomain: DOMAIN_A } })
      ).id;
      shopB = (
        await prisma.shop.create({ data: { myshopifyDomain: DOMAIN_B } })
      ).id;

      // What a first catalog sync leaves behind, plus one supplier product.
      await asShop(shopA, async (client) => {
        await insertProduct(client, shopA, "a1");
        await insertVariant(client, shopA, "a1", "a1");
        await insertInventoryItem(client, shopA, "a1", "a1");
        // Shopify can report an inventory item before its variant is known.
        await insertInventoryItem(client, shopA, "a2", null);
        await insertLocation(client, shopA, "a1");
        await insertInventoryLevel(client, shopA, "a1", "a1", "a1");
        await insertSupplier(client, shopA, DOMAIN_A, "supplier-a");
        await insertSupplierProduct(client, shopA, "mapping-a", "supplier-a");
      });
      await asShop(shopB, async (client) => {
        await insertProduct(client, shopB, "b1");
        await insertSupplier(client, shopB, DOMAIN_B, "supplier-b");
      });
    }, 600_000);

    afterAll(async () => {
      await prisma?.$disconnect();
    });

    it("counts no orphan or mismatch for facts whose parent is in their own shop", async () => {
      const clean = { mismatch: 0, orphan: 0 };

      expect(
        await preflightTables([
          "ShopifyVariantFact",
          "ShopifyInventoryItemFact",
          "ShopifyInventoryLevelFact",
          "SupplierSkuMapping",
        ]),
      ).toEqual({
        ShopifyVariantFact: clean,
        ShopifyInventoryItemFact: clean,
        ShopifyInventoryLevelFact: clean,
        SupplierSkuMapping: clean,
      });
    });

    it("lets enforcement be applied again after a shop has synced its catalog", async () => {
      const client = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        const applied = await applyEnforcement(client, { apply: true });

        const refusals = new Set(
          applied.steps
            .filter((step) => step.status === "failed")
            .map((step) => step.error),
        );
        expect([...refusals]).toEqual([]);
        expect(applied.ok).toBe(true);
      } finally {
        await client.end();
      }
    }, 600_000);

    it("still reports a reference with no parent in its own shop", async () => {
      // The composite foreign keys refuse these rows, so they are set aside to
      // build the damage the preflight exists to catch before they are created.
      const owner = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        await owner.query(
          `ALTER TABLE "ShopifyVariantFact" DROP CONSTRAINT "ShopifyVariantFact_shopId_shopifyProductGid_fkey"`,
        );
        await owner.query(
          `ALTER TABLE "SupplierSkuMapping" DROP CONSTRAINT "SupplierSkuMapping_shopId_supplierId_fkey"`,
        );
      } finally {
        await owner.end();
      }
      await asShop(shopA, async (client) => {
        await insertVariant(client, shopA, "other-shop-product", "b1");
        await insertVariant(client, shopA, "no-product", "nowhere");
        await insertSupplierProduct(
          client,
          shopA,
          "mapping-other-shop",
          "supplier-b",
        );
      });

      // A GID is unique only within a shop, so a fact without a parent in its
      // own shop is an orphan even when another shop holds that GID. A row id
      // names one row, so the supplier under another shop is a tenant mismatch.
      expect(
        await preflightTables(["ShopifyVariantFact", "SupplierSkuMapping"]),
      ).toEqual({
        ShopifyVariantFact: { mismatch: 0, orphan: 2 },
        SupplierSkuMapping: { mismatch: 1, orphan: 0 },
      });
    });
  },
);
