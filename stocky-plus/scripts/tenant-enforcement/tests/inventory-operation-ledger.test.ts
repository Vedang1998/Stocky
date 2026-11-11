/**
 * Inventory operation ledger and Shopify write executor — disposable
 * PostgreSQL 16 tests against the restricted runtime role with RLS applied.
 * Shopify is replaced by an in-memory double that honours idempotency keys
 * and compare-and-swap the way inventoryAdjustQuantities does.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  InventoryOperationConflictError,
  InventoryOperationNotFoundError,
  InventoryOperationValidationError,
} from "../../../app/services/inventory-writes/errors";
import {
  executeInventoryOperation,
  type ExecuteInventoryOperationOptions,
} from "../../../app/services/inventory-writes/execute.server";
import {
  getInventoryOperationResult,
  listInventoryOperationsForSource,
  recordInventoryOperation,
  recordInventoryReversal,
} from "../../../app/services/inventory-writes/ledger.server";
import type {
  AdjustBatchOutcome,
  AdjustBatchRequest,
  SendAdjustBatch,
} from "../../../app/services/inventory-writes/shopify-adjust.server";
import type {
  InventoryActor,
  InventoryOperationDraft,
  InventoryOperationLineDraft,
} from "../../../app/services/inventory-writes/types";
import { resolveAuthorityAfterVerifiedAuth } from "../../../app/tenant/bootstrap.server";
import {
  createTenantDb,
  type TenantDb,
} from "../../../app/tenant/tenant-db.server";
import { getMigrationClient, getRuntimeClient } from "../connection";
import { INVENTORY_OPERATION_GUARD_FN, MERCHANT_SQL_TABLES } from "../manifest";
import { verifyRoles } from "../roles";
import {
  verifyEnforcement,
  verifyImmutabilityOnly,
  verifyRlsOnly,
} from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  completeInventoryItemData,
  completeLocationData,
  rollbackAndClose,
  runtimeClientForShop,
} from "./pr5-f3-test-helpers";

const SHOP_A = "inventory-ledger-a.myshopify.com";
const SHOP_B = "inventory-ledger-b.myshopify.com";
const LEDGER_TABLES = ["InventoryOperation", "InventoryOperationLine"] as const;

const item = (n: number) => `gid://shopify/InventoryItem/${n}`;
const location = (n: number) => `gid://shopify/Location/${n}`;

const STAFF: InventoryActor = {
  shopifyUserId: "42",
  displayName: "Sam",
  channel: "ADMIN",
};

function line(
  itemNumber: number,
  delta: number,
  changeFromQuantity: number | null = null,
  locationNumber = 11,
): InventoryOperationLineDraft {
  return {
    inventoryItemId: item(itemNumber),
    variantId: null,
    locationId: location(locationNumber),
    delta,
    changeFromQuantity,
  };
}

function draft(
  overrides: Partial<InventoryOperationDraft> = {},
): InventoryOperationDraft {
  return {
    kind: "ADJUSTMENT",
    idempotencyKey: "adjustment:adj1",
    source: { type: "InventoryAdjustment", id: "adj1" },
    reason: "correction",
    quantityName: "available",
    referenceDocumentUri: null,
    actor: STAFF,
    note: null,
    lines: [line(101, 5)],
    ...overrides,
  };
}

type Step = (request: AdjustBatchRequest) => AdjustBatchOutcome | null;

/** Stand-in for Shopify's inventory levels and idempotency-key store. */
class FakeShopify {
  readonly requests: AdjustBatchRequest[] = [];
  private readonly levels = new Map<string, number>();
  private readonly settled = new Map<
    string,
    { fingerprint: string; outcome: AdjustBatchOutcome }
  >();
  private readonly steps: Step[] = [];
  private groups = 0;

  setLevel(itemNumber: number, quantity: number, locationNumber = 11): void {
    this.levels.set(
      `${item(itemNumber)}|${location(locationNumber)}`,
      quantity,
    );
  }

  level(itemNumber: number, locationNumber = 11): number {
    return (
      this.levels.get(`${item(itemNumber)}|${location(locationNumber)}`) ?? 0
    );
  }

  /** Runs once for the next request; returning null falls through to apply. */
  next(step: Step): void {
    this.steps.push(step);
  }

  /** The next request is applied but its response never reaches the app. */
  loseNextResponse(): void {
    this.next((request) => {
      this.apply(request);
      return {
        kind: "retry",
        code: "TRANSPORT_ERROR",
        message: "socket hang up",
      };
    });
  }

  keys(): string[] {
    return this.requests.map((r) => r.idempotencyKey);
  }

  readonly send: SendAdjustBatch = async (request) => {
    this.requests.push(structuredClone(request));
    const step = this.steps.shift();
    return step?.(request) ?? this.apply(request);
  };

  apply(request: AdjustBatchRequest): AdjustBatchOutcome {
    const fingerprint = JSON.stringify([
      request.reason,
      request.quantityName,
      request.referenceDocumentUri,
      request.ledgerDocumentUri,
      request.changes,
    ]);
    const previous = this.settled.get(request.idempotencyKey);
    if (previous) {
      return previous.fingerprint === fingerprint
        ? previous.outcome
        : {
            kind: "rejected",
            errors: [
              {
                code: "IDEMPOTENCY_KEY_PARAMETER_MISMATCH",
                message:
                  "The same idempotency key cannot be used with different operation parameters.",
                changeIndex: null,
              },
            ],
          };
    }

    const stale = request.changes.flatMap((change, index) => {
      const current =
        this.levels.get(`${change.inventoryItemId}|${change.locationId}`) ?? 0;
      return change.changeFromQuantity !== null &&
        change.changeFromQuantity !== current
        ? [
            {
              code: "CHANGE_FROM_QUANTITY_STALE",
              message:
                "The changeFromQuantity argument no longer matches the persisted quantity.",
              changeIndex: index,
            },
          ]
        : [];
    });
    if (stale.length > 0) return { kind: "rejected", errors: stale };

    const changes = request.changes.map((change) => {
      const key = `${change.inventoryItemId}|${change.locationId}`;
      const after = (this.levels.get(key) ?? 0) + change.delta;
      this.levels.set(key, after);
      return {
        inventoryItemId: change.inventoryItemId,
        locationId: change.locationId,
        delta: change.delta,
        quantityAfterChange: after,
      };
    });
    this.groups += 1;
    const outcome: AdjustBatchOutcome = {
      kind: "applied",
      adjustmentGroupId: `gid://shopify/InventoryAdjustmentGroup/${this.groups}`,
      changes,
    };
    this.settled.set(request.idempotencyKey, { fingerprint, outcome });
    return outcome;
  }
}

describe("inventory operation ledger and Shopify write executor", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;
  let dbA: TenantDb;
  let dbB: TenantDb;
  let shopify: FakeShopify;

  const enabled = (
    extra: Partial<ExecuteInventoryOperationOptions> = {},
  ): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => true,
    ...extra,
  });

  async function record(overrides: Partial<InventoryOperationDraft> = {}) {
    return (await recordInventoryOperation(dbA, draft(overrides))).operation;
  }

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const [shopA, shopB] = await Promise.all([
      prisma.shop.create({
        data: { myshopifyDomain: SHOP_A, processingEnabled: true },
      }),
      prisma.shop.create({
        data: { myshopifyDomain: SHOP_B, processingEnabled: true },
      }),
    ]);
    shopAId = shopA.id;
    shopBId = shopB.id;

    await prisma.shopifyLocationFact.createMany({
      data: [
        completeLocationData({ id: "11", shopId: shopAId }),
        {
          ...completeLocationData({ id: "12", shopId: shopAId }),
          isActive: false,
        },
        completeLocationData({ id: "21", shopId: shopBId }),
      ],
    });
    await prisma.shopifyInventoryItemFact.createMany({
      data: [
        ...[101, 102, 103, 104, 105].map((n) => ({
          ...completeInventoryItemData({ id: String(n), shopId: shopAId }),
          shopifyVariantGid: null,
        })),
        {
          ...completeInventoryItemData({ id: "201", shopId: shopBId }),
          shopifyVariantGid: null,
        },
      ],
    });

    const authority = async (domain: string) =>
      (
        await resolveAuthorityAfterVerifiedAuth({
          verifiedDomain: domain,
          source: "verified_admin_request",
          correlationId: "inventory-ledger-test",
          createIfMissing: false,
        })
      ).tenant;
    dbA = createTenantDb(await authority(SHOP_A));
    dbB = createTenantDb(await authority(SHOP_B));
  }, 180_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "InventoryOperationLine", "InventoryOperation" CASCADE`,
    );
    shopify = new FakeShopify();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("database enforcement", () => {
    it("registers both ledger tables for tenant enforcement and passes verification", async () => {
      for (const table of LEDGER_TABLES) {
        expect(MERCHANT_SQL_TABLES).toContain(table);
      }
      const client = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        expect((await verifyRlsOnly(client)).ok).toBe(true);
        expect((await verifyImmutabilityOnly(client)).ok).toBe(true);
        expect((await verifyEnforcement(client)).ok).toBe(true);
        expect((await verifyRoles(client)).ok).toBe(true);
      } finally {
        await client.end();
      }
    });

    it("forces RLS and grants the runtime role DML only", async () => {
      const client = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      const runtimeRole = process.env.STOCKY_RUNTIME_ROLE || "stocky_runtime";
      try {
        for (const table of LEDGER_TABLES) {
          const rls = await client.query<{
            relrowsecurity: boolean;
            relforcerowsecurity: boolean;
            owner: string;
          }>(
            `SELECT c.relrowsecurity, c.relforcerowsecurity, r.rolname AS owner
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_roles r ON r.oid = c.relowner
             WHERE n.nspname = 'public' AND c.relname = $1`,
            [table],
          );
          expect(rls.rows[0]).toMatchObject({
            relrowsecurity: true,
            relforcerowsecurity: true,
          });
          expect(rls.rows[0].owner).not.toBe(runtimeRole);

          for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
            const granted = await client.query<{ has: boolean }>(
              `SELECT has_table_privilege($1, $2, $3) AS has`,
              [runtimeRole, `public."${table}"`, privilege],
            );
            expect(granted.rows[0].has, `${table} ${privilege}`).toBe(true);
          }
          for (const privilege of ["TRUNCATE", "REFERENCES", "TRIGGER"]) {
            const granted = await client.query<{ has: boolean }>(
              `SELECT has_table_privilege($1, $2, $3) AS has`,
              [runtimeRole, `public."${table}"`, privilege],
            );
            expect(granted.rows[0].has, `${table} ${privilege}`).toBe(false);
          }
          const publicRead = await client.query<{ has: boolean }>(
            `SELECT has_table_privilege('public', $1, 'SELECT') AS has`,
            [`public."${table}"`],
          );
          expect(publicRead.rows[0].has).toBe(false);
        }

        const guard = await client.query<{
          public_exec: boolean;
          runtime_exec: boolean;
        }>(
          `SELECT
             has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec,
             has_function_privilege($2, p.oid, 'EXECUTE') AS runtime_exec
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = $1`,
          [INVENTORY_OPERATION_GUARD_FN, runtimeRole],
        );
        expect(guard.rows).toEqual([
          { public_exec: false, runtime_exec: false },
        ]);
      } finally {
        await client.end();
      }
    });

    it("hides one shop's operations from another shop and from a session with no tenant", async () => {
      const operation = await record();

      const asB = await runtimeClientForShop(shopBId);
      try {
        const seen = await asB.query(
          `SELECT
             (SELECT COUNT(*)::int FROM "InventoryOperation") AS operations,
             (SELECT COUNT(*)::int FROM "InventoryOperationLine") AS lines`,
        );
        expect(seen.rows[0]).toEqual({ operations: 0, lines: 0 });

        const updated = await asB.query(
          `UPDATE "InventoryOperationLine" SET "errorMessage" = 'tampered' WHERE "operationId" = $1`,
          [operation.id],
        );
        expect(updated.rowCount).toBe(0);
        const deleted = await asB.query(
          `DELETE FROM "InventoryOperationLine" WHERE "operationId" = $1`,
          [operation.id],
        );
        expect(deleted.rowCount).toBe(0);

        await expect(
          asB.query(
            `INSERT INTO "InventoryOperationLine"
               (id, "shopId", "operationId", "lineNumber", "inventoryItemGid", "locationGid", delta, "updatedAt")
             VALUES ('foreign-line', $1, $2, 99, $3, $4, 1, NOW())`,
            [shopAId, operation.id, item(101), location(11)],
          ),
        ).rejects.toThrow(/row-level security/);
      } finally {
        await rollbackAndClose(asB);
      }

      const asA = await runtimeClientForShop(shopAId);
      try {
        const seen = await asA.query(
          `SELECT COUNT(*)::int AS operations FROM "InventoryOperation"`,
        );
        expect(seen.rows[0].operations).toBe(1);
      } finally {
        await rollbackAndClose(asA);
      }

      const noTenant = await getRuntimeClient();
      try {
        const seen = await noTenant.query(
          `SELECT COUNT(*)::int AS operations FROM "InventoryOperation"`,
        );
        expect(seen.rows[0].operations).toBe(0);
      } finally {
        await noTenant.end();
      }
    });

    it("refuses a line that points at another shop's operation", async () => {
      const operation = await record();
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "InventoryOperationLine"
             (id, "shopId", "operationId", "lineNumber", "inventoryItemGid", "locationGid", delta, "updatedAt")
           VALUES ('cross-shop-line', $1, $2, 1, $3, $4, 1, NOW())`,
          shopBId,
          operation.id,
          item(201),
          location(21),
        ),
      ).rejects.toThrow(/InventoryOperationLine_shopId_operationId_fkey/);
    });

    it("freezes the recorded request and terminal outcomes, even for the table owner", async () => {
      const operation = await record({ lines: [line(101, 5), line(102, -1)] });

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "InventoryOperationLine" SET delta = 500 WHERE "operationId" = $1`,
          operation.id,
        ),
      ).rejects.toThrow(/inventory_operation_line_request_immutable/);
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "InventoryOperationLine" SET "locationGid" = $2 WHERE "operationId" = $1`,
          operation.id,
          location(12),
        ),
      ).rejects.toThrow(/inventory_operation_line_request_immutable/);
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "InventoryOperation" SET "payloadDigest" = repeat('0', 64) WHERE id = $1`,
          operation.id,
        ),
      ).rejects.toThrow(/inventory_operation_request_immutable/);
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "InventoryOperation" SET "actorShopifyUserId" = '1' WHERE id = $1`,
          operation.id,
        ),
      ).rejects.toThrow(/inventory_operation_request_immutable/);
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "InventoryOperationLine" SET status = 'APPLIED' WHERE "operationId" = $1`,
          operation.id,
        ),
      ).rejects.toThrow(/InventoryOperationLine_applied_at_check/);

      await executeInventoryOperation(dbA, null, operation.id, enabled());

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "InventoryOperationLine"
           SET status = 'PENDING', "appliedAt" = NULL, "batchKey" = NULL
           WHERE "operationId" = $1`,
          operation.id,
        ),
      ).rejects.toThrow(/inventory_operation_line_terminal_status_immutable/);
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "InventoryOperation" SET status = 'PENDING', "completedAt" = NULL WHERE id = $1`,
          operation.id,
        ),
      ).rejects.toThrow(/inventory_operation_terminal_status_immutable/);
    });
  });

  describe("recording", () => {
    it("writes the operation and its lines before anything is sent", async () => {
      const { operation, created } = await recordInventoryOperation(
        dbA,
        draft({
          note: "  shelf recount  ",
          lines: [line(101, 5, 10), line(102, -2)],
        }),
      );

      expect(created).toBe(true);
      expect(operation).toMatchObject({
        idempotencyKey: "adjustment:adj1",
        kind: "ADJUSTMENT",
        writeCapability: "adjustmentWrites",
        sourceType: "InventoryAdjustment",
        sourceId: "adj1",
        status: "PENDING",
        lineCount: 2,
        appliedLineCount: 0,
        completedAt: null,
      });
      const stored = await prisma.inventoryOperation.findUniqueOrThrow({
        where: { id: operation.id },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });
      expect(stored).toMatchObject({
        shopId: shopAId,
        actorShopifyUserId: "42",
        actorDisplayName: "Sam",
        actorChannel: "ADMIN",
        note: "shelf recount",
        batchSequence: 0,
        attemptCount: 0,
      });
      expect(
        stored.lines.map((l) => [
          l.shopId,
          l.lineNumber,
          l.inventoryItemGid,
          l.locationGid,
          l.delta,
          l.changeFromQuantity,
          l.status,
          l.batchKey,
        ]),
      ).toEqual([
        [shopAId, 1, item(101), location(11), 5, 10, "PENDING", null],
        [shopAId, 2, item(102), location(11), -2, null, "PENDING", null],
      ]);
      expect(shopify.requests).toHaveLength(0);
    });

    it("returns the existing operation when the same change is submitted again", async () => {
      const first = await recordInventoryOperation(dbA, draft());
      const again = await recordInventoryOperation(
        dbA,
        draft({
          actor: { shopifyUserId: "77", displayName: null, channel: "POS" },
          note: "double tap",
        }),
      );

      expect(again.created).toBe(false);
      expect(again.operation.id).toBe(first.operation.id);
      expect(await prisma.inventoryOperation.count()).toBe(1);
      expect(await prisma.inventoryOperationLine.count()).toBe(1);
      const stored = await prisma.inventoryOperation.findUniqueOrThrow({
        where: { id: first.operation.id },
      });
      expect(stored.actorShopifyUserId).toBe("42");
    });

    it("rejects a reused key that carries a different change", async () => {
      const { operation } = await recordInventoryOperation(dbA, draft());

      const reused = recordInventoryOperation(
        dbA,
        draft({ lines: [line(101, 6)] }),
      );
      await expect(reused).rejects.toBeInstanceOf(
        InventoryOperationConflictError,
      );
      await expect(reused).rejects.toMatchObject({
        code: "INVENTORY_OPERATION_KEY_REUSED",
        existingOperationId: operation.id,
      });
      expect(await prisma.inventoryOperationLine.count()).toBe(1);
    });

    it("records one operation when the same submission races itself", async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          recordInventoryOperation(
            dbA,
            draft({ lines: [line(101, 5), line(102, 1), line(103, -3)] }),
          ),
        ),
      );

      expect(new Set(results.map((r) => r.operation.id)).size).toBe(1);
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(await prisma.inventoryOperation.count()).toBe(1);
      expect(await prisma.inventoryOperationLine.count()).toBe(3);
    });

    it("scopes idempotency keys to the shop", async () => {
      const inA = await recordInventoryOperation(dbA, draft());
      const inB = await recordInventoryOperation(
        dbB,
        draft({ lines: [line(201, 4, null, 21)] }),
      );

      expect(inB.created).toBe(true);
      expect(inB.operation.id).not.toBe(inA.operation.id);
      const owners = await prisma.inventoryOperation.findMany({
        select: { shopId: true },
        orderBy: { createdAt: "asc" },
      });
      expect(owners.map((o) => o.shopId).sort()).toEqual(
        [shopAId, shopBId].sort(),
      );
    });

    it("rejects targets that are not live catalog facts of this shop", async () => {
      const attempt = recordInventoryOperation(
        dbA,
        draft({
          lines: [
            line(101, 1, null, 12),
            line(102, 1, null, 21),
            line(201, 1),
            line(999, 1),
          ],
        }),
      );
      await expect(attempt).rejects.toBeInstanceOf(
        InventoryOperationValidationError,
      );
      await expect(attempt).rejects.toMatchObject({
        issues: [
          `Location ${location(12)} is deactivated`,
          `Location ${location(21)} is not a synced location of this shop`,
          `Inventory items not synced for this shop: ${item(201)}, ${item(999)}. Run a catalog sync and try again.`,
        ],
      });
      expect(await prisma.inventoryOperation.count()).toBe(0);
    });

    it("lists a document's operations newest first without leaking across shops", async () => {
      const first = await record({
        idempotencyKey: "stocktake:st1:apply:1",
        source: { type: "Stocktake", id: "st1" },
        kind: "STOCKTAKE",
      });
      const second = await record({
        idempotencyKey: "stocktake:st1:apply:2",
        source: { type: "Stocktake", id: "st1" },
        kind: "STOCKTAKE",
        lines: [line(102, 1)],
      });
      await record();

      const listed = await listInventoryOperationsForSource(dbA, {
        type: "Stocktake",
        id: "st1",
      });
      expect(listed.map((o) => o.id)).toEqual([second.id, first.id]);
      expect(
        await listInventoryOperationsForSource(dbB, {
          type: "Stocktake",
          id: "st1",
        }),
      ).toEqual([]);
    });
  });

  describe("executing", () => {
    it("sends nothing while the kill switch is off and applies once it is on", async () => {
      const operation = await record();
      const previous = process.env.FEATURE_ADJUSTMENT_WRITES;
      process.env.FEATURE_ADJUSTMENT_WRITES = "false";
      try {
        const blocked = await executeInventoryOperation(
          dbA,
          null,
          operation.id,
          {
            sendBatch: shopify.send,
          },
        );
        expect(blocked).toMatchObject({
          status: "BLOCKED",
          appliedLineCount: 0,
          lastErrorCode: "WRITE_CAPABILITY_DISABLED",
          completedAt: null,
        });
        expect(blocked.lines.map((l) => l.status)).toEqual(["PENDING"]);
        expect(shopify.requests).toHaveLength(0);
      } finally {
        if (previous === undefined)
          delete process.env.FEATURE_ADJUSTMENT_WRITES;
        else process.env.FEATURE_ADJUSTMENT_WRITES = previous;
      }

      const applied = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );
      expect(applied).toMatchObject({
        status: "APPLIED",
        appliedLineCount: 1,
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      expect(shopify.level(101)).toBe(5);
    });

    it("gates each operation on its own capability", async () => {
      const stocktake = await record({
        kind: "STOCKTAKE",
        idempotencyKey: "stocktake:st1:apply:1",
        source: { type: "Stocktake", id: "st1" },
        reason: "cycle_count_available",
      });
      const seen: string[] = [];
      const result = await executeInventoryOperation(dbA, null, stocktake.id, {
        sendBatch: shopify.send,
        isCapabilityEnabled: (capability) => {
          seen.push(capability);
          return capability === "adjustmentWrites";
        },
      });

      expect(result.status).toBe("BLOCKED");
      expect(new Set(seen)).toEqual(new Set(["stocktakeInventoryWrites"]));
      expect(shopify.requests).toHaveLength(0);
    });

    it("refuses to run without a Shopify client and leaves the operation untouched", async () => {
      const operation = await record();
      await expect(
        executeInventoryOperation(dbA, null, operation.id, {
          isCapabilityEnabled: () => true,
        }),
      ).rejects.toThrow(/requires an Admin API client/);
      expect(
        (await getInventoryOperationResult(dbA, operation.id)).status,
      ).toBe("PENDING");
    });

    it("records Shopify's confirmation on every line and never sends again", async () => {
      shopify.setLevel(101, 10);
      shopify.setLevel(102, 4);
      const operation = await record({
        lines: [line(101, 5, 10), line(102, -4, 4)],
        referenceDocumentUri: "gid://propo/InventoryAdjustment/adj1",
      });

      const result = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );

      expect(result).toMatchObject({
        operationId: operation.id,
        status: "APPLIED",
        lineCount: 2,
        appliedLineCount: 2,
        failedLineCount: 0,
        conflictLineCount: 0,
      });
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(
        result.lines.map((l) => [l.status, l.quantityAfterChange]),
      ).toEqual([
        ["APPLIED", 15],
        ["APPLIED", 0],
      ]);
      expect(shopify.requests).toEqual([
        {
          idempotencyKey: `propo-inv:${operation.id}:1`,
          reason: "correction",
          quantityName: "available",
          referenceDocumentUri: "gid://propo/InventoryAdjustment/adj1",
          ledgerDocumentUri: null,
          changes: [
            {
              inventoryItemId: item(101),
              locationId: location(11),
              delta: 5,
              changeFromQuantity: 10,
            },
            {
              inventoryItemId: item(102),
              locationId: location(11),
              delta: -4,
              changeFromQuantity: 4,
            },
          ],
        },
      ]);
      const stored = await prisma.inventoryOperationLine.findMany({
        where: { operationId: operation.id },
      });
      expect(new Set(stored.map((l) => l.shopifyAdjustmentGroupGid))).toEqual(
        new Set(["gid://shopify/InventoryAdjustmentGroup/1"]),
      );
      expect(stored.every((l) => l.appliedAt !== null)).toBe(true);

      const again = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );
      expect(again.status).toBe("APPLIED");
      expect(shopify.requests).toHaveLength(1);
      expect(shopify.level(101)).toBe(15);
    });

    it("gives non-available quantity names the ledger document Shopify requires", async () => {
      const operation = await record({
        quantityName: "damaged",
        reason: "damaged",
      });
      await executeInventoryOperation(dbA, null, operation.id, enabled());
      expect(shopify.requests[0].ledgerDocumentUri).toBe(
        `gid://propo/InventoryOperation/${operation.id}`,
      );
    });

    it("splits a large operation into batches with one key each", async () => {
      const operation = await record({
        lines: [101, 102, 103, 104, 105].map((n) => line(n, 1)),
      });

      const result = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled({ batchSize: 2 }),
      );

      expect(result.status).toBe("APPLIED");
      expect(shopify.keys()).toEqual(
        [1, 2, 3].map((n) => `propo-inv:${operation.id}:${n}`),
      );
      expect(shopify.requests.map((r) => r.changes.length)).toEqual([2, 2, 1]);
    });

    it("resends the identical request under the same key after a lost response", async () => {
      shopify.setLevel(101, 10);
      const operation = await record({ lines: [line(101, 5), line(102, 2)] });
      shopify.loseNextResponse();

      const first = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );
      expect(first).toMatchObject({
        status: "RETRY_PENDING",
        appliedLineCount: 0,
        lastErrorCode: "TRANSPORT_ERROR",
        completedAt: null,
      });
      expect(first.lines.map((l) => l.status)).toEqual([
        "IN_FLIGHT",
        "IN_FLIGHT",
      ]);
      expect(shopify.level(101)).toBe(15);

      const second = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );
      expect(second.status).toBe("APPLIED");
      expect(second.lines.map((l) => l.quantityAfterChange)).toEqual([15, 2]);
      expect(shopify.requests).toHaveLength(2);
      expect(shopify.requests[1]).toEqual(shopify.requests[0]);
      expect(shopify.level(101)).toBe(15);
      expect(shopify.level(102)).toBe(2);
    });

    it("resumes an executor that died mid-send without applying twice", async () => {
      const operation = await record();
      shopify.next((request) => {
        shopify.apply(request);
        throw new Error("process killed");
      });

      await expect(
        executeInventoryOperation(dbA, null, operation.id, enabled()),
      ).rejects.toThrow("process killed");
      expect(shopify.level(101)).toBe(5);

      const whileLeased = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );
      expect(whileLeased.status).toBe("APPLYING");
      expect(shopify.requests).toHaveLength(1);

      const afterExpiry = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled({ now: () => new Date(Date.now() + 5 * 60_000) }),
      );
      expect(afterExpiry.status).toBe("APPLIED");
      expect(shopify.keys()).toEqual([
        `propo-inv:${operation.id}:1`,
        `propo-inv:${operation.id}:1`,
      ]);
      expect(shopify.level(101)).toBe(5);
    });

    it("lets only one of two simultaneous executors send", async () => {
      const operation = await record({
        lines: [101, 102, 103].map((n) => line(n, 2)),
      });

      const results = await Promise.all([
        executeInventoryOperation(dbA, null, operation.id, enabled()),
        executeInventoryOperation(dbA, null, operation.id, enabled()),
        executeInventoryOperation(dbA, null, operation.id, enabled()),
      ]);

      expect(shopify.requests).toHaveLength(1);
      expect([101, 102, 103].map((n) => shopify.level(n))).toEqual([2, 2, 2]);
      expect(results.some((r) => r.status === "APPLIED")).toBe(true);
      expect(
        (await getInventoryOperationResult(dbA, operation.id)).status,
      ).toBe("APPLIED");
      const stored = await prisma.inventoryOperation.findUniqueOrThrow({
        where: { id: operation.id },
      });
      expect(stored).toMatchObject({
        attemptCount: 1,
        leaseOwner: null,
        leaseExpiresAt: null,
      });
    });

    it("marks a stale line as a conflict and still applies the rest under a new key", async () => {
      shopify.setLevel(101, 10);
      shopify.setLevel(102, 7);
      shopify.setLevel(103, 3);
      const operation = await record({
        lines: [line(101, 1, 10), line(102, -2, 9), line(103, 4, 3)],
      });

      const result = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );

      expect(result).toMatchObject({
        status: "PARTIALLY_APPLIED",
        appliedLineCount: 2,
        failedLineCount: 0,
        conflictLineCount: 1,
        lastErrorCode: "CHANGE_FROM_QUANTITY_STALE",
      });
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(
        result.lines.map((l) => [l.status, l.errorCode, l.quantityAfterChange]),
      ).toEqual([
        ["APPLIED", null, 11],
        ["CONFLICT", "CHANGE_FROM_QUANTITY_STALE", null],
        ["APPLIED", null, 7],
      ]);
      expect(shopify.keys()).toEqual([
        `propo-inv:${operation.id}:1`,
        `propo-inv:${operation.id}:2`,
      ]);
      expect(shopify.requests[1].changes.map((c) => c.inventoryItemId)).toEqual(
        [item(101), item(103)],
      );
      expect([101, 102, 103].map((n) => shopify.level(n))).toEqual([11, 7, 7]);
    });

    it("fails every line of a batch Shopify rejects outright", async () => {
      const operation = await record({ lines: [line(101, 1), line(102, 1)] });
      shopify.next(() => ({
        kind: "rejected",
        errors: [
          {
            code: "ACCESS_DENIED",
            message: "Access denied for inventoryAdjustQuantities field.",
            changeIndex: null,
          },
        ],
      }));

      const result = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );

      expect(result).toMatchObject({
        status: "FAILED",
        appliedLineCount: 0,
        failedLineCount: 2,
        lastErrorCode: "ACCESS_DENIED",
        lastErrorMessage: "Access denied for inventoryAdjustQuantities field.",
      });
      expect(result.lines.map((l) => [l.status, l.errorCode])).toEqual([
        ["FAILED", "ACCESS_DENIED"],
        ["FAILED", "ACCESS_DENIED"],
      ]);
      expect(shopify.requests).toHaveLength(1);
      expect(shopify.level(101)).toBe(0);
    });

    it("fails only the line Shopify names and applies the others", async () => {
      const operation = await record({ lines: [line(101, 1), line(102, 1)] });
      shopify.next(() => ({
        kind: "rejected",
        errors: [
          {
            code: "ITEM_NOT_STOCKED_AT_LOCATION",
            message: "The item is not stocked at this location.",
            changeIndex: 1,
          },
        ],
      }));

      const result = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );

      expect(result).toMatchObject({
        status: "PARTIALLY_APPLIED",
        appliedLineCount: 1,
        failedLineCount: 1,
        conflictLineCount: 0,
      });
      expect(result.lines.map((l) => [l.status, l.errorCode])).toEqual([
        ["APPLIED", null],
        ["FAILED", "ITEM_NOT_STOCKED_AT_LOCATION"],
      ]);
      expect(shopify.level(101)).toBe(1);
      expect(shopify.level(102)).toBe(0);
    });

    it("re-keys a batch when Shopify says the previous attempt with that key failed", async () => {
      const operation = await record();
      shopify.next(() => ({
        kind: "rejected",
        errors: [
          {
            code: "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
            message:
              "A previous request with this idempotency key failed. Retry with a new idempotency key.",
            changeIndex: null,
          },
        ],
      }));

      const result = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );

      expect(result.status).toBe("APPLIED");
      expect(shopify.keys()).toEqual([
        `propo-inv:${operation.id}:1`,
        `propo-inv:${operation.id}:2`,
      ]);
      expect(shopify.level(101)).toBe(5);
    });

    it("fails rather than resends when Shopify reports the key carried different parameters", async () => {
      const operation = await record();
      shopify.next(() => ({
        kind: "rejected",
        errors: [
          {
            code: "IDEMPOTENCY_KEY_PARAMETER_MISMATCH",
            message:
              "The same idempotency key cannot be used with different operation parameters.",
            changeIndex: null,
          },
        ],
      }));

      const result = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled(),
      );

      expect(result).toMatchObject({
        status: "FAILED",
        failedLineCount: 1,
        lastErrorCode: "IDEMPOTENCY_KEY_PARAMETER_MISMATCH",
      });
      expect(shopify.requests).toHaveLength(1);
      expect(shopify.level(101)).toBe(0);
    });

    it("stops between batches when the kill switch flips and resumes later", async () => {
      const operation = await record({
        lines: [101, 102, 103].map((n) => line(n, 1)),
      });
      let checks = 0;

      const stopped = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled({ batchSize: 1, isCapabilityEnabled: () => ++checks <= 2 }),
      );

      expect(stopped).toMatchObject({
        status: "RETRY_PENDING",
        appliedLineCount: 1,
        lastErrorCode: "WRITE_CAPABILITY_DISABLED",
        completedAt: null,
      });
      expect(stopped.lines.map((l) => l.status)).toEqual([
        "APPLIED",
        "PENDING",
        "PENDING",
      ]);
      expect(shopify.requests).toHaveLength(1);

      const stillOff = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        {
          sendBatch: shopify.send,
          isCapabilityEnabled: () => false,
        },
      );
      expect(stillOff.status).toBe("RETRY_PENDING");
      expect(shopify.requests).toHaveLength(1);

      const resumed = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled({ batchSize: 1 }),
      );
      expect(resumed).toMatchObject({
        status: "APPLIED",
        appliedLineCount: 3,
        lastErrorCode: null,
      });
      expect(shopify.requests).toHaveLength(3);
    });

    it("stops at its time budget and finishes on the next call", async () => {
      const operation = await record({
        lines: [101, 102, 103].map((n) => line(n, 1)),
      });
      const start = Date.now();
      let ticks = 0;

      const partial = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled({
          batchSize: 1,
          deadlineMs: 1000,
          now: () => new Date(start + ticks++ * 150),
        }),
      );

      expect(partial.status).toBe("RETRY_PENDING");
      expect(partial.appliedLineCount).toBeGreaterThan(0);
      expect(partial.appliedLineCount).toBeLessThan(3);
      const sentSoFar = shopify.requests.length;
      expect(sentSoFar).toBe(partial.appliedLineCount);

      const finished = await executeInventoryOperation(
        dbA,
        null,
        operation.id,
        enabled({ batchSize: 1 }),
      );
      expect(finished.status).toBe("APPLIED");
      expect(shopify.requests).toHaveLength(3);
      expect([101, 102, 103].map((n) => shopify.level(n))).toEqual([1, 1, 1]);
    });

    it("cannot be read or executed through another shop's tenant", async () => {
      const operation = await record();

      await expect(
        getInventoryOperationResult(dbB, operation.id),
      ).rejects.toBeInstanceOf(InventoryOperationNotFoundError);
      await expect(
        executeInventoryOperation(dbB, null, operation.id, enabled()),
      ).rejects.toBeInstanceOf(InventoryOperationNotFoundError);
      await expect(
        recordInventoryReversal(dbB, {
          operationId: operation.id,
          actor: STAFF,
          note: null,
        }),
      ).rejects.toBeInstanceOf(InventoryOperationNotFoundError);
      expect(shopify.requests).toHaveLength(0);
      expect(
        (await getInventoryOperationResult(dbA, operation.id)).status,
      ).toBe("PENDING");
    });
  });

  describe("reversal", () => {
    it("records the opposite of the applied lines only, without compare-and-swap", async () => {
      shopify.setLevel(101, 10);
      shopify.setLevel(102, 7);
      const original = await record({
        kind: "STOCKTAKE",
        idempotencyKey: "stocktake:st1:apply:1",
        source: { type: "Stocktake", id: "st1" },
        reason: "cycle_count_available",
        referenceDocumentUri: "gid://propo/Stocktake/st1",
        lines: [line(101, 3, 10), line(102, -2, 9)],
      });
      await executeInventoryOperation(dbA, null, original.id, enabled());
      expect(shopify.level(101)).toBe(13);

      const { operation: reversal, created } = await recordInventoryReversal(
        dbA,
        {
          operationId: original.id,
          actor: { shopifyUserId: "77", displayName: null, channel: "ADMIN" },
          note: "counted the wrong shelf",
        },
      );

      expect(created).toBe(true);
      expect(reversal).toMatchObject({
        kind: "REVERSAL",
        writeCapability: "stocktakeInventoryWrites",
        idempotencyKey: `reversal:${original.id}`,
        sourceType: "Stocktake",
        sourceId: "st1",
        reason: "correction",
        status: "PENDING",
        lineCount: 1,
      });
      const stored = await prisma.inventoryOperation.findUniqueOrThrow({
        where: { id: reversal.id },
        include: { lines: true },
      });
      expect(stored.reversesOperationId).toBe(original.id);
      expect(stored.actorShopifyUserId).toBe("77");
      expect(
        stored.lines.map((l) => [
          l.inventoryItemGid,
          l.delta,
          l.changeFromQuantity,
        ]),
      ).toEqual([[item(101), -3, null]]);

      shopify.setLevel(101, 12);
      const result = await executeInventoryOperation(
        dbA,
        null,
        reversal.id,
        enabled(),
      );
      expect(result.status).toBe("APPLIED");
      expect(shopify.level(101)).toBe(9);
      expect(shopify.level(102)).toBe(7);
    });

    it("reverses an operation at most once", async () => {
      const original = await record();
      await executeInventoryOperation(dbA, null, original.id, enabled());

      const first = await recordInventoryReversal(dbA, {
        operationId: original.id,
        actor: STAFF,
        note: null,
      });
      const second = await recordInventoryReversal(dbA, {
        operationId: original.id,
        actor: STAFF,
        note: "again",
      });

      expect(second.created).toBe(false);
      expect(second.operation.id).toBe(first.operation.id);
      expect(
        await prisma.inventoryOperation.count({ where: { kind: "REVERSAL" } }),
      ).toBe(1);
    });

    it("is gated by the reversed operation's kill switch", async () => {
      const original = await record();
      await executeInventoryOperation(dbA, null, original.id, enabled());
      const { operation: reversal } = await recordInventoryReversal(dbA, {
        operationId: original.id,
        actor: STAFF,
        note: null,
      });

      const blocked = await executeInventoryOperation(dbA, null, reversal.id, {
        sendBatch: shopify.send,
        isCapabilityEnabled: (capability) => capability !== "adjustmentWrites",
      });

      expect(blocked.status).toBe("BLOCKED");
      expect(shopify.level(101)).toBe(5);
    });

    it("refuses to reverse unapplied operations and reversals", async () => {
      const pending = await record();
      await expect(
        recordInventoryReversal(dbA, {
          operationId: pending.id,
          actor: STAFF,
          note: null,
        }),
      ).rejects.toThrow("Only applied inventory changes can be reversed.");

      await executeInventoryOperation(dbA, null, pending.id, enabled());
      const { operation: reversal } = await recordInventoryReversal(dbA, {
        operationId: pending.id,
        actor: STAFF,
        note: null,
      });
      await executeInventoryOperation(dbA, null, reversal.id, enabled());
      await expect(
        recordInventoryReversal(dbA, {
          operationId: reversal.id,
          actor: STAFF,
          note: null,
        }),
      ).rejects.toThrow(
        "A reversal cannot be reversed. Record a new adjustment instead.",
      );

      const failed = await record({
        idempotencyKey: "adjustment:adj2",
        source: { type: "InventoryAdjustment", id: "adj2" },
      });
      shopify.next(() => ({
        kind: "rejected",
        errors: [
          {
            code: "INVALID_REASON",
            message: "The specified reason is invalid.",
            changeIndex: null,
          },
        ],
      }));
      await executeInventoryOperation(dbA, null, failed.id, enabled());
      await expect(
        recordInventoryReversal(dbA, {
          operationId: failed.id,
          actor: STAFF,
          note: null,
        }),
      ).rejects.toBeInstanceOf(InventoryOperationValidationError);
    });
  });
});
