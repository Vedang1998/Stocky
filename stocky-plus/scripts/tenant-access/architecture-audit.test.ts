import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  ACCESS_EXCEPTIONS,
  assertAllowlistPathsAreExact,
  exceptionForPath,
} from "./allowlist";
import { assertNoViolations, scanRepository, type AccessFinding } from "./scan";

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
    // Includes SyncApplicationReceipt (PR 4 D-043 merchant-domain receipt).
    expect(result.modelsCovered.length).toBe(26);
    // P3-c: EX-RAW-001 removed — construction lives in EX-RAW-002 only.
    expect(result.exceptionsUsed).toContain("EX-RAW-002");
    expect(result.exceptionsUsed).not.toContain("EX-RAW-001");
    expect(result.exceptionsUsed).toContain("EX-BOOT-001");
    expect(result.exceptionsUsed).toContain("EX-TDB-001");
    expect(result.contentDigest).toMatch(/^[a-f0-9]{64}$/);
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

  it("fails on dynamic raw-Prisma import with computed delegate", () => {
    const violations = scanFixture(
      "dynamic-db-import.ts.fixture",
      "app/services/dyn-leak.ts",
    );
    expect(
      violations.some(
        (v) =>
          v.kind === "db_server_dynamic_import" ||
          v.kind === "computed_delegate_access",
      ),
    ).toBe(true);
  });

  it("fails on raw-Prisma re-export chain", () => {
    const violations = scanFixture(
      "reexport-db-server.ts.fixture",
      "app/services/reexport.ts",
    );
    expect(violations.some((v) => v.kind === "db_server_reexport")).toBe(true);
  });

  it("fails on path-alias db.server import", () => {
    const violations = scanFixture(
      "alias-db-import.ts.fixture",
      "app/services/alias-leak.ts",
    );
    expect(violations.some((v) => v.kind === "db_server_import")).toBe(true);
  });

  it("fails on computed delegate access", () => {
    const violations = scanFixture(
      "computed-delegate.ts.fixture",
      "app/services/computed.ts",
    );
    expect(
      violations.some(
        (v) =>
          v.kind === "computed_delegate_access" ||
          v.kind === "db_server_import",
      ),
    ).toBe(true);
  });

  it("fails on aliased delegate access from raw prisma", () => {
    const violations = scanFixture(
      "aliased-delegate.ts.fixture",
      "app/services/aliased.ts",
    );
    expect(
      violations.some(
        (v) =>
          v.kind === "db_server_import" ||
          v.kind === "merchant_delegate_call",
      ),
    ).toBe(true);
  });

  it("fails on raw shop-only queue payload", () => {
    const violations = scanFixture(
      "raw-shop-queue.ts.fixture",
      "app/jobs/bad-queue.ts",
    );
    expect(violations.some((v) => v.kind === "raw_shop_queue_payload")).toBe(
      true,
    );
  });

  it("fails when queue producer accepts arbitrary envelope union", () => {
    const violations = scanFixture(
      "arbitrary-envelope-enqueue.ts.fixture",
      "app/jobs/queue.server.ts",
    );
    expect(
      violations.some((v) => v.kind === "arbitrary_envelope_enqueue"),
    ).toBe(true);
  });

  it("fails on derived dynamic import path concatenation (F-PR2C-07 B-1)", () => {
    const violations = scanFixture(
      "derived-dynamic-import.ts.fixture",
      "app/services/derived-dynamic.ts",
    );
    expect(
      violations.some(
        (v) =>
          v.kind === "db_server_dynamic_import" ||
          v.kind === "merchant_delegate_call",
      ),
    ).toBe(true);
  });

  it("fails on computed join delegate access (F-PR2C-07 B-2)", () => {
    const violations = scanFixture(
      "computed-join-delegate.ts.fixture",
      "app/services/computed-join.ts",
    );
    expect(
      violations.some((v) => v.kind === "computed_delegate_access"),
    ).toBe(true);
  });

  it("fails on destructured raw delegate (F-PR2C-07 B-3)", () => {
    const violations = scanFixture(
      "destructured-delegate.ts.fixture",
      "app/services/destructured.ts",
    );
    expect(
      violations.some(
        (v) =>
          v.kind === "computed_delegate_access" ||
          v.kind === "merchant_delegate_call" ||
          v.kind === "db_server_import",
      ),
    ).toBe(true);
  });

  it("fails on re-export alias of db.server (F-PR2C-07)", () => {
    const violations = scanFixture(
      "reexport-alias-db.ts.fixture",
      "app/services/data-client.ts",
    );
    expect(violations.some((v) => v.kind === "db_server_reexport")).toBe(true);
  });

  it("fails on aliased issueTenantAuthority outside tenant (F-PR2C-07 B-6)", () => {
    const violations = scanFixture(
      "aliased-issue-authority.ts.fixture",
      "app/services/mint-authority.ts",
    );
    expect(
      violations.some((v) => v.kind === "issue_authority_outside_tenant"),
    ).toBe(true);
  });

  it("fails when producer forwards TenantJobEnvelopeV1 (F-PR2C-07 B-5)", () => {
    const violations = scanFixture(
      "forwarding-envelope-producer.ts.fixture",
      "app/jobs/queue.server.ts",
    );
    expect(
      violations.some((v) => v.kind === "arbitrary_envelope_enqueue"),
    ).toBe(true);
  });

  it("fails on computed shop key in queue payload (F-PR2C-07 B-9)", () => {
    const violations = scanFixture(
      "computed-shop-queue-key.ts.fixture",
      "app/jobs/computed-shop-queue.ts",
    );
    expect(
      violations.some(
        (v) =>
          v.kind === "raw_shop_queue_payload" ||
          v.kind === "arbitrary_envelope_enqueue",
      ),
    ).toBe(true);
  });

  it("fails when allowlist contains a directory-wide path via real validator", () => {
    expect(() =>
      assertAllowlistPathsAreExact([
        { id: "EX-BAD", path: "scripts/tenant-backfill/" },
      ]),
    ).toThrow(/wildcard|directory/);
  });

  it("exact allowlist matching does not inherit suffix paths (F-PR2C-11)", () => {
    expect(exceptionForPath("other-workspace/app/db.server.ts")).toBeUndefined();
    expect(exceptionForPath("nested-copy/app/db.server.ts")).toBeUndefined();
    expect(
      exceptionForPath("fixture-root/app/tenant/tenant-db.server.ts"),
    ).toBeUndefined();
    // P3-c: EX-RAW-001 removed; facade has no raw construction exception.
    expect(exceptionForPath("app/db.server.ts")).toBeUndefined();
    expect(exceptionForPath("app/db/runtime-identity.server.ts")?.id).toBe(
      "EX-RAW-002",
    );
  });

  it("fails closed on unused or duplicated raw exception IDs (P3-c)", () => {
    const result = scanRepository();
    expect(() => assertNoViolations(result)).not.toThrow();
    expect(ACCESS_EXCEPTIONS.some((ex) => ex.id === "EX-RAW-001")).toBe(false);
    const ids = ACCESS_EXCEPTIONS.map((ex) => ex.id);
    expect(new Set(ids).size).toBe(ids.length);
    const raw = ACCESS_EXCEPTIONS.filter(
      (ex) => ex.category === "raw_prisma_construction",
    );
    for (const ex of raw) {
      expect(result.exceptionsUsed).toContain(ex.id);
    }
  });

  it("fails when generated inventory would be stale", async () => {
    const inventoryPath = path.join(
      APP_ROOT,
      "docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md",
    );
    const original = fs.readFileSync(inventoryPath, "utf8");
    try {
      fs.writeFileSync(inventoryPath, original + "\n<!-- stale -->\n");
      let failed = false;
      try {
        const { execFileSync } = await import("node:child_process");
        execFileSync(
          process.execPath,
          [
            path.join(APP_ROOT, "node_modules/tsx/dist/cli.mjs"),
            path.join(HERE, "inventory-check.ts"),
          ],
          { cwd: APP_ROOT, stdio: "pipe" },
        );
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
    } finally {
      fs.writeFileSync(inventoryPath, original);
    }
  });

  it("approved exact maintenance exceptions remain non-violating on main tree", () => {
    const result = scanRepository();
    const backfill = result.findings.filter((f) =>
      f.file.startsWith("scripts/tenant-backfill/"),
    );
    expect(backfill.length).toBeGreaterThan(0);
    expect(backfill.every((f) => f.conversionStatus !== "violation")).toBe(
      true,
    );
    expect(result.exceptionsUsed.some((id) => id.startsWith("EX-BF-"))).toBe(
      true,
    );
  });
});
