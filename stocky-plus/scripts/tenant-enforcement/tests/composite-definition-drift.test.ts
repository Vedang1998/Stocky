/**
 * Composite FK definition-drift tests (F-PR3-04) — dedicated file for CI.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { detectEnforcementDrift, verifyEnforcement } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe("PR3 composite FK definition drift", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("detects wrong same-named composite FK and refuses silent re-apply", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
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
      const apply = await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true });
      expect(apply.ok).toBe(false);
      expect(
        apply.steps.some(
          (s) =>
            s.status === "failed" &&
            s.error?.includes("fk_wrong_definition"),
        ),
      ).toBe(true);
      await client.query(
        `ALTER TABLE "POLineItem" DROP CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey"`,
      );
      expect((await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true })).ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("detects wrong FK referential action", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
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
      expect((await applyEnforcement(client, { apply: true, acknowledgeDangerousDriftRepair: true })).ok).toBe(true);
    } finally {
      await client.end();
    }
  });
});
