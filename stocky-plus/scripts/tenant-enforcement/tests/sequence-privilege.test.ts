/**
 * Public-schema sequence exact privilege checks (F-PR3C-05).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getMigrationClient } from "../connection";
import { verifyRoles } from "../roles";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe.sequential("sequence privilege enforcement", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("rejects every runtime and PUBLIC sequence privilege", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(`DROP SEQUENCE IF EXISTS public.evil_seq`);
      await client.query(`CREATE SEQUENCE public.evil_seq`);
      await client.query(
        `GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.evil_seq TO stocky_runtime`,
      );
      await client.query(
        `GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.evil_seq TO PUBLIC`,
      );

      const result = await verifyRoles(client);
      expect(result.ok).toBe(false);
      for (const grantee of ["stocky_runtime", "public"]) {
        for (const privilege of ["USAGE", "SELECT", "UPDATE"]) {
          expect(
            result.failures.some((failure) =>
              failure.startsWith(
                `excess_sequence_priv:evil_seq:${grantee}:${privilege}:`,
              ),
            ),
          ).toBe(true);
        }
      }

      await client.query(
        `REVOKE ALL ON SEQUENCE public.evil_seq FROM stocky_runtime`,
      );
      await client.query(`REVOKE ALL ON SEQUENCE public.evil_seq FROM PUBLIC`);
      await client.query(`DROP SEQUENCE public.evil_seq`);
      expect((await verifyRoles(client)).ok).toBe(true);
    } finally {
      await client.query(`DROP SEQUENCE IF EXISTS public.evil_seq`);
      await client.end();
    }
  });

  it("allows USAGE-only on catalog observation sequence and rejects UPDATE/setval drift", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const clean = await verifyRoles(client);
      expect(clean.ok).toBe(true);
      expect(
        clean.failures.some((failure) =>
          failure.includes("stocky_catalog_observation_gen_seq"),
        ),
      ).toBe(false);

      await client.query(
        `GRANT UPDATE ON SEQUENCE public.stocky_catalog_observation_gen_seq TO stocky_runtime`,
      );
      const drifted = await verifyRoles(client);
      expect(drifted.ok).toBe(false);
      expect(
        drifted.failures.some((failure) =>
          failure.startsWith(
            "excess_sequence_priv:stocky_catalog_observation_gen_seq:stocky_runtime:UPDATE:",
          ),
        ),
      ).toBe(true);

      await client.query(
        `REVOKE UPDATE ON SEQUENCE public.stocky_catalog_observation_gen_seq FROM stocky_runtime`,
      );
      expect((await verifyRoles(client)).ok).toBe(true);
    } finally {
      await client
        .query(
          `REVOKE UPDATE ON SEQUENCE public.stocky_catalog_observation_gen_seq FROM stocky_runtime`,
        )
        .catch(() => undefined);
      await client.end();
    }
  });
});
