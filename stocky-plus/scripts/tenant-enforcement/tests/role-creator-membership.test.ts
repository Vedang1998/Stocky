/**
 * PostgreSQL 16 non-superuser CREATEROLE creator-membership behavior (P3-d).
 */
import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { getBootstrapClient } from "../connection";
import {
  provisionRoles,
  readRuntimeCreatorMembership,
  verifyRoles,
} from "../roles";
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

describe.sequential("postgresql 16 role-creator membership", () => {
  let fixture: NonSuperuserOwnerFixture | undefined;

  afterAll(async () => {
    if (fixture) await destroyNonSuperuserMigrationOwnerFixture(fixture);
  });

  it("records safe owner→runtime admin membership and rejects reverse", async () => {
    requireRuntimeRolePassword();
    fixture = await createNonSuperuserMigrationOwnerFixture("creator");
    Object.assign(process.env, {
      DATABASE_URL: fixture.migrationUrl,
      DATABASE_MIGRATION_URL: fixture.migrationUrl,
      TENANT_MAINTENANCE_DATABASE_URL: fixture.migrationUrl,
      DATABASE_RUNTIME_URL: fixture.runtimeUrl,
      STOCKY_RUNTIME_ROLE: fixture.runtimeRole,
      STOCKY_RUNTIME_ROLE_PASSWORD: fixture.runtimePassword,
      STOCKY_MIGRATION_ROLE: fixture.migrationOwner,
      STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY: "1",
    });

    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: APP_ROOT,
      env: { ...process.env },
      stdio: "pipe",
    });

    const mig = new Client({ connectionString: fixture.migrationUrl });
    await mig.connect();
    try {
      const created = await provisionRoles(mig, {
        apply: true,
        phase: "prepare",
        runtimePassword: fixture.runtimePassword,
      });
      expect(created.ok).toBe(true);
      expect(created.createdRuntimeRole).toBe(true);

      await mig.query(
        `GRANT CONNECT ON DATABASE ${fixture.databaseName} TO ${fixture.runtimeRole}`,
      );

      const edges = await readRuntimeCreatorMembership(
        mig,
        fixture.runtimeRole,
      );
      expect(edges).toEqual([
        {
          member: fixture.migrationOwner,
          admin_option: true,
          inherit_option: false,
          set_option: false,
        },
      ]);

      const runtime = new Client({ connectionString: fixture.runtimeUrl });
      await runtime.connect();
      try {
        await expect(
          runtime.query(`SET ROLE ${fixture.migrationOwner}`),
        ).rejects.toThrow(/permission denied/i);
      } finally {
        await runtime.end();
      }

      await mig.query(
        `ALTER ROLE ${fixture.runtimeRole} NOCREATEROLE NOINHERIT`,
      );
      expect((await verifyRoles(mig)).ok).toBe(true);

      const boot = await getBootstrapClient();
      try {
        await boot.query(
          `REVOKE ${fixture.runtimeRole} FROM ${fixture.migrationOwner}`,
        );
        await boot.query(
          `GRANT ${fixture.migrationOwner} TO ${fixture.runtimeRole}`,
        );
      } finally {
        await boot.end();
      }
      const reverse = await verifyRoles(mig);
      expect(reverse.ok).toBe(false);
      expect(
        reverse.failures.some((f) =>
          f.includes(`member_of:${fixture!.migrationOwner}`),
        ),
      ).toBe(true);

      const boot2 = await getBootstrapClient();
      try {
        await boot2.query(
          `REVOKE ${fixture.migrationOwner} FROM ${fixture.runtimeRole}`,
        );
        await boot2.query(`CREATE ROLE stocky_mid_creator_esc NOINHERIT`);
        await boot2.query(
          `GRANT ${fixture.migrationOwner} TO stocky_mid_creator_esc`,
        );
        await boot2.query(
          `GRANT stocky_mid_creator_esc TO ${fixture.runtimeRole}`,
        );
      } finally {
        await boot2.end();
      }
      const transitive = await verifyRoles(mig);
      expect(transitive.ok).toBe(false);
      expect(
        transitive.failures.some((f) =>
          f.includes("member_of:stocky_mid_creator_esc"),
        ),
      ).toBe(true);
    } finally {
      await mig.end();
      const boot3 = await getBootstrapClient();
      try {
        await boot3
          .query(`REVOKE stocky_mid_creator_esc FROM ${fixture!.runtimeRole}`)
          .catch(() => undefined);
        await boot3.query(`DROP ROLE IF EXISTS stocky_mid_creator_esc`);
      } finally {
        await boot3.end();
      }
    }
  }, 300_000);
});
