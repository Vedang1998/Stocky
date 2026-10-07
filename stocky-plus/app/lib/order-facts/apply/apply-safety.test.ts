import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ORDER_APPLY_PHYSICAL_DELETE_OPERATIONS,
  applyOrderFacts,
  denyOrderFactPhysicalDelete,
} from "./index";
import {
  OrderApplyAccessScopeMismatchError,
  OrderApplyLeaseInvalidError,
  OrderApplyPhysicalDeleteError,
  OrderApplyProcessingDisabledError,
  OrderApplyRequestGenerationMismatchError,
} from "./errors";
import { requireProcessingEnabled } from "./writers";

const DIR = path.dirname(fileURLToPath(import.meta.url));

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTs(full));
      continue;
    }
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("PR6-C apply surface safety (R-164)", () => {
  it("ordinary apply APIs provide no physical-delete operation", () => {
    expect(ORDER_APPLY_PHYSICAL_DELETE_OPERATIONS).toEqual([]);
    expect(() => denyOrderFactPhysicalDelete()).toThrow(
      OrderApplyPhysicalDeleteError,
    );
  });

  it("request-generation mismatch is a distinct fail-closed error", () => {
    const error = new OrderApplyRequestGenerationMismatchError();
    expect(error).not.toBeInstanceOf(OrderApplyLeaseInvalidError);
    expect(error.code).toBe("order_apply_request_generation_mismatch");
    const scopeError = new OrderApplyAccessScopeMismatchError();
    expect(scopeError.code).toBe("order_apply_access_scope_mismatch");
    expect(scopeError).not.toBeInstanceOf(OrderApplyLeaseInvalidError);
  });

  it("apply module source has no physical delete, Shopify I/O, or Number money arithmetic", () => {
    const files = walkTs(DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((file) => file.endsWith(`${path.sep}index.ts`))).toBe(
      true,
    );
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/MAX_UNIQUE_RETRIES/);
      expect(source, file).not.toMatch(/\.deleteMany\s*\(/);
      expect(source, file).not.toMatch(/\$queryRaw\s*\(/);
      expect(source, file).not.toMatch(
        /DELETE\s+FROM\s+"ShopifyOrder(Line|Refund|Agreement|Adjustment)?Fact"/i,
      );
      expect(source, file).not.toMatch(/parseFloat\s*\(/);
      expect(source, file).not.toMatch(/Number\.parseFloat\s*\(/);
      expect(source, file).not.toMatch(/\bsetval\s*\(/);
      expect(source, file).not.toMatch(/pg_advisory_lock\s*\(/);
      expect(source, file).not.toMatch(/bulkOperationRunQuery/);
      expect(source, file).not.toMatch(/fetch\s*\(/);
      expect(source, file).not.toMatch(/@shopify/);
      expect(source, file).not.toMatch(/processBomSale/);
      expect(source, file).not.toMatch(/SalesDailyAggregate/);
      expect(source, file).not.toMatch(/INSERT INTO "DataIssue"/);
    }
    expect(typeof applyOrderFacts).toBe("function");
  });

  it("does not retry unique conflicts in-process and binds requestGen", () => {
    const fencing = readFileSync(path.join(DIR, "fencing.ts"), "utf8");
    expect(fencing).toMatch(/OrderApplyRequestGenerationMismatchError/);
    expect(fencing).toMatch(/"accessScopeSnapshot"/);
    expect(fencing).toMatch(/OrderApplyAccessScopeMismatchError/);
    const index = readFileSync(path.join(DIR, "index.ts"), "utf8");
    expect(index).toMatch(/MUST start a fresh[\s*]+PostgreSQL transaction/);
    const writers = readFileSync(path.join(DIR, "writers.ts"), "utf8");
    expect(writers).not.toMatch(/ON CONFLICT[\s\n]+(?:\([^;]+\)\s*)?DO UPDATE/);
    expect(writers).toMatch(
      /WITH _guard AS \([\s\S]*stocky_participating_write_guard/,
    );
    expect(writers).toMatch(/SELECT 1::int AS ok FROM _guard/);
    expect(writers).not.toMatch(
      /queryRows(?:<[^>]+>)?\(db\)`\s*SELECT\s+stocky_participating_write_guard/,
    );
    expect(writers).not.toMatch(
      /\$executeRaw`[\s\S]*stocky_participating_write_guard/,
    );
    const receipts = readFileSync(path.join(DIR, "receipts.ts"), "utf8");
    expect(receipts).toMatch(/ON CONFLICT \("shopId", "applicationKey"\) DO NOTHING/);
    expect(receipts).not.toMatch(/ON CONFLICT[\s\n]+(?:\([^;]+\)\s*)?DO UPDATE/);
  });

  it("requireProcessingEnabled queries a typed participating-write wrap and skips it when disabled", async () => {
    const calls: string[] = [];
    const enabled = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const sql = strings.join("?");
        calls.push(`query:${sql}`);
        if (sql.includes("stocky_shop_processing_enabled")) {
          return [{ processingEnabled: true }];
        }
        if (
          sql.includes("stocky_participating_write_guard") &&
          sql.includes("1::int")
        ) {
          return [{ ok: 1 }];
        }
        throw new Error(`unexpected query ${sql}`);
      },
    };
    await requireProcessingEnabled(enabled, "shop_1");
    expect(
      calls.some(
        (c) =>
          c.includes("participating_write_guard") && c.includes("1::int"),
      ),
    ).toBe(true);
    expect(calls.some((c) => c.includes("$executeRaw"))).toBe(false);

    const disabledCalls: string[] = [];
    const disabled = {
      $queryRaw: async () => {
        disabledCalls.push("query");
        return [{ processingEnabled: false }];
      },
    };
    await expect(
      requireProcessingEnabled(disabled, "shop_1"),
    ).rejects.toBeInstanceOf(OrderApplyProcessingDisabledError);
    expect(disabledCalls).toEqual(["query"]);
  });
});
