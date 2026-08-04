/**
 * Non-superuser CREATEROLE migration-owner full enforcement lifecycle (F-NEW-01).
 *
 * Bootstrap superuser creates the disposable database and migration owner, then
 * all migrations/provision/apply/verify run only as the non-superuser owner.
 */
import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { applyEnforcement } from "../apply";
import { getBootstrapClient } from "../connection";
import { MERCHANT_SQL_TABLES } from "../manifest";
import { runPreflight } from "../preflight";
import {
  provisionRoles,
  readRuntimeCreatorMembership,
  verifyRoles,
} from "../roles";
import { verifyEnforcement, verifyRlsOnly } from "../verify";
import {
  createNonSuperuserMigrationOwnerFixture,
  destroyNonSuperuserMigrationOwnerFixture,
  requireRuntimeRolePassword,
  type NonSuperuserOwnerFixture,
} from "./helpers";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe.sequential("non-superuser migration-owner full enforcement", () => {
  let fixture: NonSuperuserOwnerFixture;

  afterAll(async () => {
    if (fixture) await destroyNonSuperuserMigrationOwnerFixture(fixture);
  });

  it("completes provision, apply, verify under non-superuser CREATEROLE owner", async () => {
    requireRuntimeRolePassword();
    fixture = await createNonSuperuserMigrationOwnerFixture("full");

    const bootstrap = await getBootstrapClient();
    try {
      const attrs = await bootstrap.query<{
        rolsuper: boolean;
        rolbypassrls: boolean;
        rolcreaterole: boolean;
        rolcreatedb: boolean;
      }>(
        `SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
         FROM pg_roles WHERE rolname = $1`,
        [fixture.migrationOwner],
      );
      expect(attrs.rows[0]).toEqual({
        rolsuper: false,
        rolbypassrls: false,
        rolcreaterole: true,
        rolcreatedb: false,
      });
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          event: "non_superuser_migration_owner_attrs",
          migration_owner: fixture.migrationOwner,
          ...attrs.rows[0],
        }),
      );
    } finally {
      await bootstrap.end();
    }

    const env = {
      ...process.env,
      DATABASE_URL: fixture.migrationUrl,
      DATABASE_MIGRATION_URL: fixture.migrationUrl,
      TENANT_MAINTENANCE_DATABASE_URL: fixture.migrationUrl,
      DATABASE_RUNTIME_URL: fixture.runtimeUrl,
      STOCKY_RUNTIME_ROLE: fixture.runtimeRole,
      STOCKY_RUNTIME_ROLE_PASSWORD: fixture.runtimePassword,
      STOCKY_MIGRATION_ROLE: fixture.migrationOwner,
      STOCKY_REQUIRE_NONSUPERUSER_OWNER: "1",
      STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY: "1",
    };
    Object.assign(process.env, {
      DATABASE_URL: fixture.migrationUrl,
      DATABASE_MIGRATION_URL: fixture.migrationUrl,
      TENANT_MAINTENANCE_DATABASE_URL: fixture.migrationUrl,
      DATABASE_RUNTIME_URL: fixture.runtimeUrl,
      STOCKY_RUNTIME_ROLE: fixture.runtimeRole,
      STOCKY_RUNTIME_ROLE_PASSWORD: fixture.runtimePassword,
      STOCKY_MIGRATION_ROLE: fixture.migrationOwner,
      STOCKY_REQUIRE_NONSUPERUSER_OWNER: "1",
      STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY: "1",
    });

    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: APP_ROOT,
      env,
      stdio: "pipe",
    });
    execFileSync("npm", ["run", "tenant:indexes:apply", "--", "--apply"], {
      cwd: APP_ROOT,
      env,
      stdio: "pipe",
    });

    const mig = new Client({ connectionString: fixture.migrationUrl });
    await mig.connect();
    try {
      const identity = await mig.query<{
        current_user: string;
        rolsuper: boolean;
      }>(
        `SELECT current_user,
                (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS rolsuper`,
      );
      expect(identity.rows[0].current_user).toBe(fixture.migrationOwner);
      expect(identity.rows[0].rolsuper).toBe(false);

      const firstProvision = await provisionRoles(mig, {
        apply: true,
        phase: "prepare",
        runtimePassword: fixture.runtimePassword,
      });
      expect(firstProvision.ok).toBe(true);
      expect(firstProvision.createdRuntimeRole).toBe(true);
      await mig.query(
        `GRANT CONNECT ON DATABASE ${fixture.databaseName} TO ${fixture.runtimeRole}`,
      );

      const membership = await readRuntimeCreatorMembership(
        mig,
        fixture.runtimeRole,
      );
      expect(
        membership.some(
          (m) =>
            m.member === fixture.migrationOwner &&
            m.admin_option === true &&
            m.inherit_option === false &&
            m.set_option === false,
        ),
      ).toBe(true);

      const secondProvision = await provisionRoles(mig, {
        apply: true,
        phase: "prepare",
        runtimePassword: fixture.runtimePassword,
      });
      expect(secondProvision.ok).toBe(true);
      expect(secondProvision.createdRuntimeRole).toBe(false);

      const preflight = await runPreflight(mig, { mode: "initial" });
      expect(preflight.ok).toBe(true);

      const firstApply = await applyEnforcement(mig, { apply: true });
      expect(firstApply.ok).toBe(true);
      expect(firstApply.unsafe_runtime_access).toBe(false);
      const completed = firstApply.steps.filter((s) => s.status === "completed");
      expect(completed.length).toBe(firstApply.steps.length);
      expect(completed.length).toBeGreaterThan(100);

      const secondApply = await applyEnforcement(mig, { apply: true });
      expect(secondApply.ok).toBe(true);

      const roles = await verifyRoles(mig, { requireMerchantDml: true });
      expect(roles.ok).toBe(true);
      expect(roles.attributes.rolsuper).toBe(false);
      expect(roles.attributes.rolbypassrls).toBe(false);

      const rls = await verifyRlsOnly(mig);
      expect(rls.ok).toBe(true);
      const enforcement = await verifyEnforcement(mig);
      expect(enforcement.ok).toBe(true);

      const forced = await mig.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = ANY($1::text[])
           AND c.relrowsecurity AND c.relforcerowsecurity`,
        [MERCHANT_SQL_TABLES],
      );
      expect(Number(forced.rows[0].c)).toBe(MERCHANT_SQL_TABLES.length);

      // Seed via bootstrap: FORCE RLS applies to non-superuser table owners too,
      // and policies are granted only to the runtime role.
      const bootSeed = await getBootstrapClient();
      const bootOnDb = new Client({
        connectionString: (() => {
          const u = new URL(fixture.bootstrapUrl);
          u.pathname = `/${fixture.databaseName}`;
          return u.toString();
        })(),
      });
      await bootOnDb.connect();
      try {
        await bootOnDb.query(
          `INSERT INTO "Shop" (id, "myshopifyDomain", "createdAt", "updatedAt")
           VALUES ('shop_a', 'a.myshopify.com', NOW(), NOW()),
                  ('shop_b', 'b.myshopify.com', NOW(), NOW())`,
        );
        await bootOnDb.query(
          `INSERT INTO "Supplier" (id, shop, "shopId", name, "createdAt", "updatedAt")
           VALUES ('sup_a', 'a.myshopify.com', 'shop_a', 'A', NOW(), NOW()),
                  ('sup_b', 'b.myshopify.com', 'shop_b', 'B', NOW(), NOW())`,
        );
      } finally {
        await bootOnDb.end();
        await bootSeed.end();
      }

      const runtime = new Client({ connectionString: fixture.runtimeUrl });
      await runtime.connect();
      try {
        await runtime.query("BEGIN");
        // Missing tenant context: RLS filters to zero rows (does not raise).
        const denied = await runtime.query(`SELECT id FROM "Supplier"`);
        expect(denied.rows).toEqual([]);
        await runtime.query("ROLLBACK");

        await runtime.query("BEGIN");
        await runtime.query(
          `SELECT set_config('stocky.current_shop_id', $1, true)`,
          ["shop_a"],
        );
        await runtime.query(
          `SELECT set_config('stocky.tenant_context_version', 'phase1-db-tenant-context-v1', true)`,
        );
        const own = await runtime.query(`SELECT id FROM "Supplier"`);
        expect(own.rows.map((r) => r.id)).toEqual(["sup_a"]);
        // Cross-tenant row must not be visible.
        expect(own.rows.some((r) => r.id === "sup_b")).toBe(false);
        await runtime.query("COMMIT");
      } finally {
        await runtime.end();
      }

      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          event: "non_superuser_enforcement_complete",
          completed_steps: completed.length,
          total_steps: firstApply.steps.length,
          forced_rls_tables: Number(forced.rows[0].c),
        }),
      );
    } finally {
      await mig.end();
    }
  }, 600_000);

  it("fails closed on privileged runtime attributes without attempted repair", async () => {
    requireRuntimeRolePassword();
    const local = await createNonSuperuserMigrationOwnerFixture("drift");
    try {
      const env = {
        ...process.env,
        DATABASE_URL: local.migrationUrl,
        DATABASE_MIGRATION_URL: local.migrationUrl,
        TENANT_MAINTENANCE_DATABASE_URL: local.migrationUrl,
        DATABASE_RUNTIME_URL: local.runtimeUrl,
        STOCKY_RUNTIME_ROLE: local.runtimeRole,
        STOCKY_RUNTIME_ROLE_PASSWORD: local.runtimePassword,
        STOCKY_MIGRATION_ROLE: local.migrationOwner,
        STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY: "1",
      };
      Object.assign(process.env, {
        DATABASE_URL: local.migrationUrl,
        DATABASE_MIGRATION_URL: local.migrationUrl,
        TENANT_MAINTENANCE_DATABASE_URL: local.migrationUrl,
        DATABASE_RUNTIME_URL: local.runtimeUrl,
        STOCKY_RUNTIME_ROLE: local.runtimeRole,
        STOCKY_RUNTIME_ROLE_PASSWORD: local.runtimePassword,
        STOCKY_MIGRATION_ROLE: local.migrationOwner,
        STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY: "1",
      });
      execFileSync("npx", ["prisma", "migrate", "deploy"], {
        cwd: APP_ROOT,
        env,
        stdio: "pipe",
      });

      const mig = new Client({ connectionString: local.migrationUrl });
      await mig.connect();
      try {
        const prep = await provisionRoles(mig, {
          apply: true,
          phase: "prepare",
          runtimePassword: local.runtimePassword,
        });
        expect(prep.ok).toBe(true);

        // Safe second run
        expect(
          (
            await provisionRoles(mig, {
              apply: true,
              phase: "prepare",
              runtimePassword: local.runtimePassword,
            })
          ).ok,
        ).toBe(true);

        // Inject SUPERUSER via bootstrap only
        const boot = await getBootstrapClient();
        try {
          await boot.query(
            `ALTER ROLE ${local.runtimeRole} SUPERUSER`,
          );
        } finally {
          await boot.end();
        }

        const superFail = await provisionRoles(mig, {
          apply: true,
          phase: "prepare",
          repairDangerousDrift: true,
        });
        expect(superFail.ok).toBe(false);
        expect(superFail.errors).toContain(
          "runtime_role_superuser_requires_bootstrap_repair",
        );

        const boot2 = await getBootstrapClient();
        try {
          await boot2.query(
            `ALTER ROLE ${local.runtimeRole} NOSUPERUSER NOBYPASSRLS`,
          );
          await boot2.query(
            `ALTER ROLE ${local.runtimeRole} BYPASSRLS`,
          );
        } finally {
          await boot2.end();
        }

        const bypassFail = await provisionRoles(mig, {
          apply: true,
          phase: "prepare",
          repairDangerousDrift: true,
        });
        expect(bypassFail.ok).toBe(false);
        expect(bypassFail.errors).toContain(
          "runtime_role_bypassrls_requires_bootstrap_repair",
        );

        const boot3 = await getBootstrapClient();
        try {
          await boot3.query(
            `ALTER ROLE ${local.runtimeRole} NOBYPASSRLS`,
          );
          // Break PG16 creator membership before granting the reverse edge.
          await boot3.query(
            `REVOKE ${local.runtimeRole} FROM ${local.migrationOwner}`,
          );
          await boot3.query(
            `GRANT ${local.migrationOwner} TO ${local.runtimeRole}`,
          );
        } finally {
          await boot3.end();
        }

        const memberFail = await verifyRoles(mig);
        expect(memberFail.ok).toBe(false);
        expect(
          memberFail.failures.some((f) =>
            f.includes(`member_of:${local.migrationOwner}`),
          ),
        ).toBe(true);
      } finally {
        await mig.end();
      }
    } finally {
      await destroyNonSuperuserMigrationOwnerFixture(local);
    }
  }, 600_000);
});
