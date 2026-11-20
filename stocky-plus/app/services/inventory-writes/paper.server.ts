/**
 * What the routes that print a transfer or a count share: how the shop is
 * named and what its clock says, and the plain-text answer for a paper that
 * cannot be printed.
 */
import { readShopProfile } from "../purchasing/shop-profile.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";

export interface PaperSetting {
  shopName: string | null;
  /** The shop's IANA time zone; null prints times in UTC. */
  timeZone: string | null;
}

/**
 * The shop's name and time zone from Shopify. A paper still prints when
 * Shopify does not answer: it then carries no shop name and gives times in
 * UTC. A response thrown on the way (a sign-in bounce) is passed on.
 */
export async function readPaperSetting(
  admin: AdminGraphQLClient,
): Promise<PaperSetting> {
  try {
    const profile = await readShopProfile(admin);
    return { shopName: profile.name, timeZone: profile.ianaTimezone };
  } catch (thrown) {
    if (thrown instanceof Response) throw thrown;
    return { shopName: null, timeZone: null };
  }
}

/** A sentence in place of a paper, never cached and never sniffed into another type. */
export function paperRefusal(text: string, status: number): Response {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
