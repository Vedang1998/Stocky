import { describe, expect, it, vi } from "vitest";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import {
  createAvailableQuantityReader,
  createLevelQuantityReader,
} from "./shopify-levels.server";

const LOCATION = "gid://shopify/Location/11";
const item = (n: number) => `gid://shopify/InventoryItem/${n}`;

type LevelNode = {
  id?: string;
  inventoryLevel?: {
    quantities: Array<{ name: string; quantity: number }>;
  } | null;
} | null;

interface Call {
  query: string;
  variables: { ids: string[]; locationId: string; names: string[] };
}

/** An Admin client that answers each request with the nodes `respond` returns for it. */
function adminReturning(respond: (call: Call) => LevelNode[] | Error) {
  const calls: Call[] = [];
  const graphql = vi.fn(
    async (
      query: string,
      options?: { variables?: Record<string, unknown> },
    ) => {
      const call = {
        query,
        variables: options?.variables as Call["variables"],
      };
      calls.push(call);
      const answer = respond(call);
      return {
        json: async () =>
          answer instanceof Error
            ? { errors: [{ message: answer.message }] }
            : { data: { nodes: answer } },
      };
    },
  );
  const admin: AdminGraphQLClient = { graphql };
  return { admin, calls };
}

const level = (id: string, name: string, quantity: number): LevelNode => ({
  id,
  inventoryLevel: { quantities: [{ name, quantity }] },
});

describe("createLevelQuantityReader", () => {
  it("reads the named quantity for each item at the location", async () => {
    const { admin, calls } = adminReturning(() => [
      level(item(1), "on_hand", 12),
      level(item(2), "on_hand", 0),
    ]);

    const quantities = await createLevelQuantityReader(admin, "on_hand")(
      LOCATION,
      [item(1), item(2)],
    );

    expect([...quantities]).toEqual([
      [item(1), 12],
      [item(2), 0],
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].variables).toEqual({
      ids: [item(1), item(2)],
      locationId: LOCATION,
      names: ["on_hand"],
    });
  });

  it("reads negative quantities as they are", async () => {
    const { admin } = adminReturning(() => [level(item(1), "available", -4)]);

    const quantities = await createLevelQuantityReader(admin, "available")(
      LOCATION,
      [item(1)],
    );

    expect(quantities.get(item(1))).toBe(-4);
  });

  it("reports an item that is not stocked at the location as unknown, never as zero", async () => {
    const { admin } = adminReturning(() => [
      { id: item(1), inventoryLevel: null },
      null,
      level(item(3), "on_hand", 7),
    ]);

    const quantities = await createLevelQuantityReader(admin, "on_hand")(
      LOCATION,
      [item(1), item(2), item(3)],
    );

    expect([...quantities]).toEqual([
      [item(1), null],
      [item(2), null],
      [item(3), 7],
    ]);
  });

  it("ignores a quantity under another name, a fractional quantity and an item it did not ask for", async () => {
    const { admin } = adminReturning(() => [
      level(item(1), "available", 9),
      level(item(2), "on_hand", 2.5),
      level(item(99), "on_hand", 40),
    ]);

    const quantities = await createLevelQuantityReader(admin, "on_hand")(
      LOCATION,
      [item(1), item(2)],
    );

    expect([...quantities]).toEqual([
      [item(1), null],
      [item(2), null],
    ]);
  });

  it("asks for each item once, 100 items to a request", async () => {
    const ids = Array.from({ length: 250 }, (_, index) => item(index + 1));
    const { admin, calls } = adminReturning(({ variables }) =>
      variables.ids.map((id) => level(id, "on_hand", 1)),
    );

    const quantities = await createLevelQuantityReader(admin, "on_hand")(
      LOCATION,
      [...ids, item(1), item(250)],
    );

    expect(calls.map((call) => call.variables.ids.length)).toEqual([
      100, 100, 50,
    ]);
    expect(calls.flatMap((call) => call.variables.ids)).toEqual(ids);
    expect(quantities.size).toBe(250);
    expect([...quantities.values()].every((quantity) => quantity === 1)).toBe(
      true,
    );
  });

  it("makes no request when there is nothing to read", async () => {
    const { admin, calls } = adminReturning(() => []);

    const quantities = await createLevelQuantityReader(admin, "on_hand")(
      LOCATION,
      [],
    );

    expect(quantities.size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("fails the whole read when Shopify refuses a request, rather than returning part of it", async () => {
    const ids = Array.from({ length: 150 }, (_, index) => item(index + 1));
    const { admin } = adminReturning(({ variables }) =>
      variables.ids.includes(item(101))
        ? new Error("Internal error")
        : variables.ids.map((id) => level(id, "on_hand", 1)),
    );

    await expect(
      createLevelQuantityReader(admin, "on_hand")(LOCATION, ids),
    ).rejects.toThrow("Internal error");
  });
});

describe("createAvailableQuantityReader", () => {
  it("reads the sellable quantity", async () => {
    const { admin, calls } = adminReturning(() => [
      level(item(1), "available", 3),
    ]);

    const quantities = await createAvailableQuantityReader(admin)(LOCATION, [
      item(1),
    ]);

    expect(quantities.get(item(1))).toBe(3);
    expect(calls[0].variables.names).toEqual(["available"]);
  });
});
