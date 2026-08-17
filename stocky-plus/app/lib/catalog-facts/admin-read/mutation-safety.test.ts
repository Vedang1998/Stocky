import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { executeAdminReadQuery } from "./execute";
import {
  assertCanonicalReadDocument,
  CanonicalReadForbiddenFieldError,
  CanonicalReadGraphQLSyntaxError,
  CanonicalReadMutationRejectedError,
} from "./safety/graphql-ast";
import { scanCatalogFactsProductionModules } from "./safety/scan";
import { createMockAdmin } from "./__tests__/mock-admin";

const PLANTED_MUTATION = `#graphql
  mutation PlantedInventoryBulkToggleActivation(
    $inventoryItemId: ID!
    $inventoryItemUpdates: [InventoryBulkToggleActivationInput!]!
  ) {
    inventoryBulkToggleActivation(
      inventoryItemId: $inventoryItemId
      inventoryItemUpdates: $inventoryItemUpdates
    ) {
      inventoryItem {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const ALLOWED_PREFIX_QUERY = `#graphql
  query AllowedInventoryAndProductPrefixes(
    $inventoryItemId: ID!
    $productId: ID!
  ) {
    inventoryItem(id: $inventoryItemId) {
      id
    }
    product(id: $productId) {
      id
    }
  }
`;

describe("PR5-F2A GraphQL AST mutation safety (R-138)", () => {
  it("rejects inventoryBulkToggleActivation because the operation is a mutation", () => {
    expect(() => assertCanonicalReadDocument(PLANTED_MUTATION)).toThrow(
      CanonicalReadMutationRejectedError,
    );
    try {
      assertCanonicalReadDocument(PLANTED_MUTATION);
    } catch (error) {
      expect(error).toBeInstanceOf(CanonicalReadMutationRejectedError);
      if (error instanceof CanonicalReadMutationRejectedError) {
        expect(error.operation).toBe("mutation");
        expect(error.rootFieldNames).toContain("inventoryBulkToggleActivation");
      }
    }
  });

  it("permits QUERY fields that share inventory/product prefixes", () => {
    expect(() => assertCanonicalReadDocument(ALLOWED_PREFIX_QUERY)).not.toThrow();
  });

  it("rejects currentBulkOperation via GraphQL field AST, not substring policy", () => {
    const document = `#graphql
      query ForbiddenCurrentBulk {
        currentBulkOperation {
          id
        }
      }
    `;
    expect(() => assertCanonicalReadDocument(document)).toThrow(
      CanonicalReadForbiddenFieldError,
    );
  });

  it("fails on a deliberately invalid GraphQL document", () => {
    expect(() => assertCanonicalReadDocument("query {")).toThrow(
      CanonicalReadGraphQLSyntaxError,
    );
  });

  it("does not send a mutation to the Admin client", async () => {
    const admin = createMockAdmin(() => {
      throw new Error("Admin client must not be called for mutations");
    });
    await expect(
      executeAdminReadQuery(admin, PLANTED_MUTATION),
    ).rejects.toBeInstanceOf(CanonicalReadMutationRejectedError);
    expect(admin.calls).toEqual([]);
  });
});

describe("PR5-F2A recursive production-module scan (R-163)", () => {
  const catalogFactsDir = path.dirname(fileURLToPath(import.meta.url));

  it("enumerates nested production modules under admin-read/safety", () => {
    const result = scanCatalogFactsProductionModules(
      path.dirname(catalogFactsDir),
    );
    expect(result.relativeFiles.some((file) => file.includes("admin-read/"))).toBe(
      true,
    );
    expect(
      result.relativeFiles.some((file) => file.includes("admin-read/safety/scan.ts")),
    ).toBe(true);
    expect(
      result.relativeFiles.some((file) =>
        file.includes("admin-read/safety/graphql-ast.ts"),
      ),
    ).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("fails when inventoryBulkToggleActivation is planted in a nested production module", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pr5-f2a-planted-"));
    const nestedPlanted = path.join(
      root,
      "admin-read",
      "safety",
      "__planted_mutation__.ts",
    );
    try {
      mkdirSync(path.dirname(nestedPlanted), { recursive: true });
      writeFileSync(
        nestedPlanted,
        `export const planted = \`${PLANTED_MUTATION}\`;\n`,
        "utf8",
      );
      const result = scanCatalogFactsProductionModules(root);
      expect(
        result.relativeFiles.some((file) =>
          file.includes("admin-read/safety/__planted_mutation__.ts"),
        ),
      ).toBe(true);
      expect(
        result.findings.some(
          (finding) =>
            finding.kind === "mutation_rejected" &&
            finding.detail.includes("inventoryBulkToggleActivation"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
