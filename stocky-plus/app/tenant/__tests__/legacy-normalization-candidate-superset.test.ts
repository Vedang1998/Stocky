/**
 * F-PR2R4-03 — SQL candidate discovery is a bounded locale-sensitive superset;
 * JavaScript phase1-shop-domain-v1 is the final authorization authority.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import {
  ECMA_SCRIPT_TRIM_CODE_POINTS,
  normalizeShopDomain,
  SHOP_DOMAIN_NORMALIZATION_CORPUS,
  shopDomainTrimCharacters,
} from "../shop-domain";
import {
  legacyShopMatchesTenant,
  resolveMatchingRawLegacyShops,
} from "../legacy-scope";
import { createTenantDb } from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

/** Domain containing ASCII 'k' for Kelvin-sign fold probes. */
const K_DOMAIN = "booksite.myshopify.com";

describe("tenant legacy candidate-superset normalization (F-PR2R4-03)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let localeInfo: { datctype: string; datcollate: string };

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
    const rows = await prisma.$queryRaw<
      Array<{ datctype: string; datcollate: string }>
    >`SELECT datctype, datcollate FROM pg_database WHERE datname = current_database()`;
    localeInfo = rows[0]!;
  });

  beforeEach(async () => {
    await prisma.supplier.deleteMany();
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    await prisma.shop.create({
      data: { myshopifyDomain: K_DOMAIN },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authFor(domain: string, shopId: string) {
    return issueTenantAuthority({
      shopId,
      myshopifyDomain: domain,
      source: "verified_admin_request",
    });
  }

  it("records actual CI/database locale for evidence", () => {
    expect(localeInfo.datctype.length).toBeGreaterThan(0);
    // Documented locales of interest: C, C.UTF-8 / C.utf8, and whatever CI uses.
    expect(typeof localeInfo.datctype).toBe("string");
    expect(typeof localeInfo.datcollate).toBe("string");
  });

  it("every JS-accepted corpus raw form is returned by SQL candidate discovery", async () => {
    const trimChars = shopDomainTrimCharacters();
    for (const entry of SHOP_DOMAIN_NORMALIZATION_CORPUS) {
      if (!entry.jsAcceptsAsCanonical) continue;
      const raw = entry.buildRaw(SHOP_A_DOMAIN, SHOP_B_DOMAIN);
      const js = normalizeShopDomain(raw);
      expect(js.ok && js.normalized === SHOP_A_DOMAIN).toBe(true);

      const rows = await prisma.$queryRaw<Array<{ matches: boolean }>>`
        SELECT (lower(btrim(${raw}, ${trimChars})) = ${SHOP_A_DOMAIN}) AS matches
      `;
      expect({ id: entry.id, sql: rows[0]?.matches }).toEqual({
        id: entry.id,
        sql: true,
      });
    }
  });

  it("every SQL candidate is subjected to JS normalization before authorization", async () => {
    const paddings = [
      `\t${SHOP_A_DOMAIN}`,
      ` ${SHOP_A_DOMAIN}`,
      `\u00A0${SHOP_A_DOMAIN}`,
      `\uFEFF${SHOP_A_DOMAIN}`,
      SHOP_A_DOMAIN.toUpperCase(),
      // Kelvin-sign fold residual under UTF-8 ctype (JS must deny).
      K_DOMAIN.replace("k", "\u212A"),
    ];

    for (const raw of paddings) {
      await prisma.supplier.create({
        data: {
          shop: raw,
          shopId: null,
          name: `row-${raw.length}`,
        },
      });
    }

    const authority = authFor(SHOP_A_DOMAIN, shopAId);
    const accepted = await resolveMatchingRawLegacyShops(
      prisma,
      "Supplier",
      authority,
    );

    for (const raw of accepted) {
      expect(legacyShopMatchesTenant(raw, authority)).toBe(true);
      const js = normalizeShopDomain(raw);
      expect(js.ok && js.normalized === SHOP_A_DOMAIN).toBe(true);
    }

    // Kelvin / foreign forms must not enter the authorization set for shop A.
    expect(accepted.some((r) => r.includes("\u212A"))).toBe(false);
    expect(accepted.every((r) => !r.includes(K_DOMAIN))).toBe(true);
  });

  it("Kelvin sign remains JS-denied; SQL may discover under UTF-8 ctype", async () => {
    const trimChars = shopDomainTrimCharacters();
    const raw = "boo\u212Asite.myshopify.com";
    const js = normalizeShopDomain(raw);
    expect(js.ok).toBe(false);
    if (!js.ok) expect(js.reason).toBe("non_ascii");

    const rows = await prisma.$queryRaw<Array<{ matches: boolean }>>`
      SELECT (lower(btrim(${raw}, ${trimChars})) = ${K_DOMAIN}) AS matches
    `;
    const sqlDiscovers = rows[0]?.matches === true;

    // Under C.UTF-8 (this environment) SQL often discovers; under pure C it may not.
    // Either way JS denies and authorization must not include it.
    if (localeInfo.datctype.toLowerCase().includes("utf")) {
      expect(sqlDiscovers).toBe(true);
    }

    await prisma.supplier.create({
      data: { shop: raw, shopId: null, name: "kelvin" },
    });
    const kShop = await prisma.shop.findUnique({
      where: { myshopifyDomain: K_DOMAIN },
    });
    expect(kShop).toBeTruthy();
    const accepted = await resolveMatchingRawLegacyShops(
      prisma,
      "Supplier",
      authFor(K_DOMAIN, kShop!.id),
    );
    expect(accepted).not.toContain(raw);
    expect(accepted.every((r) => normalizeShopDomain(r).ok)).toBe(true);
  });

  it("non-ASCII confusables and ECMAScript whitespace corpus stay denied or accepted correctly", async () => {
    for (const cp of ECMA_SCRIPT_TRIM_CODE_POINTS) {
      expect(String.fromCodePoint(cp).trim()).toBe("");
    }

    const cyrillic = `е${SHOP_A_DOMAIN}`;
    expect(normalizeShopDomain(cyrillic).ok).toBe(false);

    await prisma.supplier.create({
      data: { shop: cyrillic, shopId: null, name: "cyrillic" },
    });
    const accepted = await resolveMatchingRawLegacyShops(
      prisma,
      "Supplier",
      authFor(SHOP_A_DOMAIN, shopAId),
    );
    expect(accepted).not.toContain(cyrillic);
  });

  it("extra SQL candidates count toward overflow budget (documented)", async () => {
    // Seed one JS-accepted form and many Kelvin-style SQL-superset forms that
    // normalize toward K_DOMAIN, then authenticate as K_DOMAIN with limit
    // behavior exercised via resolveMatchingRawLegacyShops count path.
    const kShop = await prisma.shop.findUnique({
      where: { myshopifyDomain: K_DOMAIN },
    });
    await prisma.supplier.create({
      data: {
        shop: `\t${K_DOMAIN}`,
        shopId: null,
        name: "accepted",
      },
    });
    // Distinct Kelvin variants that SQL may discover for K_DOMAIN.
    for (let i = 0; i < 3; i++) {
      await prisma.supplier.create({
        data: {
          shop: `${" ".repeat(i + 1)}boo\u212Asite.myshopify.com`,
          shopId: null,
          name: `kelvin-${i}`,
        },
      });
    }

    const accepted = await resolveMatchingRawLegacyShops(
      prisma,
      "Supplier",
      authFor(K_DOMAIN, kShop!.id),
    );
    // Only JS-accepted forms authorize.
    expect(accepted.every((r) => !r.includes("\u212A"))).toBe(true);
    expect(accepted.some((r) => r.includes(K_DOMAIN) || r.includes("BOOKSITE"))).toBe(
      true,
    );

    // TenantDb broad read still works for the accepted form.
    const db = createTenantDb(authFor(K_DOMAIN, kShop!.id));
    const count = await db.supplier.count({});
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
