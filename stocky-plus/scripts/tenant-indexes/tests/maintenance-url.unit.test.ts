import { describe, expect, it } from "vitest";
import { resolveMaintenanceDatabaseUrl } from "../connection";

describe("maintenance URL enforcement (R12)", () => {
  it("apply requires explicit TENANT_MAINTENANCE_DATABASE_URL", () => {
    const prevMaint = process.env.TENANT_MAINTENANCE_DATABASE_URL;
    const prevDb = process.env.DATABASE_URL;
    try {
      delete process.env.TENANT_MAINTENANCE_DATABASE_URL;
      process.env.DATABASE_URL =
        "postgresql://stocky:stocky@localhost:5432/stocky_plus_migrations";
      expect(() =>
        resolveMaintenanceDatabaseUrl({ requireExplicitMaintenanceUrl: true }),
      ).toThrow(/TENANT_MAINTENANCE_DATABASE_URL is required/);
    } finally {
      process.env.TENANT_MAINTENANCE_DATABASE_URL = prevMaint;
      process.env.DATABASE_URL = prevDb;
    }
  });

  it("blank maintenance URL fails before connection for apply", () => {
    const prevMaint = process.env.TENANT_MAINTENANCE_DATABASE_URL;
    try {
      process.env.TENANT_MAINTENANCE_DATABASE_URL = "   ";
      expect(() =>
        resolveMaintenanceDatabaseUrl({ requireExplicitMaintenanceUrl: true }),
      ).toThrow(/TENANT_MAINTENANCE_DATABASE_URL is required/);
    } finally {
      process.env.TENANT_MAINTENANCE_DATABASE_URL = prevMaint;
    }
  });

  it("pooler-pattern maintenance URL fails for apply", () => {
    const prevMaint = process.env.TENANT_MAINTENANCE_DATABASE_URL;
    try {
      process.env.TENANT_MAINTENANCE_DATABASE_URL =
        "postgresql://stocky:stocky@pooler.example:5432/db";
      expect(() =>
        resolveMaintenanceDatabaseUrl({ requireExplicitMaintenanceUrl: true }),
      ).toThrow(/pooler/i);
    } finally {
      process.env.TENANT_MAINTENANCE_DATABASE_URL = prevMaint;
    }
  });

  it("explicit direct maintenance URL succeeds", () => {
    const prevMaint = process.env.TENANT_MAINTENANCE_DATABASE_URL;
    try {
      process.env.TENANT_MAINTENANCE_DATABASE_URL =
        "postgresql://stocky:stocky@localhost:5432/stocky_plus_migrations";
      expect(
        resolveMaintenanceDatabaseUrl({ requireExplicitMaintenanceUrl: true }),
      ).toContain("localhost");
    } finally {
      process.env.TENANT_MAINTENANCE_DATABASE_URL = prevMaint;
    }
  });

  it("plan/verify may fall back to DATABASE_URL", () => {
    const prevMaint = process.env.TENANT_MAINTENANCE_DATABASE_URL;
    const prevDb = process.env.DATABASE_URL;
    try {
      delete process.env.TENANT_MAINTENANCE_DATABASE_URL;
      process.env.DATABASE_URL =
        "postgresql://stocky:stocky@localhost:5432/stocky_plus_migrations";
      expect(resolveMaintenanceDatabaseUrl()).toContain("localhost");
    } finally {
      process.env.TENANT_MAINTENANCE_DATABASE_URL = prevMaint;
      process.env.DATABASE_URL = prevDb;
    }
  });
});
