/**
 * Immutability trigger definition-drift tests (F-PR3-08) — dedicated file for CI.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import {
  detectEnforcementDrift,
  verifyEnforcement,
  verifyImmutabilityOnly,
} from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe("PR3 immutability trigger definition drift", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("detects disabled immutability trigger", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(
        `ALTER TABLE "Supplier" DISABLE TRIGGER "trg_Supplier_shopId_immutable"`,
      );
      const imm = await verifyImmutabilityOnly(client);
      expect(imm.ok).toBe(false);
      expect(imm.issues.some((i) => i.code === "trigger_disabled")).toBe(true);
      expect((await verifyEnforcement(client)).ok).toBe(false);
      expect((await detectEnforcementDrift(client)).ok).toBe(false);
      await client.query(
        `ALTER TABLE "Supplier" ENABLE TRIGGER "trg_Supplier_shopId_immutable"`,
      );
      expect((await verifyImmutabilityOnly(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("detects replica-only immutability trigger", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
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
    } finally {
      await client.end();
    }
  });

  it("detects altered trigger function body", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
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
      expect((await applyEnforcement(client, { apply: true })).ok).toBe(true);
      expect((await verifyImmutabilityOnly(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });
});
