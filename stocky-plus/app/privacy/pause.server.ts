/**
 * PR7 privacy pause kill switch. When set, authenticated intake still persists
 * a durable request with pauseHonored=true; processors do not apply erasure.
 * This is not a substitute for generation fencing or residual verification.
 */
export const FEATURE_PR7_PRIVACY_PAUSE = "FEATURE_PR7_PRIVACY_PAUSE";

export function isPrivacyPauseEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[FEATURE_PR7_PRIVACY_PAUSE];
  if (raw == null) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
