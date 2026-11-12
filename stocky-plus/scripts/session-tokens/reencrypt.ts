/**
 * Encrypts stored Shopify tokens with the current SESSION_TOKEN_ENCRYPTION_KEY.
 *
 *   npm run session-tokens:reencrypt
 *
 * Run it once after the key is first set, and again after a new key is put in
 * front of the old one. When it reports no rewritten rows the old key can be
 * removed. Safe to repeat and to run while the app is serving.
 */
import { reencryptSessionTokens } from "../../app/tenant/bootstrap.server";

reencryptSessionTokens()
  .then(({ sessions, rewritten }) => {
    console.log(
      JSON.stringify({ event: "session_tokens_reencrypted", sessions, rewritten }),
    );
    process.exit(0);
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
