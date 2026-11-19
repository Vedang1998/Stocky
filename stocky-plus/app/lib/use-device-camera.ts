import { useSyncExternalStore } from "react";

const neverChanges = () => () => {};

/**
 * Shopify Mobile and POS expose the device camera to App Bridge; desktop
 * browsers do not. Read on the client only, so the server render and the
 * first client render agree.
 */
export function useDeviceCamera(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () =>
      typeof shopify !== "undefined" &&
      Boolean(shopify.environment.mobile || shopify.environment.pos),
    () => false,
  );
}
