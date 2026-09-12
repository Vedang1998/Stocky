import { describe, expect, it } from "vitest";
import { mapConnectionPage } from "./cursor-pagination";
import { OrderPaginationError } from "./errors";

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

  it("fails when edges is missing rather than treating it as an empty page", () => {
    expect(() =>
      mapConnectionPage({
        connection: {
          pageInfo: { hasNextPage: false, endCursor: null },
        },
        connectionName: "lineItems",
        mapNode: (node) => node,
        nodeIdentity: (node) => (node as { id: string }).id,
      }),
    ).toThrow(/edges must be an array/);
  });

  it("fails when a promised continuation page is empty", () => {
    expect(() =>
      mapConnectionPage({
        connection: {
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: [],
        },
        connectionName: "lineItems",
        mapNode: (node) => node,
        nodeIdentity: (node) => (node as { id: string }).id,
        requireNonEmpty: true,
      }),
    ).toThrow(/continuation page was empty/);
  });
});
