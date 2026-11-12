/**
 * The Bundles page's loader and action against a stand-in database: decimals
 * reach the browser as exact strings, and nothing is written from a form
 * that is invalid or names a variant the shop does not have.
 */
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const db = vi.hoisted(() => ({
  bomComponent: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  shopifyVariantCache: { findMany: vi.fn() },
}));

vi.mock("../../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    tenant: { shopId: "shop-a", myshopifyDomain: "shop-a.myshopify.com" },
    db,
  })),
}));

import { action, loader } from "../../routes/app.bundles";

function post(fields: Record<string, string>): ActionFunctionArgs {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  return {
    request: new Request("https://app.example/app/bundles", { method: "POST", body }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs;
}

const ADD = { intent: "add", bundleVariantId: "v-box", componentVariantId: "v-part", quantity: "0.1" };

beforeEach(() => {
  db.bomComponent.findMany.mockReset().mockResolvedValue([]);
  db.bomComponent.upsert.mockReset().mockResolvedValue({});
  db.bomComponent.deleteMany.mockReset().mockResolvedValue({ count: 1 });
  db.shopifyVariantCache.findMany
    .mockReset()
    .mockResolvedValue([{ shopifyVariantId: "v-box" }, { shopifyVariantId: "v-part" }]);
});

describe("bundles loader", () => {
  it("sends each quantity as an exact decimal string (#77)", async () => {
    db.bomComponent.findMany.mockResolvedValue([
      {
        id: "c1",
        bundleVariantId: "v-box",
        componentVariantId: "v-part",
        quantity: new Prisma.Decimal("2.0000"),
      },
    ]);
    db.shopifyVariantCache.findMany.mockResolvedValue([
      { shopifyVariantId: "v-box", title: "Gift box" },
    ]);
    const data = await loader({
      request: new Request("https://app.example/app/bundles"),
      params: {},
      context: {},
    } as unknown as LoaderFunctionArgs);
    expect(data.components).toEqual([
      { id: "c1", bundleVariantId: "v-box", componentVariantId: "v-part", quantity: "2" },
    ]);
    expect(data.variants).toEqual([{ shopifyVariantId: "v-box", title: "Gift box" }]);
  });
});

describe("bundles action", () => {
  it("stores the quantity as typed, without passing through a float", async () => {
    await expect(action(post(ADD))).resolves.toEqual({ ok: true });
    expect(db.bomComponent.upsert).toHaveBeenCalledWith({
      where: {
        shop_bundleVariantId_componentVariantId: {
          shop: "shop-a.myshopify.com",
          bundleVariantId: "v-box",
          componentVariantId: "v-part",
        },
      },
      create: {
        shop: "shop-a.myshopify.com",
        bundleVariantId: "v-box",
        componentVariantId: "v-part",
        quantity: "0.1",
      },
      update: { quantity: "0.1" },
    });
  });

  it("writes nothing for an invalid form", async () => {
    await expect(action(post({ ...ADD, quantity: "0" }))).resolves.toEqual({
      ok: false,
      errors: { quantity: expect.any(String) },
    });
    expect(db.shopifyVariantCache.findMany).not.toHaveBeenCalled();
    expect(db.bomComponent.upsert).not.toHaveBeenCalled();
  });

  it("refuses a variant that is not in the shop's catalog", async () => {
    db.shopifyVariantCache.findMany.mockResolvedValue([{ shopifyVariantId: "v-box" }]);
    await expect(action(post(ADD))).resolves.toEqual({
      ok: false,
      errors: { componentVariantId: "This variant is not in your synced catalog." },
    });
    expect(db.shopifyVariantCache.findMany).toHaveBeenCalledWith({
      where: { shopifyVariantId: { in: ["v-box", "v-part"] } },
      select: { shopifyVariantId: true },
    });
    expect(db.bomComponent.upsert).not.toHaveBeenCalled();
  });

  it("removes a component by id and ignores a delete without one", async () => {
    await expect(action(post({ intent: "delete", id: "c1" }))).resolves.toEqual({ ok: true });
    expect(db.bomComponent.deleteMany).toHaveBeenCalledWith({ where: { id: "c1" } });

    db.bomComponent.deleteMany.mockClear();
    await expect(action(post({ intent: "delete" }))).resolves.toEqual({ ok: true });
    expect(db.bomComponent.deleteMany).not.toHaveBeenCalled();
  });

  it("answers 400 for a form it does not know", async () => {
    await expect(action(post({ intent: "purge" }))).rejects.toMatchObject({ status: 400 });
    expect(db.bomComponent.upsert).not.toHaveBeenCalled();
    expect(db.bomComponent.deleteMany).not.toHaveBeenCalled();
  });
});
