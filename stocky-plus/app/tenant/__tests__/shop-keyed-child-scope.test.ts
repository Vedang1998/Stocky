/**
 * PR6-A order child facts carry a NOT NULL shopId and a composite
 * (shopId, parentGid) foreign key, so their tenant scope is the canonical
 * shopId alone. Legacy children keep parent-lineage scope.
 */
import { describe, expect, it } from "vitest";
import { issueTenantAuthority } from "../authority.server";
import {
  SHOP_KEYED_CHILD_MODELS,
  nestedBulkScalarScopeWhere,
  rowOwnershipOk,
  tenantScopeWhere,
  tenantScopeWhereSync,
} from "../legacy-scope";
import { PR6_A_CHILD_MERCHANT_MODELS, PARENT_OWNERSHIP_RULES } from "../models";

const authority = issueTenantAuthority({
  shopId: "shop-a",
  myshopifyDomain: "a.myshopify.com",
  source: "verified_admin_request",
});

const unusedClient = new Proxy(
  {},
  {
    get() {
      throw new Error("shop-keyed child scope must not query the database");
    },
  },
) as never;

describe("shop-keyed child scope", () => {
  it("covers exactly the PR6-A child models, none of which has a parent rule", () => {
    expect([...SHOP_KEYED_CHILD_MODELS].sort()).toEqual(
      [...PR6_A_CHILD_MERCHANT_MODELS].sort(),
    );
    for (const model of PR6_A_CHILD_MERCHANT_MODELS) {
      expect(PARENT_OWNERSHIP_RULES[model]).toBeUndefined();
    }
  });

  it.each(PR6_A_CHILD_MERCHANT_MODELS)("scopes %s by canonical shopId", async (model) => {
    const expected = { shopId: "shop-a" };
    expect(tenantScopeWhereSync(model, authority)).toEqual(expected);
    expect(nestedBulkScalarScopeWhere(model, authority)).toEqual(expected);
    await expect(tenantScopeWhere(unusedClient, model, authority)).resolves.toEqual(expected);
  });

  it.each(PR6_A_CHILD_MERCHANT_MODELS)("proves %s rows only for the tenant's shopId", (model) => {
    expect(rowOwnershipOk(model, { id: "r", shopId: "shop-a" }, authority)).toBe(true);
    expect(rowOwnershipOk(model, { id: "r", shopId: "shop-b" }, authority)).toBe(false);
    expect(rowOwnershipOk(model, { id: "r", shopId: null }, authority)).toBe(false);
    expect(rowOwnershipOk(model, { id: "r" }, authority)).toBe(false);
  });

  it("keeps parent-lineage scope and the null-shopId branch for legacy children", () => {
    expect(tenantScopeWhereSync("POLineItem", authority)).toMatchObject({
      AND: [
        { OR: [{ shopId: "shop-a" }, { shopId: null }] },
        { purchaseOrder: expect.any(Object) },
      ],
    });
    expect(rowOwnershipOk("POLineItem", { id: "r", shopId: null }, authority)).toBe(true);
  });
});
