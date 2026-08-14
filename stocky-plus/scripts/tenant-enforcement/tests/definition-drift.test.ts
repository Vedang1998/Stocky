/**
 * Adversarial RLS / FK / trigger definition-drift tests (F-PR3-03/04/08).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getMigrationClient } from "../connection";
import {
  detectEnforcementDrift,
  verifyEnforcement,
  verifyImmutabilityOnly,
  verifyRlsOnly,
} from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe("PR3 RLS / composite / trigger definition drift", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function withMigration<T>(
    fn: (client: Awaited<ReturnType<typeof getMigrationClient>>) => Promise<T>,
  ): Promise<T> {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  it("baseline verify/rls/immutability/drift are clean", async () => {
    await withMigration(async (client) => {
      expect((await verifyEnforcement(client)).ok).toBe(true);
      expect((await verifyRlsOnly(client)).ok).toBe(true);
      expect((await verifyImmutabilityOnly(client)).ok).toBe(true);
      expect((await detectEnforcementDrift(client)).ok).toBe(true);
    });
  });

  it("detects USING (true) policy predicate drift", async () => {
    await withMigration(async (client) => {
      await client.query(`
        DROP POLICY "Supplier_tenant_select" ON "Supplier";
        CREATE POLICY "Supplier_tenant_select" ON "Supplier"
          FOR SELECT TO stocky_runtime USING (true);
      `);
      const rls = await verifyRlsOnly(client);
      const verify = await verifyEnforcement(client);
      const drift = await detectEnforcementDrift(client);
      expect(rls.ok).toBe(false);
      expect(verify.ok).toBe(false);
      expect(drift.ok).toBe(false);
      expect(
        rls.issues.some(
          (i) =>
            i.code === "policy_using_true" ||
            i.code === "policy_using_drift" ||
            i.code === "policy_wrong_helper",
        ),
      ).toBe(true);
      // Restore
      const { applyEnforcement } = await import("../apply");
      const restored = await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true });
      expect(restored.ok).toBe(true);
      expect((await verifyRlsOnly(client)).ok).toBe(true);
    });
  });

  it("detects missing WITH CHECK on UPDATE policy", async () => {
    await withMigration(async (client) => {
      await client.query(`
        DROP POLICY "Supplier_tenant_update" ON "Supplier";
        CREATE POLICY "Supplier_tenant_update" ON "Supplier"
          FOR UPDATE TO stocky_runtime
          USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id()
            AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1'
            AND stocky_shop_processing_enabled("shopId"));
      `);
      const rls = await verifyRlsOnly(client);
      expect(rls.ok).toBe(false);
      expect(
        rls.issues.some((i) => i.code === "policy_missing_with_check"),
      ).toBe(true);
      const { applyEnforcement } = await import("../apply");
      expect((await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true })).ok).toBe(true);
    });
  });

  it("detects PUBLIC-targeted policy", async () => {
    await withMigration(async (client) => {
      await client.query(`
        DROP POLICY "Supplier_tenant_select" ON "Supplier";
        CREATE POLICY "Supplier_tenant_select" ON "Supplier"
          FOR SELECT TO PUBLIC
          USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id()
            AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1'
            AND stocky_shop_processing_enabled("shopId"));
      `);
      const rls = await verifyRlsOnly(client);
      expect(rls.ok).toBe(false);
      expect(rls.issues.some((i) => i.code === "public_policy")).toBe(true);
      const { applyEnforcement } = await import("../apply");
      expect((await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true })).ok).toBe(true);
    });
  });

  it("detects extra permissive policy", async () => {
    await withMigration(async (client) => {
      await client.query(`
        CREATE POLICY "Supplier_extra_permissive" ON "Supplier"
          FOR SELECT TO stocky_runtime USING (true);
      `);
      const rls = await verifyRlsOnly(client);
      expect(rls.ok).toBe(false);
      expect(
        rls.issues.some((i) => i.code === "unexpected_permissive_policy"),
      ).toBe(true);
      await client.query(
        `DROP POLICY "Supplier_extra_permissive" ON "Supplier"`,
      );
      expect((await verifyRlsOnly(client)).ok).toBe(true);
    });
  });

  it("detects wrong context version key in policy", async () => {
    await withMigration(async (client) => {
      await client.query(`
        DROP POLICY "Supplier_tenant_select" ON "Supplier";
        CREATE POLICY "Supplier_tenant_select" ON "Supplier"
          FOR SELECT TO stocky_runtime
          USING ("shopId" IS NOT NULL AND "shopId" = stocky_current_tenant_id()
            AND stocky_current_tenant_context_version() = 'wrong-version'
            AND stocky_shop_processing_enabled("shopId"));
      `);
      const rls = await verifyRlsOnly(client);
      expect(rls.ok).toBe(false);
      expect(
        rls.issues.some(
          (i) =>
            i.code === "policy_using_drift" ||
            i.code === "policy_wrong_context_key",
        ),
      ).toBe(true);
      const { applyEnforcement } = await import("../apply");
      expect((await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true })).ok).toBe(true);
    });
  });

  it("detects wrong same-named composite FK definition", async () => {
    await withMigration(async (client) => {
      await client.query(`
        ALTER TABLE "POLineItem" DROP CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey";
        ALTER TABLE "POLineItem"
          ADD CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey"
          FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"(id)
          ON DELETE CASCADE;
      `);
      const verify = await verifyEnforcement(client);
      const drift = await detectEnforcementDrift(client);
      expect(verify.ok).toBe(false);
      expect(drift.ok).toBe(false);
      expect(
        verify.issues.some(
          (i) =>
            i.code === "fk_wrong_local_columns" ||
            i.code === "fk_wrong_referenced_columns",
        ),
      ).toBe(true);
      // Re-apply must refuse silent accept
      const { applyEnforcement } = await import("../apply");
      const apply = await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true });
      expect(apply.ok).toBe(false);
      expect(
        apply.steps.some(
          (s) =>
            s.status === "failed" &&
            s.error?.includes("fk_wrong_definition"),
        ),
      ).toBe(true);
      // Manual repair then apply
      await client.query(`
        ALTER TABLE "POLineItem" DROP CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey";
      `);
      expect((await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true })).ok).toBe(true);
      expect((await verifyEnforcement(client)).ok).toBe(true);
    });
  });

  it("detects wrong FK referential action", async () => {
    await withMigration(async (client) => {
      await client.query(`
        ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_shopId_supplierId_fkey";
        ALTER TABLE "PurchaseOrder"
          ADD CONSTRAINT "PurchaseOrder_shopId_supplierId_fkey"
          FOREIGN KEY ("shopId", "supplierId") REFERENCES "Supplier"("shopId", id)
          ON DELETE CASCADE;
      `);
      const verify = await verifyEnforcement(client);
      expect(verify.ok).toBe(false);
      expect(
        verify.issues.some((i) => i.code === "fk_wrong_delete_action"),
      ).toBe(true);
      await client.query(
        `ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_shopId_supplierId_fkey"`,
      );
      const { applyEnforcement } = await import("../apply");
      expect((await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true })).ok).toBe(true);
    });
  });

  it("detects disabled immutability trigger", async () => {
    await withMigration(async (client) => {
      await client.query(
        `ALTER TABLE "Supplier" DISABLE TRIGGER "trg_Supplier_shopId_immutable"`,
      );
      const imm = await verifyImmutabilityOnly(client);
      const verify = await verifyEnforcement(client);
      const drift = await detectEnforcementDrift(client);
      expect(imm.ok).toBe(false);
      expect(verify.ok).toBe(false);
      expect(drift.ok).toBe(false);
      expect(imm.issues.some((i) => i.code === "trigger_disabled")).toBe(true);
      await client.query(
        `ALTER TABLE "Supplier" ENABLE TRIGGER "trg_Supplier_shopId_immutable"`,
      );
      expect((await verifyImmutabilityOnly(client)).ok).toBe(true);
    });
  });

  it("detects replica-only immutability trigger", async () => {
    await withMigration(async (client) => {
      await client.query(
        `ALTER TABLE "Supplier" ENABLE REPLICA TRIGGER "trg_Supplier_shopId_immutable"`,
      );
      const imm = await verifyImmutabilityOnly(client);
      expect(imm.ok).toBe(false);
      expect(imm.issues.some((i) => i.code === "trigger_replica_only")).toBe(
        true,
      );
      await client.query(
        `ALTER TABLE "Supplier" ENABLE TRIGGER "trg_Supplier_shopId_immutable"`,
      );
      expect((await verifyImmutabilityOnly(client)).ok).toBe(true);
    });
  });

  it("detects wrong / altered trigger function", async () => {
    await withMigration(async (client) => {
      await client.query(`
        CREATE OR REPLACE FUNCTION stocky_prevent_shop_id_mutation()
        RETURNS trigger LANGUAGE plpgsql
        SET search_path = pg_catalog, pg_temp
        AS $$ BEGIN RETURN NEW; END; $$;
      `);
      const imm = await verifyImmutabilityOnly(client);
      expect(imm.ok).toBe(false);
      expect(
        imm.issues.some((i) => i.code === "trigger_function_body_drift"),
      ).toBe(true);
      const { applyEnforcement } = await import("../apply");
      expect((await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true })).ok).toBe(true);
      expect((await verifyImmutabilityOnly(client)).ok).toBe(true);
    });
  });
});
