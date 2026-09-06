import type { TenantAuthority } from "../../../tenant/authority.server";
import { createTenantDb } from "../../../tenant/tenant-db.server";
import { acquireCanonicalIdentityAdvisoryLock } from "../advisory-lock";
import type { CanonicalApplyDb } from "../apply";
import type { ParsedJsonlLine } from "./types";

export type CompleteProductCollectionSet = {
  productGid: string;
  memberships: Array<{ collectionGid: string; title: string }>;
};

/**
 * Shopify JSONL emits a root before all of its flattened children. Seeing the
 * next Product root proves the prior Product's collection child set ended.
 * Only one product set is retained in memory.
 */
export class ProductCollectionAccumulator {
  private current: CompleteProductCollectionSet | null = null;

  accept(lines: readonly ParsedJsonlLine[]): CompleteProductCollectionSet[] {
    const complete: CompleteProductCollectionSet[] = [];
    for (const line of lines) {
      if (line.resourceKind === "Product") {
        if (this.current) complete.push(this.current);
        this.current = {
          productGid: String(line.value.id),
          memberships: [],
        };
      } else if (line.resourceKind === "Collection") {
        const parent = line.value.__parentId;
        if (
          !this.current ||
          parent !== this.current.productGid ||
          typeof line.value.id !== "string" ||
          typeof line.value.title !== "string"
        ) {
          throw new Error("catalog_collection_parent_sequence_invalid");
        }
        this.current.memberships.push({
          collectionGid: line.value.id,
          title: line.value.title,
        });
      }
    }
    return complete;
  }

  finishCompleteStream(): CompleteProductCollectionSet[] {
    if (!this.current) return [];
    const current = this.current;
    this.current = null;
    return [current];
  }

  discardIncompleteStream(): void {
    this.current = null;
  }
}

export async function replaceProductCollectionMemberships(
  authority: TenantAuthority,
  set: CompleteProductCollectionSet,
): Promise<void> {
  const db = createTenantDb(authority);
  await db.$transaction(async (tx) => {
    await acquireCanonicalIdentityAdvisoryLock(
      tx as unknown as CanonicalApplyDb,
      {
        shopId: authority.shopId,
        resourceKind: "Product",
        shopifyGid: set.productGid,
      },
    );
    const collectionGids = [
      ...new Set(set.memberships.map((item) => item.collectionGid)),
    ];
    for (const membership of set.memberships) {
      await tx.shopifyProductCollectionMembership.upsert({
        where: {
          shopId_shopifyProductGid_shopifyCollectionGid: {
            shopId: authority.shopId,
            shopifyProductGid: set.productGid,
            shopifyCollectionGid: membership.collectionGid,
          },
        },
        create: {
          shopId: authority.shopId,
          shopifyProductGid: set.productGid,
          shopifyCollectionGid: membership.collectionGid,
          collectionTitleSnapshot: membership.title,
        },
        update: { collectionTitleSnapshot: membership.title },
      });
    }
    await tx.shopifyProductCollectionMembership.deleteMany({
      where: {
        shopifyProductGid: set.productGid,
        ...(collectionGids.length > 0
          ? { shopifyCollectionGid: { notIn: collectionGids } }
          : {}),
      },
    });
  });
}
