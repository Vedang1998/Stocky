/**
 * Catalog lookup schema/relation/signature qualification (F-PR3C-12).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { verifyEnforcement } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe.sequential("catalog qualification", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("does not let a correct same-named constraint hide target-relation drift", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(`DROP SCHEMA IF EXISTS qualification_decoy CASCADE`);
      await client.query(`CREATE SCHEMA qualification_decoy`);
      await client.query(`
        CREATE TABLE qualification_decoy."PurchaseOrder" (
          id text NOT NULL,
          "shopId" text NOT NULL,
          UNIQUE ("shopId", id)
        );
        CREATE TABLE qualification_decoy."POLineItem" (
          id text PRIMARY KEY,
          "shopId" text NOT NULL,
          "purchaseOrderId" text NOT NULL
        );
      `);

      await client.query(
        `ALTER TABLE public."POLineItem"
           DROP CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey"`,
      );
      // Create the correct decoy first so an unqualified conname-only lookup
      // can incorrectly select it instead of the later target constraint.
      await client.query(`
        ALTER TABLE qualification_decoy."POLineItem"
          ADD CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey"
          FOREIGN KEY ("shopId", "purchaseOrderId")
          REFERENCES qualification_decoy."PurchaseOrder" ("shopId", id)
          ON DELETE CASCADE ON UPDATE NO ACTION;
        ALTER TABLE public."POLineItem"
          ADD CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey"
          FOREIGN KEY ("purchaseOrderId")
          REFERENCES public."PurchaseOrder" (id)
          ON DELETE CASCADE ON UPDATE NO ACTION;
      `);

      const result = await verifyEnforcement(client);
      expect(result.ok).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.code === "fk_wrong_local_columns" &&
            issue.detail.includes("POLineItem_shopId_purchaseOrderId_fkey"),
        ),
      ).toBe(true);
    } finally {
      await client.query(
        `ALTER TABLE public."POLineItem"
           DROP CONSTRAINT IF EXISTS "POLineItem_shopId_purchaseOrderId_fkey"`,
      );
      await client.query(`DROP SCHEMA IF EXISTS qualification_decoy CASCADE`);
      const restored = await applyEnforcement(client, {
        apply: true,
        acknowledgeDangerousDriftRepair: true,
      });
      expect(restored.ok).toBe(true);
      await client.end();
    }
  });

  it("qualifies helper functions by schema and zero-argument signature", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION public.stocky_current_tenant_id(input text)
        RETURNS text
        LANGUAGE sql
        SECURITY DEFINER
        AS $$ SELECT input $$;
        GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_id(text) TO PUBLIC;
      `);

      // The insecure overload is not the zero-argument helper used by RLS and
      // must neither satisfy nor contaminate verification of that exact object.
      const result = await verifyEnforcement(client);
      expect(result.ok).toBe(true);
    } finally {
      await client.query(
        `REVOKE ALL ON FUNCTION public.stocky_current_tenant_id(text) FROM PUBLIC`,
      );
      await client.query(
        `DROP FUNCTION IF EXISTS public.stocky_current_tenant_id(text)`,
      );
      expect((await verifyEnforcement(client)).ok).toBe(true);
      await client.end();
    }
  });
});
