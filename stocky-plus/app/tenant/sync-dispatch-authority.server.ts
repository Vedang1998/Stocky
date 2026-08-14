/**
 * Approved tenant-module authority issuer for sync control-plane dispatch.
 *
 * Architecture audit forbids calling issueTenantAuthority outside app/tenant/.
 * Sync dispatcher and envelope verification resolve branded authority here only.
 */
import {
  issueTenantAuthority,
  type IssueTenantAuthorityInput,
  type TenantAuthority,
} from "./authority.server";

/**
 * Issue branded authority for durable-job dispatch or verified envelope resolution.
 * Callers must already hold verified shop identity from control-plane records.
 */
export function issueSyncDispatchAuthority(
  input: IssueTenantAuthorityInput,
): TenantAuthority {
  return issueTenantAuthority(input);
}
