/**
 * F-PR2R4-04 — strict legacy evidence limit configuration parsing.
 */

import { afterEach, describe, expect, it } from "vitest";
import { TenantAccessError } from "../errors";
import {
  ABSOLUTE_MAX_DISTINCT_LEGACY_SHOP_FORMS,
  DEFAULT_MAX_DISTINCT_LEGACY_SHOP_FORMS,
  getMaxDistinctLegacyShopFormsPerModelTenant,
  parseLegacyEvidenceLimitConfig,
  resetLegacyEvidenceLimitForTests,
} from "../legacy-scope";

describe("tenant legacy evidence configuration (F-PR2R4-04)", () => {
  const original = process.env.TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS;
    } else {
      process.env.TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS = original;
    }
    resetLegacyEvidenceLimitForTests();
  });

  it("absent and empty resolve to default 1024", () => {
    expect(parseLegacyEvidenceLimitConfig(undefined)).toBe(
      DEFAULT_MAX_DISTINCT_LEGACY_SHOP_FORMS,
    );
    expect(parseLegacyEvidenceLimitConfig(null)).toBe(
      DEFAULT_MAX_DISTINCT_LEGACY_SHOP_FORMS,
    );
    expect(parseLegacyEvidenceLimitConfig("")).toBe(
      DEFAULT_MAX_DISTINCT_LEGACY_SHOP_FORMS,
    );
    expect(DEFAULT_MAX_DISTINCT_LEGACY_SHOP_FORMS).toBe(1024);
  });

  it("accepts exact bounds 1, 1024, 4096", () => {
    expect(parseLegacyEvidenceLimitConfig("1")).toBe(1);
    expect(parseLegacyEvidenceLimitConfig("1024")).toBe(1024);
    expect(parseLegacyEvidenceLimitConfig("4096")).toBe(
      ABSOLUTE_MAX_DISTINCT_LEGACY_SHOP_FORMS,
    );
  });

  it("rejects out of range and non-strict inputs", () => {
    const invalid = [
      "4097",
      "0",
      "-1",
      "2048.9",
      "1e9",
      "0x100",
      "+10",
      "10abc",
      "abc10",
      " 10",
      "10 ",
      " ",
      "\t1024",
      "",
    ];
    // empty already defaults — remove from throw set
    for (const raw of invalid.filter((v) => v !== "")) {
      if (raw === "") continue;
      expect(() => parseLegacyEvidenceLimitConfig(raw), raw).toThrow(
        TenantAccessError,
      );
      try {
        parseLegacyEvidenceLimitConfig(raw);
      } catch (err) {
        expect(err).toBeInstanceOf(TenantAccessError);
        expect((err as TenantAccessError).code).toBe(
          "legacy_evidence_config_invalid",
        );
      }
    }
  });

  it("lazy singleton caches successful validation and resets in tests", () => {
    delete process.env.TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS;
    resetLegacyEvidenceLimitForTests();
    const a = getMaxDistinctLegacyShopFormsPerModelTenant();
    const b = getMaxDistinctLegacyShopFormsPerModelTenant();
    expect(a).toBe(1024);
    expect(b).toBe(1024);

    process.env.TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS = "32";
    // Without reset, cached value remains.
    expect(getMaxDistinctLegacyShopFormsPerModelTenant()).toBe(1024);

    resetLegacyEvidenceLimitForTests();
    expect(getMaxDistinctLegacyShopFormsPerModelTenant()).toBe(32);

    process.env.TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS = "10abc";
    resetLegacyEvidenceLimitForTests();
    expect(() => getMaxDistinctLegacyShopFormsPerModelTenant()).toThrow(
      TenantAccessError,
    );
    // Failed validation must not freeze a truncated value.
    resetLegacyEvidenceLimitForTests();
    process.env.TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS = "64";
    expect(getMaxDistinctLegacyShopFormsPerModelTenant()).toBe(64);
  });

  it("repeated and concurrent reads are deterministic", async () => {
    process.env.TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS = "128";
    resetLegacyEvidenceLimitForTests();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        Promise.resolve(getMaxDistinctLegacyShopFormsPerModelTenant()),
      ),
    );
    expect(new Set(results)).toEqual(new Set([128]));
    expect(getMaxDistinctLegacyShopFormsPerModelTenant()).toBe(128);
    expect(getMaxDistinctLegacyShopFormsPerModelTenant()).toBe(128);
  });

  it("dangerous values never truncate via parseInt semantics", () => {
    expect(() => parseLegacyEvidenceLimitConfig("10abc")).toThrow(
      /legacy_evidence_config_invalid|base-10/,
    );
    expect(() => parseLegacyEvidenceLimitConfig("1e9")).toThrow(
      TenantAccessError,
    );
    expect(() => parseLegacyEvidenceLimitConfig("2048.9")).toThrow(
      TenantAccessError,
    );
  });
});
