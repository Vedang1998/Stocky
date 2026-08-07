/**
 * D-048 / P2-D047-R03 — concurrent claim-index pre-creation on populated DurableJob.
 * Disposable PostgreSQL only. No production migration is executed as a live rollout.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SYNC_CLAIM_INDEXES,
  applyClaimIndexesConcurrently,
  classifyClaimIndex,
  inspectClaimIndex,
  recoveryInstruction,
} from "../claim-indexes";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function maintenanceUrl(): string {
  const url =
    process.env.TENANT_MAINTENANCE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url;
}

describe("sync claim-indexes concurrent rollout (D-048 / P2-D047-R03)", () => {
  let client: pg.Client;
  const dbName = `stocky_claim_idx_${Date.now()}`;

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: maintenanceUrl() });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    const url = maintenanceUrl().replace(/\/[^/]+(\?|$)/, `/${dbName}$1`);
    process.env.DATABASE_URL = url;
    process.env.DATABASE_MIGRATION_URL = url;
    process.env.TENANT_MAINTENANCE_DATABASE_URL = url;

    // Migrate up to (but not requiring) claim indexes via full chain — then
    // drop claim indexes to simulate populated pre-create path.
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: APP_ROOT,
      env: process.env,
      stdio: "pipe",
    });

    client = new pg.Client({ connectionString: url });
    await client.connect();

    // Ensure a shop exists for FK.
    await client.query(`
      INSERT INTO "Shop" (id, "myshopifyDomain", "processingEnabled", "createdAt", "updatedAt")
      VALUES ('claim-idx-shop', 'claim-idx.myshopify.com', true, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);

    // Populate DurableJob.
    for (let n = 0; n < 2000; n += 200) {
      const values: string[] = [];
      for (let i = 0; i < 200; i++) {
        const id = `claim_pop_${n + i}`;
        values.push(
          `('${id}','claim-idx-shop','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1','{}','${"p".repeat(64)}','idem-${id}','corr-${id}','tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',NOW(),NOW(),NOW())`,
        );
      }
      await client.query(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES ${values.join(",")}
        ON CONFLICT DO NOTHING
      `);
    }

    // Drop claim indexes if migration created them so we can exercise CONCURRENTLY.
    for (const entry of SYNC_CLAIM_INDEXES) {
      await client.query(`DROP INDEX IF EXISTS "${entry.name}"`);
    }
  }, 300_000);

  afterAll(async () => {
    await client.end().catch(() => undefined);
    const admin = new pg.Client({
      connectionString:
        process.env.STOCKY_BOOTSTRAP_DATABASE_URL ||
        process.env.DATABASE_URL?.replace(/\/[^/]+(\?|$)/, "/postgres$1") ||
        maintenanceUrl(),
    });
    try {
      await admin.connect();
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      await admin.end();
    } catch {
      /* best-effort cleanup */
    }
  });

  it("populated precreation uses CREATE INDEX CONCURRENTLY and matches schema", async () => {
    // Hold an open REPEATABLE READ snapshot so CONCURRENTLY stays in flight long
    // enough for concurrent writes to overlap.
    const holder = new pg.Client({
      connectionString: process.env.TENANT_MAINTENANCE_DATABASE_URL,
    });
    await holder.connect();
    await holder.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await holder.query(`SELECT COUNT(*) FROM "DurableJob"`);

    const writer = new pg.Client({
      connectionString: process.env.TENANT_MAINTENANCE_DATABASE_URL,
    });
    await writer.connect();

    const applyPromise = applyClaimIndexesConcurrently(client, { apply: true });

    // Concurrent representative writes while build runs.
    let writes = 0;
    const writeDeadline = Date.now() + 15_000;
    while (Date.now() < writeDeadline) {
      const id = `claim_live_${writes}`;
      try {
        await writer.query(
          `
          INSERT INTO "DurableJob" (
            id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
            "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
            "authorityVersion", "executionStrategy", state, "nextEligibleAt",
            "createdAt", "updatedAt"
          ) VALUES (
            $1,'claim-idx-shop','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
            '{}',$2,$3,$4,'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',NOW(),NOW(),NOW()
          )
        `,
          [id, "w".repeat(64), `idem-${id}`, `corr-${id}`],
        );
        writes += 1;
        if (writes >= 20) break;
      } catch {
        break;
      }
    }

    await holder.query("COMMIT");
    await holder.end();
    await writer.end();

    const result = await applyPromise;
    expect(result.created.length + result.skipped.length).toBe(
      SYNC_CLAIM_INDEXES.length,
    );
    expect(writes).toBeGreaterThan(0);

    for (const entry of SYNC_CLAIM_INDEXES) {
      const inspected = await inspectClaimIndex(client, entry.name);
      expect(classifyClaimIndex(entry, inspected)).toBe("valid_exact");
    }
  }, 300_000);

  it("subsequent prisma migrate deploy is a no-op for claim indexes", async () => {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: APP_ROOT,
      env: process.env,
      stdio: "pipe",
    });
    for (const entry of SYNC_CLAIM_INDEXES) {
      const inspected = await inspectClaimIndex(client, entry.name);
      expect(classifyClaimIndex(entry, inspected)).toBe("valid_exact");
    }
  }, 120_000);

  it("interrupted/invalid concurrent index state is detected and recoverable", async () => {
    const entry = SYNC_CLAIM_INDEXES[0]!;
    // Simulate invalid index: create a mismatched definition under the name.
    await client.query(`DROP INDEX IF EXISTS "${entry.name}"`);
    await client.query(
      `CREATE INDEX "${entry.name}" ON "DurableJob" ("createdAt")`,
    );
    const inspected = await inspectClaimIndex(client, entry.name);
    expect(classifyClaimIndex(entry, inspected)).toBe("wrong_definition");
    expect(recoveryInstruction(entry.name)).toMatch(/DROP INDEX CONCURRENTLY/);

    // Authorized recovery path (disposable DB).
    await client.query(`DROP INDEX CONCURRENTLY IF EXISTS "${entry.name}"`);
    const afterDrop = await inspectClaimIndex(client, entry.name);
    expect(afterDrop.status).toBe("missing");
    await applyClaimIndexesConcurrently(client, { apply: true });
    const after = await inspectClaimIndex(client, entry.name);
    expect(classifyClaimIndex(entry, after)).toBe("valid_exact");
  }, 180_000);
});
