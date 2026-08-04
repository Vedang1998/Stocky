/**
 * Mechanically explicit exact-privilege matrix (F-PR3C-06).
 *
 * Every row injects one privilege class, verifies its stable code, restores
 * that row, and proves the catalog is clean before the next row starts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { verifyRoles } from "../roles";
import { verifyEnforcement } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

type VerifierName = "roles" | "enforcement";
type PrivilegeCase = {
  case: string;
  injectSql: string;
  restoreSql: string;
  expectedCodePrefix: string;
  verifier: VerifierName;
  repairAfterRestore?: boolean;
};

const OWNER = "__MIGRATION_OWNER__";

const PRIVILEGE_CASES: PrivilegeCase[] = [
  ...(["SELECT", "INSERT", "UPDATE", "DELETE"] as const).map(
    (privilege, index): PrivilegeCase => ({
      case: `PUBLIC ${privilege} on merchant table`,
      injectSql: `GRANT ${privilege} ON TABLE public."Supplier" TO PUBLIC`,
      restoreSql: `REVOKE ${privilege} ON TABLE public."Supplier" FROM PUBLIC`,
      expectedCodePrefix: `public_grant:Supplier:${privilege}`,
      verifier: index % 2 === 0 ? "roles" : "enforcement",
    }),
  ),
  ...(["TRIGGER", "TRUNCATE", "REFERENCES"] as const).map(
    (privilege, index): PrivilegeCase => ({
      case: `runtime ${privilege} on merchant table`,
      injectSql: `GRANT ${privilege} ON TABLE public."Supplier" TO stocky_runtime`,
      restoreSql: `REVOKE ${privilege} ON TABLE public."Supplier" FROM stocky_runtime`,
      expectedCodePrefix: `excess_priv:Supplier:${privilege}`,
      verifier: index % 2 === 0 ? "roles" : "enforcement",
    }),
  ),
  ...(["USAGE", "SELECT", "UPDATE"] as const).flatMap(
    (privilege): PrivilegeCase[] =>
      (["stocky_runtime", "PUBLIC"] as const).map((grantee) => {
        const key = grantee === "PUBLIC" ? "public" : grantee;
        const suffix = `${privilege.toLowerCase()}_${key}`;
        return {
          case: `${grantee} ${privilege} on sequence`,
          injectSql: `
            CREATE SEQUENCE public.matrix_sequence_${suffix};
            GRANT ${privilege} ON SEQUENCE public.matrix_sequence_${suffix} TO ${grantee};
          `,
          restoreSql: `
            REVOKE ${privilege} ON SEQUENCE public.matrix_sequence_${suffix} FROM ${grantee};
            DROP SEQUENCE public.matrix_sequence_${suffix};
          `,
          expectedCodePrefix: `excess_sequence_priv:matrix_sequence_${suffix}:${key}:${privilege}:`,
          verifier: grantee === "PUBLIC" ? "enforcement" : "roles",
        };
      }),
  ),
  {
    case: "runtime CREATE on public schema",
    injectSql: `GRANT CREATE ON SCHEMA public TO stocky_runtime`,
    restoreSql: `REVOKE CREATE ON SCHEMA public FROM stocky_runtime`,
    expectedCodePrefix: "excess_schema_create",
    verifier: "roles",
  },
  {
    case: "PUBLIC CREATE on public schema",
    injectSql: `GRANT CREATE ON SCHEMA public TO PUBLIC`,
    restoreSql: `REVOKE CREATE ON SCHEMA public FROM PUBLIC`,
    expectedCodePrefix: "public_schema_create",
    verifier: "enforcement",
  },
  {
    case: "runtime future-table default",
    injectSql: `ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER} IN SCHEMA public GRANT SELECT ON TABLES TO stocky_runtime`,
    restoreSql: `ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER} IN SCHEMA public REVOKE SELECT ON TABLES FROM stocky_runtime`,
    expectedCodePrefix: "unsafe_default_table_priv:runtime:",
    verifier: "roles",
  },
  {
    case: "PUBLIC future-table default",
    injectSql: `ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER} IN SCHEMA public GRANT SELECT ON TABLES TO PUBLIC`,
    restoreSql: `ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER} IN SCHEMA public REVOKE SELECT ON TABLES FROM PUBLIC`,
    expectedCodePrefix: "unsafe_default_table_priv:public:",
    verifier: "enforcement",
  },
  {
    case: "PUBLIC function EXECUTE",
    injectSql: `GRANT EXECUTE ON FUNCTION public.stocky_prevent_shop_id_mutation() TO PUBLIC`,
    restoreSql: `REVOKE EXECUTE ON FUNCTION public.stocky_prevent_shop_id_mutation() FROM PUBLIC`,
    expectedCodePrefix:
      "unsafe_default_function_priv:public:EXECUTE:stocky_prevent_shop_id_mutation",
    verifier: "roles",
  },
  {
    case: "runtime control-table SELECT",
    injectSql: `GRANT SELECT ON TABLE public."TenantOwnershipIssue" TO stocky_runtime`,
    restoreSql: `REVOKE SELECT ON TABLE public."TenantOwnershipIssue" FROM stocky_runtime`,
    expectedCodePrefix: "runtime_can_select_control:TenantOwnershipIssue",
    verifier: "enforcement",
  },
  {
    case: "runtime _prisma_migrations SELECT",
    injectSql: `GRANT SELECT ON TABLE public._prisma_migrations TO stocky_runtime`,
    restoreSql: `REVOKE SELECT ON TABLE public._prisma_migrations FROM stocky_runtime`,
    expectedCodePrefix: "runtime_can_select_prisma_migrations",
    verifier: "roles",
  },
  {
    case: "runtime merchant-table ownership drift",
    injectSql: `ALTER TABLE public."Supplier" OWNER TO stocky_runtime`,
    restoreSql: `ALTER TABLE public."Supplier" OWNER TO ${OWNER}`,
    expectedCodePrefix: "runtime_owns_tables:Supplier",
    verifier: "enforcement",
    repairAfterRestore: true,
  },
  {
    case: "direct owner membership",
    injectSql: `GRANT ${OWNER} TO stocky_runtime`,
    restoreSql: `REVOKE ${OWNER} FROM stocky_runtime`,
    expectedCodePrefix: `member_of:`,
    verifier: "roles",
  },
  {
    case: "transitive owner membership",
    injectSql: `
      CREATE ROLE stocky_matrix_mid NOLOGIN;
      GRANT ${OWNER} TO stocky_matrix_mid;
      GRANT stocky_matrix_mid TO stocky_runtime;
    `,
    restoreSql: `
      REVOKE stocky_matrix_mid FROM stocky_runtime;
      REVOKE ${OWNER} FROM stocky_matrix_mid;
      DROP ROLE stocky_matrix_mid;
    `,
    expectedCodePrefix: "member_of:stocky_matrix_mid",
    verifier: "enforcement",
  },
  ...(["SEQUENCES", "FUNCTIONS"] as const).flatMap(
    (objectType): PrivilegeCase[] =>
      (["stocky_runtime", "PUBLIC"] as const).map((grantee) => {
        const privilege = objectType === "SEQUENCES" ? "USAGE" : "EXECUTE";
        const objectKey = objectType === "SEQUENCES" ? "sequence" : "function";
        const granteeKey = grantee === "PUBLIC" ? "public" : "runtime";
        return {
          case: `${grantee} future-${objectKey} default`,
          injectSql: `ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER} IN SCHEMA public GRANT ${privilege} ON ${objectType} TO ${grantee}`,
          restoreSql: `ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER} IN SCHEMA public REVOKE ${privilege} ON ${objectType} FROM ${grantee}`,
          expectedCodePrefix: `unsafe_default_${objectKey}_priv:${granteeKey}:`,
          verifier: grantee === "PUBLIC" ? "enforcement" : "roles",
        };
      }),
  ),
];

function substituteOwner(sql: string, owner: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(owner)) {
    throw new Error(`unsafe_matrix_owner:${owner}`);
  }
  return sql.replaceAll(OWNER, `"${owner}"`);
}

async function runVerifier(
  client: Awaited<ReturnType<typeof getMigrationClient>>,
  verifier: VerifierName,
): Promise<{ ok: boolean; codes: string[] }> {
  if (verifier === "roles") {
    const result = await verifyRoles(client);
    return { ok: result.ok, codes: result.failures };
  }
  const result = await verifyEnforcement(client);
  return { ok: result.ok, codes: result.issues.map((issue) => issue.code) };
}

describe.sequential("complete exact-privilege matrix", () => {
  let prisma: PrismaClient;
  let owner: string;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const result = await client.query<{ owner: string }>(
        `SELECT r.rolname AS owner
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_roles r ON r.oid = c.relowner
         WHERE n.nspname = 'public'
           AND c.relname = 'Supplier'
           AND c.relkind = 'r'`,
      );
      owner = result.rows[0].owner;
    } finally {
      await client.end();
    }
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it.each(PRIVILEGE_CASES)(
    "$case",
    async (matrixCase) => {
      const client = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      const injectSql = substituteOwner(matrixCase.injectSql, owner);
      const restoreSql = substituteOwner(matrixCase.restoreSql, owner);
      let injected = false;
      try {
        const baseline = await runVerifier(client, matrixCase.verifier);
        expect(baseline.ok).toBe(true);

        await client.query(injectSql);
        injected = true;
        const drifted = await runVerifier(client, matrixCase.verifier);
        expect(drifted.ok).toBe(false);
        expect(
          drifted.codes.some((code) =>
            code.startsWith(matrixCase.expectedCodePrefix),
          ),
        ).toBe(true);
      } finally {
        if (injected) {
          await client.query(restoreSql);
        }
        if (matrixCase.repairAfterRestore) {
          const repaired = await applyEnforcement(client, { apply: true });
          expect(repaired.ok).toBe(true);
        }
        const restored = await verifyRoles(client);
        expect(restored.ok, restored.failures.join("|")).toBe(true);
        await client.end();
      }
    },
    60_000,
  );
});
