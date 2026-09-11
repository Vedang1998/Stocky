import { CURRENT_APP_INSTALLATION_ACCESS_SCOPES_QUERY } from "./documents";
import { executeBudgetedQuery } from "./budgeted-execute";
import { OrderFactReadWalkError } from "./errors";
import { requireNonEmptyString } from "./decimal";
import { createRequestCostAccumulator, walkErrorToResult } from "./result";
import { assertTrustedOrderAdminReadContext } from "./tenant";
import { ORDER_ADMIN_READ_MAX_REQUESTS } from "./constants";
import type {
  AccessScopeSnapshot,
  OrderAdminReadContext,
  OrderReadResult,
} from "./types";

type ScopesQueryData = {
  currentAppInstallation?: {
    accessScopes?: Array<{ handle?: unknown } | null> | null;
  } | null;
};

/**
 * QUERY-only granted-scope read (addendum -10).
 * Static TOML requested scopes are not absence evidence.
 * No live merchant/store call is issued by tests; production callers supply
 * the trusted installed-app Admin client.
 */
export async function readCurrentAppInstallationAccessScopes(
  context: OrderAdminReadContext,
): Promise<OrderReadResult<AccessScopeSnapshot>> {
  const cost = createRequestCostAccumulator();
  try {
    await assertTrustedOrderAdminReadContext(context);
    const json = await executeBudgetedQuery<ScopesQueryData>(
      context.admin,
      CURRENT_APP_INSTALLATION_ACCESS_SCOPES_QUERY,
      undefined,
      cost,
      ORDER_ADMIN_READ_MAX_REQUESTS,
    );
    const scopes = json.data?.currentAppInstallation?.accessScopes;
    if (!Array.isArray(scopes)) {
      throw new OrderFactReadWalkError(
        "ADMIN_READ_ERROR",
        "currentAppInstallation.accessScopes missing from Admin response",
      );
    }
    const handles = scopes.map((scope, index) =>
      requireNonEmptyString(
        scope?.handle,
        `currentAppInstallation.accessScopes[${index}].handle`,
      ),
    );
    return {
      status: "complete",
      value: { handles },
      cost,
    };
  } catch (error) {
    return walkErrorToResult(error, cost);
  }
}
