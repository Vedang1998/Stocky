import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import {
  SessionTokenError,
  type SessionTokenCipher,
} from "./cipher.server";

/**
 * Session storage that keeps access and refresh tokens encrypted at rest.
 *
 * Tokens are sealed on the way in and opened on the way out, so the Shopify
 * library and the rest of the app only ever see the tokens Shopify issued.
 * With no cipher (local development without a key) it stores sessions as the
 * wrapped storage would.
 *
 * A token that fails authentication is treated as a missing session: the
 * library then obtains a fresh one, which overwrites the bad row. A token
 * written with a key this process does not have is a configuration error and
 * is thrown, because answering "no session" would have every shop
 * re-authorise and store tokens under the wrong key.
 */
export function encryptedSessionStorage(
  inner: SessionStorage,
  cipher: SessionTokenCipher | null,
): SessionStorage {
  if (!cipher) return inner;

  function sealed(session: Session): Session {
    return new Session({
      ...session.toObject(),
      accessToken:
        session.accessToken === undefined
          ? undefined
          : cipher!.seal(session.id, session.accessToken),
      refreshToken:
        session.refreshToken === undefined
          ? undefined
          : cipher!.seal(session.id, session.refreshToken),
    });
  }

  function opened(session: Session): Session | undefined {
    try {
      if (session.accessToken !== undefined) {
        session.accessToken = cipher!.open(session.id, session.accessToken);
      }
      if (session.refreshToken !== undefined) {
        session.refreshToken = cipher!.open(session.id, session.refreshToken);
      }
      return session;
    } catch (error) {
      if (error instanceof SessionTokenError && error.code === "token_corrupt") {
        console.error(
          `Stored tokens of session ${session.id} could not be read (${error.message}); treating the session as missing`,
        );
        return undefined;
      }
      throw error;
    }
  }

  return {
    storeSession: (session) => inner.storeSession(sealed(session)),
    loadSession: async (id) => {
      const session = await inner.loadSession(id);
      return session ? opened(session) : undefined;
    },
    findSessionsByShop: async (shop) => {
      const sessions = await inner.findSessionsByShop(shop);
      return sessions.flatMap((session) => opened(session) ?? []);
    },
    deleteSession: (id) => inner.deleteSession(id),
    deleteSessions: (ids) => inner.deleteSessions(ids),
  };
}
