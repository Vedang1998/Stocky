import { describe, expect, it } from "vitest";
import { Kind, parse, visit } from "graphql";
import {
  CANONICAL_ADMIN_READ_QUERY_DOCUMENTS,
} from "./documents";
import { CANONICAL_BULK_QUERY_DOCUMENTS } from "./bulk-query-documents";
import { assertCanonicalReadDocument } from "./safety/graphql-ast";

const BULK_CONNECTION_FIELDS = new Set([
  "products",
  "variants",
  "collections",
  "inventoryItems",
  "inventoryLevels",
]);

function bulkConnectionMetrics(document: string) {
  const ast = parse(document);
  let connections = 0;
  let maxDepth = 0;

  visit(ast, {
    Field: {
      enter(node, _key, _parent, path, ancestors) {
        if (!BULK_CONNECTION_FIELDS.has(node.name.value)) return;
        connections += 1;
        let depth = 1;
        for (const ancestor of ancestors) {
          if (
            ancestor &&
            typeof ancestor === "object" &&
            "kind" in ancestor &&
            ancestor.kind === Kind.FIELD &&
            "name" in ancestor &&
            BULK_CONNECTION_FIELDS.has(
              (ancestor as { name: { value: string } }).name.value,
            )
          ) {
            depth += 1;
          }
        }
        maxDepth = Math.max(maxDepth, depth);
        void path;
      },
    },
  });

  return { connections, maxDepth };
}

describe("PR5-F2A GraphQL documents", () => {
  it("accepts every tagged Admin read document as a QUERY", () => {
    for (const document of CANONICAL_ADMIN_READ_QUERY_DOCUMENTS) {
      expect(() => assertCanonicalReadDocument(document)).not.toThrow();
      expect(document).not.toContain("currentBulkOperation");
      expect(document).not.toContain("bulkOperationRunQuery");
    }
  });

  it("accepts bulk query documents as QUERY operations within official connection limits", () => {
    for (const document of CANONICAL_BULK_QUERY_DOCUMENTS) {
      expect(() => assertCanonicalReadDocument(document)).not.toThrow();
      expect(document).not.toContain("currentBulkOperation");
      const { connections, maxDepth } = bulkConnectionMetrics(document);
      expect(connections).toBeGreaterThan(0);
      expect(connections).toBeLessThanOrEqual(5);
      expect(maxDepth).toBeLessThanOrEqual(2);
    }
  });

  it("keeps with-unitCost and no-unitCost catalog bulk shapes distinct", () => {
    const [withCost, withoutCost] = CANONICAL_BULK_QUERY_DOCUMENTS;
    expect(withCost).toContain("unitCost");
    expect(withoutCost).not.toMatch(/\bunitCost\b/);
  });
});
