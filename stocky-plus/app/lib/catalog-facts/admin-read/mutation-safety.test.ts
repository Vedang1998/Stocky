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
import {
  extractGraphQLDocumentsFromTypeScript,
  looksLikeGraphQLDocument,
  scanCatalogFactsProductionModules,
} from "./safety/scan";
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

  it("rejects an unexpected productVariantsBulkUpdate mutation before any Admin call", async () => {
    const document = `#graphql
      mutation UnexpectedProductVariantsBulkUpdate {
        productVariantsBulkUpdate(productId: "gid://shopify/Product/1", variants: []) {
          product { id }
        }
      }
    `;
    const admin = createMockAdmin(() => {
      throw new Error("Admin client must not be called for mutations");
    });
    await expect(executeAdminReadQuery(admin, document)).rejects.toBeInstanceOf(
      CanonicalReadMutationRejectedError,
    );
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

  it("fails closed on interpolated GraphQL mutations and comment-prefixed mutations", () => {
    const interpolatedSource = [
      "export const planted = `#graphql",
      "  mutation InterpolatedInventoryDeactivate {",
      '    ${"inventoryDeactivate"} {',
      "      inventoryItem { id }",
      "    }",
      "  }",
      "`;",
      "",
    ].join("\n");
    const extractedInterpolated =
      extractGraphQLDocumentsFromTypeScript(interpolatedSource);
    expect(extractedInterpolated.documents).toEqual([]);
    expect(extractedInterpolated.unreviewable.length).toBeGreaterThan(0);

    const commentPrefixed = `
# leading GraphQL comment
mutation CommentPrefixedInventoryDeactivate {
  inventoryDeactivate(inventoryItemId: "gid://shopify/InventoryItem/1") {
    inventoryItem { id }
  }
}
`;
    expect(looksLikeGraphQLDocument(commentPrefixed)).toBe(true);
    const extractedComment = extractGraphQLDocumentsFromTypeScript(
      `export const planted = \`${commentPrefixed}\`;\n`,
    );
    expect(extractedComment.documents.length).toBe(1);
    expect(() =>
      assertCanonicalReadDocument(extractedComment.documents[0]!),
    ).toThrow(CanonicalReadMutationRejectedError);

    const validQuery = `#graphql
      query StillAllowedProduct {
        product(id: "gid://shopify/Product/1") { id }
      }
    `;
    const extractedValid = extractGraphQLDocumentsFromTypeScript(
      `export const planted = \`${validQuery}\`;\n`,
    );
    expect(extractedValid.unreviewable).toEqual([]);
    expect(extractedValid.documents.length).toBe(1);
    expect(() =>
      assertCanonicalReadDocument(extractedValid.documents[0]!),
    ).not.toThrow();
  });

  it("rejects a Shopify write-service import not on the old two-name list", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pr5-f2a-service-import-"));
    const nestedPlanted = path.join(
      root,
      "admin-read",
      "safety",
      "nested",
      "deeper",
      "planted-write-import.ts",
    );
    try {
      mkdirSync(path.dirname(nestedPlanted), { recursive: true });
      writeFileSync(
        nestedPlanted,
        `import { writeInventory } from "../../../../../services/inventory-write.server";\nexport const n = writeInventory;\n`,
        "utf8",
      );
      const result = scanCatalogFactsProductionModules(root);
      expect(
        result.relativeFiles.some((file) =>
          file.includes("admin-read/safety/nested/deeper/planted-write-import.ts"),
        ),
      ).toBe(true);
      expect(
        result.findings.some(
          (finding) =>
            finding.kind === "forbidden_import" &&
            finding.detail.includes("inventory-write.server"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a direct @shopify package import in the canonical read boundary", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pr5-f2a-shopify-import-"));
    const nestedPlanted = path.join(
      root,
      "admin-read",
      "safety",
      "nested",
      "deeper",
      "planted-shopify-import.ts",
    );
    try {
      mkdirSync(path.dirname(nestedPlanted), { recursive: true });
      writeFileSync(
        nestedPlanted,
        `import { shopifyApi } from "@shopify/shopify-api";\nexport const n = shopifyApi;\n`,
        "utf8",
      );
      const result = scanCatalogFactsProductionModules(root);
      expect(
        result.findings.some(
          (finding) =>
            finding.kind === "forbidden_import" &&
            finding.detail.includes("@shopify/shopify-api"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects export ... from a forbidden @shopify module", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pr5-f2a-export-from-"));
    const nestedPlanted = path.join(
      root,
      "admin-read",
      "safety",
      "nested",
      "deeper",
      "planted-export-from.ts",
    );
    try {
      mkdirSync(path.dirname(nestedPlanted), { recursive: true });
      writeFileSync(
        nestedPlanted,
        `export { authenticate } from "@shopify/shopify-app-react-router/server";\n`,
        "utf8",
      );
      const result = scanCatalogFactsProductionModules(root);
      expect(
        result.findings.some(
          (finding) =>
            finding.kind === "forbidden_import" &&
            finding.detail.includes("@shopify/shopify-app-react-router/server"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a dynamic import of a forbidden @shopify module", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pr5-f2a-dynamic-import-"));
    const nestedPlanted = path.join(
      root,
      "admin-read",
      "safety",
      "nested",
      "deeper",
      "planted-dynamic-import.ts",
    );
    try {
      mkdirSync(path.dirname(nestedPlanted), { recursive: true });
      writeFileSync(
        nestedPlanted,
        `export async function load() {\n  const m = await import("@shopify/shopify-app-react-router/server");\n  return m;\n}\n`,
        "utf8",
      );
      const result = scanCatalogFactsProductionModules(root);
      expect(
        result.findings.some(
          (finding) =>
            finding.kind === "forbidden_import" &&
            finding.detail.includes("@shopify/shopify-app-react-router/server"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an absolute application service import", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pr5-f2a-abs-service-"));
    const nestedPlanted = path.join(
      root,
      "admin-read",
      "safety",
      "nested",
      "deeper",
      "planted-abs-service.ts",
    );
    try {
      mkdirSync(path.dirname(nestedPlanted), { recursive: true });
      writeFileSync(
        nestedPlanted,
        `import { writeInventory } from "app/services/inventory.server";\nexport const n = writeInventory;\n`,
        "utf8",
      );
      const result = scanCatalogFactsProductionModules(root);
      expect(
        result.findings.some(
          (finding) =>
            finding.kind === "forbidden_import" &&
            finding.detail.includes("app/services/inventory.server"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a require() bypass of the service import boundary", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pr5-f2a-require-"));
    const nestedPlanted = path.join(
      root,
      "admin-read",
      "safety",
      "nested",
      "deeper",
      "planted-require.ts",
    );
    try {
      mkdirSync(path.dirname(nestedPlanted), { recursive: true });
      writeFileSync(
        nestedPlanted,
        `const write = require("~/services/inventory-write.server");\nexport const n = write;\n`,
        "utf8",
      );
      const result = scanCatalogFactsProductionModules(root);
      expect(
        result.findings.some(
          (finding) =>
            finding.kind === "forbidden_import" &&
            finding.detail.includes("~/services/inventory-write.server"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("records a syntax finding for malformed mutation-shaped GraphQL", () => {
    const malformed = `mutation M { productUpdate(input: { } { id } }`;
    const extracted = extractGraphQLDocumentsFromTypeScript(
      `export const planted = \`${malformed}\`;\n`,
    );
    expect(extracted.documents).toEqual([]);
    expect(extracted.syntaxFailures.length).toBeGreaterThan(0);

    const root = mkdtempSync(path.join(os.tmpdir(), "pr5-f2a-syntax-"));
    const nestedPlanted = path.join(
      root,
      "admin-read",
      "safety",
      "nested",
      "deeper",
      "planted-malformed-graphql.ts",
    );
    try {
      mkdirSync(path.dirname(nestedPlanted), { recursive: true });
      writeFileSync(
        nestedPlanted,
        `export const planted = \`${malformed}\`;\n`,
        "utf8",
      );
      const result = scanCatalogFactsProductionModules(root);
      expect(
        result.findings.some(
          (finding) =>
            finding.kind === "syntax" &&
            finding.detail.includes("failed to parse"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("still accepts a valid nested QUERY fixture", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pr5-f2a-valid-query-"));
    const nestedPlanted = path.join(
      root,
      "admin-read",
      "safety",
      "nested",
      "deeper",
      "planted-valid-query.ts",
    );
    try {
      mkdirSync(path.dirname(nestedPlanted), { recursive: true });
      writeFileSync(
        nestedPlanted,
        `export const planted = \`#graphql
  query PlantedValidProduct {
    product(id: "gid://shopify/Product/1") { id }
  }
\`;\n`,
        "utf8",
      );
      const result = scanCatalogFactsProductionModules(root);
      expect(result.findings).toEqual([]);
      expect(result.graphqlDocumentCount).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
