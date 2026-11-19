/**
 * One variant's planning levels in one stock scope: read for the edit form
 * in a worksheet row's detail, and saved from it. No page of its own.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getShopEntitlements, requireCapability } from "../billing/entitlements.server";
import type { LevelsActionResult, LevelsLoaderResult } from "../components/replenishment/types";
import {
  getVariantRule,
  parseVariantRuleForm,
  ReplenishmentRuleError,
  saveVariantRule,
} from "../lib/replenishment/rules.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({
  request,
  params,
}: LoaderFunctionArgs): Promise<LevelsLoaderResult> => {
  const { admin, db } = await requireAdminTenant({ request, params });
  requireCapability(await getShopEntitlements({ admin, db }), "core.replenishment");
  const search = new URL(request.url).searchParams;
  try {
    const values = await getVariantRule(
      db,
      search.get("variantGid") ?? "",
      search.get("scopeKey") ?? "",
    );
    return { ok: true, values };
  } catch (error) {
    if (error instanceof ReplenishmentRuleError) {
      return { ok: false, message: "These levels can't be loaded for this variant." };
    }
    throw error;
  }
};

export const action = async ({
  request,
  params,
}: ActionFunctionArgs): Promise<LevelsActionResult> => {
  const { admin, db } = await requireAdminTenant({ request, params });
  requireCapability(await getShopEntitlements({ admin, db }), "core.replenishment");
  const parsed = parseVariantRuleForm(await request.formData());
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  try {
    const outcome = await saveVariantRule(db, parsed);
    return { ok: true, outcome };
  } catch (error) {
    if (error instanceof ReplenishmentRuleError) {
      return { ok: false, errors: {}, message: error.message };
    }
    throw error;
  }
};
