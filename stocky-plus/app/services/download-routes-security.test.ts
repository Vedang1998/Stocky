/**
 * Regression tests for the attack-test findings on merchant download routes:
 * - labels: unbounded counts exhausted server memory; barcodes injected ZPL
 * - all downloads: private, non-cacheable, non-sniffable responses
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { MAX_LABELS_PER_REQUEST } from "../lib/warehouse-labels.server";

const { variantFindMany } = vi.hoisted(() => ({ variantFindMany: vi.fn() }));

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    admin: { graphql: vi.fn() },
    tenant: { shopId: "shop-a", myshopifyDomain: "shop-a.myshopify.com" },
    db: { shopifyVariantCache: { findMany: variantFindMany } },
  })),
}));

import { loader as labelsLoader } from "../routes/app.warehouse_.labels";

const GID = "gid://shopify/ProductVariant/1002";

function args(path: string): LoaderFunctionArgs {
  return {
    request: new Request(`https://app.example${path}`),
    params: {},
    context: {},
  } as LoaderFunctionArgs;
}

function expectPrivateDownload(response: Response): void {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="[A-Za-z0-9._-]+"$/);
}

describe("warehouse labels route", () => {
  beforeEach(() => {
    variantFindMany.mockReset();
    variantFindMany.mockResolvedValue([
      {
        shopifyVariantId: GID,
        title: "Alpha Widget",
        barcode: "12^XZ^XA^FDINJECTED",
        sku: "SKU-A2",
      },
    ]);
  });

  it("refuses an oversized label count before touching the database", async () => {
    const response = (await labelsLoader(
      args(`/app/warehouse/labels?items=${encodeURIComponent(GID)}:40000000`),
    )) as Response;

    expect(response.status).toBe(400);
    expect(variantFindMany).not.toHaveBeenCalled();
  });

  it("prints labels for a link built the way the warehouse UI builds it", async () => {
    const response = (await labelsLoader(
      args(`/app/warehouse/labels?items=${encodeURIComponent(GID)}:2`),
    )) as Response;
    const zpl = await response.text();

    expect(response.status).toBe(200);
    expect(variantFindMany).toHaveBeenCalledTimes(1);
    expect(variantFindMany).toHaveBeenCalledWith({
      where: { shopifyVariantId: { in: [GID] } },
    });
    expect(zpl.match(/\^XA/g)).toHaveLength(2);
    expect(zpl.match(/\^XZ/g)).toHaveLength(2);
    expect(zpl).not.toContain("INJECTED");
    expectPrivateDownload(response);
  });

  // Store-test finding: an unknown variant used to give an empty file with 200.
  it("stops with a clear error when a product is not in the catalog", async () => {
    const unknown = "gid://shopify/ProductVariant/424242";
    const response = (await labelsLoader(
      args(`/app/warehouse/labels?items=${encodeURIComponent(GID)}:2,${encodeURIComponent(unknown)}:1`),
    )) as Response;
    const text = await response.text();

    expect(response.status).toBe(404);
    expect(text).toContain(unknown);
    expect(text).toContain("no labels were made");
    expect(text).not.toContain("^XA");
  });

  it("gives the same error when the only product is unknown", async () => {
    variantFindMany.mockResolvedValue([]);
    const response = (await labelsLoader(
      args(`/app/warehouse/labels?items=${encodeURIComponent(GID)}:2`),
    )) as Response;
    expect(response.status).toBe(404);
    expect(await response.text()).toContain(GID);
  });

  it("prints exactly the maximum number of labels", async () => {
    variantFindMany.mockResolvedValue([
      { shopifyVariantId: GID, title: "Alpha Widget", barcode: "111", sku: null },
    ]);
    const response = (await labelsLoader(
      args(`/app/warehouse/labels?items=${encodeURIComponent(GID)}:${MAX_LABELS_PER_REQUEST}`),
    )) as Response;

    expect(response.status).toBe(200);
    expect((await response.text()).match(/\^XA/g)).toHaveLength(MAX_LABELS_PER_REQUEST);
  });
});
