/**
 * The privacy erasure verifier must notice every way the erasure function's
 * privileges can be widened, and provisioning must put each one back.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { verifyRlsOnly } from "../../tenant-enforcement/verify";
import {
  defaultPrivacyErasureOwnerRoleName,
  provisionPrivacyErasureOwner,
  verifyPrivacyErasure,
} from "../privacy-erasure";
import { defaultControlPlaneRoleName, defaultRuntimeRoleName } from "../roles";

const FN = "public.stocky_privacy_erase_shop_batch(text, integer)";
const BYSTANDER_ROLE = "stocky_privacy_test_bystander";

describe("privacy erasure privileges", () => {
  const owner = defaultPrivacyErasureOwnerRoleName();
  const controlPlane = defaultControlPlaneRoleName();
  const runtime = defaultRuntimeRoleName();
  const roles = { controlPlaneRole: controlPlane, runtimeRole: runtime };
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      connectionString:
        process.env.DATABASE_MIGRATION_URL ||
        process.env.TENANT_MAINTENANCE_DATABASE_URL ||
        process.env.DATABASE_URL,
    });
    await client.connect();
    await provisionPrivacyErasureOwner(client, roles);
    await client.query(`DROP ROLE IF EXISTS "${BYSTANDER_ROLE}"`);
    await client.query(`CREATE ROLE "${BYSTANDER_ROLE}" NOLOGIN`);
  });

  afterAll(async () => {
    await provisionPrivacyErasureOwner(client, roles);
    await client.query(`DROP ROLE IF EXISTS "${BYSTANDER_ROLE}"`);
    await client.end();
  });

  it("verifies cleanly once provisioned, and provisioning is repeatable", async () => {
    expect(await verifyPrivacyErasure(client, roles)).toEqual([]);
    await provisionPrivacyErasureOwner(client, roles);
    expect(await verifyPrivacyErasure(client, roles)).toEqual([]);
    expect((await verifyRlsOnly(client)).issues).toEqual([]);
  });

  const drifts: Array<{ name: string; sql: string; reports: string }> = [
    {
      name: "the runtime role may execute the function",
      sql: `GRANT EXECUTE ON FUNCTION ${FN} TO "${runtime}"`,
      reports: "runtime_has_privacy_erasure_execute",
    },
    {
      name: "everyone may execute the function",
      sql: `GRANT EXECUTE ON FUNCTION ${FN} TO PUBLIC`,
      reports: "public_has_privacy_erasure_execute",
    },
    {
      name: "a role that has no part in erasure may execute the function",
      sql: `GRANT EXECUTE ON FUNCTION ${FN} TO "${BYSTANDER_ROLE}"`,
      reports: `privacy_erasure_execute_granted:${BYSTANDER_ROLE}`,
    },
    {
      name: "the function is owned by another role",
      sql: `ALTER FUNCTION ${FN} OWNER TO CURRENT_USER`,
      reports: "privacy_erasure_function_owner:",
    },
    {
      name: "the function's search path is no longer pinned",
      sql: `ALTER FUNCTION ${FN} RESET search_path`,
      reports: "privacy_erasure_unsafe_search_path",
    },
    {
      name: "a delete policy matches every shop",
      sql: `DROP POLICY stocky_privacy_erasure_delete ON "Supplier";
            CREATE POLICY stocky_privacy_erasure_delete ON "Supplier"
              FOR DELETE TO "${owner}" USING (true)`,
      reports:
        "privacy_erasure_policy_predicate_drift:Supplier:stocky_privacy_erasure_delete",
    },
    {
      name: "a policy is missing from a shop-keyed table",
      sql: `DROP POLICY stocky_privacy_erasure_select ON "Supplier"`,
      reports:
        "privacy_erasure_policy_missing:Supplier:stocky_privacy_erasure_select",
    },
    {
      name: "the owner role may change rows",
      sql: `GRANT UPDATE ON TABLE "Supplier" TO "${owner}"`,
      reports: "privacy_erasure_table_privileges:Supplier:DELETE+SELECT+UPDATE",
    },
    {
      name: "the owner role may read sessions",
      sql: `GRANT SELECT ON TABLE "Session" TO "${owner}"`,
      reports: "privacy_erasure_unexpected_grant:Session:SELECT",
    },
    {
      name: "the owner role may read whole shop rows",
      sql: `GRANT SELECT ON TABLE "Shop" TO "${owner}"`,
      reports: "privacy_erasure_unexpected_grant:Shop:SELECT",
    },
    {
      name: "the owner role can log in",
      sql: `ALTER ROLE "${owner}" LOGIN`,
      reports: "privacy_erasure_owner_can_login",
    },
    {
      name: "the control plane is a member of the owner role",
      sql: `GRANT "${owner}" TO "${controlPlane}"`,
      reports: `privacy_erasure_owner_membership:${owner}:${controlPlane}`,
    },
  ];

  it.each(drifts)("reports and repairs: $name", async ({ sql, reports }) => {
    await client.query(sql);

    const errors = await verifyPrivacyErasure(client, roles);
    expect(errors.some((error) => error.startsWith(reports))).toBe(true);

    await provisionPrivacyErasureOwner(client, roles);
    expect(await verifyPrivacyErasure(client, roles)).toEqual([]);
  });

  it.each([
    ["the runtime role", () => runtime],
    ["the control-plane role", () => controlPlane],
  ])(
    "is flagged by the tenant enforcement check when a policy names %s",
    async (_name, role) => {
      await client.query(
        `ALTER POLICY stocky_privacy_erasure_select ON "Supplier" TO "${role()}"`,
      );

      const errors = await verifyPrivacyErasure(client, roles);
      const rls = await verifyRlsOnly(client);
      expect(errors).toContain(
        "privacy_erasure_policy_wrong_role:Supplier:stocky_privacy_erasure_select",
      );
      expect(rls.issues).toContainEqual({
        code: "privacy_erasure_policy_unsafe",
        table: "Supplier",
        detail: `stocky_privacy_erasure_select:r:${role()}`,
      });

      await provisionPrivacyErasureOwner(client, roles);
      expect(await verifyPrivacyErasure(client, roles)).toEqual([]);
      expect((await verifyRlsOnly(client)).issues).toEqual([]);
    },
  );
});
