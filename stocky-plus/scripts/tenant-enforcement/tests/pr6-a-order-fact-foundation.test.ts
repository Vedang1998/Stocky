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
  SHOP_COLUMN_UNCLASSIFIED,
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
  "existenceRequestGen", "existenceResponseGen",
  "sourceKind", "createdAt", "updatedAt"
`;
const LINEAGE_VALUES = `
  'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
  NULL, NULL,
  'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
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

const CANONICAL_EXISTENCE_TABLES = [
  "ShopifyOrderFact",
  "ShopifyOrderLineFact",
  "ShopifyOrderRefundFact",
  "ShopifyOrderRefundLineFact",
  "ShopifyOrderAdjustmentFact",
  "ShopifyOrderAgreementFact",
  "ShopifyOrderAgreementSaleFact",
  "ShopifyOrderRefundTransactionFact",
] as const;
type CanonicalExistenceTable = (typeof CANONICAL_EXISTENCE_TABLES)[number];

type ExistenceLineage = {
  existenceState: string;
  existenceKind: string;
  requestGen: number | null;
  responseGen: number | null;
  deletedAt: boolean;
  deletionSource: string | null;
  sourceKind?: string;
  existenceDiagnosticState?: string | null;
  historyWindowState?: string | null;
};

const LIVE_FULL_SYNC_LINEAGE: ExistenceLineage = {
  existenceState: "LIVE",
  existenceKind: "LIVE_FULL_SYNC_PRESENT",
  requestGen: null,
  responseGen: null,
  deletedAt: false,
  deletionSource: null,
  sourceKind: "FULL_SYNC",
};

function coherenceConstraint(table: CanonicalExistenceTable): string {
  return `${table}_existence_coherence_check`;
}

function isPgError(
  err: unknown,
): err is { code?: string; constraint?: string; message?: string } {
  return typeof err === "object" && err !== null;
}

async function expectCoherenceCheckRejected(
  client: Client,
  sql: string,
  params: unknown[],
  constraint: string,
  label: string,
): Promise<void> {
  await client.query("SAVEPOINT expect_coh");
  try {
    await client.query(sql, params);
    throw new Error(`expected CHECK rejection: ${label}`);
  } catch (err) {
    const e = isPgError(err) ? err : {};
    if (e.message?.startsWith("expected CHECK")) throw err;
    expect(e.code, `${label} sqlstate=${e.code} msg=${e.message}`).toBe("23514");
    expect(e.constraint, `${label} constraint=${e.constraint}`).toBe(constraint);
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expect_coh");
  }
}

async function insertCanonicalFact(
  client: Client,
  table: CanonicalExistenceTable,
  shopId: string,
  rowId: string,
  suffix: string,
  lineage: ExistenceLineage,
): Promise<void> {
  const orderGid = `gid://shopify/Order/${suffix}`;
  const lineGid = `gid://shopify/LineItem/${suffix}`;
  const refundGid = `gid://shopify/Refund/${suffix}`;
  const adjGid = `gid://shopify/OrderAdjustment/${suffix}`;
  const agrGid = `gid://shopify/SalesAgreement/${suffix}`;
  const saleGid = `gid://shopify/Sale/${suffix}`;
  const txnGid = `gid://shopify/OrderTransaction/${suffix}`;
  const source = lineage.sourceKind ?? "FULL_SYNC";
  const params = [
    rowId,
    shopId,
    lineage.existenceState,
    lineage.existenceKind,
    lineage.requestGen,
    lineage.responseGen,
    lineage.deletedAt,
    lineage.deletionSource,
    source,
    lineage.existenceDiagnosticState ?? null,
    lineage.historyWindowState ?? null,
  ];
  const lineageBind = `
    $3, $4, CLOCK_TIMESTAMP(), $5, $6,
    CASE WHEN $7 THEN CLOCK_TIMESTAMP() ELSE NULL END,
    $8::"OrderDeletionSource", $9, $10, $11,
    CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
  `;
  const lineageCols = `
    "existenceState", "existenceKind", "existenceObservedAt",
    "existenceRequestGen", "existenceResponseGen",
    "deletedAt", "deletionSource", "sourceKind",
    "existenceDiagnosticState", "historyWindowState",
    "createdAt", "updatedAt"
  `;

  if (table === "ShopifyOrderFact") {
    await client.query(
      `INSERT INTO "ShopifyOrderFact" (
         id, "shopId", "shopifyGid", name, closed, edited, test, confirmed,
         "shopCurrencyCode", "taxesIncluded", ${lineageCols}
       ) VALUES (
         $1, $2, '${orderGid}', '#1001', false, false, false, true,
         'USD', true, ${lineageBind}
       )`,
      params,
    );
    return;
  }
  if (table === "ShopifyOrderLineFact") {
    await client.query(
      `INSERT INTO "ShopifyOrderLineFact" (
         id, "shopId", "shopifyGid", "shopifyOrderGid",
         quantity, "currentQuantity", "refundableQuantity",
         "isGiftCard", title, "orderTest", "orderShopCurrencyCode",
         ${lineageCols}
       ) VALUES (
         $1, $2, '${lineGid}', '${orderGid}',
         1, 1, 1, false, 'line', false, 'USD',
         ${lineageBind}
       )`,
      params,
    );
    return;
  }
  if (table === "ShopifyOrderRefundFact") {
    await client.query(
      `INSERT INTO "ShopifyOrderRefundFact" (
         id, "shopId", "shopifyGid", "shopifyOrderGid", ${lineageCols}
       ) VALUES (
         $1, $2, '${refundGid}', '${orderGid}', ${lineageBind}
       )`,
      params,
    );
    return;
  }
  if (table === "ShopifyOrderRefundLineFact") {
    await client.query(
      `INSERT INTO "ShopifyOrderRefundLineFact" (
         id, "shopId", "shopifyRefundGid", "shopifyLineItemGid",
         "refundLineOrdinal", "shopifyGid", "shopifyOrderGid",
         quantity, ${lineageCols}
       ) VALUES (
         $1, $2, '${refundGid}', '${lineGid}',
         0, NULL, '${orderGid}', 1, ${lineageBind}
       )`,
      params,
    );
    return;
  }
  if (table === "ShopifyOrderAdjustmentFact") {
    await client.query(
      `INSERT INTO "ShopifyOrderAdjustmentFact" (
         id, "shopId", "shopifyGid", "shopifyRefundGid", "shopifyOrderGid",
         ${lineageCols}
       ) VALUES (
         $1, $2, '${adjGid}', '${refundGid}', '${orderGid}', ${lineageBind}
       )`,
      params,
    );
    return;
  }
  if (table === "ShopifyOrderAgreementFact") {
    await client.query(
      `INSERT INTO "ShopifyOrderAgreementFact" (
         id, "shopId", "shopifyGid", "shopifyOrderGid", "happenedAt",
         "agreementTypename", ${lineageCols}
       ) VALUES (
         $1, $2, '${agrGid}', '${orderGid}', CLOCK_TIMESTAMP(),
         'OrderAgreement', ${lineageBind}
       )`,
      params,
    );
    return;
  }
  if (table === "ShopifyOrderAgreementSaleFact") {
    await client.query(
      `INSERT INTO "ShopifyOrderAgreementSaleFact" (
         id, "shopId", "shopifyGid", "shopifyAgreementGid", "shopifyOrderGid",
         "saleTypename", "happenedAt", ${lineageCols}
       ) VALUES (
         $1, $2, '${saleGid}', '${agrGid}', '${orderGid}',
         'ProductSale', CLOCK_TIMESTAMP(), ${lineageBind}
       )`,
      params,
    );
    return;
  }
  await client.query(
    `INSERT INTO "ShopifyOrderRefundTransactionFact" (
       id, "shopId", "shopifyGid", "shopifyRefundGid", "shopifyOrderGid",
       status, "shopifyCreatedAt", ${lineageCols}
     ) VALUES (
       $1, $2, '${txnGid}', '${refundGid}', '${orderGid}',
       'SUCCESS', CLOCK_TIMESTAMP(), ${lineageBind}
     )`,
    params,
  );
}

async function ensureCanonicalParents(
  client: Client,
  table: CanonicalExistenceTable,
  shopId: string,
  suffix: string,
): Promise<void> {
  if (table === "ShopifyOrderFact" || table === "ShopifyOrderRefundFact") {
    return;
  }
  if (table === "ShopifyOrderLineFact" || table === "ShopifyOrderAgreementFact") {
    await insertCanonicalFact(
      client,
      "ShopifyOrderFact",
      shopId,
      `pord-${suffix}`,
      suffix,
      LIVE_FULL_SYNC_LINEAGE,
    );
    return;
  }
  if (
    table === "ShopifyOrderRefundLineFact" ||
    table === "ShopifyOrderAdjustmentFact" ||
    table === "ShopifyOrderRefundTransactionFact"
  ) {
    await insertCanonicalFact(
      client,
      "ShopifyOrderRefundFact",
      shopId,
      `pref-${suffix}`,
      suffix,
      LIVE_FULL_SYNC_LINEAGE,
    );
    return;
  }
  await insertCanonicalFact(
    client,
    "ShopifyOrderFact",
    shopId,
    `pord-${suffix}`,
    suffix,
    LIVE_FULL_SYNC_LINEAGE,
  );
  await insertCanonicalFact(
    client,
    "ShopifyOrderAgreementFact",
    shopId,
    `pagr-${suffix}`,
    suffix,
    LIVE_FULL_SYNC_LINEAGE,
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

  it("rejects an unclassified Shop column until privilege classification is explicit", async () => {
    const migration = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await migration.query("BEGIN");
      try {
        await migration.query(
          `ALTER TABLE "Shop" ADD COLUMN "pr6aUnclassifiedGuardCol" varchar(8)`,
        );
        const rejected = await verifyControlPlaneRole(migration);
        expect(rejected.ok).toBe(false);
        expect(rejected.errors).toContain(
          `${SHOP_COLUMN_UNCLASSIFIED}:pr6aUnclassifiedGuardCol`,
        );
        expect(rejected.errors.some((e) => e.includes("pr6aUnclassifiedGuardCol"))).toBe(
          true,
        );
      } finally {
        await migration.query("ROLLBACK");
      }
      const restored = await verifyControlPlaneRole(migration);
      expect(restored.errors).toEqual([]);
      expect(restored.ok).toBe(true);
      const role =
        process.env.STOCKY_CONTROL_PLANE_ROLE?.trim() || "stocky_control_plane";
      expect(CONTROL_PLANE_SHOP_COLUMNS).toHaveLength(9);
      expect(CONTROL_PLANE_SHOP_SELECT_ONLY_COLUMNS).toEqual([
        "ianaTimezone",
        "currencyCode",
      ]);
      for (const col of CONTROL_PLANE_SHOP_COLUMNS) {
        const update = await migration.query<{ has: boolean }>(
          `SELECT has_column_privilege($1, format('%I.%I', 'public', 'Shop')::regclass, $2, 'UPDATE') AS has`,
          [role, col],
        );
        expect(update.rows[0]?.has, col).toBe(true);
      }
      for (const col of CONTROL_PLANE_SHOP_SELECT_ONLY_COLUMNS) {
        const update = await migration.query<{ has: boolean }>(
          `SELECT has_column_privilege($1, format('%I.%I', 'public', 'Shop')::regclass, $2, 'UPDATE') AS has`,
          [role, col],
        );
        expect(update.rows[0]?.has, col).toBe(false);
      }
    } finally {
      await migration.end();
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

  it("installs validated existence-evidence CHECKs on all eight canonical tables only", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const rows = await client.query<{
        table_name: string;
        conname: string;
        convalidated: boolean;
      }>(
        `SELECT c.relname AS table_name, p.conname, p.convalidated
         FROM pg_constraint p
         JOIN pg_class c ON c.oid = p.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND p.contype = 'c'
           AND c.relname = ANY($1::text[])
           AND p.conname = c.relname || '_existence_coherence_check'
         ORDER BY c.relname`,
        [CANONICAL_EXISTENCE_TABLES],
      );
      expect(rows.rows.map((r) => r.table_name)).toEqual(
        [...CANONICAL_EXISTENCE_TABLES].sort(),
      );
      expect(rows.rows).toHaveLength(8);
      for (const row of rows.rows) {
        expect(row.convalidated, row.table_name).toBe(true);
        expect(row.conname).toBe(`${row.table_name}_existence_coherence_check`);
      }
      const observation = await client.query(
        `SELECT 1 FROM pg_constraint p
         JOIN pg_class c ON c.oid = p.conrelid
         WHERE c.relname = 'OrderFactObservationInFlight'
           AND p.conname LIKE '%existence_coherence_check'`
      );
      expect(observation.rowCount).toBe(0);
    } finally {
      await client.end();
    }
  });

  it("rejects the six reported impossible states plus pair/deletion holes on INSERT and UPDATE (owner and tenant runtime)", async () => {
    const invalid: Array<{ name: string; lineage: ExistenceLineage }> = [
      {
        name: "live_plus_absent_confirmed_kind_with_deleted_at",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "ABSENT_CONFIRMED_QUERY",
          requestGen: 1,
          responseGen: 2,
          deletedAt: true,
          deletionSource: "CONFIRMED_QUERY",
        },
      },
      {
        name: "live_refetch_with_tombstone",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "LIVE_REFETCH",
          requestGen: 1,
          responseGen: 2,
          deletedAt: true,
          deletionSource: "CONFIRMED_QUERY",
        },
      },
      {
        name: "deleted_at_without_deletion_source",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "LIVE_FULL_SYNC_PRESENT",
          requestGen: null,
          responseGen: null,
          deletedAt: true,
          deletionSource: null,
        },
      },
      {
        name: "inaccessible_with_deleted_at",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "INACCESSIBLE_HISTORY_WINDOW",
          requestGen: null,
          responseGen: null,
          deletedAt: true,
          deletionSource: null,
        },
      },
      {
        name: "absent_confirmed_null_gens",
        lineage: {
          existenceState: "ABSENT",
          existenceKind: "ABSENT_CONFIRMED_QUERY",
          requestGen: null,
          responseGen: null,
          deletedAt: true,
          deletionSource: "CONFIRMED_QUERY",
        },
      },
      {
        name: "reversed_gens",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "LIVE_REFETCH",
          requestGen: 999,
          responseGen: 1,
          deletedAt: false,
          deletionSource: null,
        },
      },
      {
        name: "half_null_request",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "LIVE_REFETCH",
          requestGen: 1,
          responseGen: null,
          deletedAt: false,
          deletionSource: null,
        },
      },
      {
        name: "half_null_response",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "LIVE_REFETCH",
          requestGen: null,
          responseGen: 2,
          deletedAt: false,
          deletionSource: null,
        },
      },
      {
        name: "equal_gens",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "LIVE_REFETCH",
          requestGen: 5,
          responseGen: 5,
          deletedAt: false,
          deletionSource: null,
        },
      },
      {
        name: "absent_confirmed_missing_deleted_at",
        lineage: {
          existenceState: "ABSENT",
          existenceKind: "ABSENT_CONFIRMED_QUERY",
          requestGen: 1,
          responseGen: 2,
          deletedAt: false,
          deletionSource: "CONFIRMED_QUERY",
        },
      },
      {
        name: "unverified_missing_deleted_at",
        lineage: {
          existenceState: "ABSENT",
          existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
          requestGen: null,
          responseGen: null,
          deletedAt: false,
          deletionSource: "WEBHOOK",
        },
      },
      {
        name: "unverified_non_webhook_source",
        lineage: {
          existenceState: "ABSENT",
          existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
          requestGen: null,
          responseGen: null,
          deletedAt: true,
          deletionSource: "CONFIRMED_QUERY",
        },
      },
    ];

    const owner = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    const runtime = await getRuntimeClient();
    let insertRejects = 0;
    let updateRejects = 0;
    try {
      await owner.query("BEGIN");
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const roles: Array<{ name: "owner" | "runtime"; client: Client }> = [
        { name: "owner", client: owner },
        { name: "runtime", client: runtime },
      ];
      for (const table of CANONICAL_EXISTENCE_TABLES) {
        const constraint = coherenceConstraint(table);
        for (const scenario of invalid) {
          for (const role of roles) {
            const suffix = `${CANONICAL_EXISTENCE_TABLES.indexOf(table)}-${scenario.name}-${role.name}`.replace(
              /[^a-zA-Z0-9-]/g,
              "",
            );
            await ensureCanonicalParents(role.client, table, shopAId, `i-${suffix}`);
            await role.client.query("SAVEPOINT coh_ins");
            try {
              await insertCanonicalFact(
                role.client,
                table,
                shopAId,
                `ins-${suffix}`,
                `i-${suffix}`,
                scenario.lineage,
              );
              throw new Error(
                `expected INSERT CHECK rejection: ${table} ${scenario.name} ${role.name}`,
              );
            } catch (err) {
              const e = isPgError(err) ? err : {};
              if (e.message?.startsWith("expected INSERT")) throw err;
              expect(
                e.code,
                `${table} INSERT ${scenario.name} ${role.name} sqlstate=${e.code} msg=${e.message}`,
              ).toBe("23514");
              expect(
                e.constraint,
                `${table} INSERT ${scenario.name} ${role.name}`,
              ).toBe(constraint);
              insertRejects += 1;
            } finally {
              await role.client.query("ROLLBACK TO SAVEPOINT coh_ins");
            }

            await ensureCanonicalParents(role.client, table, shopAId, `u-${suffix}`);
            await insertCanonicalFact(
              role.client,
              table,
              shopAId,
              `upd-${suffix}`,
              `u-${suffix}`,
              LIVE_FULL_SYNC_LINEAGE,
            );
            await expectCoherenceCheckRejected(
              role.client,
              `UPDATE "${table}"
               SET "existenceState" = $2,
                   "existenceKind" = $3,
                   "existenceRequestGen" = $4,
                   "existenceResponseGen" = $5,
                   "deletedAt" = CASE WHEN $6 THEN CLOCK_TIMESTAMP() ELSE NULL END,
                   "deletionSource" = $7::"OrderDeletionSource"
               WHERE id = $1`,
              [
                `upd-${suffix}`,
                scenario.lineage.existenceState,
                scenario.lineage.existenceKind,
                scenario.lineage.requestGen,
                scenario.lineage.responseGen,
                scenario.lineage.deletedAt,
                scenario.lineage.deletionSource,
              ],
              constraint,
              `${table} UPDATE ${scenario.name} ${role.name}`,
            );
            updateRejects += 1;
          }
        }
      }
      expect(insertRejects).toBe(
        CANONICAL_EXISTENCE_TABLES.length * invalid.length * 2,
      );
      expect(updateRejects).toBe(
        CANONICAL_EXISTENCE_TABLES.length * invalid.length * 2,
      );
      await owner.query("ROLLBACK");
      await runtime.query("ROLLBACK");
    } finally {
      await owner.end();
      await runtime.end();
    }
  }, 180_000);

  it("accepts every legitimate existence kind including full-sync NULL/NULL and retained-history shapes", async () => {
    const positives: Array<{ name: string; lineage: ExistenceLineage }> = [
      { name: "live_full_sync", lineage: LIVE_FULL_SYNC_LINEAGE },
      {
        name: "live_refetch",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "LIVE_REFETCH",
          requestGen: 10,
          responseGen: 11,
          deletedAt: false,
          deletionSource: null,
          sourceKind: "INCREMENTAL_REFETCH",
        },
      },
      {
        name: "absent_confirmed",
        lineage: {
          existenceState: "ABSENT",
          existenceKind: "ABSENT_CONFIRMED_QUERY",
          requestGen: 20,
          responseGen: 21,
          deletedAt: true,
          deletionSource: "CONFIRMED_QUERY",
          sourceKind: "RECONCILE",
        },
      },
      {
        name: "inaccessible_live_null_gens",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "INACCESSIBLE_HISTORY_WINDOW",
          requestGen: null,
          responseGen: null,
          deletedAt: false,
          deletionSource: null,
          sourceKind: "INCREMENTAL_REFETCH",
          existenceDiagnosticState: "ORDER_EXISTENCE_UNVERIFIABLE_WINDOW",
        },
      },
      {
        name: "inaccessible_live_coherent_pair",
        lineage: {
          existenceState: "LIVE",
          existenceKind: "INACCESSIBLE_HISTORY_WINDOW",
          requestGen: 30,
          responseGen: 31,
          deletedAt: false,
          deletionSource: null,
        },
      },
      {
        name: "inaccessible_absent_without_tombstone",
        lineage: {
          existenceState: "ABSENT",
          existenceKind: "INACCESSIBLE_HISTORY_WINDOW",
          requestGen: null,
          responseGen: null,
          deletedAt: false,
          deletionSource: null,
        },
      },
      {
        name: "unverified_delete_null_gens",
        lineage: {
          existenceState: "ABSENT",
          existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
          requestGen: null,
          responseGen: null,
          deletedAt: true,
          deletionSource: "WEBHOOK",
          sourceKind: "DELETE_WEBHOOK",
        },
      },
      {
        name: "unverified_delete_coherent_pair",
        lineage: {
          existenceState: "ABSENT",
          existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
          requestGen: 40,
          responseGen: 41,
          deletedAt: true,
          deletionSource: "WEBHOOK",
          sourceKind: "DELETE_WEBHOOK",
        },
      },
    ];

    const owner = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    const runtime = await getRuntimeClient();
    let positiveInserts = 0;
    try {
      await owner.query("BEGIN");
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);

      for (const table of CANONICAL_EXISTENCE_TABLES) {
        for (const scenario of positives) {
          for (const role of [
            { name: "owner" as const, client: owner },
            { name: "runtime" as const, client: runtime },
          ]) {
            const suffix = `p${CANONICAL_EXISTENCE_TABLES.indexOf(table)}-${scenario.name}-${role.name}`;
            await ensureCanonicalParents(role.client, table, shopAId, suffix);
            await insertCanonicalFact(
              role.client,
              table,
              shopAId,
              `pos-${suffix}`,
              suffix,
              scenario.lineage,
            );
            positiveInserts += 1;
          }
        }
      }
      expect(positiveInserts).toBe(
        CANONICAL_EXISTENCE_TABLES.length * positives.length * 2,
      );

      await insertCanonicalFact(
        owner,
        "ShopifyOrderFact",
        shopAId,
        "hist-live",
        "hist-live",
        LIVE_FULL_SYNC_LINEAGE,
      );
      await owner.query(
        `UPDATE "ShopifyOrderFact"
         SET "existenceKind" = 'INACCESSIBLE_HISTORY_WINDOW',
             "existenceDiagnosticState" = 'ORDER_EXISTENCE_UNVERIFIABLE_WINDOW'
         WHERE id = 'hist-live'`,
      );
      const liveInacc = await owner.query<{
        existenceState: string;
        existenceKind: string;
        deletedAt: Date | null;
        deletionSource: string | null;
      }>(
        `SELECT "existenceState", "existenceKind", "deletedAt", "deletionSource"
         FROM "ShopifyOrderFact" WHERE id = 'hist-live'`,
      );
      expect(liveInacc.rows[0]?.existenceState).toBe("LIVE");
      expect(liveInacc.rows[0]?.existenceKind).toBe("INACCESSIBLE_HISTORY_WINDOW");
      expect(liveInacc.rows[0]?.deletedAt).toBeNull();
      expect(liveInacc.rows[0]?.deletionSource).toBeNull();

      await insertCanonicalFact(
        owner,
        "ShopifyOrderFact",
        shopAId,
        "hist-abs",
        "hist-abs",
        {
          existenceState: "ABSENT",
          existenceKind: "ABSENT_CONFIRMED_QUERY",
          requestGen: 50,
          responseGen: 51,
          deletedAt: true,
          deletionSource: "CONFIRMED_QUERY",
          sourceKind: "RECONCILE",
        },
      );
      await owner.query(
        `UPDATE "ShopifyOrderFact"
         SET "existenceDiagnosticState" = 'ORDER_EXISTENCE_UNVERIFIABLE_WINDOW',
             "historyWindowState" = 'ORDER_HISTORY_WINDOW_TRUNCATED'
         WHERE id = 'hist-abs'`,
      );
      const keptTombstone = await owner.query<{
        existenceKind: string;
        existenceState: string;
        deletionSource: string;
        existenceRequestGen: string;
      }>(
        `SELECT "existenceKind", "existenceState", "deletionSource",
                "existenceRequestGen"::text AS "existenceRequestGen"
         FROM "ShopifyOrderFact" WHERE id = 'hist-abs'`,
      );
      expect(keptTombstone.rows[0]?.existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
      expect(keptTombstone.rows[0]?.existenceState).toBe("ABSENT");
      expect(keptTombstone.rows[0]?.deletionSource).toBe("CONFIRMED_QUERY");
      expect(keptTombstone.rows[0]?.existenceRequestGen).toBe("50");

      await insertCanonicalFact(
        owner,
        "ShopifyOrderFact",
        shopAId,
        "hist-unv",
        "hist-unv",
        {
          existenceState: "ABSENT",
          existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
          requestGen: null,
          responseGen: null,
          deletedAt: true,
          deletionSource: "WEBHOOK",
          sourceKind: "DELETE_WEBHOOK",
        },
      );
      await owner.query(
        `UPDATE "ShopifyOrderFact"
         SET "historyWindowState" = 'REFUND_OUTSIDE_ACCESSIBLE_WINDOW'
         WHERE id = 'hist-unv'`,
      );
      const keptUnverified = await owner.query<{ existenceKind: string }>(
        `SELECT "existenceKind" FROM "ShopifyOrderFact" WHERE id = 'hist-unv'`,
      );
      expect(keptUnverified.rows[0]?.existenceKind).toBe(
        "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
      );

      await insertCanonicalFact(
        owner,
        "ShopifyOrderFact",
        shopAId,
        "parent-refetch",
        "parent-refetch",
        {
          existenceState: "LIVE",
          existenceKind: "LIVE_REFETCH",
          requestGen: 70,
          responseGen: 71,
          deletedAt: false,
          deletionSource: null,
          sourceKind: "INCREMENTAL_REFETCH",
        },
      );
      await insertCanonicalFact(
        owner,
        "ShopifyOrderLineFact",
        shopAId,
        "child-fullsync",
        "parent-refetch",
        LIVE_FULL_SYNC_LINEAGE,
      );
      const child = await owner.query<{ existenceKind: string; req: string | null }>(
        `SELECT "existenceKind", "existenceRequestGen"::text AS req
         FROM "ShopifyOrderLineFact" WHERE id = 'child-fullsync'`,
      );
      expect(child.rows[0]?.existenceKind).toBe("LIVE_FULL_SYNC_PRESENT");
      expect(child.rows[0]?.req).toBeNull();

      await owner.query("ROLLBACK");
      await runtime.query("ROLLBACK");
    } finally {
      await owner.end();
      await runtime.end();
    }
  }, 180_000);
});
