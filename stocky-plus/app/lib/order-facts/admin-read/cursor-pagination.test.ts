import { describe, expect, it } from "vitest";
import { mapConnectionPage } from "../cursor-pagination";
import { OrderPaginationError } from "../errors";

describe("PR6-B cursor pagination fail-closed", () => {
  it("fails when pageInfo is missing", () => {
    expect(() =>
      mapConnectionPage({
        connection: { edges: [{ cursor: "c1", node: { id: "1" } }] },
        connectionName: "lineItems",
        mapNode: (node) => node,
        nodeIdentity: (node) => (node as { id: string }).id,
      }),
    ).toThrow(OrderPaginationError);
  });

  it("fails on empty page while hasNextPage is true", () => {
    expect(() =>
      mapConnectionPage({
        connection: {
          pageInfo: { hasNextPage: true, endCursor: "next" },
          edges: [],
        },
        connectionName: "lineItems",
        mapNode: (node) => node,
        nodeIdentity: (node) => (node as { id: string }).id,
      }),
    ).toThrow(/missing page/);
  });

  it("fails when hasNextPage is true but endCursor is missing", () => {
    expect(() =>
      mapConnectionPage({
        connection: {
          pageInfo: { hasNextPage: true, endCursor: null },
          edges: [{ cursor: "c1", node: { id: "1" } }],
        },
        connectionName: "sales",
        mapNode: (node) => node,
        nodeIdentity: (node) => (node as { id: string }).id,
      }),
    ).toThrow(/endCursor is missing/);
  });
});
