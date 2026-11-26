/**
 * Issue #73: a first install must survive afterAuth's ShopSettings bootstrap
 * overlapping another request that creates the same row.
 *
 * Observed on the dev test store (2026-11-10, enforced schema): two
 * ShopSettings creations raced, Postgres rejected one with
 * `ShopSettings_shop_key` (23505, not a retryable serialization failure),
 * afterAuth threw, the Shopify library turned that into an empty 500 with no
 * log line, and the afterAuth catalog sync was never enqueued.
 *
 * Runs on the enforced schema (indexes, roles, RLS) because the conflict
 * surfaces differently on the bare test schema. Each round uses its own shop
 * domain, and merchant rows are only read through the tenant-scoped client.
 *
 * Ported from #82 (afterAuth part only).
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { inspect } from "node:util";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../../authority.server";
import { runAfterAuthTenantBootstrap } from "../../after-auth.server";
import { ensureShopSettings } from "../../shop-settings.server";
import { createTenantDb, type TenantDb } from "../../tenant-db.server";
import { persistEntitlementSnapshot } from "../../../billing/entitlements.server";
import { resetAndEnforce } from "./helpers";

const ROUNDS = 10;
const CONCURRENCY = 6;

/**
 * Counts `shopSettings.findUnique` calls, which `ensureShopSettings` makes
 * only after losing the insert to another creator (its P2002 branch).
 */
function countingReadBacks(db: TenantDb, counter: { readBacks: number }) {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== "shopSettings") return value;
      return new Proxy(value, {
        get(delegate, method, delegateReceiver) {
          const fn = Reflect.get(delegate, method, delegateReceiver);
          if (method !== "findUnique") return fn;
          return (...args: unknown[]) => {
            counter.readBacks += 1;
            return fn.apply(delegate, args);
          };
        },
      });
    },
  });
}

/** Everything written to console.error, console.warn and console.log, with objects printed in full. */
function spyOnLogs() {
  const spies = (["error", "warn", "log"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {}),
  );
  return {
    errorLines: () =>
      spies[0].mock.calls.map((call) => call.map(printArg).join(" ")),
    allText: () =>
      spies
        .flatMap((spy) => spy.mock.calls)
        .map((call) => call.map(printArg).join(" "))
        .join("\n"),
  };
}

function printArg(arg: unknown): string {
  return typeof arg === "string" ? arg : inspect(arg, { depth: null });
}

/** Waits until some backend is blocked on a lock, such as an INSERT behind an uncommitted duplicate key. */
async function waitForBlockedBackend(prisma: PrismaClient): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted`;
    if (n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("no backend blocked on a lock within 10 seconds");
}

describe("first install race (issue #73)", () => {
  let migrationPrisma: PrismaClient;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
  }, 180_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("afterAuth bootstrap and other ShopSettings creators never reject when they overlap", async () => {
    const rejections: unknown[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      const domain = `first-install-race-${round}.myshopify.com`;
      // Shop exists (afterAuth's first step is done); ShopSettings does not.
      const shop = await migrationPrisma.shop.create({
        data: { myshopifyDomain: domain },
      });
      const tenant = issueTenantAuthority({
        shopId: shop.id,
        myshopifyDomain: domain,
        source: "verified_admin_request",
      });
      const db = createTenantDb(tenant);

      const results = await Promise.allSettled([
        runAfterAuthTenantBootstrap({ shop: domain } as never),
        ...Array.from({ length: CONCURRENCY }, () =>
          ensureShopSettings(createTenantDb(tenant)),
        ),
        // The Billing and Home loaders store an entitlement snapshot.
        persistEntitlementSnapshot(createTenantDb(tenant), {
          subscriptionActive: false,
          subscriptionPlan: null,
        }),
      ]);
      for (const r of results) {
        if (r.status === "rejected") rejections.push(r.reason);
      }

      const rows = await db.shopSettings.findMany({ where: {} });
      expect(rows).toHaveLength(1);
      expect(rows[0].shopId).toBe(shop.id);
    }

    expect(rejections).toEqual([]);
  });

  it("a creator that loses the insert to a concurrent one reads the winner's row back", async () => {
    const domain = "first-install-race-loser.myshopify.com";
    const shop = await migrationPrisma.shop.create({
      data: { myshopifyDomain: domain },
    });
    const tenant = issueTenantAuthority({
      shopId: shop.id,
      myshopifyDomain: domain,
      source: "verified_admin_request",
    });

    // The winner inserts the row and holds its transaction open, so the
    // loser's INSERT waits on the unique key and fails once the winner commits.
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let inserted!: () => void;
    const winnerInserted = new Promise<void>((resolve) => (inserted = resolve));
    const winner = migrationPrisma.$transaction(
      async (migrationTx) => {
        await migrationTx.shopSettings.create({
          data: { shop: domain, shopId: shop.id },
        });
        inserted();
        await released;
      },
      { timeout: 30_000 },
    );
    await winnerInserted;

    const counter = { readBacks: 0 };
    const loser = ensureShopSettings(
      countingReadBacks(createTenantDb(tenant), counter),
    );
    await waitForBlockedBackend(migrationPrisma);
    release();
    await winner;

    await expect(loser).resolves.toBeUndefined();
    expect(counter.readBacks).toBe(1);
  });

  it("a failed afterAuth bootstrap is logged without session secrets before it is rethrown", async () => {
    const logs = spyOnLogs();

    await expect(
      runAfterAuthTenantBootstrap({
        shop: "https://not-a-shop-domain.example",
        accessToken: "shpat_must_never_be_logged",
      } as never),
    ).rejects.toMatchObject({ name: "TenantAuthorityError" });

    const lines = logs.errorLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("afterAuth tenant bootstrap failed");
    expect(lines[0]).toContain("TenantAuthorityError");
    expect(logs.allText()).not.toContain("shpat_must_never_be_logged");
  });

  it("never takes over a settings row that belongs to another shop, and logs the refusal without the token", async () => {
    const domain = "first-install-race-foreign.myshopify.com";
    const shop = await migrationPrisma.shop.create({
      data: { myshopifyDomain: domain },
    });
    const other = await migrationPrisma.shop.create({
      data: { myshopifyDomain: "first-install-race-owner.myshopify.com" },
    });
    // A row keyed by this domain but owned by another shop, which this
    // tenant cannot see: the create loses on the unique key and the
    // read-back through the tenant client finds nothing.
    await migrationPrisma.shopSettings.create({
      data: { shop: domain, shopId: other.id },
    });
    const logs = spyOnLogs();

    await expect(
      runAfterAuthTenantBootstrap({
        shop: domain,
        accessToken: "shpat_must_never_be_logged",
      } as never),
    ).rejects.toMatchObject({ code: "P2002" });

    const row = await migrationPrisma.shopSettings.findUniqueOrThrow({
      where: { shop: domain },
    });
    expect(row.shopId).toBe(other.id);
    expect(row.shopId).not.toBe(shop.id);
    expect(
      logs
        .errorLines()
        .some((l) => l.includes("afterAuth tenant bootstrap failed")),
    ).toBe(true);
    expect(logs.allText()).not.toContain("shpat_must_never_be_logged");
  });
});
