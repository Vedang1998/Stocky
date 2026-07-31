import type { Client } from "pg";
import { normalizeIndexDef } from "./manifest";

export type InspectedIndex =
  | { status: "missing" }
  | {
      status: "present";
      valid: boolean;
      ready: boolean;
      unique: boolean;
      table: string;
      columns: string[];
      definition: string;
      definitionNormalized: string;
      indisvalid: boolean;
      indisready: boolean;
    };

export async function inspectIndex(
  client: Client,
  name: string,
): Promise<InspectedIndex> {
  const meta = await client.query<{
    table_name: string;
    indisunique: boolean;
    indisvalid: boolean;
    indisready: boolean;
    definition: string;
  }>(
    `
    SELECT
      t.relname AS table_name,
      i.indisunique,
      i.indisvalid,
      i.indisready,
      pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_class t ON i.indrelid = t.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = $1
    `,
    [name],
  );

  if (meta.rowCount === 0) {
    return { status: "missing" };
  }

  const row = meta.rows[0]!;
  const columnsResult = await client.query<{ attname: string }>(
    `
    SELECT a.attname
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a
      ON a.attrelid = i.indrelid
     AND a.attnum = k.attnum
     AND a.attnum > 0
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = $1
    ORDER BY k.ord
    `,
    [name],
  );

  const definition = row.definition;
  return {
    status: "present",
    valid: row.indisvalid,
    ready: row.indisready,
    unique: row.indisunique,
    table: row.table_name,
    columns: columnsResult.rows.map((r) => r.attname),
    definition,
    definitionNormalized: normalizeIndexDef(definition),
    indisvalid: row.indisvalid,
    indisready: row.indisready,
  };
}
