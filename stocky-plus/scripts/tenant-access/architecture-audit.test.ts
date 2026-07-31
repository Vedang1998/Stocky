import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { scanRepository, type AccessFinding } from "./scan";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures");
const APP_ROOT = path.resolve(HERE, "../..");
const TMP = path.join(APP_ROOT, ".tmp-tenant-audit");

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

function scanFixture(
  fixtureName: string,
  destRelPath: string,
): AccessFinding[] {
  const dest = path.join(TMP, destRelPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, fixtureName), dest);
  const result = scanRepository({
    roots: [TMP],
    pathRoot: TMP,
    checkAllowlistPaths: false,
  });
  return result.violations;
}

describe("tenant access architecture audit", () => {
  it("passes on the real repository (approved exceptions only)", () => {
    const result = scanRepository();
    expect(result.violations).toEqual([]);
    expect(result.modelsCovered.length).toBe(18);
    expect(result.exceptionsUsed).toContain("EX-RAW-001");
    expect(result.exceptionsUsed).toContain("EX-BOOT-001");
    expect(result.exceptionsUsed).toContain("EX-TDB-001");
  });

  it("fails on direct db.server route import", () => {
    const violations = scanFixture(
      "route-db-import.ts.fixture",
      "app/routes/bad-route.ts",
    );
    expect(violations.some((v) => v.kind === "db_server_import")).toBe(true);
  });

  it("fails on direct db.server service import", () => {
    const violations = scanFixture(
      "service-db-import.ts.fixture",
      "app/services/bad-service.ts",
    );
    expect(violations.some((v) => v.kind === "db_server_import")).toBe(true);
  });

  it("fails on worker PrismaClient construction + merchant access", () => {
    const violations = scanFixture(
      "worker-prisma-import.ts.fixture",
      "app/jobs/workers/bad-worker.ts",
    );
    expect(
      violations.some(
        (v) =>
          v.kind === "prisma_client_construction" ||
          v.kind === "merchant_delegate_call",
      ),
    ).toBe(true);
  });

  it("fails on unauthorized raw query", () => {
    const violations = scanFixture(
      "unauthorized-raw-query.ts.fixture",
      "app/services/bad-raw.ts",
    );
    expect(
      violations.some(
        (v) => v.kind === "raw_sql" || v.kind === "db_server_import",
      ),
    ).toBe(true);
  });

  it("fails when bootstrap accesses a merchant model", () => {
    const violations = scanFixture(
      "bootstrap-merchant-access.ts.fixture",
      "app/tenant/bootstrap.server.ts",
    );
    expect(
      violations.some(
        (v) =>
          v.kind === "bootstrap_merchant_access" ||
          v.kind === "merchant_delegate_call" ||
          v.kind === "db_server_import",
      ),
    ).toBe(true);
  });

  it("approved narrow maintenance exceptions remain non-violating on main tree", () => {
    const result = scanRepository();
    const backfill = result.findings.filter((f) =>
      f.file.startsWith("scripts/tenant-backfill/"),
    );
    expect(backfill.length).toBeGreaterThan(0);
    expect(backfill.every((f) => f.conversionStatus !== "violation")).toBe(
      true,
    );
  });
});
