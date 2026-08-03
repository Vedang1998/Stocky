/**
 * F-PR2R3-03 — SQL candidate discovery uses the shared trim set;
 * JavaScript phase1-shop-domain-v1 remains final authority.
 *
 * F-PR2R4-03: do not claim SQL decision == JS decision for every Unicode
 * value or database locale. Locale-sensitive supersets are covered by
 * legacy-normalization-candidate-superset.test.ts.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import {
  ECMA_SCRIPT_TRIM_CODE_POINTS,
  PHASE1_SHOP_DOMAIN_SPEC,
  SHOP_DOMAIN_NORMALIZATION_CORPUS,
  normalizeShopDomain,
  shopDomainTrimCharacters,
} from "../shop-domain";
import { createTenantDb } from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

describe("tenant legacy SQL/JS normalization equivalence (F-PR2R3-03)", () => {
  let prisma: PrismaClient;
  let shopAId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.supplier.deleteMany();
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function dbA() {
    return createTenantDb(
      issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
      }),
    );
  }

  it("shared specification exposes exact ECMAScript trim set", () => {
    expect(PHASE1_SHOP_DOMAIN_SPEC.algorithmVersion).toBe(
      "phase1-shop-domain-v1",
    );
    expect(PHASE1_SHOP_DOMAIN_SPEC.trimCodePoints).toEqual(
      ECMA_SCRIPT_TRIM_CODE_POINTS,
    );
    expect(ECMA_SCRIPT_TRIM_CODE_POINTS).toContain(0x0009);
    expect(ECMA_SCRIPT_TRIM_CODE_POINTS).toContain(0x000a);
    expect(ECMA_SCRIPT_TRIM_CODE_POINTS).toContain(0x00a0);
    expect(ECMA_SCRIPT_TRIM_CODE_POINTS).toContain(0xfeff);
    // Node String.prototype.trim agrees with the shared set.
    for (const cp of ECMA_SCRIPT_TRIM_CODE_POINTS) {
      expect(String.fromCodePoint(cp).trim()).toBe("");
    }
  });

  it("corpus: JS acceptance matches expectations; SQL discovers JS-accepted forms", async () => {
    const trimChars = shopDomainTrimCharacters();

    for (const entry of SHOP_DOMAIN_NORMALIZATION_CORPUS) {
      if (entry.sqlDiscoveryLocaleDependent) continue;

      const raw = entry.buildRaw(SHOP_A_DOMAIN, SHOP_B_DOMAIN);
      const js = normalizeShopDomain(raw);
      const jsAccepts =
        js.ok && js.normalized === SHOP_A_DOMAIN;

      expect({
        id: entry.id,
        jsAccepts,
      }).toEqual({
        id: entry.id,
        jsAccepts: entry.jsAcceptsAsCanonical,
      });

      // SQL candidate discovery: lower(btrim(raw, sharedTrimSet)) = domain
      const rows = await prisma.$queryRaw<Array<{ matches: boolean }>>`
        SELECT (lower(btrim(${raw}, ${trimChars})) = ${SHOP_A_DOMAIN}) AS matches
      `;
      const sqlDiscovers = rows[0]?.matches === true;

      // Every JS-accepted form must be SQL-discoverable (SQL is a superset).
      if (jsAccepts) {
        expect({ id: entry.id, sqlDiscovers }).toEqual({
          id: entry.id,
          sqlDiscovers: true,
        });
      }

      // For locale-independent corpus entries, SQL discovery matches the
      // documented expectation (not a universal SQL==JS identity claim).
      expect({
        id: entry.id,
        sqlDiscovers,
      }).toEqual({
        id: entry.id,
        sqlDiscovers: entry.sqlDiscoversAsCandidate,
      });
    }
  });

  it("null-owned rows with tab/newline/CR/NBSP/BOM are visible across operation families", async () => {
    const paddings = [
      ["tab", `\t${SHOP_A_DOMAIN}`],
      ["lf", `\n${SHOP_A_DOMAIN}`],
      ["cr", `\r${SHOP_A_DOMAIN}`],
      ["nbsp", `\u00A0${SHOP_A_DOMAIN}`],
      ["bom", `\uFEFF${SHOP_A_DOMAIN}`],
      ["mixed", ` \t\n${SHOP_A_DOMAIN}\r `],
    ] as const;

    const seeded: Array<{ id: string; label: string }> = [];
    for (const [label, shop] of paddings) {
      const row = await prisma.supplier.create({
        data: { shop, shopId: null, name: label },
      });
      seeded.push({ id: row.id, label });
    }

    // Also seed a foreign null-owned control that must stay invisible.
    await prisma.supplier.create({
      data: { shop: `\t${SHOP_B_DOMAIN}`, shopId: null, name: "foreign-tab" },
    });

    const many = await dbA().supplier.findMany({});
    const ids = new Set(many.map((r: { id: string }) => r.id));
    for (const row of seeded) {
      expect(ids.has(row.id)).toBe(true);
      const unique = await dbA().supplier.findUnique({ where: { id: row.id } });
      expect(unique?.id).toBe(row.id);
    }
    expect(many.every((r: { name: string }) => r.name !== "foreign-tab")).toBe(
      true,
    );

    expect(await dbA().supplier.count({})).toBe(seeded.length);
    expect(
      (await dbA().supplier.aggregate({ _count: { _all: true } }))._count._all,
    ).toBe(seeded.length);

    const groups = await dbA().supplier.groupBy({
      by: ["name"],
      _count: { _all: true },
    });
    expect(groups.length).toBe(seeded.length);

    const first = seeded[0]!;
    await dbA().supplier.update({
      where: { id: first.id },
      data: { name: "updated-tab" },
    });
    expect(
      (await prisma.supplier.findUnique({ where: { id: first.id } }))?.name,
    ).toBe("updated-tab");

    const touched = await dbA().supplier.updateMany({
      data: { name: "bulk" },
    });
    expect(touched.count).toBe(seeded.length);

    const deleted = await dbA().supplier.deleteMany({
      where: { name: "bulk" },
    });
    expect(deleted.count).toBe(seeded.length);
    expect(await prisma.supplier.count({ where: { shopId: null } })).toBe(1);
  });

  it("SQL never uses space-only btrim for candidate discovery", async () => {
    // Prove the shared trim set discovers tab-padded values that space-only
    // btrim would miss.
    const raw = `\t${SHOP_A_DOMAIN}`;
    const trimChars = shopDomainTrimCharacters();
    const withShared = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT (lower(btrim(${raw}, ${trimChars})) = ${SHOP_A_DOMAIN}) AS ok
    `;
    const spaceOnly = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT (lower(btrim(${raw})) = ${SHOP_A_DOMAIN}) AS ok
    `;
    expect(withShared[0]?.ok).toBe(true);
    expect(spaceOnly[0]?.ok).toBe(false);
  });
});
