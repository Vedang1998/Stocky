import type { TenantDb } from "../tenant/tenant-db.server";

export async function processBomSale(
  db: TenantDb,
  bundleVariantId: string,
  quantitySold: number,
) {
  const components = await db.bomComponent.findMany({
    where: { bundleVariantId },
  });

  return components.map(
    (c: {
      componentVariantId: string;
      quantity: { toString(): string } | number;
    }) => ({
      componentVariantId: c.componentVariantId,
      quantityToDecrement: Number(c.quantity) * quantitySold,
    }),
  );
}
