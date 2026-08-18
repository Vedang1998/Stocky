import { describe, expect, it } from "vitest";
import {
  CollectionPaginationError,
  readProductCollectionMemberships,
} from "./resources";
import { createMockAdmin } from "./__tests__/mock-admin";

function collectionNode(index: number) {
  return {
    id: `gid://shopify/Collection/${index}`,
    title: `Collection ${index}`,
  };
}

function paginatedCollections(total: number, pageSize: number) {
  const all = Array.from({ length: total }, (_, index) => collectionNode(index + 1));
  return createMockAdmin((_query, variables) => {
    const first = Number(variables?.first ?? pageSize);
    const after = typeof variables?.after === "string" ? variables.after : null;
    let start = 0;
    if (after) {
      const afterIndex = all.findIndex((node) => node.id === after);
      start = afterIndex + 1;
    }
    const slice = all.slice(start, start + first);
    const end = start + slice.length;
    return {
      data: {
        product: {
          collections: {
            pageInfo: {
              hasNextPage: end < all.length,
              endCursor: slice.length ? slice[slice.length - 1].id : null,
            },
            edges: slice.map((node) => ({ cursor: node.id, node })),
          },
        },
      },
    };
  });
}

describe("PR5-F2A collection membership pagination", () => {
  it("exhausts cursors for more than 250 memberships with no silent truncation", async () => {
    const admin = paginatedCollections(251, 250);
    const memberships = await readProductCollectionMemberships(
      admin,
      "gid://shopify/Product/1",
      { pageSize: 250 },
    );
    expect(memberships).toHaveLength(251);
    expect(new Set(memberships.map((row) => row.collectionGid)).size).toBe(251);
    expect(memberships[0]?.collectionGid).toBe("gid://shopify/Collection/1");
    expect(memberships[250]?.collectionGid).toBe("gid://shopify/Collection/251");
    expect(admin.calls).toHaveLength(2);
    expect(admin.calls[0]?.variables?.after == null).toBe(true);
    expect(admin.calls[1]?.variables?.after).toBe("gid://shopify/Collection/250");
  });

  it("fails closed when the collections connection is missing on a later page", async () => {
    let page = 0;
    const admin = createMockAdmin(() => {
      page += 1;
      if (page === 1) {
        return {
          data: {
            product: {
              collections: {
                pageInfo: { hasNextPage: true, endCursor: "page-1" },
                edges: [{ node: collectionNode(1) }],
              },
            },
          },
        };
      }
      return { data: { product: { collections: null } } };
    });
    await expect(
      readProductCollectionMemberships(admin, "gid://shopify/Product/1", {
        pageSize: 1,
      }),
    ).rejects.toBeInstanceOf(CollectionPaginationError);
    page = 0;
    await expect(
      readProductCollectionMemberships(admin, "gid://shopify/Product/1", {
        pageSize: 1,
      }),
    ).rejects.toThrow(/collections connection missing/);
  });

  it("fails closed on an empty page while hasNextPage is true", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        product: {
          collections: {
            pageInfo: { hasNextPage: true, endCursor: "next" },
            edges: [],
          },
        },
      },
    }));
    await expect(
      readProductCollectionMemberships(admin, "gid://shopify/Product/1"),
    ).rejects.toThrow(/missing page/);
  });

  it("fails closed on a null collection edge", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        product: {
          collections: {
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [null],
          },
        },
      },
    }));
    await expect(
      readProductCollectionMemberships(admin, "gid://shopify/Product/1"),
    ).rejects.toThrow(/edge is missing node/);
  });

  it("fails closed on an id-less collection node", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        product: {
          collections: {
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [{ node: { id: "", title: "Nameless" } }],
          },
        },
      },
    }));
    await expect(
      readProductCollectionMemberships(admin, "gid://shopify/Product/1"),
    ).rejects.toThrow(/edge node is missing id/);
  });

  it("fails closed on a duplicate endCursor", async () => {
    let page = 0;
    const admin = createMockAdmin(() => {
      page += 1;
      return {
        data: {
          product: {
            collections: {
              pageInfo: { hasNextPage: true, endCursor: "cursor-a" },
              edges: [{ node: collectionNode(page) }],
            },
          },
        },
      };
    });
    await expect(
      readProductCollectionMemberships(admin, "gid://shopify/Product/1", {
        pageSize: 1,
      }),
    ).rejects.toThrow(/duplicate collections endCursor/);
  });

  it("fails closed when hasNextPage is true without endCursor", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        product: {
          collections: {
            pageInfo: { hasNextPage: true, endCursor: null },
            edges: [{ node: collectionNode(1) }],
          },
        },
      },
    }));
    await expect(
      readProductCollectionMemberships(admin, "gid://shopify/Product/1"),
    ).rejects.toThrow(/endCursor is missing/);
  });

  it("fails closed on duplicate collection GIDs across pages", async () => {
    let page = 0;
    const admin = createMockAdmin(() => {
      page += 1;
      return {
        data: {
          product: {
            collections: {
              pageInfo: {
                hasNextPage: page === 1,
                endCursor: page === 1 ? "page-1" : null,
              },
              edges: [{ node: collectionNode(1) }],
            },
          },
        },
      };
    });
    await expect(
      readProductCollectionMemberships(admin, "gid://shopify/Product/1", {
        pageSize: 1,
      }),
    ).rejects.toThrow(/duplicate collection GID/);
  });
});
