import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * customers/data_request and customers/redact are answered with "no customer
 * data held". That answer is only true while the database has no column for
 * shopper details. A new column with a name like these fails this test until
 * it is either listed below as something else (staff, supplier, the store's
 * own location) or the two webhooks are taught to return and erase it.
 */
const PERSONAL_DATA_NAME =
  /customer|buyer|recipient|email|phone|firstname|lastname|address|birth/i;

const NOT_SHOPPER_DATA = [
  // Shopify staff account of the person using the app.
  "Session.firstName",
  "Session.lastName",
  "Session.email",
  "Session.emailVerified",
  // The merchant's own supplier contacts.
  "Supplier.contactEmail",
  "Supplier.contactPhone",
  // Street address of the merchant's stock location.
  "ShopifyLocationFact.address1",
];

function personalDataColumns(): string[] {
  const schema = readFileSync(
    fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)),
    "utf8",
  );
  const columns: string[] = [];
  for (const model of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    for (const line of model[2].split("\n")) {
      const field = /^\s+([A-Za-z_]\w*)\s+\S/.exec(line)?.[1];
      if (field && PERSONAL_DATA_NAME.test(field)) {
        columns.push(`${model[1]}.${field}`);
      }
    }
  }
  return columns;
}

describe("no customer data held", () => {
  it("holds for the current database schema", () => {
    expect(personalDataColumns().sort()).toEqual([...NOT_SHOPPER_DATA].sort());
  });
});
