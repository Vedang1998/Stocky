/**
 * Resume preflight dangerous-drift classification (F-PR3C-07).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Client } from "pg";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { runPreflight } from "../preflight";
import { provisionRoles } from "../roles";
import { verifyEnforcement } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

type RepairKind =
  "apply" | "membership" | "public-grant" | "wrong-fk" | "default-acl";

type DriftCase = {
  case: string;
  injectSql: string;
  cleanupSql: string;
  expectedCodePrefix: string;
  repair: RepairKind;
};

const OWNER = "__MIGRATION_OWNER__";

const DRIFT_CASES: DriftCase[] = [
  {
    case: "USING (true) policy",
    injectSql: `
      DROP POLICY "Supplier_tenant_select" ON public."Supplier";
      CREATE POLICY "Supplier_tenant_select" ON public."Supplier"
        FOR SELECT TO stocky_runtime USING (true);
    `,
    cleanupSql: `DROP POLICY IF EXISTS "Supplier_tenant_select" ON public."Supplier"`,
    expectedCodePrefix: "dangerous_definition_drift:policy_",
    repair: "apply",
  },
  {
    case: "disabled immutability trigger",
    injectSql: `ALTER TABLE public."Supplier" DISABLE TRIGGER "trg_Supplier_shopId_immutable"`,
    cleanupSql: `ALTER TABLE public."Supplier" ENABLE TRIGGER "trg_Supplier_shopId_immutable"`,
    expectedCodePrefix: "dangerous_definition_drift:trigger_disabled:Supplier",
    repair: "apply",
  },
  {
    case: "runtime membership in owner",
    injectSql: `GRANT ${OWNER} TO stocky_runtime`,
    cleanupSql: `REVOKE ${OWNER} FROM stocky_runtime`,
    expectedCodePrefix: "dangerous_privilege_drift:member_of:",
    repair: "membership",
  },
  {
    case: "PUBLIC merchant-table grant",
    injectSql: `GRANT SELECT ON TABLE public."Supplier" TO PUBLIC`,
    cleanupSql: `REVOKE SELECT ON TABLE public."Supplier" FROM PUBLIC`,
    expectedCodePrefix:
      "dangerous_privilege_drift:public_grant:Supplier:SELECT",
    repair: "public-grant",
  },
  {
    case: "DISABLE RLS while runtime grants remain",
    injectSql: `ALTER TABLE public."Supplier" DISABLE ROW LEVEL SECURITY`,
    cleanupSql: `
      ALTER TABLE public."Supplier" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public."Supplier" FORCE ROW LEVEL SECURITY;
    `,
    expectedCodePrefix: "dangerous_definition_drift:rls_not_enabled:Supplier",
    repair: "apply",
  },
  {
    case: "dropped composite FK",
    injectSql: `ALTER TABLE public."POLineItem" DROP CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey"`,
    cleanupSql: `ALTER TABLE public."POLineItem" DROP CONSTRAINT IF EXISTS "POLineItem_shopId_purchaseOrderId_fkey"`,
    expectedCodePrefix: "dangerous_definition_drift:fk_missing",
    repair: "apply",
  },
  {
    case: "wrong same-named composite FK",
    injectSql: `
      ALTER TABLE public."POLineItem" DROP CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey";
      ALTER TABLE public."POLineItem"
        ADD CONSTRAINT "POLineItem_shopId_purchaseOrderId_fkey"
        FOREIGN KEY ("purchaseOrderId") REFERENCES public."PurchaseOrder"(id)
        ON DELETE CASCADE;
    `,
    cleanupSql: `ALTER TABLE public."POLineItem" DROP CONSTRAINT IF EXISTS "POLineItem_shopId_purchaseOrderId_fkey"`,
    expectedCodePrefix: "dangerous_definition_drift:fk_wrong_",
    repair: "wrong-fk",
  },
  {
    case: "unsafe future-table default ACL",
    injectSql: `ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER} IN SCHEMA public GRANT SELECT ON TABLES TO stocky_runtime`,
    cleanupSql: `ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER} IN SCHEMA public REVOKE SELECT ON TABLES FROM stocky_runtime`,
    expectedCodePrefix:
      "dangerous_privilege_drift:unsafe_default_table_priv:runtime:",
    repair: "default-acl",
  },
  {
    case: "PUBLIC schema CREATE",
    injectSql: `GRANT CREATE ON SCHEMA public TO PUBLIC`,
    cleanupSql: `REVOKE CREATE ON SCHEMA public FROM PUBLIC`,
    expectedCodePrefix: "dangerous_privilege_drift:public_schema_create",
    repair: "apply",
  },
];

function sqlForOwner(sql: string, owner: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(owner)) {
    throw new Error(`unsafe_resume_owner:${owner}`);
  }
  return sql.replaceAll(OWNER, `"${owner}"`);
}

function allPreflightCodes(result: Awaited<ReturnType<typeof runPreflight>>) {
  return [...result.globalFailures, ...(result.dangerousDriftCodes ?? [])];
}

function expectDangerousCode(
  result: Awaited<ReturnType<typeof runPreflight>>,
  prefix: string,
): void {
  expect(result.ok).toBe(false);
  expect(result.driftClass).toBe("repair_authorization_required");
  expect(
    allPreflightCodes(result).some((code) => code.startsWith(prefix)),
  ).toBe(true);
}

async function repairAcknowledgedDrift(
  client: Client,
  repair: RepairKind,
  cleanupSql: string,
): Promise<void> {
  if (repair === "membership") {
    const repaired = await provisionRoles(client, {
      apply: true,
      phase: "prepare",
      repairDangerousDrift: true,
    });
    expect(repaired.ok).toBe(true);
  } else if (repair === "public-grant") {
    // PUBLIC object grants are intentionally not guessed by role repair.
    await client.query(cleanupSql);
  } else if (repair === "default-acl") {
    const repaired = await provisionRoles(client, {
      apply: true,
      phase: "prepare",
      repairDangerousDefaultPrivileges: true,
    });
    expect(repaired.ok).toBe(true);
  }

  const applied = await applyEnforcement(client, {
    apply: true,
    acknowledgeDangerousDriftRepair: true,
  });

  if (repair === "wrong-fk") {
    expect(applied.ok).toBe(false);
    expect(
      applied.steps.some((step) => step.error?.includes("fk_wrong_definition")),
    ).toBe(true);
    await client.query(cleanupSql);
    const repaired = await applyEnforcement(client, {
      apply: true,
      acknowledgeDangerousDriftRepair: true,
    });
    expect(repaired.ok).toBe(true);
  } else {
    expect(applied.ok).toBe(true);
  }
}

describe.sequential("resume preflight dangerous drift", () => {
  let prisma: PrismaClient;
  let owner: string;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const ownerResult = await client.query<{ owner: string }>(
        `SELECT r.rolname AS owner
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_roles r ON r.oid = c.relowner
         WHERE n.nspname = 'public'
           AND c.relname = 'Supplier'
           AND c.relkind = 'r'`,
      );
      owner = ownerResult.rows[0].owner;
    } finally {
      await client.end();
    }
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it.each(DRIFT_CASES)(
    "$case",
    async (driftCase) => {
      const client = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      const injectSql = sqlForOwner(driftCase.injectSql, owner);
      const cleanupSql = sqlForOwner(driftCase.cleanupSql, owner);
      let injected = false;
      try {
        expect((await verifyEnforcement(client)).ok).toBe(true);
        await client.query(injectSql);
        injected = true;

        if (driftCase.case.includes("DISABLE RLS")) {
          const grant = await client.query<{ has: boolean }>(
            `SELECT has_table_privilege(
               'stocky_runtime',
               'public."Supplier"',
               'SELECT'
             ) AS has`,
          );
          expect(grant.rows[0].has).toBe(true);
        }

        const preflight = await runPreflight(client, { mode: "resume" });
        expectDangerousCode(preflight, driftCase.expectedCodePrefix);

        const ordinaryApply = await applyEnforcement(client, { apply: true });
        expect(ordinaryApply.ok).toBe(false);
        expect(ordinaryApply.preflightOk).toBe(false);

        const afterOrdinaryApply = await runPreflight(client, {
          mode: "resume",
        });
        expectDangerousCode(afterOrdinaryApply, driftCase.expectedCodePrefix);

        const acknowledged = await runPreflight(client, {
          mode: "resume",
          acknowledgeDangerousDriftRepair: true,
        });
        expect(acknowledged.ok).toBe(true);
        expect(acknowledged.dangerousDriftCodes?.length).toBeGreaterThan(0);

        await repairAcknowledgedDrift(client, driftCase.repair, cleanupSql);
        injected = false;
        expect((await verifyEnforcement(client)).ok).toBe(true);
      } finally {
        if (injected) {
          await client.query(cleanupSql).catch(() => undefined);
          await applyEnforcement(client, {
            apply: true,
            acknowledgeDangerousDriftRepair: true,
          });
        }
        await client.end();
      }
    },
    180_000,
  );
});
