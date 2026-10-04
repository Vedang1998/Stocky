/**
 * Restricted privacy principals. Production requires an explicit erasure URL.
 * Disposable tests may SET ROLE from the migration owner.
 */
import { Client } from "pg";

export type PrivacyPrincipal =
  | "stocky_privacy_erasure"
  | "stocky_privacy_reader"
  | "stocky_privacy_operator";

function principalUrl(role: PrivacyPrincipal): string | undefined {
  if (role === "stocky_privacy_erasure") {
    return process.env.STOCKY_PRIVACY_ERASURE_DATABASE_URL;
  }
  if (role === "stocky_privacy_reader") {
    return process.env.STOCKY_PRIVACY_READER_DATABASE_URL;
  }
  return process.env.STOCKY_PRIVACY_OPERATOR_DATABASE_URL;
}

export async function withPrivacyPrincipal<T>(
  role: PrivacyPrincipal,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const dedicated = principalUrl(role);
  const url =
    dedicated ??
    process.env.DATABASE_MIGRATION_URL ??
    process.env.TENANT_MAINTENANCE_DATABASE_URL ??
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(`privacy_principal_url_missing:${role}`);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    if (!dedicated) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`privacy_principal_url_required:${role}`);
      }
      await client.query(`SET ROLE ${role}`);
    }
    return await fn(client);
  } finally {
    await client.end();
  }
}
