/**
 * Catalog qualification follow-up (P3-a).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { assessEnforcementProgress } from "../preflight";
import { verifyRoles } from "../roles";
import { verifyEnforcement } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe.sequential("catalog qualification follow-up", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("ignores cross-schema same-named composite FK decoys in progress counts", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const before = await assessEnforcementProgress(client);
      expect(before.complete).toBe(true);

      await client.query(`DROP SCHEMA IF EXISTS qual_followup CASCADE`);
      await client.query(`CREATE SCHEMA qual_followup`);
      await client.query(`
        CREATE TABLE qual_followup."PurchaseOrder" (
          id text NOT NULL,
          "shopId" text NOT NULL,
          UNIQUE ("shopId", id)
        );
        CREATE TABLE qual_followup."POLineItem" (
          id text PRIMARY KEY,
          "shopId" text NOT NULL,
          "purchaseOrderId" text NOT NULL
        );
        ALTER TABLE qual_followup."POLineItem"
          ADD CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey"
          FOREIGN KEY ("shopId", "purchaseOrderId")
          REFERENCES qual_followup."PurchaseOrder" ("shopId", id);
      `);

      const after = await assessEnforcementProgress(client);
      expect(after.compositeFkCount).toBe(before.compositeFkCount);
      expect(after.complete).toBe(true);
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS qual_followup CASCADE`);
      await client.end();
    }
  });

  it("rejects overloaded approved function signatures", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION public.stocky_current_tenant_id(extra text)
        RETURNS text LANGUAGE sql
        SET search_path = pg_catalog, pg_temp
        AS $$ SELECT extra $$;
      `);

      const roles = await verifyRoles(client);
      expect(roles.ok).toBe(false);
      expect(
        roles.failures.some((f) =>
          f.includes("ambiguous_function_overload:stocky_current_tenant_id"),
        ),
      ).toBe(true);

      const enforcement = await verifyEnforcement(client);
      expect(enforcement.ok).toBe(false);
    } finally {
      await client.query(
        `DROP FUNCTION IF EXISTS public.stocky_current_tenant_id(text)`,
      );
      const restored = await applyEnforcement(client, {
        apply: true,
        acknowledgeDangerousDriftRepair: true,
      });
      expect(restored.ok).toBe(true);
      await client.end();
    }
  });
});
