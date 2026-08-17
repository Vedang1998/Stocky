/**
 * Platform catalog observation generation allocator.
 *
 * PostgreSQL sequence stocky_catalog_observation_gen_seq: NO CYCLE, never
 * stored on Shop, gaps allowed, request/response generations may burn.
 * Returns bigint — never a JavaScript Number.
 */
export type GenerationQueryRaw = {
  $queryRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

export async function allocateCatalogObservationGeneration(
  db: GenerationQueryRaw,
): Promise<bigint> {
  const rows = (await db.$queryRaw`
    SELECT nextval('stocky_catalog_observation_gen_seq') AS gen
  `) as Array<{ gen: bigint | string | number }>;
  const raw = rows[0]?.gen;
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "string" && raw !== "") return BigInt(raw);
  throw new Error(
    "Catalog observation generation must be returned as bigint (not Number)",
  );
}
