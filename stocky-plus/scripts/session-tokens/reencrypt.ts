/**
 * Encrypts stored Shopify tokens with the current SESSION_TOKEN_ENCRYPTION_KEY.
 *
 *   npm run session-tokens:reencrypt
 *
 * Run it once after the key is first set, and again after a new key is put in
 * front of the old one. When a run reports nothing rewritten and nothing
 * unreadable, the old key can be removed. It exits 1 while any row is
 * unreadable. Safe to repeat and to run while the app is serving.
 */
import { reencryptSessionTokens } from "../../app/tenant/bootstrap.server";

reencryptSessionTokens()
  .then(({ sessions, rewritten, unreadable }) => {
    console.log(
      JSON.stringify({
        event: "session_tokens_reencrypted",
        sessions,
        rewritten,
        unreadable: unreadable.length,
        // Session ids, not tokens: the rows to look at before removing a key.
        unreadableSessionIds: unreadable,
      }),
    );
    process.exit(unreadable.length === 0 ? 0 : 1);
  })
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "session_tokens_reencrypt_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  });
