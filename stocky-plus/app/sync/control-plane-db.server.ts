/**
 * Control-plane Prisma client.
 *
 * Bound to DATABASE_CONTROL_PLANE_URL. Falls back to DATABASE_URL only when
 * STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK=1 (disposable tests).
 * Never expose as the general web/runtime Prisma client.
 */
import { PrismaClient } from "@prisma/client";
import { SyncControlPlaneError } from "./errors";

let controlPlanePrisma: PrismaClient | null = null;

export function resolveControlPlaneDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.DATABASE_CONTROL_PLANE_URL?.trim() || "";
  if (explicit) return explicit;

  const allowFallback = env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK === "1";
  const fallback = env.DATABASE_URL?.trim() || "";
  if (allowFallback && fallback) {
    return fallback;
  }

  throw new SyncControlPlaneError(
    "control_plane_url_missing",
    "DATABASE_CONTROL_PLANE_URL is required (set STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK=1 only for disposable tests)",
  );
}

/**
 * Narrow control-plane Prisma accessor. Do not re-export as default db.
 */
export function getControlPlanePrisma(
  env: NodeJS.ProcessEnv = process.env,
): PrismaClient {
  if (!controlPlanePrisma) {
    controlPlanePrisma = new PrismaClient({
      datasources: { db: { url: resolveControlPlaneDatabaseUrl(env) } },
    });
  }
  return controlPlanePrisma;
}

/** Test helper — drop cached client after schema reset. */
export async function resetControlPlanePrismaForTests(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("resetControlPlanePrismaForTests is forbidden in production");
  }
  if (controlPlanePrisma) {
    await controlPlanePrisma.$disconnect().catch(() => undefined);
    controlPlanePrisma = null;
  }
}
