import { describe, expect, it } from "vitest";
import { readAllLocations, LocationPaginationError } from "./locations";
import { LOCATION_PAGE_SIZE } from "./types";
import { createMockAdmin, locationNode } from "./__tests__/mock-admin";

function paginatedHandler(total: number, pageSize = LOCATION_PAGE_SIZE) {
  const all = Array.from({ length: total }, (_, index) => locationNode(index + 1));
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
        locations: {
          pageInfo: {
            hasNextPage: end < all.length,
            endCursor: slice.length ? slice[slice.length - 1].id : null,
          },
          edges: slice.map((node) => ({ cursor: node.id, node })),
        },
      },
    };
  });
}

describe("PR5-F2A location pagination", () => {
  it("exhausts cursors for more than 50 locations with no duplicates or omissions", async () => {
    const admin = paginatedHandler(55);
    const locations = await readAllLocations(admin, { pageSize: 50 });
    expect(locations).toHaveLength(55);
    expect(new Set(locations.map((location) => location.id)).size).toBe(55);
    expect(locations[0]?.id).toBe("gid://shopify/Location/1");
    expect(locations[54]?.id).toBe("gid://shopify/Location/55");
    expect(admin.calls.length).toBe(2);
    expect(admin.calls[0]?.variables?.after == null).toBe(true);
    expect(admin.calls[1]?.variables?.after).toBe("gid://shopify/Location/50");
    expect(admin.calls[0]?.query).toContain("query CatalogFactLocations");
    expect(admin.calls[0]?.query).not.toContain("currentBulkOperation");
  });

  it("fails closed on a duplicate endCursor instead of looping or skipping", async () => {
    let page = 0;
    const admin = createMockAdmin(() => {
      page += 1;
      return {
        data: {
          locations: {
            pageInfo: { hasNextPage: true, endCursor: "cursor-a" },
            edges: [{ cursor: `c${page}`, node: locationNode(page) }],
          },
        },
      };
    });
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toBeInstanceOf(
      LocationPaginationError,
    );
    page = 0;
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toThrow(
      /duplicate locations endCursor/,
    );
  });

  it("fails closed when hasNextPage is true but endCursor is missing", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        locations: {
          pageInfo: { hasNextPage: true, endCursor: null },
          edges: [{ cursor: "c1", node: locationNode(1) }],
        },
      },
    }));
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toThrow(
      /endCursor is missing/,
    );
  });

  it("fails closed on an empty page while hasNextPage is true (missing page)", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        locations: {
          pageInfo: { hasNextPage: true, endCursor: "next" },
          edges: [],
        },
      },
    }));
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toThrow(
      /missing page/,
    );
  });

  it("fails closed when pageInfo is missing", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        locations: {
          edges: [{ cursor: "c1", node: locationNode(1) }],
        },
      },
    }));
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toThrow(
      /pageInfo is missing/,
    );
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toBeInstanceOf(
      LocationPaginationError,
    );
  });

  it("fails closed when hasNextPage is not a boolean", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        locations: {
          pageInfo: { hasNextPage: "false", endCursor: null },
          edges: [{ cursor: "c1", node: locationNode(1) }],
        },
      },
    }));
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toThrow(
      /hasNextPage must be a boolean/,
    );
  });

  it("fails closed when pageInfo is not an object", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        locations: {
          pageInfo: "yes",
          edges: [{ cursor: "c1", node: locationNode(1) }],
        },
      },
    }));
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toThrow(
      /pageInfo is not an object/,
    );
  });

  it("fails closed when endCursor has an invalid type", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        locations: {
          pageInfo: { hasNextPage: true, endCursor: 123 },
          edges: [{ cursor: "c1", node: locationNode(1) }],
        },
      },
    }));
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toThrow(
      /endCursor must be a string or null/,
    );
  });

  it("fails closed on duplicate location GIDs across pages", async () => {
    let page = 0;
    const admin = createMockAdmin(() => {
      page += 1;
      const node = locationNode(1);
      return {
        data: {
          locations: {
            pageInfo: {
              hasNextPage: page === 1,
              endCursor: page === 1 ? "page-1" : null,
            },
            edges: [{ cursor: node.id, node }],
          },
        },
      };
    });
    await expect(readAllLocations(admin, { pageSize: 50 })).rejects.toThrow(
      /duplicate location GID/,
    );
  });
});
