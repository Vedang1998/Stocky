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
});
