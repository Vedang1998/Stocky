import { describe, expect, it } from "vitest";
import { assertCanonicalReadDocument } from "../admin-read/safety/graphql-ast";
import { ORDER_FACTS_IMPORT_LEDGER_QUERY } from "./supplemental-ledger";

describe("PR6-D import ledger document", () => {
  it("is a canonical QUERY that lists refund identities without re-reading lines", () => {
    expect(() =>
      assertCanonicalReadDocument(ORDER_FACTS_IMPORT_LEDGER_QUERY),
    ).not.toThrow();
    expect(ORDER_FACTS_IMPORT_LEDGER_QUERY).toMatch(/query OrderFactsImportLedger/);
    expect(ORDER_FACTS_IMPORT_LEDGER_QUERY).toMatch(/refunds\s*\{/);
    expect(ORDER_FACTS_IMPORT_LEDGER_QUERY).not.toMatch(/lineItems/);
    expect(ORDER_FACTS_IMPORT_LEDGER_QUERY).not.toMatch(/\bcancellation\b/);
  });
});
