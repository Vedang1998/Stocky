import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertCanonicalCatalogDocumentForModule } from "./safety/graphql-ast";
import {
  assertCatalogFactsWorkerBoundarySafe,
  scanCatalogFactsProductionModules,
} from "./safety/scan";
import {
  BULK_OPERATION_SUBMITTER_MODULE_PATH,
  CATALOG_FACT_BULK_OPERATION_RUN_QUERY_MUTATION,
} from "../ingest/bulk-operation-submitter";

const roots: string[] = [];

function workerRoot(source: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "f3-worker-scan-"));
  roots.push(root);
  mkdirSync(path.join(root, "nested"), { recursive: true });
  writeFileSync(path.join(root, "nested", "worker.ts"), source);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("PR5-F3 exact mutation exception and two-root scanner", () => {
  it("allows bulkOperationRunQuery only in the exact submitter", () => {
    expect(() =>
      assertCanonicalCatalogDocumentForModule(
        CATALOG_FACT_BULK_OPERATION_RUN_QUERY_MUTATION,
        BULK_OPERATION_SUBMITTER_MODULE_PATH,
      ),
    ).not.toThrow();
  });

  it("rejects bulkOperationRunQuery in another ingest module", () => {
    expect(() =>
      assertCanonicalCatalogDocumentForModule(
        CATALOG_FACT_BULK_OPERATION_RUN_QUERY_MUTATION,
        "ingest/not-the-submitter.ts",
      ),
    ).toThrow(/rejects GraphQL mutation/);
  });

  it("rejects an inventory mutation even in the exact submitter", () => {
    expect(() =>
      assertCanonicalCatalogDocumentForModule(
        `mutation Bad($id: ID!) {
          inventoryBulkToggleActivation(inventoryItemId: $id) {
            userErrors { message }
          }
        }`,
        BULK_OPERATION_SUBMITTER_MODULE_PATH,
      ),
    ).toThrow(/inventoryBulkToggleActivation/);
  });

  it("finds a planted worker-tree mutation recursively", () => {
    const root = workerRoot(`
      export const operation = \`mutation Bad($id: ID!) {
        inventoryBulkToggleActivation(inventoryItemId: $id) {
          userErrors { message }
        }
      }\`;
    `);
    const result = scanCatalogFactsProductionModules(root, {
      policy: "worker",
    });
    expect(result.files).toHaveLength(1);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "mutation_rejected" }),
      ]),
    );
  });

  it("rejects a planted worker write-service import", () => {
    const root = workerRoot(
      `import { adjustShopifyInventory } from "../../../services/shopify-sync.server";`,
    );
    expect(() => assertCatalogFactsWorkerBoundarySafe(root)).toThrow(
      /forbidden_import/,
    );
  });

  it("permits only the legitimate unauthenticated worker import", () => {
    const root = workerRoot(
      `import { unauthenticated } from "../../../app/shopify.server";
       export const getAdmin = unauthenticated.admin;`,
    );
    expect(() => assertCatalogFactsWorkerBoundarySafe(root)).not.toThrow();
  });
});
