import { Client } from "pg";

export type AdmissionPrincipal =
  | "stocky_original_admission"
  | "stocky_admin_capture";

function urlFor(role: AdmissionPrincipal): string | undefined {
  if (role === "stocky_original_admission") {
    return process.env.STOCKY_ORIGINAL_ADMISSION_DATABASE_URL;
  }
  return process.env.STOCKY_ADMIN_CAPTURE_DATABASE_URL;
}

export async function withAdmissionPrincipal<T>(
  role: AdmissionPrincipal,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const dedicated = urlFor(role);
  const url =
    dedicated ??
    process.env.DATABASE_MIGRATION_URL ??
    process.env.TENANT_MAINTENANCE_DATABASE_URL ??
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(`admission_principal_url_missing:${role}`);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    if (!dedicated) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`admission_principal_url_required:${role}`);
      }
      // SECURITY DEFINER helpers authenticate the login via session_user.
      // SET ROLE does not change session_user; SET SESSION AUTHORIZATION does.
      await client.query(`SET SESSION AUTHORIZATION ${role}`);
    }
    return await fn(client);
  } finally {
    await client.end();
  }
}
