import type { OrderAdminReadClient, TrustedShopIdentity } from "../admin-read";
import { allocateResponseGeneration } from "./observations";
import type { OrderApplyReceiptInput } from "../apply/types";
import type { OrderSourceKind } from "../types";
import {
  TERMINAL_TRANSACTION_STATUSES,
  isLegacyOrderWebhookTopic,
  isOrderFactsWebhookTopic,
  type OrderFactsWebhookTopic,
} from "./constants";
import { OrderFactsIdentityError, OrderFactsSyncError } from "./errors";
import {
  applyCanonicalAndLegacy,
  persistIncompleteWithoutReceipt,
  probeReceiptBeforeShopifyIo,
  type OrderFactsTxnHost,
} from "./apply-composition";
import {
  extractEditedOrderIdentity,
  extractOrderGidFromDeleteProjection,
  extractOrderGidFromLegacyProjection,
  extractRefundIdentity,
  extractTransactionIdentity,
  assertNotWebhookDeliveryId,
} from "./identity";
import {
  abandonActiveObservation,
  beginDirectOrderObservation,
} from "./observations";
import {
  mapOrderReadToObservation,
  mapRefundReadToObservation,
  persistObservationScopesAndShopMetadata,
  readGrantedAccessScopes,
  readOrderFact,
  readRefundFact,
  readShopTimezoneCurrencyOrThrow,
} from "./refetch";
import { dispatchOrderFactsSchema } from "./schema-dispatch";
import { recordOrderFactsDataIssue } from "./control-plane";
import type {
  LegacyWebhookRunner,
  OrderFactsWebhookResult,
  WebhookDeliveryWork,
} from "./types";

export type ProcessOrderFactsWebhookInput = {
  db: OrderFactsTxnHost;
  admin: OrderAdminReadClient;
  shop: TrustedShopIdentity;
  work: WebhookDeliveryWork;
  runLegacy?: LegacyWebhookRunner;
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
};

function sourceKindFor(topic: OrderFactsWebhookTopic): OrderSourceKind {
  if (topic === "orders/delete") return "DELETE_WEBHOOK";
  if (topic === "order_transactions/create") return "TRANSACTION_WEBHOOK";
  return "INCREMENTAL_REFETCH";
}

function receiptOf(work: WebhookDeliveryWork): OrderApplyReceiptInput {
  return {
    applicationKey: work.applicationKey,
    sourceJobType: work.sourceJobType,
    rootDurableJobId: work.rootDurableJobId,
    applyingDurableJobId: work.applyingDurableJobId,
    payloadDigest: work.payloadDigest,
  };
}

function webhookDeliveryIdFromKey(applicationKey: string): string | null {
  const prefix = "webhook-delivery:";
  return applicationKey.startsWith(prefix)
    ? applicationKey.slice(prefix.length)
    : null;
}

export async function processOrderFactsWebhookJob(
  input: ProcessOrderFactsWebhookInput,
): Promise<OrderFactsWebhookResult> {
  const topic = input.work.topic;
  if (!isOrderFactsWebhookTopic(topic)) {
    throw new OrderFactsSyncError(
      "order_facts_topic_unsupported",
      `Not an order-facts webhook topic: ${topic}`,
    );
  }

  const lane = dispatchOrderFactsSchema({
    topic,
    payloadSchemaVersion: input.work.payloadSchemaVersion,
  });
  if (lane === "quarantine") {
    return {
      status: "noop",
      reason: "quarantine_requires_window_sweep",
      orderGid: null,
      refundGid: null,
    };
  }

  const deliveryId = webhookDeliveryIdFromKey(input.work.applicationKey);
  const receipt = receiptOf(input.work);
  const probed = await probeReceiptBeforeShopifyIo(
    input.db,
    input.work.shopId,
    receipt,
  );
  if (probed === "already_applied") {
    return {
      status: "already_applied",
      reason: "already_applied",
      orderGid: null,
      refundGid: null,
    };
  }

  const observedAt = input.work.receivedAt;
  let resourceKind: "Order" | "Refund" = "Order";
  let shopifyGid: string;
  let enclosingOrderGid: string | null = null;
  let deleteWebhook = false;
  let sourceKind = sourceKindFor(topic);

  if (lane === "legacy_v1" && topic === "refunds/create") {
    const identity = extractRefundIdentity(input.work.projection);
    assertNotWebhookDeliveryId(identity.refundGid, deliveryId);
    resourceKind = "Refund";
    shopifyGid = identity.refundGid;
    enclosingOrderGid = identity.enclosingOrderGid;
  } else if (lane === "legacy_v1") {
    shopifyGid = extractOrderGidFromLegacyProjection(input.work.projection);
    assertNotWebhookDeliveryId(shopifyGid, deliveryId);
  } else if (lane === "edited_v1") {
    const edited = extractEditedOrderIdentity(input.work.projection);
    assertNotWebhookDeliveryId(edited.orderGid, deliveryId);
    shopifyGid = edited.orderGid;
    sourceKind = "INCREMENTAL_REFETCH";
  } else if (lane === "delete_v1") {
    shopifyGid = extractOrderGidFromDeleteProjection(input.work.projection);
    assertNotWebhookDeliveryId(shopifyGid, deliveryId);
    deleteWebhook = true;
    sourceKind = "DELETE_WEBHOOK";
  } else {
    const txn = extractTransactionIdentity(input.work.projection);
    assertNotWebhookDeliveryId(txn.orderGid, deliveryId);
    if (
      !(TERMINAL_TRANSACTION_STATUSES as readonly string[]).includes(txn.status)
    ) {
      throw new OrderFactsIdentityError(
        `order_transactions/create status ${txn.status} is not a terminal settlement signal`,
      );
    }
    shopifyGid = txn.orderGid;
    sourceKind = "TRANSACTION_WEBHOOK";
  }

  const context = { admin: input.admin, shop: input.shop };
  const handle = await input.db.$transaction((tx) =>
    beginDirectOrderObservation(tx, {
      shopId: input.work.shopId,
      resourceKind,
      shopifyGid,
      leaseDurationMs: input.work.leaseDurationMs,
      durableJobId: input.work.durableJobId,
      jobAttemptId: input.work.jobAttemptId,
      correlationId: input.work.correlationId,
    }),
  );

  try {
    const scopes = await readGrantedAccessScopes(context);
    const shopMetadata = await readShopTimezoneCurrencyOrThrow(context);
    await input.db.$transaction((tx) =>
      persistObservationScopesAndShopMetadata({
        db: tx,
        shopId: input.work.shopId,
        handle,
        scopes,
        shopMetadata,
      }),
    );

    const readResult =
      resourceKind === "Order"
        ? await readOrderFact(context, shopifyGid)
        : await readRefundFact(context, shopifyGid, {
            orderCurrencyCode: shopMetadata.currencyCode,
          });

    const mapped = await input.db.$transaction((tx) =>
      resourceKind === "Order"
        ? mapOrderReadToObservation({
            db: tx,
            shopId: input.work.shopId,
            handle,
            read: readResult as Awaited<ReturnType<typeof readOrderFact>>,
            scopes,
            sourceKind,
            observedAt,
            deleteWebhook,
          })
        : mapRefundReadToObservation({
            db: tx,
            shopId: input.work.shopId,
            handle,
            read: readResult as Awaited<ReturnType<typeof readRefundFact>>,
            scopes,
            sourceKind,
            observedAt,
            enclosingOrderGid,
          }),
    );

    if (mapped.status === "noop") {
      await input.db.$transaction((tx) =>
        abandonActiveObservation(tx, {
          shopId: input.work.shopId,
          token: handle.token,
          requestGen: handle.requestGen,
          failureCode: mapped.reason,
        }),
      );
      return {
        status: "noop",
        reason: mapped.reason,
        orderGid: resourceKind === "Order" ? shopifyGid : enclosingOrderGid,
        refundGid: resourceKind === "Refund" ? shopifyGid : null,
      };
    }
    if (mapped.status === "incomplete" || mapped.status === "failure") {
      const responseGen = await input.db.$transaction((tx) =>
        allocateResponseGeneration(tx, handle.requestGen),
      );
      await persistIncompleteWithoutReceipt({
        db: input.db,
        shopId: input.work.shopId,
        token: handle.token,
        requestGen: handle.requestGen,
        responseGen,
      });
      return {
        status: "incomplete",
        reason: mapped.reason,
        orderGid: resourceKind === "Order" ? shopifyGid : enclosingOrderGid,
        refundGid: resourceKind === "Refund" ? shopifyGid : null,
      };
    }
    if (mapped.status === "blocked") {
      if (mapped.code === "scope_continuity_denies_absence") {
        await recordOrderFactsDataIssue({
          shopId: input.work.shopId,
          reasonCode: "order_facts_scope_continuity",
          redactedEvidence: { shopifyGid, topic: input.work.topic },
        });
      }
      await input.db.$transaction((tx) =>
        abandonActiveObservation(tx, {
          shopId: input.work.shopId,
          token: handle.token,
          requestGen: handle.requestGen,
          failureCode: mapped.status,
        }),
      );
      return {
        status: "blocked",
        reason: mapped.reason,
        orderGid: resourceKind === "Order" ? shopifyGid : enclosingOrderGid,
        refundGid: resourceKind === "Refund" ? shopifyGid : null,
      };
    }
    if (mapped.status !== "observation") {
      throw new OrderFactsSyncError(
        "order_facts_map_status_unknown",
        "Order fact mapper returned an unusable status",
      );
    }

    return applyCanonicalAndLegacy({
      db: input.db,
      shopId: input.work.shopId,
      observation: mapped.observation,
      receipt,
      topic: input.work.topic,
      projection: input.work.projection,
      runLegacy: isLegacyOrderWebhookTopic(input.work.topic)
        ? input.runLegacy
        : undefined,
      requestedCanonicalIdentitiesPerTransaction:
        input.requestedCanonicalIdentitiesPerTransaction,
      configuredWorstCaseConcurrentCanonicalTransactions:
        input.configuredWorstCaseConcurrentCanonicalTransactions,
    });
  } catch (error) {
    await input.db
      .$transaction((tx) =>
        abandonActiveObservation(tx, {
          shopId: input.work.shopId,
          token: handle.token,
          requestGen: handle.requestGen,
          failureCode:
            error instanceof Error ? error.name : "order_facts_sync_error",
        }),
      )
      .catch(() => undefined);
    throw error;
  }
}
