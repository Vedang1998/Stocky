const UNSIGNED_DECIMAL_TOKEN = /^[0-9]+$/;

export type CountTokenValidation =
  | { ok: true; token: string }
  | {
      ok: false;
      reason: "count_token_missing_or_malformed";
      token: string | null;
    };

export function validateUnsignedCountToken(
  token: string | null | undefined,
): CountTokenValidation {
  if (typeof token !== "string" || !UNSIGNED_DECIMAL_TOKEN.test(token)) {
    return {
      ok: false,
      reason: "count_token_missing_or_malformed",
      token: token ?? null,
    };
  }
  return { ok: true, token };
}

export function compareUnsignedCountToken(
  expected: string | null | undefined,
  observed: bigint,
): { ok: true } | { ok: false; expected: string | null; observed: string } {
  const validated = validateUnsignedCountToken(expected);
  const observedToken = observed.toString(10);
  if (!validated.ok || validated.token !== observedToken) {
    return {
      ok: false,
      expected: validated.ok ? validated.token : validated.token,
      observed: observedToken,
    };
  }
  return { ok: true };
}

export { UNSIGNED_DECIMAL_TOKEN };
