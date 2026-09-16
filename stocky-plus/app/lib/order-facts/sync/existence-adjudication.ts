import { isWithinHistoryWindow } from "../apply/clocks";
import { ORDER_HISTORY_WINDOW_DAYS } from "../apply/constants";
import {
  lastValidLiveScopeFloor,
  scopeContinuityAllowsAbsence,
  scopesGrantReadAllOrders,
} from "../apply/existence";
import { DIAGNOSTIC } from "../apply/types";
import type { ExistenceAdjudication, ExistenceAdjudicationInput } from "./types";

/**
 * D-owned adjudication of B `null_observed`. B does not emit existence kinds.
 * Do not overwrite an established tombstone with inaccessible.
 */
export function adjudicateNullObserved(
  input: ExistenceAdjudicationInput,
): ExistenceAdjudication {
  if (!input.nullObserved || !input.queryCompleted) {
    return {
      apply: false,
      reason: "not_null_observed",
      diagnostic: null,
    };
  }

  if (input.storedKind === "ABSENT_CONFIRMED_QUERY") {
    return {
      apply: false,
      reason: "preserve_established_tombstone",
      diagnostic: null,
    };
  }

  // Delete webhooks are unverified signals. C will not invent a confirmed
  // tombstone from a webhook body, and will not insert absence with no row.
  if (input.deleteWebhook) {
    return {
      apply: true,
      existenceKind: "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
      diagnostic: DIAGNOSTIC.EXISTENCE_UNVERIFIABLE,
    };
  }

  const lastConfirmed = lastValidLiveScopeFloor(
    input.lastConfirmedScopes,
    input.currentScopes,
  );
  const inWindow = isWithinHistoryWindow({
    processedAt: input.processedAt,
    shopifyCreatedAt: input.shopifyCreatedAt,
    observedAt: input.observedAt,
    windowDays: input.windowDays ?? ORDER_HISTORY_WINDOW_DAYS,
    hasReadAllOrders: input.hasReadAllOrders || scopesGrantReadAllOrders(input.currentScopes),
  });

  if (!inWindow) {
    if (
      input.storedState === "ABSENT" ||
      input.storedKind === "INACCESSIBLE_HISTORY_WINDOW"
    ) {
      return {
        apply: false,
        reason: "preserve_established_tombstone",
        diagnostic: null,
      };
    }
    return {
      apply: true,
      existenceKind: "INACCESSIBLE_HISTORY_WINDOW",
      diagnostic: DIAGNOSTIC.WINDOW_TRUNCATED,
    };
  }

  const continuity = scopeContinuityAllowsAbsence({
    currentScopes: input.currentScopes,
    lastConfirmedScopes: lastConfirmed,
  });
  if (!continuity.ok) {
    return {
      apply: false,
      reason: "scope_continuity_denies_absence",
      diagnostic: continuity.diagnostic,
    };
  }

  return {
    apply: true,
    existenceKind: "ABSENT_CONFIRMED_QUERY",
    diagnostic: null,
  };
}

export function grantHandlesFromWebhookPayloadCurrent(
  payloadCurrent: unknown,
): never | readonly string[] {
  void payloadCurrent;
  throw new Error(
    "scopes_update.current is not granted-scope proof; use currentAppInstallation.accessScopes",
  );
}
