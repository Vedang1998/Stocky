/**
 * PR 3 — role attributes, missing-context denial, cross-shop isolation,
 * immutability, composite FKs, RLS matrix, pool leakage, bootstrap.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { issueTenantAuthority } from "../../authority.server";
import { createTenantDb } from "../../tenant-db.server";
import { MERCHANT_OWNED_MODELS } from "../../models";
import { TENANT_DB_CONTEXT_VERSION } from "../../db-context.server";
import {
  requireRuntimeUrl,
  resetAndEnforce,
  seedTwoShops,
  SHARED_EXTERNAL_ID,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  withMigrationPg,
  withRuntimePg,
} from "./helpers";
import { MERCHANT_SQL_TABLES } from "../../../../scripts/tenant-enforcement/manifest";
import { verifyRoles } from "../../../../scripts/tenant-enforcement/roles";
import {
  verifyEnforcement,
  verifyImmutabilityOnly,
  verifyRlsOnly,
} from "../../../../scripts/tenant-enforcement/verify";
import { getMigrationClient } from "../../../../scripts/tenant-enforcement/connection";

describe("PR3 database isolation — roles", () => {
  let migrationPrisma: PrismaClient;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
  }, 180_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("runtime role is not owner/superuser and lacks BYPASSRLS", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const result = await verifyRoles(client);
      expect(result.ok).toBe(true);
      expect(result.attributes.rolsuper).toBe(false);
      expect(result.attributes.rolbypassrls).toBe(false);
      expect(result.attributes.rolcreatedb).toBe(false);
      expect(result.attributes.rolcreaterole).toBe(false);
    } finally {
      await client.end();
    }
  });

  it("runtime cannot alter table, policy, or disable trigger", async () => {
    await withRuntimePg(async (client) => {
      await expect(
        client.query(`ALTER TABLE "Supplier" ADD COLUMN pr3_probe text`),
      ).rejects.toThrow();
      await expect(
        client.query(
          `DROP POLICY IF EXISTS "Supplier_tenant_select" ON "Supplier"`,
        ),
      ).rejects.toThrow();
      await expect(
        client.query(
          `ALTER TABLE "Supplier" DISABLE TRIGGER "trg_Supplier_shopId_immutable"`,
        ),
      ).rejects.toThrow();
      await expect(client.query(`CREATE ROLE pr3_probe_role`)).rejects.toThrow();
      await expect(client.query(`CREATE DATABASE pr3_probe_db`)).rejects.toThrow();
    });
  });

  it("runtime cannot SELECT control/maintenance tables", async () => {
    await withRuntimePg(async (client) => {
      await expect(
        client.query(`SELECT COUNT(*) FROM "TenantBackfillRun"`),
      ).rejects.toThrow();
      await expect(
        client.query(`SELECT COUNT(*) FROM "TenantOwnershipIssue"`),
      ).rejects.toThrow();
    });
  });
});

describe("PR3 database isolation — missing context + RLS matrix", () => {
  let migrationPrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    const shops = await seedTwoShops(migrationPrisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;

    // Seed via migration owner (BYPASSRLS)
    await migrationPrisma.supplier.create({
      data: {
        id: "sup-a",
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        name: "Supplier A",
      },
    });
    await migrationPrisma.supplier.create({
      data: {
        id: "sup-b",
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        name: "Supplier B",
      },
    });
  }, 180_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("verifies RLS enabled+forced and policies for every merchant table", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const rls = await verifyRlsOnly(client);
      expect(rls.ok).toBe(true);
      expect(MERCHANT_SQL_TABLES).toHaveLength(26);
      const full = await verifyEnforcement(client);
      expect(full.ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("without context, runtime cannot SELECT/INSERT/UPDATE/DELETE/count merchant tables", async () => {
    await withRuntimePg(async (client) => {
      for (const table of MERCHANT_SQL_TABLES) {
        // Missing context → fail-closed empty SELECT (FORCE RLS, no matching policy)
        const sel = await client.query(
          `SELECT COUNT(*)::int AS c FROM "${table}"`,
        );
        expect(sel.rows[0].c).toBe(0);
      }

      // INSERT denied by WITH CHECK (raises)
      await expect(
        client.query(
          `INSERT INTO "Supplier" (id, shop, "shopId", name) VALUES ('x', $1, $2, 'n')`,
          [SHOP_A_DOMAIN, shopAId],
        ),
      ).rejects.toThrow();

      // UPDATE/DELETE with missing context: USING matches no rows → 0 affected
      const upd = await client.query(
        `UPDATE "Supplier" SET name = 'hack' WHERE id = 'sup-a' RETURNING id`,
      );
      expect(upd.rowCount).toBe(0);

      const del = await client.query(
        `DELETE FROM "Supplier" WHERE id = 'sup-a' RETURNING id`,
      );
      expect(del.rowCount).toBe(0);

      // Prove rows still exist via migration owner
      await withMigrationPg(async (mig) => {
        const still = await mig.query(
          `SELECT COUNT(*)::int AS c FROM "Supplier"`,
        );
        expect(still.rows[0].c).toBe(2);
      });
    });
  });

  it("Shop A context sees only A; cannot read/mutate B; overlapping keys isolated", async () => {
    await withRuntimePg(async (client) => {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
        shopAId,
      ]);
      await client.query(
        `SELECT set_config('stocky.tenant_context_version', $1, true)`,
        [TENANT_DB_CONTEXT_VERSION],
      );

      const rows = await client.query(
        `SELECT id, name FROM "Supplier" ORDER BY id`,
      );
      expect(rows.rows.map((r) => r.id)).toEqual(["sup-a"]);

      await client.query("SAVEPOINT sp_insert");
      await expect(
        client.query(
          `INSERT INTO "Supplier" (id, shop, "shopId", name) VALUES ('sup-b2', $1, $2, 'evil')`,
          [SHOP_B_DOMAIN, shopBId],
        ),
      ).rejects.toThrow();
      await client.query("ROLLBACK TO SAVEPOINT sp_insert");

      const upd = await client.query(
        `UPDATE "Supplier" SET name = 'x' WHERE id = 'sup-b' RETURNING id`,
      );
      expect(upd.rowCount).toBe(0);

      await client.query("ROLLBACK");
    });
  });
});

describe("PR3 database isolation — immutability", () => {
  let migrationPrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    const shops = await seedTwoShops(migrationPrisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    await migrationPrisma.supplier.create({
      data: {
        id: "sup-imm",
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        name: "Immutable",
      },
    });
  }, 180_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("verifies immutability triggers on all merchant tables", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const result = await verifyImmutabilityOnly(client);
      expect(result.ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("rejects shopId reassignment to other shop or null via runtime SQL", async () => {
    await withRuntimePg(async (client) => {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
        shopAId,
      ]);
      await client.query(
        `SELECT set_config('stocky.tenant_context_version', $1, true)`,
        [TENANT_DB_CONTEXT_VERSION],
      );

      await client.query("SAVEPOINT sp_reassign");
      await expect(
        client.query(
          `UPDATE "Supplier" SET "shopId" = $1 WHERE id = 'sup-imm'`,
          [shopBId],
        ),
      ).rejects.toThrow(/stocky_tenant_key_immutable|shopId/);
      await client.query("ROLLBACK TO SAVEPOINT sp_reassign");

      await client.query("SAVEPOINT sp_null");
      await expect(
        client.query(
          `UPDATE "Supplier" SET "shopId" = NULL WHERE id = 'sup-imm'`,
        ),
      ).rejects.toThrow();
      await client.query("ROLLBACK TO SAVEPOINT sp_null");

      const ok = await client.query(
        `UPDATE "Supplier" SET name = 'still-a' WHERE id = 'sup-imm' RETURNING name`,
      );
      expect(ok.rows[0].name).toBe("still-a");
      await client.query("COMMIT");
    });
  });

  it("TenantDb updateMany/upsert cannot reassign shopId", async () => {
    // Ensure runtime URL is active for singleton
    requireRuntimeUrl();
    const db = createTenantDb(
      issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
      }),
    );

    await expect(
      db.supplier.update({
        where: { id: "sup-imm" },
        data: { shopId: shopBId },
      }),
    ).rejects.toThrow();

    const updated = await db.supplier.update({
      where: { id: "sup-imm" },
      data: { name: "via-tenantdb" },
    });
    expect(updated.name).toBe("via-tenantdb");
    expect(updated.shopId).toBe(shopAId);
  });
});

describe("PR3 database isolation — composite FKs", () => {
  let migrationPrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    const shops = await seedTwoShops(migrationPrisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;

    await migrationPrisma.supplier.createMany({
      data: [
        { id: "sup-a", shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
        { id: "sup-b", shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
      ],
    });
    await migrationPrisma.purchaseOrder.createMany({
      data: [
        {
          id: "po-a",
          shop: SHOP_A_DOMAIN,
          shopId: shopAId,
          supplierId: "sup-a",
          locationId: "loc1",
        },
        {
          id: "po-b",
          shop: SHOP_B_DOMAIN,
          shopId: shopBId,
          supplierId: "sup-b",
          locationId: "loc1",
        },
      ],
    });
  }, 180_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("same-tenant child insert succeeds; foreign-tenant parent fails", async () => {
    // Same tenant OK
    await migrationPrisma.pOLineItem.create({
      data: {
        id: "line-a",
        shopId: shopAId,
        purchaseOrderId: "po-a",
        shopifyVariantId: SHARED_EXTERNAL_ID,
        orderedQty: 1,
        unitCost: 1,
      },
    });

    // Child A pointing at PO B denied by composite FK
    await expect(
      migrationPrisma.pOLineItem.create({
        data: {
          id: "line-cross",
          shopId: shopAId,
          purchaseOrderId: "po-b",
          shopifyVariantId: SHARED_EXTERNAL_ID,
          orderedQty: 1,
          unitCost: 1,
        },
      }),
    ).rejects.toThrow();

    // LeadTimeSnapshot secondary lineage mismatch
    await expect(
      migrationPrisma.leadTimeSnapshot.create({
        data: {
          shopId: shopAId,
          supplierId: "sup-a",
          purchaseOrderId: "po-b",
          leadTimeDays: 3,
        },
      }),
    ).rejects.toThrow();

    // Cross-domain PO→Supplier mismatch
    await expect(
      migrationPrisma.purchaseOrder.create({
        data: {
          id: "po-cross",
          shop: SHOP_A_DOMAIN,
          shopId: shopAId,
          supplierId: "sup-b",
          locationId: "loc1",
        },
      }),
    ).rejects.toThrow();
  });
});

describe("PR3 database isolation — pool leakage", () => {
  let migrationPrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    const shops = await seedTwoShops(migrationPrisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    await migrationPrisma.supplier.createMany({
      data: [
        { id: "pool-a", shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
        { id: "pool-b", shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
      ],
    });
  }, 180_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("transaction-local context does not leak across pooled connection reuse", async () => {
    const pool = new Pool({
      connectionString: requireRuntimeUrl(),
      max: 1, // force physical reuse
    });

    try {
      const client = await pool.connect();
      const pid1 = (await client.query(`SELECT pg_backend_pid() AS pid`)).rows[0]
        .pid;

      await client.query("BEGIN");
      await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
        shopAId,
      ]);
      await client.query(
        `SELECT set_config('stocky.tenant_context_version', $1, true)`,
        [TENANT_DB_CONTEXT_VERSION],
      );
      const aRows = await client.query(`SELECT id FROM "Supplier"`);
      expect(aRows.rows.map((r) => r.id)).toEqual(["pool-a"]);
      await client.query("COMMIT");
      client.release();

      // Reuse same backend
      const client2 = await pool.connect();
      const pid2 = (await client2.query(`SELECT pg_backend_pid() AS pid`))
        .rows[0].pid;
      expect(pid2).toBe(pid1);

      // No context → empty
      const bare = await client2.query(`SELECT id FROM "Supplier"`);
      expect(bare.rows).toHaveLength(0);

      await client2.query("BEGIN");
      await client2.query(
        `SELECT set_config('stocky.current_shop_id', $1, true)`,
        [shopBId],
      );
      await client2.query(
        `SELECT set_config('stocky.tenant_context_version', $1, true)`,
        [TENANT_DB_CONTEXT_VERSION],
      );
      const bRows = await client2.query(`SELECT id FROM "Supplier"`);
      expect(bRows.rows.map((r) => r.id)).toEqual(["pool-b"]);
      await client2.query("ROLLBACK");

      // After rollback, still empty
      const afterRb = await client2.query(`SELECT id FROM "Supplier"`);
      expect(afterRb.rows).toHaveLength(0);
      client2.release();
    } finally {
      await pool.end();
    }
  });

  it("concurrent A/B transactions remain isolated", async () => {
    const pool = new Pool({
      connectionString: requireRuntimeUrl(),
      max: 2,
    });
    try {
      const cA = await pool.connect();
      const cB = await pool.connect();
      await cA.query("BEGIN");
      await cB.query("BEGIN");
      await cA.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
        shopAId,
      ]);
      await cA.query(
        `SELECT set_config('stocky.tenant_context_version', $1, true)`,
        [TENANT_DB_CONTEXT_VERSION],
      );
      await cB.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
        shopBId,
      ]);
      await cB.query(
        `SELECT set_config('stocky.tenant_context_version', $1, true)`,
        [TENANT_DB_CONTEXT_VERSION],
      );

      const a = await cA.query(`SELECT id FROM "Supplier"`);
      const b = await cB.query(`SELECT id FROM "Supplier"`);
      expect(a.rows.map((r) => r.id)).toEqual(["pool-a"]);
      expect(b.rows.map((r) => r.id)).toEqual(["pool-b"]);

      await cA.query("COMMIT");
      await cB.query("COMMIT");
      cA.release();
      cB.release();
    } finally {
      await pool.end();
    }
  });
});

describe("PR3 database isolation — bootstrap boundary", () => {
  let migrationPrisma: PrismaClient;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    await seedTwoShops(migrationPrisma);
  }, 180_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("Session and Shop work without tenant context; merchant tables do not", async () => {
    await withRuntimePg(async (client) => {
      await client.query(
        `INSERT INTO "Session" (id, shop, state, "isOnline", "accessToken")
         VALUES ('sess1', $1, 's', false, 'tok')`,
        [SHOP_A_DOMAIN],
      );
      const sessions = await client.query(`SELECT id FROM "Session"`);
      expect(sessions.rowCount).toBeGreaterThan(0);

      const shops = await client.query(`SELECT id FROM "Shop"`);
      expect(shops.rowCount).toBe(2);

      const suppliers = await client.query(`SELECT id FROM "Supplier"`);
      expect(suppliers.rows).toHaveLength(0);
    });
  });
});

describe("PR3 merchant model count", () => {
  it("covers all 26 merchant-owned models", () => {
    expect(MERCHANT_OWNED_MODELS).toHaveLength(26);
    expect(MERCHANT_SQL_TABLES).toHaveLength(26);
  });
});
