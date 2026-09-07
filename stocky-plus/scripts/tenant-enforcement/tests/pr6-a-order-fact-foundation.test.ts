/**
 * PR6-A order / refund fact foundation — disposable PostgreSQL 16 tests.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import {
  acquireOrderIdentityAdvisoryLock,
  type OrderLockQueryRaw,
} from "../../../app/lib/order-facts/advisory-lock";
import {
  ORDER_OBSERVATION_GEN_SEQ,
  ORDER_OBSERVATION_MAX_LEASE_DURATION_MS,
} from "../../../app/lib/order-facts/constants";
import { deriveOrderLockKey } from "../../../app/lib/order-facts/lock-key";
import {
  CHILD_MERCHANT_MODELS,
  DIRECT_MERCHANT_MODELS,
  MERCHANT_DELEGATE_NAMES,
  MERCHANT_OWNED_MODELS,
  PRE_PR6_A_CHILD_MERCHANT_MODEL_COUNT,
  PRE_PR6_A_DIRECT_MERCHANT_MODEL_COUNT,
  PR6_A_CHILD_MERCHANT_MODELS,
  PR6_A_DIRECT_MERCHANT_MODELS,
} from "../../../app/tenant/models";
import { getMigrationClient, getRuntimeClient } from "../connection";
import {
  COMPOSITE_FOREIGN_KEYS,
  ENFORCEMENT_CONTEXT_VERSION,
  EXPECTED_MERCHANT_TABLE_COUNT,
  MERCHANT_SQL_TABLES,
  MERCHANT_TABLES,
  ORDER_OBSERVATION_LIFECYCLE_GUARD_FN,
  ORDER_OBSERVATION_SET_LEASE_FN,
  PRE_PR6_A_MERCHANT_TABLE_COUNT,
  PR6_A_ADDED_MERCHANT_TABLE_COUNT,
} from "../manifest";
import { verifyRoles } from "../roles";
import {
  CONTROL_PLANE_SHOP_COLUMNS,
  CONTROL_PLANE_SHOP_SELECT_ONLY_COLUMNS,
  provisionControlPlaneRole,
  verifyControlPlaneRole,
} from "../../sync-control-plane/roles";
import { verifyEnforcement, verifyImmutabilityOnly, verifyRlsOnly } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

const PR6_A_TABLES = [
  "ShopifyOrderFact",
  "ShopifyOrderLineFact",
  "ShopifyOrderRefundFact",
  "OrderFactObservationInFlight",
  "ShopifyOrderRefundLineFact",
  "ShopifyOrderAdjustmentFact",
  "ShopifyOrderAgreementFact",
  "ShopifyOrderAgreementSaleFact",
  "ShopifyOrderRefundTransactionFact",
] as const;

const PR6_A_DIRECT_TABLES = [
  "ShopifyOrderFact",
  "ShopifyOrderLineFact",
  "ShopifyOrderRefundFact",
  "OrderFactObservationInFlight",
] as const;

function asQueryRaw(client: Client): OrderLockQueryRaw {
  return {
    async $queryRaw(strings, ...values) {
      let text = "";
      const params: unknown[] = [];
      strings.forEach((part, i) => {
        text += part;
        if (i < values.length) {
          params.push(values[i]);
          text += `$${params.length}`;
        }
      });
      const result = await client.query(text, params);
      return result.rows;
    },
  };
}

async function setTenant(client: Client, shopId: string): Promise<void> {
  await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
    shopId,
  ]);
  await client.query(
    `SELECT set_config('stocky.tenant_context_version', $1, true)`,
    [ENFORCEMENT_CONTEXT_VERSION],
  );
}

const LINEAGE_SQL = `
  "existenceState", "existenceKind", "existenceObservedAt",
  "sourceKind", "createdAt", "updatedAt"
`;
const LINEAGE_VALUES = `
  'LIVE', 'LIVE_REFETCH', CLOCK_TIMESTAMP(),
  'INCREMENTAL_REFETCH', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
`;

async function insertOrder(
  client: Client,
  shopId: string,
  id: string,
  gid: string,
): Promise<void> {
  await client.query(
    `INSERT INTO "ShopifyOrderFact" (
       id, "shopId", "shopifyGid", name, closed, edited, test, confirmed,
       "shopCurrencyCode", "taxesIncluded", ${LINEAGE_SQL}
     ) VALUES (
       $1, $2, $3, '#1001', false, false, false, true,
       'USD', true, ${LINEAGE_VALUES}
     )`,
    [id, shopId, gid],
  );
}

async function insertRefund(
  client: Client,
  shopId: string,
  id: string,
  gid: string,
  orderGid: string,
): Promise<void> {
  await client.query(
    `INSERT INTO "ShopifyOrderRefundFact" (
       id, "shopId", "shopifyGid", "shopifyOrderGid", ${LINEAGE_SQL}
     ) VALUES (
       $1, $2, $3, $4, ${LINEAGE_VALUES}
     )`,
    [id, shopId, gid, orderGid],
  );
}

describe.sequential("PR6-A order / refund fact foundation", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const shopA = await prisma.shop.create({
      data: { myshopifyDomain: "pr6-a-a.myshopify.com" },
    });
    const shopB = await prisma.shop.create({
      data: { myshopifyDomain: "pr6-a-b.myshopify.com" },
    });
    shopAId = shopA.id;
    shopBId = shopB.id;
  }, 600_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("derives DIRECT/CHILD/merchant inventories from the frozen nine-model add", () => {
    expect(PR6_A_DIRECT_MERCHANT_MODELS).toHaveLength(4);
    expect(PR6_A_CHILD_MERCHANT_MODELS).toHaveLength(5);
    expect(DIRECT_MERCHANT_MODELS).toHaveLength(
      PRE_PR6_A_DIRECT_MERCHANT_MODEL_COUNT + PR6_A_DIRECT_MERCHANT_MODELS.length,
    );
    expect(CHILD_MERCHANT_MODELS).toHaveLength(
      PRE_PR6_A_CHILD_MERCHANT_MODEL_COUNT + PR6_A_CHILD_MERCHANT_MODELS.length,
    );
    expect(MERCHANT_OWNED_MODELS).toHaveLength(
      DIRECT_MERCHANT_MODELS.length + CHILD_MERCHANT_MODELS.length,
    );
    expect(EXPECTED_MERCHANT_TABLE_COUNT).toBe(
      PRE_PR6_A_MERCHANT_TABLE_COUNT + PR6_A_ADDED_MERCHANT_TABLE_COUNT,
    );
    expect(MERCHANT_TABLES).toHaveLength(EXPECTED_MERCHANT_TABLE_COUNT);
    expect(MERCHANT_SQL_TABLES).toHaveLength(EXPECTED_MERCHANT_TABLE_COUNT);
    expect(DIRECT_MERCHANT_MODELS).toHaveLength(24);
    expect(CHILD_MERCHANT_MODELS).toHaveLength(11);
    expect(MERCHANT_OWNED_MODELS).toHaveLength(35);
  });

  it("registers each approved PR6-A merchant table exactly once with delegates", () => {
    const names = MERCHANT_TABLES.map((t) => t.prismaModel);
    for (const table of PR6_A_TABLES) {
      expect(names.filter((n) => n === table)).toHaveLength(1);
      expect(MERCHANT_SQL_TABLES).toContain(table);
      expect(MERCHANT_DELEGATE_NAMES[table as keyof typeof MERCHANT_DELEGATE_NAMES]).toBeTruthy();
    }
    for (const model of PR6_A_DIRECT_TABLES) {
      expect(DIRECT_MERCHANT_MODELS).toContain(model);
      expect(CHILD_MERCHANT_MODELS).not.toContain(model);
    }
    expect(names).not.toContain("ShopifyOrderShippingLineFact");
  });

  it("enforcement / RLS / immutability / role inventory succeed", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      expect((await verifyRlsOnly(client)).ok).toBe(true);
      expect((await verifyImmutabilityOnly(client)).ok).toBe(true);
      expect((await verifyEnforcement(client)).ok).toBe(true);
      const roles = await verifyRoles(client);
      expect(roles.ok).toBe(true);
      expect((await verifyControlPlaneRole(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("control-plane SELECT-only Shop timezone/currency so Prisma RETURNING * works", async () => {
    const migration = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const provisioned = await provisionControlPlaneRole(migration, {
        apply: true,
        password: process.env.STOCKY_CONTROL_PLANE_ROLE_PASSWORD,
      });
      expect(provisioned.ok).toBe(true);
      const verified = await verifyControlPlaneRole(migration);
      expect(verified.errors).toEqual([]);
      expect(verified.ok).toBe(true);

      const role =
        process.env.STOCKY_CONTROL_PLANE_ROLE?.trim() || "stocky_control_plane";
      for (const col of CONTROL_PLANE_SHOP_COLUMNS) {
        const select = await migration.query<{ has: boolean }>(
          `SELECT has_column_privilege($1, format('%I.%I', 'public', 'Shop')::regclass, $2, 'SELECT') AS has`,
          [role, col],
        );
        const update = await migration.query<{ has: boolean }>(
          `SELECT has_column_privilege($1, format('%I.%I', 'public', 'Shop')::regclass, $2, 'UPDATE') AS has`,
          [role, col],
        );
        expect(select.rows[0]?.has, col).toBe(true);
        expect(update.rows[0]?.has, col).toBe(true);
      }
      for (const col of CONTROL_PLANE_SHOP_SELECT_ONLY_COLUMNS) {
        const select = await migration.query<{ has: boolean }>(
          `SELECT has_column_privilege($1, format('%I.%I', 'public', 'Shop')::regclass, $2, 'SELECT') AS has`,
          [role, col],
        );
        const update = await migration.query<{ has: boolean }>(
          `SELECT has_column_privilege($1, format('%I.%I', 'public', 'Shop')::regclass, $2, 'UPDATE') AS has`,
          [role, col],
        );
        expect(select.rows[0]?.has, col).toBe(true);
        expect(update.rows[0]?.has, col).toBe(false);
      }
    } finally {
      await migration.end();
    }

    const controlUrl = process.env.DATABASE_CONTROL_PLANE_URL;
    if (!controlUrl) {
      throw new Error("DATABASE_CONTROL_PLANE_URL is required");
    }
    const control = new Client({ connectionString: controlUrl });
    await control.connect();
    try {
      const returned = await control.query<{ id: string; ianaTimezone: string | null }>(
        `UPDATE "Shop"
         SET "processingEnabled" = "processingEnabled"
         WHERE id = $1
         RETURNING id, "ianaTimezone"`,
        [shopAId],
      );
      expect(returned.rows).toHaveLength(1);
      expect(returned.rows[0]?.id).toBe(shopAId);
      await expect(
        control.query(
          `UPDATE "Shop" SET "ianaTimezone" = 'Etc/UTC' WHERE id = $1`,
          [shopAId],
        ),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        control.query(
          `UPDATE "Shop" SET "currencyCode" = 'USD' WHERE id = $1`,
          [shopAId],
        ),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await control.end();
    }
  });

  it("forces RLS, denies BYPASSRLS/ownership, and grants only DML on new tables", async () => {
    const migration = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const runtimeRole = process.env.STOCKY_RUNTIME_ROLE || "stocky_runtime";
      const bypass = await migration.query<{ rolbypassrls: boolean }>(
        `SELECT rolbypassrls FROM pg_roles WHERE rolname = $1`,
        [runtimeRole],
      );
      expect(bypass.rows[0]?.rolbypassrls).toBe(false);

      for (const table of PR6_A_TABLES) {
        const rls = await migration.query<{
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
          tableowner: string;
        }>(
          `SELECT c.relrowsecurity, c.relforcerowsecurity, r.rolname AS tableowner
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_roles r ON r.oid = c.relowner
           WHERE n.nspname = 'public' AND c.relname = $1`,
          [table],
        );
        expect(rls.rows[0]?.relrowsecurity).toBe(true);
        expect(rls.rows[0]?.relforcerowsecurity).toBe(true);
        expect(rls.rows[0]?.tableowner).not.toBe(runtimeRole);

        for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const) {
          const has = await migration.query<{ has: boolean }>(
            `SELECT has_table_privilege($1, $2, $3) AS has`,
            [runtimeRole, `public."${table}"`, priv],
          );
          expect(has.rows[0]?.has, `${table} ${priv}`).toBe(true);
        }
        const publicSel = await migration.query<{ has: boolean }>(
          `SELECT has_table_privilege('public', $1, 'SELECT') AS has`,
          [`public."${table}"`],
        );
        expect(publicSel.rows[0]?.has).toBe(false);
      }

      const dataIssue = await migration.query<{ has: boolean }>(
        `SELECT has_table_privilege($1, 'public."DataIssue"', 'INSERT') AS has`,
        [runtimeRole],
      );
      expect(dataIssue.rows[0]?.has).toBe(false);
    } finally {
      await migration.end();
    }
  });

  it("keeps observation sequence USAGE-only and denies SELECT/UPDATE/setval/PUBLIC", async () => {
    const runtime = await getRuntimeClient();
    const migration = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const seq = await migration.query<{
        cycle: boolean;
      }>(
        `SELECT cycle FROM pg_sequences
         WHERE schemaname = 'public' AND sequencename = $1`,
        [ORDER_OBSERVATION_GEN_SEQ],
      );
      expect(seq.rows[0]?.cycle).toBe(false);

      await expect(
        runtime.query(`SELECT nextval($1::regclass)`, [ORDER_OBSERVATION_GEN_SEQ]),
      ).resolves.toBeTruthy();
      await expect(
        runtime.query(`SELECT setval($1::regclass, 1, false)`, [
          ORDER_OBSERVATION_GEN_SEQ,
        ]),
      ).rejects.toThrow();
      await expect(
        runtime.query(`SELECT last_value FROM ${ORDER_OBSERVATION_GEN_SEQ}`),
      ).rejects.toThrow();

      const publicUsage = await migration.query<{ has: boolean }>(
        `SELECT has_sequence_privilege('public', $1, 'USAGE') AS has`,
        [`public.${ORDER_OBSERVATION_GEN_SEQ}`],
      );
      expect(publicUsage.rows[0]?.has).toBe(false);
    } finally {
      await runtime.end();
      await migration.end();
    }
  });

  it("every new merchant table has non-null immutable shopId and tenant composite FKs", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const cols = await client.query<{ table_name: string; is_nullable: string }>(
        `SELECT table_name, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND column_name = 'shopId'
           AND table_name = ANY($1::text[])`,
        [PR6_A_TABLES],
      );
      expect(cols.rows).toHaveLength(PR6_A_TABLES.length);
      expect(cols.rows.every((r) => r.is_nullable === "NO")).toBe(true);

      const fkNames = COMPOSITE_FOREIGN_KEYS.filter((fk) =>
        (PR6_A_TABLES as readonly string[]).includes(fk.childTable),
      ).map((fk) => fk.name);
      expect(fkNames).toHaveLength(6);
      const present = await client.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint
         WHERE contype = 'f' AND conname = ANY($1::text[])
         ORDER BY conname`,
        [fkNames],
      );
      expect(present.rows.map((r) => r.conname).sort()).toEqual(
        [...fkNames].sort(),
      );
    } finally {
      await client.end();
    }
  });

  it("Shop timezone/currency are nullable-first with no fake default", async () => {
    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: shopAId },
    });
    expect(shop.ianaTimezone).toBeNull();
    expect(shop.currencyCode).toBeNull();
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const cols = await client.query<{
        column_name: string;
        column_default: string | null;
        is_nullable: string;
      }>(
        `SELECT column_name, column_default, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'Shop'
           AND column_name IN ('ianaTimezone', 'currencyCode')
         ORDER BY column_name`,
      );
      expect(cols.rows).toHaveLength(2);
      for (const row of cols.rows) {
        expect(row.is_nullable).toBe("YES");
        expect(row.column_default).toBeNull();
      }
    } finally {
      await client.end();
    }
  });

  it("persists exact NUMERIC(20,6) money and independent currencies", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertOrder(
        runtime,
        shopAId,
        "ord-money",
        "gid://shopify/Order/money",
      );
      await runtime.query(
        `UPDATE "ShopifyOrderFact"
         SET "originalTotalShopAmount" = $1,
             "originalTotalShopCurrencyCode" = 'USD',
             "originalTotalPresentmentAmount" = $2,
             "originalTotalPresentmentCurrencyCode" = 'EUR'
         WHERE id = 'ord-money'`,
        ["1.234567", "9.000000"],
      );
      const row = await runtime.query<{
        originalTotalShopAmount: string;
        originalTotalShopCurrencyCode: string;
        originalTotalPresentmentAmount: string;
        originalTotalPresentmentCurrencyCode: string;
      }>(
        `SELECT "originalTotalShopAmount"::text AS "originalTotalShopAmount",
                "originalTotalShopCurrencyCode",
                "originalTotalPresentmentAmount"::text AS "originalTotalPresentmentAmount",
                "originalTotalPresentmentCurrencyCode"
         FROM "ShopifyOrderFact" WHERE id = 'ord-money'`,
      );
      expect(row.rows[0]?.originalTotalShopAmount).toBe("1.234567");
      expect(row.rows[0]?.originalTotalShopCurrencyCode).toBe("USD");
      expect(row.rows[0]?.originalTotalPresentmentAmount).toBe("9.000000");
      expect(row.rows[0]?.originalTotalPresentmentCurrencyCode).toBe("EUR");
      await runtime.query("COMMIT");

      const migration = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        const numeric = await migration.query<{
          numeric_precision: number;
          numeric_scale: number;
        }>(
          `SELECT numeric_precision, numeric_scale
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'ShopifyOrderFact'
             AND column_name = 'originalTotalShopAmount'`,
        );
        expect(numeric.rows[0]?.numeric_precision).toBe(20);
        expect(numeric.rows[0]?.numeric_scale).toBe(6);
      } finally {
        await migration.end();
      }
    } finally {
      await runtime.end();
    }
  });

  it("isolates identical Order and Refund GIDs across shops", async () => {
    const runtime = await getRuntimeClient();
    const gid = "gid://shopify/Order/shared";
    const refundGid = "gid://shopify/Refund/shared";
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertOrder(runtime, shopAId, "ord-a", gid);
      await insertRefund(runtime, shopAId, "ref-a", refundGid, gid);
      await runtime.query("COMMIT");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopBId);
      await insertOrder(runtime, shopBId, "ord-b", gid);
      await insertRefund(runtime, shopBId, "ref-b", refundGid, gid);
      const orders = await runtime.query(
        `SELECT id FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(orders.rowCount).toBe(1);
      expect(orders.rows[0].id).toBe("ord-b");
      const refunds = await runtime.query(
        `SELECT id FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      );
      expect(refunds.rowCount).toBe(1);
      expect(refunds.rows[0].id).toBe("ref-b");
      await runtime.query("COMMIT");
    } finally {
      await runtime.end();
    }
  });

  it("rejects foreign shopId INSERT, cross-shop child FK, and shopId reassignment", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await expect(
        insertOrder(runtime, shopBId, "ord-cross", "gid://shopify/Order/cross"),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertOrder(
        runtime,
        shopAId,
        "ord-parent",
        "gid://shopify/Order/parent",
      );
      await runtime.query("COMMIT");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopBId);
      await expect(
        runtime.query(
          `INSERT INTO "ShopifyOrderLineFact" (
             id, "shopId", "shopifyGid", "shopifyOrderGid",
             quantity, "currentQuantity", "refundableQuantity",
             "isGiftCard", title, "orderTest", "orderShopCurrencyCode",
             ${LINEAGE_SQL}
           ) VALUES (
             'line-cross', $1, 'gid://shopify/LineItem/cross',
             'gid://shopify/Order/parent',
             1, 1, 1, false, 'line', false, 'USD',
             ${LINEAGE_VALUES}
           )`,
          [shopBId],
        ),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await expect(
        runtime.query(
          `UPDATE "ShopifyOrderFact" SET "shopId" = $1 WHERE id = 'ord-parent'`,
          [shopBId],
        ),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");
    } finally {
      await runtime.end();
    }
  });

  it("denies missing tenant context on new tables", async () => {
    const runtime = await getRuntimeClient();
    try {
      const sel = await runtime.query(
        `SELECT COUNT(*)::int AS c FROM "ShopifyOrderFact"`,
      );
      expect(sel.rows[0].c).toBe(0);
      await expect(
        insertOrder(
          runtime,
          shopAId,
          "ord-nocontext",
          "gid://shopify/Order/nocontext",
        ),
      ).rejects.toThrow();
    } finally {
      await runtime.end();
    }
  });

  it("rejects duplicate Shopify GID in one shop and allows the same GID in another", async () => {
    const runtime = await getRuntimeClient();
    const gid = "gid://shopify/Order/dup";
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertOrder(runtime, shopAId, "ord-dup-1", gid);
      await expect(
        insertOrder(runtime, shopAId, "ord-dup-2", gid),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertOrder(runtime, shopAId, "ord-dup-a", gid);
      await runtime.query("COMMIT");
      await runtime.query("BEGIN");
      await setTenant(runtime, shopBId);
      await insertOrder(runtime, shopBId, "ord-dup-b", gid);
      await runtime.query("COMMIT");
    } finally {
      await runtime.end();
    }
  });

  it("accepts refund-line ordinal identity when Shopify refund-line id is null", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertRefund(
        runtime,
        shopAId,
        "ref-ord",
        "gid://shopify/Refund/ordinal",
        "gid://shopify/Order/ordinal-parent",
      );
      await runtime.query(
        `INSERT INTO "ShopifyOrderRefundLineFact" (
           id, "shopId", "shopifyRefundGid", "shopifyLineItemGid",
           "refundLineOrdinal", "shopifyGid", "shopifyOrderGid",
           quantity, ${LINEAGE_SQL}
         ) VALUES (
           'rl-null-gid', $1, 'gid://shopify/Refund/ordinal',
           'gid://shopify/LineItem/1', 0, NULL,
           'gid://shopify/Order/ordinal-parent', 1, ${LINEAGE_VALUES}
         )`,
        [shopAId],
      );
      await expect(
        runtime.query(
          `INSERT INTO "ShopifyOrderRefundLineFact" (
             id, "shopId", "shopifyRefundGid", "shopifyLineItemGid",
             "refundLineOrdinal", "shopifyGid", "shopifyOrderGid",
             quantity, ${LINEAGE_SQL}
           ) VALUES (
             'rl-dup', $1, 'gid://shopify/Refund/ordinal',
             'gid://shopify/LineItem/1', 0, 'gid://shopify/RefundLineItem/x',
             'gid://shopify/Order/ordinal-parent', 1, ${LINEAGE_VALUES}
           )`,
          [shopAId],
        ),
      ).rejects.toThrow();
      await runtime.query("COMMIT");
    } finally {
      await runtime.end();
    }
  });

  it("uniques agreement sales on Sale GID, not agreement GID", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertOrder(
        runtime,
        shopAId,
        "ord-sale",
        "gid://shopify/Order/sale",
      );
      await runtime.query(
        `INSERT INTO "ShopifyOrderAgreementFact" (
           id, "shopId", "shopifyGid", "shopifyOrderGid", "happenedAt",
           "agreementTypename", ${LINEAGE_SQL}
         ) VALUES (
           'agr-1', $1, 'gid://shopify/SalesAgreement/1',
           'gid://shopify/Order/sale', CLOCK_TIMESTAMP(),
           'OrderAgreement', ${LINEAGE_VALUES}
         )`,
        [shopAId],
      );
      await runtime.query(
        `INSERT INTO "ShopifyOrderAgreementSaleFact" (
           id, "shopId", "shopifyGid", "shopifyAgreementGid", "shopifyOrderGid",
           "saleTypename", "happenedAt", ${LINEAGE_SQL}
         ) VALUES
           ('sale-1', $1, 'gid://shopify/Sale/1', 'gid://shopify/SalesAgreement/1',
            'gid://shopify/Order/sale', 'ProductSale', CLOCK_TIMESTAMP(), ${LINEAGE_VALUES}),
           ('sale-2', $1, 'gid://shopify/Sale/2', 'gid://shopify/SalesAgreement/1',
            'gid://shopify/Order/sale', 'ProductSale', CLOCK_TIMESTAMP(), ${LINEAGE_VALUES})`,
        [shopAId],
      );
      await expect(
        runtime.query(
          `INSERT INTO "ShopifyOrderAgreementSaleFact" (
             id, "shopId", "shopifyGid", "shopifyAgreementGid", "shopifyOrderGid",
             "saleTypename", "happenedAt", ${LINEAGE_SQL}
           ) VALUES (
             'sale-dup', $1, 'gid://shopify/Sale/1', 'gid://shopify/SalesAgreement/1',
             'gid://shopify/Order/sale', 'ProductSale', CLOCK_TIMESTAMP(), ${LINEAGE_VALUES}
           )`,
          [shopAId],
        ),
      ).rejects.toThrow();
      await runtime.query("COMMIT");
    } finally {
      await runtime.end();
    }
  });

  it("enforces observation lifecycle, lease bounds, and identity shape", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await expect(
        runtime.query(
          `INSERT INTO "OrderFactObservationInFlight" (
             id, "shopId", "resourceKind", "shopifyGid",
             "observationRequestGen", "observationResponseGen",
             "leaseDurationMs", "leaseExpiresAt",
             "lifecycleState", "createdAt", "updatedAt"
           ) VALUES (
             'obs-bad-active', $1, 'Order', 'gid://shopify/Order/obs',
             1, 2, 1000, TIMESTAMPTZ '1970-01-01',
             'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
          [shopAId],
        ),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await runtime.query(
        `INSERT INTO "OrderFactObservationInFlight" (
           id, "shopId", "resourceKind", "shopifyGid",
           "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
           "lifecycleState", "createdAt", "updatedAt"
         ) VALUES (
           'obs-ok', $1, 'Order', 'gid://shopify/Order/obs-ok',
           3, 1000, TIMESTAMPTZ '1970-01-01',
           'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
         )`,
        [shopAId],
      );
      const leased = await runtime.query<{ leaseExpiresAt: Date }>(
        `SELECT "leaseExpiresAt" FROM "OrderFactObservationInFlight" WHERE id = 'obs-ok'`,
      );
      expect(leased.rows[0]?.leaseExpiresAt.getTime()).toBeGreaterThan(
        Date.now() - 60_000,
      );
      await expect(
        runtime.query(
          `INSERT INTO "OrderFactObservationInFlight" (
             id, "shopId", "resourceKind", "shopifyGid",
             "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
             "lifecycleState", "createdAt", "updatedAt"
           ) VALUES (
             'obs-lease-bad', $1, 'Order', 'gid://shopify/Order/obs-lease',
             4, $2, TIMESTAMPTZ '1970-01-01',
             'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
          [shopAId, ORDER_OBSERVATION_MAX_LEASE_DURATION_MS + 1],
        ),
      ).rejects.toThrow();
      await runtime.query("COMMIT");
    } finally {
      await runtime.end();
    }
  });

  it("acquires order advisory locks with signed int32 keys inside a tenant tx", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const expected = deriveOrderLockKey({
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: "gid://shopify/Order/lock",
      });
      const acquired = await acquireOrderIdentityAdvisoryLock(
        asQueryRaw(runtime),
        {
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: "gid://shopify/Order/lock",
        },
      );
      expect(acquired.key1).toBe(expected.key1);
      expect(acquired.key2).toBe(expected.key2);
      expect(Number.isSafeInteger(acquired.key1)).toBe(true);
      await runtime.query("COMMIT");
    } finally {
      await runtime.end();
    }
  });

  it("registers order observation functions without PUBLIC/runtime EXECUTE", async () => {
    const migration = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    const runtimeRole = process.env.STOCKY_RUNTIME_ROLE || "stocky_runtime";
    try {
      for (const fn of [
        ORDER_OBSERVATION_LIFECYCLE_GUARD_FN,
        ORDER_OBSERVATION_SET_LEASE_FN,
      ]) {
        const row = await migration.query<{
          public_exec: boolean;
          runtime_exec: boolean;
        }>(
          `SELECT
             has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec,
             has_function_privilege($2, p.oid, 'EXECUTE') AS runtime_exec
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = $1`,
          [fn, runtimeRole],
        );
        expect(row.rows[0]?.public_exec).toBe(false);
        expect(row.rows[0]?.runtime_exec).toBe(false);
      }
    } finally {
      await migration.end();
    }
  });
});
