import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse, specifiedRules, validate } from "graphql";
import {
  CANONICAL_BULK_QUERY_DOCUMENTS,
  CATALOG_BULK_QUERY_NO_UNIT_COST,
  CATALOG_BULK_QUERY_WITH_UNIT_COST,
  INVENTORY_LEVEL_BULK_QUERY,
} from "./bulk-query-documents";
import {
  ADMIN_2026_07_SCHEMA_PATH,
  assertBulkQuerySchemaValid,
  bulkQueryValidationRules,
  loadGeneratedAdmin202607Schema,
  validateBulkQueryAgainstAdminSchema,
} from "./bulk-query-schema";
import {
  assertCanonicalReadDocument,
  CanonicalReadMutationRejectedError,
} from "./safety/graphql-ast";

const INVALID_BULK_QUERY_MISSING_CONNECTION_TRAVERSAL = `{
  products {
    id
    title
  }
}`;

const INVALID_BULK_QUERY_MISSING_QUANTITY_NAMES = `{
  inventoryItems {
    edges {
      node {
        id
        inventoryLevels(includeInactive: true) {
          edges {
            node {
              id
              quantities {
                name
                quantity
              }
            }
          }
        }
      }
    }
  }
}`;

const INVALID_BULK_QUERY_BAD_FIELD = `{
  products {
    edges {
      node {
        idDoesNotExistXyz
      }
    }
  }
}`;

const INVALID_BULK_QUERY_REQUIRED_FIRST = `{
  shop {
    productTags {
      edges {
        node
      }
    }
  }
}`;

const PLANTED_MUTATION = `#graphql
  mutation PlantedWrite {
    inventoryAdjustQuantities(input: { name: "available", reason: "correction", changes: [] }) {
      userErrors {
        field
        message
      }
    }
  }
`;

describe("PR5-F2A untagged bulk query Admin 2026-07 schema gate", () => {
  it("fails closed when the generated local schema artifact is absent", () => {
    const missingPath = "/tmp/pr5-f2a-absent-admin-2026-07.schema.json";
    expect(() => loadGeneratedAdmin202607Schema(missingPath)).toThrow(
      /absent at .*pr5-f2a-absent-admin-2026-07\.schema\.json/,
    );
    expect(() => loadGeneratedAdmin202607Schema(missingPath)).toThrow(
      /does not fetch shopify\.dev/,
    );

    const loaderSource = readFileSync(
      fileURLToPath(new URL("./bulk-query-schema.ts", import.meta.url)),
      "utf8",
    );
    const proxyNeedle = ["admin-graphql", "direct-proxy"].join("-");
    expect(loaderSource).not.toMatch(/\bfetch\s*\(/);
    expect(loaderSource).not.toContain(proxyNeedle);
    expect(loaderSource).not.toMatch(/https:\/\/shopify\.dev/);
  });

  it("uses stock specifiedRules rather than a pagination-argument relaxation", () => {
    expect(bulkQueryValidationRules).toBe(specifiedRules);
  });

  it(
    "validates every CANONICAL_BULK_QUERY_DOCUMENTS member against the generated local schema",
    () => {
      const loaded = loadGeneratedAdmin202607Schema();
      expect(loaded.source).toBe("file");
      expect(loaded.path).toBe(ADMIN_2026_07_SCHEMA_PATH);
      expect(loaded.path.endsWith("admin-2026-07.schema.json")).toBe(true);

      expect(CANONICAL_BULK_QUERY_DOCUMENTS).toHaveLength(3);
      for (const [index, document] of CANONICAL_BULK_QUERY_DOCUMENTS.entries()) {
        assertCanonicalReadDocument(document);
        const gateErrors = validateBulkQueryAgainstAdminSchema(
          loaded.schema,
          document,
        );
        expect(gateErrors, `document[${index}] schema errors`).toEqual([]);
        const stockErrors = validate(
          loaded.schema,
          parse(document),
          specifiedRules,
        );
        expect(stockErrors, `document[${index}] specifiedRules`).toEqual([]);
        assertBulkQuerySchemaValid(
          loaded.schema,
          document,
          `canonical bulk[${index}]`,
        );
      }

      expect(CATALOG_BULK_QUERY_WITH_UNIT_COST).toContain("unitCost");
      expect(CATALOG_BULK_QUERY_NO_UNIT_COST).not.toMatch(/\bunitCost\b/);
      expect(INVENTORY_LEVEL_BULK_QUERY).toContain("item {");
      expect(INVENTORY_LEVEL_BULK_QUERY).toContain('"quality_control"');
    },
    60_000,
  );

  it("rejects collapsed connection traversal", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    const invalidErrors = validateBulkQueryAgainstAdminSchema(
      schema,
      INVALID_BULK_QUERY_MISSING_CONNECTION_TRAVERSAL,
    );
    expect(invalidErrors.length).toBeGreaterThan(0);
    expect(
      invalidErrors.some((error) =>
        error.message.includes(
          'Cannot query field "id" on type "ProductConnection"',
        ),
      ),
    ).toBe(true);
  });

  it("rejects quantities without the required names argument", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    const errors = validateBulkQueryAgainstAdminSchema(
      schema,
      INVALID_BULK_QUERY_MISSING_QUANTITY_NAMES,
    );
    expect(
      errors.some((error) =>
        error.message.includes(
          'Field "quantities" argument "names" of type "[String!]!" is required, but it was not provided.',
        ),
      ),
    ).toBe(true);
  });

  it("rejects a field that does not exist on Product", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    const errors = validateBulkQueryAgainstAdminSchema(
      schema,
      INVALID_BULK_QUERY_BAD_FIELD,
    );
    expect(
      errors.some((error) =>
        error.message.includes(
          'Cannot query field "idDoesNotExistXyz" on type "Product"',
        ),
      ),
    ).toBe(true);
  });

  it("rejects a mutation document as a canonical bulk query", () => {
    expect(() => assertCanonicalReadDocument(PLANTED_MUTATION)).toThrow(
      CanonicalReadMutationRejectedError,
    );
    expect(() => assertCanonicalReadDocument(PLANTED_MUTATION)).toThrow(
      /inventoryAdjustQuantities/,
    );
  });

  it("still reports a schema-required first: Int! under specifiedRules", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    const gateErrors = validateBulkQueryAgainstAdminSchema(
      schema,
      INVALID_BULK_QUERY_REQUIRED_FIRST,
    );
    const stockErrors = validate(
      schema,
      parse(INVALID_BULK_QUERY_REQUIRED_FIRST),
      specifiedRules,
    );
    const requiredFirst = (message: string) =>
      message.includes(
        'Field "productTags" argument "first" of type "Int!" is required, but it was not provided.',
      );
    expect(gateErrors.some((error) => requiredFirst(error.message))).toBe(true);
    expect(stockErrors.some((error) => requiredFirst(error.message))).toBe(
      true,
    );
  });
});
